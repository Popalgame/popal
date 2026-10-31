/* 0.5.x: пункт «Трава» у вкладці «Графіка» — Слабо / Середньо / Високо, щоб на слабких пристроях гра не лагала.
   Слабо: 3 простіші травинки в кущику й 35% кущиків; Середньо: 5 травинок і 70%; Високо: 9 травинок і всі кущики (як було).
   Кількість кущиків бере profile з perf.js і множить на plGrassK. За замовчуванням: телефон — Середньо, ПК — Високо. */
(function(){try{
const G=n=>{try{return eval(n)}catch(_){return undefined}};
const grass=G('gm');if(!grass||!grass.material)return;
const KEY='zi_grass',NAMES=['Слабо','Середньо','Високо'],LEAVES=[3,5,9],ROWS=[3,4,4],K=[.35,.7,1];
let coarse=false;try{coarse=matchMedia('(pointer:coarse)').matches}catch(_){}
let L=coarse?1:2;try{const v=+localStorage.getItem(KEY);if(localStorage.getItem(KEY)!=null&&v>=0&&v<=2)L=v}catch(_){}
/* та сама форма кущика, що й у visuals.js, лише з потрібною кількістю травинок і сегментів */
function tuft(leaves,rows){const g=new THREE.BufferGeometry(),pos=[],uv=[],col=[],idx=[];
 for(let leaf=0;leaf<leaves;leaf++){const angle=leaf*2.39996,dx=Math.cos(angle),dz=Math.sin(angle),height=.20+(leaf%4)*.055;
  const spread=.065+(leaf%3)*.06,width=(.012+(leaf%3)*.003)*(leaves<5?1.6:leaves<9?1.25:1),lean=.09+(leaf%4)*.03,start=pos.length/3;
  for(let row=0;row<rows;row++){const t=row/(rows-1),w=width*(1-t)*(.8+.5*Math.sin(t*Math.PI)),curve=spread+t*t*lean;
   for(const side of[-1,1]){pos.push(dx*curve-dz*w*side,height*t-.035,dz*curve+dx*w*side);uv.push((side+1)/2,t);const sh=.91+(leaf%3)*.045;col.push(sh,sh,sh)}}
  for(let row=0;row<rows-1;row++){const n=start+row*2;idx.push(n,n+1,n+2);if(row<rows-2)idx.push(n+2,n+1,n+3)}}
 g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g}
const GEO=[];
function apply(){const old=grass.geometry;if(!GEO[L])GEO[L]=tuft(LEAVES[L],ROWS[L]);if(old!==GEO[L]){grass.geometry=GEO[L];if(!GEO.includes(old))old.dispose()}
 if(window.plQuality&&window.plQuality.apply)window.plQuality.apply();else grass.count=Math.min(grass.instanceMatrix.count,Math.round(grass.count*K[L]))}
window.plGrassK=()=>K[L];
window.plGrass={get:()=>L,set:v=>{L=Math.max(0,Math.min(2,v|0));try{localStorage.setItem(KEY,String(L))}catch(_){}apply()}};
apply();
const _pf=pfTab;pfTab=function(t){_pf.apply(this,arguments);if(t!='g'&&t!='o')return;const host=document.getElementById('gfxp');if(!host||document.getElementById('grassq'))return;
 const d=document.createElement('div');d.id='grassq';
 d.innerHTML=`<h4>Трава</h4><div class='gseg'>${NAMES.map((n,i)=>`<button data-i='${i}' class='${i==L?'on':''}'>${n}</button>`).join('')}</div><small class='gnote'>Трава — найважча частина світу. «Слабо» — для слабких телефонів, «Високо» — густа трава для потужних пристроїв</small>`;
 host.appendChild(d);d.querySelectorAll('button').forEach(b=>b.onclick=()=>{window.plGrass.set(+b.dataset.i);d.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))})};
}catch(e){console.warn('grass-quality:',e)}})();
