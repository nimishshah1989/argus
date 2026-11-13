#!/bin/bash
timeout 90 /tmp/wr/run2.sh >/dev/null 2>&1; for i in $(seq 1 30); do curl -s -m2 localhost:8799/ | grep -q version && break; sleep 1; done
python3 /home/claude/s2/seed.py >/dev/null 2>&1
cd /home/claude/s2 && timeout 200 python3 robot_phone.py 2>&1 | grep -v "agent-proxy\|fonts.google\|Allowed domains\|For details"
