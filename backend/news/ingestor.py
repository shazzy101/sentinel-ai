"""
News ingestion pipeline.

Fetches free RSS/Atom feeds, dedupes by URL, runs the zero-Claude heuristic
scorer, and upserts into the Supabase `news` table. Designed to run on a cron
and via an admin endpoint. No AI calls happen here.
"""

import asyncio
import hashlib
import re
from datetime import datetime, timezone

import feedparser
import httpx

from .sources import SOURCES
from .scoring import score_article

_UA = "Mozilla/5.0 (compatible; SentinelAI-news/1.0; +https://sentinel-ai-905.pages.dev)"

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _clean(html: str) -> str:
    if not html:
        return ""
    txt = _TAG_RE.sub(" ", html)
    txt = _WS_RE.sub(" ", txt)
    return txt.strip()


def _article_id(url: str) -> str:
    return hashlib.sha1((url or "").encode("utf-8")).hexdigest()[:24]


def _published(entry) -> str:
    for key in ("published_parsed", "updated_parsed"):
        t = entry.get(key)
        if t:
            try:
                return datetime(*t[:6], tzinfo=timezone.utc).isoformat()
            except Exception:
                pass
    return datetime.now(timezone.utc).isoformat()


def _score_entries(feed, source: dict) -> list[dict]:
    """Turn parsed feed entries into scored article records."""
    out: list[dict] = []
    for entry in feed.entries[:25]:
        url = entry.get("link") or ""
        title = _clean(entry.get("title") or "")
        if not url or not title:
            continue
        summary = _clean(entry.get("summary") or entry.get("description") or "")[:1000]
        scores = score_article(title, summary, source["weight"])
        out.append({
            "id": _article_id(url),
            "title": title[:400],
            "source": source["name"],
            "author": (entry.get("author") or "")[:120] or None,
            "url": url,
            "published_at": _published(entry),
            "summary": summary or None,
            **scores,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return out


async def _fetch_source(source: dict, client: httpx.AsyncClient) -> list[dict]:
    """Fetch one feed via httpx (handles redirects/SSL/UA) then parse + score."""
    try:
        resp = await client.get(source["url"])
        if resp.status_code != 200:
            return []
        feed = feedparser.parse(resp.content)
        return _score_entries(feed, source)
    except Exception:
        return []


async def ingest_all(supabase_client) -> dict:
    """Fetch every source concurrently, dedupe, and upsert. Returns stats."""
    async with httpx.AsyncClient(
        timeout=15, follow_redirects=True, headers={"User-Agent": _UA}
    ) as client:
        results = await asyncio.gather(
            *[_fetch_source(s, client) for s in SOURCES],
            return_exceptions=True,
        )
    articles: dict[str, dict] = {}
    for r in results:
        if isinstance(r, Exception):
            continue
        for a in r:
            articles.setdefault(a["id"], a)  # dedupe by url-hash id

    rows = list(articles.values())
    stored = 0
    if rows:
        for i in range(0, len(rows), 100):
            batch = rows[i:i + 100]
            try:
                supabase_client.table("news").upsert(batch, on_conflict="id").execute()
                stored += len(batch)
            except Exception:
                pass
    return {"sources": len(SOURCES), "fetched": len(rows), "stored": stored}
