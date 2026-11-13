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
def mk(m,prob,task=None):
    t=call('/api/down',{'machine':m,'problem':prob,'kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':t['id']},tok=rv)
    c=call('/api/close',{'id':t['id'],'kind':'no_report','note':'fixed','by':'Ravi',**({'task':task} if task else {})},tok=rv); return t,c
tA,cA=mk('VC-2','Coolant pump leaking',{'text':'Replace coolant pump','why':'Waiting for spare','exp':'2026-11-12'})
tB,cB=mk('VC-3','Spindle noise',{'text':'Change spindle bearing','why':'Needs vendor','exp':'2026-11-03'})
tC,cC=mk('VC-4','Door sensor')   # no task
tD,cD=mk('VC-5','Chiller alarm',{'text':'Clean chiller filter','why':'','exp':''}); call('/api/start',{'id':cD['task']['id']},tok=rv)
tE,cE=mk('VC-6','Belt slip',{'text':'Replace belt','why':'spare','exp':''}); call('/api/start',{'id':cE['task']['id']},tok=rv); call('/api/close',{'id':cE['task']['id'],'kind':'no_report','note':'done','by':'Ravi'},tok=rv)

with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_context(viewport={'width':390,'height':2200}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block').new_page()
    pg.goto(S+'/floor.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','op1'); pg.fill('#lvP','op1234'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    pg.evaluate("go('my')"); pg.wait_for_timeout(900)
    for ref,n in [('VC-2','pending'),('VC-5','progress'),('VC-3','overdue'),('VC-6','done')]:
        pg.evaluate("(r)=>{const e=[...document.querySelectorAll('.lvtk')].find(x=>x.innerText.includes(r)); e.setAttribute('id','snap')}",ref)
        pg.locator('#snap').screenshot(path='shots/guide_%s.png'%n)
        pg.evaluate("document.getElementById('snap').removeAttribute('id')")
print('ok')
