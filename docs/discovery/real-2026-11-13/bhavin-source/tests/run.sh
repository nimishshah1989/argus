#!/bin/bash
# usage: run.sh <worker.js> [fresh]
for p in $(pgrep -f "workerd|wrangler/bin"); do [ "$p" != "$$" ] && kill $p 2>/dev/null; done
sleep 2; cd /tmp/wr
[ "$2" = "fresh" ] && rm -rf .wrangler
sed -i "s#^main = .*#main = \"$1\"#" wrangler.toml
nohup npx wrangler dev --local --port 8799 --var 'CLIENT_KEYS:{"tst":"k123"}' > wd.log 2>&1 &
sleep 14; curl -s -m3 localhost:8799/
