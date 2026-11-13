from playwright.sync_api import sync_playwright
import json, urllib.request
def api(path, body=None, hdr=None):
    h={'X-Client':'tst','X-Key':'k123','Content-Type':'application/json'}; h.update(hdr or {})
    r=urllib.request.Request('http://localhost:8799'+path, data=json.dumps(body).encode() if body is not None else None, headers=h)
    return json.load(urllib.request.urlopen(r))
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def phone(url):
        ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True); pg=ctx.new_page()
        pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto(url); pg.wait_for_timeout(2200); return pg
    tap=lambda pg,sel:(pg.locator(sel).first.tap(), pg.wait_for_timeout(600))
    toast=lambda pg: pg.evaluate("document.getElementById('lvToast').textContent")
    # ---- floor
    f=phone('http://localhost:8787/floor.html?c=tst&k=k123')
    print('floor sections', f.evaluate("[...document.querySelectorAll('.lvseg b')].map(e=>e.textContent)"), 'tabs shown', f.evaluate("getComputedStyle(document.getElementById('lvTabs')).display"))
    f.screenshot(path='/tmp/p_floor_cat.png', full_page=True)
    tap(f,'[data-a="cat"]'); f.fill('#lvq','6'); f.wait_for_timeout(300); tap(f,'#lvrows [data-a="pickm"]'); tap(f,'[data-a="kind"][data-v="stopped"]')
    f.fill('#d_problem','Spindle alarm'); f.fill('#lvname','Ramesh'); tap(f,'#lvby [data-a="by"]'); tap(f,'#lvsend'); f.wait_for_timeout(800)
    print('floor sent view', f.evaluate("A.view"))
    tap(f,'[data-a="another"]'); tap(f,'[data-a="general"]')
    f.select_option('#lvloc','Cell 3'); f.select_option('#lvwt','Electrical'); f.fill('#d_problem','Install wall fan'); tap(f,'[data-a="urg"][data-v="1"]'); f.fill('#lvname','Ramesh'); tap(f,'#lvby [data-a="by"]')
    f.screenshot(path='/tmp/p_floor_gen.png', full_page=True)
    tap(f,'#lvsend'); f.wait_for_timeout(800); print('general sent', f.evaluate("[A.view, A.st.last.kind, A.st.last.location, A.st.last.urgent]"))
    st=api('/api/state'); mt=[t for t in st['open'] if t['kind']!='general'][0]; gt=[t for t in st['open'] if t['kind']=='general'][0]
    # ---- maintenance
    m=phone('http://localhost:8787/maint.html?c=tst&k=k123')
    print('maint tabs', m.evaluate("[...document.querySelectorAll('#lvTabs button')].map(b=>b.textContent)"), 'sections', m.evaluate("[...document.querySelectorAll('.lvsect')].map(e=>e.textContent)"))
    tap(m,f'[data-a="startask"][data-v="{mt["id"]}"]'); m.select_option('#lvwho','Sagar T'); tap(m,'[data-a="startgo"]'); m.wait_for_timeout(900)
    tap(m,f'[data-a="pauseask"][data-v="{mt["id"]}"]'); m.screenshot(path='/tmp/p_pause.png')
    tap(m,'#lvrgo'); print('pause no reason ->', toast(m))
    m.select_option('#lvrsn','Sent to vendor for repair'); m.fill('#lvwhy','Spindle to ABC'); m.fill('#lveta','2026-11-02'); m.select_option('#lvto','Sagar T'); m.select_option('#lvnm','Sagar T'); tap(m,'#lvrgo'); m.wait_for_timeout(900)
    print('after pause view', m.evaluate("A.view"), api('/api/state')['open'][0]['status'] if False else [t['status'] for t in api('/api/state')['open'] if t['id']==mt['id']])
    m.screenshot(path='/tmp/p_open_waiting.png', full_page=True)
    tap(m,f'[data-a="resumeask"][data-v="{mt["id"]}"]'); m.select_option('#lvwho','Madhu K'); tap(m,'#lvrgo'); print('confirm shown', m.evaluate("!!A.st.confirmFor"))
    tap(m,'#lvrgo'); m.wait_for_timeout(900); t=[t for t in api('/api/state')['open'] if t['id']==mt['id']][0]; print('resumed', t['status'], t['startedBy'], [u['type'] for u in t['updates']])
    m.screenshot(path='/tmp/p_mine.png', full_page=True)
    tap(m,f'[data-a="handask"][data-v="{mt["id"]}"]'); m.fill('#lvwhy','Spindle refitted, trial pending'); m.select_option('#lvto','Next shift'); m.select_option('#lvnm','Madhu K'); tap(m,'#lvrgo'); m.wait_for_timeout(900)
    t=[t for t in api('/api/state')['open'] if t['id']==mt['id']][0]; print('transferred', t['status'], t['handedOver'])
    # general work start + done
    tap(m,f'[data-a="startask"][data-v="{gt["id"]}"]'); m.select_option('#lvwho','Bipin P'); tap(m,'[data-a="startgo"]'); m.wait_for_timeout(900)
    tap(m,f'[data-a="doneask"][data-v="{gt["id"]}"]'); m.fill('#lvwhy','Fan installed'); m.select_option('#lvnm','Bipin P'); tap(m,'#lvrgo'); m.wait_for_timeout(900); print('done toast', toast(m))
    # maintenance raises and starts
    tap(m,'[data-a="tab"][data-v="cat"]'); tap(m,'[data-a="cat"]'); m.fill('#lvq','9'); m.wait_for_timeout(300); tap(m,'#lvrows [data-a="pickm"]'); tap(m,'[data-a="kind"][data-v="support"]')
    m.fill('#d_problem','Coolant nozzle loose'); m.select_option('#lvnm','Sagar T'); m.check('#lvnow'); tap(m,'#lvsend'); m.wait_for_timeout(900)
    print('self-start view', m.evaluate("A.view"), [ (t['machine'],t['status'],t['selfStarted']) for t in api('/api/state')['open'] if t['selfStarted']])
    # settings sync: platform posts new settings; phone picks them up
    cl=json.load(open('/home/claude/live/site/clients/tst.json')); cl['company']='Synced Co'; cl['ref']['machines'].append({'id':'NEW-1','category':'Vertical Machining Center','cell':'1','seg':'CNC'})
    api('/api/config',{'config':cl,'fp':'fp2'},{'X-Config-Token':'t'*32})
    m.evaluate("lvRefresh()"); m.wait_for_timeout(1500)
    print('synced', m.evaluate("[CLIENT.company, REF.machines.some(x=>x.id==='NEW-1'), LV.cfgFp]"))
    print('errs', errs)
