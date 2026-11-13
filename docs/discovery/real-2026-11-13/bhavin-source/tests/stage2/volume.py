import json, urllib.request as U, sys
B='http://localhost:8799'
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try: return json.loads(U.urlopen(r).read())
    except U.HTTPError as e: return {'status':e.code, 'body':e.read()[:200]}
op=call('/api/login',{'username':'op1','password':'op1234'})['token']; tm=call('/api/login',{'username':'team','password':'team12'})['token']
n=int(sys.argv[1]) if len(sys.argv)>1 else 130
ms=['VC-%d'%i for i in range(1,9)]+['TC-%d'%i for i in range(1,6)]
for i in range(n):
    t=call('/api/down',{'machine':ms[i%len(ms)],'problem':'Volume test %d'%i,'kind':'stopped'},tok=op)['ticket']['id']
    call('/api/start',{'id':t,'by':['Ravi','Amit','Kiran'][i%3]},tok=tm); call('/api/close',{'id':t,'by':['Ravi','Amit','Kiran'][i%3],'kind':'no_report','note':'fixed %d'%i},tok=tm)
print('created',n)
