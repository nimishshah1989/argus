
let REF = {machines:[],shifts:[],observedBy:[],team:[],codes:[],breakdownCategories:[]};
let CLIENT = {id:'', company:'', reportTitle:'BREAKDOWN REPORT', product:'the platform', language:{code:'gu-IN',name:'Gujarati'}, relay:''};


function populateSelect(id, options, valueKey, labelKey){
  const el = document.getElementById(id);
  options.forEach(opt=>{
    const o = document.createElement('option');
    if(typeof opt === 'string'){ o.value = opt; o.textContent = opt; }
    else { o.value = opt[valueKey]; o.textContent = opt[labelKey] || opt[valueKey]; }
    el.appendChild(o);
  });
}

function applyClient(cfg){
  CLIENT = Object.assign(CLIENT, cfg); REF = cfg.ref;
  if(!GU.relay && CLIENT.relay) GU.relay = CLIENT.relay;
  document.querySelectorAll('.guLn').forEach(e=>e.textContent = LN());
  document.querySelectorAll('.mic-btn').forEach(b=>{ b.lastChild.textContent = 'Speak in '+LN(); });
  document.title = 'Breakdown Entry — ' + CLIENT.company;
  document.getElementById('clientName').textContent = CLIENT.company;
  populateSelect('f_machineId', REF.machines, 'id', 'id');
  populateSelect('f_shift', REF.shifts);
  populateSelect('f_observedBy', REF.observedBy);
  if(window.lvChipsInit) lvChipsInit();
  populateSelect('f_breakdownCategory', REF.breakdownCategories);
  populateSelect('f_maintCode', REF.codes);
  const m = new URLSearchParams(location.search).get('m');
  if(m && REF.machines.some(x=>x.id===m)){ const el = document.getElementById('f_machineId'); el.value = m; el.dispatchEvent(new Event('change')); }
}
async function loadClient(){
  const q = new URLSearchParams(location.search).get('c');
  try{
    let id = q; if(!id){ const ix = await (await fetch('clients/index.json')).json(); id = ix.default; }
    if(!/^[a-z0-9_-]+$/i.test(id)) throw new Error('bad client');
    const cfg = await (await fetch('clients/'+id+'.json')).json();
    applyClient(cfg);
  }catch(e){
    try{ const q2 = new URLSearchParams(location.search).get('c'); const x = q2 && JSON.parse(localStorage.getItem('bd_cfg_'+q2)||'null'); if(x && x.cfg){ applyClient(x.cfg); return; } }catch(_e){}
    document.getElementById('clientName').textContent = '';
    const h = document.querySelector('#formScreen .header p'); if(h) h.textContent = 'Could not load this company\'s data. Check the link, or connect to the internet once and try again.';
  }
}

function bdQR(holder, data){
  const asc = o => JSON.stringify(o).replace(/[\u007f-\uffff]/g, c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  const cut = (o, n) => Object.assign({}, o, {pr:String(o.pr||'').slice(0,n), ca:String(o.ca||'').slice(0,n), sp:String(o.sp||'').slice(0,Math.min(n,120))});
  // keep the code small enough to scan from a printed page: long problem / action text is shortened in the QR only
  let d = data; for(const n of [400, 300, 220, 160, 120, 80]){ if(asc(d).length <= 650) break; d = cut(data, n); }
  for(const lv of ['M','L']){ try{ holder.innerHTML = ''; new QRCode(holder, { text: asc(d), width: 600, height: 600, correctLevel: QRCode.CorrectLevel[lv] }); return true; }catch(e){} }
  holder.innerHTML = ''; return false;
}
// Signature pad — for the PDF record only, never part of the QR payload
let signaturePad = null;
function initSignaturePad(){
  const canvas = document.getElementById('sigCanvas');
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  canvas.getContext('2d').scale(ratio, ratio);
  signaturePad = new SignaturePad(canvas, { backgroundColor:'rgba(255,255,255,0)', penColor:'#16181d' });
  signaturePad.addEventListener('beginStroke', ()=>{ document.getElementById('sigPlaceholder').style.display='none'; });
}
window.addEventListener('load', initSignaturePad);
function clearSignature(){
  if(signaturePad) signaturePad.clear();
  document.getElementById('sigPlaceholder').style.display='block';
}

// Default date to today
document.getElementById('f_date').value = new Date().toISOString().slice(0,10);

// Show machine's category/cell as a hint once selected
document.getElementById('f_machineId').addEventListener('change', function(){
  const m = REF.machines.find(x=>x.id===this.value);
  document.getElementById('machineMeta').textContent = m ? `${m.category} — Cell ${m.cell}` : '';
});

function fromISODate(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function validate(){
  const required = [
    ['f_machineId','f_machineId_wrap'],
    ['f_date','f_date_wrap'],
    ['f_shift','f_shift_wrap'],
    ['f_problem','f_problem_wrap'],
    ['f_downMin','f_downMin_wrap']
  ];
  let firstInvalid = null;
  required.forEach(([fieldId, wrapId])=>{
    const el = document.getElementById(fieldId);
    const wrap = document.getElementById(wrapId);
    const valid = el.value && el.value.toString().trim() !== '';
    wrap.classList.toggle('invalid', !valid);
    if(!valid && !firstInvalid) firstInvalid = wrap;
  });
  if(firstInvalid){ firstInvalid.scrollIntoView({behavior:'smooth', block:'center'}); return false; }
  return true;
}

function generateReport(){
  if(!validate()) return;
  const btn = document.getElementById('submitBtn');
  btn.disabled = true; btn.textContent = 'Generating...';

  const data = {
    v: 1,
    mid: document.getElementById('f_machineId').value,
    d: document.getElementById('f_date').value,
    sh: document.getElementById('f_shift').value,
    pr: document.getElementById('f_problem').value.trim(),
    ob: document.getElementById('f_observedBy').value,
    ca: document.getElementById('f_correctiveAction').value.trim(),
    db: window.lvChipVal ? lvChipVal('done') : '',
    sb: window.lvChipVal ? lvChipVal('supp') : '',
    dm: Number(document.getElementById('f_downMin').value) || 0,
    mc: document.getElementById('f_maintCode').value,
    bc: document.getElementById('f_breakdownCategory').value,
    sp: document.getElementById('f_spare').value.trim(),
    ty: document.getElementById('f_kind').value,
    tk: (window.LV && LV.ticket && LV.ticket.ref) || '',
    rs: document.getElementById('f_respMin').value === '' ? null : Number(document.getElementById('f_respMin').value),
    rp: document.getElementById('f_repairMin').value === '' ? null : Number(document.getElementById('f_repairMin').value)
  };

  window.LV_LAST = data;
  // Render QR code offscreen, then extract as an image for the PDF
  const qrHolder = document.createElement('div');
  qrHolder.style.position='fixed'; qrHolder.style.left='-9999px';
  document.body.appendChild(qrHolder);
  bdQR(qrHolder, data);

  setTimeout(()=>{
    const canvas = qrHolder.querySelector('canvas');
    const qrDataUrl = canvas ? canvas.toDataURL('image/png') : null;
    document.body.removeChild(qrHolder);
    buildPdf(data, qrDataUrl);
  }, 250);
}

function buildPdf(data, qrDataUrl){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:'mm', format:'a4'});
  const pageW = 210;
  const qrSize = 26;
  const qrX = pageW - 15 - qrSize;
  const qrY = 14;

  // QR is placed FIRST, at a fixed position that never changes — completely independent of how
  // long the title, problem description, or any other field's text turns out to be. Nothing else
  // on the page is ever allowed to encroach on this reserved corner.
  if(qrDataUrl){
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    doc.setFontSize(6.5); doc.setFont(undefined,'normal'); doc.setTextColor(140);
    doc.text(['Scan to import','into '+CLIENT.product], qrX, qrY + qrSize + 4);
  }

  // Title sits in the left column only, narrowed so it can never reach into the QR's corner
  let y = 18;
  doc.setFontSize(16); doc.setFont(undefined,'bold'); doc.setTextColor(0);
  const titleLines = doc.splitTextToSize((CLIENT.company+' — '+CLIENT.reportTitle).toUpperCase(), pageW - 30 - qrSize - 8);
  doc.text(titleLines, 15, y);
  y += (titleLines.length-1)*6.5 + 6;
  doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(120);
  doc.text('Generated from mobile entry tool — one report per breakdown', 15, y);
  doc.setTextColor(0);

  // Fixed header boundary — every report's body starts at this same constant y, whichever of the
  // title or the QR block happens to be taller, so the two can never collide either.
  y = Math.max(y + 10, qrY + qrSize + 16);
  doc.setDrawColor(220); doc.line(15, y, pageW-15, y);
  y += 8;

  function field(label, value, opts){
    opts = opts || {};
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(90);
    doc.text(label.toUpperCase(), 15, y);
    doc.setFontSize(11.5); doc.setFont(undefined,'normal'); doc.setTextColor(0);
    const lines = doc.splitTextToSize(value && value.length ? value : '—', pageW-30);
    doc.text(lines, 15, y+5);
    y += 5 + (lines.length*5.2) + (opts.gap || 5);
  }

  const machine = REF.machines.find(m=>m.id===data.mid);

  field('Machine ID', data.mid + (machine ? `  (${machine.category}, Cell ${machine.cell})` : ''));
  const row = y;
  doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(90);
  doc.text('DATE', 15, row); doc.text('SHIFT', 75, row); doc.text('DOWN TIME', 130, row);
  doc.setFontSize(11.5); doc.setFont(undefined,'normal'); doc.setTextColor(0);
  doc.text(fromISODate(data.d), 15, row+5);
  doc.text(data.sh || '—', 75, row+5);
  doc.text((data.dm||0) + ' min', 130, row+5);
  y = row + 14;
  if(data.ty || data.tk || data.rs != null || data.rp != null){
    const r2 = y;
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(90);
    doc.text('TYPE', 15, r2); doc.text('RESPONSE', 75, r2); doc.text('REPAIR', 130, r2);
    doc.setFontSize(11.5); doc.setFont(undefined,'normal'); doc.setTextColor(0);
    if(data.tk){ doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(90); doc.text('TICKET', 165, r2); doc.setFontSize(11.5); doc.setFont(undefined,'normal'); doc.setTextColor(0); doc.text(String(data.tk), 165, r2+5); }
    doc.text(data.ty==='support' ? 'Running, needs support' : (data.ty ? 'Machine stopped' : '—'), 15, r2+5);
    doc.text(data.rs != null ? data.rs + ' min' : '—', 75, r2+5);
    doc.text(data.rp != null ? data.rp + ' min' : '—', 130, r2+5);
    y = r2 + 14;
  }

  field('Problem Description', data.pr);
  field('Observed By', data.ob);
  field('Corrective Action', data.ca);
  field('Done By', data.db);
  field('Supported By', data.sb);
  const row2 = y;
  doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(90);
  doc.text('MAINT CODE', 15, row2); doc.text('BREAKDOWN CATEGORY', 75, row2); doc.text('SPARE USED', 145, row2);
  doc.setFontSize(11.5); doc.setFont(undefined,'normal'); doc.setTextColor(0);
  doc.text(data.mc || '—', 15, row2+5);
  doc.text(data.bc || '—', 75, row2+5);
  doc.text(data.sp || '—', 145, row2+5);
  y = row2 + 16;

  if(window.pdfExtra && window.LVX && window.LVX.id===(LV&&LV.ticket&&LV.ticket.id)) y = window.pdfExtra(doc, y, pageW);
  // Handover signature/name — record-keeping only, read directly from the DOM so it never
  // passes through the QR-encoded `data` object and can never reach the platform import.
  const handoverName = document.getElementById('f_handoverName').value.trim();
  const sigDataUrl = (signaturePad && !signaturePad.isEmpty()) ? signaturePad.toDataURL('image/png') : null;
  if(handoverName || sigDataUrl){
    doc.setDrawColor(220); doc.line(15, y, pageW-15, y);
    y += 8;
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(90);
    doc.text('HANDOVER', 15, y);
    y += 6;
    if(sigDataUrl){
      doc.addImage(sigDataUrl, 'PNG', 15, y, 60, 22);
      y += 25;
    }
    doc.setDrawColor(200); doc.line(15, y, 75, y);
    y += 4;
    doc.setFontSize(9.5); doc.setFont(undefined,'normal'); doc.setTextColor(0);
    doc.text(handoverName || '—', 15, y);
    doc.setFontSize(8); doc.setTextColor(140);
    doc.text('Name of person taking handover', 15, y+4);
  }

  // Timestamp of report generation — sits below all body content, but never lower on the page
  // than necessary, and never allowed to collide with a long report the way the QR code once did.
  const footerY = Math.max(285, y + 10);
  const now = new Date();
  const dd = String(now.getDate()).padStart(2,'0');
  const mm = String(now.getMonth()+1).padStart(2,'0');
  const yyyy = now.getFullYear();
  let hh = now.getHours(); const ampm = hh>=12 ? 'PM':'AM'; hh = hh%12 || 12;
  const min = String(now.getMinutes()).padStart(2,'0');
  doc.setDrawColor(230); doc.line(15, footerY-5, pageW-15, footerY-5);
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(150);
  doc.text(`Report generated: ${dd}-${mm}-${yyyy} at ${hh}:${min} ${ampm}`, 15, footerY);

  if(window.pdfTimeline && window.LVX && window.LVX.id===(LV&&LV.ticket&&LV.ticket.id)) window.pdfTimeline(doc);
  const filenameSafe = (data.mid||'machine').replace(/[^a-zA-Z0-9-]/g,'');
  doc.save(`Breakdown_${filenameSafe}_${data.d}.pdf`);

  document.getElementById('submitBtn').disabled = false;
  document.getElementById('submitBtn').textContent = 'Generate PDF Report';
  document.getElementById('formScreen').style.display = 'none';
  document.getElementById('footerBar').style.display = 'none';
  document.getElementById('successScreen').style.display = 'block';
  if(typeof lvReportSaved==='function') lvReportSaved();
}

function resetForm(){
  document.getElementById('f_machineId').value = '';
  document.getElementById('machineMeta').textContent = '';
  document.getElementById('f_date').value = new Date().toISOString().slice(0,10);
  document.getElementById('f_shift').value = '';
  document.getElementById('f_problem').value = '';
  document.getElementById('f_observedBy').value = '';
  document.getElementById('f_correctiveAction').value = '';
  if(window.lvChipSet){ lvChipSet('done', []); lvChipSet('supp', []); }
  document.getElementById('f_downMin').value = '';
  document.getElementById('f_respMin').value = ''; document.getElementById('f_repairMin').value = ''; document.getElementById('f_kind').value = '';
  document.getElementById('f_maintCode').value = '';
  document.getElementById('f_breakdownCategory').value = '';
  document.getElementById('f_spare').value = '';
  document.getElementById('f_handoverName').value = '';
  clearSignature();
  document.querySelectorAll('.field.invalid').forEach(el=>el.classList.remove('invalid'));
  document.getElementById('formScreen').style.display = 'block';
  document.getElementById('footerBar').style.display = 'block';
  document.getElementById('successScreen').style.display = 'none';
  window.scrollTo(0,0);
}
