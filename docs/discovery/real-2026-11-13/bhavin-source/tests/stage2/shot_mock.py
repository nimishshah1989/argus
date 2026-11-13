import json, urllib.request as U
from playwright.sync_api import sync_playwright
S='http://localhost:8787'; B='http://localhost:8799'
def call(path, body=None, tok=None):
    h={'X-Client':'tst','Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    return json.loads(U.urlopen(r).read())
lg=lambda u,p: call('/api/login',{'username':u,'password':p})['token']
op=lg('op1','op1234'); rv=lg('ravi','ravi123')
t=call('/api/down',{'machine':'VC-2','problem':'Coolant pump leaking','kind':'stopped'},tok=op)['ticket']; call('/api/start',{'id':t['id']},tok=rv)
call('/api/close',{'id':t['id'],'kind':'no_report','note':'Temporary fix','by':'Ravi','task':{'text':'Replace coolant pump','why':'Waiting for spare','exp':''}},tok=rv)
JS="""(args)=>{
 const [label, title, sub, st, tone]=args;
 const card=document.querySelector('.lvcard, .lvtk, [data-a=openticket]')||document.querySelector('.lvcol > *:nth-child(5)');
 const cards=[...document.querySelectorAll('.lvcol > *')].filter(e=>e.textContent.includes('BD-0001')&&e.textContent.includes('Coolant'));
 const c=cards[cards.length-1]; if(!c) return 'nocard';
 const clone=c.cloneNode(true); c.parentNode.insertBefore(clone,c.nextSibling);
 const bg = tone==='amber' ? '#FFF4D6' : tone==='red' ? '#FDE8E8' : '#E6F4EA', bd = tone==='amber' ? '#F2C14E' : tone==='red' ? '#F19A9A' : '#8FCB9B', fg= tone==='amber' ? '#6B4A00' : tone==='red' ? '#8A1C1C' : '#14532D';
 const b=document.createElement('div'); b.style.cssText='margin-top:10px;padding:9px 11px;border-radius:10px;background:'+bg+';border:1px solid '+bd+';color:'+fg+';font-size:13.5px;line-height:1.35';
 b.innerHTML=label; clone.appendChild(b); return 'ok';}"""
with sync_playwright() as p:
    pg=p.chromium.launch().new_context(viewport={'width':390,'height':2300}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block').new_page()
    pg.goto(S+'/floor.html'); pg.wait_for_selector('#lvLogin'); pg.fill('#lvU','op1'); pg.fill('#lvP','op1234'); pg.click('#lvGo'); pg.wait_for_timeout(1800)
    pg.evaluate("go('my')"); pg.wait_for_timeout(900)
    pg.evaluate("""()=>{
 const cs=[...document.querySelectorAll('.lvcol > *')].filter(e=>e.textContent.includes('BD-0001')&&e.textContent.includes('Coolant')); const base=cs[0];
 const V=[
  ['amber','<b>⏳ FOLLOW-UP PENDING · 1 task</b><br>Replace coolant pump<br><span style="opacity:.85">Reason: waiting for spare · Expected Mon 9 Nov · Not started</span>'],
  ['amber','<b>🔧 FOLLOW-UP IN PROGRESS · 1 task</b><br>Replace coolant pump<br><span style="opacity:.85">Started 2:10 PM by Ravi · Expected Mon 9 Nov</span>'],
  ['green','<b>✔ FOLLOW-UP DONE</b><br>Replace coolant pump · done Mon 9 Nov by Ravi']];
 let prev=base; V.forEach(v=>{ const c=base.cloneNode(true); const bg=v[0]==='amber'?['#FFF4D6','#F2C14E','#6B4A00']:['#E6F4EA','#8FCB9B','#14532D'];
  const b=document.createElement('div'); b.style.cssText='margin-top:10px;padding:9px 11px;border-radius:10px;background:'+bg[0]+';border:1px solid '+bg[1]+';color:'+bg[2]+';font-size:13.5px;line-height:1.35'; b.innerHTML=v[1]; c.appendChild(b); prev.parentNode.insertBefore(c,prev.nextSibling); prev=c; });
 base.remove(); }""")
    pg.evaluate("window.scrollTo(0,0)")
    pg.screenshot(path='shots/mock_tile.png', full_page=True)
