"""Local fallback runner — keeps the APEX forward test alive when Railway is down.

Runs ONE generate + monitor cycle against prod Supabase, then exits.
Installed via crontab every 5 minutes. All the usual guards (dedupe, cooldown,
MA gate, daily caps) live in runner.py, so overlapping with a healthy Railway
deployment is harmless — whichever fires first wins, the other skips.

Log: /tmp/apex_local_cron.log
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from trading.runner import generate_signals, monitor_positions  # noqa: E402


def main() -> None:
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        g = generate_signals()
        m = monitor_positions()
        print(f"{ts} generated={g.get('generated')} halted={g.get('halted','')} "
              f"monitor_closed={m.get('closed')} checked={m.get('checked')}")
    except Exception as exc:
        print(f"{ts} ERROR {exc!r}")


if __name__ == "__main__":
    main()
