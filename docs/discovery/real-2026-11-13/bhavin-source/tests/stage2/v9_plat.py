# portal: section tabs, simpler table, eye window (Breakdown + General Work), order, fixed serial numbers per section, source labels,
# badges, Done by / Supported by chips, phone data (who joined, machine running again, follow-up), backup round trip
import json, urllib.request as U, datetime as dt, openpyxl
from playwright.sync_api import sync_playwright
B='http://localhost:8799'; OUT='/home/claude/s2/shots/'
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None, key=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    if key: h['X-Key']=key
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try: return json.loads(U.urlopen(r).read())
    except U.HTTPError as e: return {'status':e.code, **json.loads(e.read() or b'{}')}
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123'); am=lg('amit','amit123')
# a phone ticket with someone who joined as support, machine running again, then closed with a report
t=call('/api/down',{'machine':'VC-1','problem':'Spindle alarm two person job','kind':'stopped'},tok=op)['ticket']; I=t['id']; call('/api/start',{'id':I},tok=rv)
call('/api/join',{'id':I,'role':'support'},tok=am); call('/api/running',{'id':I},tok=rv)
call('/api/close',{'id':I,'kind':'report','report':{'ca':'Encoder cable replaced','db':'Ravi','sb':'Amit','mid':'VC-1'}},tok=rv)
g=call('/api/down',{'kind':'general','location':'Store','workType':'Electrical','problem':'Tube light'},tok=op)['ticket']; call('/api/start',{'id':g['id']},tok=rv); call('/api/join',{'id':g['id'],'role':'support'},tok=am); call('/api/close',{'id':g['id'],'kind':'done','note':'Changed'},tok=rv)
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':1400,'height':950}, accept_downloads=True); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)) if '_bubWired' not in str(e) and "reading 'x'" not in str(e) else None)
    CH='window.Chart=function(){return {destroy(){},update(){},resize(){},scales:{x:{},y:{}}}};window.Chart.register=function(){};window.Chart.defaults={plugins:{legend:{labels:{}},tooltip:{}},font:{},scale:{grid:{}}};'
    def stub(route):
        u=route.request.url
        if 'xlsx' in u: route.fulfill(status=200, content_type='application/javascript', body=open('/tmp/xl/node_modules/xlsx/dist/xlsx.full.min.js').read()); return
        route.fulfill(status=200, content_type='application/javascript', body=CH if 'chart' in u.lower() else '')
    c.route('https://cdnjs.cloudflare.com/**', stub); c.route('https://cdn.jsdelivr.net/**', stub)
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(2500)
    # serial numbers: CNC keeps the numbers it had; other sections get their own series
    before=pg.evaluate("(()=>{ const m = computeChronoSrNoMap(); return state.breakdowns.map(b=>m.get(b.id)); })()")
    pg.evaluate("""()=>{ const cm = (state.convMachines||[]).map(m=>m.id), um = (state.utilMachines||[]).map(m=>m.id);
      [['Conventional',cm[0],'15-10-2026','1'],['Conventional',cm[1]||cm[0],'02-11-2026','2'],['Conventional',cm[0],'02-11-2026','1'],['Utility',um[0],'20-10-2026','1'],['Utility',um[1]||um[0],'01-09-2026','1']]
        .forEach(([seg, mid, d, sh], i)=>otherBD().push({id:'bd_t'+i, machineId:mid, seg, date:d, shift:sh, problem:'Test '+seg+' '+i, doneBy:'Ravi', downMin:30, downHrs:0.5, maintCode:'E'})); persist(); }""")
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(800)
    order=pg.evaluate("['bd_t4','bd_t3','bd_t0','bd_t1','bd_t2'].map(id=>srLabel(bdFind(id)))"); chk(order==['U-1','U-2','C-1','C-2','C-3'],'other sections numbered by date: %s'%order)
    after=pg.evaluate("state.breakdowns.map(b=>b.srNo)"); chk(before==after and pg.evaluate("state.srInit")==True,'CNC entries keep the serial numbers they had (%d entries)'%len(after))
    seg=pg.evaluate("(()=>{ const o={}; otherBD().forEach(b=>{ (o[b.seg]=o[b.seg]||[]).push(b.srNo); }); return Object.fromEntries(Object.entries(o).map(([k,v])=>[k,[v.length, Math.min(...v), Math.max(...v), new Set(v).size]])); })()")
    chk(all(v[1]==1 and v[2]==v[0] and v[3]==v[0] for v in seg.values()),'each other section numbered 1..n, no gaps or repeats: %s'%seg)
    chk(pg.evaluate("srLabel(otherBD().find(b=>b.seg==='Utility'))").startswith('U-') and pg.evaluate("srLabel(otherBD().find(b=>b.seg==='Conventional'))").startswith('C-'),'labels U-n (Utility), C-n (Conventional)')
    # tabs
    tabs=pg.eval_on_selector_all('#bdTabs .bdtab', "b=>b.map(x=>x.innerText.replace(/\\n/g,' '))"); chk(tabs[0].startswith('CNC') and any(x.startswith('Conventional') for x in tabs) and any(x.startswith('Utilit') for x in tabs),'section tabs: %s'%tabs)
    hdr=pg.eval_on_selector_all('#bdThead th', "h=>h.map(x=>x.innerText.trim())"); chk(hdr==['','SR NO','TICKET NO.','DATE','SHIFT','MACHINE','PROBLEM','DONE BY','DOWNTIME (HRS)','CODE'] or [h.upper() for h in hdr]==['','SR NO','TICKET NO.','DATE','SHIFT','MACHINE','PROBLEM','DONE BY','DOWNTIME (HRS)','CODE'],'simpler columns: %s'%hdr)
    rows=pg.evaluate("[...document.querySelectorAll('#bdTbody tr')].slice(0,40).map(r=>[r.cells[3].innerText, r.cells[4].innerText])")
    key=lambda r:(r[0].split('-')[::-1], int(''.join(ch for ch in r[1] if ch.isdigit()) or 0))
    chk(all(key(rows[i])>=key(rows[i+1]) for i in range(len(rows)-1)),'order: newest date first, later shift first')
    pg.click("#bdTabs .bdtab:has-text('Conventional')"); pg.wait_for_timeout(400)
    secs=pg.evaluate("[...document.querySelectorAll('#bdTbody tr')].map(r=>r.cells[1].innerText)"); chk(len(secs)>0 and all(x.startswith('C-') for x in secs),'Conventional tab shows only Conventional entries (C-n)')
    chk('Excel' in pg.inner_text('#bdTbody'),'entries without a ticket show their source (Excel)')
    pg.screenshot(path=OUT+'v9_bdlog.png')
    # manual entry: next number in its section, source Manual
    nC=pg.evaluate("Math.max(...otherBD().filter(b=>b.seg==='Conventional').map(b=>b.srNo))"); mid=pg.evaluate("(state.convMachines||[])[0].id")
    pg.evaluate("""(mid)=>{ openBreakdownForm(); document.getElementById('f_machineId').value=mid; document.getElementById('f_date').value='2025-01-05'; document.getElementById('f_problem').value='Old dated manual entry'; }""", mid)
    N1,N2=pg.evaluate("activeTeam().slice(0,2).map(t=>t.name)")
    pg.select_option('#pfChDone select',N1); pg.wait_for_timeout(100); pg.select_option('#pfChSupp select',N2); pg.wait_for_timeout(100)
    pg.screenshot(path=OUT+'v9_form_chips.png'); pg.click("#modalBox button:has-text('Save Entry')"); pg.wait_for_timeout(500)
    e=pg.evaluate("(()=>{ const b = otherBD().find(b=>b.problem==='Old dated manual entry'); return [b.srNo, srLabel(b), bdSrc(b), b.doneBy, b.supportedBy]; })()")
    chk(e[0]==nC+1 and e[2]=='Manual' and e[3]==N1 and e[4]==N2,'new (older-dated) entry takes the next number C-%d, not renumbering; Manual; chips saved: %s'%(nC+1, e))
    chk(pg.evaluate("Math.max(...otherBD().filter(b=>b.seg==='Conventional' && b.problem!=='Old dated manual entry').map(b=>b.srNo))")==nC,'existing numbers unchanged')
    # eye window
    pg.click("#bdTbody tr:has-text('Old dated manual entry')"); pg.wait_for_timeout(400); v=pg.inner_text('#modalBox')
    chk('Old dated manual entry' in v and 'Manual' in v and 'C-%d'%(nC+1) in v and N1 in v and N2 in v,'eye window: all details, source, serial, people')
    pg.click("#modalBox button:has-text('Edit')"); pg.wait_for_timeout(400)
    chk(pg.evaluate("[PCH.done.join(','), PCH.supp.join(',')]")==[N1,N2],'Edit from the window opens the form with the chips')
    pg.select_option('#pfChDone select',N2); pg.wait_for_timeout(100); chk(pg.evaluate("[PCH.done.join(','), PCH.supp.join(',')]")==[N1+','+N2,''],'picking the supporter in Done by moves them out of Supported by')
    pg.click("#modalBox button:has-text('Update Entry')"); pg.wait_for_timeout(400)
    pg.click("#bdTbody tr:has-text('Old dated manual entry') .eyeb"); pg.wait_for_timeout(300)
    pg.once('dialog', lambda d: d.accept()); pg.click("#modalBox button:has-text('Delete')"); pg.wait_for_timeout(400)
    chk(pg.evaluate("!otherBD().some(b=>b.problem==='Old dated manual entry')") and not pg.is_visible('#modalBox .modal-head'),'Delete from the window removes it and closes the window')
    # phone tickets: approval, badges, who joined, follow-up, phone history
    pg.evaluate("""()=>{ const s=state.settings; s.btCompany='Test Co'; s.btClientId='tst'; s.btApi='http://localhost:8799'; s.btSite='http://localhost:8787'; localStorage.setItem('bt_key_tst','k123'); persist(); }""")
    pg.evaluate("lvsSync(true)"); pg.wait_for_timeout(4000)
    chk(pg.inner_text('#pendBadge')=='1' and pg.inner_text('#gwBadge')=='1','badges: Breakdown Log 1, General Work 1 (counted separately)')
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(500); pg.click("#page-breakdowns .lvsPanel tbody button:has-text('Approve')"); pg.wait_for_timeout(500)
    chk(not pg.is_visible('#pendBadge') and pg.inner_text('#gwBadge')=='1','after approving the breakdown: its badge goes, General Work badge stays')
    r=pg.evaluate("(id)=>{ const b = bdAll().find(b=>b.ticketId===id); return [b.doneBy, b.supportedBy, b.followMin, !!b.runningAt, srLabel(b), b.ticketRef]; }", I)
    chk(r[0]=='Ravi' and r[1]=='Amit' and r[2] is not None and r[3] and r[4]!='—','approved phone entry: Done by Ravi, Supported by Amit, follow-up kept, serial given: %s'%r)
    pg.click("#bdTabs .bdtab:has-text('CNC')"); pg.wait_for_timeout(300)
    chk(pg.evaluate("document.querySelector('#bdTbody tr').cells[2].innerText")==t['ref'],'newest entry on top with its ticket number')
    pg.click("#bdTbody tr .eyeb"); pg.wait_for_timeout(2500); v=pg.inner_text('#modalBox')
    chk('History from the phones' in v and 'Joined' in v and 'Machine running again' in v and 'follow-up' in v.lower() and 'Amit (support)' in v,'eye window: phone history (joined, running again), follow-up, who worked with role')
    pg.screenshot(path=OUT+'v9_eye.png'); pg.click("#modalBox button:has-text('Close')")
    # General Work: eye window
    pg.evaluate("nav('gw')"); pg.wait_for_timeout(500); pg.click("#page-gw .lvsPanel tbody button:has-text('Approve')"); pg.wait_for_timeout(500)
    chk(not pg.is_visible('#gwBadge'),'General Work badge clears after approving')
    w=pg.evaluate("gwLog()[0]"); chk(w['doneBy']=='Ravi' and w['supportedBy']=='Amit','work request: Done by Ravi, Supported by Amit (from who joined)')
    gh=pg.eval_on_selector_all('#page-gw table:not(.lvsPanel table) thead th', "h=>h.map(x=>x.innerText.trim().toUpperCase())")
    chk('WHAT WAS DONE' not in gh and 'RAISED BY' not in gh and gh[0]=='','General Work table simpler: %s'%gh)
    pg.click("#page-gw tr.bdrow"); pg.wait_for_timeout(2000); v=pg.inner_text('#modalBox'); chk('Tube light' in v and 'Changed' in v and 'Supported by' in v.replace('SUPPORTED BY','Supported by') and 'Joined' in v,'General Work eye window with history')
    pg.click("#modalBox button:has-text('Edit')"); pg.wait_for_timeout(300); chk(pg.is_visible('#gw_loc'),'Edit from the General Work window opens its form'); pg.click("#modalBox button:has-text('Cancel')")
    # backup round trip keeps the fixed numbers and sources
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(300)
    with pg.expect_download() as d: pg.evaluate("exportToExcel()")
    d.value.save_as('/tmp/bk9.xlsx'); wb=openpyxl.load_workbook('/tmp/bk9.xlsx', read_only=True); rws=[r for r in wb['Breakdown Log'].iter_rows(values_only=True)]
    h=[r for r in rws if r and r[0]=='Sr.'][0]; chk('Source' in h,'backup has Source column')
    chk(any(r and str(r[0]).startswith('U-') for r in rws),'backup Sr. column has U-n labels')
    snap=pg.evaluate("bdAll().map(b=>[b.id, srLabel(b), bdSrc(b)]).sort()")
    pg.evaluate("setTab='data'; nav('settings')"); pg.wait_for_timeout(400); pg.once('dialog', lambda dl: dl.accept()); pg.set_input_files('#importFile','/tmp/bk9.xlsx'); pg.wait_for_timeout(5000)
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(600)
    snap2=pg.evaluate("bdAll().map(b=>[b.id, srLabel(b), bdSrc(b)]).sort()"); chk(snap==snap2,'restore keeps every serial number and source (%d entries)'%len(snap2))
    br.close()
print('errors', errs); print('ALL OK' if ok and not errs else 'FAIL')
