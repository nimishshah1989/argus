# Handoff: loop-guard accepts `Screens: none (kit only)` (ADR 0040)

Changed `.github/loop/check_pr.py` rule 4: `Screens: none` / `none (kit only)` passes when every changed file is under `apps/web/src/ui/`, `changes/` or `docs/loop/handoff/`; otherwise it fails naming the first file outside. All other rules unchanged.
Proved locally: #736 and #738 pass (they failed before with "Screen none (kit only) has no approval"); a screen file added to #736 fails; an unapproved id still fails.
Next (coordinator): re-run loop-guard on #736 #737 #738 #739 (push or re-run the job; the guard reads the PR body at run time). #731 can go back to `Screens: none (kit only)` only if all its files are in the kit folders.
Unverified: #737 and #739 were not run locally.
