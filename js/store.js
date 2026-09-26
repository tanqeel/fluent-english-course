/* Fluent store — all progress in localStorage. Key: fluent_v1 */
(function(){
const KEY='fluent_v1';
const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const ydayStr=()=>{const d=new Date();d.setDate(d.getDate()-1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};

function fresh(){return {
  v:1, created:Date.now(), name:'Tanqeel',
  xp:0, xpByDay:{},                       // 'YYYY-MM-DD' -> xp
  lessonsDone:{},                          // lessonId -> {ts,xp}
  drillsDone:{}, drillsCorrect:{},         // engine -> count
  speakingDone:0, shadowingDone:0, srsReviews:0, errorReviews:0, quizBest:{},
  journal:[], taskCardsDone:{}, placement:null,      // phase-2: journal, task cards, placement result
  streak:{current:0,best:0,lastDate:null,freezes:0,totalDays:{}},
  badges:[], comebacks:0, nightOwl:false,
  errorLog:[],                             // {id,ts,module,engine,prompt,yours,correct,explanation,reviewed}
  modulesCompleted:{},                     // moduleId -> ts
  srs:{},                                  // cardId -> {ef,interval,reps,due,front,back,example}
  lastLesson:null, lastRoute:'#/home'
};}

let S;
try{S=JSON.parse(localStorage.getItem(KEY))||fresh();}catch(e){S=fresh();}
if(!S.v)S=fresh();
// merge in any fields added after the save was created
for(const [k,v] of Object.entries(fresh())){ if(!(k in S)) S[k]=v; }
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

/* ---- streaks: one stable rule — any day with >=10 XP counts. Forgiveness built in. ---- */
function touchDay(){ // call after awarding XP
  const t=todayStr(), st=S.streak;
  if(st.lastDate===t)return;
  const y=ydayStr();
  if(st.lastDate===y||!st.lastDate){
    if(st.lastDate===y||st.current===0){ if(st.current>0||!st.lastDate){} }
    st.current+=1;
    if(st.lastDate&&st.lastDate!==y){/* gap handled below */}
  }else{
    // missed >=1 day
    const missed=daysBetween(st.lastDate,t);
    if(missed===2&&st.freezes>0){st.freezes--;/* freeze saves the streak */}
    else{
      if(st.current>0){S.comebacks++;window.__comeback=true;}
      st.current=1;
    }
  }
  st.lastDate=t; st.best=Math.max(st.best,st.current);
  st.totalDays[t]=1;
  // earn a freeze every 7-day streak, cap 2 banked
  if(st.current>0&&st.current%7===0&&st.freezes<2){st.freezes++;window.__freezeEarned=true;}
  save();
}
function daysBetween(a,b){const d1=new Date(a+'T12:00'),d2=new Date(b+'T12:00');return Math.round((d2-d1)/864e5);}
function streakStatus(){
  const t=todayStr(),st=S.streak;
  if(st.lastDate===t)return{state:'active',msg:'Streak safe for today. 🔥'};
  if(st.lastDate===ydayStr())return{state:'pending',msg:'One lesson today keeps the streak alive.'};
  if(!st.lastDate)return{state:'new',msg:'Start your first streak today — one lesson is enough.'};
  return{state:'broken',msg:'Streak paused — welcome back. One lesson restarts it. No shame in restarting; shame is in quitting.'};
}

/* ---- XP & levels ---- */
const LEVEL_XP=[0,100,250,450,700,1000,1400,1900,2500,3200,4000,5000,6500,8000,10000];
const LEVEL_NAMES=['Warm-up','Foundations','Getting Steady','A2 Climber','A2+ Builder','B1 Explorer','B1 Speaker','B1+ Talker','B2 Ready','B2 Speaker','Confident','Fluent-ish','Client-Ready','Pro','Master'];
function level(){let l=1;for(let i=0;i<LEVEL_XP.length;i++)if(S.xp>=LEVEL_XP[i])l=i+1;
  const cur=LEVEL_XP[l-1]||0,nxt=LEVEL_XP[l]||LEVEL_XP[LEVEL_XP.length-1]*1.3;
  return{n:l,name:LEVEL_NAMES[Math.min(l-1,LEVEL_NAMES.length-1)],cur,nxt,pct:Math.min(100,Math.round((S.xp-cur)/(nxt-cur)*100))};}
function addXP(n){
  S.xp+=n;const t=todayStr();S.xpByDay[t]=(S.xpByDay[t]||0)+n;
  if(new Date().getHours()>=22)S.nightOwl=true;
  save();touchDay();checkBadges();
}

/* ---- error log: every wrong answer becomes a review card ---- */
let errSeq=Date.now();
function logError(e){
  const id='err'+(errSeq++);
  S.errorLog.unshift({id,ts:Date.now(),reviewed:0,...e});
  if(S.errorLog.length>200)S.errorLog.length=200;
  // also seed an SRS card so it resurfaces on schedule
  const cid='srs_'+id;
  S.srs[cid]={ef:2.5,interval:0,reps:0,due:Date.now(),front:e.prompt+(e.yours?'\n\nYou said: '+e.yours:''),back:'Correct: '+e.correct+(e.explanation?'\n\n'+e.explanation:''),example:''};
  save();
}
function dueCards(){const now=Date.now();return Object.entries(S.srs).filter(([k,c])=>c.due<=now).map(([k,c])=>({id:k,...c}));}
function reviewError(id){const e=S.errorLog.find(x=>x.id===id);if(e){e.reviewed++;S.errorReviews++;save();checkBadges();}}

/* ---- badges ---- */
let badgeDefs=[];
function setBadgeDefs(d){badgeDefs=d;}
function evalCheck(expr,ctx){
  const m=String(expr).match(/^([\w-]+)\s*(>=|<=|==|>|<)\s*(.+)$/);
  if(!m)return false;
  const k=m[1],op=m[2],raw=m[3].trim();
  const v=ctx[k]; if(v===undefined)return false;
  const rhs=raw==='true'?true:raw==='false'?false:Number(raw);
  switch(op){case'>=':return v>=rhs;case'<=':return v<=rhs;case'==':return v==rhs;case'>':return v>rhs;case'<':return v<rhs;}
  return false;
}
function checkBadges(extra){
  const newly=[];
  const ctx=Object.assign({
    lessons_done:Object.keys(S.lessonsDone).length,
    streak:S.streak.current, xp:S.xp,
    drills_fix_sentence:S.drillsCorrect['fix-sentence']||0,
    quiz_80:Object.values(S.quizBest).some(v=>v>=80),
    shadowing_done:S.shadowingDone, speaking_done:S.speakingDone,
    error_reviews:S.errorReviews, srs_reviews:S.srsReviews,
    comebacks:S.comebacks, late_study:S.nightOwl,
    module_complete:Object.keys(S.modulesCompleted||{}).length>0,
    placement_done:!!S.placement,
    modules_done:Object.keys(S.modulesCompleted||{}).length,
    task_cards_done:Object.keys(S.taskCardsDone||{}).length,
    journal_entries:(S.journal||[]).length,
    accuracy_done:!!(S.modulesCompleted||{}).accuracy,
    pronunciation_done:!!(S.modulesCompleted||{}).pronunciation,
    fluency_done:!!(S.modulesCompleted||{}).fluency,
    client_communication_done:!!(S.modulesCompleted||{})['client-communication'],
    self_presentation_done:!!(S.modulesCompleted||{})['self-presentation'],
    sales_done:!!(S.modulesCompleted||{}).sales
  },extra||{});
  for(const b of badgeDefs){
    if(S.badges.includes(b.id))continue;
    if(evalCheck(b.check,ctx)){S.badges.push(b.id);newly.push(b);}
  }
  if(newly.length){save();window.__newBadges=(window.__newBadges||[]).concat(newly);}
  return newly;
}

window.Store={get S(){return S;},save,todayStr,ydayStr,addXP,level,touchDay,streakStatus,logError,dueCards,reviewError,setBadgeDefs,checkBadges,KEY,
  reset(){localStorage.removeItem(KEY);location.reload();}};
})();
