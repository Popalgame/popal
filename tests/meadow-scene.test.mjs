import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=name=>readFileSync(new URL('../site/'+name,import.meta.url),'utf8');
function runtime(occupied=false){
 const ctx={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 const env={console,performance:{now:()=>1000},document:{createElement:()=>({getContext:()=>ctx})},H:(x,z)=>x*.025+z*.01,
  inv:{_b:occupied?[["B_bed",0,14,-8],["B_bed",0,19,-11],["B_bed",0,24,-13.5]]:[],_ch:[]},trees:[],wild:[],hasSave:true,ANI:[],P:{x:0,z:0}};
 env.window=env;env.self=env;vm.createContext(env);vm.runInContext(source('three.min.js'),env);env.sc=new env.THREE.Scene();
 vm.runInContext(source('src/modules/meadow-scene.js'),env);return env;
}
test('waygate columns block movement while its central passage stays open',()=>{
 const env=runtime();assert.equal(env.plSceneryObstacles.length,2);assert.ok(env.plMeadow.root.parent===env.sc);
 vm.runInContext(source('src/modules/collide.js'),env);
 const center=env.plMeadow.center;const through=env.colStep(center.x,center.z+1,center.x,center.z,.38);
 assert.deepEqual(Array.from(through),[center.x,center.z]);
 const pillar=env.plSceneryObstacles[0],blocked=env.colStep(center.x,center.z,pillar.x,pillar.z,.38);
 assert.ok(Math.hypot(blocked[0]-pillar.x,blocked[1]-pillar.z)>=pillar.r+.38-.00001);
 assert.equal(env.inv._b.length,0);assert.equal(env.inv._ch.length,0);
});
test('waygate avoids player structures rather than overwriting a saved base',()=>{
 const env=runtime(true);assert.equal(env.plMeadow,undefined);assert.equal(env.sc.children.length,0);assert.equal(env.inv._b.length,3);
});
