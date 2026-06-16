import os
import json
import logging
from typing import List, Dict, Any, Tuple
import google.generativeai as genai
import httpx

logger = logging.getLogger("regiq.generator")

# Load environment variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()  # 'gemini' or 'openrouter'
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")

# Configure Google Gemini SDK if selected
if LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


class RAGGenerator:
    """
    Generates grounded responses using an LLM (Gemini/OpenRouter) based strictly on 
    retrieved and reranked regulatory context chunks. Enforces compliance styling.
    """

    SYSTEM_PROMPT_BASE = (
        "You are RegIQ, an advanced, authoritative regulatory compliance AI assistant for Indian SMEs.\n"
        "Your core duty is to provide hyper-accurate, grounded answers using ONLY the text provided in the 'Context' section below.\n\n"
        "CRITICAL RULES:\n"
        "1. If the context does not contain the answer to the user's question, you MUST reply EXACTLY with: \n"
        "   \"I could not find this in the available regulatory documents.\"\n"
        "   Do not attempt to use external knowledge, pre-trained facts, or extrapolate.\n"
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
        if LLM_PROVIDER == "gemini" and not GEMINI_API_KEY:
            logger.warning("Gemini API Key missing. Falling back or failing runtime requests.")
        elif LLM_PROVIDER == "openrouter" and not OPENROUTER_API_KEY:
            logger.warning("OpenRouter API Key missing. Check your environment variables.")

    def _format_context(self, chunks: List[Dict[str, Any]]) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Formats list of metadata-rich chunks into an organized text string for the LLM prompt.
        Extracts citation objects for the frontend payload mapping.
        """
        context_str = ""
        citations = []

        for idx, chunk in enumerate(chunks, 1):
            metadata = chunk.get("metadata", {})
            text = chunk.get("text", chunk.get("page_content", ""))
            
            # Extract clean regulatory metadata fields
            source_doc = metadata.get("source", "Unknown Document")
            circular_no = metadata.get("circular_no", "N/A")
            date = metadata.get("date", "N/A")
            section = metadata.get("section", "N/A")
            url = metadata.get("url", "#")

            # Formulate structured context block for the LLM
            context_str += f"--- START SOURCE {idx} ---\n"
            context_str += f"Issuing Authority/Source: {source_doc}\n"
            context_str += f"Circular/Notification No: {circular_no}\n"
            context_str += f"Date: {date}\n"
            context_str += f"Section/Clause: {section}\n"
            context_str += f"Content: {text}\n"
            context_str += f"--- END SOURCE {idx} ---\n\n"

            # Prepare clean client-side citation objects
            citations.append({
                "id": idx,
                "source": source_doc,
                "circular_no": circular_no,
                "date": date,
                "section": section,
                "url": url,
                "snippet": text[:200] + "..." if len(text) > 200 else text
            })

        return context_str, citations

    async def generate_answer(
        self, query: str, chunks: List[Dict[str, Any]], mode: str = "plain"
    ) -> Dict[str, Any]:
        """
        Coordinates context formulation, system instructions compilation, and execution of LLM API.
        """
        if not chunks:
            return {
                "answer": "I could not find this in the available regulatory documents.",
                "citations": [],
                "mode": mode
            }

        context_text, citations = self._format_context(chunks)
        
        # Select dynamic prompt modifier based on presentation mode
        mode_instruction = self.PLAIN_MODE_INSTRUCTIONS if mode.lower() == "plain" else self.LEGAL_MODE_INSTRUCTIONS
        
        full_system_prompt = f"{self.SYSTEM_PROMPT_BASE}\n{mode_instruction}"
        
        user_prompt = (
            f"Context Documents:\n====================\n{context_text}\n====================\n\n"
            f"User Question: {query}\n\n"
            f"Provide your response below, following all rules specified in the system instructions. Ensure citations correspond cleanly to the [Source X] tags."
        )

        try:
            if LLM_PROVIDER == "gemini":
                return await self._call_gemini(full_system_prompt, user_prompt, citations, mode)
            elif LLM_PROVIDER == "openrouter":
                return await self._call_openrouter(full_system_prompt, user_prompt, citations, mode)
            else:
                raise ValueError(f"Unsupported LLM provider: {LLM_PROVIDER}")
                
        except Exception as e:
            logger.error(f"Error during LLM text generation loop: {str(e)}")
            return {
                "answer": "An error occurred while generating your answer. Please try again shortly.",
                "citations": [],
                "mode": mode
            }

    async def _call_gemini(self, system_instruction: str, user_content: str, citations: List[Dict], mode: str) -> Dict[str, Any]:
        """Invokes native Gemini API via Google GenAI SDK wrapper."""
        # Using gemini-1.5-flash as default for lightning-fast latency/RAG compliance
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_instruction,
            generation_config={"temperature": 0.0} # Absolute 0 temperature to enforce anti-hallucination guardrails
        )
        
        # Wrap blocking SDK call in an async executor thread if necessary, or execute direct
        response = model.generate_content(user_content)
        
        return {
            "answer": response.text.strip(),
            "citations": citations,
            "mode": mode
        }

    async def _call_openrouter(self, system_instruction: str, user_content: str, citations: List[Dict], mode: str) -> Dict[str, Any]:
        """Invokes OpenRouter endpoint using an asynchronous HTTPX pool."""
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/sahilkarande/regiq", # Required site metadata for OpenRouter rankings
            "X-Title": "RegIQ Compliance Assistant"
        }
        
        payload = {
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "content", "content": user_content}
            ],
            "temperature": 0.0  # Zero temperature for deterministic RAG behavior
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers)
            response.raise_for_status()
            res_json = response.json()
            
            answer_text = res_json['choices'][0]['message']['content']
            return {
                "answer": answer_text.strip(),
                "citations": citations,
                "mode": mode
            }