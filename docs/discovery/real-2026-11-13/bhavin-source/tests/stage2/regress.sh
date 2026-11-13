#!/bin/bash
cd /home/claude/s2
bash runall.sh
echo "--- volume"; bash run4.sh 2>&1 | grep -E "^(FAIL|ALL|PASS.*1[0-9]{2})" | tail -4
echo "--- upgrade v8 -> current"; bash upgrade_test.sh 2>&1 | grep -E "OK|FAIL|version|edit after"
echo "--- upgrade v5 -> current"; bash upgrade_test.sh /home/claude/stable/worker_v5_STABLE_2026-10-31.js 2>&1 | grep -E "OK|FAIL|version|edit after"
