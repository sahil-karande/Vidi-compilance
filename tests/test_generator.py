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