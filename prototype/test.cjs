const assert=require('node:assert/strict'),G=require('./dist/game.js');
const raw=r=>({noticed:r.noticed,interpretations:r.interpretations,interpretationId:r.interpretation.id,predictions:r.predictions,predictionId:r.prediction.id,actionId:r.actionId,reason:r.reason});
let states=0,choices=0,contacts=0,departures=0,contexts=[];
for(let seed=0;seed<3;seed++){
 let frontier=[G.applyOpening(G.initial(seed))];
 while(frontier.length){const next=new Map();for(const s of frontier){states++;assert.equal(s.pending.cue,s.lastDecision.action);assert(s.opening);for(const a of s.pending.actions){
  const context=G.npcContext(s,a.id);contexts.push({...context,expected:G.legalReactions(context)});
  assert(!JSON.stringify(context).includes('predictionId'));assert(!('prediction' in context));
  const source=JSON.stringify(s);let comparison=null;
  for(const p of s.pending.predictions.length?s.pending.predictions.map(x=>x.id):[null]){
   const n=G.step(s,p,a.id),r=n.history.at(-1).npc.after;choices++;assert.equal(JSON.stringify(s),source);
   assert.equal(r.interpretations.length,3);assert.equal(r.predictions.length,3);assert(r.actionOptions.some(x=>x.id===r.actionId));
   const result={r,impression:n.impression,pending:n.pending,ending:n.ending};if(comparison)assert.deepEqual(result,comparison);comparison=result;
   if(n.done){if(n.ending.kind==='contact')contacts++;else departures++;assert.throws(()=>G.step(n,null,a.id));}
   else{assert.equal(n.pending.cue,r.action,'NPC 行动必须直接成为下一次所见，不能被预写动作替换');const key=JSON.stringify([n.seed,n.turn,n.impression,n.impressionSource,n.position,n.playerPosition,n.lastDecision.actionId]);next.set(key,n);}
  }
  const valid=raw(G.offlineResponse(context));
  assert.throws(()=>G.step(s,s.pending.predictions[0]?.id??null,a.id,{...valid,actionId:'invented'}));
  assert.throws(()=>G.step(s,s.pending.predictions[0]?.id??null,a.id,{...valid,interpretationId:'invented'}));
  if(context.mustNotice)assert.throws(()=>G.step(s,s.pending.predictions[0]?.id??null,a.id,{...valid,noticed:false}));
 }}frontier=[...next.values()];}
}
const initial=G.initial();assert.throws(()=>G.step(initial,'p0','bag'));const opened=G.applyOpening(initial);assert.throws(()=>G.applyOpening(opened));
const passive={...opened,lastDecision:{...opened.lastDecision,noticed:false}};assert.equal(G.npcContext(passive,'window').mustNotice,true);
const c=G.npcContext(opened,'bag'),v=raw(G.offlineResponse(c));v.noticed=false;assert.throws(()=>G.modelResponse(c,v));
assert(contacts>0&&departures>0);
require('fs').writeFileSync(require('path').join(require('os').tmpdir(),'bus-context-tests.json'),JSON.stringify(contexts));
console.log(JSON.stringify({states,choices,contacts,departures,checks:'交错回合、候选与选择记录、信息隔离、注意力约束、非法动作、即时结束、历史保留通过'},null,2));
