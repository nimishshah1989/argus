# phone: join this work (primary / support), add a person, leave, who can close; machine running again / stopped again;
# report form Done by / Supported by chips filled from who joined; closed list cards + person dropdown + month line; WhatsApp full report
import json, urllib.request as U, datetime as dt
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'; OUT='/home/claude/s2/shots/'
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
call('/api/users',dict(username='kiran',name='Kiran',role='maint',password='kiran1'),key='k123')
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
t=call('/api/down',{'machine':'VC-1','problem':'Spindle change, two person job','kind':'stopped'},tok=op)['ticket']; I=t['id']; call('/api/start',{'id':I},tok=rv)
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch()
    def phone(u,pw):
        c=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id='Asia/Kolkata', accept_downloads=True); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(u+': '+str(e)))
        c.route('https://wa.me/**', lambda r: r.fulfill(status=200, body='wa'))
        pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU',u); pg.fill('#lvP',pw); pg.click('#lvGo'); pg.wait_for_timeout(1800); return c,pg
    # Amit joins as support from the ticket details
    ca,am=phone('amit','amit123'); am.evaluate("sheetDetail(%s)"%json.dumps(I)); am.wait_for_timeout(1500)
    chk(am.query_selector('#lvSheet [data-a="joinask"]') is not None and am.query_selector('#lvSheet [data-a="toclose"]') is None,'Amit (not on the job): Join this work, no close button')
    am.eval_on_selector('#lvSheet [data-a="joinask"]','b=>b.scrollIntoView({block:"center"})'); am.click('#lvSheet [data-a="joinask"]'); am.wait_for_timeout(300)
    chk(am.query_selector('#lvjn') is None and 'Join as primary' in am.inner_text('#lvSheet') and 'Act as support' in am.inner_text('#lvSheet'),'join sheet: primary / support, no name picker for a personal login')
    am.click('[data-a="jrole"][data-v="support"]'); am.wait_for_timeout(200); am.screenshot(path=OUT+'v9_join.png')
    am.click('[data-a="joingo"]'); am.wait_for_timeout(1800)
    x=call('/api/ticket?id='+I,tok=rv)['ticket']; chk([(c['name'],c['role']) for c in x['crew']]==[('Amit','support')],'server: Amit on the job as support')
    am.evaluate("go('mine')"); am.wait_for_timeout(600); m=am.inner_text('#lvBody')
    chk('Joined as support' in m and 'VC-1' in m,'Amit Mine: shows the job, Joined as support')
    chk(am.query_selector('[data-a="toclose"][data-v="%s"]'%I) is None and am.query_selector('[data-a="leaveask"][data-v="%s"]'%I) is not None,'support: no close button, Leave this work shown')
    # Ravi (running it) adds Kiran as primary
    cr,rp=phone('ravi','ravi123'); rp.evaluate("go('mine')"); rp.wait_for_timeout(600)
    chk('Amit' in rp.inner_text('#lvBody') and 'support' in rp.inner_text('#lvBody'),'Ravi Mine card shows Amit (support) on the job')
    rp.click('[data-a="joinask"][data-v="%s"]'%I); rp.wait_for_timeout(300)
    chk('Add a person' in rp.inner_text('#lvSheet') and rp.query_selector('#lvjn') is not None,'Ravi: Add a person, with a name picker')
    opts=rp.eval_on_selector('#lvjn',"e=>[...e.options].map(o=>o.value).filter(Boolean)"); chk('Ravi' not in opts and 'Amit' not in opts,'picker leaves out people already on the job')
    rp.select_option('#lvjn','Kiran'); rp.click('[data-a="joingo"]'); rp.wait_for_timeout(1800)
    x=call('/api/ticket?id='+I,tok=rv)['ticket']; chk(('Kiran','primary') in [(c['name'],c['role']) for c in x['crew']],'Kiran added as primary')
    # Team tab lists everyone under their own name
    rp.evaluate("go('team')"); rp.wait_for_timeout(600); tt=rp.inner_text('#lvBody'); chk('Kiran' in tt and 'Amit' in tt and 'support' in tt and 'primary' in tt,'Team tab: Amit (support) and Kiran (primary) listed under their names')
    # machine running again
    rp.evaluate("go('mine')"); rp.wait_for_timeout(500); rp.click('[data-a="runask"][data-v="%s"]'%I); rp.wait_for_timeout(300)
    rp.screenshot(path=OUT+'v9_run.png'); rp.click('[data-a="rungo"]'); rp.wait_for_timeout(1800)
    x=call('/api/ticket?id='+I,tok=rv)['ticket']; chk(x['runningAt'] and x['status']=='working','server: machine running, ticket still in progress')
    b=rp.inner_text('#lvBody'); chk('Machine running' in b and 'running since' in b.lower() and rp.query_selector('[data-a="stopask"][data-v="%s"]'%I) is not None,'card: Machine running chip, running since, Machine stopped again button')
    rp.evaluate("go('live')"); rp.wait_for_timeout(600); chk(rp.query_selector('.lvtile.t-follow') is not None and 'FOLLOW-UP' in rp.inner_text('.lvtile.t-follow'),'Live tile amber: FOLLOW-UP')
    rp.screenshot(path=OUT+'v9_live.png')
    # stopped again, then running again
    rp.evaluate("go('mine')"); rp.wait_for_timeout(400); rp.click('[data-a="stopask"][data-v="%s"]'%I); rp.wait_for_timeout(300); rp.click('[data-a="stopgo"]'); rp.wait_for_timeout(1500)
    x=call('/api/ticket?id='+I,tok=rv)['ticket']; chk(not x['runningAt'] and x['stopAt'],'stopped again from the phone')
    rp.click('[data-a="runask"][data-v="%s"]'%I); rp.wait_for_timeout(300); rp.click('[data-a="rungo"]'); rp.wait_for_timeout(1500)
    # Amit leaves with a reason
    am.evaluate("lvRefresh().then(()=>go('mine'))"); am.wait_for_timeout(1200); am.click('[data-a="leaveask"][data-v="%s"]'%I); am.wait_for_timeout(300)
    am.click('[data-a="leavego"]'); am.wait_for_timeout(400); chk('why' in am.inner_text('#lvToast').lower(),'leaving asks for the reason')
    am.fill('#lvwhy','Called to VC-7'); am.dispatch_event('#lvwhy','input'); am.click('[data-a="leavego"]'); am.wait_for_timeout(1800)
    x=call('/api/ticket?id='+I,tok=rv)['ticket']; a=[c for c in x['crew'] if c['name']=='Amit'][0]; chk(a['left'] and a['leftWhy']=='Called to VC-7','Amit left with reason')
    # Ravi closes: report form filled from who joined
    rp.evaluate("lvRefresh().then(()=>go('mine'))"); rp.wait_for_timeout(1200); rp.click('[data-a="toclose"][data-v="%s"]'%I); rp.wait_for_timeout(300); rp.click('[data-a="closego"]'); rp.wait_for_timeout(800)
    v=rp.evaluate("[lvChipVal('done'), lvChipVal('supp')]"); chk(v==['Ravi, Kiran','Amit'],'form: Done by Ravi, Kiran; Supported by Amit (filled from who joined): %s'%v)
    dm=rp.eval_on_selector('#f_downMin','e=>e.value'); chk(int(dm)<=2,'form downtime = stopped periods only (%s min)'%dm)
    rp.locator('#lvMan').scroll_into_view_if_needed(); rp.screenshot(path=OUT+'v9_chips.png')
    rp.click('#lvChSupp [data-chx="supp"][data-n="Amit"]'); rp.wait_for_timeout(200); chk(rp.evaluate("lvChipVal('supp')")=='','remove a chip with ×')
    rp.select_option('#lvChSupp select','Amit'); rp.wait_for_timeout(200)
    opts=rp.eval_on_selector('#lvChDone select',"e=>[...e.options].map(o=>o.text)"); chk('Ravi' not in opts and 'Kiran' not in opts and 'Amit (moves from Supported by)' in opts,'Done by add list: leaves out names already there, offers Amit as moving from Supported by')
    chk(rp.evaluate("lvChipVal('supp')")=='Amit','add back with ➕ Add supported by')
    rp.click('#lvChDone [data-chx="done"][data-n="Kiran"]'); rp.wait_for_timeout(200); rp.select_option('#lvChSupp select','Kiran'); rp.wait_for_timeout(200)
    rp.select_option('#lvChDone select','Kiran'); rp.wait_for_timeout(200); chk(rp.evaluate("[lvChipVal('done'), lvChipVal('supp')]")==['Ravi, Kiran','Amit'],'a name moves between Done by and Supported by, never in both')
    for sel in ['#f_shift','#f_observedBy','#f_maintCode','#f_breakdownCategory']:
        o=rp.eval_on_selector(sel,"e=>[...e.options].map(o=>o.value).filter(Boolean)")
        if o and not rp.input_value(sel): rp.select_option(sel, o[0])
    rp.fill('#f_correctiveAction','Spindle bearing replaced')
    rp.locator('#sigCanvas').scroll_into_view_if_needed(); bb=rp.locator('#sigCanvas').bounding_box(); rp.mouse.move(bb['x']+20,bb['y']+30); rp.mouse.down(); rp.mouse.move(bb['x']+150,bb['y']+90); rp.mouse.up()
    with rp.expect_download(timeout=20000): rp.click('#submitBtn')
    rp.wait_for_timeout(2500); chk('Ticket closed' in rp.inner_text('#successScreen'),'closed from the report form')
    x=call('/api/ticket?id='+I,tok=rv); T=x['ticket']; R=T['report']
    chk(R['db'].startswith('Ravi, Kiran') and R['sb']=='Amit' and T['status']=='closed' and T['followMin'] is not None,'report saved: Done by %s, Supported by %s; follow-up recorded'%(R['db'],R['sb']))
    # WhatsApp from the closed ticket: the whole report
    rp.goto(S+'/maint.html'); rp.wait_for_timeout(1800); rp.evaluate("sheetDetail(%s)"%json.dumps(I)); rp.wait_for_timeout(2200)
    rp.eval_on_selector('#lvSheet [data-a="wa"]','b=>b.scrollIntoView({block:"center"})'); rp.wait_for_timeout(300)
    with cr.expect_page(timeout=5000) as np: rp.click('#lvSheet [data-a="wa"]')
    u=U.unquote(np.value.url); np.value.close()
    chk(all(k in u for k in ['*Report*','Done by: Ravi, Kiran','Supported by: Amit','Observed by:','Maintenance code:','Machine running again:','Follow-up:','Amit (support)','Joined','Left','*History*']),'WhatsApp: full report, who worked with roles, history with joined / left')
    # closed lists: short cards, dropdown, month line
    rp.evaluate("LV.twkAt=0; go('team')"); rp.wait_for_timeout(2500); tt=rp.inner_text('#lvBody')
    chk(rp.query_selector('select#tf') is not None and rp.query_selector('.lvchip[data-a="tf"]') is None,'Team closed list: person dropdown, no name chips')
    chk('Done:' not in tt and rp.query_selector('.lvcl .lvclamp2') is not None,'closed cards: no "Done:" line, problem clamped')
    chk(rp.query_selector('[data-a="monopen"]') is not None and 'Primary' not in tt,'month line closed by default')
    rp.click('[data-a="monopen"]'); rp.wait_for_timeout(300); tt=rp.inner_text('#lvBody'); chk('Support' in tt and 'Amit' in tt,'month line opens: per person with primary / support split')
    rp.select_option('select#tf','Amit'); rp.wait_for_timeout(400); chk(rp.evaluate("A.st.tf")=='Amit' and 'VC-1' in rp.inner_text('#lvBody'),'dropdown filters by person')
    rp.screenshot(path=OUT+'v9_team_closed.png', full_page=False)
    # day report roles (API used by the PDF)
    f=(dt.datetime.now(dt.UTC)-dt.timedelta(hours=3)).strftime('%Y-%m-%dT%H:%M:%SZ'); to=(dt.datetime.now(dt.UTC)+dt.timedelta(minutes=2)).strftime('%Y-%m-%dT%H:%M:%SZ')
    rp.evaluate("go('team')"); rp.wait_for_timeout(300)
    with rp.expect_download(timeout=20000) as dl:
        rp.evaluate("""(async()=>{ const d = await lvApi('/api/dayreport?from=%s&to=%s&team=1'); const r = await buildDayPdf(d, {team:true, who:'', day:new Date(), shift:'', from:new Date(Date.now()-3*3600000), to:new Date()}); LV.dayPdf = r; daySave(); })()"""%(f,to))
    dl.value.save_as('/tmp/v9_day.pdf')
    import subprocess; txt=subprocess.run(['pdftotext','-layout','/tmp/v9_day.pdf','-'],capture_output=True,text=True).stdout
    chk('Support' in txt and 'Primary' in txt and 'Started' in txt,'team day report PDF: Role column (Started / Primary / Support) and split')
    ca.close(); cr.close(); br.close()
print('errors', errs); print('ALL OK' if ok and not errs else 'FAIL')
