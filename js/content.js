/* Content loader — all lesson/drill content lives in content/*.json (relative paths, subpath-safe) */
(function(){
const MODULES=['foundations','accuracy','pronunciation','fluency','client-communication','self-presentation','sales'];
const cache={modules:{},practice:null,plan:null,badges:null,quizzes:null,taskcards:null,placement:null};
async function j(p){const r=await fetch(p);if(!r.ok)throw new Error('missing '+p);return r.json();}
async function loadAll(){
  for(const m of MODULES)cache.modules[m]=await j('content/module-'+m+'.json');
  cache.practice=await j('content/practice.json');
  cache.plan=await j('content/plan.json');
  cache.badges=await j('content/badges.json');
  try{cache.quizzes=await j('content/quizzes.json');}catch(e){cache.quizzes=[];}
  try{cache.taskcards=await j('content/taskcards.json');}catch(e){cache.taskcards=[];}
  try{cache.placement=await j('content/placement.json');}catch(e){cache.placement=null;}
  Store.setBadgeDefs(cache.badges.badges||cache.badges);
  return cache;
}
function allDrills(){
  // every drill step across modules, with module/lesson context
  const out=[];
  for(const mid of MODULES){const mod=cache.modules[mid];if(!mod)continue;
    for(const l of mod.lessons||[])for(const s of l.steps||[])
      if(s.type==='drill')out.push({...s,module:mid,lesson:l.id,uid:mid+':'+l.id+':'+s.id});}
  return out;
}
function findLesson(lessonId){
  for(const mid of MODULES){const mod=cache.modules[mid];
    const l=(mod.lessons||[]).find(x=>x.id===lessonId);
    if(l)return{mod,lesson:l};}
  return null;
}
window.Content={loadAll,cache,MODULES,allDrills,findLesson};
})();
