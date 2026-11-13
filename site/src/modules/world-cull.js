/* global gm, fm, WG_N, sc, THREE */
/* 0.2.18: відсікання невидимого світу. До цього вся карта малювалася щокадру цілком:
   • скелі хребтів, прибережні кручі та ялинки на них — це InstancedMesh, а three.js r128 не вміє відсікати його за пірамідою
     видимості (frustumCulled=false), тож 2 000+ брил (≈400 тис. трикутників) ішли на відеокарту навіть за спиною героя
     й далеко за туманом, а з тінями — двічі;
   • земля — одна сітка на всю карту (≈125 тис. трикутників).
   Тут статичні InstancedMesh діляться на ділянки по CELL метрів, а земля — на TILES×TILES плиток. Кожна ділянка має власну
   сферу меж, тому three.js сам пропускає ті, що поза кадром, за дальністю прорисовки чи поза камерою тіні.
   Вершинні буфери спільні з оригіналом (нова лише індексація й матриці), тож памʼять відеокарти не росте.
   Траву й квіти (gm, fm у core-world.js) не чіпаємо — вони щокадру переставляються навколо героя. */
(function(){try{
if(typeof THREE==='undefined'||typeof sc==='undefined')return;
const CELL=40,TILES=8,MIN=24;
const skip=new Set();try{skip.add(gm);skip.add(fm)}catch(_){}

function share(geo){const g=new THREE.BufferGeometry();for(const k in geo.attributes)g.setAttribute(k,geo.attributes[k]);
 if(geo.index)g.setIndex(geo.index);for(const gr of geo.groups)g.addGroup(gr.start,gr.count,gr.materialIndex);
 g.userData.sharedWorldGeometry=1;return g}

/* ---------- статичні InstancedMesh → ділянки ---------- */
function chunkInstanced(m){if(!m||!m.isInstancedMesh||m.userData.chunked||skip.has(m)||m.count<MIN||!m.parent)return 0;
 const geo=m.geometry;if(!geo||!geo.attributes.position)return 0;if(!geo.boundingSphere)geo.computeBoundingSphere();
 const bs=geo.boundingSphere,M=new THREE.Matrix4(),c=new THREE.Vector3(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
 const cells=new Map();
 for(let i=0;i<m.count;i++){m.getMatrixAt(i,M);c.copy(bs.center).applyMatrix4(M);M.decompose(p,q,s);
  const r=bs.radius*Math.max(Math.abs(s.x),Math.abs(s.y),Math.abs(s.z)),k=Math.floor(c.x/CELL)+','+Math.floor(c.z/CELL);
  let a=cells.get(k);if(!a)cells.set(k,a=[]);a.push([i,c.x,c.y,c.z,r])}
 const col=new THREE.Color(),par=m.parent;let made=0;m.updateMatrix();
 for(const a of cells.values()){const g=share(geo);let cx=0,cy=0,cz=0;for(const e of a){cx+=e[1];cy+=e[2];cz+=e[3]}cx/=a.length;cy/=a.length;cz/=a.length;
  let rad=0;for(const e of a)rad=Math.max(rad,Math.hypot(e[1]-cx,e[2]-cy,e[3]-cz)+e[4]);
  g.boundingSphere=new THREE.Sphere(new THREE.Vector3(cx,cy,cz),rad);
  const n=new THREE.InstancedMesh(g,m.material,a.length);
  a.forEach((e,j)=>{m.getMatrixAt(e[0],M);n.setMatrixAt(j,M);if(m.instanceColor){m.getColorAt(e[0],col);n.setColorAt(j,col)}});
  n.instanceMatrix.needsUpdate=true;if(n.instanceColor)n.instanceColor.needsUpdate=true;
  n.name=m.name;n.castShadow=m.castShadow;n.receiveShadow=m.receiveShadow;n.renderOrder=m.renderOrder;n.layers.mask=m.layers.mask;n.visible=m.visible;
  if(m.customDepthMaterial)n.customDepthMaterial=m.customDepthMaterial;if(m.customDistanceMaterial)n.customDistanceMaterial=m.customDistanceMaterial;
  Object.assign(n.userData,m.userData,{chunked:1,noFreeze:1});
  n.matrix.copy(m.matrix);n.matrixAutoUpdate=false;n.frustumCulled=true;par.add(n);n.updateMatrixWorld(true);made++}
 par.remove(m);m.userData.chunked=1;try{m.dispose()}catch(_){}
 return made}

/* ---------- земля → плитки ---------- */
function tileTerrain(){let N=0;try{N=WG_N}catch(_){}if(!N)return 0;
 const gr=sc.children.find(o=>o.isMesh&&!o.isInstancedMesh&&!o.userData.tiled&&o.geometry&&o.geometry.type==='PlaneGeometry'&&o.geometry.attributes.position.count===N*N);
 if(!gr||!gr.geometry.index)return 0;
 const geo=gr.geometry,pos=geo.attributes.position,Q=N-1,step=Math.ceil(Q/TILES),big=pos.count>65535,par=gr.parent;gr.updateMatrix();let made=0;
 for(let ty=0;ty<Q;ty+=step)for(let tx=0;tx<Q;tx+=step){const x1=Math.min(Q,tx+step),y1=Math.min(Q,ty+step),idx=new(big?Uint32Array:Uint16Array)((x1-tx)*(y1-ty)*6);let k=0;
  const bx=new THREE.Box3();const v=new THREE.Vector3();
  for(let iy=ty;iy<y1;iy++)for(let ix=tx;ix<x1;ix++){const a=ix+N*iy,b=ix+N*(iy+1),c=ix+1+N*(iy+1),d=ix+1+N*iy;idx[k++]=a;idx[k++]=b;idx[k++]=d;idx[k++]=b;idx[k++]=c;idx[k++]=d}
  for(let iy=ty;iy<=y1;iy++)for(let ix=tx;ix<=x1;ix++)bx.expandByPoint(v.fromBufferAttribute(pos,ix+N*iy));
  const g=new THREE.BufferGeometry();for(const n in geo.attributes)g.setAttribute(n,geo.attributes[n]);g.setIndex(new THREE.BufferAttribute(idx,1));
  g.boundingBox=bx;g.boundingSphere=bx.getBoundingSphere(new THREE.Sphere());g.userData.sharedWorldGeometry=1;
  const t=new THREE.Mesh(g,gr.material);t.name='terrainTile';t.receiveShadow=gr.receiveShadow;t.castShadow=gr.castShadow;t.renderOrder=gr.renderOrder;t.layers.mask=gr.layers.mask;
  t.userData.noFreeze=1;t.userData.terrainTile=1;t.matrix.copy(gr.matrix);t.matrixAutoUpdate=false;par.add(t);t.updateMatrixWorld(true);made++}
 /* оригінал лишається в сцені невидимим: його матеріал і буфери й далі спільні з плитками */
 gr.visible=false;gr.userData.tiled=1;return made}

function run(){let inst=0,from=0;const list=[];sc.traverse(o=>{if(o.isInstancedMesh&&!o.userData.chunked&&!skip.has(o)&&o.count>=MIN)list.push(o)});
 for(const m of list){const n=chunkInstanced(m);if(n){inst+=n;from++}}
 const tiles=tileTerrain();return{instancedFrom:from,chunks:inst,tiles}}
window.plWorldCull={run,chunkInstanced,stats:null};
window.plWorldCull.stats=run();
/* модулі, що додають скелі пізніше (після завантаження моделей чи переходу між вимірами) */
setTimeout(()=>{try{const s=run();if(s.chunks||s.tiles)window.plWorldCull.stats=s}catch(e){console.warn('world-cull',e)}},3000);
}catch(e){console.warn('world-cull',e)}})();
