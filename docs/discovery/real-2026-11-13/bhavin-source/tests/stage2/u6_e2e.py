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
call('/api/users',dict(username='boss',name='Bhaven',role='admin',password='boss12'),key='k123')
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123'); bs=lg('boss','boss12')
t=call('/api/down',{'machine':'VC-1','problem':'Spindle noise','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':t['id']},tok=rv); c1=call('/api/close',{'id':t['id'],'kind':'report','report':{'ca':'Bearing replaced'}},tok=rv)['ticket']
o=call('/api/down',{'machine':'VC-2','problem':'Open job','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':o['id']},tok=rv)
# server rules
chk(call('/api/edit',{'id':t['id'],'activeMin':30,'reason':'x'},tok=rv).get('status')==403,'maintenance login cannot edit')
chk('reason' in call('/api/edit',{'id':t['id'],'activeMin':30},tok=bs).get('error','').lower(),'reason required')
down=dt.datetime.fromisoformat(c1['downAt'].replace('Z','+00:00'))
chk('before' in call('/api/edit',{'id':t['id'],'startedAt':(down-dt.timedelta(minutes=10)).isoformat(),'reason':'x'},tok=bs).get('error',''),'start before reported refused')
chk('future' in call('/api/edit',{'id':t['id'],'closedAt':(dt.datetime.now(dt.UTC)+dt.timedelta(hours=2)).isoformat(),'reason':'x'},tok=bs).get('error',''),'future time refused')
r0=call('/api/edit',{'id':t['id'],'downAt':(dt.datetime.now(dt.UTC)-dt.timedelta(hours=2)).isoformat(),'reason':'setup'},key='k123'); chk(r0.get('ok'),'key can move reported time back')
ev=call('/api/events?id='+t['id'],tok=bs)['events']; chk(any(e['type']=='edit' and e['by']=='Platform' for e in ev),'platform edit logged as Platform')
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch()
    def phone(u,pw):
        c=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id='Asia/Kolkata'); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU',u); pg.fill('#lvP',pw); pg.click('#lvGo'); pg.wait_for_timeout(1800); return c,pg
    c,pg=phone('ravi','ravi123'); pg.evaluate("sheetDetail(%s)"%json.dumps(t['id'])); pg.wait_for_timeout(1200)
    chk(pg.query_selector('[data-a="editask"]') is None,'no Edit button for a maintenance login'); c.close()
    c,pg=phone('boss','boss12'); pg.evaluate("sheetDetail(%s)"%json.dumps(t['id'])); pg.wait_for_timeout(1200)
    chk(pg.query_selector('[data-a="editask"]') is not None,'admin sees Edit ticket'); pg.click('[data-a="editask"]'); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+'w1_edit.png')
    # start 10 minutes after reported, work 25 min, close 40 min after reported
    pg.evaluate("""(()=>{ const T=A.st.ed.orig, d=new Date(T.downAt), f=x=>toLocalInput(new Date(d.getTime()+x*60000).toISOString());
      document.getElementById('lved_start').value=f(10); document.getElementById('lved_close').value=f(40); document.getElementById('lved_act').value=25; })()""")
    pg.click('[data-a="editgo"]'); pg.wait_for_timeout(600); chk('reason' in pg.inner_text('#lvToast').lower(),'phone asks for the reason')
    # a refused save keeps what was typed
    pg.fill('#lved_rs','Tapped Start work late'); keepc=pg.input_value('#lved_close')
    pg.evaluate("document.getElementById('lved_close').value=toLocalInput(new Date(new Date(A.st.ed.orig.downAt).getTime()+5*60000).toISOString())"); badc=pg.input_value('#lved_close')
    pg.click('[data-a="editgo"]'); pg.wait_for_timeout(1500)
    chk('before' in pg.inner_text('#lvToast') and pg.input_value('#lved_close')==badc and pg.input_value('#lved_rs')=='Tapped Start work late' and pg.input_value('#lved_act')=='25','refused save: message shown, typed values kept')
    pg.fill('#lved_close', keepc); pg.evaluate("document.getElementById('lved_act').value=25"); pg.click('[data-a="editgo"]'); pg.wait_for_timeout(2000)
    s=pg.inner_text('#lvSheet'); chk('Edited' in s and 'Tapped Start work late' in s,'history shows the edit and reason')
    st=pg.evaluate("dnice(LV.det.ticket.startedAt)"); chk('@' not in s and st in s.split('Full history')[1],'history times shown in local (India) time: '+st)
    chk('10 min' in s and '25 min' in s,'response 10 min and work 25 min recalculated')
    pg.screenshot(path=OUT+'w2_edited.png')
    ed=call('/api/edits?since=2020-01-01',key='k123')['tickets']; chk(len(ed)==1 and ed[0]['lastEdit']['reason']=='Tapped Start work late' and sum(g['mins'] for g in ed[0]['segments'])==25,'/api/edits returns the ticket, reason and segments')
    chk(call('/api/edits',tok=rv).get('status')==403,'/api/edits admin only')
    x=call('/api/ticket?id='+t['id'],tok=bs)['ticket']; chk(x['responseMin']==10 and x['activeMin']==25 and x['downtimeMin']==40 and x['repairMin']==30,'server: response 10, work 25, downtime 40, repair 30: %s'%[x['responseMin'],x['activeMin'],x['downtimeMin'],x['repairMin']])
    pp=call('/api/ticket?id='+t['id'],tok=bs)['people']; chk(sum(q['mins'] for q in pp)==25,'per-person minutes add up to the corrected work time')
    # open ticket: start time editable, no closing fields
    pg.click('[data-a="closesheet"]'); pg.evaluate("sheetDetail(%s)"%json.dumps(o['id'])); pg.wait_for_timeout(1200); pg.click('[data-a="editask"]'); pg.wait_for_timeout(300)
    chk(pg.query_selector('#lved_start') is not None and pg.query_selector('#lved_close') is None,'open ticket: start editable, no closing time')
    c.close(); br.close()
print('page errors', errs); print('ALL OK' if ok and not errs else 'FAIL')
