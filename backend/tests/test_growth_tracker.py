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
