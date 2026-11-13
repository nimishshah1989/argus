from playwright.sync_api import sync_playwright
import json, urllib.request
def api(path, body=None):
    r=urllib.request.Request('http://localhost:8799'+path, data=json.dumps(body).encode() if body else None, headers={'X-Client':'tst','X-Key':'k123','Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(r))
tid=api('/api/down',{'machine':'VTL-1','by':'Ram (Operator)','problem':'Hydraulic leak'})['ticket']['id']
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8787/maint.html?c=tst&k=k123'); pg.wait_for_timeout(2000)
    toast=lambda: pg.evaluate("document.getElementById('lvToast').textContent")
    tap=lambda sel: (pg.locator(sel).first.tap(), pg.wait_for_timeout(500))
    # start: tap without name -> message, then select
    tap(f'[data-a="startask"][data-v="{tid}"]'); pg.evaluate("document.getElementById('lvwho').value=''")
    tap('[data-a="startgo"]'); print('start no name ->', toast())
    pg.select_option('#lvwho','Sagar T'); tap('[data-a="off"][data-v="-"]'); print('name kept after time button:', pg.input_value('#lvwho'))
    tap('[data-a="startgo"]'); pg.wait_for_timeout(1000); print('status', api('/api/state')['open'][0]['status'])
    # update: type, pick name, change, change back
    tap(f'[data-a="updask"][data-v="{tid}"]'); pg.screenshot(path='/tmp/sh_upd.png')
    pg.locator('#lvwhy').fill('Sent for repair to ABC Engineering')
    pg.select_option('#lvnm','Madhu K'); pg.select_option('#lvnm','Ganesh Z'); pg.select_option('#lvnm','Madhu K')
    pg.fill('#lveta','2026-11-01')
    print('date box width', pg.evaluate("[document.getElementById('lveta').getBoundingClientRect().right, innerWidth]"), 'textarea h', pg.evaluate("document.getElementById('lvwhy').getBoundingClientRect().height"))
    tap('#lvrgo'); pg.wait_for_timeout(1000); t=api('/api/state')['open'][0]; print('update posted:', [ (u['by'],u['text']) for u in t['updates']], t['eta'])
    # second update
    tap(f'[data-a="updask"][data-v="{tid}"]'); pg.locator('#lvwhy').fill('Repair begun at vendor'); tap('#lvrgo'); pg.wait_for_timeout(1000)
    print('updates', len(api('/api/state')['open'][0]['updates']))
    # handover: no text -> message; then fill
    tap(f'[data-a="handask"][data-v="{tid}"]'); pg.screenshot(path='/tmp/sh_hand.png')
    tap('#lvrgo'); print('hand no text ->', toast())
    pg.locator('#lvwhy').fill('Removed pump, waiting seal kit'); pg.select_option('#lvto','Next shift')
    pg.select_option('#lvnm','Bipin P'); pg.select_option('#lvnm','Sagar T')
    tap('#lvrgo'); pg.wait_for_timeout(1000); t=api('/api/state')['open'][0]; print('handover', t['handedOver'], t['transferTo'], t['updates'][0]['by'])
    # pick up
    tap(f'[data-a="startask"][data-v="{tid}"]'); pg.select_option('#lvwho','Chirag P'); tap('[data-a="startgo"]'); pg.wait_for_timeout(1000)
    print('picked up by', api('/api/state')['open'][0]['startedBy'])
    # cancel
    tap(f'[data-a="cancelask"][data-v="{tid}"]'); pg.locator('#lvwhy').fill('test'); tap('#lvrgo'); pg.wait_for_timeout(1000)
    print('open after cancel', len(api('/api/state')['open']), 'errs', errs)
