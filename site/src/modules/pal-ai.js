/* 0.1.22: робота попалів бригади.
   • Попал добуває лише на території бази (до 30 м від Попал-центру): сам іде до дерева, скелі, куща чи гриба й б’є, поки не повалить.
   • Здобуте несе у власному вантажі. Скільки може нести — залежить від рівня перенесення (1–5): 5 / 10 / 15 / 20 / 30 кг.
     Рівень перенесення кожному попалу випадає під час ловлі: що вищий рівень попала, то більший шанс на високий.
   • Вантаж повний або роботу скінчено — несе до найближчої скрині з вільним місцем.
   • На базі скінчився ліс — лісоруб береться за інше своє вміння (камінь, ягоди), а як іншого немає — відпочиває біля центру.
   • Кухар бере гриби зі скрині й кладе туди смажені; носій бере їжу зі скрині й несе в годівницю центру. */
(function(){try{
const BASE=30,CAP=[0,5,10,15,20,30],SPD=2.2;
/* ---------- рівень перенесення ---------- */
function rollCr(lv){const v=Math.random()+Math.min(.6,(lv||1)*.012);return v<.45?1:v<.75?2:v<.92?3:v<1.02?4:5}
window.palCrRoll=rollCr;window.palCarry=p=>CAP[p.cr||1];
pals.forEach(p=>{if(!p.cr)p.cr=rollCr(p.lv||1)});
const _ap=addPal;addPal=function(){const r=_ap.apply(this,arguments),p=pals[pals.length-1];if(p&&!p.cr)p.cr=rollCr(p.lv||1);return r};

/* ---------- цілі ---------- */
const W=k=>window.itemW?itemW(k):.5;
const inBase=(o,C)=>Math.hypot(o.x-C[0],o.z-C[1])<=BASE;
const busy=(o,p)=>{const q=o._cl;return q&&q!==p&&q.wk&&q.cs!=null&&q.ai&&q.ai.tg===o};
function findTarget(p,job,C){let L=[];if(job=='chop')L=trees.map(o=>[o,trees,'w']);else if(job=='mine')L=rocks.filter(o=>!(o.m&&o.m.userData.ore)).map(o=>[o,rocks,'s']);
 else if(job=='gather')L=bushes.map(o=>[o,bushes,'be']).concat(shrooms.map(o=>[o,shrooms,'mu']));
 let b=null,bd=1e9;for(const e of L){const o=e[0];if(!inBase(o,C)||busy(o,p))continue;const d=Math.hypot(o.x-p.x,o.z-p.z);if(d<bd){bd=d;b=e}}return b}
const WHAT={chop:['🪓','рубає дерево','дерев'],mine:['⛏️','довбає камінь','каміння'],gather:['🫐','збирає ягоди й гриби','ягід і грибів']};

/* ---------- рух ---------- */
function moveTo(p,x,z,dt,stop){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<=stop+.08)return true;const s=Math.min(d-stop,SPD*(cf>0?1.2:1)*dt);p.x+=dx/d*s;p.z+=dz/d*s;p.a=Math.atan2(dx,dz);return false}
function place(p,tm,moving){p.m.position.set(p.x,Math.max(-1.3,H(p.x,p.z))+(moving?Math.abs(Math.sin(tm*9+p.x))*.06:0),p.z);p.m.rotation.y=p.a||0}
const bagW=A=>Object.entries(A.bag).reduce((a,[k,n])=>a+W(k)*n,0);
const say=(t,o,c)=>{if(o&&Math.hypot(P.x-o.position.x,P.z-o.position.z)<18)dmg(t,o,c||'#bdf5c9')};
const XP=p=>{try{if(window.palXp)palXp(p,1)}catch(_){}};

/* ---------- головний цикл працівника ---------- */
window.palAI=function(p,dt,tm){const C=inv._cen;if(!C)return;const A=p.ai||(p.ai={s:'pick',bag:{},t:0});const wk=T[p.ty].wk||{},cap=CAP[p.cr||1];let moving=false;
 const per=cf>0?1.4:3;
 switch(A.s){
 case'pick':{A.tg=null;A.t=0;
  const gj=['chop','mine','gather'].filter(j=>wk[j]);/* порядок: спершу ліс, тоді камінь, тоді ягоди й гриби */
  if(bagW(A)>=cap*.999&&Object.keys(A.bag).length){A.s='deliver';break}
  for(const j of gj){const e=findTarget(p,j,C);if(e){A.job=j;A.tg=e[0];A.L=e[1];A.k=e[2];e[0]._cl=p;A.s='go';break}}
  if(A.s!='pick')break;
  if(Object.keys(A.bag).length){A.s='deliver';break}
  if(wk.cook&&window.chCount&&chCount('mu')>=2){A.s='cook';break}
  if(wk.carry&&cf<20&&window.chCount&&['be','mu','gm','pie'].some(k=>chCount(k)>0)){A.s='fetch';break}
  A.s='rest';A.t=5;A.why=gj.length?'на базі не лишилось '+gj.map(j=>WHAT[j][2]).join(', '):wk.cook?'немає грибів у скрині':wk.carry?'годівниця повна або немає їжі':'немає роботи';break}
 case'go':{const o=A.tg;if(!o||!A.L.includes(o)||!inBase(o,C)){if(o&&o._cl===p)o._cl=null;A.s='pick';break}
  p.st='🚶 іде '+(A.job=='chop'?'до дерева':A.job=='mine'?'до скелі':'по ягоди');moving=!moveTo(p,o.x,o.z,dt,1.25);if(!moving){A.s='work';A.t=per}break}
 case'work':{const o=A.tg;if(!o||!A.L.includes(o)){A.s='pick';break}p.st=WHAT[A.job][0]+' '+WHAT[A.job][1];p.job=A.job;p.a=Math.atan2(o.x-p.x,o.z-p.z);
  A.t-=dt;if(A.t>0)break;A.t=per;
  const L=wk[A.job]||1,n=(A.k=='w'||A.k=='s')?(L>=3?2:1):(A.k=='be'?2:1);
  if(bagW(A)+W(A.k)*n>cap+1e-6){o._cl=null;A.s='deliver';break}
  A.bag[A.k]=(A.bag[A.k]||0)+n;let tx='+'+n+' '+(A.k=='w'?'🪵':A.k=='s'?'🪨':A.k=='be'?'🫐':'🍄');
  if(A.k=='w'&&Math.random()<.35&&bagW(A)+W('sti')<=cap){A.bag.sti=(A.bag.sti||0)+1;tx+=' +1 🥢'}
  if(!o.mx)o.mx=o.hp=(A.L===trees||A.L===rocks)?8:Math.max(1,o.hp||1);o.hp-=(A.L===trees||A.L===rocks)?1+L:1;
  try{if(window.flash)flash(o)}catch(_){}say(tx,o.m);XP(p);
  if(o.hp<=0){const L2=A.L,ix=L2.indexOf(o);if(ix>=0){sc.remove(o.m);L2.splice(ix,1)}
   const mk=L2===trees?mkTree:L2===rocks?mkRock:L2===bushes?mkBush:mkShroom,hp=L2===bushes?2:L2===shrooms?1:3;setTimeout(()=>spawn(L2,mk,hp),L2===trees||L2===rocks?20000:25000);A.s='pick'}
  if(bagW(A)>=cap-.05){if(o._cl===p)o._cl=null;A.s='deliver'}break}
 case'deliver':{const k0=Object.keys(A.bag)[0];if(!k0){A.s='pick';break}
  const ch=window.chNearFor?chNearFor(k0,p.x,p.z):null;if(!ch){A.s='rest';A.t=6;A.why=window.chAny&&chAny()?'скрині заповнені — вантаж чекає':'немає скрині — нікуди нести';break}
  p.st='📦 несе до скрині ('+Math.round(bagW(A)*10)/10+' / '+cap+' кг)';moving=!moveTo(p,ch.x,ch.z,dt,1.5);if(moving)break;
  for(const k of Object.keys(A.bag)){const put=chStore(k,A.bag[k],ch.x,ch.z);A.bag[k]-=put;if(!A.bag[k])delete A.bag[k]}
  say('📦 у скриню',p.m,'#ffe28a');A.s=Object.keys(A.bag).length?'rest':'pick';A.t=4;A.why='скрині заповнені — вантаж чекає';break}
 case'cook':{const ch=window.chNearest?chNearest(p.x,p.z):null;if(!ch||chCount('mu')<2){A.s='pick';break}
  p.st='🍳 готує гриби';p.job='cook';moving=!moveTo(p,ch.x,ch.z,dt,1.5);if(moving)break;A.t+=dt;if(A.t<per*2)break;A.t=0;
  if(chTake('mu',2)){chStore('gm',1,ch.x,ch.z);say('+1 🍢',p.m);XP(p);if(window.isBuilt&&isBuilt('B_kit')&&chCount('mu')>=2&&chTake('mu',2))chStore('gm',1,ch.x,ch.z)}A.s='pick';break}
 case'fetch':{if(!A.food){const k=['be','mu','gm','pie'].find(k=>chCount(k)>0),ch=window.chNearest?chNearest(p.x,p.z):null;if(!k||!ch||cf>=20){A.s='pick';break}
   p.st='📦 бере їжу зі скрині';moving=!moveTo(p,ch.x,ch.z,dt,1.5);if(moving)break;if(chTake(k,1))A.food=k;else{A.s='pick';break}}
  p.st='🍖 несе їжу в годівницю';p.job='carry';moving=!moveTo(p,C[0],C[1],dt,2.4);if(moving)break;cf+=(FOOD[A.food]||1);say('🍖 +'+(FOOD[A.food]||1),p.m);A.food=null;XP(p);A.s='pick';break}
 case'rest':{p.st='😴 відпочиває: '+(A.why||'немає роботи');p.job=null;A.t-=dt;
  const d=Math.hypot(p.x-C[0],p.z-C[1]);if(d>6){moving=!moveTo(p,C[0],C[1],dt,4)}else{p.t=(p.t||0)-dt;if(p.t<=0){p.t=rn(2,4);p.a=rn(0,6.3)}p.x+=Math.sin(p.a)*.35*dt;p.z+=Math.cos(p.a)*.35*dt;moving=true}
  if(A.t<=0)A.s=Object.keys(A.bag).length?'deliver':'pick';break}}
 place(p,tm,moving)};
/* знятий з бригади попал віддає вантаж назад у скриню, щоб нічого не губилось */
setInterval(()=>{for(const p of pals){if(p.ai&&!(p.wk&&p.cs!=null)){for(const k of Object.keys(p.ai.bag||{})){if(window.chStore)chStore(k,p.ai.bag[k])}if(p.ai.tg&&p.ai.tg._cl===p)p.ai.tg._cl=null;p.ai=null;p.st=null}}},1000);
window.palLoad=p=>p.ai?bagW(p.ai):0;
}catch(e){console.warn('pal-ai',e)}})();
