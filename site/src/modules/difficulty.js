/* 0.1.28: режим складності (Налаштування → Керування → «Складність»).
   • Звичайна — після смерті нічого не втрачаєте, прокидаєтесь біля Попал-центру.
   • Складна — після смерті все з рюкзака (ресурси, їжа, кулі, інструменти, рюкзак) лишається «могилою» там, де вас повалили.
     Могила не зникає: її видно здалеку (світний стовп) і на міні-карті (☠). Дійдіть і натисніть «Дія», щоб забрати все назад.
   Попали не губляться в жодному режимі. */
(function(){try{
const KEY='zi_dif';let D={hard:0};try{Object.assign(D,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(_){}
const sv=()=>{try{localStorage.setItem(KEY,JSON.stringify(D))}catch(_){}};
window.plHard=()=>!!D.hard;
window.plDeath=function(x,z){if(!D.hard)return;const it={};
 for(const k of new Set(Object.keys(IT).concat(Object.keys(res)))){if(k[0]=='_')continue;const n=cnt(k)||0;if(n>0){it[k]=n;addI(k,-n)}}
 if(!Object.keys(it).length)return;
 if(eq.tool){eq.tool=null;try{buildHero(pl,look||DLOOK)}catch(_){}}eq.bag=null;
 if(window.dropGrave)dropGrave(x,z,it);
 setTimeout(()=>msg('☠️ Складний режим: усе з рюкзака лишилось там, де вас повалили. Шукайте світний стовп і ☠ на міні-карті'),900);
 try{eqUp()}catch(_){}hud();save()};
/* налаштування: вкладка «Керування» (pc-controls.js перетворює стару «o» на «k») */
const _pf=pfTab;pfTab=function(t){_pf.apply(this,arguments);if(t!='k'&&t!='o')return;const c=$('pfc');if(!c||$('difp'))return;
 const host=c.querySelector('#pcp')||c.querySelector('.pcol')||c,d=document.createElement('div');d.id='difp';
 const L=[['😊 Звичайна','Після смерті нічого не втрачаєте'],['💀 Складна','Після смерті все з рюкзака лишається там, де вас повалили — можна повернутись і забрати']];
 d.innerHTML=`<h4>Складність</h4><div class='gseg' id='difs'>${L.map((a,i)=>`<button data-i='${i}' class='${i==(D.hard?1:0)?'on':''}'>${a[0]}</button>`).join('')}</div><small class='gnote' id='difn'>${L[D.hard?1:0][1]}</small>`;
 host.appendChild(d);
 d.querySelectorAll('#difs button').forEach(b=>b.onclick=()=>{D.hard=+b.dataset.i;sv();d.querySelectorAll('#difs button').forEach(x=>x.classList.toggle('on',x===b));$('difn').textContent=L[D.hard][1];msg(D.hard?'💀 Складний режим увімкнено':'😊 Звичайний режим')})};
}catch(e){console.warn('difficulty',e)}})();
