/* Screens — Home, Learn, Module, Lesson, Practice, Review, Progress */
(function(){
const {el,esc,toast,confetti,modal,xpToast}=UI;

function greet(){const h=new Date().getHours();
  return h<5?'Late night grind':h<12?'Good morning':h<17?'Good afternoon':h<21?'Good evening':'Late night grind';}
function dayNum(){return Math.floor((Date.now()-Store.S.created)/864e5)+1;}

/* shared drill api */
function makeApi(ctx){
  let awarded=false;
  return{
    award(n){if(awarded||!n)return;awarded=true;Store.addXP(n);xpToast(n);},
    logError(e){Store.logError({module:ctx.module||'practice',lesson:ctx.lesson||'',...e});},
    done(){ctx.onDone&&ctx.onDone();},
    mode:ctx.mode
  };
}

/* ================= HOME ================= */
function home(root){
  const S=Store.S,L=Store.level(),st=Store.streakStatus(),dn=dayNum();
  const plan=Content.cache.plan,week=plan.weeks[Math.min(11,Math.floor((dn-1)/7))];
  const due=Store.dueCards().length;
  const cont=S.lastLesson?Content.findLesson(S.lastLesson):null;
  root.innerHTML=`
    <div class="greet">${greet()}, Tanqeel 👋</div>
    <p class="sub">Day ${dn} of your 90-day path · ${esc(st.msg)}</p>
    ${!S.placement?`<div class="card" style="border:1.5px solid var(--acc);cursor:pointer" data-go="#/placement">
      <div class="kicker" style="color:var(--acc)">🧭 START HERE</div>
      <p style="margin:8px 0"><b>Take the 30-item placement test</b></p>
      <p class="small dim" style="margin:0">~25 min · finds your real level (A2 / B1 / B2) so Day 1 starts right.</p></div>`:''}
    <div class="hero">
      <div class="row">
        <div class="flame">${S.streak.current>0?'🔥':'🕯️'}</div>
        <div><div style="font-size:26px;font-weight:800">${S.streak.current} day streak</div>
        <div class="small mut">Best: ${S.streak.best} · 🛡️ ${S.streak.freezes} freeze${S.streak.freezes===1?'':'s'}</div></div>
      </div>
      <div class="row mt" style="justify-content:space-between">
        <span class="small"><b>Level ${L.n}</b> · ${esc(L.name)}</span><span class="small dim">${S.xp} XP</span>
      </div>
      <div class="xpbar"><i style="width:${L.pct}%"></i></div>
      <div class="small dim mt">${L.nxt-S.xp>0?`${L.nxt-S.xp} XP to Level ${L.n+1}`:'Max level — legend status 🏆'}</div>
    </div>
    ${cont?`<div class="card"><div class="kicker">Continue</div>
      <div class="row" style="justify-content:space-between;margin-top:6px">
        <div><b>${esc(cont.lesson.title)}</b><div class="small dim">${esc(cont.mod.title)}</div></div>
        <button class="btn" style="width:auto;padding:11px 22px" data-go="#/lesson/${cont.lesson.id}">Resume →</button>
      </div></div>`:''}
    <div class="card"><div class="kicker">Today's plan · Week ${week.week}</div>
      <p style="margin:8px 0"><b>${esc(week.focus)}</b></p>
      <p class="small mut" style="margin:0">🎯 Milestone: ${esc(week.milestone)}</p>
      <p class="small dim" style="margin:6px 0 0">~${plan.dailyMinutes} min · ${due?`📇 <b style="color:var(--acc)">${due} cards due</b> in Review`:'📇 Review deck clear — nice!'}</p>
      <div class="row mt" style="gap:8px">
        <button class="btn" data-go="#/learn" style="flex:1">Learn →</button>
        ${due?`<button class="btn vio" data-go="#/review" style="flex:1">Review ${due} cards</button>`:''}
      </div></div>
    <h2 class="sec">Quick hits</h2>
    <div class="row" style="gap:8px">
      <button class="btn ghost" data-go="#/practice" style="flex:1">⚔️ Drills</button>
      <button class="btn ghost" data-go="#/coach" style="flex:1">🤖 AI Coach · free</button>
      <button class="btn ghost" data-go="#/progress" style="flex:1">📊 Progress</button>
    </div>
    <p class="small dim center mt">Chalo — ek chhota step roz. ${due?'Pehle Review clear karo, phir naya seekho.':''}</p>`;
  root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>location.hash=b.dataset.go);
}

/* ================= LEARN ================= */
function learn(root){
  const S=Store.S;
  let html=`<div class="greet">Learn 📚</div><p class="sub">${Content.MODULES.length} modules · bite-sized lessons · everyday, work & exam English</p>
  ${!S.placement?`<div class="card" style="border:1.5px solid var(--acc);cursor:pointer" data-go="#/placement">
    <div class="kicker" style="color:var(--acc)">🧭 START HERE</div>
    <p style="margin:8px 0"><b>Placement test</b> <span class="small dim">· not taken yet</span></p>
    <p class="small dim" style="margin:0">30 items · finds your level so the path fits you.</p></div>`:''}`;
  for(const mid of Content.MODULES){
    const m=Content.cache.modules[mid];if(!m)continue;
    const total=(m.lessons||[]).length,done=(m.lessons||[]).filter(l=>S.lessonsDone[l.id]).length;
    const pct=total?Math.round(done/total*100):0;
    html+=`<div class="mod" data-mod="${mid}">
      <div class="ic" style="--mc:${m.color}">${m.icon||'📦'}</div>
      <div><h3>${esc(m.title)}</h3><p>${esc(m.tagline||'')}</p>
      ${m.phase2Note?`<p class="small" style="color:var(--amber)">⏳ ${esc(m.phase2Note)}</p>`:''}</div>
      <div class="pct"><span class="pct-num">${pct}%</span><div class="bar"><i style="width:${pct}%;background:${m.color}"></i></div>
      <div class="small dim">${done}/${total}</div></div></div>`;
  }
  root.innerHTML=html;
  root.querySelectorAll('.mod').forEach(c=>c.onclick=()=>location.hash='#/module/'+c.dataset.mod);
  root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>location.hash=b.dataset.go);
}

function moduleView(root,mid){
  const m=Content.cache.modules[mid];if(!m){root.innerHTML='<div class="empty">Module not found.</div>';return;}
  const S=Store.S;
  let html=`<div class="greet">${m.icon||''} ${esc(m.title)}</div><p class="sub">${esc(m.description||'')}</p>`;
  (m.lessons||[]).forEach((l,i)=>{
    const d=S.lessonsDone[l.id];
    html+=`<div class="mod" data-l="${l.id}">
      <div class="ic" style="font-size:22px;font-weight:800;color:${d?'var(--acc)':'var(--dim)'}">${d?'✓':i+1}</div>
      <div><h3>${esc(l.title)}</h3><p>~${l.minutes||10} min · +${l.xp||50} XP</p></div>
      <div class="pct">${d?'<span class="done-tag">DONE</span>':''}</div></div>`;
  });
  html+=`<button class="btn ghost mt" data-go="#/learn">← All modules</button>`;
  root.innerHTML=html;
  root.querySelectorAll('.mod').forEach(c=>c.onclick=()=>location.hash='#/lesson/'+c.dataset.l);
  root.querySelector('[data-go]').onclick=e=>location.hash='#/learn';
}

/* ================= LESSON ================= */
function lessonView(root,lid){
  const found=Content.findLesson(lid);
  if(!found){root.innerHTML='<div class="empty">Lesson not found.</div>';return;}
  const {mod,lesson}=found,S=Store.S;
  let i=0;
  function finish(){
    const bonus=lesson.xp||50;
    const first=!S.lessonsDone[lesson.id];
    if(first){S.lessonsDone[lesson.id]={ts:Date.now(),xp:bonus};S.lastLesson=null;}
    // module complete?
    const allDone=(mod.lessons||[]).every(l=>S.lessonsDone[l.id]);
    if(allDone&&!S.modulesCompleted[mod.id])S.modulesCompleted[mod.id]=Date.now();
    Store.save();if(first)Store.addXP(bonus);Store.checkBadges();
    // next lesson
    const idx=mod.lessons.findIndex(l=>l.id===lesson.id);
    const next=mod.lessons[idx+1];
    confetti(120);
    root.innerHTML=`<div class="card center" style="margin-top:30px">
      <div style="font-size:56px">🎉</div><h2>${first?'Lesson complete!':'Replay complete!'}</h2>
      ${first?`<p class="mut">Lesson bonus: <b style="color:var(--acc)">+${bonus} XP</b></p>`
             :`<p class="mut small">No bonus this time — but every rep still sharpens you.</p>`}
      ${allDone?`<p>🏆 <b>Module "${esc(mod.title)}" complete!</b> Badge check done.</p>`:''}
      <p class="small dim">${next?'Next up: <b>'+esc(next.title)+'</b>':'You finished every lesson in this module. Legend.'}</p>
      ${next?`<button class="btn" id="f-next">Next lesson →</button>`:''}
      <button class="btn ghost mt" id="f-home">Home</button></div>`;
    const nx=root.querySelector('#f-next');if(nx)nx.onclick=()=>location.hash='#/lesson/'+next.id;
    root.querySelector('#f-home').onclick=()=>location.hash='#/home';
    UI.refreshHud();
  }
  function render(){
    const step=lesson.steps[i];
    if(!step){finish();return;}
    const total=lesson.steps.length;
    root.innerHTML=`<div class="step-tag">Step ${i+1} of ${total} · ${esc(lesson.title)}</div>
      <div class="lprog"><i style="width:${i/total*100}%"></i></div><div id="step"></div>`;
    const host=root.querySelector('#step');
    const advance=()=>{i++;if(i>=lesson.steps.length)finish();else render();};
    if(step.type==='teach')renderTeach(step,host,advance);
    else{const api=makeApi({module:mod.id,lesson:lesson.id,onDone:advance});
      const d=el('<div></div>');host.appendChild(d);
      Drills.mount(step.engine,{...step,uid:mod.id+':'+lesson.id+':'+step.id},d,api);}
    window.scrollTo({top:0});
  }
  function renderTeach(step,host,advance){
    host.appendChild(el(`<div class="card teach">
      <div class="kicker">${esc(mod.title)}</div><h3>${esc(step.heading||'')}</h3>
      <div style="font-size:15px;line-height:1.65">${UI.md(step.body||'')}</div>
      ${step.example?`<div class="ex">${UI.md(step.example)}</div>`:''}
      ${step.roman?`<div class="roman">🇵🇰 ${esc(step.roman)}</div>`:''}
      ${step.tip?`<div class="tip">💡 ${UI.md(step.tip)}</div>`:''}
      <button class="btn mt" id="t-next">${i>=lesson.steps.length-1?'Finish lesson 🎉':'Got it →'}</button></div>`));
    host.querySelector('#t-next').onclick=advance;
  }
  S.lastLesson=lesson.id;Store.save();
  render();
}

/* ================= PRACTICE ================= */
const ENGINES=[
  ['fix-sentence','🔧','Fix the sentence'],['multiple-choice','✅','Multiple choice'],
  ['fill-blank','✏️','Fill the blank'],['dialogue','🎭','Complete the dialogue'],
  ['shadowing','🎧','Shadowing'],['flashcard','🃏','Flashcards'],
  ['timed-quiz','⏱️','Timed quiz'],['speaking-task','🎙️','Speaking task']];
function practice(root,engine){
  if(!engine){
    let html=`<div class="greet">Drill arena ⚔️</div><p class="sub">Pick a drill type — or go random. Every rep counts.</p>
      <div class="card"><button class="btn" data-e="random">🎲 Surprise me (mixed)</button></div><div class="badge-grid">`;
    for(const [e,ic,name] of ENGINES)html+=`<div class="bdg" data-e="${e}" style="cursor:pointer"><span class="e">${ic}</span>${name}</div>`;
    html+=`</div>
      <div class="row mt" style="gap:8px">
        <button class="btn vio" id="tab-quiz" style="flex:1">📝 Module quizzes</button>
        <button class="btn ghost" id="tab-task" style="flex:1">🎙️ Speaking tasks</button>
      </div>`;
    root.innerHTML=html;
    root.querySelectorAll('[data-e]').forEach(c=>c.onclick=()=>location.hash='#/practice/'+c.dataset.e);
    root.querySelector('#tab-quiz').onclick=()=>quizList(root);
    root.querySelector('#tab-task').onclick=()=>taskList(root);
    return;
  }
  const bank=Content.cache.practice;
  const alias={'speaking-task':'speak'};               // legacy bank key
  const poolFor=e=>(bank[e]||bank[alias[e]]||[]).map(d=>({...d,engine:e}));
  const pool=engine==='random'
    ?ENGINES.flatMap(([e])=>poolFor(e))
    :[...poolFor(engine),...Content.allDrills().filter(d=>d.engine===engine)].map(d=>({...d,engine}));
  if(!pool.length){root.innerHTML='<div class="empty">No drills for this engine yet.</div>';return;}
  let idx=Math.floor(Math.random()*pool.length);
  function run(){
    const step=pool[idx];
    root.innerHTML=`<div class="step-tag">Drill arena · ${esc(step.engine.replace(/-/g,' '))}</div>
      <div class="row" style="justify-content:space-between;margin:8px 0">
        <button class="btn ghost" style="width:auto;padding:9px 16px" id="p-back">← Arena</button>
        <button class="btn ghost" style="width:auto;padding:9px 16px" id="p-next">Skip ↻</button></div>
      <div id="drill"></div><div id="after"></div>`;
    root.querySelector('#p-back').onclick=()=>location.hash='#/practice';
    root.querySelector('#p-next').onclick=()=>{idx=(idx+1)%pool.length;run();window.scrollTo({top:0});};
    const api=makeApi({module:'practice',onDone:()=>{
      const after=root.querySelector('#after');
      after.innerHTML='';
      const b=el(`<button class="btn vio mt">Next drill →</button>`);
      b.onclick=()=>{idx=(idx+1)%pool.length;run();window.scrollTo({top:0});};
      after.appendChild(b);
    }});
    Drills.mount(step.engine,{...step,uid:'practice:'+step.id},root.querySelector('#drill'),api);
    window.scrollTo({top:0});
  }
  run();
}

/* ================= QUIZZES ================= */
function quizList(root){
  const qs=Content.cache.quizzes||[];
  let html=`<div class="greet">Module quizzes 📝</div>
    <p class="sub">One quiz per module — 10 questions each. <b>8/10 to move on.</b></p>
    <button class="btn ghost" style="width:auto;padding:9px 16px" id="q-back">← Arena</button><div class="mt">`;
  for(const qz of qs){
    const best=Store.S.quizBest[qz.id]||0;
    const done=best>=80;
    html+=`<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer" data-q="${qz.id}">
      <div><b>${done?'✅ ':''}${esc(qz.title)}</b><div class="small dim">${qz.questions.length} questions · best ${best}%</div></div>
      <span class="chip">${done?'Done':'Start'}</span></div>`;
  }
  root.innerHTML=html+'</div>';
  root.querySelector('#q-back').onclick=()=>location.hash='#/practice';
  root.querySelectorAll('[data-q]').forEach(c=>c.onclick=()=>quizView(root,c.dataset.q));
}
function quizView(root,qid){
  const qz=(Content.cache.quizzes||[]).find(q=>q.id===qid);
  if(!qz){root.innerHTML='<div class="empty">Quiz not found.</div>';return;}
  root.innerHTML=`<div class="step-tag">${esc(qz.title)}</div><div id="drill"></div>`;
  const api=makeApi({module:'quiz',quiz:qid,onDone:()=>{
    const b=el(`<button class="btn vio mt">← Back to quizzes</button>`);
    b.onclick=()=>quizList(root);root.appendChild(b);
  }});
  Drills.mount('timed-quiz',{engine:'timed-quiz',id:qid,uid:'quiz:'+qid,title:qz.title,
    questions:qz.questions,seconds:600,xp:100,rule:qz.rule},root.querySelector('#drill'),api);
}

/* ================= TASK CARDS ================= */
function taskList(root,moduleFilter){
  const ts=Content.cache.taskcards||[];
  const mods=[...new Set(ts.map(t=>t.module))];
  let html=`<div class="greet">Speaking task cards 🎙️</div>
    <p class="sub">Real call situations. Record yourself, listen back, repeat. Model scripts included.</p>
    <button class="btn ghost" style="width:auto;padding:9px 16px" id="t-back">← Arena</button>
    <div class="row mt" style="gap:6px;flex-wrap:wrap" id="t-mods">
      <button class="chip" data-m="" style="cursor:pointer;border-color:var(--acc)">All</button>
      ${mods.map(m=>`<button class="chip" data-m="${m}" style="cursor:pointer">${esc(m.replace(/-/g,' '))}</button>`).join('')}
    </div><div class="mt" id="t-cards"></div>`;
  root.innerHTML=html;
  root.querySelector('#t-back').onclick=()=>location.hash='#/practice';
  function paint(mf){
    const done=Store.S.taskCardsDone||{};
    const list=ts.filter(t=>!mf||t.module===mf);
    root.querySelector('#t-cards').innerHTML=list.map(t=>
      `<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer" data-t="${t.id}">
        <div><b>${done[t.id]?'✅ ':''}${esc(t.title)}</b><div class="small dim">${esc(t.module.replace(/-/g,' '))} · ${Math.round(t.seconds/60*10)/10} min · ${t.kind==='journal'?'writing':'speaking'}</div></div>
        <span class="chip">Open</span></div>`).join('')||'<div class="empty">No task cards here.</div>';
    root.querySelectorAll('[data-t]').forEach(c=>c.onclick=()=>taskView(root,c.dataset.t,moduleFilter));
  }
  root.querySelectorAll('#t-mods .chip').forEach(c=>c.onclick=()=>paint(c.dataset.m));
  paint(moduleFilter||'');
}
function taskView(root,tid,backFilter){
  const t=(Content.cache.taskcards||[]).find(x=>x.id===tid);
  if(!t){root.innerHTML='<div class="empty">Task card not found.</div>';return;}
  root.innerHTML=`<div class="step-tag">${esc(t.module.replace(/-/g,' '))} · task card</div><div id="drill"></div>`;
  const api=makeApi({module:'taskcard',task:tid,onDone:()=>{
    Store.S.taskCardsDone=Store.S.taskCardsDone||{};
    Store.S.taskCardsDone[tid]=Date.now();Store.save();
    const b=el(`<button class="btn vio mt">← Back to task cards</button>`);
    b.onclick=()=>taskList(root,backFilter);root.appendChild(b);
  }});
  const step={engine:t.kind==='journal'?'journal':'speaking-task',id:tid,
    title:t.title,prompt:t.prompt,model:t.model,script:t.script,
    checklist:t.checklist,tip:t.tip,seconds:t.seconds,xp:25};
  Drills.mount(step.engine,step,root.querySelector('#drill'),api);
}

/* ================= PLACEMENT ================= */
function placement(root){
  const P=Content.cache.placement;
  const done=Store.S.placement;
  if(!P){root.innerHTML='<div class="empty">Placement test not loaded.</div>';return;}
  if(done){
    root.innerHTML=`<div class="card center" style="margin-top:30px">
      <div style="font-size:52px">📍</div><h2>Your level: ${done.band}</h2>
      <p class="mut">Placement score: <b style="color:var(--acc)">${done.score}/100</b> · taken ${new Date(done.ts).toLocaleDateString()}</p>
      <p class="small dim">Band A2: 0–39 · B1: 40–69 · B2: 70–100</p>
      <button class="btn mt" id="pl-re">Retake placement ↻</button>
      <button class="btn ghost mt" id="pl-home">Home</button></div>`;
    root.querySelector('#pl-re').onclick=()=>startPlacement(root);
    root.querySelector('#pl-home').onclick=()=>location.hash='#/home';
    return;
  }
  root.innerHTML=`<div class="card center" style="margin-top:26px">
    <div style="font-size:52px">🧭</div><h2>START HERE: Placement test</h2>
    <p class="mut">30 items · ~25 minutes · scored out of 100.<br>Finds your real level so Day 1 starts at the right place.</p>
    <p class="small dim">Parts A–B are checked automatically. Parts C–E are self-checked against the key — be honest, nobody sees this but you.</p>
    <button class="btn mt" id="pl-start">Start placement test →</button></div>`;
  root.querySelector('#pl-start').onclick=()=>startPlacement(root);
}
function startPlacement(root){
  const P=Content.cache.placement;
  let partIdx=0,score=0;const answers=[];
  function render(){
    if(partIdx>=P.parts.length){finish();return;}
    const part=P.parts[partIdx];
    root.innerHTML=`<div class="step-tag">Placement · Part ${part.part} of E · ${esc(part.title)}</div>
      <div class="lprog"><i style="width:${partIdx/P.parts.length*100}%"></i></div>
      <div class="card teach"><div>${UI.md(part.instructions)}</div></div><div id="pl-q"></div>`;
    const host=root.querySelector('#pl-q');
    if(part.kind==='fix'||part.kind==='mc'){
      let qi=0;
      (function one(){
        if(qi>=part.items.length){partIdx++;render();return;}
        const it=part.items[qi];
        host.innerHTML='';
        if(part.kind==='fix'){
          const w=el(`<div><p class="mut small">Item ${qi+1}/${part.items.length}</p>
            <div class="shad-text" style="border-color:rgba(248,113,113,.4)">❌ ${esc(it.wrong)}</div>
            <input class="field" id="pl-in" placeholder="Type the corrected sentence…" autocomplete="off">
            <button class="btn mt" id="pl-go">Check ✓</button></div>`);
          host.appendChild(w);
          w.querySelector('#pl-go').onclick=()=>{
            const v=w.querySelector('#pl-in').value;
            if(!v.trim()){toast('Type something first ✍️');return;}
            const ok=norm(v)===norm(it.answer);
            if(ok){score+=it.points;toast('✅');}
            else toast('❌ → '+it.answer,3000);
            answers.push({part:part.part,n:it.n,ok});
            qi++;one();
          };
        }else{
          const w=el(`<div><p class="mut small">Item ${qi+1}/${part.items.length}</p>
            <div class="shad-text">${UI.md(it.prompt)}</div><div class="opts" id="pl-opts"></div></div>`);
          host.appendChild(w);
          const ob=w.querySelector('#pl-opts');
          it.options.forEach(o=>{
            const b=el(`<button class="opt">${esc(o.t)}</button>`);
            b.onclick=()=>{
              const ok=o.v===it.answer;
              if(ok){score+=it.points;toast('✅');}
              else toast('❌ → '+it.full,3000);
              answers.push({part:part.part,n:it.n,ok});
              qi++;one();
            };
            ob.appendChild(b);
          });
        }
        window.scrollTo({top:0});
      })();
    }else{
      // self-graded parts: answer then compare with key
      let qi=0;
      (function one(){
        if(qi>=part.items.length){partIdx++;render();return;}
        const it=part.items[qi];
        host.innerHTML='';
        const w=el(`<div><p class="mut small">Item ${qi+1}/${part.items.length}</p>
          <div class="card" style="margin:0 0 10px"><div>${UI.md(it.prompt)}</div></div>
          <textarea class="field" id="pl-ta" rows="3" placeholder="Write your answer…"></textarea>
          <button class="btn mt" id="pl-show">Show answer key</button><div id="pl-key"></div></div>`);
        host.appendChild(w);
        w.querySelector('#pl-show').onclick=()=>{
          w.querySelector('#pl-show').remove();
          w.querySelector('#pl-key').innerHTML=
            `<div class="explain"><b>Answer key:</b><br>${UI.md(it.key)}${it.sample?'<br><br><b>Sample:</b><br>'+UI.md(it.sample):''}</div>
             <div class="grade-row"><button class="grade g4" id="pl-g">✓ I got it right</button>
             <button class="grade g1" id="pl-b">✗ I missed it</button></div>`;
          w.querySelector('#pl-g').onclick=()=>{score+=it.points;answers.push({part:part.part,n:it.n,ok:true});qi++;one();};
          w.querySelector('#pl-b').onclick=()=>{answers.push({part:part.part,n:it.n,ok:false});qi++;one();};
        };
        window.scrollTo({top:0});
      })();
    }
  }
  function finish(){
    const band=score<40?'A2':score<70?'B1':'B2';
    Store.S.placement={score,band,ts:Date.now()};
    Store.save();Store.addXP(100);Store.checkBadges({placement_done:true});
    confetti(140);
    root.innerHTML=`<div class="card center" style="margin-top:30px">
      <div style="font-size:56px">🎯</div><h2>Your level: ${band}</h2>
      <p class="mut">Score: <b style="color:var(--acc)">${score}/100</b></p>
      <p class="small">${score<40?'Solid foundation. We build up from here — small daily wins.':score<70?'Right in the sweet spot. Time to push toward B2.':'Strong! Let us polish you to full client-call confidence.'}</p>
      <button class="btn mt" id="pl-go2">Start my 90-day path →</button></div>`;
    root.querySelector('#pl-go2').onclick=()=>location.hash='#/learn';
    UI.refreshHud();
  }
  render();
}

/* ================= REVIEW ================= */
function review(root,tab){
  tab=tab||'cards';
  const due=Store.dueCards(),errs=Store.S.errorLog;
  root.innerHTML=`<div class="greet">Review 📇</div>
    <p class="sub">Spaced repetition + your personal mistake log. This is where fluency is actually built.</p>
    <div class="tabs">
      <button class="tab ${tab==='cards'?'on':''}" data-t="cards">🃏 Flashcards (${due.length} due)</button>
      <button class="tab ${tab==='errors'?'on':''}" data-t="errors">📝 Error log (${errs.length})</button>
    </div><div id="tab-body"></div>`;
  root.querySelectorAll('.tab').forEach(t=>t.onclick=()=>review(root,t.dataset.t));
  const body=root.querySelector('#tab-body');
  if(tab==='cards')reviewCards(body,due);else reviewErrors(body,errs);
}
function reviewCards(body,due){
  if(!due.length){body.innerHTML=`<div class="empty">🎉 All clear! No cards due.<br><span class="small">Cards you miss get rescheduled automatically (SM-2).</span></div>`;return;}
  let i=0;
  function show(){
    if(i>=due.length){body.innerHTML=`<div class="card center"><div style="font-size:48px">✅</div><h3>Session complete!</h3><p class="mut small">Cards rescheduled by SM-2. Come back tomorrow for the next batch.</p><button class="btn" id="rc-home">Done</button></div>`;
      body.querySelector('#rc-home').onclick=()=>location.hash='#/home';UI.refreshHud();return;}
    const c=due[i];
    body.innerHTML=`<div class="step-tag">Card ${i+1} of ${due.length}</div><div class="lprog"><i style="width:${i/due.length*100}%"></i></div><div id="fc"></div>`;
    Drills.mount('flashcard',{front:c.front,back:c.back,example:c.example,cardId:c.id},body.querySelector('#fc'),
      {award:()=>{},logError:()=>{},done:()=>{i++;show();},mode:'sm2'});
  }
  show();
}
function reviewErrors(body,errs){
  if(!errs.length){body.innerHTML=`<div class="empty">📝 No mistakes logged yet.<br><span class="small">Every wrong drill answer lands here automatically — your personal hit-list.</span></div>`;return;}
  let html=`<p class="small mut">Tap <b>Got it</b> when you've truly absorbed the fix. Be honest — this list is for you, not for showing off.</p>`;
  errs.slice(0,50).forEach(e=>{
    html+=`<div class="err"><div class="small dim">${esc(e.engine.replace(/-/g,' '))} · ${new Date(e.ts).toLocaleDateString()} ${e.reviewed?`· ✓×${e.reviewed}`:''}</div>
      <div style="margin:6px 0">${esc(e.prompt)}</div>
      ${e.yours?`<div>You said: <span class="y">${esc(e.yours)}</span></div>`:''}
      <div>Correct: <span class="c">${esc(e.correct)}</span></div>
      ${e.explanation?`<div class="small mut" style="margin-top:6px">${esc(e.explanation)}</div>`:''}
      <div class="row mt" style="gap:8px">
        <button class="btn ghost" style="width:auto;padding:8px 16px;font-size:13px" data-r="${e.id}">✓ Got it</button>
        <button class="btn ghost" style="width:auto;padding:8px 16px;font-size:13px" data-d="${e.id}">🗑</button>
      </div></div>`;
  });
  body.innerHTML=html;
  const rerender=()=>reviewErrors(body,Store.S.errorLog);
  body.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{Store.reviewError(b.dataset.r);toast('Logged as reviewed 🧠');UI.refreshHud();rerender();});
  body.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{
    Store.S.errorLog=Store.S.errorLog.filter(x=>x.id!==b.dataset.d);Store.save();rerender();});
}

/* ================= PROGRESS ================= */
function progress(root){
  const S=Store.S,L=Store.level(),defs=Content.cache.badges.badges||Content.cache.badges,plan=Content.cache.plan;
  // XP chart last 14 days
  const days=[];for(let k=13;k>=0;k--){const d=new Date();d.setDate(d.getDate()-k);
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    days.push({key,xp:S.xpByDay[key]||0,label:String(d.getDate())});}
  const mx=Math.max(10,...days.map(d=>d.xp));
  // streak calendar last 35 days
  let cal='';for(let k=34;k>=0;k--){const d=new Date();d.setDate(d.getDate()-k);
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const hit=(S.xpByDay[key]||0)>=10,k0=k===0;
    cal+=`<div class="d${hit?' hit':''}${k0?' today':''}">${d.getDate()}</div>`;}
  const planDone=S.planDone||{};
  root.innerHTML=`
    <div class="greet">Progress 📊</div><p class="sub">Level ${L.n} · ${esc(L.name)} · ${S.xp} total XP</p>
    <div class="card"><div class="kicker">XP · last 14 days</div>
      <div class="bars">${days.map(d=>`<div class="b${d.xp?'':' zero'}" style="height:${Math.max(4,d.xp/mx*100)}%" title="${d.key}: ${d.xp} XP"></div>`).join('')}</div>
      <div class="row" style="justify-content:space-between"><span class="small dim">${days[0].key.slice(5)}</span><span class="small dim">${days[13].key.slice(5)}</span></div></div>
    <div class="card"><div class="kicker">Streak calendar · 35 days</div><div class="cal">${cal}</div>
      <div class="kv"><span>Current streak</span><b>🔥 ${S.streak.current} days</b></div>
      <div class="kv"><span>Best streak</span><b>${S.streak.best} days</b></div>
      <div class="kv"><span>Streak freezes</span><b>🛡️ ${S.streak.freezes}</b></div>
      <div class="kv" style="border:0"><span>Comebacks</span><b>💪 ${S.comebacks}</b></div></div>
    <h2 class="sec">Badges (${S.badges.length}/${defs.length})</h2>
    <div class="badge-grid">${defs.map(b=>{const got=S.badges.includes(b.id);
      return `<div class="bdg${got?'':' locked'}"><span class="e">${b.icon}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`;}).join('')}</div>
    <h2 class="sec">90-day checklist</h2>
    <div class="card" id="plan-list">${plan.weeks.map(w=>`
      <div class="check${planDone[w.week]?' done':''}" data-w="${w.week}"><div class="box">${planDone[w.week]?'✓':''}</div>
      <span class="txt"><b>Week ${w.week}:</b> ${esc(w.focus)}<br><span class="small dim">🎯 ${esc(w.milestone)}</span></span></div>`).join('')}</div>
    <div class="card"><div class="kicker">Lifetime stats</div>
      <div class="kv"><span>Lessons completed</span><b>${Object.keys(S.lessonsDone).length}</b></div>
      <div class="kv"><span>Drills attempted</span><b>${Object.values(S.drillsDone).reduce((a,b)=>a+b,0)}</b></div>
      <div class="kv"><span>Shadowing reps</span><b>${S.shadowingDone}</b></div>
      <div class="kv"><span>Speaking tasks</span><b>${S.speakingDone}</b></div>
      <div class="kv"><span>SRS reviews</span><b>${S.srsReviews}</b></div>
      <div class="kv" style="border:0"><span>Mistakes reviewed</span><b>${S.errorReviews}</b></div></div>
    <button class="btn ghost mt" id="reset">Reset all progress</button>
    <p class="small dim center">Progress is stored on this device only. It works fully offline.</p>`;
  root.querySelectorAll('#plan-list .check').forEach(c=>c.onclick=()=>{
    const w=+c.dataset.w;S.planDone=S.planDone||{};
    if(S.planDone[w])delete S.planDone[w];else{S.planDone[w]=Date.now();confetti(40);}
    Store.save();progress(root);
  });
  root.querySelector('#reset').onclick=()=>{
    const m=modal(`<h3>Reset everything?</h3><p class="mut small">XP, streak, badges, error log — all gone. This can't be undone.</p>
      <button class="btn danger" id="r-yes">Yes, reset</button>
      <button class="btn ghost mt" id="r-no">Keep my progress</button>`);
    m.querySelector('#r-yes').onclick=()=>Store.reset();
    m.querySelector('#r-no').onclick=()=>m.remove();
  };
}

window.Screens={home,learn,moduleView,lessonView,practice,practiceArena:practice,review,progress,placement,quizList,taskList};
})();
