# Hadaleum Growth Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily "Growth Brief" that turns Hadaleum's live signal data into ready-to-send X posts, reply ammo, and an engagement checklist to break the cold-start (0 followers → 0 reach) problem and drive free signups.

**Architecture:** New `backend/growth/` package. Reuses existing live data functions (`load_copy_traders`, `fetch_recent_copy_moves`, `get_marketing_snapshot`) and `integrations.resend`. Pure, unit-tested ranker + content templates; thin live-data extractor; Markdown brief written to disk and emailed. No auto-posting.

**Tech Stack:** Python 3.11+, pydantic v2, existing repo deps, pytest. Tests live in `backend/tests/` and run from `backend/` (repo's existing convention: `sys.path.insert` to backend root).

**Conventions (read first):**
- All commands run from `~/Sentinel/backend`.
- Run tests with the repo's venv: `cd ~/Sentinel && source venv/bin/activate && cd backend`.
- Growth modules import siblings absolutely: `from growth.models import Signal`.
- Reused modules are top-level: `from copy_traders_store import load_copy_traders`, etc.
- Every test file starts with the repo's path shim:
  ```python
  import sys
  from pathlib import Path
  sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
  ```
- Commit author: `git -c user.name='Shazaib Amlani' -c user.email='shazaib.amlani@gmail.com' commit ...` (or rely on repo config if set).

---

## File Structure

```
backend/growth/
  __init__.py
  models.py            # Signal, RankedSignal, ContentPiece, DailyBrief
  ranker.py            # tweetability_score(), select_top()
  content.py           # make_content()
  alpha_extractor.py   # extract_signals() — live data -> Signal list
  engagement.py        # load_targets(), plan()
  tracker.py           # record_metrics(), latest_delta()
  brief.py             # build_brief(), to_markdown()
  delivery.py          # deliver()
  run_daily.py         # async orchestrator + __main__
  targets.yaml         # curated crypto-X accounts
backend/tests/
  test_growth_ranker.py
  test_growth_content.py
  test_growth_extractor.py
  test_growth_engagement.py
  test_growth_tracker.py
  test_growth_brief.py
docs/growth/briefs/.gitkeep
```

---

## Task 1: Package scaffold + models

**Files:**
- Create: `backend/growth/__init__.py`, `backend/growth/models.py`
- Create: `docs/growth/briefs/.gitkeep`
- Test: `backend/tests/test_growth_models.py`

- [ ] **Step 1: Create `backend/growth/__init__.py` (empty) and `docs/growth/briefs/.gitkeep` (empty)**

- [ ] **Step 2: Write the failing test** `backend/tests/test_growth_models.py`

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from growth.models import Signal, RankedSignal, ContentPiece, DailyBrief


def test_signal_minimal():
    s = Signal(kind="smart_money_buy", token="ARB", action="buy", ts="2026-06-16T12:00:00+00:00")
    assert s.token == "ARB"
    assert s.amount_usd is None


def test_ranked_wraps_signal():
    s = Signal(kind="smart_money_buy", token="ARB", action="buy", ts="2026-06-16T12:00:00+00:00")
    rs = RankedSignal(signal=s, tweetability=4.2, reasons=["recent"])
    assert rs.signal.token == "ARB"
    assert rs.tweetability == 4.2


def test_daily_brief_holds_pieces():
    s = Signal(kind="smart_money_buy", token="ARB", action="buy", ts="2026-06-16T12:00:00+00:00")
    cp = ContentPiece(original_post="x", reply_variants=["a"], cta="hadaleum.com", signal_token="ARB")
    b = DailyBrief(date="2026-06-16", pieces=[cp], engagement=[], metrics_delta={})
    assert b.pieces[0].signal_token == "ARB"
    assert b.date == "2026-06-16"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd ~/Sentinel && source venv/bin/activate && cd backend && pytest tests/test_growth_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'growth'`

- [ ] **Step 4: Write `backend/growth/models.py`**

```python
from __future__ import annotations
from pydantic import BaseModel


class Signal(BaseModel):
    kind: str                       # smart_money_buy | take_profit | win_ledger
    token: str
    action: str = ""                # buy | take_profit | sell | ""
    ts: str                         # ISO timestamp
    trader_label: str | None = None
    rank: int | None = None
    amount_usd: float | None = None
    unrealized_win_rate_pct: float | None = None
    tx_hash: str | None = None
    raw: dict = {}                  # original source dict / ready tweet_hook


class RankedSignal(BaseModel):
    signal: Signal
    tweetability: float
    reasons: list[str] = []


class ContentPiece(BaseModel):
    original_post: str
    reply_variants: list[str]
    cta: str
    signal_token: str


class DailyBrief(BaseModel):
    date: str
    pieces: list[ContentPiece]
    engagement: list[dict]
    metrics_delta: dict
    headline: str | None = None
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_growth_models.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/growth/__init__.py backend/growth/models.py backend/tests/test_growth_models.py docs/growth/briefs/.gitkeep
git commit -m "feat(growth): package scaffold + pydantic models"
```

---

## Task 2: Tweetability ranker

**Files:**
- Create: `backend/growth/ranker.py`
- Test: `backend/tests/test_growth_ranker.py`

- [ ] **Step 1: Write the failing test** `backend/tests/test_growth_ranker.py`

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from growth.models import Signal
from growth.ranker import tweetability_score, select_top

NOW = "2026-06-16T12:00:00+00:00"


def _sig(token, action, amount, ts, winrate=None, rank=None, kind="smart_money_buy"):
    return Signal(kind=kind, token=token, action=action, ts=ts, amount_usd=amount,
                  unrealized_win_rate_pct=winrate, rank=rank)


def test_strong_buy_outranks_weak_exit():
    strong = _sig("ARB", "buy", 80000, "2026-06-16T11:50:00+00:00", winrate=78, rank=2)
    weak = _sig("USDC", "take_profit", 200, "2026-06-15T01:00:00+00:00")
    s_strong, _ = tweetability_score(strong, now=NOW)
    s_weak, _ = tweetability_score(weak, now=NOW)
    assert s_strong > s_weak


def test_reasons_present_for_strong():
    strong = _sig("PEPE", "buy", 50000, "2026-06-16T11:55:00+00:00", winrate=70, rank=1)
    score, reasons = tweetability_score(strong, now=NOW)
    assert score > 0
    assert len(reasons) >= 2


def test_select_top_sorted_and_capped():
    sigs = [
        _sig("USDC", "take_profit", 100, "2026-06-15T00:00:00+00:00"),
        _sig("ARB", "buy", 80000, "2026-06-16T11:50:00+00:00", winrate=78, rank=2),
        _sig("LINK", "buy", 5000, "2026-06-16T10:00:00+00:00", winrate=60, rank=5),
    ]
    top = select_top(sigs, n=2, now=NOW)
    assert len(top) == 2
    assert top[0].tweetability >= top[1].tweetability
    assert top[0].signal.token == "ARB"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_growth_ranker.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'growth.ranker'`

- [ ] **Step 3: Write `backend/growth/ranker.py`**

```python
from __future__ import annotations
import math
from datetime import datetime, timezone
from growth.models import Signal, RankedSignal

# Tokens that read as boring/non-tweetable when they're the headline asset.
_DULL = frozenset({"USDC", "USDT", "DAI", "BUSD", "FRAX", "TUSD", "USDP",
                   "LUSD", "GHO", "PYUSD", "FDUSD"})


def _parse(ts: str) -> datetime | None:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def tweetability_score(s: Signal, now: str | None = None) -> tuple[float, list[str]]:
    """Deterministic score for how tweet-worthy a signal is on crypto X.
    Rewards specific tokens, size, recency, trader quality, and fresh entries."""
    score = 0.0
    reasons: list[str] = []

    tok = (s.token or "").upper()
    if tok and tok not in _DULL:
        score += 2.0
        reasons.append(f"specific token ${tok}")
    else:
        score += 0.3

    if s.amount_usd:
        size_pts = min(s.amount_usd / 20000.0, 1.0) * 3.0
        score += size_pts
        if s.amount_usd >= 25000:
            reasons.append(f"large size ${s.amount_usd:,.0f}")

    now_dt = _parse(now) if now else datetime.now(timezone.utc)
    ts_dt = _parse(s.ts)
    if now_dt and ts_dt:
        mins = (now_dt - ts_dt).total_seconds() / 60.0
        if mins < 60:
            score += 2.0
            reasons.append("very recent (<1h)")
        elif mins < 360:
            score += 1.0
            reasons.append("recent (<6h)")

    if s.unrealized_win_rate_pct is not None:
        score += (s.unrealized_win_rate_pct / 100.0) * 2.0
        if s.unrealized_win_rate_pct >= 65:
            reasons.append(f"{s.unrealized_win_rate_pct:.0f}% win-rate trader")

    if s.rank is not None and s.rank > 0:
        score += min(3.0 / s.rank, 1.5)
        if s.rank <= 3:
            reasons.append(f"top-{s.rank} ranked trader")

    if s.action == "buy":
        score += 1.5
        reasons.append("fresh entry")
    elif s.action == "take_profit":
        score += 0.5

    return round(score, 3), reasons


def select_top(signals: list[Signal], n: int = 5, now: str | None = None) -> list[RankedSignal]:
    ranked = []
    for s in signals:
        score, reasons = tweetability_score(s, now=now)
        ranked.append(RankedSignal(signal=s, tweetability=score, reasons=reasons))
    ranked.sort(key=lambda r: r.tweetability, reverse=True)
    return ranked[:n]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_growth_ranker.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/growth/ranker.py backend/tests/test_growth_ranker.py
git commit -m "feat(growth): deterministic tweetability ranker"
```

---

## Task 3: Content generator

**Files:**
- Create: `backend/growth/content.py`
- Test: `backend/tests/test_growth_content.py`

- [ ] **Step 1: Write the failing test** `backend/tests/test_growth_content.py`

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from growth.models import Signal, RankedSignal
from growth.content import make_content

CTA_HOST = "hadaleum.com"


def _ranked(**kw):
    s = Signal(kind=kw.pop("kind", "smart_money_buy"), token=kw.pop("token", "ARB"),
               action=kw.pop("action", "buy"), ts="2026-06-16T11:50:00+00:00", **kw)
    return RankedSignal(signal=s, tweetability=5.0, reasons=["fresh entry"])


def test_content_has_cta_and_token():
    cp = make_content(_ranked(amount_usd=80000, rank=2, unrealized_win_rate_pct=78))
    assert CTA_HOST in cp.cta
    assert "ARB" in cp.original_post
    assert cp.signal_token == "ARB"


def test_all_strings_within_x_limit():
    cp = make_content(_ranked(amount_usd=80000, rank=2, unrealized_win_rate_pct=78))
    assert len(cp.original_post) <= 280
    assert all(len(v) <= 280 for v in cp.reply_variants)
    assert len(cp.reply_variants) >= 2


def test_win_ledger_uses_ready_hook():
    s = Signal(kind="win_ledger", token="ETH", action="", ts="2026-06-16T11:50:00+00:00",
               raw={"tweet_hook": "🟢 Hadaleum flagged moves: 71% win rate. hadaleum.com/wins"})
    rs = RankedSignal(signal=s, tweetability=3.0, reasons=[])
    cp = make_content(rs)
    assert cp.original_post.startswith("🟢")
    assert "hadaleum.com" in cp.original_post
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_growth_content.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'growth.content'`

- [ ] **Step 3: Write `backend/growth/content.py`**

```python
from __future__ import annotations
from growth.models import RankedSignal, ContentPiece

CTA = "Live smart-money feed → hadaleum.com (free)"


def _verb(action: str) -> str:
    return {"buy": "aped into", "take_profit": "took profit on",
            "sell": "exited"}.get(action, "moved on")


def _truncate(text: str, limit: int = 280) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def make_content(rs: RankedSignal) -> ContentPiece:
    s = rs.signal

    # Win-ledger signals already carry a ready-to-post hook from marketing snapshot.
    if s.kind == "win_ledger":
        hook = (s.raw or {}).get("tweet_hook") or f"Hadaleum win ledger update. {CTA}"
        return ContentPiece(original_post=_truncate(hook), reply_variants=[_truncate(hook)],
                            cta=CTA, signal_token=s.token or "")

    tok = (s.token or "").upper()
    size = f"${s.amount_usd:,.0f}" if s.amount_usd else "a position"
    wr = f" ({s.unrealized_win_rate_pct:.0f}% win rate)" if s.unrealized_win_rate_pct else ""
    rank = f"#{s.rank} " if s.rank else ""
    verb = _verb(s.action)

    original = _truncate(
        f"Smart-money watch: a {rank}ranked wallet{wr} just {verb} {size} of ${tok}. "
        f"On-chain, verifiable. {CTA}")

    reply_variants = [
        _truncate(f"FWIW a top-ranked on-chain wallet{wr} just {verb} {size} of ${tok}. "
                  f"Tracking it live: hadaleum.com"),
        _truncate(f"${tok} flow note: ranked smart money {verb} {size} here. "
                  f"Full feed (free) → hadaleum.com"),
        _truncate(f"Worth a look — ${tok} just saw a {rank}ranked wallet {verb} {size}. "
                  f"hadaleum.com"),
    ]
    return ContentPiece(original_post=original, reply_variants=reply_variants,
                        cta=CTA, signal_token=tok)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_growth_content.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/growth/content.py backend/tests/test_growth_content.py
git commit -m "feat(growth): content generator (posts + reply variants + CTA)"
```

---

## Task 4: Alpha extractor (live data)

**Files:**
- Create: `backend/growth/alpha_extractor.py`
- Test: `backend/tests/test_growth_extractor.py`

- [ ] **Step 1: Write the failing test** `backend/tests/test_growth_extractor.py`

```python
import sys
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import growth.alpha_extractor as ax
from growth.models import Signal


def test_extract_maps_moves_and_winledger(monkeypatch):
    fake_traders = [{"address": "0xAAA", "label": "Alpha", "metrics": {}}]
    fake_moves = [{
        "bought": "ARB", "sold": "USDC", "amount_usd": 80000, "action": "buy",
        "time": "2026-06-16T11:50:00+00:00", "tx_hash": "0xtx", "trader_label": "Alpha",
        "rank": 2, "unrealized_win_rate_pct": 78,
    }]
    fake_snapshot = {"tweet_hooks": ["🟢 71% win rate across scored moves. hadaleum.com/wins"]}

    monkeypatch.setattr(ax, "load_copy_traders", lambda **k: fake_traders)

    async def _fake_moves(traders, **k):
        return fake_moves
    monkeypatch.setattr(ax, "fetch_recent_copy_moves", _fake_moves)

    async def _fake_snap():
        return fake_snapshot
    monkeypatch.setattr(ax, "get_marketing_snapshot", _fake_snap)

    signals = asyncio.run(ax.extract_signals(limit=10))
    kinds = {s.kind for s in signals}
    assert "smart_money_buy" in kinds
    assert "win_ledger" in kinds
    buy = next(s for s in signals if s.kind == "smart_money_buy")
    assert buy.token == "ARB"
    assert buy.amount_usd == 80000
    assert buy.ts == "2026-06-16T11:50:00+00:00"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_growth_extractor.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'growth.alpha_extractor'`

- [ ] **Step 3: Write `backend/growth/alpha_extractor.py`**

```python
from __future__ import annotations
from copy_traders_store import load_copy_traders
from copy_trader_moves import fetch_recent_copy_moves
from detected_moves import get_marketing_snapshot
from growth.models import Signal

_BUY_KINDS = {"buy": "smart_money_buy", "take_profit": "take_profit"}


def _move_to_signal(m: dict) -> Signal:
    action = m.get("action") or ""
    kind = _BUY_KINDS.get(action, "smart_money_buy")
    # The headline token is what was bought (entry) or, for take-profit, what was sold.
    token = (m.get("bought") if action != "take_profit" else m.get("sold")) or m.get("bought") or ""
    return Signal(
        kind=kind, token=token, action=action,
        ts=m.get("time") or "",
        trader_label=m.get("trader_label"),
        rank=m.get("rank"),
        amount_usd=m.get("amount_usd"),
        unrealized_win_rate_pct=m.get("unrealized_win_rate_pct"),
        tx_hash=m.get("tx_hash"),
        raw=m,
    )


async def extract_signals(limit: int = 15) -> list[Signal]:
    """Pull live smart-money moves + win-ledger hooks, normalized to Signals."""
    traders = load_copy_traders()
    moves = await fetch_recent_copy_moves(traders, limit=limit)
    signals = [_move_to_signal(m) for m in moves if (m.get("bought") or m.get("sold"))]

    snap = await get_marketing_snapshot()
    for hook in (snap.get("tweet_hooks") or [])[:2]:
        signals.append(Signal(kind="win_ledger", token="", action="",
                              ts="", raw={"tweet_hook": hook}))
    return signals
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_growth_extractor.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/growth/alpha_extractor.py backend/tests/test_growth_extractor.py
git commit -m "feat(growth): live alpha extractor (copy moves + win ledger)"
```

---

## Task 5: Engagement planner + targets

**Files:**
- Create: `backend/growth/engagement.py`, `backend/growth/targets.yaml`
- Test: `backend/tests/test_growth_engagement.py`

- [ ] **Step 1: Write `backend/growth/targets.yaml`**

```yaml
# Big crypto-X accounts to borrow audience from. Reply under their FRESH posts
# (first 5-15 min) with matched alpha. Edit freely. 'beat' helps the planner
# match a signal to the account. 'handle' is display-only (you watch manually).
accounts:
  - handle: "@AltcoinGordon"
    beat: "altcoins"
  - handle: "@CryptoKaleo"
    beat: "majors"
  - handle: "@inversebrah"
    beat: "memecoins"
  - handle: "@DegenSpartan"
    beat: "defi"
```

- [ ] **Step 2: Write the failing test** `backend/tests/test_growth_engagement.py`

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from growth.models import Signal, RankedSignal
from growth.engagement import load_targets, plan


def _rs(token, tweetability):
    s = Signal(kind="smart_money_buy", token=token, action="buy",
               ts="2026-06-16T11:50:00+00:00")
    return RankedSignal(signal=s, tweetability=tweetability, reasons=[])


def test_load_targets_reads_yaml():
    targets = load_targets()
    assert isinstance(targets, list)
    assert all("handle" in t for t in targets)


def test_plan_pairs_each_account_with_a_signal():
    targets = [{"handle": "@A", "beat": "memecoins"}, {"handle": "@B", "beat": "majors"}]
    top = [_rs("PEPE", 5.0), _rs("ETH", 4.0)]
    items = plan(targets, top)
    assert len(items) == 2
    assert all(item["handle"] in ("@A", "@B") for item in items)
    assert all("suggested_token" in item for item in items)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/test_growth_engagement.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'growth.engagement'`

- [ ] **Step 4: Write `backend/growth/engagement.py`**

```python
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_growth_engagement.py -v`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/growth/engagement.py backend/growth/targets.yaml backend/tests/test_growth_engagement.py
git commit -m "feat(growth): engagement planner + seed target accounts"
```

---

## Task 6: Tracker (Supabase metrics + delta)

**Files:**
- Create: `backend/growth/tracker.py`
- Test: `backend/tests/test_growth_tracker.py`

- [ ] **Step 1: Write the failing test** `backend/tests/test_growth_tracker.py`

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from growth import tracker


def test_delta_math():
    rows = [
        {"date": "2026-06-15", "followers": 10, "profile_clicks": 5, "signups": 1},
        {"date": "2026-06-16", "followers": 18, "profile_clicks": 12, "signups": 3},
    ]
    d = tracker.compute_delta(rows)
    assert d["followers"] == 8
    assert d["profile_clicks"] == 7
    assert d["signups"] == 2


def test_delta_handles_single_row():
    rows = [{"date": "2026-06-16", "followers": 5, "profile_clicks": 2, "signups": 0}]
    d = tracker.compute_delta(rows)
    assert d["followers"] == 0   # no prior day to diff against
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_growth_tracker.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'growth.tracker'`

- [ ] **Step 3: Write `backend/growth/tracker.py`**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_growth_tracker.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Add the Supabase table (manual note — record in plan output)**

The `growth_metrics` table must exist in Supabase for live persistence (tests use mock):
```sql
CREATE TABLE IF NOT EXISTS growth_metrics (
  date date PRIMARY KEY,
  followers integer DEFAULT 0,
  profile_clicks integer DEFAULT 0,
  signups integer DEFAULT 0
);
```
This is a manual action for the operator; the code degrades gracefully without it.

- [ ] **Step 6: Commit**

```bash
git add backend/growth/tracker.py backend/tests/test_growth_tracker.py
git commit -m "feat(growth): metrics tracker + day-over-day delta"
```

---

## Task 7: Brief builder (Markdown)

**Files:**
- Create: `backend/growth/brief.py`
- Test: `backend/tests/test_growth_brief.py`

- [ ] **Step 1: Write the failing test** `backend/tests/test_growth_brief.py`

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from growth.models import ContentPiece, DailyBrief
from growth.brief import build_brief, to_markdown


def _piece(tok):
    return ContentPiece(original_post=f"post about {tok}", reply_variants=[f"reply {tok}"],
                        cta="hadaleum.com", signal_token=tok)


def test_build_brief_assembles():
    b = build_brief(date="2026-06-16", pieces=[_piece("ARB")],
                    engagement=[{"handle": "@A", "suggested_token": "ARB"}],
                    metrics_delta={"followers": 8, "profile_clicks": 7, "signups": 2},
                    headline="71% win rate")
    assert isinstance(b, DailyBrief)
    assert b.headline == "71% win rate"


def test_markdown_contains_key_sections():
    b = build_brief(date="2026-06-16", pieces=[_piece("ARB")],
                    engagement=[{"handle": "@A", "suggested_token": "ARB"}],
                    metrics_delta={"followers": 8, "profile_clicks": 7, "signups": 2},
                    headline="71% win rate")
    md = to_markdown(b)
    assert "2026-06-16" in md
    assert "ARB" in md
    assert "@A" in md
    assert "followers" in md.lower()
    assert "post about ARB" in md
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_growth_brief.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'growth.brief'`

- [ ] **Step 3: Write `backend/growth/brief.py`**

```python
from __future__ import annotations
from growth.models import ContentPiece, DailyBrief


def build_brief(date: str, pieces: list[ContentPiece], engagement: list[dict],
                metrics_delta: dict, headline: str | None = None) -> DailyBrief:
    return DailyBrief(date=date, pieces=pieces, engagement=engagement,
                      metrics_delta=metrics_delta, headline=headline)


def to_markdown(b: DailyBrief) -> str:
    lines = [f"# Hadaleum Growth Brief — {b.date}", ""]
    if b.headline:
        lines += [f"> {b.headline}", ""]

    d = b.metrics_delta or {}
    lines += ["## Yesterday's movement",
              f"- followers: {d.get('followers', 0):+d}  "
              f"profile clicks: {d.get('profile_clicks', 0):+d}  "
              f"signups: {d.get('signups', 0):+d}", ""]

    lines += ["## Today's posts (send the best 2-3)", ""]
    for i, p in enumerate(b.pieces, 1):
        lines += [f"### {i}. ${p.signal_token or 'update'}",
                  "**Original post:**", "", f"> {p.original_post}", "",
                  "**Reply variants:**"]
        lines += [f"- {v}" for v in p.reply_variants]
        lines += [""]

    lines += ["## Engagement checklist (reply under FRESH posts, first 5-15 min)", ""]
    for item in b.engagement:
        lines += [f"- [ ] {item.get('handle')} ({item.get('beat', '')}) — "
                  f"lead with ${item.get('suggested_token') or 'top signal'}"]
    lines += [""]
    return "\n".join(lines)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_growth_brief.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/growth/brief.py backend/tests/test_growth_brief.py
git commit -m "feat(growth): markdown brief builder"
```

---

## Task 8: Delivery + daily orchestrator

**Files:**
- Create: `backend/growth/delivery.py`, `backend/growth/run_daily.py`
- Test: `backend/tests/test_growth_delivery.py`

- [ ] **Step 1: Write the failing test** `backend/tests/test_growth_delivery.py`

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import growth.delivery as delivery


def test_write_brief_file(tmp_path, monkeypatch):
    monkeypatch.setattr(delivery, "BRIEF_DIR", tmp_path)
    path = delivery.write_brief("2026-06-16", "# hello brief")
    assert path.exists()
    assert "hello brief" in path.read_text()
    assert path.name == "2026-06-16.md"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_growth_delivery.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'growth.delivery'`

- [ ] **Step 3: Write `backend/growth/delivery.py`**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_growth_delivery.py -v`
Expected: PASS

- [ ] **Step 5: Write `backend/growth/run_daily.py`**

```python
from __future__ import annotations
import asyncio
from datetime import datetime, timezone
from growth.alpha_extractor import extract_signals
from growth.ranker import select_top
from growth.content import make_content
from growth.engagement import load_targets, plan
from growth.tracker import latest_delta
from growth.brief import build_brief, to_markdown
from growth.delivery import deliver
from detected_moves import get_marketing_snapshot


async def run() -> str:
    date = datetime.now(timezone.utc).date().isoformat()
    signals = await extract_signals(limit=15)
    top = select_top(signals, n=5)
    pieces = [make_content(rs) for rs in top]
    targets = load_targets()
    engagement = plan(targets, top)
    delta = latest_delta()
    snap = await get_marketing_snapshot()
    brief = build_brief(date=date, pieces=pieces, engagement=engagement,
                        metrics_delta=delta, headline=snap.get("headline"))
    md = to_markdown(brief)
    path = await deliver(date, md)
    print(f"[growth] brief written -> {path}")
    return md


if __name__ == "__main__":
    asyncio.run(run())
```

- [ ] **Step 6: Commit**

```bash
git add backend/growth/delivery.py backend/growth/run_daily.py backend/tests/test_growth_delivery.py
git commit -m "feat(growth): delivery (file+email) + daily orchestrator CLI"
```

---

## Task 9: Full-suite verification + live smoke

- [ ] **Step 1: Run the whole growth suite**

Run: `cd ~/Sentinel && source venv/bin/activate && cd backend && pytest tests/test_growth_*.py -v`
Expected: ALL PASS.

- [ ] **Step 2: Live smoke (real data, writes a real brief, no email needed)**

Run: `cd ~/Sentinel/backend && python -m growth.run_daily`
Expected: prints `[growth] brief written -> .../docs/growth/briefs/<today>.md`. Open that file;
it should contain real tokens/posts if live data is available, or win-ledger hooks at minimum.
If `load_copy_traders` returns empty (no Supabase/JSON), the brief still builds from win-ledger
hooks — acceptable. Note any empty-data condition rather than treating it as a failure.

- [ ] **Step 3: Confirm no regressions in existing tests**

Run: `cd ~/Sentinel/backend && pytest -q`
Expected: existing suite still green (growth is additive; nothing else touched).

- [ ] **Step 4: Commit any brief artifact if desired (optional)**

```bash
# The generated brief under docs/growth/briefs/ may be committed as a sample, or gitignored.
git add docs/growth/briefs/ 2>/dev/null || true
```

---

## Notes for the executor

- **No auto-posting exists or should be added.** Every output is for a human to send. Keep it that way.
- **Empty live data is not a failure.** Cold-start day one may have thin copy-move data; the brief should still produce win-ledger posts + the engagement checklist.
- **The win condition is leading indicators** (profile clicks, follows, signups logged via `tracker.record_metrics`), not instant revenue. Operator logs yesterday's numbers daily so the delta line stays real.
- **Brand strings say "Hadaleum"**, never "Sentinel", in any user-facing/content output.
