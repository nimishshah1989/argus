# phone layout: status chips (filter), team strip, Open tab switch, Me button sheet, More on the Report tab
import json, urllib.request as U
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'; OUT='/home/claude/s2/shots/'
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try: return json.loads(U.urlopen(r).read())
    except U.HTTPError as e: return {'status':e.code, **json.loads(e.read() or b'{}')}
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123'); am=lg('amit','amit123')
a=call('/api/down',{'machine':'VC-1','problem':'Spindle alarm','kind':'stopped'},tok=op)['ticket']          # open, down
b=call('/api/down',{'machine':'VC-2','problem':'Coolant','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':b['id']},tok=rv); call('/api/join',{'id':b['id'],'role':'support'},tok=am)   # working with 2 people
c=call('/api/down',{'machine':'VC-3','problem':'Need electrician','kind':'support'},tok=op)['ticket']       # support
d=call('/api/down',{'machine':'VC-4','problem':'Gearbox noise','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':d['id']},tok=rv); call('/api/pause',{'id':d['id'],'reason':'Waiting for spare'},tok=rv)
g=call('/api/down',{'kind':'general','location':'Store','workType':'Electrical','problem':'Tube light'},tok=op)['ticket']
errs=[]
with sync_playwright() as p:
    br=p.chromium.launch(); cx=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True); pg=cx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(S+'/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(2000)
    pg.evaluate("go('open')"); pg.wait_for_timeout(600)
    chips=pg.eval_on_selector_all('.lvsc',"e=>e.map(x=>x.innerText.replace(/\\n/g,' '))"); print(chips)
    nums=[int(''.join(ch for ch in x.split(' ')[1] if ch.isdigit())) for x in chips]
    chk(len(chips)==4 and nums[0]==2 and nums[1]==1 and nums[2]==1,'chips: Down 2 (VC-1, VC-2), Waiting 1 (VC-4), Support 1 (VC-3)  %s'%chips)
    chk(nums[3]>0,'Running OK counts machines with no open ticket (%d)'%nums[3])
    pg.screenshot(path=OUT+'v10_open.png')
    # filter by Support
    pg.evaluate("document.querySelector('.lvsc.c-support').click()"); pg.wait_for_timeout(300)
    t=pg.inner_text('#lvBody'); chk('VC-3' in t and 'VC-1' not in t and 'Showing support requests' in t,'tap Support: only the support request is listed')
    pg.evaluate("document.querySelector('[data-a=chipf][data-v=\"\"]').click()"); pg.wait_for_timeout(300)
    chk('VC-1' in pg.inner_text('#lvBody') and 'VC-3' in pg.inner_text('#lvBody'),'tap again: filter cleared')
    # team strip
    s=pg.inner_text('.lvstrip'); chk('Team now: 2 on jobs' in s,'team strip collapsed: %s'%s.replace('\n',' '))
    pg.evaluate("document.querySelector('.lvstrip>button').click()"); pg.wait_for_timeout(300)
    s=pg.inner_text('.lvstrip'); chk('Ravi' in s and 'LEAD' in s and 'Amit' in s and 'SUPPORT' in s and 'VC-2' in s,'expanded: Ravi LEAD, Amit SUPPORT on VC-2')
    chk('Kiran' not in s and 'free' not in s.lower(),'no free people listed')
    pg.screenshot(path=OUT+'v10_open_team.png')
    # switch
    sw=pg.inner_text('.lvseg3'); chk('Breakdowns (3)' in sw and 'Tasks (0)' in sw and 'Work (1)' in sw,'switch counts: %s'%sw.replace('\n',' '))
    pg.evaluate("document.querySelector('[data-a=otab][data-v=work]').click()"); pg.wait_for_timeout(300)
    t=pg.inner_text('#lvBody'); chk('Store' in t and 'VC-1' not in t,'Work view lists only the work request')
    # Me
    pg.evaluate("document.querySelector('.lvme').click()"); pg.wait_for_timeout(300)
    m=pg.inner_text('#lvSheet'); chk('Signed in as' in m and 'Change password' in m and 'Sign out' in m and 'App version' in m and 'Update now' in m,'Me sheet: password, sign out, version, update')
    pg.evaluate("closeSheet(); go('open')"); pg.wait_for_timeout(300)
    chk('Signed in as' not in pg.inner_text('#lvBody'),'account block gone from the bottom of Open')
    # More on Report tab
    pg.evaluate("go('cat')"); pg.wait_for_timeout(400); pg.evaluate("document.querySelector('[data-a=moremenu]').click()"); pg.wait_for_timeout(300)
    m=pg.inner_text('#lvSheet'); chk('Write a report only' in m and 'day report' in m.lower(),'Report tab > More: report only, day report')
    chk(not errs,'no page errors '+str(errs[:2]))
print('ALL PASS' if ok else 'SOME FAILED')
