/* 0.2.15: бустер досвіду (xpb) — нагорода реферальної програми (referral.js, 30 рівень друга).
   • У рюкзаку: виберіть «Бустер досвіду» → «⚡ Активувати». Діє 24 години: увесь досвід героя й попалів ×2 (+100%).
   • Кілька бустерів підряд — час додається. Кінець дії зберігається в inv._xpb (мітка часу), тож перезапуск гри його не скидає.
   • Поки діє — біля смуги досвіду героя значок «⚡ ×2» і скільки лишилось. */
(function(){try{
if(typeof IT=='undefined'||typeof inv=='undefined')return;
const DAY=86400000;
IT.xpb=['⚡','Бустер досвіду (1 день)'];if(inv.xpb==null)inv.xpb=0;
try{if(window.DS)window.DS.xpb='На 24 години подвоює досвід героя й попалів (+100%). Активуйте в рюкзаку. Нагорода реферальної програми. Не має ваги'}catch(_){}
try{const w0=window.itemW;if(w0)window.itemW=k=>k=='xpb'?0:w0(k)}catch(_){}
const on=()=>(inv._xpb||0)>Date.now();
window.plXpBoost=on;
/* подвоєння досвіду */
if(typeof addXp=='function'){const a0=addXp;addXp=function(n){return a0.call(this,on()&&n>0?Math.round(n*2):n)}}
if(window.palXp){const p0=window.palXp;window.palXp=function(p,n){return p0.call(this,p,on()&&n>0?Math.round(n*2):n)}}
/* активація */
function activate(){if(!(inv.xpb>0))return;inv.xpb--;inv._xpb=Math.max(Date.now(),inv._xpb||0)+DAY;
 try{msg('⚡ Бустер досвіду активовано: ×2 досвіду ще '+(window.plDur?window.plDur(inv._xpb-Date.now()):'24 год'));save();hud()}catch(_){}chip()}
if(typeof ivR=='function'){const _r=ivR;ivR=function(){_r.apply(this,arguments);try{if(typeof ivTab!='undefined'&&ivTab!='i')return;const sel=document.querySelector('#ivc .i2s.on'),k=sel&&sel.dataset.sl,d=document.querySelector('#ivc .i2d');
 if(!d||k!='xpb'||d.querySelector('[data-xpb]'))return;const b=document.createElement('button');b.dataset.xpb=1;b.textContent='⚡ Активувати';b.onclick=()=>{activate();ivR()};d.insertBefore(b,d.querySelector('[data-drop]'))}catch(_){}}}
/* значок біля смуги досвіду */
const css=document.createElement('style');css.textContent=`#xpbc{position:fixed;z-index:6;display:none;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;background:linear-gradient(#ffe08a,#e2a93a);color:#2a1a06;font:800 11px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4);pointer-events:none}`;document.head.appendChild(css);
const c=document.createElement('div');c.id='xpbc';document.body.appendChild(c);
function chip(){if(!on()){c.style.display='none';return}const x=document.getElementById('xb');const r=x&&x.getBoundingClientRect();if(!r||!r.width){c.style.display='none';return}
 c.style.display='flex';c.style.left=Math.round(r.right+6)+'px';c.style.top=Math.round(r.top+r.height/2-9)+'px';c.textContent='⚡ ×2 · '+(window.plDur?window.plDur(inv._xpb-Date.now()):'')}
setInterval(()=>{const hide=(typeof menuO!='undefined'&&menuO)||(typeof ivO!='undefined'&&ivO)||(typeof pfO!='undefined'&&pfO);if(hide){c.style.display='none';return}chip()},1000);
}catch(e){console.warn('xp-boost',e)}})();
