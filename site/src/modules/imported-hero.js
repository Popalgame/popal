/* Optional GLB hero. The editor skin remains visible until a valid rig is ready. */
(function(){
'use strict';
const T=window.THREE,previous=window.buildHero,previousAct=window.heroAct,previousShow=window.ccShow,previousDraw=window.drawAv;
/* Hero model registry: each entry ships rig + locomotion + combat packs and the
   melee clip/hand of its signature weapon (classic slashes left, Aiko chops right). */
const MODELS={
 classic:{full:'assets/models/hero-rigged.glb',mobile:'assets/models/hero-mobile.glb',locomotion:'assets/models/hero-locomotion.glb',combat:'assets/models/hero-combat.glb',hitClip:'sword_hit',hitHand:'left'},
 aiko:{full:'assets/models/hero-aiko.glb',mobile:'assets/models/hero-aiko-mobile.glb',locomotion:'assets/models/hero-aiko-locomotion.glb',combat:'assets/models/hero-aiko-combat.glb',hitClip:'hammer_hit',hitHand:'right'}
};
let coarse=false;try{coarse=!!(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches)}catch(_){}
const get=name=>{try{return eval(name)}catch(_){return undefined}};
const MODEL_IDS=Object.keys(MODELS);
/* look.model is stored as the UI index (0/1) but older saves/tests may hold the id string */
function activeModel(){const lk=get('look'),m=lk&&lk.model;const id=MODELS[m]?m:(Number.isInteger(+m)&&MODEL_IDS[+m]?MODEL_IDS[+m]:'classic');return{id,def:MODELS[id]}}
let active=activeModel();
/* The loop below reads `active` lazily each frame, but a model switched after the
   module loaded must also refresh the per-instance melee hand; install() re-reads it. */
const api=window.importedHero={status:'loading',ready:null,error:null,clips:[],stats:null,model:active.id,url:coarse?active.def.mobile:active.def.full,walkSource:'built-in',locomotionSource:'built-in',locomotionReady:null,combatSource:'built-in',combatReady:null,models:Object.keys(MODELS)};
if(!T||!T.GLTFLoader||!T.SkeletonUtils||typeof previous!=='function'){
 api.status='unavailable';api.error='Three GLTFLoader, SkeletonUtils, or buildHero is unavailable';api.ready=Promise.resolve(false);return;
}
const instances=new Set(),normName=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^(mixamorig|hero)/,'');
let template=null,animations=null,locomotion=null,combat=null,last=performance.now();
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
 const hand=bone(model,['righthand','handr']),has=!!(hand&&/^(ax|pk|pick)/.test(tool));
 /* Aiko's hammer is baked into the model and rigid to the right hand; showing an
    equipped axe/pick at the same time would stack two tools in one fist. */
 if(active.id==='aiko'&&has)return;
 /* з інструментом у правій руці меч героя (частина моделі, у лівій руці) ховаємо */
 model.traverse(node=>{if(!node.isSkinnedMesh||!node.material)return;const m=node.material;
  if(!m.userData.noSword){const u={value:0};m.userData.noSword=u;const prev=m.onBeforeCompile;
   m.onBeforeCompile=function(sh,r){if(prev)prev.call(this,sh,r);sh.uniforms.uNoSword=u;
    sh.vertexShader='varying vec3 vSwP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSwP=position;');
    sh.fragmentShader='varying vec3 vSwP;uniform float uNoSword;\n'+sh.fragmentShader.replace('void main() {','void main() {\n if(uNoSword>.5&&vSwP.x>.545&&vSwP.y>.86)discard;')};
   m.needsUpdate=true}
  m.userData.noSword.value=has?1:0});
 if(has){
  const metal=/^(axm|pkm)$/.test(tool)?0xc7d3dc:/^(axe|pick)$/.test(tool)?0x858d96:0xa8753d;
  const grip=new T.Group();grip.name='equippedTool';hand.add(grip);
  /* руків'я проходить крізь кулак (поперек пальців), а не вздовж них: напрям рахуємо в позі привʼязки (T-поза),
     де «вперед» — +z, а «вгору» для опущеної руки — +x; отже руків'я дивиться вперед і вгору під ~45° */
  let dir=new T.Vector3(0,0,1);
  model.traverse(node=>{if(!node.isSkinnedMesh||!node.skeleton)return;const i=node.skeleton.bones.indexOf(hand);if(i<0)return;
   const bw=new T.Matrix4().copy(node.skeleton.boneInverses[i]).invert(),q=new T.Quaternion();bw.decompose(new T.Vector3(),q,new T.Vector3());
   dir=new T.Vector3(.62,.12,.78).normalize().applyQuaternion(q.invert())});
  grip.position.set(0,.075,0);/* центр кулака — трохи далі від зап'ястя */
  grip.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());
  accessory(grip,new T.CylinderGeometry(.022,.026,.56,8),new T.MeshStandardMaterial({color:0x79512f}),0,.16,0,0,0);
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
 g.userData.rig={skeletal:true,imported:true,mixer,actions,state:'idle',locomotion:'idle',action:null,actionUntil:0,speed:0,run:0,lastX:null,lastZ:null,meleeHand:active.def.hitHand};
 if(locomotion)installLocomotion(g.userData.rig);
 if(combat)installCombat(g.userData.rig);
 instances.add(g);return true;
}
window.buildHero=function(g,lk){if(!template||!g||g!==get('pl')&&g!==get('hp2'))return previous.call(this,g,lk);install(g);return g};
function noteEditor(){
 if(!document.getElementById)return;const panel=document.getElementById('ccp');
 if(!panel||!panel.querySelector('#ccn')||panel.querySelector('.imported-hero-note'))return;
 const note=document.createElement('p');note.className='imported-hero-note';note.textContent='Модель 3D-героя вибирається вище. Ім’я можна змінити.';
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
function installCombat(r){
 const hitName=active.def.hitClip,hitClip=(combat&&combat[hitName])||combat.sword_hit;
 if(r.action&&!r.playingAction)r.playingAction=r.actions[r.action];
 r.toolHit=r.actions.hit;r.meleeHand=active.def.hitHand;
 function overlay(clip){const action=r.mixer.clipAction(upperClip(clip));action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;if(T.AdditiveAnimationBlendMode!==undefined)action.blendMode=T.AdditiveAnimationBlendMode;return action}
 r.swordHit=overlay(hitClip);r.throwRight=overlay(combat.throw_right);
 r.actions.hit=r.swordHit;r.actions.throw=r.throwRight;
}
function swordTarget(){
 const P=get('P');if(!P)return true;
 const near=(name,range)=>(get(name)||[]).some(o=>Math.hypot(o.x-P.x,o.z-P.z)<range);
 /* Keep the same target priority as core-world: creatures before harvestables. */
 if(near('wild',2.6))return true;
 return !(near('bushes',2.2)||near('shrooms',2)||near('trees',2.4)||near('rocks',2.4));
}
function importedAct(kind){
 const pl=get('pl'),r=pl&&pl.userData.rig;
 if(!r||!r.imported||(kind!=='hit'&&kind!=='throw'))return false;
 const action=kind==='hit'?(r.swordHit&&swordTarget()?r.swordHit:r.toolHit||r.actions.hit):r.throwRight||r.actions.throw;
 const old=r.playingAction||r.action&&r.actions[r.action];if(old&&old!==action)old.fadeOut(.08);
 r.actions[kind]=action;action.reset().setEffectiveWeight(1).fadeIn(.06).play();
 r.action=kind;r.playingAction=action;r.actionUntil=performance.now()/1000+action.getClip().duration;r.actionObservedUntil=r.actionUntil;
 r.attackHand=kind==='hit'&&action===r.swordHit?r.meleeHand:((kind==='throw'&&r.throwRight)||action===r.toolHit)?'right':null;r.state=kind;return true;
}
/* The click listener in hero-anim owns a lexical act(). Route that path as well
   as keyboard/global callers through the imported character's action selector. */
window.importedHeroAct=importedAct;
function syncAction(r,now){
 if(!r.action){r.actionObservedUntil=null;return}
 if(r.actionUntil!==r.actionObservedUntil){r.playingAction=r.actions[r.action];r.actionUntil=now+r.playingAction.getClip().duration;r.actionObservedUntil=r.actionUntil}
}
window.heroAct=function(kind){if(!importedAct(kind))previousAct(kind)};
/* gait clips share the same phase convention (t=0 = left foot contact), so walk<->run
   transitions keep the same normalized phase instead of snapping back to frame 0 */
const gait=k=>k==='walk'||k==='run',clipDur=a=>a.getClip().duration;
function choose(r,next,fade){if(next===r.locomotion)return;const from=r.actions[r.locomotion],to=r.actions[next];to.reset();if(gait(next)&&gait(r.locomotion)){const d=clipDur(from);to.time=(from.time%d)/d*clipDur(to)}to.play();to.crossFadeFrom(from,fade,false);r.locomotion=next}
/* In-place clips keep the existing collision/controller movement. Their shared
   phase advances by travelled distance, so a blocked character cannot run in place. */
function installLocomotion(r){
 const old=r.actions[r.locomotion],phase=old&&gait(r.locomotion)?old.time/clipDur(old):0;
 for(const key of ['walk','run'])r.actions[key].stop();
 for(const key of ['walk','jog','run']){
  const action=r.mixer.clipAction(locomotion.clips[key]);
  action.setLoop(T.LoopRepeat,Infinity).setEffectiveWeight(0).play();action.paused=true;r.actions[key]=action;
 }
 r.actions.idle.stopFading().setEffectiveWeight(1).play();
 r.distanceGait={phase:phase%1,mix:0,swim:0};
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
function updateLocomotion(r,state,distance,dt){
 const d=r.distanceGait,profiles=locomotion.profiles;
 const jogging=smooth(profiles.walk.speed*1.25,profiles.jog.speed*.85,r.speed);
 const running=smooth(profiles.jog.speed*1.1,profiles.run.speed*.95,r.speed);
 const weights={walk:1-jogging,jog:jogging*(1-running),run:jogging*running};
 d.mix=damp(d.mix,state!=='idle'&&state!=='swim'?1:0,18,dt);
 d.swim=damp(d.swim,state==='swim'?1:0,12,dt);
 let stride=0;for(const key of ['walk','jog','run'])stride+=weights[key]*profiles[key].speed*clipDur(r.actions[key]);
 if(distance>0&&state!=='idle'&&state!=='swim')d.phase=(d.phase+distance/stride)%1;
 for(const key of ['walk','jog','run']){
  const a=r.actions[key],weight=weights[key]*d.mix*(1-d.swim);
  a.enabled=weight>.00001;a.time=d.phase*clipDur(a);a.setEffectiveWeight(weight);
 }
 r.actions.idle.enabled=true;r.actions.idle.stopFading().setEffectiveWeight((1-d.mix)*(1-d.swim)).play();
 r.actions.swim.enabled=true;r.actions.swim.stopFading().setEffectiveWeight(d.swim).play();
 r.gaitWeights=weights;r.gaitPhase=d.phase;
 r.locomotion=state==='idle'||state==='swim'?state:weights.run>.5?'run':weights.jog>.5?'jog':'walk';
 r.state=r.action||r.locomotion;
}
const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
(function loop(){requestAnimationFrame(loop);const now=performance.now(),elapsed=Math.max(0,(now-last)/1000),dt=Math.min(.05,elapsed);last=now;
 const pl=get('pl'),P=get('P'),H=window.H;
 for(const g of instances){const r=g.userData.rig;if(!r||!r.imported){instances.delete(g);continue}if(!g.parent)continue;
  let state='idle',distance=0;if(g===pl&&P){
   const blocked=get('menuO')||get('ivO')||get('pfO')||get('ccO');
   const travelled=r.lastX==null?0:Math.hypot(P.x-r.lastX,P.z-r.lastZ);
   const velocity=elapsed<=0||elapsed>.25?0:travelled/elapsed;
   if(!blocked&&elapsed>0&&elapsed<=.25&&velocity<20)distance=travelled;
   r.lastX=P.x;r.lastZ=P.z;
   if(blocked||elapsed>.25||velocity>=20){r.speed=0;r.run=0}
   else{r.speed=damp(r.speed,Math.min(15,velocity),8,dt);r.run=r.speed>(r.locomotion==='run'?6:6.5)?1:0}
   state=blocked?'idle':H&&H(P.x,P.z)<-1.15?'swim':r.run?'run':r.speed>.24?'walk':'idle';
  }
  syncAction(r,now/1000);
  /* Authored strikes finish by played clip time, so a fullscreen/frame pause
     cannot discard the left-hand swing before the player sees it. */
  if(r.action){const a=r.playingAction||r.actions[r.action],done=(a===r.swordHit||a===r.throwRight)?a.time>=clipDur(a):now/1000>=r.actionUntil;if(done){a.fadeOut(.1);r.action=null;r.playingAction=null}}
  if(r.distanceGait){updateLocomotion(r,state,distance,dt);r.mixer.update(dt);continue}
  choose(r,state,state==='swim'?.26:.17);r.state=r.action||r.locomotion;
  /* Original GLB walk and playback, before the rejected alternative gait. */
  r.actions.walk.timeScale=Math.max(.7,Math.min(2,r.speed/5*1.7));
  r.actions.run.timeScale=Math.max(.85,Math.min(1.6,r.speed/8*1.35));r.mixer.update(dt);
 }
})();
function loadLocomotion(){
 api.locomotionReady=new Promise(resolve=>{
  try{new T.GLTFLoader().load(active.def.locomotion,gltf=>{
   try{
    const metadata=gltf.scene&&gltf.scene.userData&&gltf.scene.userData.locomotion;
    if(!metadata||metadata.version!==1||!metadata.profiles)throw Error('Missing locomotion stride metadata');
    const clips={},expected=animations.find(c=>c.name.toLowerCase()==='walk');
    if(!expected||!gltf.animations||gltf.animations.length!==3)throw Error('Locomotion requires exactly three clips');
    for(const key of ['walk','jog','run']){
     const clip=gltf.animations.find(c=>c.name===key),profile=metadata.profiles[key];
     if(!profile||!Number.isFinite(profile.speed)||profile.speed<=0||!clip||!Number.isFinite(clip.duration)||clip.duration<=0)throw Error('Invalid locomotion profile');
     const tracks=new Map(expected.tracks.map(t=>[t.name,t.ValueTypeName]));
     if(clip.tracks.length!==tracks.size)throw Error('Incomplete locomotion tracks');
     for(const track of clip.tracks){if(tracks.get(track.name)!==track.ValueTypeName||!track.validate())throw Error('Locomotion track does not match hero rig');tracks.delete(track.name)}
     if(tracks.size)throw Error('Missing locomotion bone');clips[key]=clip;
    }
    if(!(metadata.profiles.walk.speed<metadata.profiles.jog.speed&&metadata.profiles.jog.speed<metadata.profiles.run.speed))throw Error('Locomotion speeds must increase');
    locomotion={clips,profiles:metadata.profiles};api.walkSource=active.def.locomotion;api.locomotionSource=active.def.locomotion;
    for(const g of instances)installLocomotion(g.userData.rig);resolve(true);
   }catch(error){console.warn('hero locomotion',error);resolve(false)}
  },undefined,error=>{console.warn('hero locomotion',error);resolve(false)})}catch(error){console.warn('hero locomotion',error);resolve(false)}
 });
}
function loadCombat(){
 api.combatReady=new Promise(resolve=>{
  try{new T.GLTFLoader().load(active.def.combat,gltf=>{
   try{
    const clips={},expected=animations.find(c=>c.name.toLowerCase()==='idle');
    const names=[active.def.hitClip,'throw_right'];
    if(!expected||!gltf.animations||gltf.animations.length!==2)throw Error('Combat requires '+names.join(' and '));
    for(const key of names){
     const clip=gltf.animations.find(c=>c.name===key),tracks=new Map(expected.tracks.map(t=>[t.name,t.ValueTypeName]));
     if(!clip||!Number.isFinite(clip.duration)||clip.duration<=0||clip.tracks.length!==tracks.size)throw Error('Invalid combat clip');
     for(const track of clip.tracks){if(tracks.get(track.name)!==track.ValueTypeName||!track.validate())throw Error('Combat track does not match hero rig');tracks.delete(track.name)}
     if(tracks.size)throw Error('Missing combat bone');clips[key]=clip;
    }
    combat=clips;api.combatSource=active.def.combat;for(const g of instances)installCombat(g.userData.rig);resolve(true);
   }catch(error){console.warn('hero combat',error);resolve(false)}
  },undefined,error=>{console.warn('hero combat',error);resolve(false)})}catch(error){console.warn('hero combat',error);resolve(false)}
 });
}
api.ready=new Promise(resolve=>{
 const urls=coarse?[active.def.mobile,active.def.full]:[active.def.full],loader=new T.GLTFLoader();
 function fail(error,index){
  if(index+1<urls.length){load(index+1);return}
  api.status='failed';api.error=String(error&&error.message||error);console.warn('imported hero',error);resolve(false);
 }
 function load(index){
  const url=urls[index];api.url=url;
  try{loader.load(url,gltf=>{
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
   if(document.body)document.body.classList.add('imported-hero-ready');noteEditor();if(typeof window.drawAv==='function')window.drawAv();resolve(true);loadLocomotion();loadCombat();
  }catch(error){fail(error,index)}
  },undefined,error=>fail(error,index))}catch(error){fail(error,index)}
 }
 load(0);
});
/* Switch the 3D hero model (e.g. from the customization panel). Loads the chosen
   packs, then rebuilds every live instance; falls back to classic on any failure. */
api.setModel=function(id){
 if(!MODELS[id]||id===active.id)return Promise.resolve(api.status==='ready');
 const model={id,def:MODELS[id]};
 const urls=coarse?[model.def.mobile,model.def.full]:[model.def.full];
 return new Promise(resolve=>{
  const loader=new T.GLTFLoader();
  function fail(error,index){
   if(index+1<urls.length){load(index+1);return}
   console.warn('hero model',id,error);resolve(false);
  }
  function load(index){
   const url=urls[index];
   try{loader.load(url,gltf=>{
    try{
     const scene=gltf.scene||gltf.scenes&&gltf.scenes[0],clips=gltf.animations||[];
     if(!scene||['idle','walk','run','swim','hit','throw'].some(name=>!clips.some(c=>c.name.toLowerCase()===name)))throw Error('Rig requires idle, walk, run, swim, hit, and throw clips');
     let skinned=0;scene.traverse(node=>{if(node.isSkinnedMesh)skinned++});if(!skinned)throw Error('Rig requires a SkinnedMesh');
     const box=new T.Box3().setFromObject(scene),size=box.getSize(new T.Vector3());if(!Number.isFinite(size.y)||size.y<.01)throw Error('Rig has invalid bounds');
     const wrapper=new T.Group(),scale=1.8/size.y;
     scene.scale.multiplyScalar(scale);scene.position.set(-(box.min.x+box.max.x)*.5*scale,-box.min.y*scale,-(box.min.z+box.max.z)*.5*scale);wrapper.add(scene);
     active=model;template=wrapper;animations=clips;locomotion=null;combat=null;
     api.model=id;api.url=url;api.status='loading';api.clips=clips.map(c=>c.name);
     /* install() deletes and re-adds each g in `instances`; iterating the live set
        directly would re-visit every re-added member forever, so walk a snapshot */
     for(const g of [...instances])install(g);
     document.body.classList.add('imported-hero-ready');
     loadLocomotion();loadCombat();
     api.status='ready';resolve(true);
    }catch(error){fail(error,index)}
   },undefined,error=>fail(error,index))}catch(error){fail(error,index)}
  }
  load(0);
 });
};
})();
