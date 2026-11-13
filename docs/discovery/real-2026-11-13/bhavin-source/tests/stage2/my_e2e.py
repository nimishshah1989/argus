import json, urllib.request as U
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'; OUT='/home/claude/s2/shots/'
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None, key='k123'):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    elif key: h['X-Key']=key
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try: return json.loads(U.urlopen(r).read())
    except U.HTTPError as e: return {'status':e.code, **json.loads(e.read() or b'{}')}
lg=lambda u,p: call('/api/login',{'username':u,'password':p},key=None)['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
# tickets by op1: VC-2 (will be in progress), VC-4 (waiting), TC-1 (booked), a work request, VC-7 fixed
ids={}
for m,k in [('VC-2','stopped'),('VC-4','stopped'),('TC-1','support'),('VC-7','stopped')]:
    ids[m]=call('/api/down',{'machine':m,'problem':{'VC-2':'Spindle noise','VC-4':'Hydraulic leak','TC-1':'Coolant pump weak','VC-7':'Door switch alarm'}[m],'kind':k},tok=op)['ticket']['id']
call('/api/down',{'kind':'general','location':'Store','workType':'Electrical','problem':'Tube light not working','by':'x'},tok=op)
call('/api/down',{'machine':'VC-8','problem':'Not mine','kind':'stopped'},tok=lg('op2','op2345'))
for m in ['VC-2','VC-4','VC-7']: call('/api/start',{'id':ids[m],'by':'x'},tok=rv)
call('/api/pause',{'id':ids['VC-4'],'reason':'Waiting for spare','note':'Seal kit ordered from supplier','eta':'2026-11-02T12:30:00Z'},tok=rv)
call('/api/close',{'id':ids['VC-7'],'kind':'no_report','note':'Switch cleaned'},tok=rv)
chk(call('/api/pushkey',tok=op).get('key'),'report login can get alerts key')
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True); pg=c.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(S+'/floor.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','op1'); pg.fill('#lvP','op1234'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    tabs=pg.inner_text('#lvTabs'); chk('My complaints' in tabs and '4' in tabs,'tab with count of 4 open: '+tabs.replace('\n',' '))
    pg.click('[data-a="tab"][data-v="my"]'); pg.wait_for_timeout(500)
    t=pg.inner_text('#lvBody')
    chk('open (4)' in t.lower() and 'fixed in the last 24 hours (1)' in t.lower(),'open and fixed sections')
    chk('Ravi is working on it' in t and 'Waiting for spare' in t and 'Booked. Waiting for maintenance' in t and 'Fixed at' in t,'status lines')
    chk('VC-8' not in t,'other person\'s complaint not shown')
    chk(t.count('Cancel this complaint')==2,'cancel only on not-started ones')
    pg.screenshot(path=OUT+'m1_my.png', full_page=False)
    pg.evaluate("document.getElementById('lvBody').scrollTop=2000"); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'m2_my_bottom.png')
    print('errors', errs); br.close()
print('ALL OK' if ok else 'FAIL')
