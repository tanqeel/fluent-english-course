/* Speak Fluently — hash router + PWA boot. All paths relative: works under any subpath. */
(function(){
'use strict';
const APP_V=25; // must match version.json — bump both on every release
const TABS=[
  ['#/home','🏠','Home'],['#/learn','📚','Learn'],['#/practice','⚔️','Practice'],
  ['#/review','📇','Review'],['#/progress','📊','Progress'],['#/coach','🤖','Coach'],
  ['#/profile','👤','Profile']
];
function drawTabs(active){
  const bar=document.getElementById('tabbar');
  bar.innerHTML=TABS.map(([h,ic,label])=>
    `<a href="${h}" class="${active===h?'on':''}"><span class="ic">${ic}</span><span class="lb">${label}</span></a>`).join('');
}
function route(){
  const hash=location.hash||'#/home';
  const root=document.getElementById('root');
  const [_,path,arg]=hash.match(/^#\/([a-z]+)(?:\/(.+))?$/)||[];
  try{
    switch(path){
      case 'home': drawTabs('#/home'); Screens.home(root); break;
      case 'learn': drawTabs('#/learn'); Screens.learn(root); break;
      case 'module': drawTabs('#/learn'); Screens.moduleView(root,arg); break;
      case 'lesson': drawTabs('#/learn'); Screens.lessonView(root,arg); break;
      case 'practice': drawTabs('#/practice'); Screens.practice(root,arg); break;
      case 'speak': drawTabs('#/practice'); Screens.speak(root,arg); break;
      case 'quizzes': drawTabs('#/practice'); Screens.quizList(root); break;
      case 'taskcards': drawTabs('#/practice'); Screens.taskList(root); break;
      case 'placement': drawTabs('#/learn'); Screens.placement(root); break;
      case 'review': drawTabs('#/review'); Screens.review(root,arg); break;
      case 'progress': drawTabs('#/progress'); Screens.progress(root); break;
      case 'coach': drawTabs('#/coach'); Screens.coach(root); break;
      case 'profile': drawTabs('#/profile'); Screens.profile(root); break;
      case 'onboarding': drawTabs(''); Screens.onboarding(root); break;
      default: location.hash='#/home'; return;
    }
    Store.S.lastRoute=hash; Store.save();
  }catch(e){
    console.error(e);
    root.innerHTML='<div class="empty">Something broke loading this screen. <a href="#/home">Go home</a></div>';
  }
  UI.refreshHud();
  maybeInstallUI();
  window.scrollTo({top:0});
}

/* ---------- install prompt (v12): medium popup once, then a quiet corner pill ---------- */
let deferredInstall=null, installTimer=null;
const LS_DONE='fluent_install_done', LS_DISMISSED='fluent_install_dismissed';
function isStandalone(){
  return (window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true;
}
function lsGet(k){try{return localStorage.getItem(k)==='1';}catch(e){return false;}}
function lsSet(k){try{localStorage.setItem(k,'1');}catch(e){}}
function clearInstallUI(){
  const p=document.getElementById('install-popup');if(p){if(p._esc)document.removeEventListener('keydown',p._esc);p.remove();}
  const pill=document.getElementById('install-pill');if(pill)pill.remove();
}
/* small persistent pill, pinned top-right on every screen until installed */
function ensurePill(){
  if(lsGet(LS_DONE)||!Store.S.name||document.getElementById('install-pill'))return;
  const p=document.createElement('button');
  p.id='install-pill';p.className='install-pill';
  p.innerHTML='📲 Install app';
  p.setAttribute('aria-label','Install the Speak Fluently app');
  p.onclick=()=>showInstallPopup();          // user-initiated: reopening is fine, not nagging
  document.body.appendChild(p);
}
function dismissInstallPopup(silent){
  const w=document.getElementById('install-popup');
  if(w){if(w._esc)document.removeEventListener('keydown',w._esc);w.remove();}
  if(!silent){lsSet(LS_DISMISSED);ensurePill();}
}
function showManualInstall(w){
  const card=w.querySelector('.ip-card');
  card.innerHTML=`
    <button class="ip-x" id="ip-x2" aria-label="Close">✕</button>
    <div class="ip-icon">📲</div>
    <h3>Add to Home Screen</h3>
    <p class="mut small" style="text-align:left;margin:10px 0 16px"><b>iPhone (Safari):</b> tap <b>Share</b> → <b>Add to Home Screen</b>.<br><br>
    <b>Android (Chrome):</b> tap the <b>⋮ menu</b> → <b>Add to Home screen</b> / <b>Install app</b>.<br><br>
    <b>Other browsers:</b> look for an install option in the browser menu.</p>
    <button class="btn" id="ip-ok">Got it</button>`;
  w.querySelector('#ip-x2').onclick=()=>dismissInstallPopup();
  w.querySelector('#ip-ok').onclick=()=>dismissInstallPopup();
  setTimeout(()=>{try{w.querySelector('#ip-ok').focus();}catch(e){}},60);
}
function showInstallPopup(force){
  if(document.getElementById('install-popup'))return;
  if(!force&&lsGet(LS_DONE))return;
  const hasNative=!!deferredInstall;
  const w=document.createElement('div');
  w.id='install-popup';w.className='install-popup';
  w.setAttribute('role','dialog');w.setAttribute('aria-modal','true');w.setAttribute('aria-labelledby','ip-title');
  w.innerHTML=`
    <div class="ip-card">
      <button class="ip-x" id="ip-x" aria-label="Not now">✕</button>
      <div class="ip-icon">📲</div>
      <h3 id="ip-title">Install Speak Fluently</h3>
      <p class="mut small" style="margin:6px 0 18px">Lessons, Speak Studio, AI coach & streaks on your home screen — and it works fully offline.</p>
      <button class="btn" id="ip-go">${hasNative?'Install app':'How to install'}</button>
      <button class="btn ghost mt" id="ip-no">Not now</button>
    </div>`;
  w.addEventListener('click',e=>{if(e.target===w)dismissInstallPopup();});   // backdrop = not now
  const escH=e=>{if(e.key==='Escape')dismissInstallPopup();};
  w._esc=escH;document.addEventListener('keydown',escH);
  document.body.appendChild(w);
  w.querySelector('#ip-x').onclick=()=>dismissInstallPopup();
  w.querySelector('#ip-no').onclick=()=>dismissInstallPopup();
  const go=w.querySelector('#ip-go');
  go.onclick=async()=>{
    if(deferredInstall){
      try{deferredInstall.prompt();await deferredInstall.userChoice;}catch(e){}
      deferredInstall=null;
      dismissInstallPopup(true);   // silent: installed→appinstalled finalizes; cancelled→ask again next home visit
    }else{
      showManualInstall(w);
    }
  };
  setTimeout(()=>{try{go.focus({preventScroll:true});}catch(e){try{go.focus();}catch(e2){}}},60);
}
function maybeInstallUI(){
  clearTimeout(installTimer);
  const pop=document.getElementById('install-popup');
  if(pop){if(pop._esc)document.removeEventListener('keydown',pop._esc);pop.remove();}  // never carry across routes
  if(lsGet(LS_DONE)){clearInstallUI();return;}                       // installed: gone permanently
  if(isStandalone()){lsSet(LS_DONE);clearInstallUI();return;}        // launched as installed app
  if(!Store.S.name)return;                                           // onboarding not complete
  if(lsGet(LS_DISMISSED)){ensurePill();return;}                      // dismissed: quiet pill everywhere
  const pill=document.getElementById('install-pill');if(pill)pill.remove();
  if(!/^#\/home$/.test(location.hash||'#/home'))return;               // home only — never interrupt lessons
  installTimer=setTimeout(()=>{showInstallPopup();},2500);           // small delay, not aggressive
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;maybeInstallUI();});
window.addEventListener('appinstalled',()=>{lsSet(LS_DONE);clearInstallUI();});
async function boot(){
  try{
    await Content.loadAll();
  }catch(e){
    document.getElementById('root').innerHTML=
      '<div class="empty" style="margin-top:60px">Couldn\'t load course files.<br>Check your connection and reload.</div>';
    console.error(e); return;
  }
  Store.touchDay();
  if(window.Theme)Theme.init();
  window.addEventListener('hashchange',route);
  if(!Store.S.name)location.hash='#/onboarding';
  else if(!location.hash)location.hash=Store.S.lastRoute||'#/home';
  route();
  /* ---------- seamless updates: refresh brings new versions live, no reinstall ---------- */
let swReg=null, updateToastShown=false;
function showUpdateToast(){
  if(updateToastShown||document.getElementById('update-toast'))return;
  updateToastShown=true;
  const t=document.createElement('div');
  t.id='update-toast';t.className='update-toast';t.setAttribute('role','status');
  t.innerHTML=`<span>✨ New version available</span><button class="btn" id="ut-go">Refresh</button><button class="ut-x" id="ut-x" aria-label="Dismiss">✕</button>`;
  document.body.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  t.querySelector('#ut-go').onclick=()=>{try{window.location.reload();}catch(e){}};
  t.querySelector('#ut-x').onclick=()=>{t.classList.remove('show');setTimeout(()=>t.remove(),350);};
}
function watchForUpdates(reg){
  swReg=reg;
  const check=()=>{ // re-check for updates; silent when offline
    try{const p=reg.update();if(p&&p.catch)p.catch(()=>{});}catch(e){}
  };
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
  check(); // check on every app start
  // backstop: if the running code is older than what's deployed, force an update check.
  // version.json is served network-first by the worker, so this sees the deployed truth.
  fetch('version.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{
    if(j&&typeof j.v==='number'&&j.v!==APP_V){
      check();
      // if the new worker still hasn't taken over after 10s, offer a manual refresh
      setTimeout(()=>{if(!updateToastShown)showUpdateToast();},10000);
    }
  }).catch(()=>{});
}
function autoReload(){
  // move onto the new worker with exactly one reload per session — never loop
  let done=false;
  try{done=sessionStorage.getItem('sf_ar')==='1';}catch(e){}
  if(done){if(!updateToastShown)showUpdateToast();return;}
  try{sessionStorage.setItem('sf_ar','1');}catch(e){}
  location.reload();
}
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js')
      .then(reg=>watchForUpdates(reg))
      .catch(err=>console.warn('SW:',err));
    // a new worker activated + claimed -> switch to it automatically, no tap needed
    let hadController=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(hadController)autoReload();
      hadController=true;
    });
  });
}
}
document.readyState==='loading'
  ?document.addEventListener('DOMContentLoaded',boot)
  :boot();

/* ---------- global install API (Profile tab button) ---------- */
window.AppInstall={
  show(force){showInstallPopup(!!force);},
  installed(){return lsGet(LS_DONE)||isStandalone();}
};
})();
