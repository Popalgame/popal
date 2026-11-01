/* 0.3.0: адаптивна роздільність, пакетування світу та бюджет кадру.
   0.2.8: якість графіки — 4 режими (Слабкі / Середні / Високі / Ультра). Режим виставляє ВСІ параметри разом:
   роздільність, обмеження FPS, дальність, траву, тіні й ефекти. Будь-який параметр можна змінити окремо — тоді режим «Свої».
   Слабкі — для телефонів, що гріються: 30 FPS, 1× роздільність, без тіней і без постобробки (кадр малюється одразу на екран).
   Адаптивна роздільність (крім Ультра): якщо кадр не встигає, роздільність тимчасово знижується до 60%. */
(function(){try{
const read=n=>{try{return eval(n)}catch(_){return undefined}};
const worldScene=read('sc'),renderer=read('R');if(!worldScene||!renderer)return;
let coarse=false;try{coarse=matchMedia('(pointer:coarse)').matches}catch(_){}
const KEY='zi_quality',KEYS=['res','fps','dist','grass','shadow','fx'];
const PRESETS={low:{name:'Слабкі',res:0,fps:30,dist:0,grass:0,shadow:0,fx:0},med:{name:'Середні',res:1,fps:60,dist:1,grass:1,shadow:1,fx:1},
 high:{name:'Високі',res:2,fps:60,dist:2,grass:2,shadow:2,fx:2},ultra:{name:'Ультра',res:3,fps:0,dist:3,grass:3,shadow:3,fx:3}};
const OPT={res:{n:'Роздільність',l:['Низька','Середня','Висока','Ультра'],note:'Найбільше впливає на нагрів телефона'},
 fps:{n:'Обмеження FPS',v:[30,60,0],l:['30','60','Без обмеження'],note:'30 — економить батарею, телефон менше гріється'},
 dist:{n:'Дальність прорисовки',l:['Близько','Середня','Далеко','Максимум']},
 grass:{n:'Трава',l:['Мало','Середньо','Густо','Ультра']},
 shadow:{n:'Тіні',l:['Вимкнено','Низькі','Високі','Ультра']},
 fx:{n:'Ефекти',l:['Вимкнено','Звичайні','Світіння','Ультра'],note:'Звичайні — кольорокорекція й згладжування; Світіння — ще й сяйво вогню та ліхтарів'}};
const RES_CAP=[1,1.25,2,3],GRASS_N=[4000,9000,15000,1e9],GRASS_GEO=[0,1,2,2],SHADOW=[0,1024,2048,4096];
const weak=()=>{try{return (navigator.deviceMemory&&navigator.deviceMemory<=3)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)}catch(_){return false}};
const defPreset=()=>coarse?(weak()?'low':'med'):'high';
let preset=defPreset(),S={...PRESETS[preset]},scale=1,averageMs=16.7,slowWindows=0,fastWindows=0,qualityAt=0;delete S.name;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved){
 const OLD={battery:'low',balanced:'med',high:'high',k2:'ultra',k3:'ultra'};/* старі режими до 0.2.8 */
 const p=PRESETS[saved.preset]?saved.preset:OLD[saved.mode];if(p){preset=p;S={...PRESETS[p]};delete S.name}
 if(saved.preset==='custom'&&saved.s){preset='custom';for(const k of KEYS)if(saved.s[k]!=null)S[k]=saved.s[k]}}}catch(_){}
const valid=(k,v)=>k==='fps'?OPT.fps.v.includes(v):Number.isInteger(v)&&v>=0&&v<OPT[k].l.length;
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({preset,s:S}))}catch(_){}};
const longEdge=()=>{const el=renderer.domElement||{};return Math.max(1,el.clientWidth||(typeof innerWidth==='number'?innerWidth:1280),el.clientHeight||(typeof innerHeight==='number'?innerHeight:720))};
/* Ультра на екрані з малою щільністю пікселів (ПК) — суперсемплінг до 2560 px по довшій стороні */
function ratio(){const dpr=devicePixelRatio||1;if(S.res===3)return Math.max(Math.min(dpr,RES_CAP[3]),Math.min(2.5,2560/longEdge()),1);
 return Math.max(.6,Math.min(dpr,RES_CAP[S.res])*scale)}
function setShadow(lv){try{const sun=read('sun');if(!sun||!sun.shadow)return;const on=lv>0;if(sun.castShadow!==on)sun.castShadow=on;if(!on)return;const size=SHADOW[lv];
 if(sun.shadow.mapSize.x!==size){sun.shadow.mapSize.set(size,size);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}}catch(_){}}
function applyQuality(reset){const r=ratio();
 if(Math.abs(renderer.getPixelRatio()-r)>.02){renderer.setPixelRatio(r);try{read('rs')()}catch(_){}}
 if(window.plGrass&&window.plGrass.get()!==GRASS_GEO[S.grass])window.plGrass.set(GRASS_GEO[S.grass]);
 const grassMesh=read('gm');if(grassMesh)grassMesh.count=Math.min(grassMesh.instanceMatrix.count,Math.round(GRASS_N[S.grass]*(S.res<3?Math.max(.65,scale):1)));
 if(reset&&window.plGfx)window.plGfx.set({fps:S.fps,dist:S.dist});
 window.plFxLevel=S.fx;if(window.plVis)window.plVis.setHQ(S.fx>=2);
 setShadow(S.shadow);qualityAt=performance.now()}
function setPreset(next){if(!PRESETS[next])return;preset=next;S={...PRESETS[next]};delete S.name;scale=1;slowWindows=fastWindows=0;save();applyQuality(true);syncUI()}
function setOne(k,v){if(!KEYS.includes(k)||!valid(k,v))return;S[k]=v;const m=Object.keys(PRESETS).find(p=>KEYS.every(q=>PRESETS[p][q]===S[q]));preset=m||'custom';if(k==='res')scale=1;save();applyQuality(true);syncUI()}
/* сумісність: старі назви режимів */
const ALIAS={battery:'low',balanced:'med',cinematic:'high',k2:'ultra',k3:'ultra',auto:null};
window.plQuality={set:m=>{if(m in ALIAS)m=ALIAS[m]||defPreset();setPreset(m)},setOne,apply:()=>applyQuality(false),presets:PRESETS,
 state:()=>({mode:preset,preset,settings:{...S},scale,pixelRatio:renderer.getPixelRatio(),buffer:(()=>{const el=renderer.domElement||{};return [el.width||0,el.height||0]})(),averageMs,profile:(PRESETS[preset]||{name:'Свої'}).name,...window.plFrameStats})};
setTimeout(()=>applyQuality(true),0);try{addEventListener('load',()=>applyQuality(true))}catch(_){}
try{let resizeT=0;addEventListener('resize',()=>{clearTimeout(resizeT);resizeT=setTimeout(()=>applyQuality(false),180)})}catch(_){}

/* Пакетуємо лише нерухомі меші з однаковим матеріалом. Спільні вихідні
   геометрії не звільняються; об'єднані буфери мають окремого власника. */
const batchedRoots=new Set(),point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
function batchStatic(root,protectedNodes){
 const groups=new Map();for(const child of root.children){
  if(!child.isMesh||child.isSkinnedMesh||child.isInstancedMesh||child.customDepthMaterial||Array.isArray(child.material)||child.children.length||!child.geometry.attributes.normal||protectedNodes&&protectedNodes.has(child))continue;
  const key=child.material.uuid+':'+child.castShadow+':'+child.receiveShadow;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(child);
 }
 for(const children of groups.values()){
  if(children.length<2)continue;const positions=[],normals=[],uvs=[],colors=[];let hasColor=false;
  for(const child of children){child.updateMatrix();normalMatrix.getNormalMatrix(child.matrix);
   const geo=child.geometry,pa=geo.attributes.position,na=geo.attributes.normal,ua=geo.attributes.uv,ca=geo.attributes.color,ix=geo.index;hasColor=hasColor||!!ca;
   for(let i=0,count=ix?ix.count:pa.count;i<count;i++){const v=ix?ix.getX(i):i;
    point.fromBufferAttribute(pa,v).applyMatrix4(child.matrix);positions.push(point.x,point.y,point.z);
    normal.fromBufferAttribute(na,v).applyMatrix3(normalMatrix).normalize();normals.push(normal.x,normal.y,normal.z);
    uvs.push(ua?ua.getX(v):0,ua?ua.getY(v):0);colors.push(ca?ca.getX(v):1,ca?ca.getY(v):1,ca?ca.getZ(v):1);
   }
  }
  const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));merged.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));merged.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  if(hasColor)merged.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));merged.computeBoundingSphere();
  const mesh=new THREE.Mesh(merged,children[0].material);mesh.castShadow=children[0].castShadow;mesh.receiveShadow=children[0].receiveShadow;mesh.userData.ownsStaticGeometry=1;mesh.userData.heroGeometry=children.some(c=>c.userData.heroGeometry);
  children.forEach(child=>{root.remove(child);if(protectedNodes&&!child.geometry.userData.sharedPalGeometry)child.geometry.dispose()});root.add(mesh);
 }
 root.userData.staticBatchReady=1;if(!protectedNodes)batchedRoots.add(root);
}
window.plBatchModel=(root,protectedNodes)=>{const groups=[];root.traverse(node=>{if(node.isGroup)groups.push(node)});groups.forEach(group=>batchStatic(group,protectedNodes||new Set()));root.traverse(mesh=>{if(!mesh.isMesh)return;if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();const radius=mesh.geometry.boundingSphere.radius*Math.max(Math.abs(mesh.scale.x),Math.abs(mesh.scale.y),Math.abs(mesh.scale.z));mesh.castShadow=radius>.14&&!mesh.material.transparent&&!mesh.material.isMeshBasicMaterial});if(root.userData.heroGeometries){root.userData.heroGeometries.clear();root.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.heroGeometry)root.userData.heroGeometries.add(mesh.geometry)})}};
function freezeObject(obj){obj.updateMatrix();obj.updateMatrixWorld(true);obj.traverse(child=>{if(!child.userData.noFreeze)child.matrixAutoUpdate=false})}
function scanStatics(){
 for(const name of ['pl','hp2']){const hero=read(name),rig=hero&&hero.userData.rig;if(!rig||rig.batched||rig.skeletal)continue;
  if(rig.hair&&rig.hair.length){const hairRoot=new THREE.Group();rig.head.add(hairRoot);for(const [mesh] of rig.hair){mesh.parent.remove(mesh);hairRoot.add(mesh)}rig.hair=[[hairRoot,0]]}
  window.plBatchModel(hero,new Set());rig.batched=1;
 }
 for(const root of batchedRoots)if(!root.parent){root.traverse(child=>{if(child.userData.ownsStaticGeometry)child.geometry.dispose()});batchedRoots.delete(root)}
 for(const name of ['trees','rocks','bushes','shrooms'])for(const obj of read(name)||[]){const root=obj.m;if(!root)continue;if(!root.userData.staticBatchReady){batchStatic(root);if(name==='bushes'||name==='shrooms')root.traverse(mesh=>{if(mesh.isMesh)mesh.castShadow=false})}if(root.matrixAutoUpdate)freezeObject(root)}
 for(const child of worldScene.children)if(child.isMesh&&child.matrixAutoUpdate&&!child.userData.noFreeze&&(child.isInstancedMesh||child.geometry&&child.geometry.type==='PlaneGeometry'))freezeObject(child);
}
setTimeout(scanStatics,900);setInterval(scanStatics,4000);
const oldFlash=window.flash;if(typeof oldFlash==='function')window.flash=function(obj){const root=obj&&obj.m;if(root&&!root.matrixAutoUpdate){root.matrixAutoUpdate=true;setTimeout(()=>{if(root.parent){root.updateMatrix();root.matrixAutoUpdate=false}},280)}return oldFlash.apply(this,arguments)};
setInterval(()=>{const actor=read('P');if(!actor)return;const far=(worldScene.fog?worldScene.fog.far:80)+12,far2=far*far;
 for(const name of ['trees','rocks','bushes','shrooms'])for(const obj of read(name)||[]){if(obj.m)obj.m.visible=(obj.x-actor.x)**2+(obj.z-actor.z)**2<far2}
 for(const name of ['wild','pals'])for(const obj of read(name)||[]){if(!obj.m)continue;
  const isPal=name==='pals',selected=isPal&&obj===(read('pals')||[])[read('selP')],eligible=!isPal||(selected&&(!window.palShown||window.palShown()))||obj.wk&&obj.cs!=null;
  obj.m.visible=!!eligible&&(obj.x-actor.x)**2+(obj.z-actor.z)**2<far2;
  const high=obj._hi&&obj._hi.root;for(const child of obj.m.children)if(child!==high&&child.matrixAutoUpdate)freezeObject(child);
 }
},240);

/* Після двох повільних вікон Auto зменшує GPU-навантаження. Для
   відновлення якості потрібно вісім стабільних вікон — без мерехтіння. */
let last=performance.now(),elapsed=0,samples=[];
function monitor(now){requestAnimationFrame(monitor);const dt=now-last;last=now;
 if(document.hidden||read('menuO')||read('ccO')||read('ivO')||read('pfO')){samples=[];elapsed=0;return}
 if(dt<=0||dt>150)return;samples.push(dt);elapsed+=dt;if(elapsed<2500)return;
 averageMs=samples.reduce((a,b)=>a+b,0)/samples.length;samples=[];elapsed=0;if(S.res===3||performance.now()-qualityAt<5000)return;
 const target=1000/(window.gfxFps||60);slowWindows=averageMs>target*1.25?slowWindows+1:0;fastWindows=averageMs<target*1.08?fastWindows+1:0;
 if(slowWindows>=2&&scale>.6){scale=Math.max(.6,scale-.12);slowWindows=fastWindows=0;applyQuality(false)}
 else if(fastWindows>=8&&scale<1){scale=Math.min(1,scale+.08);slowWindows=fastWindows=0;applyQuality(false)}
}
requestAnimationFrame(monitor);
/* ---------- вкладка «Графіка»: режими + детальні налаштування ---------- */
function syncUI(){const p=document.getElementById&&document.getElementById('gq-presets');if(!p)return;
 p.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('on',b.dataset.preset===preset));
 const n=document.getElementById('gq-note');if(n)n.textContent=preset==='custom'?'Свої налаштування — оберіть режим, щоб повернути збалансовані значення':
  {low:'Для слабких телефонів: менше нагрівається й довше тримає батарея',med:'Баланс якості й плавності — рекомендовано для більшості телефонів',high:'Тіні, світіння й густа трава — для потужних телефонів і ПК',ultra:'Усе на максимум: найвища роздільність, тіні й ефекти, без обмеження FPS'}[preset];
 for(const k of KEYS)document.querySelectorAll('#gq-'+k+' button').forEach(b=>b.classList.toggle('on',(k==='fps'?OPT.fps.v[+b.dataset.i]:+b.dataset.i)===S[k]))}
if(document.createElement){const css=document.createElement('style');css.textContent=`#gq-presets .gseg.big button{flex:1;padding:10px 4px;font-size:15px;font-weight:800}#gq-presets details{margin-top:10px}#gq-presets summary{cursor:pointer;font-weight:700;color:#ffe7a8;padding:6px 0}`;document.head.appendChild(css)}
const oldTab=pfTab;pfTab=function(tab){oldTab.apply(this,arguments);if(tab!=='g'&&tab!=='o')return;const host=document.getElementById('gfxp');if(!host||document.getElementById('gq-presets'))return;
 const panel=document.createElement('div');panel.id='gq-presets';
 panel.innerHTML='<h4>Якість графіки</h4><div class="gseg big">'+Object.entries(PRESETS).map(([k,v])=>`<button data-preset="${k}">${v.name}</button>`).join('')+'</div><small class="gnote" id="gq-note"></small>'+
  '<details'+(preset==='custom'?' open':'')+'><summary>Детальні налаштування</summary>'+KEYS.map(k=>`<h4>${OPT[k].n}</h4><div class="gseg" id="gq-${k}">${OPT[k].l.map((l,i)=>`<button data-i="${i}">${l}</button>`).join('')}</div>`+(OPT[k].note?`<small class="gnote">${OPT[k].note}</small>`:'')).join('')+'</details>';
 host.prepend(panel);
 panel.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>setPreset(b.dataset.preset));
 for(const k of KEYS)panel.querySelectorAll('#gq-'+k+' button').forEach(b=>b.onclick=()=>setOne(k,k==='fps'?OPT.fps.v[+b.dataset.i]:+b.dataset.i));
 syncUI()};
}catch(error){console.warn('perf',error)}})();
