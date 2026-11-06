/* 0.2.10: рюкзак у інвентарі.
   • Сітка рівно вміщається в колонку (раніше ліва колонка клітинок обрізалась і з'являвся горизонтальний скрол).
   • Опис предмета — велике вікно поверх колонки «Спорядження» (праворуч від сітки, над персонажем), коли натиснули на предмет;
     ✕ або ще одне натискання на предмет — закрити. Під сіткою більше нічого не стоїть, тож сітка вища. */
(function(){try{
const css=document.createElement('style');css.textContent=`
#ivc .i2gw{min-width:0}#ivc .i2g{overflow-x:hidden!important;grid-template-columns:repeat(6,minmax(0,1fr))!important}
#ivc .i2g .i2s{min-width:0;overflow:hidden}#ivc .i2g .i2s img.iic{width:72%;height:72%}
#ivc .i2>div:first-child>.i2d{display:none!important}
#ivc .i2{position:relative}
#ivc .i2pop{position:absolute;z-index:6;top:0;bottom:0;display:flex;flex-direction:column;gap:10px;padding:16px 16px 14px;border-radius:16px;background:linear-gradient(180deg,rgba(24,44,70,.98),rgba(12,24,42,.98));border:2px solid #7fe3f5;box-shadow:0 10px 40px rgba(0,0,0,.6)}
#ivc .i2pop .px{position:absolute;right:10px;top:10px;width:34px;height:34px;border-radius:10px;border:1px solid rgba(127,227,245,.5);background:rgba(255,255,255,.06);color:#fff;font-size:17px}
#ivc .i2pop .i2d{margin:0;display:flex;flex-direction:column;align-items:stretch;gap:10px;background:none;padding:0;min-height:0;flex:1;overflow-y:auto;font-size:14px}
#ivc .i2pop .i2d .ic{font-size:64px;line-height:1;align-self:center}#ivc .i2pop .i2d .ic img{width:96px;height:96px}
#ivc .i2pop .i2d .tx{text-align:center}#ivc .i2pop .i2d .tx b{display:block;font-size:20px;margin-bottom:6px}#ivc .i2pop .i2d .tx small{display:block;font-size:14px;line-height:1.45;color:#c9d6e4}
#ivc .i2pop .i2d button{min-height:42px;font-size:15px}
@media (max-width:640px){#ivc .i2pop{left:0!important;width:100%!important}}`;document.head.appendChild(css);
const _r=ivR;ivR=function(){const r=_r.apply(this,arguments);try{
 const c=document.getElementById('ivc');if(typeof ivTab=='undefined'||ivTab!='i'||!c)return r;
 const grid=c.querySelector('.i2'),d=c.querySelector('.i2>div:first-child>.i2d'),eqc=c.querySelector('.i2c');if(!grid||!d)return r;
 if(!d.querySelector('.tx'))return r;/* нічого не вибрано */
 const pop=document.createElement('div');pop.className='i2pop';pop.innerHTML="<button class='px' aria-label='Закрити'>✕</button>";
 const gr=grid.getBoundingClientRect(),er=(eqc||grid).getBoundingClientRect();pop.style.left=(er.left-gr.left-4)+'px';pop.style.width=(er.width+8)+'px';
 pop.appendChild(d);grid.appendChild(pop);
 pop.querySelector('.px').onclick=e=>{e.stopPropagation();if(window.ivSel)window.ivSel(null);ivR()};
}catch(e){console.warn('inv-ui',e)}return r};
}catch(e){console.warn('inv-ui',e)}})();
