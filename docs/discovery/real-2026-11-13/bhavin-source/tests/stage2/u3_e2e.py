import json, urllib.request as U
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'; OUT='/home/claude/s2/shots/'
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try: return json.loads(U.urlopen(r).read())
    except U.HTTPError as e: return {'status':e.code, **json.loads(e.read() or b'{}')}
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123'); am=lg('amit','amit123')
T={}
for m,pr in [('VC-1','Spindle noise'),('VC-2','Coolant leak'),('VC-3','ATC alarm'),('TC-1','Chuck not clamping'),('TC-2','Hydraulic low'),('TC-3','Door switch')]:
    T[m]=call('/api/down',{'machine':m,'problem':pr,'kind':'stopped'},tok=op)['ticket']['id']
call('/api/down',{'kind':'general','location':'Store','workType':'Electrical','problem':'Fan not working','urgent':True},tok=op)
# ravi closes VC-1 (report) and VC-2 (no report); amit starts VC-3, transfers it, ravi picks up and closes
call('/api/start',{'id':T['VC-1']},tok=rv); call('/api/close',{'id':T['VC-1'],'kind':'report','report':{'ca':'Replaced spindle bearing'}},tok=rv)
call('/api/start',{'id':T['VC-2']},tok=rv); call('/api/close',{'id':T['VC-2'],'kind':'no_report','note':'Tightened hose clamp'},tok=rv)
call('/api/start',{'id':T['VC-3']},tok=am); call('/api/transfer',{'id':T['VC-3'],'note':'Sensor checked, replace next'},tok=am)
call('/api/start',{'id':T['VC-3']},tok=rv); call('/api/close',{'id':T['VC-3'],'kind':'no_report','note':'Proximity sensor replaced'},tok=rv)
# open work: ravi on TC-1, amit on TC-2 (paused, assigned to ravi), TC-3 not started
call('/api/start',{'id':T['TC-1']},tok=rv); call('/api/start',{'id':T['TC-2']},tok=am); call('/api/pause',{'id':T['TC-2'],'reason':'Waiting for spare','assign':'Ravi'},tok=am)
w=call('/api/mywork',tok=rv); chk(w.get('all') is False and len(w['tickets'])==3,'ravi has 3 closed jobs: %s'%[t['machine'] for t in w.get('tickets',[])])
chk(any(t['done']=='Replaced spindle bearing' for t in w['tickets']),'done text from report')
wa=call('/api/mywork',tok=am); chk([t['machine'] for t in wa['tickets']]==['VC-3'],'amit sees the transferred job he worked on')
chk(call('/api/mywork',tok=op).get('status')==403,'shop floor cannot read mywork')
with sync_playwright() as p:
    br=p.chromium.launch(); errs=[]
    def phone(u,pw,page='maint'):
        c=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(S+'/'+page+'.html'); pg.wait_for_selector('#lvLogin')
        chk(pg.evaluate("getComputedStyle(document.getElementById('formScreen')).display")=='none','old form hidden at start ('+u+')')
        pg.fill('#lvU',u); pg.fill('#lvP',pw); pg.click('#lvGo'); pg.wait_for_timeout(1800); return c,pg
    c,pg=phone('ravi','ravi123')
    chk('Team' in pg.inner_text('#lvTabs'),'Team tab present')
    pg.click('[data-a="tab"][data-v="mine"]'); pg.wait_for_timeout(1500); t=pg.inner_text('#lvBody')
    chk('closed in the last 30 days (3)' in t.lower() and 'This month: 3 jobs' in t,'Mine closed list + month total')
    chk('Replaced spindle bearing' not in t and 'Done:' not in t,'closed cards are short (what was done only inside the ticket)')
    chk('Show everyone' not in t,'no show-everyone toggle on a personal login')
    pg.evaluate("document.getElementById('lvBody').scrollTop=600"); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'u1_mine.png')
    pg.click('[data-a="tab"][data-v="team"]'); pg.wait_for_timeout(500); t=pg.inner_text('#lvBody')
    chk('working now (1 person)' in t.lower() and 'Ravi' in t and 'TC-1' in t,'Team: Ravi on TC-1')
    chk('waiting (1)' in t.lower() and 'assigned to Ravi' in t,'Team: waiting assigned')
    chk('not started (2)' in t.lower() and 'TC-3' in t and 'Store' in t,'Team: not started incl. work request')
    pg.screenshot(path=OUT+'u2_team.png')
    pg.click('.lvtm[data-v="%s"]'%T['TC-3']); pg.wait_for_timeout(400); chk(pg.is_visible('#lvSheet [data-a="startask"]'),'tap job opens its sheet with Start work')
    pg.click('[data-a="closesheet"]'); pg.wait_for_timeout(200)
    pg.click('[data-a="tab"][data-v="cat"]'); pg.wait_for_timeout(300)
    pg.fill('#lvsq','3'); pg.dispatch_event('#lvsq','input'); pg.wait_for_timeout(200); t=pg.inner_text('#lvsres')
    chk('VC-3' in t and 'TC-3' in t and not pg.is_visible('#lvcatbody'),'search "3" finds VC-3 and TC-3, groups hidden')
    pg.fill('#lvsq','tc 3'); pg.dispatch_event('#lvsq','input'); pg.wait_for_timeout(200); t=pg.inner_text('#lvsres')
    chk('TC-3' in t and 'Already reported' in t and 'VC-3' not in t,'"tc 3" finds TC-3, shows already reported')
    pg.screenshot(path=OUT+'u3_search.png')
    pg.fill('#lvsq','vc5'); pg.dispatch_event('#lvsq','input'); pg.wait_for_timeout(200); pg.click('#lvsres [data-v="VC-5"]'); pg.wait_for_timeout(300)
    chk(pg.is_visible('text=What is the situation?'),'pick from search goes to the situation step')
    c.close()
    c,pg=phone('team','team12'); pg.click('[data-a="tab"][data-v="mine"]'); pg.wait_for_timeout(1500); t=pg.inner_text('#lvBody')
    chk('team work' in t and 'Ravi' in t and 'closed in the last 30 days (3)' in t.lower(),'shared phone sees the whole team closed list with names'); c.close()
    c,pg=phone('op1','op1234','floor'); pg.fill('#lvsq','17'); pg.dispatch_event('#lvsq','input'); pg.wait_for_timeout(200)
    chk('No machine matches' in pg.inner_text('#lvsres'),'floor search shows no-match message'); c.close()
    print('page errors:', errs); br.close()
print('ALL OK' if ok and not errs else 'FAIL')
