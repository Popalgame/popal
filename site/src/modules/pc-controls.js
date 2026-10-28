/* 0.1.11: гра на ПК — рух WASD/стрілками, дії клавішами, камера Q/E і колесом миші, опція «Джойстик» у налаштуваннях (Авто / Показувати / Сховати), камера від першої особи (V) */
(function(){try{
const KEY='zi_pc';let C={joy:0,fp:0};
try{Object.assign(C,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const sv=()=>{try{localStorage.setItem(KEY,JSON.stringify(C))}catch(e){}};
/* vis() дивиться лише inline-стиль (вікна показуються через style.display), щоб не викликати перерахунок верстки щокадру */
const $=id=>document.getElementById(id),vis=id=>{const e=$(id),d=e&&e.style.display;return !!d&&d!='none'};
const MQ=matchMedia('(hover:hover) and (pointer:fine)');let pc=MQ.matches;const isPC=()=>pc;
/* --- джойстик і підписи клавіш --- */
function apply(){const hide=C.joy==2||(C.joy==0&&isPC());document.body.classList.toggle('nojoy',hide);document.body.classList.toggle('pckeys',isPC());document.body.classList.toggle('fp',!!C.fp);eye=0}
const st=document.createElement('style');st.id='pc-css';
st.textContent=`body.nojoy #joy{display:none!important}
body.nojoy #pw2{left:calc(env(safe-area-inset-left,0px) + 12px)!important}
body.pckeys #btns button,body.pckeys #bag,body.pckeys #bld{position:relative}
body.pckeys #btns button[data-k]::after,body.pckeys #bag[data-k]::after,body.pckeys #bld[data-k]::after{content:attr(data-k);position:absolute;top:-6px;left:-6px;min-width:18px;padding:1px 5px;border-radius:6px;background:rgba(14,28,68,.9);border:1px solid #e2bf67;color:#ffe9b0;font:800 10px/14px system-ui,sans-serif;text-align:center;pointer-events:none}
#fpx{display:none;position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.45);pointer-events:none;z-index:5}
body.fp #fpx{display:block}
#fph{display:none;position:fixed;left:50%;top:calc(50% + 18px);transform:translateX(-50%);padding:4px 10px;border-radius:8px;background:rgba(14,28,68,.75);color:#ffe9b0;font:700 12px system-ui,sans-serif;pointer-events:none;z-index:5;white-space:nowrap}
body.fp.pckeys:not(.plk) #fph{display:block}
#pckl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:12px;color:#cfe8ff;margin:4px 0 8px}#pckl b{color:#ffe9b0;white-space:nowrap}`;
document.head.appendChild(st);
const fpx=document.createElement('div');fpx.id='fpx';document.body.appendChild(fpx);
const fph=document.createElement('div');fph.id='fph';fph.textContent='🖱️ Клацніть по грі, щоб керувати мишею';document.body.appendChild(fph);
let eye=0;
const lab={hit:'Space',throw:'R',craft:'C',bag:'I',bld:'B'};
function labels(){for(const id in lab){const e=$(id);if(e)e.dataset.k=lab[id]}}
apply();labels();setTimeout(labels,500);
{const ch=()=>{pc=MQ.matches;apply()};if(MQ.addEventListener)MQ.addEventListener('change',ch);else if(MQ.addListener)MQ.addListener(ch)}
/* --- клавіатура --- */
const down=new Set();let kbd=0,tipd=0,run=0;
const typing=e=>{const t=e.target;return t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))};
const busy=()=>(typeof menuO!=='undefined'&&menuO)||(typeof ccO!=='undefined'&&ccO);
const click=id=>{const e=$(id);if(e&&getComputedStyle(e).display!='none'){e.click();return 1}return 0};
const bmode=()=>document.body.classList.contains('bmode');
function esc(){
 if(locked()){unlock();return}
 if(bmode())return click('bx');
 if(vis('em'))return click('emx');
 if(vis('dlg')){dlgX();return}
 if(typeof ivO!=='undefined'&&ivO)return click('ivx');
 if(typeof pfO!=='undefined'&&pfO)return click('pfx');
 if(typeof menuO!=='undefined'&&menuO){if(typeof started!=='undefined'&&started)mmHide();return}
 click('mbt')}
const ACT={Space:()=>click('hit'),KeyF:()=>click('hit'),KeyR:()=>bmode()?click('brot'):click('throw'),KeyC:()=>click('craft'),KeyI:()=>(typeof ivO!=='undefined'&&ivO)?click('ivx'):click('bag'),Tab:()=>(typeof ivO!=='undefined'&&ivO)?click('ivx'):click('bag'),
 KeyB:()=>bmode()?click('bx'):click('bld'),Enter:()=>bmode()&&click('bok'),KeyX:()=>bmode()&&click('bdel'),Delete:()=>bmode()&&click('bdel'),
 Digit1:()=>typeof pwSw=='function'&&pwSw(-1),Digit2:()=>typeof pwSw=='function'&&pwSw(1),Escape:esc,KeyT:()=>window.palToggle&&palToggle(),
 KeyV:()=>{C.fp=C.fp?0:1;sv();apply();syncSeg();if(C.fp)lock();else unlock();msg(C.fp?'👁️ Від першої особи: миша — огляд, ЛКМ — дія, ПКМ — кинути, Esc — курсор':'🎥 Камера від третьої особи')}};
const MOVE=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','ShiftLeft','ShiftRight']);
addEventListener('keydown',e=>{if(typing(e)||e.ctrlKey||e.metaKey||e.altKey)return;const c=e.code;
 if(MOVE.has(c)){down.add(c);if(c.startsWith('Arrow'))e.preventDefault()}
 if(!tipd&&!busy()&&(MOVE.has(c)||ACT[c])){tipd=1;msg('⌨️ WASD — рух, Shift — біг, Пробіл — дія, R — кинути, C — крафт, I — інвентар, B — будова, T — призвати попала, Q/E — камера, V — вид від першої особи, Esc — меню')}
 const a=ACT[c];if(!a)return;if(c=='Escape'||c=='Tab'||c=='Space')e.preventDefault();if(e.repeat||(busy()&&c!='Escape'))return;a()});
addEventListener('keyup',e=>down.delete(e.code));
addEventListener('blur',()=>down.clear());
/* біг: множник швидкості поверх ваги інвентаря (bags.js) */
const sp0=window.spdF;window.spdF=()=>(sp0?sp0():1)*(run?1.6:1);
/* щокадру переводимо натиснуті клавіші у «джойстик» jx/jy з core-world.js; якщо відкрили вікно — віддаємо курсор */
let T0=performance.now();
(function tick(){requestAnimationFrame(t=>{const dt=Math.min(.05,(t-T0)/1000);T0=t;
 if(locked()&&(!C.fp||needUI()))unlock();
 if(!down.size&&!kbd){run=0;tick();return}
 const k=c=>down.has(c)?1:0,on=!busy()&&!(typeof ivO!=='undefined'&&ivO)&&!(typeof pfO!=='undefined'&&pfO);
 const x=on?(k('KeyD')||k('ArrowRight'))-(k('KeyA')||k('ArrowLeft')):0,y=on?(k('KeyS')||k('ArrowDown'))-(k('KeyW')||k('ArrowUp')):0;
 run=on&&(k('ShiftLeft')||k('ShiftRight'));
 if(jid===null){if(x||y){const l=Math.hypot(x,y);jx=x/l;jy=y/l;kbd=1}else if(kbd){jx=jy=0;kbd=0}}
 if(on){const r=k('KeyE')-k('KeyQ');if(r)ang-=r*dt*2.2}
 tick()})})();
/* перша особа: перед кожним рендером ставимо камеру в очі героя і ховаємо його модель */
const r0=R.render.bind(R);
R.render=function(s,c){if(!C.fp||c!==cam||busy())return r0(s,c);
 if(!eye){try{eye=Math.max(.8,(new THREE.Box3().setFromObject(pl).max.y-pl.position.y)*.92)}catch(e){eye=1.5}}
 const lp=(pit-.72)*1.6,fx=-Math.sin(ang),fz=-Math.cos(ang),x=P.x+fx*.2,y=pl.position.y+eye,z=P.z+fz*.2;
 cam.position.set(x,y,z);cam.lookAt(x+fx*Math.cos(lp),y-Math.sin(lp),z+fz*Math.cos(lp));
 const v=pl.visible;pl.visible=false;r0(s,c);pl.visible=v};
/* перша особа на ПК: миша захоплюється (pointer lock) — рух миші крутить камеру, ЛКМ — дія, ПКМ — кинути кулю */
const cv=R.domElement,locked=()=>document.pointerLockElement===cv;
const needUI=()=>busy()||(typeof ivO!=='undefined'&&ivO)||(typeof pfO!=='undefined'&&pfO)||vis('dlg')||vis('em')||bmode();
function lock(){if(C.fp&&isPC()&&!locked()&&!needUI()&&cv.requestPointerLock){try{const p=cv.requestPointerLock();p&&p.catch&&p.catch(()=>{})}catch(e){}}}
function unlock(){if(locked())document.exitPointerLock()}
/* якщо браузер не дає захопити мишу — запасний режим: камера крутиться просто рухом миші над грою */
let noLock=0;const free=()=>noLock&&C.fp&&isPC()&&!needUI();
document.addEventListener('pointerlockchange',()=>document.body.classList.toggle('plk',locked()||!!noLock));
document.addEventListener('pointerlockerror',()=>{if(!noLock){noLock=1;document.body.classList.add('plk');msg('🖱️ Браузер не дав захопити мишу: камера крутиться рухом миші над грою')}});
cv.addEventListener('mousedown',e=>{if(!C.fp||!isPC()||needUI())return;if(!locked()&&!noLock){lock();return}
 e.preventDefault();e.stopImmediatePropagation();if(e.button==0)click('hit');else if(e.button==2)click('throw')},true);
cv.addEventListener('contextmenu',e=>{if(C.fp)e.preventDefault()});
document.addEventListener('mousemove',e=>{if(!C.fp||(!locked()&&!(e.target===cv&&free())))return;ang-=e.movementX*.0026;pit=Math.max(.18,Math.min(1.4,pit+e.movementY*.0022))});
/* колесо миші над грою — нахил камери */
R.domElement.addEventListener('wheel',e=>{if(busy())return;e.preventDefault();pit=Math.max(.18,Math.min(1.4,pit+Math.sign(e.deltaY)*.06))},{passive:false});
/* --- налаштування: замість «Опцій» окремі вкладки Керування / Графіка / Звук --- */
function syncSeg(){document.querySelectorAll('#pcv button').forEach(x=>x.classList.toggle('on',+x.dataset.i==C.fp))}
{const pfs=$('pfs');if(pfs){const mk=(t,s)=>{const b=document.createElement('button');b.dataset.t=t;b.textContent=s;b.onclick=()=>pfTab(t);return b};
 const kb=mk('k','🎮 Керування'),gb=mk('g','🖥️ Графіка'),sb=mk('s','🔊 Звук'),ob=pfs.querySelector("[data-t='o']");
 if(ob)ob.replaceWith(kb,gb,sb);else pfs.append(kb,gb,sb)}}
const _pf=pfTab;pfTab=function(t){if(t=='o')t='k';if(t!='k'&&t!='g'&&t!='s')return _pf(t);const c=$('pfc');
 if(t=='k'){_pf('k');if(c)ctl(c);return}
 /* графіку й звук будують старі модулі на вкладці «o» — будуємо її і лишаємо потрібну частину */
 _pf('o');document.querySelectorAll('#pfs button').forEach(b=>b.classList.toggle('on',b.dataset.t==t));
 const host=c&&(c.querySelector('.pcol')||c),snd=$('sndp');if(!host)return;
 if(t=='s'){host.innerHTML='';if(snd){host.appendChild(snd);const n=snd.querySelector('.gnote');if(n)n.textContent='Кнопками ▶ можна перевірити гучність.'}}
 else if(snd)snd.remove()};
/* на телефоні — лише камера й джойстик з підказками для дотику; на ПК — ще й список клавіш */
function ctl(c){
 c.innerHTML=`<div class='pcol' id='pcp'></div>`+(isPC()?`<div class='pcol'><h4>Клавіші</h4><div id='pckl'></div></div>`:'');
 const d=$('pcp'),kl=$('pckl');
 d.innerHTML=`<h4>Камера</h4><div class='gseg' id='pcv'>`+['3-тя особа','1-ша особа'].map((n,i)=>`<button data-i='${i}' class='${i==C.fp?'on':''}'>${n}</button>`).join('')+`</div>
 <small class='gnote'>`+(isPC()?'Клавіша V перемикає вид. Від першої особи клацніть по грі — камерою керує миша, Esc звільняє курсор':'Від першої особи огляд — пальцем по екрану, рух — джойстиком')+`</small>
 <h4>Джойстик на екрані</h4><div class='gseg' id='pcj'>`+['Авто','Показувати','Сховати'].map((n,i)=>`<button data-i='${i}' class='${i==C.joy?'on':''}'>${n}</button>`).join('')+`</div>
 <small class='gnote' id='pcjn'></small>`;
 const jn=()=>{$('pcjn').textContent=!isPC()&&C.joy==2?'⚠️ Без джойстика на телефоні рухатися не вийде':isPC()?'«Авто» ховає джойстик на компʼютері з мишею. Рух — WASD або стрілками':'«Авто» показує джойстик на телефоні й планшеті'};jn();
 if(kl)kl.innerHTML=`<b>W A S D / ←↑↓→</b><span>рух</span><b>Shift</b><span>біг</span><b>Пробіл / F</b><span>дія, розмова</span><b>R</b><span>кинути кулю</span><b>C</b><span>крафт</span><b>I / Tab</b><span>інвентар</span><b>B</b><span>будова (R — поворот, Enter — поставити, X — розібрати)</span><b>1 / 2</b><span>попередня / наступна істота</span><b>T</b><span>призвати / відкликати попала</span><b>Q / E, колесо, миша</b><span>камера</span><b>V</b><span>перша / третя особа</span><b>Миша (перша особа)</b><span>огляд, ЛКМ — дія, ПКМ — кинути кулю, Esc — звільнити курсор</span><b>Esc</b><span>закрити вікно / меню</span>`;
 d.querySelectorAll('#pcv button').forEach(b=>b.onclick=()=>{C.fp=+b.dataset.i;sv();apply();syncSeg()});
 d.querySelectorAll('#pcj button').forEach(b=>b.onclick=()=>{C.joy=+b.dataset.i;sv();apply();jn();d.querySelectorAll('#pcj button').forEach(x=>x.classList.toggle('on',x===b))})};
}catch(e){console.warn('pc-controls',e)}})();
