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
t=call('/api/down',{'machine':'VC-1','problem':'Oil leak','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':t['id']},tok=rv); call('/api/close',{'id':t['id'],'kind':'report','report':{'ca':'Seal'}},tok=rv)
n=dt.datetime.now(dt.UTC).replace(second=0,microsecond=0); D=n-dt.timedelta(hours=2)
r=call('/api/edit',{'id':t['id'],'downAt':D.isoformat(),'startedAt':(D+dt.timedelta(minutes=10)).isoformat(),'closedAt':(D+dt.timedelta(minutes=40)).isoformat(),'activeMin':6,'reason':'setup'},key='k123')
chk(r.get('ok'),'setup: reported, +10 start, +40 close, work 6 (the mismatch from the screenshot)')
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id='Asia/Kolkata'); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','boss'); pg.fill('#lvP','boss12'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    pg.evaluate("sheetDetail(%s)"%json.dumps(t['id'])); pg.wait_for_timeout(2000); pg.evaluate("act('editask', %s)"%json.dumps(t['id'])); pg.wait_for_timeout(400)
    chk(pg.is_visible('#lved_link') and 'Does not match now' in pg.inner_text('#lved_link') and '30 min' in pg.inner_text('#lved_link'),'opening a mismatched ticket says so (start to close 30 min, work 6 min)')
    pg.screenshot(path=OUT+'edlink_open.png')
    hm=lambda: pg.input_value('#lved_start')[-5:]
    loc=lambda m: (D+dt.timedelta(minutes=m)).astimezone(dt.timezone(dt.timedelta(hours=5,minutes=30))).strftime('%H:%M')
    pg.fill('#lved_act','20'); pg.wait_for_timeout(200)
    chk(hm()==loc(20),'work 20 min -> start moves to close-20 (%s)'%hm())
    pg.fill('#lved_start', pg.input_value('#lved_start')[:-5]+loc(5)); pg.dispatch_event('#lved_start','change'); pg.wait_for_timeout(200)
    chk(pg.input_value('#lved_act')=='35','start moved to +5 -> work becomes 35')
    pg.fill('#lved_act','300'); pg.wait_for_timeout(200)
    chk(hm()==loc(0) and pg.input_value('#lved_act')=='40' and 'longer than' in pg.inner_text('#lved_link'),'work longer than possible -> start = reported, work capped at 40, warning shown')
    pg.screenshot(path=OUT+'edlink_warn.png')
    pg.fill('#lved_act','30'); pg.wait_for_timeout(200); chk(hm()==loc(10),'work 30 -> start back to +10')
    pg.fill('#lved_rs','Work time entered wrong'); pg.click('[data-a="editgo"]'); pg.wait_for_timeout(2200)
    x=call('/api/ticket?id='+t['id'],tok=bs)['ticket']
    chk([x['responseMin'],x['activeMin'],x['repairMin'],x['downtimeMin']]==[10,30,30,40],'saved: response 10, work 30, repair 30, downtime 40: %s'%[x['responseMin'],x['activeMin'],x['repairMin'],x['downtimeMin']])
    pg.screenshot(path=OUT+'edlink_saved.png')
    c.close(); br.close()
print('errors', errs); print('ALL OK' if ok and not errs else 'FAIL')
