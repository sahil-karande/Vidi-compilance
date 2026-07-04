import os
import json
import logging
import asyncio
from typing import List, Dict, Any, Tuple
import google.generativeai as genai  # Clean, explicit single namespace choice
from app.config import settings

logger = logging.getLogger("regiq.generator")

LLM_PROVIDER = "gemini"


class RAGGenerator:
    """
    Generates grounded responses using the official google-generativeai SDK.
    Enforces compliance styling and anti-hallucination guardrails.
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
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
        else:
            logger.warning("Gemini API Key missing from settings context. Verify VITE/FastAPI configurations.")

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
                "snippet": text[:200] + "..." if len(text) > 200 else text
            })

        return context_str, citations

    async def generate_answer(
        self, query: str, chunks: List[Dict[str, Any]], mode: str = "plain"
    ) -> Dict[str, Any]:
        """Coordinates context formulation and invokes the active API layer."""
        if not chunks:
            return {
                "answer": "I could not find this in the available regulatory documents.",
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

        try:
            return await self._call_gemini(full_system_prompt, user_prompt, citations, mode)
                
        except Exception as e:
            logger.error(f"Error during LLM text generation loop: {str(e)}")
            err_msg = str(e)
            
            # If the free tier limit is reached, give a clean suggestion to the user
            if "429" in err_msg or "quota" in err_msg.lower():
                return {
                    "answer": "⚠️ **Gemini Free Quota Limit Reached (5 RPM).** Please wait 30 seconds for the window to reset and resubmit your compliance question.",
                    "citations": [],
                    "mode": mode
                }
                
            return {
                "answer": f"An error occurred while generating your answer: {err_msg}. Please try again shortly.",
                "citations": [],
                "mode": mode
            }

    async def _call_gemini(self, system_instruction: str, user_content: str, citations: List[Dict], mode: str) -> Dict[str, Any]:
        """Invokes the google-generativeai model using thread pools to avoid blockages."""
        generation_config = {
            "temperature": 0.0,
            "top_p": 1.0,
        }

        combined_prompt = f"{system_instruction}\n\n{user_content}"

        def _sync_generate():
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(model_name="models/gemini-2.5-flash")
            return model.generate_content(contents=combined_prompt, generation_config=generation_config)

        response = await asyncio.to_thread(_sync_generate)
        
        return {
            "answer": response.text.strip(),
            "citations": citations,
            "mode": mode
        }


# Singleton instance initialization to allow module-level imports
_generator_instance = RAGGenerator()
generate_answer = _generator_instance.generate_answer