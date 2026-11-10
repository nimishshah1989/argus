"""Load Cosmos prototype seed data into a local Atlas (Maintenance OS fork) instance via its REST API.

Usage: python3 load_cosmos.py <cosmos.json> <api_base>   e.g. http://localhost:8080
Proof of fit only: one company, location tree, assets, completed work orders for every breakdown.
"""
import json, sys, time, uuid, urllib.request, urllib.error

SEED, API = sys.argv[1], sys.argv[2].rstrip('/')
d = json.load(open(SEED))
TOKEN = None


def call(method, path, body=None, params=''):
    url = f"{API}{path}{params}"
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    if TOKEN:
        req.add_header('Authorization', f'Bearer {TOKEN}')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode()[:500]}")


# 1. Sign up the Cosmos admin (creates the company = tenant)
EMAIL, PWD = 'admin@cosmos.test', 'Cosmos#2026demo'
try:
    call('POST', '/auth/signup', {"email": EMAIL, "password": PWD, "firstName": "Cosmos", "lastName": "Admin",
                                  "phone": "+910000000000", "companyName": "Cosmos (demo tenant)", "employeesCount": 50,
                                  "language": "EN", "skipMailSending": True, "timeZone": "Asia/Kolkata"})
except RuntimeError as e:
    print('signup:', str(e)[:200])
tok = call('POST', '/auth/signin', {"email": EMAIL, "password": PWD, "type": "client"})
TOKEN = tok.get('accessToken') or tok.get('token') or tok.get('access_token')
print('signed in:', bool(TOKEN))


def run_import(kind, rows):
    u = str(uuid.uuid4())
    res = call('POST', f'/import/{kind}', rows, params=f'?uuid={u}')
    print(f'import {kind}: {len(rows)} rows ->', str(res)[:200])
    return res


# 2. Locations: Plant > Area (Cosmos "location" code) > Cell within that area
assets_all = []
for seg, key in [('CNC', 'machines'), ('Conventional', 'conv'), ('Process', 'proc'), ('Utility', 'util'), ('DG Set', 'dg')]:
    for m in d[key]:
        m = dict(m); m['_segment'] = seg
        if key == 'dg':
            m['category'] = 'DG Set'
        assets_all.append(m)

PLANT = 'Cosmos Plant'
locs = [{"name": PLANT}]
areas = sorted({str(m.get('location') or '').strip() for m in assets_all} - {''})
for a in areas:
    locs.append({"name": f"Area {a}", "parentLocationName": PLANT})
cell_names = {}
for m in assets_all:
    a, c = str(m.get('location') or '').strip(), str(m.get('cell') or '').strip()
    if a and c:
        cell_names[(a, c)] = f"Cell {c} @ {a}"
for (a, c), n in sorted(cell_names.items()):
    locs.append({"name": n, "parentLocationName": f"Area {a}"})
run_import('locations', locs)
time.sleep(5)


# 3. Assets
def loc_for(m):
    a, c = str(m.get('location') or '').strip(), str(m.get('cell') or '').strip()
    if a and c:
        return cell_names[(a, c)]
    return f"Area {a}" if a else PLANT


asset_rows = []
for m in assets_all:
    info = {k: m.get(k) for k in ['segment', 'controller', 'ctrlModel', 'ctrlSerial', 'year', 'datePurchase', 'assetCode',
                                  'length', 'width', 'conveyor', 'capacityKva', 'cell', 'location'] if m.get(k) not in (None, '')}
    info['segment'] = m['_segment']
    asset_rows.append({
        "name": m['id'], "category": m.get('category') or m['_segment'], "manufacturer": m.get('make') or '',
        "model": m.get('model') or '', "serialNumber": str(m.get('serial') or ''),
        "power": f"{m.get('power')} kVA" if m.get('power') not in (None, '') else '',
        "locationName": loc_for(m), "status": "OPERATIONAL",
        "additionalInfos": json.dumps(info), "description": f"{m['_segment']} asset imported from Cosmos prototype",
    })
for i in range(0, len(asset_rows), 100):
    run_import('assets', asset_rows[i:i + 100])
    time.sleep(3)
time.sleep(5)

# 4. Breakdowns and PM entries -> completed work orders (category = Cosmos maintenance code)
wo_rows = []
for b in d['breakdowns']:
    code = (b.get('maintCode') or '').strip() or 'UNCODED'
    spares = '; '.join(s for s in [b.get('spare1'), b.get('spare2'), b.get('spare3')] if s)
    desc = (f"Date {b['date']} | shift {b.get('shift')} | observed by {b.get('observedBy')} | done by {b.get('doneBy')}"
            f" | supported by {b.get('supportedBy') or '-'} | down {b.get('downHrs')} h | code {code} | E/M {b.get('electMech') or '-'}"
            f" | spares {spares or '-'} | cosmos id {b['id']}")
    dd, mm, yy = b['date'].split('-')
    excel_date = (time.mktime((int(yy), int(mm), int(dd), 12, 0, 0, 0, 0, -1)) / 86400.0) + 25569
    wo_rows.append({"title": (b.get('problem') or 'Breakdown')[:200], "status": "COMPLETE", "priority": "NONE",
                    "description": desc, "category": code, "assetName": b['machineId'], "dueDate": excel_date,
                    "estimatedDuration": float(b.get('downHrs') or 0), "feedback": b.get('correctiveAction') or '',
                    "completedOn": excel_date, "requiredSignature": "false", "archived": "false"})
for i in range(0, len(wo_rows), 200):
    run_import('work-orders', wo_rows[i:i + 200])
    time.sleep(3)
print('done: assets', len(asset_rows), 'work orders', len(wo_rows), 'locations', len(locs))
