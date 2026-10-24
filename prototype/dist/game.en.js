(function(root){
'use strict';
const VERSION='0.4-alternating';
const profiles=[
 {id:'a',stop:6,agenda:'Get off at the third stop to collect repaired glasses.',discomfort:'A rain-soaked cuff is sticking to his skin.',phone:'The repair shop sent a collection reminder.'},
 {id:'b',stop:8,agenda:'Ride to the terminal and check where to transfer.',discomfort:'His right leg has gone numb from sitting.',phone:'He is checking a transfer map.'},
 {id:'c',stop:8,agenda:'Ride to the terminal, then go home.',discomfort:'Cold air is coming through the window gap.',phone:'A family member sent an ordinary message.'}
];
const opt=(id,label)=>({id,label});
const titles=['Taking a seat','Reflections','The brakes','Between stops','At your feet','The next stop','An empty seat','Your stop'];
const environments=[
 'A night bus. You take the aisle seat, bag on your lap.\nFour stops to go. A stranger sits by the window.',
 'The bus pulls away. Both of you are reflected in the glass.',
 'The bus brakes hard. A handrail is in front of you.',
 'Another stop, then the bus moves again. The aisle is briefly clear.',
 'The bus jolts. A folded receipt slips from his pocket to your feet.',
 'The next stop is announced.',
 'East Gate passes. A few seats are now empty.',
 'Your stop. The doors open.'
];
const actionText={
 glance:'He glances at you and lets his gaze linger.',
 shift:'He draws his elbow in and shifts toward the window.',
 make_room:'He draws his knees back, leaving room to pass.',
 fold_phone:'He puts his phone face down and turns toward the aisle.',
 phone:'He looks down and turns his phone over again.',
 check_stop:'He checks the stop display, then glances at your bag.',
 stand_aside:'He stands and turns sideways, leaving space in front of the seats.',
 sit_back:'He sits back by the window and releases the rail.',
 move_across:'He takes a seat across the aisle.',
 stay:'He pauses and stays where he is.',
 brace_rail:'He reaches past your bag and grabs the rail.',
 brace_seat:'He braces against the edge of the seat.',
 recover_ticket:'He checks his pocket and picks up the receipt without looking up.',
 wait_ticket:'He glances down at the receipt, his hand still by his pocket.',
 miss:'The noise of the bus swallows the moment. He does not respond.',
 npc_exit:'At East Gate, he gets off. You stay on the bus. Neither of you has spoken to the other.',
 player_exit:'You step off. The doors close. He stays on the bus.'
};
const kinds=['unknown','space','exit','contact','private'];
const forecasts=['stay','adjust','reach_out','leave'];
function initial(seed=0){return prepare({version:VERSION,seed,profile:{...profiles[Math.abs(seed)%3]},turn:0,impression:'unknown',impressionSource:null,position:'seated',playerPosition:'seated',history:[],opening:null,lastDecision:null,done:false,ending:null});}
function actions(s){switch(s.turn){
 case 0:return [opt('bag','Pull your bag in, leaving room for an elbow'),opt('feet','Move your feet toward the aisle'),opt('window','Look out the window')];
 case 1:return [opt('bag','Hold your bag against your chest'),opt('feet','Turn sideways to clear the aisle'),opt('route','Look up at the route map')];
 case 2:return [opt('steady','Grip the edge of your seat'),opt('bag','Pull your bag back'),opt('window','Settle back and keep looking out the window')];
 case 3:return [opt('feet','Pull your legs in and stay seated'),opt('stand','Pick up your bag and stand.'),opt('ask','Look at him and ask, “Do you need to get past?”')];
 case 4:return [opt('return','Pick up the receipt and hold it out to him'),opt('point','Point out the receipt on the floor'),opt('ignore','Move your feet away and leave the receipt')];
 case 5:return [opt('bag','Set your bag securely on your lap'),opt('nod','Look at him and nod'),opt('window','Look out the window'),opt('ask','Ask, “Is this East Gate?”')];
 case 6:return [opt('space','Move to an empty seat'),opt('window','Stay where you are and look outside'),opt('ask','Look at him and ask, “Were you making room for me?”')];
 case 7:return [opt('leave','Take your bag and get off'),opt('thanks','Look at him and say, “Thanks.”')];
}}
function predictions(s){if(s.turn===2||s.turn===7)return [];const a=s.lastDecision?.actionId;
 let xs=['He might be responding to what I just did.','He might just be dealing with something of his own.','He might be waiting for me to move first.','I cannot tell yet.'];
 if(['stand_aside','make_room'].includes(a))xs=['He is getting ready to leave.','He thinks I want to get out and is making room.','He might just want to stand for a while.','I cannot tell yet.'];
 if(['shift','move_across','sit_back'].includes(a))xs=['He might want some space.','He might just be getting comfortable.','He might be making room for me.','I cannot tell yet.'];
 if(a==='glance')xs=['He might want to say something to me.','He might be watching what I do next.','He just glanced at the aisle.','I cannot tell yet.'];
 if(['recover_ticket','wait_ticket'].includes(a))xs=['He has noticed something on the floor.','He is waiting to see whether I pick it up.','He might not have noticed at all.','I cannot tell yet.'];
 return xs.map((label,i)=>opt('p'+i,label));
}
function prepare(s){return {...s,pending:{title:titles[s.turn],text:environments[s.turn],cue:s.lastDecision?.action||'',actions:actions(s),predictions:predictions(s)}};}
function classify(id){if(['ask','return','point','nod','thanks'].includes(id))return 'reach_out';if(id==='leave')return 'leave';if(['bag','feet','stand','space','steady'].includes(id))return 'adjust';return 'stay';}
function directed(id){return ['ask','return','point','nod','thanks'].includes(id);}
function npcContext(s,actionId=null){
 const opening=actionId===null;
 const a=opening?opt('sit','You take the aisle seat and put your bag on your lap.'):s.pending.actions.find(x=>x.id===actionId);if(!a)throw Error('Invalid action');
 const terminal=!opening&&!directed(a.id)&&(a.id==='leave'||s.turn+1>=s.profile.stop);
 const nextNode=opening?0:(directed(a.id)||terminal?s.turn:Math.min(s.turn+1,7));
 const last=s.lastDecision;
 return {language:'en',node:opening?-1:s.turn,phase:opening?'opening':'response',nextNode,ownSituation:{...s.profile},ownPosition:s.position,playerPosition:actionId==='stand'?'standing':actionId==='space'?'across':s.playerPosition,environmentNow:'The bag belongs to the player; the receipt belongs to the NPC. The player acts first, then the following environment develops. Do not treat a later event as the known cause of their earlier action: '+environments[nextNode].replace('Four stops to go.',''),ownPreviousAction:last?.action||null,playerObservableAction:{id:a.id,text:a.label},priorUnderstanding:s.impression,priorDecision:last?{interpretation:last.interpretation,prediction:last.prediction,actionId:last.actionId}:null,observedHistory:s.history.filter(e=>e.npc.after.noticed).map(e=>({node:e.turn,observedAction:e.action.label,understanding:e.npc.after.understanding})),mustNotice:opening||directed(a.id)||!['window','ignore','steady'].includes(a.id)||last?.noticed===false,terminal:terminal?(a.id==='leave'?'player_exit':'npc_exit'):null};
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
 return id==='return'?'He takes the receipt and looks at you. “Thanks.”':id==='point'?'He picks up the receipt and nods to you.':id==='nod'?'He looks at you and nods back.':id==='thanks'?'He looks up and nods. “No problem.”':c.node===5?'He looks at you. “Yes, East Gate.”':c.node===6?'He looks at you. “Do you mean just now?”':'He turns to you. “What is it?”';
}
function validateOptions(xs,kind){if(!Array.isArray(xs)||xs.length!==3||new Set(xs.map(x=>x.id)).size!==3)throw Error('The response has an incomplete set of options.');for(const x of xs){if(typeof x.id!=='string'||typeof x.text!=='string'||!x.text.trim()||x.text.length>220||!(kind==='meaning'?kinds:forecasts).includes(x[kind]))throw Error('The option format could not be validated.');}}
function modelResponse(c,m,engine='gemini'){
 if(!m||typeof m.noticed!=='boolean'||(c.mustNotice&&!m.noticed)||!legalReactions(c).includes(m.actionId))throw Error('The response contained an invalid action.');
 validateOptions(m.interpretations,'meaning');validateOptions(m.predictions,'behavior');
 const interpretation=m.interpretations.find(x=>x.id===m.interpretationId),prediction=m.predictions.find(x=>x.id===m.predictionId);
 if(!interpretation||!prediction||typeof m.reason!=='string'||m.reason.length>400)throw Error('The response has an incomplete selection.');
 if(!m.noticed&&interpretation.meaning!==c.priorUnderstanding)throw Error('Understanding cannot change without an observation.');
 if(m.actionId==='acknowledge'&&!m.noticed)throw Error('Contact requires a noticed gesture.');
 return {noticed:m.noticed,observation:m.noticed?c.playerObservableAction.text:'',understanding:interpretation.text,interpretations:m.interpretations,interpretation,predictions:m.predictions,prediction,actionOptions:legalReactions(c).map(id=>({id,text:id==='acknowledge'?acknowledged(c):actionText[id]})),actionId:m.actionId,action:m.actionId==='acknowledge'?acknowledged(c):actionText[m.actionId],reason:m.reason,contact:m.actionId==='acknowledge',nextUnderstanding:interpretation.meaning,engine};
}
function offlineResponse(c){
 const id=c.playerObservableAction.id,meaning=directed(id)?'contact':id==='feet'||id==='stand'?'exit':id==='bag'||id==='space'?'space':'private';
 const labels={unknown:'I cannot tell what they mean yet.',space:'They might want some space of their own.',exit:'They might be about to leave their seat.',contact:'That gesture was clearly directed at me.',private:'He might just be dealing with something of his own.'};
 const alternatives=[meaning,...kinds.filter(x=>x!==meaning)].slice(0,3);
 const choices=legalReactions(c);let actionId=directed(id)?'acknowledge':choices[(Math.abs(c.node+1)*3+id.length)%choices.length];
 return modelResponse(c,{noticed:true,interpretations:alternatives.map((v,i)=>({id:'i'+i,text:labels[v],meaning:v})),interpretationId:'i0',predictions:[{id:'f0',text:'They might stay seated without responding.',behavior:'stay'},{id:'f1',text:'They might adjust their bag or position.',behavior:'adjust'},{id:'f2',text:'They might make a gesture toward me.',behavior:'reach_out'}],predictionId:meaning==='contact'?'f2':'f1',actionId,reason:'Based on this reading, leave room for a response.'},'offline');
}
function applyPosition(s,r){return {...s,position:r.actionId==='stand_aside'?'standing':r.actionId==='sit_back'?'seated':r.actionId==='move_across'?'across':s.position,lastDecision:r,impression:r.nextUnderstanding};}
function applyOpening(s,m=null){if(s.turn!==0||s.history.length||s.opening)throw Error('The opening has already happened.');const c=npcContext(s),r=m?modelResponse(c,m):offlineResponse(c);return prepare({...applyPosition(s,r),opening:r});}
function step(s,predictionId,actionId,m=null){
 if(s.done)throw Error('This encounter has ended.');if(!s.opening)throw Error('Complete the opening first.');
 const q=s.pending,pred=q.predictions.find(x=>x.id===predictionId)||null;
 if(q.predictions.length&&!pred)throw Error('Choose an interpretation first.');if(!q.predictions.length&&predictionId!==null)throw Error('This moment does not require an interpretation.');
 const action=q.actions.find(x=>x.id===actionId);if(!action)throw Error('Invalid action');
 const c=npcContext(s,actionId),r=m?modelResponse(c,m):offlineResponse(c);
 const event={turn:s.turn,title:q.title,seen:q.text+'\n'+q.cue,prediction:pred,action,npc:{before:s.lastDecision,after:r},predictionFollowup:{expected:s.lastDecision.prediction,actual:action.label,actualBehavior:classify(actionId)},feedback:r.action};
 let ns={...applyPosition(s,r),turn:s.turn+1,history:[...s.history,event],impressionSource:r.nextUnderstanding!==s.impression?s.turn:s.impressionSource,playerPosition:actionId==='stand'?'standing':actionId==='space'?'across':s.playerPosition};
 if(r.contact||c.terminal){ns.done=true;ns.ending={kind:r.contact?'contact':'apart',text:r.action};return {...ns,pending:null};}
 if(ns.turn>=s.profile.stop){ns.done=true;ns.ending={kind:'apart',text:'At East Gate, he gets off. You stay on the bus. Neither of you has spoken to the other.'};event.departure=ns.ending.text;return {...ns,pending:null};}
 return prepare(ns);
}
const api={VERSION,initial,applyOpening,step,npcContext,offlineResponse,legalReactions,modelResponse,classify};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.WalkGame=api;
})(typeof window!=='undefined'?window:globalThis);
