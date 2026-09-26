/* SM-2 spaced repetition (SuperMemo 2). Per-card: {ef, interval, reps, due} */
(function(){
function review(card,q){
  // q: 0..5 — we map UI buttons: Again=0, Hard=3, Good=4, Easy=5
  let {ef=2.5,interval=0,reps=0}=card;
  if(q>=3){
    if(reps===0)interval=1;
    else if(reps===1)interval=6;
    else interval=Math.round(interval*ef);
    ef=ef+(0.1-(5-q)*(0.08+(5-q)*0.02));
    if(ef<1.3)ef=1.3;
    reps+=1;
  }else{reps=0;interval=1;}
  return{ef:Math.round(ef*100)/100,interval,reps,due:Date.now()+interval*864e5};
}
window.SM2={review};
})();
