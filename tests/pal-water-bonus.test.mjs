import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../site/src/modules/pal-ai.js',import.meta.url),'utf8');

function scene(){
 const tree={x:0,z:0,hp:100,mx:100,m:{position:{x:0,z:0}}};
 const worker={ty:0,wk:true,cs:0,cr:5,x:0,z:0,m:{position:{set(){}},rotation:{}}};
 const water={ty:1,wk:true,cs:1};
 const pals=[worker,water];
 const context={window:{},pals,T:[{wk:{chop:1}},{wk:{water:3}},{wk:{water:2}}],
  addPal(){},inv:{_cen:[0,0]},cf:0,trees:[tree],rocks:[],bushes:[],shrooms:[],
  itemW:()=>1,P:{x:100,z:100},H:()=>0,Math,setInterval(){},console};
 context.window.itemW=context.itemW;
 vm.runInNewContext(source,context);
 assert.equal(typeof context.window.palAI,'function');
 worker.ai={s:'work',bag:{},t:3,tg:tree,L:context.trees,k:'w',job:'chop'};
 return {context,worker,water,tree,step:dt=>context.window.palAI(worker,dt,0)};
}

test('water uses the highest level among active crew and advances actual resource work',()=>{
 const s=scene();
 s.context.pals.push({ty:2,wk:true,cs:2});
 s.step(2.1);
 assert.equal(s.worker.ai.bag.w,1);
 assert.equal(s.tree.hp,98);
});

test('water has no effect without an assigned active specialist, including during a work cycle',()=>{
 const s=scene();
 s.water.wk=false;
 s.step(2.1);
 assert.equal(s.worker.ai.bag.w,undefined);
 s.water.wk=true;
 s.step(.65);
 assert.equal(s.worker.ai.bag.w,1);

 const t=scene();
 t.step(1);
 t.water.cs=null;
 t.step(1.4);
 assert.equal(t.worker.ai.bag.w,undefined);
 t.step(.2);
 assert.equal(t.worker.ai.bag.w,1);
});

test('water speeds cooking while leaving travel speed unchanged',()=>{
 const s=scene();
 const w=s.worker;
 s.context.T[0].wk.cook=1;
 s.context.window.BPLACED=[{id:'B_kit',x:0,z:0}];
 s.context.KIT=s.context.window.KIT={rc:()=>({mu:1}),done(){}};
 s.context.IT={gm:['🍢','Meal']};
 w.ai={s:'cook',bag:{mu:1},ph:2,dish:'gm',n:1,t:0};
 s.step(4.2);
 assert.equal(w.ai.bag.gm,1);

 w.ai={s:'go',bag:{},t:0,tg:s.tree,L:s.context.trees,job:'chop'};
 s.tree.x=10;
 w.x=0;
 s.step(1);
 assert.equal(w.x,2.2);
});
