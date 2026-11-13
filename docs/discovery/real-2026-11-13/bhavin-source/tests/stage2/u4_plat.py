p='/home/claude/cosmos_platform.html'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:90],s.count(a)); s=s.replace(a,b)
# 1. approvals newest first, ticket number shown
rep("""  const P = pendList().filter(mine), stuck""","""  const P = pendList().filter(mine).slice().sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))), stuck""")
rep("""        if(x.src==='general') return `<tr><td style="font-size:11px">Work request<br>""","""        if(x.src==='general') return `<tr><td style="font-size:11px">${r.ticketRef?'<b>'+esc(r.ticketRef)+'</b><br>':''}Work request<br>""")
rep("""        return `<tr><td style="font-size:11px">${x.src==='live' ? 'Live ticket'""","""        return `<tr><td style="font-size:11px">${r.ticketRef?'<b>'+esc(r.ticketRef)+'</b><br>':''}${x.src==='live' ? 'Live ticket'""")
# 2. ticket number travels with approved records
rep("""      const rec = {id:genId('gw'), ticketId:t.id, date:""","""      const rec = {id:genId('gw'), ticketId:t.id, ticketRef:t.ref||'', date:""")
rep("""    const rec = bdFromPayload(p, 'bd_live'); rec.ticketId = t.id;""","""    const rec = bdFromPayload(p, 'bd_live'); rec.ticketId = t.id; if(t.ref) rec.ticketRef = t.ref;""")
rep("""    spare1: p.sp || '', cost1: 0, spare2:'', cost2:0, spare3:'', cost3:0 };""","""    spare1: p.sp || '', cost1: 0, spare2:'', cost2:0, spare3:'', cost3:0, ...(p.tk ? {ticketRef:String(p.tk).slice(0,20)} : {}) };""")
# 3. Breakdown Log: Ticket No. column and search
rep("""    const s = !search || [b.machineId,b.problem,b.doneBy,b.correctiveAction].join(' ').toLowerCase().includes(search);""","""    const s = !search || [b.machineId,b.problem,b.doneBy,b.correctiveAction,b.ticketRef||''].join(' ').toLowerCase().includes(search);""")
rep("""['Sr No','Section','Machine','Date','Shift','Problem','Done By','Supported By','Downtime (Hrs)','Code','Spare Cost','','']""","""['Sr No','Ticket No.','Section','Machine','Date','Shift','Problem','Done By','Supported By','Downtime (Hrs)','Code','Spare Cost','','']""")
rep("""      <td>${srNoMap.get(b.id) ?? '—'}</td>
      <td style="font-size:11px">${b.seg ?""","""      <td>${srNoMap.get(b.id) ?? '—'}</td>
      <td style="font-family:var(--mono);font-size:11px;white-space:nowrap">${b.ticketRef ? esc(b.ticketRef) : '<span style="color:var(--text3)">—</span>'}</td>
      <td style="font-size:11px">${b.seg ?""")
rep("""<input class="search-box" id="bdSearch" placeholder="Search problem, machine, done by..." oninput="renderBreakdownTable()">""","""<input class="search-box" id="bdSearch" placeholder="Search problem, machine, done by, ticket no..." oninput="renderBreakdownTable()">""")
rep("""colspan="12"><div class="empty-state"><div class="ic">&#9888;</div>No breakdown entries match""","""colspan="14"><div class="empty-state"><div class="ic">&#9888;</div>No breakdown entries match""")
# 4. General Work log: ticket column, search
rep("""(r.location+' '+r.workType+' '+r.problem+' '+r.done+' '+r.doneBy).toLowerCase()""","""(r.location+' '+r.workType+' '+r.problem+' '+r.done+' '+r.doneBy+' '+(r.ticketRef||'')).toLowerCase()""")
rep("""<thead><tr><th>Date</th><th>Place</th><th>Type</th><th>Job</th>""","""<thead><tr><th>Ticket No.</th><th>Date</th><th>Place</th><th>Type</th><th>Job</th>""")
rep("""      ${V.slice().reverse().map(r=>`<tr><td>${esc(r.date)}</td>""","""      ${V.slice().reverse().map(r=>`<tr><td style="font-family:var(--mono);font-size:11px;white-space:nowrap">${r.ticketRef?esc(r.ticketRef):'—'}</td><td>${esc(r.date)}</td>""")
# 5. Excel backup: Ticket No. column
rep("""'Record ID','Response time (Min)','Repair time (Min)','Section','Ticket ID'];""","""'Record ID','Response time (Min)','Repair time (Min)','Section','Ticket ID','Ticket No.'];""")
rep("""      b.respMin==null?'':b.respMin, b.activeMin==null?'':b.activeMin, b.seg||'CNC', b.ticketId||'']);""","""      b.respMin==null?'':b.respMin, b.activeMin==null?'':b.activeMin, b.seg||'CNC', b.ticketId||'', b.ticketRef||'']);""")
rep("""resp:col(['Response time (Min)'],-1), rep:col(['Repair time (Min)'],-1), sec:col(['Section'],-1), tk:col(['Ticket ID'],-1)};""","""resp:col(['Response time (Min)'],-1), rep:col(['Repair time (Min)'],-1), sec:col(['Section'],-1), tk:col(['Ticket ID'],-1), tno:col(['Ticket No.'],-1)};""")
rep("""        if(C.tk>=0 && r[C.tk]) rec.ticketId = String(r[C.tk]);""","""        if(C.tk>=0 && r[C.tk]) rec.ticketId = String(r[C.tk]);
        if(C.tno>=0 && r[C.tno]) rec.ticketRef = String(r[C.tno]);""")
# 6. per-machine Excel: ticket number
rep("""  const H = ['#','Date','Shift','Problem',""","""  const H = ['#','Date','Ticket No.','Shift','Problem',""")
rep("""  const rows = L.map((b,i)=>[i+1, dt(b.date), b.shift||'',""","""  const rows = L.map((b,i)=>[i+1, dt(b.date), b.ticketRef||'', b.shift||'',""")
rep("""  XLSX.utils.sheet_add_aoa(ws, [['','','','Total','','','','',{f:'SUM(I5:I'+last+')'},{f:'SUM(J5:J'+last+')'}]], {origin:'A'+(last+1)});
  ws['!cols'] = [4,12,6,36,12,40,18,14,12,12,12,12,9,6,40,12].map(w=>({wch:w})); ws['!autofilter'] = {ref:'A4:P'+last};""","""  XLSX.utils.sheet_add_aoa(ws, [['','','','','Total','','','','',{f:'SUM(J5:J'+last+')'},{f:'SUM(K5:K'+last+')'}]], {origin:'A'+(last+1)});
  ws['!cols'] = [4,12,10,6,36,12,40,18,14,12,12,12,12,9,6,40,12].map(w=>({wch:w})); ws['!autofilter'] = {ref:'A4:Q'+last};""")
# 7. company settings: ticket prefixes, shift timings and each person's usual shift go to the phones
rep("""    features:btFeat(), floorLive:!!s.btFloorLive,""","""    ticketPrefix:{bd:btPrefix('bd'), wr:btPrefix('wr')}, shiftTimes:(s.shiftTimes||[]).filter(x=>x && x.name && x.start).map(x=>({name:String(x.name), start:x.start, end:x.end||''})),
    teamShifts:(()=>{ const o = {}; activeTeam().forEach(t=>{ if(t.shift) o[t.name] = String(t.shift); }); return o; })(),
    features:btFeat(), floorLive:!!s.btFloorLive,""")
rep("""function btFeat(){""","""function btPrefix(k){ const v = String((state.settings.btPrefix||{})[k]||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); return v || (k==='wr' ? 'WR' : 'BD'); }
function btSetPrefix(k, v){ if(!state.settings.btPrefix) state.settings.btPrefix = {}; state.settings.btPrefix[k] = String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); persist(); renderPage('settings'); toast('Saved. New tickets get it within a minute; existing numbers stay.'); }
function btFeat(){""")
rep("""    <div style="font-weight:600;margin:14px 0 4px">Segments shown on the phones</div>""","""    <div style="font-weight:600;margin:14px 0 4px">Ticket numbers</div>
    <div class="desc">Every ticket gets a running number for reference on the phones, the PDF, WhatsApp and the logs, e.g. ${btPrefix('bd')}-0042. Changing the prefix applies to new tickets only.</div>
    <div class="form-grid" style="max-width:520px"><div class="form-group"><label>Breakdowns (machine stopped or needs support)</label><input value="${esc(btPrefix('bd'))}" maxlength="6" onchange="btSetPrefix('bd', this.value)"></div>
      <div class="form-group"><label>Work requests (not a machine)</label><input value="${esc(btPrefix('wr'))}" maxlength="6" onchange="btSetPrefix('wr', this.value)"></div></div>
    <div style="font-weight:600;margin:14px 0 4px">Segments shown on the phones</div>""")
# 8. Team Members: usual shift
rep("""        ${t.status==='Inactive'?' <span class="badge badge-grey">Inactive</span>':''}</span>
      <span style="display:flex;gap:10px;align-items:center">""","""        ${t.status==='Inactive'?' <span class="badge badge-grey">Inactive</span>':''}</span>
      <span style="display:flex;gap:10px;align-items:center">
        ${t.type!=='Vendor' ? `<select title="Usual shift (used for the day report on the phones)" style="width:auto;font-size:11px;padding:2px 6px" onchange="teamSetShift(${i}, this.value)"><option value="">Usual shift: not set</option>${(state.settings.shifts||[]).map(x=>`<option value="${esc(x)}" ${String(t.shift||'')===String(x)?'selected':''}>Shift ${esc(x)}</option>`).join('')}</select>` : ''}""")
rep("""function addTeamMember(){""","""function teamSetShift(i, v){ const t = state.settings.team[i]; if(!t) return; if(v) t.shift = String(v); else delete t.shift; persist(); toast(v ? t.name+': usual shift '+v : t.name+': usual shift cleared'); }
function addTeamMember(){""")
rep("""      <h3>Team Members &amp; Vendors</h3>
      <div class="desc">Feeds the Done By / Supported By dropdowns. Inactive members stay in history but drop out of new-entry dropdowns.</div>""","""      <h3>Team Members &amp; Vendors</h3>
      <div class="desc">Feeds the Done By / Supported By dropdowns. Inactive members stay in history but drop out of new-entry dropdowns. The usual shift fills in the shift on each person's day report on the phone; they can change it there. Shift start and end times are in Shift timings above.</div>""")
# 9. numbers for entries approved before ticket numbers existed (looked up once from the server)
rep("""    await lvsPushConfig();""","""    await lvsPushConfig();
    try{ await lvsFillRefs(); }catch(e){}""")
rep("""// ---- company settings go to the server""","""// entries approved before ticket numbers existed: look their numbers up once (and again daily while any are missing)
async function lvsFillRefs(){
  const miss = bdAll().concat(gwLog()).filter(b=>b && b.ticketId && !b.ticketRef); if(!miss.length) return;
  const k = 'bt_refs_'+lvsId(); let last = 0; try{ last = Number(localStorage.getItem(k))||0; }catch(e){}
  if(Date.now()-last < 86400000) return;
  const h = await lvsFetch('/api/history?days=400'), m = {}; (h.tickets||[]).forEach(t=>{ if(t.ref) m[t.id] = t.ref; });
  let n = 0; miss.forEach(b=>{ if(m[b.ticketId]){ b.ticketRef = m[b.ticketId]; n++; } });
  try{ localStorage.setItem(k, String(Date.now())); }catch(e){}
  if(n){ persist(); if(currentPage==='breakdowns') renderBreakdownTable(); if(currentPage==='gw') renderGW(); }
}
// ---- company settings go to the server""")
open(p,'w',encoding='utf-8').write(s); print('ok')
