p='/home/claude/cosmos_platform.html'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:80],s.count(a)); s=s.replace(a,b)
rep("""  const TABS = [['company','Company &amp; organisation'],['machines','Machines'],""","""  const TABS = [['company','Company &amp; organisation'],['people','People &amp; access'],['machines','Machines'],""")
rep("""    conn: `${btConnCard()}`,""","""    conn: `${btConnCard()}`,
    people: `${btPeopleCard()}`,""")
# links: no key any more
rep("""function liveUrl(){ const s = lvsSite(), k = lvsKey(); if(s) return s+'/live.html?c='+encodeURIComponent(lvsId())+(k?'&k='+encodeURIComponent(k):''); return String(state.settings.btLive||'').trim(); }
function phoneUrl(role){ const s = lvsSite(), k = lvsKey(); return s ? s+'/'+role+'.html?c='+encodeURIComponent(lvsId())+(k?'&k='+encodeURIComponent(k):'') : ''; }""",
"""// links carry no key: everyone signs in with the login made for them under People & access
function liveUrl(){ const s = lvsSite(); return s ? s+'/live.html?c='+encodeURIComponent(lvsId()) : ''; }
function phoneUrl(role){ const s = lvsSite(); return s ? s+'/'+role+'.html?c='+encodeURIComponent(lvsId()) : ''; }""")
rep("""    <div style="font-weight:600;margin:4px 0">Links to share</div>
    <div class="desc">Made from the site address, the company code and the key. Send the phone links on WhatsApp; each phone remembers it after the first open.</div>""",
"""    <div style="font-weight:600;margin:4px 0">Links to share</div>
    <div class="desc">The links hold no key. Each person signs in with their own login, made under <a href="#" onclick="setTab='people';renderSettings();return false">People &amp; access</a>. The access key above is only for this platform. Never put it in a link or send it to anyone.</div>""")
rep("""    <div class="desc">Where the platform, the phones and the live board find each other. Set once at the start. The access key is kept only in this browser on this computer. It is not saved in the Excel backup, so enter it again on a new computer.</div>""",
"""    <div class="desc">Where the platform, the phones and the live board find each other. Set once at the start. The access key lets this platform read every ticket, send the company settings and manage logins. It is kept only in this browser on this computer, not in the Excel backup, so enter it again on a new computer.</div>""")
rep("""<span>${u ? esc(u) : 'Enter the site address and the key'}</small>""","""<span>${u ? esc(u) : 'Enter the site address'}</small>""") if s.count("""<span>${u ? esc(u) : 'Enter the site address and the key'}</small>""") else None
s = s.replace("${u ? esc(u) : 'Enter the site address and the key'}", "${u ? esc(u) : 'Enter the site address'}")

# site folder: no company file inside, company code and server address filled in
rep("""  const enc = new TextEncoder(), F = [], f = btClientFile();
  const co = String(state.settings.btCompany||'').trim(), site = lvsSite();
  Object.keys(SITE_FILES).forEach(p=>{ let d = b64bytes(SITE_FILES[p]);
    if(/^(floor|maint|live)\\.html$/.test(p)){ let t = new TextDecoder().decode(d); t = t.split('__SITE__/').join(site ? site+'/' : '').split('__CO__ · ').join(co ? co.replace(/[<>"&]/g,'')+' · ' : ''); d = enc.encode(t); }
    F.push(['site/'+p, d]); });
  F.push(['site/clients/'+id+'.json', enc.encode(JSON.stringify(f, null, 1))]);
  F.push(['site/clients/index.json', enc.encode(JSON.stringify({default:id}))]);""",
"""  if(!lvsApi()){ toast('Enter the server address under Connections first', true); return; }
  const enc = new TextEncoder(), F = [], f = btClientFile();
  const co = String(state.settings.btCompany||'').trim(), site = lvsSite(), clean = v=>String(v).replace(/[<>"'&\\\\]/g,'');
  // the company data is not in the folder: phones and the board get it from the server after signing in
  Object.keys(SITE_FILES).forEach(p=>{ let d = b64bytes(SITE_FILES[p]);
    if(/\\.html$/.test(p)){ let t = new TextDecoder().decode(d); t = t.split('__SITE__/').join(site ? site+'/' : '').split('__CO__ · ').join(co ? clean(co)+' · ' : '').split('__CID__').join(clean(id)).split('__API__').join(clean(lvsApi())); d = enc.encode(t); }
    F.push(['site/'+p, d]); });""")
rep("""   'The company file inside is site/clients/'+id+'.json. It holds the machines, team, shifts, logo and settings from the platform.',
   'The access key is not in this zip. It stays in the links you share.'].join('\\r\\n');""",
"""   'There is no company data in this folder. Phones and the live board load the machines, team and settings from the server after each person signs in.',
   'The access key is not in this zip and must never be put in a link. Logins are made in the platform: Settings > People & access.'].join('\\r\\n');""")

# ---- People & access
rep("""function lvsCopy(u){""", r"""// ---- People & access: logins for the phones and the live board (kept on the server, never in the Excel backup)
const PPL = {list:null, err:'', busy:false, shown:null, edit:'', form:{name:'', username:'', role:'report', title:'', shared:false, password:''}};
const PPL_ROLES = [['report','Report','Shop floor. Reports breakdowns and work requests. Cannot see the live board unless switched on.'],
  ['maint','Maintenance','Starts, transfers, pauses and closes jobs. Gets the alerts.'],
  ['board','View board','Sees the live status only. For Production, Planning and Directors.'],
  ['supervisor','Supervisor','Everything Maintenance does.'],
  ['admin','Admin','Everything, and can manage logins.']];
const pplRole = r => (PPL_ROLES.find(x=>x[0]===r)||['','—'])[1];
async function pplApi(path, body){
  let r; try{ r = await fetch(lvsApi()+path, {method:body?'POST':'GET', headers:{'X-Client':lvsId(), 'X-Key':lvsKey(), 'Content-Type':'application/json'}, body:body?JSON.stringify(body):undefined}); }catch(e){ throw new Error('Could not reach the server'); }
  const j = await r.json().catch(()=>({}));
  if(r.status===401) throw new Error('The access key or company code is wrong (Connections)');
  if(r.status===404 && path==='/api/users') throw new Error('The server is an older version. Upload the new server code first (see the update steps).');
  if(!r.ok) throw new Error(j.error || ('Server error '+r.status));
  return j;
}
async function pplLoad(){
  if(PPL.busy) return; PPL.busy = true;
  try{ PPL.list = (await pplApi('/api/users')).users||[]; PPL.err = ''; }catch(e){ PPL.err = e.message; if(PPL.list===null) PPL.list = []; }
  PPL.busy = false; if(currentPage==='settings' && setTab==='people') renderSettings();
}
function pplPw(){ const L = 'abcdefghjkmnpqrstuvwxyz', D = '23456789', a = new Uint32Array(7); crypto.getRandomValues(a); return Array.from(a, (x,i)=>i<4 ? L[x%L.length] : D[x%D.length]).join(''); }
function pplSuggest(name){ const base = String(name||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,'').trim().split(/\s+/); let u = (base[0]||'').slice(0,20); if(u.length < 3) u = (base.join('')||'user').slice(0,20);
  const have = new Set((PPL.list||[]).map(x=>x.username)); let v = u, n = 2; while(have.has(v)) v = u+(n++); return v.length >= 3 ? v : v+'1'; }
function pplLink(role){ return role==='board' ? liveUrl() : phoneUrl(role==='report' ? 'floor' : 'maint'); }
function pplMsg(x){ return 'Your login for the maintenance tool ('+(state.settings.btCompany||'')+')\n'+(x.role==='board'?'Live board':'Open')+': '+pplLink(x.role)+'\nUsername: '+x.username+'\nPassword: '+x.password+'\nYou can change the password at the bottom of the screen after signing in.'; }
function pplF(k, v){ PPL.form[k] = v; if(k==='name' && !PPL.form.userTouched) { PPL.form.username = pplSuggest(v); const e = document.getElementById('ppl_u'); if(e) e.value = PPL.form.username; } if(k==='username') PPL.form.userTouched = true; if(k==='role'){ renderSettings(); } }
function pplPrefill(name){ PPL.form = {name, username:pplSuggest(name), role:'maint', title:'', shared:false, password:pplPw()}; PPL.edit = ''; renderSettings(); const e = document.getElementById('ppl_p'); if(e) e.scrollIntoView({block:'center'}); }
async function pplAdd(){
  const f = PPL.form; f.username = String(f.username||'').trim().toLowerCase(); f.name = String(f.name||'').trim();
  if(!f.name){ toast('Enter the person\'s name', true); return; } if(!f.password){ f.password = pplPw(); }
  try{ await pplApi('/api/users', {username:f.username, name:f.name, role:f.role, title:f.role==='report'?f.title:'', shared:!!f.shared, password:f.password});
    PPL.shown = {name:f.name, username:f.username, password:f.password, role:f.role}; PPL.form = {name:'', username:'', role:f.role, title:'', shared:false, password:''};
    toast('Login made for '+f.name); await pplLoad(); }
  catch(e){ toast(e.message, true); }
}
async function pplSave(un){
  const u = (PPL.list||[]).find(x=>x.username===un); if(!u) return;
  const g = id=>document.getElementById(id);
  const body = {username:un, name:g('pe_n').value.trim(), role:g('pe_r').value, title:g('pe_r').value==='report' ? (g('pe_t')||{}).value||'' : '', shared:g('pe_s').checked};
  try{ await pplApi('/api/users', body); PPL.edit = ''; toast('Saved. It applies on their phone straight away.'); await pplLoad(); }catch(e){ toast(e.message, true); }
}
async function pplAct(kind, un){
  const u = (PPL.list||[]).find(x=>x.username===un); if(!u) return;
  try{
    if(kind==='reset'){ if(!confirm('Make a new password for '+u.name+'? Their phones and screens are signed out until they sign in with the new one.')) return;
      const pw = pplPw(); await pplApi('/api/users/password', {username:un, password:pw}); PPL.shown = {name:u.name, username:un, password:pw, role:u.role}; toast('New password made for '+u.name); }
    else if(kind==='signout'){ if(!confirm('Sign '+u.name+' out of all phones and screens? They can sign in again with their password.')) return; await pplApi('/api/users/signout', {username:un}); toast(u.name+' is signed out everywhere'); }
    else if(kind==='off'){ if(!confirm('Switch off '+u.name+'? They are signed out at once and cannot sign in until switched on again.')) return; await pplApi('/api/users', {username:un, name:u.name, role:u.role, title:u.title, shared:u.shared, active:false}); toast(u.name+' switched off'); }
    else if(kind==='on'){ await pplApi('/api/users', {username:un, name:u.name, role:u.role, title:u.title, shared:u.shared, active:true}); toast(u.name+' switched on'); }
    else if(kind==='delete'){ if(!confirm('Delete the login '+un+'? Their past tickets stay as they are. Switching off is usually enough.')) return; await pplApi('/api/users/delete', {username:un}); toast('Login deleted'); }
    await pplLoad();
  }catch(e){ toast(e.message, true); }
}
function pplWhen(iso){ if(!iso) return 'never'; const m = Math.round((Date.now()-Date.parse(iso))/60000); return m < 2 ? 'just now' : m < 60 ? m+' min ago' : m < 1440 ? Math.round(m/60)+' h ago' : Math.round(m/1440)+' days ago'; }
function btPeopleCard(){
  if(!lvsApi() || !lvsKey()) return `<div class="card"><h3>People &amp; access</h3><div class="desc">Enter the server address and the access key under <a href="#" onclick="setTab='conn';renderSettings();return false">Connections</a> first. Logins are kept on the server.</div></div>`;
  if(PPL.list===null && !PPL.busy) setTimeout(pplLoad, 0);
  const L = PPL.list||[], f = PPL.form, obs = ['Operator','Setter','Supervisor','Engineer'];
  const withLogin = new Set(L.map(u=>String(u.name).toLowerCase()));
  const noLogin = activeTeam().filter(t=>t.type!=='Vendor' && !withLogin.has(String(t.name).toLowerCase())).map(t=>t.name);
  const sel = (id, opts, cur, on) => `<select id="${id}" ${on||''}>${opts.map(([v,n])=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(n)}</option>`).join('')}</select>`;
  const shown = PPL.shown ? `<div class="card" style="border-color:#059669"><h3>Send this to ${esc(PPL.shown.name)}</h3>
      <div class="desc">The password is shown only now. It is not kept anywhere you can read it again. If it is lost, make a new one with <b>New password</b>.</div>
      <pre style="white-space:pre-wrap;background:var(--bg2,#F3F4F6);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;margin:0 0 8px">${esc(pplMsg(PPL.shown))}</pre>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" onclick='lvsCopy(${JSON.stringify(pplMsg(PPL.shown)).replace(/'/g,"&#39;")})'>Copy</button>
      <button class="btn btn-secondary btn-sm" onclick='window.open("https://wa.me/?text="+encodeURIComponent(${JSON.stringify(pplMsg(PPL.shown)).replace(/'/g,"&#39;")}),"_blank","noopener")'>Send on WhatsApp</button>
      <button class="btn btn-secondary btn-sm" onclick="PPL.shown=null;renderSettings()">Done</button></div></div>` : '';
  const add = `<div class="card"><h3>Add a login</h3>
    <div class="desc">Only logins made here can sign in. A <b>personal</b> login fills in the person's name on everything they do. Tick <b>Shared phone</b> for one phone used by a whole cell or team: it asks for the person's name each time.</div>
    ${noLogin.length ? `<div style="margin:4px 0 10px;font-size:12.5px"><span style="color:var(--text3)">Team members without a login:</span> ${noLogin.slice(0,30).map(n=>`<button class="btn btn-secondary btn-sm" style="padding:1px 8px;margin:2px" onclick='pplPrefill(${JSON.stringify(n).replace(/'/g,"&#39;")})'>${esc(n)}</button>`).join('')}</div>` : ''}
    <div class="form-grid" style="max-width:760px">
      <div class="form-group"><label>Name (as it should appear on tickets)</label><input value="${esc(f.name)}" placeholder="e.g. Ravi Patel" oninput="pplF('name', this.value)"></div>
      <div class="form-group"><label>Username (small letters, no spaces)</label><input id="ppl_u" value="${esc(f.username)}" placeholder="e.g. ravi" autocapitalize="none" oninput="pplF('username', this.value.toLowerCase())"></div>
      <div class="form-group"><label>Role</label>${sel('ppl_r', PPL_ROLES.map(r=>[r[0], r[1]]), f.role, `onchange="pplF('role', this.value)"`)}<div style="color:var(--text3);font-size:11px;margin-top:3px">${esc((PPL_ROLES.find(r=>r[0]===f.role)||[])[2]||'')}</div></div>
      ${f.role==='report' ? `<div class="form-group"><label>Job on the shop floor (shown on their reports)</label>${sel('ppl_t', [['','Ask on the phone']].concat(obs.map(o=>[o,o])), f.title, `onchange="pplF('title', this.value)"`)}</div>` : ''}
      <div class="form-group"><label>Password (at least 6 characters)</label><div style="display:flex;gap:6px"><input id="ppl_p" value="${esc(f.password)}" placeholder="Make one or type one" oninput="pplF('password', this.value)"><button class="btn btn-secondary btn-sm" onclick="PPL.form.password=pplPw();renderSettings()">Make one</button></div></div>
      <div class="form-group"><label style="display:flex;gap:6px;align-items:center;margin-top:22px"><input type="checkbox" ${f.shared?'checked':''} onchange="pplF('shared', this.checked)" style="width:auto"> Shared phone (asks for the name each time)</label></div>
    </div>
    <button class="btn btn-primary btn-sm" onclick="pplAdd()">Add login</button></div>`;
  const row = u=>{
    if(PPL.edit===u.username) return `<tr><td colspan="7"><div class="form-grid" style="max-width:760px;margin:4px 0">
        <div class="form-group"><label>Name</label><input id="pe_n" value="${esc(u.name)}"></div>
        <div class="form-group"><label>Role</label>${sel('pe_r', PPL_ROLES.map(r=>[r[0], r[1]]), u.role, `onchange="document.getElementById('pe_tw').style.display=this.value==='report'?'':'none'"`)}</div>
        <div class="form-group" id="pe_tw" style="${u.role==='report'?'':'display:none'}"><label>Job on the shop floor</label>${sel('pe_t', [['','Ask on the phone']].concat(obs.map(o=>[o,o])), u.title)}</div>
        <div class="form-group"><label style="display:flex;gap:6px;align-items:center;margin-top:22px"><input id="pe_s" type="checkbox" ${u.shared?'checked':''} style="width:auto"> Shared phone</label></div></div>
        <button class="btn btn-primary btn-sm" onclick="pplSave('${esc(u.username)}')">Save</button> <button class="btn btn-secondary btn-sm" onclick="PPL.edit='';renderSettings()">Cancel</button></td></tr>`;
    const st = !u.active ? '<span style="color:#dc2626;font-weight:600">Switched off</span>' : u.locked ? '<span style="color:#d97706;font-weight:600">Locked (wrong passwords)</span>' : '<span style="color:#059669;font-weight:600">Active</span>';
    return `<tr${u.active?'':' style="opacity:.6"'}><td><b>${esc(u.name)}</b>${u.shared?' <small style="color:var(--text3)">shared phone</small>':''}</td><td>${esc(u.username)}</td><td>${esc(pplRole(u.role))}${u.title?` <small style="color:var(--text3)">${esc(u.title)}</small>`:''}</td><td>${st}</td>
      <td>${u.devices||0}</td><td><small>${esc(pplWhen(u.seen||u.lastLogin))}</small></td>
      <td style="white-space:nowrap"><button class="btn btn-secondary btn-sm" style="padding:1px 8px" onclick="PPL.edit='${esc(u.username)}';renderSettings()">Edit</button>
        <button class="btn btn-secondary btn-sm" style="padding:1px 8px" onclick="pplAct('reset','${esc(u.username)}')">New password</button>
        ${u.devices?`<button class="btn btn-secondary btn-sm" style="padding:1px 8px" onclick="pplAct('signout','${esc(u.username)}')">Sign out everywhere</button>`:''}
        ${u.active?`<button class="btn btn-secondary btn-sm" style="padding:1px 8px;color:#dc2626" onclick="pplAct('off','${esc(u.username)}')">Switch off</button>`:`<button class="btn btn-secondary btn-sm" style="padding:1px 8px" onclick="pplAct('on','${esc(u.username)}')">Switch on</button> <button class="btn btn-secondary btn-sm" style="padding:1px 8px;color:#dc2626" onclick="pplAct('delete','${esc(u.username)}')">Delete</button>`}</td></tr>`;
  };
  const counts = PPL_ROLES.map(([k,n])=>[n, L.filter(u=>u.role===k && u.active).length]).filter(x=>x[1]);
  const list = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0">Logins (${L.length})</h3><button class="btn btn-secondary btn-sm" onclick="pplLoad()">${PPL.busy?'Loading...':'Refresh'}</button></div>
    <div class="desc">${counts.length ? counts.map(([n,c])=>c+' '+esc(n)).join(' · ')+'. ' : ''}Switching someone off signs them out of every phone and screen at once. Five wrong passwords lock a login for 10 minutes; <b>New password</b> unlocks it.</div>
    ${PPL.err ? `<div style="color:#dc2626;font-size:12.5px;margin:6px 0">${esc(PPL.err)}</div>` : ''}
    ${L.length ? `<div style="overflow:auto"><table class="data-table" style="width:100%"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Devices</th><th>Last used</th><th></th></tr></thead><tbody>${L.map(row).join('')}</tbody></table></div>` : (PPL.busy ? '<div class="desc">Loading...</div>' : '<div class="desc">No logins yet. Add the first one above.</div>')}
    <div style="font-weight:600;margin:14px 0 4px">Where each role signs in</div>
    <div class="items">${[['Report','floor'],['Maintenance, Supervisor, Admin','maint'],['View board','live']].map(([n,r])=>{ const u = r==='live' ? liveUrl() : phoneUrl(r); return `<div class="list-item"><span><b>${n}</b><br><small style="color:var(--text3);word-break:break-all">${esc(u||'Enter the site address under Connections')}</small></span>${u?`<button class="btn btn-secondary btn-sm" onclick='lvsCopy(${JSON.stringify(u)})'>Copy</button>`:''}</div>`; }).join('')}</div>
    <div class="desc" style="margin-top:6px">Any login works on any of these links; the role decides what the person sees. Logins live on the server, not in the Excel backup.</div></div>`;
  return shown + add + list;
}
function lvsCopy(u){""")
open(p,'w',encoding='utf-8').write(s); print('ok', len(s))
