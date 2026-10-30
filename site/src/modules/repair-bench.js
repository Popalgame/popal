/* 0.1.29: ремонтний верстак 🔧 (будівля B_rep, world-007.js) — підійдіть і натисніть «Дія», щоб полагодити сокири й кирки з рюкзака.
   Повний ремонт: дерев’яний інструмент — 3 🪵, кам’яний — 3 🪨 + 1 🪵, металевий — 2 🔩 + 1 🪵; ціна пропорційна зношеності (мінімум 1). */
(function(){try{
if(!window.TT||!window.DUR)return;
const REP={1:{w:3},2:{s:3,w:1},3:{ing:2,w:1}};
const bench=()=>(window.BPLACED||[]).find(b=>b.id=='B_rep');
const near=()=>{const b=bench();return b&&Math.hypot(b.x-P.x,b.z-P.z)<2.3};
const ico=k=>window.plIcon?plIcon(k):IT[k][0];
const tools=()=>Object.keys(TT).filter(id=>inv[id]>0);
function cost(id){const m=DUR.mx(id),w=m-DUR.left(id),c={};if(w<=0)return c;const r=REP[TT[id].t]||REP[1];for(const k in r)c[k]=Math.max(1,Math.ceil(r[k]*w/m));return c}
const can=c=>Object.keys(c).every(k=>cnt(k)>=c[k]);

const css=document.createElement('style');css.textContent=`
#repw{display:none;position:fixed;left:calc(env(safe-area-inset-left,0px) + 12%);right:calc(env(safe-area-inset-right,0px) + 12%);top:calc(env(safe-area-inset-top,0px) + 8%);max-height:84%;overflow:auto;z-index:36;flex-direction:column;background:rgba(14,20,42,.96);border:2px solid #e2bf67;border-radius:16px;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.5)}
#repw header{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(226,191,103,.4)}#repw header b{flex:1;font-size:18px;color:#ffe7a8}
#repw .cx{background:none;border:none;color:#e2bf67;font-size:24px;cursor:pointer}
#repw .th{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 12px;padding:8px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(226,191,103,.35);border-radius:12px}
#repw .th .ic{font-size:30px;width:40px;text-align:center}#repw .th .ic img{width:38px;height:38px}#repw .nm{flex:1;min-width:140px}#repw .nm b{color:#ffe7a8}#repw .nm small{display:block;opacity:.8;font-size:12px}#repw .nm small img{width:18px;height:18px;vertical-align:-4px}
#repw .rb{display:block;height:6px;border-radius:3px;background:rgba(0,0,0,.4);overflow:hidden;margin:4px 0}#repw .rb i{display:block;height:100%}
#repw button.fx{background:linear-gradient(#5fb04a,#2f8a3a);border:2px solid #e2bf67;color:#fff;border-radius:10px;padding:4px 12px;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px}
#repw button:disabled{opacity:.35;filter:grayscale(1)}#repw .em{opacity:.65;font-size:12px;padding:6px 14px 10px;text-align:center}`;document.head.appendChild(css);
const box=document.createElement('div');box.id='repw';document.body.appendChild(box);
function render(){const ts=tools();
 box.innerHTML=`<header><b>${ico('B_rep')} Ремонтний верстак</b><button class='cx'>✕</button></header>`+(ts.length?ts.map(id=>{const v=DUR.left(id),m=DUR.mx(id),p=v/m,c=cost(id),full=v>=m;
  return `<div class='th'><div class='ic'>${ico(id)}</div><div class='nm'><b>${IT[id][1]}</b><span class='rb'><i style='width:${p*100}%;background:${p>.5?'#7ee08a':p>.2?'#ffd34e':'#ff6b5a'}'></i></span><small>🔧 ${v} / ${m}${full?' · ціле':' · ремонт: '+Object.keys(c).map(k=>ico(k)+'×'+c[k]+(cnt(k)<c[k]?' (є '+cnt(k)+')':'')).join(' + ')}</small></div>
  <button class='fx' data-fix='${id}' ${!full&&can(c)?'':'disabled'}>${full?'✔ Ціле':'🔧 Полагодити'}</button></div>`}).join(''):`<div class='em'>У рюкзаку немає сокир чи кирок</div>`)+
 `<div class='em'>Ремонт повертає повну міцність. Матеріали беруться з рюкзака, ціна залежить від того, наскільки інструмент зношений.</div>`;
 box.querySelector('.cx').onclick=close;
 box.querySelectorAll('[data-fix]').forEach(b=>b.onclick=()=>{const id=b.dataset.fix,c=cost(id);if(!(inv[id]>0)||!Object.keys(c).length||!can(c))return;
  for(const k in c)addI(k,-c[k]);DUR.set(id,DUR.mx(id));msg('🔧 Полагоджено: '+IT[id][1]);
  try{if(window.plBurst){const q=bench();plBurst(q.x,H(q.x,q.z)+1.1,q.z,0xffd34e,10,1.2,.3)}}catch(_){}
  try{eqUp()}catch(_){}hud();save();render()})}
function open(){ivO=1;box.style.display='flex';render()}
function close(){box.style.display='none';ivO=0;save()}
const hb=$('hit'),h0=hb.onclick;hb.onclick=function(){if(near()&&!nearest(wild,2.6)){open();return}return h0.apply(this,arguments)};
let was=null,hit0=null;ANI.push(()=>{const n=!!near();if(n===was)return;was=n;if(n){hit0=hb.innerHTML;hb.innerHTML=ico('B_rep')+'<small>Ремонт</small>'}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}});
addEventListener('keydown',e=>{if(e.key=='Escape'&&box.style.display=='flex')close()});
}catch(e){console.warn('repair-bench',e)}})();
