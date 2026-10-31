/* 0.5.x: здобич із переможених диких істот — з Пухоклуба випадає шерсть 🧶, з Моророга, Грозовика й Бамбузла — шкіра 🟫
   (1–2 шт., з істот від 20 рівня — на одну більше). Спрацьовує, хоч би хто переміг: герой чи попал-захисник. Пійманих це не стосується */
(function(){try{
if(typeof wild=='undefined'||typeof T=='undefined')return;
const ic=(k,e)=>(window.plIconSrc&&plIconSrc(k)&&window.plIcon)?plIcon(k):e;/* намальовані значки — icons.js */
Object.assign(IT,{wool:[ic('wool','🧶'),'Шерсть'],lth:[ic('lth','🟫'),'Шкіра']});
for(const k of['wool','lth'])if(inv[k]==null)inv[k]=0;
const LOOT={'Пухоклуб':'wool','Мороріг':'lth','Грозовик':'lth','Бамбузл':'lth'},EMO={wool:'🧶',lth:'🟫'};/* msg і dmg виводять текст, тож там — емодзі */
function drop(w){const k=LOOT[(T[w.ty]||{}).n];if(!k)return;const n=1+(Math.random()<.4?1:0)+((w.lv||1)>=20?1:0);addI(k,n);
 const p=w.m&&w.m.position?w.m.position.clone():null;setTimeout(()=>{try{if(p)dmg('+'+n+' '+EMO[k],{position:p},'#ffe28a')}catch(_){}msg(EMO[k]+' '+IT[k][1]+' +'+n);try{hud()}catch(_){}},450)}
/* переможена істота прибирається з масиву wild з hp<=0 (core-world.js, pal-defense.js); піймана — з hp>0 */
const sp=wild.splice;wild.splice=function(){const out=sp.apply(this,arguments);for(const w of out)if(w&&w.hp<=0)try{drop(w)}catch(e){console.warn('creature-drops',e)}return out};
}catch(e){console.warn('creature-drops:',e)}})();
