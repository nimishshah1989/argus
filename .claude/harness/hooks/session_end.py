#!/usr/bin/env python3
"""SessionEnd: refresh the machine-written facts at the bottom of docs/HANDOFF.md (branch, latest commits,
uncommitted files) and append one line to wiki/log.md. The agent writes the top of the handoff itself."""
import datetime
import json
import os
import subprocess
import sys
from pathlib import Path

root = Path(os.environ.get("CLAUDE_PROJECT_DIR", "."))
START, END = "<!-- facts: written by the session-end hook -->", "<!-- end facts -->"


def git(*args):
    try:
        return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, timeout=20).stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        return ""


def main():
    try:
        data = json.load(sys.stdin)
    except ValueError:
        data = {}
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    br = git("branch", "--show-current") or "(detached)"
    commits = git("log", "-3", "--format=%h %s").splitlines()
    dirty = git("status", "--porcelain").splitlines()
    facts = [START, f"Last session ended {now} on branch `{br}`.",
             *[f"- {c}" for c in commits],
             f"Uncommitted files: {len(dirty)}" + (f" (first: {dirty[0][3:]})" if dirty else ""), END]

    handoff = root / "docs" / "HANDOFF.md"
    handoff.parent.mkdir(parents=True, exist_ok=True)
    text = handoff.read_text() if handoff.is_file() else "# Handoff\n"
    if START in text and END in text:
        head, rest = text.split(START, 1)
        text = head + "\n".join(facts) + rest.split(END, 1)[1]
    else:
        text = text.rstrip("\n") + "\n\n" + "\n".join(facts) + "\n"
    handoff.write_text(text)

    log = root / "wiki" / "log.md"
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a") as f:
        if log.stat().st_size == 0:
            f.write("# Log (append-only)\n\n")
        f.write(f"- {now} session {data.get('session_id', '?')[:8]} on `{br}`: "
                f"{commits[0] if commits else 'no commits'}\n")


if __name__ == "__main__":
    main()
