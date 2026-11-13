import json, urllib.request as U, datetime as dt
B='http://localhost:8799'
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None, key=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    if key: h['X-Key']=key
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try:
        x=U.urlopen(r); return x.status, json.loads(x.read())
    except U.HTTPError as e: return e.code, {'raw':e.read()[:300]}
lg=lambda u,p: call('/api/login',{'username':u,'password':p})[1]['token']
tm=lg('team','team12'); rv=lg('ravi','ravi123'); op=lg('op1','op1234'); am=lg('amit','amit123')
s,j=call('/api/mywork',tok=tm); chk(s==200 and len(j['tickets'])>=130,'mywork with 130+ tickets works (%s, %s)'%(s,len(j.get('tickets',[]))))
s,j=call('/api/history?days=30&reports=1',key='k123'); chk(s==200 and len(j['tickets'])>=130,'history with reports works (%s)'%len(j.get('tickets',[])))
refs=[t['ref'] for t in j['tickets']]; chk(all(r.startswith('BD-') for r in refs) and len(set(refs))==len(refs),'existing tickets numbered, no duplicates (%s..%s)'%(min(refs),max(refs)))
oldest=sorted(j['tickets'],key=lambda t:t['downAt'])[0]['ref']; chk(oldest=='BD-0001','oldest ticket is BD-0001 (%s)'%oldest)
n0=max(int(r[3:]) for r in refs)
s,j=call('/api/down',{'machine':'VC-7','problem':'New after numbering','kind':'stopped'},tok=op); r1=j['ticket']['ref']; chk(r1=='BD-%04d'%(n0+1),'next breakdown continues the series: '+r1)
s,j=call('/api/down',{'machine':'VC-7','problem':'Duplicate','kind':'stopped'},tok=op); chk(j.get('exists'),'duplicate report refused')
s,j=call('/api/down',{'machine':'VC-8','problem':'Second','kind':'support'},tok=op); chk(j['ticket']['ref']=='BD-%04d'%(n0+2),'no gap after refused duplicate: '+j['ticket']['ref'])
s,j=call('/api/down',{'kind':'general','location':'Store','workType':'Electrical','problem':'Fan'},tok=op); chk(j['ticket']['ref']=='WR-0001','work requests have their own series: '+j['ticket']['ref']); wr=j['ticket']['id']
# prefix change from company settings
cfg=call('/api/config',tok=tm)[1]['config']; cfg['ticketPrefix']={'bd':'BRK','wr':'job'}
r=U.Request(B+'/api/config',data=json.dumps({'config':cfg,'fp':'fp2'}).encode(),headers={'X-Client':'tst','X-Key':'k123','X-Config-Token':'ct_'+'a'*40,'Content-Type':'application/json'},method='POST'); U.urlopen(r)
s,j=call('/api/down',{'kind':'general','location':'Office','workType':'Civil','problem':'Door'},tok=op); chk(j['ticket']['ref']=='JOB-0002','prefix setting applies to new tickets: '+j['ticket']['ref'])
cfg['ticketPrefix']={'bd':'BD','wr':'WR'}; r=U.Request(B+'/api/config',data=json.dumps({'config':cfg,'fp':'fp3'}).encode(),headers={'X-Client':'tst','X-Key':'k123','X-Config-Token':'ct_'+'a'*40,'Content-Type':'application/json'},method='POST'); U.urlopen(r)
# ticket details
t1=[t for t in call('/api/state',tok=rv)[1]['open'] if t['ref']==r1][0]['id']
call('/api/start',{'id':t1},tok=rv); call('/api/transfer',{'id':t1,'note':'Checked wiring, replace sensor'},tok=rv); call('/api/start',{'id':t1},tok=am)
call('/api/pause',{'id':t1,'reason':'Waiting for spare','note':'Sensor ordered'},tok=am); call('/api/resume',{'id':t1},tok=rv)
call('/api/close',{'id':t1,'kind':'report','report':{'ca':'Proximity sensor replaced','db':'Ravi, Amit','mc':'E','bc':'E','sp':'PRX 12mm'}},tok=rv)
s,j=call('/api/ticket?id='+t1,tok=rv); ev=[e['type'] for e in j['events']]
chk(s==200 and j['ticket']['ref']==r1 and j['ticket']['report']['ca']=='Proximity sensor replaced','ticket details with report')
chk(ev==['down','start','transfer','pickup','pause','resume','close'],'full timeline in order: %s'%ev)
chk(sorted(p['by'] for p in j['people'])==['Amit','Ravi'],'people who worked: %s'%j['people'])
s,j=call('/api/ticket?id='+t1,tok=op); chk(s==200,'shop floor can open its own complaint')
s,j=call('/api/ticket?id='+t1,tok=lg('op2','op2345')); chk(s==403,'shop floor cannot open someone else\'s complaint')
# team closed work
s,j=call('/api/mywork?team=1',tok=rv); chk(s==200 and j['all'] and any(t['ref']==r1 for t in j['tickets']),'team closed work for a personal login')
s,j=call('/api/mywork',tok=rv); chk(not j['all'],'personal mine still personal')
# day report: window around now
now=dt.datetime.utcnow(); f=(now-dt.timedelta(hours=12)).strftime('%Y-%m-%dT%H:%M:%SZ'); t=(now+dt.timedelta(hours=12)).strftime('%Y-%m-%dT%H:%M:%SZ')
s,j=call('/api/dayreport?from=%s&to=%s'%(f,t),tok=rv); chk(s==200 and j['people'] and j['people'][0]['name']=='Ravi','my day report for Ravi')
jobs=j['people'][0]['jobs']; x=[q for q in jobs if q['ref']==r1]; chk(x and x[0]['status']=='closed' and x[0]['done']=='Proximity sensor replaced','closed job with what was done')
s,j=call('/api/dayreport?from=%s&to=%s&team=1'%(f,t),tok=rv); names=[p['name'] for p in j['people']]; chk('Ravi' in names and 'Amit' in names,'team day report lists everyone who worked: %s'%names)
s,j=call('/api/dayreport?from=%s&to=%s&who=Amit'%(f,t),tok=tm); chk(s==200 and [p['name'] for p in j['people']]==['Amit'],'shared phone picks a person')
s,j=call('/api/dayreport?from=%s&to=%s'%(f,t),tok=op); chk(s==403,'shop floor has no day report')
s,j=call('/api/dayreport?from=2020-01-01T00:00:00Z&to=2020-01-02T00:00:00Z',tok=rv); chk(s==400,'old dates refused')
s,j=call('/api/state',tok=rv); chk(s==200 and all(t.get('ref') for t in j['open']),'open tickets carry numbers')
print('ALL OK' if ok else 'FAIL')
