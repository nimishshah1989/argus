p='/home/claude/cosmos_platform.html'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:90],s.count(a)); s=s.replace(a,b)
# wrapped text in the approval table
i=s.index('</style>')
s=s[:i]+"""
.pend-act{white-space:nowrap;display:flex;flex-direction:column;gap:4px;align-items:stretch;min-width:84px}
.pend-txt{white-space:normal;min-width:160px;max-width:340px}
.clamp3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:normal}
"""+s[i:]
# which page an item belongs to
rep("""  const gw = mode==='gw', mine = x=>gw ? x.src==='general' : x.src!=='general', isGW = t=>t.kind==='general';""","""  const gw = mode==='gw', mine = x=>gw ? pendIsGW(x) : !pendIsGW(x), isGW = t=>t.kind==='general';""")
rep("""function pendApproveAll(mode){ const gw = mode==='gw', P = pendList().filter(x=>gw ? x.src==='general' : x.src!=='general');""","""function pendApproveAll(mode){ const gw = mode==='gw', P = pendList().filter(x=>(gw ? pendIsGW(x) : !pendIsGW(x)) && x.src!=='edit');""")
# the table: actions first, text wrapped, ticket number
i=s.index("""      <div class="table-wrap short"><table><thead><tr><th>From</th><th>Machine</th><th>Date</th><th>Problem</th><th>Action taken</th><th>Down</th><th>Done by</th><th></th></tr></thead><tbody>""")
j=s.index("""      </tbody></table></div></div>`;""", i)
s=s[:i]+"""      <div class="table-wrap short"><table><thead><tr><th></th><th>From</th><th>${gw?'Place':'Machine'}</th><th>Date</th><th>Problem</th><th>Action taken</th><th>${gw?'Work':'Down'}</th><th>Done by</th></tr></thead><tbody>
      ${P.map(pendRowHtml).join('')}
"""+s[j:]
rep("""// entries approved before ticket numbers existed""","""// ---- approval rows (buttons first so they never need scrolling; long text wraps to 3 lines, full text on hover)
const pendIsGW = x => x.src==='general' || (x.src==='edit' && x.gw);
const ptx = (t, cls) => `<td class="pend-txt"><div class="clamp3" title="${esc(t||'')}">${esc(t||'—')}</div></td>`;
function pendRowHtml(x){
  const r = x.rec||{}, b = (fn, label, cls) => `<button class="btn ${cls||'btn-secondary'} btn-sm" onclick="${fn}('${x.id}'${fn==='pendApprove' && label==='Edit' ? ',true' : ''})">${label}</button>`;
  const ref = r.ticketRef ? '<b>'+esc(r.ticketRef)+'</b><br>' : '';
  if(x.src==='edit'){
    const L = (x.changes||[]).map(c=>esc(c[0])+': '+esc(c[1])+' → <b>'+esc(c[2])+'</b>').join('<br>');
    return `<tr style="background:#f0fdfa"><td><div class="pend-act">${b('pendAcceptEdit','Accept','btn-primary')}${b('pendReject','Reject')}</div></td>
      <td style="font-size:11px">${x.ref?'<b>'+esc(x.ref)+'</b><br>':''}<b style="color:#0f766e">Edited on phone</b><br><span style="color:var(--text3)">by ${esc(x.by||'admin')} · ${lvsWhen(x.at)}</span></td>
      <td><b>${esc(x.place||'')}</b></td><td>${esc(x.date||'')}</td><td class="pend-txt" colspan="2"><div style="font-size:12px;line-height:1.5">${L}</div>${x.reason?'<div style="font-size:11px;color:var(--text3);margin-top:3px">Reason: '+esc(x.reason)+'</div>':''}</td><td></td><td></td></tr>`;
  }
  if(x.src==='general') return `<tr><td><div class="pend-act">${b('pendApprove','Approve','btn-primary')}${b('pendEditGW','Edit')}${b('pendReject','Reject')}</div></td>
    <td style="font-size:11px">${ref}Work request<br><span style="color:var(--text3)">closed ${lvsWhen(x.at)}</span>${x.edited?'<br><span style="color:#0f766e">edited on phone</span>':''}</td><td><b>${esc(r.location)}</b><br><span style="font-size:11px;color:var(--text3)">${esc(r.workType)}</span></td><td>${esc(r.date)}</td>${ptx(r.problem)}${ptx(r.done)}<td>${lvsDur(r.activeMin)}</td><td>${esc(r.doneBy||'—')}</td></tr>`;
  const unk = !bdAnyMachine(r.machineId);
  return `<tr><td><div class="pend-act">${b('pendApprove','Approve','btn-primary')}${b('pendApprove','Edit')}${b('pendReject','Reject')}</div></td>
    <td style="font-size:11px">${ref}${x.src==='live' ? 'Live ticket'+(x.at?'<br><span style="color:var(--text3)">closed '+lvsWhen(x.at)+'</span>':'')+(x.transfers?'<br><span style="color:var(--text3)">transferred '+x.transfers+'×</span>':'')+(r.waitMin?'<br><span style="color:var(--text3)">waited '+lvsDur(r.waitMin)+'</span>':'') : 'PDF'+(x.file?'<br><span style="color:var(--text3)">'+esc(x.file)+'</span>':'')}${x.edited?'<br><span style="color:#0f766e">edited on phone</span>':''}</td>
    <td><b>${esc(r.machineId)}</b>${unk?'<br><span style="color:#dc2626;font-size:11px">Not in machine list</span>':(bdSegOf(r.machineId)!=='CNC'?'<br><span style="color:var(--text3);font-size:11px">'+esc(bdSegOf(r.machineId))+'</span>':'')}</td><td>${esc(r.date)}</td>${ptx(r.problem)}${ptx(r.correctiveAction)}<td>${lvsDur(r.downMin)}</td><td>${esc(r.doneBy||'—')}</td></tr>`;
}

// ---- General Work: edit an entry in the log, or a work request waiting for approval
let gwEdit = null;
function gwFind(t){ return t.kind==='pend' ? ((pendList().find(x=>x.id===t.id)||{}).rec) : gwLog().find(r=>r.id===t.id); }
function pendEditGW(pid){ openGWForm({kind:'pend', id:pid}); }
function openGWForm(t){
  const r = gwFind(t); if(!r){ toast('Entry not found', true); return; } gwEdit = t;
  const types = btList('btWorkTypes', BT_WORK_TYPES), team = activeTeam().map(x=>x.name);
  document.getElementById('modalBox').innerHTML = `<div class="modal-head"><h2>Edit work request${r.ticketRef?' '+esc(r.ticketRef):''}</h2><button class="modal-close" onclick="closeModal()">&times;</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="form-group"><label>Date</label><input type="date" id="gw_date" value="${esc(toISODate(r.date||''))}"></div>
      <div class="form-group"><label>Place</label><input id="gw_loc" value="${esc(r.location||'')}"></div>
      <div class="form-group"><label>Type of work</label><select id="gw_type">${[...new Set(types.concat(r.workType?[r.workType]:[]))].map(x=>`<option ${x===r.workType?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Work time (min)</label><input type="number" min="0" id="gw_min" value="${esc(r.activeMin||0)}"></div>
      <div class="form-group full"><label>Job</label><textarea id="gw_prob">${esc(r.problem||'')}</textarea></div>
      <div class="form-group full"><label>What was done</label><textarea id="gw_done">${esc(r.done||'')}</textarea></div>
      <div class="form-group"><label>Done by</label><select id="gw_by"><option value=""></option>${[...new Set(team.concat(r.doneBy?[r.doneBy]:[]))].map(x=>`<option ${x===r.doneBy?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Raised by</label><input id="gw_rep" value="${esc(r.reportedBy||'')}"></div>
      <div class="form-group"><label style="display:flex;gap:6px;align-items:center;margin-top:22px"><input type="checkbox" id="gw_urg" ${r.urgent?'checked':''} style="width:auto"> Urgent</label></div>
    </div></div>
    <div class="modal-foot"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveGWForm()">Save</button></div>`;
  openModal();
}
function saveGWForm(){
  const r = gwEdit && gwFind(gwEdit); if(!r) return; const g = id=>document.getElementById(id);
  const d = g('gw_date').value, prob = g('gw_prob').value.trim();
  if(!d){ toast('Enter the date', true); return; } if(!prob){ toast('Describe the job', true); return; }
  Object.assign(r, {date:fromISODate(d), location:g('gw_loc').value.trim(), workType:g('gw_type').value, activeMin:Math.max(0, Number(g('gw_min').value)||0), problem:prob, done:g('gw_done').value.trim(), doneBy:g('gw_by').value, reportedBy:g('gw_rep').value.trim(), urgent:g('gw_urg').checked});
  persist(); closeModal(); lvsPaint(); if(currentPage==='gw') renderGW(); toast('Saved');
}

// ---- tickets corrected by an admin on the phone: checked every 12 hours (last 7 days), or with Check now
function lvsEditVals(t){
  const d = new Date(t.downAt), p = n=>String(n).padStart(2,'0'), date = p(d.getDate())+'-'+p(d.getMonth()+1)+'-'+d.getFullYear();
  if(t.kind==='general') return {date, problem:t.problem||'', activeMin:t.activeMin||0, waitMin:t.waitMin||0, segments:t.segments||[]};
  const dm = t.kind==='stopped' ? (t.downtimeMin||0) : (t.activeMin||0);
  const o = {date, problem:t.problem||'', downMin:dm, downHrs:Math.round(dm/60*100)/100, activeMin:t.activeMin||0, waitMin:t.waitMin||0, segments:t.segments||[]};
  if(t.responseMin!=null) o.respMin = t.responseMin; return o;
}
const EDIT_LABEL = {date:'Date', problem:'Problem', downMin:'Downtime (min)', respMin:'Response (min)', activeMin:'Work time (min)', waitMin:'Waiting (min)'};
async function lvsCheckEdits(force){
  const k = 'bt_edits_'+lvsId(); let last = 0; try{ last = Number(localStorage.getItem(k))||0; }catch(e){}
  if(!force && Date.now()-last < 12*3600000) return 0;
  const r = await lvsFetch('/api/edits?since='+encodeURIComponent(new Date(last ? last-3600000 : Date.now()-7*86400000).toISOString()));
  const seen = state.editSeen || (state.editSeen = {}); let n = 0;
  (r.tickets||[]).forEach(t=>{
    if(!t.editedAt || seen[t.id]===t.editedAt) return; seen[t.id] = t.editedAt;
    const nv = lvsEditVals(t), le = t.lastEdit||{};
    const p = pendList().find(x=>x.ticketId===t.id && x.src!=='edit');
    if(p){ Object.assign(p.rec, nv); if(t.ref) p.rec.ticketRef = t.ref; p.edited = true; n++; return; }   // not approved yet: the waiting entry is simply updated
    const rec = bdAll().find(b=>b.ticketId===t.id) || gwLog().find(b=>b.ticketId===t.id); if(!rec) return;
    const ch = Object.keys(EDIT_LABEL).filter(f=>nv[f]!==undefined && String(nv[f])!==String(rec[f]==null?'':rec[f])).map(f=>[EDIT_LABEL[f], rec[f]==null||rec[f]===''?'—':rec[f], nv[f]]);
    if(!ch.length) return;
    state.pendingBD = pendList().filter(x=>!(x.src==='edit' && x.ticketId===t.id));
    pendList().push({id:genId('pend'), src:'edit', ticketId:t.id, recId:rec.id, gw:t.kind==='general', ref:t.ref||rec.ticketRef||'', place:t.kind==='general' ? (t.location||'') : t.machine, date:nv.date, changes:ch, vals:nv, reason:le.reason||'', by:le.by||'', at:t.editedAt});
    n++;
  });
  try{ localStorage.setItem(k, String(Date.now())); }catch(e){}
  if(n){ persist(); lvsPaint(); }
  return n;
}
function pendAcceptEdit(id){
  const P = pendList(), i = P.findIndex(x=>x.id===id); if(i<0) return; const x = P[i];
  const rec = x.gw ? gwLog().find(r=>r.id===x.recId) : bdFind(x.recId);
  if(rec){ const v = Object.assign({}, x.vals); if(x.gw) ['downMin','downHrs','respMin'].forEach(f=>delete v[f]); Object.assign(rec, v); rec.editNote = 'Corrected on phone by '+(x.by||'admin')+(x.reason?': '+x.reason:''); }
  P.splice(i,1); persist(); lvsPaint(); if(currentPage==='breakdowns') renderBreakdownTable(); if(currentPage==='gw') renderGW();
  toast(rec ? 'Correction applied to '+(x.ref||x.place) : 'The entry is no longer in the log');
}

// entries approved before ticket numbers existed""")
# waiting items get their ticket numbers too
rep("""  const miss = bdAll().concat(gwLog()).filter(b=>b && b.ticketId && !b.ticketRef); if(!miss.length) return;""","""  const miss = bdAll().concat(gwLog(), pendList().map(x=>x.rec).filter(Boolean)).filter(b=>b && b.ticketId && !b.ticketRef); if(!miss.length) return;""")
rep("""    try{ await lvsFillRefs(); }catch(e){}""","""    try{ await lvsFillRefs(); }catch(e){}
    try{ const ne = await lvsCheckEdits(!!manual); if(ne) toast(ne+' ticket correction'+(ne>1?'s':'')+' from the phones'); }catch(e){}""")
# General Work log: Edit button on each entry
rep("""      ${V.slice().reverse().map(r=>`<tr><td style="font-family:var(--mono);font-size:11px;white-space:nowrap">${r.ticketRef?esc(r.ticketRef):'—'}</td>""","""      ${V.slice().reverse().map(r=>`<tr><td style="font-family:var(--mono);font-size:11px;white-space:nowrap">${r.ticketRef?esc(r.ticketRef):'—'}<br><button class="btn btn-secondary btn-sm" style="padding:1px 8px;margin-top:3px;font-family:inherit" onclick="openGWForm({kind:'log', id:'${esc(r.id)}'})">Edit</button></td>""")
open(p,'w',encoding='utf-8').write(s); print('ok')
