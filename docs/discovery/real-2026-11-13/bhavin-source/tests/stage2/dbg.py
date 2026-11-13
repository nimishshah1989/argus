import json, urllib.request as U
from playwright.sync_api import sync_playwright
B='http://localhost:8799'
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET'); return json.loads(U.urlopen(r).read())
op=call('/api/login',{'username':'op1','password':'op1234'})['token']; rv=call('/api/login',{'username':'ravi','password':'ravi123'})['token']
t=call('/api/down',{'machine':'VC-1','problem':'x','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':t['id']},tok=rv)
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True).new_page()
    pg.goto('http://localhost:8787/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    pg.evaluate("go('mine')"); pg.wait_for_timeout(500)
    pg.evaluate("window.__n=0; new MutationObserver(()=>window.__n++).observe(document.getElementById('lvBody'),{childList:true,subtree:true})")
    pg.wait_for_timeout(3000); print('mutations in 3s', pg.evaluate("window.__n"))
    print(pg.evaluate("document.querySelector('#lvBody').innerHTML.length"))
