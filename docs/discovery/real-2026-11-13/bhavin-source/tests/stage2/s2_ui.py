import re
p='/home/claude/live/parts2/ui.js'; s=open(p).read()
TOP=re.compile(r'\n(?=(?:function |async function |const |let |/\* ----|window\.|\(function))')
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt, (a[:80], s.count(a)); s=s.replace(a,b)
def fn(name, new):
    global s
    m=re.search(r'\n(?:async )?function '+re.escape(name)+r'\(', s) or re.search(r'\nconst '+re.escape(name)+r' =', s)
    assert m, name
    st=m.start()+1; nx=TOP.search(s, m.end()); en=nx.start()+1 if nx else len(s)
    s=s[:st]+new.strip('\n')+'\n'+s[en:]

rep("""/* Live breakdown tickets (version 2).
   Two kinds of users: shop floor (reports a stopped machine or one that needs support) and maintenance (starts work, writes the report, closes).
   Choose with ?role=floor or ?role=maint on the link; the phone remembers it. */""","""/* Live breakdown tickets (version 3).
   Everyone signs in with a username and password made by the admin in the platform (Settings > People & access).
   The login decides the screens: Report (shop floor), Maintenance / Supervisor / Admin (maintenance desk), View board (live status only).
   A personal login records its own name on every action. A shared login (one phone for a team or cell) asks for the name each time. */
const AUTH = {cid:'', api:'', tok:'', user:null};""")

# ---------- storage and server
fn('lvKeyName', r"""const ls = k => { try{ return localStorage.getItem(k)||''; }catch(e){ return ''; } };
const lsSet = (k, v) => { try{ if(v==null || v==='') localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){} };
const ME = () => AUTH.user || {};
const personal = () => !!AUTH.user && !AUTH.user.shared;
const ROLE_NAME = {report:'Report', maint:'Maintenance', board:'View board', supervisor:'Supervisor', admin:'Admin'};""")
fn('lvKey', '')
fn('lvMe', r"""const lvMe = () => personal() ? ME().name : lvGet('me', '');""")
fn('lvApi', r"""async function lvApi(path, body){
  const o = {headers:{'X-Client':AUTH.cid}};
  if(AUTH.tok) o.headers.Authorization = 'Bearer '+AUTH.tok;
  if(body){ o.method = 'POST'; o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
  let r; try{ r = await fetch(AUTH.api.replace(/\/+$/,'')+path, o); }catch(e){ throw {net:true, message:'No internet connection'}; }
  let j = {}; try{ j = await r.json(); }catch(e){}
  if(r.status === 401 && path !== '/api/login'){ lvSignedOut('Your sign-in has ended. Please sign in again.'); throw {auth:true, message:'Please sign in again'}; }
  if(!r.ok) throw {message:j.error||'Something went wrong', status:r.status};
  return j;
}""")

# ---------- routing for the new roles
rep("const rootOf = () => LV.role==='maint' ? 'open' : 'cat';", "const rootOf = () => LV.role==='maint' ? 'open' : LV.role==='board' ? 'live' : 'cat';")
rep("""  if(LV.role==='') return [];""", """  if(LV.role==='' || LV.role==='board') return [];""")
rep("""'<div class="t"><b>'+esc(o.title)+'</b><span>'+esc(CLIENT.company||'')+(LV.role==='maint'?' · Maintenance':'')+'</span></div>';""",
    """'<div class="t"><b>'+esc(o.title)+'</b><span>'+esc(CLIENT.company||'')+(LV.role==='maint'?' · Maintenance':LV.role==='board'?' · View only':'')+'</span></div>';""")
rep("""  const V = {role:vRole, cat:vCat,""", """  const V = {cat:vCat,""")
fn('vRole', '')

# ---------- account line at the bottom of the main screens
rep("/* ---------- share on WhatsApp ---------- */", r"""function acctHtml(){
  const u = ME(); if(!u.name) return '';
  return '<div class="lvacct"><span>Signed in as <b>'+esc(u.name)+'</b> · '+esc(ROLE_NAME[u.role]||'')+(u.shared?' · shared phone':'')+'</span><span class="lvwrap" style="justify-content:center;gap:4px"><button class="lvlink" style="width:auto" data-a="pwask">Change password</button><button class="lvlink" style="width:auto" data-a="signoutask">Sign out</button></span></div>';
}
/* ---------- share on WhatsApp ---------- */""")
rep("""   +(LV.secs||[]).map(sec=>'<div class="lvseg"><b>'+esc(sec.name)+'</b><span>'+sec.n+'</span></div><div class="lvgrid2">'+sec.cats.map(tile).join('')+'</div>').join('')+'</div>'};""",
    """   +(LV.secs||[]).map(sec=>'<div class="lvseg"><b>'+esc(sec.name)+'</b><span>'+sec.n+'</span></div><div class="lvgrid2">'+sec.cats.map(tile).join('')+'</div>').join('')+(LV.role==='floor'?acctHtml():'')+'</div>'};""")
rep("""+'<div class="lvcol" id="lvtiles">'+tilesHtml()+'</div>'+(window.PAGE_ROLE ? '' : '<button class="lvlink" data-a="switchrole">Change role (now: '+(LV.role==='maint'?'Maintenance':'Shop floor')+')</button>')+'</div>'};""",
    """+'<div class="lvcol" id="lvtiles">'+tilesHtml()+'</div>'+(LV.role==='maint'?'':acctHtml())+'</div>'};""")
rep("""+'<button class="lvlink" data-a="reportonly">Write a report only (breakdown already fixed)</button>'+pushHtml(false)+(window.PAGE_ROLE ? '' : '<button class="lvlink" data-a="switchrole">Change role (now: Maintenance)</button>')+'</div>'};""",
    """+'<button class="lvlink" data-a="reportonly">Write a report only (breakdown already fixed)</button>'+pushHtml(false)+acctHtml()+'</div>'};""")

# ---------- names: a personal login fills them in
rep("""function nameSel(id, list, sel, blank){""", """// a personal login: no name to pick, the server records the signed-in name; a shared login picks from the list
function meSel(id, list, sel, blank){ if(personal()) return '<input type="hidden" id="'+id+'" value="'+esc(ME().name)+'"><span class="lvhint">Recorded as <b>'+esc(ME().name)+'</b></span>'; return nameSel(id, list, sel, blank); }
function nameSel(id, list, sel, blank){""")
s = s.replace("""'<span class="lvlbl" style="font-size:16px;font-weight:800">Your name</span>'+nameSel('lvnm', lvTeam(), A.st.reasonBy)""", """(personal() ? meSel('lvnm') : '<span class="lvlbl" style="font-size:16px;font-weight:800">Your name</span>'+nameSel('lvnm', lvTeam(), A.st.reasonBy))""")
assert s.count("meSel('lvnm')")==4, s.count("meSel('lvnm')")
rep("""   +'<span class="lvlbl" style="font-size:16px;font-weight:800">Who is resuming the work?</span>'+nameSel('lvwho', lvTeam(), A.st.who, 'Select who is working')""",
    """   +(personal() ? meSel('lvwho') : '<span class="lvlbl" style="font-size:16px;font-weight:800">Who is resuming the work?</span>'+nameSel('lvwho', lvTeam(), A.st.who, 'Select who is working'))""")
rep("""   +'<span class="lvlbl" style="font-size:16px;font-weight:800">Who is working on it?</span>'+nameSel('lvwho', lvTeam(), A.st.who, 'Select who is working')""",
    """   +(personal() ? meSel('lvwho') : '<span class="lvlbl" style="font-size:16px;font-weight:800">Who is working on it?</span>'+nameSel('lvwho', lvTeam(), A.st.who, 'Select who is working'))""")
rep("""   +'<span class="lvlbl" style="font-size:16px;font-weight:800">Your name</span>'+(LV.role==='maint' ? nameSel('lvnm', names, A.st.reasonBy) : '<input id="lvrn" class="lvin2" data-i="rn" type="text" autocomplete="name" autocapitalize="words" value="'+esc(A.st.reasonBy)+'" placeholder="Type your name">')""",
    """   +(personal() ? meSel(LV.role==='maint' ? 'lvnm' : 'lvrn') : '<span class="lvlbl" style="font-size:16px;font-weight:800">Your name</span>'+(LV.role==='maint' ? nameSel('lvnm', names, A.st.reasonBy) : '<input id="lvrn" class="lvin2" data-i="rn" type="text" autocomplete="name" autocapitalize="words" value="'+esc(A.st.reasonBy)+'" placeholder="Type your name">'))""")
# sheetRead: hidden lvrn must be read too (it was only read through input events)
rep("""if((x = v('lvrn'))!=null) A.st.reasonBy = x.trim();""", """if((x = v('lvrn'))!=null) A.st.reasonBy = x.trim();""")
fn('whoBlock', r"""function whoBlock(){
  const u = ME();
  if(LV.role==='maint') return (personal() ? meSel('lvnm') : '<div style="display:flex;flex-direction:column;gap:6px"><span class="lvlbl" style="font-size:17px;font-weight:800">Your name</span>'+nameSel('lvnm', lvTeam(), lvMe())+'</div>')
    +'<label class="lvcheck"><input type="checkbox" id="lvnow"'+(A.st.startNow?' checked':'')+'><span>I am starting work on it now</span></label>';
  if(personal()) return u.title ? '<span class="lvhint">Reporting as <b>'+esc(u.name)+' ('+esc(u.title)+')</b></span>'
    : '<span class="lvhint">Reporting as <b>'+esc(u.name)+'</b></span><div style="display:flex;flex-direction:column;gap:8px"><span class="lvlbl" style="font-size:17px;font-weight:800">Your role</span><div class="lvwrap" id="lvby">'+chips(lvReporters(), A.st.by, 'by')+'</div></div>';
  return '<div style="display:flex;flex-direction:column;gap:6px"><label class="lvlbl" for="lvname" style="font-size:17px;font-weight:800">Your name</label><input id="lvname" class="lvin2" data-i="nm" type="text" autocomplete="name" autocapitalize="words" value="'+esc(lvGet('name',''))+'" placeholder="Type your name"></div>'
   +'<div style="display:flex;flex-direction:column;gap:8px"><span class="lvlbl" style="font-size:17px;font-weight:800">Your role</span><div class="lvwrap" id="lvby">'+chips(lvReporters(), A.st.by, 'by')+'</div></div>';
}""")
fn('whoRead', r"""// who is raising: [display name, role, name only]; null when something is missing
function whoRead(){
  const u = ME();
  if(LV.role==='maint'){ const n = ($('lvnm')||{}).value||''; if(!n){ need('Select your name'); return null; } return [n+' (Maintenance)', 'maint', n]; }
  if(personal()){ const r = u.title || A.st.by; if(!r){ need('Pick your role'); return null; } return [u.name+' ('+r+')', 'floor', u.name]; }
  const nm = (($('lvname')||{}).value||'').trim().replace(/[()]/g,'').slice(0,40), role = A.st.by;
  if(!nm){ need('Type your name'); return null; } if(!role){ need('Pick your role'); return null; } return [nm+' ('+role+')', 'floor', nm];
}""")
fn('lvSendState', r"""function lvSendState(){
  if(LV.role==='maint') return;
  const ta = $('d_problem'), b = $('lvsend'), nm = $('lvname'); if(!b) return;
  const who = personal() ? !!(ME().title || A.st.by) : !!(A.st.by && nm && nm.value.trim());
  const ok = !!(ta && ta.value.trim() && who) && !LV.busy;
  b.classList.toggle('off', !ok && !LV.busy); b.setAttribute('aria-disabled', ok?'false':'true');
  const n = $('lvnote'); if(n){ n.style.display = ok || LV.busy ? 'none' : 'block'; if(personal()) n.textContent = ME().title ? 'Write what is wrong.' : 'Write what is wrong and pick your role.'; }
}""")
rep("""role:w[1], startNow, startBy:w[2]});
    LV.busy = false;
    if(w[1]==='floor'){""", """role:w[1], startNow, startBy:w[2], byRole:A.st.by||''});
    LV.busy = false;
    if(w[1]==='floor'){""")
rep("""by:w[0], problem:pr, role:w[1], startNow, startBy:w[2]});
    LV.busy = false; if(w[1]==='floor')""", """by:w[0], problem:pr, role:w[1], startNow, startBy:w[2], byRole:A.st.by||''});
    LV.busy = false; if(w[1]==='floor')""")

# ---------- floor and board: who may cancel, and no actions on the board
rep("""  if(LV.role==='maint') body += actionBtns(t, true);
  else body += '<button class="lvsec" style="color:#9B1C1C!important;border:2px solid #C62828!important;background:#fff!important" data-a="cancelask" data-v="'+esc(t.id)+'">Cancel ticket</button>';""",
"""  if(LV.role==='maint') body += actionBtns(t, true);
  else if(mineToCancel(t)) body += '<button class="lvsec" style="color:#9B1C1C!important;border:2px solid #C62828!important;background:#fff!important" data-a="cancelask" data-v="'+esc(t.id)+'">Cancel ticket</button>';""")
rep("""function sheetMachine(id){""", """// the shop floor can cancel a ticket it raised itself, until maintenance starts on it
const mineToCancel = t => LV.role==='floor' && t.status==='open' && !t.startedAt && !!ME().username && t.raisedUser===ME().username;
function sheetMachine(id){""")
rep("""  if(t) return sheetTicket(t);
  openSheet(""", """  if(t) return sheetTicket(t);
  if(LV.role==='board'){ openSheet('<div class="hd"><div class="lvwrap"><b>'+esc(id)+'</b>'+stChip('running')+'</div><button class="lvx" data-a="closesheet" aria-label="Close">'+I.x+'</button></div><div style="font-size:13.5px;color:#4B5563;margin-top:-6px">'+esc(m.category||'')+(m.cell?' · Cell '+esc(m.cell):'')+'</div><span class="lvhint">This machine is running.</span>'); return; }
  openSheet(""")
rep("""+WA_BTN(l.id)+(cur ? '<button class="lvsec\"""", """+WA_BTN(l.id)+(cur && (LV.role==='maint' || mineToCancel(cur)) ? '<button class="lvsec\"""")

# ---------- sign out, change password
rep("""/* ---------- maintenance ---------- */""", r"""/* ---------- account: sign out, change password ---------- */
function sheetSignout(){
  openSheet('<div class="hd"><b>Sign out of this phone?</b><button class="lvx" data-a="closesheet" aria-label="Close">'+I.x+'</button></div>'
   +'<span class="lvhint">'+(LV.role==='maint' ? 'Alerts stop on this phone. ' : '')+'You need your username and password to sign in again.</span>'
   +'<div class="lv3"><button data-a="closesheet">Go back</button><button class="lvprim red" data-a="signoutgo" style="flex:1">'+spin(LV.busy, LV.busy ? 'Signing out...' : 'Sign out')+'</button></div>');
}
async function doSignout(){
  if(LV.busy) return; LV.busy = true; sheetSignout();
  try{ if(LV.push==='on'){ const r = await navigator.serviceWorker.ready, sb = await r.pushManager.getSubscription(); if(sb){ try{ await lvApi('/api/unsubscribe', {endpoint:sb.endpoint}); }catch(e){} await sb.unsubscribe(); } } }catch(e){}
  try{ await lvApi('/api/logout', {}); }catch(e){}
  lvForget(); location.reload();
}
// clears this company's sign-in and the data kept on the phone
function lvForget(){ ['bd_tok_','bd_user_','bd_state_','bd_cfg_'].forEach(k=>lsSet(k+AUTH.cid, '')); AUTH.tok = ''; AUTH.user = null; }
function sheetPw(err){
  openSheet('<div class="hd"><b>Change your password</b><button class="lvx" data-a="closesheet" aria-label="Close">'+I.x+'</button></div>'
   +'<label class="lvlbl" for="lvpo" style="font-size:16px;font-weight:800">Current password</label><input id="lvpo" class="lvin2" type="password" autocomplete="current-password">'
   +'<label class="lvlbl" for="lvpn" style="font-size:16px;font-weight:800">New password (at least 6 characters)</label><input id="lvpn" class="lvin2" type="password" autocomplete="new-password">'
   +'<label class="lvlbl" for="lvpn2" style="font-size:16px;font-weight:800">New password again</label><input id="lvpn2" class="lvin2" type="password" autocomplete="new-password">'
   +'<span class="lvhint">Your other phones and screens are signed out. This one stays signed in.</span>'
   +'<div class="lv3"><button data-a="closesheet">Go back</button><button class="lvprim" data-a="pwgo" style="flex:1">'+spin(LV.busy, LV.busy ? 'Saving...' : 'Save password')+'</button></div>');
}
async function doPw(){
  if(LV.busy) return;
  const o = ($('lvpo')||{}).value||'', n = ($('lvpn')||{}).value||'', n2 = ($('lvpn2')||{}).value||'';
  if(!o) return need('Enter your current password'); if(n.length < 6) return need('The new password needs at least 6 characters'); if(n !== n2) return need('The two new passwords are not the same');
  LV.busy = true; const b = document.querySelector('[data-a="pwgo"]'); if(b) b.innerHTML = spin(true, 'Saving...');
  try{ await lvApi('/api/password', {old:o, password:n}); LV.busy = false; closeSheet(); lvToast('Password changed.'); }
  catch(e){ LV.busy = false; if(b) b.innerHTML = spin(false, 'Save password'); lvToast(e.message, true); }
}

/* ---------- maintenance ---------- */""")
rep("""    case 'role': LV.role = v; lvSet('role', v); go(rootOf(), true); lvRefresh(); if(v==='maint') pushCheck(); break;
    case 'switchrole': go('role', true); break;
""", """    case 'signoutask': closeSheet(); sheetSignout(); break;
    case 'signoutgo': doSignout(); break;
    case 'pwask': closeSheet(); sheetPw(); break;
    case 'pwgo': doPw(); break;
""")
rep("""    case 'cancelask': S.tid = v; S.reason = ''; S.reasonBy = LV.role==='maint' ? lvMe() : lvGet('name',''); sheetReason('cancel'); break;""",
    """    case 'cancelask': S.tid = v; S.reason = ''; S.reasonBy = LV.role==='maint' || personal() ? lvMe() : lvGet('name',''); closeSheet(); sheetReason('cancel'); break;""")

# ---------- start-up: sign-in, company settings from the server
fn('lvInit', r"""function lvInit(){
  if(LV.inited || !AUTH.user) return; LV.inited = true;
  LV.on = true; lvBuildCats(); lvShell();
  const r = ME().role; LV.role = r==='report' ? 'floor' : r==='board' ? 'board' : 'maint';
  document.title = (LV.role==='maint' ? 'Maintenance Desk' : LV.role==='board' ? 'Live status' : 'Report a Breakdown') + (CLIENT.company ? ' — '+CLIENT.company : '');
  const sp = new URLSearchParams(location.search);
  const app = $('lvApp');
  // one listener for everything (the sheet sits inside the app)
  app.addEventListener('click', e=>{ if(e.target.id==='lvSheetB'){ closeSheet(); return; } const b = e.target.closest('[data-a]'); if(!b) return;
    if(b.dataset.a==='openticket'){ if(e.target.closest('button, a, select, input, textarea')) return; const t = LV.state.open.find(x=>x.id===b.dataset.v); if(t) sheetTicket(t); return; }
    act(b.dataset.a, b.dataset.v, b); });
  app.addEventListener('input', e=>{
    const i = e.target.dataset && e.target.dataset.i;
    if(i==='q'){ A.st.q = e.target.value; const c = LV.cats.find(x=>x.k===A.st.cat); if(c) $('lvrows').innerHTML = rowsFor(c); }
    else if(i==='lq'){ A.st.liveQ = e.target.value; $('lvtiles').innerHTML = tilesHtml(); }
    else if(i==='prob' || i==='nm'){ lvSendState(); }
    else if(i==='rn'){ A.st.reasonBy = e.target.value.trim(); }
    else if(i==='spare'){ A.st.spare = e.target.value; }
    else if(i==='eta'){ A.st.eta = e.target.value; }
    else if(i==='reason'){ A.st.reason = e.target.value; }
  });
  const root = rootOf(); A.view = root; A.depth = 0; history.replaceState({view:root, d:0}, ''); lvShow(); render();
  const m = sp.get('m');
  if(m && LV.role==='floor' && REF.machines.some(x=>x.id===m)){ A.st.machine = m; if(!tmap()[m]) go('type', true); }
  lvRefresh().then(()=>{ if(m && LV.role==='floor' && tmap()[m]) sheetMachine(m); });
  if(LV.role==='maint') pushCheck();
  lvFlush(); clearInterval(LV.timer); LV.timer = setInterval(()=>{ if(!document.hidden && LV.on) lvRefresh(); }, 30000);
  window.addEventListener('online', lvFlush); document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && LV.on) lvRefresh(); });
}
/* ---------- sign-in ---------- */
// company code and server address: from the link (?c=, ?api=), from the site folder the platform made, or from the last visit
function lvIds(){
  const sp = new URLSearchParams(location.search), set = v => v && !/^__/.test(v) ? String(v).trim() : '';
  let cid = set(sp.get('c')) || set(window.CO_ID) || ls('bd_cid'), api = set(sp.get('api')) || set(window.API_BASE) || ls('bd_api');
  if(cid && !/^[a-z0-9_-]{1,60}$/i.test(cid)) cid = ''; if(api && !/^https?:\/\/[^\s"'<>]+$/i.test(api)) api = '';
  AUTH.cid = cid; AUTH.api = api.replace(/\/+$/,''); if(cid) lsSet('bd_cid', cid); if(api) lsSet('bd_api', AUTH.api);
}
function lvScreen(html){ const a = $('lvApp'); a.innerHTML = '<div class="lvbody lvlogin">'+html+'</div>'; a.classList.add('on'); $('formScreen').style.display = 'none'; $('footerBar').style.display = 'none'; }
function lvMsg(t){ lvScreen('<div class="lvcol" style="max-width:440px;margin:40px auto 0"><h1 class="lvh1">Maintenance tool</h1><p class="lvp">'+esc(t)+'</p></div>'); }
async function lvLogin(msg){
  lvScreen('<form class="lvcol" id="lvLogin" style="max-width:440px;margin:0 auto" autocomplete="on" novalidate>'
   +'<div class="lvbrand"><img id="lvLogo" alt="" style="display:none"><div><b id="lvCo">'+esc(CLIENT.company||'')+'</b><span>'+(window.PAGE_ROLE==='maint' ? 'Maintenance desk' : window.PAGE_ROLE==='floor' ? 'Report a breakdown' : 'Maintenance tool')+'</span></div></div>'
   +'<h1 class="lvh1" style="font-size:24px">Sign in</h1>'
   +(msg ? '<div class="lvnote wt" id="lvLoginMsg"><b>'+esc(msg)+'</b></div>' : '<div id="lvLoginMsg"></div>')
   +'<label class="lvlbl" for="lvU" style="font-size:16px;font-weight:800">Username</label><input id="lvU" name="username" class="lvin2" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" value="'+esc(ls('bd_lastuser_'+AUTH.cid))+'">'
   +'<label class="lvlbl" for="lvP" style="font-size:16px;font-weight:800">Password</label><input id="lvP" name="password" class="lvin2" type="password" autocomplete="current-password">'
   +'<label class="lvcheck"><input type="checkbox" id="lvShowP"><span>Show password</span></label>'
   +'<button class="lvprim" id="lvGo" type="submit">Sign in</button>'
   +'<span class="lvhint">Your administrator gives you a username and password. You stay signed in on this phone for 30 days after your last use.</span></form>');
  const f = $('lvLogin'), u = $('lvU'), pw = $('lvP');
  $('lvShowP').addEventListener('change', e=>{ pw.type = e.target.checked ? 'text' : 'password'; });
  (u.value ? pw : u).focus();
  f.addEventListener('submit', async e=>{
    e.preventDefault(); const b = $('lvGo'), m = $('lvLoginMsg');
    const un = u.value.trim(), p = pw.value;
    if(!un || !p){ m.className = 'lvnote wt'; m.innerHTML = '<b>Enter your username and password.</b>'; return; }
    b.innerHTML = spin(true, 'Signing in...'); b.disabled = true;
    try{
      const r = await lvApi('/api/login', {username:un, password:p, device:navigator.userAgent.slice(0,120)});
      AUTH.tok = r.token; AUTH.user = r.user; lsSet('bd_tok_'+AUTH.cid, r.token); lsSet('bd_user_'+AUTH.cid, JSON.stringify(r.user)); lsSet('bd_lastuser_'+AUTH.cid, r.user.username);
      lvStart();
    }catch(x){ b.innerHTML = '<span>Sign in</span>'; b.disabled = false; m.className = 'lvnote wt'; m.innerHTML = '<b>'+esc(x.net ? 'No internet connection. Try again when you have signal.' : x.message)+'</b>'; pw.select(); }
  });
  try{ const r = await fetch(AUTH.api+'/api/brand', {headers:{'X-Client':AUTH.cid}}), j = await r.json();
    if(j.company && $('lvCo')) $('lvCo').textContent = j.company; if(j.logo && $('lvLogo')){ $('lvLogo').src = j.logo; $('lvLogo').style.display = ''; }
    if(r.status===401) lvMsg('This link has a company code the server does not know. Ask your administrator for the right link.'); }catch(e){}
}
function lvSignedOut(msg){ if(!AUTH.tok) return; lvForget(); LV.on = false; clearInterval(LV.timer); closeSheet(); lvLogin(msg); }
// loads the company settings (machines, team, lists, logo) for the signed-in person, or the copy kept on this phone when offline
async function lvStart(){
  let cached = null; try{ cached = JSON.parse(ls('bd_cfg_'+AUTH.cid)||'null'); }catch(e){}
  const go = (cfg, fp) => { LV.cfgFp = fp; applyClient(Object.assign({}, cfg, {id:AUTH.cid, api:AUTH.api})); };
  try{
    const me = await lvApi('/api/me'); if(me.user){ AUTH.user = me.user; lsSet('bd_user_'+AUTH.cid, JSON.stringify(me.user)); }
    const r = await lvApi('/api/config');
    if(!r.config){ lvMsg('The company settings are not on the server yet. Open the platform on the office computer once, with the server connected.'); return; }
    lsSet('bd_cfg_'+AUTH.cid, JSON.stringify({fp:r.fp, cfg:r.config})); go(r.config, r.fp);
  }catch(e){
    if(e.auth) return;
    if(cached && cached.cfg && AUTH.user){ go(cached.cfg, cached.fp); LV.offline = true; return; }
    lvMsg(e.net ? 'No internet connection. Connect once to sign in and load the machines, then it also works with weak signal.' : e.message);
  }
}
async function lvBoot(){
  lvIds();
  try{ Object.keys(localStorage).forEach(k=>{ if(/^bd_key_/.test(k)) localStorage.removeItem(k); }); }catch(e){} // old access keys are no longer used on phones
  if(!AUTH.cid || !AUTH.api){ lvMsg('This link is incomplete. Open the link your administrator sent you.'); return; }
  AUTH.tok = ls('bd_tok_'+AUTH.cid); try{ AUTH.user = JSON.parse(ls('bd_user_'+AUTH.cid)||'null'); }catch(e){ AUTH.user = null; }
  if(!AUTH.tok || !AUTH.user){ AUTH.tok = ''; lvLogin(); return; }
  lvStart();
}""")
fn('lvApplyConfig', r"""function lvApplyConfig(cfg, fp, save){
  const c = Object.assign({}, cfg, {id:AUTH.cid, api:AUTH.api});
  if(save) lsSet('bd_cfg_'+AUTH.cid, JSON.stringify({fp, cfg}));
  LV.cfgFp = fp; window.__baseApply(c); lvBuildCats();
  if(LV.on && !$('lvSheetB').classList.contains('on')) render();
}""")
rep("""(function(){
  const a = applyClient; window.__baseApply = a;
  applyClient = function(cfg){
    // newer company settings from the server, kept on this phone, take priority over the file on the site
    let c = cfg; try{ const x = JSON.parse(localStorage.getItem('bd_cfg_'+cfg.id)||'null'); if(x && x.cfg){ c = Object.assign({}, x.cfg, {id:cfg.id, api:x.cfg.api || cfg.api}); LV.cfgFp = x.fp; } }catch(e){}
    a(c); lvInit(); };""", """(function(){
  const a = applyClient; window.__baseApply = a;
  applyClient = function(cfg){ a(cfg); lvInit(); };""")
rep("""window.back = back;
</script>""", """window.back = back;
lvBoot();
</script>""")
# refresh: auth handled by lvApi
rep("""    if(e.auth){ lvToast(e.message, true); return; }""", """    if(e.auth) return;""")
open(p,'w').write(s); print('ok', len(s))
