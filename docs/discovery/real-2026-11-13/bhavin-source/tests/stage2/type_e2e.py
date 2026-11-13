import json, urllib.request as U
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None, key=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    return json.loads(U.urlopen(r).read())
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
a=call('/api/down',{'machine':'VC-1','problem':'TYPE support','kind':'support'},tok=op)['ticket']['id']
b=call('/api/down',{'machine':'VC-2','problem':'TYPE stopped','kind':'stopped'},tok=op)['ticket']['id']
c=call('/api/down',{'machine':'VC-3','problem':'TYPE follow','kind':'stopped'},tok=op)['ticket']['id']
call('/api/start',{'id':c},tok=rv); call('/api/running',{'id':c},tok=rv)
call('/api/start',{'id':a},tok=rv)
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); cx=br.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Kolkata'); pg=cx.new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    def cards(): return pg.evaluate("[...document.querySelectorAll('.lvtk')].map(e=>e.innerText)")
    def find(t,k): return [x for x in t if k in x]
    o=cards()
    chk(find(o,'TYPE stopped') and 'Machine stopped' in find(o,'TYPE stopped')[0],'Open tab: stopped card has Machine stopped')
    pg.evaluate("go('mine')"); pg.wait_for_timeout(700); m=cards()
    s=find(m,'TYPE support'); f=find(m,'TYPE follow')
    chk(s and 'Machine running · needs support' in s[0],'Mine: support card says Machine running · needs support')
    chk(f and 'Machine running again' in f[0],'Mine: follow-up card says Machine running again')
    h=pg.evaluate("[...document.querySelectorAll('.lvtk')].filter(e=>e.innerText.includes('TYPE support'))[0].querySelector('.hd').nextElementSibling.className")
    chk(h=='lvtype','type line sits directly under the machine / ticket number header')
    chk(not errs,'no page errors '+str(errs))
print('ALL PASS' if ok else 'SOME FAILED')
