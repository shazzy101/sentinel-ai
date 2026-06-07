"""Load environment variables before any chain/API modules are imported."""
from pathlib import Path

from dotenv import load_dotenv

# Always resolve backend/.env regardless of process cwd (uvicorn, scripts, etc.)
_ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(_ENV_PATH, override=True)
