from playwright.sync_api import sync_playwright
import json, urllib.request
def api(path, body=None):
    r=urllib.request.Request('http://localhost:8799'+path, data=json.dumps(body).encode() if body else None, headers={'X-Client':'tst','X-Key':'k123','Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(r))
# one open ticket reported long ago is impossible (server stamps), so set stuck threshold tiny later
api('/api/down',{'machine':'TC-3','by':'Ram (Operator)','problem':'Chuck not clamping'})
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':900}, accept_downloads=True); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("window.Chart=function(){return {destroy(){},update(){}}};Chart.register=function(){};Chart.defaults={font:{},plugins:{legend:{labels:{}}}};")
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(1500)
    pg.evaluate("state.settings.btLive='https://maintenance-bd.example.dev/live.html?c=tst&k=k123'; lvsMigrate()")
    print('migrated', pg.evaluate("[state.settings.btSite, state.settings.btClientId, lvsKey(), state.settings.btLive]"))
    pg.evaluate("btSet('btApi','http://localhost:8799'); lvsStart(true)"); pg.wait_for_timeout(2500)
    print('sync', pg.evaluate("[LVS.err, (LVS.state||{open:[]}).open.length, pendList().length, document.getElementById('pendBadge').textContent]"))
    pg.evaluate("btSet('stuckHrs',0.0001)"); 
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(500)
    print('stuck', pg.evaluate("lvsStuck().length"))
    pg.screenshot(path='/tmp/plat_bd.png')
    pid=pg.evaluate("pendList()[0].id"); n0=pg.evaluate("state.breakdowns.length")
    pg.evaluate(f"pendApprove('{pid}')"); print('approved', pg.evaluate("state.breakdowns.length")-n0, pg.evaluate("state.breakdowns[state.breakdowns.length-1]"))
    pg.evaluate("lvsSync()"); pg.wait_for_timeout(1500); print('no dup', pg.evaluate("pendList().length"))
    pg.evaluate("localStorage.removeItem('bt_sync_tst'); lvsSync()"); pg.wait_for_timeout(1500); print('no dup full', pg.evaluate("pendList().length"))
    pg.evaluate("nav('settings'); setTab='conn'; renderSettings()"); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/plat_conn.png', full_page=True)
    print('excel key?', pg.evaluate("JSON.stringify(state.settings).includes('k123')"))
    pg.evaluate("setTab='phone'; renderSettings()")
    with pg.expect_download() as d: pg.evaluate("btSiteDownload()")
    d.value.save_as('/tmp/site_dl.zip')
    pg.evaluate("nav('dashboard')"); pg.wait_for_timeout(300); print('dash', pg.evaluate("(document.getElementById('lvsDash')||{}).innerHTML"))
    print('errs', [e for e in errs if "reading 'x'" not in e])
