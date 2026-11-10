#!/usr/bin/env python3
"""PostToolUse (Write/Edit/MultiEdit): format the edited file when the repo has a formatter.
Python: ruff (through uv when the repo has uv.lock). JS/TS/CSS/JSON/Markdown: prettier when package.json lists it.
A formatter failure is reported to the agent, never fatal."""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

root = Path(os.environ.get("CLAUDE_PROJECT_DIR", ".")).resolve()


def has_ruff():
    py = root / "pyproject.toml"
    return (py.is_file() and "ruff" in py.read_text()) or (root / "ruff.toml").is_file()


def has_prettier():
    pkg = root / "package.json"
    if not pkg.is_file():
        return False
    try:
        d = json.loads(pkg.read_text())
    except ValueError:
        return False
    return "prettier" in {**d.get("dependencies", {}), **d.get("devDependencies", {})}


def command(path):
    ext = path.suffix
    if ext == ".py" and has_ruff():
        if (root / "uv.lock").is_file() and shutil.which("uv"):
            return ["uv", "run", "--locked", "ruff", "format", "--force-exclude", str(path)]
        if shutil.which("ruff"):
            return ["ruff", "format", "--force-exclude", str(path)]
    if ext in {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".css", ".json", ".md"} and has_prettier():
        return ["npx", "--no-install", "prettier", "--write", "--ignore-unknown", str(path)]
    return None


def main():
    data = json.load(sys.stdin)
    f = (data.get("tool_input") or {}).get("file_path")
    if not f:
        return
    path = Path(f).resolve()
    if not path.is_file() or not path.is_relative_to(root):
        return
    cmd = command(path)
    if not cmd:
        return
    try:
        r = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired) as e:
        print(f"formatter did not run: {e}", file=sys.stderr)
        return
    if r.returncode:
        print(f"formatter reported a problem in {path.name}:\n{(r.stdout + r.stderr)[-1500:]}", file=sys.stderr)


if __name__ == "__main__":
    main()
