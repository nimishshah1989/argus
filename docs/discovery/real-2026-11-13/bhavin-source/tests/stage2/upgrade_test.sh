#!/bin/bash
# 1) the server you run today (v5) with tickets already in it
cd /tmp/wr && timeout 60 bash run.sh ${1:-/home/claude/stable/worker_v8_STABLE_2026-11-03.js} fresh >/dev/null 2>&1; for i in $(seq 1 30); do curl -s -m2 localhost:8799/ | grep -q version && break; sleep 1; done
python3 /home/claude/s2/seed.py >/dev/null 2>&1
python3 - <<'PY'
import json, urllib.request as U
B='http://localhost:8799'
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET'); return json.loads(U.urlopen(r).read())
op=call('/api/login',{'username':'op1','password':'op1234'})['token']
for m in ['VC-1','VC-2','VC-3']: call('/api/down',{'machine':m,'problem':'before upgrade '+m,'kind':'stopped'},tok=op)
call('/api/down',{'kind':'general','location':'Store','workType':'Electrical','problem':'before upgrade fan'},tok=op)
print('old server: 4 tickets raised')
PY
# 2) upgrade to the new server, same database
cd /tmp/wr && timeout 60 bash run.sh /home/claude/live/api/worker.js >/dev/null 2>&1; for i in $(seq 1 30); do curl -s -m2 localhost:8799/ | grep -q version && break; sleep 1; done
python3 - <<'PY'
import json, urllib.request as U
B='http://localhost:8799'
def call(path, body=None, tok=None, key=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    if key: h['X-Key']=key
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET'); return json.loads(U.urlopen(r).read())
print('version', call('/api/state',key='k123')['version'])
op=call('/api/login',{'username':'op1','password':'op1234'})['token']
st=sorted(call('/api/state',tok=op)['open'], key=lambda t:t['downAt']); print('after upgrade:', [(t['machine'] or t['location'], t['ref']) for t in st])
t=call('/api/down',{'machine':'VC-4','problem':'after upgrade','kind':'stopped'},tok=op)['ticket']; print('new ticket:', t['ref'])
w=call('/api/down',{'kind':'general','location':'Office','workType':'Civil','problem':'after upgrade door'},tok=op)['ticket']; print('new work request:', w['ref'])
e=call('/api/edit',{'id':st[0]['id'],'problem':'corrected after upgrade','reason':'check'},key='k123'); ed=call('/api/edits?since=2020-01-01',key='k123')['tickets']; print('edit after upgrade:', e.get('ok'), len(ed))
ok = e.get('ok') and len(ed)==1 and [t['ref'] for t in st]==['BD-0001','BD-0002','BD-0003','WR-0001'] and t['ref']=='BD-0004' and w['ref']=='WR-0002'
print('UPGRADE OK' if ok else 'UPGRADE FAIL')
PY
# 3) tickets without numbers appearing later (e.g. a restore) get numbers on the next start, continuing the series
cd /tmp/wr && python3 /home/claude/s2/volume_sql.py 20 >/dev/null 2>&1 && timeout 60 bash run.sh /home/claude/live/api/worker.js >/dev/null 2>&1
python3 - <<'PY'
import json, urllib.request as U
B='http://localhost:8799'
r=U.Request(B+'/api/history?days=30',headers={'X-Client':'tst','X-Key':'k123'}); T=json.loads(U.urlopen(r).read())['tickets']
refs=[t['ref'] for t in T]; bd=sorted(int(x[3:]) for x in refs if x.startswith('BD-'))
print('tickets', len(T), 'unnumbered', sum(1 for x in refs if not x), 'duplicates', len(refs)-len(set(refs)), 'BD range', bd[0], '-', bd[-1])
print('RESTORE OK' if all(refs) and len(refs)==len(set(refs)) and bd==list(range(1,len(bd)+1)) else 'RESTORE FAIL')
PY
