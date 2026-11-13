from playwright.sync_api import sync_playwright
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_page(viewport={'width':1400,'height':900}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    def stub(route):
        u=route.request.url
        if 'xlsx' in u: route.fulfill(status=200, content_type='application/javascript', body=open('/tmp/xl/node_modules/xlsx/dist/xlsx.full.min.js').read()); return
        route.fulfill(status=200, content_type='application/javascript', body='window.Chart=function(){return {destroy(){},update(){},resize(){},scales:{x:{},y:{}}}};window.Chart.register=function(){};window.Chart.defaults={plugins:{legend:{labels:{}},tooltip:{}},font:{},scale:{grid:{}}};' if 'chart' in u.lower() else '')
    pg.route('https://cdnjs.cloudflare.com/**', stub); pg.route('https://cdn.jsdelivr.net/**', stub)
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(2500)
    pg.evaluate("""()=>{ state.pendingBD=[
      {id:'p1',src:'live',ticketId:'t1',rec:{id:'b1',machineId:'VC-9',date:'01-11-2026',problem:'Spindle noise',downMin:60,downHrs:1},at:new Date().toISOString(),by:'Ravi'},
      {id:'p2',src:'general',ticketId:'t2',rec:{id:'g1',date:'01-11-2026',location:'Store',workType:'Electrical',problem:'Fan not working',done:'Fan replaced',activeMin:30},at:new Date().toISOString(),by:'Amit'}];
      LVS.state={now:new Date().toISOString(),open:[
        {id:'o1',kind:'stopped',machine:'VC-5',problem:'Old breakdown',downAt:new Date(Date.now()-5*86400000).toISOString(),updates:[],reportedBy:'x'},
        {id:'o2',kind:'general',location:'Office',workType:'Civil',machine:'',problem:'Door repair',downAt:new Date(Date.now()-5*86400000).toISOString(),updates:[],reportedBy:'y'}],needReport:[]}; state.settings.btApi='http://x'; persist(); }""")
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(600); t=pg.inner_text('#page-'+('gw' if 'gw' in pg.evaluate('currentPage') else 'breakdowns')+' .lvsPanel')
    chk('Spindle noise' in t and 'Fan not working' not in t and 'VC-5' in t and 'Door repair' not in t,'Breakdown Log panel shows only breakdowns')
    chk('1 more' in t,'notes 1 waiting on the other page')
    pg.evaluate("nav('gw')"); pg.wait_for_timeout(600); t=pg.inner_text('#page-'+('gw' if 'gw' in pg.evaluate('currentPage') else 'breakdowns')+' .lvsPanel')
    chk('Fan not working' in t and 'Spindle noise' not in t and 'Office' in t and 'VC-5' not in t,'General Work panel shows only work requests')
    pg.once('dialog', lambda d: d.accept()); pg.click("#page-gw .lvsPanel button:has-text('Approve all')"); pg.wait_for_timeout(400)
    chk(pg.evaluate("[pendList().map(x=>x.id), gwLog().some(r=>r.id==='g1'), state.breakdowns.some(b=>b.id==='b1')]")==[['p1'],True,False],'Approve all on General Work approves only work requests')
    print('errors', [e for e in errs if '_bubWired' not in e and "reading 'x'" not in e]); br.close()
print('ALL OK' if ok else 'FAIL')
