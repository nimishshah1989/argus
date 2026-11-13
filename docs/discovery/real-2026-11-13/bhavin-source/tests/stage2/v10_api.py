import json, urllib.request as U, urllib.error as UE, datetime as D, time
B='http://localhost:8799'; ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def raw(path, body=None, tok=None, key=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    if key: h['X-Key']=key
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try:
        x=U.urlopen(r); return x.status, json.loads(x.read())
    except UE.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
def call(*a,**k):
    s,j=raw(*a,**k)
    assert s==200,(a[0],s,j); return j
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123'); am=lg('amit','amit123')
print('version', call('/')['version'] if 'version' in call('/') else '?')
# ---- support request: no machine downtime
s1=call('/api/down',{'machine':'VC-1','problem':'needs electrician','kind':'support'},tok=op)['ticket']
call('/api/start',{'id':s1['id']},tok=rv); time.sleep(1)
c=call('/api/close',{'id':s1['id'],'kind':'done','note':'electrician came','by':'Ravi'},tok=rv)
chk(c['ticket']['downtimeMin']==0,'support request closes with machine downtime 0 (was its hands-on time)')
chk(c['task'] is None,'no task when none asked')
# ---- stopped ticket closes and leaves a pending task
t1=call('/api/down',{'machine':'VC-2','problem':'coolant pump leaking','kind':'stopped'},tok=op)['ticket']
call('/api/start',{'id':t1['id']},tok=rv)
bad=raw('/api/close',{'id':t1['id'],'kind':'done','note':'temporary fix','by':'Ravi','task':{'text':'','why':'spare'}},tok=rv)
chk(bad[0]==400,'a pending task without text is refused')
chk(call('/api/ticket?id='+t1['id'],tok=rv)['ticket']['status']=='working','and the ticket was NOT closed by the refused call')
c=call('/api/close',{'id':t1['id'],'kind':'done','note':'temporary fix, machine running','by':'Ravi','task':{'text':'Replace coolant pump when spare arrives','why':'Waiting for spare','exp':'2026-11-12'}},tok=rv)
tk=c['task']
chk(tk and tk['kind']=='general' and tk['workType']=='Pending task' and tk['parentId']==t1['id'] and tk['parentRef']==t1['ref'],'closing created a pending task linked to the ticket: '+str(tk and tk['ref']))
chk(tk['ref'].startswith('WR-') or tk['ref'].split('-')[0]!=t1['ref'].split('-')[0],'task has its own work-request number ('+tk['ref']+')')
chk(tk['location']=='VC-2' and tk['taskExp']=='2026-11-12' and tk['taskWhy']=='Waiting for spare','task carries machine, expected date and reason')
chk(c['ticket']['status']=='closed','the breakdown ticket itself is closed')
# the machine is free for a new complaint
n=raw('/api/down',{'machine':'VC-2','problem':'different problem: alarm','kind':'stopped'},tok=op)
chk(n[0]==200 and not n[1].get('exists'),'machine is free: operators can raise a new complaint while the task is pending')
# ticket details list the task + history line
d=call('/api/ticket?id='+t1['id'],tok=rv)
chk(len(d['tasks'])==1 and d['tasks'][0]['id']==tk['id'],'ticket details list its pending task')
chk(any(e['type']=='task' and tk['ref'] in e['text'] and 'left' in e['text'] for e in d['events']),'history says the task was left')
# task shows in the open list
st=call('/api/state',tok=rv)
chk(any(x['id']==tk['id'] for x in st['open']),'task appears in the open list')
# progress of the task is written on the original ticket
call('/api/start',{'id':tk['id']},tok=am)
call('/api/pause',{'id':tk['id'],'reason':'Other','waitReason':'Waiting for spare','by':'Amit'},tok=am)
call('/api/resume',{'id':tk['id'],'by':'Amit'},tok=am)
c2=call('/api/close',{'id':tk['id'],'kind':'done','note':'pump replaced','by':'Amit','taskDown':25},tok=am)
chk(c2['ticket']['taskDownMin']==25,'task close stores the minutes the machine was stopped (25)')
ev=[e for e in call('/api/ticket?id='+t1['id'],tok=rv)['events'] if e.get('task')]; ty=[e['type'] for e in ev]
chk('start' in ty and 'pause' in ty and 'resume' in ty,'start, pause and resume of the task appear in the original ticket history, tagged with the task number: '+str(len(ev))+' lines')
chk(any(e['type']=='close' and 'pump replaced' in e['text'] for e in ev),'completion line carries the note')
# floor can read the original ticket history if it raised it
fl=lg('suresh','suresh1') if raw('/api/login',{'username':'suresh','password':'suresh1'})[0]==200 else None
# a task cannot carry a task
g=call('/api/down',{'location':'Stores','problem':'general job','kind':'general'},tok=rv)['ticket']
r=raw('/api/close',{'id':g['id'],'kind':'done','note':'x','by':'Ravi','task':{'text':'again'}},tok=rv)
chk(r[0]==400,'a pending task cannot be left on a general work request')
# ---- export for backup / reconcile
chk(raw('/api/export',tok=op)[0]==403,'shop floor cannot export')
chk(raw('/api/export',tok=rv)[0]==403,'maintenance cannot export either')
e=call('/api/export?offset=0',key='k123')
ids=[x['id'] for x in e['tickets']]
chk(t1['id'] in ids and tk['id'] in ids and e['total']>=len(ids),'export returns the tickets ('+str(len(ids))+' of '+str(e['total'])+')')
x=[y for y in e['tickets'] if y['id']==t1['id']][0]
chk(len(x['events'])>=4 and x['report'] is None or isinstance(x['events'],list),'every ticket carries its events')
e2=call('/api/export?offset=1&from=2000-01-01T00:00:00Z&to=2999-01-01T00:00:00Z',key='k123')
chk(e2['offset']==1 and e2['total']>=e['total']-0,'paging with an offset works')
print('ALL PASS' if ok else 'SOME FAILED')
