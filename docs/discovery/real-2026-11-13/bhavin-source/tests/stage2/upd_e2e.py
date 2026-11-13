import subprocess, re, time
from playwright.sync_api import sync_playwright
S='http://localhost:8787'
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(6000)
    b0=pg.evaluate("APP_BUILD"); chk(b0.isdigit() and pg.query_selector('#lvUpd') is None,'same version: no update bar (build %s)'%b0)
    # deploy new pages (new build stamp)
    time.sleep(1.2); subprocess.run("sed -i \"s/APP_BUILD = '[0-9]*'/APP_BUILD = '29990101000000'/\" /tmp/s2site/maint.html", shell=True)
    pg.evaluate("lvUpAt=0; document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(1500)
    chk(pg.query_selector('#lvUpd') is not None and 'new version' in pg.inner_text('#lvUpd'),'new pages deployed: "Update now" bar shown when the app comes back')
    pg.screenshot(path='/home/claude/s2/shots/update_bar.png')
    pg.click('#lvUpd button'); pg.wait_for_timeout(3000)
    b1=pg.evaluate("APP_BUILD"); chk(b1!=b0 and pg.query_selector('#lvUpd') is None,'Update now loads the new pages (%s -> %s), still signed in: %s'%(b0,b1,pg.is_visible('#lvLogin')==False))
    chk(not pg.is_visible('#lvLogin'),'still signed in after the update')
    pg.evaluate("lvUpAt=0; lvCheckUpdate()"); pg.wait_for_timeout(1200); chk(pg.query_selector('#lvUpd') is None,'no bar again once up to date')
    n=pg.evaluate("caches.keys().then(async K=>{let t=0; for(const k of K){ t+=(await (await caches.open(k)).keys()).length } return [K,t]})"); chk(len(n[0])<=1 and n[1]<20,'offline store stays small: %s'%n)
    br.close()
print('errors', errs); print('ALL OK' if ok and not errs else 'FAIL')
