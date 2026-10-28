/* 0.0.11: налаштування графіки — обмеження FPS, дальність прорисовки, лічильник FPS */
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
/* --- вкладка Опції --- */
const seg=(id,arr,cur,lab)=>`<div class='gseg' id='${id}'>`+arr.map((a,i)=>`<button data-i='${i}' class='${i==cur?'on':''}'>${lab(a)}</button>`).join('')+`</div>`;
const _pf=pfTab;pfTab=function(t){_pf(t);if(t!='o')return;const c=document.getElementById('pfc');if(!c||document.getElementById('gfxp'))return;
 const d=document.createElement('div');d.id='gfxp';const host=c.querySelector('.pcol')||c;
 d.innerHTML=`<h4>Обмеження FPS</h4>${seg('gfps',FPS,FPS.findIndex(f=>f[0]==G.fps),a=>a[1])}<small class='gnote'>30 — економить батарею, менше гріється телефон</small>
 <h4>Дальність прорисовки</h4>${seg('gdst',DIST,G.dist,a=>a[0])}<small class='gnote'>Далі — красивіше, але важче для телефона</small>
 <h4>Лічильник FPS</h4>${seg('gshw',[['Вимкнено'],['Показувати']],G.show,a=>a[0])}`;
 host.appendChild(d);
 const bind=(id,f)=>d.querySelectorAll('#'+id+' button').forEach(b=>b.onclick=()=>{f(+b.dataset.i);sv();apply();d.querySelectorAll('#'+id+' button').forEach(x=>x.classList.toggle('on',x===b))});
 bind('gfps',i=>G.fps=FPS[i][0]);bind('gdst',i=>G.dist=i);bind('gshw',i=>G.show=i)};
}catch(e){console.warn('graphics',e)}})();
