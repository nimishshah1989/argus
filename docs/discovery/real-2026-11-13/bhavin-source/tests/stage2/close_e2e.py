import json, urllib.request as U
from playwright.sync_api import sync_playwright
B='http://localhost:8799'
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    return json.loads(U.urlopen(r).read())
op=call('/api/login',{'username':'op1','password':'op1234'})['token']; rv=call('/api/login',{'username':'ravi','password':'ravi123'})['token']
tid=call('/api/down',{'machine':'TC-4','problem':'ચક ક્લેમ્પ નથી થતું – chuck not clamping','kind':'stopped'},tok=op)['ticket']['id']; call('/api/start',{'id':tid},tok=rv)
ok=True
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, accept_downloads=True); pg=c.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8787/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(1500)
    pg.click('[data-a="tab"][data-v="mine"]'); pg.wait_for_timeout(500); pg.click('[data-a="toclose"][data-v="%s"]'%tid); pg.wait_for_timeout(300); pg.click('[data-a="closego"]'); pg.wait_for_timeout(700)
    for sel in ['#f_shift','#f_observedBy','#f_maintCode','#f_breakdownCategory']:
        opts=pg.eval_on_selector(sel,"e=>[...e.options].map(o=>o.value).filter(Boolean)")
        if opts and not pg.input_value(sel): pg.select_option(sel, opts[0])
    pg.fill('#f_correctiveAction','Clamp cylinder seal replaced ₹ 1,200')
    pg.locator('#sigCanvas').scroll_into_view_if_needed(); b=pg.locator('#sigCanvas').bounding_box(); pg.mouse.move(b['x']+20,b['y']+30); pg.mouse.down(); pg.mouse.move(b['x']+150,b['y']+90); pg.mouse.up()
    with pg.expect_download(timeout=20000): pg.click('#submitBtn')
    pg.wait_for_timeout(2000); t=pg.inner_text('#successScreen')
    print(('PASS' if 'Ticket closed' in t else 'FAIL')+' close flow shows success: '+t[:120].replace('\n',' '))
    st=call('/api/history?days=1&reports=1',None) if False else None
    print('errors', errs); br.close()
