/* 0.3.0: потреби попалів бригади — їжа, сон і втома.
   • Ситість (p.fd, 0–100): працюючи на базі, попал голоднішає (повна шкала — приблизно за 15 хв роботи). Стала нижчою за 35 —
     сам іде до Кошика з їжею (B_bask) і їсть, доки не наїсться. Кошик наповнює гравець: підійдіть і натисніть «Дія» — уся їжа
     з рюкзака (ягоди, гриби, смажені гриби, пиріг) перейде в кошик. Порожній кошик — голодний попал (ситість 0) не працює.
   • Сон: уночі попал іде на вільне місце на лежанці (B_nest2 / B_nest5, garden.js) і спить до ранку.
   • Втома (p.ft, 0–100): хто не має де спати, працює всю ніч і втомлюється; до ранку — повна втома. Втомлений попал не працює:
     спить на лежанці, якщо є місце, або відпочиває біля центру, доки не відпочине. Сон знімає втому швидко, відпочинок — повільно.
   • Шкала ситості — під шкалою здоров'я супутника (вибір попала), а ситість і бадьорість — у картках бригади в Попал-центрі.
   Зберігається в inv._nd (за порядком pals), запас кошиків — у inv._bsk. */
(function(){try{
if(typeof pals=='undefined'||!window.palAI)return;
const FD_ON=.11,FD_IDLE=.02,FD_SLEEP=.008;/* ситість за секунду: робота / відпочинок / сон */
const FT_NIGHT=.111,FT_DAY=.018,FT_SLEEP=-.6,FT_REST=-.08;/* втома за секунду */
const HUNGRY=35,FULL=95,UNIT=6,BCAP=150;/* одиниця їжі в кошику = +6 ситості; кошик тримає 150 одиниць */
const FOODV={be:2,mu:2,gm:6,pie:12};
const clamp=v=>Math.max(0,Math.min(100,v));
if(!Array.isArray(inv._nd))inv._nd=[];if(!inv._bsk||typeof inv._bsk!='object')inv._bsk={};
pals.forEach((p,i)=>{const d=inv._nd[i];p.fd=d&&isFinite(d[0])?clamp(d[0]):100;p.ft=d&&isFinite(d[1])?clamp(d[1]):0});
const _ap=addPal;addPal=function(){const r=_ap.apply(this,arguments),p=pals[pals.length-1];if(p&&p.fd==null){p.fd=100;p.ft=0}return r};
const _sv=save;save=function(){try{inv._nd=pals.map(p=>[Math.round(p.fd==null?100:p.fd),Math.round(p.ft||0)])}catch(_){}return _sv.apply(this,arguments)};

/* ---------- кошики ---------- */
const baskets=()=>(window.BPLACED||[]).filter(b=>b.id=='B_bask');
const bkey=b=>Math.round(b.x*10)/10+','+Math.round(b.z*10)/10;
const stock=b=>inv._bsk[bkey(b)]||0;
function setStock(b,v){inv._bsk[bkey(b)]=Math.max(0,Math.min(BCAP,v));const f=b.g&&b.g.userData.bask&&b.g.userData.bask.fill;if(f){const k=stock(b)/BCAP;f.visible=k>0;f.position.y=.12+.3*Math.min(1,k*1.4)}}
setInterval(()=>baskets().forEach(b=>setStock(b,stock(b))),1500);/* наповнення кошика видно на моделі */
function bestBasket(p){let best=null,bd=1e9;for(const b of baskets()){if(stock(b)<=0)continue;const d=Math.hypot(b.x-p.x,b.z-p.z);if(d<bd){bd=d;best=b}}return best}

/* гравець кладе їжу з рюкзака в кошик: «Дія» поруч із кошиком */
const near=()=>{let best=null,bd=2.6;for(const b of baskets()){const d=Math.hypot(b.x-P.x,b.z-P.z);if(d<bd){bd=d;best=b}}return best};
function fill(b){let room=BCAP-stock(b),put=0;const got=[];for(const k of['pie','gm','be','mu']){let n=inv[k]||0,t=0;while(n>0&&room>=FOODV[k]){n--;t++;room-=FOODV[k];put+=FOODV[k]}if(t){inv[k]-=t;got.push(IT[k][0]+'×'+t)}}
 if(!put){msg(stock(b)>=BCAP?'🧺 Кошик повний':'🧺 У рюкзаку немає їжі: ягоди, гриби, смажені гриби або пиріг');return}
 setStock(b,stock(b)+put);msg('🧺 У кошик: '+got.join(' ')+' · запас '+stock(b)+' / '+BCAP);try{hud();save()}catch(_){}}
{const hb=document.getElementById('hit');if(hb){const h0=hb.onclick;hb.onclick=function(){const b=near();if(b&&!nearest(wild,2.6)){fill(b);return}return h0&&h0.apply(this,arguments)};
 let was=null,hit0=null;ANI.push(()=>{const n=!!near();if(n===was)return;was=n;if(n){hit0=hb.innerHTML;hb.innerHTML=(window.plIcon?plIcon('B_bask'):'🧺')+'<small>Покласти їжу</small>'}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}})}}

/* ---------- рух і положення (як у pal-ai.js) ---------- */
function moveTo(p,x,z,dt,stop){const dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<=stop+.08)return true;const s=Math.min(d-stop,2.2*dt),nx=p.x+dx/d*s,nz=p.z+dz/d*s;p.a=Math.atan2(dx,dz);
 if(window.colPalStep)colPalStep(p,nx,nz,x,z,stop,dt);else{p.x=nx;p.z=nz}return false}
function place(p,tm,moving){p.m.position.set(p.x,Math.max(-1.3,H(p.x,p.z))+(p.sleep?.18:0)+(moving?Math.abs(Math.sin(tm*9+p.x))*.06:0),p.z);p.m.rotation.y=p.a||0}
const say=(t,o,c)=>{if(o&&Math.hypot(P.x-o.position.x,P.z-o.position.z)<18)dmg(t,o,c||'#bdf5c9')};
const night=()=>!!(window.isNight&&isNight());
function leave(p){const A=p.ai;if(A){if(A.tg&&A.tg._cl===p)A.tg._cl=null;A.tg=null;A.s='pick';A.t=0}if(p.sleep&&window.NEST)window.NEST.release(p);p.sleep=0;p.nd=null}
function take(p,s){const A=p.ai||(p.ai={s:'pick',bag:{},t:0});if(A.tg&&A.tg._cl===p)A.tg._cl=null;A.tg=null;A.s='rest';A.t=2;p.nd=s}/* ai.s='rest' — лежанка вважає місце зайнятим, а pal-ai не бере роботу */

/* ---------- головний цикл ---------- */
const ai0=window.palAI;
window.palAI=function(p,dt,tm){const C=inv._cen;if(!C)return ai0.apply(this,arguments);
 if(p.fd==null){p.fd=100;p.ft=0}const N=night();let s=p.nd;
 /* що робити далі */
 if(!s){if(p.fd<HUNGRY&&bestBasket(p))take(p,'eat');else if(N&&window.NEST&&window.NEST.claim(p))take(p,'sleep');else if(p.ft>=100)take(p,'tired');else if(p.fd<=0)take(p,'hungry')}
 s=p.nd;
 if(!s){/* працює як звичайно */const busy=p.ai&&p.ai.s!='rest';p.fd=clamp(p.fd-(busy?FD_ON:FD_IDLE)*dt);p.ft=clamp(p.ft+(busy?(N?FT_NIGHT:FT_DAY):FT_REST)*dt);return ai0.apply(this,arguments)}
 let moving=false;const A=p.ai;A.s='rest';A.t=2;
 if(s=='eat'){const b=bestBasket(p);if(!b){leave(p);return}p.st='🍖 іде поїсти до кошика';p.job=null;moving=!moveTo(p,b.x,b.z,dt,1.05);
  if(!moving){p.st='🍖 їсть з кошика';p.a=Math.atan2(b.x-p.x,b.z-p.z);p._et=(p._et||0)+dt;if(p._et>=1.2){p._et=0;if(stock(b)>0){setStock(b,stock(b)-1);p.fd=clamp(p.fd+UNIT);say('🍖 +'+UNIT,p.m,'#ffd08a')}
   if(p.fd>=FULL||stock(b)<=0){say('😋 наївся',p.m,'#ffd08a');leave(p)}}}}
 else if(s=='sleep'){const ns=window.NEST&&window.NEST.claim(p);if(!ns||(!N&&p.ft<=0)){leave(p);return}/* уранці прокидається, коли відпочив */
  moving=!moveTo(p,ns.x,ns.z,dt,.05);p.sleep=!moving;p.st=p.sleep?'😴 спить на лежанці':'🌙 іде спати';p.job=null;
  if(p.sleep){p.ft=clamp(p.ft+FT_SLEEP*dt);p.fd=clamp(p.fd-FD_SLEEP*dt);if((p._zz=(p._zz||0)-dt)<=0){p._zz=4;say('💤',p.m,'#cfe8ff')}}
  if(!N&&p.ft<=0)leave(p);if(p.fd<HUNGRY&&bestBasket(p)){leave(p);take(p,'eat')}}
 else if(s=='tired'){const ns=window.NEST&&window.NEST.claim(p);p.job=null;
  if(ns){moving=!moveTo(p,ns.x,ns.z,dt,.05);p.sleep=!moving;p.st=p.sleep?'😴 втомився — спить':'😩 втомився — іде на лежанку';if(p.sleep)p.ft=clamp(p.ft+FT_SLEEP*dt)}
  else{p.sleep=0;p.st='😩 втомився — немає де спати, відпочиває';const d=Math.hypot(p.x-C[0],p.z-C[1]);if(d>5)moving=!moveTo(p,C[0],C[1],dt,4);p.ft=clamp(p.ft+FT_REST*2*dt)}
  p.fd=clamp(p.fd-FD_IDLE*dt);if(p.ft<=40)leave(p);else if(p.fd<HUNGRY&&bestBasket(p)){leave(p);take(p,'eat')}}
 else if(s=='hungry'){p.job=null;p.sleep=0;p.st='😩 голодний — покладіть їжу в кошик 🧺';const d=Math.hypot(p.x-C[0],p.z-C[1]);if(d>5)moving=!moveTo(p,C[0],C[1],dt,4);p.ft=clamp(p.ft+FT_REST*dt);
  if(bestBasket(p)){leave(p);take(p,'eat')}else if(p.fd>0)leave(p)}
 place(p,tm,moving)};
window.PALNEEDS={baskets,stock,fill,HUNGRY};

/* ---------- шкала ситості супутника (під шкалою здоров'я у виборі попала) ---------- */
{const w2=document.getElementById('pw2');if(w2){const bar=document.createElement('div');bar.id='pcfd';bar.innerHTML='<i></i><span></span>';w2.appendChild(bar);
 const css=document.createElement('style');css.textContent=`#pcfd{position:absolute;left:8px;top:96px;width:150px;height:5px;border-radius:4px;background:rgba(10,20,40,.7);border:1px solid rgba(255,255,255,.25);overflow:hidden;pointer-events:none}
#pcfd i{display:block;height:100%;width:100%;background:linear-gradient(#ffd08a,#e8902a);transition:width .25s}#pcfd span{position:absolute;right:-30px;top:-6px;font:700 10px system-ui;color:#fff;text-shadow:0 1px 2px #000}
.wc .nd{display:flex;gap:6px;margin-top:4px;font-size:11px;color:#dfe8f5}.wc .nd span{flex:1;min-width:0}.wc .nd i{display:block;height:5px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:2px}.wc .nd i b{display:block;height:100%}
.pgn{display:flex;gap:8px;margin-top:4px;font-size:11.5px;color:#dfe8f5}.pgn span{flex:1}.pgn i{display:block;height:5px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:2px}.pgn i b{display:block;height:100%}`;document.head.appendChild(css);
 /* рівний ряд під іменем попала: спершу здоров'я, під ним ситість; стара декоративна смужка #pwh прихована, нічого не перекривається */
 const css2=document.createElement('style');css2.textContent='#pwh{display:none!important}#pchp span,#pcfd span{display:none}#pchp{height:6px!important}#pcfd{height:5px!important}';document.head.appendChild(css2);
 const lay=()=>{const n=document.getElementById('pwn'),hp=document.getElementById('pchp');if(!n||!n.offsetWidth)return;const op=n.offsetParent;if(!op)return;
  const nr=n.getBoundingClientRect(),pr=op.getBoundingClientRect(),k=pr.width/(op.offsetWidth||1)||1,L=(nr.left-pr.left)/k+4,W=nr.width/k-8;let T=(nr.bottom-pr.top)/k+3;
  for(const e of[hp,bar]){if(!e)continue;if(e.parentElement!==op)op.appendChild(e);if(e===bar&&bar.style.display=='none')continue;e.style.left=L+'px';e.style.top=T+'px';e.style.width=W+'px';T+=e.offsetHeight+3}
  /* смужки не мають виходити за нижній край екрана: блок попала трохи піднімається */
  let low=null;for(const e of[hp,bar])if(e&&e.offsetParent)low=e;if(low){const b=low.getBoundingClientRect().bottom+(parseFloat(op.style.translate&&op.style.translate.split(' ')[1])||0)*k,lim=innerHeight-14;const up=Math.max(0,Math.ceil(b-lim));op.style.translate=up?'0 '+(-up/k)+'px':''}};
 let lp=null,lv=-1,lt=0;setInterval(()=>{const p=pals[selP];bar.style.display=p?'':'none';if(!p)return;const v=Math.round(p.fd==null?100:p.fd);if(p===lp&&v===lv&&++lt%5){lay();return}lp=p;lv=v;bar.firstChild.style.width=v+'%';bar.lastChild.textContent='';lay();bar.title='Ситість '+v+'%'},400)}}
const barsHTML=(p,cls)=>{const fd=Math.round(p.fd==null?100:p.fd),en=Math.round(100-(p.ft||0));return `<div class='${cls}'><span>🍖 ситість ${fd}%<i><b style='width:${fd}%;background:linear-gradient(90deg,#ffd08a,#e8902a)'></b></i></span><span>⚡ бадьорість ${en}%<i><b style='width:${en}%;background:linear-gradient(90deg,#9fe8ff,#4fb8e8)'></b></i></span></div>`};
window.palNeedsHTML=p=>barsHTML(p,'pgn');
/* картки бригади в Попал-центрі (popal-center.js малює їх у тому ж порядку, що й pals.filter(cs!=null&&wk)) */
setInterval(()=>{const g=document.querySelector('.wg');if(!g||!g.offsetParent)return;const cr=pals.filter(p=>p.cs!=null&&p.wk);
 g.querySelectorAll('.wc:not(.e)').forEach((c,i)=>{const p=cr[i];if(!p)return;const html=barsHTML(p,'nd');let e=c.querySelector('.nd');if(!e){const box=c.querySelector('div');if(!box)return;box.insertAdjacentHTML('beforeend',html)}else if(e.outerHTML!==html)e.outerHTML=html})},700);
/* картки загону в рюкзаку */
if(typeof ivR=='function'){const _r=ivR;ivR=function(){_r.apply(this,arguments);try{if(typeof ivTab=='undefined'||ivTab!='p')return;document.querySelectorAll('#ivc .i2p .card').forEach((c,i)=>{const p=pals[i];if(p&&!c.querySelector('.pgn'))c.insertAdjacentHTML('beforeend',window.palNeedsHTML(p))})}catch(_){}}}
}catch(e){console.warn('pal-needs',e)}})();
