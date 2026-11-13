import shutil
from playwright.sync_api import sync_playwright
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
shutil.copy('/home/claude/s2/platform_before_import.html','/tmp/plat.html')
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':1300,'height':900}); pg=c.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    def stub(route):
        u=route.request.url
        if 'xlsx' in u: route.fulfill(status=200, content_type='application/javascript', body=open('/tmp/xl/node_modules/xlsx/dist/xlsx.full.min.js').read()); return
        route.fulfill(status=200, content_type='application/javascript', body='window.Chart=function(){return {destroy(){},update(){},resize(){},scales:{x:{},y:{}}}};window.Chart.register=function(){};window.Chart.defaults={plugins:{legend:{labels:{}},tooltip:{}},font:{},scale:{grid:{}}};' if 'chart' in u.lower() else '')
    c.route('https://cdnjs.cloudflare.com/**', stub); c.route('https://cdn.jsdelivr.net/**', stub)
    pg.goto('file:///tmp/plat.html'); pg.wait_for_timeout(2500)
    pg.evaluate("""async ()=>{ state.breakdowns.push({id:'bd_mine_only',machineId:'VC-9',date:'01-11-2026',shift:'1',problem:'Entered only in my browser',downMin:30,downHrs:0.5,maintCode:'E',electMech:'E'});
      otherBD().push({id:'bd_conv1',machineId:'BS-01',date:'30-10-2026',problem:'Blade',downMin:60,downHrs:1,seg:'Conventional'}); state.pendingBD=[{id:'pend1',src:'live',rec:{id:'x',machineId:'VC-1'}}]; state.settings.gwLog=[{id:'g1'}];
      await saveStateToDB(); }""")
    before=pg.evaluate("[state.breakdowns.length, state.meta && state.meta.dataVersion]"); print('saved before', before)
    shutil.copy('/home/claude/cosmos_platform.html','/tmp/plat.html')
    pg.reload(); pg.wait_for_timeout(3000)
    r=pg.evaluate("[state.meta.dataVersion, state.breakdowns.length, state.breakdowns.some(b=>b.id==='bd_mine_only'), otherBD().length, (state.pendingBD||[]).length, (state.settings.gwLog||[]).length, state.machines.some(m=>m.id==='VC-57'), state.breakdowns.filter(b=>b.date && b.date.endsWith('10-2026') && b.id.startsWith('bd_mvq')).length]")
    chk(r[0]==21,'data version 21'); chk(r[1]==before[0]+55,'55 breakdowns added: %s -> %s'%(before[0],r[1])); chk(r[2],'my browser-only entry kept')
    chk(r[3]==1 and r[4]==1 and r[5]==1,'other-section breakdowns, approvals, work log kept: %s'%r[3:6]); chk(r[6],'VC-57 added')
    v=pg.evaluate("(state.breakdowns.find(b=>b.machineId==='VC-9'&&b.date==='16-03-2026')||{}).downMin"); chk(v==235,'UTI entry stays at 235 min')
    pg.evaluate("nav('machines')"); pg.wait_for_timeout(500); chk('VC-57' in pg.inner_text('#page-machines'),'VC-57 in the CNC machine list')
    f=pg.evaluate("btClientFile().ref.machines.some(m=>m.id==='VC-57')"); chk(f,'VC-57 goes to the phones with the next sync')
    print('errors', [e for e in errs if '_bubWired' not in e and "reading 'x'" not in e]); br.close()
print('ALL OK' if ok else 'FAIL')
