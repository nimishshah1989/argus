#!/bin/bash
timeout 90 /tmp/wr/run2.sh >/dev/null 2>&1; for i in $(seq 1 30); do curl -s -m2 localhost:8799/ | grep -q version && break; sleep 1; done
python3 /home/claude/s2/seed.py >/dev/null 2>&1
(cd /tmp/wr && python3 /home/claude/s2/volume_sql.py 130 >/dev/null 2>&1)
timeout 90 /tmp/wr/run3.sh >/dev/null 2>&1; for i in $(seq 1 30); do curl -s -m2 localhost:8799/ | grep -q version && break; sleep 1; done
python3 /home/claude/s2/u4_api.py 2>&1 | grep -E "^PASS|^FAIL|ALL"
