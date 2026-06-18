import asyncio
import os
from app.rag.generator import RAGGenerator

# Setup temporary mock environment variables for validation
os.environ["LLM_PROVIDER"] = "gemini" 
# Ensure your GEMINI_API_KEY is exported in your terminal before running this!

# Sample Mock Output directly structured as coming out of your Reranker
mock_reranked_chunks = [
    {
        "text": "As per GST notification No. 12/2017-Central Tax, services provided by an educational institution to its students, faculty, and staff are completely exempt from GST levies.",
        "metadata": {
            "source": "CBIC GST Notification Portal",
            "circular_no": "12/2017-Central Tax",
            "date": "28-06-2017",
            "section": "Paragraph 1, Entry 66",
            "url": "https://cbic-gst.gov.in/pdf/notification12-cgst-eng.pdf"
        }
    }
]

async def run_tests():
    generator = RAGGenerator()
    
    print("=== TEST 1: PLAIN MODE CONTEXT QUESTION ===")
    res_plain = await generator.generate_answer(
        query="Is an educational institution exempt from GST?",
        chunks=mock_reranked_chunks,
        mode="plain"
    )
    print(f"Answer:\n{res_plain['answer']}\n")
    print(f"Citations Returned: {len(res_plain['citations'])}\n")
    
    print("=== TEST 2: LEGAL MODE CONTEXT QUESTION ===")
    res_legal = await generator.generate_answer(
        query="Is an educational institution exempt from GST?",
        chunks=mock_reranked_chunks,
        mode="legal"
    )
    print(f"Answer:\n{res_legal['answer']}\n")

    print("=== TEST 3: HALLUCINATION & GROUNDING CORRUPT TEST ===")
    # Asking a question completely absent from our context dataset (e.g., SEBI Equity rules)
    res_hallucination = await generator.generate_answer(
        query="What is the minimum promoter contribution for an IPO under SEBI ICDR guidelines?",
        chunks=mock_reranked_chunks,
        mode="legal"
    )
    print(f"Answer for unrelated topic:\n{res_hallucination['answer']}\n")
    
if __name__ == "__main__":
    asyncio.run(run_tests())