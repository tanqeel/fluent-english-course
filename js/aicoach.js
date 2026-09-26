/* Fluent AI Coach — bring-your-own-key Gemini coaching, 100% client-side.
   The key lives ONLY in localStorage on this device and is sent ONLY to
   Google's generativelanguage API. Nothing else ever sees it. */
(function(){
'use strict';
const {el,esc,md,toast,modal,xpToast}=UI;
const KEY_LS='fluent_gemini_key';      // the API key — device only
const STORE_LS='fluent_coach_v1';       // chat history + xp caps — device only
const API='https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const MODEL_LABEL='Gemini 2.0 Flash';

function getKey(){try{return localStorage.getItem(KEY_LS)||'';}catch(e){return '';}}
function setKey(k){try{localStorage.setItem(KEY_LS,k.trim());}catch(e){}}
function clearKey(){try{localStorage.removeItem(KEY_LS);}catch(e){}}

function cs(){let s;try{s=JSON.parse(localStorage.getItem(STORE_LS))||null;}catch(e){s=null;}
  if(!s)s={chat:[],xpDay:'',xpGiven:0};
  return s;}
function csSave(s){try{localStorage.setItem(STORE_LS,JSON.stringify(s));}catch(e){}}
function xpToday(n){ // small daily-capped XP for coach work
  const s=cs(),t=Store.todayStr();
  if(s.xpDay!==t){s.xpDay=t;s.xpGiven=0;}
  const room=Math.max(0,40-s.xpGiven),give=Math.min(room,n);
  if(give>0){s.xpGiven+=give;Store.addXP(give);xpToast(give);}
  csSave(s);
}

/* ---------- strict-tutor personas (from the course's master prompt) ---------- */
const SYS_CHAT=`You are Tanqeel's English speaking coach inside the Fluent app. He is a Pakistani university student at A2/B1 level, preparing for freelance client calls, IELTS, and professional life abroad.
Rules:
(1) Keep every reply under 80 words, mobile-friendly, simple natural English.
(2) Ask him ONE question at a time. Keep the conversation moving.
(3) After each of his messages, correct ALL errors in this format: his sentence → corrected sentence → one-line rule. Correct articles, prepositions, tenses — never let one pass.
(4) Never praise an incorrect sentence. Praise only genuine progress, specifically.
(5) If he repeats an error, stop and drill it with 5 short examples.
(6) Roman Urdu explanations are welcome when a rule is hard.
(7) When he says "roleplay", become the client in the scenario he gives, stay in character for 10 minutes, then give an error report card: Clarity / Tone / Structure / Client-safety, 1-5 each.`;

const SYS_WRITE=`You are Tanqeel's writing coach inside the Fluent app. He is a Pakistani university student at A2/B1 level, writing for freelance clients and IELTS.
For the text he pastes, reply in this exact structure:
**Scores** — Clarity /5, Tone /5, Structure /5, Client-safety /5 (no fake claims, no promises he can't keep).
**Corrected version** — the full text rewritten correctly.
**Fixes** — each fix as: wrong → right → one-line rule.
Keep it concise and mobile-friendly. Never praise errors.`;

const SYS_SPEAK=`You are Tanqeel's pronunciation coach inside the Fluent app. He is a Pakistani (Urdu-speaking) English learner at A2/B1 level. Listen to his recorded English speech and reply in this structure:
**Heard** — what you understood him saying (1-2 lines).
**Fix these** — 3-5 specific words/phrases: what he said → correct form, focusing on Urdu-speaker patterns (/th/ sounds, v/w, word stress, -ed endings, dropped articles).
**Fluency tip** — one tip on pace, fillers, or pauses.
Concise, mobile-friendly, encouraging but honest. If the audio is unclear or not English, say so plainly.`;

/* ---------- Gemini call ---------- */
async function callGemini(key,systemInstruction,parts,opts){
  opts=opts||{};
  let res;
  try{
    res=await fetch(API+'?key='+encodeURIComponent(key),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        system_instruction:{parts:[{text:systemInstruction}]},
        contents:[{role:'user',parts:parts}],
        generationConfig:{maxOutputTokens:opts.maxTokens||500,temperature:opts.temp??0.7}
      })
    });
  }catch(e){
    throw {friendly:'No internet connection. AI Coach needs internet — the rest of the app works offline. 🌐'};
  }
  let data=null;
  try{data=await res.json();}catch(e){}
  if(!res.ok){
    const msg=(data&&data.error&&data.error.message)||'';
    if(res.status===400&&/API key|API_KEY/i.test(msg))
      throw {friendly:'That key didn\'t work. Double-check you copied the whole key from Google AI Studio — no extra spaces. 🔑'};
    if(res.status===403)
      throw {friendly:'Google refused the key (403). The free quota may be exhausted for today — try again tomorrow, or make a fresh key. 🔑'};
    if(res.status===429)
      throw {friendly:'Too many requests — free tier rate limit. Wait a minute and try again. ⏳'};
    throw {friendly:'Coach had a hiccup ('+res.status+'). Try again in a moment.'};
  }
  const text=data&&data.candidates&&data.candidates[0]&&data.candidates[0].content
    &&data.candidates[0].content.parts.map(p=>p.text||'').join('');
  if(!text)throw {friendly:'The coach came back empty. Try again.'};
  return text;
}
function needKey(){
  return `<div class="card center" style="border:1.5px solid var(--vio)">
    <div style="font-size:44px">🤖</div><h3>Meet your AI Coach</h3>
    <p class="mut small">Conversation practice, writing feedback, and speaking feedback —
    right here in the app, powered by your own <b>free</b> Gemini key.</p>
    <button class="btn vio" id="coach-setup">Set up AI Coach · 2 min</button>
    <p class="small dim">Your key stays on this device only. Everything else in Fluent works fully offline.</p></div>`;
}

/* ---------- setup screen ---------- */
function setupView(root,back){
  root.innerHTML=`
  <div class="step-tag">AI Coach · setup</div>
  <div class="greet">Get your free key 🔑</div>
  <p class="sub">Once. Two minutes. Then the coach lives in your pocket.</p>
  <div class="card"><div class="kicker">Step 1</div>
    <p style="margin:8px 0">Open <b>Google AI Studio</b> — Google's free site for Gemini keys.</p>
    <button class="btn ghost" id="s-open">Open aistudio.google.com ↗</button></div>
  <div class="card"><div class="kicker">Step 2</div>
    <p style="margin:8px 0 0">Sign in with your Google account, tap <b>"Get API key"</b>, then <b>"Create API key"</b>. It's free — no card needed.</p></div>
  <div class="card"><div class="kicker">Step 3</div>
    <p style="margin:8px 0">Copy the key and paste it here:</p>
    <input class="field" id="s-key" type="password" placeholder="Paste your Gemini API key" autocomplete="off" spellcheck="false">
    <button class="btn" id="s-save">Save & test connection</button>
    <p class="small dim" id="s-status" style="margin:8px 0 0"></p></div>
  <div class="card"><div class="kicker" style="color:var(--acc)">🔒 Your privacy</div>
    <p class="small mut" style="margin:8px 0 0">The key is stored <b>only</b> in this browser's localStorage on your device.
    It is sent <b>only</b> to Google's API when you use the coach. Never logged, never shared, never in any file.
    You can remove it anytime from Coach → ⚙️.</p></div>
  <button class="btn ghost mt" id="s-back">← Back</button>`;
  root.querySelector('#s-open').onclick=()=>window.open('https://aistudio.google.com/apikey','_blank','noopener');
  root.querySelector('#s-back').onclick=back;
  root.querySelector('#s-save').onclick=async()=>{
    const k=root.querySelector('#s-key').value.trim();
    const st=root.querySelector('#s-status');
    if(!k){st.textContent='Paste the key first 🙂';return;}
    st.innerHTML='<span class="dim">Testing…</span>';
    try{
      await callGemini(k,'You are a test. Reply with exactly: OK',{text:'Say OK'},{maxTokens:5,temp:0});
      setKey(k);st.innerHTML='<b style="color:var(--acc)">✅ Connected! AI Coach is live.</b>';confetti(80);
      setTimeout(back,900);
    }catch(e){st.innerHTML='<b style="color:#f87171">'+esc(e.friendly||'Connection failed.')+'</b>';}
  };
}

/* ---------- shared coach shell ---------- */
function shell(root,title,sub,bodyFn){
  root.innerHTML=`
  <div class="step-tag">AI Coach <span class="ai-badge">🤖 AI</span> · needs internet</div>
  <div class="greet">${title}</div><p class="sub">${sub}</p>
  <div id="coach-body"></div>
  <div class="row mt" style="gap:8px">
    <button class="btn ghost" id="c-home" style="flex:1">← Coach home</button>
    <button class="btn ghost" id="c-key" style="flex:1">⚙️ Key settings</button>
  </div>`;
  root.querySelector('#c-home').onclick=()=>coachHome(root);
  root.querySelector('#c-key').onclick=()=>keySettings(root);
  bodyFn(root.querySelector('#coach-body'));
}
function bubble(who,text){
  return `<div class="msg ${who}">${who==='ai'?'<span class="ai-badge">🤖 AI</span>':''}<div class="msg-b">${md(text)}</div></div>`;
}
function keySettings(root){
  root.innerHTML=`<div class="step-tag">AI Coach · key settings</div>
  <div class="greet">Key settings ⚙️</div>
  <div class="card"><div class="kicker">Status</div>
    <p style="margin:8px 0">${getKey()?'<b style="color:var(--acc)">✅ Key saved on this device</b><br><span class="small dim">Model: '+esc(MODEL_LABEL)+' · free tier</span>':'<b style="color:#f87171">No key saved</b>'}</p>
    ${getKey()?`<button class="btn" id="k-remove" style="background:linear-gradient(135deg,#f87171,#dc2626);color:#fff">Remove my key</button>
    <p class="small dim">Removes the key from this device immediately. Chat history stays.</p>`:''}</div>
  <button class="btn ghost mt" id="k-back">← Coach home</button>`;
  root.querySelector('#k-back').onclick=()=>coachHome(root);
  const rm=root.querySelector('#k-remove');
  if(rm)rm.onclick=()=>{const m=modal(`<h3>Remove your API key?</h3><p class="mut small">The coach will stop working until you add a key again. Your progress is untouched.</p>
    <button class="btn" id="rk-yes" style="background:linear-gradient(135deg,#f87171,#dc2626);color:#fff">Remove it</button>
    <button class="btn ghost mt" id="rk-no">Keep it</button>`);
    m.querySelector('#rk-yes').onclick=()=>{clearKey();m.remove();toast('Key removed 🔒');coachHome(root);};
    m.querySelector('#rk-no').onclick=()=>m.remove();};
}

/* ---------- coach home ---------- */
function coachHome(root){
  const has=getKey();
  let html=`<div class="step-tag">AI Coach <span class="ai-badge">🤖 AI</span></div>
  <div class="greet">AI Coach 🤖</div>
  <p class="sub">Your strict tutor, inside the app. Corrects everything — never empty praise.</p>
  ${has?'':needKey()}
  <div class="card" style="cursor:pointer" data-c="chat"><div class="kicker">💬 Conversation practice</div>
    <p style="margin:8px 0"><b>Talk with the strict tutor</b></p>
    <p class="small dim" style="margin:0">One question at a time · every mistake corrected · say "roleplay" for a client scenario.</p></div>
  <div class="card" style="cursor:pointer" data-c="write"><div class="kicker">✍️ Writing feedback</div>
    <p style="margin:8px 0"><b>Paste your writing, get scored</b></p>
    <p class="small dim" style="margin:0">Clarity / Tone / Structure / Client-safety + corrected version + every fix explained.</p></div>
  <div class="card" style="cursor:pointer" data-c="speak"><div class="kicker">🎙️ Speaking feedback</div>
    <p style="margin:8px 0"><b>Record yourself, get pronunciation notes</b></p>
    <p class="small dim" style="margin:0">Needs internet · specific words to fix, tuned for Urdu speakers.</p></div>
  ${has?`<button class="btn ghost" id="c-key2">⚙️ Key settings</button>`:''}`;
  root.innerHTML=html;
  const go=c=>{ if(!getKey()){setupView(root,()=>coachHome(root));return;}
    if(c==='chat')chatView(root);else if(c==='write')writeView(root);else speakView(root);};
  root.querySelectorAll('[data-c]').forEach(c=>c.onclick=()=>go(c.dataset.c));
  const s=root.querySelector('#coach-setup');if(s)s.onclick=()=>setupView(root,()=>coachHome(root));
  const k2=root.querySelector('#c-key2');if(k2)k2.onclick=()=>keySettings(root);
}

/* ---------- 1. conversation practice ---------- */
function chatView(root){
  shell(root,'Conversation 💬','The strict tutor: talks with you, corrects everything.',body=>{
    const s=cs();
    body.innerHTML=`<div class="chat" id="ch-log"></div>
      <div class="row" style="gap:8px;margin-top:10px">
        <input class="field" id="ch-in" style="flex:1;margin:0" placeholder="Type to the coach…" autocomplete="off">
        <button class="btn" id="ch-send" style="width:auto;padding:13px 20px">➤</button></div>
      <p class="small dim center">Tip: type <b>roleplay</b> + a scenario for a mock client call.</p>`;
    const log=body.querySelector('#ch-log'),inp=body.querySelector('#ch-in');
    const draw=()=>{log.innerHTML=s.chat.map(m=>bubble(m.w,m.t)).join('');log.scrollTop=log.scrollHeight;};
    const push=(w,t)=>{s.chat.push({w,t});if(s.chat.length>40)s.chat=s.chat.slice(-40);csSave(s);draw();};
    draw();
    if(!s.chat.length)push('ai',"Assalam-o-Alaikum, Tanqeel! I'm your strict coach. I'll correct *every* mistake — that's how you get fluent. Let's start simple: **what did you do today?**");
    let busy=false;
    async function send(){
      if(busy)return;const txt=inp.value.trim();if(!txt)return;
      if(!navigator.onLine){toast('No internet — AI Coach needs it. The rest of Fluent works offline. 🌐');return;}
      busy=true;inp.value='';
      push('you',txt);xpToday(5);
      const typing=el('<div class="msg ai"><div class="msg-b dim">typing…</div></div>');log.appendChild(typing);log.scrollTop=log.scrollHeight;
      const history=s.chat.slice(-12).flatMap(m=>[{role:m.w==='you'?'user':'model',parts:[{text:m.t}]}]);
      try{
        const reply=await callGemini(getKey(),SYS_CHAT,history.slice(0,-1).concat([{role:'user',parts:[{text:txt}]}]));
        typing.remove();push('ai',reply);
      }catch(e){typing.remove();push('ai','⚠️ '+e.friendly);}
      busy=false;inp.focus();
    }
    body.querySelector('#ch-send').onclick=send;
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')send();});
  });
}

/* ---------- 2. writing feedback ---------- */
function writeView(root){
  shell(root,'Writing ✍️','Paste anything — email, essay, proposal. Get scored + fixed.',body=>{
    body.innerHTML=`<textarea class="field" id="w-in" rows="6" placeholder="Paste your English writing here…"></textarea>
      <button class="btn vio" id="w-go">Score my writing <span class="ai-badge">🤖 AI</span></button>
      <div id="w-out" class="mt"></div>`;
    let busy=false;
    body.querySelector('#w-go').onclick=async()=>{
      if(busy)return;const txt=body.querySelector('#w-in').value.trim();
      const out=body.querySelector('#w-out');
      if(!txt){toast('Paste some writing first ✍️');return;}
      if(!navigator.onLine){toast('No internet — AI Coach needs it. 🌐');return;}
      busy=true;out.innerHTML='<div class="card"><p class="dim small">Scoring… the coach reads every line.</p></div>';
      try{
        const reply=await callGemini(getKey(),SYS_WRITE,[{text:'Score and correct this writing:\n\n'+txt}],{maxTokens:700});
        out.innerHTML=`<div class="card"><span class="ai-badge">🤖 AI feedback</span><div class="mt" style="font-size:14.5px;line-height:1.65">${md(reply)}</div></div>`;
        xpToday(15);Store.S.speakingDone++;Store.save();
      }catch(e){out.innerHTML=`<div class="card"><p style="color:#f87171">${esc(e.friendly)}</p></div>`;}
      busy=false;window.scrollTo({top:document.body.scrollHeight});
    };
  });
}

/* ---------- 3. speaking feedback ---------- */
function speakView(root){
  shell(root,'Speaking 🎙️','Record yourself. Get pronunciation + fluency notes. <b>Needs internet.</b>',body=>{
    body.innerHTML=`
      <div class="card center">
        <p class="mut small">Read this out loud, then tap record:</p>
        <p class="shad-text" id="sp-line">“I would like to schedule a call to discuss the project timeline and the next steps.”</p>
        <button class="btn ghost" id="sp-new" style="width:auto;padding:10px 18px">🎲 New line</button></div>
      <div class="row" style="justify-content:center"><button class="rec-btn" id="sp-rec">🎙️</button></div>
      <p class="center small dim" id="sp-status">Tap 🎙️ and read the line</p>
      <div id="sp-out" class="mt"></div>`;
    const LINES=[
      'I would like to schedule a call to discuss the project timeline and the next steps.',
      'The third version of the report is ready for your review.',
      'Could you please clarify what you mean by the delivery date?',
      'I think this approach will work better for your customers.',
      'Thank you for your patience while I fix these issues.'];
    body.querySelector('#sp-new').onclick=()=>{body.querySelector('#sp-line').textContent='“'+LINES[Math.floor(Math.random()*LINES.length)]+'”';};
    const recBtn=body.querySelector('#sp-rec'),status=body.querySelector('#sp-status'),out=body.querySelector('#sp-out');
    let rec=null,chunks=[],recording=false,busy=false;
    function blobToB64(blob){return new Promise((res,rej)=>{const r=new FileReader();
      r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(blob);});}
    recBtn.onclick=async()=>{
      if(busy)return;
      if(!recording){
        if(!navigator.onLine){toast('Recording needs internet for AI feedback. 🌐');return;}
        try{
          const stream=await navigator.mediaDevices.getUserMedia({audio:true});
          rec=new MediaRecorder(stream);chunks=[];
          rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
          rec.start();recording=true;rec._stream=stream;
          recBtn.classList.add('live');status.innerHTML='<b style="color:#f87171">● Recording… tap again to stop</b>';
        }catch(e){toast('Microphone blocked. Allow mic access in your browser settings. 🎙️');}
        return;
      }
      recording=false;recBtn.classList.remove('live');status.textContent='Analyzing…';
      const stream=rec._stream;
      await new Promise(res=>{rec.onstop=res;rec.stop();});
      stream.getTracks().forEach(t=>t.stop());
      const blob=new Blob(chunks,{type:rec.mimeType||'audio/webm'});
      if(blob.size<2000){status.textContent='Too short — tap 🎙️ and try again.';return;}
      busy=true;out.innerHTML='<div class="card"><p class="dim small">Listening… the coach hears every sound.</p></div>';
      try{
        const b64=await blobToB64(blob);
        const reply=await callGemini(getKey(),SYS_SPEAK,[
          {text:'Give me pronunciation + fluency feedback on this recording. The line I read was: '+body.querySelector('#sp-line').textContent},
          {inlineData:{mimeType:blob.type||'audio/webm',data:b64}}
        ],{maxTokens:600});
        out.innerHTML=`<div class="card"><span class="ai-badge">🤖 AI feedback</span><div class="mt" style="font-size:14.5px;line-height:1.65">${md(reply)}</div></div>`;
        status.textContent='Done — tap 🎙️ to record again.';xpToday(20);Store.S.speakingDone++;Store.save();
      }catch(e){out.innerHTML=`<div class="card"><p style="color:#f87171">${esc(e.friendly)}</p></div>`;status.textContent='Tap 🎙️ to try again.';}
      busy=false;window.scrollTo({top:document.body.scrollHeight});
    };
  });
}

/* ---------- entry ---------- */
function coach(root){
  if(!getKey()){
    root.innerHTML=`<div class="step-tag">AI Coach <span class="ai-badge">🤖 AI</span></div>`;
    const host=el('<div></div>');root.appendChild(host);coachHome(host);return;
  }
  const host=el('<div></div>');root.appendChild(host);coachHome(host);
}

window.Screens.coach=coach;
window.AICoach={getKey,clearKey,callGemini};
})();
