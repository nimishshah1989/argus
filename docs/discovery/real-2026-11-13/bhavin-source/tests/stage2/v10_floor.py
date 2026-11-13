# shop floor: pending task marker on the Live tile, notice when raising on that machine, task cannot be started/closed from the floor app
import json, urllib.request as U
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'; ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try: return json.loads(U.urlopen(r).read())
    except U.HTTPError as e: return {'status':e.code, **json.loads(e.read() or b'{}')}
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
t=call('/api/down',{'machine':'VC-2','problem':'Coolant pump leaking','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':t['id']},tok=rv)
call('/api/close',{'id':t['id'],'kind':'no_report','note':'temporary fix','by':'Ravi','task':{'text':'Replace pump when spare arrives','why':'Waiting for spare','exp':'2026-11-20'}},tok=rv)
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True).new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(S+'/floor.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','op1'); pg.fill('#lvP','op1234'); pg.click('#lvGo'); pg.wait_for_timeout(2000)
    pg.evaluate("go('live')"); pg.wait_for_timeout(600)
    chk(pg.evaluate("[...document.querySelectorAll('.lvtile')].some(b=>b.innerText.includes('VC-2') && b.querySelector('.tkm'))"),'Live tile for VC-2 carries the pending task marker')
    pg.evaluate("A.st.machine='VC-2'; A.st.kind='stopped'; go('problem')"); pg.wait_for_timeout(400)
    b=pg.inner_text('#lvBody'); chk('pending task is open' in b and 'Replace pump' in b and '20 Nov' in b,'raising on VC-2 shows the notice with the expected date')
    chk(pg.evaluate("document.querySelector('[data-a=startask],[data-a=toclose],[data-a=doneask]')")==None,'no start/close buttons on the floor app')
    chk(not errs,'no page errors '+str(errs[:2]))
print('ALL PASS' if ok else 'SOME FAILED')
