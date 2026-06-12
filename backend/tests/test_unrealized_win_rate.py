"""Tests for unrealized (mark-to-market) win rate.

Realized win rate counts only closed trades. Unrealized win rate also counts
still-held positions, marked to the current price — so a wallet that sells its
winners and holds its losers (the disposition effect) no longer shows a fake
100%.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from copy_trading_winrate import unrealized_win_rate  # noqa: E402


def test_all_closed_winners_no_open_positions():
    completed = [{"profitable": True}, {"profitable": True}]
    assert unrealized_win_rate(completed, [], {}) == 100.0


def test_open_loser_drags_down_a_perfect_realized_record():
    # 3 closed wins, but 1 bag currently underwater (bought at 10, now 6).
    completed = [{"profitable": True}, {"profitable": True}, {"profitable": True}]
    open_positions = [{"token": "ASTEROID", "cost_per_unit": 10.0, "amount": 100.0}]
    prices = {"ASTEROID": 6.0}
    # 3 winners / 4 positions = 75%
    assert unrealized_win_rate(completed, open_positions, prices) == 75.0


def test_open_winner_counts_as_a_win():
    completed = [{"profitable": False}]            # 1 closed loser
    open_positions = [{"token": "INJ", "cost_per_unit": 5.0, "amount": 10.0}]
    prices = {"INJ": 8.0}                           # up → win
    # 1 winner / 2 = 50%
    assert unrealized_win_rate(completed, open_positions, prices) == 50.0


def test_unpriceable_open_position_excluded_from_denominator():
    completed = [{"profitable": True}]
    open_positions = [{"token": "NOPRICE", "cost_per_unit": 1.0, "amount": 5.0}]
    prices = {}                                     # can't price the bag
    # only the 1 priceable (closed) position counts → 100%
    assert unrealized_win_rate(completed, open_positions, prices) == 100.0


def test_no_positions_returns_none():
    assert unrealized_win_rate([], [], {}) is None


if __name__ == "__main__":
    test_all_closed_winners_no_open_positions()
    test_open_loser_drags_down_a_perfect_realized_record()
    test_open_winner_counts_as_a_win()
    test_unpriceable_open_position_excluded_from_denominator()
    test_no_positions_returns_none()
    print("ok: unrealized win rate tests passed")
