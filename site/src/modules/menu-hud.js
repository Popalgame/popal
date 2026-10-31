/* 0.5.x: поки відкрите головне меню, інтерфейс гри (профіль, кнопки, карта, рюкзак, попали, куля, джойстик) сховано — видно лише меню й світ.
   У меню герой видно лише тому, хто ввійшов в акаунт; поки героя не створено — його не видно ніде. Гість бачить героя, щойно почне грати. */
(function(){try{
const mm=document.getElementById('mm');if(!mm)return;
const st=document.createElement('style');st.textContent=`body.mmon :is(#pc,#mbt,#bag,#mmap,.inmap,#cmp,#pw2,#eqp,#eqm,#btns,#bld,#joy,#hud,#guide){visibility:hidden!important;pointer-events:none!important}`;
document.head.appendChild(st);
const sync=()=>document.body.classList.toggle('mmon',mm.style.display=='flex');
new MutationObserver(sync).observe(mm,{attributes:true,attributeFilter:['style']});sync();
/* у головному меню: версія гри внизу праворуч (береться з core-world.js?v= у game.html) і Instagram угорі праворуч */
{const sv=document.querySelector('script[src*="core-world.js?v="]'),ver=sv?(sv.getAttribute('src').split('v=')[1]||''):'';
 const mc=document.createElement('style');mc.textContent=`#mmver{position:absolute;right:calc(env(safe-area-inset-right,0px) + 14px);bottom:calc(env(safe-area-inset-bottom,0px) + 10px);color:rgba(255,255,255,.62);font-size:12px;font-weight:700;letter-spacing:.4px;text-shadow:0 1px 3px #000;pointer-events:none}
#mmig{position:absolute;right:calc(env(safe-area-inset-right,0px) + 14px);top:calc(env(safe-area-inset-top,0px) + 12px);width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(13,28,36,.55);border:1px solid rgba(255,255,255,.25);box-shadow:0 4px 14px rgba(0,0,0,.35);transition:transform .12s ease}
#mmig:active{transform:scale(.93)}#mmig svg{width:28px;height:28px;display:block}`;document.head.appendChild(mc);
 if(getComputedStyle(mm).position=='static')mm.style.position='fixed';
 if(ver){const v=document.createElement('div');v.id='mmver';v.textContent='Beta '+ver;mm.appendChild(v)}
 const ig=document.createElement('a');ig.id='mmig';ig.href='https://www.instagram.com/popalgame/';ig.target='_blank';ig.rel='noopener';ig.setAttribute('aria-label','Popal в Instagram');
 ig.innerHTML=`<svg viewBox='0 0 24 24' aria-hidden='true'><defs><linearGradient id='igg' x1='0' y1='1' x2='1' y2='0'><stop offset='0' stop-color='#feda75'/><stop offset='.35' stop-color='#fa7e1e'/><stop offset='.6' stop-color='#d62976'/><stop offset='.85' stop-color='#962fbf'/><stop offset='1' stop-color='#4f5bd5'/></linearGradient></defs><rect x='2' y='2' width='20' height='20' rx='6' fill='url(#igg)'/><rect x='6' y='6' width='12' height='12' rx='4' fill='none' stroke='#fff' stroke-width='1.8'/><circle cx='12' cy='12' r='2.9' fill='none' stroke='#fff' stroke-width='1.8'/><circle cx='16.3' cy='7.7' r='1.05' fill='#fff'/></svg>`;
 mm.appendChild(ig)}
let hid=0;if(typeof ANI!='undefined')ANI.push(()=>{if(typeof pl=='undefined'||!pl)return;
 let u=null;try{u=eval('fbU')}catch(_){}const off=!look||(document.body.classList.contains('mmon')&&!u);
 if(off){if(pl.visible){pl.visible=false;hid=1}}else if(hid){hid=0;pl.visible=true}});
}catch(e){console.warn('menu-hud:',e)}})();
