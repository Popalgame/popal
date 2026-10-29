/* Optional GLB hero. The editor skin remains visible until a valid rig is ready. */
(function(){
'use strict';
const T=window.THREE,previous=window.buildHero,previousAct=window.heroAct,previousShow=window.ccShow,previousDraw=window.drawAv;
const api=window.importedHero={status:'loading',ready:null,error:null,clips:[],stats:null,url:'assets/models/hero-rigged.glb'};
if(!T||!T.GLTFLoader||!T.SkeletonUtils||typeof previous!=='function'){
 api.status='unavailable';api.error='Three GLTFLoader, SkeletonUtils, or buildHero is unavailable';api.ready=Promise.resolve(false);return;
}
const get=name=>{try{return eval(name)}catch(_){return undefined}};
const instances=new Set(),normName=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^(mixamorig|hero)/,'');
let template=null,animations=null,last=performance.now();
function disposeInstance(g){
 const old=g.userData.importedHero;if(!old)return;
 const r=g.userData.rig;if(r&&r.mixer){r.mixer.stopAllAction();r.mixer.uncacheRoot(old.model)}
 const skeletons=new Set();old.model.traverse(node=>{if(node.isSkinnedMesh&&node.skeleton)skeletons.add(node.skeleton);if(node.userData.importedAccessory){node.geometry.dispose();node.material.dispose()}});
 for(const skeleton of skeletons)skeleton.dispose();
 g.remove(old.model);g.userData.importedHero=null;g.userData.rig=null;instances.delete(g);
}
function disposeProcedural(g){
 const skin=g.userData.heroSkin,r=g.userData.rig;
 if(r&&r.mixer){r.mixer.stopAllAction();if(skin)r.mixer.uncacheRoot(skin.mesh)}
 if(skin){skin.mesh.skeleton.dispose();skin.mesh.material.dispose();g.userData.heroSkin=null}
 if(g.userData.heroGeometries){for(const geometry of g.userData.heroGeometries)geometry.dispose();g.userData.heroGeometries.clear()}
 while(g.children.length)g.remove(g.children[0]);
}
function bone(model,terms){let result=null;model.traverse(node=>{if(result||!node.isBone)return;const name=normName(node.name);if(terms.some(term=>name.includes(term)))result=node});return result}
function accessory(parent,geometry,material,x,y,z,rx,rz){
 const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.rotation.set(rx||0,0,rz||0);mesh.castShadow=true;mesh.userData.importedAccessory=true;parent.add(mesh);return mesh;
}
function equipment(model,g){
 const equipped=get('eq')||{},tool=equipped.tool||'';
 const hand=bone(model,['righthand','handr']);
 if(hand&&/^(ax|pk|pick)/.test(tool)){
  const metal=/^(axm|pkm)$/.test(tool)?0xc7d3dc:/^(axe|pick)$/.test(tool)?0x858d96:0xa8753d;
  const grip=new T.Group();grip.name='equippedTool';hand.add(grip);
  /* the hand bone's +Y runs wrist->fingertips, so the shaft must extend along +y or the tool
     renders back through the forearm */
  accessory(grip,new T.CylinderGeometry(.022,.026,.48,8),new T.MeshStandardMaterial({color:0x79512f}),0,.18,0,0,0);
  if(/^ax/.test(tool))accessory(grip,new T.BoxGeometry(.2,.105,.045),new T.MeshStandardMaterial({color:metal}),-.075,.4,0,0,.18);
  else accessory(grip,new T.BoxGeometry(.34,.055,.055),new T.MeshStandardMaterial({color:metal}),0,.4,0,0,0);
 }

}
function upperClip(clip){
 /* hips rotation joins the overlay so strikes pivot the whole body, but hips position stays
     with the locomotion clip or the additive bob would double up */
 const tracks=clip.tracks.filter(track=>/arm|hand|shoulder|clavicle|spine|chest|head|neck/i.test(track.name)||(/hips/i.test(track.name)&&!/\.(position|scale)$/.test(track.name)));
 if(!tracks.length)return clip;
 const copy=new T.AnimationClip(clip.name,clip.duration,tracks.map(track=>track.clone()));
 if(T.AnimationUtils&&T.AnimationUtils.makeClipAdditive)T.AnimationUtils.makeClipAdditive(copy,0);
 return copy;
}
function install(g){
 if(!g||!g.userData||!template)return false;
 const model=T.SkeletonUtils.clone(template),mixer=new T.AnimationMixer(model),actions={};
 model.name='importedHero';model.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false}});
 const source={};for(const clip of animations)source[clip.name.toLowerCase()]=clip;
 const idle=source.idle;
 for(const key of ['idle','walk','run','swim','hit','throw']){
  const overlay=key==='hit'||key==='throw',clip=source[key]||idle;
  const action=mixer.clipAction(overlay?upperClip(clip):clip);
  action.setLoop(overlay?T.LoopOnce:T.LoopRepeat,Infinity);action.clampWhenFinished=overlay;
  if(overlay&&action.getClip()!==clip&&T.AdditiveAnimationBlendMode!==undefined)action.blendMode=T.AdditiveAnimationBlendMode;
  actions[key]=action;
 }
 actions.idle.play();
 if(g.userData.importedHero)disposeInstance(g);else disposeProcedural(g);
 equipment(model,g);g.add(model);
 g.userData.importedHero={model};
 g.userData.rig={skeletal:true,imported:true,mixer,actions,state:'idle',locomotion:'idle',action:null,actionUntil:0,speed:0,run:0,lastX:null,lastZ:null};
 instances.add(g);return true;
}
window.buildHero=function(g,lk){if(!template||!g||g!==get('pl')&&g!==get('hp2'))return previous.call(this,g,lk);install(g);return g};
function noteEditor(){
 if(!document.getElementById)return;const panel=document.getElementById('ccp');
 if(!panel||!panel.querySelector('#ccn')||panel.querySelector('.imported-hero-note'))return;
 const note=document.createElement('p');note.className='imported-hero-note';note.textContent='Вигляд 3D-героя фіксований. Ім’я можна змінити.';
 panel.insertBefore(note,panel.querySelector('#cca'));
}
if(typeof previousShow==='function')window.ccShow=function(){const result=previousShow.apply(this,arguments);if(api.status==='ready')noteEditor();return result};
function captureAvatar(){
 const renderer=get('R2'),scene=get('sc2'),camera=get('cam2'),preview=get('hp2');
 const canvas=document.getElementById&&document.getElementById('avc'),ctx=canvas&&canvas.getContext&&canvas.getContext('2d');
 if(!renderer||!scene||!camera||!preview||!preview.userData.importedHero||!ctx||!renderer.domElement)return;
 const position=camera.position.clone(),quaternion=camera.quaternion.clone(),rotation=preview.rotation.clone(),zoom=camera.zoom;
 try{
  preview.rotation.set(0,0,0);camera.position.set(0,1.56,1.35);camera.lookAt(0,1.5,0);camera.zoom=1.1;camera.updateProjectionMatrix();
  renderer.render(scene,camera);
  const source=renderer.domElement,width=source.width,height=source.height,size=Math.min(width,height);
  if(!size)throw Error('Empty preview canvas');
  ctx.fillStyle='#203c35';ctx.fillRect(0,0,64,64);ctx.drawImage(source,(width-size)/2,(height-size)/2,size,size,0,0,64,64);
 }finally{
  camera.position.copy(position);camera.quaternion.copy(quaternion);camera.zoom=zoom;camera.updateProjectionMatrix();preview.rotation.copy(rotation);
  renderer.render(scene,camera);
 }
}
if(typeof previousDraw==='function')window.drawAv=function(){const result=previousDraw.apply(this,arguments);if(api.status==='ready')try{captureAvatar()}catch(error){console.warn('imported hero avatar',error)}return result};
function syncAction(r,now){
 if(!r.action){r.actionObservedUntil=null;return}
 // hero-anim's click listeners call their lexical act(), which writes its old duration.
 // A changed deadline also identifies a repeated click of the same action.
 if(r.actionUntil!==r.actionObservedUntil){r.actionUntil=now+r.actions[r.action].getClip().duration;r.actionObservedUntil=r.actionUntil}
}
window.heroAct=function(kind){previousAct(kind);const pl=get('pl'),r=pl&&pl.userData.rig;if(r&&r.imported&&r.action===kind)syncAction(r,performance.now()/1000)};
/* gait clips share the same phase convention (t=0 = left foot contact), so walk<->run
   transitions keep the same normalized phase instead of snapping back to frame 0 */
const gait=k=>k==='walk'||k==='run',clipDur=a=>a.getClip().duration;
function choose(r,next,fade){if(next===r.locomotion)return;const from=r.actions[r.locomotion],to=r.actions[next];to.reset();if(gait(next)&&gait(r.locomotion)){const d=clipDur(from);to.time=(from.time%d)/d*clipDur(to)}to.play();to.crossFadeFrom(from,fade,false);r.locomotion=next}
const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
(function loop(){requestAnimationFrame(loop);const now=performance.now(),dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;
 const pl=get('pl'),P=get('P'),H=window.H;
 for(const g of instances){const r=g.userData.rig;if(!r||!r.imported){instances.delete(g);continue}if(!g.parent)continue;
  let state='idle';if(g===pl&&P){const velocity=r.lastX==null?0:Math.hypot(P.x-r.lastX,P.z-r.lastZ)/Math.max(dt,.001);r.lastX=P.x;r.lastZ=P.z;r.speed=damp(r.speed,get('menuO')?0:Math.min(15,velocity),8,dt);r.run=damp(r.run,r.speed>3.3?1:0,7,dt);state=H&&H(P.x,P.z)<-1.15?'swim':r.speed>3.3?'run':r.speed>.24?'walk':'idle'}
  syncAction(r,now/1000);
  if(r.action&&now/1000>=r.actionUntil){r.actions[r.action].fadeOut(.1);r.action=null}
  choose(r,state,state==='swim'?.26:.17);r.state=r.action||r.locomotion;
  /* stride-matched playback: walk_v2 covers 1.04 m/s, run_v2 covers 4.0 m/s at timeScale 1 */
  r.actions.walk.timeScale=Math.max(.8,Math.min(2.2,r.speed/1.04));r.actions.run.timeScale=Math.max(.85,Math.min(1.5,r.speed/4));r.mixer.update(dt);
 }
})();
api.ready=new Promise(resolve=>{
 new T.GLTFLoader().load(api.url,gltf=>{
  try{
   const scene=gltf.scene||gltf.scenes&&gltf.scenes[0],clips=gltf.animations||[];
   if(!scene||['idle','walk','run','swim','hit','throw'].some(name=>!clips.some(c=>c.name.toLowerCase()===name)))throw Error('Rig requires idle, walk, run, swim, hit, and throw clips');
   let skinned=0,meshes=0,triangles=0;scene.traverse(node=>{if(!node.isMesh)return;meshes++;if(node.isSkinnedMesh)skinned++;const geometry=node.geometry;if(geometry){const count=geometry.index?geometry.index.count:geometry.getAttribute('position')&&geometry.getAttribute('position').count;triangles+=Math.floor((count||0)/3)}});if(!skinned)throw Error('Rig requires a SkinnedMesh');
   const box=new T.Box3().setFromObject(scene),size=box.getSize(new T.Vector3());if(!Number.isFinite(size.y)||size.y<.01)throw Error('Rig has invalid bounds');
   const wrapper=new T.Group(),scale=1.8/size.y;
   scene.scale.multiplyScalar(scale);scene.position.set(-(box.min.x+box.max.x)*.5*scale,-box.min.y*scale,-(box.min.z+box.max.z)*.5*scale);wrapper.add(scene);
   template=wrapper;animations=clips;api.clips=clips.map(c=>c.name);api.stats={meshes,skinnedMeshes:skinned,triangles,bounds:{width:size.x*scale,height:1.8,depth:size.z*scale},scale};api.status='ready';
   /* 2K textures stay sharp at grazing angles only with anisotropic filtering */
   let maxAn=1;try{maxAn=Math.min(16,get('R').capabilities.getMaxAnisotropy())}catch(_){}
   scene.traverse(node=>{if(!node.isMesh)return;const list=Array.isArray(node.material)?node.material:[node.material];for(const material of list){if(!material)continue;for(const slot of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap']){const texture=material[slot];if(texture&&texture.anisotropy<maxAn){texture.anisotropy=maxAn;texture.needsUpdate=true}}}});
   for(const name of ['pl','hp2']){const g=get(name);if(g)install(g)}
   if(document.body)document.body.classList.add('imported-hero-ready');noteEditor();if(typeof window.drawAv==='function')window.drawAv();resolve(true);
  }catch(error){api.status='failed';api.error=String(error&&error.message||error);console.warn('imported hero',error);resolve(false)}
 },undefined,error=>{api.status='failed';api.error=String(error&&error.message||error);console.warn('imported hero',error);resolve(false)});
});
})();
