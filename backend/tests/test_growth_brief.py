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
