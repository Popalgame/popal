/* 0.2.9: еволюція попалів — кристали, Колба поліпшень і форми 2 й 3.
   • Кристал еволюції (cr2) — форма 2 з 25 рівня; Кристал вознесіння (cr3, рідкісніший, із сильнішого боса) — форма 3 з 50 рівня.
     Кристали не мають ваги в рюкзаку (займають лише клітинку). Поки босів немає, гравець ID 0001 отримує по 20 кожного для тестів.
   • Колба поліпшень (B_flask, world-007.js): підійдіть і натисніть «Дія» → оберіть попала → кристал → анімація перетворення.
   • Нова форма: трохи більший розмір (+6% / +12%), сяйво стихії й нові частини тіла кожного виду (pal-forms.js); сильніші атака, захист і HP (pal-growth.js).
     Рівень і атаки лишаються. Дикі попали на локаціях 1–2 завжди у формі 1. */
(function(){try{
if(typeof pals=='undefined'||typeof THREE=='undefined')return;

/* ---------- кристали: значки й предмети ---------- */
function gem(c1,c2,c3,star){const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');
 x.fillStyle='rgba(0,0,0,.28)';x.beginPath();x.ellipse(48,86,24,5,0,0,7);x.fill();
 const g=x.createRadialGradient(48,48,4,48,48,46);g.addColorStop(0,c3+'aa');g.addColorStop(1,c3+'00');x.fillStyle=g;x.fillRect(0,0,96,96);
 const P=[[48,8],[74,30],[66,80],[30,80],[22,30]];x.beginPath();P.forEach(([u,v],i)=>i?x.lineTo(u,v):x.moveTo(u,v));x.closePath();
 const f=x.createLinearGradient(20,10,76,82);f.addColorStop(0,c1);f.addColorStop(1,c2);x.fillStyle=f;x.fill();x.lineWidth=3;x.strokeStyle='rgba(26,18,22,.9)';x.stroke();
 x.fillStyle='rgba(255,255,255,.35)';x.beginPath();x.moveTo(48,8);x.lineTo(48,46);x.lineTo(22,30);x.closePath();x.fill();
 x.fillStyle='rgba(0,0,0,.18)';x.beginPath();x.moveTo(48,46);x.lineTo(66,80);x.lineTo(74,30);x.closePath();x.fill();
 x.strokeStyle='rgba(255,255,255,.5)';x.lineWidth=1.5;x.beginPath();x.moveTo(22,30);x.lineTo(48,46);x.lineTo(74,30);x.moveTo(48,46);x.lineTo(48,80);x.stroke();
 if(star){x.fillStyle='#fff';for(const[u,v,r]of[[70,16,6],[24,58,4]]){x.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?r*.3:r;x.lineTo(u+Math.cos(a)*rr,v+Math.sin(a)*rr)}x.fill()}}
 return c.toDataURL()}
const ICO={cr2:gem('#bff6ff','#2a8ee0','#7fe3f5',0),cr3:gem('#ffe9a8','#9a46e6','#d9a8ff',1)};
/* 0.2.15: кристали еволюції за стихіями. Попалу потрібен кристал своєї стихії (у двостихійних — будь-якої з двох).
   Кожен бос дає лише кристал своєї стихії: Страж ущелини — вогню, Кришталевий Владика — землі. «cr2» — універсальний: підходить будь-кому, випадає з будь-якого боса з шансом 5%. */
const CR=[['fi','Кристал вогню','#ffe0a0','#e0401a','#ff8a3a'],['wa','Кристал води','#d8f6ff','#1f7fd8','#5fc8ff'],['gr','Кристал трави','#e6ffc0','#2f9a3a','#7fe08a'],
 ['ea','Кристал землі','#ffe8c0','#9a5a24','#e0a860'],['ai','Кристал повітря','#ffffff','#7fb8d8','#cfefff'],['da','Кристал темряви','#e8d0ff','#5a2a9a','#a77ae6'],['ne','Нейтральний кристал','#ffffff','#b8b8c8','#ffe0f0']];
for(const[e,,c1,c2,c3]of CR)ICO['cr2_'+e]=gem(c1,c2,c3,0);
const CRK=CR.map(c=>'cr2_'+c[0]);window.EVO_CR=CRK;
const img=k=>`<img class='iic' src='${ICO[k]}' alt=''>`;
IT.cr2=[img('cr2'),'Універсальний кристал еволюції'];IT.cr3=[img('cr3'),'Кристал вознесіння'];for(const[e,n]of CR)IT['cr2_'+e]=[img('cr2_'+e),n];
for(const k of['cr2','cr3',...CRK])if(inv[k]==null)inv[k]=0;
try{const s=window.plIconSrc;window.plIconSrc=k=>ICO[k]||(s?s(k):null)}catch(_){}
try{const w0=window.itemW;if(w0)window.itemW=k=>k=='cr2'||k=='cr3'||/^cr2_/.test(k)?0:w0(k)}catch(_){}/* кристали не мають ваги */
/* опис у рюкзаку */
try{if(window.DS)Object.assign(window.DS,{cr2:'Друга форма будь-якого попала з 25 рівня — підходить усім стихіям. Рідкісний: випадає з будь-якого боса з шансом 5%. Використовується в Колбі поліпшень. Не має ваги',cr3:'Третя форма попала з 50 рівня. Рідкісний — із сильнішого боса. Використовується в Колбі поліпшень. Не має ваги'});
 Object.assign(window.DS,{
  cr2_fi:'Друга форма вогняного попала з 25 рівня. Випадає зі Стража ущелини. Не має ваги',
  cr2_wa:'Друга форма водяного попала з 25 рівня. Випадає з боса стихії води. Не має ваги',
  cr2_gr:'Друга форма трав’яного попала з 25 рівня. Випадає з боса стихії трави. Не має ваги',
  cr2_ea:'Друга форма земляного попала з 25 рівня. Випадає з Кришталевого Владики. Не має ваги',
  cr2_ai:'Друга форма повітряного попала з 25 рівня. Випадає з боса стихії повітря. Не має ваги',
  cr2_da:'Друга форма темного попала з 25 рівня. Випадає з боса стихії темряви. Не має ваги',
  cr2_ne:'Друга форма нейтрального попала з 25 рівня. Випадає з нейтрального боса. Не має ваги'})}catch(_){}
/* тестові кристали для гравця ID 0001 (поки немає босів) */
/* приходять листом у пошту (mail.js) */
const gift=setInterval(()=>{if(inv._crg){clearInterval(gift);return}if(window.myPid!=='0001'||!window.plMail)return;inv._crg=1;clearInterval(gift);
 window.plMail.send({from:'Розробник Regnum Land',title:'💎 Кристали для тестів',text:'Поки боси ще в роботі — ось кристали, щоб випробувати Колбу поліпшень.',items:{cr2:20,cr3:20}});
 try{msg('📬 Нова пошта: кристали для тестів')}catch(_){}},2000);

/* ---------- вигляд форм ---------- */
const ECOL={gr:0x5fdc7a,ea:0xd9a25a,fi:0xff7a2a,da:0xa77ae6,ne:0xffb8d8,ai:0xbfe8ff,wa:0x3ad0ff};
const elC=ty=>{const e=(T[ty]&&T[ty].e)||['ne'];return ty==6?0x9fe8ff:ty==7?0xffe14a:ty==1?0x7fe3f5:ECOL[e[0]]||0xffffff};
const FS=[1,1,1.06,1.12];/* форма лише трохи більша */
const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
 g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.4,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
const add_=(o,c)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
/* загальні ознаки форми (аура під ногами, іскри); особливі частини тіла кожного виду — pal-forms.js. h — висота моделі, c — колір стихії */
function formFx(fm,h,c){const g=new THREE.Group();g.name='formFx';const u={spin:[],orbit:[],bob:[]};
 const aura=new THREE.Mesh(new THREE.RingGeometry(.45,.62,40),add_(.55,c));aura.rotation.x=-Math.PI/2;aura.position.y=.04;g.add(aura);u.spin.push(aura);
 const disc=new THREE.Mesh(new THREE.CircleGeometry(.62,40),add_(.16,c));disc.rotation.x=-Math.PI/2;disc.position.y=.03;g.add(disc);
 /* іскри навколо */
 const no=fm>=3?4:2;for(let i=0;i<no;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:c,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));s.scale.setScalar(.22);s.userData.ph=i/no*Math.PI*2;s.userData.r=.55;s.userData.y=h*.55;g.add(s);u.orbit.push(s)}
 g.userData.u=u;return g}
/* висота моделі попала: габарити (раз на зміну моделі) */
const _b=new THREE.Box3(),_v=new THREE.Vector3();
function modelH(m,ex){let h=1;try{const s=m.scale.x||1;ex.visible=false;_b.setFromObject(m);ex.visible=true;_b.getSize(_v);if(isFinite(_v.y)&&_v.y>.1)h=_v.y/s}catch(_){}return Math.min(2.6,Math.max(.5,h))}
function applyForm(o,fm,ty){const m=o.m||o;let fx=m.getObjectByName('formFx');const want=fm>=2;
 if(!want){if(fx){m.remove(fx);fx.traverse(q=>{if(q.geometry)q.geometry.dispose();if(q.material)q.material.dispose()})}m.userData.fmApplied=fm;return}
 const key=fm+':'+m.children.length;if(fx&&m.userData.fmKey===key)return;if(fx){m.remove(fx);fx.traverse(q=>{if(q.geometry)q.geometry.dispose();if(q.material)q.material.dispose()})}
 const tmp=new THREE.Group();m.add(tmp);const h=modelH(m,tmp);m.remove(tmp);fx=formFx(fm,h,elC(ty));m.add(fx);m.userData.fmKey=key;m.userData.fmApplied=fm}
/* попали гравця: аксесуари й масштаб форми */
setInterval(()=>{const PF=window.PALFORM;if(PF){for(const p of pals)if(p._hi)PF.ensure(p._hi,p.ty,p.fm||1);for(const w of(typeof wild!='undefined'?wild:[]))if(w._hi)PF.ensure(w._hi,w.ty,w.fm||1)}/* моделі з пулу — потрібна форма; дикі — форма 1, бос — своя (boss.js) */
 for(const p of pals){if(!p.m)continue;const fm=p.fm||1,fs=FS[fm]||1;applyForm(p,fm,p.ty);
 if(p._s0!==fs){const was=p._s0||1;p._s0=fs;if(Math.abs(p.m.scale.x-was)<.01)p.m.scale.setScalar(fs)}}},600);
/* анімація аксесуарів */
ANI.push(()=>{const t=performance.now()/1000;
 const run=m=>{const fx=m&&m.getObjectByName('formFx');if(!fx||!fx.visible)return;const u=fx.userData.u;
  for(const a of u.spin)a.rotation.z=t*1.2;for(const b of u.bob)b.position.y+=Math.sin(t*2.4)*.0015;
  for(const s of u.orbit){const a=t*1.6+s.userData.ph;s.position.set(Math.cos(a)*s.userData.r,s.userData.y+Math.sin(t*3+s.userData.ph)*.12,Math.sin(a)*s.userData.r)}
};
 for(const p of pals)if(p.m&&p.m.visible)run(p.m);if(anim)run(anim.r.root)});

/* ---------- значок Колби: знімок справжньої 3D-моделі (у крафті, рюкзаку, будові) ---------- */
function flaskIcon(){try{if(!window.mkBuilding)return;const S=192,cv=document.createElement('canvas');cv.width=cv.height=S;
 const rr=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:true,preserveDrawingBuffer:true});rr.setPixelRatio(1);rr.setSize(S,S,false);rr.setClearColor(0,0);if('outputEncoding' in rr)rr.outputEncoding=THREE.sRGBEncoding;
 const s=new THREE.Scene();s.add(new THREE.HemisphereLight(0xffffff,0x5a6a80,1.15));const k=new THREE.DirectionalLight(0xffffff,1.2);k.position.set(3,5,4);s.add(k);const k2=new THREE.DirectionalLight(0x9fe8ff,.5);k2.position.set(-3,2,-2);s.add(k2);
 const g=window.mkBuilding('B_flask');g.rotation.y=-.5;s.add(g);g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g),c=b.getCenter(new THREE.Vector3()),z=b.getSize(new THREE.Vector3());
 const cam=new THREE.PerspectiveCamera(26,1,.05,100),d=Math.max(z.x,z.y,z.z)*.53/Math.tan(13*Math.PI/180);cam.position.set(c.x,c.y+d*.35,c.z+d);cam.lookAt(c.x,c.y-.05,c.z);rr.render(s,cam);
 const o=document.createElement('canvas');o.width=o.height=96;const x=o.getContext('2d');x.fillStyle='rgba(0,0,0,.3)';x.beginPath();x.ellipse(48,87,24,6,0,0,7);x.fill();
 /* темний контур, як у намальованих значків гри (icons.js) */const sil=document.createElement('canvas');sil.width=sil.height=96;const y=sil.getContext('2d');y.drawImage(cv,0,0,96,96);y.globalCompositeOperation='source-in';y.fillStyle='rgba(26,18,22,.92)';y.fillRect(0,0,96,96);
 for(const[dx,dy]of[[-2,0],[2,0],[0,-2],[0,2],[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]])x.drawImage(sil,dx,dy);x.drawImage(cv,0,0,96,96);
 const url=o.toDataURL('image/png');rr.dispose();rr.forceContextLoss();g.traverse(m=>{if(m.geometry)m.geometry.dispose()});
 ICO.B_flask=url;if(IT.B_flask)IT.B_flask[0]=`<img class='iic' src='${url}' alt=''>`;try{if(typeof ivO!='undefined'&&ivO&&typeof ivR=='function')ivR()}catch(_){}}catch(e){console.warn('flask icon',e)}}
if(document.readyState=='complete')setTimeout(flaskIcon,900);else addEventListener('load',()=>setTimeout(flaskIcon,900));

/* ---------- Колба поліпшень ---------- */
const flasks=()=>(window.BPLACED||[]).filter(b=>b.id=='B_flask');
const nearFlask=()=>flasks().find(b=>Math.hypot(b.x-P.x,b.z-P.z)<2.9);
const NEED={2:[25,'cr2'],3:[50,'cr3']};
/* який кристал потрібен попалу: для форми 2 — кристал своєї стихії (або універсальний), для форми 3 — кристал вознесіння */
const elsOf=p=>((T[p.ty]||{}).e&&T[p.ty].e.length?T[p.ty].e:['ne']);
const want=(p,f)=>f==2?elsOf(p).map(e=>'cr2_'+e):[NEED[f][1]];
const pick=(p,f)=>{const w=want(p,f);for(const k of w)if(inv[k]>0)return k;if(f==2&&inv.cr2>0)return'cr2';return null};
const css=document.createElement('style');css.textContent=`
#evo{display:none;position:fixed;left:calc(env(safe-area-inset-left,0px) + 10%);right:calc(env(safe-area-inset-right,0px) + 10%);top:calc(env(safe-area-inset-top,0px) + 6%);bottom:calc(env(safe-area-inset-bottom,0px) + 6%);z-index:36;flex-direction:column;background:rgba(14,20,42,.96);border:2px solid #7fe3f5;border-radius:16px;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.5);overflow:hidden}
#evo header{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(127,227,245,.4)}#evo header b{flex:1;font-size:18px;color:#bff6ff}
#evo .cx{background:none;border:none;color:#7fe3f5;font-size:24px;cursor:pointer}
#evo .cr{display:flex;flex-wrap:wrap;gap:8px 14px;justify-content:center;padding:8px 12px;font-size:15px}#evo .cr span{display:flex;align-items:center;gap:6px}#evo .cr img{width:30px;height:30px}
#evo .ls{overflow:auto;padding:4px 12px 12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
#evo .pc{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.06);border:1px solid rgba(127,227,245,.3);border-radius:12px;padding:6px 8px}
#evo .pc .ic{width:44px;height:44px;flex:none;display:flex;align-items:center;justify-content:center;font-size:30px}#evo .pc .ic img{width:44px;height:44px}
#evo .pc .tx{flex:1;font-size:13px;line-height:1.3}#evo .pc .tx b{color:#ffe7a8}#evo .pc .tx small{display:block;opacity:.75}
#evo .pc button{background:linear-gradient(#4fd0f0,#2a7ec8);border:2px solid #bff6ff;color:#fff;border-radius:10px;padding:5px 9px;font-weight:800;cursor:pointer;font-family:inherit;font-size:13px}#evo .pc button:disabled{opacity:.35;filter:grayscale(1)}
#evo .em{opacity:.7;font-size:12px;padding:0 14px 10px;text-align:center}`;document.head.appendChild(css);
const box=document.createElement('div');box.id='evo';document.body.appendChild(box);
let open=0;
function render(){const cr=k=>`<span>${img(k)} <b>${inv[k]||0}</b> ${IT[k][1]}</span>`;
 const rows=pals.map((p,i)=>{const fm=p.fm||1,nx=fm+1,nd=NEED[nx],nm=(T[p.ty]||{}).n,lv=p.lv||1;let why='',ok=0;
  if(!nd)why='Максимальна форма';else if(lv<nd[0])why=`Потрібен ${nd[0]} рівень`;else if(!pick(p,nx))why=`Потрібен ${want(p,nx).map(k=>IT[k][1]).join(' або ')}`;else ok=1;
  const ico=(typeof EM!='undefined'&&EM[p.ty])||'🐾';
  return`<div class='pc'><div class='ic'>${ico}</div><div class='tx'><b>${nm}</b> · ${lv} рів.<small>Форма ${fm}${nd?' → '+nx+' · '+(ok?'готовий':why):' · '+why}</small></div><button data-e='${i}' ${ok?'':'disabled'}>🧪 Еволюція</button></div>`}).join('');
 box.innerHTML=`<header><b>🧪 Колба поліпшень</b><button class='cx'>✕</button></header><div class='cr'>${['cr2',...CRK,'cr3'].filter(k=>inv[k]>0).map(cr).join('')||'<small>Кристалів поки немає — вони випадають із босів</small>'}</div>
 <div class='ls'>${rows||'<small>Поки немає попалів</small>'}</div>
 <div class='em'>Форма 2 — з 25 рівня й кристал стихії попала (вогню, води, трави…). Кожен бос дає кристал своєї стихії. Форма 3 — з 50 рівня й Кристал вознесіння. Кристали випадають із босів. Рівень і атаки попала зберігаються</div>`}
function show(v){open=v;box.style.display=v?'flex':'none';if(v)render()}
box.addEventListener('click',e=>{if(e.target.closest('.cx')){show(0);return}const b=e.target.closest('[data-e]');if(!b||b.disabled)return;const p=pals[+b.dataset.e];if(p)evolve(p)});
const hb=document.getElementById('hit');
if(hb){const h0=hb.onclick;hb.onclick=function(){if(nearFlask()&&!(typeof nearest=='function'&&nearest(wild,2.6))&&!anim){show(1);return}return h0&&h0.apply(this,arguments)};
 let was=null,hit0=null;ANI.push(()=>{const n=!!nearFlask();if(n===was)return;was=n;if(n){hit0=hb.innerHTML;hb.innerHTML='🧪<small>Колба</small>'}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}})}

/* ---------- перетворення ---------- */
let anim=null;
function evolve(p){const fm=p.fm||1,nd=NEED[fm+1],b=nearFlask()||flasks()[0];const ck=nd?pick(p,fm+1):null;if(!nd||!b||(p.lv||1)<nd[0]||!ck||anim)return;
 inv[ck]--;show(0);
 let r=null;try{r=window.PALMODEL?PALMODEL.build(p.ty):null}catch(_){r=null}
 const root=r?r.root:new THREE.Mesh(new THREE.SphereGeometry(.4,16,12),new THREE.MeshStandardMaterial({color:T[p.ty].c}));
 const base=.62;if(r&&window.PALFORM)window.PALFORM.ensure(r,p.ty,fm);root.scale.setScalar(base);applyForm(root,fm,p.ty);
 const fl=b.g.userData.flask||{},y0=b.g.position.y;root.position.set(b.x,y0+.55,b.z);sc.add(root);
 const c=elC(p.ty),beam=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,6,24,1,true),add_(0,c));beam.position.set(b.x,y0+3,b.z);sc.add(beam);
 const flash=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),add_(0,0xffffff));flash.position.set(b.x,y0+1.2,b.z);sc.add(flash);
 const sparks=[];for(let i=0;i<18;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:i%3?c:0xffffff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));s.scale.setScalar(.25);s.userData={a:Math.random()*6.28,r:.35+Math.random()*.25,v:.6+Math.random(),y:Math.random()};sc.add(s);sparks.push(s)}
 const nm=(T[p.ty]||{}).n;try{msg('🧪 '+nm+' у Колбі поліпшень…');if(window.PSFX)PSFX.sfx('build')}catch(_){}
 anim={p,r,root,beam,flash,sparks,fl,b,t:0,done:0,base,c,y0,to:fm+1}}
/* 0.2.10: поки попал у Колбі — справжній попал зникає з поля (він «переміщений» у колбу), а після еволюції з'являється біля колби */
ANI.push(()=>{if(!anim)return;const A=anim;if(A.p.m&&!A.done)A.p.m.scale.setScalar(.0001)});
ANI.push(()=>{if(!anim)return;const A=anim,dt=Math.min(.05,(performance.now()-(A.lt||performance.now()))/1000);A.lt=performance.now();A.t+=dt;const t=A.t,R=A.root;
 const k1=Math.min(1,t/1.3);R.position.y=A.y0+.55+k1*.55+Math.sin(t*3)*.04;R.rotation.y+=dt*(1.5+t*3);
 if(A.fl.lq){A.fl.lq.material.emissiveIntensity=.9+Math.min(2.2,t*1.1)*(t<3?1:Math.max(0,(4.4-t)/1.4));A.fl.lq.scale.y=1+Math.min(1.4,t*.6)*(t<3?1:Math.max(0,(4.4-t)/1.4))}
 if(A.fl.tip)A.fl.tip.material.emissiveIntensity=1.4+Math.sin(t*14)*.8;
 A.beam.material.opacity=Math.min(.45,t*.25)*(t<3?1:Math.max(0,(4.4-t)/1.4));A.beam.scale.set(1+Math.sin(t*9)*.08,1,1+Math.sin(t*9)*.08);
 for(const s of A.sparks){const u=s.userData;u.y=(u.y+dt*u.v*(.5+t*.4))%1;const a=u.a+t*(2+t);s.position.set(A.b.x+Math.cos(a)*u.r,A.y0+.5+u.y*1.4,A.b.z+Math.sin(a)*u.r);s.material.opacity=Math.min(1,t)*(t<3.2?1:Math.max(0,(4.4-t)/1.2))}
 if(t>2.4&&t<3){const q=(t-2.4)/.6;R.scale.setScalar(A.base*(1+Math.sin(q*Math.PI*6)*.12*q))}
 if(t>=3&&!A.done){A.done=1;if(A.p.m)A.p.m.scale.setScalar(.0001);A.p.fm=A.to;if(A.r&&window.PALFORM)window.PALFORM.ensure(A.r,A.p.ty,A.to);applyForm(R,A.to,A.p.ty);R.scale.setScalar(A.base*FS[A.to]);try{save();if(window.PSFX)PSFX.sfx('level')}catch(_){}}
 if(t>2.85&&t<3.6){const q=(t-2.85)/.75;A.flash.scale.setScalar(.3+q*2.6);A.flash.material.opacity=.9*(1-q)}else A.flash.material.opacity=0;
 if(t>=4.6){for(const o of[A.beam,A.flash,...A.sparks]){sc.remove(o);if(o.geometry&&!o.isSprite)o.geometry.dispose();o.material.dispose()}
  sc.remove(R);try{if(A.r&&window.PALMODEL)PALMODEL.dispose(A.r)}catch(_){}
  if(A.p.m){const fs=FS[A.to]||1;A.p._s0=fs;A.p.m.scale.setScalar(fs);A.p.x=A.b.x+1.2;A.p.z=A.b.z+1.2;A.p.m.position.set(A.p.x,H(A.p.x,A.p.z),A.p.z)}if(A.fl.lq){A.fl.lq.scale.y=1;A.fl.lq.material.emissiveIntensity=.9}
  try{msg('🎉 '+(T[A.p.ty]||{}).n+' еволюціонував — тепер форма '+A.to+'! Сильніші атака, захист і здоров’я')}catch(_){}anim=null}});
window.EVOLUTION={evolve,applyForm,show:()=>show(1),FS,NEED};
}catch(e){console.warn('evolution',e)}})();
