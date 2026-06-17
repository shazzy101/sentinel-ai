from __future__ import annotations
from observability import log_error

_TABLE = "growth_metrics"
_FIELDS = ("followers", "profile_clicks", "signups")


def compute_delta(rows: list[dict]) -> dict:
    """Today-minus-yesterday for each tracked field. Rows sorted oldest->newest.
    With <2 rows, deltas are 0 (nothing to diff)."""
    if len(rows) < 2:
        return {f: 0 for f in _FIELDS}
    prev, cur = rows[-2], rows[-1]
    return {f: (cur.get(f, 0) or 0) - (prev.get(f, 0) or 0) for f in _FIELDS}


def record_metrics(date: str, followers: int, profile_clicks: int, signups: int) -> bool:
    """Upsert one day's metrics. Best-effort; returns False on any failure
    (e.g. Supabase not configured -> mock client)."""
    try:
        from db.supabase import supabase_client
        supabase_client.table(_TABLE).upsert({
            "date": date, "followers": followers,
            "profile_clicks": profile_clicks, "signups": signups,
        }).execute()
        return True
    except Exception as e:
        log_error("growth_tracker_record_failed", error=str(e)[:200])
        return False


def latest_delta(limit: int = 7) -> dict:
    """Fetch recent metrics rows and compute the most recent day-over-day delta."""
    try:
        from db.supabase import supabase_client
        res = (supabase_client.table(_TABLE).select("*")
               .order("date").limit(limit).execute())
        rows = res.data or []
        return compute_delta(rows)
    except Exception as e:
        log_error("growth_tracker_delta_failed", error=str(e)[:200])
        return {f: 0 for f in _FIELDS}
