"""
RegIQ — backend/app/rag/generator.py
Day 53: LangChain Conversation Memory & ConversationalRetrievalChain

Upgrades the response generator to use LangChain's ConversationalRetrievalChain
paired with ConversationBufferWindowMemory and thread message history.
Enables multi-turn conversational follow-up questions (e.g. "What about for Maharashtra specifically?")
while preserving strict regulatory grounding rules.
"""

import os
import logging
from typing import List, Dict, Any, Tuple, Optional
from groq import AsyncGroq

# LangChain Imports with defensive fallbacks
try:
    from langchain_classic.chains.conversational_retrieval.base import ConversationalRetrievalChain
    from langchain_classic.memory import ConversationBufferWindowMemory
    from langchain_core.documents import Document
    from langchain_core.retrievers import BaseRetriever
    from langchain_core.prompts import PromptTemplate
    from langchain_groq import ChatGroq
    LANGCHAIN_AVAILABLE = True
except ImportError:
    try:
        from langchain.chains import ConversationalRetrievalChain # type: ignore
        from langchain.memory import ConversationBufferWindowMemory # type: ignore
        from langchain_core.documents import Document
        from langchain_core.retrievers import BaseRetriever
        from langchain_core.prompts import PromptTemplate
        from langchain_groq import ChatGroq
        LANGCHAIN_AVAILABLE = True
    except ImportError:
        ConversationalRetrievalChain = None
        ConversationBufferWindowMemory = None
        Document = None
        BaseRetriever = object
        PromptTemplate = None
        ChatGroq = None
        LANGCHAIN_AVAILABLE = False

# Safe LangFuse import for v4+
try:
    from langfuse.decorators import observe, langfuse_context
except ImportError:
    try:
        from langfuse import observe
        from langfuse._context import langfuse_context
    except ImportError:
        from langfuse import observe
        langfuse_context = None

from app.config import settings

logger = logging.getLogger("regiq.generator")
LLM_PROVIDER = "groq"


class PrecomputedChunkRetriever(BaseRetriever if LANGCHAIN_AVAILABLE else object):
    """
    In-memory retriever for ConversationalRetrievalChain that serves
    the verified and reranked regulatory chunks as LangChain Document objects.
    """
    documents: List[Any] = []

    def __init__(self, documents: List[Any], **kwargs):
        super().__init__(documents=documents, **kwargs)

    def _get_relevant_documents(self, query: str, *, run_manager: Optional[Any] = None) -> List[Any]:
        return self.documents

    async def _aget_relevant_documents(self, query: str, *, run_manager: Optional[Any] = None) -> List[Any]:
        return self.documents


class RAGGenerator:
    """
    Generates grounded regulatory responses using LangChain ConversationalRetrievalChain
    with ConversationBufferWindowMemory for multi-turn thread continuity.
    """

    SYSTEM_PROMPT_BASE = (
        "You are RegIQ, an advanced, authoritative regulatory compliance AI assistant for Indian SMEs.\n"
        "Your core duty is to provide hyper-accurate, grounded answers using ONLY the text provided in the 'Context' section below.\n\n"
        "CRITICAL RULES:\n"
        "1. If the context does not contain the answer to the user's question, you MUST reply EXACTLY with: \n"
        "    \"I could not find this in the available regulatory documents.\"\n"
        "    Do not attempt to use external knowledge, pre-trained facts, or extrapolate.\n"
        "2. Do not invent circular numbers, section clauses, notification dates, or URLs under any circumstances.\n"
        "3. Every factual claim or rule state MUST explicitly reference its source chunk index or citation details (e.g., [Source 1]).\n"
        "4. If the user asks a follow-up question, use the conversation history to understand context (e.g., specific state, penalty, or compliance date referenced earlier).\n"
    )

    PLAIN_MODE_INSTRUCTIONS = (
        "[MODE: PLAIN ENGLISH]\n"
        "- Explain the compliance rule like you are talking to a business owner with no legal background.\n"
        "- Use simple, clear, 8th-grade level English.\n"
        "- Break down complex terms into actionable steps.\n"
        "- Format your response strictly using clean Markdown bullet points.\n"
        "- Keep sentences concise.\n"
    )

    LEGAL_MODE_INSTRUCTIONS = (
        "[MODE: LEGAL TEXT]\n"
        "- Use formal, precise legal and regulatory language.\n"
        "- Maintain the original density and strict terminology of the circulars.\n"
        "- Include precise section clauses, definitions, and exact wording where relevant.\n"
        "- Format with professional paragraphs and structured sub-sections.\n"
    )

    CONDENSE_QUESTION_TEMPLATE = (
        "Given the following conversation history and a follow up question, rephrase the follow up question "
        "to be a standalone regulatory compliance question in its original language, incorporating all relevant "
        "statutes, circulars, or context previously discussed.\n\n"
        "Chat History:\n"
        "{chat_history}\n\n"
        "Follow Up Input: {question}\n"
        "Standalone question:"
    )

    QA_PROMPT_TEMPLATE = (
        "{system_prompt}\n\n"
        "Context Documents:\n"
        "====================\n"
        "{context}\n"
        "====================\n\n"
        "Question: {question}\n\n"
        "Provide your response below, following all rules specified in the system instructions.\n"
        "Helpful Answer:"
    )

    def __init__(self):
        self.api_key = getattr(settings, "groq_api_key", None) or os.getenv("GROQ_API_KEY")
        if self.api_key:
            self.client = AsyncGroq(api_key=self.api_key)
        else:
            self.client = None
            logger.warning("[generator] Groq API Key missing from configuration context.")
            
        self.model = "openai/gpt-oss-120b"

    def _format_context(self, chunks: List[Any]) -> Tuple[str, List[Dict[str, Any]], List[Any]]:
        """
        Formats raw chunks into both text context, structured citations,
        and LangChain Document objects.
        """
        context_str = ""
        citations = []
        documents = []

        for idx, chunk in enumerate(chunks, 1):
            if hasattr(chunk, "__dict__") or not isinstance(chunk, dict):
                metadata = getattr(chunk, "metadata", {}) or {}
                text = getattr(chunk, "text", getattr(chunk, "page_content", ""))
            else:
                metadata = chunk.get("metadata", {}) or {}
                text = chunk.get("text", chunk.get("page_content", ""))
            
            source_doc = metadata.get("source", "Unknown Document")
            circular_no = metadata.get("circular_no", "N/A")
            date = metadata.get("date", "N/A")
            section = metadata.get("section", "N/A")
            url = metadata.get("url", "#")

            chunk_header = (
                f"--- START SOURCE {idx} ---\n"
                f"Issuing Authority/Source: {source_doc}\n"
                f"Circular/Notification No: {circular_no}\n"
                f"Date: {date}\n"
                f"Section/Clause: {section}\n"
                f"Content: {text}\n"
                f"--- END SOURCE {idx} ---\n\n"
            )
            context_str += chunk_header

            citations.append({
                "id": idx,
                "source": source_doc,
                "circular_no": circular_no,
                "date": date,
                "section": section,
                "url": url,
                "snippet": text
            })

            if LANGCHAIN_AVAILABLE and Document is not None:
                documents.append(
                    Document(
                        page_content=chunk_header,
                        metadata={
                            "source": source_doc,
                            "circular_no": circular_no,
                            "date": date,
                            "section": section,
                            "url": url,
                            "chunk_id": idx
                        }
                    )
                )

        return context_str, citations, documents

    def _build_memory(self, chat_history: Optional[List[Dict[str, Any]]]) -> Any:
        """Populates ConversationBufferWindowMemory from thread message logs."""
        if not LANGCHAIN_AVAILABLE or ConversationBufferWindowMemory is None:
            return None

        memory = ConversationBufferWindowMemory(
            k=5,
            memory_key="chat_history",
            return_messages=True,
            output_key="answer"
        )

        if chat_history:
            for item in chat_history:
                role = item.get("role", "")
                content = item.get("content", "")
                if not content:
                    continue
                if role == "user":
                    memory.chat_memory.add_user_message(content)
                elif role in ("assistant", "ai"):
                    memory.chat_memory.add_ai_message(content)

        return memory

    @observe(as_type="generation", name="langchain_conversational_generator")
    async def generate_answer(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        mode: str = "plain",
        chat_history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Generates grounded response using ConversationalRetrievalChain with thread memory.
        Falls back to direct Groq client with structured history if needed.
        """
        if not chunks:
            return {
                "answer": "I could not find this in the available regulatory documents.",
                "citations": [],
                "mode": mode
            }

        context_text, citations, documents = self._format_context(chunks)
        mode_instruction = self.PLAIN_MODE_INSTRUCTIONS if mode.lower() == "plain" else self.LEGAL_MODE_INSTRUCTIONS
        full_system_prompt = f"{self.SYSTEM_PROMPT_BASE}\n{mode_instruction}"

        # ── Primary Execution: LangChain ConversationalRetrievalChain ──
        if LANGCHAIN_AVAILABLE and self.api_key:
            try:
                retriever = PrecomputedChunkRetriever(documents=documents)
                memory = self._build_memory(chat_history)

                llm = ChatGroq(
                    groq_api_key=self.api_key,
                    model_name=self.model,
                    temperature=0.0
                )

                qa_prompt = PromptTemplate(
                    template=self.QA_PROMPT_TEMPLATE,
                    input_variables=["context", "question"],
                    partial_variables={"system_prompt": full_system_prompt}
                )

                condense_prompt = PromptTemplate.from_template(self.CONDENSE_QUESTION_TEMPLATE)

                chain = ConversationalRetrievalChain.from_llm(
                    llm=llm,
                    retriever=retriever,
                    memory=memory,
                    condense_question_prompt=condense_prompt,
                    combine_docs_chain_kwargs={"prompt": qa_prompt},
                    return_source_documents=True,
                    verbose=False
                )

                logger.info(f"[generator] Executing ConversationalRetrievalChain with {len(chat_history or [])} history messages")
                chain_output = await chain.ainvoke({"question": query})
                answer_text = chain_output.get("answer", "").strip()

                if langfuse_context:
                    try:
                        langfuse_context.update_current_observation(
                            input={"query": query, "history_len": len(chat_history or [])},
                            output=answer_text,
                            model=self.model,
                            metadata={"mode": mode, "chunks_used": len(chunks), "chain": "ConversationalRetrievalChain"}
                        )
                    except Exception:
                        pass

                return {
                    "answer": answer_text,
                    "citations": citations,
                    "mode": mode
                }

            except Exception as chain_err:
                logger.warning(f"[generator] ConversationalRetrievalChain notice ({chain_err}) -> proceeding to resilient Groq conversation fallback.")

        # ── Resilient Fallback: AsyncGroq with thread history ──
        if not self.client:
            self.api_key = getattr(settings, "groq_api_key", None) or os.getenv("GROQ_API_KEY")
            if self.api_key:
                self.client = AsyncGroq(api_key=self.api_key)
            else:
                return {
                    "answer": "Groq API token is misconfigured or completely missing from your backend server .env file.",
                    "citations": [],
                    "mode": mode
                }

        user_prompt = (
            f"Context Documents:\n====================\n{context_text}\n====================\n\n"
            f"User Question: {query}\n\n"
            f"Provide your response below, following all rules specified in the system instructions."
        )

        messages = [{"role": "system", "content": full_system_prompt}]

        # Inject conversation history into multi-turn messages
        if chat_history:
            for item in chat_history[-6:]:
                r = item.get("role")
                c = item.get("content")
                if r in ("user", "assistant") and c:
                    messages.append({"role": r, "content": c})

        messages.append({"role": "user", "content": user_prompt})

        try:
            chat_completion = await self.client.chat.completions.create(
                messages=messages,
                model=self.model,
                temperature=0.0,
            )
            answer_text = chat_completion.choices[0].message.content.strip()

            usage_dict = {}
            if hasattr(chat_completion, "usage") and chat_completion.usage:
                usage_dict = {
                    "input": getattr(chat_completion.usage, "prompt_tokens", None),
                    "output": getattr(chat_completion.usage, "completion_tokens", None),
                    "total": getattr(chat_completion.usage, "total_tokens", None),
                }

            if langfuse_context:
                try:
                    langfuse_context.update_current_observation(
                        output=answer_text,
                        usage=usage_dict,
                        metadata={"mode": mode, "history_turns": len(chat_history or [])}
                    )
                except Exception:
                    pass

            return {
                "answer": answer_text,
                "citations": citations,
                "mode": mode
            }

        except Exception as e:
            logger.error(f"Error during Groq LLM text generation: {str(e)}")
            err_msg = str(e)
            if "429" in err_msg:
                return {
                    "answer": "⚠️ **Groq API Rate Limit Hit.** Please wait a moment and retry.",
                    "citations": [],
                    "mode": mode
                }
            return {
                "answer": f"An error occurred while generating your response via Groq: {err_msg}.",
                "citations": [],
                "mode": mode
            }


_generator_instance = RAGGenerator()
generate_answer = _generator_instance.generate_answer