import json, urllib.request as U
B='http://localhost:8799'
def call(path, body=None, key='k123', extra=None):
    h={'X-Client':'tst','Content-Type':'application/json','X-Key':key}; h.update(extra or {})
    r=U.Request(B+path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    return json.loads(U.urlopen(r).read())
ms=[{'id':'VC-%d'%i,'category':'Vertical Machining Center','cell':'1','seg':'CNC'} for i in range(1,9)]+[{'id':'TC-%d'%i,'category':'Turning Center','cell':'2','seg':'CNC'} for i in range(1,6)]+[{'id':'COMP-1','category':'Air Compressor','seg':'Utility'}]
cfg={'id':'tst','company':'Test Co','tagline':'Live Machine Status','reportTitle':'BREAKDOWN REPORT','product':'Zerodown','language':{'code':'gu-IN','name':'Gujarati'},'relay':'','features':{'general':True,'pause':True},'floorLive':False,
     'ref':{'machines':ms,'shifts':['1','2'],'observedBy':['Operator','Setter','Supervisor','Engineer'],'team':['Ravi','Amit','Kiran'],'codes':['E01','M01'],'breakdownCategories':['Electrical','Mechanical'],'locations':['Store','Office'],'cells':['1','2']},'glossary':{}}
print(call('/api/config',{'config':cfg,'fp':'fp1'},extra={'X-Config-Token':'ct_'+'a'*40}))
for u in [dict(username='ravi',name='Ravi',role='maint',password='ravi123'),dict(username='amit',name='Amit',role='maint',password='amit123'),dict(username='op1',name='Suresh',role='report',title='Operator',password='op1234'),
          dict(username='op2',name='Mona',role='report',password='op2345'),dict(username='tvboard',name='Board TV',role='board',password='tvtv12'),dict(username='cell3',name='Cell 3 phone',role='report',shared=True,password='cell33'),
          dict(username='team',name='Maintenance phone',role='maint',shared=True,password='team12')]:
    print(u['username'], call('/api/users',u))
