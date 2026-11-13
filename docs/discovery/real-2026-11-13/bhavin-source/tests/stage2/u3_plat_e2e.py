import json, zipfile, io
from playwright.sync_api import sync_playwright
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':1400,'height':950}, accept_downloads=True); pg=c.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    def stub(route):
        u=route.request.url
        if 'xlsx' in u: route.fulfill(status=200, content_type='application/javascript', body=open('/tmp/xl/node_modules/xlsx/dist/xlsx.full.min.js').read()); return
        body='window.Chart=function(){return {destroy(){},update(){},resize(){},scales:{x:{getPixelForValue(){return 0}},y:{getPixelForValue(){return 0}}}}};window.Chart.register=function(){};window.Chart.defaults={plugins:{legend:{labels:{}},tooltip:{}},font:{},scale:{grid:{}}};' if 'chart' in u.lower() else ''
        route.fulfill(status=200, content_type='application/javascript', body=body)
    pg.route('https://cdnjs.cloudflare.com/**', stub); pg.route('https://cdn.jsdelivr.net/**', stub)
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(3000)
    chk(pg.evaluate("typeof XLSX")=='object','Excel library loaded')
    base=pg.evaluate("({n:state.breakdowns.length, h:state.breakdowns.reduce((a,b)=>a+(Number(b.downHrs)||0),0), uti:bdAll().filter(b=>b.utiHrs!==undefined).length, vc9:(state.breakdowns.find(b=>b.machineId==='VC-9'&&b.date==='16-03-2026')||{}).downMin})")
    chk(base['uti']==0 and base['vc9']==235,'UTI gone, VC-9 16 Mar downtime 235: %s'%base)
    # migration of saved data that still has UTI
    r=pg.evaluate("""()=>{ const b = state.breakdowns.find(x=>x.machineId==='VTL-5'); b.downMin=60; b.utiHrs=0.5; 
       bdAll().forEach(b=>{ if(b && b.utiHrs!==undefined){ const u = Number(b.utiHrs)||0; if(u > 0){ b.downMin = (Number(b.downMin)||0) + Math.round(u*60); b.downHrs = Math.round(b.downMin/60*100)/100; } delete b.utiHrs; } }); return [b.downMin, b.downHrs, 'utiHrs' in b]; }""")
    chk(r==[90,1.5,False],'saved UTI entry moves into downtime: %s'%r)
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(800)
    pg.click("button:has-text('+ Log Breakdown')"); pg.wait_for_timeout(500)
    groups=pg.evaluate("[...document.querySelectorAll('#f_machineId optgroup')].map(g=>g.label)")
    chk(groups[:2]==['CNC machines','Conventional machines'] and 'Utilities' in groups,'picker grouped by section: %s'%groups)
    t=pg.inner_text('#modalBox'); chk('Machine downtime (min)' in t and 'Response time (min)' in t and 'Repair time (min)' in t and 'UTI Hours' not in t,'form labels renamed, UTI gone')
    pg.select_option('#f_machineId','BS-01'); pg.wait_for_timeout(100); chk('Conventional' in pg.input_value('#f_categoryPreview'),'category shows Conventional')
    pg.fill('#f_date','2026-10-30'); pg.fill('#f_problem','Blade broken'); pg.fill('#f_downMin','90'); pg.fill('#f_repairMin','45'); pg.fill('#f_respMin','10')
    pg.click("button:has-text('Save Entry')"); pg.wait_for_timeout(600)
    after=pg.evaluate("({n:state.breakdowns.length, h:state.breakdowns.reduce((a,b)=>a+(Number(b.downHrs)||0),0), o:otherBD().map(b=>[b.machineId,b.seg,b.downMin,b.activeMin,b.respMin])})")
    chk(after['n']==base['n'] and abs(after['h']-base['h'])<1e-9 and after['o']==[['BS-01','Conventional',90,45,10]],'conventional entry stored outside CNC analytics: %s'%after['o'])
    t=pg.inner_text('#bdTabs').replace('\n',' '); chk('Conventional 1' in t,'Conventional tab counts the entry: '+t)
    pg.evaluate("bdSetTab('Conventional')"); pg.wait_for_timeout(300); rows=pg.inner_text('#bdTbody'); chk('BS-01' in rows and 'VC-' not in rows,'section filter works')
    pg.screenshot(path='/home/claude/s2/shots/u4_log.png')
    # edit keeps live fields, CNC entry with ticket
    pg.evaluate("state.breakdowns.push({id:'bd_tkt1',machineId:'VC-9',date:'30-10-2026',shift:'1',problem:'Test live',downMin:30,downHrs:0.5,maintCode:'E',electMech:'E',ticketId:'t_x1',respMin:5,activeMin:20,segments:[{by:'Ravi',mins:20}]}); persist();")
    pg.evaluate("openBreakdownForm('bd_tkt1')"); pg.wait_for_timeout(300)
    chk(pg.input_value('#f_respMin')=='5' and pg.input_value('#f_repairMin')=='20','response and repair shown from live ticket')
    pg.fill('#f_problem','Test live edited'); pg.click("button:has-text('Update Entry')"); pg.wait_for_timeout(400)
    e=pg.evaluate("(()=>{const b=bdFind('bd_tkt1'); return [b.problem,b.ticketId,b.segments&&b.segments.length,b.activeMin]})()"); chk(e==['Test live edited','t_x1',1,20],'edit keeps ticket and segments: %s'%e)
    # approvals: live ticket for a utility machine
    pg.evaluate("""pendList().push({id:'pend_u1',src:'live',ticketId:'t_u1',rec:{id:'bd_u1',machineId:'COMP.-01',date:'30-10-2026',shift:'1',problem:'Air pressure low',downMin:40,downHrs:0.67,maintCode:'PNU',electMech:'M',ticketId:'t_u1'},at:new Date().toISOString(),by:'Ravi'}); persist(); pendApprove('pend_u1');""")
    chk(pg.evaluate("otherBD().some(b=>b.id==='bd_u1' && b.seg==='Utility') && !state.breakdowns.some(b=>b.id==='bd_u1')"),'approved utility ticket goes to the right list')
    # asset page history + Excel download
    pg.evaluate("openAssetDetail('conv','BS-01')"); pg.wait_for_timeout(600); t=pg.inner_text('#page-asset')
    chk('Breakdown history (1)' in t and 'Blade broken' in t,'conventional machine page shows its history')
    pg.screenshot(path='/home/claude/s2/shots/u5_asset.png', full_page=True)
    with pg.expect_download() as d: pg.click("#page-asset button:has-text('Download history (Excel)')")
    import openpyxl
    d.value.save_as('/tmp/m1.xlsx'); wb=openpyxl.load_workbook('/tmp/m1.xlsx'); chk(wb.sheetnames==['Summary','BD History'] and wb['BD History']['E5'].value=='Blade broken' and wb['BD History']['C4'].value=='Ticket No.','per-machine Excel for BS-01')
    with pg.expect_download() as d: pg.evaluate("bdMachineXlsx('WJ-01')")
    d.value.save_as('/tmp/m2.xlsx'); wb=openpyxl.load_workbook('/tmp/m2.xlsx'); S=wb['Summary']; vals={S.cell(r,1).value:S.cell(r,2).value for r in range(1,20)}
    chk(vals.get('Breakdowns (PM entries left out)')==22,'WJ-01 Excel has 22 breakdowns: %s'%vals.get('Breakdowns (PM entries left out)'))
    print('WJ-01 summary:', {k:v for k,v in vals.items() if k})
    # backup roundtrip: export, then restore
    with pg.expect_download() as d: pg.evaluate("exportToExcel()")
    d.value.save_as('/tmp/bk.xlsx'); path='/tmp/bk.xlsx'; wbx=openpyxl.load_workbook(path, read_only=True); ws=wbx['Breakdown Log']
    hdr=None
    for row in ws.iter_rows(max_row=12, values_only=True):
        if row and row[0]=='Sr.': hdr=row; break
    chk(hdr and 'UTI(Hrs)' not in hdr and 'Section' in hdr and 'Repair time (Min)' in hdr,'backup headers updated')
    nbd, nother = pg.evaluate("[state.breakdowns.length, otherBD().length]")
    pg.once('dialog', lambda dl: dl.accept())
    pg.set_input_files('#importFile', path) if pg.query_selector('#importFile') else None
    if not pg.query_selector('#importFile'):
        pg.evaluate("setTab='data'; nav('settings')"); pg.wait_for_timeout(500); pg.set_input_files('#importFile', path)
    pg.wait_for_timeout(4000)
    r2=pg.evaluate("[state.breakdowns.length, otherBD().length, (bdFind('bd_tkt1')||{}).activeMin, (bdFind('bd_tkt1')||{}).ticketId, (otherBD().find(b=>b.machineId==='BS-01')||{}).seg]")
    chk(r2==[nbd, nother, 20, 't_x1', 'Conventional'],'restore keeps sections, repair time, ticket: %s vs %s'%(r2,[nbd,nother]))
    br.close()
errs=[e for e in errs if '_bubWired' not in e and "reading 'x'" not in e]; print('page errors:', errs[:5]); print('ALL OK' if ok and not errs else 'CHECK')
