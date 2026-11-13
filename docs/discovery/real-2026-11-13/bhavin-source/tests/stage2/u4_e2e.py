import json, urllib.request as U, io
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
S='http://localhost:8787'; B='http://localhost:8799'; OUT='/home/claude/s2/shots/'
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    return json.loads(U.urlopen(r).read())
# shift timings + usual shifts in the company settings (as the platform sends them)
cfg=call('/api/config',tok=call('/api/login',{'username':'ravi','password':'ravi123'})['token'])['config']
cfg['shiftTimes']=[{'name':'1','start':'08:00','end':'18:00'},{'name':'2','start':'18:00','end':'06:00'}]; cfg['teamShifts']={'Ravi':'1','Amit':'2'}
r=U.Request(B+'/api/config',data=json.dumps({'config':cfg,'fp':'fp9'}).encode(),headers={'X-Client':'tst','X-Key':'k123','X-Config-Token':'ct_'+'a'*40,'Content-Type':'application/json'},method='POST'); U.urlopen(r)
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123'); am=lg('amit','amit123')
T={}
for m,pr in [('VC-1','Spindle bearing noise ₹ “heavy” — સ્પિન્ડલ'),('VC-2','Coolant leak'),('VC-3','ATC alarm 2051'),('TC-1','Chuck not clamping')]:
    T[m]=call('/api/down',{'machine':m,'problem':pr,'kind':'stopped'},tok=op)['ticket']
gw=call('/api/down',{'kind':'general','location':'Store','workType':'Electrical','problem':'Fan not working'},tok=op)['ticket']
call('/api/start',{'id':T['VC-1']['id']},tok=rv); call('/api/close',{'id':T['VC-1']['id'],'kind':'report','report':{'ca':'Replaced spindle bearing 7014','db':'Ravi','mc':'M','bc':'M','sp':'Bearing 7014 Rs 2,400'}},tok=rv)
call('/api/start',{'id':T['VC-3']['id']},tok=am); call('/api/transfer',{'id':T['VC-3']['id'],'note':'Sensor checked, replace next','to':'Ravi'},tok=am); call('/api/start',{'id':T['VC-3']['id']},tok=rv)
call('/api/pause',{'id':T['VC-3']['id'],'reason':'Waiting for spare','note':'Prox sensor ordered'},tok=rv)
call('/api/start',{'id':gw['id']},tok=am); call('/api/close',{'id':gw['id'],'kind':'done','note':'Fan replaced'},tok=am)
call('/api/start',{'id':T['VC-2']['id']},tok=am)
chk(T['VC-1']['ref'].startswith('BD-') and gw['ref'].startswith('WR-'),'numbers: %s, %s'%(T['VC-1']['ref'],gw['ref']))
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch()
    def phone(u,pw,page='maint'):
        c=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(S+'/'+page+'.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU',u); pg.fill('#lvP',pw); pg.click('#lvGo'); pg.wait_for_timeout(1800); return c,pg
    c,pg=phone('ravi','ravi123')
    t=pg.inner_text('#lvBody'); chk(T['TC-1']['ref'] in t,'number on Open cards')
    # details of a waiting ticket (from Open)
    pg.click('.lvtk[data-v="%s"] .pr'%T['VC-3']['id']); pg.wait_for_timeout(1200); s=pg.inner_text('#lvSheet')
    chk(T['VC-3']['ref'] in s and 'Full history' in s and 'Transferred' in s and 'Picked up' in s and 'Paused' in s,'details: number + full history (transfer, pick up, pause)')
    chk('Amit' in s and 'Who worked on it' in s,'details: who worked')
    chk(pg.query_selector('#lvSheet [data-a="resumeask"]') is not None,'details keep the action buttons')
    pg.screenshot(path=OUT+'v1_detail_open.png'); pg.click('[data-a="closesheet"]'); pg.wait_for_timeout(200)
    # Mine: closed list -> details with report
    pg.click('[data-a="tab"][data-v="mine"]'); pg.wait_for_timeout(1500)
    chk(pg.is_visible('text=Download my day report'),'My day report button')
    pg.click('.lvtm[data-v="%s"]'%T['VC-1']['id']); pg.wait_for_timeout(1200); s=pg.inner_text('#lvSheet')
    chk('Replaced spindle bearing 7014' in s and 'Report' in s and 'Closed' in s and T['VC-1']['ref'] in s,'closed details show the report')
    pg.screenshot(path=OUT+'v2_detail_closed.png'); pg.click('[data-a="closesheet"]'); pg.wait_for_timeout(200)
    # my day report
    pg.click('[data-a="dayask"][data-v="me"]'); pg.wait_for_timeout(300)
    chk(pg.input_value('#lvds')=='1','shift pre-filled from usual shift (Ravi = 1)')
    pg.select_option('#lvds',''); pg.wait_for_timeout(150); chk('00:00' in pg.inner_text('#lvdwin'),'no shift = calendar day: '+pg.inner_text('#lvdwin'))
    pg.screenshot(path=OUT+'v3_day_sheet.png')
    pg.click('[data-a="daygo"]'); pg.wait_for_timeout(2500); chk(pg.is_visible('text=Report ready'),'report ready')
    with pg.expect_download() as d: pg.click('[data-a="daysave"]')
    d.value.save_as('/tmp/day_me.pdf'); txt=' '.join(''.join(pg2.extract_text() for pg2 in PdfReader('/tmp/day_me.pdf').pages).split())
    chk('Daily Work Report' in txt and 'Ravi' in txt and T['VC-1']['ref'] in txt and 'Replaced spindle bearing 7014' in txt,'my PDF: header, number, what was done')
    chk(T['VC-3']['ref'] in txt and 'waiting' in txt.lower() and 'Pending at the end' in txt,'my PDF: paused job in pending section')
    chk('Rs' in txt and '"heavy"' in txt and '[local-language text]' in txt,'my PDF: ₹ and curly quotes made readable')
    pg.click('[data-a="closesheet"]'); pg.wait_for_timeout(200)
    # Team tab
    pg.click('[data-a="tab"][data-v="team"]'); pg.wait_for_timeout(1800); t=pg.inner_text('#lvBody')
    chk('closed in the last 30 days (2)' in t.lower() and 'This month:' in t,'Team: closed list + month line: ')
    chk(gw['ref'] in t and T['VC-1']['ref'] in t,'Team list shows numbers')
    pg.select_option('select#tf','Amit'); pg.wait_for_timeout(300); t=pg.inner_text('#lvBody')
    chk(gw['ref'] in t and T['VC-1']['ref'] not in t.lower().split('closed in the last 30 days')[1].upper(),'filter chip: Amit only')
    pg.evaluate("document.getElementById('lvBody').scrollTop=9999"); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'v4_team_closed.png')
    pg.evaluate("document.getElementById('lvBody').scrollTop=0")
    pg.click('[data-a="dayask"][data-v="team"]'); pg.wait_for_timeout(300); pg.click('[data-a="daygo"]'); pg.wait_for_timeout(2500)
    with pg.expect_download() as d: pg.click('[data-a="daysave"]')
    d.value.save_as('/tmp/day_team.pdf'); txt=' '.join(''.join(x.extract_text() for x in PdfReader('/tmp/day_team.pdf').pages).split())
    chk('Team Daily Work Report' in txt and 'Team summary' in txt and 'Ravi' in txt and 'Amit' in txt and 'Team total' in txt,'team PDF: summary per person and total')
    chk(gw['ref'] in txt and 'Fan replaced' in txt,'team PDF: work request with what was done')
    c.close()
    # shared maintenance phone: day report asks for the person, shift follows their usual shift
    c,pg=phone('team','team12'); pg.click('[data-a="tab"][data-v="mine"]'); pg.wait_for_timeout(800); pg.click('[data-a="dayask"][data-v="me"]'); pg.wait_for_timeout(300)
    pg.select_option('#lvdw','Amit'); pg.wait_for_timeout(300); chk(pg.input_value('#lvds')=='2' and '18:00' in pg.inner_text('#lvdwin'),'shared phone: Amit -> Shift 2, 18:00 window: '+pg.inner_text('#lvdwin'))
    c.close()
    # shop floor: own complaint details, sent screen number, no actions
    c,pg=phone('op1','op1234','floor'); pg.click('[data-a="tab"][data-v="my"]'); pg.wait_for_timeout(600)
    pg.click('.lvtk[data-v="%s"] .pr'%T['VC-1']['id']); pg.wait_for_timeout(1200); s=pg.inner_text('#lvSheet')
    chk('Replaced spindle bearing 7014' in s and T['VC-1']['ref'] in s and pg.query_selector('#lvSheet [data-a="startask"]') is None,'floor sees own complaint details, no actions')
    pg.click('[data-a="closesheet"]'); pg.click('[data-a="tab"][data-v="cat"]'); pg.wait_for_timeout(300)
    pg.fill('#lvsq','vc6'); pg.dispatch_event('#lvsq','input'); pg.wait_for_timeout(200); pg.click('#lvsres [data-v="VC-6"]'); pg.click('[data-a="kind"][data-v="stopped"]'); pg.wait_for_timeout(300)
    pg.fill('#d_problem','Hydraulic pressure low'); pg.dispatch_event('#d_problem','input'); pg.click('#lvsend'); pg.wait_for_timeout(1500)
    chk('Ticket number BD-' in pg.inner_text('#lvBody'),'sent screen shows the ticket number')
    wa=pg.evaluate("waText(A.st.last)"); chk(wa.startswith('BD-'),'WhatsApp message starts with the number: '+wa[:30])
    pg.screenshot(path=OUT+'v5_sent.png'); c.close()
    # report form PDF carries the ticket number
    c,pg=phone('amit','amit123'); pg.click('[data-a="tab"][data-v="mine"]'); pg.wait_for_timeout(800)
    pg.click('[data-a="toclose"][data-v="%s"]'%T['VC-2']['id']); pg.wait_for_timeout(300); pg.click('[data-a="closego"]'); pg.wait_for_timeout(700)
    for sel in ['#f_shift','#f_observedBy','#f_maintCode','#f_breakdownCategory']:
        opts=pg.eval_on_selector(sel,"e=>[...e.options].map(o=>o.value).filter(Boolean)")
        if opts and not pg.input_value(sel): pg.select_option(sel, opts[0])
    pg.fill('#f_correctiveAction','Hose clamp tightened')
    with pg.expect_download(timeout=20000) as d: pg.click('#submitBtn')
    d.value.save_as('/tmp/bd.pdf'); txt=''.join(x.extract_text() for x in PdfReader('/tmp/bd.pdf').pages)
    chk('TICKET' in txt and T['VC-2']['ref'] in txt,'breakdown PDF shows the ticket number')
    pg.wait_for_timeout(1500); chk('Ticket closed' in pg.inner_text('#successScreen'),'ticket closed after the report')
    c.close(); br.close()
print('page errors:', errs); print('ALL OK' if ok and not errs else 'FAIL')
