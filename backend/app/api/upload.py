"""
RegIQ — backend/app/api/upload.py
Day 40 Complete Implementation: Ingestion Upload, Listing, and Document Purging
"""

import os
import uuid
import tempfile
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from loguru import logger

# ─────────────────────────────────────────────────────────────
#  DYNAMIC ROOT PATH INJECTION (Fixes ModuleNotFoundError)
# ─────────────────────────────────────────────────────────────
project_root = Path(__file__).resolve().parents[3]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
# ─────────────────────────────────────────────────────────────

from app.api.auth import get_current_user, require_role, get_supabase_admin
from app.models.user import User, UserRole
from app.rag.retriever import get_chroma_client, get_embedding_model

# Import specific processing utilities from your pipeline code
from pipeline.chunker import extract_text, clean_text, create_splitter

router = APIRouter()

# Max payload restriction: 10MB limit rule
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 Megabytes


# ── Day 40 Pydantic Response Validation Models ──
class UploadedDocResponse(BaseModel):
    id: str
    filename: str
    uploaded_at: str


@router.post("/upload", status_code=status.HTTP_201_CREATED, tags=["Document Upload"])
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.PRO))
):
    """
    POST /api/upload (Pro and Enterprise users only).
    Accepts custom financial/compliance PDFs, extracts text via PyMuPDF/OCR fallback,
    chunks, embeds, and saves to an isolated namespace inside ChromaDB.
    Tracks state into Supabase uploaded_docs table.
    """
    # 1. Enforce strict content extension filtering
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Only official regulatory PDF files are accepted."
        )

    # 2. Validate maximum file stream capacity limits (10MB)
    try:
        body = await file.read(MAX_FILE_SIZE + 1)
        if len(body) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size boundary exceeded. Maximum permissible threshold is 10MB."
            )
        await file.seek(0)
    except HTTPException:
        raise
    except Exception as size_err:
        logger.error(f"[upload] Error evaluating target binary volume: {size_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error reading file stream properties."
        )

    # Define unique asset structures
    document_id = str(uuid.uuid4())
    user_id = current_user.user_id
    collection_id = f"user_docs_{user_id}"  # Isolated collection per user

    # 3. Create clean system landing buffers for text processors
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        try:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = Path(tmp_file.name)
        except Exception as io_err:
            logger.error(f"[upload] Disk payload stage failure: {io_err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to stage file data to local application block."
            )

    try:
        # 4. Leverage established custom ingestion text extractor (PyMuPDF with OCR Fallback)
        logger.info(f"[upload] Processing extraction matrix on user doc: {file.filename}")
        raw_text, method_used = extract_text(tmp_file_path)
        
        if not raw_text or len(raw_text.strip()) < 5:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Document parsing yielded zero indexable text contents. Check image clarity."
            )

        # 5. Clean text anomalies and structural formatting noise
        sanitized_text = clean_text(raw_text)

        # 6. Apply standard LangChain 512 token split patterns 
        text_splitter = create_splitter()
        raw_chunks = text_splitter.split_text(sanitized_text)
        
        valid_chunks = [c.strip() for c in raw_chunks if len(c.strip()) >= 50]
        if not valid_chunks:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Document text volume is too brief to generate meaningful semantic vectors."
            )

        # 7. Embed using singleton `all-MiniLM-L6-v2` instance
        logger.info(f"[upload] Processing {len(valid_chunks)} semantic mappings via cross encoders...")
        embedding_model = get_embedding_model()
        embeddings = embedding_model.encode(valid_chunks, normalize_embeddings=True).tolist()

        # 8. Bind elements to isolated client collection inside ChromaDB
        chroma_client = get_chroma_client()
        collection = chroma_client.get_or_create_collection(
            name=collection_id,
            metadata={"hnsw:space": "cosine"}
        )

        # Construct specific vector entries
        chroma_ids = [f"user_{document_id}_{idx:04d}" for idx in range(len(valid_chunks))]
        chroma_metadatas = [
            {
                "corpus": "user_docs",
                "filename": file.filename,
                "circular_no": "User Upload",
                "date": datetime.now(timezone.utc).date().isoformat(),
                "title": file.filename.replace(".pdf", ""),
                "chunk_index": idx,
                "total_chunks": len(valid_chunks),
                "extraction_method": method_used,
                "document_id": document_id
            }
            for idx in range(len(valid_chunks))
        ]

        # Bulk register documents into persistent disk space
        collection.add(
            ids=chroma_ids,
            embeddings=embeddings,
            metadatas=chroma_metadatas,
            documents=valid_chunks
        )

        # 9. Sync tracking metadata state safely back to administrative Supabase ledger
        admin_supabase = get_supabase_admin()
        db_payload = {
            "id": document_id,
            "user_id": user_id,
            "filename": file.filename,
            "chroma_collection_id": collection_id,
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }

        supabase_res = admin_supabase.table("uploaded_docs").insert(db_payload).execute()
        if not supabase_res.data:
            raise Exception("Supabase persistent table layer injection returned an empty block.")

        logger.info(f"[upload] Document {file.filename} compiled and indexed successfully for user {user_id}")
        
        return {
            "status": "success",
            "document_id": document_id,
            "filename": file.filename,
            "chunks_processed": len(valid_chunks),
            "chroma_collection": collection_id,
            "extraction_method": method_used
        }

    except HTTPException:
        raise
    except Exception as pipeline_err:
        logger.error(f"[upload] Critical failure running index routines: {pipeline_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"In-flight internal pipeline routing exception: {str(pipeline_err)}"
        )
    finally:
        if tmp_file_path.exists():
            os.unlink(tmp_file_path)


# ── Day 40 Integration: GET /api/upload/list Endpoint ──
@router.get("/upload/list", response_model=List[UploadedDocResponse], tags=["Document Upload"])
async def list_user_documents(current_user: User = Depends(require_role(UserRole.PRO))):
    """
    GET /api/upload/list
    Retrieves all tracking records for the logged-in PRO user from the Supabase ledger.
    """
    try:
        admin_supabase = get_supabase_admin()
        res = admin_supabase.table("uploaded_docs").select("id", "filename", "uploaded_at").eq("user_id", current_user.user_id).execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Failed to fetch document ledger list: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal database tracking retrieval error."
        )


# ── Day 40 Integration: DELETE /api/upload/{doc_id} Endpoint ──
@router.delete("/upload/{doc_id}", tags=["Document Upload"])
async def delete_user_document(doc_id: str, current_user: User = Depends(require_role(UserRole.PRO))):
    """
    DELETE /api/upload/{doc_id}
    Deletes vector references from ChromaDB and purges row tracking entries from Supabase.
    """
    try:
        admin_supabase = get_supabase_admin()
        
        # 1. Clear record entry out of Supabase ledger to verify user ownership
        res = admin_supabase.table("uploaded_docs").delete().eq("id", doc_id).eq("user_id", current_user.user_id).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Document asset not found or user ownership access verification failed."
            )
            
        # 2. Flush target indices out of local ChromaDB disk space
        chroma_client = get_chroma_client()
        collection_id = f"user_docs_{current_user.user_id}"
        
        existing_cols = [c.name for c in chroma_client.list_collections()]
        if collection_id in existing_cols:
            collection = chroma_client.get_collection(name=collection_id)
            # Use metadata dictionary parsing constraint to scrub matches out of memory
            collection.delete(where={"document_id": doc_id})
            
        logger.info(f"[Purge] Document vector space elements {doc_id} successfully dropped.")
        return {"status": "success", "detail": f"Purged document reference {doc_id} completely from server memory."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to execute target structural cleanups: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server-side component flush execution failure."
        )