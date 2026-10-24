const G=window.WalkGame,view=document.getElementById('view'),restart=document.getElementById('restart');
let state=null,phase='intro',prediction=null,snapshots=[],seed=0,mode='checking',requestVersion=0,lastAction=null;
const modeReady=fetch('/api/status').then(r=>r.ok?r.json():null).then(x=>{mode=x?.ready?'gemini':'offline';return mode;}).catch(()=>{mode='offline';return mode;});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function show(html){view.innerHTML=html;view.focus({preventScroll:true});window.scrollTo(0,0);}
function intro(){requestVersion++;phase='intro';state=null;snapshots=[];restart.hidden=true;show('<p class="eyebrow">中文 · 文字行动原型 0.4</p><h1>同车</h1><p class="lead">夜班车。你还有四站。</p><p class="muted">有时先选一个暂时的理解，再决定做什么。<br>理解不是答案，也不会被对方听见。</p><button class="primary" data-do="start">上车</button><p class="muted"><span id="mode-label">'+(mode==='gemini'?'Gemini 已连接 · 仅发送可观察动作':mode==='offline'?'离线规则试玩 · 本机模型服务未连接':'正在检查本机模型连接…')+'</span></p>');}
async function start(){await modeReady;seed=Math.floor(Math.random()*3);state=G.initial(seed);snapshots=[];restart.hidden=false;await perform(null);}
function enter(){prediction=null;phase=state.pending.predictions.length?'interpret':'action';render();}
function render(){const q=state.pending,last=state.history.at(-1),choices=phase==='interpret'?q.predictions:q.actions;show(`${last?`<div class="previous"><span>你刚才</span><p>${esc(last.action.label)}</p></div>`:''}<p class="eyebrow">${String(state.turn+1).padStart(2,'0')} · ${esc(q.title)}</p><p class="scene-text">${esc(q.text)}</p><p class="npc-action">${esc(q.cue)}</p>${phase==='interpret'?'<h3>你暂时怎么理解？</h3>':prediction?`<div class="prediction"><span class="label">你的暂时理解</span><p>${esc(prediction.label)}</p><button class="minor" data-do="rethink">换一种理解</button></div><h3>你做什么？</h3>`:'<h3>你做什么？</h3>'}<div class="choices">${choices.map((c,i)=>`<button data-pick="${c.id}"><span class="key">${i+1}</span>${esc(c.label)}</button>`).join('')}</div>`);}
async function pick(id){if(phase==='interpret'){prediction=state.pending.predictions.find(x=>x.id===id);if(!prediction)return;phase='action';render();return;}if(phase==='action')await perform(id);}
async function perform(id){
 const before=state,p=prediction?.id??null,version=requestVersion;lastAction=id;
 phase='waiting';show('<p class="muted">正在生成这一轮回应。等待时间不计入故事。</p>');
 try{
  let reply=null;
  if(mode==='gemini'){
   const response=await fetch('/api/react',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(G.npcContext(before,id)),signal:AbortSignal.timeout(45000)});
   const data=await response.json();if(!response.ok)throw Error(data.error||'回应未完成。');reply=data.reply;
  }
  if(version!==requestVersion)return;
  if(id===null)state=G.applyOpening(before,reply);
  else{const next=G.step(before,p,id,reply);snapshots[before.turn]=before;state=next;}
 }catch(error){if(version!==requestVersion)return;phase='error';show('<h2>这一轮还没有发生</h2><p>'+esc(error.message)+'</p><div class="choices"><button data-do="retry">重试这次动作</button>'+(id===null?'':'<button data-do="back-action">返回动作选择</button>')+'</div>');return;}
 state.done?ending():enter();
}
function ending(){phase='ending';show(`<p class="eyebrow">${state.ending.kind==='contact'?'你们确认了彼此':'各自的路'}</p><h1>${state.ending.kind==='contact'?'说到这里':'没有说上话'}</h1><p class="lead">${esc(state.ending.text)}</p><p class="muted">这段经历到这里结束。</p><div class="choices"><button class="primary" data-do="recap">回看双方的每一个片段</button><button data-do="restart">重新上车</button></div>`);}
function optionsList(xs,selected){return '<ul class="facts">'+xs.map(x=>`<li>${x.id===selected?'✓ ':''}${esc(x.text)}${x.id===selected?' <strong>实际选择</strong>':''}</li>`).join('')+'</ul>';}
function decision(r,nextAction){return `<p><strong>他注意到了什么</strong><br>${esc(r.observation||'没有注意到你的这次动作。')}</p><p><strong>他采用的解释</strong><br>${esc(r.interpretation.text)}</p><details><summary>当时的三个解释选项</summary>${optionsList(r.interpretations,r.interpretation.id)}</details><p><strong>他预测你接下来会</strong><br>${esc(r.prediction.text)}</p><details><summary>当时的三个预测选项</summary>${optionsList(r.predictions,r.prediction.id)}</details><p><strong>他选择的行动</strong><br>${esc(r.action)}</p><details><summary>当时可采取的行动</summary>${optionsList(r.actionOptions,r.actionId)}</details><p><strong>选择的依据</strong><br>${esc(r.reason)}</p><p class="muted">${nextAction?'你后来实际做的是：'+esc(nextAction):'故事已结束，这个预测没有再被检验。'}</p>`;}
function record(e){return `<article class="record"><h3>${String(e.turn+1).padStart(2,'0')} · ${esc(e.title)}</h3><p class="muted">${esc(e.seen)}</p><div class="compare"><div><span class="label">你这边</span><p><strong>当时的理解</strong><br>${esc(e.prediction?.label??'这个过渡节点没有记录解释。')}</p><p><strong>实际动作</strong><br>${esc(e.action.label)}</p></div><div><span class="label">接下来，他的完整一轮</span>${decision(e.npc.after,state.history[e.turn+1]?.action.label)}</div></div>${e.departure?`<p>${esc(e.departure)}</p>`:''}<button class="revisit" data-revisit="${e.turn}">回到这一刻</button></article>`;}
function recap(){phase='recap';show(`<p class="eyebrow">同一段经历 · 交错的两份记录</p><h1>各自看见的</h1><p class="muted">你的解释没有传给他。候选解释、预测和行动都是当时保存的选项；勾选项是他实际采用的那一个。</p><article class="record"><h3>开场：他先看见你坐下</h3>${decision(state.opening,state.history[0]?.action.label)}</article>${state.history.map(record).join('')}<div class="choices"><button data-do="download">保存完整记录</button><button data-do="restart">重新上车</button></div>`);}
function revisit(n){if(phase!=='recap'||!snapshots[n])return;requestVersion++;state=snapshots[n];snapshots=snapshots.slice(0,n);enter();}
function download(){const blob=new Blob([JSON.stringify({version:G.VERSION,mode,seed,initialNpcFacts:state.profile,ending:state.ending,opening:state.opening,nodes:state.history},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='同车-双方过程记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
view.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.pick)pick(b.dataset.pick);else if(b.dataset.revisit!==undefined)revisit(Number(b.dataset.revisit));else switch(b.dataset.do){case'start':start();break;case'retry':perform(lastAction);break;case'back-action':phase='action';render();break;case'rethink':phase='interpret';render();break;case'recap':recap();break;case'download':download();break;case'restart':intro();break;}});
document.addEventListener('keydown',e=>{if(!['interpret','action'].includes(phase)||e.repeat||e.metaKey||e.ctrlKey||e.altKey||!['1','2','3','4'].includes(e.key))return;const xs=phase==='interpret'?state.pending.predictions:state.pending.actions;const c=xs[Number(e.key)-1];if(c){e.preventDefault();pick(c.id);}});
restart.onclick=()=>{if(confirm('清除本局，重新上车？'))intro();};intro();

modeReady.then(()=>{const el=document.getElementById('mode-label');if(el)el.textContent=mode==='gemini'?'Gemini 已连接 · 仅发送可观察动作':'离线规则试玩 · 本机模型服务未连接';});
