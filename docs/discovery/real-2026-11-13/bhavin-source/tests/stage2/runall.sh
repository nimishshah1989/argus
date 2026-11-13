#!/bin/bash
cd /home/claude/s2
run(){ timeout 90 /tmp/wr/run2.sh >/dev/null 2>&1; for i in $(seq 1 30); do curl -s -m2 localhost:8799/ | grep -q version && break; sleep 1; done; [ "$2" = "seed" ] && python3 seed.py >/dev/null 2>&1; r=$(timeout 400 python3 $1 2>&1 | grep -v "agent-proxy\|fonts.google\|Allowed domains\|For details"); f=$(echo "$r" | grep -c "^FAIL"); echo "$1: $(echo "$r" | grep -cE "^PASS") passed, $f failed $(echo "$r" | grep -E "^FAIL" | head -3 | tr '\n' ' ')"; }
run apitest.py
run e2e.py seed
run my_e2e.py seed
run u3_e2e.py seed
run form_e2e.py seed
run close_e2e.py seed

run u4_e2e.py seed
run u4_plat_e2e.py seed
run plat_e2e.py seed
run u3_plat_e2e.py
run split_e2e.py
run merge_e2e.py
run u5_e2e.py seed
run robot_e2e.py
run robot_phone.py seed
run u6_e2e.py seed
run u6_plat_e2e.py seed
run wa_e2e.py seed
run edlink_e2e.py seed
run cx_e2e.py seed
run v9_api.py seed
run bug_hist.py seed
run v10_api.py seed
run sw_redirect.py
run v9_phone.py seed
run v9_plat.py seed
run v10_phone.py seed
run v10_plat.py seed
run v10_layout.py seed
run v10_pdf.py seed
run v10_floor.py seed
run v10_chain.py seed
run v10_follow.py seed
run upd_e2e.py seed
bash /home/claude/s2/mksite.sh >/dev/null 2>&1
