"""
Vidi — backend/app/config.py
Day 11 Task: Environment configuration

Loads settings from .env using pydantic-settings.
Single source of truth for all environment variables across the backend.
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

    # ── LLM APIs ─────────────────────────────────────────────
    gemini_api_key: str = ""
    openrouter_api_key: str = ""

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
        # Checks for .env in both the execution root and the explicit backend subdirectory
        env_file=[".env", "backend/.env"],
        env_file_encoding="utf-8",
        extra="ignore",          # ignore unrelated env vars
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        """Split comma-separated ALLOWED_ORIGINS into a list for CORS."""
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


# Singleton settings instance — imported across the app
settings = Settings()"""
Vidi — backend/app/config.py
Updated Day 20: Added supabase_jwt_secret field
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