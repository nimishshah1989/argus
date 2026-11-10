
/* Gujarati dictation for Problem Description and Corrective Action.
   Speech to text: Chrome's built-in recogniser (needs internet and a secure https page).
   Translation: (1) your own relay if its address is set, (2) Chrome's on-device translator if present,
   (3) a basic public translation as a last resort. The person always checks the English before it is used. */
function LN(){ return (CLIENT.language&&CLIENT.language.name)||'your language'; }
const GU = {target:null, rec:null, want:false, finalTxt:'', kind:'problem', relay:''};
(function(){
  try{ const q = new URLSearchParams(location.search).get('relay'); if(q){ localStorage.setItem('bd_relay', q); } GU.relay = (localStorage.getItem('bd_relay')||localStorage.getItem('cosmos_relay')||'').trim(); }catch(e){}
  const SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>';
  [['f_problem','Problem Description','problem'],['f_correctiveAction','Corrective Action','action']].forEach(([id,name,kind])=>{
    const ta = document.getElementById(id); if(!ta) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mic-btn'; b.innerHTML = SVG+'Speak in '+LN();
    b.onclick = ()=>guOpen(id, name, kind); ta.insertAdjacentElement('afterend', b);
  });
})();
function guEl(i){ return document.getElementById(i); }
function guSetStatus(t, live){ const s = guEl('guStatus'); s.textContent = t||''; s.classList.toggle('live', !!live); }
function guOpen(id, name, kind){
  GU.target = id; GU.kind = kind; GU.finalTxt = ''; guEl('guSrc').value = ''; guEl('guEn').value = ''; guEl('guNote').textContent = ''; guEl('guNote').className = 'gu-note';
  guEl('guTitle').textContent = 'Speak in '+LN()+': '+name; guSetStatus(''); guEl('guMic').textContent = 'Start speaking'; guEl('guBack').classList.add('show');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ guSetStatus('Voice is not available in this browser. Open this page in Chrome, or use the keyboard microphone and choose '+LN()+', then tap Translate.'); }
  else if(location.protocol === 'file:' || window.top !== window.self){ guSetStatus(guWhy()); }
}
function guClose(){ guStop(); guEl('guBack').classList.remove('show'); }
function guStop(){ GU.want = false; if(GU.rec){ try{ GU.rec.stop(); }catch(e){} } guEl('guMic').textContent = 'Start speaking'; guEl('guMic').classList.add('rec'); }
function guToggle(){ if(GU.want){ guStop(); guSetStatus('Stopped. Translating…'); setTimeout(guTranslate, 800); } else guStart(); }
function guWhy(){
  const p = location.protocol;
  if(p === 'file:') return 'This page is opened from a file on the phone or computer. Chrome blocks the microphone for pages opened this way. Open the tool from its https web link instead.';
  if(window.top !== window.self) return 'This page is open inside another page or app. Chrome blocks the microphone there. Open the tool directly in Chrome from its https link.';
  if(p !== 'https:' && location.hostname !== 'localhost') return 'Chrome only allows the microphone on https pages. Open the tool from its https link.';
  return 'The microphone did not start. Tap the lock icon next to the address, set Microphone to Allow, reload, and try again. If it still fails, use the keyboard microphone and choose '+LN()+'.';
}
async function guStart(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if(!SR){ guSetStatus('Voice is not available in this browser. Open the tool in Chrome, or use the keyboard microphone and choose '+LN()+', then tap Translate.'); return; }
  guSetStatus('Starting the microphone… tap Allow if Chrome asks'); guEl('guMic').disabled = true;
  try{
    if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){ const st = await guTimeout(navigator.mediaDevices.getUserMedia({audio:true}), 12000); st.getTracks().forEach(t=>t.stop()); }
  }catch(e){
    guEl('guMic').disabled = false; const n = (e && e.name) || '';
    guSetStatus(n === 'NotAllowedError' || n === 'SecurityError' ? 'Microphone is blocked. '+guWhy() : n === 'NotFoundError' ? 'No microphone found on this device.' : n === 'Error' && e.message === 'timeout' ? 'Chrome is waiting for you to allow the microphone. Tap Allow, then tap Start speaking again.' : 'Could not use the microphone ('+(n||'error')+'). '+guWhy());
    return;
  }
  guEl('guMic').disabled = false;
  GU.finalTxt = guEl('guSrc').value ? guEl('guSrc').value.trim()+' ' : '';
  const r = new SR(); GU.rec = r; r.lang = (CLIENT.language&&CLIENT.language.code)||'gu-IN'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1; GU.want = true; let started = false;
  r.onstart = ()=>{ started = true; guSetStatus('Listening… speak now', true); guEl('guMic').textContent = 'Stop'; };
  r.onresult = e=>{
    // Rebuild the whole sentence from every result each time (Android Chrome repeats earlier words in later results).
    const parts = []; let interim = '';
    for(let i=0;i<e.results.length;i++){ const t = (e.results[i][0].transcript||'').trim(); if(!t) continue; if(e.results[i].isFinal){ parts.push(t); } else interim = t; }
    // a later result that already contains an earlier one replaces it (growing sentence)
    const out = []; parts.concat(interim ? [interim] : []).forEach(t=>{ while(out.length && t.indexOf(out[out.length-1]) === 0) out.pop(); out.push(t); });
    guEl('guSrc').value = (GU.finalTxt + out.join(' ')).trim();
  };
  r.onerror = e=>{ const m = {'not-allowed':'Microphone is blocked. '+guWhy(),'service-not-allowed':'Voice typing is blocked on this page. '+guWhy(),'no-speech':'Did not hear anything. Tap Start speaking and try again.','network':'No internet, or Google voice service could not be reached. You can type the Gujarati instead.','language-not-supported':'Gujarati voice is not available here. Use the keyboard microphone and choose '+LN()+'.','audio-capture':'No microphone found.'}[e.error]; if(e.error !== 'aborted'){ guSetStatus(m || 'Voice stopped ('+e.error+').'); if(e.error !== 'no-speech'){ GU.want = false; guEl('guMic').textContent = 'Start speaking'; } } };
  r.onend = ()=>{ if(GU.want){ GU.finalTxt = guEl('guSrc').value ? guEl('guSrc').value.trim()+' ' : ''; try{ r.start(); }catch(e){ GU.want = false; guEl('guMic').textContent = 'Start speaking'; } } else { guEl('guMic').textContent = 'Start speaking'; guEl('guSrc').value = guEl('guSrc').value.trim(); } };
  try{ r.start(); }catch(e){ guSetStatus('Could not start voice typing. '+guWhy()); GU.want = false; return; }
  setTimeout(()=>{ if(GU.want && !started){ GU.want = false; try{ r.abort(); }catch(e){} guEl('guMic').textContent = 'Start speaking'; guSetStatus('Voice typing did not start. '+guWhy()); } }, 6000);
}
function guFresh(){ guStop(); GU.finalTxt = ''; guEl('guSrc').value = ''; guEl('guEn').value = ''; guEl('guNote').textContent = ''; guSetStatus('Cleared. Tap Start speaking.'); setTimeout(guStart, 250); }
async function guTranslate(){
  const txt = guEl('guSrc').value.trim(); if(!txt){ guSetStatus('Nothing to translate yet.'); return; }
  const btn = guEl('guTr'); btn.disabled = true; guSetStatus('Translating…'); guEl('guNote').textContent = ''; guEl('guNote').className = 'gu-note';
  try{
    const r = await guTranslateText(txt, GU.kind); guEl('guEn').value = r.text;
    guEl('guNote').textContent = r.via === 'ai' ? 'Translated for maintenance reports. Please check it.' : r.via === 'device' ? 'Translated on this phone. Please check it carefully.' : 'Basic translation. Technical words may be wrong, please check and correct it carefully.';
    guEl('guNote').className = 'gu-note'+(r.via === 'ai' ? '' : ' warn'); guSetStatus('Check the English below.');
  }catch(e){ guSetStatus('Could not translate. Check the internet and tap Translate again, or type the English yourself.'); }
  btn.disabled = false;
}
function guTimeout(p, ms){ return Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), ms))]); }
function guGloss(t){
  const g = CLIENT.glossary || {}; Object.keys(g).sort((a,b)=>b.length-a.length).forEach(k=>{ if(k && /[^\x00-\x7F]/.test(k)) t = t.split(k).join(' '+g[k]+' '); });
  return t.replace(/\s+/g,' ').trim();
}
function guGlossEn(t){
  const g = CLIENT.glossary || {}; Object.keys(g).sort((a,b)=>b.length-a.length).forEach(k=>{ if(!k || /[^\x00-\x7F]/.test(k)) return;
    t = t.replace(new RegExp('(^|[^A-Za-z0-9])('+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?![A-Za-z0-9])','gi'), (all,pre,found,off)=>{ const r = g[k]; const start = (off+pre.length===0) || /[.!?]\s*$/.test(t.slice(0,off+pre.length)); return pre+((start && /^[A-Z]/.test(found) && /^[a-z]/.test(r)) ? r.charAt(0).toUpperCase()+r.slice(1) : r); }); });
  return t;
}
async function guTranslateText(text, kind){ const r = await guTranslateRaw(text, kind); if(r && r.text) r.text = guGlossEn(r.text); return r; }
async function guTranslateRaw(text, kind){
  text = guGloss(text);
  if(GU.relay){ try{ const res = await guTimeout(fetch(GU.relay, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text, kind, lang:LN()})}), 9000); if(res.ok){ const j = await res.json(); if(j && j.english) return {text:j.english, via:'ai'}; } }catch(e){} }
  try{ if(window.Translator){ const o = {sourceLanguage:((CLIENT.language&&CLIENT.language.code)||'gu').split('-')[0], targetLanguage:'en'}; if((await guTimeout(Translator.availability(o), 3000)) === 'available'){ const t = await guTimeout(Translator.create(o), 5000); return {text:await guTimeout(t.translate(text), 5000), via:'device'}; } } }catch(e){}
  const res = await guTimeout(fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl='+(((CLIENT.language&&CLIENT.language.code)||'gu').split('-')[0])+'&tl=en&dt=t&q='+encodeURIComponent(text)), 9000); if(!res.ok) throw new Error('translate');
  const d = await res.json(); const out = (d[0]||[]).map(x=>x[0]).join(''); if(!out) throw new Error('empty'); return {text:out, via:'basic'};
}
function guUse(){
  const en = guEl('guEn').value.trim(); if(!en){ guSetStatus('There is no English yet. Tap Translate first.'); return; }
  const ta = guEl(GU.target); const cur = ta.value.trim(); ta.value = cur ? cur+' '+en : en; ta.dispatchEvent(new Event('input',{bubbles:true}));
  const w = ta.closest('.field'); if(w) w.classList.remove('invalid'); guClose();
}
