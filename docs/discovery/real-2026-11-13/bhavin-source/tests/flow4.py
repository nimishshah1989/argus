import json, urllib.request, time
def api(path, body=None, hdr=None):
    h={'X-Client':'tst','X-Key':'k123','Content-Type':'application/json'}; h.update(hdr or {})
    r=urllib.request.Request('http://localhost:8799'+path, data=json.dumps(body).encode() if body is not None else None, headers=h)
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return {'HTTP':e.code, **json.load(e)}
st=api('/api/state'); print('upgrade: open', len(st['open']), st['open'][0]['status'], 'version', st['version'])
old=st['open'][0]['id']
# full flow
t=api('/api/down',{'machine':'VTL-4','by':'Ram (Operator)','problem':'Hydraulic leak'})['ticket']; tid=t['id']
print('dup', api('/api/down',{'machine':'VTL-4','by':'X','problem':'again'}).get('exists'))
print('start', api('/api/start',{'id':tid,'by':'Sagar T'})['ticket']['status'])
print('pause no reason', api('/api/pause',{'id':tid,'by':'Sagar T'}).get('error'))
r=api('/api/pause',{'id':tid,'by':'Sagar T','reason':'Sent to vendor for repair','note':'Pump to ABC','eta':'2026-11-02T12:00:00Z','assign':''})['ticket']
print('paused', r['status'], r['waitReason'], r['eta'], r['activeMin'])
print('start while waiting', api('/api/start',{'id':tid,'by':'X'}).get('error'))
print('dup while waiting', api('/api/down',{'machine':'VTL-4','by':'X','problem':'again'}).get('exists'))
r=api('/api/resume',{'id':tid,'by':'Madhu K','note':'pump back'})['ticket']; print('resumed', r['status'], r['startedBy'], r['waitMin'])
print('update', api('/api/update',{'id':tid,'by':'Madhu K','text':'Fitting pump'})['ticket']['status'])
r=api('/api/transfer',{'id':tid,'by':'Madhu K','note':'Pump fitted, trial pending','to':'Next shift'})['ticket']; print('transfer', r['status'], r['handedOver'], r['transfers'])
r=api('/api/start',{'id':tid,'by':'Chirag P'})['ticket']; print('pickup', r['status'], r['startedBy'])
st=api('/api/state'); o=[x for x in st['open'] if x['id']==tid][0]; print('timeline', [u['type'] for u in o['updates']], o['updateCount'])
r=api('/api/close',{'id':tid,'by':'Chirag P','kind':'report','report':{'mid':'VTL-4','ca':'pump replaced'}})['ticket']
print('closed', r['status'], 'active',r['activeMin'],'wait',r['waitMin'],'vendor',r['vendorMin'],'down',r['downtimeMin'],'resp',r['responseMin'])
h=api('/api/history?days=2&reports=1'); x=[t for t in h['tickets'] if t['id']==tid][0]; print('segments', x['segments'])
# general work, urgent, by floor
g=api('/api/down',{'kind':'general','location':'Cell 3','workType':'Electrical','urgent':True,'by':'Supervisor','problem':'Install wall fan'}); print('general', g['ticket']['kind'], g['ticket']['location'], g['ticket']['urgent'], g['ticket']['machine']=='')
g2=api('/api/down',{'kind':'general','location':'Cell 3','workType':'Electrical','by':'Supervisor','problem':'Second job same place'}); print('general 2 allowed', g2.get('ok'))
print('general no location', api('/api/down',{'kind':'general','by':'S','problem':'x'}).get('error'))
r=api('/api/start',{'id':g['ticket']['id'],'by':'Bipin P'}); r=api('/api/close',{'id':g['ticket']['id'],'by':'Bipin P','kind':'done','note':'Fan installed'})['ticket']; print('general closed', r['closeKind'], r['downtimeMin'], r['hasReport'])
# maintenance self-started
m=api('/api/down',{'machine':'TC-9','by':'Sagar T','problem':'Found loose guard','role':'maint','startNow':True})['ticket']; print('self', m['status'], m['selfStarted'], m['raisedRole'])
r=api('/api/close',{'id':m['id'],'by':'Sagar T','kind':'no_report','note':'tightened'})['ticket']; print('self resp', r['responseMin'])
# config
print('config none', api('/api/config'))
cfg={'company':'Test Co','ref':{'machines':[{'id':'VC-1','category':'VMC','seg':'CNC'}]}}
print('cfg post', api('/api/config',{'config':cfg,'fp':'abc'},{'X-Config-Token':'tok_'+'x'*30}))
print('cfg other token', api('/api/config',{'config':cfg,'fp':'abd'},{'X-Config-Token':'tok_'+'y'*30}))
print('cfg get same', api('/api/config?fp=abc')); print('cfg get', api('/api/config?fp=zz')['config']['company'])
print('state config', api('/api/state')['config'])
print('old ticket close', api('/api/close',{'id':old,'by':'Sagar T','kind':'no_report','note':'old'})['ticket']['status'])
