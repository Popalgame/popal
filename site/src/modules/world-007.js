/* 0.0.7 — будівлі, рівень табору, стихійні атаки, рівні попалів, день і ніч, міні-карта */
(function(){try{
const FIRE=new THREE.MeshStandardMaterial({color:0xff8a3a,emissive:0xff5a10,emissiveIntensity:1.4}),LAMP=new THREE.MeshStandardMaterial({color:0xffe0a0,emissive:0xffb050,emissiveIntensity:1.2});
const BUI=[
{id:'B_bed',n:'Ліжко',i:'🛏️',c:{w:5,sti:2},d:'Уночі біля ліжка натисніть «Дія», щоб проспати до ранку',p:2,u:1},
{id:'B_kit',n:'Кухня-багаття',i:'🍲',c:{s:4,w:3},d:'Котелок над багаттям. Без неї їжу не приготувати: тут готуєте ви й попали-кухарі',p:2,u:1},
{id:'B_wb',n:'Верстак',i:'🪚',c:{w:8,s:4,sti:2},d:'Біля нього крафтять зелені кулі. Відкриває металеві інструменти й рюкзак слідопита',p:3,u:1},
{id:'B_wb2',n:'Верстак II',i:'⚒️',c:{w:10,s:8,ing:4},d:'Біля нього крафтять сині кулі',p:3,u:1},/* 0.5.x: верстаки за рівнем — кулі за рідкістю (benches.js) */
{id:'B_wb3',n:'Верстак III',i:'🛠️',c:{w:12,s:12,ing:10,coal:4},d:'Біля нього крафтять червоні кулі',p:4,u:1},
{id:'B_nest2',n:'Мала лежанка',i:'🪺',c:{w:6,sti:3},d:'Тут відпочивають 2 попали з бригади',p:1},
{id:'B_nest5',n:'Лежанка',i:'🛏️',c:{w:10,sti:4,wool:4},d:'Тут відпочивають 5 попалів з бригади',p:2},
{id:'B_rep',n:'Ремонтний верстак',i:'🔧',c:{w:6,s:5,sti:3},d:'Лагодить сокири й кирки: підійдіть і натисніть «Дія»',p:2,u:1},/* 0.1.29: repair-bench.js */
{id:'B_fur',n:'Плавильня',i:'🏭',c:{s:10,w:4},d:'Відкриває залізні злитки',p:3,u:1},
{id:'B_garden',n:'Грядка',i:'🌱',c:{w:8,s:2,sd:2},d:'6 лунок для насіння ягід. Садіть і збирайте самі — або це зробить попал-збирач',p:2},/* 0.5.x: замість старої «Ягідної грядки» (garden.js) */
{id:'B_lamp',n:'Ліхтар',i:'🏮',c:{w:2,s:1},d:'Світить уночі',p:1},
{id:'B_fen',n:'Паркан',i:'🚧',c:{w:4},d:'Прикрашає базу',p:1}];
const BI={};BUI.forEach(b=>{BI[b.id]=b;IT[b.id]=[b.i,b.n];if(inv[b.id]==null)inv[b.id]=0});
if(!Array.isArray(inv._b))inv._b=[];
/* 0.5.x: стара «Ягідна грядка» стає новою грядкою */
if(inv.B_farm){inv.B_garden=(inv.B_garden||0)+inv.B_farm;inv.B_farm=0}inv._b.forEach(b=>{if(b[0]=='B_farm')b[0]='B_garden'});
RC.push(...BUI.map(b=>({id:b.id,n:b.n,c:b.c,d:b.d+' · +'+b.p+' до бази',bld:1})));
const REQ={bg:'B_wb',bb:'B_wb2',br:'B_wb3',B_wb2:'B_wb',B_wb3:'B_wb2',B_nest5:'B_wb',axm:'B_wb',pkm:'B_wb',bp3:'B_wb',ing:'B_fur',gm:'B_kit',pie:'B_kit'}/* 0.1.28: їжу готують лише на кухні-багатті */;
const built=id=>inv._b.some(x=>x[0]==id);window.isBuilt=built;
const LV=[0,2,5,9,14];
window.campPts=()=>inv._b.reduce((a,x)=>a+(BI[x[0]]?BI[x[0]].p:0),0);
window.campLv=()=>{const p=campPts();let l=1;LV.forEach((t,i)=>{if(p>=t)l=i+1});return l};
window.palCap=()=>8+2*(campLv()-1);
/* ---------- будівлі ---------- */
/* 0.1.17: будівлі стоять кільцем навколо Попал-центру */
const SLOTS=[];for(let k=0;k<28;k++)SLOTS.push(k/28*Math.PI*2);
const spos=si=>{const a=SLOTS[si%SLOTS.length],r=si%2?9.8:7.4,C=inv._cen||[0,0];return[C[0]+Math.cos(a)*r,C[1]+Math.sin(a)*r]};
function mkB(id){const g=new THREE.Group(),W=0x8e5a3a,D=0x5a3418,ST=0x8b8f9a;
if(id=='B_bed'){add(g,B(1,.25,1.8),W,0,.18,0);add(g,B(.9,.15,1.7),0xf4ede0,0,.37,0);add(g,B(.7,.12,.35),0xffffff,0,.48,-.62);add(g,B(.92,.1,1.05),0x5b6bd6,0,.47,.3);add(g,B(1,.6,.1),W,0,.4,-.9)}
else if(id=='B_kit'){for(let i=0;i<8;i++){const a=i/8*6.28;add(g,S(.14),ST,Math.cos(a)*.5,.1,Math.sin(a)*.5)}add(g,Cy(.28,.22,.3,10),0x3a3a44,0,.62,0);for(const a of[0,2.1,4.2])add(g,Cy(.03,.03,1.2,5),D,Math.cos(a)*.38,.55,Math.sin(a)*.38).rotation.set(Math.sin(a)*.35,0,-Math.cos(a)*.35);const f=new THREE.Mesh(Co(.18,.42,6),FIRE);f.position.y=.24;g.add(f);g.userData.fire=f}
else if(id=='B_wb'){add(g,B(1.4,.12,.7),W,0,.8,0);for(const x of[-.6,.6])for(const z of[-.28,.28])add(g,B(.1,.8,.1),D,x,.4,z);add(g,B(.5,.04,.2),0xc8cdd8,-.3,.88,.1);add(g,Cy(.03,.03,.4,6),D,.35,.9,0).rotation.z=Math.PI/2;add(g,B(.12,.08,.06),0x8a8f9e,.55,.9,0)}
else if(id=='B_rep'){add(g,B(1.3,.12,.7),W,0,.78,0);for(const x of[-.55,.55])for(const z of[-.26,.26])add(g,B(.1,.78,.1),D,x,.39,z);add(g,B(.34,.12,.2),0x4a4e58,-.3,.9,0);add(g,B(.5,.08,.14),0x5a5f6a,-.3,1,0);const wh=add(g,Cy(.26,.26,.08,14),ST,.36,1.06,0);wh.rotation.x=Math.PI/2;add(g,Cy(.03,.03,.3,6),D,.36,1.06,0).rotation.x=Math.PI/2;add(g,B(.9,.05,.4),D,0,.25,0)}
else if(id=='B_fur'&&window.mkFurnace){return mkFurnace()}/* 0.1.27: нова реалістична плавильня — furnace.js */
else if(id=='B_fur'){add(g,S(.7),ST,0,.55,0).scale.set(1,.85,1);add(g,Cy(.15,.18,.8,8),0x6a6f7a,.32,1.3,-.2);const m=new THREE.Mesh(S(.25),FIRE);m.position.set(0,.42,.56);m.scale.set(1,.8,.4);g.add(m);g.userData.fire=m}
else if(id=='B_wb2'||id=='B_wb3'){const MT=id=='B_wb3'?0x5d6676:0x7d8592;add(g,B(1.6,.14,.8),id=='B_wb3'?0x6b4a34:W,0,.86,0);for(const x of[-.7,.7])for(const z of[-.32,.32])add(g,B(.12,.86,.12),id=='B_wb3'?MT:D,x,.43,z);
 add(g,B(1.4,.06,.62),D,0,.3,0);add(g,B(.42,.16,.24),MT,-.4,1.01,0);add(g,B(.56,.1,.3),MT,-.4,1.13,0);add(g,Cy(.05,.05,.3,8),MT,.35,1.07,.15);add(g,B(.2,.14,.16),0xc9a24a,.45,1,-.15);
 if(id=='B_wb3'){for(const[x,c]of[[.1,0x7fe3f5],[.25,0xff6b5a],[.4,0x5fdc7a]]){const gm=new THREE.Mesh(S(.06),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.9}));gm.position.set(x,1.0,.25);g.add(gm)}add(g,B(.08,.6,.08),MT,.7,1.2,-.3);add(g,B(.5,.06,.06),MT,.5,1.48,-.3)}}
else if(id=='B_nest2'||id=='B_nest5'){const big=id=='B_nest5',R0=big?1.05:.62;const rim=new THREE.Mesh(new THREE.TorusGeometry(R0,big?.16:.12,8,big?28:20),new THREE.MeshStandardMaterial({color:0xb08a52,roughness:.95}));rim.rotation.x=Math.PI/2;rim.position.y=.14;rim.castShadow=true;g.add(rim);
 add(g,Cy(R0,R0,.12,big?28:20),0x8a6a3c,0,.08,0);const cu=add(g,Cy(R0*.9,R0*.9,.08,big?28:20),big?0xf2eadb:0xe8d6b0,0,.16,0);for(let i=0;i<(big?14:8);i++){const a=i/(big?14:8)*6.28;add(g,B(.05,.03,.28),0xd9b56a,Math.cos(a)*R0,.24,Math.sin(a)*R0).rotation.y=-a}}
else if(id=='B_garden'){add(g,B(3.6,.2,2.4),0x7a5232,0,.1,0);add(g,B(3.36,.06,2.16),0x4a3324,0,.2,0);for(const x of[-1.1,0,1.1])for(const z of[-.55,.55]){add(g,Cy(.3,.34,.05,10),0x3b281a,x,.235,z)}
 for(const x of[-1.8,1.8])add(g,B(.12,.26,2.5),0x8e5a3a,x,.13,0);for(const z of[-1.2,1.2])add(g,B(3.72,.26,.12),0x8e5a3a,0,.13,z)}
else if(id=='B_farm'){add(g,B(1.8,.15,1.1),0x6a4a2a,0,.07,0);for(let i=0;i<6;i++){const x=(i%3-1)*.55,z=i<3?-.25:.25;add(g,S(.17),0x3f8a3a,x,.28,z);add(g,S(.05),0x4a5fd6,x+.08,.36,z+.08);add(g,S(.05),0xd93b3b,x-.07,.33,z-.05)}}
else if(id=='B_lamp'){add(g,Cy(.05,.06,1.6,6),0x2a2a33,0,.8,0);const l=new THREE.Mesh(B(.22,.28,.22),LAMP);l.position.y=1.72;g.add(l);add(g,Co(.2,.15,4),0x2a2a33,0,1.94,0,Math.PI/4);const lt=new THREE.PointLight(0xffc070,0,10);lt.position.y=1.7;g.add(lt);g.userData.light=lt}
else{for(const x of[-.8,0,.8])add(g,B(.12,.8,.12),W,x,.4,0);for(const y of[.3,.6])add(g,B(1.8,.08,.06),D,0,y,0)}
return g}
const placed=[];window.BPLACED=placed;
/* 0.1.27: будівлю ставлять вільно (x,z,ry у сейві); старі записи без координат — на місці слота в кільці */
function spawnB(id,si,X,Z,RY){const[x,z]=X!=null?[X,Z]:spos(si),g=mkB(id);const C=inv._cen||[0,0];g.position.set(x,H(x,z),z);g.rotation.y=RY!=null?RY:Math.atan2(C[0]-x,C[1]-z);sc.add(g);placed.push({id,g,x,z});for(let i=trees.length-1;i>=0;i--){const t=trees[i];if(Math.hypot(t.x-x,t.z-z)<2.2){sc.remove(t.m);trees.splice(i,1)}}}
if(inv._cen)inv._b.forEach(([id,si,x,z,ry])=>{if(BI[id])spawnB(id,si,x,z,ry)});
window.respawnB=()=>{placed.forEach(b=>sc.remove(b.g));placed.length=0;if(inv._cen)inv._b.forEach(([id,si,x,z,ry])=>{if(BI[id])spawnB(id,si,x,z,ry)})};
function placeB(id){if(!inv._cen){msg('🏠 Спершу збудуйте й поставте Попал-центр');return}if(!(inv[id]>0))return;if(BI[id].u&&built(id)){msg('Це вже збудовано');return}
 const r=(window.colR&&colR[id])||.8;
 if(window.plPlace){plPlace({name:'🏗️ '+BI[id].n,r,dist:r+1.6,ry:(P.face||0)+Math.PI,mk:()=>mkB(id),onOk:(x,z,ry)=>doPlaceB(id,x,z,ry)});return}
 doPlaceB(id,P.x+Math.sin(P.face||0)*(r+1.6),P.z+Math.cos(P.face||0)*(r+1.6),(P.face||0)+Math.PI)}
function doPlaceB(id,x,z,ry){if(!(inv[id]>0)||(BI[id].u&&built(id)))return;
const l0=campLv();inv[id]--;inv._b.push([id,-1,+x.toFixed(2),+z.toFixed(2),+(+ry).toFixed(2)]);spawnB(id,-1,x,z,ry);msg('🏗️ Збудовано: '+BI[id].n);const l1=campLv();if(l1>l0)setTimeout(()=>msg('🏠 Рівень бази '+l1+'! Тепер з вами може бути до '+palCap()+' попалів'),1500);try{hud();save()}catch(_){}}
document.addEventListener('click',e=>{const t=e.target.closest('[data-place]');if(!t)return;placeB(t.dataset.place);ivR()});
const _r=ivR;ivR=function(){_r();const c=$('ivc');if(!c)return;
if(ivTab=='i'){const on=c.querySelector('.i2g .i2s.on'),d=c.querySelector('.i2d');if(on&&BI[on.dataset.sl]&&d){const b=document.createElement('button');b.dataset.place=on.dataset.sl;b.textContent='🏗️ Поставити';d.appendChild(b)}}
if(ivTab=='c'){const h=document.createElement('div');h.className='cmlv';const l=campLv(),nx=LV[l];h.innerHTML=`🏠 <b>Рівень бази ${l}</b> · попалів з вами: до ${palCap()}${nx!=null?` · до рівня ${l+1}: ${nx-campPts()} очок будівель`:' · максимум'}`;c.insertBefore(h,c.firstChild);
c.querySelectorAll('[data-r]').forEach(bt=>{const R=RC[+bt.dataset.r];if(!R)return;if(R.bld&&BI[R.id].u&&(built(R.id)||cnt(R.id)>0)){bt.disabled=true;bt.textContent=built(R.id)?'✔ Збудовано':'✔ У рюкзаку'}else if(REQ[R.id]&&!built(REQ[R.id])){bt.disabled=true;bt.textContent='🔒 '+BI[REQ[R.id]].n}})}};
/* ---------- рівні попалів ---------- */
if(!Array.isArray(inv._px))inv._px=[];pals.forEach((p,i)=>p.xp=inv._px[i]||0);
/* 0.1.11: попал — до 50 рівня і не вище рівня героя; досвід за тією самою таблицею, що й у героя (XPT з core-world.js).
   Нагороди ×30 і +10% за кожен рівень попала: попал, що працює в таборі з їжею, доходить до 50 рівня приблизно за 10 год */
const PXMAX=50,PXM=30,pxN=l=>XPT[Math.min(PXMAX,l+1)];
function gainPx(p,n){const cap=Math.min(PXMAX,plv);if((p.lv||1)>=cap){p.xp=0;if((p.lv||1)<PXMAX&&!p.capM){p.capM=1;msg('🐾 '+T[p.ty].n+' досяг рівня героя. Підвищіть рівень героя, щоб попал ріс далі')}return}p.capM=0;
n=Math.round(n*PXM*(1+.1*((p.lv||1)-1)));p.xp=(p.xp||0)+n;let up=0;while((p.lv||1)<cap&&p.xp>=pxN(p.lv||1)){p.xp-=pxN(p.lv||1);p.lv=(p.lv||1)+1;up=1}if((p.lv||1)>=cap)p.xp=0;inv._px=pals.map(q=>q.xp||0);if(up){msg('🐾 '+T[p.ty].n+' досяг рівня '+p.lv+'!');try{pwUp();save()}catch(_){}}}
window.palXp=gainPx;window.palXpNeed=pxN;
const pw0=window.palWork;if(pw0)window.palWork=(p,dt)=>{const b=p.w||0;pw0(p,dt);if((p.w||0)<b){gainPx(p,2);if(p.job=='cook'&&built('B_kit')&&window.chCount&&chCount('mu')>=2&&chTake('mu',2))chStore('gm',1,p.x,p.z);}};
/* ---------- стихійні атаки ---------- */
const EC={wa:[0x3ad0ff,'💧 Водяний струмінь'],fi:[0xff7a2a,'🔥 Вогняний плювок'],ea:[0xa8713f,'⛰️ Кам’яний удар'],ai:[0xe8f4ff,'🌪️ Вихор'],gr:[0x5fdc7a,'🌿 Бамбуковий смерч'],da:[0x9a6ad6,'🌑 Тіньова куля'],ne:[0xf4f4f8,'⚪ Наскок']};
const ecOf=ty=>EC[((T[ty]&&T[ty].e)||['ne'])[0]]||EC.ne;
let atT=0;const shots=[];
function palAttack(dt){atT-=dt;const p=pals[selP];if(!p||atT>0||(window.palOn&&!palOn()))return;let tg=null,bd=7;for(const w of wild){if(!w.ag)continue;const d=Math.hypot(w.x-p.x,w.z-p.z);if(d<bd){bd=d;tg=w}}if(!tg)return;atT=2.6;const[col,nm]=ecOf(p.ty),m=new THREE.Mesh(S(.18),new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:1.3}));m.position.set(p.x,H(p.x,p.z)+.8,p.z);sc.add(m);shots.push({m,w:tg,p,t:0,x0:p.x,z0:p.z,nm,col})}
function shotUp(dt){for(let i=shots.length-1;i>=0;i--){const s=shots[i];s.t+=dt*2.2;const k=Math.min(1,s.t),y0=H(s.x0,s.z0)+.8;s.m.position.set(s.x0+(s.w.x-s.x0)*k,y0+Math.sin(k*Math.PI)*.8,s.z0+(s.w.z-s.z0)*k);s.m.scale.setScalar(1+k*.6);if(k<1)continue;sc.remove(s.m);s.m.material.dispose();shots.splice(i,1);if(!wild.includes(s.w))continue;
let v,tg;if(window.PW){const r=PW.palHit(s.p,s.w);v=r.v;tg=r.tag}else{const em=window.elM?elM(s.p.ty,s.w.ty):1;v=Math.round((8+2*(s.p.lv||1))*em);tg=em>1?' ✦':em<1?' ▽':''}s.w.hp=Math.max(1,s.w.hp-v);flash(s.w);dmg(s.nm+' '+v+tg,s.w.m,'#'+s.col.toString(16).padStart(6,'0'));gainPx(s.p,3);if(s.w.hp<=1&&!s.w.wk){s.w.wk=1;msg('🔮 '+T[s.w.ty].n+' ослаблена! Киньте кулю')}}}
/* ---------- день і ніч ---------- */
/* 0.1.11: день триває 45 хв, ніч — 15 хв реального часу. Ніч — коли tod поза (N0, N1), тобто d>.5 у dn() */
const DAYS=2700,NIGHTS=900,N0=.22,N1=.78;let tod=.32;try{const v=parseFloat(localStorage.getItem('zi_tod'));if(v>=0&&v<1)tod=v}catch(_){}
const hemi=sc.children.find(o=>o.isHemisphereLight),h0=hemi?hemi.intensity:1,s0=sun.intensity,e0=R.toneMappingExposure||1,fog0=sc.fog?sc.fog.color.clone():null,NIG=new THREE.Color(0x0c1430),hc0=hemi?hemi.color.clone():null,sc0=sun.color.clone(),MOON=new THREE.Color(0x8fb0ff),MOONH=new THREE.Color(0x5a74c0);/* 0.1.16: уночі — холодне місячне світло */
const bgc=sc.background&&sc.background.image&&sc.background.image.getContext?sc.background.image:null,DC=['#2f7fe0','#7db8ef','#bcdcf3'],NC=['#050a1e','#14204a','#2a3a6a'];
const mix=(a,b,t)=>{const A=parseInt(a.slice(1),16),C=parseInt(b.slice(1),16),f=s=>((A>>s&255)+((C>>s&255)-(A>>s&255))*t)|0;return`rgb(${f(16)},${f(8)},${f(0)})`};
const sg=new THREE.BufferGeometry(),sp=new Float32Array(900);for(let i=0;i<300;i++){const a=Math.random()*6.28,e=.15+Math.random()*1.3,r=70;sp[i*3]=Math.cos(a)*Math.cos(e)*r;sp[i*3+1]=Math.sin(e)*r;sp[i*3+2]=Math.sin(a)*Math.cos(e)*r}sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
const stars=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:.7,transparent:true,opacity:0,depthWrite:false,fog:false}));stars.frustumCulled=false;sc.add(stars);
const hud0=document.getElementById('hud');let clk=null;if(hud0){clk=document.createElement('span');clk.id='clk';hud0.appendChild(clk)}
let bgT=9,lastD=-1,clT=9,svT=0;window.isNight=()=>Math.max(0,Math.min(1,(Math.abs(tod-.5)-.24)/.08))>.5;
/* 0.2.0: чтення точного часу доби ззовні (tod в IIFE-замиканні, звідти не видно) */
window.ziTod=()=>tod;
function dn(dt){if(window.REALM==='isle')dt=0,tod=.36;/* на острові пробудження завжди ранок */tod=(tod+dt*(tod>=N0&&tod<N1?(N1-N0)/DAYS:(1-N1+N0)/NIGHTS))%1;const d=Math.max(0,Math.min(1,(Math.abs(tod-.5)-.24)/.08));
R.toneMappingExposure=e0*(1-.42*d);if(hemi){hemi.intensity=h0*(1-.7*d);hemi.color.copy(hc0).lerp(MOONH,d)}sun.intensity=s0*(1-.88*d);sun.color.copy(sc0).lerp(MOON,d);if(fog0)sc.fog.color.copy(fog0).lerp(NIG,d);
placed.forEach(b=>{if(b.g.userData.light)b.g.userData.light.intensity=1.8*d});stars.material.opacity=d;stars.position.set(P.x,0,P.z);
bgT+=dt;if(bgc&&bgT>.4&&Math.abs(d-lastD)>.005){bgT=0;lastD=d;const x=bgc.getContext('2d'),g=x.createLinearGradient(0,0,0,bgc.height);g.addColorStop(0,mix(DC[0],NC[0],d));g.addColorStop(.6,mix(DC[1],NC[1],d));g.addColorStop(1,mix(DC[2],NC[2],d));x.fillStyle=g;x.fillRect(0,0,bgc.width,bgc.height);sc.background.needsUpdate=true}
clT+=dt;if(clk&&clT>.5){clT=0;const m=Math.floor(tod*1440),h=Math.floor(m/60),mi=m%60;clk.textContent=(d>.5?'🌙 ':'☀️ ')+String(h).padStart(2,'0')+':'+String(mi).padStart(2,'0')}
svT+=dt;if(svT>10){svT=0;try{localStorage.setItem('zi_tod',tod.toFixed(4))}catch(_){}}}
document.addEventListener('click',e=>{if(!e.target.closest('#hit'))return;if(!isNight())return;const b=placed.find(b=>b.id=='B_bed'&&Math.hypot(b.x-P.x,b.z-P.z)<2.8);if(!b)return;e.stopImmediatePropagation();e.preventDefault();tod=.27;P.hp=HPM;msg('😴 Ви виспались. Добрий ранок!');try{hud()}catch(_){}},true);
/* ---------- міні-карта ---------- */
const mm=document.createElement('canvas');mm.id='mmap';mm.width=mm.height=240;document.body.appendChild(mm);const posClk=()=>{if(!clk)return;const r=mm.getBoundingClientRect();clk.style.left=(r.left+r.width/2)+'px';clk.style.top=r.bottom+'px'};
const togMM=()=>{mm.classList.toggle('big');setTimeout(posClk,230)};
if(clk){clk.className='inmap';mm.after(clk);clk.onclick=togMM}mm.onclick=togMM;posClk();
const E=SZ+4,NR=240,off=document.createElement('canvas');off.width=off.height=NR;{const x=off.getContext('2d');for(let i=0;i<NR;i++)for(let j=0;j<NR;j++){const wx=-E+(i+.5)/NR*2*E,wz=-E+(j+.5)/NR*2*E,h=H(wx,wz);x.fillStyle=h<-.45?(h<-3?'#2a6fa8':'#3a8fc8'):(window.pathD&&pathD(wx,wz)<1.6)?'#c9a66b':window.BIO?'#'+BCOL[BIO(wx,wz)].toString(16).padStart(6,'0'):h>9?'#f2f6fc':h>6?'#a3a9b4':h>3.4?'#86a05c':h>1?'#7aa645':'#5f9a3a';x.fillRect(i,j,1,1)}x.fillStyle='#d8c8a8';x.beginPath();x.arc(NR/2,NR/2,4.2/(2*E)*NR,0,7);x.fill()}
let MZ=1,MCX=0,MCZ=0;const tp=(x,z)=>[((x+E)/(2*E)*240-MCX)*MZ+120,((z+E)/(2*E)*240-MCZ)*MZ+120];
function drawMM(){const x=mm.getContext('2d');x.clearRect(0,0,240,240);x.save();x.beginPath();x.arc(120,120,118,0,7);x.clip();x.imageSmoothingEnabled=false;{const big=mm.classList.contains('big');MZ=big?1:Math.max(1,E/75);if(MZ>1){MCX=(P.x+E)/(2*E)*240;MCZ=(P.z+E)/(2*E)*240}else{MCX=MCZ=120}x.drawImage(off,(0-MCX)*MZ+120,(0-MCZ)*MZ+120,240*MZ,240*MZ)}
x.fillStyle='rgba(10,20,40,.18)';x.fillRect(0,0,240,240);
(window.MT||[]).forEach(m=>{const[a,c]=tp(m[0],m[1]),s=Math.max(5,m[2]*.3);x.fillStyle='rgba(240,244,252,.9)';x.strokeStyle='rgba(50,60,80,.9)';x.lineWidth=1;x.beginPath();x.moveTo(a,c-s);x.lineTo(a+s*1.1,c+s*.7);x.lineTo(a-s*1.1,c+s*.7);x.closePath();x.fill();x.stroke()});
(window.SIGNS||[]).forEach(s=>{const[a,c]=tp(s.x,s.z);x.fillStyle='#ff9a3c';x.strokeStyle='#1a2040';x.lineWidth=1;x.beginPath();x.moveTo(a,c-4);x.lineTo(a+4,c);x.lineTo(a,c+4);x.lineTo(a-4,c);x.closePath();x.fill();x.stroke()});
placed.forEach(b=>{const[a,c]=tp(b.x,b.z);x.fillStyle='#8e5a3a';x.fillRect(a-3,c-3,6,6)});
(inv._gd||[]).forEach(g=>{if(!g.d)return;const[a,c]=tp(g.x,g.z);x.font='bold 13px serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#c070ff';x.fillText('☠',a,c)});/* 0.1.28: могила з речами */
if(inv._cen){const[a,c]=tp(inv._cen[0],inv._cen[1]);x.fillStyle='#7fe3f5';x.strokeStyle='#1a2040';x.lineWidth=1.5;x.beginPath();x.arc(a,c,5,0,7);x.fill();x.stroke()}
pals.forEach((p,i)=>{if(i===selP||p.cs==null||!p.wk)return;const[a,c]=tp(p.x,p.z);x.fillStyle='#5fe08a';x.beginPath();x.arc(a,c,2.5,0,7);x.fill()});
wild.forEach(w=>{if(Math.hypot(w.x-P.x,w.z-P.z)>26)return;const[a,c]=tp(w.x,w.z);x.fillStyle=w.ag?'#ff4d4d':'#ffb0b0';x.beginPath();x.arc(a,c,2.2,0,7);x.fill()});
(typeof NPCS!='undefined'?NPCS:[]).forEach(n=>{const[a,c]=tp(n.x,n.z);x.fillStyle='#ffd34e';x.beginPath();x.arc(a,c,4,0,7);x.fill();if(n.mk&&n.mk.visible){x.fillStyle='#1a1a1a';x.font='bold 9px sans-serif';x.textAlign='center';x.fillText('!',a,c+3)}});
const[a,c]=tp(P.x,P.z),fx=Math.sin(P.face||0),fz=Math.cos(P.face||0);x.fillStyle='#fff';x.strokeStyle='#1a2040';x.lineWidth=2;x.beginPath();x.moveTo(a+fx*9,c+fz*9);x.lineTo(a-fx*5+fz*5,c-fz*5-fx*5);x.lineTo(a-fx*5-fz*5,c-fz*5+fx*5);x.closePath();x.stroke();x.fill();
x.restore();x.fillStyle='#fff';x.font='bold 16px sans-serif';x.textAlign='center';x.fillText('Пн',120,20)}
/* ---------- цикл ---------- */
let last=performance.now(),mmT=1;(function loop(){const n=performance.now(),dt=Math.min(.05,(n-last)/1000);last=n;try{dn(dt);if(!menuO&&!ivO){palAttack(dt);shotUp(dt)}placed.forEach(b=>{const f=b.g.userData.fire;if(f)f.scale.y=1+Math.sin(n/120)*.15});mmT+=dt;if(mmT>.3){mmT=0;mm.style.display=menuO&&!document.body.classList.contains('hedit')?'none':'';/* у редакторі розташування (hud-layout.js) карту видно, щоб її можна було перетягнути */if(clk)clk.style.display=mm.style.display;posClk();drawMM()}}catch(e){}requestAnimationFrame(loop)})();
try{hud()}catch(_){}
}catch(e){console.warn('world-007',e)}})();
