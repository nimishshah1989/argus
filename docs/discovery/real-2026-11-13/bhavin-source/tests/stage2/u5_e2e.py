import json, urllib.request as U
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
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
    except U.HTTPError as e: return {'status':e.code}
call('/api/users',dict(username='sup1',name='Mehul',role='supervisor',password='sup123'),key='k123')
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123'); am=lg('amit','amit123'); sp=lg('sup1','sup123')
a=call('/api/down',{'machine':'VC-1','problem':'Ravi job','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':a['id']},tok=rv); call('/api/close',{'id':a['id'],'kind':'no_report','note':'fixed by ravi'},tok=rv)
b=call('/api/down',{'machine':'VC-2','problem':'Amit job','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':b['id']},tok=am); call('/api/close',{'id':b['id'],'kind':'no_report','note':'fixed by amit'},tok=am)
import datetime as dt
now=dt.datetime.now(dt.UTC); f=(now-dt.timedelta(hours=12)).strftime('%Y-%m-%dT%H:%M:%SZ'); t=(now+dt.timedelta(hours=12)).strftime('%Y-%m-%dT%H:%M:%SZ')
r=call('/api/dayreport?from=%s&to=%s&who=Ravi'%(f,t),tok=sp); chk([p['name'] for p in r.get('people',[])]==['Ravi'],'supervisor can make Ravi\'s report (server)')
r=call('/api/dayreport?from=%s&to=%s&who=Ravi'%(f,t),tok=am); chk([p['name'] for p in r.get('people',[])]==['Amit'],'maintenance login asking for Ravi still gets only its own')
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch()
    def phone(u,pw):
        c=br.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, accept_downloads=True); pg=c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU',u); pg.fill('#lvP',pw); pg.click('#lvGo'); pg.wait_for_timeout(1800); return c,pg
    # supervisor picks a person in the day report
    c,pg=phone('sup1','sup123'); pg.click('[data-a="tab"][data-v="mine"]'); pg.wait_for_timeout(800)
    chk(pg.is_visible('text=Download day report'),'supervisor sees "Day report"'); pg.click('[data-a="dayask"][data-v="me"]'); pg.wait_for_timeout(300)
    opts=pg.eval_on_selector('#lvdw',"e=>[...e.options].map(o=>o.text)"); chk(opts[0]=='Me (Mehul)' and 'Ravi' in opts,'Whose report: Me first, then the team: %s'%opts[:4])
    pg.select_option('#lvdw','Ravi'); pg.wait_for_timeout(200); pg.click('[data-a="daygo"]'); pg.wait_for_timeout(2500)
    with pg.expect_download() as d: pg.click('[data-a="daysave"]')
    d.value.save_as('/tmp/sup_ravi.pdf'); txt=' '.join(''.join(x.extract_text() for x in PdfReader('/tmp/sup_ravi.pdf').pages).split())
    chk('Ravi' in txt and a['ref'] in txt and b['ref'] not in txt,'PDF is Ravi\'s report only'); c.close()
    # maintenance login: own report only, no picker
    c,pg=phone('amit','amit123'); pg.click('[data-a="tab"][data-v="mine"]'); pg.wait_for_timeout(800); pg.click('[data-a="dayask"][data-v="me"]'); pg.wait_for_timeout(300)
    chk(pg.query_selector('#lvdw') is None and pg.is_visible('text=My day report'),'maintenance login: own report, no picker'); pg.click('[data-a="closesheet"]')
    # closed list: not reloaded for someone else's close, reloaded after own close and on Refresh
    pg.click('[data-a="tab"][data-v="team"]'); pg.wait_for_timeout(1500); t0=pg.inner_text('#lvBody')
    chk('Refresh' in t0 and 'Refreshes whenever you open this page' in t0,'Team closed list shows Refresh and "whenever you open"')
    n0=t0.lower().count('closed ')
    x=call('/api/down',{'machine':'VC-3','problem':'Closed elsewhere','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':x['id']},tok=rv); call('/api/close',{'id':x['id'],'kind':'no_report','note':'elsewhere'},tok=rv)
    pg.evaluate('lvRefresh()'); pg.wait_for_timeout(1200); chk(x['ref'] not in pg.inner_text('#lvBody'),'a job closed on another phone does not reload the list every refresh')
    pg.click('[data-a="twkref"]'); pg.wait_for_timeout(1500); chk(x['ref'] in pg.inner_text('#lvBody'),'Refresh brings it in')
    y=call('/api/down',{'machine':'VC-4','problem':'Amit closes here','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':y['id']},tok=am); pg.evaluate('lvRefresh()'); pg.wait_for_timeout(1000)
    pg.evaluate("A.st.tid=%s"%json.dumps(y['id'])); pg.evaluate("act('noreport', %s)"%json.dumps(y['id'])); pg.wait_for_timeout(300); pg.fill('#lvwhy','fixed here'); pg.click('[data-a="noreportgo"]'); pg.wait_for_timeout(1500)
    pg.click('[data-a="tab"][data-v="mine"]'); pg.wait_for_timeout(1800); chk(y['ref'] in pg.inner_text('#lvBody'),'a job closed on this phone shows in Mine straight away')
    pg.click('[data-a="tab"][data-v="team"]'); pg.wait_for_timeout(1800); chk(y['ref'] in pg.inner_text('#lvBody'),'... and in Team straight away')
    c.close(); br.close()
print('page errors', errs); print('ALL OK' if ok and not errs else 'FAIL')
