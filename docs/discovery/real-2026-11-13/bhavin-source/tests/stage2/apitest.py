import json, urllib.request
B='http://localhost:8799'
def call(path, body=None, tok=None, key=None, c='tst'):
    h={'X-Client':c,'Content-Type':'application/json'}
    if key: h['X-Key']=key
    if tok: h['Authorization']='Bearer '+tok
    r=urllib.request.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
K='k123'; ok=True
def chk(cond, msg):
    global ok
    print(('PASS ' if cond else 'FAIL ')+msg); ok = ok and cond
# config so brand works
cfg={'id':'tst','company':'Test Co','ref':{'machines':[{'id':'VC-1','category':'VMC','seg':'CNC'}],'team':['Ravi','Amit'],'observedBy':['Operator']}}
print(call('/api/config',{'config':cfg,'fp':'x1'},key=K,)) if False else None
import urllib
st,j=call('/api/state'); chk(st==401,'no auth -> 401')
import urllib.request as U
r=U.Request(B+'/api/config',data=json.dumps({'config':cfg,'fp':'x1'}).encode(),headers={'X-Client':'tst','X-Key':K,'X-Config-Token':'tok_'+'a'*30,'Content-Type':'application/json'},method='POST'); print(U.urlopen(r).read())
st,j=call('/api/brand'); chk(st==200 and j['company']=='Test Co','brand public %s'%j)
for u in [dict(username='ravi',name='Ravi',role='maint',password='ravi123'),dict(username='op1',name='Suresh',role='report',title='Operator',password='op1234'),
          dict(username='tvboard',name='Board TV',role='board',password='tvtv12'),dict(username='cell3',name='Cell 3 phone',role='report',shared=True,password='cell33'),dict(username='boss',name='Admin',role='admin',password='boss12')]:
    st,j=call('/api/users',u,key=K); chk(st==200 and j.get('created'),'create '+u['username'])
st,j=call('/api/users',dict(username='Bad Name',name='x',role='maint',password='123456'),key=K); chk(st==400,'bad username rejected')
st,j=call('/api/users',dict(username='zz',name='x',role='maint',password='12'),key=K); chk(st==400,'short username/pw rejected')
def login(u,p):
    st,j=call('/api/login',{'username':u,'password':p}); return st,j
st,j=login('ravi','wrong'); chk(st==401,'wrong pw')
st,j=login('RAVI','ravi123'); chk(st==200 and j['token'].startswith('s_'),'login case-insensitive'); T={'ravi':j['token']}
for u,p in [('op1','op1234'),('tvboard','tvtv12'),('cell3','cell33'),('boss','boss12')]: T[u]=login(u,p)[1]['token']
st,j=call('/api/me',tok=T['op1']); chk(j.get('user',{}).get('role')=='report','me')
# floor raises
st,j=call('/api/down',{'machine':'VC-1','by':'Fake','problem':'Noise','kind':'stopped'},tok=T['op1']); chk(st==200 and j['ticket']['reportedBy']=='Suresh (Operator)','floor report name forced: %s'%j.get('ticket',{}).get('reportedBy')); tid=j['ticket']['id']
st,j=call('/api/start',{'id':tid,'by':'Ravi'},tok=T['op1']); chk(st==403,'floor cannot start')
st,j=call('/api/down',{'machine':'VC-1','by':'x','problem':'p'},tok=T['tvboard']); chk(st==403,'board cannot raise')
st,j=call('/api/state',tok=T['tvboard']); chk(st==200 and len(j['open'])==1,'board reads state')
st,j=call('/api/history',tok=T['ravi']); chk(st==403,'maint no history')
st,j=call('/api/history',tok=T['boss']); chk(st==200,'admin history')
st,j=call('/api/config',{'config':cfg,'fp':'x'},tok=T['boss']); chk(st==403,'admin login cannot push config')
st,j=call('/api/start',{'id':tid,'by':'Amit'},tok=T['ravi']); chk(st==200 and j['ticket']['startedBy']=='Ravi','maint start name forced')
st,j=call('/api/cancel',{'id':tid,'by':'x','reason':'r'},tok=T['op1']); chk(st==403,'floor cannot cancel started ticket')
st,j=call('/api/close',{'id':tid,'by':'x','kind':'no_report','note':'fixed'},tok=T['ravi']); chk(st==200 and j['ticket']['closedBy']=='Ravi','close')
# shared login
st,j=call('/api/down',{'machine':'VC-1','by':'Mahesh (Setter)','problem':'Alarm'},tok=T['cell3']); chk(j.get('ticket',{}).get('reportedBy')=='Mahesh (Setter)','shared login keeps typed name'); t2=j['ticket']['id']
st,j=call('/api/cancel',{'id':t2,'by':'Mahesh','reason':'wrong machine'},tok=T['cell3']); chk(st==200,'floor cancels own unstarted ticket')
# pushkey perms
st,j=call('/api/pushkey',tok=T['tvboard']); chk(st==403,'board no push'); st,j=call('/api/pushkey',tok=T['ravi']); chk(st==200,'maint push key')
# list users
st,j=call('/api/users',key=K); chk(st==200 and len(j['users'])==5,'list users'); print([ (u['username'],u['devices']) for u in j['users']])
st,j=call('/api/users',tok=T['ravi']); chk(st==403,'maint cannot list users')
# switch off -> session dies
st,j=call('/api/users',dict(username='ravi',name='Ravi',role='maint',active=False),key=K); chk(st==200,'switch off')
st,j=call('/api/state',tok=T['ravi']); chk(st==401,'switched off -> signed out')
st,j=login('ravi','ravi123'); chk(st==403,'switched off cannot login')
call('/api/users',dict(username='ravi',name='Ravi',role='maint',active=True),key=K)
# reset password -> old sessions die
st,j=call('/api/users/password',dict(username='op1',password='newpw1'),key=K); chk(st==200,'reset pw')
st,j=call('/api/state',tok=T['op1']); chk(st==401,'reset signs out'); chk(login('op1','newpw1')[0]==200,'login new pw')
# change own password
tk=login('tvboard','tvtv12')[1]['token']; st,j=call('/api/password',{'old':'tvtv12','password':'tvnew1'},tok=tk); chk(st==200,'change own pw'); chk(call('/api/state',tok=tk)[0]==200,'current session kept'); chk(call('/api/state',tok=T['tvboard'])[0]==401,'other sessions ended')
# admin self-protect
st,j=call('/api/users',dict(username='boss',name='Admin',role='maint'),tok=T['boss']); chk(st==400,'admin cannot demote self')
st,j=call('/api/users',dict(username='op1',name='Suresh',role='report',title='Setter'),tok=T['boss']); chk(st==200,'admin login edits user')
# lockout
for i in range(5): st,j=login('cell3','bad')
st,j=login('cell3','cell33'); chk(st==429,'locked after 5 wrong: %s'%j.get('error'))
# logout
st,j=call('/api/logout',{},tok=T['boss']); chk(call('/api/state',tok=T['boss'])[0]==401,'logout')
# key still full
chk(call('/api/state',key=K)[0]==200,'platform key ok'); chk(call('/api/state',key='bad')[0]==401,'bad key 401')
st,j=call('/api/state',tok='s_garbagegarbage'); chk(st==401,'bad token')
print('ALL OK' if ok else 'SOME FAILED')
