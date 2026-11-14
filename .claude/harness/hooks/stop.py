#!/usr/bin/env python3
"""Stop: the fast tests (.claude/harness/fast-tests.sh, the repo's own) must pass before the agent finishes.
After three failures in a row it lets the agent stop, so a red test it cannot fix gets reported, not looped on."""
import json
import os
import subprocess
import sys
from pathlib import Path

root = Path(os.environ.get("CLAUDE_PROJECT_DIR", "."))
script = root / ".claude" / "harness" / "fast-tests.sh"
counter = root / ".claude" / "harness" / ".stop-failures"


def main():
    json.load(sys.stdin)
    if not script.is_file():
        return
    # Only when code changed: a turn that touched docs, or nothing, does not pay for a test run.
    changed = subprocess.run(["git", "status", "--porcelain"], cwd=root, capture_output=True, text=True).stdout
    if not any(line[3:].startswith(("apps/", "packages/", "scripts/", "tools/")) for line in changed.splitlines()):
        counter.unlink(missing_ok=True)
        return
    try:
        r = subprocess.run(["bash", str(script)], cwd=root, capture_output=True, text=True, timeout=840)
        ok, out = r.returncode == 0, r.stdout + r.stderr
    except subprocess.TimeoutExpired:
        ok, out = False, "the fast tests took longer than 14 minutes"
    if ok:
        counter.unlink(missing_ok=True)
        return
    n = int(counter.read_text() or 0) + 1 if counter.is_file() else 1
    if n >= 3:
        counter.unlink(missing_ok=True)
        print("The fast tests failed three times in a row. Stop, and write the failure into docs/HANDOFF.md.",
              file=sys.stderr)
        return
    counter.write_text(str(n))
    print(json.dumps({"decision": "block",
                      "reason": f"The fast tests fail (attempt {n} of 3). Fix the cause, not the test:\n{out[-3000:]}"}))


if __name__ == "__main__":
    main()
