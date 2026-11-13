import json, urllib.request as U, datetime as D
B='http://localhost:8799'
def call(path, body=None, tok=None, key=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    if key: h['X-Key']=key
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try: return json.loads(U.urlopen(r).read())
    except U.HTTPError as e: print('HTTP',e.code,path,e.read().decode()[:200]); raise
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
t=call('/api/down',{'machine':'VC-1','problem':'late close test','kind':'stopped'},tok=op)['ticket']['id']
import time
st=call('/api/start',{'id':t},tok=rv)['ticket']['startedAt']
time.sleep(3)
marker=D.datetime.now(D.UTC).strftime('%Y-%m-%dT%H:%M:%S.000Z')   # portal marker already past the (back-dated) closing time
call('/api/close',{'id':t,'kind':'report','by':'Ravi','report':{'ca':'fixed','mid':'VC-1'},'ts':st},tok=rv)
h=call('/api/history?days=7&reports=1&changed='+marker,key='k123')
ids=[x['id'] for x in h['tickets']]
ok1 = t in ids
print(('PASS ' if ok1 else 'FAIL ')+'ticket closed with a back-dated time is returned by the incremental sync')
# ticket closed long before the marker (really old) must NOT be re-sent forever
time.sleep(1.2)
old=call('/api/history?days=7&reports=1&changed='+D.datetime.now(D.UTC).strftime('%Y-%m-%dT%H:%M:%S.000Z'),key='k123')
ok2 = t not in [x['id'] for x in old['tickets']]
print(('PASS ' if ok2 else 'FAIL ')+'and it is not sent again once the marker has passed the time the server received it')
full=call('/api/history?days=7&reports=1',key='k123')
ok3 = t in [x['id'] for x in full['tickets']]
print(('PASS ' if ok3 else 'FAIL ')+'a full 7-day read still returns it')
print('ALL PASS' if ok1 and ok2 and ok3 else 'SOME FAILED')
