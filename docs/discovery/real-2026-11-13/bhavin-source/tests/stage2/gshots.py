import json, urllib.request as U
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'; O='/home/claude/guide/shots/'
def call(path, body=None, tok=None, key=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    if key: h['X-Key']=key
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    return json.loads(U.urlopen(r).read())
call('/api/users',dict(username='kiran',name='Kiran',role='maint',password='kiran1'),key='k123')
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
A=call('/api/down',{'machine':'VC-1','problem':'Spindle noise, machine stopped','kind':'stopped'},tok=op)['ticket']['id']
Bt=call('/api/down',{'machine':'VC-2','problem':'Coolant pressure low, need electrician help','kind':'support'},tok=op)['ticket']['id']
C=call('/api/down',{'machine':'VC-3','problem':'Axis alarm, reset done, checking','kind':'stopped'},tok=op)['ticket']['id']
call('/api/start',{'id':A},tok=rv); call('/api/start',{'id':C},tok=rv); call('/api/running',{'id':C},tok=rv)
def phone(br,u,pw):
    c=br.new_context(viewport={'width':390,'height':760}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id='Asia/Kolkata'); pg=c.new_page()
    pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU',u); pg.fill('#lvP',pw); pg.click('#lvGo'); pg.wait_for_timeout(1800); return pg
with sync_playwright() as p:
    br=p.chromium.launch()
    rp=phone(br,'ravi','ravi123'); rp.wait_for_timeout(500)
    rp.screenshot(path=O+'s1_open.png')
    am=phone(br,'amit','amit123'); am.evaluate("sheetDetail(%s)"%json.dumps(A)); am.wait_for_timeout(1300)
    am.eval_on_selector('#lvSheet [data-a="joinask"]','b=>b.scrollIntoView({block:"center"})'); am.wait_for_timeout(300); am.screenshot(path=O+'s2_details_join.png')
    am.click('#lvSheet [data-a="joinask"]'); am.wait_for_timeout(400); am.click('[data-a="jrole"][data-v="support"]'); am.wait_for_timeout(300); am.screenshot(path=O+'s3_join_sheet.png')
    am.click('[data-a="joingo"]'); am.wait_for_timeout(1800)
    rp.evaluate("lvRefresh().then(()=>go('mine'))"); rp.wait_for_timeout(1500)
    rp.click('[data-a="joinask"][data-v="%s"]'%A); rp.wait_for_timeout(400); rp.screenshot(path=O+'s4_add_person.png')
    rp.evaluate("closeSheet&&closeSheet()"); rp.wait_for_timeout(400)
    rp.evaluate("document.querySelector('[data-a=\"runask\"]').scrollIntoView({block:'center'})"); rp.wait_for_timeout(300); rp.screenshot(path=O+'s5_mine_card.png')
    rp.click('[data-a="runask"][data-v="%s"]'%A); rp.wait_for_timeout(400); rp.screenshot(path=O+'s6_running_again.png')
    rp.click('[data-a="rungo"]'); rp.wait_for_timeout(1800)
    rp.evaluate("go('live')"); rp.wait_for_timeout(700); rp.screenshot(path=O+'s7_live.png')
    am.evaluate("lvRefresh().then(()=>go('mine'))"); am.wait_for_timeout(1300); am.click('[data-a="leaveask"][data-v="%s"]'%A); am.wait_for_timeout(400); am.screenshot(path=O+'s8_leave.png')
    am.fill('#lvwhy','Called to VC-7'); am.dispatch_event('#lvwhy','input'); am.click('[data-a="leavego"]'); am.wait_for_timeout(1800)
    rp.evaluate("lvRefresh().then(()=>go('mine'))"); rp.wait_for_timeout(1200); rp.click('[data-a="toclose"][data-v="%s"]'%A); rp.wait_for_timeout(300); rp.click('[data-a="closego"]'); rp.wait_for_timeout(900)
    rp.locator('#lvMan').scroll_into_view_if_needed(); rp.wait_for_timeout(300); rp.screenshot(path=O+'s9_chips.png')
    br.close()
print('ok')
