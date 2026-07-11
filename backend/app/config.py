from functools import lru_cache
from pathlib import Path
import os


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"


def _load_env_file() -> None:
    if not ENV_PATH.exists():
        return
    for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file()


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


class Settings:
    admin_password_hash: str = os.getenv("ADMIN_PASSWORD_HASH", "")
    session_secret: str = os.getenv("SESSION_SECRET", "dev-session-secret")
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    cookie_secure: bool = _env_bool("COOKIE_SECURE", frontend_origin.startswith("https://"))
    cookie_samesite: str = os.getenv(
        "COOKIE_SAMESITE",
        "none" if frontend_origin.startswith("https://") else "lax",
    ).lower()
    ai_provider: str = os.getenv("AI_PROVIDER", "")
    ai_model: str = os.getenv("AI_MODEL", "")
    ai_api_key: str = os.getenv("AI_API_KEY", "")
    auto_summarize_on_save: bool = os.getenv("AUTO_SUMMARIZE_ON_SAVE", "false").lower() == "true"

    data_dir: Path = BASE_DIR / "data"
    posts_dir: Path = data_dir / "posts"
    comments_dir: Path = data_dir / "comments"
    uploads_dir: Path = data_dir / "uploads"
    posts_index_path: Path = posts_dir / "index.json"
    categories_path: Path = data_dir / "categories.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
