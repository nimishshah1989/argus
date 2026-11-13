import json, urllib.request as U
from playwright.sync_api import sync_playwright
B='http://localhost:8799'; S='http://localhost:8787'; ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET'); return json.loads(U.urlopen(r).read())
rv=call('/api/login',{'username':'ravi','password':'ravi123'})['token']
cfg=call('/api/config',tok=rv)['config']; cfg['ref']['machines'].append({'id':'BOXY','category':'Robot','cell':'1','seg':'Robot'})
r=U.Request(B+'/api/config',data=json.dumps({'config':cfg,'fp':'fprobot'}).encode(),headers={'X-Client':'tst','X-Key':'k123','X-Config-Token':'ct_'+'a'*40,'Content-Type':'application/json'},method='POST'); U.urlopen(r)
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(S+'/floor.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','op1'); pg.fill('#lvP','op1234'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    t=pg.inner_text('#lvBody'); chk('ROBOTS' in t.upper(),'Report screen has a Robots section')
    pg.fill('#lvsq','boxy'); pg.dispatch_event('#lvsq','input'); pg.wait_for_timeout(200); chk('BOXY' in pg.inner_text('#lvsres'),'search finds BOXY')
    pg.click('#lvsres [data-v="BOXY"]'); pg.click('[data-a="kind"][data-v="stopped"]'); pg.wait_for_timeout(300); pg.fill('#d_problem','Gripper not closing'); pg.dispatch_event('#d_problem','input'); pg.click('#lvsend'); pg.wait_for_timeout(1500)
    chk('Sent to maintenance' in pg.inner_text('#lvBody'),'BOXY breakdown reported'); c.close()
    c=br.new_context(viewport={'width':1600,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(S+'/live.html'); pg.wait_for_timeout(800); pg.fill('#lu','tvboard'); pg.fill('#lp','tvtv12'); pg.click('#lg'); pg.wait_for_timeout(2500)
    chk('BOXY' not in pg.inner_text('#wall') and 'BOXY' not in pg.inner_text('#side'),'TV board does not show BOXY'); c.close(); br.close()
print('errors', errs); print('ALL OK' if ok and not errs else 'FAIL')
