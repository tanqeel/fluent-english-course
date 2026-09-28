/* Drill engines — fix-sentence, multiple-choice, fill-blank, dialogue, shadowing,
   flashcard (SRS), timed-quiz, speaking-task. Zero deps, offline-safe. */
(function(){
const {el,esc,toast}=UI;

function norm(s){return String(s||'').toLowerCase().trim().replace(/\s+/g,' ').replace(/[.!?]+$/,'');}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;}

function feedback(host,ok,html){
  host.querySelector('.fb-slot')?.remove();
  const d=el(`<div class="fb-slot feedback ${ok?'good':'bad'}">${html}</div>`);
  host.appendChild(d);return d;
}
function explainBlock(step){
  return step.explanation?`<div class="explain"><b>Why:</b> ${UI.md(step.explanation)}</div>`:'';
}
function continueBtn(host,api,label='Continue →'){
  const b=el(`<button class="btn mt">${label}</button>`);
  b.onclick=()=>api.done&&api.done();
  host.appendChild(b);
}
function markDrill(engine,correct){
  const S=Store.S;
  S.drillsDone[engine]=(S.drillsDone[engine]||0)+1;
  if(correct)S.drillsCorrect[engine]=(S.drillsCorrect[engine]||0)+1;
  Store.save();
}

/* ---------- multiple choice ---------- */
function mc(step,host,api){
  const wrap=el(`<div><p style="font-size:17px;font-weight:700">${esc(step.prompt)}</p><div class="opts"></div></div>`);
  const box=wrap.querySelector('.opts');
  let done=false;
  shuffle(step.options).forEach(text=>{
    const b=el(`<button class="opt">${esc(text)}</button>`);
    b.onclick=()=>{
      if(done)return;
      const correct=norm(text)===norm(step.options[step.answer]);
      if(correct){done=true;b.classList.add('right');
        feedback(host,true,`✅ Correct! ${explainBlock(step)}`);
        markDrill('multiple-choice',true);api.award(step.xp||10);continueBtn(host,api);
      }else{b.classList.add('wrong');
        feedback(host,false,`❌ Not quite. Try again — read the options once more.`);
        markDrill('multiple-choice',false);
        api.logError({prompt:step.prompt,yours:text,correct:step.options[step.answer],explanation:step.explanation,engine:'multiple-choice'});
      }
    };
    box.appendChild(b);
  });
  host.appendChild(wrap);
}

/* ---------- fix the sentence ---------- */
function fixSentence(step,host,api){
  const wrap=el(`<div>
    <p class="mut small">Fix this sentence:</p>
    <div class="shad-text" style="border-color:color-mix(in srgb,var(--red) 40%,transparent)">❌ ${esc(step.wrong)}</div>
    <input class="field" id="fx-in" placeholder="Type the corrected sentence…" autocomplete="off">
    <div class="row" style="gap:8px"><button class="btn" id="fx-go" style="flex:3">Check ✓</button>
    <button class="btn ghost" id="fx-hint" style="flex:1">${UI.icon('tip','in-tx')}</button></div></div>`);
  host.appendChild(wrap);
  let done=false,tried=false;
  wrap.querySelector('#fx-hint').onclick=()=>toast(UI.icon('tip','in-tx')+' '+step.hint,3200);
  wrap.querySelector('#fx-go').onclick=()=>{
    if(done)return;
    const v=wrap.querySelector('#fx-in').value;
    if(!v.trim()){toast('Type your fix first '+UI.icon('write','in-tx'));return;}
    const okAns=[step.answer].concat(step.accept||[]);
    if(okAns.some(a=>norm(v)===norm(a))){
      done=true;wrap.querySelector('#fx-in').disabled=true;
      feedback(host,true,`✅ <b>${esc(step.answer)}</b>${explainBlock(step)}`);
      markDrill('fix-sentence',!tried);api.award(tried?Math.ceil((step.xp||10)/2):(step.xp||10));continueBtn(host,api);
    }else{tried=true;wrap.querySelector('#fx-in').classList.add('shake-x');
      setTimeout(()=>wrap.querySelector('#fx-in')?.classList.remove('shake-x'),350);
      feedback(host,false,`❌ Not yet. Correct version: <b>${esc(step.answer)}</b>${explainBlock(step)}`);
      markDrill('fix-sentence',false);
      api.logError({prompt:'Fix: '+step.wrong,yours:v,correct:step.answer,explanation:step.explanation,engine:'fix-sentence'});
    }
  };
}

/* ---------- fill in the blank ---------- */
function fillBlank(step,host,api){
  const parts=String(step.text||(step.options&&step.options[0])||step.prompt||'').split('___');
  const wrap=el(`<div><p style="font-size:17px;font-weight:700">${esc(parts[0])}<span style="color:var(--acc)">___</span>${esc(parts[1]||'')}</p><div class="opts"></div></div>`);
  host.appendChild(wrap);
  const box=wrap.querySelector('.opts');
  let done=false;
  if(step.options&&step.options.length>1){
    // options[0] is the stem text; choices follow
    const choices=step.options.slice(1);
    shuffle(choices).forEach(c=>{
      const b=el(`<button class="opt">${esc(c)}</button>`);
      b.onclick=()=>{
        if(done)return;
        const full=(parts[0]+c+(parts[1]||'')).trim();
        if(norm(full)===norm(step.answer)){
          done=true;b.classList.add('right');
          feedback(host,true,`✅ <b>${esc(step.answer)}</b>${explainBlock(step)}`);
          markDrill('fill-blank',true);api.award(step.xp||10);continueBtn(host,api);
        }else{b.classList.add('wrong');
          feedback(host,false,`❌ The answer is: <b>${esc(step.answer)}</b>${explainBlock(step)}`);
          markDrill('fill-blank',false);
          api.logError({prompt:step.prompt||step.text,yours:c,correct:step.answer,explanation:step.explanation,engine:'fill-blank'});
        }
      };
      box.appendChild(b);
    });
  }else{
    const inp=el(`<input class="field" placeholder="Type the missing word(s)…" autocomplete="off">`);
    const go=el(`<button class="btn mt">Check ✓</button>`);
    box.append(inp,go);
    go.onclick=()=>{
      if(done)return;const v=inp.value;if(!v.trim()){toast('Type something first '+UI.icon('write','in-tx'));return;}
      const full=(parts[0]+v+(parts[1]||'')).trim();
      const ok=(step.accept||[step.answer]).some(a=>norm(full)===norm(a));
      if(ok){done=true;feedback(host,true,`✅ <b>${esc(step.answer)}</b>${explainBlock(step)}`);markDrill('fill-blank',true);api.award(step.xp||10);continueBtn(host,api);}
      else{feedback(host,false,`❌ The answer is: <b>${esc(step.answer)}</b>${explainBlock(step)}`);markDrill('fill-blank',false);
        api.logError({prompt:step.prompt||step.text,yours:v,correct:step.answer,explanation:step.explanation,engine:'fill-blank'});}
    };
  }
}

/* ---------- complete the dialogue ---------- */
function dialogue(step,host,api){
  const wrap=el(`<div><p class="mut small">${UI.icon('roleplay','in-tx')} ${esc(step.scene)}</p><div class="lines"></div></div>`);
  host.appendChild(wrap);
  const lines=wrap.querySelector('.lines');
  const turns=step.turns||[];
  let ti=0,score=0;
  function showTurn(){
    if(ti>=turns.length){
      feedback(host,true,`${UI.icon('party','in-tx')} Dialogue complete! ${explainBlock(step)}`);
      markDrill('dialogue',score===turns.length);api.award(score===turns.length?(step.xp||15):Math.ceil((step.xp||15)/2));continueBtn(host,api);return;
    }
    const t=turns[ti];
    const line=el(`<div class="card" style="margin:10px 0"><p class="small dim" style="margin:0 0 6px"><b style="color:var(--vio)">${esc(t.who)}</b> says:</p><div class="opts"></div></div>`);
    const box=line.querySelector('.opts');
    let answered=false;
    shuffle(t.options).forEach((opt,i)=>{
      const b=el(`<button class="opt">${esc(opt)}</button>`);
      b.onclick=()=>{
        if(answered)return;answered=true;
        if(norm(opt)===norm(t.options[t.answer])){score++;b.classList.add('right');toast('✅ Natural!');}
        else{b.classList.add('wrong');
          api.logError({prompt:step.scene+' — your line',yours:opt,correct:t.options[t.answer],explanation:step.explanation,engine:'dialogue'});
          toast('❌ The natural line was: “'+t.options[t.answer]+'”',3000);}
        ti++;setTimeout(showTurn,650);
      };
      box.appendChild(b);
    });
    lines.appendChild(line);
  }
  showTurn();
}

/* ---------- media recorder helper ---------- */
function makeRecorder(){
  let rec=null,chunks=[],stream=null;
  return{
    async start(){
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      rec=new MediaRecorder(stream);chunks=[];
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      rec.start();
    },
    stop(){return new Promise(res=>{
      rec.onstop=()=>{const blob=new Blob(chunks,{type:rec.mimeType||'audio/webm'});
        stream.getTracks().forEach(t=>t.stop());res(URL.createObjectURL(blob));};
      rec.stop();
    })},
    get live(){return rec&&rec.state==='recording';}
  };
}
function speak(text){
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);u.rate=.92;u.lang='en-US';
    speechSynthesis.speak(u);
  }catch(e){toast('No voice available on this device 🔇');}
}

/* ---------- shadowing ---------- */
function shadowing(step,host,api){
  const wrap=el(`<div>
    <p class="mut small">${UI.icon('listen','in-tx')} <b style="color:var(--txt)">${esc(step.title||'Shadowing')}</b> — listen, then copy the rhythm.</p>
    <div class="shad-text">“${esc(step.text)}”</div>
    <div class="row" style="justify-content:center;gap:10px;margin:10px 0">
      <button class="btn ghost" id="sh-play" style="width:auto;padding:12px 20px">▶ Model</button>
    </div>
    <div class="row" style="justify-content:center"><button class="rec-btn" id="sh-rec">${UI.icon('mic','in-tx')}</button></div>
    <p class="center small dim" id="sh-status">Tap ${UI.icon('mic','in-tx')} and shadow the line out loud</p>
    <div id="sh-back"></div>
    ${step.tip?`<div class="tip">${UI.icon('tip','in-tx')} ${esc(step.tip)}</div>`:''}
  </div>`);
  host.appendChild(wrap);
  const R=makeRecorder();let recURL=null,started=false;
  const playBtn=wrap.querySelector('#sh-play'),recBtn=wrap.querySelector('#sh-rec'),status=wrap.querySelector('#sh-status'),back=wrap.querySelector('#sh-back');
  playBtn.onclick=()=>{
    if(step.audio){const a=new Audio(step.audio);a.play().catch(()=>speak(step.text));}
    else speak(step.text);
  };
  recBtn.onclick=async()=>{
    try{
      if(!R.live){
        await R.start();started=true;recBtn.classList.add('live');recBtn.textContent='⏹️';
        status.textContent='Recording… speak now!';
      }else{
        recURL=await R.stop();recBtn.classList.remove('live');recBtn.innerHTML=UI.icon('mic','in-tx');
        status.textContent='Nice! Listen to yourself:';
        back.innerHTML='';
        const a=document.createElement('audio');a.controls=true;a.src=recURL;back.appendChild(a);
        if(!wrap.querySelector('#sh-done')){
          const d=el(`<button class="btn mt" id="sh-done">Done — I shadowed it ✓</button>`);
          d.onclick=()=>{
            Store.S.shadowingDone++;Store.save();
            markDrill('shadowing',true);api.award(step.xp||15);
            toast(UI.icon('mic','in-tx')+' Rep logged! Shadowing builds muscle memory.');
            continueBtn(host,api);
            d.remove();
          };
          back.appendChild(d);
        }
      }
    }catch(e){toast(UI.icon('mic','in-tx')+' Mic blocked — allow microphone access to record.');}
  };
}

/* ---------- flashcard (lesson self-grade + review SM-2) ---------- */
function flashcard(step,host,api,mode){
  const card=el(`<div class="fc"><div class="fc-in">
    <div class="fc-f"><div class="small dim">FRONT — tap to flip</div><div style="margin-top:10px">${esc(step.front)}</div></div>
    <div class="fc-b"><div class="small dim">BACK</div><div style="margin-top:10px">${esc(step.back)}</div>
    ${step.example?`<div class="small" style="margin-top:12px;font-style:italic;color:var(--acc)">${esc(step.example)}</div>`:''}</div>
  </div></div>`);
  host.appendChild(card);
  card.onclick=()=>card.classList.add('flip');
  const row=el(`<div class="grade-row" style="display:none"></div>`);
  host.appendChild(row);
  function showGrades(){
    row.style.display='flex';
    if(mode==='sm2'){
      // Again / Hard / Good / Easy -> SM-2 quality 0/3/4/5
      const opts=[['Again',0,'g1','<small>forgot</small>'],['Hard',3,'','<small>tough</small>'],['Good',4,'g4','<small>ok</small>'],['Easy',5,'g4','<small>instant</small>']];
      opts.forEach(([label,q,cls,sub])=>{
        const b=el(`<button class="grade ${cls}">${label}${sub}</button>`);
        b.onclick=()=>{
          const st=SM2.review(Store.S.srs[step.cardId]||{},q);
          Store.S.srs[step.cardId]={...st,front:step.front,back:step.back,example:step.example||''};
          Store.S.srsReviews++;Store.save();Store.checkBadges();
          UI.toast(q>=3?`Scheduled in ${st.interval} day${st.interval>1?'s':''} ${UI.icon('calendar','in-tx')}`:'Back tomorrow — no stress '+UI.icon('calendar','in-tx'));
          api.done&&api.done();
        };
        row.appendChild(b);
      });
    }else{
      const knew=el(`<button class="grade g4">✓ I knew it</button>`);
      const not=el(`<button class="grade g1">✗ Not yet</button>`);
      knew.onclick=()=>{markDrill('flashcard',true);api.award(step.xp||5);continueBtn(host,api);row.style.display='none';};
      not.onclick=()=>{
        // seed SRS card for scheduled review
        const cid='srs_lesson_'+(step.uid||step.id||Date.now());
        if(!Store.S.srs[cid])Store.S.srs[cid]={ef:2.5,interval:0,reps:0,due:Date.now(),front:step.front,back:step.back,example:step.example||''};
        Store.save();markDrill('flashcard',false);
        toast('Added to your Review deck '+UI.icon('review','in-tx'));continueBtn(host,api);row.style.display='none';
      };
      row.append(knew,not);
    }
  }
  // reveal grades shortly after flip
  const obs=new MutationObserver(()=>{if(card.classList.contains('flip')){showGrades();obs.disconnect();}});
  obs.observe(card,{attributes:true,attributeFilter:['class']});
}

/* ---------- journal (free writing, saved on-device) ---------- */
let jSeq=Date.now();
function journal(step,host,api){
  const wrap=el(`<div>
    <p class="mut small">${UI.icon('write','in-tx')} <b style="color:var(--txt)">Writing</b> — be honest, write it properly.</p>
    <div class="card" style="margin:10px 0"><div style="font-size:15px">${UI.md(step.prompt||'')}</div></div>
    <textarea class="field" id="j-t" rows="5" placeholder="Write here…"></textarea>
    <button class="btn" id="j-save">Save entry ✓</button>
    <p class="small dim center" style="margin-top:8px">Saved on this device only. Submit to Muse in chat for strict feedback.</p>
  </div>`);
  host.appendChild(wrap);
  let done=false;
  wrap.querySelector('#j-save').onclick=()=>{
    if(done)return;
    const v=wrap.querySelector('#j-t').value.trim();
    if(v.length<3){toast('Write a little more first '+UI.icon('write','in-tx'));return;}
    done=true;
    const S=Store.S;S.journal=S.journal||[];
    S.journal.unshift({id:'j'+(jSeq++),ts:Date.now(),prompt:String(step.prompt||'').slice(0,120),text:v.slice(0,2000)});
    if(S.journal.length>200)S.journal.length=200;
    Store.save();
    markDrill('journal',true);api.award(step.xp||15);
    feedback(host,true,`✅ Saved to your journal.`);
    continueBtn(host,api);
  };
}

/* ---------- word order (tap words into order) ---------- */
function wordOrder(step,host,api,onResult){
  const words=shuffle(step.words||[]);
  const picked=[];
  const wrap=el(`<div>
    <p style="font-size:16px;font-weight:700">${esc(step.prompt||'Put the words in order:')}</p>
    <div class="shad-text" id="wo-out" style="min-height:56px;color:var(--dim)">Tap the words…</div>
    <div id="wo-bank" style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0"></div>
    <div class="row" style="gap:8px">
      <button class="btn" id="wo-go" style="flex:2">Check ✓</button>
      <button class="btn ghost" id="wo-clear" style="flex:1">↺</button>
    </div></div>`);
  host.appendChild(wrap);
  const out=wrap.querySelector('#wo-out'),bank=wrap.querySelector('#wo-bank');
  let done=false,fails=0;
  function paint(){
    out.innerHTML=picked.length?esc(picked.join(' ')):'Tap the words…';
    out.style.color=picked.length?'var(--txt)':'var(--dim)';
    bank.innerHTML='';
    words.forEach((w,i)=>{
      if(picked.includes(i))return;
      const c=el(`<button class="chip" style="font-size:15px;padding:9px 14px;cursor:pointer">${esc(w)}</button>`);
      c.onclick=()=>{if(!done){picked.push(i);paint();}};
      bank.appendChild(c);
    });
  }
  out.onclick=()=>{if(!done&&picked.length){picked.pop();paint();}};
  wrap.querySelector('#wo-clear').onclick=()=>{if(!done){picked.length=0;paint();}};
  wrap.querySelector('#wo-go').onclick=()=>{
    if(done||!picked.length){toast('Tap the words first 👆');return;}
    const sent=picked.map(i=>words[i]).join(' ');
    if(norm(sent)===norm(step.answer)){
      done=true;
      feedback(host,true,`✅ <b>${esc(step.answer)}</b>${explainBlock(step)}`);
      finish(true);
    }else{
      fails++;
      wrap.querySelector('#wo-out').classList.add('shake-x');
      setTimeout(()=>wrap.querySelector('#wo-out')?.classList.remove('shake-x'),350);
      if(fails>=2){
        feedback(host,false,`The correct order: <b>${esc(step.answer)}</b>${explainBlock(step)}`);
        finish(false,true);
      }else{
        feedback(host,false,`❌ Not quite — tap the sentence to remove the last word and retry.`);
        finish(false,false,true);
      }
    }
  };
  function finish(correct,showAnswer,retry){
    if(onResult){onResult(correct,retry);return;}
    if(retry)return;
    markDrill('word-order',correct);
    if(!correct)api.logError({prompt:step.prompt||'Put in order',yours:'(wrong order)',correct:step.answer,explanation:step.explanation,engine:'word-order'});
    if(correct)api.award(step.xp||10);
    else if(showAnswer)api.award(Math.ceil((step.xp||10)/3));
    continueBtn(host,api);
  }
  paint();
}

/* ---------- timed quiz (mixed kinds: mc | fix | order | self) ---------- */
function timedQuiz(step,host,api){
  const qs=shuffle(step.questions||[]);
  let i=0,score=0,left=step.seconds||300,timer=null,locked=false,finished=false;
  const wrap=el(`<div>
    <div class="row" style="justify-content:space-between"><span class="chip">⏱️ ${esc(step.title||'Quiz')}</span><span class="q-timer" id="tq-t"></span></div>
    ${step.rule?`<p class="small dim center">${esc(step.rule)}</p>`:''}
    <div class="lprog"><i id="tq-p" style="width:0%"></i></div>
    <div id="tq-q"></div></div>`);
  host.appendChild(wrap);
  const tEl=wrap.querySelector('#tq-t'),qEl=wrap.querySelector('#tq-q');
  function fmt(s){s=Math.max(0,s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
  tEl.textContent=fmt(left);
  timer=setInterval(()=>{
    left--;tEl.textContent=fmt(left);
    tEl.style.color=left<=15?'var(--red)':left<=60?'var(--amber)':'';
    if(left<=0)finish();
  },1000);
  function next(correct){
    if(correct)score++;
    i++;setTimeout(ask,500);
  }
  function ask(){
    if(i>=qs.length){finish();return;}
    clearInterval(timer);
    timer=setInterval(()=>{
      left--;tEl.textContent=fmt(left);
      tEl.style.color=left<=15?'var(--red)':left<=60?'var(--amber)':'';
      if(left<=0)finish();
    },1000);
    locked=false;
    const q=qs[i];
    wrap.querySelector('#tq-p').style.width=(i/qs.length*100)+'%';
    qEl.innerHTML='';
    const head=el(`<div><p style="font-size:16.5px;font-weight:700">${i+1}. ${UI.md(q.prompt||'')}</p><div id="tq-body"></div></div>`);
    qEl.appendChild(head);
    const body=head.querySelector('#tq-body');
    if(q.kind==='mc'){
      shuffle(q.options).forEach(o=>{
        const b=el(`<button class="opt">${esc(typeof o==='object'?o.t:o)}</button>`);
        b.onclick=()=>{
          if(locked)return;locked=true;
          const val=typeof o==='object'?o.v:o;
          if(norm(val)===norm(q.options[q.answer])||norm(typeof o==='object'?o.t:o)===norm(typeof q.options[q.answer]==='object'?q.options[q.answer].t:q.options[q.answer])){
            b.classList.add('right');toast('✅');next(true);
          }else{
            b.classList.add('wrong');
            api.logError({prompt:q.prompt,yours:val,correct:typeof q.options[q.answer]==='object'?q.options[q.answer].t:q.options[q.answer],explanation:q.explanation,engine:'timed-quiz'});
            toast('❌ '+(q.explanation||''),2600);next(false);
          }
        };
        body.appendChild(b);
      });
    }else if(q.kind==='fix'){
      body.appendChild(el(`<div class="shad-text" style="border-color:color-mix(in srgb,var(--red) 40%,transparent)">❌ ${esc(q.wrong||'')}</div>`));
      const inp=el(`<input class="field" placeholder="Type the corrected version…" autocomplete="off">`);
      const go=el(`<button class="btn mt">Check ✓</button>`);
      body.append(inp,go);
      go.onclick=()=>{
        if(locked)return;
        const v=inp.value;if(!v.trim()){toast('Type something first '+UI.icon('write','in-tx'));return;}
        locked=true;
        const okAns=[q.answer].concat(q.accept||[]);
        if(okAns.some(a=>norm(v)===norm(a))){toast('✅');next(true);}
        else{api.logError({prompt:'Fix: '+(q.wrong||q.prompt),yours:v,correct:q.answer,explanation:q.explanation,engine:'timed-quiz'});
          toast('❌ → '+q.answer,3000);next(false);}
      };
    }else if(q.kind==='order'){
      orderInline(q,body,ok=>{ if(!ok)toast('❌ → '+q.answer,2600); next(ok); },
        e=>api.logError({...e,engine:'timed-quiz'}));
    }else{ // self-graded: write / dialogue / rewrite
      const ta=el(`<textarea class="field" rows="3" placeholder="Write your answer…"></textarea>`);
      const show=el(`<button class="btn mt">Show sample answer</button>`);
      body.append(ta,show);
      show.onclick=()=>{
        show.remove();
        body.appendChild(el(`<div class="explain"><b>Sample answer:</b><br>${UI.md(q.sample||'')}</div>`));
        const row=el(`<div class="grade-row"></div>`);
        const good=el(`<button class="grade g4">✓ Mine matches</button>`);
        const bad=el(`<button class="grade g1">✗ I missed it</button>`);
        good.onclick=()=>{toast('✅ Honest work.');next(true);};
        bad.onclick=()=>{api.logError({prompt:q.prompt,yours:ta.value.slice(0,120)||'(blank)',correct:q.sample,explanation:q.explanation,engine:'timed-quiz'});next(false);};
        row.append(good,bad);body.appendChild(row);
      };
    }
  }
  function finish(){
    if(finished)return;finished=true;
    clearInterval(timer);
    if(!qs.length)return;
    const pct=Math.round(score/qs.length*100);
    const S=Store.S,key=step.uid||step.id||'quiz';
    if(pct>(S.quizBest[key]||0))S.quizBest[key]=pct;
    Store.save();
    qEl.innerHTML='';
    wrap.querySelector('#tq-p').style.width='100%';
    const great=pct>=80;
    feedback(host,great,`${UI.icon('target','in-tx')} <b>${score}/${qs.length} — ${pct}%</b><br>${great?'Excellent! 8/10+ — you may move on. '+UI.icon('party','in-tx'):pct>=50?'Good effort — your misses are in the Error Log. Hit 8/10 to move on.':'Tough round. Review the Error Log, redo the lesson, and try again.'}`);
    markDrill('timed-quiz',great);
    api.award(Math.round((step.xp||100)*score/qs.length));
    continueBtn(host,api,great?'Continue →':'Review & continue →');
  }
  ask();
}

/* inline word-order used by quizzes (result via callback) */
function orderInline(q,host,onDone,onErr){
  const words=q.words.slice();
  for(let k=words.length-1;k>0;k--){const j=Math.random()*(k+1)|0;[words[k],words[j]]=[words[j],words[k]];}
  const picked=[];
  const wrap=el(`<div>
    <div class="shad-text" id="oi-out" style="min-height:52px;color:var(--dim)">Tap the words…</div>
    <div id="oi-bank" style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0"></div>
    <div class="row" style="gap:8px"><button class="btn" id="oi-go" style="flex:2">Check ✓</button>
    <button class="btn ghost" id="oi-clear" style="flex:1">↺</button></div></div>`);
  host.appendChild(wrap);
  const out=wrap.querySelector('#oi-out'),bank=wrap.querySelector('#oi-bank');
  let done=false,fails=0;
  function paint(){
    out.innerHTML=picked.length?esc(picked.map(x=>words[x]).join(' ')):'Tap the words…';
    bank.innerHTML='';
    words.forEach((w,idx)=>{
      if(picked.includes(idx))return;
      const c=el(`<button class="chip" style="font-size:15px;padding:9px 14px;cursor:pointer">${esc(w)}</button>`);
      c.onclick=()=>{if(!done){picked.push(idx);paint();}};
      bank.appendChild(c);
    });
  }
  out.onclick=()=>{if(picked.length){picked.pop();paint();}};
  wrap.querySelector('#oi-clear').onclick=()=>{picked.length=0;paint();};
  wrap.querySelector('#oi-go').onclick=()=>{
    if(done||!picked.length){toast('Tap the words first 👆');return;}
    const sent=picked.map(x=>words[x]).join(' ');
    if(norm(sent)===norm(q.answer)){done=true;onDone(true);}
    else{fails++;out.classList.add('shake-x');setTimeout(()=>out.classList.remove('shake-x'),350);
      if(fails>=2){done=true;onErr&&onErr({prompt:q.prompt,yours:sent,correct:q.answer,explanation:q.explanation});onDone(false);}
      else toast('❌ Not quite — retry.');}
  };
  paint();
}

/* ---------- speaking task ---------- */
function speakingTask(step,host,api){
  const total=step.seconds||90;
  let left=total,timer=null,done=false;
  const wrap=el(`<div>
    <p class="mut small">${UI.icon('mic','in-tx')} <b style="color:var(--txt)">${esc(step.title||'Speaking task')}</b></p>
    <div class="shad-text">${UI.md(step.prompt)}</div>
    ${step.model?`<details class="explain"><summary>${UI.icon('read','in-tx')} <b>Model script</b> — tap to read</summary><div class="mt">${UI.md(step.model)}</div><button class="btn ghost mt" id="sp-model-audio">🔊 Hear the model</button></details>`:''}
    ${(step.checklist||[]).map(c=>`<div class="check"><div class="box"></div><span class="txt small">${esc(c)}</span></div>`).join('')}
    <div class="timer" id="sp-t">${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}</div>
    <div class="row" style="justify-content:center;gap:8px">
      <button class="btn ghost" id="sp-start" style="width:auto;padding:12px 22px">▶ Start timer</button>
      <button class="rec-btn" id="sp-rec" style="margin:0">${UI.icon('mic','in-tx')}</button>
    </div>
    <p class="center small dim" id="sp-status">Record yourself, then listen back.</p>
    <div id="sp-back"></div>
    ${step.tip?`<div class="tip">${UI.icon('tip','in-tx')} ${esc(step.tip)}</div>`:''}
  </div>`);
  host.appendChild(wrap);
  const modelBtn=wrap.querySelector('#sp-model-audio');
  if(modelBtn)modelBtn.onclick=()=>speak(step.script||step.model||'');
  const R=makeRecorder();
  const tEl=wrap.querySelector('#sp-t'),recBtn=wrap.querySelector('#sp-rec'),status=wrap.querySelector('#sp-status'),back=wrap.querySelector('#sp-back');
  wrap.querySelector('#sp-start').onclick=e=>{
    e.target.disabled=true;
    timer=setInterval(()=>{
      left--;tEl.textContent=`${Math.floor(Math.max(0,left)/60)}:${String(Math.max(0,left)%60).padStart(2,'0')}`;
      tEl.className='timer'+(left<=10?' end':left<=30?' warn':'');
      if(left<=0){clearInterval(timer);tEl.textContent="Time! ⏰";toast('Time! Wrap up your last sentence. ⏰');}
    },1000);
  };
  recBtn.onclick=async()=>{
    try{
      if(!R.live){await R.start();recBtn.classList.add('live');recBtn.textContent='⏹️';status.textContent='Recording… keep going in English!';}
      else{
        const url=await R.stop();recBtn.classList.remove('live');recBtn.innerHTML=UI.icon('mic','in-tx');status.textContent='Listen back — be your own coach:';
        back.innerHTML='';const a=document.createElement('audio');a.controls=true;a.src=url;back.appendChild(a);
        if(!wrap.querySelector('#sp-done')){
          const d=el(`<button class="btn mt" id="sp-done">Mark complete ✓</button>`);
          d.onclick=()=>{
            done=true;Store.S.speakingDone++;Store.save();
            markDrill('speaking-task',true);api.award(step.xp||25);
            feedback(host,true,`${UI.icon('party','in-tx')} Speaking task done!<br><span class="why">Want feedback? In the Muse chat, say <b>"speaking task"</b> and share what you said — you'll get corrections and a better version.</span>`);
            continueBtn(host,api);d.remove();
          };
          back.appendChild(d);
        }
      }
    }catch(e){toast(UI.icon('mic','in-tx')+' Mic blocked — allow microphone access to record.');}
  };
  // checklist toggles
  wrap.querySelectorAll('.check').forEach(c=>c.onclick=()=>c.classList.toggle('done'));
}

function mount(engine,step,host,api){
  const fn={ 'multiple-choice':mc,'fix-sentence':fixSentence,'fill-blank':fillBlank,'dialogue':dialogue,'complete-dialogue':dialogue,
    'shadowing':shadowing,'flashcard':flashcard,'flashcards':flashcard,'timed-quiz':timedQuiz,
    'speaking-task':speakingTask,'speaking-card':speakingTask,'journal':journal,'word-order':wordOrder }[engine];
  if(!fn){host.appendChild(el(`<div class="empty">Unknown drill type: ${esc(engine)}</div>`));return;}
  fn(step,host,api,api.mode);
}

window.Drills={mount,norm,speak,makeRecorder};
})();
