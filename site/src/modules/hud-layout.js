/* 0.1.11: власне розташування інтерфейсу — гравець перетягує джойстик, кнопки, попалів, екіпірування, міні-карту й «Будову», змінює їх розмір і чутливість джойстика; плаваючий джойстик. Позиції — у частках екрана, окремо на кожному пристрої */
(function(){try{
const KEY='zi_hud',EL=[['joy','🕹️ Джойстик'],['btns','⚔️ Кнопки дій'],['pw2','🐾 Попали'],['eqp','🎒 Екіпірування'],['mmap','🗺️ Міні-карта'],['bag','🎒 Рюкзак'],['mbt','☰ Меню'],['bld','🏗️ Будова']];
let L={el:{},sens:1,float:0};
try{Object.assign(L,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const sv=()=>{try{localStorage.setItem(KEY,JSON.stringify(L))}catch(e){}};
const $=id=>document.getElementById(id),GRID=8,PROPS=['left','top','right','bottom','transform','transform-origin'];
let D=null;const cur=()=>D||L;
/* відступи під виріз камери й заокруглення екрана */
const pr=document.createElement('div');pr.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';document.body.appendChild(pr);
const ins=()=>{const c=getComputedStyle(pr);return{t:parseFloat(c.paddingTop)||0,r:parseFloat(c.paddingRight)||0,b:parseFloat(c.paddingBottom)||0,l:parseFloat(c.paddingLeft)||0}};
const shown=e=>!!e&&e.getClientRects().length>0;
function clamp(e){if(!shown(e))return;const r=e.getBoundingClientRect(),i=ins(),W=innerWidth,H=innerHeight;
 const x=Math.max(i.l,Math.min(W-i.r-r.width,r.left)),y=Math.max(i.t,Math.min(H-i.b-r.height,r.top));
 if(Math.abs(x-r.left)>.5||Math.abs(y-r.top)>.5){e.style.setProperty('left',x+'px','important');e.style.setProperty('top',y+'px','important')}}
function place(e,p){const s=p.s||1;e.style.setProperty('transform-origin','0 0','important');e.style.setProperty('transform','scale('+s+')','important');
 e.style.setProperty('right','auto','important');e.style.setProperty('bottom','auto','important');
 e.style.setProperty('left',p.x*innerWidth+'px','important');e.style.setProperty('top',p.y*innerHeight+'px','important');clamp(e)}
function apply(src){src=src||cur();for(const[id]of EL){const e=$(id);if(!e)continue;const p=src.el[id];if(p)place(e,p);else PROPS.forEach(k=>e.style.removeProperty(k))}
 document.body.classList.toggle('hfloat',!!src.float)}
addEventListener('resize',()=>apply());addEventListener('orientationchange',()=>setTimeout(()=>apply(),350));
/* --- джойстик: враховує розмір і чутливість (заміна jm з core-world.js, де радіус був жорстко 45 px) --- */
const jsc=()=>{const p=cur().el.joy;return p&&p.s||1};
jm=function(e){const r=joy.getBoundingClientRect(),s=jsc(),c=r.width/2;let dx=e.clientX-r.left-c,dy=e.clientY-r.top-c;const R=45*s,l=Math.hypot(dx,dy);
 if(l>R){dx*=R/l;dy*=R/l}kn.style.left=45+dx/s+'px';kn.style.top=45+dy/s+'px';
 let x=dx/R*(cur().sens||1),y=dy/R*(cur().sens||1);const m=Math.hypot(x,y);if(m>1){x/=m;y/=m}jx=x;jy=y};
/* плаваючий джойстик: зʼявляється там, де торкнулися лівої частини екрана */
const editing=()=>document.body.classList.contains('hedit');
addEventListener('pointerdown',e=>{if(!L.float||editing()||e.target!==R.domElement||e.clientX>innerWidth*.45||jid!==null)return;
 if(typeof menuO!=='undefined'&&menuO||!shown(joy))return;
 e.stopPropagation();e.preventDefault();const r=joy.getBoundingClientRect();
 joy.style.setProperty('left',e.clientX-r.width/2+'px','important');joy.style.setProperty('top',e.clientY-r.height/2+'px','important');
 joy.style.setProperty('right','auto','important');joy.style.setProperty('bottom','auto','important');clamp(joy);joy.classList.add('hon');
 jid=e.pointerId;try{joy.setPointerCapture(e.pointerId)}catch(_){}jm(e)},true);
const home=()=>{if(jid===null){joy.classList.remove('hon');apply()}};
['pointerup','pointercancel','lostpointercapture'].forEach(t=>joy.addEventListener(t,()=>setTimeout(home,0)));
/* --- мультитач: поки один палець тримає джойстик, дотик другим пальцем до кнопки (попал ◀ ▶, сфера, дія…) теж спрацьовує.
   Браузери не створюють click для другого пальця, тому робимо його самі з pointerdown/pointerup --- */
const TP=new Map();
addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||e.isPrimary||editing())return;const t=e.target;
 if(t&&t.closest&&!t.closest('#gl,#joy'))TP.set(e.pointerId,{t,x:e.clientX,y:e.clientY,at:performance.now()})},true);
addEventListener('pointerup',e=>{const p=TP.get(e.pointerId);if(!p)return;TP.delete(e.pointerId);
 if(performance.now()-p.at>600||Math.hypot(e.clientX-p.x,e.clientY-p.y)>14)return;
 const t=document.elementFromPoint(e.clientX,e.clientY);if(!t||!(t===p.t||p.t.contains(t)||t.contains(p.t)))return;
 p.t._syn=performance.now();p.t.click()},true);
addEventListener('pointercancel',e=>TP.delete(e.pointerId),true);
/* якщо браузер усе ж надішле свій click для цього дотику — не спрацьовуємо двічі */
addEventListener('click',e=>{if(!e.isTrusted)return;for(let n=e.target;n;n=n.parentElement)if(n._syn&&performance.now()-n._syn<400){n._syn=0;e.stopImmediatePropagation();e.preventDefault();return}},true);
/* --- стилі --- */
const st=document.createElement('style');st.id='hud-css';
st.textContent=`body.hfloat #joy:not(.hon){opacity:.45}
body.hedit *{pointer-events:none!important}
body.hedit .hmov,body.hedit #hlt,body.hedit #hlt *{pointer-events:auto!important}
${EL.map(([id])=>'body.hedit #'+id+'.hmov').join(',')}{z-index:26!important;outline:2px dashed #7fe3f5!important;outline-offset:3px!important;cursor:move;touch-action:none;opacity:1!important}
${EL.map(([id])=>'body.hedit #'+id+'.hmov.hsel').join(',')}{outline:3px solid #ffd34e!important}
${EL.map(([id])=>'body.hedit #'+id+'.hmov.hbad').join(',')}{outline:3px solid #ff5a5a!important}
#hlo{display:none;position:fixed;inset:0;z-index:24;background-color:rgba(8,16,36,.45);background-image:repeating-linear-gradient(0deg,rgba(127,227,245,.07) 0 1px,transparent 1px ${GRID*4}px),repeating-linear-gradient(90deg,rgba(127,227,245,.07) 0 1px,transparent 1px ${GRID*4}px)}
body.hedit #hlo{display:block}
#hlt{display:none;position:fixed;z-index:30;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 6px);width:min(440px,calc(100vw - 24px));padding:6px 8px;border-radius:12px;background:rgba(13,42,58,.94);border:2px solid #c9a24a;color:#fff;font:600 12px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.45)}
#hlt.bot{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 6px)}
body.hedit #hlt{display:block}
#hlt .r{display:flex;align-items:center;gap:8px;margin:2px 0}
#hlt b{flex:1;color:#ffe9b0;font-size:13px}
#hlt label{flex:1;display:flex;align-items:center;gap:6px;white-space:nowrap}
#hlt input{flex:1;min-width:60px;accent-color:#e8803a}
#hlt label span{min-width:34px;text-align:right;color:#cfe8ff}
#hlt button{border:2px solid #c9a24a;border-radius:9px;background:linear-gradient(#1d4f6e,#123650);color:#fff;font:700 12px system-ui,sans-serif;padding:6px 10px}
#hlt #hlok{background:linear-gradient(#ffa356,#c8431f)}
#hlt .r3 button{flex:1}
#hlt .dim{opacity:.4;pointer-events:none!important}`;
document.head.appendChild(st);
const lo=document.createElement('div');lo.id='hlo';document.body.appendChild(lo);
const tb=document.createElement('div');tb.id='hlt';
tb.innerHTML=`<div class='r'><b id='hln'>Перетягніть елемент, торкніться — щоб змінити розмір</b><button id='hlm' aria-label='Перемістити панель'>⇅</button></div>
<div class='r'><label id='hszw'>Розмір <input type='range' id='hsz' min='60' max='160' step='5'><span id='hszv'></span></label><label id='hsnw'>Чутливість <input type='range' id='hsn' min='50' max='200' step='10'><span id='hsnv'></span></label></div>
<div class='r r3'><button id='hlr'>↺ Скинути</button><button id='hlc'>✕ Скасувати</button><button id='hlok'>✔ Готово</button></div>`;
document.body.appendChild(tb);
/* --- режим редагування --- */
let sel=null,drag=null,pm=0;
const nm=id=>(EL.find(x=>x[0]==id)||[])[1]||id;
const pos=e=>{const r=e.getBoundingClientRect();return{x:r.left/innerWidth,y:r.top/innerHeight}};
const ensure=e=>{let p=D.el[e.id];if(!p){p=D.el[e.id]=Object.assign(pos(e),{s:1});place(e,p)}return p};
function ui(){if(!D)return;const p=sel&&D.el[sel.id];$('hln').textContent=sel?nm(sel.id):'Перетягніть елемент, торкніться — щоб змінити розмір';
 $('hszw').classList.toggle('dim',!sel);const s=Math.round(((p&&p.s)||1)*100);$('hsz').value=s;$('hszv').textContent=s+'%';
 $('hsnw').style.display=sel&&sel.id=='joy'?'':'none';const n=Math.round((D.sens||1)*100);$('hsn').value=n;$('hsnv').textContent=n+'%'}
function overlap(){const es=[...document.querySelectorAll('.hmov')],rs=es.map(e=>e.getBoundingClientRect());es.forEach(e=>e.classList.remove('hbad'));
 for(let i=0;i<es.length;i++)for(let j=i+1;j<es.length;j++){const a=rs[i],b=rs[j];if(a.left<b.right-2&&b.left<a.right-2&&a.top<b.bottom-2&&b.top<a.bottom-2){es[i].classList.add('hbad');es[j].classList.add('hbad')}}}
function select(e){if(sel)sel.classList.remove('hsel');sel=e;if(e)e.classList.add('hsel');ui()}
/* відкрито з налаштувань у головному меню: на час редагування ховаємо меню й налаштування, після — повертаємо гравця туди ж */
let back=null;
function edit(){if(editing())return;const mm=$('mm');back={pf:typeof pfO!=='undefined'&&!!pfO,mm:!!mm&&mm.style.display=='flex'};if(back.pf)$('pfx').click();if(back.mm)mm.style.display='none';{const mp=$('mmap');if(mp)mp.style.display=''}/* карту гра ховає при відкритому меню — показуємо одразу, щоб її теж можна було перетягнути */
 D=JSON.parse(JSON.stringify(L));pm=typeof menuO!=='undefined'?menuO:0;menuO=1;
 document.body.classList.add('hedit');if(document.pointerLockElement)document.exitPointerLock();
 joy.classList.remove('hon');apply(D);for(const[id]of EL){const e=$(id);if(shown(e))e.classList.add('hmov')}select(null);overlap()}
function done(save){select(null);if(save){L.el=D.el;L.sens=D.sens;sv()}D=null;
 document.querySelectorAll('.hmov').forEach(e=>e.classList.remove('hmov','hbad'));document.body.classList.remove('hedit');menuO=pm;apply();
 if(save&&window.msg)msg('📌 Розташування збережено й зафіксовано');
 if(back){if(back.mm)$('mm').style.display='flex';if(back.pf){pfO=1;$('pf').style.display='grid';pfTab('k')}back=null}}
window.hudEdit=edit;
addEventListener('pointerdown',e=>{if(!editing())return;const t=e.target.closest&&e.target.closest('.hmov');if(!t)return;
 e.stopPropagation();e.preventDefault();select(t);const p=ensure(t),r=t.getBoundingClientRect();drag={id:e.pointerId,el:t,p,ox:e.clientX-r.left,oy:e.clientY-r.top};ui()},true);
addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();
 const x=Math.round((e.clientX-drag.ox)/GRID)*GRID,y=Math.round((e.clientY-drag.oy)/GRID)*GRID;
 drag.el.style.setProperty('left',x+'px','important');drag.el.style.setProperty('top',y+'px','important');clamp(drag.el);
 Object.assign(drag.p,pos(drag.el))},true);
const end=e=>{if(drag&&e.pointerId===drag.id){drag=null;overlap()}};
/* у режимі редагування дотик лише вибирає елемент: не відкриваємо рюкзак, не розгортаємо карту тощо */
addEventListener('click',e=>{if(editing()&&e.target.closest&&e.target.closest('.hmov')){e.stopImmediatePropagation();e.preventDefault()}},true);addEventListener('pointerup',end,true);addEventListener('pointercancel',end,true);
$('hsz').oninput=()=>{if(!sel)return;const p=ensure(sel),r0=sel.getBoundingClientRect(),cx=r0.left+r0.width/2,cy=r0.top+r0.height/2,s=+$('hsz').value/100;
 p.s=s;sel.style.setProperty('transform','scale('+s+')','important');const r=sel.getBoundingClientRect();
 sel.style.setProperty('left',cx-r.width/2+'px','important');sel.style.setProperty('top',cy-r.height/2+'px','important');clamp(sel);Object.assign(p,pos(sel));ui();overlap()};
$('hsn').oninput=()=>{D.sens=+$('hsn').value/100;ui()};
$('hlm').onclick=()=>tb.classList.toggle('bot');
$('hlr').onclick=()=>{D.el={};D.sens=1;apply(D);select(null);overlap()};
$('hlc').onclick=()=>done(false);$('hlok').onclick=()=>done(true);
/* --- вкладка «Керування»: розташування й плаваючий джойстик --- */
const _pf=pfTab;pfTab=function(t){_pf(t);if(t!='k'&&t!='o')return;const host=$('pcp');if(!host||$('hudp'))return;
 const d=document.createElement('div');d.id='hudp';
 d.innerHTML=`<h4>Розташування на екрані</h4><button class='ob' id='hedb' style='width:100%'>✋ Налаштувати розташування</button>
 <small class='gnote'>Перетягніть джойстик, кнопки, попалів, екіпірування, міні-карту, рюкзак, кнопку меню чи «Будову» і змініть їх розмір. Після «Готово» все зафіксовано</small>
 <h4>Плаваючий джойстик</h4><div class='gseg' id='hflt'>`+['Вимкнено','Увімкнено'].map((n,i)=>`<button data-i='${i}' class='${i==(L.float?1:0)?'on':''}'>${n}</button>`).join('')+`</div>
 <small class='gnote'>Джойстик зʼявляється там, де торкнетеся лівої частини екрана</small>`;
 host.appendChild(d);$('hedb').onclick=edit;
 d.querySelectorAll('#hflt button').forEach(b=>b.onclick=()=>{L.float=+b.dataset.i;sv();apply();d.querySelectorAll('#hflt button').forEach(x=>x.classList.toggle('on',x===b))})};
apply();setTimeout(()=>apply(),600);
}catch(e){console.warn('hud-layout',e)}})();
