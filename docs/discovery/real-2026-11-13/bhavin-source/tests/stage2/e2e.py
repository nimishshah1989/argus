import json, time, urllib.request as U
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'; OUT='/home/claude/s2/shots/'
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def api(path, body=None):
    h={'X-Client':'tst','Content-Type':'application/json','X-Key':'k123'}
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    return json.loads(U.urlopen(r).read())
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch()
    def phone():
        c=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return c,pg
    def login(pg,u,pw):
        pg.fill('#lvU',u); pg.fill('#lvP',pw); pg.click('#lvGo'); pg.wait_for_timeout(1200)
    # ---- floor, personal login with a job title
    c,pg=phone(); pg.goto(S+'/floor.html'); pg.wait_for_selector('#lvLogin')
    pg.wait_for_timeout(500); pg.screenshot(path=OUT+'1_login.png')
    chk('Test Co' in pg.inner_text('#lvCo'),'login shows company name from server')
    login(pg,'op1','wrong'); chk('Wrong username or password' in pg.inner_text('#lvLoginMsg'),'wrong password message')
    pg.fill('#lvP','op1234'); pg.click('#lvGo'); pg.wait_for_timeout(1500)
    chk(pg.is_visible('text=Which machine?'),'floor login -> report screen')
    chk(pg.is_visible('text=Signed in as'),'account line shown')
    pg.screenshot(path=OUT+'2_floor_home.png', full_page=False)
    pg.click('[data-a="cat"] >> nth=0'); pg.wait_for_timeout(300); pg.click('[data-a="pickm"][data-v="VC-3"]'); pg.wait_for_timeout(300)
    pg.click('[data-a="kind"][data-v="stopped"]'); pg.wait_for_timeout(300)
    chk(pg.is_visible('text=Reporting as') and pg.query_selector('#lvname') is None,'no name box for a personal login')
    pg.fill('#d_problem','Spindle noise'); pg.dispatch_event('#d_problem','input'); pg.wait_for_timeout(200)
    pg.screenshot(path=OUT+'3_floor_problem.png')
    pg.click('#lvsend'); pg.wait_for_timeout(1500)
    chk(pg.is_visible('text=Sent to maintenance'),'sent')
    st=api('/api/state'); t=[x for x in st['open'] if x['machine']=='VC-3'][0]
    chk(t['reportedBy']=='Suresh (Operator)','server recorded Suresh (Operator)')
    chk(pg.is_visible('text=Cancel this ticket'),'own ticket can be cancelled')
    chk('My complaints' in pg.inner_text('#lvTabs') and 'Live' not in pg.inner_text('#lvTabs'),'floor tabs: Report + My complaints, no Live')
    c.close()
    # ---- floor, personal login without title must pick role
    c,pg=phone(); pg.goto(S+'/floor.html'); pg.wait_for_selector('#lvLogin'); login(pg,'op2','op2345')
    pg.click('[data-a="cat"] >> nth=0'); pg.wait_for_timeout(300); pg.click('[data-a="pickm"][data-v="VC-5"]'); pg.click('[data-a="kind"][data-v="support"]'); pg.wait_for_timeout(300)
    chk(pg.is_visible('#lvby'),'role chips for login without title')
    pg.fill('#d_problem','Coolant low'); pg.dispatch_event('#d_problem','input'); pg.click('[data-a="by"][data-v="Setter"]'); pg.click('#lvsend'); pg.wait_for_timeout(1500)
    st=api('/api/state'); t5=[x for x in st['open'] if x['machine']=='VC-5'][0]; chk(t5['reportedBy']=='Mona (Setter)','server recorded Mona (Setter)')
    # VC-3 ticket was raised by op1, op2 cannot cancel it
    pg.click('text=Report another machine'); pg.wait_for_timeout(300); pg.click('[data-a="cat"] >> nth=0'); pg.wait_for_timeout(300); pg.click('[data-a="pickm"][data-v="VC-3"]'); pg.wait_for_timeout(400)
    chk(not pg.is_visible('text=Cancel ticket'),'cannot cancel someone else\'s ticket')
    c.close()
    # ---- shared floor phone keeps name box
    c,pg=phone(); pg.goto(S+'/floor.html'); pg.wait_for_selector('#lvLogin'); login(pg,'cell3','cell33')
    pg.click('[data-a="cat"] >> nth=0'); pg.wait_for_timeout(300); pg.click('[data-a="pickm"][data-v="VC-6"]'); pg.click('[data-a="kind"][data-v="stopped"]'); pg.wait_for_timeout(300)
    chk(pg.query_selector('#lvname') is not None,'shared login asks for the name')
    c.close()
    # ---- maintenance, personal
    c,pg=phone(); pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); login(pg,'ravi','ravi123'); pg.wait_for_timeout(800)
    chk(pg.is_visible('text=Breakdowns (2)'),'maint sees open breakdowns')
    pg.screenshot(path=OUT+'4_maint_open.png')
    pg.click('[data-a="startask"][data-v="%s"]'%t['id']); pg.wait_for_timeout(300)
    chk(pg.query_selector('select#lvwho') is None and pg.is_visible('#lvSheet >> text=Recorded as'),'start sheet has no name dropdown')
    pg.screenshot(path=OUT+'5_maint_start.png')
    pg.click('[data-a="startgo"]'); pg.wait_for_timeout(1500)
    chk(pg.is_visible('text=Mine') ,'moved to Mine')
    pg.click('[data-a="pauseask"][data-v="%s"]'%t['id']); pg.wait_for_timeout(300); pg.select_option('#lvrsn','Waiting for spare'); pg.click('[data-a="pausego"]'); pg.wait_for_timeout(1500)
    st=api('/api/state'); x=[y for y in st['open'] if y['id']==t['id']][0]; chk(x['status']=='waiting' and x['startedBy']=='Ravi' and x['pausedBy']=='Ravi','start and pause recorded as Ravi')
    c.close()
    # ---- shared maintenance phone picks the name
    c,pg=phone(); pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); login(pg,'team','team12'); pg.wait_for_timeout(800)
    pg.click('[data-a="resumeask"][data-v="%s"]'%t['id']); pg.wait_for_timeout(300)
    chk(pg.query_selector('select#lvwho') is not None,'shared maint phone has name dropdown')
    pg.select_option('#lvwho','Amit'); pg.click('[data-a="resumego"]'); pg.wait_for_timeout(1500)
    st=api('/api/state'); x=[y for y in st['open'] if y['id']==t['id']][0]; chk(x['status']=='working' and x['startedBy']=='Amit','shared phone recorded Amit')
    # change password + sign out
    pg.click('[data-a="tab"][data-v="open"]'); pg.wait_for_timeout(300); pg.click('.lvme'); pg.click('[data-a="pwask"]'); pg.fill('#lvpo','team12'); pg.fill('#lvpn','team99'); pg.fill('#lvpn2','team99'); pg.click('[data-a="pwgo"]'); pg.wait_for_timeout(1200)
    chk(pg.is_visible('text=Password changed'),'password changed on phone')
    pg.click('.lvme'); pg.click('[data-a="signoutask"]'); pg.click('[data-a="signoutgo"]'); pg.wait_for_timeout(2000)
    chk(pg.is_visible('#lvLogin'),'signed out -> sign-in screen')
    chk(pg.evaluate("localStorage.getItem('bd_tok_tst')") is None and pg.evaluate("localStorage.getItem('bd_cfg_tst')") is None,'token and company data cleared')
    login(pg,'team','team99'); chk(pg.is_visible('text=Breakdowns'),'new password works')
    c.close()
    # ---- board role on a phone page: live only
    c,pg=phone(); pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); login(pg,'tvboard','tvtv12'); pg.wait_for_timeout(800)
    chk(pg.is_visible('text=Live status') and pg.query_selector('#lvTabs button') is None,'board login on phone -> live only')
    pg.click('[data-a="tile"][data-v="VC-3"]'); pg.wait_for_timeout(300)
    chk(pg.query_selector('#lvSheet [data-a="startask"]') is None and pg.query_selector('#lvSheet [data-a="cancelask"]') is None,'board sees no action buttons')
    pg.screenshot(path=OUT+'6_board_phone.png')
    c.close()
    # ---- TV board
    c=br.new_context(viewport={'width':1600,'height':900}); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(S+'/live.html'); pg.wait_for_timeout(800); chk(pg.is_visible('#login form'),'board asks to sign in'); pg.screenshot(path=OUT+'7_tv_login.png')
    pg.fill('#lu','tvboard'); pg.fill('#lp','tvtv12'); pg.click('#lg'); pg.wait_for_timeout(2000)
    chk(not pg.is_visible('#login') and 'VC-3' in pg.inner_text('#wall'),'board shows machines after sign-in')
    pg.screenshot(path=OUT+'8_tv.png')
    # switch the login off from the platform -> board signs out at next refresh
    api('/api/users', dict(username='tvboard',name='Board TV',role='board',active=False))
    pg.evaluate('poll()'); pg.wait_for_timeout(1000); chk(pg.is_visible('#login form'),'switched-off board is signed out')
    c.close()
    # ---- link without company code, no saved one
    c,pg=phone(); pg.goto(S+'/index.html?c=nosuch'); pg.wait_for_timeout(1500); chk(pg.is_visible("text=company code the server does not know"),'unknown company message'); c.close()
    br.close()
print('page errors:', errs[:5])
print('ALL OK' if ok and not errs else 'CHECK FAILURES')
