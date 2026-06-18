<<<<<<< HEAD
import os
import json
from app.rag.generator import RegIQGenerator

# Setup mocked environment
# Make sure to run this in a terminal where GEMINI_API_KEY is exported, 
# or paste your valid key here temporarily for isolated testing.
if not os.getenv("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = "PASTE_YOUR_AIzaSy_KEY_HERE"

# Ensure provider is locked onto gemini for direct SDK verification
os.environ["PREFERRED_LLM_PROVIDER"] = "gemini"

# 1. Instantiate your core engine class
generator = RegIQGenerator()

# 2. Setup mock corpus data chunk mimicking your vector database retrieval matching ChromaDB schema
valid_context = [{
    "text": "As per RBI Circular RBI/2024/45, all NBFCs must maintain a Capital Adequacy Ratio (CAR) of 15% effective from April 1, 2024.",
    "metadata": {
        "circular_no": "RBI/2024/45", 
        "authority": "RBI", 
        "date": "2024-04-01", 
        "url": "https://rbi.org.in/scripts/NotificationUser.aspx"
    }
}]

print("--- TESTING PLAIN MODE (Should be simple English + bullet points) ---")
res_plain = generator.generate_answer(
    query="What is the CAR requirement for NBFCs?", 
    retrieved_chunks=valid_context, 
    mode="plain"
)
print(json.dumps(res_plain, indent=2))


print("\n--- TESTING LEGAL MODE (Should be precise, formal legalese language) ---")
res_legal = generator.generate_answer(
    query="What is the CAR requirement for NBFCs?", 
    retrieved_chunks=valid_context, 
    mode="legal"
)
print(json.dumps(res_legal, indent=2))


print("\n--- TESTING HALLUCINATION GUARDRAIL (Expecting 'I could not find this...') ---")
res_hallucination = generator.generate_answer(
    query="What are the specific penalties for violating SEBI insider trading codes?", 
    retrieved_chunks=valid_context,  # Passing the irrelevant RBI context chunk on purpose
    mode="plain"
)
print(json.dumps(res_hallucination, indent=2))
=======
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
>>>>>>> 966715a224964e8add74323cd74d4fe189f31313
