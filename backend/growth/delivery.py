from __future__ import annotations
import os
from pathlib import Path
from integrations.resend import send_email, is_configured

# docs/growth/briefs relative to repo root (backend/growth/delivery.py -> ../../docs/...)
BRIEF_DIR = Path(__file__).resolve().parent.parent.parent / "docs" / "growth" / "briefs"


def write_brief(date: str, markdown: str) -> Path:
    BRIEF_DIR.mkdir(parents=True, exist_ok=True)
    path = BRIEF_DIR / f"{date}.md"
    path.write_text(markdown)
    return path


def _md_to_html(markdown: str) -> str:
    # Minimal: preserve as preformatted text; good enough for a daily ops email.
    escaped = markdown.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f"<pre style='font-family:ui-monospace,monospace;white-space:pre-wrap'>{escaped}</pre>"


async def email_brief(date: str, markdown: str) -> bool:
    if not is_configured():
        return False
    to = os.getenv("GROWTH_BRIEF_TO") or os.getenv("OPERATOR_EMAIL")
    if not to:
        return False
    return await send_email(to, f"Hadaleum Growth Brief — {date}", _md_to_html(markdown))


async def deliver(date: str, markdown: str) -> Path:
    path = write_brief(date, markdown)
    await email_brief(date, markdown)   # best-effort; never raises
    return path
