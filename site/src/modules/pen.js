/* 0.2.10: Загін (B_pen, модель — world-007.js).
   • Поселіть у загін попалів, з яких падає шерсть або шкіра (creature-drops.js: Пухоклуб — 🧶, Мороріг, Грозовик, Бамбузл — 🟫).
     Вони гуляють усередині паркану й час від часу дають шерсть чи шкіру — вона збирається в загоні (копичка біля хвіртки).
   • «Дія» поруч із загоном — вікно: хто живе в загоні, що назбиралося («Забрати все»), кого можна поселити.
   • До 3 попалів у загоні. Що вищий рівень попала, то швидше: 1 рів. — раз на 3 хв, 25 рів. — приблизно раз на 80 с.
   • Попал у загоні живе в Попал-центрі (займає місце в сховищі), але не працює в бригаді й не потребує кошика.
     Візьмете його з собою або в бригаду — він сам покине загін.
   • Загін накопичує до 60 речей; поки гра закрита, попали теж працюють (до цієї межі).
   • Збереження: inv._pen[ключ] = {it:{wool,lth}, t}, inv._pn — загін кожного попала (за порядком pals). */
(function(){try{
if(typeof pals=='undefined'||typeof IT=='undefined')return;
const CAP=3,STORE=60,R=1.9,NEAR=3.6;
const LOOT=window.PAL_LOOT||{'Пухоклуб':'wool','Мороріг':'lth','Грозовик':'lth','Бамбузл':'lth'},EMO={wool:'🧶',lth:'🟫'};
const prod=p=>LOOT[(T[p.ty]||{}).n]||null;
const every=p=>180/(1+((p.lv||1)-1)/20);/* секунд на одну річ */
if(!inv._pen||typeof inv._pen!='object')inv._pen={};
const pens=()=>(window.BPLACED||[]).filter(b=>b.id=='B_pen');
const key=b=>Math.round(b.x*10)/10+','+Math.round(b.z*10)/10;
const rec=b=>{const k=key(b);let o=inv._pen[k];if(!o||typeof o!='object')o=inv._pen[k]={it:{},t:Date.now()};if(!o.it)o.it={};return o};
const total=o=>Object.values(o.it||{}).reduce((a,n)=>a+n,0);
const inPen=b=>{const k=key(b);return pals.filter(p=>p.pen===k)};
/* завантаження і збереження прив'язки попалів */
if(Array.isArray(inv._pn))pals.forEach((p,i)=>{const d=inv._pn[i];if(d&&d[0]){p.pen=d[0];p._pa=+d[1]||0}});
const _sv=save;save=function(){try{inv._pn=pals.map(p=>p.pen?[p.pen,Math.round(p._pa||0)]:0)}catch(_){}return _sv.apply(this,arguments)};

/* ---------- виробництво ---------- */
const say=(t,o,c)=>{try{if(o&&Math.hypot(P.x-o.position.x,P.z-o.position.z)<18)dmg(t,o,c)}catch(_){}};
function tick(){const now=Date.now(),ks=new Set(pens().map(key));
 /* загін розібрали — попали виходять, назбиране повертається гравцю */
 for(const k of Object.keys(inv._pen))if(!ks.has(k)){const o=inv._pen[k];const got=[];for(const[i,n]of Object.entries(o.it||{}))if(n>0){addI(i,n);got.push(EMO[i]+'×'+n)}delete inv._pen[k];if(got.length)msg('🐑 Із загону: '+got.join(' '))}
 for(const p of pals)if(p.pen&&(!ks.has(p.pen)||p.cs==null||p.wk||p===pals[selP]||!prod(p))){p.pen=null;p._pa=0;p._pw=null}
 for(const b of pens()){const o=rec(b),dt=Math.min(Math.max(0,(now-(o.t||now))/1000),12*3600);o.t=now;
  for(const p of inPen(b)){const k=prod(p);p._pa=(p._pa||0)+dt;const ev=every(p);
   while(p._pa>=ev){p._pa-=ev;if(total(o)>=STORE){p._pa=0;break}o.it[k]=(o.it[k]||0)+1;say('+1 '+EMO[k],p.m,'#ffe28a')}}
  showPile(b,o)}}
function showPile(b,o){const pl=b.g&&b.g.userData.pile;if(!pl)return;const n=Math.min(12,Math.ceil(total(o)/5));if(pl.children.length===n&&pl.userData.k===JSON.stringify(o.it))return;
 pl.userData.k=JSON.stringify(o.it);while(pl.children.length)pl.remove(pl.children[0]);const w=o.it.wool||0,l=o.it.lth||0;
 for(let i=0;i<n;i++){const isW=i<Math.ceil(n*w/Math.max(1,w+l));const m=isW?new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),new THREE.MeshStandardMaterial({color:0xf4eee0,roughness:1}))
   :new THREE.Mesh(new THREE.BoxGeometry(.34,.06,.26),new THREE.MeshStandardMaterial({color:0x8a5a32,roughness:.85}));
  m.position.set((i%3)*.26-.26,.08+Math.floor(i/3)*.1,((i*7)%3)*.2-.2);m.rotation.y=i*1.3;m.castShadow=true;pl.add(m)}}
setInterval(tick,1000);

/* ---------- прогулянка в загоні ---------- */
let lt=0;ANI.push(tm=>{const dt=Math.min(.1,Math.max(0,tm-(lt||tm)));lt=tm;const PN=pens();if(!PN.length)return;const by={};for(const b of PN)by[key(b)]=b;
 for(const p of pals){if(!p.pen||p===pals[selP]||p.wk)continue;const b=by[p.pen];if(!b||!p.m)continue;
  let w=p._pw;if(!w){const a=Math.random()*6.3,r=Math.random()*R;w=p._pw={x:b.x+Math.cos(a)*r,z:b.z+Math.sin(a)*r,tx:null,tz:null,t:Math.random()*2}}
  if(w.tx==null){w.t-=dt;if(w.t<=0){const a=Math.random()*6.3,r=Math.random()*R;w.tx=b.x+Math.cos(a)*r;w.tz=b.z+Math.sin(a)*r}}
  let mv=false;if(w.tx!=null){const dx=w.tx-w.x,dz=w.tz-w.z,d=Math.hypot(dx,dz);if(d<.08){w.tx=null;w.t=1+Math.random()*4}else{const s=Math.min(d,.75*dt);w.x+=dx/d*s;w.z+=dz/d*s;w.a=Math.atan2(dx,dz);mv=true}}
  p.x=w.x;p.z=w.z;p.m.visible=true;p.m.position.set(w.x,H(w.x,w.z)+.04+(mv?Math.abs(Math.sin(tm*8+w.x))*.05:0),w.z);if(w.a!=null)p.m.rotation.y=w.a;p.st='🐑 гуляє в загоні'}});

/* ---------- вікно загону ---------- */
const near=()=>{let best=null,bd=NEAR;for(const b of pens()){const d=Math.hypot(b.x-P.x,b.z-P.z);if(d<bd){bd=d;best=b}}return best};
{const css=document.createElement('style');css.textContent=`
#pen{display:none;position:fixed;left:calc(env(safe-area-inset-left,0px) + 6%);right:calc(env(safe-area-inset-right,0px) + 6%);top:calc(env(safe-area-inset-top,0px) + 5%);bottom:calc(env(safe-area-inset-bottom,0px) + 5%);z-index:36;flex-direction:column;background:rgba(14,20,42,.97);border:2px solid #e2bf67;border-radius:16px;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.5);overflow:hidden;font-family:system-ui,sans-serif}
#pen header{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(226,191,103,.4)}#pen header b{font-size:18px;color:#ffe7a8;flex:1}#pen header small{opacity:.75;font-size:12px}
#pen .cx{background:none;border:none;color:#e2bf67;font-size:24px;cursor:pointer}
#pen .st{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.08);font-size:14px}#pen .st .it{display:flex;gap:14px;flex:1;font-size:15px}#pen .st .it b{color:#ffe7a8;font-size:18px}
#pen .cb{flex:1;display:flex;gap:12px;padding:10px 12px;min-height:0}#pen .col{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
#pen h5{margin:0 0 6px;color:#e2bf67;font-size:13px}
#pen .ls{flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px;min-height:0;padding-right:4px}
#pen .r{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:5px 8px}
#pen .r canvas{width:44px;height:44px;border-radius:10px;background:radial-gradient(circle at 50% 35%,#2f5a6c,#122a35);flex:none}
#pen .r .nm{flex:1;min-width:0;font-size:13px;line-height:1.3}#pen .r .nm small{display:block;opacity:.75;font-size:11.5px}
#pen .r i{display:block;height:4px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:3px;overflow:hidden}#pen .r i b{display:block;height:100%;background:linear-gradient(90deg,#ffe08a,#e8902a)}
#pen .em{opacity:.7;font-size:12.5px;padding:6px;line-height:1.45}
#pen button.b{background:linear-gradient(#f39a4a,#d9532e);border:2px solid #e2bf67;color:#fff;border-radius:9px;padding:3px 10px;font-weight:700;cursor:pointer;font-size:12.5px;font-family:inherit;min-height:32px}
#pen button.b.g{background:linear-gradient(#5fb04a,#2f8a3a)}#pen button.b:disabled{opacity:.35}
@media (max-width:640px){#pen .cb{flex-direction:column}}`;document.head.appendChild(css)}
const W=document.createElement('div');W.id='pen';document.body.appendChild(W);
let cur=null;
const nm=p=>(T[p.ty]||{}).n||'Попал';
const where=p=>p===pals[selP]?'з вами':p.cs==null?'у команді':p.wk?'у бригаді':'у сховищі центру';
function open_(b){cur=b;ivO=1;W.style.display='flex';tick();render()}
function close_(){W.style.display='none';ivO=0;cur=null;try{hud();save()}catch(_){}}
function settle(p){if(!cur)return;if(inPen(cur).length>=CAP){msg('🐑 У загоні вже '+CAP+' попали');return}
 if(p===pals[selP]){msg('🐑 '+nm(p)+' зараз з вами. Виберіть іншого попала супутником — тоді його можна поселити');return}
 if(p.cs==null){const f=window.cenFree?cenFree():-1;if(f<0){msg('🏠 Попал-центр заповнений — звільніть місце');return}p.cs=f}
 p.wk=0;p.pen=key(cur);p._pa=0;p._pw=null;msg('🐑 '+nm(p)+' тепер живе в загоні');try{save()}catch(_){}render()}
function out(p){p.pen=null;p._pa=0;p._pw=null;msg('🗄️ '+nm(p)+' повернувся у сховище Попал-центру');try{save()}catch(_){}render()}
function takeAll(){const o=rec(cur),got=[];for(const[k,n]of Object.entries(o.it))if(n>0){addI(k,n);got.push(EMO[k]+' '+IT[k][1]+' ×'+n)}o.it={};showPile(cur,o);if(got.length)msg('🐑 Забрано: '+got.join(', '));try{hud();save()}catch(_){}render()}
function render(){if(!cur)return;const o=rec(cur),list=inPen(cur),cand=pals.filter(p=>prod(p)&&!p.pen),w=o.it.wool||0,l=o.it.lth||0;
 W.innerHTML=`<header><b>🐑 Загін</b><small>Попалів: ${list.length} / ${CAP}</small><button class='cx' aria-label='Закрити'>✕</button></header>
 <div class='st'><span>Назбиралося:</span><span class='it'><span>${IT.wool?IT.wool[0]:'🧶'} Шерсть <b>${w}</b></span><span>${IT.lth?IT.lth[0]:'🟫'} Шкіра <b>${l}</b></span></span><small style='opacity:.7'>${total(o)} / ${STORE}</small><button class='b g' data-all ${total(o)?'':'disabled'}>⬇ Забрати все</button></div>
 <div class='cb'><div class='col'><h5>Живуть у загоні</h5><div class='ls'>${list.length?list.map((p,i)=>{const k=prod(p),ev=every(p),pc=Math.min(100,Math.round((p._pa||0)/ev*100));return`<div class='r' data-c='l${i}'><span class='nm'><b>${nm(p)}</b> · рів. ${p.lv||1}<small>${EMO[k]} ${IT[k][1].toLowerCase()} — раз на ${Math.round(ev)} с</small><i><b style='width:${pc}%'></b></i></span><button class='b' data-out='${pals.indexOf(p)}'>Вивести</button></div>`}).join(''):"<div class='em'>Тут поки нікого. Поселіть попала, з якого падає шерсть або шкіра.</div>"}</div></div>
 <div class='col'><h5>Можна поселити</h5><div class='ls'>${cand.length?cand.map((p,i)=>{const k=prod(p);return`<div class='r' data-c='c${i}'><span class='nm'><b>${nm(p)}</b> · рів. ${p.lv||1}<small>${EMO[k]} дає ${IT[k][1].toLowerCase()} · ${where(p)}</small></span><button class='b g' data-in='${pals.indexOf(p)}' ${list.length>=CAP||p===pals[selP]?'disabled':''}>Поселити</button></div>`}).join(''):"<div class='em'>Немає попалів, з яких падає шерсть або шкіра. Шерсть дає Пухоклуб, шкіру — Мороріг, Грозовик і Бамбузл. Спіймайте когось із них.</div>"}</div></div></div>`;
 const rows=[...list.map((p,i)=>['l'+i,p]),...cand.map((p,i)=>['c'+i,p])];
 for(const[c,p]of rows){const r=W.querySelector(`[data-c='${c}']`);if(!r)continue;const cv=document.createElement('canvas');cv.width=cv.height=88;try{drawCrit(cv,T[p.ty].c)}catch(_){}r.insertBefore(cv,r.firstChild)}
 W.querySelector('.cx').onclick=close_;
 W.querySelectorAll('[data-in]').forEach(b=>b.onclick=()=>settle(pals[+b.dataset.in]));
 W.querySelectorAll('[data-out]').forEach(b=>b.onclick=()=>out(pals[+b.dataset.out]));
 const a=W.querySelector('[data-all]');if(a)a.onclick=takeAll}
addEventListener('keydown',e=>{if(e.key=='Escape'&&W.style.display=='flex')close_()});
setInterval(()=>{if(cur&&W.style.display=='flex'&&!W.matches(':hover'))render()},2000);
{const hb=document.getElementById('hit');if(hb){const h0=hb.onclick;hb.onclick=function(){const b=near();if(b&&!nearest(wild,2.6)){open_(b);return}return h0&&h0.apply(this,arguments)};
 let was=null,hit0=null;ANI.push(()=>{const n=!!near();if(n===was)return;was=n;if(n){hit0=hb.innerHTML;hb.innerHTML='<span style="font-size:30px">🐑</span><small>Загін</small>'}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}})}}
window.PEN={pens,inPen,open:open_,every};
}catch(e){console.warn('pen',e)}})();
