import json, urllib.request as U
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    return json.loads(U.urlopen(r).read())
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
t=call('/api/down',{'machine':'VC-2','problem':'Coolant pump leaking','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':t['id']},tok=rv)
c=call('/api/close',{'id':t['id'],'kind':'no_report','note':'Temporary fix, machine running','by':'Ravi','task':{'text':'Replace coolant pump','why':'Waiting for spare','exp':''}},tok=rv)
with sync_playwright() as p:
    pg=p.chromium.launch().new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block').new_page()
    pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    pg.evaluate("go('mine')"); pg.wait_for_timeout(800)
    pg.evaluate("go('open')"); pg.wait_for_timeout(800); pg.screenshot(path='shots/open_pending.png')

