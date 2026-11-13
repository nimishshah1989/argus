p='/home/claude/cosmos_platform.html'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:90],s.count(a)); s=s.replace(a,b)

# ---------- helpers: every section's machines, breakdowns outside CNC kept in their own list (CNC analytics untouched)
rep("""function machineIds(){ return nonRobotMachines().map(m=>m.id).sort(); }""","""function machineIds(){ return nonRobotMachines().map(m=>m.id).sort(); }
// Breakdowns for Conventional, Process, Utility and DG machines live in state.otherBD, so every CNC figure (which reads state.breakdowns) stays as it was.
function otherBD(){ if(!Array.isArray(state.otherBD)) state.otherBD = []; return state.otherBD; }
const BD_SECS = [['CNC','CNC machines'],['Conventional','Conventional machines'],['Process','Process machines'],['Utility','Utilities'],['DG','DG sets']];
function bdSecLists(){ return [['CNC', nonRobotMachines()],['Conventional', state.convMachines||[]],['Process', state.procMachines||[]],['Utility', state.utilMachines||[]],['DG', state.dgMachines||[]]]; }
function bdSegOf(id){ for(const [sec, L] of bdSecLists()){ if(L.some(m=>m && m.id===id)) return sec; } return ''; }
function bdAnyMachine(id){ for(const [, L] of bdSecLists()){ const m = L.find(x=>x && x.id===id); if(m) return m; } return null; }
function bdAll(){ return state.breakdowns.concat(otherBD()); }
function bdFind(id){ return state.breakdowns.find(b=>b.id===id) || otherBD().find(b=>b.id===id); }
// puts an entry in the right list for its machine (CNC list or the other-sections list), replacing any older copy with the same id
function bdStore(rec){
  state.breakdowns = state.breakdowns.filter(b=>b.id!==rec.id); state.otherBD = otherBD().filter(b=>b.id!==rec.id);
  const seg = bdSegOf(rec.machineId); if(seg && seg!=='CNC'){ rec.seg = seg; state.otherBD.push(rec); } else { delete rec.seg; state.breakdowns.push(rec); }
}
function bdPickerHtml(sel){
  return bdSecLists().map(([sec, L])=>{ const ids = L.map(m=>m.id).filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b), undefined, {numeric:true}));
    return ids.length ? `<optgroup label="${esc((BD_SECS.find(x=>x[0]===sec)||[sec,sec])[1])}">${ids.map(mid=>`<option value="${esc(mid)}" ${mid===sel?'selected':''}>${esc(mid)}</option>`).join('')}</optgroup>` : ''; }).join('');
}""")

# ---------- breakdown form
rep("""            <option value="">Select machine...</option>
            ${machineIds().map(mid=>`<option value="${esc(mid)}" ${mid===b.machineId?'selected':''}>${esc(mid)}</option>`).join('')}
          </select></div>
        <div class="form-group"><label>Category (auto)</label><input class="auto" id="f_categoryPreview" readonly value="${esc((getMachine(b.machineId)||{}).category||'')}"></div>""",
"""            <option value="">Select machine...</option>
            ${bdPickerHtml(b.machineId)}
          </select></div>
        <div class="form-group"><label>Category (auto)</label><input class="auto" id="f_categoryPreview" readonly value="${esc(b.machineId ? ((bdAnyMachine(b.machineId)||{}).category||'')+(bdSegOf(b.machineId)&&bdSegOf(b.machineId)!=='CNC'?' · '+bdSegOf(b.machineId):'') : '')}"></div>""")
rep("""  const b = id ? state.breakdowns.find(x=>x.id===id) : {};
  const doneNames""","""  const b = id ? (bdFind(id)||{}) : {};
  const doneNames""")
rep("""        <div class="form-group"><label>Down Time (Min) <span class="req">*</span></label><input type="number" id="f_downMin" value="${esc(b.downMin||'')}" oninput="updateDownHrsPreview()"></div>
        <div class="form-group"><label>Down Time (Hrs, auto)</label><input class="auto" id="f_downHrsPreview" readonly value="${esc(b.downHrs||0)}"></div>""",
"""        <div class="form-group"><label>Machine downtime (min) <span class="req">*</span></label><input type="number" id="f_downMin" value="${esc(b.downMin||'')}" oninput="updateDownHrsPreview()"><span class="hint">From the report until the machine runs again, including waiting for spares or a vendor</span></div>
        <div class="form-group"><label>Machine downtime (hrs, auto)</label><input class="auto" id="f_downHrsPreview" readonly value="${esc(b.downHrs||0)}"></div>
        <div class="form-group"><label>Response time (min)</label><input type="number" id="f_respMin" value="${b.respMin==null?'':esc(b.respMin)}" placeholder="Optional"><span class="hint">From the report until work started${b.ticketId?' (from the live ticket)':''}</span></div>
        <div class="form-group"><label>Repair time (min)</label><input type="number" id="f_repairMin" value="${(b.activeMin!=null?b.activeMin:b.repairMin)==null?'':esc(b.activeMin!=null?b.activeMin:b.repairMin)}" placeholder="Optional"><span class="hint">Only the time maintenance was working on it (pauses and transfers left out)</span></div>""")
rep("""        <div class="form-group"><label>PM Hours</label><input type="number" id="f_pmHrs" value="${esc(b.pmHrs||0)}"></div>
        <div class="form-group"><label>UTI Hours</label><input type="number" id="f_utiHrs" value="${esc(b.utiHrs||0)}"></div>""",
"""        <div class="form-group"><label>PM Hours</label><input type="number" id="f_pmHrs" value="${esc(b.pmHrs||0)}"></div>
        <div class="form-group"></div>""")
rep("""  const m = getMachine(mid);
  document.getElementById('f_categoryPreview').value = m ? m.category : '';""","""  const m = bdAnyMachine(mid), sg = bdSegOf(mid);
  document.getElementById('f_categoryPreview').value = m ? (m.category||'')+(sg && sg!=='CNC' ? ' · '+sg : '') : '';""")
rep("""  if(!getMachine(mid)){ toast('Select a valid machine from the list', true); return; }""","""  if(!bdAnyMachine(mid)){ toast('Select a valid machine from the list', true); return; }""")
rep("""  const obj = {
    id: editingBreakdownId || genId('bd'),""","""  const old = editingBreakdownId ? bdFind(editingBreakdownId) : null;
  const numOrNull = v => String(v).trim()==='' ? null : Math.max(0, Number(v)||0);
  const obj = Object.assign({}, old||{}, {
    id: editingBreakdownId || genId('bd'),""")
rep("""    pmHrs: Number(document.getElementById('f_pmHrs').value)||0, utiHrs: Number(document.getElementById('f_utiHrs').value)||0,
    spare1: document.getElementById('f_spare1').value.trim(), cost1: Number(document.getElementById('f_cost1').value)||0,
    spare2: document.getElementById('f_spare2').value.trim(), cost2: Number(document.getElementById('f_cost2').value)||0,
    spare3: document.getElementById('f_spare3').value.trim(), cost3: Number(document.getElementById('f_cost3').value)||0
  };
  if(editingBreakdownId){
    const idx = state.breakdowns.findIndex(b=>b.id===editingBreakdownId);
    const oldB = state.breakdowns[idx]; state.breakdowns[idx] = obj; try{ glLearn(oldB, obj); }catch(e){}
    toast('Breakdown entry updated');
  } else {
    state.breakdowns.push(obj);
    toast('Breakdown entry added');
  }""","""    pmHrs: Number(document.getElementById('f_pmHrs').value)||0,
    spare1: document.getElementById('f_spare1').value.trim(), cost1: Number(document.getElementById('f_cost1').value)||0,
    spare2: document.getElementById('f_spare2').value.trim(), cost2: Number(document.getElementById('f_cost2').value)||0,
    spare3: document.getElementById('f_spare3').value.trim(), cost3: Number(document.getElementById('f_cost3').value)||0
  });
  delete obj.utiHrs;
  const rv = numOrNull(document.getElementById('f_respMin').value), pv = numOrNull(document.getElementById('f_repairMin').value);
  if(rv==null) delete obj.respMin; else obj.respMin = rv;
  if(pv==null) delete obj.activeMin; else obj.activeMin = pv;
  if(old){ try{ glLearn(old, obj); }catch(e){} }
  bdStore(obj);
  toast(old ? 'Breakdown entry updated' : 'Breakdown entry added'+(obj.seg ? ' ('+obj.seg+'; kept out of the CNC analytics)' : ''));""")
rep("""  state.breakdowns = state.breakdowns.filter(b=>b.id!==id);
  persist(); toast('Entry deleted'); renderBreakdownTable();""","""  state.breakdowns = state.breakdowns.filter(b=>b.id!==id); state.otherBD = otherBD().filter(b=>b.id!==id);
  persist(); toast('Entry deleted'); renderBreakdownTable();""")

# ---------- breakdown log: section column and filter
rep("""      <select class="select-box" id="bdMcFilter" onchange="renderBreakdownTable()">
        <option value="">All Machines</option>
        ${machineIds().map(id=>`<option value="${esc(id)}">${esc(id)}</option>`).join('')}
      </select>""","""      <select class="select-box" id="bdSecFilter" onchange="renderBreakdownTable()">
        <option value="">All sections</option>${BD_SECS.map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}
      </select>
      <select class="select-box" id="bdMcFilter" onchange="renderBreakdownTable()">
        <option value="">All Machines</option>
        ${bdPickerHtml('')}
      </select>""")
rep("""  const monthF = document.getElementById('bdMonthFilter')?.value||'';
  let list = state.breakdowns.filter(b=>{""","""  const monthF = document.getElementById('bdMonthFilter')?.value||'';
  const secF = document.getElementById('bdSecFilter')?.value||'';
  let list = bdAll().filter(b=>{
    if(secF && (b.seg||'CNC')!==secF) return false;""")
rep("""  document.getElementById('bdThead').innerHTML = '<tr>'+['Sr No','Machine','Date','Shift','Problem','Done By','Supported By','Down (Hrs)','Code','Spare Cost','',''].map(h=>'<th>'+h+'</th>').join('')+'</tr>';""",
"""  document.getElementById('bdThead').innerHTML = '<tr>'+['Sr No','Section','Machine','Date','Shift','Problem','Done By','Supported By','Downtime (Hrs)','Code','Spare Cost','',''].map(h=>'<th>'+h+'</th>').join('')+'</tr>';""")
rep("""      <td>${srNoMap.get(b.id) ?? '—'}</td>
      <td><b style="color:var(--accent)">${esc(b.machineId)}</b></td>""","""      <td>${srNoMap.get(b.id) ?? '—'}</td>
      <td style="font-size:11px">${b.seg ? `<span class="badge badge-grey">${esc(b.seg)}</span>` : 'CNC'}</td>
      <td><b style="color:var(--accent)">${esc(b.machineId)}</b></td>""")
rep("""No breakdown entries match your filters</div></td></tr>`;""","""No breakdown entries match your filters</div></td></tr>`;
  if(otherBD().length && !secF) document.getElementById('bdCount').textContent = list.length+' entries ('+otherBD().length+' outside CNC, not in the analytics)';""")

# ---------- approvals and PDF import: any section, stored in the right list
rep("""  const x = P[i]; if(x.src==='general') gwLog().push(x.rec); else state.breakdowns.push(x.rec);""","""  const x = P[i]; if(x.src==='general') gwLog().push(x.rec); else bdStore(x.rec);""")
rep("""  const P = pendList(), known = new Set([...P.map(x=>x.ticketId).filter(Boolean), ...state.breakdowns.map(b=>b.ticketId).filter(Boolean), ...lvsDone()]);""",
"""  const P = pendList(), known = new Set([...P.map(x=>x.ticketId).filter(Boolean), ...bdAll().map(b=>b.ticketId).filter(Boolean), ...lvsDone()]);""")
rep("""      ${P.map(x=>{ const r = x.rec, unk = !getMachine(r.machineId) && !machineIds().includes(r.machineId);""","""      ${P.map(x=>{ const r = x.rec, unk = !bdAnyMachine(r.machineId);""")
rep("""          <td><b>${esc(r.machineId)}</b>${unk?'<br><span style="color:#dc2626;font-size:11px">Not in machine list</span>':''}</td>""",
"""          <td><b>${esc(r.machineId)}</b>${unk?'<br><span style="color:#dc2626;font-size:11px">Not in machine list</span>':(bdSegOf(r.machineId)!=='CNC'?'<br><span style="color:var(--text3);font-size:11px">'+esc(bdSegOf(r.machineId))+'</span>':'')}</td>""")
rep("""    const machine = getMachine(payload.mid);
    if(!machine){
      results.unknownMachine.push""","""    const machine = bdAnyMachine(payload.mid);
    if(!machine){
      results.unknownMachine.push""")
rep("""  const existingSigs = new Set(state.breakdowns.concat(pendList().map(x=>x.rec)).map(breakdownSig));""","""  const existingSigs = new Set(bdAll().concat(pendList().map(x=>x.rec)).map(breakdownSig));""")

# ---------- machine pages: history for other sections, Excel download for every machine
rep("""        ${(!robot && bd.length) ? `<div style="margin-top:12px"><button class="btn btn-primary btn-sm" onclick="openMachineDetail('${esc(m.id)}','asset')">View all breakdowns &rarr;</button></div>` : ''}""",
"""        ${(!robot && bd.length) ? `<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" onclick="openMachineDetail('${esc(m.id)}','asset')">View all breakdowns &rarr;</button><button class="btn btn-secondary btn-sm" onclick="bdMachineXlsx('${esc(m.id)}')">Download history (Excel)</button></div>` : ''}""")
i=s.index("""    html += `<div class="note-box" style="font-size:12px;color:var(--text3);border-left:3px solid var(--amber);padding:6px 12px">Breakdown tracking covers CNC machines only""")
j=s.index("\n", i)
s = s[:i] + """    html += bdOtherBlock(m.id);""" + s[j:]
rep("""// ═══ ui_breakdowns.js ═══""","""// breakdown history on the page of a Conventional, Process, Utility or DG machine (kept out of the CNC analytics)
function bdOtherBlock(id){
  const L = otherBD().filter(b=>b.machineId===id).sort((a,b)=>(b.date||'').split('-').reverse().join('').localeCompare((a.date||'').split('-').reverse().join('')));
  const hrs = L.filter(b=>!isPM(b)).reduce((a,b)=>a+(Number(b.downHrs)||0),0), n = L.filter(b=>!isPM(b)).length;
  return `<div class="card" style="margin-top:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0">Breakdown history (${L.length})</h3>${L.length?`<button class="btn btn-secondary btn-sm" onclick="bdMachineXlsx('${esc(id)}')">Download history (Excel)</button>`:''}</div>
    <div class="desc">${L.length ? n+' breakdown'+(n===1?'':'s')+' · '+fmtNum(hrs,1)+' hrs machine downtime · average '+fmtNum(n?hrs/n:0,1)+' hrs. ' : ''}Breakdowns of this machine are kept in the Breakdown Log but not in the CNC analytics.</div>
    ${L.length ? `<div class="table-wrap short"><table><thead><tr><th>Date</th><th>Shift</th><th>Problem</th><th>Corrective action</th><th>Done by</th><th>Downtime (hrs)</th><th>Code</th><th></th></tr></thead><tbody>${L.map(b=>`<tr><td style="font-family:var(--mono);font-size:11px">${esc(b.date)}</td><td>${esc(b.shift)}</td><td>${esc(b.problem)}</td><td>${esc(b.correctiveAction||'—')}</td><td style="font-size:11px">${esc(b.doneBy||'—')}</td><td>${fmtNum(Number(b.downHrs)||0,2)}</td><td>${esc(b.maintCode||'')}</td><td><button class="btn btn-secondary btn-sm" onclick="openBreakdownForm('${b.id}')">Edit</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div style="color:var(--text3);font-size:12px;padding:6px 0">No breakdowns logged yet. Add one from the Breakdown Log, or it arrives from the phones once approved.</div>'}</div>`;
}
// one machine's full breakdown history as an Excel file: every entry, plus a summary and month-by-month totals
function bdMachineXlsx(id){
  if(typeof XLSX==='undefined'){ toast('The Excel library did not load. Check the internet and try again.', true); return; }
  const m = bdAnyMachine(id) || {id}, seg = bdSegOf(id) || 'CNC';
  const key = b=>(b.date||'').split('-').reverse().join('');
  const L = bdAll().filter(b=>b.machineId===id).sort((a,b)=>key(a).localeCompare(key(b)));
  if(!L.length){ toast('No breakdowns logged for '+id, true); return; }
  const dt = d=>{ const p = String(d||'').split('-'); return p.length===3 ? new Date(Date.UTC(+p[2], +p[1]-1, +p[0])) : d; };
  const H = ['#','Date','Shift','Problem','Observed by','Corrective action','Done by','Supported by','Machine downtime (min)','Machine downtime (hrs)','Response time (min)','Repair time (min)','Maint code','E/M','Spares used','Spare cost (Rs)'];
  const rows = L.map((b,i)=>[i+1, dt(b.date), b.shift||'', b.problem||'', b.observedBy||'', b.correctiveAction||'', b.doneBy||'', b.supportedBy||'', Number(b.downMin)||0, Number(b.downHrs)||0,
    b.respMin==null?'':b.respMin, (b.activeMin!=null?b.activeMin:b.repairMin)==null?'':(b.activeMin!=null?b.activeMin:b.repairMin), b.maintCode||'', b.electMech||'',
    [b.spare1,b.spare2,b.spare3].map(x=>String(x||'').trim()).filter(Boolean).join('; '), sumSpareCost(b)||0]);
  const n = rows.length, last = 4+n;
  const ws = XLSX.utils.aoa_to_sheet([[id+' breakdown history'], [[seg, m.category, [m.make,m.model].filter(Boolean).join(' '), m.cell?'Cell '+m.cell:'', m.location?'Location '+m.location:''].filter(Boolean).join(' · ')], [], H, ...rows], {cellDates:true});
  for(let r=5;r<=last;r++){ const c = ws['B'+r]; if(c && c.t==='d') c.z = 'dd-mmm-yyyy'; }
  XLSX.utils.sheet_add_aoa(ws, [['','','','Total','','','','',{f:'SUM(I5:I'+last+')'},{f:'SUM(J5:J'+last+')'}]], {origin:'A'+(last+1)});
  ws['!cols'] = [4,12,6,36,12,40,18,14,12,12,12,12,9,6,40,12].map(w=>({wch:w})); ws['!autofilter'] = {ref:'A4:P'+last};
  const real = L.filter(b=>!isPM(b)), hrs = real.reduce((a,b)=>a+(Number(b.downHrs)||0),0);
  const months = {}; L.forEach(b=>{ const p = String(b.date||'').split('-'); if(p.length!==3) return; const k = p[2]+'-'+p[1]; const o = months[k] = months[k]||{n:0,h:0}; if(!isPM(b)){ o.n++; o.h += Number(b.downHrs)||0; } });
  const S = [[id+' summary'], [], ['Section', seg], ['Category', m.category||''], ['Make / model', [m.make,m.model].filter(Boolean).join(' ')], [],
    ['Breakdowns (PM entries left out)', real.length], ['Machine downtime (hrs)', Math.round(hrs*100)/100], ['Average per breakdown (hrs)', real.length ? Math.round(hrs/real.length*100)/100 : 0],
    ['Longest single breakdown (hrs)', Math.max(0, ...real.map(b=>Number(b.downHrs)||0))], ['First entry', L[0].date], ['Last entry', L[L.length-1].date], ['PM entries', L.length-real.length], [],
    ['Month','Breakdowns','Downtime (hrs)'], ...Object.keys(months).sort().map(k=>{ const [y,mo] = k.split('-'); return [['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo-1]+' '+y, months[k].n, Math.round(months[k].h*100)/100]; }),
    [], ['Made by the maintenance platform on '+new Date().toLocaleString()+' from the Breakdown Log.']];
  const ws2 = XLSX.utils.aoa_to_sheet(S); ws2['!cols'] = [{wch:34},{wch:14},{wch:16}];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws2, 'Summary'); XLSX.utils.book_append_sheet(wb, ws, 'BD History');
  XLSX.writeFile(wb, id.replace(/[^A-Za-z0-9-]+/g,'_')+'_BD_History_'+pmISO(new Date())+'.xlsx');
  toast('Downloaded the breakdown history of '+id+' ('+L.length+' entries)');
}

// ═══ ui_breakdowns.js ═══""")
# download button on the CNC machine analysis page
rep("""      ${kpi('Top 50% of BD Hours', topN+' of '+list.length,""","""      ${kpi('Top 50% of BD Hours', topN+' of '+list.length,""")
rep("""    <div class="card">
      <h3>Breakdowns — Highest to Lowest Downtime</h3>""","""    <div style="margin:0 0 12px"><button class="btn btn-secondary btn-sm" onclick="bdMachineXlsx('${esc(m.id)}')">Download full breakdown history (Excel)</button></div>
    <div class="card">
      <h3>Breakdowns — Highest to Lowest Downtime</h3>""")

# ---------- Excel backup: no UTI column, response/repair/section kept; old backups with UTI still load
rep("""  const bdHeaders = ['Sr.','Machine ID','Date','Month','Shift','Problem Description','Observed By','Corrective Action',
                      'Done By','Supported By','Down(Min)','Down(Hrs)','Maint Code','E/M','PM(Hrs)','UTI(Hrs)',
                      'Spare 1','Cost 1','Spare 2','Cost 2','Spare 3','Cost 3','Total Spare Cost','Record ID'];
  const bdRows = [...docHeaderRows('', DOC_BREAKDOWN_HISTORY, 'BREAKDOWN HISTORY'), bdHeaders];
  state.breakdowns.forEach((b,i)=>{
    bdRows.push([i+1, b.machineId, b.date, monthAbbrevFromDDMMYYYY(b.date), b.shift, b.problem, b.observedBy, b.correctiveAction,
      b.doneBy, b.supportedBy, b.downMin, b.downHrs, b.maintCode, b.electMech, b.pmHrs, b.utiHrs,
      b.spare1, b.cost1, b.spare2, b.cost2, b.spare3, b.cost3, sumSpareCost(b), b.id]);
  });
  const wsBD = XLSX.utils.aoa_to_sheet(bdRows);
  wsBD['!cols'] = [5,12,12,7,6,35,10,38,16,16,10,10,9,6,7,7,18,9,18,9,18,9,13,18].map(w=>({wch:w}));""",
"""  const bdHeaders = ['Sr.','Machine ID','Date','Month','Shift','Problem Description','Observed By','Corrective Action',
                      'Done By','Supported By','Machine downtime (Min)','Machine downtime (Hrs)','Maint Code','E/M','PM(Hrs)',
                      'Spare 1','Cost 1','Spare 2','Cost 2','Spare 3','Cost 3','Total Spare Cost','Record ID','Response time (Min)','Repair time (Min)','Section','Ticket ID'];
  const bdRows = [...docHeaderRows('', DOC_BREAKDOWN_HISTORY, 'BREAKDOWN HISTORY'), bdHeaders];
  bdAll().forEach((b,i)=>{
    bdRows.push([i+1, b.machineId, b.date, monthAbbrevFromDDMMYYYY(b.date), b.shift, b.problem, b.observedBy, b.correctiveAction,
      b.doneBy, b.supportedBy, b.downMin, b.downHrs, b.maintCode, b.electMech, b.pmHrs,
      b.spare1, b.cost1, b.spare2, b.cost2, b.spare3, b.cost3, sumSpareCost(b), b.id,
      b.respMin==null?'':b.respMin, b.activeMin==null?'':b.activeMin, b.seg||'CNC', b.ticketId||'']);
  });
  const wsBD = XLSX.utils.aoa_to_sheet(bdRows);
  wsBD['!cols'] = [5,12,12,7,6,35,10,38,16,16,10,10,9,6,7,18,9,18,9,18,9,13,18,10,10,12,18].map(w=>({wch:w}));""")
rep("""      const newBreakdowns = [], usedIds = new Set();
      for(let i=1;i<bdRows.length;i++){
        const r = bdRows[i];
        if(!r || !r[1]) continue;
        newBreakdowns.push({
          id: (r[23] && !usedIds.has(String(r[23]))) ? String(r[23]) : genId('bd'), machineId:String(r[1]||'').trim(), date:normalizeDateCellDMY(r[2]), shift:String(r[4]||''),
          problem:r[5]||'', observedBy:r[6]||'', correctiveAction:r[7]||'', doneBy:r[8]||'', supportedBy:r[9]||'',
          downMin:Number(r[10])||0, downHrs:Number(r[11])||0, maintCode:r[12]||'', electMech:r[13]||'',
          pmHrs:Number(r[14])||0, utiHrs:Number(r[15])||0,
          spare1:r[16]||'', cost1:Number(r[17])||0, spare2:r[18]||'', cost2:Number(r[19])||0, spare3:r[20]||'', cost3:Number(r[21])||0
        });
        usedIds.add(newBreakdowns[newBreakdowns.length-1].id);
      }""","""      const newBreakdowns = [], newOther = [], usedIds = new Set();
      // columns are found by their heading, so older backups (with the UTI column) and newer ones both load
      const BH = (bdRows[0]||[]).map(x=>String(x==null?'':x).trim().toLowerCase());
      const col = (names, def) => { for(const n of names){ const k = BH.indexOf(n.toLowerCase()); if(k>=0) return k; } return def; };
      const C = {down:col(['Machine downtime (Min)','Down(Min)'],10), hrs:col(['Machine downtime (Hrs)','Down(Hrs)'],11), code:col(['Maint Code'],12), em:col(['E/M'],13), pm:col(['PM(Hrs)'],14),
        uti:col(['UTI(Hrs)'],-1), s1:col(['Spare 1'],16), c1:col(['Cost 1'],17), s2:col(['Spare 2'],18), c2:col(['Cost 2'],19), s3:col(['Spare 3'],20), c3:col(['Cost 3'],21), id:col(['Record ID'],23),
        resp:col(['Response time (Min)'],-1), rep:col(['Repair time (Min)'],-1), sec:col(['Section'],-1), tk:col(['Ticket ID'],-1)};
      for(let i=1;i<bdRows.length;i++){
        const r = bdRows[i];
        if(!r || !r[1]) continue;
        const uti = C.uti>=0 ? Number(r[C.uti])||0 : 0, dm = (Number(r[C.down])||0) + Math.round(uti*60);
        const rec = {
          id: (r[C.id] && !usedIds.has(String(r[C.id]))) ? String(r[C.id]) : genId('bd'), machineId:String(r[1]||'').trim(), date:normalizeDateCellDMY(r[2]), shift:String(r[4]||''),
          problem:r[5]||'', observedBy:r[6]||'', correctiveAction:r[7]||'', doneBy:r[8]||'', supportedBy:r[9]||'',
          downMin:dm, downHrs:uti ? Math.round(dm/60*100)/100 : (Number(r[C.hrs])||0), maintCode:r[C.code]||'', electMech:r[C.em]||'',
          pmHrs:Number(r[C.pm])||0,
          spare1:r[C.s1]||'', cost1:Number(r[C.c1])||0, spare2:r[C.s2]||'', cost2:Number(r[C.c2])||0, spare3:r[C.s3]||'', cost3:Number(r[C.c3])||0
        };
        if(C.resp>=0 && r[C.resp]!=='' && r[C.resp]!=null) rec.respMin = Number(r[C.resp])||0;
        if(C.rep>=0 && r[C.rep]!=='' && r[C.rep]!=null) rec.activeMin = Number(r[C.rep])||0;
        if(C.tk>=0 && r[C.tk]) rec.ticketId = String(r[C.tk]);
        const sec = C.sec>=0 ? String(r[C.sec]||'').trim() : '';
        if(sec && sec!=='CNC'){ rec.seg = sec; newOther.push(rec); } else newBreakdowns.push(rec);
        usedIds.add(rec.id);
      }""")
rep("""      state.breakdowns = newBreakdowns;""","""      state.breakdowns = newBreakdowns; state.otherBD = newOther;""")

# ---------- UTI removed: the four entries move into machine downtime (runs once per entry, every load is safe)
rep("""  if(applyDataCorrections(state.breakdowns) > 0) needsSave = true;""","""  if(applyDataCorrections(state.breakdowns) > 0) needsSave = true;
  bdAll().forEach(b=>{ if(b && b.utiHrs!==undefined){ const u = Number(b.utiHrs)||0; if(u > 0){ b.downMin = (Number(b.downMin)||0) + Math.round(u*60); b.downHrs = Math.round(b.downMin/60*100)/100; } delete b.utiHrs; needsSave = true; } });""")
open(p,'w',encoding='utf-8').write(s); print('ok')
