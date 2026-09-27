/* Speak Fluently service worker — offline-first. All URLs relative: safe under any subpath. */
const CACHE='fluent-v13';
const PRECACHE=[
  'index.html','manifest.webmanifest',
  'css/styles.css',
  'js/store.js','js/sm2.js','js/theme.js','js/ui.js','js/content.js','js/drills.js','js/screens.js','js/speak.js','js/aicoach.js','js/app.js',
  'content/module-foundations.json','content/module-accuracy.json','content/module-pronunciation.json',
  'content/module-fluency.json','content/module-client-communication.json',
  'content/module-self-presentation.json','content/module-sales.json',
  'content/module-everyday-social.json','content/module-workplace.json','content/module-ielts.json',
  'content/practice.json','content/plan.json','content/badges.json',
  'content/quizzes.json','content/taskcards.json','content/placement.json',
  'content/pronunciation.json','content/scenarios.json','content/stories.json',
  'icons/icon-192.png','icons/icon-512.png'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET'||url.origin!==location.origin)return;
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
