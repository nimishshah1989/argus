#!/usr/bin/env python3
"""CI backstop for the loop. Runs on every PR; local hooks can be bypassed, this can't.

1. Every PR updates HANDOFF.md.
2. A PR that changes PROJECT.md or the schema adds a new ADR in docs/adr/.
3. Only `plan/` branches may touch protected files or modify/delete existing tests.
4. Frontend code only for screens Nimish approved: PR body has `Screens: <id>, <id>` and each
   id is in design/approved.json with a hash matching the current wireframe.
5. Design system: no raw colours / arbitrary Tailwind values in frontend code (use tokens);
   design/brand.css may only override the variables listed in brand_overridable.
Usage: check_pr.py <base-ref> <head-branch>   (PR body in env PR_BODY)
"""
import fnmatch
import hashlib
import json
import os
import re
import subprocess
import sys

DEFAULT_PROTECTED = ["PROJECT.md", "CLAUDE.md", ".loop.json", "db/schema.sql", "prisma/schema.prisma",
                     "**/schema.prisma", "docs/adr/**", ".github/workflows/**", ".github/loop/**", "design/**"]
DEFAULT_TESTS = ["tests/**", "test/**", "**/__tests__/**", "**/test_*.py", "**/*_test.py",
                 "**/*.test.*", "**/*.spec.*", "**/*_test.go"]
DEFAULT_FRONTEND = ["app/**/*.tsx", "src/app/**", "src/components/**", "src/pages/**", "apps/web/**",
                    "components/**", "**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.css"]
DEFAULT_BRAND = ["--accent", "--accent-2", "--accent-soft", "--accent-rule", "--wash-1", "--wash-2", "--wash-3", "--font-serif", "--font-sans"]
KIT_ONLY = ("apps/web/src/ui/", "changes/", "docs/loop/handoff/")  # ADR 0040; kit tests live in apps/web/src/ui/
LOCKED = ["PROJECT.md", "db/schema.sql", "prisma/schema.prisma", "**/schema.prisma"]
RAW_STYLE = re.compile(r"""(?:[:"'\s(=]#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b|\brgba?\(|\bhsla?\(|-\[#|-\[\d+(?:px|rem)\])""")


def matches(path, patterns):
    return any(fnmatch.fnmatch(path, p) or (p.startswith("**/") and fnmatch.fnmatch(path, p[3:])) for p in patterns)


def sh(*args):
    return subprocess.run(list(args), capture_output=True, text=True, check=True).stdout


def wf_hash(sid):
    try:
        return hashlib.sha256(open(f"design/wireframes/{sid}.html", "rb").read()).hexdigest()[:16]
    except OSError:
        return ""


def main():
    base, head = sys.argv[1], sys.argv[2]
    cfg = json.load(open(".loop.json")) if os.path.exists(".loop.json") else {}
    protected = cfg.get("protected", DEFAULT_PROTECTED) + [".github/loop/**"]
    tests = cfg.get("tests", DEFAULT_TESTS)
    frontend = cfg.get("frontend", DEFAULT_FRONTEND)
    token_files = cfg.get("token_files", ["design/**", "**/tokens.css", "**/brand.css"])
    brand_ok = set(cfg.get("brand_overridable", DEFAULT_BRAND))

    changes = []
    for line in sh("git", "diff", "--name-status", f"{base}...HEAD").splitlines():
        parts = line.split("\t")
        status, path = parts[0][0], parts[-1]
        changes.append((status, path))
        if status == "R":
            changes.append(("D", parts[1]))
    paths = {p for _, p in changes}
    errors = []

    # Builder rules apply only to commits after Plan's seed (`Plan-base: <sha>` written by `loop run-ticket`).
    body = os.environ.get("PR_BODY", "")
    pb = re.search(r"^Plan-base:\s*([0-9a-f]{7,40})\s*$", body, re.M)
    bbase = base
    if pb and subprocess.run(["git", "merge-base", "--is-ancestor", pb.group(1), "HEAD"]).returncode == 0:
        bbase = pb.group(1)
    bchanges = changes if bbase == base else []
    if bbase != base:
        for line in sh("git", "diff", "--name-status", f"{bbase}...HEAD").splitlines():
            parts = line.split("\t")
            bchanges.append((parts[0][0], parts[-1]))
            if parts[0][0] == "R":
                bchanges.append(("D", parts[1]))
        # A build branch that merged main in carries the files of main in Plan-base...HEAD; only files this PR changes count.
        bchanges = [c for c in bchanges if c[1] in paths]

    # 1–3  (ticket PRs leave docs/loop/handoff/<N>.md; other PRs update HANDOFF.md)
    ticket_handoff = any(p.startswith("docs/loop/handoff/") for p in paths)
    # ADR 0038: handoff files are no longer a merge gate.
    if any(matches(p, LOCKED) for p in paths) and not any(s == "A" and p.startswith("docs/adr/") for s, p in changes):
        errors.append("PROJECT.md or the schema changed without a new ADR in docs/adr/.")
    if not head.startswith("plan/"):
        # A screen PR may write its own coverage table (docs/design/v2/scope/<screen>.md); ADR 0035.
        own_scope = {f"docs/design/v2/scope/{q.split('/')[5]}.md" for _, q in bchanges
                      if q.startswith("apps/web/src/screens/v2/") and q.count("/") >= 6}
        for s, p in bchanges:
            if p in own_scope or p == "apps/web/src/screens/v2/insight-coverage.test.ts":
                continue  # ADR 0038: each screen adds its own line to the shared takeaway list
            if matches(p, protected):
                errors.append(f"{p}: protected file changed on a build branch. Only plan/ branches may change it.")
            elif matches(p, tests) and s in ("M", "D"):
                errors.append(f"{p}: existing test {'modified' if s == 'M' else 'deleted'} on a build branch.")

    # 3b. ticket size budget (written into the PR body by `loop run-ticket` from the ticket)
    b = re.search(r"^Budget:\s*files\s*<=\s*(\d+)\s+lines\s*<=\s*(\d+)", body, re.M | re.I)
    if b and not head.startswith("plan/"):
        max_files, max_lines = int(b.group(1)), int(b.group(2))
        extra = cfg.get("budget_exclude", ["changes/**", "CHANGELOG.md"])
        skip = lambda p: (p == "HANDOFF.md" or p.startswith("docs/loop/") or matches(p, tests) or matches(p, extra)
                          or p.endswith((".lock", "lock.json", "lock.yaml")))
        # Diff the build against the seed applied on top of the main it merged in, so lines from main and from the
        # seed never count, even in a file all three changed. -M counts a rename once, under its new path.
        rng = [f"{bbase}...HEAD"]
        if bbase != base:
            mb = sh("git", "merge-base", base, "HEAD").strip()
            mt = subprocess.run(["git", "merge-tree", "--write-tree", mb, bbase], capture_output=True, text=True)
            # shortcut: if the seed conflicts with main (or git < 2.38), Plan-base...HEAD still counts lines from main
            # in files the PR also changed; upgrade if that ever fails a real build (ADR 0032).
            if mt.returncode == 0:
                rng = [mt.stdout.split()[0], "HEAD"]
        files, lines = [], 0
        tok = sh("git", "diff", "--numstat", "-M", "-z", *rng).split("\0")
        i = 0
        while i < len(tok):
            a, d, p = (tok[i].split("\t") + ["", "", ""])[:3]
            if p == "" and d:  # rename record: counts, then the old path, then the new path
                p, i = tok[i + 2], i + 3
            else:
                i += 1
            if d and p in paths and not skip(p):
                files.append(p)
                if a.isdigit() and d.isdigit():
                    lines += int(a) + int(d)
        slack = 1.2
        if len(files) > max_files * slack or lines > max_lines * slack:  # ADR 0038: warn-only
            print(f"::warning::Over the ticket's size budget: {len(files)} files / {lines} lines vs "
                  f"budget {max_files} / {max_lines}. Not blocking.")

    # 4. wireframe gate
    fe = sorted(p for s, p in changes if s != "D" and matches(p, frontend) and not p.startswith("design/"))
    if fe:
        m = re.search(r"^Screens:\s*(.+)$", os.environ.get("PR_BODY", ""), re.M | re.I)
        listed = [x.strip() for x in m.group(1).split(",") if x.strip()] if m else []
        # ADR 0040: `Screens: none` / `none (kit only)` is fine when every changed file is kit, changelog or handoff.
        if m and re.fullmatch(r"none(\s*\(kit only\))?", m.group(1).strip(), re.I):
            listed = []
            outside = sorted(p for p in paths if not p.startswith(KIT_ONLY))
            if outside:
                errors.append(f"`Screens: none` but {outside[0]} is outside the kit ({len(outside)} such files). "
                              "List the approved screen ids instead.")
        approved = json.load(open("design/approved.json")).get("screens", {}) if os.path.exists("design/approved.json") else {}
        # ADR 0038: a missing Screens line no longer blocks; a listed screen must still be approved.
        for sid in listed:
            a = approved.get(sid)
            if not a:
                errors.append(f"Screen {sid} has no approval from Nimish (design/approved.json).")
            elif a.get("hash") != wf_hash(sid):
                errors.append(f"Screen {sid}: wireframe changed after approval. Needs re-approval.")

    # 5. design-system discipline
    for p in fe:
        if matches(p, token_files):
            continue
        added = [l[1:] for l in sh("git", "diff", "-U0", f"{base}...HEAD", "--", p).splitlines()
                 if l.startswith("+") and not l.startswith("+++")]
        bad = [l.strip() for l in added if RAW_STYLE.search(l) and "loop-allow-color" not in l]
        if bad:
            errors.append(f"{p}: raw colour/size instead of design tokens, e.g. `{bad[0][:80]}`. "
                          "Use a token (var(--…) or the Tailwind preset).")
    if os.path.exists("design/brand.css") and "design/brand.css" in paths:
        declared = set(re.findall(r"(--[\w-]+)\s*:", open("design/brand.css").read()))
        extra = declared - brand_ok
        if extra:
            errors.append(f"design/brand.css overrides non-brand tokens: {', '.join(sorted(extra))}. "
                          f"Projects may only change: {', '.join(sorted(brand_ok))}.")

    if errors:
        print("loop-guard FAILED:")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print(f"loop-guard passed ({len(paths)} files, branch {head}).")


if __name__ == "__main__":
    main()
