from playwright.sync_api import sync_playwright
import json, urllib.request
def api(path, body=None):
    r=urllib.request.Request('http://localhost:8799'+path, data=json.dumps(body).encode() if body else None, headers={'X-Client':'tst','X-Key':'k123','Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(r))
api('/api/down',{'machine':'VC-7','by':'Ram (Operator)','problem':'Spindle noise'})
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':400,'height':860}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8787/index.html?c=tst&k=k123&role=maint'); pg.wait_for_timeout(2500)
    def click(a,v=None):
        sel='[data-a="%s"]'%a + ('[data-v="%s"]'%v if v else '')
        pg.locator(sel).first.click(); pg.wait_for_timeout(700)
    tid=api('/api/state')['open'][0]['id']
    click('startask',tid); pg.locator('#lvSheet [data-a="who"]').first.click(); pg.wait_for_timeout(300); click('startgo'); pg.wait_for_timeout(1200)
    print('view',pg.evaluate("A.view"), api('/api/state')['open'][0]['status'])
    click('updask',tid); pg.fill('#lvwhy','Bearing damaged, waiting spare'); pg.fill('#lvspare','Bearing 7014'); pg.fill('#lveta','2026-11-01')
    pg.locator('#lvSheet [data-a="uby"]').first.click(); pg.wait_for_timeout(300); click('updgo'); pg.wait_for_timeout(1200)
    t=api('/api/state')['open'][0]; print('upd',t['eta'],t['waitSpare'],len(t['updates']))
    pg.screenshot(path='/tmp/ph_mine.png')
    click('handask',tid); pg.fill('#lvwhy','Removed spindle, need fitting'); pg.locator('#lvSheet [data-a="to"]').first.click(); pg.wait_for_timeout(300); pg.locator('#lvSheet [data-a="hby"]').first.click(); pg.wait_for_timeout(300); click('handgo'); pg.wait_for_timeout(1200)
    t=api('/api/state')['open'][0]; print('hand',t['status'],t['handedOver'],t['transferTo'], pg.evaluate("A.view"))
    pg.screenshot(path='/tmp/ph_open.png')
    click('startask',tid); pg.locator('#lvSheet [data-a="who"]').nth(1).click(); pg.wait_for_timeout(300); click('startgo'); pg.wait_for_timeout(1200)
    t=api('/api/state')['open'][0]; print('pickup',t['status'],t['startedBy'],t['transfers'])
    click('noreport',tid); pg.fill('#lvwhy','Busy, will write later'); pg.locator('#lvSheet [data-a="rby"]').first.click(); pg.wait_for_timeout(300); click('noreportgo'); pg.wait_for_timeout(1200)
    click('tab','open'); pg.wait_for_timeout(500)
    print('needreport on phone', pg.locator('[data-a="latereport"]').count())
    pg.screenshot(path='/tmp/ph_nr.png', full_page=True)
    click('latereport',tid); pg.wait_for_timeout(800)
    print('form', pg.evaluate("[A.view, document.getElementById('f_machineId').value, document.getElementById('lvBanner').textContent.slice(0,80)]"))
    pg.evaluate("window.LV_LAST={v:1,mid:'VC-6',pr:'Spindle noise',ca:'Replaced bearing',dm:120}; lvReportSaved()"); pg.wait_for_timeout(1500)
    print(pg.evaluate("document.getElementById('lvDone').textContent"))
    h=api('/api/history?days=2&reports=1')['tickets'][0]; print('server',h['closeKind'],h['report'],h['transfers'],h['handoverWaitMin'])
    print(api('/api/state')['needReport'])
    print('push state', pg.evaluate('LV.push')); print('errs',errs)
