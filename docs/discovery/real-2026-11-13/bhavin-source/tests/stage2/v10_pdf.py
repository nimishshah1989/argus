# report PDF carries the ticket details block (people with roles + minutes, times, type) and a timeline; support request says no downtime
import json, urllib.request as U, time, subprocess
from playwright.sync_api import sync_playwright
B='http://localhost:8799'; ok=True
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
def mk(machine, kind, extra=False):
    t=call('/api/down',{'machine':machine,'problem':'Spindle alarm, two person job','kind':kind},tok=op)['ticket']; call('/api/start',{'id':t['id']},tok=rv)
    if extra:
        call('/api/join',{'id':t['id'],'role':'support'},tok=am)
        for i in range(2): call('/api/pause',{'id':t['id'],'reason':'Waiting for spare'},tok=rv); call('/api/resume',{'id':t['id']},tok=rv)
        call('/api/update',{'id':t['id'],'text':'Spare ordered'},tok=rv)
    return t
def run(t, name, long):
    with sync_playwright() as p:
        br=p.chromium.launch(); c=br.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, accept_downloads=True); pg=c.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://localhost:8787/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
        pg.evaluate("go('mine')"); pg.wait_for_timeout(500); pg.evaluate("document.querySelector('[data-a=toclose][data-v=\"%s\"]').click()"%t['id']); pg.wait_for_timeout(400); pg.evaluate("document.querySelector('[data-a=closego]').click()"); pg.wait_for_timeout(1500)
        for sel in ['#f_shift','#f_observedBy','#f_maintCode','#f_breakdownCategory']:
            opts=pg.eval_on_selector(sel,"e=>[...e.options].map(o=>o.value).filter(Boolean)")
            if opts and not pg.input_value(sel): pg.select_option(sel, opts[0])
        pg.fill('#f_correctiveAction','Encoder cable replaced')
        pg.locator('#sigCanvas').scroll_into_view_if_needed(); b=pg.locator('#sigCanvas').bounding_box(); pg.mouse.move(b['x']+20,b['y']+30); pg.mouse.down(); pg.mouse.move(b['x']+150,b['y']+90); pg.mouse.up()
        with pg.expect_download(timeout=20000) as d: pg.click('#submitBtn')
        f='/tmp/'+name+'.pdf'; d.value.save_as(f); pg.wait_for_timeout(500); chk(not errs,name+': no page errors '+str(errs[:1]))
    return f, subprocess.run(['pdftotext','-layout',f,'-'],capture_output=True,text=True).stdout, int(subprocess.run(['bash','-c','pdfinfo %s | grep Pages'%f],capture_output=True,text=True).stdout.split()[1])
f,txt,pages=run(mk('VC-1','stopped',True),'long',True)
chk('TICKET DETAILS' in txt and 'Ravi (primary' in txt and 'Amit (support' in txt and 'Machine stopped' in txt,'stopped ticket: details block with people, roles, minutes and type')
chk('Reported by' in txt and 'Hands-on' in txt and 'Waiting' in txt,'times and time split present')
chk(pages==2 and 'WORK TIMELINE' in txt and 'Paused' in txt and 'Resumed' in txt,'more than 6 events: timeline on page 2 (%d pages)'%pages)
f2,txt2,pages2=run(mk('VC-3','support',False),'sup',False)
chk('Needs support' in txt2 and 'Downtime: none' in txt2,'support request: type line says needs support, downtime none')
chk(pages2==1,'short ticket: stays one page (%d)'%pages2)
print('ALL PASS' if ok else 'SOME FAILED')
