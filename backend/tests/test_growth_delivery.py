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
