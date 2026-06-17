from __future__ import annotations
from pathlib import Path
import yaml
from growth.models import RankedSignal

_TARGETS = Path(__file__).parent / "targets.yaml"


def load_targets() -> list[dict]:
    if not _TARGETS.exists():
        return []
    data = yaml.safe_load(_TARGETS.read_text()) or {}
    return data.get("accounts", [])


def plan(targets: list[dict], top: list[RankedSignal]) -> list[dict]:
    """Pair each target account with the best-fitting top signal to reply with.
    Round-robins through ranked signals so accounts get varied ammo."""
    items = []
    for i, t in enumerate(targets):
        rs = top[i % len(top)] if top else None
        items.append({
            "handle": t.get("handle"),
            "beat": t.get("beat"),
            "suggested_token": rs.signal.token if rs else None,
            "suggested_reply_idx": 0,
        })
    return items
