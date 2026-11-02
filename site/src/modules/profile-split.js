/* 0.5.x: профіль і налаштування розділено. Дотик до аватарки відкриває меню гравця, а «Налаштування» / «Як грати» з меню — лише налаштування.
   0.2.9: меню гравця має вкладки «Профіль», «Пошта», «Промокод» (mail.js); у налаштуваннях їх немає. */
(function(){try{
const pf=document.getElementById('pf'),av=document.getElementById('av'),title=pf&&pf.querySelector('#pfh b');
if(!pf||!av||!title||typeof pfTab!='function')return;
const ME=['p','m','pr'];/* вкладки меню гравця */
const st=document.createElement('style');st.textContent=`#pf.pfme #pfs button:not([data-t='p']):not([data-t='m']):not([data-t='pr']){display:none!important}
#pf:not(.pfme) #pfs button[data-t='p'],#pf:not(.pfme) #pfs button[data-t='m'],#pf:not(.pfme) #pfs button[data-t='pr']{display:none!important}`;document.head.appendChild(st);
function mode(me){pf.classList.toggle('pfme',me);title.textContent=me?'Профіль':'Налаштування'}
const a0=av.onclick;av.onclick=function(){const r=a0&&a0.apply(this,arguments);mode(true);return r};
/* вкладки гравця — меню гравця, будь-яка інша — налаштування */
const _pt=pfTab;pfTab=function(t){mode(ME.includes(t));return _pt.apply(this,arguments)};
mode(false);
}catch(e){console.warn('profile-split:',e)}})();
