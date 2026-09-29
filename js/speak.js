/* Speak Studio — Pronunciation Lab, Daily Challenge, Roleplays, Stories, Stats, Mistake Repair.
   All client-side, offline-first. Speech recognition uses the browser's built-in
   voice typing (may need network on some devices); every flow has an offline fallback. */
(function(){
const {el,esc,toast,confetti,modal,xpToast}=UI;

/* ================= speech helpers ================= */
function srAvailable(){return !!(window.SpeechRecognition||window.webkitSpeechRecognition);}
function runSR(timeoutMs){
  return new Promise((res,rej)=>{
    const C=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!C){rej(new Error('no-sr'));return;}
    let got=false;
    const rec=new C();rec.lang='en-US';rec.interimResults=false;rec.maxAlternatives=3;
    const t0=performance.now();
    const timer=setTimeout(()=>{try{rec.stop();}catch(e){}},timeoutMs||15000);
    rec.onresult=e=>{
      got=true;clearTimeout(timer);
      const secs=Math.max(1,(performance.now()-t0)/1000);
      const alts=[];const r0=e.results[0];
      for(let i=0;i<r0.length;i++)alts.push(r0[i].transcript);
      try{rec.stop();}catch(e2){}
      res({alts,secs,best:alts[0]||''});
    };
    rec.onerror=e=>{clearTimeout(timer);rej(new Error(e.error||'sr-error'));};
    rec.onend=()=>{clearTimeout(timer);if(!got)rej(new Error('no-speech'));};
    try{rec.start();}catch(e){clearTimeout(timer);rej(e);}
  });
}
function toks(s){return String(s||'').toLowerCase().replace(/[^a-z'\s]/g,' ').split(/\s+/).filter(Boolean);}
/* word-level diff: greedy multiset match of target words in what was heard */
function wordDiff(target,heard){
  const T=toks(target),H=toks(heard);
  const hc={};H.forEach(w=>{hc[w]=(hc[w]||0)+1;});
  const words=T.map(w=>{const ok=(hc[w]||0)>0;if(ok)hc[w]--;return{w,ok};});
  const extra=[];Object.keys(hc).forEach(w=>{for(let i=0;i<hc[w];i++)extra.push(w);});
  const hits=words.filter(x=>x.ok).length;
  return{words,extra,score:T.length?Math.round(hits/T.length*100):0,heard:(heard||'').trim()};
}
const FILLER_WORDS=['um','uh','er','ah','hmm','like','actually','basically'];
const FILLER_PHRASES=['you know','i mean'];
function countFillers(text){
  const words=toks(text);let n=0;
  words.forEach(w=>{if(FILLER_WORDS.includes(w))n++;});
  const joined=' '+words.join(' ')+' ';
  FILLER_PHRASES.forEach(p=>{const m=joined.match(new RegExp(' '+p+' ','g'));if(m)n+=m.length;});
  return n;
}
function saveSpeakStat(st){
  const S=Store.S;S.speakStats=S.speakStats||[];
  S.speakStats.unshift({ts:Date.now(),...st});
  if(S.speakStats.length>200)S.speakStats.length=200;
  Store.save();
}
function srNote(){
  return `<p class="small dim">${UI.icon('mic','in-tx')} Speech check uses your browser's built-in voice typing — on some phones it needs internet. No internet? Use the record + self-check option instead. Your audio never leaves this device except for the transcription itself.</p>`;
}

/* ================= deterministic daily challenge ================= */
function hashSeed(s){let h=2166136261;for(const ch of s){h^=ch.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry(seed){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function dailyPlan(){
  const date=Store.todayStr();
  const r=mulberry(hashSeed('speak-daily-'+date));
  const bank=Content.cache.practice||{};
  const lessonDrills=Content.allDrills();
  const poolOf=e=>[...(bank[e]||[]).map(d=>({...d,engine:e})),
    ...lessonDrills.filter(d=>d.engine===e).map(d=>({...d,engine:e}))];
  const pick=(arr)=>arr.length?arr[Math.floor(r()*arr.length)]:null;
  const aliasSpeak=(bank['speak']||[]).map(d=>({...d,engine:'speaking-task'}));
  const pronSets=(Content.cache.pron&&Content.cache.pron.sets)||[];
  const tasks=(Content.cache.taskcards||[]).filter(t=>t.kind!=='journal');
  const items=[];
  const f1=pick(poolOf('fix-sentence'));if(f1)items.push({kind:'drill',engine:'fix-sentence',icon:'write',label:'Fix the sentence',step:f1});
  const f2=pick(poolOf('fix-sentence'));if(f2&&f2!==f1)items.push({kind:'drill',engine:'fix-sentence',icon:'write',label:'Fix the sentence',step:f2});
  const fb=pick(poolOf('fill-blank'));if(fb)items.push({kind:'drill',engine:'fill-blank',icon:'write',label:'Fill the blank',step:fb});
  const mc=pick(poolOf('multiple-choice'));if(mc)items.push({kind:'drill',engine:'multiple-choice',icon:'target',label:'Multiple choice',step:mc});
  if(pronSets.length){const ps=pronSets[Math.floor(r()*pronSets.length)];items.push({kind:'pron',icon:'target',label:'Pronunciation: '+ps.title,setId:ps.id});}
  const tk=pick(tasks.length?tasks:aliasSpeak);if(tk)items.push({kind:'task',icon:'mic',label:'Speaking task',task:tk});
  return{date,items:items.slice(0,6)};
}
function dailyState(){
  const S=Store.S;S.dailyDone=S.dailyDone||{};
  const plan=dailyPlan();
  let st=S.dailyDone[plan.date];
  if(!st||!st.items||st.items.length!==plan.items.length){st={items:plan.items.map(()=>false),bonus:false};S.dailyDone[plan.date]=st;Store.save();}
  return{plan,st};
}

/* ================= HUB ================= */
function hubCard(icon,title,sub,go,extra){
  return `<div class="card" style="cursor:pointer" data-go="${go}">
    <div class="row" style="justify-content:space-between;align-items:center">
      <div><div style="font-size:22px">${icon}</div><b>${esc(title)}</b>
      <div class="small dim" style="margin-top:4px">${sub}</div></div>
      <div style="font-size:22px;color:var(--dim)">→</div></div>
    ${extra||''}</div>`;
}
function home(root){
  const S=Store.S;
  const {plan,st}=dailyState();
  const doneCount=st.items.filter(Boolean).length;
  const errs=(S.errorLog||[]).filter(e=>!e.reviewed).length;
  const intens=S.intensity||'balanced';
  const pronSets=(Content.cache.pron&&Content.cache.pron.sets||[]).length;
  const scenCount=(Content.cache.scenarios&&Content.cache.scenarios.scenarios||[]).length;
  const storyCount=(Content.cache.stories&&Content.cache.stories.stories||[]).length;
  root.innerHTML=`
    <div class="greet">Speak Studio ${UI.icon('mic','in-tx')}</div>
    <p class="sub">Pronunciation, real conversations, stories — the speaking gym.</p>
    ${hubCard(UI.icon('calendar','in-tx'),'Daily Challenge',st.bonus?'✅ Done for today — see you tomorrow!':`${doneCount}/${plan.items.length} done today · +50 XP bonus`, '#/speak/daily',
      st.bonus?'':'<div class="lprog" style="margin-top:10px"><i style="width:'+(doneCount/plan.items.length*100)+'%"></i></div>')}
    ${hubCard(UI.icon('target','in-tx'),'Pronunciation Lab',pronSets+' sets · word-level feedback · retry until it clicks','#/speak/pron')}
    ${hubCard(UI.icon('roleplay','in-tx'),'Roleplay Scenarios',scenCount+' offline conversations · job, travel, clients, IELTS','#/speak/roleplay')}
    ${hubCard(UI.icon('read','in-tx'),'Interactive Stories',storyCount+' stories · tap any word · save expressions','#/speak/stories')}
    ${hubCard(UI.icon('write','in-tx'),'Mistake Repair',errs?errs+' mistakes waiting to be fixed':'All clear — mistakes you make land here','#/speak/repair')}
    ${hubCard(UI.icon('progress','in-tx'),'Speaking Stats','WPM · accuracy · your weekly self-league','#/speak/stats')}
    <div class="card"><div class="kicker">Roleplay feedback style</div>
      <p class="small dim" style="margin:6px 0 10px">How direct should the coach be in roleplays? (Praktika-style)</p>
      <div class="row" style="gap:8px">
        ${[['soft',UI.icon('star','in-tx')+' Soft'],['balanced','⚖️ Balanced'],['strict',UI.icon('target','in-tx')+' Strict']].map(([v,l])=>
          `<button class="btn ghost intens${intens===v?' sel':''}" data-i="${v}" style="flex:1">${l}</button>`).join('')}
      </div></div>
    <button class="btn ghost mt" data-go="#/practice" style="width:100%">← Back to Drill Arena</button>`;
  root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>location.hash=b.dataset.go);
  root.querySelectorAll('.intens').forEach(b=>b.onclick=()=>{
    Store.S.intensity=b.dataset.i;Store.save();toast('Feedback style: '+b.dataset.i+' ✓');home(root);
  });
}

/* ================= DAILY CHALLENGE ================= */
function daily(root){
  const {plan,st}=dailyState();
  const allDone=st.items.every(Boolean);
  function render(){
    let html=`<div class="greet">Daily Challenge ${UI.icon('calendar','in-tx')}</div>
      <p class="sub">${plan.date} · finish all ${plan.items.length} for <b>+50 XP bonus</b>.</p>
      <div class="lprog"><i style="width:${st.items.filter(Boolean).length/plan.items.length*100}%"></i></div>
      <div class="small dim" style="margin:6px 0 14px">${st.items.filter(Boolean).length}/${plan.items.length} complete${st.bonus?' · ✅ bonus claimed':''}</div>
      <div id="d-items"></div><div id="d-stage"></div>
      <button class="btn ghost mt" data-go="#/speak" style="width:auto;padding:9px 16px">← Speak Studio</button>`;
    root.innerHTML=html;
    root.querySelector('[data-go]').onclick=e=>location.hash='#/speak';
    const box=root.querySelector('#d-items');
    plan.items.forEach((it,i)=>{
      const done=st.items[i];
      const row=el(`<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;${done?'opacity:.65':''}">
        <div><b>${UI.icon(it.icon||'star','in-tx')} ${done?'✅ ':''}${esc(it.label)}</b>
        <div class="small dim">${it.kind==='drill'?'quick drill':it.kind==='pron'?'5 lines · speak aloud':it.kind==='task'?'record yourself':''}</div></div>
        ${done?'':`<button class="btn" style="width:auto;padding:10px 18px" data-i="${i}">Start →</button>`}</div>`);
      box.appendChild(row);
    });
    box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>startItem(+b.dataset.i));
    if(allDone&&!st.bonus){
      st.bonus=true;Store.save();Store.addXP(50);Store.checkBadges();confetti(130);
      toast(UI.icon('calendar','in-tx')+' Daily Challenge complete! +50 XP bonus '+UI.icon('party','in-tx'),3400);render();return;
    }
    if(allDone&&st.bonus){
      const c=el(`<div class="card center" style="border:1.5px solid var(--acc)"><div style="font-size:40px">${UI.icon('trophy','in-tx')}</div>
        <b>Challenge complete!</b><p class="small dim">Come back tomorrow for a fresh set.</p></div>`);
      root.querySelector('#d-stage').appendChild(c);
    }
  }
  function markDone(i){st.items[i]=true;Store.save();Store.checkBadges();render();window.scrollTo({top:0});}
  function startItem(i){
    const it=plan.items[i],stage=root.querySelector('#d-stage');
    stage.innerHTML='';window.scrollTo({top:0});
    if(it.kind==='drill'){
      stage.appendChild(el(`<div class="step-tag">Daily · ${UI.icon(it.icon||'star','in-tx')} ${esc(it.label)}</div><div id="dd"></div>`));
      const api={award:n=>{Store.addXP(n||10);xpToast(n||10);},
        logError:e=>Store.logError({module:'daily',lesson:'',...e}),
        done:()=>markDone(i)};
      Drills.mount(it.engine,{...it.step,uid:'daily:'+plan.date+':'+i},stage.querySelector('#dd'),api);
    }else if(it.kind==='pron'){
      location.hash='#/speak/pron/'+it.setId;
      toast('Finish the set — it counts toward your daily ✓',3000);
    }else if(it.kind==='task'){
      const t=it.task;
      stage.appendChild(el(`<div class="step-tag">Daily · ${esc(it.label)}</div><div id="dd"></div>`));
      const step=t.id?{engine:'speaking-task',id:t.id,title:t.title,prompt:t.prompt,model:t.model,script:t.script,checklist:t.checklist,tip:t.tip,seconds:t.seconds,xp:25}
                     :{...t,engine:'speaking-task'};
      const api={award:n=>{Store.addXP(n||25);xpToast(n||25);Store.S.speakingDone++;Store.save();},
        logError:e=>Store.logError({module:'daily',...e}),
        done:()=>markDone(i)};
      Drills.mount('speaking-task',step,stage.querySelector('#dd'),api);
    }
  }
  render();
}

/* ================= PRONUNCIATION LAB ================= */
function pronList(root){
  const sets=(Content.cache.pron&&Content.cache.pron.sets)||[];
  const best=Store.S.pronBest||{};
  root.innerHTML=`<div class="greet">Pronunciation Lab ${UI.icon('target','in-tx')}</div>
    <p class="sub">Hear the model → say it → get word-level feedback → retry. Built for Urdu/Punjabi speakers.</p>
    ${srAvailable()?'':`<div class="card" style="border:1.5px solid var(--amber)"><b>⚠️ No speech check on this device</b><p class="small dim" style="margin:6px 0 0">Your browser doesn't support voice typing here — the lab still works with <b>record + self-check</b>.</p></div>`}
    <div>${sets.map(s=>{const b=best[s.id];
      return `<div class="card" style="cursor:pointer" data-s="${s.id}">
        <div class="row" style="justify-content:space-between;align-items:center">
          <div><div style="font-size:22px">${s.icon}</div><b>${esc(s.title)}</b>
          <div class="small dim" style="margin-top:4px">${esc(s.focus)} · ${s.lines.length} lines</div></div>
          ${b?`<span class="chip">${b}% best</span>`:'<span style="font-size:22px;color:var(--dim)">→</span>'}</div></div>`;}).join('')}</div>
    ${srNote()}
    <button class="btn ghost mt" data-go="#/speak" style="width:auto;padding:9px 16px">← Speak Studio</button>`;
  root.querySelectorAll('[data-s]').forEach(c=>c.onclick=()=>location.hash='#/speak/pron/'+c.dataset.s);
  root.querySelector('[data-go]').onclick=e=>location.hash='#/speak';
}
function claimDaily(kind,setId){
  const {plan,st}=dailyState();let changed=false;
  plan.items.forEach((it,i)=>{
    if(!changed&&!st.items[i]&&it.kind===kind&&(!setId||it.setId===setId)){st.items[i]=true;changed=true;}
  });
  if(changed){Store.save();Store.checkBadges();}
  return changed;
}
function pronView(root,setId){
  const sets=(Content.cache.pron&&Content.cache.pron.sets)||[];
  const set=sets.find(s=>s.id===setId);
  if(!set){root.innerHTML='<div class="empty">Set not found.</div>';return;}
  const best=Store.S.pronBest||{};
  let li=0;const lineDone=new Array(set.lines.length).fill(false);const lineScore=new Array(set.lines.length).fill(0);
  function render(){
    const L=set.lines[li];
    root.innerHTML=`
      <div class="step-tag">Pronunciation Lab · ${esc(set.title)} · line ${li+1}/${set.lines.length}</div>
      <div class="lprog"><i style="width:${li/set.lines.length*100}%"></i></div>
      <div class="card"><div class="kicker">${esc(set.focus)} · how to make the sound</div>
        <p style="margin:8px 0;font-size:15px;line-height:1.6">${esc(set.tip)}</p></div>
      <div class="shad-text" style="font-size:19px">“${esc(L.text)}”</div>
      <div class="row" style="justify-content:center;gap:10px;margin:12px 0">
        <button class="btn ghost" id="pl-model" style="width:auto;padding:12px 20px">🔊 Model</button>
        ${srAvailable()?`<button class="btn" id="pl-say" style="width:auto;padding:12px 22px">${UI.icon('mic','in-tx')} Say it</button>`:''}
        <button class="btn" id="pl-self" style="width:auto;padding:12px 20px">${UI.icon('listen','in-tx')} Record + self-check</button>
      </div>
      ${L.tip?`<div class="tip">${UI.icon('tip','in-tx')} ${esc(L.tip)}</div>`:''}
      <div id="pl-out"></div>
      <div id="pl-nav" class="row mt" style="gap:8px;justify-content:space-between">
        <button class="btn ghost" id="pl-back" style="width:auto;padding:10px 16px">← Sets</button>
        <span class="small dim">${lineDone.filter(Boolean).length}/${set.lines.length} lines solid</span>
      </div>`;
    root.querySelector('#pl-model').onclick=()=>Drills.speak(L.text);
    root.querySelector('#pl-back').onclick=()=>location.hash='#/speak/pron';
    const sayBtn=root.querySelector('#pl-say');
    if(sayBtn)sayBtn.onclick=()=>runCheck(L);
    root.querySelector('#pl-self').onclick=()=>selfCheck(L);
    window.scrollTo({top:0});
  }
  async function runCheck(L){
    const out=root.querySelector('#pl-out');
    out.innerHTML=`<div class="card center"><div style="font-size:34px">${UI.icon('mic','in-tx')}</div><p class="mut">Listening… say the line now.</p></div>`;
    try{
      const {best:heard,secs}=await runSR();
      const d=wordDiff(L.text,heard);
      const words=d.words.length,fillers=countFillers(heard);
      const wpm=Math.round(words/Math.max(1,secs)*60);
      const ok=d.score>=70;
      lineScore[li]=Math.max(lineScore[li],d.score);
      saveSpeakStat({kind:'pron',label:set.title+' · “'+L.text.slice(0,28)+'…”',accuracy:d.score,wpm,fillers,secs:Math.round(secs)});
      if(ok&&!lineDone[li]){lineDone[li]=true;}
      out.innerHTML=`<div class="card" style="border:1.5px solid ${ok?'var(--acc)':'var(--amber)'}">
        <div class="row" style="justify-content:space-between;align-items:center">
          <b style="font-size:20px">${ok?'✅':'🔁'} ${d.score}%</b>
          <span class="small dim">${Math.round(secs)}s · ~${wpm} WPM${fillers?` · ${fillers} filler${fillers>1?'s':''}`:''}</span></div>
        <div class="pron-line">${d.words.map(x=>`<span class="pw ${x.ok?'ok':'miss'}">${esc(x.w)}</span>`).join(' ')}</div>
        ${d.extra.length?`<div class="small dim">Extra words heard: ${d.extra.map(esc).join(', ')}</div>`:''}
        <div class="small dim" style="margin-top:6px">Heard: “${esc(d.heard)}”</div>
        <p class="small" style="margin:10px 0 0">${ok
          ?(d.score===100?'Flawless. Next line? '+UI.icon('party','in-tx'):'Solid! The red words need one more rep.')
          :'Listen to the model once more, then retry — slow down on the <b style="color:var(--red)">red</b> words.'}</p>
        <div class="row mt" style="gap:8px">
          <button class="btn ghost" id="pl-retry" style="flex:1">🔁 Retry</button>
          <button class="btn" id="pl-next" style="flex:1">${li<set.lines.length-1?'Next line →':'Finish set '+UI.icon('party','in-tx')}</button>
        </div></div>`;
      out.querySelector('#pl-retry').onclick=()=>runCheck(L);
      out.querySelector('#pl-next').onclick=next;
    }catch(e){
      const msg=e.message==='no-speech'?'I didn\'t catch that — speak a little louder and try again.':
        e.message==='not-allowed'?'Mic blocked — allow microphone access, or use record + self-check.':
        'Speech check hiccup — try again, or use record + self-check.';
      out.innerHTML=`<div class="card"><p class="mut">${esc(msg)}</p>
        <div class="row" style="gap:8px"><button class="btn ghost" id="pl-re2" style="flex:1">🔁 Try again</button>
        <button class="btn" id="pl-self2" style="flex:1">${UI.icon('listen','in-tx')} Record + self-check</button></div></div>`;
      out.querySelector('#pl-re2').onclick=()=>runCheck(L);
      out.querySelector('#pl-self2').onclick=()=>selfCheck(L);
    }
  }
  async function selfCheck(L){
    const out=root.querySelector('#pl-out');
    out.innerHTML=`<div class="card"><div class="kicker">Record + honest self-check</div>
      <div class="row" style="justify-content:center"><button class="rec-btn" id="sc-rec" aria-label="Record your voice">${UI.icon('mic','in-tx')}</button></div>
      <p class="center small dim" id="sc-st">Tap ${UI.icon('mic','in-tx')}, say the line, then listen back.</p>
      <div id="sc-back"></div></div>`;
    const R=Drills.makeRecorder();
    const recBtn=out.querySelector('#sc-rec'),st=out.querySelector('#sc-st'),back=out.querySelector('#sc-back');
    recBtn.onclick=async()=>{
      try{
        if(!R.live){await R.start();recBtn.classList.add('live');recBtn.textContent='⏹️';st.textContent='Recording… say the line!';}
        else{
          const url=await R.stop();recBtn.classList.remove('live');recBtn.innerHTML=UI.icon('mic','in-tx');
          st.textContent='Listen back — be your own coach:';
          back.innerHTML='';
          const a=document.createElement('audio');a.controls=true;a.src=url;back.appendChild(a);
          const checks=['I stressed the important words','My problem sounds were clear','I sounded smooth, not rushed'];
          const boxes=checks.map(c=>`<div class="check" style="margin-top:8px"><div class="box"></div><span class="txt small">${c}</span></div>`).join('');
          back.insertAdjacentHTML('beforeend',boxes);
          back.querySelectorAll('.check').forEach(c=>c.onclick=()=>c.classList.toggle('done'));
          const b=el(`<button class="btn mt">Done — line practiced ✓</button>`);
          b.onclick=()=>{
            const n=back.querySelectorAll('.check.done').length;
            lineScore[li]=Math.max(lineScore[li],n*25+25);
            if(!lineDone[li])lineDone[li]=true;
            saveSpeakStat({kind:'pron-self',label:set.title+' · self-check',accuracy:n*25+25,wpm:0,fillers:0,secs:0});
            toast(n>=2?'Honest practice logged '+UI.icon('brain','in-tx'):'Logged — be strict with yourself next time');
            next();
          };
          back.appendChild(b);
        }
      }catch(e){toast(UI.icon('mic','in-tx')+' Mic blocked — allow microphone access to record.');}
    };
  }
  function next(){
    if(li<set.lines.length-1){li++;render();}
    else finishSet();
  }
  function finishSet(){
    const avg=Math.round(lineScore.reduce((a,b)=>a+b,0)/Math.max(1,lineScore.length));
    best[setId]=Math.max(best[setId]||0,avg);
    Store.S.pronBest=best;Store.save();
    claimDaily('pron',setId);
    const first=!Store.S['pronDone_'+setId];
    Store.S['pronDone_'+setId]=1;Store.save();
    if(first){Store.addXP(30);}else{Store.addXP(10);}
    Store.checkBadges();confetti(110);
    root.innerHTML=`<div class="card center" style="margin-top:30px">
      <div style="font-size:52px">${UI.icon('target','in-tx')}</div><h2>Set complete!</h2>
      <p class="mut">Average score: <b style="color:var(--acc)">${avg}%</b> · best: ${best[setId]}%</p>
      <p class="small dim">${avg>=85?'Outstanding — these sounds are yours now.':avg>=70?'Strong. Revisit in a few days to lock it in.':'Good reps. Come back tomorrow — pronunciation is built in layers.'}</p>
      <div class="row" style="gap:8px;justify-content:center">
        <button class="btn" id="pf-again" style="width:auto">🔁 Practice again</button>
        <button class="btn ghost" id="pf-back" style="width:auto">← All sets</button>
      </div></div>`;
    root.querySelector('#pf-again').onclick=()=>{li=0;lineDone.fill(false);lineScore.fill(0);render();};
    root.querySelector('#pf-back').onclick=()=>location.hash='#/speak/pron';
    UI.refreshHud();
  }
  render();
}

/* ================= ROLEPLAY SCENARIOS ================= */
function scenarioList(root){
  const list=(Content.cache.scenarios&&Content.cache.scenarios.scenarios)||[];
  const done=Store.S.scenariosDone||{};
  root.innerHTML=`<div class="greet">Roleplay Scenarios ${UI.icon('roleplay','in-tx')}</div>
    <p class="sub">Real conversations, fully offline. Each has goals — hit them like a mission. Stuck? Freestyle with the AI Coach after.</p>
    <div>${list.map(s=>`<div class="card" style="cursor:pointer" data-s="${s.id}">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div><div style="font-size:22px">${s.icon}</div><b>${esc(s.title)}</b>
        <div class="small dim" style="margin-top:4px">${esc(s.level)} · ~${s.minutes} min · ${s.goals.length} goals ${done[s.id]?`· ✅ played ${done[s.id]}×`:''}</div></div>
        <div style="font-size:22px;color:var(--dim)">→</div></div></div>`).join('')}</div>
    <button class="btn ghost mt" data-go="#/speak" style="width:auto;padding:9px 16px">← Speak Studio</button>`;
  root.querySelectorAll('[data-s]').forEach(c=>c.onclick=()=>location.hash='#/speak/roleplay/'+c.dataset.s);
  root.querySelector('[data-go]').onclick=e=>location.hash='#/speak';
}
function scenarioPlay(root,scId){
  const list=(Content.cache.scenarios&&Content.cache.scenarios.scenarios)||[];
  const sc=list.find(s=>s.id===scId);
  if(!sc){root.innerHTML='<div class="empty">Scenario not found.</div>';return;}
  const intens=Store.S.intensity||'balanced';
  const t0=Date.now();
  let ti=0;
  function intro(){
    root.innerHTML=`<div class="card" style="margin-top:14px">
      <div style="font-size:40px">${sc.icon}</div>
      <h2 style="margin:8px 0">${esc(sc.title)}</h2>
      <p class="mut">${esc(sc.scene)}</p>
      <div class="kicker" style="margin-top:12px">${UI.icon('target','in-tx')} Your goals</div>
      <div style="margin:8px 0">${sc.goals.map(g=>`<div class="small" style="margin:6px 0">• ${esc(g)}</div>`).join('')}</div>
      <p class="small dim">Feedback style: <b>${esc(intens)}</b> <span class="dim">(change it in Speak Studio)</span></p>
      <div class="row" style="gap:8px">
        <button class="btn" id="sp-begin" style="flex:1">Start conversation →</button>
        <button class="btn ghost" id="sp-back" style="width:auto">←</button>
      </div></div>`;
    root.querySelector('#sp-begin').onclick=()=>{ti=0;renderTurn();};
    root.querySelector('#sp-back').onclick=()=>location.hash='#/speak/roleplay';
    window.scrollTo({top:0});
  }
  function chatShell(inner){
    return `<div class="step-tag">${sc.icon} ${esc(sc.title)} · turn ${Math.min(ti+1,sc.turns.length)}/${sc.turns.length}</div>
      <div class="lprog"><i style="width:${ti/sc.turns.length*100}%"></i></div>${inner}`;
  }
  function renderTurn(){
    const t=sc.turns[ti];
    if(!t){finish();return;}
    if(t.who==='them'){
      root.innerHTML=chatShell(`
        <div class="chat"><div class="msg them"><div class="bub">${esc(t.say)}</div>
          <button class="btn ghost sm" id="t-hear">🔊 Hear it</button></div></div>
        ${t.coach?`<div class="tip">${UI.icon('brain','in-tx')} Coach: ${esc(t.coach)}</div>`:''}
        <button class="btn mt" id="t-next">${t.end?'Finish '+UI.icon('party','in-tx'):'Your turn →'}</button>`);
      root.querySelector('#t-hear').onclick=()=>Drills.speak(t.say);
      root.querySelector('#t-next').onclick=()=>{ti++;renderTurn();};
    }else{
      // your turn: choices + freestyle
      root.innerHTML=chatShell(`
        <div class="card" style="border:1.5px solid var(--acc)"><div class="kicker">${UI.icon('target','in-tx')} Your move</div>
          <p style="margin:8px 0"><b>${esc(t.prompt)}</b></p></div>
        <div id="opts">${t.options.map((o,i)=>`<button class="opt say" data-o="${i}">${UI.icon('chat','in-tx')} ${esc(o.label)}</button>`).join('')}</div>
        <button class="btn mt" id="t-free">${UI.icon('mic','in-tx')} Freestyle — say it my own way</button>
        <div id="t-note"></div>`);
      root.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>choose(+b.dataset.o));
      root.querySelector('#t-free').onclick=()=>freestyle(t);
    }
    window.scrollTo({top:0});
  }
  function choose(oi){
    const t=sc.turns[ti],o=t.options[oi];
    const note=(o.notes&&(o.notes[intens]||o.notes.balanced))||'';
    const box=root.querySelector('#t-note');
    box.innerHTML=`<div class="card" style="margin-top:12px;border:1.5px solid var(--line)">
      <div class="small dim">You said:</div><p style="margin:6px 0"><i>“${esc(o.label.replace(/^“|”$/g,''))}”</i></p>
      <div class="tip">${UI.icon('brain','in-tx')} Coach (${esc(intens)}): ${esc(note)}</div>
      <div class="row" style="gap:8px">
        <button class="btn ghost" id="n-retry" style="flex:1">↩ Try another</button>
        <button class="btn" id="n-go" style="flex:1">Continue →</button></div></div>`;
    box.querySelector('#n-retry').onclick=()=>renderTurn();
    box.querySelector('#n-go').onclick=()=>{
      // say the chosen line aloud for muscle memory
      Drills.speak(o.label.replace(/^“|”$/g,''));
      ti=(o.next!=null?o.next:ti+1);renderTurn();
    };
    box.scrollIntoView({behavior:'smooth',block:'center'});
  }
  async function freestyle(t){
    const box=root.querySelector('#t-note');
    box.innerHTML=`<div class="card" style="margin-top:12px"><div class="kicker">${UI.icon('mic','in-tx')} Freestyle — record yourself</div>
      <div class="row" style="justify-content:center"><button class="rec-btn" id="f-rec" aria-label="Record your voice">${UI.icon('mic','in-tx')}</button></div>
      <p class="center small dim" id="f-st">Say your own version of: ${esc(t.prompt)}</p>
      <div id="f-back"></div></div>`;
    const R=Drills.makeRecorder();
    const recBtn=box.querySelector('#f-rec'),st=box.querySelector('#f-st'),back=box.querySelector('#f-back');
    recBtn.onclick=async()=>{
      try{
        if(!R.live){await R.start();recBtn.classList.add('live');recBtn.textContent='⏹️';st.textContent='Recording… go!';}
        else{
          const url=await R.stop();recBtn.classList.remove('live');recBtn.innerHTML=UI.icon('mic','in-tx');
          st.textContent='Listen back, then continue:';
          back.innerHTML='';const a=document.createElement('audio');a.controls=true;a.src=url;back.appendChild(a);
          back.insertAdjacentHTML('beforeend',`<div class="tip">${UI.icon('tip','in-tx')} Compare with the scripted options above — steal their best phrases.</div>
            <div class="row" style="gap:8px"><button class="btn ghost" id="f-retry" style="flex:1">↩ Back to options</button>
            <button class="btn" id="f-go" style="flex:1">Continue →</button></div>`);
          back.querySelector('#f-retry').onclick=()=>renderTurn();
          back.querySelector('#f-go').onclick=()=>{ti=(t.options[0].next!=null?t.options[0].next:ti+1);renderTurn();};
        }
      }catch(e){toast(UI.icon('mic','in-tx')+' Mic blocked — allow microphone access to record.');}
    };
  }
  function finish(){
    const mins=Math.max(1,Math.round((Date.now()-t0)/60000));
    const done=Store.S.scenariosDone||{};done[scId]=(done[scId]||0)+1;Store.S.scenariosDone=done;
    saveSpeakStat({kind:'roleplay',label:sc.title,accuracy:0,wpm:0,fillers:0,secs:0});
    Store.save();
    let goalsHit=[];
    root.innerHTML=`<div class="card center" style="margin-top:24px">
      <div style="font-size:52px">${sc.icon}</div><h2>Scenario complete!</h2>
      <p class="mut small">~${mins} min · ${sc.turns.length} turns · feedback: ${esc(intens)}</p>
      <div class="kicker" style="margin-top:10px">${UI.icon('target','in-tx')} Which goals did you hit? Be honest.</div>
      <div id="g-list" style="text-align:left;margin:10px 0">
        ${sc.goals.map((g,i)=>`<div class="check" data-g="${i}"><div class="box"></div><span class="txt small">${esc(g)}</span></div>`).join('')}
      </div>
      <button class="btn" id="f-done">Claim XP →</button>
      <div class="row mt" style="gap:8px;justify-content:center">
        <button class="btn ghost" id="f-open" style="width:auto">${UI.icon('coach','in-tx')} Continue free-talk with AI Coach</button>
      </div>
      <button class="btn ghost mt" id="f-back2" style="width:auto">← All scenarios</button></div>`;
    root.querySelectorAll('#g-list .check').forEach(c=>c.onclick=()=>{
      c.classList.toggle('done');
      const i=+c.dataset.g;
      goalsHit.includes(i)?goalsHit=goalsHit.filter(x=>x!==i):goalsHit.push(i);
    });
    root.querySelector('#f-open').onclick=()=>location.hash='#/coach';
    root.querySelector('#f-back2').onclick=()=>location.hash='#/speak/roleplay';
    root.querySelector('#f-done').onclick=()=>{
      const xp=30+goalsHit.length*10;
      Store.addXP(xp);xpToast(xp);Store.checkBadges();confetti(100);
      toast(`${UI.icon('roleplay','in-tx')} ${goalsHit.length}/${sc.goals.length} goals · +${xp} XP`);
      location.hash='#/speak/roleplay';
    };
    UI.refreshHud();
  }
  intro();
}

/* ================= INTERACTIVE STORIES ================= */
function storyList(root){
  const list=(Content.cache.stories&&Content.cache.stories.stories)||[];
  const read=Store.S.storiesRead||{};
  root.innerHTML=`<div class="greet">Interactive Stories ${UI.icon('read','in-tx')}</div>
    <p class="sub">Read the dialogue, <b>tap any word</b> for its meaning, save expressions, then ace the quiz.</p>
    <div>${list.map(s=>`<div class="card" style="cursor:pointer" data-s="${s.id}">
      <div class="row" style="justify-content:space-between;align-items:center">
        <div><div style="font-size:22px">${s.icon}</div><b>${read[s.id]?'✅ ':''}${esc(s.title)}</b>
        <div class="small dim" style="margin-top:4px">${esc(s.level)} · ${s.lines.length} lines · ${s.quiz.length} quiz questions</div></div>
        <div style="font-size:22px;color:var(--dim)">→</div></div></div>`).join('')}</div>
    <button class="btn ghost mt" data-go="#/speak" style="width:auto;padding:9px 16px">← Speak Studio</button>`;
  root.querySelectorAll('[data-s]').forEach(c=>c.onclick=()=>location.hash='#/speak/stories/'+c.dataset.s);
  root.querySelector('[data-go]').onclick=e=>location.hash='#/speak';
}
function storyDict(){return (Content.cache.stories&&Content.cache.stories.dict)||{};}
function lookupWord(w){
  const key=String(w||'').toLowerCase().replace(/[^a-z']/g,'');
  if(!key)return null;
  const d=storyDict();
  if(d[key])return{word:key,...d[key]};
  // de-inflection candidates: plurals, -ies, -ied, doubled consonants, silent e
  const cands=[];
  if(/(ies)$/.test(key))cands.push(key.replace(/(ies)$/,'y'));
  if(/(es)$/.test(key))cands.push(key.slice(0,-2),key.slice(0,-1));
  else if(/(s)$/.test(key)&&!/(ss)$/.test(key))cands.push(key.slice(0,-1));
  if(/(ied)$/.test(key))cands.push(key.replace(/(ied)$/,'y'));
  if(/(ed)$/.test(key)){const b=key.slice(0,-2);cands.push(b);if(/(.)\1$/.test(b))cands.push(b.slice(0,-1));cands.push(b+'e');}
  if(/(ing)$/.test(key)){const b=key.slice(0,-3);cands.push(b);if(/(.)\1$/.test(b))cands.push(b.slice(0,-1));cands.push(b+'e');}
  for(const t of cands)if(d[t])return{word:t,...d[t]};
  return null;
}
function storyView(root,stId){
  const list=(Content.cache.stories&&Content.cache.stories.stories)||[];
  const st=list.find(s=>s.id===stId);
  if(!st){root.innerHTML='<div class="empty">Story not found.</div>';return;}
  const read=Store.S.storiesRead||{};
  function wordify(text){
    // esc() first, then wrap each word in a tappable span (whitespace/punctuation untouched)
    return esc(text).split(/(\s+)/).map(part=>{
      if(!/[A-Za-z]/.test(part))return part;
      const m=part.match(/^([^A-Za-z']*)([A-Za-z']+)([^A-Za-z']*)$/);
      if(!m)return part;
      return `${m[1]}<span class="w" data-w="${esc(m[2].toLowerCase())}">${m[2]}</span>${m[3]}`;
    }).join('');
  }
  function renderRead(){
    root.innerHTML=`<div class="step-tag">${UI.icon('read','in-tx')} ${esc(st.title)} · ${esc(st.level)}</div>
      <p class="small dim">👆 Tap any word for its meaning · 🔊 hear each line</p>
      <div class="chat" id="story-lines">
        ${st.lines.map(l=>`<div class="msg ${l.who==='Narrator'?'them':'you'}">
          <div class="who">${esc(l.who)}</div>
          <div class="bub story">${wordify(l.text)}</div>
          <button class="btn ghost sm" data-hear="${esc(l.text)}">🔊</button></div>`).join('')}
      </div>
      <div class="card"><div class="kicker">${UI.icon('key','in-tx')} Key words in this story</div>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px" id="story-vocab">
          ${(st.vocab||[]).map(v=>`<button class="chip" data-vw="${esc(v)}" style="cursor:pointer">${UI.icon('key','in-tx')} ${esc(v)}</button>`).join('')}
        </div>
        <p class="small dim" style="margin:8px 0 0">Tap a key word — or any word in the story — for its meaning. Save it to your Review deck.</p></div>
      <button class="btn mt" id="st-quiz">✅ I've read it — quiz me!</button>
      <button class="btn ghost mt" data-go="#/speak/stories" style="width:auto;padding:9px 16px">← All stories</button>`;
    root.querySelector('[data-go]').onclick=e=>location.hash='#/speak/stories';
    root.querySelectorAll('[data-hear]').forEach(b=>b.onclick=()=>Drills.speak(b.dataset.hear));
    root.querySelector('#story-lines').addEventListener('click',e=>{
      const w=e.target.closest('.w');if(!w)return;
      showWord(w.dataset.w);
    });
    root.querySelectorAll('#story-vocab [data-vw]').forEach(b=>b.onclick=()=>showWord(b.dataset.vw));
    root.querySelector('#st-quiz').onclick=renderQuiz;
    window.scrollTo({top:0});
  }
  function showWord(raw){
    const hit=lookupWord(raw);
    const m=modal(`<div class="center"><div style="font-size:34px">${UI.icon('read','in-tx')}</div>
      <h3 style="margin:8px 0">${esc(raw)}</h3>
      ${hit?`<p style="font-size:16px"><b>${esc(hit.d)}</b></p>
        <p class="mut"><i>“${esc(hit.ex)}”</i></p>
        <div class="row" style="gap:8px;justify-content:center">
          <button class="btn ghost" id="w-hear" style="width:auto">🔊 Hear it</button>
          <button class="btn" id="w-save" style="width:auto">${UI.icon('review','in-tx')} Save to Review</button>
        </div>`
      :`<p class="mut small">Not in the story dictionary yet.</p>
        <button class="btn ghost" id="w-hear" style="width:auto">🔊 Hear it</button>`}
      <button class="btn ghost mt" id="w-x" style="width:100%">Close</button></div>`);
    m.querySelector('#w-x').onclick=()=>m.remove();
    m.querySelector('#w-hear').onclick=()=>Drills.speak(raw);
    const sv=m.querySelector('#w-save');
    if(sv)sv.onclick=()=>{
      const cid='srs_story_'+raw.replace(/[^a-z]/g,'');
      Store.S.srs[cid]=Store.S.srs[cid]||{ef:2.5,interval:0,reps:0,due:Date.now(),front:hit.word,back:hit.d,example:hit.ex};
      Store.save();toast(`“${hit.word}” saved to Review ${UI.icon('review','in-tx')}`);m.remove();
    };
  }
  function renderQuiz(){
    let qi=0,score=0;
    function ask(){
      if(qi>=st.quiz.length){finishQuiz();return;}
      const q=st.quiz[qi];
      root.innerHTML=`<div class="step-tag">${UI.icon('read','in-tx')} ${esc(st.title)} · question ${qi+1}/${st.quiz.length}</div>
        <div class="lprog"><i style="width:${qi/st.quiz.length*100}%"></i></div>
        <div class="card"><p style="font-size:17px;font-weight:700">${esc(q.q)}</p><div class="opts" id="q-opts"></div></div>
        <div id="q-fb"></div>`;
      const box=root.querySelector('#q-opts');
      q.options.forEach((o,i)=>{
        const b=el(`<button class="opt">${esc(o)}</button>`);
        b.onclick=()=>{
          const ok=i===q.answer;
          if(ok){score++;b.classList.add('right');}
          else{b.classList.add('wrong');box.children[q.answer].classList.add('right');}
          [...box.children].forEach(x=>x.style.pointerEvents='none');
          root.querySelector('#q-fb').innerHTML=`<div class="feedback ${ok?'good':'bad'}">${ok?'✅ Correct!':'❌ '+esc(q.why)}</div>
            <button class="btn mt" id="q-n">${qi<st.quiz.length-1?'Next →':'Finish '+UI.icon('party','in-tx')}</button>`;
          root.querySelector('#q-n').onclick=()=>{qi++;ask();};
        };
        box.appendChild(b);
      });
      window.scrollTo({top:0});
    }
    function finishQuiz(){
      const pct=Math.round(score/st.quiz.length*100);
      if(!read[stId]){read[stId]=Date.now();Store.S.storiesRead=read;Store.save();Store.addXP(30);}
      else Store.addXP(10);
      Store.checkBadges();confetti(pct>=67?110:40);
      saveSpeakStat({kind:'story',label:st.title,accuracy:pct,wpm:0,fillers:0,secs:0});
      root.innerHTML=`<div class="card center" style="margin-top:30px">
        <div style="font-size:52px">${UI.icon('read','in-tx')}</div><h2>Story complete!</h2>
        <p class="mut">Comprehension: <b style="color:var(--acc)">${score}/${st.quiz.length} (${pct}%)</b></p>
        <p class="small dim">${pct===100?'Perfect understanding!':pct>=67?'Well understood.':'Read it once more — stories reward re-reading.'}</p>
        <div class="row" style="gap:8px;justify-content:center">
          <button class="btn ghost" id="s-reread" style="width:auto">${UI.icon('read','in-tx')} Re-read</button>
          <button class="btn" id="s-back" style="width:auto">← All stories</button>
        </div></div>`;
      root.querySelector('#s-reread').onclick=renderRead;
      root.querySelector('#s-back').onclick=()=>location.hash='#/speak/stories';
      UI.refreshHud();
    }
    ask();
  }
  renderRead();
}

/* ================= SPEAKING STATS + WEEKLY SELF-LEAGUE ================= */
function weekBuckets(n){
  // n rolling 7-day blocks ending today, oldest first
  const out=[];
  for(let k=n-1;k>=0;k--){
    const end=new Date();end.setDate(end.getDate()-k*7);
    const start=new Date(end);start.setDate(start.getDate()-6);
    const key=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    let xp=0;
    for(let j=0;j<7;j++){const d=new Date(start);d.setDate(d.getDate()+j);xp+=(Store.S.xpByDay[key(d)]||0);}
    out.push({label:key(start).slice(5)+'→'+key(end).slice(5),xp,current:k===0});
  }
  return out;
}
function stats(root){
  const S=Store.S;
  const sessions=(S.speakStats||[]).filter(s=>s.kind==='pron'||s.kind==='pron-self');
  const last10=sessions.slice(0,10).reverse();
  const mxWpm=Math.max(60,...last10.map(s=>s.wpm||0));
  const mxAcc=Math.max(50,...sessions.slice(0,20).map(s=>s.accuracy||0));
  const avgAcc=sessions.length?Math.round(sessions.reduce((a,s)=>a+(s.accuracy||0),0)/sessions.length):0;
  const roleplays=Object.keys(S.scenariosDone||{}).length;
  const stories=Object.keys(S.storiesRead||{}).length;
  const weeks=weekBuckets(8);
  const mxW=Math.max(50,...weeks.map(w=>w.xp));
  const cur=weeks[weeks.length-1].xp,prev=weeks[weeks.length-2].xp;
  const diff=cur-prev;
  const verdict=diff>0?`▲ ${diff} XP more than last week — you're climbing.`:
    diff<0?`▼ ${-diff} XP less than last week. Small step today beats zero.`:
    `Even with last week. Consistency is the whole game.`;
  root.innerHTML=`<div class="greet">Speaking Stats ${UI.icon('progress','in-tx')}</div>
    <p class="sub">Your only competitor is past-you. Honest numbers, no fake opponents.</p>
    <div class="card"><div class="kicker">${UI.icon('trophy','in-tx')} Weekly self-league · last 8 weeks</div>
      <div class="bars">${weeks.map(w=>`<div class="b${w.xp?'':' zero'}${w.current?' cur':''}" style="height:${Math.max(4,w.xp/mxW*100)}%" title="${w.label}: ${w.xp} XP"></div>`).join('')}</div>
      <div class="row" style="justify-content:space-between"><span class="small dim">${weeks[0].label}</span><span class="small dim"><b>this week</b></span></div>
      <p class="small" style="margin:10px 0 0">${verdict}</p>
      <p class="small dim" style="margin:4px 0 0">Best week: <b>${Math.max(...weeks.map(w=>w.xp))} XP</b></p></div>
    <div class="card"><div class="kicker">${UI.icon('target','in-tx')} Pronunciation accuracy · recent sessions</div>
      ${sessions.length?`<div class="bars">${sessions.slice(0,14).reverse().map(s=>`<div class="b${s.accuracy?'':' zero'}" style="height:${Math.max(4,(s.accuracy||0)/Math.max(100,mxAcc)*100)}%" title="${esc(s.label)}: ${s.accuracy}%"></div>`).join('')}</div>
      <p class="small" style="margin:8px 0 0">Average: <b>${avgAcc}%</b> · sessions: <b>${sessions.length}</b></p>`
      :'<p class="mut small">No pronunciation sessions yet — the Lab is waiting. '+UI.icon('target','in-tx')+'</p>'}</div>
    <div class="card"><div class="kicker">${UI.icon('xp','in-tx')} Speaking pace (WPM) · recent</div>
      ${last10.length?`<div class="bars">${last10.map(s=>`<div class="b${s.wpm?'':' zero'}" style="height:${Math.max(4,(s.wpm||0)/mxWpm*100)}%" title="${Math.round(s.wpm)} WPM"></div>`).join('')}</div>
      <p class="small dim" style="margin:8px 0 0">Natural conversation ≈ 120–150 WPM. Don't chase speed — chase clarity.</p>`
      :'<p class="mut small">WPM appears after pronunciation sessions with speech check.</p>'}</div>
    <div class="card"><div class="kicker">Lifetime speaking</div>
      <div class="kv"><span>Roleplay scenarios played</span><b>${UI.icon('roleplay','in-tx')} ${roleplays}</b></div>
      <div class="kv"><span>Stories finished</span><b>${UI.icon('read','in-tx')} ${stories}</b></div>
      <div class="kv"><span>Pronunciation sessions</span><b>${UI.icon('target','in-tx')} ${sessions.length}</b></div>
      <div class="kv" style="border:0"><span>Avg accuracy</span><b>${avgAcc}%</b></div></div>
    <button class="btn ghost mt" data-go="#/speak" style="width:auto;padding:9px 16px">← Speak Studio</button>`;
  root.querySelector('[data-go]').onclick=e=>location.hash='#/speak';
}

/* ================= MISTAKE REPAIR ================= */
function repair(root){
  const errs=(Store.S.errorLog||[]).filter(e=>!e.reviewed).slice(0,12);
  if(!errs.length){
    root.innerHTML=`<div class="greet">Mistake Repair ${UI.icon('write','in-tx')}</div>
      <div class="card center" style="margin-top:16px"><div style="font-size:48px">${UI.icon('party','in-tx')}</div>
      <h3>All clear!</h3><p class="mut small">Mistakes you make in drills land here for a repair round.</p>
      <button class="btn" data-go="#/practice" style="width:auto">Go make some mistakes →</button></div>
      <button class="btn ghost mt" data-go2="#/speak" style="width:auto;padding:9px 16px">← Speak Studio</button>`;
    root.querySelector('[data-go]').onclick=e=>location.hash='#/practice';
    root.querySelector('[data-go2]').onclick=e=>location.hash='#/speak';
    return;
  }
  let i=0,fixed=0;
  function rebuild(e){
    if(e.engine==='fix-sentence'){
      return{engine:'fix-sentence',id:e.id,wrong:String(e.prompt||'').replace(/^Fix:\s*/,''),answer:e.correct,
        explanation:e.explanation,hint:'Read it slowly — find the one wrong word.',xp:10};
    }
    if(e.engine==='fill-blank'&&/___/.test(e.prompt||'')){
      return{engine:'fill-blank',id:e.id,text:e.prompt,answer:e.correct,explanation:e.explanation,xp:10};
    }
    return{engine:'repair-card',id:e.id,prompt:e.prompt,correct:e.correct,explanation:e.explanation,xp:10};
  }
  function render(){
    if(i>=errs.length){finish();return;}
    const e=errs[i],step=rebuild(e);
    root.innerHTML=`<div class="step-tag">Mistake Repair ${UI.icon('write','in-tx')} · ${i+1}/${errs.length}</div>
      <div class="lprog"><i style="width:${i/errs.length*100}%"></i></div>
      <div class="card" style="border:1.5px solid var(--amber)">
        <div class="kicker">Earlier you got this wrong — fix it now</div>
        <div id="rp"></div></div>
      <button class="btn ghost mt" data-go="#/speak" style="width:auto;padding:9px 16px">← Quit repair</button>`;
    root.querySelector('[data-go]').onclick=()=>location.hash='#/speak';
    const host=root.querySelector('#rp');
    if(step.engine==='repair-card'){
      host.innerHTML=`<p style="font-size:16px;font-weight:700">${esc(step.prompt||'')}</p>
        <details class="explain"><summary>👁️ Reveal the correct version</summary>
        <div class="mt"><b style="color:var(--acc)">${esc(step.correct||'')}</b>
        ${step.explanation?`<div class="small mut" style="margin-top:6px">${esc(step.explanation)}</div>`:''}</div></details>
        <div class="row mt" style="gap:8px">
          <button class="btn ghost" id="rp-no" style="flex:1">🔁 Still tricky</button>
          <button class="btn" id="rp-yes" style="flex:1">✓ Got it now</button></div>`;
      host.querySelector('#rp-yes').onclick=()=>{fixed++;Store.reviewError(e.id);i++;render();};
      host.querySelector('#rp-no').onclick=()=>{toast('Kept in your log — it will come back '+UI.icon('review','in-tx'));i++;render();};
    }else{
      const api={award:n=>{Store.addXP(n||10);xpToast(n||10);},
        logError:()=>{},
        done:()=>{fixed++;Store.reviewError(e.id);i++;render();}};
      Drills.mount(step.engine,{...step,uid:'repair:'+e.id},host,api);
    }
    window.scrollTo({top:0});
  }
  function finish(){
    Store.S.repairDone=(Store.S.repairDone||0)+1;Store.save();
    Store.addXP(20);Store.checkBadges();confetti(90);
    root.innerHTML=`<div class="card center" style="margin-top:30px">
      <div style="font-size:52px">${UI.icon('write','in-tx')}</div><h2>Repair round done!</h2>
      <p class="mut">Fixed <b style="color:var(--acc)">${fixed}/${errs.length}</b> · +20 XP</p>
      <p class="small dim">Repaired mistakes stick 3× better than new lessons. Science-ish. Probably true.</p>
      <button class="btn" id="rp-home">← Speak Studio</button></div>`;
    root.querySelector('#rp-home').onclick=()=>location.hash='#/speak';
    UI.refreshHud();
  }
  render();
}

/* ================= dispatcher ================= */
function speak(root,arg){
  const parts=String(arg||'').split('/');
  const sub=parts[0]||'',id=decodeURIComponent(parts[1]||'');
  switch(sub){
    case '': home(root); break;
    case 'daily': daily(root); break;
    case 'pron': id?pronView(root,id):pronList(root); break;
    case 'roleplay': id?scenarioPlay(root,id):scenarioList(root); break;
    case 'stories': id?storyView(root,id):storyList(root); break;
    case 'stats': stats(root); break;
    case 'repair': repair(root); break;
    default: home(root);
  }
}

window.Speak={speak,home,daily,pronList,pronView,scenarioList,scenarioPlay,storyList,storyView,
  stats,repair,wordDiff,countFillers,toks,dailyPlan,dailyState,claimDaily,srAvailable};
})();
