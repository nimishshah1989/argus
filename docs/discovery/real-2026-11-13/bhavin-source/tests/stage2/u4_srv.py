p='/home/claude/live/api/worker.js'; s=open(p).read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:80],s.count(a)); s=s.replace(a,b)
rep("""  // version 5
  raised_user: `ALTER TABLE tickets ADD COLUMN raised_user TEXT`};""","""  // version 5
  raised_user: `ALTER TABLE tickets ADD COLUMN raised_user TEXT`,
  // version 6: readable ticket number (BD-0042, WR-0013)
  ref: `ALTER TABLE tickets ADD COLUMN ref TEXT`};""")
rep("""    db.prepare(`CREATE INDEX IF NOT EXISTS sessions_user ON sessions(client, username)`)
  ]);
  ready = true;""","""    db.prepare(`CREATE INDEX IF NOT EXISTS sessions_user ON sessions(client, username)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS events_time ON events(client, at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS tickets_ref ON tickets(client, ref)`)
  ]);
  await backfillRefs(db);
  ready = true;""")
rep("""const json = (o, status, h) =>""","""// ---- ticket numbers: one running series per company for breakdowns and one for work requests; the prefix is a company setting
const series = kind => kind === 'general' ? 'wr' : 'bd';
async function prefixes(db, client){
  try{ const cf = await db.prepare(`SELECT body FROM config WHERE client=?`).bind(client).first(); const p = cf ? (JSON.parse(cf.body).ticketPrefix||{}) : {};
    const ok = v => /^[A-Za-z0-9]{1,6}$/.test(String(v||'')) ? String(v).toUpperCase() : '';
    return {bd: ok(p.bd) || 'BD', wr: ok(p.wr) || 'WR'}; }catch(e){ return {bd:'BD', wr:'WR'}; }
}
async function nextRef(db, client, kind, pre){
  const sr = series(kind), r = await db.prepare(`INSERT INTO meta (k, v) VALUES (?, '1') ON CONFLICT(k) DO UPDATE SET v = CAST(CAST(v AS INTEGER) + 1 AS TEXT) RETURNING v`).bind('seq:'+client+':'+sr).first();
  return pre[sr] + '-' + String(r.v).padStart(4, '0');
}
// tickets raised before numbers existed get them once, in the order they were raised
async function backfillRefs(db){
  const claim = await db.prepare(`INSERT OR IGNORE INTO meta (k, v) VALUES ('refs_v1', ?)`).bind(new Date().toISOString()).run();
  if(!claim.meta || !claim.meta.changes) return;
  const L = (await db.prepare(`SELECT id, client, kind FROM tickets WHERE ref IS NULL ORDER BY client, down_at`).all()).results;
  const pre = {}, n = {}, q = [];
  for(const t of L){
    if(!pre[t.client]) pre[t.client] = await prefixes(db, t.client);
    const k = t.client+':'+series(t.kind); n[k] = (n[k]||0) + 1;
    q.push(db.prepare(`UPDATE tickets SET ref=? WHERE id=?`).bind(pre[t.client][series(t.kind)] + '-' + String(n[k]).padStart(4, '0'), t.id));
  }
  Object.keys(n).forEach(k=>q.push(db.prepare(`INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = CAST(MAX(CAST(v AS INTEGER), CAST(excluded.v AS INTEGER)) AS TEXT)`).bind('seq:'+k, String(n[k]))));
  for(let i=0;i<q.length;i+=50) await db.batch(q.slice(i, i+50));
}
// the database takes at most 100 values per query, so long id lists are looked up in batches of 90
async function byIds(db, head, pre, ids, tail){
  const out = [];
  for(let i=0;i<ids.length;i+=90){ const part = ids.slice(i, i+90); const r = await db.prepare(head+'('+part.map(()=>'?').join(',')+')'+(tail||'')).bind(...pre, ...part).all(); out.push(...r.results); }
  return out;
}
const json = (o, status, h) =>""")
rep("""const V = 5;""","""const V = 6;""")
rep("""urgent:!!r.urgent, raisedUser:r.raised_user||''});""","""urgent:!!r.urgent, raisedUser:r.raised_user||'', ref:r.ref||''});""")
rep("""        const ev1 = await db.prepare(`SELECT * FROM events WHERE client=? AND type IN ('update','transfer','pause','resume','pickup') AND ticket IN (${ids.map(()=>'?').join(',')}) ORDER BY at DESC`).bind(client, ...ids).all();
        ev1.results.forEach(e=>{""","""        const ev1 = (await byIds(db, `SELECT * FROM events WHERE client=? AND type IN ('update','transfer','pause','resume','pickup') AND ticket IN `, [client], ids)).sort((a,b)=>a.at<b.at?1:a.at>b.at?-1:0);
        ev1.forEach(e=>{""")
rep("""        const ids = r.results.map(x=>x.id).slice(0, 400);
        const s = await db.prepare(`SELECT * FROM events WHERE client=? AND type='segment' AND ticket IN (${ids.map(()=>'?').join(',')})`).bind(client, ...ids).all();
        s.results.forEach(e=>{""","""        const ids = r.results.map(x=>x.id);
        const s = await byIds(db, `SELECT * FROM events WHERE client=? AND type='segment' AND ticket IN `, [client], ids);
        s.forEach(e=>{""")
rep("""      const since = new Date(now - 30*86400000).toISOString(), all = who.key || who.shared, me = who.name;""","""      const since = new Date(now - 30*86400000).toISOString(), all = who.key || who.shared || url.searchParams.get('team') === '1', me = who.name;""")
rep("""        const sq = await db.prepare(`SELECT ticket, by, SUM(mins) AS m FROM events WHERE client=? AND type='segment' AND ticket IN (${ids.map(()=>'?').join(',')}) GROUP BY ticket, by`).bind(client, ...ids).all();
        sq.results.forEach(e=>{""","""        const sq = await byIds(db, `SELECT ticket, by, SUM(mins) AS m FROM events WHERE client=? AND type='segment' AND ticket IN `, [client], ids, ` GROUP BY ticket, by`);
        sq.forEach(e=>{""")
rep("""    if(url.pathname === '/api/events' && req.method === 'GET'){""", open('/home/claude/s2/u4_endpoints.js').read() + """    if(url.pathname === '/api/events' && req.method === 'GET'){""")
rep("""      const id = newId();
      try{""","""      const id = newId(), ref = await nextRef(db, client, kind, await prefixes(db, client));
      try{""")
rep("""startNow ? 1 : 0, raised_user) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)""","""startNow ? 1 : 0, raised_user, ref) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)""") if False else None
rep("""self_started, raised_user) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)""","""self_started, raised_user, ref) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)""")
rep("""startNow ? 1 : 0, who.username || '').run();""","""startNow ? 1 : 0, who.username || '', ref).run();""")
open(p,'w').write(s); print('ok')
