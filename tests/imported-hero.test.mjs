import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const three=readFileSync(new URL('../site/three.min.js',import.meta.url),'utf8');
const skeletonUtils=readFileSync(new URL('../site/vendor/SkeletonUtils.js',import.meta.url),'utf8');
const imported=readFileSync(new URL('../site/src/modules/imported-hero.js',import.meta.url),'utf8');
function glbJson(path){const data=readFileSync(new URL(path,import.meta.url));return JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString())}
function setup({coarse=false,matchMedia=true}={}){
 let now=0,editorOpen=false,avatarCanvas=null,oldAvatarDraws=0;const frames=[],notes=[],bodyClasses=new Set(),requests=[];
 const panel={querySelector:selector=>selector==='#ccn'?editorOpen?{}:null:selector==='.imported-hero-note'?notes[0]||null:selector==='#cca'?{}:null,insertBefore:note=>notes.push(note)};
 const document={addEventListener(){},getElementById:id=>id==='ccp'?panel:id==='avc'?avatarCanvas:null,createElement:()=>({}),body:{classList:{add:name=>bodyClasses.add(name)}}};
 const env={console:{...console,warn(){}},performance:{now:()=>now},requestAnimationFrame:callback=>frames.push(callback),setTimeout,document,H:()=>0,menuO:0,P:{x:0,z:0},eq:{tool:null,bag:null},inv:{}};
 if(matchMedia)env.matchMedia=query=>{assert.equal(query,'(pointer: coarse)');return {matches:coarse}};
 env.ccShow=()=>{editorOpen=true;notes.length=0};env.drawAv=()=>oldAvatarDraws++;
 env.window=env;env.self=env;vm.createContext(env);vm.runInContext(three,env);vm.runInContext(skeletonUtils,env);
 const T=env.THREE;T.GLTFLoader=class{load(url,onLoad,progress,onError){requests.push({url,onLoad,onError})}};
 env.pl=new T.Group();env.hp2=new T.Group();new T.Scene().add(env.pl,env.hp2);
 env.buildHero=g=>{while(g.children.length)g.remove(g.children[0]);g.add(new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial()));g.userData.heroSkin=null;g.userData.rig={skeletal:true}};
 env.heroAct=kind=>{const r=env.pl.userData.rig;if(!r||!r.actions)return;r.actions[kind].reset().play();r.action=kind;r.actionUntil=now/1000+.42};
 env.buildHero(env.pl);env.buildHero(env.hp2);const legacyAct=env.heroAct;
 vm.runInContext(imported,env);
 function asset(names=['idle','walk','run','swim','hit','throw']){
  const hips=new T.Bone();hips.name='Hips';const spine=new T.Bone();spine.name='mixamorigSpine';hips.add(spine);const hand=new T.Bone();hand.name='mixamorigRightHand';spine.add(hand);
  const geo=new T.BoxGeometry(.5,1,.3);const count=geo.getAttribute('position').count;geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(Array.from({length:count*4},(_,i)=>i%4?0:0),4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:count*4},(_,i)=>i%4?0:1),4));
  const skin=new T.SkinnedMesh(geo,new T.MeshStandardMaterial({skinning:true}));skin.add(hips);skin.bind(new T.Skeleton([hips,spine,hand]));const scene=new T.Group();scene.add(skin);
  return {scene,animations:names.map(name=>new T.AnimationClip(name,name==='hit'?1:.8,[new T.NumberKeyframeTrack('Hips.rotation[x]',[0,.4,.8],[0,.2,0]),new T.NumberKeyframeTrack('mixamorigSpine.rotation[x]',[0,.4,.8],[0,.1,0])]))};
 }
 return {env,asset,legacyAct,notes,bodyClasses,requests,setAvatarCanvas:canvas=>{avatarCanvas=canvas},oldAvatarDraws:()=>oldAvatarDraws,resolve:value=>requests.at(-1).onLoad(value),reject:error=>requests.at(-1).onError(error),tick:ms=>{now+=ms;for(let i=0,n=frames.length;i<n;i++)frames.shift()()},loads:()=>requests.length};
}
test('GLB loads once and replaces both visible fallback heroes with independent rigs',async()=>{
 const rt=setup(),{env}=rt,T=env.THREE;assert.equal(env.importedHero.status,'loading');assert.equal(env.pl.children.length,1);assert.equal(rt.loads(),1);
 assert.deepEqual(rt.requests.map(r=>r.url),['assets/models/hero-rigged.glb']);
 rt.resolve(rt.asset());assert.equal(await env.importedHero.ready,true);assert.equal(env.importedHero.status,'ready');assert.ok(rt.bodyClasses.has('imported-hero-ready'));env.ccShow();assert.equal(rt.notes.length,1);assert.match(rt.notes[0].textContent,/Ім’я можна змінити/);assert.equal(env.importedHero.stats.skinnedMeshes,1);assert.ok(env.importedHero.stats.triangles>0);assert.equal(env.importedHero.stats.bounds.height,1.8);
 assert.ok(env.pl.userData.importedHero);assert.ok(env.hp2.userData.importedHero);
 const a=env.pl.userData.importedHero.model,b=env.hp2.userData.importedHero.model;
 assert.notEqual(a,b);let skinA,skinB;a.traverse(n=>{if(n.isSkinnedMesh)skinA=n});b.traverse(n=>{if(n.isSkinnedMesh)skinB=n});
 assert.notEqual(skinA.skeleton,skinB.skeleton);assert.notEqual(skinA.skeleton.bones[0],skinB.skeleton.bones[0]);
 assert.equal(new T.Box3().setFromObject(a).getSize(new T.Vector3()).y,1.8);
 let skeletonDisposals=0,geometryDisposals=0,materialDisposals=0;skinA.skeleton.dispose=()=>skeletonDisposals++;skinA.geometry.addEventListener('dispose',()=>geometryDisposals++);skinA.material.addEventListener('dispose',()=>materialDisposals++);
 const second=new T.SkinnedMesh(skinA.geometry,skinA.material);second.skeleton=skinA.skeleton;a.add(second);
 const oldMixer=env.pl.userData.rig.mixer;env.eq.tool='axe';env.eq.bag='bp1';env.inv.bp1=1;env.buildHero(env.pl,{});assert.equal(rt.loads(),2);assert.equal(oldMixer._actions.length,0);assert.equal(skeletonDisposals,1);assert.equal(geometryDisposals,0);assert.equal(materialDisposals,0);assert.notEqual(env.pl.userData.importedHero.model,a);
 const equipped=[];env.pl.userData.importedHero.model.traverse(n=>{if(n.name==='equippedTool'||n.name==='equippedBag')equipped.push(n.name)});assert.deepEqual(equipped.sort(),['equippedTool']);for(let i=0;i<3;i++)env.buildHero(env.pl,{});assert.equal(rt.loads(),2);
});
test('coarse pointer loads mobile rig once and gives each hero an independent skeleton',async()=>{
 const rt=setup({coarse:true}),{env}=rt;assert.equal(env.importedHero.url,'assets/models/hero-mobile.glb');
 assert.deepEqual(rt.requests.map(r=>r.url),['assets/models/hero-mobile.glb']);
 rt.resolve(rt.asset());assert.equal(await env.importedHero.ready,true);assert.equal(env.importedHero.status,'ready');assert.equal(env.importedHero.error,null);
 const a=env.pl.userData.importedHero.model,b=env.hp2.userData.importedHero.model;
 assert.notEqual(a,b);let skinA,skinB;a.traverse(n=>{if(n.isSkinnedMesh)skinA=n});b.traverse(n=>{if(n.isSkinnedMesh)skinB=n});
 assert.notEqual(skinA.skeleton,skinB.skeleton);assert.notEqual(skinA.skeleton.bones[0],skinB.skeleton.bones[0]);
 env.buildHero(env.pl,{});assert.equal(rt.loads(),2);
});
test('missing matchMedia selects the full rig',async()=>{
 const rt=setup({matchMedia:false}),{env}=rt;assert.equal(env.importedHero.url,'assets/models/hero-rigged.glb');
 rt.resolve(rt.asset());assert.equal(await env.importedHero.ready,true);assert.equal(rt.loads(),2);
});
test('mobile network and validation failures retry full rig before procedural fallback',async()=>{
 for(const invalid of [false,true]){
  const rt=setup({coarse:true}),{env}=rt;
  if(invalid)rt.resolve(rt.asset(['idle','walk']));else rt.reject(new Error('offline'));
  assert.deepEqual(rt.requests.map(r=>r.url),['assets/models/hero-mobile.glb','assets/models/hero-rigged.glb']);
  assert.equal(env.importedHero.status,'loading');assert.equal(env.pl.children.length,1);
  rt.resolve(rt.asset());assert.equal(await env.importedHero.ready,true);assert.equal(env.importedHero.status,'ready');assert.equal(env.importedHero.error,null);
  assert.equal(env.importedHero.url,'assets/models/hero-rigged.glb');assert.ok(env.pl.userData.importedHero);assert.ok(env.hp2.userData.importedHero);
  env.buildHero(env.pl,{});assert.equal(rt.loads(),3);
 }
 const rt=setup({coarse:true}),{env}=rt;rt.resolve(rt.asset(['idle']));rt.reject(new Error('offline'));
 assert.equal(await env.importedHero.ready,false);assert.equal(env.importedHero.status,'failed');assert.match(env.importedHero.error,/offline/);
 assert.equal(env.pl.children.length,1);assert.equal(env.hp2.children.length,1);assert.equal(rt.loads(),2);
 env.buildHero(env.pl,{});assert.equal(rt.loads(),2);
});
test('optional walk replaces only walk on both independent rigs and preserves gait phase',async()=>{
 const rt=setup(),{env}=rt;rt.resolve(rt.asset());assert.equal(await env.importedHero.ready,true);
 assert.deepEqual(rt.requests.map(r=>r.url),['assets/models/hero-rigged.glb','assets/models/hero-walk-clip.glb']);
 const player=env.pl.userData.rig,preview=env.hp2.userData.rig,baseWalk=player.actions.walk.getClip(),baseRun=player.actions.run.getClip();
 rt.tick(16);for(let i=0;i<20;i++){env.P.x+=.125;rt.tick(50)}
 const phase=player.actions.walk.time/player.actions.walk.getClip().duration;
 const walk=rt.asset(['walk']).animations[0];rt.resolve({animations:[walk]});
 assert.equal(env.importedHero.walkSource,'assets/models/hero-walk-clip.glb');
 assert.equal(player.actions.walk.getClip(),walk);assert.equal(preview.actions.walk.getClip(),walk);
 assert.notEqual(player.actions.walk,preview.actions.walk);assert.equal(player.actions.run.getClip(),baseRun);
 assert.ok(Math.abs(player.actions.walk.time/walk.duration-phase)<.001);
 assert.ok(player.actions.walk.isRunning());assert.equal(player.actions.idle.getClip().name,'idle');
 for(let i=0;i<10;i++){env.P.x+=.125;rt.tick(50)}
 assert.ok(player.actions.walk.timeScale>1.9&&player.actions.walk.timeScale<2.05);
 env.buildHero(env.pl,{});assert.equal(env.pl.userData.rig.actions.walk.getClip(),walk);
 assert.notEqual(baseWalk,walk);
});
test('missing or invalid optional walk keeps both imported heroes and built-in animations',async()=>{
 for(const failure of ['network','missing','tracks','bone']){
  const rt=setup(),{env}=rt;rt.resolve(rt.asset());assert.equal(await env.importedHero.ready,true);
  const player=env.pl.userData.rig,preview=env.hp2.userData.rig,baseWalk=player.actions.walk.getClip();
  if(failure==='network')rt.reject(new Error('offline'));
  else if(failure==='missing')rt.resolve({animations:[]});
  else{
   const clip=rt.asset(['walk']).animations[0];
   if(failure==='tracks')clip.tracks.pop();
   else clip.tracks[0].name='OtherHips.rotation[x]';
   rt.resolve({animations:[clip]});
  }
  assert.equal(env.importedHero.status,'ready');assert.equal(env.importedHero.walkSource,'built-in');
  assert.equal(player.actions.walk.getClip(),baseWalk);assert.equal(preview.actions.walk.getClip(),baseWalk);
  assert.equal(player.actions.run.getClip().name,'run');assert.ok(env.pl.userData.importedHero);
 }
});
test('mobile rig fallback also accepts the separate walk clip',async()=>{
 const rt=setup({coarse:true}),{env}=rt;rt.reject(new Error('mobile unavailable'));
 rt.resolve(rt.asset());assert.equal(await env.importedHero.ready,true);
 assert.deepEqual(rt.requests.map(r=>r.url),['assets/models/hero-mobile.glb','assets/models/hero-rigged.glb','assets/models/hero-walk-clip.glb']);
 const walk=rt.asset(['walk']).animations[0];rt.resolve({animations:[walk]});
 assert.equal(env.pl.userData.rig.actions.walk.getClip(),walk);
 assert.equal(env.hp2.userData.rig.actions.walk.getClip(),walk);
 assert.equal(env.importedHero.url,'assets/models/hero-rigged.glb');
});
test('shipped walk GLB matches the walk channels in both shipped hero rigs',()=>{
 const clip=glbJson('../site/assets/models/hero-walk-clip.glb');
 assert.equal(clip.meshes,undefined);assert.deepEqual(clip.animations.map(a=>a.name),['walk']);
 const channels=asset=>asset.animations.find(a=>a.name==='walk').channels.map(c=>`${asset.nodes[c.target.node].name}.${c.target.path}`).sort();
 for(const path of ['../site/assets/models/hero-rigged.glb','../site/assets/models/hero-mobile.glb']){
  assert.deepEqual(channels(clip),channels(glbJson(path)));
 }
});
test('movement and actions use imported clips while menu stops locomotion',async()=>{
 const rt=setup(),{env}=rt;rt.resolve(rt.asset());await env.importedHero.ready;
 rt.tick(16);for(let i=0;i<20;i++){env.P.x+=.125;rt.tick(50)}const r=env.pl.userData.rig;
 assert.equal(r.state,'walk');assert.ok(r.actions.walk.isRunning());assert.equal(r.actions.idle.isRunning(),false);
 assert.ok(r.actions.walk.timeScale>.8&&r.actions.walk.timeScale<.9);
 for(let i=0;i<20;i++){env.P.x+=.4;rt.tick(50)}assert.equal(r.state,'run');assert.ok(r.actions.run.isRunning());
 assert.ok(r.actions.run.timeScale>1.3&&r.actions.run.timeScale<1.4);
 for(let i=0;i<20;i++){env.P.x+=.125;rt.tick(50)}assert.equal(r.locomotion,'walk','releasing Shift returns to walking');
 for(let i=0;i<20;i++){env.P.x+=.4;rt.tick(50)}assert.equal(r.locomotion,'run');
 rt.legacyAct('hit');rt.tick(16);assert.equal(r.state,'hit');assert.equal(r.locomotion,'run');assert.ok(r.actionUntil>.9,'lexical click uses imported clip duration');
 rt.tick(600);rt.legacyAct('hit');rt.tick(16);assert.ok(r.actionUntil>1.5,'repeated click extends imported clip duration');
 rt.tick(500);assert.equal(r.action,'hit');rt.tick(600);assert.equal(r.action,null);
 env.heroAct('hit');assert.ok(r.actionUntil>2.6,'public dispatcher also uses imported clip duration');rt.tick(1200);assert.equal(r.action,null);
 env.menuO=1;for(let i=0;i<30;i++)rt.tick(50);assert.equal(r.locomotion,'idle');
});
test('partial analog movement walks, swimming overrides gait, and open menus idle immediately',async()=>{
 const rt=setup(),{env}=rt;rt.resolve(rt.asset());await env.importedHero.ready;
 rt.tick(16);for(let i=0;i<20;i++){env.P.z+=.125;rt.tick(50)}const r=env.pl.userData.rig;
 assert.equal(r.locomotion,'walk');assert.ok(r.actions.walk.timeScale>=.7);
 env.H=()=>-2;rt.tick(50);assert.equal(r.locomotion,'swim');
 env.menuO=1;rt.tick(50);assert.equal(r.locomotion,'idle');assert.equal(r.speed,0);
 env.menuO=0;env.H=()=>0;rt.tick(50);assert.equal(r.locomotion,'idle');
 for(let i=0;i<20;i++){env.P.z+=.4;rt.tick(50)}assert.equal(r.locomotion,'run');
 env.ivO=1;rt.tick(50);assert.equal(r.locomotion,'idle');
});
test('real frame time and pause gaps cannot turn normal movement into a run',async()=>{
 const rt=setup(),{env}=rt;rt.resolve(rt.asset());await env.importedHero.ready;
 rt.tick(16);const r=env.pl.userData.rig;
 for(let i=0;i<10;i++){env.P.x+=.25;rt.tick(100)}
 assert.equal(r.locomotion,'walk');assert.ok(r.speed<2.6,'velocity uses the full 100 ms, not the mixer cap');
 env.P.x+=.25;rt.tick(1000);assert.equal(r.locomotion,'idle');assert.equal(r.speed,0);
 env.P.x+=.25;rt.tick(50);assert.equal(r.locomotion,'walk');
});
test('HUD avatar captures imported preview and restores preview camera and rotation',async()=>{
 const rt=setup(),{env}=rt,T=env.THREE,images=[];
 env.sc2=new T.Scene();env.sc2.add(env.hp2);env.cam2=new T.PerspectiveCamera(35,.8,.1,20);env.cam2.position.set(0,1.4,4.2);env.cam2.lookAt(0,1.05,0);env.hp2.rotation.y=.7;
 const source={width:200,height:250};let renders=0;env.R2={domElement:source,render:()=>renders++};
 rt.setAvatarCanvas({getContext:()=>({fillRect(){},drawImage:(...args)=>images.push(args)})});
 const position=env.cam2.position.clone(),quaternion=env.cam2.quaternion.clone(),rotation=env.hp2.rotation.clone(),zoom=env.cam2.zoom;
 rt.resolve(rt.asset());await env.importedHero.ready;
 assert.equal(rt.oldAvatarDraws(),1);assert.equal(images.length,1);assert.equal(images[0][0],source);assert.equal(renders,2);
 assert.ok(env.cam2.position.equals(position));assert.ok(env.cam2.quaternion.equals(quaternion));assert.ok(env.hp2.rotation.equals(rotation));assert.equal(env.cam2.zoom,zoom);
 env.drawAv();assert.equal(images.length,2);
});
test('invalid or failed GLB keeps procedural fallback visible',async()=>{
 for(const invalid of [true,false]){const rt=setup(),{env}=rt;if(invalid)rt.resolve(rt.asset(['idle','walk']));else rt.reject(new Error('offline'));
  assert.equal(await env.importedHero.ready,false);assert.equal(env.importedHero.status,'failed');assert.equal(rt.bodyClasses.has('imported-hero-ready'),false);assert.equal(env.pl.children.length,1);assert.equal(env.hp2.children.length,1);
  env.buildHero(env.pl,{});assert.equal(rt.loads(),1);assert.equal(env.pl.children.length,1);
 }
});
