import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../site/src/modules/building-vegetation.js',import.meta.url),'utf8');
function mesh(){return {instanceMatrix:{array:new Float32Array(48),needsUpdate:false}}}

test('plants disappear under saved foundations and return after removal',()=>{
 const gm=mesh(),fm=mesh(),pieces=[{t:0,cx:0,cz:0}],P={x:0,z:0};let refreshes=0;
 const env={gm,fm,P,BUILD:{pieces},regrass(){
  refreshes++;
  for(const m of [gm,fm])for(const [i,x,z] of [[0,1,1],[16,-1,-1],[32,4,1]]){
   m.instanceMatrix.array[i+12]=x;m.instanceMatrix.array[i+13]=.5;m.instanceMatrix.array[i+14]=z;
  }
 }};
 env.window=env;vm.createContext(env);vm.runInContext(source,env);
 for(const m of [gm,fm])assert.deepEqual([m.instanceMatrix.array[13],m.instanceMatrix.array[29],m.instanceMatrix.array[45]],[-5,.5,.5]);
 pieces.push({t:1,cx:2,cz:0});env.plRefreshVegetation();assert.equal(refreshes,1);
 pieces.shift();env.plRefreshVegetation();assert.equal(refreshes,2);
 for(const m of [gm,fm])assert.equal(m.instanceMatrix.array[13],.5);
 pieces.push({t:0,cx:0,cz:0});env.plRefreshVegetation();assert.equal(gm.instanceMatrix.array[13],-5);
 env.regrass(20,20);assert.equal(fm.instanceMatrix.array[13],-5);
});
