import re,subprocess,sys
s=open('/home/claude/cosmos_platform.html',encoding='utf-8').read()
bl=re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>',s,re.S)
for i,b in enumerate(bl):
    open(f'/tmp/blk{i}.js','w').write(b)
    r=subprocess.run(['node','--check',f'/tmp/blk{i}.js'],capture_output=True,text=True)
    print(i,len(b),r.returncode,r.stderr[:300])
