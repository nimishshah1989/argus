# writes N closed tickets with work segments straight into the local test database (bypasses the per-minute limit)
import sys, datetime as dt, subprocess, random
n=int(sys.argv[1]) if len(sys.argv)>1 else 130
now=dt.datetime.utcnow(); L=[]
names=['Ravi','Amit','Kiran']; ms=['VC-%d'%i for i in range(1,9)]+['TC-%d'%i for i in range(1,6)]
for i in range(n):
    down=now-dt.timedelta(hours=2+i*3); st=down+dt.timedelta(minutes=10); cl=st+dt.timedelta(minutes=40)
    f=lambda d:d.strftime('%Y-%m-%dT%H:%M:%S.000Z'); tid='t_vol%04d'%i; who=names[i%3]
    L.append(f"INSERT INTO tickets (id,client,machine,cell,category,down_at,reported_by,problem,status,closed_at,closed_by,close_kind,close_note,downtime_min,kind,started_at,started_by,response_min,repair_min,active_min,raised_role,raised_user) VALUES ('{tid}','tst','{ms[i%len(ms)]}','1','VMC','{f(down)}','Suresh (Operator)','Volume test {i}','closed','{f(cl)}','{who}','no_report','fixed {i}',50,'stopped','{f(st)}','{who}',10,40,40,'floor','op1');")
    L.append(f"INSERT INTO events (id,client,ticket,at,type,by,text,mins) VALUES ('e_vs{i}','tst','{tid}','{f(cl)}','segment','{who}','',40);")
    L.append(f"INSERT INTO events (id,client,ticket,at,type,by,text) VALUES ('e_vc{i}','tst','{tid}','{f(cl)}','close','{who}','fixed {i}');")
open('/tmp/vol.sql','w').write('\n'.join(L))
r=subprocess.run(['npx','wrangler','d1','execute','t','--local','--file','/tmp/vol.sql'],cwd='/tmp/wr',capture_output=True,text=True)
print(r.stdout[-300:], r.stderr[-300:])
