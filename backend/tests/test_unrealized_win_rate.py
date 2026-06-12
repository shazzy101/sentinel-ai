"""Tests for unrealized (mark-to-market) win rate.

Realized win rate counts only closed trades. Unrealized win rate also counts
still-held positions: priced bags are marked to market, and a bag that's been
held a long time with NO price is treated as a loss (dead/illiquid). A recently
bought, not-yet-indexed token is excluded (we can't fairly judge it yet).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from copy_trading_winrate import unrealized_win_rate  # noqa: E402

NOW = 1_000_000_000
DAY = 86_400


def test_all_closed_winners_no_open_positions():
    completed = [{"profitable": True}, {"profitable": True}]
    assert unrealized_win_rate(completed, [], {}, now_ts=NOW) == 100.0


def test_priced_open_loser_drags_down_a_perfect_record():
    completed = [{"profitable": True}, {"profitable": True}, {"profitable": True}]
    open_positions = [{"token": "ASTEROID", "cost_per_unit": 10.0, "amount": 100.0, "buy_ts": NOW - DAY}]
    prices = {"ASTEROID": 6.0}            # priced + down → loss
    assert unrealized_win_rate(completed, open_positions, prices, now_ts=NOW) == 75.0


def test_priced_open_winner_counts_as_win():
    completed = [{"profitable": False}]
    open_positions = [{"token": "INJ", "cost_per_unit": 5.0, "amount": 10.0, "buy_ts": NOW - DAY}]
    prices = {"INJ": 8.0}                 # priced + up → win
    assert unrealized_win_rate(completed, open_positions, prices, now_ts=NOW) == 50.0


def test_old_unpriceable_bag_counts_as_loss():
    completed = [{"profitable": True}, {"profitable": True}]
    open_positions = [{"token": "DEADCOIN", "cost_per_unit": 1.0, "amount": 5.0, "buy_ts": NOW - 30 * DAY}]
    prices = {}                           # held 30d, no price → dead → loss
    # 2 wins / 3 positions = 66.7
    assert unrealized_win_rate(completed, open_positions, prices, now_ts=NOW) == 66.7


def test_recent_unpriceable_bag_excluded():
    completed = [{"profitable": True}]
    open_positions = [{"token": "JUSTLAUNCHED", "cost_per_unit": 1.0, "amount": 5.0, "buy_ts": NOW - 2 * DAY}]
    prices = {}                           # held 2d, no price → maybe just un-indexed → exclude
    assert unrealized_win_rate(completed, open_positions, prices, now_ts=NOW) == 100.0


def test_no_positions_returns_none():
    assert unrealized_win_rate([], [], {}, now_ts=NOW) is None


if __name__ == "__main__":
    for fn in [
        test_all_closed_winners_no_open_positions,
        test_priced_open_loser_drags_down_a_perfect_record,
        test_priced_open_winner_counts_as_win,
        test_old_unpriceable_bag_counts_as_loss,
        test_recent_unpriceable_bag_excluded,
        test_no_positions_returns_none,
    ]:
        fn()
    print("ok: unrealized win rate tests passed")
