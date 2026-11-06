/* 0.5.x: поки відкрите головне меню, інтерфейс гри (профіль, кнопки, карта, рюкзак, попали, куля, джойстик) сховано — видно лише меню й світ.
   У меню герой видно лише тому, хто ввійшов в акаунт; поки героя не створено — його не видно ніде. Гість бачить героя, щойно почне грати. */
(function(){try{
const mm=document.getElementById('mm');if(!mm)return;
const st=document.createElement('style');st.textContent=`body.mmon :is(#pc,#mbt,#bag,#mmap,.inmap,#cmp,#pw2,#eqp,#eqm,#btns,#bld,#joy,#hud,#guide){visibility:hidden!important;pointer-events:none!important}`;
document.head.appendChild(st);
const sync=()=>document.body.classList.toggle('mmon',mm.style.display=='flex');
new MutationObserver(sync).observe(mm,{attributes:true,attributeFilter:['style']});sync();
/* у головному меню: версія гри внизу праворуч (береться з core-world.js?v= у game.html), Instagram угорі праворуч і ліворуч від нього Telegram-група розробників (0.2.11) */
{const sv=document.querySelector('script[src*="core-world.js?v="]'),ver=sv?(sv.getAttribute('src').split('v=')[1]||''):'';
 const mc=document.createElement('style');mc.textContent=`#mmver{position:absolute;right:calc(env(safe-area-inset-right,0px) + 14px);bottom:calc(env(safe-area-inset-bottom,0px) + 10px);color:rgba(255,255,255,.62);font-size:12px;font-weight:700;letter-spacing:.4px;text-shadow:0 1px 3px #000;pointer-events:none}
#mmig{position:absolute;right:calc(env(safe-area-inset-right,0px) + 14px);top:calc(env(safe-area-inset-top,0px) + 12px);width:44px;height:44px;border-radius:12px;display:block;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.35);transition:transform .12s ease}
#mmig:active{transform:scale(.93)}#mmig svg{width:100%;height:100%;display:block}
#mmtg{position:absolute;right:calc(env(safe-area-inset-right,0px) + 68px);top:calc(env(safe-area-inset-top,0px) + 12px);width:44px;height:44px;border-radius:12px;display:block;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.35);transition:transform .12s ease}
#mmtg:active{transform:scale(.93)}#mmtg svg{width:100%;height:100%;display:block}`;document.head.appendChild(mc);
 if(getComputedStyle(mm).position=='static')mm.style.position='fixed';
 if(ver){const v=document.createElement('div');v.id='mmver';v.textContent='Alpha '+ver;mm.appendChild(v)}
 const ig=document.createElement('a');ig.id='mmig';ig.href='https://www.instagram.com/popalgame/';ig.target='_blank';ig.rel='noopener';ig.setAttribute('aria-label','Regnum Land в Instagram');
 ig.innerHTML=`<svg viewBox='0 0 24 24' aria-hidden='true'><defs><linearGradient id='igg' x1='0' y1='1' x2='1' y2='0'><stop offset='0' stop-color='#feda75'/><stop offset='.35' stop-color='#fa7e1e'/><stop offset='.6' stop-color='#d62976'/><stop offset='.85' stop-color='#962fbf'/><stop offset='1' stop-color='#4f5bd5'/></linearGradient></defs><rect x='0' y='0' width='24' height='24' fill='url(#igg)'/><rect x='5' y='5' width='14' height='14' rx='4.2' fill='none' stroke='#fff' stroke-width='1.9'/><circle cx='12' cy='12' r='3.3' fill='none' stroke='#fff' stroke-width='1.9'/><circle cx='16.6' cy='7.4' r='1.1' fill='#fff'/></svg>`;
 mm.appendChild(ig);
 const tg=document.createElement('a');tg.id='mmtg';tg.href='https://t.me/+wpdLV01LLrRmOGM0';tg.target='_blank';tg.rel='noopener';tg.setAttribute('aria-label','Telegram-група розробників Regnum Land');tg.title='Telegram-група розробників';
 tg.innerHTML=`<svg viewBox='0 0 24 24' aria-hidden='true'><defs><linearGradient id='tgg' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#37bbfe'/><stop offset='1' stop-color='#007dbb'/></linearGradient></defs><rect width='24' height='24' fill='url(#tgg)'/><path d='M5.2 11.6l11.9-4.6c.55-.2 1.03.13.85.96l-2.03 9.55c-.15.68-.55.85-1.12.53l-3.1-2.28-1.5 1.44c-.16.16-.3.3-.62.3l.22-3.15 5.73-5.18c.25-.22-.05-.34-.39-.12L7.97 13.5l-3.05-.95c-.66-.21-.68-.66.28-.95z' fill='#fff'/></svg>`;
 mm.appendChild(tg)}
let hid=0;if(typeof ANI!='undefined')ANI.push(()=>{if(typeof pl=='undefined'||!pl)return;
 let u=null;try{u=eval('fbU')}catch(_){}const off=!look||(document.body.classList.contains('mmon')&&!u);
 if(off){if(pl.visible){pl.visible=false;hid=1}}else if(hid){hid=0;pl.visible=true}});
}catch(e){console.warn('menu-hud:',e)}})();
