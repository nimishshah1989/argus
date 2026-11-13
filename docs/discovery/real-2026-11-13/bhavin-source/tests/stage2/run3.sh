#!/bin/bash
cd /home/claude/s2
timeout 60 /tmp/wr/run2.sh >/dev/null 2>&1; python3 seed.py >/dev/null 2>&1; (cd /tmp/wr && python3 /home/claude/s2/volume_sql.py 130 >/dev/null 2>&1)
echo "u4_api (with 130 tickets):"; timeout 200 python3 u4_api.py 2>&1 | grep -E "^FAIL|ALL|FAIL$"
timeout 60 /tmp/wr/run2.sh >/dev/null 2>&1; python3 seed.py >/dev/null 2>&1
echo "plat_e2e:"; timeout 200 python3 plat_e2e.py 2>&1 | grep -E "^FAIL|ALL|CHECK"
echo "u3_plat_e2e:"; timeout 300 python3 u3_plat_e2e.py 2>&1 | grep -E "^FAIL|ALL|CHECK"
