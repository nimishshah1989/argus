import json, urllib.request as U, openpyxl
from playwright.sync_api import sync_playwright
B='http://localhost:8799'
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    return json.loads(U.urlopen(r).read())
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
ids=[]
for m in ['VC-1','VC-2','VC-3']:
    t=call('/api/down',{'machine':m,'problem':'Plat test '+m,'kind':'stopped'},tok=op)['ticket']; ids.append(t)
    call('/api/start',{'id':t['id']},tok=rv); call('/api/close',{'id':t['id'],'kind':'report','report':{'ca':'fixed '+m,'mid':m}},tok=rv)
g=call('/api/down',{'kind':'general','location':'Store','workType':'Electrical','problem':'Plat fan'},tok=op)['ticket']; call('/api/start',{'id':g['id']},tok=rv); call('/api/close',{'id':g['id'],'kind':'done','note':'done fan'},tok=rv)
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':1400,'height':950}, accept_downloads=True); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    def stub(route):
        u=route.request.url
        if 'xlsx' in u: route.fulfill(status=200, content_type='application/javascript', body=open('/tmp/xl/node_modules/xlsx/dist/xlsx.full.min.js').read()); return
        route.fulfill(status=200, content_type='application/javascript', body='window.Chart=function(){return {destroy(){},update(){},resize(){},scales:{x:{},y:{}}}};window.Chart.register=function(){};window.Chart.defaults={plugins:{legend:{labels:{}},tooltip:{}},font:{},scale:{grid:{}}};' if 'chart' in u.lower() else '')
    c.route('https://cdnjs.cloudflare.com/**', stub); c.route('https://cdn.jsdelivr.net/**', stub)
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(2500)
    # an entry approved earlier (has the ticket id, no number yet) -> number filled in on sync
    pg.evaluate("""(id)=>{ const s=state.settings; s.btCompany='Test Co'; s.btClientId='tst'; s.btApi='http://localhost:8799'; s.btSite='http://localhost:8787'; localStorage.setItem('bt_key_tst','k123');
       s.btPrefix={bd:'BD',wr:'WR'}; s.shiftTimes=[{name:'1',start:'08:00',end:'18:00'},{name:'2',start:'18:00',end:'06:00'}];
       const t = s.team.find(x=>x.type!=='Vendor'); t.shift='2';
       state.breakdowns.push({id:'bd_old_live',machineId:'VC-9',date:'01-11-2026',problem:'approved before numbers',downMin:30,downHrs:0.5,maintCode:'E',electMech:'E',ticketId:id}); persist(); }""", ids[0]['id'])
    pg.evaluate("lvsSync(true)"); pg.wait_for_timeout(4000)
    P=pg.evaluate("pendList().map(x=>[x.src, x.rec.ticketRef, x.at])")
    chk(len(P)==3 and all(x[1] for x in P) and ids[0]['ref'] not in [x[1] for x in P],'approvals carry ticket numbers, already-approved one not queued again: %s'%[x[1] for x in P])
    chk(pg.evaluate("(bdFind('bd_old_live')||{}).ticketRef")==ids[0]['ref'],'older approved entry got its number from the server')
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(600)
    rows=pg.eval_on_selector_all('#page-breakdowns .lvsPanel tbody tr', "r=>r.map(x=>x.cells[1].innerText.split('\\n')[0])")
    chk(rows==[ids[2]['ref'],ids[1]['ref']],'approvals newest first: %s'%rows)
    pg.once('dialog', lambda d: d.accept()); pg.click("#page-breakdowns .lvsPanel button:has-text('Approve all')"); pg.wait_for_timeout(500)
    pg.fill('#bdSearch', ids[1]['ref']); pg.dispatch_event('#bdSearch','input'); pg.wait_for_timeout(300); t=pg.inner_text('#bdTbody')
    chk(ids[1]['ref'] in t and 'VC-2' in t and t.count('\n')<=1,'Breakdown Log: Ticket No. column and search by number')
    pg.evaluate("nav('gw')"); pg.wait_for_timeout(500); pg.once('dialog', lambda d: d.accept()); pg.click("#page-gw .lvsPanel button:has-text('Approve all')"); pg.wait_for_timeout(500)
    chk(g['ref'] in pg.inner_text('#page-gw'),'General Work log shows WR number')
    # settings: prefixes + team shift
    pg.evaluate("setTab='phone'; nav('settings')"); pg.wait_for_timeout(500); chk('Ticket numbers' in pg.inner_text('#page-settings'),'prefix setting shown')
    f=pg.evaluate("btClientFile()"); chk(f['ticketPrefix']=={'bd':'BD','wr':'WR'} and len(f['shiftTimes'])==2 and list(f['teamShifts'].values())==['2'],'prefixes, shift times, usual shifts go to phones')
    pg.evaluate("setTab='company'; renderSettings()"); pg.wait_for_timeout(400); chk(pg.query_selector('#teamItems select') is not None,'usual shift selector in Team Members')
    # backup round trip keeps ticket numbers and usual shift
    with pg.expect_download() as d: pg.evaluate("exportToExcel()")
    d.value.save_as('/tmp/bk4.xlsx'); wb=openpyxl.load_workbook('/tmp/bk4.xlsx', read_only=True)
    hdr=[r for r in wb['Breakdown Log'].iter_rows(max_row=12, values_only=True) if r and r[0]=='Sr.'][0]; chk('Ticket No.' in hdr,'backup has Ticket No.')
    chk(any(r and r[0]=='Team Members' and len(r)>3 and r[3]=='Usual shift' for r in wb['Settings'].iter_rows(values_only=True)),'backup has usual shift')
    pg.evaluate("setTab='data'; nav('settings')"); pg.wait_for_timeout(400); pg.once('dialog', lambda dl: dl.accept()); pg.set_input_files('#importFile','/tmp/bk4.xlsx'); pg.wait_for_timeout(4500)
    r=pg.evaluate("[(bdFind('bd_old_live')||{}).ticketRef, state.settings.team.find(x=>x.type!=='Vendor').shift]"); chk(r==[ids[0]['ref'],'2'],'restore keeps ticket number and usual shift: %s'%r)
    with pg.expect_download() as d: pg.evaluate("bdMachineXlsx('VC-2')")
    d.value.save_as('/tmp/m4.xlsx'); ws=openpyxl.load_workbook('/tmp/m4.xlsx')['BD History']; chk(ws['C4'].value=='Ticket No.' and any(ws.cell(r,3).value==ids[1]['ref'] for r in range(5,ws.max_row+1)),'per-machine Excel has Ticket No.')
    br.close()
print('errors', [e for e in errs if '_bubWired' not in e and "reading 'x'" not in e]); print('ALL OK' if ok else 'FAIL')
