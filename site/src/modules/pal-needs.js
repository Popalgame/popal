/* 0.3.0: потреби попалів бригади — їжа, сон і втома.
   • Ситість (p.fd, 0–100): працюючи на базі, попал голоднішає (повна шкала — приблизно за 15 хв роботи). Стала нижчою за 35 —
     сам іде до Кошика з їжею (B_bask) і їсть, доки не наїсться. Кошик наповнює гравець: підійдіть і натисніть «Дія» — відкриється
     вікно кошика (що в ньому лежить і їжа з рюкзака). Порожній кошик — голодний попал (ситість 0) не працює.
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

/* ---------- кошики ----------
   0.2.10: кошик — як скриня, але лише для їжі. «Дія» поруч відкриває вікно: зліва що лежить у кошику (кожен вид окремо, з кількістю),
   справа їжа з рюкзака — «1», «10», «Усе». Забрати назад теж можна. Місткість — 150 одиниць ситості (ягода й гриб — 2, смажені гриби — 6, пиріг — 12).
   inv._bsk[ключ] = {be,mu,gm,pie}; старе збереження (просто число одиниць) перетворюється на ягоди. */
const FK=['be','mu','gm','pie'];
const baskets=()=>(window.BPLACED||[]).filter(b=>b.id=='B_bask');
const bkey=b=>Math.round(b.x*10)/10+','+Math.round(b.z*10)/10;
const box=b=>{const k=bkey(b);let o=inv._bsk[k];if(typeof o=='number')o=inv._bsk[k]=o>0?{be:Math.ceil(o/FOODV.be)}:{};if(!o||typeof o!='object')o=inv._bsk[k]={};return o};
const stock=b=>{const o=box(b);return FK.reduce((a,k)=>a+(o[k]||0)*FOODV[k],0)};
function showFill(b){const f=b.g&&b.g.userData.bask&&b.g.userData.bask.fill;if(f){const k=stock(b)/BCAP;f.visible=k>0;f.position.y=.12+.3*Math.min(1,k*1.4)}}
setInterval(()=>baskets().forEach(showFill),1500);/* наповнення кошика видно на моделі */
function bestBasket(p){let best=null,bd=1e9;for(const b of baskets()){if(stock(b)<=0)continue;const d=Math.hypot(b.x-p.x,b.z-p.z);if(d<bd){bd=d;best=b}}return best}
/* попал з'їдає одну річ: найменшу, якої вистачає до ситості, або найбільшу, що є */
function eatOne(b,p){const o=box(b),need=(100-(p.fd||0))/UNIT,have=FK.filter(k=>o[k]>0);if(!have.length)return 0;
 const k=have.filter(k=>FOODV[k]>=need).sort((x,y)=>FOODV[x]-FOODV[y])[0]||have.sort((x,y)=>FOODV[y]-FOODV[x])[0];
 o[k]--;if(!o[k])delete o[k];showFill(b);return FOODV[k]*UNIT}

/* гравець відкриває кошик: «Дія» поруч із кошиком */
const near=()=>{let best=null,bd=2.6;for(const b of baskets()){const d=Math.hypot(b.x-P.x,b.z-P.z);if(d<bd){bd=d;best=b}}return best};
{const css=document.createElement('style');css.textContent=`
#bks{display:none;position:fixed;left:calc(env(safe-area-inset-left,0px) + 6%);right:calc(env(safe-area-inset-right,0px) + 6%);top:calc(env(safe-area-inset-top,0px) + 5%);bottom:calc(env(safe-area-inset-bottom,0px) + 5%);z-index:36;flex-direction:column;background:rgba(14,20,42,.96);border:2px solid #e2bf67;border-radius:16px;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.5);overflow:hidden;font-family:system-ui,sans-serif}
#bks header{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(226,191,103,.4)}#bks header b{font-size:18px;color:#ffe7a8;flex:1}
#bks .cx{background:none;border:none;color:#e2bf67;font-size:24px;cursor:pointer}
#bks .cap{padding:8px 14px 0;font-size:13px;color:#dfe8f5}#bks .cap i{display:block;height:8px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:4px}#bks .cap i b{display:block;height:100%;background:linear-gradient(90deg,#ffd08a,#e8902a)}
#bks .cb{flex:1;display:flex;gap:12px;padding:10px 12px;min-height:0}#bks .col{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
#bks h5{margin:0 0 6px;color:#e2bf67;font-size:13px;display:flex;align-items:center;gap:8px}#bks h5 span{flex:1}
#bks .ls{flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px;min-height:0;padding-right:4px}
#bks .r{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:6px 8px}
#bks .r.e{opacity:.45}#bks .r .ic{font-size:26px;width:34px;text-align:center}#bks .r .ic img{width:32px;height:32px}
#bks .r .nm{flex:1;min-width:0;font-size:13px;line-height:1.25}#bks .r .nm small{display:block;opacity:.7;font-size:11px}#bks .r .n{font-weight:800;font-size:16px;color:#ffe7a8;min-width:34px;text-align:right}
#bks button.b{background:linear-gradient(#f39a4a,#d9532e);border:2px solid #e2bf67;color:#fff;border-radius:9px;padding:3px 9px;font-weight:700;cursor:pointer;font-size:12px;font-family:inherit;min-height:30px}
#bks button.b.g{background:linear-gradient(#5fb04a,#2f8a3a)}#bks button.b:disabled{opacity:.35}#bks .em{opacity:.65;font-size:12px;padding:6px}
@media (max-width:640px){#bks .cb{flex-direction:column}}`;document.head.appendChild(css)}
const W=document.createElement('div');W.id='bks';document.body.appendChild(W);
let cur=null;
const ic=k=>IT[k]?IT[k][0]:'❔',nm=k=>IT[k]?IT[k][1]:k;
function bkOpen(b){cur=b;ivO=1;W.style.display='flex';bkR()}
function bkClose(){W.style.display='none';ivO=0;cur=null;try{hud();save()}catch(_){}}
function put(k,n){const room=Math.floor((BCAP-stock(cur))/FOODV[k]);n=Math.min(n,inv[k]||0,room);if(n<=0){msg(room<=0?'🧺 Кошик повний':'🧺 У рюкзаку цього немає');return}inv[k]-=n;const o=box(cur);o[k]=(o[k]||0)+n;showFill(cur);bkR()}
function take(k,n){const o=box(cur);n=Math.min(n,o[k]||0);if(n<=0)return;o[k]-=n;if(!o[k])delete o[k];addI(k,n);showFill(cur);bkR()}
function bkR(){if(!cur)return;const o=box(cur),st=stock(cur),pc=Math.round(st/BCAP*100),hungry=pals.filter(p=>p.cs!=null&&p.wk&&(p.fd||0)<HUNGRY).length;
 W.innerHTML=`<header><b>🧺 Кошик з їжею</b><button class='cx' aria-label='Закрити'>✕</button></header>
 <div class='cap'>Запас: <b>${st}</b> / ${BCAP} · ${st?'попали їдять звідси самі':'порожньо — голодні попали не працюватимуть'}${hungry?' · голодних: '+hungry:''}<i><b style='width:${pc}%'></b></i></div>
 <div class='cb'><div class='col'><h5><span>У кошику</span>${st?"<button class='b g' data-all>⬇ Забрати все</button>":''}</h5><div class='ls'>${FK.map(k=>`<div class='r ${o[k]?'':'e'}'><span class='ic'>${ic(k)}</span><span class='nm'>${nm(k)}<small>+${FOODV[k]*UNIT} ситості</small></span><span class='n'>${o[k]||0}</span><button class='b g' data-t='${k}' data-n='1' ${o[k]?'':'disabled'}>1</button><button class='b g' data-t='${k}' data-n='1e9' ${o[k]?'':'disabled'}>Усе</button></div>`).join('')}</div></div>
 <div class='col'><h5><span>🎒 Їжа в рюкзаку</span>${FK.some(k=>inv[k]>0)?"<button class='b' data-pall>⬆ Покласти все</button>":''}</h5><div class='ls'>${FK.some(k=>inv[k]>0)?FK.filter(k=>inv[k]>0).map(k=>`<div class='r'><span class='ic'>${ic(k)}</span><span class='nm'>${nm(k)}</span><span class='n'>${inv[k]}</span><button class='b' data-p='${k}' data-n='1'>1</button><button class='b' data-p='${k}' data-n='10'>10</button><button class='b' data-p='${k}' data-n='1e9'>Усе</button></div>`).join(''):"<div class='em'>У рюкзаку немає їжі. Сюди можна покласти лише ягоди, гриби, смажені гриби й пиріг.</div>"}</div></div></div>`;
 W.querySelector('.cx').onclick=bkClose;
 W.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>take(b.dataset.t,+b.dataset.n));
 W.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>put(b.dataset.p,+b.dataset.n));
 const a=W.querySelector('[data-all]');if(a)a.onclick=()=>{for(const k of FK)take(k,1e9)};
 const pa=W.querySelector('[data-pall]');if(pa)pa.onclick=()=>{for(const k of['pie','gm','be','mu'])if(inv[k]>0&&stock(cur)+FOODV[k]<=BCAP)put(k,1e9)}}
addEventListener('keydown',e=>{if(e.key=='Escape'&&W.style.display=='flex')bkClose()});
setInterval(()=>{if(cur&&W.style.display=='flex'&&!W.matches(':hover'))bkR()},2000);/* видно, як попали їдять */
function fill(b){bkOpen(b)}
{const hb=document.getElementById('hit');if(hb){const h0=hb.onclick;hb.onclick=function(){const b=near();if(b&&!nearest(wild,2.6)){bkOpen(b);return}return h0&&h0.apply(this,arguments)};
 let was=null,hit0=null;ANI.push(()=>{const n=!!near();if(n===was)return;was=n;if(n){hit0=hb.innerHTML;hb.innerHTML=(window.plIcon?plIcon('B_bask'):'🧺')+'<small>Кошик</small>'}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}})}}

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
  if(!moving){p.st='🍖 їсть з кошика';p.a=Math.atan2(b.x-p.x,b.z-p.z);p._et=(p._et||0)+dt;if(p._et>=1.2){p._et=0;const add=eatOne(b,p);if(add){p.fd=clamp(p.fd+add);say('🍖 +'+add,p.m,'#ffd08a')}
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
window.PALNEEDS={baskets,stock,fill,open:bkOpen,HUNGRY};

/* ---------- шкала ситості супутника (під шкалою здоров'я у виборі попала) ---------- */
{const w2=document.getElementById('pw2');if(w2){const bar=document.createElement('div');bar.id='pcfd';bar.innerHTML='<i></i><span></span>';w2.appendChild(bar);
 const css=document.createElement('style');css.textContent=`#pcfd{position:absolute;left:8px;top:96px;width:150px;height:5px;border-radius:4px;background:rgba(10,20,40,.7);border:1px solid rgba(255,255,255,.25);overflow:hidden;pointer-events:none}
#pcfd i{display:block;height:100%;width:100%;background:linear-gradient(#ffd08a,#e8902a);transition:width .25s}#pcfd span{position:absolute;right:-30px;top:-6px;font:700 10px system-ui;color:#fff;text-shadow:0 1px 2px #000}
.wc .nd{display:flex;gap:6px;margin-top:4px;font-size:11px;color:#dfe8f5}.wc .nd span{flex:1;min-width:0}.wc .nd i{display:block;height:5px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:2px}.wc .nd i b{display:block;height:100%}
.pgn{display:flex;gap:8px;margin-top:4px;font-size:11.5px;color:#dfe8f5}.pgn span{flex:1}.pgn i{display:block;height:5px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:2px}.pgn i b{display:block;height:100%}`;document.head.appendChild(css);
 /* рівний ряд під іменем попала: спершу здоров'я, під ним ситість; стара декоративна смужка #pwh прихована, нічого не перекривається */
 const css2=document.createElement('style');css2.textContent='#pwh{display:none!important}#pchp{height:15px!important;border-radius:6px!important}#pcfd{height:13px!important;border-radius:6px!important}'+
  '#pchp span,#pcfd span{position:absolute!important;left:0!important;right:0!important;top:0!important;bottom:0!important;display:flex!important;align-items:center;justify-content:center;font:800 10.5px/1 system-ui,sans-serif!important;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;white-space:nowrap;letter-spacing:.2px}#pcfd span{font-size:9.5px!important}';document.head.appendChild(css2);
 const lay=()=>{const n=document.getElementById('pwn'),hp=document.getElementById('pchp');if(!n||!n.offsetWidth)return;const op=n.offsetParent;if(!op)return;
  const nr=n.getBoundingClientRect(),pr=op.getBoundingClientRect(),k=pr.width/(op.offsetWidth||1)||1,L=(nr.left-pr.left)/k+4,W=nr.width/k-8;let T=(nr.bottom-pr.top)/k+3;
  for(const e of[hp,bar]){if(!e)continue;if(e.parentElement!==op)op.appendChild(e);if(e===bar&&bar.style.display=='none')continue;e.style.left=L+'px';e.style.top=T+'px';e.style.width=W+'px';T+=e.offsetHeight+3}
  /* смужки не мають виходити за нижній край екрана: блок попала трохи піднімається */
  let low=null;for(const e of[hp,bar])if(e&&e.offsetParent)low=e;if(low){const b=low.getBoundingClientRect().bottom-(parseFloat(op.style.translate&&op.style.translate.split(' ')[1])||0)*k,lim=innerHeight-14;const up=Math.max(0,Math.ceil(b-lim));op.style.translate=up?'0 '+(-up/k)+'px':''}};
 let lp=null,lv=-1,lt=0;setInterval(()=>{const p=pals[selP];bar.style.display=p?'':'none';if(!p)return;const v=Math.round(p.fd==null?100:p.fd);if(p===lp&&v===lv&&++lt%5){lay();return}lp=p;lv=v;bar.firstChild.style.width=v+'%';bar.lastChild.textContent='🍖 '+v+' / 100';lay();bar.title='Ситість '+v+' з 100'},400)}}
const barsHTML=(p,cls)=>{const fd=Math.round(p.fd==null?100:p.fd),en=Math.round(100-(p.ft||0));return `<div class='${cls}'><span>🍖 ситість ${fd} / 100<i><b style='width:${fd}%;background:linear-gradient(90deg,#ffd08a,#e8902a)'></b></i></span><span>⚡ бадьорість ${en} / 100<i><b style='width:${en}%;background:linear-gradient(90deg,#9fe8ff,#4fb8e8)'></b></i></span></div>`};
window.palNeedsHTML=p=>barsHTML(p,'pgn');
/* картки бригади в Попал-центрі (popal-center.js малює їх у тому ж порядку, що й pals.filter(cs!=null&&wk)) */
setInterval(()=>{const g=document.querySelector('.wg');if(!g||!g.offsetParent)return;const cr=pals.filter(p=>p.cs!=null&&p.wk);
 g.querySelectorAll('.wc:not(.e)').forEach((c,i)=>{const p=cr[i];if(!p)return;const html=barsHTML(p,'nd');let e=c.querySelector('.nd');if(!e){const box=c.querySelector('div');if(!box)return;box.insertAdjacentHTML('beforeend',html)}else if(e.outerHTML!==html)e.outerHTML=html})},700);
/* картки загону в рюкзаку */
if(typeof ivR=='function'){const _r=ivR;ivR=function(){_r.apply(this,arguments);try{if(typeof ivTab=='undefined'||ivTab!='p')return;document.querySelectorAll('#ivc .i2p .card').forEach((c,i)=>{const p=pals[i];if(p&&!c.querySelector('.pgn'))c.insertAdjacentHTML('beforeend',window.palNeedsHTML(p))})}catch(_){}}}
}catch(e){console.warn('pal-needs',e)}})();
