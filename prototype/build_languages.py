from pathlib import Path
import json,re
ROOT=Path(__file__).parent
D=ROOT/'dist'
def translate(text,mapping):
 # Single pass prevents translated output being translated a second time.
 pattern=re.compile('|'.join(re.escape(k) for k in sorted(mapping,key=len,reverse=True)))
 return pattern.sub(lambda m:mapping[m.group()],text)
game=json.loads((ROOT/'i18n/en.json').read_text());ui=json.loads((ROOT/'i18n/ui.en.json').read_text())
s=translate((D/'game.js').read_text(),game)
s=s.replace('return {node:',"return {language:'en',node:")
(D/'game.en.js').write_text(s)
s=translate((D/'app.js').read_text(),ui)
s=s.replace("esc(error.message)","esc('The response could not be completed. This moment has not advanced. Please retry.')")
(D/'app.en.js').write_text(s)
s=translate((D/'index.html').read_text(),ui)
s=s.replace('lang="zh-CN"','lang="en"').replace('game.js?v=4','game.en.js?v=4en').replace('app.js?v=4','app.en.js?v=4en')
s=s.replace('href="en.html"','href="index.html"').replace('>English</a>','>中文</a>')
s=s.replace('切换语言会开始新的一局','Switching languages starts a new ride')
(D/'en.html').write_text(s)
for name in ['game.en.js','app.en.js','en.html']:
 text=(D/name).read_text().replace('>中文</a>','></a>')
 remains=re.findall(r'[^\n]*[\u4e00-\u9fff][^\n]*',text)
 if remains:
  print(name+' untranslated:');print('\n'.join(remains));raise SystemExit(1)
print('English files generated; no untranslated Chinese except the language switch.')
