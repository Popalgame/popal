/* global gm, fm, regrass, P */
/* Keep meadow plants out of placed foundations, including restored saves. */
(function(){
if(!window.BUILD)return;
const cells=()=>window.BUILD.pieces.filter(p=>p.t===0).map(p=>p.cx+','+p.cz);
/* 0.2.18: трава переставляється порціями (core-world.js), тому клітинки фундаментів передаємо їй наперед,
   а не правимо готовий буфер після перестановки. */
const original=regrass;
regrass=function(){
 const list=cells();
 window.plGrassBlocked=list.length?new Set(list):null;
 return original.apply(this,arguments);
};
let last='';
window.plRefreshVegetation=function(){
 const next=cells().sort().join('|');
 if(next===last)return;
 last=next;
 regrass(P.x,P.z);
};
window.plRefreshVegetation();
})();
