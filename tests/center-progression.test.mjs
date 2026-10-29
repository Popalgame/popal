import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../site/src/modules/popal-center.js',import.meta.url),'utf8');
const prefix=source.slice(source.indexOf('const CN='),source.indexOf('/* ---------- модель ---------- */'));

function center({level,hero=1,materials={},crew=[]}={}){
 const inv={_cen:[0,0],...materials};if(level!==undefined)inv._cenLv=level;
 const res={w:materials.w||0,s:materials.s||0},pals=crew.map((wk,i)=>({cs:i,wk}));
 const calls={save:0,hud:0,pwUp:0,render:0,messages:[]};
 const context={inv,res,pals,plv:hero,IT:{w:['🪵','Деревина'],s:['🪨','Камінь'],sti:['🪵','Палки'],ing:['⚙️','Злитки']},RC:[],hasSave:false,
  cnt:k=>k in res?res[k]:inv[k],addI:(k,n)=>{if(k in res)res[k]+=n;else inv[k]=(inv[k]||0)+n},
  save:()=>calls.save++,hud:()=>calls.hud++,pwUp:()=>calls.pwUp++,render:()=>calls.render++,msg:s=>calls.messages.push(s),window:{}};
 vm.runInNewContext(`(function(){${prefix}\nwindow.api={cenLv,wMax,upgradeState,upgradeCen,crew};})()`,context);
 context.calls=calls;context.api=context.window.api;return context;
}

test('old saves start at level one; invalid levels clamp to available caps',()=>{
 assert.equal(center().api.cenLv(),1);
 assert.equal(center().api.wMax(),2);
 assert.equal(center({level:99}).api.wMax(),8);
 assert.equal(center({level:-3}).api.cenLv(),1);
 assert.equal(center({level:'broken'}).api.cenLv(),1);
});

test('upgrade requires both hero level and materials, then pays exactly once',()=>{
 const c=center({hero:4,materials:{w:30,s:20}});
 c.api.upgradeCen();assert.equal(c.inv._cenLv,1);assert.equal(c.res.w,30);assert.equal(c.calls.save,0);
 c.plv=5;c.res.s=19;c.api.upgradeCen();assert.equal(c.inv._cenLv,1);assert.equal(c.res.w,30);
 c.res.s=20;c.api.upgradeCen();assert.equal(c.inv._cenLv,2);assert.equal(c.api.wMax(),3);
 assert.equal(c.res.w,0);assert.equal(c.res.s,0);
 assert.deepEqual([c.calls.save,c.calls.hud,c.calls.pwUp,c.calls.render],[1,1,1,3]);
 c.api.upgradeCen();assert.equal(c.inv._cenLv,2);assert.equal(c.calls.save,1);
});

test('later levels expose escalating costs and maximum cap',()=>{
 const c=center({level:4,hero:28,materials:{w:160,s:130,ing:20}});
 assert.equal(c.api.upgradeState().ready,true);
 c.api.upgradeCen();assert.equal(c.api.cenLv(),5);assert.equal(c.api.wMax(),8);
 assert.equal(c.inv.ing,0);assert.equal(c.api.upgradeState().ready,false);
 c.api.upgradeCen();assert.equal(c.calls.save,1);
});

test('existing workers remain assigned during level migration',()=>{
 const c=center({level:3,crew:[1,1,1,1,1]});
 assert.equal(c.api.wMax(),4);
 assert.equal(c.api.crew().length,5);
 assert.equal(c.pals.filter(p=>p.wk).length,5);
});
