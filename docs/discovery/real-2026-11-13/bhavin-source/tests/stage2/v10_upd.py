# Update now: when the server copy has a different build stamp, the notice appears once; Update now reloads and the notice does not come straight back
import re
from playwright.sync_api import sync_playwright
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
errs=[]
with sync_playwright() as p:
    cx=p.chromium.launch().new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, service_workers='block'); pg=cx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    state={'new':False}
    def h(route):
        r=route.request
        if state['new'] and r.url.endswith('/maint.html') and r.resource_type=='fetch':
            resp=route.fetch(); body=resp.text(); body=re.sub(r"APP_BUILD = '[^']+'","APP_BUILD = '29990101000000'",body); route.fulfill(response=resp, body=body)
        else: route.continue_()
    cx.route('**/maint.html', h)
    pg.goto('http://localhost:8787/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(2500)
    chk(pg.query_selector('#lvUpd') is None,'no notice when the build matches')
    state['new']=True; print(pg.evaluate("[APP_BUILD, lvUpAt, !!document.getElementById('lvUpd')]")); pg.evaluate("lvUpAt=0; lvCheckUpdate()"); pg.wait_for_timeout(1500)
    chk(pg.query_selector('#lvUpd') is not None,'notice appears when the server has a newer build')
    state['new']=False
    pg.evaluate("document.querySelector('#lvUpd button').click()"); pg.wait_for_timeout(3500)
    chk(pg.evaluate("typeof lvApplyUpdate")=='function','page reloaded with the new code')
    pg.wait_for_timeout(1500); chk(pg.query_selector('#lvUpd') is None,'notice does not come straight back after Update now')
    chk(int(pg.evaluate("sessionStorage.getItem('lvUpAt')||0"))>0,'the check time is remembered across the reload')
    chk(not errs,'no page errors '+str(errs[:2]))
print('ALL PASS' if ok else 'SOME FAILED')
