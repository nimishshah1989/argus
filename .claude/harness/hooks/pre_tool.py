#!/usr/bin/env python3
"""PreToolUse: refuse secrets in files, pushes to main/master, force-pushes, --no-verify,
and deleting or skipping tests. Exit 2 blocks the tool call; stderr tells the agent why."""
import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

SECRETS = [
    (r"AKIA[0-9A-Z]{16}", "an AWS access key"),
    (r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----", "a private key"),
    (r"\bgh[pousr]_[A-Za-z0-9]{36,}", "a GitHub token"),
    (r"\bgithub_pat_[A-Za-z0-9_]{40,}", "a GitHub token"),
    (r"\bsk-ant-[A-Za-z0-9_-]{20,}", "an Anthropic key"),
    (r"\bsk-(?:proj-)?[A-Za-z0-9]{32,}", "an OpenAI-style key"),
    (r"\bxox[abprs]-[A-Za-z0-9-]{10,}", "a Slack token"),
    (r"\bAIza[0-9A-Za-z_-]{35}", "a Google API key"),
]
TEST_PATH = re.compile(r"(^|/)(tests?|__tests__|e2e|spec)/|(^|/)test_[^/]*\.py$|_test\.(py|go)$|\.(test|spec)\.[cm]?[jt]sx?$")
SKIP = re.compile(r"pytest\.mark\.skip\b(?!if)|pytest\.skip\(|unittest\.skip\b|\b(?:it|test|describe)\.(?:skip|only)\(|\bx(?:it|describe|test)\(")


def block(why):
    print(f"Blocked by the harness: {why}", file=sys.stderr)
    sys.exit(2)


def branch():
    try:
        return subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True,
                              cwd=os.environ.get("CLAUDE_PROJECT_DIR", ".")).stdout.strip()
    except OSError:
        return ""


def check_bash(cmd):
    for part in re.split(r"&&|\|\||;|\|", cmd):
        try:
            words = shlex.split(part)
        except ValueError:
            words = part.split()
        if not words:
            continue
        if "git" in words and "--no-verify" in words:
            block("--no-verify skips the repository's checks.")
        if "git" in words and "push" in words:
            args = words[words.index("push") + 1:]
            if any(a in ("-f", "--force", "--force-with-lease") or a.startswith("--force") for a in args):
                block("force-pushing rewrites shared history.")
            refs = [a for a in args if not a.startswith("-")][1:]
            if any(r.startswith("+") for r in refs):
                block("a '+' refspec is a force-push.")
            targets = [r.split(":")[-1] for r in refs]
            if any(t in ("main", "master", "refs/heads/main", "refs/heads/master") for t in targets) or \
                    (not refs and branch() in ("main", "master")):
                block("never push to main or master; push a branch and open a pull request.")
        if words[0] == "rm" or words[:2] == ["git", "rm"]:
            if any(TEST_PATH.search(w) for w in words[1:] if not w.startswith("-")):
                block("deleting a test is not allowed; a wrong test is a question for the planner.")


def check_file(path, old, new):
    for pattern, what in SECRETS:
        if re.search(pattern, new):
            block(f"this text contains what looks like {what}. Use an environment variable.")
    if TEST_PATH.search(path) and len(SKIP.findall(new)) > len(SKIP.findall(old)):
        block("skipping a test (or isolating one with .only) is not allowed; make it pass or ask the planner.")


def main():
    data = json.load(sys.stdin)
    tool, inp = data.get("tool_name", ""), data.get("tool_input", {}) or {}
    if tool == "Bash":
        check_bash(inp.get("command", ""))
    elif tool in ("Write", "Edit", "MultiEdit"):
        path = inp.get("file_path", "")
        if tool == "Write":
            p = Path(path)
            old = p.read_text(errors="ignore") if p.is_file() else ""
            check_file(path, old, inp.get("content", ""))
        else:
            edits = inp.get("edits") or [inp]
            for e in edits:
                check_file(path, e.get("old_string", ""), e.get("new_string", ""))
    sys.exit(0)


if __name__ == "__main__":
    main()
