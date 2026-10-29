/* global gm, fm, regrass, P */
/* Keep meadow plants out of placed foundations, including restored saves. */
(function(){
if(!window.BUILD)return;
const cells=()=>window.BUILD.pieces.filter(p=>p.t===0).map(p=>p.cx+','+p.cz);
const original=regrass;
regrass=function(){
 original.apply(this,arguments);
 const blocked=new Set(cells());
 if(!blocked.size)return;
 for(const mesh of [gm,fm]){
  const values=mesh.instanceMatrix.array;
  for(let i=0;i<values.length;i+=16){
   if(values[i+13]>-4&&blocked.has(Math.floor(values[i+12]/3)+','+Math.floor(values[i+14]/3)))values[i+13]=-5;
  }
  mesh.instanceMatrix.needsUpdate=true;
 }
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
