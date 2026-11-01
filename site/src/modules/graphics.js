/* 0.0.11: налаштування графіки — обмеження FPS, дальність прорисовки, лічильник FPS (0.2.8: FPS і дальність виставляє режим якості з perf.js) */
(function(){try{
const KEY='zi_gfx';let G={fps:0,dist:1,show:0};
try{Object.assign(G,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const sv=()=>{try{localStorage.setItem(KEY,JSON.stringify(G))}catch(e){}};
const FPS=[[30,'30'],[60,'60'],[0,'Без обмеження']];
const DIST=[['Близько',45,22,43],['Середня',80,44,78],['Далеко',125,70,122],['Максимум',180,100,175]];
/* --- обмеження FPS: усі кадри гри проходять через один «насос» --- */
const raf0=window.requestAnimationFrame.bind(window),caf0=window.cancelAnimationFrame.bind(window);
let q=new Map(),nid=1,sched=0,last=0;
function pump(t){sched=0;const iv=G.fps?1000/G.fps:0;
 if(iv&&t-last<iv-2){sched=1;raf0(pump);return}
 last=t;const cbs=[...q.values()];q=new Map();
 for(const cb of cbs){try{cb(t)}catch(e){setTimeout(()=>{throw e})}}}
window.requestAnimationFrame=cb=>{const id=nid++;q.set(id,cb);if(!sched){sched=1;raf0(pump)}return id};
window.cancelAnimationFrame=id=>{q.delete(id)};
/* --- лічильник FPS --- */
const fc=document.createElement('div');fc.id='fpsc';document.body.appendChild(fc);
let fN=0,fT=performance.now();
(function cnt(){window.requestAnimationFrame(()=>{fN++;const n=performance.now();if(n-fT>=500){fc.textContent=Math.round(fN*1000/(n-fT))+' FPS';fN=0;fT=n}
 fc.style.display=G.show&&!(typeof menuO!=='undefined'&&menuO)?'block':'none';cnt()})})();
/* --- застосування --- */
function apply(){window.gfxFps=G.fps;const d=DIST[G.dist]||DIST[1];
 try{if(typeof cam!=='undefined'&&cam){cam.far=d[1];cam.updateProjectionMatrix()}}catch(e){}
 try{if(typeof sc!=='undefined'&&sc&&sc.fog){sc.fog.near=d[2];sc.fog.far=d[3]}}catch(e){}}
apply();
window.plGfx={set:next=>{if(next.fps!==undefined&&[0,30,60].includes(next.fps))G.fps=next.fps;if(next.dist!==undefined&&Number.isInteger(next.dist)&&next.dist>=0&&next.dist<DIST.length)G.dist=next.dist;sv();apply()},state:()=>({...G})};
/* --- вкладка «Графіка»: контейнер #gfxp; режими якості й деталі додає perf.js, тут — лише лічильник FPS --- */
const _pf=pfTab;pfTab=function(t){_pf(t);if(t!='o')return;const c=document.getElementById('pfc');if(!c||document.getElementById('gfxp'))return;
 const d=document.createElement('div');d.id='gfxp';const host=c.querySelector('.pcol')||c;
 d.innerHTML=`<h4>Лічильник FPS</h4><div class='gseg' id='gshw'>${['Вимкнено','Показувати'].map((a,i)=>`<button data-i='${i}' class='${i==G.show?'on':''}'>${a}</button>`).join('')}</div>`;
 host.appendChild(d);
 d.querySelectorAll('#gshw button').forEach(b=>b.onclick=()=>{G.show=+b.dataset.i;sv();d.querySelectorAll('#gshw button').forEach(x=>x.classList.toggle('on',x===b))})};
}catch(e){console.warn('graphics',e)}})();
