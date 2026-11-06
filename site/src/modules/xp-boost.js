/* 0.2.15: бустер досвіду (xpb) — нагорода реферальної програми (referral.js, 30 рівень друга).
   • У рюкзаку: виберіть «Бустер досвіду» → «⚡ Активувати». Діє 24 години: увесь досвід героя й попалів ×2 (+100%).
   • Кілька бустерів підряд — час додається. Кінець дії зберігається в inv._xpb (мітка часу), тож перезапуск гри його не скидає.
   • Поки діє — блискавка ⚡ на аватарці героя, а час, що лишився, — лише в меню персонажа: «год:хв:сек». */
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
const css=document.createElement('style');css.textContent=`#xpbav{position:absolute;right:-3px;bottom:-3px;width:17px;height:17px;border-radius:50%;display:none;align-items:center;justify-content:center;font-size:10px;line-height:1;background:#16263a;border:1.5px solid #f2c14e;box-shadow:0 1px 4px rgba(0,0,0,.55),0 0 6px rgba(242,193,78,.45);z-index:3;pointer-events:none}
#xpbav.on{display:flex}
#xpbc{position:fixed;z-index:6;display:none;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;background:linear-gradient(#ffe08a,#e2a93a);color:#2a1a06;font:800 11px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4);pointer-events:none}`;document.head.appendChild(css);
const c=document.createElement('div');c.id='xpbc';document.body.appendChild(c);
/* блискавка на аватарці героя, поки бустер діє */
const av=document.getElementById('av');let ab=null;if(av){if(getComputedStyle(av).position=='static')av.style.position='relative';ab=document.createElement('span');ab.id='xpbav';ab.textContent='⚡';ab.title='Бустер досвіду ×2';av.appendChild(ab)}
function chip(){if(ab)ab.classList.toggle('on',on());c.style.display='none'}/* 0.2.15: час — лише в меню персонажа; на екрані тільки блискавка на аватарці */
/* у меню персонажа (профіль) — скільки лишилось: години, хвилини й секунди, щосекунди */
const hms=ms=>{const t=Math.max(0,Math.floor(ms/1000)),h=Math.floor(t/3600),m=Math.floor(t%3600/60),x=t%60;return h+':'+String(m).padStart(2,'0')+':'+String(x).padStart(2,'0')};
const css2=document.createElement('style');css2.textContent=`#xpbpf{flex:1 1 100%;display:flex;align-items:center;gap:10px;margin:0 0 4px;padding:9px 14px;border-radius:12px;background:linear-gradient(90deg,rgba(255,214,90,.22),rgba(255,214,90,.06));border:1px solid rgba(255,214,90,.55);color:#fff3c8;font:700 14px system-ui,sans-serif}
#xpbpf i{font-style:normal;font-size:20px}#xpbpf span{flex:1}#xpbpf b{font:900 18px ui-monospace,monospace;color:#ffe08a;letter-spacing:.5px}`;document.head.appendChild(css2);
function pf(){const c=document.getElementById('pfc'),pfw=document.getElementById('pf');let e=document.getElementById('xpbpf');
 const show=on()&&c&&pfw&&pfw.classList.contains('pfme')&&getComputedStyle(pfw).display!='none'&&!!document.querySelector("#pfs button.on[data-t='p']");
 if(!show){if(e)e.remove();return}
 if(!e){e=document.createElement('div');e.id='xpbpf';e.innerHTML="<i>⚡</i><span>Бустер досвіду ×2 — залишилось</span><b translate='no'></b>";c.prepend(e)}
 e.querySelector('b').textContent=hms(inv._xpb-Date.now())}
setInterval(pf,1000);document.addEventListener('click',()=>setTimeout(pf,80));
setInterval(()=>{if(ab)ab.classList.toggle('on',on());const hide=(typeof menuO!='undefined'&&menuO)||(typeof ivO!='undefined'&&ivO)||(typeof pfO!='undefined'&&pfO);if(hide){c.style.display='none';return}chip()},1000);
}catch(e){console.warn('xp-boost',e)}})();
