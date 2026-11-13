import json, urllib.request as U
B='http://localhost:8799'
def call(path, body=None, tok=None, key=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    if key: h['X-Key']=key
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try:
        x=U.urlopen(r); return x.status, json.loads(x.read())
    except U.HTTPError as e: return e.code, e.read()[:300]
tm=call('/api/login',{'username':'team','password':'team12'})[1]
tm=tm['token'] if isinstance(tm,dict) else None
s,j=call('/api/mywork',tok=tm); print('mywork shared', s, len(j['tickets']) if isinstance(j,dict) else j)
s,j=call('/api/history?days=30&reports=1',key='k123'); print('history reports', s, len(j['tickets']) if isinstance(j,dict) else j)
