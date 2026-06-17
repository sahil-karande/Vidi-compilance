"""
Vidi — backend/app/models/thread.py
Day 16 Task: Thread + Message Pydantic Models

Matches Supabase schema (wired in Week 4):
    threads  (id, user_id, title, corpus_tags[], created_at, updated_at)
    messages (id, thread_id, role, content, citations JSON, mode, created_at)
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.user import Corpus, AnswerMode


# ─────────────────────────────────────────────────────────────
#  Message Models
# ─────────────────────────────────────────────────────────────

class MessageRole(str):
    USER      = "user"
    ASSISTANT = "assistant"


class Message(BaseModel):
    """Single message in a chat thread — stored in Supabase messages table."""
    id:          Optional[str]      = None
    thread_id:   str
    role:        str                = "user"       # "user" | "assistant"
    content:     str
    citations:   list[dict]         = Field(default_factory=list)
    mode:        AnswerMode         = AnswerMode.PLAIN
    created_at:  datetime           = Field(default_factory=datetime.utcnow)


class MessageCreate(BaseModel):
    """Payload to create a new message — used internally by /query endpoint."""
    thread_id:  str
    role:       str
    content:    str
    citations:  list[dict]  = Field(default_factory=list)
    mode:       AnswerMode  = AnswerMode.PLAIN


# ─────────────────────────────────────────────────────────────
#  Thread Models
# ─────────────────────────────────────────────────────────────

class Thread(BaseModel):
    """Chat thread grouping messages by topic — Supabase threads table."""
    id:           Optional[str]      = None
    user_id:      str
    title:        str                = "New Conversation"
    corpus_tags:  list[str]          = Field(default_factory=list)
    messages:     list[Message]      = Field(default_factory=list)
    created_at:   datetime           = Field(default_factory=datetime.utcnow)
    updated_at:   datetime           = Field(default_factory=datetime.utcnow)


class ThreadCreate(BaseModel):
    """Payload to create a new thread."""
    title:       str        = "New Conversation"
    corpus_tags: list[str]  = Field(default_factory=list)


class ThreadSummary(BaseModel):
    """Lightweight thread listing — shown in chat sidebar (no messages loaded)."""
    id:          str
    title:       str
    corpus_tags: list[str]
    created_at:  datetime
    updated_at:  datetime
    preview:     str  = ""   # first 100 chars of last message