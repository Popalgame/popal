import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';
const source=readFileSync(new URL('../site/sw.js',import.meta.url),'utf8');
test('music, effects and creature voices are available in the offline cache',()=>{
 const list=source.match(/const ASSETS=\[([^\]]+)\]/)?.[1]||'';
 const cached=new Set([...list.matchAll(/'([^']+)'/g)].map(match=>match[1]));
 const missing=[];
 for(const category of ['music','sfx','pals'])for(const name of readdirSync(new URL(`../site/sounds/${category}/`,import.meta.url))){
  if(name.endsWith('.mp3')&&!cached.has(`sounds/${category}/${name}`))missing.push(`${category}/${name}`);
 }
 assert.deepEqual(missing,[]);
});
test('offline core script query resolves to the precached unversioned asset',async()=>{
 const events={},expected={cached:true};let options;
 const env={self:{addEventListener:(name,fn)=>events[name]=fn},URL,Response,location:{origin:'https://game.test'},fetch:async()=>{throw new Error('offline')},
  caches:{match:async(_request,opts)=>{options=opts;return expected}}};
 vm.runInNewContext(source,env);let result;events.fetch({request:{url:'https://game.test/src/modules/core-world.js?v=0.3.0',method:'GET'},respondWith:p=>result=p});
 assert.equal(await result,expected);assert.equal(options.ignoreSearch,true);
});
test('failed precache never activates and replaces the working version',async()=>{
 const events={};let skipped=false,pending;
 vm.runInNewContext(source,{self:{addEventListener:(name,fn)=>events[name]=fn,skipWaiting:()=>{skipped=true}},caches:{open:async()=>({addAll:async()=>{throw new Error('download interrupted')}})}});
 events.install({waitUntil:p=>pending=p});await assert.rejects(pending,/download interrupted/);assert.equal(skipped,false);
});
