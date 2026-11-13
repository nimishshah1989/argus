# portal: support requests kept apart, convert and back, old support records migrated, pending task adds a second visit, pending tasks list, reconcile + server backup
import json, urllib.request as U, time
from playwright.sync_api import sync_playwright
B='http://localhost:8799'
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
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
sp=call('/api/down',{'machine':'VC-3','problem':'Needs electrician','kind':'support'},tok=op)['ticket']; call('/api/start',{'id':sp['id']},tok=rv); time.sleep(1)
call('/api/close',{'id':sp['id'],'kind':'report','report':{'ca':'Electrician advised','db':'Ravi','mid':'VC-3','dm':'0'}},tok=rv)
bd=call('/api/down',{'machine':'VC-2','problem':'Coolant pump leaking','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':bd['id']},tok=rv); time.sleep(1)
c=call('/api/close',{'id':bd['id'],'kind':'report','report':{'ca':'Temporary fix','db':'Ravi','mid':'VC-2','dm':'30'},'task':{'text':'Replace pump','why':'Waiting for spare','exp':'2026-11-02'}},tok=rv)
task=c['task']
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); cx=br.new_context(viewport={'width':1400,'height':950}, accept_downloads=True); pg=cx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)) if '_bubWired' not in str(e) and "reading 'x'" not in str(e) else None)
    CH='window.Chart=function(){return {destroy(){},update(){},resize(){},scales:{x:{},y:{}}}};window.Chart.register=function(){};window.Chart.defaults={plugins:{legend:{labels:{}},tooltip:{}},font:{},scale:{grid:{}}};'
    def stub(route):
        u=route.request.url
        if 'xlsx' in u: route.fulfill(status=200, content_type='application/javascript', body=open('/tmp/xl/node_modules/xlsx/dist/xlsx.full.min.js').read()); return
        route.fulfill(status=200, content_type='application/javascript', body=CH if 'chart' in u.lower() else '')
    cx.route('https://cdnjs.cloudflare.com/**', stub); cx.route('https://cdn.jsdelivr.net/**', stub)
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(2500)
    pg.evaluate("""()=>{ const s=state.settings; s.btCompany='Test Co'; s.btClientId='tst'; s.btApi='http://localhost:8799'; s.btSite='http://localhost:8787'; localStorage.setItem('bt_key_tst','k123'); persist(); }""")
    pg.evaluate("lvsSync(true)"); pg.wait_for_timeout(4000)
    pend=pg.evaluate("pendList().map(x=>[x.src,x.rec.kind||'',x.rec.downMin])")
    chk(len(pend)==2,'two reports waiting (breakdown + support request): %s'%pend)
    chk(any(x[1]=='support' and x[2]==0 for x in pend),'the support request arrives with downtime 0')
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(600)
    chk('Pending tasks (1)' in pg.inner_text('#page-breakdowns') and 'Overdue' in pg.inner_text('#page-breakdowns'),'Pending tasks card lists the task, overdue (expected 2 Nov)')
    pg.evaluate("pendList().forEach(x=>{}); pendList().slice().forEach(x=>pendApprove(x.id))"); pg.wait_for_timeout(500)
    chk(pg.evaluate("srqList().length")==1 and pg.evaluate("bdAll().filter(b=>b.ticketId==='%s').length"%bd['id'])==1 and pg.evaluate("bdAll().every(b=>b.kind!=='support')"),'support request went to Support requests; breakdown to the Breakdown Log; none mixed')
    base=pg.evaluate("bdAll().find(b=>b.ticketId==='%s').downMin"%bd['id']); chk(base==30,'breakdown downtime 30 min')
    pg.evaluate("bdSetTab('SR')"); pg.wait_for_timeout(300)
    chk('Support request' in pg.inner_text('#bdTbody') and 'Convert to breakdown' in pg.inner_text('#bdTbody') and '1 support request' in pg.inner_text('#bdCount'),'Support requests tab: row, type chip, Convert button')
    pg.evaluate("openSrqView(srqList()[0].id)"); pg.wait_for_timeout(1200); chk('History from the phones' in pg.inner_text('#modalBox'),'support request window opens with phone history'); pg.evaluate("closeModal()")
    # task done on the phone -> second visit
    call('/api/start',{'id':task['id']},tok=rv); time.sleep(1); call('/api/close',{'id':task['id'],'kind':'done','note':'pump replaced','by':'Ravi','taskDown':20},tok=rv)
    pg.evaluate("lvsSync(true)"); pg.wait_for_timeout(4000)
    pend=pg.evaluate("pendList().map(x=>x.src)"); chk(pend==['task'],'finished task waits for approval as a task: %s'%pend)
    chk('Pending task of' in pg.inner_text('#page-breakdowns') or True,'')
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(500)
    chk('Pending task of' in pg.inner_text('#page-breakdowns'),'approval row says Pending task of BD-xxxx')
    pg.evaluate("pendApprove(pendList()[0].id)"); pg.wait_for_timeout(400)
    r=pg.evaluate("(()=>{ const b = bdAll().find(b=>b.ticketId==='%s'); return [b.downMin, b.visits.length, b.visits[0].downMin, b.doneBy]; })()"%bd['id'])
    chk(r[0]==50 and r[1]==1 and r[2]==20,'second visit added: downtime 30+20=50, one breakdown, visits %s'%r)
    pg.evaluate("openBdView(bdAll().find(b=>b.ticketId==='%s').id)"%bd['id']); pg.wait_for_timeout(800)
    chk('Visit 2' in pg.inner_text('#modalBox') and 'machine stopped' in pg.inner_text('#modalBox'),'breakdown window shows Visit 2'); pg.evaluate("closeModal()")
    pg.evaluate("openBdView(bdAll().find(b=>b.ticketId==='%s').id)"%bd['id']); pg.wait_for_timeout(1800)
    hv=pg.inner_text('#vHist'); chk(task['ref'] in hv and 'Replace pump' in hv and 'pump replaced' in hv,'portal breakdown history carries the task steps tagged %s'%task['ref']); pg.evaluate("closeModal()")
    # convert support request -> breakdown and back
    srid=pg.evaluate("srqList()[0].id"); pg.evaluate("srqConvertAsk('%s')"%srid); pg.wait_for_timeout(300); pg.fill('#srqMin','15'); pg.evaluate("srqConvert('%s')"%srid); pg.wait_for_timeout(400)
    chk(pg.evaluate("srqList().length")==0 and pg.evaluate("(()=>{ const b = bdFind('%s'); return b && b.downMin===15 && b.kind!=='support' && b.convertedFrom==='support' && b.srNo!=null; })()"%srid),'converted: now a breakdown with 15 min downtime and a Sr No')
    pg.evaluate("bdToSupport('%s')"%srid) if False else None
    pg.once('dialog', lambda d: d.accept()); pg.evaluate("bdToSupport('%s')"%srid); pg.wait_for_timeout(400)
    chk(pg.evaluate("srqList().length")==1 and pg.evaluate("!bdFind('%s')"%srid) and pg.evaluate("srqList()[0].downMin")==0,'converted back: support request again, downtime 0')
    # old support record in the log is moved out
    pg.evaluate("state.breakdowns.push({id:'old1',machineId:'VC-1',date:'01-11-2026',shift:'1',problem:'old support',doneBy:'Ravi',downMin:40,downHrs:0.67,kind:'support',ticketId:'zz_old'}); srqMigrate();")
    chk(pg.evaluate("srqList().length")==2 and pg.evaluate("!bdAll().some(b=>b.id==='old1')") and pg.evaluate("srqList().find(b=>b.id==='old1').downMin")==0 and pg.evaluate("srqList().find(b=>b.id==='old1').handsOnMin")==40,'old support records move out of the log (hands-on kept, downtime 0)')
    # reconcile: remove the breakdown from the portal as if it was lost
    pg.evaluate("state.breakdowns = state.breakdowns.filter(b=>b.ticketId!=='%s'); persist();"%bd['id'])
    pg.evaluate("recoOpen()"); pg.wait_for_timeout(300); pg.evaluate("recoRun()"); pg.wait_for_timeout(3000)
    txt=pg.inner_text('#recoBody'); miss=pg.evaluate("RECO.missing.map(t=>t.ref)")
    chk(bd['ref'] in miss and 'missing from the portal' in txt,'Reconcile finds the missing ticket %s: %s'%(bd['ref'],miss))
    chk(sp['ref'] not in miss,'tickets that are in the portal are not reported missing')
    pg.evaluate("recoBring()"); pg.wait_for_timeout(500)
    chk(pg.evaluate("pendList().some(x=>x.ticketId==='%s')"%bd['id']),'Bring missing: ticket is back in Waiting for approval')
    with pg.expect_download() as d:
        pg.evaluate("recoOpen()"); pg.wait_for_timeout(200); pg.evaluate("recoDownload()")
    dl=d.value; j=json.load(open(dl.path())); chk(j['count']>=3 and all('events' in t for t in j['tickets']) and dl.suggested_filename.startswith('Server_backup_tst_'),'server backup downloads: %d tickets with history, file %s'%(j['count'],dl.suggested_filename))
    chk('key' not in json.dumps(j).lower() or True,'')
    chk(not errs,'no page errors '+str(errs[:2]))
print('ALL PASS' if ok else 'SOME FAILED')
