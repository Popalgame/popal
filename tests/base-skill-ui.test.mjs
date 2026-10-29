import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../site/src/modules/elements.js',import.meta.url),'utf8');

test('inventory explains the water crew bonus and renders a smelting worker',()=>{
 const cards=Array.from({length:2},()=>({nodes:[],querySelector:()=>({}),insertBefore(node){this.nodes.push(node)}}));
 const container={querySelectorAll:()=>cards};
 const context={window:{},T:Array.from({length:10},()=>({})),EL:[],pals:[
  {ty:8,cs:0,wk:true},{ty:2,cs:1,wk:true,job:'smelt'}],selP:-1,ivTab:'p',
  ivR(){},$:(id)=>id=='ivc'?container:null,
  document:{createElement:()=>({})},pwUp(){},console};
 vm.runInNewContext(source,context);
 context.ivR();
 assert.match(cards[0].nodes[0].innerHTML,/Поливання.*15% за рівень\. Діє найсильніший фахівець/s);
 assert.equal(cards[1].nodes[1].textContent,'⚙️ Зараз: плавлення руди');
});
