/* Fluent AI Coach — 100% client-side.
   DEFAULT: "Free AI" (Pollinations text API) — free, no key, no signup, zero setup.
   OPTIONAL UPGRADE: your own free Gemini key for smarter feedback (esp. speaking).
   The Gemini key, when set, lives ONLY in localStorage on this device and is sent
   ONLY to Google's generativelanguage API. Nothing else ever sees it. */
(function(){
'use strict';
const {el,esc,md,toast,modal,xpToast}=UI;
const KEY_LS='fluent_gemini_key';      // the API key — device only
const STORE_LS='fluent_coach_v1';       // chat history + xp caps — device only
const GEMINI_API='https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const MODEL_LABEL='Gemini 2.0 Flash';
const FREE_API='https://text.pollinations.ai/';
const FREE_MODEL='openai';

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
const uname=()=>(Store.S.name||'friend');
const SYS_CHAT=()=>`You are ${uname()}'s English speaking coach inside the Speak Fluently app. ${uname()} is a university student at A2/B1 level, preparing for freelance client calls, IELTS, and professional life abroad.
Rules:
(1) Keep every reply under 80 words, mobile-friendly, simple natural English.
(2) Ask him ONE question at a time. Keep the conversation moving.
(3) After each of his messages, correct ALL errors in this format: his sentence → corrected sentence → one-line rule. Correct articles, prepositions, tenses — never let one pass.
(4) Never praise an incorrect sentence. Praise only genuine progress, specifically.
(5) If he repeats an error, stop and drill it with 5 short examples.
(6) Roman Urdu explanations are welcome when a rule is hard.
(7) When he says "roleplay", become the client in the scenario he gives, stay in character for 10 minutes, then give an error report card: Clarity / Tone / Structure / Client-safety, 1-5 each.`;

const SYS_WRITE=()=>`You are ${uname()}'s writing coach inside the Speak Fluently app. ${uname()} is a university student at A2/B1 level, writing for freelance clients and IELTS.
For the text he pastes, reply in this exact structure:
**Scores** — Clarity /5, Tone /5, Structure /5, Client-safety /5 (no fake claims, no promises he can't keep).
**Corrected version** — the full text rewritten correctly.
**Fixes** — each fix as: wrong → right → one-line rule.
Keep it concise and mobile-friendly. Never praise errors.`;

const SYS_SPEAK=()=>`You are ${uname()}'s pronunciation coach inside the Speak Fluently app. ${uname()} is an Urdu-speaking English learner at A2/B1 level. Listen to ${uname()}'s recorded English speech and reply in this structure:
**Heard** — what you understood him saying (1-2 lines).
**Fix these** — 3-5 specific words/phrases: what he said → correct form, focusing on Urdu-speaker patterns (/th/ sounds, v/w, word stress, -ed endings, dropped articles).
**Fluency tip** — one tip on pace, fillers, or pauses.
Concise, mobile-friendly, encouraging but honest. If the audio is unclear or not English, say so plainly.`;

/* ---------- Gemini call ---------- */
async function callGemini(key,systemInstruction,parts,opts){
  opts=opts||{};
  let res;
  try{
    res=await fetch(GEMINI_API+'?key='+encodeURIComponent(key),{
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
/* ---------- Free AI — no key, no signup ----------
   Provider chain (first success wins):
   1) Pollinations text API — POST {messages, model:"openai"}
   2) Pollinations GET fallback (prompt in URL)
   3) Puter.js (lazy-loaded SDK, keyless) — model gpt-5-nano
   All need internet; everything else in the app works offline. */
function isOfflineErr(e){return e instanceof TypeError||(e&&/failed to fetch|networkerror|load failed/i.test(e.message||''));}
async function fetchTimeout(url,init,ms){
  const ctrl=new AbortController();init=init||{};init.signal=ctrl.signal;
  const t=setTimeout(()=>ctrl.abort(),ms||60000);
  try{return await fetch(url,init);}finally{clearTimeout(t);}
}
async function pollinationsPOST(payload){
  const res=await fetchTimeout(FREE_API,{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({messages:payload,model:FREE_MODEL})},45000);
  const txt=await res.text();
  let j=null;try{j=JSON.parse(txt);}catch(e){}
  if(j&&j.error){
    if(res.status===429||/rate|limit/i.test(j.error||''))
      throw {friendly:'busy',retryable:true};
    throw {friendly:'Free AI had a hiccup ('+(j.status||res.status)+').',retryable:true};
  }
  if(!res.ok)throw {friendly:'Free AI had a hiccup ('+res.status+').',retryable:true};
  const t=(j&&typeof j==='string'?j:txt).trim();
  if(!t)throw {friendly:'The coach came back empty.',retryable:true};
  return t;
}
async function pollinationsGET(system,messages){
  const convo=messages.slice(-8).map(m=>(m.role==='user'?'You: ':'Coach: ')+m.content).join('\n');
  const prompt=(system+'\n\n'+convo).slice(0,3200);
  const res=await fetchTimeout(FREE_API+encodeURIComponent(prompt)+'?model='+FREE_MODEL,{},45000);
  const txt=await res.text();
  let j=null;try{j=JSON.parse(txt);}catch(e){}
  if(j&&j.error)throw {friendly:'Free AI had a hiccup.',retryable:true};
  if(!res.ok)throw {friendly:'Free AI had a hiccup ('+res.status+').',retryable:true};
  const t=txt.trim();
  if(!t)throw {friendly:'The coach came back empty.',retryable:true};
  return t;
}
function loadPuter(){
  return new Promise((res,rej)=>{
    if(window.puter&&window.puter.ai)return res(window.puter);
    const s=document.createElement('script');
    s.src='https://js.puter.com/v2/';s.async=true;
    const to=setTimeout(()=>rej(new Error('timeout')),25000);
    s.onload=()=>{clearTimeout(to);
      (window.puter&&window.puter.ai)?res(window.puter):rej(new Error('no-ai'));};
    s.onerror=()=>{clearTimeout(to);rej(new Error('sdk'));};
    document.head.appendChild(s);
  });
}
async function puterChat(payload){
  const puter=await loadPuter();
  const r=await puter.ai.chat(payload,{model:'gpt-5-nano',max_tokens:600,temperature:0.7});
  let t='';
  if(r){
    if(typeof r==='string')t=r;
    else if(r.message){
      const c=r.message.content;
      t=typeof c==='string'?c:(Array.isArray(c)?c.map(x=>x.text||'').join(''):'');
    }
    else t=r.text||r.output_text||'';
  }
  t=String(t||'').trim();
  if(!t)throw {friendly:'The coach came back empty.',retryable:true};
  return t;
}
async function callFreeAI(system,messages,opts){
  opts=opts||{};
  const payload=[{role:'system',content:system}].concat(messages);
  const tries=[()=>pollinationsPOST(payload),()=>pollinationsGET(system,messages),()=>puterChat(payload)];
  let last=null;
  for(const fn of tries){
    try{const t=await fn();if(t)return t;}
    catch(e){
      if(isOfflineErr(e))throw {friendly:'No internet connection. AI Coach needs internet — the rest of the app works offline. 🌐'};
      if(e&&e.name==='AbortError'){last={friendly:'Free AI took too long.',retryable:true};continue;}
      if(e&&e.friendly){last=e;continue;}
      last={friendly:'Free AI had a hiccup.',retryable:true};
    }
  }
  if(last&&last.friendly==='busy')
    throw {friendly:'Free AI is busy right now (rate limit). Wait a minute and try again — or add a free Gemini key in ⚙️ settings for the smarter coach. ⏳'};
  throw {friendly:'Free AI is having trouble right now. Try again in a bit — or add a free Gemini key in ⚙️ settings for the smarter coach. 🤖'};
}

/* ---------- unified dispatcher: Gemini key when set, else Free AI ---------- */
function activeProvider(){return getKey()?'gemini':'free';}
async function askCoach(system,messages,opts){
  if(getKey()){
    // adapt [{role:'user'|'assistant',content}] to Gemini contents
    const contents=messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
    return callGemini(getKey(),system,contents,opts);
  }
  return callFreeAI(system,messages,opts);
}

/* ---------- setup screen ---------- */
function setupView(root,back){
  root.innerHTML=`
  <div class="step-tag">AI Coach · setup</div>
  <div class="greet">Start coaching ✨</div>
  <p class="sub">Free AI works instantly — no key, no signup.</p>
  <div class="card center" style="border:1.5px solid var(--acc)">
    <div class="kicker" style="color:var(--acc)">Recommended</div>
    <p style="margin:8px 0"><b>Free AI</b> — conversation practice + writing feedback, right now.</p>
    <button class="btn" id="s-free">✨ Start with Free AI</button>
    <p class="small dim" style="margin:8px 0 0">Free AI sends your messages to a public free service to generate replies — don't paste passwords or private info.</p></div>
  <div class="card">
    <div class="kicker" style="color:var(--vio)">🔑 Optional upgrade</div>
    <p style="margin:8px 0"><b>Smarter coach</b> — add a free Gemini key for better feedback,
    including <b>speaking feedback on your recordings</b>.</p>
    <button class="btn ghost" id="s-showkey" style="width:auto;padding:10px 18px">Add a free Gemini key · 2 min</button>
    <div id="s-keyflow" style="display:none">
      <div class="kicker mt">Step 1</div>
      <p style="margin:8px 0">Open <b>Google AI Studio</b> — Google's free site for Gemini keys.</p>
      <button class="btn ghost" id="s-open">Open aistudio.google.com ↗</button>
      <div class="kicker mt">Step 2</div>
      <p style="margin:8px 0">Sign in, tap <b>"Get API key"</b> → <b>"Create API key"</b>. Free, no card.</p>
      <div class="kicker mt">Step 3</div>
      <p style="margin:8px 0">Copy the key and paste it here:</p>
      <input class="field" id="s-key" type="password" placeholder="Paste your Gemini API key" autocomplete="off" spellcheck="false">
      <button class="btn vio" id="s-save">Save & test connection</button>
      <p class="small dim" id="s-status" style="margin:8px 0 0"></p>
      <p class="small dim" style="margin:8px 0 0">🔒 The key is stored <b>only</b> in this browser on your device, sent <b>only</b> to Google's API. Remove it anytime from Coach → ⚙️.</p>
    </div></div>
  <button class="btn ghost mt" id="s-back">← Back</button>`;
  root.querySelector('#s-free').onclick=()=>{toast('Free AI is on — happy practicing! ✨');back();};
  root.querySelector('#s-showkey').onclick=e=>{const f=root.querySelector('#s-keyflow');
    const open=f.style.display!=='none';f.style.display=open?'none':'block';
    e.target.textContent=open?'Add a free Gemini key · 2 min':'Hide key setup';};
  root.querySelector('#s-open').onclick=()=>window.open('https://aistudio.google.com/apikey','_blank','noopener');
  root.querySelector('#s-back').onclick=back;
  root.querySelector('#s-save').onclick=async()=>{
    const k=root.querySelector('#s-key').value.trim();
    const st=root.querySelector('#s-status');
    if(!k){st.textContent='Paste the key first 🙂';return;}
    st.innerHTML='<span class="dim">Testing…</span>';
    try{
      await callGemini(k,'You are a test. Reply with exactly: OK',{text:'Say OK'},{maxTokens:5,temp:0});
      setKey(k);st.innerHTML='<b style="color:var(--acc)">✅ Connected! Smarter coach is live.</b>';confetti(80);
      setTimeout(back,900);
    }catch(e){st.innerHTML='<b style="color:var(--red)">'+esc(e.friendly||'Connection failed.')+'</b>';}
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
  const prov=activeProvider();
  root.innerHTML=`<div class="step-tag">AI Coach · settings</div>
  <div class="greet">Coach settings ⚙️</div>
  <div class="card"><div class="kicker">Active provider</div>
    <p style="margin:8px 0">${prov==='gemini'
      ?'<b style="color:var(--acc)">🔑 Gemini key</b><br><span class="small dim">Model: '+esc(MODEL_LABEL)+' · free tier · speaking feedback ON</span>'
      :'<b style="color:var(--acc)">✨ Free AI</b><br><span class="small dim">No key · conversation + writing work now · speaking feedback needs a Gemini key</span>'}</p>
    ${prov==='gemini'
      ?`<button class="btn danger" id="k-remove">Remove my key</button>
        <p class="small dim">Removes the key from this device immediately. The coach falls back to Free AI. Chat history and progress stay.</p>`
      :`<button class="btn vio" id="k-upgrade">Upgrade: add a free Gemini key ↗</button>
        <p class="small dim">For smarter feedback and speaking feedback on your recordings. Still free — takes 2 minutes.</p>`}</div>
  <button class="btn ghost mt" id="k-back">← Coach home</button>`;
  root.querySelector('#k-back').onclick=()=>coachHome(root);
  const up=root.querySelector('#k-upgrade');
  if(up)up.onclick=()=>setupView(root,()=>coachHome(root));
  const rm=root.querySelector('#k-remove');
  if(rm)rm.onclick=()=>{const m=modal(`<h3>Remove your API key?</h3><p class="mut small">The coach falls back to Free AI. Your progress is untouched.</p>
    <button class="btn danger" id="rk-yes">Remove it</button>
    <button class="btn ghost mt" id="rk-no">Keep it</button>`);
    m.querySelector('#rk-yes').onclick=()=>{clearKey();m.remove();toast('Key removed — back to Free AI 🔒');coachHome(root);};
    m.querySelector('#rk-no').onclick=()=>m.remove();};
}

/* ---------- coach home ---------- */
function coachHome(root){
  const prov=activeProvider();
  const provLine=prov==='gemini'
    ?'<p class="small dim" style="margin:0 0 10px">🔑 Smarter coach active · <a href="javascript:void(0)" id="c-prov" style="color:var(--vio)">settings</a></p>'
    :'<p class="small dim" style="margin:0 0 10px">✨ Free AI active — no key needed · <a href="javascript:void(0)" id="c-prov" style="color:var(--vio)">settings / upgrade</a></p>';
  let html=`<div class="step-tag">AI Coach <span class="ai-badge">🤖 AI</span> · needs internet</div>
  <div class="greet">AI Coach 🤖</div>
  <p class="sub">Your strict tutor, inside the app. Corrects everything — never empty praise.</p>
  ${provLine}
  <div class="card" style="cursor:pointer" data-c="chat"><div class="kicker">💬 Conversation practice</div>
    <p style="margin:8px 0"><b>Talk with the strict tutor</b></p>
    <p class="small dim" style="margin:0">One question at a time · every mistake corrected · say "roleplay" for a client scenario.</p></div>
  <div class="card" style="cursor:pointer" data-c="write"><div class="kicker">✍️ Writing feedback</div>
    <p style="margin:8px 0"><b>Paste your writing, get scored</b></p>
    <p class="small dim" style="margin:0">Clarity / Tone / Structure / Client-safety + corrected version + every fix explained.</p></div>
  <div class="card" style="cursor:pointer" data-c="speak"><div class="kicker">🎙️ Speaking ${prov==='gemini'?'feedback':'practice'}</div>
    <p style="margin:8px 0"><b>${prov==='gemini'?'Record yourself, get pronunciation notes':'Record yourself + self-check'}</b></p>
    <p class="small dim" style="margin:0">${prov==='gemini'
      ?'AI pronunciation + fluency notes, tuned for Urdu speakers.'
      :'Without a Gemini key I can\'t hear you — but your recording stays on this device and you get a self-check checklist. <b>Free Gemini key unlocks AI feedback.</b>'}</p></div>
  <button class="btn ghost" id="c-key2">⚙️ Coach settings</button>`;
  root.innerHTML=html;
  const go=c=>{if(c==='chat')chatView(root);else if(c==='write')writeView(root);else speakView(root);};
  root.querySelectorAll('[data-c]').forEach(c=>c.onclick=()=>go(c.dataset.c));
  const pv=root.querySelector('#c-prov');if(pv)pv.onclick=()=>keySettings(root);
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
    if(!s.chat.length)push('ai',"Assalam-o-Alaikum, "+uname()+"! I'm your strict coach. I'll correct *every* mistake — that's how you get fluent. Let's start simple: **what did you do today?**");
    let busy=false;
    async function send(){
      if(busy)return;const txt=inp.value.trim();if(!txt)return;
      if(!navigator.onLine){toast('No internet — AI Coach needs it. The rest of Fluent works offline. 🌐');return;}
      busy=true;inp.value='';
      push('you',txt);xpToday(5);
      const typing=el('<div class="msg ai"><div class="msg-b typing"><span></span><span></span><span></span></div></div>');log.appendChild(typing);log.scrollTop=log.scrollHeight;
      const history=s.chat.slice(-12).map(m=>({role:m.w==='you'?'user':'assistant',content:m.t}));
      try{
        const reply=await askCoach(SYS_CHAT(),history.slice(0,-1).concat([{role:'user',content:txt}]));
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
        const reply=await askCoach(SYS_WRITE(),[{role:'user',content:'Score and correct this writing:\n\n'+txt}],{maxTokens:700});
        out.innerHTML=`<div class="card"><span class="ai-badge">🤖 AI feedback</span><div class="mt" style="font-size:14.5px;line-height:1.65">${md(reply)}</div></div>`;
        xpToday(15);Store.S.speakingDone++;Store.save();
      }catch(e){out.innerHTML=`<div class="card"><p style="color:var(--red)">${esc(e.friendly)}</p></div>`;}
      busy=false;window.scrollTo({top:document.body.scrollHeight});
    };
  });
}

/* ---------- 3. speaking ----------
   With a Gemini key: AI pronunciation + fluency feedback (needs internet).
   Without a key: record locally, play it back, and run the self-check checklist.
   Recording is on-device — it never leaves this phone. */
const SELF_CHECK=[
  'Did I stress the RIGHT syllable in the long words? (e.g. pro-JECT, not PRO-ject)',
  'Did my "th" sound like <i>th</i> (think, this) — not "t", "d", or "s"?',
  'Did I say "v" (very) differently from "w" (were)?',
  'Did I pronounce the -ed endings? (worked, started, wanted)',
  'Was my pace steady — no rushing, no long "ummm" gaps?',
  'Did I sound like I meant it — or like I was reading a robot?'];
function speakView(root){
  const prov=activeProvider();
  shell(root,'Speaking 🎙️',
    prov==='gemini'
      ?'Record yourself. Get AI pronunciation + fluency notes. <b>Needs internet.</b>'
      :'Record yourself on this device, play it back, and self-check. <b>Add a free Gemini key in ⚙️ settings for AI pronunciation feedback.</b>',
    body=>{
    body.innerHTML=`
      <div class="card center">
        <p class="mut small">Read this out loud, then tap record:</p>
        <p class="shad-text" id="sp-line">“I would like to schedule a call to discuss the project timeline and the next steps.”</p>
        <button class="btn ghost" id="sp-new" style="width:auto;padding:10px 18px">🎲 New line</button></div>
      <div class="row" style="justify-content:center"><button class="rec-btn" id="sp-rec">🎙️</button></div>
      <p class="center small dim" id="sp-status">Tap 🎙️ and read the line</p>
      <audio id="sp-play" controls style="width:100%;display:none"></audio>
      ${prov==='gemini'?'':'<div class="card mt"><div class="kicker">✅ Self-check (no key)</div><div class="small" style="line-height:1.7">'
        +SELF_CHECK.map((c,i)=>'<p style="margin:6px 0"><b>'+(i+1)+'.</b> '+c+'</p>').join('')+'</div></div>'}
      <div id="sp-out" class="mt"></div>`;
    const LINES=[
      'I would like to schedule a call to discuss the project timeline and the next steps.',
      'The third version of the report is ready for your review.',
      'Could you please clarify what you mean by the delivery date?',
      'I think this approach will work better for your customers.',
      'Thank you for your patience while I fix these issues.'];
    body.querySelector('#sp-new').onclick=()=>{body.querySelector('#sp-line').textContent='“'+LINES[Math.floor(Math.random()*LINES.length)]+'”';};
    const recBtn=body.querySelector('#sp-rec'),status=body.querySelector('#sp-status'),
          out=body.querySelector('#sp-out'),player=body.querySelector('#sp-play');
    let rec=null,chunks=[],recording=false,busy=false;
    function blobToB64(blob){return new Promise((res,rej)=>{const r=new FileReader();
      r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(blob);});}
    recBtn.onclick=async()=>{
      if(busy)return;
      if(!recording){
        // recording is local — no internet needed to capture audio
        try{
          const stream=await navigator.mediaDevices.getUserMedia({audio:true});
          rec=new MediaRecorder(stream);chunks=[];
          rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
          rec.start();recording=true;rec._stream=stream;
          recBtn.classList.add('live');status.innerHTML='<b style="color:var(--red)">● Recording… tap again to stop</b>';
        }catch(e){toast('Microphone blocked. Allow mic access in your browser settings. 🎙️');}
        return;
      }
      recording=false;recBtn.classList.remove('live');status.textContent='Working…';
      const stream=rec._stream;
      await new Promise(res=>{rec.onstop=res;rec.stop();});
      stream.getTracks().forEach(t=>t.stop());
      const blob=new Blob(chunks,{type:rec.mimeType||'audio/webm'});
      if(blob.size<2000){status.textContent='Too short — tap 🎙️ and try again.';return;}
      const url=URL.createObjectURL(blob);
      player.src=url;player.style.display='block';
      if(prov!=='gemini'){
        // Free AI path: honest local self-check — audio stays on the device
        status.innerHTML='Saved on this device ✅ — press play and run the self-check above.';
        out.innerHTML='<div class="card"><p class="mut small">🎧 Listen to yourself above. Without a Gemini key I can\'t hear you — but comparing your recording to the line is already real practice. For AI pronunciation feedback, add a <b>free Gemini key</b> in ⚙️ Coach settings.</p></div>';
        xpToday(10);Store.S.speakingDone++;Store.save();
        return;
      }
      // Gemini path: send for AI feedback
      if(!navigator.onLine){toast('AI feedback needs internet — your recording is saved on this device. 🌐');status.textContent='No internet — recording kept on this device.';return;}
      busy=true;out.innerHTML='<div class="card"><p class="dim small">Listening… the coach hears every sound.</p></div>';
      try{
        const b64=await blobToB64(blob);
        const reply=await callGemini(getKey(),SYS_SPEAK(),[
          {text:'Give me pronunciation + fluency feedback on this recording. The line I read was: '+body.querySelector('#sp-line').textContent},
          {inlineData:{mimeType:blob.type||'audio/webm',data:b64}}
        ],{maxTokens:600});
        out.innerHTML=`<div class="card"><span class="ai-badge">🤖 AI feedback</span><div class="mt" style="font-size:14.5px;line-height:1.65">${md(reply)}</div></div>`;
        status.textContent='Done — tap 🎙️ to record again.';xpToday(20);Store.S.speakingDone++;Store.save();
      }catch(e){out.innerHTML=`<div class="card"><p style="color:var(--red)">${esc(e.friendly)}</p></div>`;status.textContent='Tap 🎙️ to try again.';}
      busy=false;window.scrollTo({top:document.body.scrollHeight});
    };
  });
}

/* ---------- entry ---------- */
function coach(root){
  root.innerHTML='';
  const host=el('<div></div>');root.appendChild(host);coachHome(host);
}

window.Screens.coach=coach;
window.AICoach={getKey,clearKey,callGemini,askCoach,activeProvider};
})();
