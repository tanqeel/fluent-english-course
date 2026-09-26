/* Fluent UI helpers: toast, confetti, modal, small DOM utils */
(function(){
const $=s=>document.querySelector(s);
function el(html){const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild;}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

/* tiny markdown subset for content JSON: **bold**, *italic*, `code`, - lists */
function md(src){
  if(!src)return '';
  let h=esc(src);
  h=h.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
     .replace(/(^|[\s(])\*([^*\n]+)\*/g,'$1<i>$2</i>')
     .replace(/`([^`]+)`/g,'<code>$1</code>');
  const lines=h.split('\n'),out=[];let inList=false;
  for(const ln of lines){
    if(/^\s*-\s+/.test(ln)){
      if(!inList){out.push('<ul>');inList=true;}
      out.push('<li>'+ln.replace(/^\s*-\s+/,'')+'</li>');
    }else{
      if(inList){out.push('</ul>');inList=false;}
      out.push(ln.trim()===''?'':ln+'<br>');
    }
  }
  if(inList)out.push('</ul>');
  return out.join('\n').replace(/(<br>\n?)+$/,'');
}

let toastT;
function toast(msg,ms=2600){
  let t=$('#toast');if(!t){t=el('<div id="toast"></div>');document.body.appendChild(t);}
  t.innerHTML=msg;t.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),ms);
}

/* lightweight canvas confetti — zero deps */
function confetti(n=90){
  let c=$('#confetti');
  if(!c){c=document.createElement('canvas');c.id='confetti';document.body.appendChild(c);}
  c.width=innerWidth;c.height=innerHeight;
  const x=c.getContext('2d');
  const colors=['#a3e635','#34d399','#a78bfa','#60a5fa','#fbbf24','#f472b6','#fff'];
  const ps=Array.from({length:n},()=>({x:Math.random()*c.width,y:-20-Math.random()*c.height*0.3,
    w:6+Math.random()*7,h:8+Math.random()*8,vy:2.2+Math.random()*3.4,vx:-1.4+Math.random()*2.8,
    r:Math.random()*Math.PI,vr:-.1+Math.random()*.2,col:colors[Math.random()*colors.length|0]}));
  let frames=0;
  (function tick(){
    x.clearRect(0,0,c.width,c.height);frames++;
    for(const p of ps){p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;
      x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.col;x.fillRect(-p.w/2,-p.h/2,p.w,p.h);x.restore();}
    if(frames<220&&ps.some(p=>p.y<c.height+30))requestAnimationFrame(tick);
    else x.clearRect(0,0,c.width,c.height);
  })();
}

function modal(html){
  const bg=el('<div class="modal-bg"><div class="modal"></div></div>');
  bg.firstElementChild.innerHTML=html;
  bg.addEventListener('click',e=>{if(e.target===bg)bg.remove();});
  document.body.appendChild(bg);
  return bg;
}

function xpToast(n){toast(`+${n} XP ⚡`);refreshHud();}

function refreshHud(){
  const st=Store.streakStatus(),L=Store.level(),S=Store.S;
  const s=$('#hud-streak'),xp=$('#hud-xp');
  if(s){s.innerHTML=`🔥 ${S.streak.current}`;s.classList.toggle('hot',S.streak.current>0);}
  if(xp)xp.innerHTML=`⚡ ${S.xp}`;
  const nb=window.__newBadges;
  if(nb&&nb.length){
    window.__newBadges=[];
    confetti(110);
    const b=nb[0];
    setTimeout(()=>{const m=modal(`<div style="font-size:52px">${b.icon}</div><h3 style="margin:8px 0">Badge earned: ${esc(b.name)}</h3><p class="mut small">${esc(b.desc)}</p><button class="btn" id="m-ok">Nice! 🎉</button>`);
      m.querySelector('#m-ok').onclick=()=>m.remove();},350);
  }
  if(window.__comeback){window.__comeback=false;setTimeout(()=>toast('Welcome back, Tanqeel. Restarting is the hard part — you did it. 💪',3400),600);}
  if(window.__freezeEarned){window.__freezeEarned=false;setTimeout(()=>toast('🛡️ Streak Freeze earned! One missed day won\'t break your streak.',3200),600);}
}

window.UI={el,esc,md,toast,confetti,modal,xpToast,refreshHud,$};
})();
