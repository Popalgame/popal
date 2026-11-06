(function(){try{
addEventListener('beforeinstallprompt',e=>{e.preventDefault();window._bip=e});
addEventListener('appinstalled',()=>{window._bip=null;msg('✅ Гру встановлено! Шукайте іконку Regnum Land')});
if('serviceWorker' in navigator&&location.protocol=='https:'&&/popalgame|popal-4da6b/.test(location.hostname))navigator.serviceWorker.register('sw.js').catch(()=>{});
/* 0.2.13: автооновлення. Телефон (особливо iPhone з іконкою на головному екрані) може тримати стару сторінку гри в пам'яті.
   Під час запуску й щоразу, коли гра повертається з фону, перевіряємо версію на сайті (game.html без кешу, core-world.js?v=…).
   Якщо на сайті новіша — зберігаємо прогрес, оновлюємо service worker і перезапускаємо гру вже на новій версії (не частіше разу на версію). */
{const cur=((document.querySelector('script[src*="core-world.js?v="]')||{getAttribute:()=>''}).getAttribute('src')||'').split('v=')[1]||'';
 const live=/popalgame|popal-4da6b/.test(location.hostname);let busy=0,last=0;
 async function check(){if(!live||!cur||busy||Date.now()-last<60000)return;busy=1;last=Date.now();try{
  const r=await fetch('game.html?vc='+Date.now(),{cache:'no-store'});const t=await r.text();const m=/core-world\.js\?v=([\d.]+)/.exec(t);
  if(!m||m[1]===cur)return;const k='zi_upd_'+m[1];try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1')}catch(_){}
  try{msg('🔄 Нова версія '+m[1]+' — оновлюємо гру…')}catch(_){}try{save()}catch(_){}
  try{const reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();if(reg)await reg.update()}catch(_){}
  try{await fetch('game.html',{cache:'reload'})}catch(_){}
  const u=new URL(location.href);u.searchParams.set('v',m[1]);setTimeout(()=>location.replace(u.toString()),900)}catch(_){}finally{busy=0}}
 setTimeout(check,4000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});}
const standalone=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone;
const _pf=pfTab;pfTab=function(t){_pf(t);if(t!='i')return;const c=$('pfc');if(!c||$('inst'))return;const d=document.createElement('div');d.className='pcol';d.id='inst';
d.innerHTML=`<h4>📲 Встановити гру</h4><button class='ob' id='inA'>🤖 Встановити на Android</button><small id='inAs'>${standalone()?'✅ Гра вже встановлена й відкрита як застосунок':'Гра встановиться як застосунок з іконкою Regnum Land і відкриватиметься на весь екран.'}</small><div class='pst'><b>🍎 iPhone та iPad</b><br>1. Відкрийте гру в <b>Safari</b>: popalgame.pl<br>2. Натисніть «Поділитися» (квадрат зі стрілкою ⬆️)<br>3. Виберіть «<b>На початковий екран</b>» і «Додати»<br>Гра з’явиться на робочому столі з іконкою Regnum Land і відкриватиметься без панелей браузера.</div>`;
c.appendChild(d);
$('inA').onclick=()=>{const s=$('inAs');if(standalone()){s.textContent='✅ Гра вже встановлена';return}
if(window._bip){window._bip.prompt();window._bip.userChoice.then(r=>{s.textContent=r.outcome=='accepted'?'✅ Встановлюємо…':'Скасовано. Можна спробувати ще раз';window._bip=null});return}
if(/iPhone|iPad/.test(navigator.userAgent)){s.textContent='На iPhone скористайтеся інструкцією нижче 👇';return}
s.innerHTML='Відкрийте <b>popalgame.pl/game.html</b> у <b>Chrome</b>, натисніть меню <b>⋮</b> і виберіть «<b>Встановити застосунок</b>» або «Додати на головний екран».'}};
}catch(e){console.warn('inst',e)}})();
