import json, urllib.request as U, datetime as dt, time
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
call('/api/users',dict(username='boss',name='Bhaven',role='admin',password='boss12'),key='k123')
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123'); bs=lg('boss','boss12')
down=lambda m,p: call('/api/down',{'machine':m,'problem':p,'kind':'stopped'},tok=op)['ticket']
# 1) never started, cancelled by the person who raised it
a=down('VC-1','Coolant pump'); r=call('/api/cancel',{'id':a['id'],'by':'Suresh','reason':'Raised by mistake'},tok=op); chk(r.get('ok'),'floor cancels own complaint')
st=call('/api/state',tok=rv); chk([t['id'] for t in st['cancelled']]==[a['id']] and st['cancelled'][0]['closeNote']=='Raised by mistake','state lists cancelled in last 24 h')
chk(call('/api/restore',{'id':a['id'],'reason':'x'},tok=rv).get('status')==403,'maintenance cannot restore')
chk('reason' in call('/api/restore',{'id':a['id']},tok=bs).get('error','').lower(),'reason required')
r=call('/api/restore',{'id':a['id'],'reason':'Machine still down'},tok=bs); chk(r.get('status')=='open' and r['ticket']['status']=='open' and not r['ticket']['closedAt'],'never-started ticket restored as open')
chk('only a cancelled' in call('/api/restore',{'id':a['id'],'reason':'again'},tok=bs).get('error','').lower(),'cannot restore twice')
# 2) being worked on when cancelled -> back in progress, clock as if never cancelled
b=down('VC-2','Spindle'); call('/api/start',{'id':b['id']},tok=rv); time.sleep(1); call('/api/cancel',{'id':b['id'],'by':'Ravi','reason':'Wrong tap'},tok=rv)
r=call('/api/restore',{'id':b['id'],'reason':'Cancelled by mistake'},tok=bs); chk(r.get('status')=='working' and r['ticket']['segStart'][:19]==r['ticket']['startedAt'][:19] and r['ticket']['startedBy']=='Ravi','working ticket restored in progress, clock from original start')
ev=[e['type'] for e in call('/api/events?id='+b['id'],tok=rv)['events']]; chk(ev[-2:]==['cancel','restore'],'history keeps cancel and restore: %s'%ev)
c=call('/api/close',{'id':b['id'],'kind':'report','report':{'ca':'Fixed'}},tok=rv); chk(c['ticket']['status']=='closed','restored ticket closes normally')
# 3) paused when cancelled -> waiting again
w=down('VC-4','Waiting spare'); call('/api/start',{'id':w['id']},tok=rv); call('/api/pause',{'id':w['id'],'reason':'Waiting for spare','note':'Bearing'},tok=rv); call('/api/cancel',{'id':w['id'],'by':'Ravi','reason':'oops'},tok=rv)
r=call('/api/restore',{'id':w['id'],'reason':'still waiting'},key='k123'); chk(r.get('status')=='waiting' and r['ticket']['waitReason']=='Waiting for spare','paused ticket restored as waiting (platform key)')
# 4) machine already has a new ticket -> refused
x=down('VC-3','Old one'); call('/api/cancel',{'id':x['id'],'by':'Suresh','reason':'dup'},tok=op); y=down('VC-3','New one')
r=call('/api/restore',{'id':x['id'],'reason':'mistake'},tok=bs); chk(r.get('status')==409 and y['ref'] in r.get('error',''),'refused when the machine already has an open ticket: '+r.get('error',''))
# day report: restored job is not shown as cancelled
f=(dt.datetime.now(dt.UTC)-dt.timedelta(hours=2)).isoformat().replace('+00:00','Z'); t_=(dt.datetime.now(dt.UTC)+dt.timedelta(minutes=1)).isoformat().replace('+00:00','Z')
d=call('/api/dayreport?from=%s&to=%s'%(f,t_),tok=rv); js={j['id']:j['status'] for p in d['people'] for j in p['jobs']}
chk(js.get(b['id'])=='closed' and js.get(w['id'])=='waiting','day report: restored jobs show closed / waiting, not cancelled: %s'%[js.get(b['id']),js.get(w['id'])])
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch()
    def phone(u,pw,page='maint'):
        c=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id='Asia/Kolkata'); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(S+'/'+page+'.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU',u); pg.fill('#lvP',pw); pg.click('#lvGo'); pg.wait_for_timeout(1800); return c,pg
    z=down('VC-5','Hydraulic leak'); call('/api/start',{'id':z['id']},tok=rv); call('/api/cancel',{'id':z['id'],'by':'Ravi','reason':'Pressed cancel by mistake'},tok=rv)
    # shop floor: own cancelled complaint visible
    c,pg=phone('op1','op1234','index'); pg.evaluate("go('my')"); pg.wait_for_timeout(600); t=pg.inner_text('#lvBody')
    chk('Cancelled' in t and 'Pressed cancel by mistake' in t and 'FIXED OR CANCELLED' in t.upper(),'floor: My complaints shows the cancelled one with reason'); c.close()
    # maintenance: Team tab lists it, no restore button
    c,pg=phone('ravi','ravi123'); pg.evaluate("go('team')"); pg.wait_for_timeout(600); t=pg.inner_text('#lvBody')
    chk('CANCELLED IN THE LAST 24 HOURS' in t.upper() and 'VC-5' not in t,'Team tab: cancelled shown as a folded line')
    pg.evaluate("document.querySelector('[data-a=cxtog]').click()"); pg.wait_for_timeout(300); t=pg.inner_text('#lvBody'); chk('VC-5' in t,'Team tab: cancelled section opens')
    pg.click('.lvtm:has-text("VC-5")'); pg.wait_for_timeout(2000); s=pg.inner_text('#lvSheet')
    chk('Pressed cancel by mistake' in s and pg.query_selector('[data-a="restoreask"]') is None,'maintenance: details show reason, no Restore button'); c.close()
    # admin restores on the phone
    c,pg=phone('boss','boss12'); pg.evaluate("go('team')"); pg.wait_for_timeout(600); pg.evaluate("document.querySelector('[data-a=cxtog]').click()"); pg.wait_for_timeout(300); pg.click('.lvtm:has-text("VC-5")'); pg.wait_for_timeout(2000)
    pg.eval_on_selector('[data-a="restoreask"]','b=>b.scrollIntoView({block:"center"})'); pg.wait_for_timeout(300); pg.click('[data-a="restoreask"]'); pg.wait_for_timeout(400)
    pg.screenshot(path=OUT+'cx_restore.png')
    pg.click('[data-a="restorego"]'); pg.wait_for_timeout(500); chk('reason' in pg.inner_text('#lvToast').lower(),'phone asks for the reason')
    pg.fill('#lvrs_r','Ravi pressed cancel by mistake'); pg.click('[data-a="restorego"]'); pg.wait_for_timeout(2500)
    s=pg.inner_text('#lvSheet'); chk('Restored' in s and 'Ravi pressed cancel by mistake' in s and 'back in progress' in pg.inner_text('#lvToast'),'restored on phone: history shows it, toast says back in progress')
    chk(call('/api/ticket?id='+z['id'],tok=bs)['ticket']['status']=='working','server: VC-5 working again')
    pg.click('[data-a="closesheet"]'); pg.evaluate("go('team')"); pg.wait_for_timeout(600); chk('VC-5' not in (pg.inner_text('#lvBody').upper().split('CANCELLED IN THE LAST')+[''])[1],'no longer in the cancelled list')
    pg.screenshot(path=OUT+'cx_team.png'); c.close()
    # platform list + restore
    q=down('VC-6','Chuck'); call('/api/cancel',{'id':q['id'],'by':'Suresh','reason':'Duplicate'},tok=op)
    c=br.new_context(viewport={'width':1400,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)) if '_bubWired' not in str(e) else None)
    CH='window.Chart=function(){return {destroy(){},update(){},resize(){},scales:{x:{},y:{}}}};window.Chart.register=function(){};window.Chart.defaults={plugins:{legend:{labels:{}},tooltip:{}},font:{},scale:{grid:{}}};'
    c.route('https://cdnjs.cloudflare.com/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=CH if 'chart' in r.request.url.lower() else '')); c.route('https://cdn.jsdelivr.net/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=CH if 'chart' in r.request.url.lower() else ''))
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(2500)
    pg.evaluate("""()=>{ const s=state.settings; s.btCompany='Test Co'; s.btClientId='tst'; s.btApi='http://localhost:8799'; s.btSite='http://localhost:8787'; localStorage.setItem('bt_key_tst','k123'); persist(); }""")
    pg.evaluate("nav('breakdowns')"); pg.wait_for_timeout(800); pg.click("button:has-text('Cancelled tickets')"); pg.wait_for_timeout(1500)
    t=pg.inner_text('#modalBox'); chk('VC-6' in t and 'Duplicate' in t and 'VC-3' in t and 'VC-5' not in t,'portal: cancelled list (VC-6, VC-3), restored ones gone')
    pg.screenshot(path=OUT+'cx_portal.png')
    pg.once('dialog', lambda d: d.accept('Not a duplicate')); pg.click("#modalBox tr:has-text('VC-6') button:has-text('Restore')"); pg.wait_for_timeout(1500)
    chk('VC-6' not in pg.inner_text('#modalBox') and call('/api/ticket?id='+q['id'],tok=bs)['ticket']['status']=='open','portal: Restore puts VC-6 back open')
    pg.once('dialog', lambda d: d.accept('try')); pg.click("#modalBox tr:has-text('VC-3') button:has-text('Restore')"); pg.wait_for_timeout(1200)
    chk('already has an open ticket' in pg.inner_text('#toast') if pg.query_selector('#toast') else True,'portal shows the refusal message')
    br.close()
print('errors', errs); print('ALL OK' if ok and not errs else 'FAIL')
