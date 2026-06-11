#!/usr/bin/env python3
"""
Launch smoke test — hits every public endpoint and asserts a healthy response
shape. Run against prod or local:

    python3 scripts/smoke_test.py                  # prod
    BASE=http://localhost:8000 python3 scripts/smoke_test.py

Exit code 0 = all green, 1 = at least one failure. No external deps (urllib).
"""

import json
import os
import ssl
import sys
import urllib.request
import urllib.error

BASE = os.getenv("BASE", "https://backend-production-250bf.up.railway.app").rstrip("/")
TIMEOUT = 25

PASS, FAIL = [], []

# Verified context by default; fall back to certifi, then unverified, so the
# test runs on machines with a broken local CA bundle (common on macOS Python).
try:
    import certifi  # type: ignore
    _CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:  # noqa: BLE001
    _CTX = ssl.create_default_context()
_UNVERIFIED = ssl._create_unverified_context()


def _get(path: str):
    req = urllib.request.Request(BASE + path, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=_CTX) as r:
            return r.status, r.read()
    except urllib.error.URLError as e:
        if isinstance(getattr(e, "reason", None), ssl.SSLError):
            with urllib.request.urlopen(req, timeout=TIMEOUT, context=_UNVERIFIED) as r:
                return r.status, r.read()
        raise


def check(name: str, path: str, *, expect_keys=None, want_status=200, raw=False):
    try:
        status, body = _get(path)
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read()
    except Exception as e:  # noqa: BLE001
        FAIL.append(f"{name} [{path}] — request error: {e}")
        return None
    if status != want_status:
        FAIL.append(f"{name} [{path}] — HTTP {status} (wanted {want_status})")
        return None
    if raw:
        PASS.append(f"{name} [{path}] — {status} ({len(body)} bytes)")
        return body
    try:
        data = json.loads(body)
    except Exception:  # noqa: BLE001
        FAIL.append(f"{name} [{path}] — invalid JSON")
        return None
    payload = data.get("data", data) if isinstance(data, dict) else data
    if expect_keys:
        missing = [k for k in expect_keys if not (isinstance(payload, dict) and k in payload)]
        if missing:
            FAIL.append(f"{name} [{path}] — missing keys {missing}")
            return None
    PASS.append(f"{name} [{path}] — {status}")
    return payload


def main():
    print(f"Smoke test → {BASE}\n")

    check("Stats", "/api/stats", expect_keys=["count"])
    check("Copy traders top", "/api/copy-trading/top?limit=3", expect_keys=["wallets", "total_qualified"])
    check("Copy featured", "/api/copy-trading/featured", expect_keys=["traders"])
    check("Recent moves", "/api/copy-trading/recent-moves?limit=3", expect_keys=["moves"])
    check("Latest transactions", "/api/transactions/latest?limit=3", expect_keys=["transactions"])
    check("Intelligence summary", "/api/intelligence/summary")
    check("Intelligence signals", "/api/intelligence/signals")
    check("Network pulse", "/api/network/pulse")
    check("Network top tokens", "/api/network/top-tokens")
    check("News list", "/api/news?limit=5", expect_keys=["articles"])
    check("News pulse", "/api/news/pulse")
    check("Trust pulse", "/api/trust-pulse")
    check("Trust marketing", "/api/trust-pulse/marketing", expect_keys=["stats_30d", "equity_curve"])
    check("Detected wins", "/api/detected-wins?limit=5", expect_keys=["wins"])
    check("OG image", "/api/trust/og.svg", raw=True)

    print("PASS:")
    for p in PASS:
        print(f"  ✓ {p}")
    if FAIL:
        print("\nFAIL:")
        for f in FAIL:
            print(f"  ✗ {f}")
    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
