# -*- coding: utf-8 -*-
"""Loopback-only Gemini gateway. Credential stays in process memory."""
import os,json,getpass,urllib.request,urllib.error,threading
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
MODEL=os.environ.get('GAME_GEMINI_MODEL','gemini-2.5-flash')
PROMPT="""你是公交上坐在玩家附近的陌生人。你有自己的处境，同时比普通路人更留意邻座的动作。你必须完成一轮：观察实际动作→提出三个不同而合理的解释→选一个暂时相信的解释→提出三个可能的下一步预测→选一个预测→据此选一个合法行动。不是解说员，也不是聊天助手。所有理解可能错误，不读心，不把谨慎或沉默当敌意。
context.mustNotice 为 true 时当前动作确实在你的感知范围内，必须 noticed=true；注意到不等于知道真实意图。false 时可以被自己的事分心，但不能连续忽视每一轮。若 noticed=false，选中的解释 meaning 必须沿用 priorUnderstanding，说明缺少新观察，不能把玩家的新动作当证据。其余候选可以是不确定的假设。
interpretations 三项必须有实质差异，分别考虑玩家自身原因、与你的关系、或不确定性；只描述暂时解释。predictions 三项写玩家接下来可能做什么，behavior 标为 stay/adjust/reach_out/leave。prediction 是你行动之后对玩家反应的预期，不是假称已经发生。
先选择解释，再根据它选择预测和行动。reason 用一句短话连接三者，不写长推理。actionId 必须来自 allowedActions。偏好有观察意义的动作；不要反复停住或看手机。可在几个同样合理的动作中有变化，不为了随机而违背场景或自己刚刚形成的理解。
NPC 的本轮行动将直接成为玩家下轮看见的动作，不能假装动作发生过却仍按旧姿势行动。ownPreviousAction 是你自己上一轮的动作；playerObservableAction 才是玩家刚做的动作。environmentNow 是当前已发生的环境变化。不要添加新物品、姓名、关系和事件。
acknowledge 表示你确实收到对你发出的明确交流并回应，将立即结束故事；不必每轮设法搭话，也不要故意不回答明确提问来延长故事。三个解释和三个预测都用简短中文；不得知道玩家选择的内心解释或尚未发生的行动。"""
OPTION_I={'type':'object','properties':{'id':{'type':'string'},'text':{'type':'string'},'meaning':{'type':'string','enum':['unknown','space','exit','contact','private']}},'required':['id','text','meaning'],'additionalProperties':False}
OPTION_P={'type':'object','properties':{'id':{'type':'string'},'text':{'type':'string'},'behavior':{'type':'string','enum':['stay','adjust','reach_out','leave']}},'required':['id','text','behavior'],'additionalProperties':False}
SCHEMA={'type':'object','properties':{'noticed':{'type':'boolean'},'interpretations':{'type':'array','items':OPTION_I,'minItems':3,'maxItems':3},'interpretationId':{'type':'string'},'predictions':{'type':'array','items':OPTION_P,'minItems':3,'maxItems':3},'predictionId':{'type':'string'},'actionId':{'type':'string'},'reason':{'type':'string'}},'required':['noticed','interpretations','interpretationId','predictions','predictionId','actionId','reason'],'additionalProperties':False}
FIELDS={'node','phase','nextNode','ownSituation','ownPosition','playerPosition','environmentNow','ownPreviousAction','playerObservableAction','priorUnderstanding','priorDecision','observedHistory','mustNotice','terminal'}
KEY='';GATE=threading.Semaphore(1)
def allowed(c):
 if c['terminal']:return [c['terminal']]
 a=c['playerObservableAction']['id']
 if a in ['ask','return','point','nod','thanks']:return ['acknowledge','miss']
 if c['nextNode']==2:return ['brace_rail','brace_seat']
 xs=['glance','make_room','fold_phone','check_stop','stay']
 xs.append('sit_back' if c['ownPosition']=='standing' else 'shift')
 if c['nextNode']>=3 and c['ownPosition']!='standing':xs.append('stand_aside')
 if c['nextNode']>=6 and c['ownPosition']!='across':xs.append('move_across')
 if c['nextNode']==4:xs.append('wait_ticket')
 if a=='ignore':return ['recover_ticket']
 if (c['priorDecision'] or {}).get('actionId')!='phone':xs.append('phone')
 return xs
ACTION_GUIDE={'glance':'看向玩家，短暂观察，不主动搭话','shift':'坐着往窗边挪一点','make_room':'收腿让出过道','fold_phone':'扣下手机，注意过道','check_stop':'看站名，再看玩家的包','stay':'暂不改变位置','phone':'低头继续看手机','stand_aside':'站起来并侧身让出空间','sit_back':'坐回窗边座位','move_across':'换到新空出的另一边座位','wait_ticket':'看到小票但暂不捡，看一下玩家是否动','recover_ticket':'自己捡起小票','brace_rail':'抓扶手稳住自己','brace_seat':'按座椅边稳住自己','acknowledge':'明确回应对方的交流','miss':'没有收到或没有回应这次交流','npc_exit':'按自己的原定路线下车','player_exit':'玩家下车，NPC留下'}
def generate(c):
 language=c.get('language','zh')
 if language not in ('zh','en') or set(c)-{'language'}!=FIELDS:raise ValueError('context')
 if set(c['ownSituation'])!={'id','stop','agenda','discomfort','phone'}:raise ValueError('ownSituation')
 if set(c['playerObservableAction'])!={'id','text'}:raise ValueError('action')
 if type(c['node']) is not int or c['node'] not in range(-1,8) or type(c['nextNode']) is not int or c['nextNode'] not in range(8):raise ValueError('node')
 if c['phase'] not in ('opening','response') or c['terminal'] not in (None,'npc_exit','player_exit'):raise ValueError('phase')
 if type(c['mustNotice']) is not bool or not isinstance(c['observedHistory'],list) or len(c['observedHistory'])>8:raise ValueError('history')
 for e in c['observedHistory']:
  if set(e)!={'node','observedAction','understanding'}:raise ValueError('historyFields')
 if c['priorDecision'] is not None and set(c['priorDecision'])!={'interpretation','prediction','actionId'}:raise ValueError('prior')
 opts=allowed(c);schema=json.loads(json.dumps(SCHEMA));schema['properties']['actionId']['enum']=opts
 if c['mustNotice']:schema['properties']['noticed']['enum']=[True]
 extra=' Write all option text and reason in concise natural English. The player is they; the NPC is you.' if language=='en' else ''
 payload={'systemInstruction':{'parts':[{'text':PROMPT+extra}]},'contents':[{'role':'user','parts':[{'text':json.dumps({**c,'allowedActions':[{ 'id':x,'meaning':ACTION_GUIDE[x]} for x in opts]},ensure_ascii=False)}]}],'generationConfig':{'temperature':0.95,'maxOutputTokens':1800,'thinkingConfig':{'thinkingBudget':0},'responseMimeType':'application/json','responseJsonSchema':schema}}
 req=urllib.request.Request('https://generativelanguage.googleapis.com/v1beta/models/'+MODEL+':generateContent',data=json.dumps(payload).encode(),headers={'x-goog-api-key':KEY,'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=35) as r:data=json.load(r)
 parts=data.get('candidates',[{}])[0].get('content',{}).get('parts',[])
 out=json.loads(''.join(p.get('text','') for p in parts if not p.get('thought')))
 if set(out)!=set(SCHEMA['required']) or out['actionId'] not in opts or type(out['noticed']) is not bool:raise ValueError('output')
 if c['mustNotice'] and not out['noticed']:raise ValueError('attention')
 for field,tag,values in [('interpretations','meaning',['unknown','space','exit','contact','private']),('predictions','behavior',['stay','adjust','reach_out','leave'])]:
  xs=out[field]
  if not isinstance(xs,list) or len(xs)!=3 or len({x['id'] for x in xs})!=3:raise ValueError('options')
  for x in xs:
   if set(x)!={'id','text',tag} or not isinstance(x['id'],str) or not isinstance(x['text'],str) or not x['text'].strip() or len(x['text'])>220 or x[tag] not in values:raise ValueError('option')
 chosen=next((x for x in out['interpretations'] if x['id']==out['interpretationId']),None)
 predicted=next((x for x in out['predictions'] if x['id']==out['predictionId']),None)
 if chosen is None or predicted is None or not isinstance(out['reason'],str) or len(out['reason'])>400:raise ValueError('selection')
 if not out['noticed'] and chosen['meaning']!=c['priorUnderstanding']:raise ValueError('unobserved')
 if out['actionId']=='acknowledge' and not out['noticed']:raise ValueError('contact')
 return out
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def send_json(self,status,data):
  raw=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
 def do_GET(self):
  if self.path=='/api/status':return self.send_json(200,{'ready':bool(KEY),'model':MODEL})
  return super().do_GET()
 def do_POST(self):
  if self.path!='/api/react':return self.send_json(404,{'error':'无此接口'})
  host=self.headers.get('Host','');origin=self.headers.get('Origin')
  if host not in ('127.0.0.1:8766','localhost:8766') or (origin and origin not in ('http://127.0.0.1:8766','http://localhost:8766')):return self.send_json(403,{'error':'仅限本机同源访问'})
  if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.send_json(415,{'error':'需要 JSON'})
  try:n=int(self.headers.get('Content-Length','0'))
  except ValueError:return self.send_json(400,{'error':'请求无效'})
  if n<1 or n>18000:return self.send_json(413,{'error':'请求大小无效'})
  if not GATE.acquire(blocking=False):return self.send_json(429,{'error':'上一次回应仍在处理中，请稍后重试。'})
  try:
   c=json.loads(self.rfile.read(n));out=generate(c);self.send_json(200,{'reply':out,'model':MODEL})
  except urllib.error.HTTPError as e:self.send_json(502,{'error':'Gemini 请求未完成（HTTP '+str(e.code)+'），本轮尚未推进。'})
  except (ValueError,KeyError,TypeError):self.send_json(502,{'error':'回应未通过规则检查，本轮尚未推进，可以重试。'})
  except Exception:self.send_json(502,{'error':'连接未完成，本轮尚未推进，可以重试。'})
  finally:GATE.release()
if __name__=='__main__':
 KEY=os.environ.get('GEMINI_API_KEY') or getpass.getpass('Gemini credential (hidden): ')
 print('Local game: http://127.0.0.1:8766/ | model: '+MODEL,flush=True)
 ThreadingHTTPServer(('127.0.0.1',8766),partial(Handler,directory=str(Path(__file__).parent/'dist'))).serve_forever()
