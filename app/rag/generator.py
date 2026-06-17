import os
import json
import logging
from typing import List, Dict, Any, Tuple
from google import genai
from google.genai import types
import httpx

logger = logging.getLogger("regiq.generator")

# Load environment variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()  # 'gemini' or 'openrouter'
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")

# Initialize the new Google GenAI Client if selected
gemini_client = None
if LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
    # Explicitly instantiating the unified client wrapper
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)


class RAGGenerator:
    """
    Generates grounded responses using the modern google-genai SDK or OpenRouter.
    Enforces compliance styling and anti-hallucination guardrails.
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
        """Invokes the modern google-genai models service correctly."""
        if not gemini_client:
            raise ValueError("Gemini Client is not initialized. Verify your GEMINI_API_KEY.")

        # Configuration structure using the correct SDK parameters
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.0,  # Strict determinism
        )

        # Correct method location: client.models.generate_content
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_content,
            config=config
        )
        
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
            "HTTP-Referer": "https://github.com/sahilkarande/regiq",
            "X-Title": "RegIQ Compliance Assistant"
        }
        
        payload = {
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.0
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