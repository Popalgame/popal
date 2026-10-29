import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const three=readFileSync(new URL('../site/three.min.js',import.meta.url),'utf8');
const models=readFileSync(new URL('../site/src/modules/pal-models.js',import.meta.url),'utf8');

function runtime(){
 const env={console,performance:{now:()=>0},requestAnimationFrame(){},document:{createElement(){return {getContext(){return {fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}}}}}}};
 env.window=env;vm.createContext(env);vm.runInContext(three,env);vm.runInContext(models,env);return env;
}

test('Puff has a skinned body and expressive animation clips that blend on state changes',()=>{
 const env=runtime(),model=env.PALMODEL.build(4),mesh=model.root.getObjectByName('PuffBody');
 assert.equal(mesh.isSkinnedMesh,true);assert.equal(mesh.skeleton.bones.length,2);
 assert.ok(mesh.geometry.attributes.normal.getX(12*25)>0);
 assert.equal(model.head.isBone,true);assert.deepEqual(Object.keys(model.actions),['idle','walk','attack','happy']);
 assert.ok(env.PALMODEL.tris(model.root)<10000);
 model.walkMix=1;for(let i=0;i<60;i++)env.PALMODEL.pose(model,i/60,'walk',0);
 assert.ok(model.actions.walk.getEffectiveWeight()>.9);
 env.PALMODEL.pose(model,1,'attack',0);
 assert.ok(model.actions.walk.getEffectiveWeight()>0);
 for(let i=61;i<120;i++)env.PALMODEL.pose(model,i/60,'attack',0);
 assert.ok(model.actions.attack.getEffectiveWeight()>.9);
 model.resetPoseTime();
 assert.equal(model.mixer.time,0);assert.equal(model.actions.idle.getEffectiveWeight(),1);
 env.PALMODEL.pose(model,500,'idle',0);assert.equal(model.mixer.time,0);
 env.PALMODEL.pose(model,500.02,'idle',0);assert.ok(model.mixer.time<.05);
 env.PALMODEL.dispose(model);
});

test('Puff damage flash and disposal are independent across pooled instances',()=>{
 const env=runtime(),a=env.PALMODEL.build(4),b=env.PALMODEL.build(4),material=a.root.getObjectByName('PuffBody').material;
 assert.notEqual(material,b.root.getObjectByName('PuffBody').material);
 env.PALMODEL.pose(a,0,'idle',.5);env.PALMODEL.pose(b,0,'idle',0);
 assert.ok(material.emissive.r>0);assert.equal(b.root.getObjectByName('PuffBody').material.emissive.r,0);
 let released=0,skeletonReleased=0;const body=a.root.getObjectByName('PuffBody'),skeleton=body.skeleton,originalDispose=skeleton.dispose.bind(skeleton);
 skeleton.dispose=()=>{skeletonReleased++;originalDispose()};
 const secondSkin=new env.THREE.SkinnedMesh(body.geometry,body.material);secondSkin.bind(skeleton);a.root.add(secondSkin);
 body.geometry.addEventListener('dispose',()=>released++);
 env.PALMODEL.dispose(a);assert.equal(released,1);assert.equal(skeletonReleased,1);
 env.PALMODEL.pose(b,.02,'happy',0);assert.equal(b.root.getObjectByName('PuffBody').geometry.attributes.skinWeight.itemSize,4);
 env.PALMODEL.dispose(b);
});
