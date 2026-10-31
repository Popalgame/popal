/* 0.5.x: поки відкрите головне меню, інтерфейс гри (профіль, кнопки, карта, рюкзак, попали, куля, джойстик) сховано — видно лише меню й світ.
   Поки героя ще не створено (новий гравець), у світі його теж не видно. */
(function(){try{
const mm=document.getElementById('mm');if(!mm)return;
const st=document.createElement('style');st.textContent=`body.mmon :is(#pc,#mbt,#bag,#mmap,.inmap,#cmp,#pw2,#eqp,#eqm,#btns,#bld,#joy,#hud,#guide){visibility:hidden!important;pointer-events:none!important}`;
document.head.appendChild(st);
const sync=()=>document.body.classList.toggle('mmon',mm.style.display=='flex');
new MutationObserver(sync).observe(mm,{attributes:true,attributeFilter:['style']});sync();
let hid=0;if(typeof ANI!='undefined')ANI.push(()=>{if(typeof pl=='undefined'||!pl)return;
 if(!look){if(pl.visible){pl.visible=false;hid=1}}else if(hid){hid=0;pl.visible=true}});
}catch(e){console.warn('menu-hud:',e)}})();
