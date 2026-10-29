/* 0.3.0: адаптивна роздільність, пакетування світу та бюджет кадру. */
(function(){try{
const read=n=>{try{return eval(n)}catch(_){return undefined}};
const worldScene=read('sc'),renderer=read('R');if(!worldScene||!renderer)return;
const coarse=matchMedia('(pointer:coarse)').matches,KEY='zi_quality';
const profiles={battery:{name:'Економія',dpr:1,fps:30,dist:0,grass:6500,hq:0},balanced:{name:'Збалансована',dpr:1.25,fps:60,dist:1,grass:12000,hq:0},high:{name:'Кінематографічна',dpr:2,fps:60,dist:2,grass:20000,hq:1},k2:{name:'2K (2560)',res:2560,fps:60,dist:2,grass:20000,hq:1},k3:{name:'3K (3200)',res:3200,fps:60,dist:3,grass:20000,hq:1,shadow:4096}};
let mode='auto',scale=1,averageMs=16.7,slowWindows=0,fastWindows=0,qualityAt=0;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&['auto',...Object.keys(profiles)].includes(saved.mode))mode=saved.mode}catch(_){}
const profile=()=>profiles[mode==='auto'?(coarse?'balanced':'high'):mode];
/* 2K/3K target the long edge of the drawing buffer regardless of devicePixelRatio,
   so even a 1x display renders a supersampled 2560/3200 px frame. */
const longEdge=()=>{const el=renderer.domElement||{};return Math.max(1,el.clientWidth||(typeof innerWidth==='number'?innerWidth:1280),el.clientHeight||(typeof innerHeight==='number'?innerHeight:720))};
function ratioFor(cfg){if(cfg.res)return Math.max(1,Math.min(4,cfg.res/longEdge()));return Math.max(.7,Math.min(devicePixelRatio||1,cfg.dpr)*scale)}
function setShadow(size){if(!size)return;try{const sun=read('sun');if(!sun||!sun.shadow)return;if(sun.shadow.mapSize.x!==size){sun.shadow.mapSize.set(size,size);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}}catch(_){}}
function applyQuality(reset){const cfg=profile(),ratio=ratioFor(cfg);
 if(Math.abs(renderer.getPixelRatio()-ratio)>.02){renderer.setPixelRatio(ratio);try{read('rs')()}catch(_){}}
 const grassMesh=read('gm');if(grassMesh)grassMesh.count=Math.min(grassMesh.instanceMatrix.count,Math.round(cfg.grass*(mode==='auto'?Math.max(.65,scale):1)));
 if(reset&&window.plGfx)window.plGfx.set({fps:cfg.fps,dist:mode==='auto'?1:cfg.dist});
 if(window.plVis)window.plVis.setHQ(cfg.hq&&(mode!=='auto'||scale>.78));
 setShadow(cfg.shadow);qualityAt=performance.now();
}
function setMode(next){if(!['auto',...Object.keys(profiles)].includes(next))return;mode=next;scale=1;slowWindows=fastWindows=0;try{localStorage.setItem(KEY,JSON.stringify({mode}))}catch(_){}applyQuality(true)}
window.plQuality={set:setMode,state:()=>({mode,scale,pixelRatio:renderer.getPixelRatio(),buffer:(()=>{const el=renderer.domElement||{};return [el.width||0,el.height||0]})(),target:profile().res||null,averageMs,profile:profile().name,...window.plFrameStats})};
setTimeout(()=>applyQuality(true),0);
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
 averageMs=samples.reduce((a,b)=>a+b,0)/samples.length;samples=[];elapsed=0;if(mode!=='auto'||performance.now()-qualityAt<5000)return;
 const target=1000/(window.gfxFps||60);slowWindows=averageMs>target*1.25?slowWindows+1:0;fastWindows=averageMs<target*1.08?fastWindows+1:0;
 if(slowWindows>=2&&scale>.6){scale=Math.max(.6,scale-.12);slowWindows=fastWindows=0;applyQuality(false)}
 else if(fastWindows>=8&&scale<1){scale=Math.min(1,scale+.08);slowWindows=fastWindows=0;applyQuality(false)}
}
requestAnimationFrame(monitor);
const oldTab=pfTab;pfTab=function(tab){oldTab.apply(this,arguments);if(tab!=='g'&&tab!=='o')return;const host=document.getElementById('gfxp');if(!host||document.getElementById('quality-presets'))return;
 const panel=document.createElement('div');panel.id='quality-presets';panel.innerHTML='<h4>Якість і плавність</h4><div class="gseg">'+[['auto','Авто'],...Object.entries(profiles).map(([k,v])=>[k,v.name])].map(([key,label])=>'<button data-quality="'+key+'" class="'+(mode===key?'on':'')+'">'+label+'</button>').join('')+'</div><small class="gnote">Авто адаптує роздільність та ефекти для плавної гри. 2K/3K рендерять кадр у 2560/3200 px по довшій стороні (суперсемплінг) — найчіткіша картинка, найважче для GPU.</small>';
 host.prepend(panel);panel.querySelectorAll('button').forEach(button=>button.onclick=()=>{setMode(button.dataset.quality);panel.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===button))});
};
}catch(error){console.warn('perf',error)}})();
