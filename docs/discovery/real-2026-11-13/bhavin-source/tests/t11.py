import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page()
    pg.add_init_script("window.Chart=function(){return {destroy(){},update(){}}};Chart.register=function(){};Chart.defaults={font:{},plugins:{legend:{labels:{}}}};")
    pg.goto('file:///home/claude/cosmos_platform.html'); pg.wait_for_timeout(1500)
    cl=pg.evaluate("(()=>{ state.settings.btCompany='Cosmos Engitech'; state.settings.btClientId='cosmos'; state.settings.btApi='http://localhost:9'; return btClientFile(); })()")
    import collections; print(len(cl['ref']['machines']), collections.Counter(m['seg'] for m in cl['ref']['machines']))
    ids=[m['id'] for m in cl['ref']['machines'] if m['seg']=='CNC']
    V=[i for i in ids if i.startswith('VC')]; T=[i for i in ids if i.startswith('TC')]; VT=[i for i in ids if i.startswith('VTL')]
    conv=[m['id'] for m in cl['ref']['machines'] if m['seg']!='CNC'][0]
    ST={'now':'2026-10-28T12:04:00Z','open':[
      {'machine':V[10],'status':'open','kind':'stopped','downAt':'2026-10-28T11:22:00Z','problem':'Spindle alarm 2001, machine not starting','reportedBy':'Mahesh'},
      {'machine':T[8],'status':'working','kind':'stopped','downAt':'2026-10-28T10:40:00Z','startedAt':'2026-10-28T10:54:00Z','startedBy':'Ravi P','problem':'Coolant pump not working','reportedBy':'x'},
      {'machine':VT[3],'status':'open','kind':'stopped','downAt':'2026-10-26T06:00:00Z','startedAt':'2026-10-26T07:00:00Z','handedOver':True,'handoverSince':'2026-10-28T06:30:00Z','waitSpare':True,'eta':'2026-10-31T12:30:00Z','problem':'Hydraulic pump seal leaking','reportedBy':'x','updates':[{'type':'update','at':'2026-10-28T06:00:00Z','by':'Amit','text':'Seal kit ordered from Rexroth dealer, courier expected Friday','spare':'Hydraulic seal kit'}]},
      {'machine':conv,'status':'open','kind':'stopped','downAt':'2026-10-28T11:50:00Z','problem':'conventional should not show','reportedBy':'x'}],
     'closed':[{'machine':T[2],'problem':'Air leakage at chuck','closedAt':'2026-10-28T09:40:00Z'},{'machine':V[3],'problem':'ATC stuck','closedAt':'2026-10-28T08:15:00Z'}]}
    for vw,vh,name in ((390,844,'board_phone'),(1920,1080,'board_1080')):
        pg2=b.new_page(viewport={'width':vw,'height':vh}); errs=[]; pg2.on('pageerror',lambda e:errs.append(str(e)))
        pg2.route('**/clients/cosmos.json',lambda r:r.fulfill(json=cl))
        pg2.route('http://localhost:9/**',lambda r:r.fulfill(json=ST,headers={'access-control-allow-origin':'*'}))
        pg2.goto('http://localhost:8787/live.html?c=cosmos&k=1'); pg2.wait_for_timeout(1500)
        pg2.screenshot(path=f'/tmp/{name}.jpg', type='jpeg', quality=85, full_page=(vw<500))
        print(name, pg2.evaluate("[document.querySelectorAll('.t').length, document.getElementById('nS').textContent, document.querySelector('.t.s').title, document.documentElement.scrollWidth]"), errs)
    # empty state
    ST2={'now':'2026-10-28T12:04:00Z','open':[],'closed':[]}
    pg3=b.new_page(viewport={'width':1920,'height':1080}); pg3.route('**/clients/cosmos.json',lambda r:r.fulfill(json=cl)); pg3.route('http://localhost:9/**',lambda r:r.fulfill(json=ST2,headers={'access-control-allow-origin':'*'}))
    pg3.goto('http://localhost:8787/live.html?c=cosmos&k=1'); pg3.wait_for_timeout(1500); pg3.screenshot(path='/tmp/board_empty.jpg', type='jpeg', quality=85)
