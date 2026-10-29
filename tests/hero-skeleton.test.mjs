import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const three=readFileSync(new URL('../site/three.min.js',import.meta.url),'utf8');
const skin=readFileSync(new URL('../site/src/modules/hero-skeleton.js',import.meta.url),'utf8');
const animation=readFileSync(new URL('../site/src/modules/hero-anim.js',import.meta.url),'utf8');
const editor=readFileSync(new URL('../site/src/modules/character-customization.js',import.meta.url),'utf8');
function runtime(){
 let now=0;const frames=[],clickListeners=[];
 const env={console,performance:{now:()=>now},requestAnimationFrame:cb=>frames.push(cb),setTimeout(){},document:{addEventListener(name,callback){if(name==='click')clickListeners.push(callback)}},H:()=>0,menuO:0};
 env.window=env;env.self=env;vm.createContext(env);vm.runInContext(three,env);
 const T=env.THREE;env.pl=new T.Group();new T.Scene().add(env.pl);env.hp2=new T.Group();new T.Scene().add(env.hp2);env.DLOOK={};env.look=null;
 env.buildHero=g=>{if(g.userData.heroGeometries)for(const geo of g.userData.heroGeometries)geo.dispose();g.userData.heroGeometries=new Set();while(g.children.length)g.remove(g.children[0]);
  for(const [part,x,y] of [['body',0,.9],['head',0,1.55],['armUpperR',.3,1.2],['armLowerR',.3,.85],['legUpperL',-.12,.55],['legLowerL',-.12,.22]]){
   const geo=new T.BoxGeometry(.2,.25,.2),m=new T.Mesh(geo,new T.MeshStandardMaterial({color:0xabcdef}));m.position.set(x,y,0);m.userData.heroPart=part;g.add(m);g.userData.heroGeometries.add(geo)}
 };
 vm.runInContext(skin,env);vm.runInContext(animation,env);
 return {env,frames,clickListeners,tick:ms=>{now+=ms;frames.shift()?.()}};
}
test('editable hero becomes a true bound skin with playable clips',()=>{
 const {env,tick}=runtime(),T=env.THREE,g=env.pl,mesh=g.userData.heroSkin.mesh;
 assert.ok(mesh instanceof T.SkinnedMesh);assert.ok(mesh.skeleton instanceof T.Skeleton);
 assert.equal(mesh.skeleton.bones.length,10);assert.equal(mesh.geometry.getAttribute('skinIndex').count,mesh.geometry.getAttribute('position').count);
 assert.equal(mesh.geometry.getAttribute('skinWeight').getX(0),1);
 const weights=mesh.geometry.getAttribute('skinWeight'),jointVertex=Array.from({length:weights.count},(_,i)=>i).find(i=>weights.getX(i)>.05&&weights.getY(i)>.05);
 assert.ok(jointVertex>=0,'elbow/knee rings blend upper and lower bones');
 assert.ok(Math.abs(weights.getX(jointVertex)+weights.getY(jointVertex)-1)<1e-6);
 assert.deepEqual(Object.keys(env.heroAnimationClips).sort(),['hit','idle','run','swim','throw','walk']);
 env.P={x:0,z:0};tick(16);env.P.x=1;tick(100);
 assert.equal(g.userData.rig.state,'run');assert.ok(g.userData.rig.actions.run.isRunning());
 tick(120);assert.ok(Math.abs(mesh.skeleton.getBoneByName('heroLegUpperL').rotation.x)>.01);
 mesh.updateMatrixWorld(true);const deformed=new T.Vector3();mesh.boneTransform(jointVertex,deformed);assert.ok([deformed.x,deformed.y,deformed.z].every(Number.isFinite));
 const runTime=g.userData.rig.actions.run.time;env.heroAct('hit');env.P.x+=.2;tick(16);assert.equal(g.userData.rig.state,'hit');assert.equal(g.userData.rig.locomotion,'run');assert.equal(g.userData.rig.actions.hit.blendMode,T.AdditiveAnimationBlendMode);assert.ok(g.userData.rig.actions.run.time>runTime);
 assert.ok(env.heroAnimationClips.hit.tracks.every(track=>!track.name.includes('heroLeg')));
 tick(500);assert.equal(g.userData.rig.action,null);
});
test('upper-body actions fade out while locomotion keeps advancing',()=>{
 const {env,tick}=runtime(),r=env.pl.userData.rig;env.P={x:0,z:0};tick(16);env.P.x=1;tick(100);
 for(const kind of ['hit','throw']){
  const gait=r.actions.run.time;env.heroAct(kind);for(let i=0;i<15;i++){env.P.x+=.2;tick(50)}
  assert.equal(r.action,null);assert.equal(r.state,'run');assert.ok(r.actions.run.time!==gait);
  assert.ok(r.actions[kind].getEffectiveWeight()<.01,kind+' weight '+r.actions[kind].getEffectiveWeight());
 }
});
test('rebuild disposes old skin and stops its mixer',()=>{
 const {env}=runtime(),g=env.pl,old=g.userData.heroSkin.mesh,oldMixer=g.userData.rig.mixer;
 let geometryDisposed=0,materialDisposed=0,skeletonDisposed=0;const disposeSkeleton=old.skeleton.dispose.bind(old.skeleton);old.skeleton.dispose=()=>{skeletonDisposed++;disposeSkeleton()};old.geometry.addEventListener('dispose',()=>geometryDisposed++);old.material.addEventListener('dispose',()=>materialDisposed++);
 env.buildHero(g,{});
 assert.notEqual(g.userData.heroSkin.mesh,old);assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);assert.equal(skeletonDisposed,1);
 assert.equal(g.userData.heroGeometries.size,1);assert.equal(oldMixer._actions.length,0);assert.ok(g.userData.rig.actions.idle.isRunning());
});

test('real editor geometry builds every hairstyle and outfit into the skin',()=>{
 const {env}=runtime(),T=env.THREE;
 const start=editor.indexOf('buildHero=function(g,lk){'),end=editor.indexOf(';\nccShow=',start);
 assert.ok(start>=0&&end>start);
 env.SK=[0xf0c9a4,0xe0ac80,0xb7835a,0x7a5235,0xf6d9c0,0x5a3a26];env.HC=[0x3a2a1e,0x8a5a2b,0xe8c25a,0xd93b3b,0x5b6bd6,0xf4f4f4,0x7a1f3a,0x6b3f1e];env.TC=[0x5b6bd6,0xd93b3b,0x4f9a4a,0xe8803a,0x8e5a3a,0x2e3658,0x2f78d0];
 env.BRW=[0x3a2a1e,0x6b3f1e,0xc89a5a,0x7a1f3a,0x1a1a1a];env.EYC=[0x5a3a1e,0x2f6ad6,0x3a9a4a,0x8a5ad6,0x7a5a2a,0x1a1a1a];env.eq={tool:null,bag:null};env.inv={};
 env.B=(w,h,d)=>new T.BoxGeometry(w,h,d);env.Cy=(a,b,h,n=8)=>new T.CylinderGeometry(a,b,h,n);env.Co=(r,h,n=8)=>new T.ConeGeometry(r,h,n);env.S=r=>new T.SphereGeometry(r,12,9);
 env.add=(g,geo,color,x,y,z)=>{const m=new T.Mesh(geo,new T.MeshStandardMaterial({color}));m.position.set(x,y,z);g.add(m);return m};env.outl=()=>{};
 vm.runInContext(editor.slice(start,end+1),env);
 vm.runInContext(skin,env);const sourceBuild=env.buildHero,probe=new T.Group();
 for(let hr=0;hr<7;hr++)for(let top=0;top<5;top++){
  assert.doesNotThrow(()=>sourceBuild(probe,{g:hr%2,hr,top,sk:0,hc:0,tc:0,br:0,ey:0}));
  assert.ok(probe.userData.heroSkin.mesh instanceof T.SkinnedMesh);
 }
});

test('both button click and public action dispatch delegate imported heroes to their weapon hand selector',()=>{
 const {env,clickListeners}=runtime(),r=env.pl.userData.rig,received=[];
 r.imported=true;env.importedHeroAct=kind=>{received.push(kind);return true};
 for(const click of clickListeners)click({target:{closest:selector=>selector==='#hit'?{}:null}});
 env.heroAct('throw');assert.deepEqual(received,['hit','throw']);
 assert.equal(r.actions.hit.isRunning(),false,'legacy right-arm action must not run alongside delegated left slash');
});
