/* 0.1.17: Попал-центр — серце бази гравця. Крафтиться (20 🪵 + 15 🪨) і ставиться один раз будь-де на суші.
   Навколо нього будується база. Попали лежать у сховищі центру (8 сторінок по 30 слотів); працюють лише ті, що в бригаді (0.1.21).
   Решта попалів — з гравцем у сфері (команда, яку можна призивати). */
(function(){try{
const CN=240,PG=30,NP=CN/PG,NEAR=3.2;
/* 0.1.21: рівень центру визначає, скільки попалів працює (бригада). Поки що є лише 1 рівень — 2 працівники, підвищення з'явиться пізніше.
   Решта попалів у сховищі центру відпочиває. */
const LVW=[0,2],cenLv=()=>1,wMax=()=>LVW[cenLv()]||2;window.cenLv=cenLv;window.cenWMax=wMax;
const crew=()=>pals.filter(p=>p.cs!=null&&p.wk);
/* перехід із 0.1.17–0.1.20, де працювали всі попали в центрі: на роботі лишаються перші двоє */
if(!inv._wkM){inv._wkM=1;if(!crew().length)pals.filter(p=>p.cs!=null).sort((a,b)=>a.cs-b.cs).slice(0,LVW[1]).forEach(p=>p.wk=1)}
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
/* 0.1.27: спершу передперегляд (place.js) з кільцем майбутньої бази, тоді встановлення */
function placeCen(){if(inv._cen){msg('🏠 Попал-центр уже стоїть — він може бути лише один');return}if(!(inv.B_cen>0))return;
 if(window.plPlace){plPlace({name:'🏠 Попал-центр',r:2.2,dist:4,center:true,mk:()=>{const o=orb,r=ring,g=mkCen();orb=o;ring=r;return g},onOk:(x,z)=>doPlaceCen(x,z)});return}
 doPlaceCen(P.x+Math.sin(P.face||0)*3,P.z+Math.cos(P.face||0)*3)}
function doPlaceCen(x,z){if(inv._cen||!(inv.B_cen>0))return;if(H(x,z)<-.3){msg('🌊 Попал-центр не можна ставити у воді');return}
 inv.B_cen--;inv._cen=[+x.toFixed(2),+z.toFixed(2)];showCen();if(window.respawnB)respawnB();
 /* перший центр: попали, які раніше працювали в таборі (усі, крім того, що з вами), переходять у центр */
 if(!inv._cenM){inv._cenM=1;const keep=pals[selP];for(const p of pals){if(p!==keep&&p.cs==null){const f=cenFree();if(f>=0){p.cs=f;if(crew().length<wMax())p.wk=1}}}}
 pwUp();hud();save();msg('🏠 Попал-центр збудовано! Біля нього натисніть «Дія» й поставте попалів у бригаду — вони почнуть працювати');if(window.plBurst)plBurst(x,H(x,z)+2,z,0x7fe3f5,40,3.5,.5)}
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
#cen .dt{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;font-size:13px}#cen .dt canvas{width:44px;height:44px;flex:none}#cen .dt div{flex:1 1 120px;min-width:0;line-height:1.35}#cen .dt button{flex:1 1 auto}
#cen .em{opacity:.7;font-size:12px}
#cen .tabs{display:flex;gap:6px;flex:1}#cen .tabs button{background:rgba(255,255,255,.06);border:2px solid rgba(226,191,103,.45);color:#e8dcc0;border-radius:10px;padding:4px 14px;font-weight:700;cursor:pointer;font-family:inherit;font-size:14px}
#cen .tabs button.on{background:linear-gradient(#f39a4a,#d9532e);color:#fff;border-color:#e2bf67}#cen .lvb{font-size:12px;color:#ffe7a8;background:rgba(226,191,103,.15);border:1px solid rgba(226,191,103,.5);border-radius:8px;padding:2px 8px;white-space:nowrap}
#cen .cw{display:flex;flex-direction:column;gap:8px;flex:1.35;min-width:0;overflow:auto}
#cen .wg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
#cen .wc{position:relative;border:2px solid #3a8ee6;border-radius:14px;background:rgba(58,142,230,.14);padding:8px 10px;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;min-height:96px;min-width:0}
#cen .wc.e{border-style:dashed;border-color:rgba(127,227,245,.4);background:rgba(127,227,245,.04);justify-content:center;opacity:.8;font-size:13px}
#cen .wc canvas{width:56px;height:56px;flex:none}#cen .wc div{flex:1;min-width:0;font-size:12.5px;line-height:1.35}#cen .wc b{font-size:15px}
#cen .wc button{flex-basis:100%;background:linear-gradient(#5a6a8a,#3a4560);border:2px solid #e2bf67;color:#fff;border-radius:10px;padding:3px 8px;font-weight:700;cursor:pointer;font-size:12px;white-space:nowrap}
#cen .lk{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}#cen .lk div{border:2px dashed rgba(255,255,255,.15);border-radius:12px;padding:8px 4px;text-align:center;font-size:11px;opacity:.55}
#cen .cs .wb{position:absolute;right:3px;top:1px;font-size:12px}`;document.head.appendChild(css);
const box=document.createElement('div');box.id='cen';document.body.appendChild(box);
let page=0,sel=null,tab=0;
const JI={chop:'🪓',mine:'⛏️',gather:'🫐',carry:'📦',cook:'🍳',water:'💧',cool:'❄️'},JN={chop:'рубає дерева',mine:'добуває камінь',gather:'збирає ягоди й гриби',carry:'носить їжу в годівницю',cook:'готує їжу'};
const jobs=p=>Object.keys((T[p.ty]||{}).wk||{}).map(j=>JI[j]||'').join('');
const crL=p=>`🎒 Перенос Lv${p.cr||1} (${window.palCarry?palCarry(p):5} кг)`;
const cv=(p,s)=>{const c=document.createElement('canvas');c.width=c.height=s;try{drawCrit(c,T[p.ty].c)}catch(_){}return c};
function openCen(){ivO=1;box.style.display='flex';render()}
function closeCen(){box.style.display='none';ivO=0;sel=null}
window.openCen=openCen;
setInterval(()=>{if(box.style.display=='flex'&&tab==0)render()},1000);
const done=t=>{pwUp();hud();save();render();if(t)msg(t)};
/* поставити попала в бригаду (з команди — спершу в сховище) */
function toCrew(p){if(crew().length>=wMax()){msg('⚒️ У бригаді вже '+wMax()+' попали — це максимум для рівня '+cenLv());return}
 if(p.cs==null){const f=cenFree();if(f<0){msg('🏠 Попал-центр заповнений');return}p.cs=f}p.wk=1;done('⚒️ '+T[p.ty].n+' у бригаді — працює на базі')}
function offCrew(p){p.wk=0;done('🗄️ '+T[p.ty].n+' відпочиває у сховищі')}
function head(){const inC=pals.filter(p=>p.cs!=null);return `<header><div class='tabs'><button data-tab='0' class='${tab==0?'on':''}'>⚒️ Бригада ${crew().length}/${wMax()}</button><button data-tab='1' class='${tab==1?'on':''}'>🗄️ Сховище ${inC.length}/${CN}</button></div>
 <span class='lvb'>🏠 Рівень ${cenLv()}</span><small>🍖 ${cf} · ${(inv._ch||[]).length?'📦 '+inv._ch.length:'⚠️ Немає скрині'}</small><button class='cx'>✕</button></header>`}
function render(){box.innerHTML=head()+(tab==0?crewHTML():storeHTML());box.querySelector('.cx').onclick=closeCen;
 box.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=+b.dataset.tab;sel=null;render()});
 if(tab==0)crewBind();else storeBind()}
/* ---------- вкладка «Бригада» ---------- */
function crewHTML(){return `<div class='cb'><div class='cw'><div class='wg'></div>
 <div class='box em'>⚒️ Бригада працює лише на території бази (30 м від центру): рубає, добуває, збирає й носить усе у скрині. Скільки попал несе за раз — залежить від його рівня перенесення. На ${cenLv()}-му рівні центру працюють лише ${wMax()}.</div>
 <div class='lk'>${[2,3,4,5].map(l=>`<div>🔒 Рівень ${l}<br>більше місць</div>`).join('')}</div><div class='em' style='text-align:center'>Підвищення рівня Попал-центру з'явиться пізніше</div></div>
 <div class='cr'><div class='box tm'><h5>Кого поставити на роботу</h5></div></div></div>`}
function crewBind(){const g=box.querySelector('.wg'),cr=crew();
 for(let k=0;k<wMax();k++){const p=cr[k],d=document.createElement('div');
  if(p){d.className='wc';d.appendChild(cv(p,96));d.insertAdjacentHTML('beforeend',`<div><b>${T[p.ty].n}</b><br>рів. ${p.lv||1} · ${jobs(p)}<br>${crL(p)}${window.palLoad?' · вантаж '+(Math.round(palLoad(p)*10)/10)+' кг':''}<br><span class='em'>${p.st||'⚙️ Береться до роботи'}</span></div><button>↩ Відпочити</button>`);d.querySelector('button').onclick=()=>offCrew(p)}
  else{d.className='wc e';d.textContent='＋ Вільне місце — оберіть попала праворуч'}
  g.appendChild(d)}
 const tl=box.querySelector('.tm'),full=cr.length>=wMax();
 const cand=pals.filter(p=>!(p.cs!=null&&p.wk)).sort((a,b)=>(a.cs==null)-(b.cs==null));
 if(!cand.length)tl.insertAdjacentHTML('beforeend',`<div class='em'>${pals.length?'Усі ваші попали вже в бригаді.':'Зловіть попала кулею 🔮 — і поставте сюди.'}</div>`);
 for(const p of cand){const i=pals.indexOf(p),r=document.createElement('div');r.className='tr';r.appendChild(cv(p,40));
  r.insertAdjacentHTML('beforeend',`<span>${T[p.ty].n} · рів. ${p.lv||1} ${jobs(p)}<br><small class='em'>${crL(p)} · ${p.cs!=null?'🗄️ у сховищі':i===selP?'🚶 з вами':'🔮 з вами у сфері'}</small></span><button ${full?'disabled':''}>⚒️ На роботу</button>`);
  r.querySelector('button').onclick=()=>toCrew(p);tl.appendChild(r)}}
/* ---------- вкладка «Сховище» ---------- */
function storeHTML(){const inC=pals.filter(p=>p.cs!=null),pages=[...Array(NP)].map((_,k)=>inC.some(p=>p.cs>=k*PG&&p.cs<(k+1)*PG));
 return `<div class='cb'><div class='cl'><div class='cg'></div><div class='pn'><button data-pg='-1' ${page?'':'disabled'}>◀</button><div class='pd'>${pages.map((h,k)=>`<i class='${k==page?'on':''} ${h?'h':''}'></i>`).join('')}</div><b>${page+1} / ${NP}</b><button data-pg='1' ${page<NP-1?'':'disabled'}>▶</button></div></div>
 <div class='cr'><div class='box dt'></div><div class='box tm'><h5>🎒 З вами (${palTeam().length}/${window.palCap?palCap():8})</h5></div></div></div>`}
function storeBind(){const inC=pals.filter(p=>p.cs!=null),tm=palTeam(),cap=window.palCap?palCap():8;
 box.querySelectorAll('[data-pg]').forEach(b=>b.onclick=()=>{page=Math.max(0,Math.min(NP-1,page+ +b.dataset.pg));sel=null;render()});
 const g=box.querySelector('.cg');
 for(let k=0;k<PG;k++){const si=page*PG+k,p=inC.find(q=>q.cs===si),d=document.createElement('div');d.className='cs'+(p?' f':'')+(sel===si?' on':'');
  if(p){d.appendChild(cv(p,64));d.insertAdjacentHTML('beforeend',`<span class='lv'>${p.lv||1}</span><span class='jb'>${jobs(p)}</span>${p.wk?"<span class='wb'>⚒️</span>":''}`)}else d.innerHTML=`<span class='pl'>＋</span>`;
  d.onclick=()=>{sel=si;render()};g.appendChild(d)}
 const dt=box.querySelector('.dt'),sp=sel!=null&&inC.find(q=>q.cs===sel);
 if(sp){const t=T[sp.ty];dt.appendChild(cv(sp,88));dt.insertAdjacentHTML('beforeend',`<div><b>${t.n}</b> · рів. ${sp.lv||1}<br><span class='em'>${sp.wk?'⚒️ У бригаді — працює':'🗄️ Відпочиває'} ${jobs(sp)}<br>${crL(sp)}</span></div>${sp.wk?"<button data-off>↩ Відпочити</button>":`<button data-on ${crew().length>=wMax()?'disabled':''}>⚒️ На роботу</button>`}<button data-out ${tm.length>=cap?'disabled':''}>🎒 Забрати</button>`);
  const on=dt.querySelector('[data-on]'),off=dt.querySelector('[data-off]');if(on)on.onclick=()=>toCrew(sp);if(off)off.onclick=()=>offCrew(sp);
  dt.querySelector('[data-out]').onclick=()=>{if(palTeam().length>=cap){msg('З вами вже повна команда');return}sp.cs=null;sp.wk=0;sel=null;done('🐾 '+t.n+' тепер з вами у сфері')}}
 else if(sel!=null)dt.innerHTML=`<div class='em'>Слот ${sel+1} вільний. Натисніть «➕ У сховище» біля попала праворуч.</div>`;
 else dt.innerHTML=`<div class='em'>У сховищі попали відпочивають. Працюють лише ті, що в бригаді (вкладка «⚒️ Бригада»). Оберіть слот, щоб побачити попала.</div>`;
 const tl=box.querySelector('.tm');
 if(!tm.length)tl.insertAdjacentHTML('beforeend',`<div class='em'>${pals.length?'Усі ваші попали вже в центрі.':'Зловіть попала кулею 🔮 — і покладіть сюди.'}</div>`);
 for(const i of tm){const p=pals[i],r=document.createElement('div');r.className='tr';r.appendChild(cv(p,40));r.insertAdjacentHTML('beforeend',`<span>${T[p.ty].n} · рів. ${p.lv||1} ${jobs(p)}${i===selP?' · 🚶 з вами':''}</span><button>➕ У сховище</button>`);
  r.querySelector('button').onclick=()=>{const want=sel!=null&&!inC.some(q=>q.cs===sel)?sel:cenFree(page*PG);if(want<0){msg('🏠 Попал-центр заповнений');return}
   p.cs=want;p.wk=0;sel=want;page=Math.floor(want/PG);done('🗄️ '+T[p.ty].n+' у сховищі Попал-центру')};
  tl.appendChild(r)}}
addEventListener('keydown',e=>{if(e.key=='Escape'&&box.style.display=='flex')closeCen()});
}catch(e){console.warn('popal-center',e)}})();
