/* 0.1.29: міцність інструментів — кожен влучний удар сокирою по дереву чи киркою по каменю/жилі забирає 1 міцності.
   Дерев’яні 40, кам’яні 80, металеві 160 ударів. На нулі інструмент ламається й зникає, його треба скрафтити знову.
   Залишок міцності — в inv._dur {id: ударів}; шкала в панелі інструмента й у деталях предмета в інвентарі. */
(function(){try{
if(!window.TT||!window.gHit)return;
const MX={1:40,2:80,3:160},mx=id=>MX[TT[id].t]||40;
if(!inv._dur||typeof inv._dur!='object')inv._dur={};
const D=()=>inv._dur||(inv._dur={});
const left=id=>{const d=D();if(d[id]==null||d[id]>mx(id))d[id]=mx(id);return d[id]};
function bar(id){const v=left(id),m=mx(id),p=v/m,c=p>.5?'#7ee08a':p>.2?'#ffd34e':'#ff6b5a';
 return `<span class='durb'><i style='width:${p*100}%;background:${c}'></i></span><small class='durt'>🔧 ${v} / ${m}</small>`}
const st=document.createElement('style');st.textContent=`.durb{display:block;height:5px;border-radius:3px;background:rgba(0,0,0,.35);overflow:hidden;margin:4px 0 2px}.durb i{display:block;height:100%}.durt{display:block;opacity:.85}
.i2s .durs{position:absolute;left:4px;right:4px;bottom:3px;height:3px;border-radius:2px;background:rgba(0,0,0,.4);overflow:hidden;pointer-events:none}.i2s .durs i{display:block;height:100%}`;document.head.appendChild(st);

function brk(id){if(!(inv[id]>0))return;addI(id,-1);delete D()[id];
 if(eq.tool==id&&!(inv[id]>0)){eq.tool=null;try{buildHero(pl,look||DLOOK)}catch(_){}}
 msg('💥 '+IT[id][1]+' зламалась! Створіть нову в Крафті');try{if(window.plBurst)plBurst(P.x,H(P.x,P.z)+1.2,P.z,0x9a8f80,14,1.6,.35)}catch(_){}
 try{eqUp()}catch(_){}try{hud()}catch(_){}try{ivR()}catch(_){}save()}

const _gh=window.gHit;
window.gHit=function(k,o){const r=_gh.apply(this,arguments);if(r===-1)return r;
 const id=eq.tool,t=id&&TT[id];if(!t||t.k!=k||!(inv[id]>0))return r;
 const v=left(id)-1;D()[id]=v;
 /* ламається вже після удару: fellB на цьому ж кліку ще має бачити інструмент у руках */
 if(v<=0)setTimeout(()=>brk(id),0);else if(v==10||v==Math.ceil(mx(id)*.2))msg('⚠️ '+IT[id][1]+' майже зламана: '+v+' ударів');
 try{eqUp()}catch(_){}return r};

const _eu=eqUp;eqUp=function(){_eu.apply(this,arguments);try{const id=eq.tool,e=document.getElementById('eqtc');if(e&&id&&TT[id]){const t=TOOLS.find(x=>x.id==id);e.textContent=(t?t.d+' · ':'')+'🔧 '+left(id)+'/'+mx(id)}}catch(_){}};
const _r=ivR;ivR=function(){_r.apply(this,arguments);try{const c=document.getElementById('ivc');if(!c)return;
 c.querySelectorAll('.i2g .i2s[data-sl]').forEach(b=>{const id=b.dataset.sl;if(!TT[id]||!(inv[id]>0)||b.querySelector('.durs'))return;const p=left(id)/mx(id);
  if(getComputedStyle(b).position=='static')b.style.position='relative';
  b.insertAdjacentHTML('beforeend',`<span class='durs'><i style='width:${p*100}%;background:${p>.5?'#7ee08a':p>.2?'#ffd34e':'#ff6b5a'}'></i></span>`)});
 const on=c.querySelector('.i2g .i2s.on'),id=on&&on.dataset.sl,tx=c.querySelector('.i2d .tx');
 if(id&&TT[id]&&inv[id]>0&&tx&&!tx.querySelector('.durb'))tx.insertAdjacentHTML('beforeend',bar(id))}catch(e){console.warn('durability ivR',e)}};
try{eqUp()}catch(_){}
}catch(e){console.warn('durability:',e)}})();
