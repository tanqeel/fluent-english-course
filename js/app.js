/*/* Speak Fluently — hash router + PWA boot. All paths relative: works under any subpath. */
(function(){
'use strict';
const TABS=[
  ['#/home','🏠','Home'],['#/learn','📚','Learn'],['#/practice','⚔️','Practice'],
  ['#/review','📇','Review'],['#/progress','📊','Progress'],['#/coach','🤖','Coach']
];
function drawTabs(active){
  const bar=document.getElementById('tabbar');
  bar.innerHTML=TABS.map(([h,ic,label])=>
    `<a href="${h}" class="${active===h?'on':''}"><span class="ic">${ic}</span>${label}</a>`).join('');
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
      case 'quizzes': drawTabs('#/practice'); Screens.quizList(root); break;
      case 'taskcards': drawTabs('#/practice'); Screens.taskList(root); break;
      case 'placement': drawTabs('#/learn'); Screens.placement(root); break;
      case 'review': drawTabs('#/review'); Screens.review(root,arg); break;
      case 'progress': drawTabs('#/progress'); Screens.progress(root); break;
      case 'coach': drawTabs('#/coach'); Screens.coach(root); break;
      case 'onboarding': drawTabs(''); Screens.onboarding(root); break;
      default: location.hash='#/home'; return;
    }
    Store.S.lastRoute=hash; Store.save();
  }catch(e){
    console.error(e);
    root.innerHTML='<div class="empty">Something broke loading this screen. <a href="#/home">Go home</a></div>';
  }
  UI.refreshHud();
  maybeInstallBanner();
  window.scrollTo({top:0});
}

/* ---------- install prompt ---------- */
let deferredInstall=null;
function isStandalone(){
  return (window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true;
}
function hideInstallBanner(){const b=document.getElementById('install-banner');if(b)b.remove();}
function dismissInstall(){try{localStorage.setItem('fluent_install_dismissed','1');}catch(e){}hideInstallBanner();}
function maybeInstallBanner(){
  hideInstallBanner();
  if(!Store.S.name)return;                       // after onboarding only
  if(isStandalone())return;                      // already installed
  try{if(localStorage.getItem('fluent_install_dismissed'))return;}catch(e){}
  const hash=location.hash||'#/home';
  if(!/^#\/home$/.test(hash))return;             // home only — never interrupt lessons/tests
  const hasNative=!!deferredInstall;
  const b=document.createElement('div');
  b.id='install-banner';b.className='install-banner';
  b.innerHTML=`
    <div style="font-size:34px">📲</div>
    <div style="flex:1"><b>Install Speak Fluently</b>
      <div class="small dim">${hasNative?'One tap — lessons, AI coach and streaks on your home screen, works offline.':'Add it to your home screen for the full app feel.'}</div></div>
    <button class="btn" id="ib-go" style="width:auto;padding:10px 16px">${hasNative?'Install':'How'}</button>
    <button class="btn ghost" id="ib-no" style="width:auto;padding:10px 12px" aria-label="Dismiss">✕</button>`;
  document.body.appendChild(b);
  b.querySelector('#ib-no').onclick=dismissInstall;
  b.querySelector('#ib-go').onclick=async()=>{
    if(deferredInstall){
      deferredInstall.prompt();
      try{await deferredInstall.userChoice;}catch(e){}
      deferredInstall=null;dismissInstall();
    }else{
      const m=UI.modal(`<h3>📲 Add to Home Screen</h3>
        <p class="mut small"><b>iPhone (Safari):</b> tap <b>Share</b> → <b>Add to Home Screen</b>.<br>
        <b>Android (Chrome):</b> tap the <b>⋮ menu</b> → <b>Add to Home screen</b> / <b>Install app</b>.</p>
        <button class="btn" id="ib-ok">Got it</button>`);
      m.querySelector('#ib-ok').onclick=()=>m.remove();
    }
  };
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;maybeInstallBanner();});
window.addEventListener('appinstalled',()=>{try{localStorage.setItem('fluent_install_dismissed','1');}catch(e){}hideInstallBanner();});
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
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('sw.js').catch(err=>console.warn('SW:',err));
    });
  }
}
document.readyState==='loading'
  ?document.addEventListener('DOMContentLoaded',boot)
  :boot();
})();
