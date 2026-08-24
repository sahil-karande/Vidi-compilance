import os
import logging
from typing import List, Dict, Any, Tuple
from groq import AsyncGroq
from langfuse import observe, langfuse_context

from app.config import settings

logger = logging.getLogger("regiq.generator")

LLM_PROVIDER = "groq"


class RAGGenerator:
    """
    Generates grounded responses using the official Groq SDK.
    Enforces compliance styling, anti-hallucination guardrails, and LangFuse tracing.
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

    def __init__(self):
        self.api_key = getattr(settings, "groq_api_key", None) or os.getenv("GROQ_API_KEY")
        
        if self.api_key:
            self.client = AsyncGroq(api_key=self.api_key)
        else:
            self.client = None
            logger.warning("Groq API Key missing from configuration context. Verify your .env environment parameters.")
            
        self.model = "llama-3.3-70b-versatile"

    def _format_context(self, chunks: List[Any]) -> Tuple[str, List[Dict[str, Any]]]:
        """Formats list of chunks into an organized context block for the prompt."""
        context_str = ""
        citations = []

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

            context_str += f"--- START SOURCE {idx} ---\n"
            context_str += f"Issuing Authority/Source: {source_doc}\n"
            context_str += f"Circular/Notification No: {circular_no}\n"
            context_str += f"Date: {date}\n"
            context_str += f"Section/Clause: {section}\n"
            context_str += f"Content: {text}\n"
            context_str += f"--- END SOURCE {idx} ---\n\n"

            citations.append({
                "id": idx,
                "source": source_doc,
                "circular_no": circular_no,
                "date": date,
                "section": section,
                "url": url,
                "snippet": text
            })

        return context_str, citations

    @observe(as_type="generation", name="groq_generator")
    async def generate_answer(
        self, query: str, chunks: List[Dict[str, Any]], mode: str = "plain"
    ) -> Dict[str, Any]:
        """Coordinates context formulation and invokes the active API layer with LangFuse tracking."""
        if not chunks:
            langfuse_context.update_current_observation(
                input={"query": query, "chunks_count": 0, "mode": mode},
                output="I could not find this in the available regulatory documents.",
                metadata={"status": "no_chunks_provided"}
            )
            return {
                "answer": "I could not find this in the available regulatory documents.",
                "citations": [],
                "mode": mode
            }

        if not self.client:
            self.api_key = getattr(settings, "groq_api_key", None) or os.getenv("GROQ_API_KEY")
            if self.api_key:
                self.client = AsyncGroq(api_key=self.api_key)
            else:
                err = "Groq API token is misconfigured or completely missing from your backend server .env file."
                langfuse_context.update_current_observation(
                    input={"query": query, "mode": mode},
                    output=err,
                    metadata={"status": "auth_error"}
                )
                return {
                    "answer": err,
                    "citations": [],
                    "mode": mode
                }

        context_text, citations = self._format_context(chunks)
        mode_instruction = self.PLAIN_MODE_INSTRUCTIONS if mode.lower() == "plain" else self.LEGAL_MODE_INSTRUCTIONS
        full_system_prompt = f"{self.SYSTEM_PROMPT_BASE}\n{mode_instruction}"
        
        user_prompt = (
            f"Context Documents:\n====================\n{context_text}\n====================\n\n"
            f"User Question: {query}\n\n"
            f"Provide your response below, following all rules specified in the system instructions."
        )

        messages = [
            {"role": "system", "content": full_system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        # Update LangFuse observation with model inputs and hyper-parameters
        langfuse_context.update_current_observation(
            input=messages,
            model=self.model,
            model_parameters={"temperature": 0.0},
            metadata={"mode": mode, "chunks_used": len(chunks)}
        )

        try:
            chat_completion = await self.client.chat.completions.create(
                messages=messages,
                model=self.model,
                temperature=0.0,
            )
            
            answer_text = chat_completion.choices[0].message.content.strip()
            
            # Extract token usage directly from Groq completion response
            usage_dict = {}
            if hasattr(chat_completion, "usage") and chat_completion.usage:
                usage_dict = {
                    "input": getattr(chat_completion.usage, "prompt_tokens", None),
                    "output": getattr(chat_completion.usage, "completion_tokens", None),
                    "total": getattr(chat_completion.usage, "total_tokens", None),
                }

            # Update LangFuse observation with response text and tokens
            langfuse_context.update_current_observation(
                output=answer_text,
                usage=usage_dict
            )
            
            return {
                "answer": answer_text,
                "citations": citations,
                "mode": mode
            }
                
        except Exception as e:
            logger.error(f"Error during Groq LLM text generation loop: {str(e)}")
            err_msg = str(e)
            
            langfuse_context.update_current_observation(
                output=err_msg,
                metadata={"error": True, "exception_type": type(e).__name__}
            )
            
            if "429" in err_msg:
                return {
                    "answer": "⚠️ **Groq API Rate Limit Hit.** Please wait a moment for your rate limits to clear and resubmit your prompt.",
                    "citations": [],
                    "mode": mode
                }
                
            return {
                "answer": f"An error occurred while generating your response via Groq: {err_msg}.",
                "citations": [],
                "mode": mode
            }


# Singleton instance initialization to allow module-level imports
_generator_instance = RAGGenerator()
generate_answer = _generator_instance.generate_answer