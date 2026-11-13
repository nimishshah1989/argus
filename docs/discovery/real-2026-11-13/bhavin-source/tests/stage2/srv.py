p='/home/claude/live/api/worker.js'; s=open(p,encoding='utf-8').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:70],s.count(a)); s=s.replace(a,b)
rep("""// Live maintenance tickets (version 4): Cloudflare Worker + D1 database.
// Setup: bind a D1 database to this Worker with the name DB, and add a secret CLIENT_KEYS like {"cosmos":"a-long-random-text"}
// (company id -> its access key). Optional variable ALLOWED_ORIGIN = the tool's site address (several allowed, comma separated).
//""","""// Live maintenance tickets (version 5): Cloudflare Worker + D1 database.
// Setup: bind a D1 database to this Worker with the name DB, and add a secret CLIENT_KEYS like {"cosmos":"a-long-random-text"}
// (company id -> its access key). Optional variable ALLOWED_ORIGIN = the tool's site address (several allowed, comma separated).
//
// Who can use it: the platform uses the company access key (full access, never put it in a link).
// Everyone else signs in with a username and password that an admin created in the platform (Settings > People & access).
// A sign-in lasts 30 days on that device. Roles: report (shop floor), maint, board (view only), supervisor, admin.
//""")
rep("const V = 4;","const V = 5;")
rep("""  location: `ALTER TABLE tickets ADD COLUMN location TEXT`, work_type: `ALTER TABLE tickets ADD COLUMN work_type TEXT`, urgent: `ALTER TABLE tickets ADD COLUMN urgent INTEGER NOT NULL DEFAULT 0`};""",
"""  location: `ALTER TABLE tickets ADD COLUMN location TEXT`, work_type: `ALTER TABLE tickets ADD COLUMN work_type TEXT`, urgent: `ALTER TABLE tickets ADD COLUMN urgent INTEGER NOT NULL DEFAULT 0`,
  // version 5
  raised_user: `ALTER TABLE tickets ADD COLUMN raised_user TEXT`};""")
rep("""const ACTIVE = `('open','working','waiting')`;""","""const USERS = `CREATE TABLE IF NOT EXISTS users (client TEXT NOT NULL, username TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, title TEXT, shared INTEGER NOT NULL DEFAULT 0,
  pass TEXT NOT NULL, salt TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created TEXT, updated TEXT, last_login TEXT, fail_n INTEGER NOT NULL DEFAULT 0, lock_until TEXT, PRIMARY KEY (client, username))`;
const SESSIONS = `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, client TEXT NOT NULL, username TEXT NOT NULL, created TEXT, seen TEXT, expires TEXT, device TEXT)`;
const ACTIVE = `('open','working','waiting')`;
// what each role may do
const ROLES = ['report','maint','board','supervisor','admin'];
const CAN = {report:['read','raise','config'], board:['read','config'], maint:['read','raise','config','work','push'],
  supervisor:['read','raise','config','work','push','history'], admin:['read','raise','config','work','push','history','users']};
const SESSION_DAYS = 30, MAX_DEVICES = 10;""")
rep("""  await db.prepare(EVENTS).run(); await db.prepare(SUBS).run(); await db.prepare(META).run(); await db.prepare(CONFIG).run();""",
"""  await db.prepare(EVENTS).run(); await db.prepare(SUBS).run(); await db.prepare(META).run(); await db.prepare(CONFIG).run();
  await db.prepare(USERS).run(); await db.prepare(SESSIONS).run();""")
rep("""    db.prepare(`CREATE INDEX IF NOT EXISTS events_type ON events(client, type, at)`)
  ]);""","""    db.prepare(`CREATE INDEX IF NOT EXISTS events_type ON events(client, type, at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sessions_user ON sessions(client, username)`)
  ]);""")
rep("""const json = (o, status, h) => new Response(JSON.stringify(o), {status: status||200, headers: {...h, 'Content-Type':'application/json'}});""",
"""const json = (o, status, h) => new Response(JSON.stringify(o), {status: status||200, headers: {...h, 'Content-Type':'application/json', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}});""")
rep("""// Writes must come from the tool's own site (ALLOWED_ORIGIN). Reads are open to any page that has the key (the platform runs from a local file).
function cors(req){
  const o = req.headers.get('Origin') || '';
  return {'Access-Control-Allow-Origin': o || '*', 'Access-Control-Allow-Methods':'GET, POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, X-Client, X-Key, X-Config-Token', 'Access-Control-Max-Age':'86400', 'Vary':'Origin'};
}""","""// Only the tool's own site (ALLOWED_ORIGIN) and the platform (a local file, origin "null") may call the server from a browser.
function originOk(req, env){ const o = req.headers.get('Origin') || '', L = origins(env); return !o || o === 'null' || !L.length || L.includes(o) || o === new URL(req.url).origin; }
function cors(req, env){
  const o = req.headers.get('Origin') || '';
  const h = {'Access-Control-Allow-Methods':'GET, POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, X-Client, X-Key, X-Config-Token, Authorization', 'Access-Control-Max-Age':'86400', 'Vary':'Origin'};
  if(originOk(req, env)) h['Access-Control-Allow-Origin'] = o || '*';
  return h;
}""")
rep("""const VENDOR = /vendor/i;""","""const VENDOR = /vendor/i;
// sign-in attempts per address (on top of the 5-wrong-tries lock per username)
function loginLimited(ip){ const t = Math.floor(Date.now()/60000), k = 'L|'+ip+'|'+t, n = (HITS.get(k)||0)+1; HITS.set(k, n); return n > 20; }
// passwords are stored as PBKDF2-SHA256 hashes (100,000 rounds, random salt), never as text
async function passHash(pw, salt){ const k = await crypto.subtle.importKey('raw', te.encode(String(pw)), 'PBKDF2', false, ['deriveBits']); return b64u(await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:ub64(salt), iterations:100000}, k, 256)); }
function rnd(n){ const b = new Uint8Array(n); crypto.getRandomValues(b); return b64u(b); }
const userOut = u => ({username:u.username, name:u.name, role:u.role, title:u.title||'', shared:!!u.shared});""")
# ---- request head
rep("""    const h = cors(req), url = new URL(req.url);
    if(req.method === 'OPTIONS') return new Response(null, {status:204, headers:h});
    if(!url.pathname.startsWith('/api/')) return json({ok:true, service:'maintenance tickets', version:V}, 200, h);
    if(limited(req.headers.get('CF-Connecting-IP') || 'x', req.method === 'POST')) return json({error:'Too many requests. Wait a minute and try again.'}, 429, h);
    { const L = origins(env), o = req.headers.get('Origin'); if(req.method === 'POST' && L.length && o && o !== 'null' && !L.includes(o)) return json({error:'origin'}, 403, h); }
    let keys = {}; try{ keys = JSON.parse(env.CLIENT_KEYS || '{}'); }catch(e){}
    const client = clean(req.headers.get('X-Client') || url.searchParams.get('c'), 60), key = req.headers.get('X-Key') || url.searchParams.get('k') || '';
    if(!client || !keys[client] || !same(keys[client], key)) return json({error:'auth'}, 401, h);
    if(!env.DB) return json({error:'no database bound (name it DB)'}, 500, h);
    await ensureSchema(env.DB);
    const db = env.DB, now = Date.now(), nowIso = new Date(now).toISOString();
    let body = {}; if(req.method === 'POST'){ try{ body = await req.json(); }catch(e){ return json({error:'bad json'}, 400, h); } }
    const later = p => { if(ctx && ctx.waitUntil) ctx.waitUntil(p); };
""","""    const h = cors(req, env), url = new URL(req.url);
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
      const m = /^Bearer\\s+(\\S{10,100})$/.exec(req.headers.get('Authorization') || '');
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
        if(!name) return json({error:'Enter the person\\'s name'}, 400, h);
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
""")
# ---- permission checks per endpoint
rep("""    if(url.pathname === '/api/state' && req.method === 'GET'){
""","""    if(url.pathname === '/api/state' && req.method === 'GET'){
      if(!can('read')) return deny();
""")
rep("""    if(url.pathname === '/api/history' && req.method === 'GET'){
""","""    if(url.pathname === '/api/history' && req.method === 'GET'){
      if(!can('history')) return deny();
""")
rep("""    if(url.pathname === '/api/events' && req.method === 'GET'){
""","""    if(url.pathname === '/api/events' && req.method === 'GET'){
      if(!can('read')) return deny();
""")
rep("""    if(url.pathname === '/api/config' && req.method === 'GET'){
""","""    if(url.pathname === '/api/config' && req.method === 'GET'){
      if(!can('config')) return deny();
""")
rep("""      // Only the platform that first sent the settings can change them (it keeps a private token). Reset by deleting the row in the database console.
""","""      // Only the platform that first sent the settings can change them (it keeps a private token). Reset by deleting the row in the database console.
      if(!who.key) return deny();
""")
rep("""      const kind = ['support','general'].includes(body.kind) ? body.kind : 'stopped';
      const machine = kind === 'general' ? '' : clean(body.machine, 40), by = clean(body.by, 60), problem = clean(body.problem, 500);
      const location = clean(body.location, 80), workType = clean(body.workType, 60), urgent = body.urgent ? 1 : 0;
      const role = body.role === 'maint' ? 'maint' : 'floor', startNow = !!body.startNow && role === 'maint', starter = clean(body.startBy || body.by, 60);""",
"""      if(!can('raise')) return deny();
      const kind = ['support','general'].includes(body.kind) ? body.kind : 'stopped';
      const role = who.key ? (body.role === 'maint' ? 'maint' : 'floor') : (who.role === 'report' ? 'floor' : 'maint');
      // a personal login reports under its own name; the shop-floor role (Operator, Setter...) comes from the login or from the phone
      const by = (who.key || who.shared) ? clean(body.by, 60) : clean(who.name + ' (' + (role === 'maint' ? 'Maintenance' : (who.title || clean(body.byRole, 30) || 'Shop floor')) + ')', 60);
      const machine = kind === 'general' ? '' : clean(body.machine, 40), problem = clean(body.problem, 500);
      const location = clean(body.location, 80), workType = clean(body.workType, 60), urgent = body.urgent ? 1 : 0;
      const startNow = !!body.startNow && role === 'maint', starter = actor(body.startBy || body.by);""")
rep("""        await db.prepare(`INSERT INTO tickets (id, client, machine, cell, category, down_at, reported_by, problem, kind, location, work_type, urgent, raised_role, status, started_at, started_by, seg_start, response_min, self_started) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id, client, machine, clean(body.cell, 40), clean(body.category, 80), nowIso, by, problem, kind, location, workType, urgent, role,
            startNow ? 'working' : 'open', startNow ? nowIso : null, startNow ? starter : null, startNow ? nowIso : null, null, startNow ? 1 : 0).run();""",
"""        await db.prepare(`INSERT INTO tickets (id, client, machine, cell, category, down_at, reported_by, problem, kind, location, work_type, urgent, raised_role, status, started_at, started_by, seg_start, response_min, self_started, raised_user) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id, client, machine, clean(body.cell, 40), clean(body.category, 80), nowIso, by, problem, kind, location, workType, urgent, role,
            startNow ? 'working' : 'open', startNow ? nowIso : null, startNow ? starter : null, startNow ? nowIso : null, null, startNow ? 1 : 0, who.username || '').run();""")
# work endpoints: permission + actor name
for ep in ['start','transfer','pause','resume','update','close','report']:
    a = "    if(url.pathname === '/api/%s' && req.method === 'POST'){" % ep
    assert s.count(a)==1, ep
    s = s.replace(a, a + "\n      if(!can('work')) return deny();")
n = s.count("const by = clean(body.by, 60)")
s = s.replace("const by = clean(body.by, 60)", "const by = actor(body.by)")
print('actor replaced', n)
rep("""    if(url.pathname === '/api/cancel' && req.method === 'POST'){
      const t = await get(body.id); if(!t) return notFound();""","""    if(url.pathname === '/api/cancel' && req.method === 'POST'){
      const t = await get(body.id); if(!t) return notFound();
      // maintenance can cancel any ticket; the shop floor only one it raised itself and nobody has started
      if(!can('work') && !(can('raise') && who.username && t.raised_user === who.username && t.status === 'open')) return deny();""")
rep("""    if(url.pathname === '/api/pushkey' && req.method === 'GET') return json""","""    if(url.pathname.startsWith('/api/push') || url.pathname === '/api/subscribe' || url.pathname === '/api/unsubscribe'){ if(!can('push')) return deny(); }
    if(url.pathname === '/api/pushkey' && req.method === 'GET') return json""")
rep(""".bind(ep.slice(0,1000), client, clean(k.p256dh,200), clean(k.auth,100), body.role === 'floor' ? 'floor' : 'maint', nowIso, clean(body.who, 60)).run();""",
""".bind(ep.slice(0,1000), client, clean(k.p256dh,200), clean(k.auth,100), 'maint', nowIso, actor(body.who)).run();""")
open(p,'w',encoding='utf-8').write(s); print('ok', len(s))
