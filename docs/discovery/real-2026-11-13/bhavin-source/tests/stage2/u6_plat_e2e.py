import json, urllib.request as U, datetime as dt
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
    return json.loads(U.urlopen(r).read())
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
long='Spindle making a grinding noise at high rpm, coolant leaking near the turret, operator says it started after the night shift changed the tool; checked belts and found one cracked, also cleaned the chip conveyor which was jammed with long chips '*2
ids=[]
for m in ['VC-1','VC-2']:
    t=call('/api/down',{'machine':m,'problem':long if m=='VC-1' else 'Plat edit '+m,'kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':t['id']},tok=rv); call('/api/close',{'id':t['id'],'kind':'report','report':{'ca':'fixed '+m}},tok=rv); ids.append(t)
g=call('/api/down',{'kind':'general','location':'Store','workType':'Electrical','problem':'Fan not working'},tok=op)['ticket']; call('/api/start',{'id':g['id']},tok=rv); call('/api/close',{'id':g['id'],'kind':'done','note':'fan fixed'},tok=rv)
def back(id, h): return call('/api/edit',{'id':id,'downAt':(dt.datetime.now(dt.UTC)-dt.timedelta(hours=h)).isoformat(),'reason':'setup'},key='k123')
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':1400,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    def stub(route):
        u=route.request.url
        route.fulfill(status=200, content_type='application/javascript', body='window.Chart=function(){return {destroy(){},update(){},resize(){},scales:{x:{},y:{}}}};window.Chart.register=function(){};window.Chart.defaults={plugins:{legend:{labels:{}},tooltip:{}},font:{},scale:{grid:{}}};' if 'chart' in u.lower() else '')
    c.route('https://cdnjs.cloudflare.com/**', stub); c.route('https://cdn.jsdelivr.net/**', stub)
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(2500)
    pg.evaluate("""()=>{ const s=state.settings; s.btCompany='Test Co'; s.btClientId='tst'; s.btApi='http://localhost:8799'; s.btSite='http://localhost:8787'; localStorage.setItem('bt_key_tst','k123'); persist(); }""")
    pg.evaluate("lvsSync(true)"); pg.wait_for_timeout(4000)
    chk(pg.evaluate("pendList().length")==3,'3 waiting for approval')
    # ---- layout: buttons first, long text clamped, no sideways scroll needed for the buttons
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(700)
    first=pg.eval_on_selector('#page-breakdowns .lvsPanel tbody tr td', "td=>td.innerText")
    chk('Approve' in first and 'Reject' in first and 'Edit' in first,'Approve/Edit/Reject in the first column')
    bx=pg.eval_on_selector("#page-breakdowns .lvsPanel tbody tr button:has-text('Reject')", "b=>{const r=b.getBoundingClientRect(); return [r.right, window.innerWidth]}")
    chk(bx[0] < 400,'buttons visible at the left without scrolling (x=%d)'%bx[0])
    hgt=pg.eval_on_selector_all('#page-breakdowns .lvsPanel tbody tr', "r=>r.map(x=>x.getBoundingClientRect().height)")
    chk(max(hgt) < 110,'long problem text clamped, rows stay short: %s'%[int(x) for x in hgt])
    pg.screenshot(path=OUT+'p1_approvals.png', clip={'x':0,'y':0,'width':1400,'height':900})
    # ---- General Work: edit while waiting, then approve, then edit in the log
    pg.evaluate("nav('gw')"); pg.wait_for_timeout(600)
    pg.click("#page-gw .lvsPanel tbody button:has-text('Edit')"); pg.wait_for_timeout(300)
    pg.fill('#gw_min','45'); pg.fill('#gw_done','Fan capacitor replaced'); pg.click("#modalBox button:has-text('Save')"); pg.wait_for_timeout(300)
    chk('Fan capacitor replaced' in pg.inner_text('#page-gw .lvsPanel'),'GW waiting entry edited before approval')
    pg.click("#page-gw .lvsPanel tbody button:has-text('Approve')"); pg.wait_for_timeout(500)
    r=pg.evaluate("gwLog().map(x=>[x.activeMin,x.done,x.ticketRef])"); chk(r==[[45,'Fan capacitor replaced',g['ref']]],'approved with the edited values: %s'%r)
    pg.click("#page-gw tr.bdrow"); pg.wait_for_timeout(300); pg.click("#modalBox button:has-text('Edit')"); pg.wait_for_timeout(300); pg.fill('#gw_loc','Main store'); pg.fill('#gw_prob',''); pg.click("#modalBox button:has-text('Save')"); pg.wait_for_timeout(300)
    chk(pg.evaluate("gwLog()[0].location")=='Store','empty job refused, nothing saved')
    pg.fill('#gw_prob','Ceiling fan not working'); pg.click("#modalBox button:has-text('Save')"); pg.wait_for_timeout(300)
    chk(pg.evaluate("[gwLog()[0].location,gwLog()[0].problem]")==['Main store','Ceiling fan not working'],'GW log entry edited')
    # ---- approve VC-1, leave VC-2 waiting
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(500)
    pg.evaluate("(id)=>pendApprove(pendList().find(x=>x.ticketId===id).id)", ids[0]['id']); pg.wait_for_timeout(500)
    if pg.query_selector('#modalBox:visible'): pass
    chk(pg.evaluate("(id)=>!!bdAll().find(b=>b.ticketId===id)", ids[0]['id']),'VC-1 approved into the log')
    # ---- admin corrects both on the phone (here via the server)
    back(ids[0]['id'],3); back(ids[1]['id'],2); back(g['id'],2)
    pg.evaluate("lvsSync(true)"); pg.wait_for_timeout(4000)
    P=pg.evaluate("pendList().map(x=>[x.src,x.ticketId,!!x.edited])")
    chk(sum(1 for x in P if x[0]=='edit')==2,'approved VC-1 and approved GW come back as Edited items: %s'%P)
    chk(any(x[1]==ids[1]['id'] and x[0]!='edit' and x[2] for x in P),'waiting VC-2 updated in place, marked edited')
    dm=pg.evaluate("(id)=>pendList().find(x=>x.ticketId===id&&x.src!=='edit').rec.downMin", ids[1]['id']); chk(dm>=119,'waiting VC-2 downtime now ~2 h: %s'%dm)
    chk(pg.evaluate("Object.keys(state.editSeen).length")==3,'edits remembered')
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(500); t=pg.inner_text('#page-breakdowns .lvsPanel')
    chk('Edited on phone' in t and 'Reason: setup' in t and '→' in t,'Edited item shows old → new and reason')
    chk(pg.query_selector("#page-breakdowns .lvsPanel button:has-text('Approve all')") is None or pg.evaluate("pendList().filter(x=>x.src==='edit').length")==2,'ok')
    pg.screenshot(path=OUT+'p2_edited.png')
    # Approve all must not swallow edit items
    pg.once('dialog', lambda d: d.accept()); b=pg.query_selector("#page-breakdowns .lvsPanel button:has-text('Approve all')")
    if b: b.click(); pg.wait_for_timeout(600)
    chk(pg.evaluate("pendList().filter(x=>x.src==='edit').length")==2,'Approve all leaves Edited items alone')
    # accept the CNC correction
    pg.click("#page-breakdowns .lvsPanel button:has-text('Accept')"); pg.wait_for_timeout(500)
    r=pg.evaluate("(id)=>{const b=bdAll().find(b=>b.ticketId===id); return [b.downMin, b.editNote]}", ids[0]['id'])
    chk(r[0]>=179 and 'setup' in r[1],'accepted: VC-1 downtime ~3 h, note kept: %s'%r)
    # reject the GW correction
    pg.evaluate("nav('gw')"); pg.wait_for_timeout(500); pg.once('dialog', lambda d: d.accept()); pg.click("#page-gw .lvsPanel button:has-text('Reject')"); pg.wait_for_timeout(500)
    chk(pg.evaluate("pendList().filter(x=>x.src==='edit').length")==0 and pg.evaluate("gwLog()[0].location")=='Main store','GW correction rejected, log unchanged')
    # next check does not bring them back; 12-hour gap respected
    pg.evaluate("lvsSync(true)"); pg.wait_for_timeout(3500); chk(pg.evaluate("pendList().filter(x=>x.src==='edit').length")==0,'no repeats after a fresh check')
    chk(pg.evaluate("lvsCheckEdits(false)")==0,'automatic check waits 12 hours')
    n=[]; pg.on('request', lambda q: n.append(q.url) if '/api/edits' in q.url else None); pg.evaluate("lvsSync(false)"); pg.wait_for_timeout(3000); chk(len(n)==0,'normal sync does not call /api/edits')
    br.close()
errs=[e for e in errs if '_bubWired' not in e]; print('errors', errs); print('ALL OK' if ok and not errs else 'FAIL')
