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
def mk(m,prob,task=None):
    t=call('/api/down',{'machine':m,'problem':prob,'kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':t['id']},tok=rv)
    c=call('/api/close',{'id':t['id'],'kind':'no_report','note':'fixed','by':'Ravi',**({'task':task} if task else {})},tok=rv); return t,c
tA,cA=mk('VC-2','Coolant pump leaking',{'text':'Replace coolant pump','why':'Waiting for spare','exp':'2099-01-09'})
tB,cB=mk('VC-3','Spindle noise',{'text':'Change spindle bearing','why':'Needs vendor','exp':'2020-01-01'})
tC,cC=mk('VC-4','Door sensor')   # no task
tD,cD=mk('VC-5','Chiller alarm',{'text':'Clean chiller filter','why':'','exp':''}); call('/api/start',{'id':cD['task']['id']},tok=rv)
tE,cE=mk('VC-6','Belt slip',{'text':'Replace belt','why':'spare','exp':''}); call('/api/start',{'id':cE['task']['id']},tok=rv); call('/api/close',{'id':cE['task']['id'],'kind':'no_report','note':'done','by':'Ravi'},tok=rv)
st=call('/api/state',tok=op); cl={x['id']:x for x in st['closed']}
chk(len(cl[tA['id']].get('follow',[]))==1 and cl[tA['id']]['follow'][0]['status']=='open','state: pending task attached to closed breakdown')
chk('follow' not in cl[tC['id']],'state: no task = no follow field')
chk(cl[tE['id']]['follow'][0]['status']=='closed','state: finished task shows closed')
mw=call('/api/mywork?team=1',tok=rv); mm={x['id']:x for x in mw['tickets']}
chk(mm[tD['id']]['follow'][0]['status']=='working' and mm[tA['id']]['follow'][0]['text']=='Replace coolant pump','mywork: follow attached (working / open)')
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch()
    def ctx(): return br.new_context(viewport={'width':390,'height':2200}, device_scale_factor=1, is_mobile=True, has_touch=True, service_workers='block').new_page()
    def login(pg,page,u,pw):
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(S+'/'+page); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','%s'%u); pg.fill('#lvP','%s'%pw); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    pg=ctx(); login(pg,'floor.html','op1','op1234'); pg.evaluate("go('my')"); pg.wait_for_timeout(900)
    txt=pg.inner_text('body'); boxes=pg.evaluate("[...document.querySelectorAll('.lvtk')].map(e=>e.innerText)")
    def card(ref,L): return [x for x in L if ref in x]
    chk(any('FOLLOW-UP PENDING · 1 task' in x and 'Replace coolant pump' in x and 'Waiting for spare' in x and 'Expected 9 Jan' in x and 'Not started' in x for x in card('VC-2',boxes)),'floor: pending box with task, reason, expected date')
    chk(any('FOLLOW-UP OVERDUE' in x and 'Was expected 1 Jan' in x for x in card('VC-3',boxes)),'floor: overdue box (red)')
    chk(not any('FOLLOW-UP' in x for x in card('VC-4',boxes)),'floor: breakdown without a task has no box')
    chk(any('FOLLOW-UP IN PROGRESS' in x and 'Started' in x and 'Ravi' in x for x in card('VC-5',boxes)),'floor: in progress box with who started')
    chk(any('FOLLOW-UP DONE' in x and 'Replace belt' in x and 'Ravi' in x for x in card('VC-6',boxes)),'floor: done box')
    pg.screenshot(path='shots/real_follow_floor.png', full_page=True)
    pg2=ctx(); login(pg2,'maint.html','ravi','ravi123'); pg2.evaluate("go('mine')"); pg2.wait_for_timeout(1500)
    t2=pg2.inner_text('body'); chk('FOLLOW-UP PENDING' in t2 and 'Replace coolant pump' in t2 and 'FOLLOW-UP DONE' in t2,'maint Mine: boxes show on closed tiles')
    pg2.screenshot(path='shots/real_follow_mine.png', full_page=True)
    pg2.evaluate("go('team')"); pg2.wait_for_timeout(1500); t3=pg2.inner_text('body'); chk('FOLLOW-UP OVERDUE' in t3,'maint Team: boxes show on closed tiles')
    pg2.evaluate("sheetDetail(%s)"%json.dumps(tA['id'])); pg2.wait_for_timeout(1500); s=pg2.inner_text('#lvSheet'); chk('FOLLOW-UP PENDING' in s and 'Replace coolant pump' in s,'maint detail sheet: box at top')
    pg2.evaluate("sheetDetail(%s)"%json.dumps(tC['id'])); pg2.wait_for_timeout(1200); chk('FOLLOW-UP' not in pg2.inner_text('#lvSheet'),'detail sheet without task: no box')
    # finish task of A -> box turns to done
    call('/api/start',{'id':cA['task']['id']},tok=rv); call('/api/close',{'id':cA['task']['id'],'kind':'no_report','note':'fitted','by':'Ravi'},tok=rv)
    pg.evaluate("lvRefresh && lvRefresh()") if False else pg.reload(); pg.wait_for_timeout(2000); pg.evaluate("go('my')"); pg.wait_for_timeout(900)
    boxes=pg.evaluate("[...document.querySelectorAll('.lvtk')].map(e=>e.innerText)"); chk(any('FOLLOW-UP DONE' in x and 'Replace coolant pump' in x for x in card('VC-2',boxes)),'after the task is finished the pending box turns to done')
    # chained: finish D's task with another pending task
    k=cD['task']; c2=call('/api/close',{'id':k['id'],'kind':'no_report','note':'part','by':'Ravi','task':{'text':'Fit new filter','why':'spare','exp':''}},tok=rv)
    st=call('/api/state',tok=op); f=[x for x in st['closed'] if x['id']==tD['id']][0]['follow']; chk(len(f)==2 and sorted(x['status'] for x in f)==['closed','open'],'chained task keeps both under the original breakdown (%s)'%[x['status'] for x in f])
    pg.reload(); pg.wait_for_timeout(2000); pg.evaluate("go('my')"); pg.wait_for_timeout(900)
    boxes=pg.evaluate("[...document.querySelectorAll('.lvtk')].map(e=>e.innerText)"); b=card('VC-5',boxes); chk(any('FOLLOW-UP PENDING · 1 task' in x and 'Fit new filter' in x and '1 earlier task done' in x for x in b),'chained: new pending shown, earlier task counted as done')
    chk('App version 10.4' in pg.inner_text('body'),'app version 10.4')
    chk(not errs,'no page errors '+str(errs[:2]))
print('ALL PASS' if ok else 'SOME FAILED')
