from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    pg.add_init_script("window.Chart=function(){return {destroy(){},update(){}}};Chart.register=function(){};Chart.defaults={font:{},plugins:{legend:{labels:{}}}};")
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(1500); pg.evaluate("nav('settings')")
    print(pg.evaluate("(()=>{ const r = bdFromPayload({mid:'VC-6',d:'2026-10-27',pr:'x',dm:30},'bd_pdf'); applyPdfImport([r]); return [pendList().length, pendList()[0].src, document.getElementById('pendBadge').textContent]; })()"))
    # working minutes: shifts 07:00-15:00 and 15:00-23:00; from 22:00 to next day 08:00 => 60 + 60 = 120
    print(pg.evaluate("(()=>{ state.settings.shiftTimes=[{name:'1',start:'07:00',end:'15:00'},{name:'2',start:'15:00',end:'23:00'}]; const a=new Date(2026,9,27,22,0).getTime(), b=new Date(2026,9,28,8,0).getTime(); const w1=lvsWorkMin(a,b); state.settings.shiftTimes=[{name:'3',start:'23:00',end:'07:00'}]; const w2=lvsWorkMin(a,b); state.settings.shiftTimes=[]; return [w1,w2,lvsWorkMin(a,b)]; })()"))
