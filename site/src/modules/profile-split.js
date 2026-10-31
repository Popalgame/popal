/* 0.5.x: профіль і налаштування розділено. Дотик до аватарки відкриває лише профіль (без бічних вкладок, на всю ширину),
   а «Налаштування» / «Як грати» з меню — лише налаштування, без вкладки «Профіль». */
(function(){try{
const pf=document.getElementById('pf'),av=document.getElementById('av'),title=pf&&pf.querySelector('#pfh b');
if(!pf||!av||!title||typeof pfTab!='function')return;
const st=document.createElement('style');st.textContent=`#pf.pfme #pfs{display:none!important}#pf.pfme #pfc{grid-column:1/3}
#pf:not(.pfme) #pfs button[data-t='p']{display:none!important}`;document.head.appendChild(st);
function mode(me){pf.classList.toggle('pfme',me);title.textContent=me?'Профіль':'Налаштування'}
const a0=av.onclick;av.onclick=function(){const r=a0&&a0.apply(this,arguments);mode(true);return r};
/* будь-яка інша вкладка — це вже налаштування */
const _pt=pfTab;pfTab=function(t){if(t!='p')mode(false);return _pt.apply(this,arguments)};
mode(false);
}catch(e){console.warn('profile-split:',e)}})();
