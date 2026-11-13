import json
from playwright.sync_api import sync_playwright
from PIL import Image
cl=json.load(open('/home/claude/live/site/clients/cosmos.json'))
import sys
cl['api']='http://localhost:9/'; cl['tagline']='Live Machine Status'
import base64
cl['logo']='data:image/png;base64,'+base64.b64encode(open('/tmp/logo.png','rb').read()).decode()
ids=[m['id'] for m in cl['ref']['machines']]
cats={}
for m in cl['ref']['machines']: cats.setdefault(m['category'],[]).append(m['id'])
print({k:cl['groups'].get(k) for k in cats} if cl.get('groups') else 'nogroups', len(ids))
ST={'now':'2026-10-28T10:00:00Z','open':[{'machine':ids[0],'status':'open','kind':'stopped','downAt':'2026-10-28T09:00:00Z','problem':'Spindle noise','reportedBy':'Ram'},{'machine':ids[3],'status':'working','kind':'stopped','downAt':'2026-10-28T08:00:00Z','startedAt':'2026-10-28T08:30:00Z','startedBy':'Raj','problem':'Coolant','reportedBy':'x'},{'machine':ids[8],'status':'open','kind':'stopped','downAt':'2026-10-26T08:00:00Z','startedAt':'2026-10-26T09:00:00Z','handedOver':True,'handoverSince':'2026-10-28T06:30:00Z','transferTo':'Next shift','waitSpare':True,'eta':'2026-11-01T12:30:00Z','problem':'Spindle bearing noise','reportedBy':'x','updates':[{'type':'update','at':'2026-10-27T10:00:00Z','by':'Amit','text':'Bearing damaged, ordered from supplier','spare':'Bearing 7014'}]}],'closed':[{'machine':ids[5],'problem':'Air leak at chuck','closedAt':'2026-10-28T07:00:00Z','downtimeMin':45,'closedBy':'Sunil'}]}
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1600,'height':900}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('**/clients/cosmos.json',lambda r:r.fulfill(json=cl))
    pg.route('http://localhost:9/**',lambda r:r.fulfill(json=ST,headers={'access-control-allow-origin':'*'}))
    pg.goto('http://localhost:8787/live.html?c=cosmos&k=1'); pg.wait_for_timeout(1500)
    pg.screenshot(path='/tmp/board.png',full_page=True)
    print(pg.evaluate("[document.querySelectorAll('.ct').length, document.querySelectorAll('.sq i').length, document.querySelector('.sq i').title, document.getElementById('upd').parentNode.textContent]"))
    print(pg.evaluate("[...document.querySelectorAll('.ct b')].map(e=>e.textContent)"))
    print(errs)
