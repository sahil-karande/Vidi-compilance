import os
import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RegIQ_Generator")

# Define structural format for strict fallback downstream validation
class RegIQStructuredOutput(BaseModel):
    answer: str = Field(description="The compliance answer, strictly derived from provided context snippets.")
    is_found: bool = Field(description="Set to false if context has insufficient information to answer fully. Otherwise true.")

class RegIQGenerator:
    def __init__(self):
        # Load API keys from environment
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        
        # Fallback tracking
        self.preferred_provider = os.getenv("PREFERRED_LLM_PROVIDER", "gemini").lower()
        
        # Initialize Gemini client if available
        if self.gemini_api_key:
            self.gemini_client = genai.Client(api_key=self.gemini_api_key)
        else:
            self.gemini_client = None
            logger.warning("GEMINI_API_KEY not found in environment variables.")

        if not self.openrouter_api_key:
            logger.warning("OPENROUTER_API_KEY not found in environment variables.")

    def _get_system_prompt(self, mode: str = "plain") -> str:
        """
        Returns the rigid system prompt based on user interface mode selection.
        """
        base_prompt = (
            "You are RegIQ, an expert regulatory compliance assistant for Indian SMEs.\n"
            "Your sole objective is to answer the user's query based strictly on the provided context chunks.\n\n"
            "CRITICAL RULES:\n"
            "1. Answer ONLY using the facts directly mentioned in the provided context.\n"
            "2. If the context does not contain enough information to conclusively answer the query, "
            "you MUST set 'is_found' to false and reply exactly with: \"I could not find this in the available regulatory documents.\"\n"
            "3. Do NOT extrapolate, speculate, or use outside training knowledge under any circumstances.\n"
            "4. For every claim or rule you state, you MUST cite its specific metadata attributes "
            "(circular number, issuing authority, section, and date) explicitly in your text.\n"
            "5. Never invent or hallucinate regulation details, section numbers, or dates.\n\n"
        )
        
        if mode == "plain":
            mode_prompt = (
                "[PLAIN MODE ACTIVE]\n"
                "- Write your response using simple, clear English targeting an 8th-grade comprehension level.\n"
                "- Avoid dense legal jargon; explain complex compliance terms simply.\n"
                "- Structure your answer logically using clean Markdown bullet points.\n"
                "- Keep sentences brief and practical for an SME business owner."
            )
        else:  # legal mode
            mode_prompt = (
                "[LEGAL MODE ACTIVE]\n"
                "- Use formal, authoritative, and precise legal language.\n"
                "- Maintain the tone of a high-level compliance officer or corporate attorney.\n"
                "- Include full verbatim section references, legal definitions, and precise provisions.\n"
                "- Do not oversimplify clauses; preserve the structural nuances of the source text."
            )
            
        return base_prompt + mode_prompt

    def _format_context(self, chunks: List[Dict[str, Any]]) -> str:
        """
        Formats retrieved vector chunks and metadata into a clean text block for the LLM context window.
        """
        formatted_blocks = []
        for i, chunk in enumerate(chunks):
            metadata = chunk.get("metadata", {})
            text = chunk.get("text", "")
            
            block = (
                f"--- CONTEXT CHUNK {i+1} ---\n"
                f"Source Authority: {metadata.get('authority', 'N/A')}\n"
                f"Circular/Notification No: {metadata.get('circular_no', 'N/A')}\n"
                f"Section/Clause: {metadata.get('section', 'N/A')}\n"
                f"Date: {metadata.get('date', 'N/A')}\n"
                f"URL: {metadata.get('url', 'N/A')}\n"
                f"Content: {text}\n"
            )
            formatted_blocks.append(block)
            
        return "\n".join(formatted_blocks)

    def _generate_via_gemini(self, system_prompt: str, user_content: str, model_name: str = "gemini-2.5-flash") -> Dict[str, Any]:
        """
        Direct generation calls using the official GenAI SDK enforcing Structured JSON schema outputs.
        """
        if not self.gemini_client:
            raise ValueError("Gemini client is not initialized.")
            
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.0,
            max_output_tokens=1500,
            response_mime_type="application/json",
            response_schema=RegIQStructuredOutput,
        )
        
        response = self.gemini_client.models.generate_content(
            model=model_name,
            contents=user_content,
            config=config
        )
        return json.loads(response.text)

    def _generate_via_openrouter(self, system_prompt: str, user_content: str, model_name: str = "google/gemini-2.5-flash") -> Dict[str, Any]:
        """
        Fallback path via OpenRouter, requesting structural compliance inside a JSON block schema response layout.
        """
        if not self.openrouter_api_key:
            raise ValueError("OpenRouter API key is not configured.")
            
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/sahilkarande/regiq",
            "X-Title": "RegIQ Compliance Assistant"
        }
        
        # Enforce JSON output for OpenRouter compatible inference backends
        payload = {
            "model": model_name,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt + "\nOutput your answer strictly formatted in valid JSON containing keys 'answer' (string) and 'is_found' (boolean)."},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.0,
            "max_tokens": 1500
        }
        
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                raise RuntimeError(f"OpenRouter Error {response.status_code}: {response.text}")
            
            result = response.json()
            raw_content = result['choices'][0]['message']['content']
            return json.loads(raw_content)

    def generate_answer(self, query: str, retrieved_chunks: List[Dict[str, Any]], mode: str = "plain") -> Dict[str, Any]:
        """
        Primary interface function executed by the FastAPI /query router.
        Combines inputs -> Triggers LLM execution loop -> Catches edge cases.
        """
        if not retrieved_chunks:
            return {
                "answer": "I could not find this in the available regulatory documents.",
                "citations": []
            }
            
        system_prompt = self._get_system_prompt(mode=mode)
        formatted_context = self._format_context(retrieved_chunks)
        
        user_content = (
            f"Context Documents:\n{formatted_context}\n\n"
            f"User Query: {query}\n\n"
            f"Generate answer strictly conforming to system rules. Populate JSON output parameter metrics fields explicitly."
        )
        
        structured_response = None
        provider_used = self.preferred_provider
        
        # Primary Execution Loop
        try:
            if provider_used == "gemini" and self.gemini_client:
                logger.info("Routing query to Native Gemini SDK with Structural Schema Enforcement...")
                structured_response = self._generate_via_gemini(system_prompt, user_content)
            elif self.openrouter_api_key:
                logger.info("Routing query to OpenRouter JSON Parser fallback routing...")
                provider_used = "openrouter"
                structured_response = self._generate_via_openrouter(system_prompt, user_content)
            else:
                raise RuntimeError("No operational LLM provider configuration variables detected.")
                
        except Exception as e:
            logger.error(f"Primary LLM route failed: {str(e)}. Attempting cross-provider fallback handling...")
            # Cross-Provider Failover Execution Block
            try:
                if provider_used == "gemini" and self.openrouter_api_key:
                    provider_used = "openrouter"
                    structured_response = self._generate_via_openrouter(system_prompt, user_content)
                elif provider_used == "openrouter" and self.gemini_client:
                    provider_used = "gemini"
                    structured_response = self._generate_via_gemini(system_prompt, user_content)
                else:
                    raise e
            except Exception as failover_err:
                logger.critical(f"All structural LLM routing backends collapsed: {str(failover_err)}")
                return {
                    "answer": "An unexpected server-side error occurred while computing the response.",
                    "citations": []
                }

        # Anti-hallucination processing leveraging structural attributes
        if not structured_response or not structured_response.get("is_found", True):
            return {
                "answer": "I could not find this in the available regulatory documents.",
                "citations": []
            }
            
        cleaned_answer = structured_response.get("answer", "").strip()
        
        if "I could not find this in the available regulatory documents" in cleaned_answer:
            return {
                "answer": "I could not find this in the available regulatory documents.",
                "citations": []
            }

        # Map metadata objects safely to feed React elements
        citations = [chunk.get("metadata", {}) for chunk in retrieved_chunks]
        
        return {
            "answer": cleaned_answer,
            "citations": citations,
            "meta": {"provider": provider_used, "mode": mode}
        }

if __name__ == "__main__":
    # Test script stays identical for runtime structural contract testing
    os.environ["PREFERRED_LLM_PROVIDER"] = "gemini"
    generator = RegIQGenerator()
    
    mock_retrieved_data = [
        {
            "text": "As per Notification No. 12/2017-Central Tax, services provided by an entity registered under section 12AA of the Income-tax Act by way of charitable activities are exempt from GST.",
            "metadata": {
                "authority": "CBIC (GST)",
                "circular_no": "Notification No. 12/2017-Central Tax",
                "section": "Section 12AA reference",
                "date": "28-06-2017",
                "url": "https://cbic-gst.gov.in/pdf"
            }
        }
    ]
    
    print("\n--- TEST 1: Question In-Corpus ---")
    res1 = generator.generate_answer(
        query="Are registered charitable organizations exempt from paying GST?",
        retrieved_chunks=mock_retrieved_data,
        mode="plain"
    )
    print(json.dumps(res1, indent=2))
    
    print("\n--- TEST 2: Question Out-Of-Corpus ---")
    res2 = generator.generate_answer(
        query="What is the penalty for filing dynamic QR codes late for companies making over 500 crores?",
        retrieved_chunks=mock_retrieved_data,
        mode="legal"
    )
    print(json.dumps(res2, indent=2))