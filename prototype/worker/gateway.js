const limits=new Map();
const fields=['node','phase','nextNode','ownSituation','ownPosition','playerPosition','environmentNow','ownPreviousAction','playerObservableAction','priorUnderstanding','priorDecision','observedHistory','mustNotice','terminal'];
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
function validateContext(c){
 if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!fields.includes(k)&&k!=='language')||fields.some(k=>!(k in c)))throw Error('context');
 if(!Number.isInteger(c.node)||c.node< -1||c.node>7||!Number.isInteger(c.nextNode)||c.nextNode<0||c.nextNode>7||!['opening','response'].includes(c.phase)||![null,'npc_exit','player_exit'].includes(c.terminal)||typeof c.mustNotice!=='boolean')throw Error('context');
 if(!['zh','en'].includes(c.language||'zh')||!c.ownSituation||Object.keys(c.ownSituation).sort().join()!==['id','stop','agenda','discomfort','phone'].sort().join()||!c.playerObservableAction||Object.keys(c.playerObservableAction).sort().join()!=='id,text')throw Error('context');
 if(!Array.isArray(c.observedHistory)||c.observedHistory.length>8||c.observedHistory.some(e=>Object.keys(e).sort().join()!=='node,observedAction,understanding'))throw Error('context');
 if(c.priorDecision&&Object.keys(c.priorDecision).sort().join()!=='actionId,interpretation,prediction')throw Error('context');
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/api/status')return json({ready:!!env.GEMINI_API_KEY,model:'gemini-2.5-flash'});
 if(url.pathname==='/api/react'){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Same-origin requests only'},403);
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))return json({error:'JSON required'},415);
  if(!env.GEMINI_API_KEY)return json({error:'模型服务暂未配置。'},503);
  const ip=request.headers.get('CF-Connecting-IP')||'unknown',slot=Math.floor(Date.now()/3600000),key=ip+':'+slot;
  if(limits.size>5000)for(const k of limits.keys())if(!k.endsWith(':'+slot))limits.delete(k);
  const count=limits.get(key)||0;if(count>=60)return json({error:'试玩请求较多，请稍后再来。 / Please try again later.'},429);limits.set(key,count+1);
  try{
   const raw=await request.text();if(raw.length>18000)return json({error:'Request too large'},413);
   const c=JSON.parse(raw);validateContext(c);
   const opts=globalThis.WalkGame.legalReactions(c),schema=structuredClone(SCHEMA);schema.properties.actionId.enum=opts;if(c.mustNotice)schema.properties.noticed.enum=[true];
   const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:PROMPT+(c.language==='en'?' Write all option text and reason in concise natural English. The player is they; the NPC is you.':'')}]},contents:[{role:'user',parts:[{text:JSON.stringify({...c,allowedActions:opts.map(id=>({id,meaning:ACTION_GUIDE[id]}))})}]}],generationConfig:{temperature:0.95,maxOutputTokens:1800,thinkingConfig:{thinkingBudget:0},responseMimeType:'application/json',responseJsonSchema:schema}}),signal:AbortSignal.timeout(35000)});
   if(!response.ok)return json({error:'Gemini 暂未完成回应（'+response.status+'）。本轮未推进，可重试。'},502);
   const data=await response.json(),reply=JSON.parse((data.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join(''));
   globalThis.WalkGame.modelResponse(c,reply);return json({reply,model:'gemini-2.5-flash'});
  }catch{return json({error:'这一轮未完成，请重试。 / This turn did not complete. Please retry.'},502);}
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const asset=ASSETS[url.pathname];if(!asset)return new Response('Not found',{status:404});
 return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}};
