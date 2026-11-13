from playwright.sync_api import sync_playwright
import json, urllib.request
def api(path, body=None, hdr=None):
    h={'X-Client':'tst','X-Key':'k123','Content-Type':'application/json'}; h.update(hdr or {})
    r=urllib.request.Request('http://localhost:8799'+path, data=json.dumps(body).encode() if body is not None else None, headers=h)
    return json.load(urllib.request.urlopen(r))
t=api('/api/down',{'machine':'VTL-4','by':'Ram (Operator)','problem':'Hydraulic pump seal leaking'})['ticket']
api('/api/start',{'id':t['id'],'by':'Sagar T'})
api('/api/update',{'id':t['id'],'by':'Sagar T','text':'Seal damaged, checking stock'})
api('/api/pause',{'id':t['id'],'by':'Sagar T','reason':'Waiting for spare','note':'Seal kit ordered from Rexroth dealer','eta':'2026-11-01T12:30:00Z'})
g=api('/api/down',{'kind':'general','location':'Store','workType':'Electrical','by':'Sup','problem':'Tube light'})
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    for w,h,n in ((1920,1080,'b1080'),(390,844,'bphone')):
        pg=b.new_page(viewport={'width':w,'height':h}); pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8787/live.html?c=tst&k=k123'); pg.wait_for_timeout(2500)
        pg.screenshot(path=f'/tmp/{n}.jpg', type='jpeg', quality=85, full_page=(w<500))
        print(n, pg.evaluate("[document.getElementById('nS').textContent, document.querySelectorAll('.t.x').length, document.title, document.documentElement.scrollWidth]"))
    print(errs)
