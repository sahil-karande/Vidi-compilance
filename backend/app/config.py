"""
Vidi — backend/app/config.py
Updated Day 37: Added groq_api_key parameter mapping
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables / .env file.
    All fields have safe defaults for local development.
    """

    # ── App ──────────────────────────────────────────────────
    environment: str = "development"          # development | production
    allowed_origins: str = "http://localhost:5173"

    # ── Supabase ─────────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""        # Day 20: Dashboard → Settings → API → JWT Settings → JWT Secret

    # ── LLM APIs ─────────────────────────────────────────────
    gemini_api_key: str = ""
    openrouter_api_key: str = ""
    groq_api_key: str = ""  # 💡 ADD THIS LINE HERE so Pydantic maps GROQ_API_KEY from your .env file

    # ── ChromaDB ─────────────────────────────────────────────
    chroma_host: str = "localhost"
    chroma_port: int = 8001
    chroma_auth_token: str = "vidi_chroma_secret"

    # ── Payments ─────────────────────────────────────────────
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # ── Email ────────────────────────────────────────────────
    resend_api_key: str = ""
    email_from: str = "noreply@vidi.in"

    # ── Pipeline paths (used by backend to read vectordb) ────
    data_dir: str = "./data"
    vectordb_dir: str = "./vectordb"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",          # ignore unrelated env vars
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        """Split comma-separated ALLOWED_ORIGINS into a list for CORS."""
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


# Singleton settings instance — imported across the app
settings = Settings()

# ── Instantiate Supabase Client Singleton (Day 23) ──────────────────────
from supabase import create_client

# This reads directly from your Pydantic settings instance dynamically
supabase = create_client(settings.supabase_url, settings.supabase_anon_key)