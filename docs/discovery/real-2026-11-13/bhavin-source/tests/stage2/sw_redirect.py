import http.server, socketserver, threading, os, sys, shutil, tempfile
from playwright.sync_api import sync_playwright
SITE='/home/claude/live/site'
def run(swfile,label):
    tmp=tempfile.mkdtemp(); shutil.copytree(SITE,tmp+'/s'); shutil.copy(swfile,tmp+'/s/sw.js'); root=tmp+'/s'
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(s,*a,**k): super().__init__(*a,directory=root,**k)
        def log_message(s,*a): pass
        def do_GET(s):
            path=s.path.split('?')[0]; q=s.path[len(path):]
            if path.endswith('.html'):   # Cloudflare-style: /live.html -> /live
                s.send_response(308); s.send_header('Location',path[:-5]+q); s.end_headers(); return
            if path in ('/live','/maint','/index','/floor'): s.path='/'+path[1:]+'.html'+q
            return super().do_GET()
    srv=socketserver.TCPServer(('0.0.0.0',0),H); port=srv.server_address[1]; threading.Thread(target=srv.serve_forever,daemon=True).start()
    res=[]
    with sync_playwright() as p:
        b=p.chromium.launch(); c=b.new_context(); pg=c.new_page()
        pg.goto(f'http://localhost:{port}/maint.html?c=t'); pg.wait_for_timeout(2500)
        pg.evaluate("navigator.serviceWorker.ready.then(()=>1)"); pg.wait_for_timeout(1500)
        pg.reload(); pg.wait_for_timeout(1500)
        for i in range(3):
            try:
                pg.goto(f'http://localhost:{port}/live.html?c=t',timeout=8000); pg.wait_for_timeout(1200); res.append(('ok',pg.url.split(str(port))[1],pg.title()[:20]))
            except Exception as e: res.append(('FAIL',str(e)[:80]))
        b.close()
    srv.shutdown(); print(label,res); return all(r[0]=='ok' for r in res)
a=run('/home/claude/s2/sw_before_v10.js','old sw.js')
b=run('/home/claude/live/site/sw.js','new sw.js')
print('PASS new sw opens the page through a redirect' if b else 'FAIL new sw'); print('(old sw reproduced the failure)' if not a else '(old sw did not fail in this simulation)')
