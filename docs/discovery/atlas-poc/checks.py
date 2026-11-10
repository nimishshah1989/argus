import json, urllib.request, sys
API='http://localhost:8080'
def call(m, p, b=None, t=None):
    r=urllib.request.Request(API+p, data=None if b is None else json.dumps(b).encode(), method=m)
    r.add_header('Content-Type','application/json')
    if t: r.add_header('Authorization','Bearer '+t)
    try:
        with urllib.request.urlopen(r, timeout=60) as x:
            s=x.read().decode(); return x.status, (json.loads(s) if s else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]
def signin(e,p): return call('POST','/auth/signin',{"email":e,"password":p,"type":"client"})[1]['accessToken']
A=signin('admin@cosmos.test','Cosmos#2026demo')
st,page=call('POST','/assets/search',{"pageNum":0,"pageSize":5,"filterFields":[]},A)
print('tenant A asset search', st, page.get('totalElements') if isinstance(page,dict) else page)
items=page['content']; parent, child = items[0], items[1]
st,res=call('PATCH',f"/assets/{child['id']}",{"parentAsset":{"id":parent['id']}},A)
print('asset hierarchy patch', st, (res.get('parentAsset') or {}).get('id') if isinstance(res,dict) else res)
# second tenant
call('POST','/auth/signup',{"email":"admin@foundry.test","password":"Foundry#2026demo","firstName":"Foundry","lastName":"Admin","phone":"+910000000001","companyName":"Foundry (demo tenant)","employeesCount":20,"language":"EN","skipMailSending":True,"timeZone":"Asia/Kolkata"})
B=signin('admin@foundry.test','Foundry#2026demo')
st,pb=call('POST','/assets/search',{"pageNum":0,"pageSize":5,"filterFields":[]},B)
print('tenant B asset search', st, pb.get('totalElements') if isinstance(pb,dict) else pb)
st,x=call('GET',f"/assets/{parent['id']}",None,B)
print('tenant B reading tenant A asset by id ->', st)
st,w=call('POST','/work-orders/search',{"pageNum":0,"pageSize":1,"filterFields":[]},B)
print('tenant B work orders', st, w.get('totalElements') if isinstance(w,dict) else w)
