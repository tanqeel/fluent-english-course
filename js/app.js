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
      default: location.hash='#/home'; return;
    }
    Store.S.lastRoute=hash; Store.save();
  }catch(e){
    console.error(e);
    root.innerHTML='<div class="empty">Something broke loading this screen. <a href="#/home">Go home</a></div>';
  }
  UI.refreshHud();
  window.scrollTo({top:0});
}
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
  if(!location.hash)location.hash=Store.S.lastRoute||'#/home';
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
