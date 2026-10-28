(function(){try{
addEventListener('beforeinstallprompt',e=>{e.preventDefault();window._bip=e});
addEventListener('appinstalled',()=>{window._bip=null;msg('✅ Гру встановлено! Шукайте іконку Popal')});
if('serviceWorker' in navigator&&location.protocol=='https:'&&/popalgame|popal-4da6b/.test(location.hostname))navigator.serviceWorker.register('sw.js').catch(()=>{});
const standalone=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone;
const _pf=pfTab;pfTab=function(t){_pf(t);if(t!='i')return;const c=$('pfc');if(!c||$('inst'))return;const d=document.createElement('div');d.className='pcol';d.id='inst';
d.innerHTML=`<h4>📲 Встановити гру</h4><button class='ob' id='inA'>🤖 Встановити на Android</button><small id='inAs'>${standalone()?'✅ Гра вже встановлена й відкрита як застосунок':'Гра встановиться як застосунок з іконкою Popal і відкриватиметься на весь екран.'}</small><div class='pst'><b>🍎 iPhone та iPad</b><br>1. Відкрийте гру в <b>Safari</b>: popalgame.pl<br>2. Натисніть «Поділитися» (квадрат зі стрілкою ⬆️)<br>3. Виберіть «<b>На початковий екран</b>» і «Додати»<br>Гра з’явиться на робочому столі з іконкою Popal і відкриватиметься без панелей браузера.</div>`;
c.appendChild(d);
$('inA').onclick=()=>{const s=$('inAs');if(standalone()){s.textContent='✅ Гра вже встановлена';return}
if(window._bip){window._bip.prompt();window._bip.userChoice.then(r=>{s.textContent=r.outcome=='accepted'?'✅ Встановлюємо…':'Скасовано. Можна спробувати ще раз';window._bip=null});return}
if(/iPhone|iPad/.test(navigator.userAgent)){s.textContent='На iPhone скористайтеся інструкцією нижче 👇';return}
s.innerHTML='Відкрийте <b>popalgame.pl/game.html</b> у <b>Chrome</b>, натисніть меню <b>⋮</b> і виберіть «<b>Встановити застосунок</b>» або «Додати на головний екран».'}};
}catch(e){console.warn('inst',e)}})();
