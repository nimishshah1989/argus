import json, urllib.request as U
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'; OUT='/home/claude/s2/shots/'
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET'); return json.loads(U.urlopen(r).read())
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
c1=call('/api/down',{'machine':'VC-1','problem':'Spindle noise','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':c1['id']},tok=rv); call('/api/close',{'id':c1['id'],'kind':'report','report':{'ca':'Bearing'}},tok=rv)
o1=call('/api/down',{'machine':'VC-2','problem':'Alarm 401','kind':'stopped'},tok=op)['ticket']
call('/api/start',{'id':o1['id']},tok=rv); call('/api/update',{'id':o1['id'],'text':'Checked encoder cable','spare':'Encoder'},tok=rv); call('/api/pause',{'id':o1['id'],'reason':'Waiting for spare','note':'Encoder ordered'},tok=rv)
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id='Asia/Kolkata'); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    c.route('https://wa.me/**', lambda r: r.fulfill(status=200, body='wa'))
    pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    def wa(tid):
        pg.evaluate("sheetDetail(%s)"%json.dumps(tid)); pg.wait_for_timeout(2500); pg.eval_on_selector('#lvSheet [data-a="wa"]','b=>b.scrollIntoView({block:"center"})'); pg.wait_for_timeout(400)
        with c.expect_page(timeout=5000) as np: pg.click('#lvSheet [data-a="wa"]')
        u=np.value.url; np.value.close(); return U.unquote(u)
    chk(pg.evaluate("[window.innerWidth, document.documentElement.scrollWidth]")==[390,390],'app fits the phone width: %s'%pg.evaluate("[window.innerWidth, document.documentElement.scrollWidth]"))
    u=wa(c1['id']); chk('wa.me' in u and 'CLOSED' in u and 'VC-1' in u and 'Closed:' in u and 'by Ravi' in u and 'What was done: Bearing' in u and c1['ref'] in u,'closed ticket: WhatsApp opens with CLOSED message')
    pg.click('[data-a="closesheet"]'); u=wa(o1['id']); chk('Alarm 401' in u and '*History*' in u and 'Checked encoder cable' in u and 'Waiting for spare' in u and 'Encoder ordered' in u and 'Started' in u and 'Reported' in u,'from details: full history in the message (update, pause, start)')
    chk('WAITING (' in u.split('\n')[0] and 'Now waiting: Waiting for spare' in u and 'Machine downtime:' in u and 'As of' in u,'facts: waiting now, downtime so far, as-of time')
    pg.click('[data-a="closesheet"]')
    pg.evaluate("go('mine')"); pg.wait_for_timeout(600)
    b=pg.query_selector('.lvdaybtn'); chk(b is not None and 'Download' in b.inner_text(),'Mine: proper Download day report button')
    pg.screenshot(path=OUT+'day_btn_mine.png')
    b.click(); pg.wait_for_timeout(600); chk('report' in pg.inner_text('#lvSheet').lower(),'button opens the day report sheet')
    pg.click('[data-a="closesheet"]'); pg.evaluate("go('team')"); pg.wait_for_timeout(600); chk('team day report' in pg.inner_text('.lvdaybtn').lower(),'Team: proper Download team day report button')
    pg.screenshot(path=OUT+'day_btn_team.png'); c.close(); br.close()
print('errors', errs); print('ALL OK' if ok and not errs else 'FAIL')
