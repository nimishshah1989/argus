import json, zipfile, io, urllib.request as U
from playwright.sync_api import sync_playwright
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':1400,'height':950}, accept_downloads=True); pg=c.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    def stub(route):
        u=route.request.url
        body='window.Chart=function(){return {destroy(){},update(){},resize(){}}};window.Chart.register=function(){};window.Chart.defaults={plugins:{legend:{labels:{}},tooltip:{}},font:{},scale:{grid:{}}};' if 'chart' in u.lower() else (open('/tmp/xl/node_modules/xlsx/dist/xlsx.full.min.js').read() if 'xlsx' in u else '')
        route.fulfill(status=200, content_type='application/javascript', body=body)
    pg.route('https://cdnjs.cloudflare.com/**', stub); pg.route('https://cdn.jsdelivr.net/**', stub)
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(2500)
    pg.evaluate("""()=>{ const s=state.settings; s.btCompany='Test Co'; s.btClientId='tst'; s.btApi='http://localhost:8799'; s.btSite='http://localhost:8787'; persist(); localStorage.setItem('bt_key_tst','k123');
      if(!s.team.some(t=>t.name==='Kiran')) s.team.push({name:'Kiran', type:'Team', status:'Active'}); persist(); }""")
    pg.evaluate("setTab='people'; nav('settings')"); pg.wait_for_timeout(2000)
    txt=pg.inner_text('#page-settings')
    chk('Logins (7)' in txt,'lists the 7 logins from the server')
    chk('Kiran' in pg.inner_text('#page-settings'),'suggests team member without login')
    pg.screenshot(path='/home/claude/s2/shots/p1_people.png', full_page=True)
    pg.click("button:has-text('Kiran')"); pg.wait_for_timeout(300)
    chk(pg.input_value('#ppl_u')=='kiran' and len(pg.input_value('#ppl_p'))==7,'prefill username and generated password')
    pw=pg.input_value('#ppl_p')
    pg.click("button:has-text('Add login')"); pg.wait_for_timeout(1500)
    txt=pg.inner_text('#page-settings')
    chk('Send this to Kiran' in txt and 'Password: '+pw in txt and 'maint.html?c=tst' in txt,'share box with link, username, password')
    chk('Logins (8)' in txt,'list refreshed')
    # sign in with it on the API
    r=U.urlopen(U.Request('http://localhost:8799/api/login', data=json.dumps({'username':'kiran','password':pw}).encode(), headers={'X-Client':'tst','Content-Type':'application/json'}, method='POST'))
    chk(json.loads(r.read())['user']['role']=='maint','new login signs in as Maintenance')
    pg.click("button:has-text('Done')"); pg.wait_for_timeout(300)
    # switch off op2
    pg.once('dialog', lambda d: d.accept())
    row=pg.locator('tr', has_text='op2'); row.locator("button:has-text('Switch off')").click(); pg.wait_for_timeout(1500)
    chk('Switched off' in pg.locator('tr', has_text='op2').inner_text(),'switched off shows')
    # edit role
    pg.locator('tr', has_text='amit').locator("button:has-text('Edit')").click(); pg.wait_for_timeout(300)
    pg.select_option('#pe_r','supervisor'); pg.click("button:has-text('Save')"); pg.wait_for_timeout(1500)
    chk('Supervisor' in pg.locator('tr', has_text='amit').inner_text(),'role changed to Supervisor')
    # new password
    pg.once('dialog', lambda d: d.accept()); pg.locator('tr', has_text='ravi').locator("button:has-text('New password')").click(); pg.wait_for_timeout(1500)
    chk('Send this to Ravi' in pg.inner_text('#page-settings'),'reset shows new password')
    pg.screenshot(path='/home/claude/s2/shots/p2_people_after.png', full_page=True)
    # connections links carry no key
    pg.evaluate("setTab='conn'; renderSettings()"); pg.wait_for_timeout(300); t=pg.inner_text('#page-settings')
    chk('k123' not in t and 'floor.html?c=tst' in t,'links have no key')
    # site folder zip
    with pg.expect_download() as d: pg.evaluate('btSiteDownload()')
    z=zipfile.ZipFile(io.BytesIO(open(d.value.path(),'rb').read())); names=z.namelist()
    chk(not any('clients/' in n for n in names),'no company file in the zip')
    fl=z.read('site/floor.html').decode(); ix=z.read('site/index.html').decode(); lv=z.read('site/live.html').decode()
    chk("window.CO_ID='tst'" in fl and "API_BASE='http://localhost:8799'" in ix and "API_BASE='http://localhost:8799'" in lv,'company code and server filled into pages')
    chk('__CID__' not in fl+ix+lv and '__API__' not in fl+ix+lv,'no placeholders left')
    chk('server/worker.js' in names and 'const V = 10;' in z.read('server/worker.js').decode(),'server v10 in zip')
    print(z.read('README.txt').decode()[-300:])
    br.close()
errs=[e for e in errs if "reading 'x'" not in e and '_bubWired' not in e]; print('page errors:', errs[:5]); print('ALL OK' if ok and not errs else 'CHECK FAILURES')
