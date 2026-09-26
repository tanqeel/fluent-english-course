/* Speak Fluently — theme controller: system / light / dark.
   Stored key: fluent_theme. Default = 'system' (follows the phone).
   Pre-paint: index.html runs a tiny inline snippet so the explicit
   choice applies before CSS loads; system mode needs no attribute. */
(function(){
'use strict';
const KEY='fluent_theme';
const META_DARK='#0b0f1a', META_LIGHT='#f2f5f9';
const ICONS={
  system:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/><path d="M12 7.2A3.3 3.3 0 0 1 15.2 11a3.3 3.3 0 0 1-4.4 3.1A3.8 3.8 0 0 1 12 7.2z" fill="currentColor" stroke="none" opacity=".85"/></svg>',
  light:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3L19 19M19 5l-1.7 1.7M6.7 17.3L5 19"/></svg>',
  dark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>'
};
const LABELS={system:'System (follows your phone)',light:'Light',dark:'Dark'};

function get(){try{return localStorage.getItem(KEY)||'system';}catch(e){return 'system';}}
function isDark(m){return m==='dark'||(m==='system'&&typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches);}
function apply(m){
  const root=document.documentElement;
  if(m==='system')root.removeAttribute('data-theme');
  else root.setAttribute('data-theme',m);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',isDark(m)?META_DARK:META_LIGHT);
  const btn=document.getElementById('theme-toggle');
  if(btn){btn.innerHTML=ICONS[m]||ICONS.system;btn.dataset.mode=m;
    btn.setAttribute('aria-label','Theme: '+LABELS[m]+'. Tap to change.');}
}
function set(m){if(!LABELS[m])m='system';try{localStorage.setItem(KEY,m);}catch(e){}apply(m);}
function cycle(){const m=get();set(m==='system'?'light':m==='light'?'dark':'system');}
function init(){
  apply(get());
  document.addEventListener('click',e=>{
    const b=e.target&&e.target.closest?e.target.closest('#theme-toggle'):null;
    if(b)cycle();
  });
  if(typeof matchMedia==='function'){
    const mq=matchMedia('(prefers-color-scheme: dark)');
    const onChange=()=>{if(get()==='system')apply('system');};
    if(mq.addEventListener)mq.addEventListener('change',onChange);
    else if(mq.addListener)mq.addListener(onChange);
  }
}
window.Theme={init,get,set,cycle};
})();
