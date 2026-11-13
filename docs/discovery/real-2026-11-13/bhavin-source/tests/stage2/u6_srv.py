p='/home/claude/live/api/worker.js'; s=open(p).read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:80],s.count(a)); s=s.replace(a,b)
rep("""  ref: `ALTER TABLE tickets ADD COLUMN ref TEXT`};""","""  ref: `ALTER TABLE tickets ADD COLUMN ref TEXT`,
  // version 7: when an admin last corrected the ticket
  edited_at: `ALTER TABLE tickets ADD COLUMN edited_at TEXT`};""")
rep("""const V = 6;""","""const V = 7;""")
rep("""urgent:!!r.urgent, raisedUser:r.raised_user||'', ref:r.ref||''});""","""urgent:!!r.urgent, raisedUser:r.raised_user||'', ref:r.ref||'', editedAt:r.edited_at||null});""")
rep("""    if(url.pathname === '/api/events' && req.method === 'GET'){""","""    // an admin corrects an honest mistake: times, work / waiting minutes, problem text, names. Open tickets, or closed in the last 7 days.
    // Response, repair and downtime are worked out again; the change and its reason go into the ticket's history.
    if(url.pathname === '/api/edit' && req.method === 'POST'){
      if(!who.key && who.role !== 'admin') return deny();
      const t = await get(body.id); if(!t) return notFound();
      const active = isActive(t);
      if(t.status === 'cancelled') return json({error:'A cancelled ticket cannot be edited'}, 400, h);
      if(!active && Date.parse(t.closed_at||0) < now - 7*86400000) return json({error:'Only tickets closed in the last 7 days can be edited'}, 400, h);
      const reason = clean(body.reason, 300); if(!reason) return json({error:'Write the reason for the change'}, 400, h);
      const tm = (v, cur) => { if(v === undefined || v === null || v === '') return cur; const x = Date.parse(v); return isNaN(x) ? 'bad' : new Date(x).toISOString(); };
      const down = tm(body.downAt, t.down_at), start = tm(body.startedAt, t.started_at), close = active ? null : tm(body.closedAt, t.closed_at);
      if([down, start, close].includes('bad')) return json({error:'One of the times is not valid'}, 400, h);
      if(Date.parse(down) > now + 60000 || (start && Date.parse(start) > now + 60000) || (close && Date.parse(close) > now + 60000)) return json({error:'A time cannot be in the future'}, 400, h);
      if(start && Date.parse(start) < Date.parse(down)) return json({error:'Work cannot start before the complaint was reported'}, 400, h);
      if(close && Date.parse(close) < Date.parse(start || down)) return json({error:'The closing time cannot be before the work started'}, 400, h);
      const num = (v, cur) => v === undefined || v === null || v === '' ? cur : Math.max(0, Math.min(100000, Math.round(Number(v)||0)));
      const act = num(body.activeMin, t.active_min||0), wait = num(body.waitMin, t.wait_min||0);
      const problem = body.problem === undefined ? t.problem : clean(body.problem, 500); if(!problem) return json({error:'The problem cannot be empty'}, 400, h);
      const sBy = body.startedBy === undefined ? t.started_by : clean(body.startedBy, 60), cBy = active || body.closedBy === undefined ? t.closed_by : clean(body.closedBy, 60);
      const response = t.self_started || !start ? null : mins(down, start), repair = start && close ? mins(start, close) : t.repair_min;
      const downtime = close ? (t.kind === 'stopped' ? mins(down, close) : act) : null;
      // what changed, in words, for the history
      const hm = iso => iso ? new Date(iso).toISOString().slice(5,16).replace('T',' ') : '-', ch = [];
      if(down !== t.down_at) ch.push('reported '+hm(t.down_at)+' > '+hm(down));
      if(start !== t.started_at) ch.push('started '+hm(t.started_at)+' > '+hm(start));
      if(close && close !== t.closed_at) ch.push('closed '+hm(t.closed_at)+' > '+hm(close));
      if(act !== (t.active_min||0)) ch.push('work '+(t.active_min||0)+' > '+act+' min');
      if(wait !== (t.wait_min||0)) ch.push('waiting '+(t.wait_min||0)+' > '+wait+' min');
      if(problem !== t.problem) ch.push('problem text');
      if(sBy !== t.started_by) ch.push('started by '+(t.started_by||'-')+' > '+(sBy||'-'));
      if(cBy !== t.closed_by) ch.push('closed by '+(t.closed_by||'-')+' > '+(cBy||'-'));
      if(!ch.length) return json({error:'Nothing was changed'}, 400, h);
      await db.prepare(`UPDATE tickets SET down_at=?, started_at=?, closed_at=?, problem=?, started_by=?, closed_by=?, active_min=?, wait_min=?, response_min=?, repair_min=?, downtime_min=COALESCE(?, downtime_min), edited_at=? WHERE id=?`)
        .bind(down, start, close, problem, sBy, cBy, act, wait, response, repair, downtime, nowIso, t.id).run();
      // keep each person's work minutes adding up to the corrected work time
      const dAct = act - (t.active_min||0);
      if(dAct) await ev(t.id, 'segment', cBy || sBy || '', 'correction', '', '', dAct);
      await ev(t.id, 'edit', who.key ? 'Platform' : who.name, reason, '', ch.join('; '));
      return json({ok:true, ticket:row(await get(t.id)), changed:ch}, 200, h);
    }
    // tickets corrected since a time (the platform asks every 12 hours, last 7 days only)
    if(url.pathname === '/api/edits' && req.method === 'GET'){
      if(!who.key && who.role !== 'admin') return deny();
      const since = Date.parse(url.searchParams.get('since')||''), from = new Date(Math.max(isNaN(since) ? 0 : since, now - 7*86400000)).toISOString();
      const r = await db.prepare(`SELECT * FROM tickets WHERE client=? AND edited_at>=? ORDER BY edited_at LIMIT 300`).bind(client, from).all();
      const ids = r.results.map(x=>x.id), segs = {};
      if(ids.length) (await byIds(db, `SELECT ticket, by, SUM(mins) AS m FROM events WHERE client=? AND type='segment' AND ticket IN `, [client], ids, ` GROUP BY ticket, by`)).forEach(e=>{ (segs[e.ticket] = segs[e.ticket]||[]).push({by:e.by||'', mins:e.m||0}); });
      return json({now:nowIso, tickets:r.results.map(x=>{ const o = withReport(x); o.segments = segs[x.id]||[]; return o; })}, 200, h);
    }
    if(url.pathname === '/api/events' && req.method === 'GET'){""")
open(p,'w').write(s); print('ok')
