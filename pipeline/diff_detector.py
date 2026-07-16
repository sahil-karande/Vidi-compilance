"""
RegIQ — pipeline/diff_detector.py
Day 45 Task: Advanced NLP Diff Engine & Regulatory Change Detection

Compares newly scraped/embedded circular variations against historical baselines
using cosine similarity on embeddings. If similarity < 0.85 -> flags as changed,
isolates sentence-level deltas, and generates human-readable change summaries via Groq LLM.
"""

import os
import json
import numpy as np
import difflib
from pathlib import Path
from datetime import datetime
from loguru import logger
from groq import Groq
from sentence_transformers import SentenceTransformer

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"

# Setup monitoring logs matching system layout
logger.add(DATA_DIR / "diff_detector.log", rotation="5 MB", level="INFO")

def load_json_embeddings(file_path: Path) -> list:
    """Safely loads chunks containing vector text embeddings."""
    if not file_path.exists():
        return []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read dataset from {file_path}: {e}")
        return []

def calculate_cosine_similarity(vec1: list, vec2: list) -> float:
    """Computes the standard cosine similarity metric between two normalized embedding vectors."""
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    if v1.size == 0 or v2.size == 0:
        return 0.0
    dot_product = np.dot(v1, v2)
    norm_v1 = np.linalg.norm(v1)
    norm_v2 = np.linalg.norm(v2)
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return float(dot_product / (norm_v1 * norm_v2))

def extract_changed_sentences(old_text: str, new_text: str) -> dict:
    """Isolates sentence-level deltas to filter out unchanged context blocks."""
    # Split text by sentence delimiters for structural analysis
    old_sentences = [s.strip() for s in old_text.replace(";", ".").split(".") if s.strip()]
    new_sentences = [s.strip() for s in new_text.replace(";", ".").split(".") if s.strip()]
    
    differ = difflib.Differ()
    diff_results = list(differ.compare(old_sentences, new_sentences))
    
    added = [line[2:] for line in diff_results if line.startswith("+ ")]
    removed = [line[2:] for line in diff_results if line.startswith("- ")]
    
    return {"added": added, "removed": removed}

def generate_llm_change_summary(source_doc: str, old_text: str, current_text: str, deltas: dict) -> str:
    """Generates a high-precision, human-readable compliance alert summary via Groq SDK."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY environment variable missing. Skipping LLM summarization layer.")
        return "Regulatory updates detected. Review structural timeline and original notifications directly."

    try:
        client = Groq(api_key=api_key)
        
        system_prompt = (
            "You are RegIQ, an authoritative compliance automation engine for Indian businesses.\n"
            "Your objective is to compare a modified regulatory text document against its previous version "
            "and generate a highly concise, executive summary explaining what changed, what compliance action "
            "is required, and who is affected. Do not use complex language; explain clearly for a business owner."
        )
        
        user_content = (
            f"Document Title/Source: {source_doc}\n\n"
            f"--- ADDED PROVISIONS/CLAUSES ---\n{chr(10).join(deltas['added'][:10])}\n\n"
            f"--- REMOVED/REPEALED CLAUSES ---\n{chr(10).join(deltas['removed'][:10])}\n\n"
            f"Based on these isolated structural changes, summarize the regulatory shift "
            f"in up to 3 crisp, bulleted sentences tailored for an Indian small business operator."
        )
        
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.0
        )
        return completion.choices[0].message.content.strip()
        
    except Exception as e:
        logger.error(f"Error invoking Groq change summarizer: {e}")
        return f"Automatic change tracking completed with errors: {str(e)}"

def detect_corpus_changes(corpus: str, backup_dir: Path, model: SentenceTransformer) -> list:
    """Analyzes semantic variations between active and historical embeddings namespaces."""
    active_embeddings_file = DATA_DIR / corpus / "embeddings.json"
    historical_embeddings_file = backup_dir / corpus / "embeddings.json"
    
    if not active_embeddings_file.exists():
        logger.warning(f"No active embedded corpus located for: {corpus}")
        return []
        
    if not historical_embeddings_file.exists():
        logger.info(f"First-time run execution profile setup for {corpus}. Skipping NLP diff engine tracking.")
        return []

    logger.info(f"Running semantic similarity delta evaluations for corpus: {corpus.upper()}")
    active_data = load_json_embeddings(active_embeddings_file)
    historical_data = load_json_embeddings(historical_embeddings_file)

    # Reconstruct document levels + gather mean embeddings to identify document-level drifts
    active_docs = {}
    for chunk in active_data:
        src = chunk.get("filename", "unknown")  # Grouping by filename as source identifier
        if src not in active_docs:
            active_docs[src] = {"text": "", "embeddings": []}
        active_docs[src]["text"] += "\n" + chunk.get("text", "")
        if "embedding" in chunk:
            active_docs[src]["embeddings"].append(chunk["embedding"])

    historical_docs = {}
    for chunk in historical_data:
        src = chunk.get("filename", "unknown")
        if src not in historical_docs:
            historical_docs[src] = {"text": "", "embeddings": []}
        historical_docs[src]["text"] += "\n" + chunk.get("text", "")
        if "embedding" in chunk:
            historical_docs[src]["embeddings"].append(chunk["embedding"])

    detected_alerts = []

    for doc_source, doc_info in active_docs.items():
        current_text = doc_info["text"]
        current_vector = np.mean(doc_info["embeddings"], axis=0).tolist() if doc_info["embeddings"] else []

        if doc_source in historical_docs:
            old_text = historical_docs[doc_source]["text"]
            old_vector = np.mean(historical_docs[doc_source]["embeddings"], axis=0).tolist() if historical_docs[doc_source]["embeddings"] else []
            
            if not current_vector or not old_vector:
                old_vector = model.encode(old_text, normalize_embeddings=True).tolist()
                current_vector = model.encode(current_text, normalize_embeddings=True).tolist()

            similarity = calculate_cosine_similarity(old_vector, current_vector)
            logger.debug(f"Similarity index for {doc_source}: {similarity:.4f}")

            # Critical threshold check limit condition (< 0.85 indicates change)
            if similarity < 0.85:
                logger.info(f"⚠️ SEMANTIC DRIFT IDENTIFIED (< 0.85) in {corpus.upper()} -> {doc_source} (Similarity: {similarity:.2f})")
                
                # Extract granular changed sentences
                deltas = extract_changed_sentences(old_text, current_text)
                
                # Trigger LLM Summary layer via Groq
                summary = generate_llm_change_summary(doc_source, old_text, current_text, deltas)
                
                alert = {
                    "corpus": corpus,
                    "source_doc": doc_source,
                    "type": "modification",
                    "timestamp": datetime.utcnow().isoformat(),
                    "metrics": {
                        "cosine_similarity": round(similarity, 4),
                        "sentences_added": len(deltas["added"]),
                        "sentences_removed": len(deltas["removed"])
                    },
                    "summary": summary,
                    "highlights": {
                        "snippets_added": deltas["added"][:5],
                        "snippets_deleted": deltas["removed"][:5]
                    }
                }
                detected_alerts.append(alert)
        else:
            # Entirely new regulation provision parsed
            deltas = extract_changed_sentences("", current_text)
            summary = generate_llm_change_summary(doc_source, "", current_text, deltas)
            
            alert = {
                "corpus": corpus,
                "source_doc": doc_source,
                "type": "new_provision",
                "timestamp": datetime.utcnow().isoformat(),
                "metrics": {
                    "cosine_similarity": 0.0,
                    "sentences_added": len(deltas["added"]),
                    "sentences_removed": 0
                },
                "summary": summary,
                "highlights": {
                    "snippets_added": deltas["added"][:5],
                    "snippets_deleted": []
                }
            }
            detected_alerts.append(alert)
            logger.info(f"✨ NEW SYSTEM REGULATION ADDED in {corpus.upper()} -> {doc_source}")

    return detected_alerts

def run_diff_detection(backup_directory_name: str = "backup_historical") -> list:
    """Main execution point to initialize NLP engine models and detect changes across all active corpora."""
    backup_path = DATA_DIR / backup_directory_name
    corpora_list = ["gst", "rbi", "sebi", "mca", "fema"]
    all_system_alerts = []

    logger.info("Initializing SentenceTransformer model layer for verification validation tasks...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    for corpus in corpora_list:
        corpus_alerts = detect_corpus_changes(corpus, backup_path, model)
        all_system_alerts.extend(corpus_alerts)

    # Output alert manifest file mapped to the Supabase ingestion tier parameters
    manifest_out = DATA_DIR / "checkpoint_report.json"
    with open(manifest_out, "w", encoding="utf-8") as f:
        json.dump(all_system_alerts, f, indent=4)

    logger.info(f"Diff detection routine complete. Generated {len(all_system_alerts)} compliance alert mutations.")
    return all_system_alerts

if __name__ == "__main__":
    run_diff_detection()