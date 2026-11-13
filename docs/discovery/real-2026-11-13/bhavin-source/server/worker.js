// Live maintenance tickets (version 9): Cloudflare Worker + D1 database.
// Setup: bind a D1 database to this Worker with the name DB, and add a secret CLIENT_KEYS like {"cosmos":"a-long-random-text"}
// (company id -> its access key). Optional variable ALLOWED_ORIGIN = the tool's site address (several allowed, comma separated).
//
// Who can use it: the platform uses the company access key (full access, never put it in a link).
// Everyone else signs in with a username and password that an admin created in the platform (Settings > People & access).
// A sign-in lasts 30 days on that device. Roles: report (shop floor), maint, board (view only), supervisor, admin.
//
// Ticket kinds: stopped (machine down, downtime counts), support (machine running, needs help), general (work not on a machine).
// Ticket life: open -> working -> closed, or cancelled. While working it can be
//   transferred (back to open, someone else picks it up) or paused for a waiting reason (spare, vendor repair...) and resumed by anyone.
// Clocks: response (report -> first start), active repair (sum of work segments, credited per person), waiting (paused time),
//   transfer wait (transferred -> picked up), downtime (report -> close; for support/general = active repair).
// Version 9: others can join a job (as primary or as support) with their own clock; "machine running again" stops the downtime
//   while the ticket stays open for a follow-up (downtime = stopped periods only, repair = start -> running again, follow-up = running again -> close).
// Company settings (machines, team, lists, logo...) are kept here too, sent by the platform, read by phones and the board.

const V = 10;
const BASE = `CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY, client TEXT NOT NULL, machine TEXT NOT NULL, cell TEXT, category TEXT,
  down_at TEXT NOT NULL, reported_by TEXT NOT NULL, problem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', closed_at TEXT, closed_by TEXT, close_kind TEXT, close_note TEXT,
  downtime_min INTEGER, report_file TEXT,
  kind TEXT NOT NULL DEFAULT 'stopped', started_at TEXT, started_by TEXT, response_min INTEGER, repair_min INTEGER)`;
const ADD = {kind: `ALTER TABLE tickets ADD COLUMN kind TEXT NOT NULL DEFAULT 'stopped'`, started_at: `ALTER TABLE tickets ADD COLUMN started_at TEXT`,
  started_by: `ALTER TABLE tickets ADD COLUMN started_by TEXT`, response_min: `ALTER TABLE tickets ADD COLUMN response_min INTEGER`, repair_min: `ALTER TABLE tickets ADD COLUMN repair_min INTEGER`,
  eta: `ALTER TABLE tickets ADD COLUMN eta TEXT`, wait_spare: `ALTER TABLE tickets ADD COLUMN wait_spare INTEGER NOT NULL DEFAULT 0`, report_data: `ALTER TABLE tickets ADD COLUMN report_data TEXT`,
  handover_since: `ALTER TABLE tickets ADD COLUMN handover_since TEXT`, handover_wait_min: `ALTER TABLE tickets ADD COLUMN handover_wait_min INTEGER NOT NULL DEFAULT 0`,
  transfers: `ALTER TABLE tickets ADD COLUMN transfers INTEGER NOT NULL DEFAULT 0`, transfer_to: `ALTER TABLE tickets ADD COLUMN transfer_to TEXT`,
  // version 4
  seg_start: `ALTER TABLE tickets ADD COLUMN seg_start TEXT`, active_min: `ALTER TABLE tickets ADD COLUMN active_min INTEGER NOT NULL DEFAULT 0`,
  wait_since: `ALTER TABLE tickets ADD COLUMN wait_since TEXT`, wait_reason: `ALTER TABLE tickets ADD COLUMN wait_reason TEXT`,
  wait_min: `ALTER TABLE tickets ADD COLUMN wait_min INTEGER NOT NULL DEFAULT 0`, vendor_min: `ALTER TABLE tickets ADD COLUMN vendor_min INTEGER NOT NULL DEFAULT 0`,
  assigned_to: `ALTER TABLE tickets ADD COLUMN assigned_to TEXT`, paused_by: `ALTER TABLE tickets ADD COLUMN paused_by TEXT`,
  raised_role: `ALTER TABLE tickets ADD COLUMN raised_role TEXT`, self_started: `ALTER TABLE tickets ADD COLUMN self_started INTEGER NOT NULL DEFAULT 0`,
  location: `ALTER TABLE tickets ADD COLUMN location TEXT`, work_type: `ALTER TABLE tickets ADD COLUMN work_type TEXT`, urgent: `ALTER TABLE tickets ADD COLUMN urgent INTEGER NOT NULL DEFAULT 0`,
  // version 5
  raised_user: `ALTER TABLE tickets ADD COLUMN raised_user TEXT`,
  // version 6: readable ticket number (BD-0042, WR-0013)
  ref: `ALTER TABLE tickets ADD COLUMN ref TEXT`,
  // version 7: when an admin last corrected the ticket
  edited_at: `ALTER TABLE tickets ADD COLUMN edited_at TEXT`,
  // version 9: people who joined the job, and machine running again while the ticket stays open
  crew: `ALTER TABLE tickets ADD COLUMN crew TEXT`, running_at: `ALTER TABLE tickets ADD COLUMN running_at TEXT`, stop_at: `ALTER TABLE tickets ADD COLUMN stop_at TEXT`,
  down_acc: `ALTER TABLE tickets ADD COLUMN down_acc INTEGER NOT NULL DEFAULT 0`, follow_min: `ALTER TABLE tickets ADD COLUMN follow_min INTEGER`,
  // version 10: a pending task left when a ticket is closed (a work request that points back to its ticket)
  parent_id: `ALTER TABLE tickets ADD COLUMN parent_id TEXT`, parent_ref: `ALTER TABLE tickets ADD COLUMN parent_ref TEXT`, task_exp: `ALTER TABLE tickets ADD COLUMN task_exp TEXT`,
  task_why: `ALTER TABLE tickets ADD COLUMN task_why TEXT`, task_down_min: `ALTER TABLE tickets ADD COLUMN task_down_min INTEGER`};
const SUBS = `CREATE TABLE IF NOT EXISTS subs (endpoint TEXT PRIMARY KEY, client TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, role TEXT, at TEXT)`;
const META = `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`;
const EVENTS = `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, client TEXT NOT NULL, ticket TEXT NOT NULL, at TEXT NOT NULL, type TEXT NOT NULL, by TEXT, text TEXT, eta TEXT, spare TEXT)`;
const CONFIG = `CREATE TABLE IF NOT EXISTS config (client TEXT PRIMARY KEY, body TEXT NOT NULL, fp TEXT, at TEXT, token TEXT)`;
const USERS = `CREATE TABLE IF NOT EXISTS users (client TEXT NOT NULL, username TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, title TEXT, shared INTEGER NOT NULL DEFAULT 0,
  pass TEXT NOT NULL, salt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created TEXT, updated TEXT, last_login TEXT, fail_n INTEGER NOT NULL DEFAULT 0, lock_until TEXT, PRIMARY KEY (client, username))`;
const SESSIONS = `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, client TEXT NOT NULL, username TEXT NOT NULL, created TEXT, seen TEXT, expires TEXT, device TEXT)`;
const ACTIVE = `('open','working','waiting')`;
// what each role may do
const ROLES = ['report','maint','board','supervisor','admin'];
const CAN = {report:['read','raise','config','push'], board:['read','config'], maint:['read','raise','config','work','push'],
  supervisor:['read','raise','config','work','push','history'], admin:['read','raise','config','work','push','history','users']};
const SESSION_DAYS = 30, MAX_DEVICES = 10;
let ready = false;
async function ensureSchema(db){
  if(ready) return;
  await db.prepare(BASE).run();
  const have = new Set(((await db.prepare(`PRAGMA table_info(tickets)`).all()).results || []).map(r => r.name));
  for(const c of Object.keys(ADD)) if(!have.has(c)) await db.prepare(ADD[c]).run();
  await db.prepare(EVENTS).run(); await db.prepare(SUBS).run(); await db.prepare(META).run(); await db.prepare(CONFIG).run();
  await db.prepare(USERS).run(); await db.prepare(SESSIONS).run();
  const ec = new Set(((await db.prepare(`PRAGMA table_info(events)`).all()).results || []).map(r => r.name));
  if(!ec.has('mins')) await db.prepare(`ALTER TABLE events ADD COLUMN mins INTEGER`).run();
  const sc = new Set(((await db.prepare(`PRAGMA table_info(subs)`).all()).results || []).map(r => r.name));
  if(!sc.has('who')) await db.prepare(`ALTER TABLE subs ADD COLUMN who TEXT`).run();
  await db.batch([
    db.prepare(`CREATE INDEX IF NOT EXISTS events_ticket ON events(client, ticket, at)`),
    db.prepare(`DROP INDEX IF EXISTS one_open_per_machine`),
    db.prepare(`DROP INDEX IF EXISTS one_active_per_machine`),
    // one active ticket per machine (general work is not tied to a machine)
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS one_active_machine ON tickets(client, machine) WHERE status IN ${ACTIVE} AND kind <> 'general'`),
    db.prepare(`CREATE INDEX IF NOT EXISTS tickets_client_time ON tickets(client, down_at)`),
    // so each refresh reads only the rows it needs, however long the history gets
    db.prepare(`CREATE INDEX IF NOT EXISTS tickets_status ON tickets(client, status, closed_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS tickets_noreport ON tickets(client, close_kind, closed_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS events_type ON events(client, type, at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sessions_user ON sessions(client, username)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS events_time ON events(client, at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS tickets_ref ON tickets(client, ref)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS tickets_edited ON tickets(client, edited_at)`)
  ]);
  await backfillRefs(db);
  ready = true;
}

// ---- ticket numbers: one running series per company for breakdowns and one for work requests; the prefix is a company setting
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
// any ticket without a number (raised before numbers existed, or restored from a backup) gets one, continuing its series in the order raised;
// numbers are reserved from the counter first, so two server copies starting together can never hand out the same number
async function backfillRefs(db){
  const L = (await db.prepare(`SELECT id, client, kind FROM tickets WHERE ref IS NULL ORDER BY client, down_at LIMIT 5000`).all()).results;
  if(!L.length) return;
  const groups = {}; L.forEach(t=>{ const k = t.client+':'+series(t.kind); (groups[k] = groups[k]||[]).push(t); });
  for(const k of Object.keys(groups)){
    const G = groups[k], client = k.split(':')[0], pre = await prefixes(db, client);
    const r = await db.prepare(`INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = CAST(CAST(v AS INTEGER) + ? AS TEXT) RETURNING v`).bind('seq:'+k, String(G.length), G.length).first();
    let n = Number(r.v) - G.length;
    const q = G.map(t=>db.prepare(`UPDATE tickets SET ref=? WHERE id=? AND ref IS NULL`).bind(pre[series(t.kind)] + '-' + String(++n).padStart(4, '0'), t.id));
    for(let i=0;i<q.length;i+=50) await db.batch(q.slice(i, i+50));
  }
}
// the database takes at most 100 values per query, so long id lists are looked up in batches of 90
async function byIds(db, head, pre, ids, tail){
  const out = [];
  for(let i=0;i<ids.length;i+=90){ const part = ids.slice(i, i+90); const r = await db.prepare(head+'('+part.map(()=>'?').join(',')+')'+(tail||'')).bind(...pre, ...part).all(); out.push(...r.results); }
  return out;
}
// follow-up tasks left from closed breakdowns: attached to each closed ticket so the tile can say what is still pending
async function addFollow(db, client, rows){
  const ids = rows.map(r=>r.id); if(!ids.length) return rows;
  const tk = await byIds(db, `SELECT id, ref, status, problem, task_exp, task_why, started_by, started_at, closed_at, closed_by, parent_id FROM tickets WHERE client=? AND status IN ('open','working','waiting','closed') AND parent_id IN `, [client], ids);
  const m = {}; tk.sort((a,b)=>String(a.ref)<String(b.ref)?-1:1).forEach(k=>{ (m[k.parent_id] = m[k.parent_id]||[]).push({id:k.id, ref:k.ref||'', status:k.status, text:k.problem||'', exp:k.task_exp||'', why:k.task_why||'', startedBy:k.started_by||'', startedAt:k.started_at||null, closedAt:k.closed_at||null, closedBy:k.closed_by||''}); });
  return rows.map(r=>m[r.id] ? {...r, follow:m[r.id]} : r);
}
const json = (o, status, h) => new Response(JSON.stringify(o), {status: status||200, headers: {...h, 'Content-Type':'application/json', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}});
function origins(env){ return String(env.ALLOWED_ORIGIN||'').split(',').map(x=>x.trim().replace(/\/+$/,'')).filter(Boolean); }
// Only the tool's own site (ALLOWED_ORIGIN) and the platform (a local file, origin "null") may call the server from a browser.
function originOk(req, env){ const o = req.headers.get('Origin') || '', L = origins(env); return !o || o === 'null' || !L.length || L.includes(o) || o === new URL(req.url).origin; }
function cors(req, env){
  const o = req.headers.get('Origin') || '';
  const h = {'Access-Control-Allow-Methods':'GET, POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, X-Client, X-Key, X-Config-Token, Authorization', 'Access-Control-Max-Age':'86400', 'Vary':'Origin'};
  if(originOk(req, env)) h['Access-Control-Allow-Origin'] = o || '*';
  return h;
}
function same(a, b){ a = String(a||''); b = String(b||''); let d = a.length ^ b.length; for(let i=0;i<Math.max(a.length,b.length);i++) d |= (a.charCodeAt(i)||0) ^ (b.charCodeAt(i)||0); return d === 0; }
function clean(s, n){ return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g,' ').trim().slice(0, n); }
const mins = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
function newId(){ const b = new Uint8Array(9); crypto.getRandomValues(b); return 't_' + Array.from(b, x=>x.toString(16).padStart(2,'0')).join(''); }
async function sha(s){ return b64u(await crypto.subtle.digest('SHA-256', te.encode(String(s)))); }
function pickTime(ts, now, minIso, what){
  if(!ts) return {iso: new Date(now).toISOString()};
  let t = Date.parse(ts); if(isNaN(t)) return {error: 'That time is not valid'};
  if(t > now + 60000) return {error: 'The time cannot be in the future'};
  if(t > now) t = now;
  if(t < now - 24*3600000) return {error: 'The time cannot be more than a day ago'};
  if(minIso && t < Date.parse(minIso)) return {error: what + ' cannot be before ' + new Date(Date.parse(minIso)).toISOString().slice(11,16) + ' UTC'};
  return {iso: new Date(t).toISOString()};
}
// Simple per-address limit (each Cloudflare location keeps its own count; a guard against floods, not exact accounting)
const HITS = new Map();
function limited(ip, isWrite){
  const t = Math.floor(Date.now()/60000), k = ip+'|'+t, n = (HITS.get(k)||0)+1; HITS.set(k, n);
  if(HITS.size > 5000){ for(const x of HITS.keys()){ if(!x.endsWith('|'+t)) HITS.delete(x); } }
  return n > (isWrite ? 120 : 600);
}
const VENDOR = /vendor/i;
// sign-in attempts per address (on top of the 5-wrong-tries lock per username)
function loginLimited(ip){ const t = Math.floor(Date.now()/60000), k = 'L|'+ip+'|'+t, n = (HITS.get(k)||0)+1; HITS.set(k, n); return n > 20; }
// passwords are stored as PBKDF2-SHA256 hashes (100,000 rounds, random salt), never as text
async function passHash(pw, salt){ const k = await crypto.subtle.importKey('raw', te.encode(String(pw)), 'PBKDF2', false, ['deriveBits']); return b64u(await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:ub64(salt), iterations:100000}, k, 256)); }
function rnd(n){ const b = new Uint8Array(n); crypto.getRandomValues(b); return b64u(b); }
const userOut = u => ({username:u.username, name:u.name, role:u.role, title:u.title||'', shared:!!u.shared});

// ---- Web Push (RFC 8291 message encryption, RFC 8292 VAPID)
const b64u = a => btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const ub64 = s => { s = String(s).replace(/-/g,'+').replace(/_/g,'/'); while(s.length % 4) s += '='; return Uint8Array.from(atob(s), c=>c.charCodeAt(0)); };
const cat = (...a) => { const n = a.reduce((x,y)=>x+y.length,0), o = new Uint8Array(n); let i = 0; a.forEach(x=>{ o.set(x,i); i += x.length; }); return o; };
const te = new TextEncoder();
async function vapidKeys(db){
  const r = await db.prepare(`SELECT v FROM meta WHERE k='vapid'`).first();
  if(r) return JSON.parse(r.v);
  const kp = await crypto.subtle.generateKey({name:'ECDSA', namedCurve:'P-256'}, true, ['sign','verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey), pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  const v = {jwk, pub}; await db.prepare(`INSERT OR IGNORE INTO meta (k, v) VALUES ('vapid', ?)`).bind(JSON.stringify(v)).run();
  return JSON.parse((await db.prepare(`SELECT v FROM meta WHERE k='vapid'`).first()).v);
}
async function hkdf(salt, ikm, info, bytes){
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF', hash:'SHA-256', salt, info}, k, bytes*8));
}
async function encryptPush(sub, text){
  const ua = ub64(sub.p256dh), auth = ub64(sub.auth);
  const eph = await crypto.subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, true, ['deriveBits']);
  const as = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, {name:'ECDH', namedCurve:'P-256'}, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH', public:uaKey}, eph.privateKey, 256));
  const ikm = await hkdf(auth, shared, cat(te.encode('WebPush: info\0'), ua, as), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv:nonce}, key, cat(te.encode(text), new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0,0,16,0]), new Uint8Array([as.length]), as, ct);
}
async function vapidAuth(endpoint, v){
  const aud = new URL(endpoint).origin, now = Math.floor(Date.now()/1000);
  const head = b64u(te.encode(JSON.stringify({typ:'JWT', alg:'ES256'}))), body = b64u(te.encode(JSON.stringify({aud, exp:now+12*3600, sub:'mailto:alerts@example.com'})));
  const k = await crypto.subtle.importKey('jwk', v.jwk, {name:'ECDSA', namedCurve:'P-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign({name:'ECDSA', hash:'SHA-256'}, k, te.encode(head+'.'+body));
  return 'vapid t='+head+'.'+body+'.'+b64u(sig)+', k='+v.pub;
}

async function pushTo(db, client, msg, who){
  try{
    const r = who ? await db.prepare(`SELECT * FROM subs WHERE client=? AND role='maint' AND who=?`).bind(client, who).all()
                  : await db.prepare(`SELECT * FROM subs WHERE client=? AND role='maint'`).bind(client).all();
    if(!r.results.length) return;
    const v = await vapidKeys(db), text = JSON.stringify(msg);
    await Promise.all(r.results.map(async s=>{
      try{
        const res = await fetch(s.endpoint, {method:'POST', headers:{'Content-Encoding':'aes128gcm', 'Content-Type':'application/octet-stream', 'TTL':'3600', 'Urgency':'high', 'Authorization':await vapidAuth(s.endpoint, v)}, body:await encryptPush(s, text)});
        if(res.status===404 || res.status===410) await db.prepare(`DELETE FROM subs WHERE endpoint=?`).bind(s.endpoint).run();
      }catch(e){}
    }));
  }catch(e){}
}
// the shop-floor phones that raised a ticket (alerts on, signed in with that login)
async function pushFloor(db, client, username, msg){
  try{
    if(!username) return;
    const r = await db.prepare(`SELECT * FROM subs WHERE client=? AND role='floor' AND who=?`).bind(client, username).all();
    if(!r.results.length) return;
    const v = await vapidKeys(db), text = JSON.stringify(msg);
    await Promise.all(r.results.map(async s=>{ try{
      const res = await fetch(s.endpoint, {method:'POST', headers:{'Content-Encoding':'aes128gcm', 'Content-Type':'application/octet-stream', 'TTL':'3600', 'Urgency':'normal', 'Authorization':await vapidAuth(s.endpoint, v)}, body:await encryptPush(s, text)});
      if(res.status===404 || res.status===410) await db.prepare(`DELETE FROM subs WHERE endpoint=?`).bind(s.endpoint).run(); }catch(e){} }));
  }catch(e){}
}
const KIND = {stopped:'Machine stopped: ', support:'Needs support: ', general:'Work request: '};
const place = t => t.kind === 'general' ? (t.location || 'General work') : t.machine;
// a time picked on the phone has whole minutes: one in the same minute as the earliest allowed time counts as that time
const sameMinute = (ts, min) => { const a = Date.parse(ts||''), b = Date.parse(min||''); return !isNaN(a) && !isNaN(b) && a < b && b - a < 60000 ? min : ts; };
const crewOf = t => { try{ const c = t && t.crew ? JSON.parse(t.crew) : []; return Array.isArray(c) ? c : []; }catch(e){ return []; } };

export default {
  async fetch(req, env, ctx){
    const h = cors(req, env), url = new URL(req.url);
    if(req.method === 'OPTIONS') return new Response(null, {status:204, headers:h});
    if(!url.pathname.startsWith('/api/')) return json({ok:true, service:'maintenance tickets', version:V}, 200, h);
    const ip = req.headers.get('CF-Connecting-IP') || 'x';
    if(limited(ip, req.method === 'POST')) return json({error:'Too many requests. Wait a minute and try again.'}, 429, h);
    if(req.method === 'POST' && !originOk(req, env)) return json({error:'origin'}, 403, h);
    let keys = {}; try{ keys = JSON.parse(env.CLIENT_KEYS || '{}'); }catch(e){}
    const client = clean(req.headers.get('X-Client') || url.searchParams.get('c'), 60), key = req.headers.get('X-Key') || '';
    if(!client || !keys[client]) return json({error:'auth', message:'Unknown company code'}, 401, h);
    if(!env.DB) return json({error:'no database bound (name it DB)'}, 500, h);
    await ensureSchema(env.DB);
    const db = env.DB, now = Date.now(), nowIso = new Date(now).toISOString();
    let body = {}; if(req.method === 'POST'){ try{ body = await req.json(); }catch(e){ return json({error:'bad json'}, 400, h); } }
    const later = p => { if(ctx && ctx.waitUntil) ctx.waitUntil(p); };

    // ---------- before signing in: the company name and logo for the sign-in screen, and signing in
    if(url.pathname === '/api/brand' && req.method === 'GET'){
      const cf = await db.prepare(`SELECT body FROM config WHERE client=?`).bind(client).first(); let c = {}; try{ c = cf ? JSON.parse(cf.body) : {}; }catch(e){}
      return json({company:c.company||'', tagline:c.tagline||'', logo:c.logo||''}, 200, h);
    }
    if(url.pathname === '/api/login' && req.method === 'POST'){
      if(loginLimited(ip)) return json({error:'Too many sign-in attempts. Wait a minute and try again.'}, 429, h);
      const un = clean(body.username, 40).toLowerCase(), pw = String(body.password||'').slice(0, 200);
      if(!un || !pw) return json({error:'Enter your username and password'}, 400, h);
      const u = await db.prepare(`SELECT * FROM users WHERE client=? AND username=?`).bind(client, un).first();
      if(!u){ await passHash(pw, rnd(16)); return json({error:'Wrong username or password'}, 401, h); }
      if(u.lock_until && Date.parse(u.lock_until) > now) return json({error:'Too many wrong passwords. Try again after '+Math.ceil((Date.parse(u.lock_until)-now)/60000)+' min, or ask your administrator to reset it.'}, 429, h);
      if(!same(await passHash(pw, u.salt), u.pass)){
        const n = (u.fail_n||0) + 1, lock = n >= 5 ? new Date(now + 10*60000).toISOString() : null;
        await db.prepare(`UPDATE users SET fail_n=?, lock_until=? WHERE client=? AND username=?`).bind(lock ? 0 : n, lock, client, un).run();
        return json({error:lock ? 'Too many wrong passwords. This login is locked for 10 minutes.' : 'Wrong username or password'}, 401, h);
      }
      if(!u.active) return json({error:'This login is switched off. Ask your administrator.'}, 403, h);
      const tok = 's_' + rnd(24), exp = new Date(now + SESSION_DAYS*86400000).toISOString();
      await db.batch([
        db.prepare(`INSERT INTO sessions (token, client, username, created, seen, expires, device) VALUES (?,?,?,?,?,?,?)`).bind(await sha(tok), client, un, nowIso, nowIso, exp, clean(body.device || req.headers.get('User-Agent'), 120)),
        db.prepare(`UPDATE users SET fail_n=0, lock_until=NULL, last_login=? WHERE client=? AND username=?`).bind(nowIso, client, un),
        db.prepare(`DELETE FROM sessions WHERE client=? AND (expires<? OR token IN (SELECT token FROM sessions WHERE client=? AND username=? ORDER BY seen DESC LIMIT -1 OFFSET ?))`).bind(client, nowIso, client, un, MAX_DEVICES)
      ]);
      return json({ok:true, token:tok, days:SESSION_DAYS, user:userOut(u)}, 200, h);
    }

    // ---------- who is asking: the platform (company key) or a signed-in person
    let who = null;
    if(key){ if(!same(keys[client], key)) return json({error:'auth'}, 401, h); who = {key:true, role:'admin', name:'', username:'', shared:true}; }
    else {
      const m = /^Bearer\s+(\S{10,100})$/.exec(req.headers.get('Authorization') || '');
      if(m){
        const th = await sha(m[1]);
        const s = await db.prepare(`SELECT s.seen, s.expires, u.username, u.name, u.role, u.title, u.shared, u.active FROM sessions s JOIN users u ON u.client=s.client AND u.username=s.username WHERE s.token=? AND s.client=?`).bind(th, client).first();
        if(s && s.active && Date.parse(s.expires) > now){
          who = {key:false, token:th, username:s.username, name:s.name, role:ROLES.includes(s.role) ? s.role : 'report', title:s.title||'', shared:!!s.shared};
          // the 30 days restart from the last use (written at most twice a day)
          if(now - Date.parse(s.seen||0) > 12*3600000) later(db.prepare(`UPDATE sessions SET seen=?, expires=? WHERE token=?`).bind(nowIso, new Date(now + SESSION_DAYS*86400000).toISOString(), th).run());
        }
      }
    }
    if(!who) return json({error:'auth', message:'Please sign in again'}, 401, h);
    const can = p => who.key || (CAN[who.role]||[]).includes(p);
    const deny = () => json({error:'Your login cannot do this. Ask your administrator.'}, 403, h);
    // the name recorded on each action: a personal login always records its own name; a shared login (one phone for a team) records the name picked on the phone
    const actor = v => (who.key || who.shared) ? clean(v, 60) : who.name;

    if(url.pathname === '/api/me' && req.method === 'GET') return json(who.key ? {key:true} : {user:userOut(who)}, 200, h);
    if(url.pathname === '/api/logout' && req.method === 'POST'){ if(!who.key) await db.prepare(`DELETE FROM sessions WHERE token=?`).bind(who.token).run(); return json({ok:true}, 200, h); }
    if(url.pathname === '/api/password' && req.method === 'POST'){
      if(who.key) return json({error:'Use People & access in the platform'}, 400, h);
      const u = await db.prepare(`SELECT * FROM users WHERE client=? AND username=?`).bind(client, who.username).first();
      if(!u || !same(await passHash(String(body.old||''), u.salt), u.pass)) return json({error:'The current password is wrong'}, 400, h);
      const np = String(body.password||''); if(np.length < 6 || np.length > 100) return json({error:'The new password needs at least 6 characters'}, 400, h);
      const salt = rnd(16);
      await db.batch([db.prepare(`UPDATE users SET pass=?, salt=?, updated=? WHERE client=? AND username=?`).bind(await passHash(np, salt), salt, nowIso, client, who.username),
        db.prepare(`DELETE FROM sessions WHERE client=? AND username=? AND token<>?`).bind(client, who.username, who.token)]);
      return json({ok:true}, 200, h);
    }

    // ---------- people and access (platform with the key, or an admin login)
    if(url.pathname.startsWith('/api/users')){
      if(!can('users')) return deny();
      const un = clean(body.username, 40).toLowerCase();
      if(url.pathname === '/api/users' && req.method === 'GET'){
        const r = await db.prepare(`SELECT u.username, u.name, u.role, u.title, u.shared, u.active, u.created, u.last_login, u.lock_until,
            (SELECT COUNT(*) FROM sessions s WHERE s.client=u.client AND s.username=u.username AND s.expires>?) AS devices,
            (SELECT MAX(seen) FROM sessions s WHERE s.client=u.client AND s.username=u.username) AS seen FROM users u WHERE u.client=? ORDER BY u.name`).bind(nowIso, client).all();
        return json({users:r.results.map(u=>({...userOut(u), active:!!u.active, created:u.created, lastLogin:u.last_login, seen:u.seen, devices:u.devices||0, locked:!!(u.lock_until && Date.parse(u.lock_until) > now)}))}, 200, h);
      }
      if(req.method !== 'POST') return json({error:'not found'}, 404, h);
      if(!/^[a-z0-9._-]{3,30}$/.test(un)) return json({error:'The username needs 3 to 30 letters or numbers (a dot, dash or underscore is fine), no spaces'}, 400, h);
      const self = !who.key && un === who.username;
      const ex = await db.prepare(`SELECT * FROM users WHERE client=? AND username=?`).bind(client, un).first();
      const pwOk = p => typeof p === 'string' && p.length >= 6 && p.length <= 100;
      if(url.pathname === '/api/users'){
        const name = clean(body.name, 60), role = ROLES.includes(body.role) ? body.role : '', title = clean(body.title, 40), shared = body.shared ? 1 : 0;
        if(!name) return json({error:'Enter the person\'s name'}, 400, h);
        if(!role) return json({error:'Pick a role'}, 400, h);
        if(self && (role !== 'admin' || body.active === false)) return json({error:'You cannot remove your own admin access'}, 400, h);
        if(!ex){
          if(!pwOk(body.password)) return json({error:'The password needs at least 6 characters'}, 400, h);
          const n = (await db.prepare(`SELECT COUNT(*) AS n FROM users WHERE client=?`).bind(client).first()).n || 0;
          if(n >= 500) return json({error:'Too many logins for this company'}, 400, h);
          const salt = rnd(16);
          await db.prepare(`INSERT INTO users (client, username, name, role, title, shared, pass, salt, active, created, updated) VALUES (?,?,?,?,?,?,?,?,1,?,?)`).bind(client, un, name, role, title, shared, await passHash(body.password, salt), salt, nowIso, nowIso).run();
          return json({ok:true, created:true}, 200, h);
        }
        const active = body.active === false ? 0 : body.active === true ? 1 : ex.active;
        const q = [db.prepare(`UPDATE users SET name=?, role=?, title=?, shared=?, active=?, updated=? WHERE client=? AND username=?`).bind(name, role, title, shared, active, nowIso, client, un)];
        if(!active) q.push(db.prepare(`DELETE FROM sessions WHERE client=? AND username=?`).bind(client, un));
        await db.batch(q);
        return json({ok:true}, 200, h);
      }
      if(!ex) return json({error:'No such login'}, 404, h);
      if(url.pathname === '/api/users/password'){
        if(!pwOk(body.password)) return json({error:'The password needs at least 6 characters'}, 400, h);
        const salt = rnd(16);
        await db.batch([db.prepare(`UPDATE users SET pass=?, salt=?, fail_n=0, lock_until=NULL, updated=? WHERE client=? AND username=?`).bind(await passHash(body.password, salt), salt, nowIso, client, un),
          db.prepare(`DELETE FROM sessions WHERE client=? AND username=?`+(self ? ` AND token<>?` : '')).bind(...(self ? [client, un, who.token] : [client, un]))]);
        return json({ok:true}, 200, h);
      }
      if(url.pathname === '/api/users/signout'){ await db.prepare(`DELETE FROM sessions WHERE client=? AND username=?`+(self ? ` AND token<>?` : '')).bind(...(self ? [client, un, who.token] : [client, un])).run(); return json({ok:true}, 200, h); }
      if(url.pathname === '/api/users/delete'){
        if(self) return json({error:'You cannot delete your own login'}, 400, h);
        await db.batch([db.prepare(`DELETE FROM sessions WHERE client=? AND username=?`).bind(client, un), db.prepare(`DELETE FROM users WHERE client=? AND username=?`).bind(client, un)]);
        return json({ok:true}, 200, h);
      }
      return json({error:'not found'}, 404, h);
    }

    const row = r => r && ({id:r.id, machine:r.machine, cell:r.cell||'', category:r.category||'', kind:r.kind||'stopped', downAt:r.down_at, reportedBy:r.reported_by, problem:r.problem,
      status:r.status, startedAt:r.started_at||null, startedBy:r.started_by||'', responseMin:r.response_min, repairMin:r.repair_min,
      closedAt:r.closed_at, closedBy:r.closed_by||'', closeKind:r.close_kind||'', closeNote:r.close_note||'', downtimeMin:r.downtime_min, reportFile:r.report_file||'',
      eta:r.eta||'', waitSpare:!!r.wait_spare, handoverSince:r.handover_since||null, handoverWaitMin:r.handover_wait_min||0, transfers:r.transfers||0, transferTo:r.transfer_to||'',
      handedOver:r.status==='open' && !!r.started_at, hasReport:!!r.report_data,
      segStart:r.seg_start||null, activeMin:r.active_min||0, waitSince:r.wait_since||null, waitReason:r.wait_reason||'', waitMin:r.wait_min||0, vendorMin:r.vendor_min||0,
      assignedTo:r.assigned_to||'', pausedBy:r.paused_by||'', raisedRole:r.raised_role||'', selfStarted:!!r.self_started, location:r.location||'', workType:r.work_type||'', urgent:!!r.urgent, raisedUser:r.raised_user||'', ref:r.ref||'', editedAt:r.edited_at||null,
      crew:crewOf(r).map(c=>({name:c.name, role:c.role, joinedAt:c.joinedAt, running:!!c.seg, segStart:c.seg||null, mins:c.mins||0, left:c.left||null, leftWhy:c.leftWhy||''})),
      runningAt:r.running_at||null, stopAt:r.stop_at||null, downAcc:r.down_acc||0, followMin:r.follow_min==null?null:r.follow_min,
      parentId:r.parent_id||'', parentRef:r.parent_ref||'', taskExp:r.task_exp||'', taskWhy:r.task_why||'', taskDownMin:r.task_down_min==null?null:r.task_down_min});
    const withReport = r => { const o = row(r); try{ o.report = r.report_data ? JSON.parse(r.report_data) : null; }catch(e){ o.report = null; } return o; };
    const ev = async (ticket, type, by, text, eta, spare, m) => {
      const r = await db.prepare(`INSERT INTO events (id, client, ticket, at, type, by, text, eta, spare, mins) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(newId(), client, ticket, new Date().toISOString(), type, by||'', text||'', eta||'', spare||'', m==null?null:m).run();
      if(['start','pickup','pause','resume','close','cancel'].includes(type)){
        // a pending task keeps its ticket informed: the line is written on the ticket it came from, so everyone who follows that ticket sees the progress
        const k = await db.prepare(`SELECT parent_id, ref, task_down_min FROM tickets WHERE id=? AND client=?`).bind(ticket, client).first();
        if(k && k.parent_id){
          const W = {start:'started', pickup:'picked up', pause:'paused', resume:'resumed', close:'done', cancel:'cancelled'}[type];
          const line = 'Pending task '+(k.ref||'')+' '+W+(text && ['pause','close','cancel'].includes(type) ? ': '+text : '')+(type==='close' && k.task_down_min ? ' · machine stopped '+k.task_down_min+' min' : '');
          await db.prepare(`INSERT INTO events (id, client, ticket, at, type, by, text, eta, spare, mins) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(newId(), client, k.parent_id, new Date().toISOString(), 'task', by||'', line, '', '', null).run();
        }
      }
      return r;
    };
    const evRow = e => ({ticket:e.ticket, at:e.at, type:e.type, by:e.by||'', text:e.text||'', eta:e.eta||'', spare:e.spare||'', mins:e.mins==null?null:e.mins});
    // a breakdown's history includes the steps of the tasks left from it (tagged with the task number); the one-line summaries written on the breakdown for those steps are dropped
    const threadEvents = async (parentId, evs, tasks) => {
      if(!tasks.length) return evs;
      evs = evs.filter(x=>!(x.type === 'task' && /^Pending task \S+ (started|picked up|paused|resumed|done|cancelled)/.test(x.text||'')));
      for(const k of tasks){
        const ke = await db.prepare(`SELECT * FROM events WHERE client=? AND ticket=? ORDER BY at`).bind(client, k.id).all();
        ke.results.filter(x=>x.type!=='segment' && x.type!=='task').forEach(x=>{ const r = evRow(x); r.task = k.ref; r.text = '['+k.ref+'] '+(r.text||''); evs.push(r); });
      }
      return evs.sort((p,q)=>String(p.at).localeCompare(String(q.at)));
    };
    const get = async id => db.prepare(`SELECT * FROM tickets WHERE id=? AND client=?`).bind(clean(id, 40), client).first();
    const isActive = t => t && (t.status === 'open' || t.status === 'working' || t.status === 'waiting');
    const notFound = () => json({error:'Ticket not found'}, 404, h);
    // closes the current work segment: adds its minutes to active repair and records who did it
    const endSeg = async (t, atIso) => { if(!t.seg_start) return 0; const m = mins(t.seg_start, atIso); await ev(t.id, 'segment', t.started_by, '', '', '', m); return m; };
    // ---- people who joined the job: each has their own clock (seg = running since), minutes go into 'segment' events under their name
    const crewSave = (id, C) => db.prepare(`UPDATE tickets SET crew=? WHERE id=?`).bind(C.length ? JSON.stringify(C) : null, id).run();
    const crewStop = async (t, C, atIso, keep) => { for(const c of C){ if(c.seg && !c.left){ const m = mins(c.seg, atIso); if(m > 0){ await ev(t.id, 'segment', c.name, c.role, '', '', m); c.mins = (c.mins||0) + m; } c.seg = null; } } return C; };
    const crewActive = C => C.filter(c=>!c.left);
    // who may close: the person running the job (started / picked up / resumed it), anyone who joined as primary; Supervisor, Admin and the platform always
    const mayClose = (t, by) => who.key || who.role === 'supervisor' || who.role === 'admin' || t.status === 'open' || !t.started_by || by === t.started_by || crewActive(crewOf(t)).some(c=>c.name === by && c.role === 'primary');
    const etaOf = v => { if(!v) return {iso:''}; const e = Date.parse(v); return isNaN(e) ? {error:'The expected date is not valid'} : {iso:new Date(e).toISOString()}; };

    // ---------- reading
    if(url.pathname === '/api/state' && req.method === 'GET'){
      if(!can('read')) return deny();
      const open = await db.prepare(`SELECT * FROM tickets WHERE client=? AND status IN ${ACTIVE} ORDER BY down_at`).bind(client).all();
      const since = new Date(now - 24*3600000).toISOString();
      const done = await db.prepare(`SELECT * FROM tickets WHERE client=? AND status='closed' AND closed_at>=? ORDER BY closed_at DESC LIMIT 100`).bind(client, since).all();
      const cx = await db.prepare(`SELECT * FROM tickets WHERE client=? AND status='cancelled' AND closed_at>=? ORDER BY closed_at DESC LIMIT 50`).bind(client, since).all();
      const ids = open.results.map(r=>r.id), tl = {}, cnt = {};
      if(ids.length){
        const ev1 = (await byIds(db, `SELECT * FROM events WHERE client=? AND type IN ('update','transfer','pause','resume','pickup','join','leave','lead','running','stopped') AND ticket IN `, [client], ids)).sort((a,b)=>a.at<b.at?1:a.at>b.at?-1:0);
        ev1.forEach(e=>{ cnt[e.ticket] = (cnt[e.ticket]||0)+1; (tl[e.ticket] = tl[e.ticket]||[]); if(tl[e.ticket].length < 12) tl[e.ticket].push(evRow(e)); });
      }
      const wk = new Date(now - 7*86400000).toISOString();
      const nr = await db.prepare(`SELECT * FROM tickets WHERE client=? AND close_kind='no_report' AND closed_at>=? AND report_data IS NULL ORDER BY closed_at DESC LIMIT 200`).bind(client, wk).all();
      const cf = await db.prepare(`SELECT fp, at FROM config WHERE client=?`).bind(client).first();
      const closedRows = await addFollow(db, client, done.results.map(row));
      return json({now:nowIso, version:V, config:cf ? {fp:cf.fp, at:cf.at} : null,
        open:open.results.map(r=>({...row(r), updates:tl[r.id]||[], updateCount:cnt[r.id]||0})), closed:closedRows, cancelled:cx.results.map(row), needReport:nr.results.map(row)}, 200, h);
    }
    if(url.pathname === '/api/history' && req.method === 'GET'){
      if(!can('history')) return deny();
      const days = Math.max(1, Math.min(400, Number(url.searchParams.get('days')) || 30)), since = new Date(now - days*86400000).toISOString();
      const ch = Date.parse(url.searchParams.get('changed') || '');
      // changed = since the platform last looked: judged by when the server RECEIVED the close/report (event time), not by the closing time, which a person can back-date by up to a day
      const r = isNaN(ch)
        ? await db.prepare(`SELECT * FROM tickets WHERE client=? AND down_at>=? ORDER BY down_at DESC LIMIT 2000`).bind(client, since).all()
        : await db.prepare(`SELECT t.* FROM tickets t WHERE t.client=? AND t.status IN ('closed','cancelled') AND t.closed_at>=? UNION SELECT t.* FROM tickets t JOIN events e ON e.client=t.client AND e.ticket=t.id WHERE t.client=? AND e.type IN ('report','close','cancel') AND e.at>=? LIMIT 500`).bind(client, new Date(ch).toISOString(), client, new Date(ch).toISOString()).all();
      const withR = url.searchParams.get('reports') === '1';
      // work segments, so the platform can credit each person for their own time
      let segs = {};
      if(withR && r.results.length){
        const ids = r.results.map(x=>x.id);
        const s = await byIds(db, `SELECT * FROM events WHERE client=? AND type='segment' AND ticket IN `, [client], ids);
        s.forEach(e=>{ (segs[e.ticket] = segs[e.ticket]||[]).push({by:e.by||'', mins:e.mins||0, role:['primary','support'].includes(e.text) ? e.text : ''}); });
      }
      return json({now:nowIso, tickets:r.results.map(x=>{ const o = withR ? withReport(x) : row(x); if(withR) o.segments = segs[x.id]||[]; return o; })}, 200, h);
    }
    // everything the server holds about the tickets raised between two times, with every event, 200 tickets at a time: for a backup and for checking the portal against the server
    if(url.pathname === '/api/export' && req.method === 'GET'){
      if(!who.key && who.role !== 'admin') return deny();
      const fromT = Date.parse(url.searchParams.get('from')||''), toT = Date.parse(url.searchParams.get('to')||'');
      const f = new Date(isNaN(fromT) ? now - 30*86400000 : fromT).toISOString(), tt = new Date(isNaN(toT) ? now + 86400000 : toT).toISOString(), off = Math.max(0, Number(url.searchParams.get('offset')) || 0);
      const total = (await db.prepare(`SELECT COUNT(*) n FROM tickets WHERE client=? AND down_at>=? AND down_at<?`).bind(client, f, tt).first()).n;
      const r = await db.prepare(`SELECT * FROM tickets WHERE client=? AND down_at>=? AND down_at<? ORDER BY down_at, id LIMIT 200 OFFSET ?`).bind(client, f, tt, off).all();
      const ev = r.results.length ? await byIds(db, `SELECT * FROM events WHERE client=? AND ticket IN `, [client], r.results.map(x=>x.id)) : [], by = {};
      ev.forEach(e=>{ (by[e.ticket] = by[e.ticket]||[]).push(evRow(e)); });
      Object.values(by).forEach(l=>l.sort((a,b)=>a.at<b.at?-1:a.at>b.at?1:0));
      return json({now:nowIso, from:f, to:tt, offset:off, total, tickets:r.results.map(x=>Object.assign(withReport(x), {events:by[x.id]||[]}))}, 200, h);
    }
    // jobs a maintenance person worked on (started, picked up, resumed or closed) that closed in the last 30 days, with their own work minutes
    if(url.pathname === '/api/mywork' && req.method === 'GET'){
      if(!can('work')) return deny();
      const since = new Date(now - 30*86400000).toISOString(), all = who.key || who.shared || url.searchParams.get('team') === '1', me = who.name;
      const r = all
        ? await db.prepare(`SELECT * FROM tickets WHERE client=? AND status='closed' AND closed_at>=? ORDER BY closed_at DESC LIMIT 400`).bind(client, since).all()
        : await db.prepare(`SELECT t.* FROM tickets t WHERE t.client=? AND t.status='closed' AND t.closed_at>=? AND (t.closed_by=? OR t.started_by=? OR EXISTS (SELECT 1 FROM events e WHERE e.client=t.client AND e.ticket=t.id AND e.by=? AND e.type IN ('start','pickup','resume','segment'))) ORDER BY t.closed_at DESC LIMIT 400`).bind(client, since, me, me, me).all();
      const ids = r.results.map(x=>x.id), segs = {};
      if(ids.length){
        const sq = await byIds(db, `SELECT ticket, by, SUM(mins) AS m, MAX(CASE WHEN text IN ('primary','support') THEN text ELSE '' END) AS r FROM events WHERE client=? AND type='segment' AND ticket IN `, [client], ids, ` GROUP BY ticket, by`);
        sq.forEach(e=>{ (segs[e.ticket] = segs[e.ticket]||[]).push({by:e.by||'', mins:e.m||0, role:e.r||''}); });
      }
      const mw = r.results.map(x=>{ let rd = null; try{ rd = x.report_data ? JSON.parse(x.report_data) : null; }catch(e){}
        return {...row(x), done:(rd && (rd.ca || rd.done)) || x.close_note || '', segments:segs[x.id]||[]}; });
      return json({now:nowIso, all:!!all, tickets:await addFollow(db, client, mw)}, 200, h);
    }
    // one ticket in full: details, report contents, every event, work minutes per person
    if(url.pathname === '/api/ticket' && req.method === 'GET'){
      if(!can('read')) return deny();
      const t = await get(url.searchParams.get('id')); if(!t) return notFound();
      if(!who.key && who.role === 'report' && t.raised_user !== who.username) return deny();
      const e = await db.prepare(`SELECT * FROM events WHERE client=? AND ticket=? ORDER BY at`).bind(client, t.id).all(), segs = {}, role = {};
      e.results.filter(x=>x.type==='segment').forEach(x=>{ segs[x.by||''] = (segs[x.by||''] || 0) + (x.mins||0); });
      e.results.filter(x=>x.type==='join').forEach(x=>{ role[x.by||''] = x.spare === 'support' ? 'support' : 'primary'; });
      e.results.filter(x=>['start','pickup'].includes(x.type)).forEach(x=>{ if(!role[x.by||'']) role[x.by||''] = 'started'; });
      if(t.started_by) role[t.started_by] = role[t.started_by] === 'support' ? 'support' : (role[t.started_by] || 'started');
      if(t.status === 'working' && t.seg_start && t.started_by) segs[t.started_by] = (segs[t.started_by]||0) + mins(t.seg_start, nowIso);
      crewOf(t).forEach(c=>{ if(c.seg && !c.left) segs[c.name] = (segs[c.name]||0) + mins(c.seg, nowIso); if(!(c.name in segs)) segs[c.name] = segs[c.name]||0; });
      const tk = await db.prepare(`SELECT * FROM tickets WHERE client=? AND parent_id=? ORDER BY down_at`).bind(client, t.id).all();
      const evs = await threadEvents(t.id, e.results.filter(x=>x.type!=='segment').map(evRow), tk.results);
      return json({now:nowIso, tasks:tk.results.map(row), ticket:withReport(t), events:evs, people:Object.keys(segs).filter(k=>k).map(k=>({by:k, mins:segs[k], role:role[k]||'primary'}))}, 200, h);
    }
    // the day report: every job a person (or the whole team) worked on between two times, with their own work minutes in that window
    if(url.pathname === '/api/dayreport' && req.method === 'GET'){
      if(!can('work')) return deny();
      const from = Date.parse(url.searchParams.get('from')||''), to = Date.parse(url.searchParams.get('to')||'');
      if(isNaN(from) || isNaN(to) || to <= from || to - from > 48*3600000 || from < now - 40*86400000) return json({error:'Pick a date in the last 40 days'}, 400, h);
      // a personal login makes its own report; a shared phone, Supervisor or Admin can pick the person
      const pick = who.key || who.shared || who.role === 'supervisor' || who.role === 'admin';
      const team = url.searchParams.get('team') === '1', person = team ? '' : (pick ? (clean(url.searchParams.get('who'), 60) || who.name) : who.name);
      if(!team && !person) return json({error:'Pick whose report to make'}, 400, h);
      const fi = new Date(from).toISOString(), ti = new Date(to).toISOString(), endT = Math.min(to, now);
      // work segments end at their event time; one that started in the window may end up to two days later
      const ev = (await db.prepare(`SELECT * FROM events WHERE client=? AND at>=? AND at<? ORDER BY at`).bind(client, fi, new Date(to + 2*86400000).toISOString()).all()).results;
      const running = (await db.prepare(`SELECT id, started_by, seg_start, crew FROM tickets WHERE client=? AND status='working' AND seg_start<?`).bind(client, ti).all()).results;
      const work = {}, acts = {}, add = (o, k, t) => { (o[k] = o[k]||{}); (o[k][t] = o[k][t]||[]); return o[k][t]; };
      const overlap = (a, b) => Math.max(0, Math.round((Math.min(b, endT) - Math.max(a, from))/60000));
      ev.forEach(e=>{
        const at = Date.parse(e.at), by = e.by||'';
        if(e.type === 'segment'){ const m = overlap(at - (e.mins||0)*60000, at); if(m > 0) add(work, by, e.ticket).push(m); }
        else if(at < to && ['start','pickup','resume','transfer','pause','update','close','cancel','report','join','leave','lead','running','stopped'].includes(e.type)) add(acts, by, e.ticket).push(evRow(e));
      });
      running.forEach(t=>{ const m = overlap(Date.parse(t.seg_start), now); if(m > 0) add(work, t.started_by||'', t.id).push(m);
        crewOf(t).forEach(c=>{ if(c.seg && !c.left){ const n = overlap(Date.parse(c.seg), now); if(n > 0) add(work, c.name, t.id).push(n); } }); });
      const people = new Set([...Object.keys(work), ...Object.keys(acts)]);
      const wanted = [...people].filter(p => p && (team || p === person)), ids = new Set();
      wanted.forEach(p=>{ Object.keys(work[p]||{}).forEach(i=>ids.add(i)); Object.keys(acts[p]||{}).forEach(i=>ids.add(i)); });
      const T = {}; (await byIds(db, `SELECT * FROM tickets WHERE client=? AND id IN `, [client], [...ids])).forEach(t=>{ T[t.id] = t; });
      const allEv = {}; (await byIds(db, `SELECT ticket, at, type, by, text, spare FROM events WHERE client=? AND type IN ('start','pickup','resume','transfer','pause','close','cancel','restore','join') AND ticket IN `, [client], [...ids])).forEach(e=>{ (allEv[e.ticket] = allEv[e.ticket]||[]).push(e); });
      // where the ticket stood at the end of the window
      const standing = t => { const L = []; (allEv[t.id]||[]).filter(e=>Date.parse(e.at) < to).sort((a,b)=>a.at<b.at?-1:a.at>b.at?1:0).forEach(e=>{ if(e.type==='restore'){ if(L.length && L[L.length-1].type==='cancel') L.pop(); } else L.push(e); }); const last = L[L.length-1];   // a restore undoes the cancel before it
        if(!last) return {s:'open'}; if(last.type==='close') return {s:'closed', at:last.at, by:last.by}; if(last.type==='cancel') return {s:'cancelled', at:last.at};
        if(last.type==='pause') return {s:'waiting', why:last.spare||t.wait_reason||''}; if(last.type==='transfer') return {s:'transferred', why:last.text||'', to:last.spare||''}; return {s:'working'}; };
      // each person's part in each job: started it, joined as primary, or joined as support (jobs from before joining existed count as primary)
      const roleIn = (p, t) => { const E = allEv[t.id]||[], j = E.filter(e=>e.type==='join' && e.by===p).pop();
        if(E.some(e=>['start','pickup'].includes(e.type) && e.by===p) || (!j && t.started_by===p)) return 'started'; return j ? (j.spare==='support' ? 'support' : 'primary') : 'primary'; };
      const out = wanted.sort().map(p=>{
        const jobs = Object.keys(Object.assign({}, work[p]||{}, acts[p]||{})).filter(i=>T[i]).map(i=>{ const t = T[i], st = standing(t), A = (acts[p]||{})[i]||[]; let rd = null; try{ rd = t.report_data ? JSON.parse(t.report_data) : null; }catch(e){}
          return {id:t.id, ref:t.ref||'', role:roleIn(p, t), kind:t.kind, machine:t.machine, location:t.location||'', workType:t.work_type||'', problem:t.problem, downAt:t.down_at, mins:((work[p]||{})[i]||[]).reduce((a,b)=>a+b,0),
            did:A.map(a=>({type:a.type, at:a.at, text:a.text, spare:a.spare})), done:(st.s==='closed' && ((rd && (rd.ca||rd.done)) || t.close_note)) || '', status:st.s, statusAt:st.at||'', statusBy:st.by||'', why:st.why||'', to:st.to||'', downtime:t.downtime_min, parentRef:t.parent_ref||'', taskExp:t.task_exp||''}; })
          .sort((a,b)=>a.downAt<b.downAt?-1:1);
        return {name:p, jobs, mins:jobs.reduce((a,j)=>a+j.mins,0), primaryMins:jobs.filter(j=>j.role!=='support').reduce((a,j)=>a+j.mins,0), supportMins:jobs.filter(j=>j.role==='support').reduce((a,j)=>a+j.mins,0), closed:jobs.filter(j=>j.status==='closed' && j.statusBy===p).length};
      }).filter(x=>x.jobs.length);
      return json({now:nowIso, from:fi, to:ti, team, person, people:out}, 200, h);
    }
    // an admin corrects an honest mistake: times, work / waiting minutes, problem text, names. Open tickets, or closed in the last 7 days.
    // Response, repair and downtime are worked out again; the change and its reason go into the ticket's history.
    if(url.pathname === '/api/edit' && req.method === 'POST'){
      if(!who.key && who.role !== 'admin') return deny();
      const t = await get(body.id); if(!t) return notFound();
      const active = isActive(t);
      if(t.status === 'cancelled') return json({error:'A cancelled ticket cannot be edited'}, 400, h);
      if(!active && Date.parse(t.closed_at||0) < now - 7*86400000) return json({error:'Only tickets closed in the last 7 days can be edited'}, 400, h);
      const reason = clean(body.reason, 300); if(!reason) return json({error:'Write the reason for the change'}, 400, h);
      const tm = (v, cur) => { if(v === undefined || v === null || v === '') return cur; const x = Date.parse(v); return isNaN(x) ? 'bad' : new Date(x).toISOString(); };
      let down = tm(body.downAt, t.down_at), start = tm(body.startedAt, t.started_at), close = active ? null : tm(body.closedAt, t.closed_at);
      if([down, start, close].includes('bad')) return json({error:'One of the times is not valid'}, 400, h);
      // when a time is corrected, every time is kept to the whole minute, so the minutes come out exactly as typed
      const fl = iso => iso ? new Date(Math.floor(Date.parse(iso)/60000)*60000).toISOString() : iso;
      const anyTime = [body.downAt, body.startedAt, body.closedAt].some(v => v !== undefined && v !== null && v !== '');
      if(anyTime){ down = fl(down); start = fl(start); close = fl(close); }
      if(false) return json({error:'One of the times is not valid'}, 400, h);
      if(Date.parse(down) > now + 60000 || (start && Date.parse(start) > now + 60000) || (close && Date.parse(close) > now + 60000)) return json({error:'A time cannot be in the future'}, 400, h);
      if(start && Date.parse(start) < Date.parse(down)) return json({error:'Work cannot start before the complaint was reported'}, 400, h);
      if(close && Date.parse(close) < Date.parse(start || down)) return json({error:'The closing time cannot be before the work started'}, 400, h);
      const num = (v, cur) => v === undefined || v === null || v === '' ? cur : Math.max(0, Math.min(100000, Math.round(Number(v)||0)));
      const act = num(body.activeMin, t.active_min||0), wait = num(body.waitMin, t.wait_min||0);
      const problem = body.problem === undefined ? t.problem : clean(body.problem, 500); if(!problem) return json({error:'The problem cannot be empty'}, 400, h);
      const sBy = body.startedBy === undefined ? t.started_by : clean(body.startedBy, 60), cBy = active || body.closedBy === undefined ? t.closed_by : clean(body.closedBy, 60);
      const periods = (t.down_acc||0) > 0 || !!t.running_at;   // machine ran again in between: downtime is the stopped periods, kept as recorded
      const response = t.self_started || !start ? null : mins(down, start), repair = start && close ? (t.running_at ? mins(start, t.running_at) : mins(start, close)) : t.repair_min;
      const downtime = close ? (t.kind === 'stopped' ? (periods ? null : mins(down, close)) : act) : null;
      // what changed, in words, for the history
      const hm = iso => iso ? '@'+new Date(iso).toISOString().slice(0,16)+'Z' : '-', ch = [];   // @time is shown in each phone's own local time
      if(hm(down) !== hm(t.down_at)) ch.push('reported '+hm(t.down_at)+' > '+hm(down));
      if(hm(start) !== hm(t.started_at)) ch.push('started '+hm(t.started_at)+' > '+hm(start));
      if(close && hm(close) !== hm(t.closed_at)) ch.push('closed '+hm(t.closed_at)+' > '+hm(close));
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
      const last = {}; if(ids.length) (await byIds(db, `SELECT ticket, at, by, text, spare FROM events WHERE client=? AND type='edit' AND ticket IN `, [client], ids)).forEach(e=>{ if(!last[e.ticket] || e.at > last[e.ticket].at) last[e.ticket] = {at:e.at, by:e.by||'', reason:e.text||'', changes:e.spare||''}; });
      return json({now:nowIso, tickets:r.results.map(x=>{ const o = withReport(x); o.segments = segs[x.id]||[]; o.lastEdit = last[x.id]||null; return o; })}, 200, h);
    }
    if(url.pathname === '/api/events' && req.method === 'GET'){
      if(!can('read')) return deny();
      const e = await db.prepare(`SELECT * FROM events WHERE client=? AND ticket=? ORDER BY at`).bind(client, clean(url.searchParams.get('id'), 40)).all();
      const tid = clean(url.searchParams.get('id'), 40), tk = await db.prepare(`SELECT id, ref FROM tickets WHERE client=? AND parent_id=? ORDER BY down_at`).bind(client, tid).all();
      return json({events:await threadEvents(tid, e.results.map(evRow), tk.results)}, 200, h);
    }

    // ---------- company settings (sent by the platform, read by phones and the board)
    if(url.pathname === '/api/config' && req.method === 'GET'){
      if(!can('config')) return deny();
      const cf = await db.prepare(`SELECT body, fp, at FROM config WHERE client=?`).bind(client).first();
      if(!cf) return json({config:null}, 200, h);
      if(url.searchParams.get('fp') && url.searchParams.get('fp') === cf.fp) return json({same:true, fp:cf.fp}, 200, h);
      return json({fp:cf.fp, at:cf.at, config:JSON.parse(cf.body)}, 200, h);
    }
    if(url.pathname === '/api/config' && req.method === 'POST'){
      // Only the platform that first sent the settings can change them (it keeps a private token). Reset by deleting the row in the database console.
      if(!who.key) return deny();
      const tok = clean(req.headers.get('X-Config-Token'), 200), cfg = body.config, fp = clean(body.fp, 80);
      if(!tok || tok.length < 20) return json({error:'Missing settings token'}, 400, h);
      if(!cfg || typeof cfg !== 'object' || !Array.isArray((cfg.ref||{}).machines)) return json({error:'The settings are not valid'}, 400, h);
      const text = JSON.stringify(cfg); if(text.length > 400000) return json({error:'The settings are too large (logo too big?)'}, 400, h);
      const th = await sha(tok), ex = await db.prepare(`SELECT token FROM config WHERE client=?`).bind(client).first();
      if(ex && ex.token && ex.token !== th) return json({error:'Another platform already manages these settings'}, 403, h);
      await db.prepare(`INSERT INTO config (client, body, fp, at, token) VALUES (?,?,?,?,?) ON CONFLICT(client) DO UPDATE SET body=excluded.body, fp=excluded.fp, at=excluded.at, token=excluded.token`).bind(client, text, fp, nowIso, th).run();
      return json({ok:true, at:nowIso}, 200, h);
    }

    // ---------- raising
    if(url.pathname === '/api/down' && req.method === 'POST'){
      if(!can('raise')) return deny();
      const kind = ['support','general'].includes(body.kind) ? body.kind : 'stopped';
      const role = who.key ? (body.role === 'maint' ? 'maint' : 'floor') : (who.role === 'report' ? 'floor' : 'maint');
      // a personal login reports under its own name; the shop-floor role (Operator, Setter...) comes from the login or from the phone
      const by = (who.key || who.shared) ? clean(body.by, 60) : clean(who.name + ' (' + (role === 'maint' ? 'Maintenance' : (who.title || clean(body.byRole, 30) || 'Shop floor')) + ')', 60);
      const machine = kind === 'general' ? '' : clean(body.machine, 40), problem = clean(body.problem, 500);
      const location = clean(body.location, 80), workType = clean(body.workType, 60), urgent = body.urgent ? 1 : 0;
      const startNow = !!body.startNow && role === 'maint', starter = actor(body.startBy || body.by);
      if(kind !== 'general' && !machine) return json({error:'Pick a machine'}, 400, h);
      if(kind === 'general' && !location) return json({error:'Pick where the work is'}, 400, h);
      if(!by) return json({error:'Enter your name'}, 400, h);
      if(!problem) return json({error:'Write what is needed'}, 400, h);
      // a machine already reported keeps its ticket (checked before a number is used, so numbers have no gaps)
      if(kind !== 'general'){ const ex0 = await db.prepare(`SELECT * FROM tickets WHERE client=? AND machine=? AND status IN ${ACTIVE} AND kind<>'general'`).bind(client, machine).first(); if(ex0) return json({exists:true, ticket:row(ex0)}, 200, h); }
      const id = newId(), ref = await nextRef(db, client, kind, await prefixes(db, client));
      try{
        await db.prepare(`INSERT INTO tickets (id, client, machine, cell, category, down_at, reported_by, problem, kind, location, work_type, urgent, raised_role, status, started_at, started_by, seg_start, response_min, self_started, raised_user, ref) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id, client, machine, clean(body.cell, 40), clean(body.category, 80), nowIso, by, problem, kind, location, workType, urgent, role,
            startNow ? 'working' : 'open', startNow ? nowIso : null, startNow ? starter : null, startNow ? nowIso : null, null, startNow ? 1 : 0, who.username || '', ref).run();
      }catch(e){
        const ex = machine ? await db.prepare(`SELECT * FROM tickets WHERE client=? AND machine=? AND status IN ${ACTIVE} AND kind<>'general'`).bind(client, machine).first() : null;
        if(ex) return json({exists:true, ticket:row(ex)}, 200, h);
        return json({error:'could not save'}, 500, h);
      }
      await ev(id, 'down', by, problem);
      if(startNow) await ev(id, 'start', starter, 'raised and started by maintenance');
      const t = await get(id);
      if(!startNow && (kind !== 'general' || urgent)) later(pushTo(db, client, {title:(urgent && kind==='general' ? 'URGENT ' : '')+KIND[kind]+place(t), body:problem+' (reported by '+by+')', tag:id}));
      return json({ok:true, ticket:row(t)}, 200, h);
    }

    // ---------- working on a ticket
    if(url.pathname === '/api/start' && req.method === 'POST'){
      if(!can('work')) return deny();
      const t = await get(body.id); if(!t) return notFound();
      if(t.status === 'working') return json({ok:true, already:true, ticket:row(t)}, 200, h);
      if(t.status === 'waiting') return json({error:'This ticket is waiting. Use Resume work.'}, 400, h);
      if(t.status !== 'open') return json({error:'This ticket is already ' + t.status}, 400, h);
      const by = actor(body.by); if(!by) return json({error:'Pick who is working on it'}, 400, h);
      const p = pickTime(body.ts, now, t.handover_since || t.down_at, 'Start time'); if(p.error) return json({error:p.error}, 400, h);
      if(t.started_at){ // picking up a transferred ticket: the first start and the response time stay as they were
        await db.prepare(`UPDATE tickets SET status='working', started_by=?, seg_start=?, handover_wait_min=handover_wait_min+?, handover_since=NULL WHERE id=?`).bind(by, p.iso, t.handover_since ? mins(t.handover_since, p.iso) : 0, t.id).run();
        await ev(t.id, 'pickup', by, '');
      } else {
        await db.prepare(`UPDATE tickets SET status='working', started_at=?, started_by=?, seg_start=?, response_min=? WHERE id=?`).bind(p.iso, by, p.iso, mins(t.down_at, p.iso), t.id).run();
        await ev(t.id, 'start', by, '');
      }
      return json({ok:true, ticket:row(await get(t.id))}, 200, h);
    }
    if(url.pathname === '/api/transfer' && req.method === 'POST'){
      if(!can('work')) return deny();
      const t = await get(body.id); if(!t) return notFound();
      if(t.status !== 'working') return json({error:t.status === 'open' ? 'Work has not started on this ticket' : 'Only a ticket being worked on can be transferred'}, 400, h);
      const by = actor(body.by), note = clean(body.note, 500), to = clean(body.to, 60);
      if(!by) return json({error:'Select your name'}, 400, h);
      if(!note) return json({error:'Write what was done and what is left'}, 400, h);
      const seg = await endSeg(t, nowIso);
      { const C = crewOf(t); if(crewActive(C).length){ await crewStop(t, C, nowIso); crewActive(C).forEach(c=>{ c.left = nowIso; c.leftWhy = 'job transferred'; }); await crewSave(t.id, C); } }
      await db.prepare(`UPDATE tickets SET status='open', handover_since=?, transfers=transfers+1, transfer_to=?, active_min=active_min+?, seg_start=NULL WHERE id=?`).bind(nowIso, to, seg, t.id).run();
      await ev(t.id, 'transfer', by, note, '', to);
      later(pushTo(db, client, {title:'Transferred: '+place(t), body:note+' ('+by+(to?' to '+to:'')+')', tag:t.id}));
      return json({ok:true, ticket:row(await get(t.id))}, 200, h);
    }
    if(url.pathname === '/api/pause' && req.method === 'POST'){
      if(!can('work')) return deny();
      const t = await get(body.id); if(!t) return notFound();
      if(t.status !== 'working') return json({error:'Only a ticket being worked on can be paused'}, 400, h);
      const by = actor(body.by), reason = clean(body.reason, 60), note = clean(body.note, 400), assign = clean(body.assign, 60);
      const eta = etaOf(body.eta); if(eta.error) return json({error:eta.error}, 400, h);
      if(!by) return json({error:'Select your name'}, 400, h);
      if(!reason) return json({error:'Pick why the work is waiting'}, 400, h);
      const seg = await endSeg(t, nowIso);
      { const C = crewOf(t); if(C.length) await crewSave(t.id, await crewStop(t, C, nowIso)); }
      await db.prepare(`UPDATE tickets SET status='waiting', wait_since=?, wait_reason=?, paused_by=?, assigned_to=?, eta=COALESCE(NULLIF(?,''), eta), wait_spare=?, active_min=active_min+?, seg_start=NULL WHERE id=?`)
        .bind(nowIso, reason, by, assign, eta.iso, /spare/i.test(reason) ? 1 : 0, seg, t.id).run();
      await ev(t.id, 'pause', by, note, eta.iso, reason);
      return json({ok:true, ticket:row(await get(t.id))}, 200, h);
    }
    if(url.pathname === '/api/resume' && req.method === 'POST'){
      if(!can('work')) return deny();
      const t = await get(body.id); if(!t) return notFound();
      if(t.status !== 'waiting') return json({error:'This ticket is not waiting'}, 400, h);
      const by = actor(body.by); if(!by) return json({error:'Select who is resuming the work'}, 400, h);
      const p = pickTime(body.ts, now, t.wait_since, 'Resume time'); if(p.error) return json({error:p.error}, 400, h);
      const w = t.wait_since ? mins(t.wait_since, p.iso) : 0, vend = VENDOR.test(t.wait_reason||'') ? w : 0;
      const C = crewOf(t), inCrew = crewActive(C).some(c=>c.name === by), lead = (by === t.started_by || inCrew) && t.started_by ? t.started_by : by;
      crewActive(C).forEach(c=>{ if(c.name !== lead) c.seg = p.iso; });
      if(C.length) await crewSave(t.id, C);
      await db.prepare(`UPDATE tickets SET status='working', started_by=?, seg_start=?, wait_min=wait_min+?, vendor_min=vendor_min+?, wait_since=NULL, wait_spare=0 WHERE id=?`).bind(lead, p.iso, w, vend, t.id).run();
      await ev(t.id, 'resume', by, clean(body.note, 300), '', '', w);
      if(t.paused_by && t.paused_by !== by) later(pushTo(db, client, {title:'Resumed: '+place(t), body:by+' resumed the work you paused ('+(t.wait_reason||'waiting')+')', tag:t.id}, t.paused_by));
      return json({ok:true, ticket:row(await get(t.id))}, 200, h);
    }
    if(url.pathname === '/api/update' && req.method === 'POST'){
      if(!can('work')) return deny();
      const t = await get(body.id); if(!t) return notFound();
      if(!isActive(t)) return json({error:'This ticket is already ' + t.status}, 400, h);
      const by = actor(body.by), text = clean(body.text, 400), spare = clean(body.spare, 300);
      const eta = etaOf(body.eta); if(eta.error) return json({error:eta.error}, 400, h);
      if(!by) return json({error:'Select your name'}, 400, h);
      if(!text) return json({error:'Write the update'}, 400, h);
      const n = (await db.prepare(`SELECT COUNT(*) AS n FROM events WHERE client=? AND ticket=? AND type='update'`).bind(client, t.id).first()).n || 0;
      if(n >= 60) return json({error:'Too many updates on this ticket'}, 400, h);
      await db.prepare(`UPDATE tickets SET eta=COALESCE(NULLIF(?,''), eta), wait_spare=? WHERE id=?`).bind(eta.iso, spare ? 1 : (t.status==='waiting' && /spare/i.test(t.wait_reason||'') ? 1 : 0), t.id).run();
      await ev(t.id, 'update', by, text, eta.iso, spare);
      return json({ok:true, ticket:row(await get(t.id))}, 200, h);
    }
    if(url.pathname === '/api/cancel' && req.method === 'POST'){
      const t = await get(body.id); if(!t) return notFound();
      // maintenance can cancel any ticket; the shop floor only one it raised itself and nobody has started
      if(!can('work') && !(can('raise') && who.username && t.raised_user === who.username && t.status === 'open')) return deny();
      if(!isActive(t)) return json({error:'This ticket is already ' + t.status}, 400, h);
      const by = actor(body.by), why = clean(body.reason, 300);
      if(!by) return json({error:'Enter your name'}, 400, h);
      if(!why) return json({error:'Give a reason for cancelling'}, 400, h);
      { const C = crewOf(t); if(C.length) await crewSave(t.id, await crewStop(t, C, nowIso)); }
      await db.prepare(`UPDATE tickets SET status='cancelled', closed_at=?, closed_by=?, close_kind='cancelled', close_note=?, seg_start=NULL WHERE id=?`).bind(nowIso, by, why, t.id).run();
      await ev(t.id, 'cancel', by, why);
      return json({ok:true}, 200, h);
    }
    // admin (or the platform) undoes a cancellation made by mistake: the ticket goes back to where it was, as if it had never been cancelled
    if(url.pathname === '/api/restore' && req.method === 'POST'){
      if(!who.key && who.role !== 'admin') return deny();
      const t = await get(body.id); if(!t) return notFound();
      if(t.status !== 'cancelled') return json({error:'Only a cancelled ticket can be restored'}, 400, h);
      if(Date.parse(t.closed_at||0) < now - 7*86400000) return json({error:'Only tickets cancelled in the last 7 days can be restored'}, 400, h);
      const reason = clean(body.reason, 300); if(!reason) return json({error:'Write the reason for restoring'}, 400, h);
      if(t.kind !== 'general' && t.machine){
        const ex = await db.prepare(`SELECT ref, id FROM tickets WHERE client=? AND machine=? AND status IN ${ACTIVE} AND kind<>'general' AND id<>?`).bind(client, t.machine, t.id).first();
        if(ex) return json({error:t.machine+' already has an open ticket'+(ex.ref?' ('+ex.ref+')':'')+'. Close or cancel that one first, or keep this one cancelled.'}, 409, h);
      }
      // where it was: the last step before the cancellation
      const last = await db.prepare(`SELECT type, at FROM events WHERE client=? AND ticket=? AND type IN ('start','pickup','resume','pause','transfer') AND at<=? ORDER BY at DESC LIMIT 1`).bind(client, t.id, t.closed_at).first();
      const st = !last ? 'open' : ['start','pickup','resume'].includes(last.type) ? 'working' : last.type === 'pause' ? 'waiting' : 'open';
      await db.prepare(`UPDATE tickets SET status=?, closed_at=NULL, closed_by=NULL, close_kind=NULL, close_note=NULL, seg_start=? WHERE id=?`).bind(st, st === 'working' ? last.at : null, t.id).run();
      await ev(t.id, 'restore', who.key ? 'Platform' : who.name, reason, '', 'cancelled by '+(t.closed_by||'-')+(t.close_note?': '+t.close_note:''));
      return json({ok:true, status:st, ticket:row(await get(t.id))}, 200, h);
    }
    // ---------- joining a job: as primary (shares the work, can close) or as support; leaving with a reason
    if(url.pathname === '/api/join' && req.method === 'POST'){
      if(!can('work')) return deny();
      const t = await get(body.id); if(!t) return notFound();
      if(!['working','waiting'].includes(t.status) || !t.started_by) return json({error:'You can join once work has started. Use Start work instead.'}, 400, h);
      const by = actor(body.by), name = clean(body.name, 60) || by, role = body.role === 'support' ? 'support' : 'primary';
      if(!by || !name) return json({error:'Select your name'}, 400, h);
      if(name !== by && by !== t.started_by && !who.key && !['supervisor','admin'].includes(who.role)) return json({error:'Only '+t.started_by+' (running the job) can add someone else'}, 403, h);
      if(name === t.started_by) return json({error:name+' is already running this job'}, 400, h);
      const C = crewOf(t), ex = C.find(c=>c.name === name);
      if(ex && !ex.left) return json({error:name+' has already joined this job'}, 400, h);
      if(crewActive(C).length >= 12) return json({error:'Too many people on this job'}, 400, h);
      const seg = t.status === 'working' ? nowIso : null;
      if(ex){ ex.role = role; ex.left = null; ex.leftWhy = ''; ex.seg = seg; ex.joinedAt = nowIso; }
      else C.push({name, role, joinedAt:nowIso, seg, mins:0});
      await crewSave(t.id, C);
      await ev(t.id, 'join', name, name !== by ? 'added by '+by : '', '', role);
      if(t.started_by !== by) later(pushTo(db, client, {title:'Joined: '+place(t), body:name+' joined your job as '+role+(name !== by ? ' (added by '+by+')' : ''), tag:t.id}, t.started_by));
      return json({ok:true, ticket:row(await get(t.id))}, 200, h);
    }
    if(url.pathname === '/api/leave' && req.method === 'POST'){
      if(!can('work')) return deny();
      const t = await get(body.id); if(!t) return notFound();
      if(!['working','waiting'].includes(t.status)) return json({error:'This ticket is not being worked on'}, 400, h);
      const by = actor(body.by), name = clean(body.name, 60) || by, why = clean(body.reason, 300);
      if(!by) return json({error:'Select your name'}, 400, h);
      if(!why) return json({error:'Write why you are leaving'}, 400, h);
      if(name !== by && !who.key && !['supervisor','admin'].includes(who.role) && by !== t.started_by) return json({error:'You can only leave for yourself'}, 403, h);
      const C = crewOf(t);
      if(name === t.started_by){
        // the person running the job leaves: the first primary still on it takes over; with only support left, use Transfer
        const next = crewActive(C).find(c=>c.role === 'primary');
        if(!next) return json({error:'Someone must take over first. Ask a colleague to join as primary, or use Transfer.'}, 400, h);
        const seg = await endSeg(t, nowIso);
        if(next.seg){ const m = mins(next.seg, nowIso); await ev(t.id, 'segment', next.name, 'primary', '', '', m); next.mins = (next.mins||0) + m; next.seg = null; }
        const i = C.indexOf(next); C.splice(i, 1);
        C.push({name, role:'primary', joinedAt:t.started_at, seg:null, mins:seg, left:nowIso, leftWhy:why, wasMain:true});
        await crewSave(t.id, C);
        await db.prepare(`UPDATE tickets SET started_by=?, seg_start=?, active_min=active_min+? WHERE id=?`).bind(next.name, t.status === 'working' ? nowIso : null, seg, t.id).run();
        await ev(t.id, 'leave', name, why, '', 'main');
        await ev(t.id, 'lead', next.name, 'took over from '+name);
        later(pushTo(db, client, {title:'You are running '+place(t)+' now', body:name+' left the job: '+why, tag:t.id}, next.name));
        return json({ok:true, ticket:row(await get(t.id))}, 200, h);
      }
      const c = crewActive(C).find(x=>x.name === name); if(!c) return json({error:name+' is not on this job'}, 400, h);
      if(c.seg){ const m = mins(c.seg, nowIso); await ev(t.id, 'segment', c.name, c.role, '', '', m); c.mins = (c.mins||0) + m; c.seg = null; }
      c.left = nowIso; c.leftWhy = why;
      await crewSave(t.id, C);
      await ev(t.id, 'leave', name, why, '', c.role);
      later(pushTo(db, client, {title:'Left: '+place(t), body:name+' ('+c.role+') left the job: '+why, tag:t.id}, t.started_by));
      return json({ok:true, ticket:row(await get(t.id))}, 200, h);
    }
    // ---------- machine running again while the ticket stays open (waiting for a vendor, a spare, support...); stopped again restarts the downtime
    if(url.pathname === '/api/running' && req.method === 'POST'){
      if(!can('work')) return deny();
      const t = await get(body.id); if(!t) return notFound();
      if(t.kind !== 'stopped') return json({error:'Only a stopped machine can be marked running'}, 400, h);
      if(!['working','waiting'].includes(t.status)) return json({error:'Start work first. Then mark the machine running again.'}, 400, h);
      if(t.running_at) return json({error:'The machine is already marked running'}, 400, h);
      const by = actor(body.by); if(!by) return json({error:'Select your name'}, 400, h);
      const from = [t.started_at, t.stop_at || t.down_at].filter(Boolean).sort().pop();
      const p = pickTime(sameMinute(body.ts, from), now, from, 'Running time'); if(p.error) return json({error:p.error}, 400, h);
      const add = mins(t.stop_at || t.down_at, p.iso);
      await db.prepare(`UPDATE tickets SET running_at=?, down_acc=down_acc+? WHERE id=?`).bind(p.iso, add, t.id).run();
      await ev(t.id, 'running', by, clean(body.note, 300), p.iso);
      return json({ok:true, ticket:row(await get(t.id))}, 200, h);
    }
    if(url.pathname === '/api/stopped' && req.method === 'POST'){
      if(!can('work')) return deny();
      const t = await get(body.id); if(!t) return notFound();
      if(!isActive(t) || !t.running_at) return json({error:'The machine is not marked running'}, 400, h);
      const by = actor(body.by); if(!by) return json({error:'Select your name'}, 400, h);
      const p = pickTime(sameMinute(body.ts, t.running_at), now, t.running_at, 'Stop time'); if(p.error) return json({error:p.error}, 400, h);
      await db.prepare(`UPDATE tickets SET running_at=NULL, stop_at=? WHERE id=?`).bind(p.iso, t.id).run();
      await ev(t.id, 'stopped', by, clean(body.note, 300), p.iso);
      later(pushTo(db, client, {title:'Stopped again: '+place(t), body:t.problem+' ('+by+')', tag:t.id}));
      return json({ok:true, ticket:row(await get(t.id))}, 200, h);
    }
    if(url.pathname === '/api/close' && req.method === 'POST'){
      if(!can('work')) return deny();
      const t = await get(body.id); if(!t) return notFound();
      if(!isActive(t)) return json({ok:true, already:true, ticket:row(t)}, 200, h);
      const by = actor(body.by), kind = body.kind === 'no_report' ? 'no_report' : (body.kind === 'done' ? 'done' : 'report'), note = clean(body.note, 500);
      if(!by) return json({error:'Enter who is closing it'}, 400, h);
      if(kind === 'no_report' && !note) return json({error:'Give a reason for closing without a report'}, 400, h);
      if(kind === 'done' && !note) return json({error:'Write what was done'}, 400, h);
      const task = body.task && typeof body.task === 'object' ? {text:clean(body.task.text, 300), why:clean(body.task.why, 80), exp:/^\d{4}-\d{2}-\d{2}$/.test(String(body.task.exp||'')) ? body.task.exp : ''} : null;
      if(task && !task.text) return json({error:'Write what is pending'}, 400, h);
      if(task && t.kind === 'general' && !t.parent_id) return json({error:'A pending task can only be left on a breakdown, a support ticket or another pending task'}, 400, h);
      const taskDown = t.parent_id && body.taskDown != null && body.taskDown !== '' ? Math.max(0, Math.min(1440, Math.round(Number(body.taskDown)) || 0)) : null;
      if(!mayClose(t, by)) return json({error:'Only '+(t.started_by||'the person running the job')+' or someone who joined as primary can close this. Join as primary first.'}, 403, h);
      const p = pickTime(body.ts, now, t.seg_start || t.wait_since || t.started_at || t.down_at, 'Closing time'); if(p.error) return json({error:p.error}, 400, h);
      const seg = await endSeg(t, p.iso);
      { const C = crewOf(t); if(C.length) await crewSave(t.id, await crewStop(t, C, p.iso)); }
      const w = t.status === 'waiting' && t.wait_since ? mins(t.wait_since, p.iso) : 0, vend = VENDOR.test(t.wait_reason||'') ? w : 0;
      const waitH = t.handover_since ? mins(t.handover_since, p.iso) : 0;
      const active = (t.active_min||0) + seg;
      const response = t.self_started ? null : (t.started_at ? mins(t.down_at, t.started_at) : null);
      // machine running again before the close: repair ends when it ran again, the rest is follow-up; downtime counts only the stopped periods
      const repair = t.started_at ? (t.running_at ? mins(t.started_at, t.running_at) : mins(t.started_at, p.iso)) : null, follow = t.running_at ? mins(t.running_at, p.iso) : null;
      // a support request has no machine downtime (the machine kept running): its hands-on time is kept as work time; a general request counts its work time
      const down = t.kind === 'stopped' ? (t.down_acc||0) + (t.running_at ? 0 : mins(t.stop_at || t.down_at, p.iso)) : t.kind === 'support' ? 0 : active;
      const rd = (kind === 'report' || kind === 'done') && body.report && typeof body.report === 'object' ? JSON.stringify(body.report) : (kind === 'done' ? JSON.stringify({done:note}) : null);
      if(rd && rd.length > 20000) return json({error:'The report is too large'}, 400, h);
      await db.prepare(`UPDATE tickets SET status='closed', closed_at=?, closed_by=?, close_kind=?, close_note=?, downtime_min=?, response_min=?, repair_min=?, report_file=?, report_data=?,
          handover_wait_min=handover_wait_min+?, handover_since=NULL, active_min=?, wait_min=wait_min+?, vendor_min=vendor_min+?, wait_since=NULL, seg_start=NULL, follow_min=?, task_down_min=COALESCE(?, task_down_min) WHERE id=?`)
        .bind(p.iso, by, kind, note, down, response, repair, clean(body.file, 120), rd, waitH, active, w, vend, follow, taskDown, t.id).run();
      await ev(t.id, 'close', by, kind === 'report' ? '' : (t.kind === 'general' ? note : note));
      let newTask = null;
      if(task){
        const tid = newId(), tref = await nextRef(db, client, 'general', await prefixes(db, client));
        const where = t.machine || t.location || '';
        await db.prepare(`INSERT INTO tickets (id, client, machine, cell, category, down_at, reported_by, problem, kind, location, work_type, urgent, raised_role, status, started_at, started_by, seg_start, response_min, self_started, raised_user, ref, parent_id, parent_ref, task_exp, task_why) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(tid, client, '', '', '', nowIso, by + ' (Maintenance)', task.text, 'general', where, 'Pending task', 0, 'maint', 'open', null, null, null, null, 0, who.username || '', tref, t.parent_id || t.id, t.parent_id ? (t.parent_ref || '') : (t.ref || ''), task.exp, task.why).run();
        await ev(tid, 'down', by, task.text);
        await ev(t.parent_id || t.id, 'task', by, (t.parent_id ? 'Pending task '+(t.ref||'')+' not finished, new task ' : 'Pending task ')+tref+' left: '+task.text+(task.why ? ' · '+task.why : '')+(task.exp ? ' · expected '+task.exp : ''));
        newTask = row(await get(tid));
      }
      if(t.raised_user && t.raised_role !== 'maint') later(pushFloor(db, client, t.raised_user, {title:'Fixed: '+place(t), body:'Closed by '+by+' at '+new Date(p.iso).toISOString().slice(11,16)+' UTC. '+t.problem, tag:t.id, url:'floor'}));
      return json({ok:true, ticket:row(await get(t.id)), task:newTask}, 200, h);
    }
    if(url.pathname === '/api/report' && req.method === 'POST'){
      if(!can('work')) return deny(); // report written later for a ticket closed without one
      const t = await get(body.id); if(!t) return notFound();
      if(t.status !== 'closed') return json({error:'Close the ticket first'}, 400, h);
      const by = actor(body.by), rep = body.report && typeof body.report === 'object' ? JSON.stringify(body.report) : '';
      if(!by) return json({error:'Enter your name'}, 400, h);
      if(!rep || rep.length > 20000) return json({error:'The report is empty or too large'}, 400, h);
      await db.prepare(`UPDATE tickets SET report_data=?, close_kind='report' WHERE id=?`).bind(rep, t.id).run();
      await ev(t.id, 'report', by, '');
      return json({ok:true}, 200, h);
    }

    // ---------- phone alerts
    if(url.pathname.startsWith('/api/push') || url.pathname === '/api/subscribe' || url.pathname === '/api/unsubscribe'){ if(!can('push')) return deny(); }
    if(url.pathname === '/api/pushkey' && req.method === 'GET') return json({key:(await vapidKeys(db)).pub}, 200, h);
    if(url.pathname === '/api/subscribe' && req.method === 'POST'){
      const sb = body.sub || {}, k = sb.keys || {}, ep = String(sb.endpoint||'');
      if(!/^https:\/\//.test(ep) || !k.p256dh || !k.auth) return json({error:'Alerts are not supported on this phone'}, 400, h);
      await db.prepare(`INSERT INTO subs (endpoint, client, p256dh, auth, role, at, who) VALUES (?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET client=excluded.client, p256dh=excluded.p256dh, auth=excluded.auth, role=excluded.role, at=excluded.at, who=excluded.who`)
        .bind(ep.slice(0,1000), client, clean(k.p256dh,200), clean(k.auth,100), who.role === 'report' ? 'floor' : 'maint', nowIso, who.role === 'report' ? who.username : actor(body.who)).run();
      return json({ok:true}, 200, h);
    }
    if(url.pathname === '/api/unsubscribe' && req.method === 'POST'){
      await db.prepare(`DELETE FROM subs WHERE endpoint=? AND client=?`).bind(String(body.endpoint||'').slice(0,1000), client).run();
      return json({ok:true}, 200, h);
    }
    if(url.pathname === '/api/pushtest' && req.method === 'POST'){
      const s = await db.prepare(`SELECT * FROM subs WHERE endpoint=? AND client=?`).bind(String(body.endpoint||'').slice(0,1000), client).first();
      if(!s) return json({error:'This phone is not signed up for alerts'}, 400, h);
      const v = await vapidKeys(db), res = await fetch(s.endpoint, {method:'POST', headers:{'Content-Encoding':'aes128gcm', 'Content-Type':'application/octet-stream', 'TTL':'600', 'Urgency':'high', 'Authorization':await vapidAuth(s.endpoint, v)}, body:await encryptPush(s, JSON.stringify({title:'Test alert', body:'Alerts are working on this phone.', tag:'test'}))});
      return res.ok ? json({ok:true}, 200, h) : json({error:'The phone service refused the alert ('+res.status+')'}, 400, h);
    }
    return json({error:'not found'}, 404, h);
  }
};
