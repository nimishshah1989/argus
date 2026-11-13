from playwright.sync_api import sync_playwright
import json, urllib.request
def api(path, body=None, hdr=None):
    h={'X-Client':'tst','X-Key':'k123','Content-Type':'application/json'}; h.update(hdr or {})
    r=urllib.request.Request('http://localhost:8799'+path, data=json.dumps(body).encode() if body is not None else None, headers=h)
    return json.load(urllib.request.urlopen(r))
st=api('/api/state'); vc9=[t for t in st['open'] if t['machine']=='VC-9'][0]
api('/api/close',{'id':vc9['id'],'by':'Sagar T','kind':'report','report':{'mid':'VC-9','pr':'Coolant nozzle loose','ca':'Tightened nozzle','dm':15}})
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':900}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("window.Chart=function(){return {destroy(){},update(){}}};Chart.register=function(){};Chart.defaults={font:{},plugins:{legend:{labels:{}}}};")
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(1500); pg.evaluate("nav('settings')")
    pg.evaluate("state.settings.btCompany='Cosmos Engitech'; state.settings.btClientId='tst'; state.settings.btApi='http://localhost:8799'; localStorage.setItem('bt_key_tst','k123'); localStorage.removeItem('bt_sync_tst')")
    pg.evaluate("lvsSync(true)"); pg.wait_for_timeout(3000)
    print('sync', pg.evaluate("[LVS.err, LVS.cfgErr||'', pendList().map(x=>x.src+':'+(x.rec.machineId||x.rec.location))]"))
    cfg=api('/api/config'); print('server cfg', cfg['config']['company'], cfg['config']['features'], cfg['config']['workTypes'][:2], 'locations' in cfg['config']['ref'])
    print('cfg line', pg.evaluate("lvsCfgLine()"))
    pg.evaluate("setTab='phone'; renderSettings()"); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/plat_phone.png', full_page=True)
    # change a setting -> pushed on next sync
    pg.evaluate("btSetFeat('general', false); lvsSync()"); pg.wait_for_timeout(2500); print('feature pushed', api('/api/config')['config']['features'])
    gid=pg.evaluate("(pendList().find(x=>x.src==='general')||{}).id"); mid=pg.evaluate("(pendList().find(x=>x.src==='live')||{}).id")
    pg.evaluate(f"pendApprove('{gid}')"); pg.evaluate(f"pendApprove('{mid}')")
    print('gw', pg.evaluate("gwLog().map(r=>[r.location,r.workType,r.done,r.activeMin])"), 'bd last', pg.evaluate("(()=>{const b=state.breakdowns[state.breakdowns.length-1]; return [b.machineId,b.correctiveAction,b.selfStarted,b.raisedRole,b.segments]})()"))
    pg.evaluate("nav('gw')"); pg.wait_for_timeout(400); pg.screenshot(path='/tmp/plat_gw.png', full_page=True)
    print('errs', [e for e in errs if "reading 'x'" not in e])
