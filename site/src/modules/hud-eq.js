/* 0.5.x: панель «куля + у руках» у стилі сучасних ігор-ловилок: дві напівпрозорі плашки з бірюзовою смугою й точками по кутах,
   лічильник куль «003» (зайві нулі тьмяні, порожньо — червоний 0), у правій — інструмент і його міцність.
   ПК: над панеллю підказка «Кинути сферу [R]», під плашками клавіші 3 (наступна куля) і 4 (наступний інструмент); дотик, як і раніше, відкриває вибір. */
(function(){try{
const eqp=document.getElementById('eqp'),eb=document.getElementById('eqb'),et=document.getElementById('eqt');if(!eqp||!eb||!et||typeof eqUp!='function')return;
let fine=false;try{fine=matchMedia('(pointer: fine)').matches}catch(_){}
const st=document.createElement('style');st.textContent=`
html body #eqp.pq{gap:10px!important;align-items:flex-end}
html body #eqp.pq .eqs{position:relative!important;display:block!important;width:132px!important;height:auto!important;padding:0!important;margin:0!important;background:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;overflow:visible!important;font-family:inherit;color:#fff;text-align:left}
html body #eqp.pq .eqs>small,html body #eqp.pq .eqs>b,html body #eqp.pq .eqs>u{display:none!important}
#eqp.pq .pqh{display:block;height:13px;background:linear-gradient(#24575c,#1a4146);border-bottom:1px solid rgba(255,255,255,.18);color:#bfe7e2;font-size:9px;font-weight:800;line-height:13px;padding:0 6px;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase}
#eqp.pq .pqb{position:relative;display:flex;align-items:center;gap:6px;height:44px;padding:0 8px;background:linear-gradient(rgba(58,60,58,.72),rgba(38,40,40,.62));-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
#eqp.pq .pqb::before,#eqp.pq .pqb::after,#eqp.pq .pqh::before,#eqp.pq .pqh::after{content:'';position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;box-shadow:0 0 3px #fff}
#eqp.pq .pqh{position:relative}#eqp.pq .pqh::before{left:-1px;top:-1px}#eqp.pq .pqh::after{right:-1px;top:-1px}#eqp.pq .pqb::before{left:-1px;bottom:-1px}#eqp.pq .pqb::after{right:-1px;bottom:-1px}
html body #eqp.pq .eqi{position:static!important;flex:0 0 34px;width:34px!important;height:34px!important;display:flex!important;align-items:center;justify-content:center;font-size:24px!important;margin:0!important}
html body #eqp.pq .eqi img,html body #eqp.pq .eqi canvas,html body #eqp.pq .eqi svg{max-width:34px;max-height:34px}
#eqp.pq .pqn{font:800 26px/1 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:1px;font-variant-numeric:tabular-nums;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}
#eqp.pq .pqn i{font-style:normal;color:rgba(255,255,255,.28)}#eqp.pq .pqn em{font-style:normal;color:#ff8d84}
#eqp.pq .pqv{align-self:stretch;width:1px;margin:7px 2px;background:rgba(255,255,255,.35)}
#eqp.pq .pqd{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;font:800 15px/1 system-ui,-apple-system,'Segoe UI',sans-serif;font-variant-numeric:tabular-nums}
#eqp.pq .pqd span{display:block;height:3px;border-radius:2px;background:rgba(0,0,0,.45);overflow:hidden}#eqp.pq .pqd span i{display:block;height:100%}
#eqp.pq .pqk{display:flex;justify-content:center;align-items:center;gap:6px;margin-top:4px;height:16px;color:#8fd3e8;font-size:13px;font-weight:800}
#eqp.pq .pqk kbd{display:inline-block;min-width:14px;height:16px;padding:0 3px;border-radius:3px;background:#dfe6ee;color:#1d2a36;font:800 11px/16px system-ui,sans-serif;text-align:center;box-shadow:0 1px 0 #7d8a96}
#pqt{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);margin-bottom:8px;display:flex;align-items:center;gap:8px;padding:4px 6px 4px 12px;border-radius:4px;background:rgba(30,34,38,.55);color:#f2f2f2;font-size:13px;font-weight:600;white-space:nowrap;pointer-events:none;text-shadow:0 1px 2px #000}
#pqt kbd{display:inline-block;min-width:16px;height:20px;padding:0 4px;border-radius:3px;background:#dfe6ee;color:#1d2a36;font:800 12px/20px system-ui,sans-serif;text-align:center;text-shadow:none}
@media (pointer:coarse) and (max-width:960px){html body #eqp.pq .eqs{width:116px!important}#eqp.pq .pqn{font-size:22px}#eqp.pq .pqb{height:40px;padding:0 6px}html body #eqp.pq .eqi{flex-basis:30px;width:30px!important;height:30px!important;font-size:21px!important}}`;
document.head.appendChild(st);
eqp.classList.add('pq');
const mk=(b,sw)=>{const h=document.createElement('span');h.className='pqh';const bd=document.createElement('span');bd.className='pqb';const k=document.createElement('span');k.className='pqk';k.innerHTML=(fine?`<kbd>${sw}</kbd>`:'')+'⟳';
 const ic=b.querySelector('.eqi');b.prepend(h);b.insertBefore(bd,ic);bd.appendChild(ic);const x=document.createElement('span');bd.appendChild(x);b.appendChild(k);return{h,bd,x}};
const B=mk(eb,'3'),Tl=mk(et,'4');
const tv=document.createElement('span');tv.className='pqv';Tl.bd.insertBefore(tv,Tl.x);B.x.className='pqn';Tl.x.className='pqd';
if(fine){const t=document.createElement('div');t.id='pqt';t.innerHTML='Кинути сферу для ловлі <kbd>R</kbd>';eqp.appendChild(t)}
const col=p=>p>.5?'#7ee08a':p>.2?'#ffd34e':'#ff6b5a';
function draw(){const b=BALL.find(x=>x.id==eq.ball)||BALL[0],n=Math.max(0,Math.min(999,ec(b.id)|0)),s=String(n),pad='0'.repeat(3-s.length);
 B.h.textContent=b.s||b.n;B.x.innerHTML=n?`<i>${pad}</i>${s}`:`<i>00</i><em>0</em>`;
 const id=eq.tool,t=TOOLS.find(x=>x.id==id)||TOOLS[0];Tl.h.textContent=id&&IT[id]?IT[id][1]:t.n;
 if(id&&window.DUR&&window.TT&&TT[id]){const v=DUR.left(id),m=DUR.mx(id);Tl.x.innerHTML=`<b>🔧 ${v}</b><span><i style='width:${v/m*100}%;background:${col(v/m)}'></i></span>`}
 else Tl.x.innerHTML=`<b style='color:rgba(255,255,255,.45)'>—</b>`}
const _eu=eqUp;eqUp=function(){_eu.apply(this,arguments);try{draw()}catch(e){console.warn('hud-eq',e)}};
/* ПК: 3 — наступна куля, 4 — наступний інструмент (лише з тих, що є) */
if(fine)addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;const tg=e.target;if(tg&&(tg.tagName=='INPUT'||tg.tagName=='TEXTAREA'||tg.isContentEditable))return;
 if((typeof menuO!='undefined'&&menuO)||(typeof ivO!='undefined'&&ivO))return;
 if(e.code=='Digit3'){const own=BALL.filter(x=>ec(x.id)>0);if(own.length<2)return;const i=own.findIndex(x=>x.id==eq.ball);eq.ball=own[(i+1)%own.length].id;msg('Куля: '+(own[(i+1)%own.length].s||own[(i+1)%own.length].n));eqUp();save()}
 else if(e.code=='Digit4'){const own=[null].concat(TOOLS.filter(x=>x.id&&inv[x.id]>0).map(x=>x.id));if(own.length<2)return;const i=own.indexOf(eq.tool);eq.tool=own[(i+1)%own.length];try{buildHero(pl,look||DLOOK)}catch(_){}msg('В руках: '+(eq.tool?IT[eq.tool][1]:'Руки'));eqUp();save()}});
try{eqUp()}catch(_){}
}catch(e){console.warn('hud-eq:',e)}})();
