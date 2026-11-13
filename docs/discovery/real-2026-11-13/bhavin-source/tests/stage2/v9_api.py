# server v9: joining a job (primary / support), own clocks, leaving, taking over, who may close; machine running again / stopped again
import json, urllib.request as U, datetime as dt, subprocess
B='http://localhost:8799'
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None, key=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    if key: h['X-Key']=key
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try: return json.loads(U.urlopen(r).read())
    except U.HTTPError as e: return {'status':e.code, **json.loads(e.read() or b'{}')}
def sql(q):
    r=subprocess.run(['npx','wrangler','d1','execute','t','--local','--command',q],cwd='/tmp/wr',capture_output=True,text=True); return r.returncode
iso=lambda m: (dt.datetime.now(dt.UTC).replace(second=0,microsecond=0)-dt.timedelta(minutes=m)).strftime('%Y-%m-%dT%H:%M:%S.000Z')
call('/api/users',dict(username='kiran',name='Kiran',role='maint',password='kiran1'),key='k123')
call('/api/users',dict(username='boss',name='Bhaven',role='admin',password='boss12'),key='k123')
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123'); am=lg('amit','amit123'); ki=lg('kiran','kiran1'); tm=lg('team','team12')
t=call('/api/down',{'machine':'VC-1','problem':'Spindle change','kind':'stopped'},tok=op)['ticket']; I=t['id']
chk('once work has started' in call('/api/join',{'id':I,'role':'primary'},tok=am).get('error',''),'cannot join before work starts')
call('/api/start',{'id':I},tok=rv)
r=call('/api/join',{'id':I,'role':'primary'},tok=am); chk(r.get('ok') and r['ticket']['crew'][0]['name']=='Amit' and r['ticket']['crew'][0]['role']=='primary' and r['ticket']['crew'][0]['running'],'Amit joins as primary, clock running')
chk('already joined' in call('/api/join',{'id':I,'role':'support'},tok=am).get('error',''),'cannot join twice')
chk('already running' in call('/api/join',{'id':I},tok=rv).get('error',''),'starter cannot join own job')
chk(call('/api/join',{'id':I,'name':'Kiran','role':'support'},tok=am).get('status')==403,'a primary cannot add others (only the person running the job)')
r=call('/api/join',{'id':I,'name':'Kiran','role':'support'},tok=rv); chk(r.get('ok') and any(c['name']=='Kiran' and c['role']=='support' for c in r['ticket']['crew']),'Ravi adds Kiran as support')
ev=[(e['type'],e['by'],e['spare'],e['text']) for e in call('/api/events?id='+I,tok=rv)['events']]
chk(('join','Amit','primary','') in ev and ('join','Kiran','support','added by Ravi') in ev,'history: joined as primary / support, added by Ravi')
# 20 minutes of work for everyone (clocks moved back in the database)
sql(f"UPDATE tickets SET seg_start='{iso(20)}', crew=json_set(json_set(crew,'$[0].seg','{iso(20)}'),'$[1].seg','{iso(20)}') WHERE id='{I}'")
d=call('/api/ticket?id='+I,tok=rv); P={p['by']:(p['mins'],p['role']) for p in d['people']}
chk(P.get('Ravi',(0,))[0]>=19 and P.get('Amit',(0,))[0]>=19 and P.get('Kiran',(0,))[0]>=19,'each person has their own clock (~20 min each): %s'%P)
chk(P['Ravi'][1]=='started' and P['Amit'][1]=='primary' and P['Kiran'][1]=='support','roles: started / primary / support')
# pause stops everyone; resume brings everyone back
call('/api/pause',{'id':I,'reason':'Waiting for spare'},tok=am)
x=call('/api/ticket?id='+I,tok=rv)['ticket']; chk(x['status']=='waiting' and not any(c['running'] for c in x['crew']) and all(c['mins']>=19 for c in x['crew']),'pause stops every clock, minutes kept')
call('/api/resume',{'id':I},tok=ki)
x=call('/api/ticket?id='+I,tok=rv)['ticket']; chk(x['startedBy']=='Ravi' and all(c['running'] for c in x['crew']) and x['segStart'],'resume (by Kiran, on the job) keeps Ravi running it and restarts everyone')
# support cannot close; primary can
r=call('/api/close',{'id':I,'kind':'done','note':'x'},tok=ki); chk(r.get('status')==403 and 'primary' in r.get('error',''),'support cannot close: '+r.get('error',''))
# leaving
chk('why' in call('/api/leave',{'id':I},tok=ki).get('error','').lower(),'leaving needs a reason')
r=call('/api/leave',{'id':I,'reason':'Called to VC-7'},tok=ki); k=[c for c in r['ticket']['crew'] if c['name']=='Kiran'][0]
chk(r.get('ok') and k['left'] and k['leftWhy']=='Called to VC-7' and not k['running'],'Kiran leaves with a reason, clock stops')
r=call('/api/join',{'id':I,'role':'support'},tok=ki); chk(r.get('ok') and [c for c in r['ticket']['crew'] if c['name']=='Kiran'][0]['running'],'Kiran can join again')
call('/api/leave',{'id':I,'reason':'Shift over'},tok=ki)
# starter leaves -> first primary takes over
r=call('/api/leave',{'id':I,'reason':'Going to stores'},tok=rv); x=r['ticket']
chk(r.get('ok') and x['startedBy']=='Amit' and any(c['name']=='Ravi' and c['left'] for c in x['crew']) and not any(c['name']=='Amit' for c in x['crew']),'Ravi leaves: Amit (primary) takes over, Ravi kept as left')
ev=[(e['type'],e['by']) for e in call('/api/events?id='+I,tok=am)['events']]; chk(('leave','Ravi') in ev and ('lead','Amit') in ev,'history: Ravi left, Amit took over')
r=call('/api/close',{'id':I,'kind':'done','note':'Spindle changed'},tok=am); chk(r.get('ok') and r['ticket']['status']=='closed','Amit (now running it) closes')
d=call('/api/ticket?id='+I,tok=am); P={p['by']:p for p in d['people']}
chk(set(P)=={'Ravi','Amit','Kiran'} and P['Ravi']['role']=='started' and P['Kiran']['role']=='support','people after close: Ravi started, Amit, Kiran support: %s'%[(p['by'],p['role'],p['mins']) for p in d['people']])
# only support left -> starter cannot leave; transfer makes everyone leave
t2=call('/api/down',{'machine':'VC-2','problem':'Leak','kind':'stopped'},tok=op)['ticket']; J=t2['id']; call('/api/start',{'id':J},tok=rv); call('/api/join',{'id':J,'role':'support'},tok=ki)
chk('take over' in call('/api/leave',{'id':J,'reason':'x'},tok=rv).get('error',''),'starter cannot leave with only support on the job')
r=call('/api/close',{'id':J,'kind':'done','note':'x'},tok=am); chk(r.get('status')==403,'someone not on the job cannot close')
call('/api/transfer',{'id':J,'note':'End of shift'},tok=rv); x=call('/api/ticket?id='+J,tok=rv)['ticket']
chk(x['status']=='open' and all(c['left'] for c in x['crew']),'transfer: everyone who joined leaves')
r=call('/api/close',{'id':J,'kind':'no_report','note':'dup'},tok=am); chk(r.get('ok'),'transferred (open) ticket: anyone can close, as before')
# shared phone: picks names
t3=call('/api/down',{'machine':'VC-3','problem':'Belt','kind':'stopped'},tok=op)['ticket']; K=t3['id']; call('/api/start',{'id':K,'by':'Ravi'},tok=tm)
r=call('/api/join',{'id':K,'by':'Kiran','role':'primary'},tok=tm); chk(r.get('ok') and r['ticket']['crew'][0]['name']=='Kiran','shared phone: Kiran joins (name picked)')
r=call('/api/close',{'id':K,'by':'Kiran','kind':'done','note':'Belt'},tok=tm); chk(r.get('ok'),'shared phone: primary Kiran closes')
# day report roles
f=iso(300); to=(dt.datetime.now(dt.UTC)+dt.timedelta(minutes=1)).strftime('%Y-%m-%dT%H:%M:%S.000Z')
d=call('/api/dayreport?from=%s&to=%s&team=1'%(f,to),tok=rv); R={p['name']:p for p in d['people']}
kj=[j for j in R['Kiran']['jobs'] if j['id']==I][0]; aj=[j for j in R['Amit']['jobs'] if j['id']==I][0]; rj=[j for j in R['Ravi']['jobs'] if j['id']==I][0]
chk(kj['role']=='support' and aj['role']=='primary' and rj['role']=='started','day report: job roles started / primary / support')

chk(R['Kiran']['supportMins']>=19 and R['Amit']['primaryMins']>=19,'day report: primary / support minutes split (Kiran support %s, Amit primary %s)'%(R['Kiran']['supportMins'],R['Amit']['primaryMins']))
# ---- machine running again / stopped again
import time; time.sleep(61)
m=call('/api/down',{'machine':'VC-4','problem':'Overload alarm','kind':'stopped'},tok=op); print(m) if 'ticket' not in m else None; m=m['ticket']; M=m['id']
chk('Start work first' in call('/api/running',{'id':M},tok=rv).get('error',''),'running again needs work started')
call('/api/start',{'id':M},tok=rv)
call('/api/edit',{'id':M,'downAt':iso(180),'startedAt':iso(170),'reason':'setup'},key='k123')
chk(call('/api/running',{'id':M,'ts':iso(175)},tok=rv).get('status')==400,'running time cannot be before work started')
chk(call('/api/running',{'id':M},tok=op).get('status')==403,'shop floor cannot mark running')
r=call('/api/running',{'id':M,'ts':iso(120)},tok=rv); chk(r.get('ok') and r['ticket']['runningAt'] and r['ticket']['downAcc']==60,'running since 2 h ago: 60 min down so far')
call('/api/pause',{'id':M,'reason':'Waiting for vendor'},tok=rv)
chk('already marked running' in call('/api/running',{'id':M},tok=rv).get('error',''),'cannot mark running twice')
r=call('/api/stopped',{'id':M,'ts':iso(60)},tok=rv); chk(r.get('ok') and not r['ticket']['runningAt'] and r['ticket']['stopAt'],'stopped again 1 h ago')
r=call('/api/running',{'id':M,'ts':iso(30)},tok=rv); chk(r['ticket']['downAcc']==90,'running again 30 min ago: 90 min down (60 + 30)')
ev=[e['type'] for e in call('/api/events?id='+M,tok=rv)['events']]; chk(ev.count('running')==2 and ev.count('stopped')==1,'history: running, stopped, running')
st=call('/api/state',tok=rv); o=[x for x in st['open'] if x['id']==M][0]; chk(o['runningAt'] and o['status']=='waiting','state: still open (waiting), machine running')
call('/api/resume',{'id':M},tok=rv); c=call('/api/close',{'id':M,'kind':'done','note':'Vendor fixed'},tok=rv)['ticket']
chk(c['downtimeMin']==90 and c['repairMin']==140 and c['followMin'] in (30,31),'closed: downtime 90 (stopped periods), repair 140 (start -> running), follow-up 30: %s'%[c['downtimeMin'],c['repairMin'],c['followMin']])
# old style ticket unchanged
n=call('/api/down',{'machine':'VC-5','problem':'Old style','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':n['id']},tok=rv); n=call('/api/close',{'id':n['id'],'kind':'done','note':'ok'},tok=rv)['ticket']
chk(n['followMin'] is None and n['downtimeMin']==0,'normal ticket: no follow-up, downtime as before')
print('ALL OK' if ok else 'FAIL')
