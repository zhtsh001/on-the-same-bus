from pathlib import Path
import json, runpy
root=Path(__file__).resolve().parents[1]
backend=runpy.run_path(str(root/'server.py'))
assets={}
for p in (root/'dist').iterdir():
 if p.is_file() and p.suffix in ('.html','.js','.css'):
  assets['/'+p.name]={'body':p.read_text(),'type':{'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[p.suffix]}
assets['/']=assets['/index.html']
prefix='const ASSETS='+json.dumps(assets,ensure_ascii=False)+';\nconst PROMPT='+json.dumps(backend['PROMPT'],ensure_ascii=False)+';\nconst SCHEMA='+json.dumps(backend['SCHEMA'])+';\nconst ACTION_GUIDE='+json.dumps(backend['ACTION_GUIDE'],ensure_ascii=False)+';\n'
engine=(root/'dist/game.js').read_text()
worker=(root/'worker/gateway.js').read_text()
out=root/'dist/server';out.mkdir(exist_ok=True)
(out/'index.js').write_text(prefix+engine+'\n'+worker)
host=root/'.openai/hosting.json';host.parent.mkdir(exist_ok=True);m=json.loads(host.read_text()) if host.exists() else {};m.pop('static',None);host.write_text(json.dumps(m,indent=2)+'\n')
(root/'dist/.openai').mkdir(exist_ok=True)
(root/'dist/.openai/hosting.json').write_text(host.read_text())
print('Hosted Worker built; static assets embedded, no credentials included.')
