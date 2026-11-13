# phone: close with a pending task, support request has 0 downtime, task done asks machine-stopped minutes, task card/line, parent shows task
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
    try: return json.loads(U.urlopen(r).read())
    except U.HTTPError as e: return {'status':e.code, **json.loads(e.read() or b'{}')}
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
t=call('/api/down',{'machine':'VC-1','problem':'Coolant pump leaking','kind':'stopped'},tok=op)['ticket']; I=t['id']; call('/api/start',{'id':I},tok=rv)
sp=call('/api/down',{'machine':'VC-3','problem':'Needs electrician','kind':'support'},tok=op)['ticket']; call('/api/start',{'id':sp['id']},tok=rv)
errs=[]
def jc(pg,sel): pg.evaluate("s=>document.querySelector(s).click()", sel)
with sync_playwright() as p:
    br=p.chromium.launch()
    c=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True, timezone_id='Asia/Kolkata'); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    # support request: closing form shows downtime 0
    pg.evaluate("go('mine')"); pg.wait_for_timeout(500)
    jc(pg,'[data-a="toclose"][data-v="%s"]'%sp['id']); pg.wait_for_timeout(500)
    jc(pg,'[data-a="closego"]'); pg.wait_for_timeout(800)
    chk(pg.input_value('#f_downMin')=='0','support request report form: downtime prefilled 0')
    pg.reload(); pg.wait_for_timeout(2500); pg.evaluate("go('mine')"); pg.wait_for_timeout(600)
    # stopped: close with pending task, empty text refused
    jc(pg,'[data-a="toclose"][data-v="%s"]'%I); pg.wait_for_timeout(500)
    chk(pg.query_selector('#lvtkOn') is not None,'close page has Leave a pending task')
    chk(not pg.is_visible('#lvtkTx'),'task fields hidden until ticked')
    jc(pg,'#lvtkOn'); pg.wait_for_timeout(200); chk(pg.is_visible('#lvtkTx'),'ticking shows the task fields')
    jc(pg,'[data-a="closego"]'); pg.wait_for_timeout(500)
    chk(not pg.is_visible('#f_downMin'),'empty task text: stays on the close page')
    pg.fill('#lvtkTx','Replace pump when spare arrives'); pg.select_option('#lvtkWhy','Waiting for spare'); pg.fill('#lvtkExp','2026-11-20')
    jc(pg,'[data-a="closego"]'); pg.wait_for_timeout(900)
    chk(pg.query_selector('#f_downMin') is not None,'report form opens')
    # fill the rest of the form via existing helper if present
    import sys
    pg.evaluate("window.__tk=ptaskOut()"); chk(pg.evaluate("window.__tk && window.__tk.text")=='Replace pump when spare arrives','task kept through to the form')
    # submit via direct call (form filling is covered by other suites)
    pg.evaluate("lvCloseTicket(%s,'Ravi',null,null,{machineId:'VC-1',problem:'Coolant pump leaking',downMin:30,respMin:5,repMin:20,done:'temp fix',by:'Ravi'})"%json.dumps(I)); pg.wait_for_timeout(2000)
    d=call('/api/ticket?id='+I,tok=rv); tasks=d.get('tasks') or []
    chk(len(tasks)==1 and tasks[0]['taskExp']=='2026-11-20','server has the pending task from the phone: '+str([x['ref'] for x in tasks]))
    tid=tasks[0]['id'] if tasks else None
    # task shows on the phone with the type line, in the Open list
    pg.evaluate("lvRefresh().then(()=>go('open'))"); pg.wait_for_timeout(1500)
    chk('Tasks (1)' in pg.inner_text('#lvBody'),'Open tab switch shows Tasks (1)')
    jc(pg,'[data-a="otab"][data-v="tasks"]'); pg.wait_for_timeout(300)
    b=pg.inner_text('#lvBody'); chk('Pending task of' in b and '20 Nov' in b,'Open list: task card says Pending task of BD-xxxx · expected 20 Nov')
    # start + done asks for machine stopped minutes
    call('/api/start',{'id':tid},tok=rv)
    pg.evaluate("lvRefresh().then(()=>go('mine'))"); pg.wait_for_timeout(1200)
    jc(pg,'[data-a="doneask"][data-v="%s"]'%tid); pg.wait_for_timeout(500)
    chk(pg.query_selector('#lvtkDown') is not None,'finishing a task asks: did the machine have to stop (minutes)')
    pg.fill('#lvtkDown','25'); pg.fill('#lvwhy','pump replaced'); 
    sel=pg.query_selector('#lvnm')
    if sel and sel.evaluate("e=>e.tagName")=='SELECT':
        try: pg.select_option('#lvnm','Ravi')
        except Exception: pass
    jc(pg,'[data-a="donego"]'); pg.wait_for_timeout(1800)
    d=call('/api/ticket?id='+I,tok=rv); tk=d['tasks'][0]
    chk(tk['status']=='closed' and tk['taskDownMin']==25,'task done: machine stopped 25 min stored (status %s, %s)'%(tk['status'],tk['taskDownMin']))
    ev=[e['type'] for e in d['events']]; chk('task' in ev,'parent history has a Pending task line')
    pg.evaluate("sheetDetail(%s)"%json.dumps(I)); pg.wait_for_timeout(1200)
    chk('Pending task' in pg.inner_text('#lvSheet') and tk['ref'] in pg.inner_text('#lvSheet'),'parent details list the pending task')
    chk(not errs,'no page errors '+str(errs[:2]))
print('ALL PASS' if ok else 'SOME FAILED')
