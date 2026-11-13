import json, urllib.request as U
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'
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
a=call('/api/down',{'machine':'VC-1','problem':'Label test support','kind':'support'},tok=op)['ticket']['id']
b=call('/api/down',{'machine':'VC-2','problem':'Label test stopped','kind':'stopped'},tok=op)['ticket']['id']
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':390,'height':844},timezone_id='Asia/Kolkata'); pg=c.new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    cards=pg.evaluate("[...document.querySelectorAll('.lvtk')].map(e=>e.innerText)")
    s=[x for x in cards if 'Label test support' in x]; k=[x for x in cards if 'Label test stopped' in x]
    chk(s and 'Down' not in s[0] and 'Open' in s[0],'support card says Open, not Down: '+(s[0].replace('\n',' | ') if s else '?'))
    chk(k and ('Waiting' in k[0] or 'Down' in k[0]),'stopped card keeps Waiting/Down')
    for tid,exp in ((a,'Needs support (machine running)'),(b,'Machine stopped')):
        pg.evaluate("sheetDetail(%s)"%json.dumps(tid)); pg.wait_for_timeout(1200)
        t=pg.inner_text('#lvSheet'); chk(exp in t,'details show Type: '+exp)
        if tid==a: chk('Machine downtime' not in t,'support details: no machine downtime row')
        pg.evaluate("closeSheet&&closeSheet()"); pg.wait_for_timeout(300)
    # waiting support ticket
    call('/api/start',{'id':a},tok=rv); call('/api/pause',{'id':a,'reason':'Vendor','waitReason':'Waiting for part'},tok=rv)
    pg.reload(); pg.wait_for_timeout(2200)
    cards=pg.evaluate("[...document.querySelectorAll('.lvtk')].map(e=>e.innerText)"); s=[x for x in cards if 'Label test support' in x]
    chk(s and 'Down' not in s[0],'waiting support card: no Down: '+(s[0].replace('\n',' | ')[:120] if s else '?'))
    chk(not errs,'no page errors '+str(errs))
print('ALL PASS' if ok else 'SOME FAILED')
