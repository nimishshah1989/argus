from playwright.sync_api import sync_playwright
import zipfile, io
with sync_playwright() as p:
    b=p.chromium.launch()
    for r in ('maint','floor'):
        pg=b.new_page(viewport={'width':400,'height':800}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto(f'http://localhost:8787/{r}.html?c=tst&k=k123'); pg.wait_for_timeout(2000)
        print(r, pg.title(), pg.evaluate("[LV.role, A.view, document.querySelector('#lvBar').textContent.slice(0,40)]"), errs)
    # an old phone remembered maint, opening floor.html must still be floor
    pg=b.new_page(viewport={'width':400,'height':800}); pg.goto('http://localhost:8787/index.html?c=tst&k=k123&role=maint'); pg.wait_for_timeout(1500)
    pg.goto('http://localhost:8787/floor.html?c=tst&k=k123'); pg.wait_for_timeout(1500); print('override', pg.evaluate("LV.role"))
    # platform download
    pg=b.new_page(accept_downloads=True)
    pg.add_init_script("window.Chart=function(){return {destroy(){},update(){}}};Chart.register=function(){};Chart.defaults={font:{},plugins:{legend:{labels:{}}}};")
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(1500); pg.evaluate("nav('settings')")
    pg.evaluate("state.settings.btCompany='Cosmos Engitech'; state.settings.btClientId='cosmos'; state.settings.btSite='https://maintenance-bd.bhaven89.workers.dev'; localStorage.setItem('bt_key_cosmos','KEY1')")
    print(pg.evaluate("[phoneUrl('floor'), phoneUrl('maint')]"))
    with pg.expect_download() as d: pg.evaluate("btSiteDownload()")
    d.value.save_as('/tmp/sd2.zip')
z=zipfile.ZipFile('/tmp/sd2.zip'); h=z.read('site/maint.html').decode()
import re; print(re.findall(r'<meta (?:property="og:[a-z]+"|name="description") content="[^"]*">', h))
print('__' in h[:3000])
