import json, urllib.request as U
from playwright.sync_api import sync_playwright
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
B='http://localhost:8799'
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':1400,'height':950}, accept_downloads=True); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    def stub(route):
        u=route.request.url
        if 'xlsx' in u: route.fulfill(status=200, content_type='application/javascript', body=open('/tmp/xl/node_modules/xlsx/dist/xlsx.full.min.js').read()); return
        route.fulfill(status=200, content_type='application/javascript', body='window.Chart=function(){return {destroy(){},update(){},resize(){},scales:{x:{},y:{}}}};window.Chart.register=function(){};window.Chart.defaults={plugins:{legend:{labels:{}},tooltip:{}},font:{},scale:{grid:{}}};' if 'chart' in u.lower() else '')
    c.route('https://cdnjs.cloudflare.com/**', stub); c.route('https://cdn.jsdelivr.net/**', stub)
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(2500)
    base=pg.evaluate("[state.breakdowns.length, state.breakdowns.reduce((a,b)=>a+(Number(b.downHrs)||0),0)]")
    f=pg.evaluate("btClientFile().ref.machines.find(m=>m.id==='BOXY')"); chk(f and f['seg']=='Robot','BOXY sent to phones in the Robot section: %s'%f)
    chk(not pg.evaluate("btClientFile().ref.machines.some(m=>m.id==='BOXY' && m.seg==='CNC')"),'BOXY not sent as CNC (so it stays off the TV board)')
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(500); pg.click("button:has-text('+ Log Breakdown')"); pg.wait_for_timeout(400)
    g=pg.evaluate("[...document.querySelectorAll('#f_machineId optgroup')].map(x=>[x.label, [...x.children].map(o=>o.value)])")
    chk(any(l=='Robots' and 'BOXY' in v for l,v in g) and not any(l=='CNC machines' and 'BOXY' in v for l,v in g),'Robots group in the picker with BOXY')
    pg.select_option('#f_machineId','BOXY'); pg.fill('#f_date','2026-11-02'); pg.fill('#f_problem','Gripper not closing'); pg.fill('#f_downMin','45'); pg.click("button:has-text('Save Entry')"); pg.wait_for_timeout(500)
    r=pg.evaluate("[otherBD().filter(b=>b.machineId==='BOXY').map(b=>b.seg), state.breakdowns.length, state.breakdowns.reduce((a,b)=>a+(Number(b.downHrs)||0),0)]")
    chk(r[0]==['Robot'] and r[1]==base[0] and abs(r[2]-base[1])<1e-9,'robot breakdown logged under Robot, CNC figures unchanged')
    pg.evaluate("bdSetTab('Robot')"); pg.wait_for_timeout(300); t=pg.inner_text('#bdTbody'); chk('BOXY' in t and 'Gripper' in t,'section filter: Robots')
    pg.evaluate("pendList().push({id:'pr1',src:'live',ticketId:'t_r1',rec:{id:'bd_r1',machineId:'BOXY',date:'03-11-2026',problem:'Robot alarm',downMin:20,downHrs:0.33,ticketRef:'BD-0099'},at:new Date().toISOString()}); pendApprove('pr1');")
    chk(pg.evaluate("otherBD().some(b=>b.id==='bd_r1' && b.seg==='Robot')"),'approved robot ticket goes to Robots')
    pg.evaluate("openAssetDetail('machines','BOXY')"); pg.wait_for_timeout(600); t=pg.inner_text('#page-asset')
    chk('Breakdown history (2)' in t and 'Gripper not closing' in t and 'Robot alarm' in t,'BOXY page shows its breakdown history')
    with pg.expect_download() as d: pg.click("#page-asset button:has-text('Download history (Excel)')")
    chk(d.value.suggested_filename.startswith('BOXY_BD_History'),'BOXY Excel download')
    # saved entries from before move into Robots on the next load
    pg.evaluate("async ()=>{ otherBD().splice(0); state.breakdowns.push({id:'bd_oldrobot',machineId:'BOXY',date:'01-10-2026',problem:'old robot entry',downMin:30,downHrs:0.5}); await saveStateToDB(); }"); pg.wait_for_timeout(500)
    pg.reload(); pg.wait_for_timeout(3000)
    chk(pg.evaluate("otherBD().some(b=>b.id==='bd_oldrobot' && b.seg==='Robot') && !state.breakdowns.some(b=>b.id==='bd_oldrobot')"),'older robot entries move to Robots on load')
    br.close()
print('errors', [e for e in errs if '_bubWired' not in e and "reading 'x'" not in e]); print('ALL OK' if ok else 'FAIL')
