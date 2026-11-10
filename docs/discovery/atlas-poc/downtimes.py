import json, urllib.request, sys
API='http://localhost:8080'; d=json.load(open(sys.argv[1]))
def call(m,p,b=None,t=None):
    r=urllib.request.Request(API+p,data=None if b is None else json.dumps(b).encode(),method=m); r.add_header('Content-Type','application/json')
    if t: r.add_header('Authorization','Bearer '+t)
    try:
        with urllib.request.urlopen(r,timeout=60) as x: s=x.read().decode(); return x.status,(json.loads(s) if s else None)
    except urllib.error.HTTPError as e: return e.code,e.read().decode()[:200]
T=call('POST','/auth/signin',{"email":"admin@cosmos.test","password":"Cosmos#2026demo","type":"client"})[1]['accessToken']
ids={}
for pg in range(5):
    page=call('POST','/assets/search',{"pageNum":pg,"pageSize":50,"filterFields":[]},T)[1]
    for a in page['content']: ids[a['name']]=a['id']
ok=bad=skip=0; errs={}; used={}
for b in d['breakdowns']:
    code=(b.get('maintCode') or '').strip().upper(); h=float(b.get('downHrs') or 0)
    if code in ('PM','NO DT') or h<=0 or b['machineId'] not in ids: skip+=1; continue
    dd,mm,yy=b['date'].split('-')
    key=(b['machineId'],b['date']); off=used.get(key,0.0); h=min(h, 23.9-off)
    if h<=0: skip+=1; continue
    used[key]=off+h+0.01
    import datetime
    start=datetime.datetime(int(yy),int(mm),int(dd),0,0)+datetime.timedelta(hours=off)
    st,res=call('POST','/asset-downtimes',{"asset":{"id":ids[b['machineId']]},"startsOn":start.strftime('%Y-%m-%dT%H:%M:%S.000Z'),"duration":int(h*3600)},T)
    if st==200: ok+=1
    else: bad+=1; errs[str(res)[:120]]=errs.get(str(res)[:120],0)+1
print('downtimes created',ok,'failed',bad,'skipped',skip); print(errs)
