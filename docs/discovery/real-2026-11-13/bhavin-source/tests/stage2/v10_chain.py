# task not finished: finishing it can leave another pending task on the same breakdown
import json, urllib.request as U
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'; ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try: return json.loads(U.urlopen(r).read())
    except U.HTTPError as e: return {'status':e.code, **json.loads(e.read() or b'{}')}
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
t=call('/api/down',{'machine':'VC-2','problem':'Pump leak','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':t['id']},tok=rv)
c=call('/api/close',{'id':t['id'],'kind':'no_report','note':'temp fix','by':'Ravi','task':{'text':'Replace pump','why':'Waiting for spare','exp':''}},tok=rv); k=c['task']
call('/api/start',{'id':k['id']},tok=rv)
errs=[]
with sync_playwright() as p:
    pg=p.chromium.launch().new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True).new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    pg.evaluate("go('mine')"); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[data-a=doneask][data-v=\"%s\"]').click()"%k['id']); pg.wait_for_timeout(400)
    chk(pg.query_selector('#lvtkOn') is not None,'finishing a task offers: Task not finished, leave another pending task')
    pg.fill('#lvwhy','Old pump removed, new one not fitted')
    pg.evaluate("document.querySelector('#lvtkOn').click()"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#lvrgo').click()"); pg.wait_for_timeout(600)
    chk(pg.is_visible('#lvrgo'),'ticked with empty text: refused')
    pg.fill('#lvtkTx','Fit new pump and test'); pg.fill('#lvtkDown','15'); pg.evaluate("document.querySelector('#lvrgo').click()"); pg.wait_for_timeout(2000)
    d=call('/api/ticket?id='+t['id'],tok=rv); T=d['tasks']
    chk(len(T)==2 and [x['status'] for x in sorted(T,key=lambda x:x['ref'])]==['closed','open'],'breakdown now has two tasks: first done, second pending (%s)'%[(x['ref'],x['status']) for x in T])
    n=[x for x in T if x['status']=='open'][0]; chk(n['parentId']==t['id'] and n['parentRef']==t['ref'],'new task is attached to the original breakdown %s'%n['parentRef'])
    chk(any(e['type']=='task' and 'not finished' in (e['text'] or '') for e in d['events']),'breakdown history records that the task was not finished')
    ev=d['events']; tk=[e for e in ev if e.get('task')]
    chk(any('[%s]'%T[0]['ref'] in (e['text'] or '') for e in tk) and any(e['type']=='start' for e in tk) and any(e['type']=='close' for e in tk),'breakdown history now carries the task steps (start, close) tagged with the task number: %d lines'%len(tk))
    chk(not any(e['type']=='task' and 'started' in (e['text'] or '') and e['text'].startswith('Pending task') for e in ev),'no duplicate summary lines for the same steps')
    chk(ev==sorted(ev,key=lambda e:e['at']),'history is in time order')
    own=call('/api/ticket?id='+n['id'],tok=rv); chk(own['ticket']['id']==n['id'] and not any(e.get('task') for e in own['events']),'each task still has its own history when opened alone')
    pg.evaluate("sheetDetail(%s)"%json.dumps(t['id'])); pg.wait_for_timeout(1500)
    s=pg.inner_text('#lvSheet'); h=s.split('Full history')[-1]; print(pg.evaluate("JSON.stringify(LV.det.events.slice(3,5))")); print(pg.evaluate("tlLine(LV.det.events[4])")); chk(T[0]['ref'] in h and 'Replace pump' in h and 'Fit new pump' in h,'phone breakdown window shows the tasks inside the history')
    pg.evaluate("document.querySelector('#lvSheet [data-a=openticket]').click()"); pg.wait_for_timeout(1200)
    chk('Pending task of '+t['ref'] in pg.inner_text('#lvSheet'),'tapping a task opens that task on its own')
    chk(not errs,'no page errors '+str(errs[:2]))
print('ALL PASS' if ok else 'SOME FAILED')
