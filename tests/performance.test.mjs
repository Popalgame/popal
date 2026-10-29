import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const threeSource=readFileSync(new URL('../site/three.min.js',import.meta.url),'utf8');
const perfSource=readFileSync(new URL('../site/src/modules/perf.js',import.meta.url),'utf8');
function runtime(){
 const saved=new Map(),settings=[],effects=[];
 const env={console,performance:{now:()=>0},setTimeout(){},setInterval(){},requestAnimationFrame(){},matchMedia:()=>({matches:false}),devicePixelRatio:2,
  localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},pfTab(){},document:{hidden:false},
  plGfx:{set:v=>settings.push(v)},plVis:{setHQ:v=>effects.push(v)}};
 env.window=env;env.self=env;vm.createContext(env);vm.runInContext(threeSource,env);
 env.sc=new env.THREE.Scene();env.R={ratio:1,getPixelRatio(){return this.ratio},setPixelRatio(v){this.ratio=v}};env.rs=()=>{};
 env.gm={instanceMatrix:{count:20000},count:20000};vm.runInContext(perfSource,env);
 return {env,saved,settings,effects};
}
test('quality presets respect resolution and vegetation budgets and persist the choice',()=>{
 const {env,saved,settings,effects}=runtime();env.plQuality.set('battery');
 assert.equal(env.R.ratio,1);assert.equal(env.gm.count,6500);assert.equal(settings.at(-1).fps,30);assert.equal(effects.at(-1),0);
 env.plQuality.set('high');assert.equal(env.R.ratio,1.75);assert.equal(env.gm.count,20000);assert.equal(settings.at(-1).fps,60);assert.equal(effects.at(-1),true);
 assert.equal(JSON.parse(saved.get('zi_quality')).mode,'high');env.plQuality.set('invalid');assert.equal(env.plQuality.state().mode,'high');
});
test('batching preserves geometry transforms and animated parts without disposing shared geometry',()=>{
 const {env}=runtime(),T=env.THREE,root=new T.Group(),mat=new T.MeshStandardMaterial(),geo=new T.BoxGeometry(1,1,1);
 geo.userData.sharedPalGeometry=1;let disposed=0;geo.addEventListener('dispose',()=>disposed++);
 const a=new T.Mesh(geo,mat),b=new T.Mesh(geo,mat),ear=new T.Mesh(geo,mat);a.position.x=-2;b.position.x=2;b.scale.y=2;root.add(a,b,ear);
 env.plBatchModel(root,new Set([ear]));assert.equal(root.children.length,2);assert.equal(ear.parent,root);assert.equal(disposed,0);
 const merged=root.children.find(o=>o!==ear);assert.equal(merged.userData.ownsStaticGeometry,1);merged.geometry.computeBoundingBox();
 assert.equal(merged.geometry.boundingBox.min.x,-2.5);assert.equal(merged.geometry.boundingBox.max.x,2.5);assert.equal(merged.geometry.boundingBox.max.y,1);
});
test('merged hero buffers remain registered for the next appearance rebuild',()=>{
 const {env}=runtime(),T=env.THREE,root=new T.Group(),mat=new T.MeshStandardMaterial();root.userData.heroGeometries=new Set();let released=0;
 for(let i=0;i<2;i++){const geo=new T.BoxGeometry(1,1,1),mesh=new T.Mesh(geo,mat);geo.addEventListener('dispose',()=>released++);mesh.userData.heroGeometry=true;mesh.position.x=i*2;root.userData.heroGeometries.add(geo);root.add(mesh)}
 env.plBatchModel(root,new Set());assert.equal(released,2);assert.equal(root.userData.heroGeometries.size,1);assert.equal(root.userData.heroGeometries.has(root.children[0].geometry),true);
 let mergedReleased=false;root.children[0].geometry.addEventListener('dispose',()=>{mergedReleased=true});for(const geo of root.userData.heroGeometries)geo.dispose();assert.equal(mergedReleased,true);
});

test('batching preserves skinning, instance buffers and custom shadow materials',()=>{
 const {env}=runtime(),T=env.THREE,root=new T.Group(),mat=new T.MeshStandardMaterial(),geo=new T.BoxGeometry(1,1,1);
 const skinned=new T.SkinnedMesh(geo,mat),instanced=new T.InstancedMesh(geo,mat,2),leaves=new T.Mesh(geo,mat);
 leaves.customDepthMaterial=new T.MeshDepthMaterial();root.add(skinned,instanced,leaves,new T.Mesh(geo,mat),new T.Mesh(geo,mat));
 env.plBatchModel(root,new Set());assert.equal(root.children.length,4);assert.equal(skinned.parent,root);assert.equal(instanced.parent,root);assert.equal(leaves.parent,root);
 assert.equal(instanced.instanceMatrix.count,2);assert.ok(leaves.customDepthMaterial);
});
