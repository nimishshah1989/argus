import re
p='/home/claude/live/parts2/ui.js'; s=open(p).read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:90],s.count(a)); s=s.replace(a,b)
new=open('/home/claude/s2/u4_ui_new.js').read()
# put the new code before the maintenance section
rep("""/* ---------- maintenance ---------- */""", new+"""
/* ---------- maintenance ---------- */""")
# every ticket opens the full details
rep("""function sheetTicket(t){
  const k = uiState(t);""","""function sheetTicket(t){ return sheetDetail(t.id, t); }
function sheetTicketOld(t){
  const k = uiState(t);""")
rep("""    if(b.dataset.a==='openticket'){ if(e.target.closest('button, a, select, input, textarea')) return; const t = LV.state.open.find(x=>x.id===b.dataset.v); if(t) sheetTicket(t); return; }""",
"""    if(b.dataset.a==='openticket'){ if(e.target.closest('button, a, select, input, textarea')) return; sheetDetail(b.dataset.v); return; }""")
# numbers on cards
rep("""<div class="lvtk" data-a="openticket" data-v="'+esc(t.id)+'"><div class="hd"><b>'+esc(place(t))+'</b><span class="lvwrap" style="gap:6px">""","""<div class="lvtk" data-a="openticket" data-v="'+esc(t.id)+'"><div class="hd"><b>'+esc(place(t))+' '+refTag(t)+'</b><span class="lvwrap" style="gap:6px">""")
rep("""   +l.map(t=>'<div class="lvtk"><div class="hd"><b>'+esc(place(t))+'</b>'+stChip('working')+'</div>'""","""   +l.map(t=>'<div class="lvtk" data-a="openticket" data-v="'+esc(t.id)+'"><div class="hd"><b>'+esc(place(t))+' '+refTag(t)+'</b>'+stChip('working')+'</div>'""")
rep("""  return '<div class="lvtk"><div class="hd"><b>'+esc(place(t))+'</b><span class="lvst s-'+(k==='handover'?'waiting':k==='general'?'stopped':k)+'">'+esc(chip)+'</span></div>'""",
"""  return '<div class="lvtk" data-a="openticket" data-v="'+esc(t.id)+'"><div class="hd"><b>'+esc(place(t))+' '+refTag(t)+'</b><span class="lvst s-'+(k==='handover'?'waiting':k==='general'?'stopped':k)+'">'+esc(chip)+'</span></div>'""")
rep("""  const job = (t, right, sub) => '<div class="lvtm" data-a="openticket" data-v="'+esc(t.id)+'"><div><b>'+esc(place(t))+'</b>""","""  const job = (t, right, sub) => '<div class="lvtm" data-a="openticket" data-v="'+esc(t.id)+'"><div><b>'+esc(place(t))+' '+refTag(t)+'</b>""")
rep("""       return '<div class="lvtm"><div><b>'+esc(place(t))+'</b><span>'+esc(t.problem)+'</span>'""","""       return '<div class="lvtm" data-a="openticket" data-v="'+esc(t.id)+'"><div><b>'+esc(place(t))+' '+refTag(t)+'</b><span>'+esc(t.problem)+'</span>'""")
rep("""+'<div class="lvcard"><div class="lvwrap" style="justify-content:space-between"><span class="big" style="'+(gen?'font-size:22px':'')+'">'+esc(place(l))+'</span>'+stChip(k)+'</div>'""",
"""+'<div class="lvcard"><div class="lvwrap" style="justify-content:space-between"><span class="big" style="'+(gen?'font-size:22px':'')+'">'+esc(place(l))+'</span>'+stChip(k)+'</div>'+(l.ref ? '<div style="font-size:15px;font-weight:800;color:#374151">Ticket number '+esc(l.ref)+'</div>' : '')""")
rep("""  return head+': '+where+'\\n'+t.problem""","""  return (t.ref ? t.ref+' · ' : '')+head+': '+where+'\\n'+t.problem""")
# Team tab: team day report and the team's closed work
rep("""   html:'<div class="lvcol">'
   +'<div class="lvsect">Working now ('+people.length""","""   html:'<div class="lvcol"><button class="lvsec" data-a="dayask" data-v="team" style="min-height:50px;font-weight:800">Team day report (PDF)</button>'
   +'<div class="lvsect">Working now ('+people.length""")
rep("""   +'<span class="lvhint" style="text-align:center">Tap a job to see it and act on it.</span></div>'};""","""   +'<span class="lvhint" style="text-align:center">Tap a job to see it and act on it.</span>'+teamClosedHtml()+'</div>',
   after:()=>{ lvTeamWork(false); }};""")
# Mine: my day report
rep("""   html:'<div class="lvcol"><p class="lvp" style="margin:0">'+(l.length ? l.length+' in progress'""","""   html:'<div class="lvcol"><button class="lvsec" data-a="dayask" data-v="me" style="min-height:50px;font-weight:800">'+(personal() ? 'My day report (PDF)' : 'Day report (PDF)')+'</button><p class="lvp" style="margin:0">'+(l.length ? l.length+' in progress'""")
# actions
rep("""    case 'wkmore': S.wkMore = !S.wkMore; render(); break;""","""    case 'wkmore': S.wkMore = !S.wkMore; render(); break;
    case 'twkmore': S.twkMore = !S.twkMore; render(); break;
    case 'tf': S.tf = v==='*' ? '' : v; S.twkMore = false; render(); break;
    case 'dayask': S.dr = {kind:v, days:0, shift:String((CLIENT.teamShifts||{})[lvMe()]||''), who:personal() ? '' : lvMe()}; closeSheet(); sheetDay(); break;
    case 'daygo': doDay(); break;
    case 'dayshare': dayShare(); break;
    case 'daysave': daySave(); break;""")
rep("""    case 'tab': if(v==='cat'){ S.machine = ''; S.sq = ''; } if(v==='mine') lvMyWork(false); go(v, true); break;""","""    case 'tab': if(v==='cat'){ S.machine = ''; S.sq = ''; } if(v==='mine') lvMyWork(false); if(v==='team') lvTeamWork(false); go(v, true); break;""")
# the day sheet updates its "covers" line when the date, shift or person changes
rep("""    else if(i==='sq'){""","""    else if(i==='dr'){ const D = A.st.dr; if(e.target.id==='lvds') D.shiftTouched = true; dayRead(); const w = dayWindow(D.days||0, D.shift), el = $('lvdwin'); if(el) el.textContent = 'Covers '+dShort(w.from)+' to '+dShort(w.to)+'.'; }
    else if(i==='sq'){""")
# a newly closed ticket refreshes the team list too
rep("""const top = ((s.closed||[])[0]||{}).id; if(LV.wkSeen && top !== LV.wkSeen) LV.wkAt = 0; LV.wkSeen = top;""","""const top = ((s.closed||[])[0]||{}).id; if(LV.wkSeen && top !== LV.wkSeen){ LV.wkAt = 0; LV.twkAt = 0; } LV.wkSeen = top;""")
open(p,'w').write(s); print('ok')
