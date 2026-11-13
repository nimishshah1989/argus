import json, base64, subprocess
from playwright.sync_api import sync_playwright
ok=True
def chk(c,m):
    global ok; print(('PASS ' if c else 'FAIL ')+m); ok = ok and bool(c)
LONG = 'Spindle bearing noise ₹ “heavy” — સ્પિન્ડલ બેરિંગ અવાજ, coolant pump weak, ATC arm stuck at tool 12, operator says alarm 2051 came twice. '*3
with sync_playwright() as p:
    br=p.chromium.launch(); c=br.new_context(viewport={'width':390,'height':844}, device_scale_factor=3, is_mobile=True, has_touch=True, accept_downloads=True); pg=c.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8787/maint.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','ravi'); pg.fill('#lvP','ravi123'); pg.click('#lvGo'); pg.wait_for_timeout(1500)
    pg.evaluate("go('cat')"); pg.wait_for_timeout(500); pg.evaluate("document.querySelector('[data-a=moremenu]').click()"); pg.wait_for_timeout(300); pg.evaluate("document.querySelector('[data-a=reportonly]').click()"); pg.wait_for_timeout(600)
    w=pg.evaluate("[document.getElementById('sigCanvas').width, document.getElementById('sigCanvas').offsetWidth]")
    chk(w[0]>0 and w[0]==round(w[1]*3),'signature box sized when the form opens: %s'%w)
    pg.select_option('#f_machineId','VC-3'); pg.select_option('#f_shift','1')
    pg.fill('#f_problem', LONG); pg.fill('#f_correctiveAction', LONG); pg.fill('#f_downMin','45')
    pg.select_option('#lvChDone select','Ravi')
    for sel in ['#f_observedBy','#f_maintCode','#f_breakdownCategory']:
        opts=pg.eval_on_selector(sel,"e=>[...e.options].map(o=>o.value).filter(Boolean)")
        if opts: pg.select_option(sel, opts[0])
    pg.locator('#sigCanvas').scroll_into_view_if_needed(); pg.wait_for_timeout(300); box=pg.locator('#sigCanvas').bounding_box()
    pg.mouse.move(box['x']+30, box['y']+40); pg.mouse.down()
    for i in range(20): pg.mouse.move(box['x']+30+i*12, box['y']+40+(i%5)*12)
    pg.mouse.up(); pg.wait_for_timeout(200)
    ink=pg.evaluate("""(()=>{ const c=document.getElementById('sigCanvas'), d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) n++; return [n, signaturePad.isEmpty()]; })()""")
    chk(ink[0]>200 and ink[1]==False,'signature ink visible on the box: %s pixels'%ink[0])
    pg.screenshot(path='/home/claude/s2/shots/f1_sig.png')
    # QR made from the same data the form uses
    q=pg.evaluate("""(()=>{ const h=document.createElement('div'); document.body.appendChild(h); const data={v:1,mid:'VC-3',d:'2026-10-31',sh:'1',pr:%s,ca:%s,db:'Ravi',dm:45,mc:'RT',bc:'M',sp:'Bearing 7014 ₹ 2,400'};
       const ok=bdQR(h,data); const cv=h.querySelector('canvas'); const u=cv?cv.toDataURL('image/png'):null; h.remove(); return [ok, u]; })()"""%(json.dumps(LONG),json.dumps(LONG)))
    chk(q[0] and q[1],'QR made for long Gujarati text')
    open('/tmp/qr.png','wb').write(base64.b64decode(q[1].split(',')[1]))
    out=subprocess.run(['node','-e',"const {PNG}=require('/tmp/xl/node_modules/pngjs');const jsQR=require('/tmp/xl/node_modules/jsqr');const p=PNG.sync.read(require('fs').readFileSync('/tmp/qr.png'));const r=jsQR(new Uint8ClampedArray(p.data),p.width,p.height);console.log(r?r.data:'NONE')"],capture_output=True,text=True).stdout.strip()
    try: d=json.loads(out); chk(d['pr']==LONG[:len(d['pr'])] and d['mid']=='VC-3' and '₹' in d['sp'],'QR scans back with Gujarati and ₹ intact (pr %d chars)'%len(d['pr']))
    except Exception as e: chk(False,'QR decode: '+out[:120])
    with pg.expect_download(timeout=20000) as dl: pg.click('#submitBtn')
    pg.wait_for_timeout(800)
    print('debug', pg.evaluate("[A.view, getComputedStyle(document.getElementById('successScreen')).display, document.getElementById('submitBtn').textContent, (document.querySelector('.err-banner,#errBanner')||{}).textContent]"))
    chk(pg.is_visible('#successScreen') and not errs,'PDF generated, no error banner')
    print('errors', errs); br.close()
print('ALL OK' if ok else 'FAIL')
