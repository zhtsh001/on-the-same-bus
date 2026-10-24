(function(root){
'use strict';
const VERSION='0.4-alternating';
const profiles=[
 {id:'a',stop:6,agenda:'第三站下车，去取修好的眼镜。',discomfort:'外套袖口被雨淋湿了，贴着皮肤。',phone:'维修店发来取件提醒。'},
 {id:'b',stop:8,agenda:'坐到终点，确认换乘站的位置。',discomfort:'久坐后右腿发麻。',phone:'正在查看换乘地图。'},
 {id:'c',stop:8,agenda:'坐到终点，回家。',discomfort:'车窗缝里有冷风。',phone:'家人发来一条普通消息。'}
];
const opt=(id,label)=>({id,label});
const titles=['坐下','倒影','刹车','下一站','脚边','站名','空出的地方','到站'];
const environments=[
 '夜班车。你坐到过道边，把包放上膝盖。\n你还有四站。靠窗坐着一个陌生人。',
 '车离开站台。窗上倒映着你们的身影。',
 '车猛地一刹。扶手在你前方。',
 '车停了一站，又开了。过道暂时空着。',
 '车又晃了一下。一张折过的小票从他的口袋滑到你脚边。',
 '车内报出下一个站名。',
 '东门站过去了。车里空出几个座位。',
 '你的站到了。车门打开。'
];
const actionText={
 glance:'他看了你一眼，视线停了片刻。',
 shift:'他收回手肘，往窗边让了一点。',
 make_room:'他把膝盖收回去，留出过道。',
 fold_phone:'他把手机扣在腿上，转向过道。',
 phone:'他低头，把手机重新翻了过来。',
 check_stop:'他抬头看站名，又扫了一眼你手里的包。',
 stand_aside:'他站起来，侧身留出座位前的空间。',
 sit_back:'他坐回靠窗的位置，把手从扶手上拿开。',
 move_across:'他换到过道另一边，坐下。',
 stay:'他停了一下，没有再动。',
 brace_rail:'他伸出手，越过你的包，抓住扶手。',
 brace_seat:'他按住座椅边，稳住身体。',
 recover_ticket:'他摸了摸口袋，自己捡起小票。没有抬头。',
 wait_ticket:'他低头看了一眼小票，手还停在口袋边。',
 miss:'车声盖过了这一刻。他没有回应。',
 npc_exit:'车到东门。他下车。你留在车上。你们没有说过话。',
 player_exit:'你下车。车门合上，他留在车里。'
};
const kinds=['unknown','space','exit','contact','private'];
const forecasts=['stay','adjust','reach_out','leave'];
function initial(seed=0){return prepare({version:VERSION,seed,profile:{...profiles[Math.abs(seed)%3]},turn:0,impression:'unknown',impressionSource:null,position:'seated',playerPosition:'seated',history:[],opening:null,lastDecision:null,done:false,ending:null});}
function actions(s){switch(s.turn){
 case 0:return [opt('bag','把包收紧，空出手肘的位置'),opt('feet','把脚挪向过道'),opt('window','看向窗外')];
 case 1:return [opt('bag','把包抱到胸前'),opt('feet','侧身，让出过道'),opt('route','抬头看车内路线图')];
 case 2:return [opt('steady','抓住自己的座椅边'),opt('bag','把包往回收'),opt('window','坐稳后，继续看窗外')];
 case 3:return [opt('feet','把腿收回，继续坐着'),opt('stand','抱起包，站起来'),opt('ask','看向他，问：“你是要过去吗？”')];
 case 4:return [opt('return','拾起小票，递向他'),opt('point','朝他指一指地上的小票'),opt('ignore','把脚移开，留着小票')];
 case 5:return [opt('bag','把包重新放稳'),opt('nod','看向他，点一下头'),opt('window','看向窗外'),opt('ask','问：“这站是东门吗？”')];
 case 6:return [opt('space','坐到新空出的座位'),opt('window','留在原处，看窗外'),opt('ask','看向他，问：“刚才是在让我吗？”')];
 case 7:return [opt('leave','拿起包，下车'),opt('thanks','看向他，说：“谢谢。”')];
}}
function predictions(s){if(s.turn===2||s.turn===7)return [];const a=s.lastDecision?.actionId;
 let xs=['他可能在回应我刚才的动作。','他可能只是在处理自己的事。','他可能在等我先动。','现在还判断不出。'];
 if(['stand_aside','make_room'].includes(a))xs=['他准备下车。','他以为我要出去，在给我让路。','他可能只是想站一会儿。','现在还判断不出。'];
 if(['shift','move_across','sit_back'].includes(a))xs=['他可能想留一点距离。','他也许只是在调整坐姿。','他可能在给我腾地方。','现在还判断不出。'];
 if(a==='glance')xs=['他可能想和我说什么。','他可能在看我接下来做什么。','他只是扫了一眼过道。','现在还判断不出。'];
 if(['recover_ticket','wait_ticket'].includes(a))xs=['他看见了脚边的东西。','他是在看我会不会捡。','他可能根本没注意到。','现在还判断不出。'];
 return xs.map((label,i)=>opt('p'+i,label));
}
function prepare(s){return {...s,pending:{title:titles[s.turn],text:environments[s.turn],cue:s.lastDecision?.action||'',actions:actions(s),predictions:predictions(s)}};}
function classify(id){if(['ask','return','point','nod','thanks'].includes(id))return 'reach_out';if(id==='leave')return 'leave';if(['bag','feet','stand','space','steady'].includes(id))return 'adjust';return 'stay';}
function directed(id){return ['ask','return','point','nod','thanks'].includes(id);}
function npcContext(s,actionId=null){
 const opening=actionId===null;
 const a=opening?opt('sit','你坐到过道边，把包放上膝盖。'):s.pending.actions.find(x=>x.id===actionId);if(!a)throw Error('无效动作');
 const terminal=!opening&&!directed(a.id)&&(a.id==='leave'||s.turn+1>=s.profile.stop);
 const nextNode=opening?0:(directed(a.id)||terminal?s.turn:Math.min(s.turn+1,7));
 const last=s.lastDecision;
 return {node:opening?-1:s.turn,phase:opening?'opening':'response',nextNode,ownSituation:{...s.profile},ownPosition:s.position,playerPosition:actionId==='stand'?'standing':actionId==='space'?'across':s.playerPosition,environmentNow:'包属于玩家，小票属于NPC。玩家动作先发生，然后发生以下环境变化，不要把后来的变化当成先前动作的已知原因：'+environments[nextNode].replace('你还有四站。',''),ownPreviousAction:last?.action||null,playerObservableAction:{id:a.id,text:a.label},priorUnderstanding:s.impression,priorDecision:last?{interpretation:last.interpretation,prediction:last.prediction,actionId:last.actionId}:null,observedHistory:s.history.filter(e=>e.npc.after.noticed).map(e=>({node:e.turn,observedAction:e.action.label,understanding:e.npc.after.understanding})),mustNotice:opening||directed(a.id)||!['window','ignore','steady'].includes(a.id)||last?.noticed===false,terminal:terminal?(a.id==='leave'?'player_exit':'npc_exit'):null};
}
function legalReactions(c){
 if(c.terminal)return [c.terminal];
 const id=c.playerObservableAction.id;
 if(directed(id))return ['acknowledge','miss'];
 if(c.nextNode===2)return ['brace_rail','brace_seat'];
 let xs=['glance','make_room','fold_phone','check_stop','stay'];
 if(c.ownPosition==='standing')xs.push('sit_back');else xs.push('shift');
 if(c.nextNode>=3&&c.ownPosition!=='standing')xs.push('stand_aside');
 if(c.nextNode>=6&&c.ownPosition!=='across')xs.push('move_across');
 if(c.nextNode===4)xs.push('wait_ticket');
 if(id==='ignore')return ['recover_ticket'];
 if(c.priorDecision?.actionId!=='phone')xs.push('phone');
 return xs;
}
function acknowledged(c){const id=c.playerObservableAction.id;
 return id==='return'?'他接过小票，看向你：“谢谢。”':id==='point'?'他捡起小票，朝你点头。':id==='nod'?'他看着你，也点了一下头。':id==='thanks'?'他抬头，朝你点头：“不客气。”':c.node===5?'他看向你：“对，东门。”':c.node===6?'他看向你：“你是说刚才吗？”':'他转向你：“怎么了？”';
}
function validateOptions(xs,kind){if(!Array.isArray(xs)||xs.length!==3||new Set(xs.map(x=>x.id)).size!==3)throw Error('模型选项不完整');for(const x of xs){if(typeof x.id!=='string'||typeof x.text!=='string'||!x.text.trim()||x.text.length>220||!(kind==='meaning'?kinds:forecasts).includes(x[kind]))throw Error('模型选项格式不符合要求');}}
function modelResponse(c,m,engine='gemini'){
 if(!m||typeof m.noticed!=='boolean'||(c.mustNotice&&!m.noticed)||!legalReactions(c).includes(m.actionId))throw Error('模型返回了无效行动');
 validateOptions(m.interpretations,'meaning');validateOptions(m.predictions,'behavior');
 const interpretation=m.interpretations.find(x=>x.id===m.interpretationId),prediction=m.predictions.find(x=>x.id===m.predictionId);
 if(!interpretation||!prediction||typeof m.reason!=='string'||m.reason.length>400)throw Error('模型选择不完整');
 if(!m.noticed&&interpretation.meaning!==c.priorUnderstanding)throw Error('没有观察就不能更新对玩家的理解');
 if(m.actionId==='acknowledge'&&!m.noticed)throw Error('未注意到玩家，不能确认联系');
 return {noticed:m.noticed,observation:m.noticed?c.playerObservableAction.text:'',understanding:interpretation.text,interpretations:m.interpretations,interpretation,predictions:m.predictions,prediction,actionOptions:legalReactions(c).map(id=>({id,text:id==='acknowledge'?acknowledged(c):actionText[id]})),actionId:m.actionId,action:m.actionId==='acknowledge'?acknowledged(c):actionText[m.actionId],reason:m.reason,contact:m.actionId==='acknowledge',nextUnderstanding:interpretation.meaning,engine};
}
function offlineResponse(c){
 const id=c.playerObservableAction.id,meaning=directed(id)?'contact':id==='feet'||id==='stand'?'exit':id==='bag'||id==='space'?'space':'private';
 const labels={unknown:'暂时不能确定他的意思。',space:'他可能想留一点自己的空间。',exit:'他可能准备离开座位。',contact:'他的动作是明确对我做的。',private:'他可能只是在处理自己的事。'};
 const alternatives=[meaning,...kinds.filter(x=>x!==meaning)].slice(0,3);
 const choices=legalReactions(c);let actionId=directed(id)?'acknowledge':choices[(Math.abs(c.node+1)*3+id.length)%choices.length];
 return modelResponse(c,{noticed:true,interpretations:alternatives.map((v,i)=>({id:'i'+i,text:labels[v],meaning:v})),interpretationId:'i0',predictions:[{id:'f0',text:'他可能继续坐着，不再回应。',behavior:'stay'},{id:'f1',text:'他可能调整包或姿势。',behavior:'adjust'},{id:'f2',text:'他可能主动向我示意。',behavior:'reach_out'}],predictionId:meaning==='contact'?'f2':'f1',actionId,reason:'依据目前的理解，试着留出回应空间。'},'offline');
}
function applyPosition(s,r){return {...s,position:r.actionId==='stand_aside'?'standing':r.actionId==='sit_back'?'seated':r.actionId==='move_across'?'across':s.position,lastDecision:r,impression:r.nextUnderstanding};}
function applyOpening(s,m=null){if(s.turn!==0||s.history.length||s.opening)throw Error('开场已经发生');const c=npcContext(s),r=m?modelResponse(c,m):offlineResponse(c);return prepare({...applyPosition(s,r),opening:r});}
function step(s,predictionId,actionId,m=null){
 if(s.done)throw Error('已经结束');if(!s.opening)throw Error('先完成开场');
 const q=s.pending,pred=q.predictions.find(x=>x.id===predictionId)||null;
 if(q.predictions.length&&!pred)throw Error('先选择你的理解');if(!q.predictions.length&&predictionId!==null)throw Error('这个节点无需解释');
 const action=q.actions.find(x=>x.id===actionId);if(!action)throw Error('无效动作');
 const c=npcContext(s,actionId),r=m?modelResponse(c,m):offlineResponse(c);
 const event={turn:s.turn,title:q.title,seen:q.text+'\n'+q.cue,prediction:pred,action,npc:{before:s.lastDecision,after:r},predictionFollowup:{expected:s.lastDecision.prediction,actual:action.label,actualBehavior:classify(actionId)},feedback:r.action};
 let ns={...applyPosition(s,r),turn:s.turn+1,history:[...s.history,event],impressionSource:r.nextUnderstanding!==s.impression?s.turn:s.impressionSource,playerPosition:actionId==='stand'?'standing':actionId==='space'?'across':s.playerPosition};
 if(r.contact||c.terminal){ns.done=true;ns.ending={kind:r.contact?'contact':'apart',text:r.action};return {...ns,pending:null};}
 if(ns.turn>=s.profile.stop){ns.done=true;ns.ending={kind:'apart',text:'车到东门。他下车。你留在车上。你们没有说过话。'};event.departure=ns.ending.text;return {...ns,pending:null};}
 return prepare(ns);
}
const api={VERSION,initial,applyOpening,step,npcContext,offlineResponse,legalReactions,modelResponse,classify};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.WalkGame=api;
})(typeof window!=='undefined'?window:globalThis);
