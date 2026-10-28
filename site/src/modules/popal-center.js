/* 0.1.17: Попал-центр — серце бази гравця. Крафтиться (20 🪵 + 15 🪨) і ставиться один раз будь-де на суші.
   Навколо нього будується база. Працюють лише попали, покладені в сховище центру: 8 сторінок по 30 слотів.
   Решта попалів — з гравцем у сфері (команда, яку можна призивати). */
(function(){try{
const CN=240,PG=30,NP=CN/PG,NEAR=3.2;
IT.B_cen=['🏠','Попал-центр'];if(inv.B_cen==null)inv.B_cen=0;
RC.unshift({id:'B_cen',n:'🏠 Попал-центр',c:{w:20,s:15},d:'Серце вашої бази: ставиться один раз. Навколо нього будуєте базу, а попали в ньому працюють',one:1});

/* гравцям зі старим табором — центр у подарунок, щоб перенести базу */
if(hasSave&&!inv._cen&&!inv._cenG&&!(inv.B_cen>0)&&(pals.length||(inv._b||[]).length)){inv.B_cen=1;inv._cenG=1;setTimeout(()=>msg('🏠 Табір зник! У рюкзаку — Попал-центр у подарунок: поставте його, де хочете жити'),4000)}

/* ---------- слоти ---------- */
const used=()=>new Set(pals.filter(p=>p.cs!=null).map(p=>p.cs));
window.cenFree=(from)=>{if(!inv._cen)return -1;const u=used();for(let k=0;k<CN;k++){const i=((from||0)+k)%CN;if(!u.has(i))return i}return -1};
window.cenPos=()=>inv._cen||null;

/* ---------- модель ---------- */
const GLOW=new THREE.MeshStandardMaterial({color:0x7fe3f5,emissive:0x2ab8e0,emissiveIntensity:1.6,roughness:.25});
const STN=new THREE.MeshStandardMaterial({color:0xb9b4c4,roughness:.85,flatShading:true}),STD=new THREE.MeshStandardMaterial({color:0x7d7890,roughness:.9,flatShading:true});
let cenG=null,orb=null,ring=null;
function mkCen(){const g=new THREE.Group(),m=(geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
 m(new THREE.CylinderGeometry(2.1,2.3,.3,10),STD,0,.15,0);m(new THREE.CylinderGeometry(1.75,1.9,.22,10),STN,0,.4,0);
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.26,x=Math.cos(a)*1.55,z=Math.sin(a)*1.55;m(new THREE.BoxGeometry(.26,1.1,.26),STN,x,1.0,z).rotation.y=-a;m(new THREE.OctahedronGeometry(.16,0),GLOW,x,1.7,z)}
 m(new THREE.CylinderGeometry(.42,.6,.9,8),STN,0,.95,0);
 orb=new THREE.Group();orb.position.y=2.05;g.add(orb);
 /* та сама світло-синя куля, якою гравець ловить попалів */
 const ball=new THREE.Mesh(new THREE.SphereGeometry(.55,32,20),window.plBallMat?plBallMat('b'):GLOW);ball.castShadow=true;orb.add(ball);
 ring=new THREE.Mesh(new THREE.TorusGeometry(.95,.035,6,48),GLOW);ring.rotation.x=Math.PI/2;ring.position.y=2.05;g.add(ring);
 const lt=new THREE.PointLight(0x7fe3f5,0,9);lt.position.y=2.2;g.add(lt);g.userData.light=lt;
 const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');x.font='bold 46px system-ui';x.textAlign='center';x.textBaseline='middle';x.lineWidth=8;x.strokeStyle='#1a1430';x.strokeText('🏠 Попал-центр',256,48);x.fillStyle='#ffe7a8';x.fillText('🏠 Попал-центр',256,48);
 const tx=new THREE.CanvasTexture(c);tx.encoding=THREE.sRGBEncoding;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,depthTest:false}));sp.scale.set(3.2,.6,1);sp.position.y=3.3;g.add(sp);
 return g}
function showCen(){if(cenG){sc.remove(cenG);cenG=null}const C=inv._cen;if(!C)return;cenG=mkCen();cenG.position.set(C[0],Math.max(-.2,H(C[0],C[1]))-.05,C[1]);sc.add(cenG);
 for(const L of[trees,rocks,bushes,shrooms])for(let i=L.length-1;i>=0;i--){const o=L[i];if(Math.hypot(o.x-C[0],o.z-C[1])<3.6){sc.remove(o.m);L.splice(i,1)}}}
showCen();
ANI.push(t=>{if(!cenG)return;orb.rotation.y=t*.6;orb.position.y=2.05+Math.sin(t*1.6)*.08;ring.rotation.z=t*.9;ring.position.y=orb.position.y;
 const n=window.isNight&&isNight();cenG.userData.light.intensity=n?1.6:0});

/* ---------- встановлення ---------- */
function placeCen(){if(inv._cen){msg('🏠 Попал-центр уже стоїть — він може бути лише один');return}if(!(inv.B_cen>0))return;
 const x=P.x+Math.sin(P.face||0)*3,z=P.z+Math.cos(P.face||0)*3;
 if(H(x,z)<-.3||H(P.x,P.z)<-.3){msg('🌊 Попал-центр не можна ставити у воді');return}
 inv.B_cen--;inv._cen=[+x.toFixed(2),+z.toFixed(2)];showCen();if(window.respawnB)respawnB();
 /* перший центр: попали, які раніше працювали в таборі (усі, крім того, що з вами), переходять у центр */
 if(!inv._cenM){inv._cenM=1;const keep=pals[selP];for(const p of pals){if(p!==keep&&p.cs==null){const f=cenFree();if(f>=0)p.cs=f}}}
 pwUp();hud();save();msg('🏠 Попал-центр збудовано! Біля нього натисніть «Дія», щоб покласти попалів на роботу');if(window.plBurst)plBurst(x,H(x,z)+2,z,0x7fe3f5,40,3.5,.5)}
window.placeCen=placeCen;
document.addEventListener('click',e=>{const t=e.target.closest('[data-cenplace]');if(!t)return;placeCen();ivR()});
const _r=ivR;ivR=function(){_r.apply(this,arguments);const c=$('ivc');if(!c)return;
 if(ivTab=='i'){const on=c.querySelector('.i2g .i2s.on'),d=c.querySelector('.i2d');if(on&&on.dataset.sl=='B_cen'&&d&&!d.querySelector('[data-cenplace]')){const b=document.createElement('button');b.dataset.cenplace=1;b.textContent='🏠 Поставити тут';d.appendChild(b)}}
 if(ivTab=='c'){const i=RC.findIndex(r=>r.id=='B_cen');const bt=c.querySelector(`[data-r='${i}']`);if(bt&&inv._cen){bt.disabled=true;bt.textContent='✔ Збудовано'}}};

/* ---------- взаємодія: «Дія» біля центру відкриває його ---------- */
const nearCen=()=>inv._cen&&Math.hypot(P.x-inv._cen[0],P.z-inv._cen[1])<NEAR;window.nearCen=nearCen;
const hb=$('hit'),h0=hb.onclick;hb.onclick=function(){if(nearCen()&&!nearest(wild,2.6)){openCen();return}return h0.apply(this,arguments)};
let wasNear=null,hit0=null;ANI.push(()=>{const n=!!nearCen();if(n===wasNear)return;wasNear=n;if(n){hit0=hb.innerHTML;hb.innerHTML='🏠<small>Центр</small>'}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}});

/* ---------- вікно центру ---------- */
const css=document.createElement('style');css.id='cen-css';css.textContent=`
#cen{display:none;position:fixed;left:calc(env(safe-area-inset-left,0px) + 5%);right:calc(env(safe-area-inset-right,0px) + 5%);top:calc(env(safe-area-inset-top,0px) + 4%);bottom:calc(env(safe-area-inset-bottom,0px) + 4%);z-index:36;flex-direction:column;background:rgba(14,20,42,.96);border:2px solid #e2bf67;border-radius:16px;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.5);overflow:hidden;font-family:inherit}
#cen header{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(226,191,103,.4)}
#cen header b{font-size:18px;color:#ffe7a8;flex:1}#cen header small{opacity:.8}
#cen .cx{background:none;border:none;color:#e2bf67;font-size:24px;cursor:pointer}
#cen .cb{flex:1;display:flex;gap:12px;padding:10px 12px;min-height:0}
#cen .cl{display:flex;flex-direction:column;min-width:0;flex:1.35}
#cen .cg{flex:1;display:grid;grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(5,1fr);gap:5px;min-height:0}
#cen .cs{position:relative;border:2px dashed rgba(127,227,245,.35);border-radius:10px;background:rgba(127,227,245,.05);display:flex;align-items:center;justify-content:center;cursor:pointer;min-height:0;overflow:hidden}
#cen .cs.f{border-style:solid;border-color:#3a8ee6;background:rgba(58,142,230,.15)}#cen .cs.on{border-color:#ffd34e;box-shadow:0 0 0 2px #ffd34e inset}
#cen .cs canvas{width:42px;height:42px;flex:none}#cen .cs .lv{position:absolute;left:4px;top:2px;font-size:11px;font-weight:700;color:#ffe7a8}
#cen .cs .jb{position:absolute;right:3px;bottom:1px;font-size:11px}#cen .cs .pl{opacity:.35;font-size:20px}
#cen .pn{display:flex;align-items:center;justify-content:center;gap:10px;padding-top:6px}
#cen .pn button{background:#2e3658;border:2px solid #e2bf67;color:#fff;border-radius:10px;padding:2px 14px;font-size:16px;cursor:pointer}#cen .pn button:disabled{opacity:.35}
#cen .pd{display:flex;gap:4px}#cen .pd i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.25)}#cen .pd i.on{background:#ffd34e}#cen .pd i.h{background:#7fe3f5}#cen .pd i.on.h{background:#ffd34e}
#cen .cr{flex:1;display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0}
#cen .box{background:rgba(255,255,255,.05);border:1px solid rgba(226,191,103,.35);border-radius:12px;padding:8px}
#cen h5{margin:0 0 6px;color:#e2bf67;font-size:13px}
#cen .tm{flex:1;overflow:auto;display:flex;flex-direction:column;gap:5px;min-height:0}
#cen .tr{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border-radius:10px;padding:3px 6px}
#cen .tr canvas{width:34px;height:34px}#cen .tr span{flex:1;font-size:13px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cen .tr button,#cen .dt button{background:linear-gradient(#f39a4a,#d9532e);border:2px solid #e2bf67;color:#fff;border-radius:10px;padding:3px 10px;font-weight:700;cursor:pointer;font-size:13px;white-space:nowrap}
#cen .tr button:disabled,#cen .dt button:disabled{opacity:.4;filter:grayscale(1)}
#cen .dt{display:flex;align-items:center;gap:8px;font-size:13px}#cen .dt canvas{width:44px;height:44px}#cen .dt div{flex:1;min-width:0}
#cen .em{opacity:.7;font-size:12px}`;document.head.appendChild(css);
const box=document.createElement('div');box.id='cen';document.body.appendChild(box);
let page=0,sel=null;
const JI={chop:'🪓',mine:'⛏️',gather:'🫐',carry:'📦',cook:'🍳',water:'💧',cool:'❄️'};
const jobs=p=>Object.keys((T[p.ty]||{}).wk||{}).map(j=>JI[j]||'').join('');
const cv=(p,s)=>{const c=document.createElement('canvas');c.width=c.height=s;try{drawCrit(c,T[p.ty].c)}catch(_){}return c};
function openCen(){ivO=1;box.style.display='flex';render()}
function closeCen(){box.style.display='none';ivO=0;sel=null}
window.openCen=openCen;
function render(){const inC=pals.filter(p=>p.cs!=null),tm=palTeam(),cap=window.palCap?palCap():8;
 const pages=[...Array(NP)].map((_,k)=>inC.some(p=>p.cs>=k*PG&&p.cs<(k+1)*PG));
 box.innerHTML=`<header><b>🏠 Попал-центр</b><small>Працюють: ${inC.length} / ${CN} · 🍖 Годівниця: ${cf} · ${(inv._ch||[]).length?'📦 Скринь: '+inv._ch.length:'⚠️ Немає скрині — попалам нікуди складати здобуте'}</small><button class='cx'>✕</button></header>
 <div class='cb'><div class='cl'><div class='cg'></div><div class='pn'><button data-pg='-1' ${page?'':'disabled'}>◀</button><div class='pd'>${pages.map((h,k)=>`<i class='${k==page?'on':''} ${h?'h':''}'></i>`).join('')}</div><b>${page+1} / ${NP}</b><button data-pg='1' ${page<NP-1?'':'disabled'}>▶</button></div></div>
 <div class='cr'><div class='box dt'></div><div class='box tm'><h5>🎒 З вами (${tm.length}/${cap}) — у центрі вони працюють</h5></div></div></div>`;
 box.querySelector('.cx').onclick=closeCen;
 box.querySelectorAll('[data-pg]').forEach(b=>b.onclick=()=>{page=Math.max(0,Math.min(NP-1,page+ +b.dataset.pg));sel=null;render()});
 const g=box.querySelector('.cg');
 for(let k=0;k<PG;k++){const si=page*PG+k,p=inC.find(q=>q.cs===si),d=document.createElement('div');d.className='cs'+(p?' f':'')+(sel===si?' on':'');
  if(p){d.appendChild(cv(p,64));d.insertAdjacentHTML('beforeend',`<span class='lv'>${p.lv||1}</span><span class='jb'>${jobs(p)}</span>`)}else d.innerHTML=`<span class='pl'>＋</span>`;
  d.onclick=()=>{sel=si;render()};g.appendChild(d)}
 /* панель деталей обраного слота */
 const dt=box.querySelector('.dt'),sp=sel!=null&&inC.find(q=>q.cs===sel);
 if(sp){const t=T[sp.ty];dt.appendChild(cv(sp,88));dt.insertAdjacentHTML('beforeend',`<div><b>${t.n}</b> · рів. ${sp.lv||1}<br><span class='em'>${sp.job?'⚙️ Зараз працює':'⚙️ Працює в центрі'} ${jobs(sp)}</span></div><button data-out ${tm.length>=cap?'disabled':''}>↩ Забрати</button>`);
  dt.querySelector('[data-out]').onclick=()=>{if(palTeam().length>=cap){msg('З вами вже повна команда');return}sp.cs=null;sel=null;pwUp();hud();save();render();msg('🐾 '+t.n+' тепер з вами у сфері')}}
 else if(sel!=null)dt.innerHTML=`<div class='em'>Слот ${sel+1} вільний. Натисніть «➕ У центр» біля попала праворуч — він займе цей слот і почне працювати.</div>`;
 else dt.innerHTML=`<div class='em'>Попали в центрі працюють: рубають, добувають, збирають, готують. Оберіть слот, щоб побачити попала, або додайте попалів праворуч.</div>`;
 /* команда */
 const tl=box.querySelector('.tm');
 if(!tm.length)tl.insertAdjacentHTML('beforeend',`<div class='em'>${pals.length?'Усі ваші попали вже в центрі.':'Зловіть попала кулею 🔮 — і покладіть сюди.'}</div>`);
 for(const i of tm){const p=pals[i],r=document.createElement('div');r.className='tr';r.appendChild(cv(p,40));r.insertAdjacentHTML('beforeend',`<span>${T[p.ty].n} · рів. ${p.lv||1} ${jobs(p)}${i===selP?' · 🚶 з вами':''}</span><button>➕ У центр</button>`);
  r.querySelector('button').onclick=()=>{const want=sel!=null&&!inC.some(q=>q.cs===sel)?sel:cenFree(page*PG);if(want<0){msg('🏠 Попал-центр заповнений');return}
   p.cs=want;sel=want;page=Math.floor(want/PG);pwUp();hud();save();render();msg('🏠 '+T[p.ty].n+' тепер працює в Попал-центрі')};
  tl.appendChild(r)}}
addEventListener('keydown',e=>{if(e.key=='Escape'&&box.style.display=='flex')closeCen()});
}catch(e){console.warn('popal-center',e)}})();
