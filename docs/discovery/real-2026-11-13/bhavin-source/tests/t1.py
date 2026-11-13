from playwright.sync_api import sync_playwright
from PIL import Image
Image.new('RGB',(400,200),(200,30,30)).save('/tmp/logo.png')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':900}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("window.Chart=function(){return {destroy(){},update(){}}};Chart.register=function(){};Chart.defaults={font:{},plugins:{legend:{labels:{}}}};")
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(1500)
    pg.evaluate("nav('settings')")
    for t in ['company','machines','breakdowns','phone','conn','data']:
        pg.evaluate(f"setTab='{t}';renderSettings()"); n=pg.evaluate("document.querySelectorAll('#page-settings .card').length"); print(t,n)
    pg.evaluate("setTab='company';renderSettings()")
    pg.set_input_files('#logoFile','/tmp/logo.png'); pg.wait_for_timeout(500)
    print(pg.evaluate("[!!state.settings.logo, state.settings.logo.length, document.querySelector('.brand .mark img')!=null]"))
    pg.evaluate("btSet('btCompany','Cosmos Engitech'); btSet('btTagline','Live Machine Status')")
    print(pg.evaluate("document.querySelector('.brand h1').textContent"))
    pg.evaluate("nav('settings')"); pg.click('.brand'); print(pg.evaluate("currentPage"))
    print(pg.evaluate("(()=>{const f=btClientFile();return [f.company,f.tagline,f.logo.length,f.id]})()"))
    pg.evaluate("nav('settings')");pg.screenshot(path='/tmp/set.png')
    print(errs)
