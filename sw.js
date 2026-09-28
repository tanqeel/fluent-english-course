/* Speak Fluently service worker — offline-first. All URLs relative: safe under any subpath. */
const CACHE='fluent-v43';
const APP_VERSION=43; // informational: matches version.json; bump both together
const PRECACHE=[
  'index.html','manifest.webmanifest','version.json',
  'css/styles.css',
  'js/store.js','js/sm2.js','js/theme.js','js/ui.js','js/content.js','js/drills.js','js/screens.js','js/speak.js','js/aicoach.js','js/app.js',
  'content/module-foundations.json','content/module-accuracy.json','content/module-pronunciation.json',
  'content/module-fluency.json','content/module-client-communication.json',
  'content/module-self-presentation.json','content/module-sales.json',
  'content/module-everyday-social.json','content/module-workplace.json','content/module-ielts.json',
  'content/practice.json','content/plan.json','content/badges.json',
  'content/quizzes.json','content/taskcards.json','content/placement.json',
  'content/pronunciation.json','content/scenarios.json','content/stories.json',
  'icons/icon-192.png','icons/icon-512.png','icons/icon-64.png','icons/apple-touch-icon.png',
  'icons/ui/home.png','icons/ui/learn.png','icons/ui/practice.png','icons/ui/review.png','icons/ui/progress.png','icons/ui/coach.png','icons/ui/profile.png','icons/ui/streak.png','icons/ui/xp.png',
  'icons/ui/mic.png','icons/ui/listen.png','icons/ui/roleplay.png','icons/ui/target.png','icons/ui/trophy.png','icons/ui/medal.png','icons/ui/star.png','icons/ui/read.png','icons/ui/write.png','icons/ui/calendar.png',
  'icons/ui/tip.png','icons/ui/chat.png','icons/ui/brain.png','icons/ui/compass.png','icons/ui/key.png','icons/ui/dice.png','icons/ui/share.png','icons/ui/party.png','icons/ui/muscle.png','icons/ui/shield.png','icons/ui/logo-tile.png','icons/ui/timer.png','icons/ui/refresh.png','icons/ui/download.png','icons/ui/reset.png',
  'icons/favicon-32.png','icons/favicon-16.png','icons/maskable-192.png','icons/maskable-512.png'
];
self.addEventListener('install',e=>{
  // cache:'reload' bypasses the browser HTTP cache (GitHub Pages sends
  // max-age=600) AND refreshes it — so a new worker can never precache
  // stale files. Without this, phones got stuck on old content while
  // version.json already reported the new release.
  const fresh=PRECACHE.map(u=>new Request(u,{cache:'reload'}));
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(fresh)).then(()=>self.skipWaiting()));
});
self.addEventListener('message',e=>{ // manual activation path (kept for robustness)
  if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==location.origin)return;
  // version check: always network-first so the app sees the deployed truth,
  // never a stale cached copy
  if(url.pathname.endsWith('version.json')){
    e.respondWith(fetch(e.request).then(res=>{
      if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}
      return res;
    }).catch(()=>caches.match(e.request)));
    return;
  }
  // audio: cache on first play, then serve offline (lazy — keeps install light)
  if(url.pathname.endsWith('.mp3')){
    e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(hit=>{
      if(hit)return hit;
      return fetch(e.request).then(res=>{
        if(res.ok)c.put(e.request,res.clone());
        return res;
      }).catch(()=>c.match(e.request));
    })));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(hit=>{
    if(hit)return hit;
    return fetch(e.request).then(res=>{
      if(res.ok&&url.pathname.match(/\.(html|css|js|json|png|webmanifest)$/))c.put(e.request,res.clone());
      return res;
    }).catch(()=>{
      // offline navigation fallback
      if(e.request.mode==='navigate')return c.match('index.html');
      throw new Error('offline');
    });
  })));
});
