#!/bin/bash
# test copy of the site with the company code and local server filled in
rm -rf /tmp/s2site && cp -r /home/claude/live/site /tmp/s2site
for f in /tmp/s2site/*.html; do sed -i "s#__CID__#tst#g; s#__API__#http://localhost:8799#g; s#__SITE__/#http://localhost:8787/#g; s#__CO__ · #Test Co · #g" $f; done
pkill -f "[h]ttp.server 8787"; cd /tmp/s2site && nohup python3 -m http.server 8787 >/tmp/hs.log 2>&1 &
sleep 1; echo site up
