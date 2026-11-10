#!/usr/bin/env python3
"""SessionStart: put docs/HANDOFF.md and wiki/index.md in front of the agent."""
import os
from pathlib import Path

root = Path(os.environ.get("CLAUDE_PROJECT_DIR", "."))
for rel in ("docs/HANDOFF.md", "wiki/index.md"):
    p = root / rel
    if p.is_file():
        print(f"===== {rel} =====\n{p.read_text()[:6000]}")
    else:
        print(f"===== {rel} is missing: create it before you finish =====")
