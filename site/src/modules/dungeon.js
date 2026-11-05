/* 0.3.1: Підземелля 1 — Кришталеві печери.
   • Окрема печера (далеко в морі за краєм острова, закрита скелями й склепінням): вхідна зала з порталом назад, звивистий тунель
     з двома нішами, а в кінці — велика кришталева зала з колонами, жаровнями, рунним колом і троном боса.
   • Темно: світить лише слабкий вогник героя. На стінах тунелю — 7 підставок під ліхтарі: підійдіть і натисніть «Дія»,
     щоб поставити Ліхтар з крафту (🏮). Поставлені ліхтарі лишаються назавжди (inv._dgl). Зала боса освітлена.
   • У тунелі — 4 сильні дикі попали (16–18 рів.), у залі — 👑 Кришталевий Владика (20 рів., рушій boss.js) з двома заклинаннями
     й різною здобиччю: малі Кристали еволюції та зілля здоров'я.
   • Вхід: портал у Старому лісі біля правого перевалу хребта 2 (DUNGEON.setPortal).
   • Якщо гравця збережено всередині — після завантаження він на острові біля порталу (inv._dgRet). */
(function(){try{
if(window.REALM==='isle'||typeof wild=='undefined')return;
const O=[-190,-190],BOX=32,FLOOR=0,REC=16;/* рекомендований рівень */
const L=(u,v)=>[O[0]+u,O[1]+v];
const inBox=(x,z)=>Math.abs(x-O[0])<BOX&&Math.abs(z-O[1])<BOX;
/* план печери (локальні координати від O) */
const ROOMS=[[-22,-18,6],[-3,-14,4.5],[-9,-3,4.2],[12,16,15]],HALL=ROOMS[3];
const TUN=[[-22,-18],[-12,-22],[-3,-14],[-9,-3],[-2,4],[5,9]],TR=2.8;
function segD(px,pz,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;let t=((px-a[0])*dx+(pz-a[1])*dz)/l2;t=Math.max(0,Math.min(1,t));return Math.hypot(px-a[0]-dx*t,pz-a[1]-dz*t)}
function walkL(u,v,m){for(const r of ROOMS)if(Math.hypot(u-r[0],v-r[1])<r[2]-m)return true;for(let i=1;i<TUN.length;i++)if(segD(u,v,TUN[i-1],TUN[i])<TR-m)return true;return false}
const walk=(x,z,m)=>walkL(x-O[0],z-O[1],m||0);
const inHall=(x,z)=>Math.hypot(x-O[0]-HALL[0],z-O[1]-HALL[1])<HALL[2]+1;
window.DG={inBox,walk};

/* ---------- висота: підлога печери (window.H і BLDY — для героя, моделей і анімації) ---------- */
{const H0=window.H;window.H=(x,z)=>inBox(x,z)?FLOOR:H0(x,z);
 const b0=window.BLDY;window.BLDY=function(x,z,dt){if(inBox(x,z))return FLOOR;return b0?b0.apply(this,arguments):H0(x,z)};
 const s0=window.spdF;window.spdF=()=>(s0?s0():1)*(inBox(P.x,P.z)&&H0(P.x,P.z)<-1.15?1/.55:1);/* під печерою море — без цього герой «плив би» повільно */
 const z0=window.plZoom;window.plZoom=()=>{const v=z0?z0():9.5;return inBox(P.x,P.z)?Math.min(v,inHall(P.x,P.z)?11:6.5):v}}

/* ---------- стіни тверді ---------- */
{const blocked=(x,z,m)=>inBox(x,z)&&!walk(x,z,m);
 const b0=window.BLDC;window.BLDC=function(ox,oz){if(b0)b0.apply(this,arguments);if(!inBox(P.x,P.z)||!blocked(P.x,P.z,.3))return;
  if(!blocked(P.x,oz,.3)){P.z=oz;return}if(!blocked(ox,P.z,.3)){P.x=ox;return}P.x=ox;P.z=oz};
 const c0=window.colBlocked;window.colBlocked=function(x0,z0,x1,z1,r){if(blocked(x1,z1,(r||.4)))return true;return c0?c0.apply(this,arguments):false}}

/* ---------- будова печери (лише коли вперше заходите) ---------- */
let G=null;const SCON=[];/* підставки під ліхтарі */
const MAT={rock:null,floor:new THREE.MeshStandardMaterial({color:0x3a342e,roughness:1}),dark:new THREE.MeshStandardMaterial({color:0x221d1a,roughness:1,side:THREE.DoubleSide}),
 iron:new THREE.MeshStandardMaterial({color:0x2a2a30,roughness:.6,metalness:.6}),gold:new THREE.MeshStandardMaterial({color:0xd8a948,roughness:.35,metalness:.8,emissive:0x3a2a08}),
 cyan:new THREE.MeshStandardMaterial({color:0x7fe3f5,emissive:0x2ab8e8,emissiveIntensity:1.2,roughness:.2,transparent:true,opacity:.92}),
 vio:new THREE.MeshStandardMaterial({color:0xc8a2ff,emissive:0x8a4aff,emissiveIntensity:1.1,roughness:.2,transparent:true,opacity:.92}),
 fire:new THREE.MeshStandardMaterial({color:0xffb050,emissive:0xff7a20,emissiveIntensity:1.8}),moss:new THREE.MeshStandardMaterial({color:0x5fe0b0,emissive:0x2ab890,emissiveIntensity:.9}),
 rune:new THREE.MeshBasicMaterial({color:0x7fe3f5,transparent:true,opacity:.75,side:THREE.DoubleSide}),banner:new THREE.MeshStandardMaterial({color:0x6a1a2a,roughness:.9,side:THREE.DoubleSide})};
let seed=4242;const rnd=()=>(seed=seed*16807%2147483647)/2147483647,rr=(a,b)=>a+rnd()*(b-a);
const M=(g,geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m};
function crystal(g,x,z,s,mat){const c=new THREE.Group();for(let i=0;i<5;i++){const h=rr(.8,1.8)*s,m=new THREE.Mesh(new THREE.ConeGeometry(.22*s,h,5),mat);m.position.set(rr(-.35,.35)*s,h/2,rr(-.35,.35)*s);m.rotation.set(rr(-.4,.4),rr(0,6),rr(-.4,.4));c.add(m)}c.position.set(x,FLOOR,z);g.add(c);return c}
function build(){G=new THREE.Group();G.name='dungeon1';MAT.rock=window.plCliff?plCliff.mat():new THREE.MeshStandardMaterial({color:0x7a7066,roughness:1});
 /* підлога й склепіння */
 {const f=M(G,new THREE.PlaneGeometry(BOX*2,BOX*2),MAT.floor,O[0],FLOOR+.01,O[1]);f.rotation.x=-Math.PI/2;f.receiveShadow=true;
  const shell=M(G,new THREE.BoxGeometry(BOX*2,16,BOX*2),new THREE.MeshBasicMaterial({color:0x07060a,side:THREE.BackSide}),O[0],FLOOR+7.9,O[1]);shell.name='shell'}/* суцільна темна оболонка: ззовні печери нічого не видно */
 /* стіни — брили вздовж краю печери */
 {const A=[];for(let u=-BOX+1;u<BOX;u+=1.7)for(let v=-BOX+1;v<BOX;v+=1.7){if(walkL(u,v,0))continue;let near=false;for(const[du,dv]of[[2,0],[-2,0],[0,2],[0,-2],[1.4,1.4],[-1.4,1.4],[1.4,-1.4],[-1.4,-1.4]])if(walkL(u+du,v+dv,0)){near=true;break}if(near)A.push([u+rr(-.4,.4),v+rr(-.4,.4)])}
  const geos=window.plCliff?[0,1,2].map(k=>plCliff.geo(k)):[new THREE.DodecahedronGeometry(1,1)],dm=new THREE.Object3D(),cl=new THREE.Color(),cols=[0x8a8076,0x6e665e,0x5e5852,0x7a7268];
  geos.forEach((geo,k)=>{const P_=A.filter((_,i)=>i%geos.length==k),m=new THREE.InstancedMesh(geo,MAT.rock,P_.length);
   P_.forEach(([u,v],i)=>{const hall=Math.hypot(u-HALL[0],v-HALL[1])<HALL[2]+3;dm.position.set(O[0]+u,FLOOR-1,O[1]+v);dm.scale.set(rr(1.7,2.4),hall?rr(9,13):rr(6,9),rr(1.7,2.4));dm.rotation.set(0,rr(0,6),0);dm.updateMatrix();m.setMatrixAt(i,dm.matrix);m.setColorAt(i,cl.setHex(cols[(rnd()*4)|0]))});
   m.receiveShadow=true;G.add(m)})}
 /* сталактити й сталагміти, світні гриби й кристали в тунелі */
 for(let i=1;i<TUN.length;i++){const a=TUN[i-1],b=TUN[i];for(let t=0;t<1;t+=.22){const u=a[0]+(b[0]-a[0])*t,v=a[1]+(b[1]-a[1])*t,[x,z]=L(u,v);
  const st=M(G,new THREE.ConeGeometry(rr(.25,.5),rr(1.5,3),6),MAT.rock,x+rr(-2,2),rr(9.5,11),z+rr(-2,2));st.rotation.x=Math.PI;
  if(rnd()<.6){const dx=b[1]-a[1],dz=-(b[0]-a[0]),dl=Math.hypot(dx,dz),sd=rnd()<.5?-1:1;const px=x+dx/dl*2.2*sd,pz=z+dz/dl*2.2*sd;if(rnd()<.5)crystal(G,px,pz,rr(.5,.8),rnd()<.5?MAT.cyan:MAT.vio);else for(let k=0;k<4;k++){const s=M(G,new THREE.SphereGeometry(rr(.08,.16),8,6),MAT.moss,px+rr(-.4,.4),FLOOR+rr(.05,.25),pz+rr(-.4,.4));s.scale.y=.6}}}}
 /* підставки під ліхтарі: залізна скоба на стіні */
 const SP=[[-17,-21],[-12,-24.6],[-5,-17],[-1,-11],[-10.5,-6],[-6.5,1],[0,6.5]];
 SP.forEach(([u,v],i)=>{let best=null,bd=9;for(let a=0;a<6.28;a+=.3)for(let d=1;d<3.5;d+=.25){const uu=u+Math.cos(a)*d,vv=v+Math.sin(a)*d;if(!walkL(uu,vv,0)&&d<bd){bd=d;best=[u+Math.cos(a)*(d-.35),v+Math.sin(a)*(d-.35)]}}
  const p=best||[u,v],[x,z]=L(p[0],p[1]),g=new THREE.Group();g.position.set(x,FLOOR,z);
  M(g,new THREE.CylinderGeometry(.05,.05,2.2,6),MAT.iron,0,1.1,0);M(g,new THREE.CylinderGeometry(.22,.12,.18,10),MAT.iron,0,2.25,0);
  const mark=M(g,new THREE.TorusGeometry(.3,.03,6,18),new THREE.MeshBasicMaterial({color:0x7fe3f5,transparent:true,opacity:.55}),0,2.4,0);mark.rotation.x=Math.PI/2;
  const lamp=new THREE.Group();lamp.visible=false;g.add(lamp);M(lamp,new THREE.BoxGeometry(.26,.32,.26),new THREE.MeshStandardMaterial({color:0xffe0a0,emissive:0xffb050,emissiveIntensity:1.6}),0,2.5,0);M(lamp,new THREE.ConeGeometry(.22,.16,4),MAT.iron,0,2.74,0).rotation.y=Math.PI/4;
  G.add(g);SCON.push({i,x,z,g,mark,lamp})});
 /* вихідний портал у вхідній залі */
 {const[x,z]=L(-26,-15);const g=portalMesh();g.position.set(x,FLOOR,z);g.rotation.y=Math.atan2(4,-3);G.add(g);EXIT.x=x;EXIT.z=z;EXIT.g=g}
 /* ===== кришталева зала боса ===== */
 {const[hx,hz]=L(HALL[0],HALL[1]),R=HALL[2];
  const fl=M(G,new THREE.CircleGeometry(R-.5,48),new THREE.MeshStandardMaterial({color:0x2c2a33,roughness:.55,metalness:.15}),hx,FLOOR+.02,hz);fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;
  for(const[r0,r1]of[[5,5.25],[8.6,8.8]]){const ring=M(G,new THREE.RingGeometry(r0,r1,64),MAT.rune,hx,FLOOR+.04,hz);ring.rotation.x=-Math.PI/2}
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2,b=a+Math.PI*2/6*2;const p1=[hx+Math.cos(a)*5.1,hz+Math.sin(a)*5.1],p2=[hx+Math.cos(b)*5.1,hz+Math.sin(b)*5.1],len=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]);
   const l=M(G,new THREE.PlaneGeometry(len,.12),MAT.rune,(p1[0]+p2[0])/2,FLOOR+.045,(p1[1]+p2[1])/2);l.rotation.set(-Math.PI/2,0,-Math.atan2(p2[1]-p1[1],p2[0]-p1[0]))}/* зірка в рунному колі */
  const dome=M(G,new THREE.SphereGeometry(R+1,32,16,0,Math.PI*2,0,Math.PI/2),MAT.dark,hx,FLOOR,hz);dome.scale.y=.9;
  /* колони з золотими обручами і стягами */
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2+.15,x=hx+Math.cos(a)*(R-2.6),z=hz+Math.sin(a)*(R-2.6);if(Math.hypot(x-O[0]-5,z-O[1]-9)<4)continue;/* прохід із тунелю */
   M(G,new THREE.CylinderGeometry(.7,.85,11,10),MAT.rock,x,FLOOR+5.5,z);M(G,new THREE.CylinderGeometry(1.05,1.05,.5,10),MAT.rock,x,FLOOR+.25,z);M(G,new THREE.CylinderGeometry(1,1,.4,10),MAT.rock,x,FLOOR+10.8,z);
   for(const y of[2.2,8])M(G,new THREE.TorusGeometry(.76,.07,6,20),MAT.gold,x,FLOOR+y,z).rotation.x=Math.PI/2;
   if(i%2==0){const bn=M(G,new THREE.PlaneGeometry(1.2,3.2),MAT.banner,x-Math.cos(a)*.78,FLOOR+5.4,z-Math.sin(a)*.78);bn.rotation.y=-a+Math.PI/2;const tr=M(G,new THREE.PlaneGeometry(1.22,.16),MAT.gold,0,0,0);bn.add(tr);tr.position.set(0,1.2,.01)}}
  /* великі кристали попід стінами */
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2+.4,x=hx+Math.cos(a)*(R-.8),z=hz+Math.sin(a)*(R-.8);if(Math.hypot(x-O[0]-5,z-O[1]-9)<4)continue;crystal(G,x,z,rr(1.3,2.1),i%2?MAT.cyan:MAT.vio)}
  /* жаровні */
  for(let i=0;i<4;i++){const a=i/4*Math.PI*2+Math.PI/4,x=hx+Math.cos(a)*9.6,z=hz+Math.sin(a)*9.6;M(G,new THREE.CylinderGeometry(.18,.28,1.1,8),MAT.iron,x,FLOOR+.55,z);M(G,new THREE.CylinderGeometry(.7,.4,.45,12),MAT.iron,x,FLOOR+1.3,z);
   const f=M(G,new THREE.ConeGeometry(.5,1.1,8),MAT.fire,x,FLOOR+2,z);f.userData.fire=1}
  /* трон: сходи й величезний кристал за босом (з протилежного від входу боку) */
  {const dx=HALL[0]-5,dz=HALL[1]-9,dl=Math.hypot(dx,dz),tx=hx+dx/dl*(R-3.4),tz=hz+dz/dl*(R-3.4),ry=Math.atan2(dx,dz);
   for(let s=0;s<3;s++){const st=M(G,new THREE.BoxGeometry(6-s*1.3,.3,2.2-s*.4),MAT.rock,tx-dx/dl*(1.2-s*.45),FLOOR+.15+s*.3,tz-dz/dl*(1.2-s*.45));st.rotation.y=ry}
   crystal(G,tx,tz,3.2,MAT.vio).position.y=FLOOR+.9;THR.x=tx;THR.z=tz}
  /* світло зали */
  HL.push([hx,FLOOR+9,hz,0xb08aff,1.6,R*2.2],[hx+3,FLOOR+3,hz+3,0xffa040,1.1,R*1.6])}
 sc.add(G)}
const EXIT={},THR={},HL=[];
function portalMesh(){const g=new THREE.Group();for(let i=0;i<9;i++){const a=i/8*Math.PI,x=Math.cos(a)*1.6,y=Math.sin(a)*2.4+.2;const s=new THREE.Mesh(new THREE.DodecahedronGeometry(.42,0),new THREE.MeshStandardMaterial({color:0x6e665e,roughness:1,flatShading:true}));s.position.set(x,y,0);g.add(s)}
 const PU={t:{value:0}},sw=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.ShaderMaterial({uniforms:PU,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  vertexShader:'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform float t;varying vec2 vU;void main(){vec2 p=vU*2.-1.;float r=length(p),a=atan(p.y,p.x);float sw=sin(a*5.-r*12.+t*3.)*.5+.5;float e=smoothstep(1.,.75,r);vec3 c=mix(vec3(.45,.25,1.),vec3(.6,1.,.95),sw);float k=e*(.35+.65*sw);gl_FragColor=vec4(c*k,k);}'}));
 sw.scale.set(1.25,1.95,1);sw.position.y=1.9;g.add(sw);g.userData.pu=PU;return g}

/* ---------- світло й темрява ---------- */
let inside=false,LG=null;const ENV={};
function lightsOn(){LG=new THREE.Group();const torch=new THREE.PointLight(0xffc890,1,8,2);torch.name='torch';LG.add(torch);
 for(let i=0;i<4;i++){const l=new THREE.PointLight(0xffb060,0,13,2);l.name='pool';LG.add(l)}
 for(const h of HL){const l=new THREE.PointLight(h[3],h[4],h[5],2);l.position.set(h[0],h[1],h[2]);LG.add(l)}sc.add(LG);
 ENV.lights=sc.children.filter(o=>o.isHemisphereLight||o.isDirectionalLight||o.isAmbientLight).map(o=>[o,o.intensity]);
 ENV.fog=sc.fog?[sc.fog.color.getHex(),sc.fog.near,sc.fog.far]:null;ENV.bg=sc.background;document.body.classList.add('indg')}
function lightsOff(){if(LG){sc.remove(LG);LG=null}for(const[o,v]of ENV.lights||[])o.intensity=v;if(sc.fog&&ENV.fog){sc.fog.color.setHex(ENV.fog[0]);sc.fog.near=ENV.fog[1];sc.fog.far=ENV.fog[2]}if(ENV.bg!==undefined)sc.background=ENV.bg;document.body.classList.remove('indg')}
{const css=document.createElement('style');css.textContent='body.indg #mmap,body.indg #mmapClk,body.indg .inmap{visibility:hidden!important}';document.head.appendChild(css)}

/* ---------- мешканці ---------- */
const MOBS=[[-3,-14,3,16],[-9,-3,6,17],[-1,5,1,17],[4,11,7,18]];
const mobs=()=>wild.filter(w=>w.dg);
function spawnMobs(){if(mobs().length)return;if(inv._dgMobT&&Date.now()<inv._dgMobT)return;
 for(const[u,v,ty,lv]of MOBS){const[x,z]=L(u,v),m=mkPal(T[ty].c);m.position.set(x,FLOOR,z);sc.add(m);const s=window.PW?PW.stats(ty,lv):{hp:300,atk:80,def:60};
  wild.push({m,ty,lv,dg:1,name:'⛏️ '+T[ty].n+' печер',hp:Math.round(s.hp*1.6),mh:Math.round(s.hp*1.6),atk:Math.round(s.atk*1.15),def:s.def,x,z,a:0,t:0,ag:1,cd:0})}}
{const sp=wild.splice;wild.splice=function(){const out=sp.apply(this,arguments);if(out.some(w=>w&&w.dg)&&!wild.some(w=>w.dg))inv._dgMobT=Date.now()+5*60000;return out}}/* усіх переможено — нові через 5 хв */

/* ---------- 👑 Кришталевий Владика ---------- */
const BOSS=window.BOSSKIT?window.BOSSKIT.add({id:'dg1',name:'👑 Кришталевий Владика',ty:1,lv:20,fm:3,scale:2.8,r:2.3,home:L(HALL[0],HALL[1]),arena:HALL[2]-1,hpMul:16,atkMul:1.5,respawn:600000,xp:500,
 enabled:()=>!!G,y:()=>FLOOR,
 abil:[{n:'Кришталевий вибух',icon:'💎 ',kind:'nova',R:7,cast:3.5,cd:12,first:4,k:1.5,col:0xff3a5a},
       {n:'Град уламків',icon:'🪨 ',kind:'rain',cnt:4,R:2.4,cast:3,cd:9,first:8,k:1.1,col:0x7fe3f5}],
 loot:[{tab:[{k:'cr2',n:[1,1],w:55},{k:'cr2',n:[2,2],w:30},{k:'cr2',n:[3,3],w:15}]},
       {tab:[{k:'hpp',n:[1,2],w:50},{k:'hpp',n:[3,4],w:20},{k:'cr2',n:[1,1],w:30}]},
       {chance:.5,tab:[{k:'hpp',n:[2,3],w:70},{k:'cr2',n:[1,1],w:30}]}]}):null;

/* ---------- вхід і вихід ---------- */
const fade=document.createElement('div');fade.style.cssText='position:fixed;inset:0;background:radial-gradient(circle,#2a1a4a 0%,#0a0614 70%);opacity:0;pointer-events:none;transition:opacity .7s;z-index:9999';document.body.appendChild(fade);
let busy=false;
function go(fn){if(busy)return;busy=true;fade.style.opacity='1';setTimeout(()=>{try{fn()}catch(e){console.warn('dungeon',e)}setTimeout(()=>{fade.style.opacity='0';busy=false},250)},750)}
function companion(){const p=pals[selP];if(p&&p.m){p.x=P.x+1;p.z=P.z+1}}
function enter(){go(()=>{if(!inBox(P.x,P.z))inv._dgRet=[+P.x.toFixed(2),+P.z.toFixed(2)];if(!G)build();const[x,z]=L(-21,-18);P.x=x;P.z=z;P.face=Math.atan2(1,-.4);companion();spawnMobs();
 if(!inv._dgSeen){inv._dgSeen=1;setTimeout(()=>{try{msg('🕯️ Тут темно. Поставте ліхтарі на підставки вздовж тунелю: підійдіть і натисніть «Дія» (потрібен 🏮 Ліхтар з крафту)')}catch(_){}},900)}
 else setTimeout(()=>{try{msg('🕳️ Кришталеві печери · рекомендований рівень '+REC+'+')}catch(_){}},900);try{save()}catch(_){}})}
function leave(){go(()=>{const r=inv._dgRet||(PORTAL.x!=null?[PORTAL.x+2,PORTAL.z+2]:window.SPAWN?[window.SPAWN[0],window.SPAWN[1]]:[0,3]);P.x=r[0];P.z=r[1];companion();try{save()}catch(_){}})}
/* збережено в печері — після завантаження на острові */
if(inBox(P.x,P.z)){const r=inv._dgRet||(window.SPAWN?[window.SPAWN[0],window.SPAWN[1]]:[0,3]);P.x=r[0];P.z=r[1]}

/* ---------- портал на острові (місце виберемо пізніше) ---------- */
const PORTAL={};
function setPortal(x,z,ry){if(PORTAL.g)sc.remove(PORTAL.g);for(const nm of['trees','rocks','bushes','shrooms']){let A;try{A=eval(nm)}catch(_){A=null}if(!Array.isArray(A))continue;for(let i=A.length-1;i>=0;i--){const o=A[i];if(o&&Math.hypot(o.x-x,o.z-z)<13){if(o.m)sc.remove(o.m);A.splice(i,1)}}}/* біля порталу — чисто */const g=portalMesh();g.position.set(x,H(x,z),z);g.rotation.y=ry||0;sc.add(g);PORTAL.g=g;PORTAL.x=x;PORTAL.z=z}

function caveMouth(px,pz,rzx){if(typeof plCliff=='undefined')return;const geos=[0,1,2].map(k=>plCliff.geo(k)),mat=plCliff.mat(),cols=plCliff.cols,A=[];let sd=777;const rn=()=>(sd=sd*16807%2147483647)/2147483647,r2=(a,b)=>a+rn()*(b-a);
 const add=(x,z,w,h,y)=>A.push([x,(y==null?H(x,z)-h*.1:y),z,w*r2(.85,1.15),h,w*r2(.85,1.2),rn()*6.28,cols[(rn()*cols.length)|0]]);
 /* обрамлення входу: стовпи брил обабіч порталу й важке склепіння над ним */
 for(const sx of[-1,1])for(let k=0;k<3;k++){add(px+sx*(2.6+k*1.4),pz+r2(-.3,.5),1.9+k*.4,8+k*3);add(px+sx*(2.4+k*1.2),pz+2.6,2.2,9+k*2)}/* стіни коридору від хребта до входу */
 for(let k=-2;k<=2;k++)add(px+k*1.4,pz+.4,1.9,2.2,H(px,pz)+5.4+Math.abs(k)*.3);
 add(px,pz+1.6,4.2,5.5,H(px,pz)+6.6);
 /* масив за хребтом (південніше): високі брили й піки, щоб вхід виглядав як печера в горі */
 for(let i=0;i<46;i++){const x=px+r2(-16,16),z=rzx+r2(2,20),d=Math.hypot(x-px,(z-rzx)*.8),h=Math.max(8,30-d*.9)*r2(.8,1.15);add(x,z,r2(3,5),h)}
 const dm=new THREE.Object3D(),cl=new THREE.Color();
 geos.forEach((g,k)=>{const P_=A.filter((_,i)=>i%3==k),m=new THREE.InstancedMesh(g,mat,P_.length);P_.forEach((r,i)=>{dm.position.set(r[0],r[1],r[2]);dm.scale.set(r[3],r[4],r[5]);dm.rotation.set(0,r[6],0);dm.updateMatrix();m.setMatrixAt(i,dm.matrix);m.setColorAt(i,cl.setHex(r[7]))});m.castShadow=m.receiveShadow=true;sc.add(m)});
 /* темна глибина печери за порталом */
 const back=new THREE.Mesh(new THREE.PlaneGeometry(4.2,5.2),new THREE.MeshBasicMaterial({color:0x05040a}));back.position.set(px,H(px,pz)+2.4,pz+1.2);back.rotation.y=Math.PI;sc.add(back);
 /* брили тверді; масив за хребтом — теж */
 if(window.plRockCol){const C=window.plRockCol(A.filter(r=>r[1]<H(r[0],r[2])+1.5).map(r=>({x:r[0],z:r[2],r:Math.max(r[3],r[5])*.95})));const c0=window.colBlocked;
  window.colBlocked=function(x0,z0,x1,z1,r){if(C.hit(x1,z1,(r||.4)+.2))return true;return c0?c0.apply(this,arguments):false};
  const b0=window.BLDC;window.BLDC=function(ox,oz){if(b0)b0.apply(this,arguments);if(C.hit(P.x,P.z,.35)){P.x=ox;P.z=oz}}}
 for(const nm of['trees','rocks','bushes','shrooms']){let L2;try{L2=eval(nm)}catch(_){L2=null}if(!Array.isArray(L2))continue;for(let i=L2.length-1;i>=0;i--){const o=L2[i];if(o&&o.x>px-18&&o.x<px+18&&o.z>rzx-2&&o.z<rzx+22){if(o.m)sc.remove(o.m);L2.splice(i,1)}}}}
/* ---------- «Дія»: ліхтар на підставку, портали ---------- */
function nearSconce(){if(!G||!inBox(P.x,P.z))return null;let best=null,bd=2.4;for(const s of SCON){const d=Math.hypot(P.x-s.x,P.z-s.z);if(d<bd){bd=d;best=s}}return best}
const nearExit=()=>G&&EXIT.x!=null&&Math.hypot(P.x-EXIT.x,P.z-EXIT.z)<2.6;
const nearPortal=()=>PORTAL.g&&Math.hypot(P.x-PORTAL.x,P.z-PORTAL.z)<2.6;
if(!Array.isArray(inv._dgl))inv._dgl=[];
function lightUp(s){if(inv._dgl.includes(s.i)){msg('🏮 Тут уже світить ліхтар');return}if(!(inv.B_lamp>0)){msg('🏮 Потрібен Ліхтар: скрафтіть його (🪵 2, 🪨 1) і поверніться');return}
 inv.B_lamp--;inv._dgl.push(s.i);msg('🏮 Ліхтар поставлено ('+inv._dgl.length+' / '+SCON.length+')');try{hud();save()}catch(_){}}
{const hb=document.getElementById('hit');if(hb){const h0=hb.onclick;hb.onclick=function(){if(!nearest(wild,2.6)){const s=nearSconce();if(s&&!inv._dgl.includes(s.i)){lightUp(s);return}if(nearExit()){leave();return}if(nearPortal()){enter();return}}return h0&&h0.apply(this,arguments)};
 let was=null,hit0=null;ANI.push(()=>{const s=nearSconce(),k=s&&!inv._dgl.includes(s.i)?'lamp':nearExit()?'exit':nearPortal()?'in':'';if(k===was)return;was=k;
  if(k){if(hit0==null)hit0=hb.innerHTML;hb.innerHTML=(k=='lamp'?(window.plIcon?plIcon('B_lamp'):'🏮')+'<small>Ліхтар</small>':'🌀<small>'+(k=='exit'?'Вийти':'У печеру')+'</small>')}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}})}}

/* ---------- кадр ---------- */
let last=performance.now();
ANI.push(()=>{const t=performance.now(),dt=Math.min(.05,(t-last)/1000);last=t;
 for(const g of[EXIT.g,PORTAL.g])if(g&&g.userData.pu)g.userData.pu.t.value=t/1000;
 const inn=inBox(P.x,P.z);if(inn&&!inside){inside=true;if(!G)build();lightsOn()}else if(!inn&&inside){inside=false;lightsOff()}
 if(G)G.visible=inside;if(!inside)return;
 /* темрява: денне світло майже гасне, туман чорний */
 for(const[o,v]of ENV.lights)o.intensity=v*(o.isDirectionalLight?.03:.08);if(sc.fog){sc.fog.color.setHex(0x07060a);sc.fog.near=6;sc.fog.far=inHall(P.x,P.z)?46:28}sc.background=new THREE.Color(0x07060a);
 /* вогник героя і найближчі ліхтарі */
 const torch=LG.getObjectByName('torch');torch.position.set(P.x,FLOOR+2.2,P.z);
 const lit=SCON.filter(s=>inv._dgl.includes(s.i)).sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z)),pool=LG.children.filter(o=>o.name=='pool');
 pool.forEach((l,i)=>{const s=lit[i];if(s){l.position.set(s.x,FLOOR+2.6,s.z);l.intensity=1.5+Math.sin(t/90+i)*.08}else l.intensity=0});
 for(const s of SCON){const on=inv._dgl.includes(s.i);s.lamp.visible=on;s.mark.visible=!on;if(!on)s.mark.material.opacity=.35+.3*Math.sin(t/300+s.i)}
 G.children.forEach((c,i)=>{if(c.userData.fire)c.scale.y=1+Math.sin(t/110+i)*.15});
 /* мешканці печери: стоять на підлозі, бачать героя за 12 м і йдуть до нього, не виходячи за стіни */
 for(const w of wild){if(!w.dg&&!(w.boss&&inBox(w.x,w.z)))continue;if(w.dg){const d=Math.hypot(P.x-w.x,P.z-w.z),reach=Math.max(1.3,(w._r||.6)+.8);
   if(d<12&&d>reach-.2&&!w.sl){w.a=Math.atan2(P.x-w.x,P.z-w.z);const nx=w.x+Math.sin(w.a)*2.4*dt,nz=w.z+Math.cos(w.a)*2.4*dt;if(walk(nx,nz,.5)){w.x=nx;w.z=nz}}}
  if(w.m){w.m.position.set(w.x,FLOOR,w.z);w.m.rotation.y=w.a||0}}
 const p=pals[selP];if(p&&p.m&&inBox(p.x,p.z))p.m.position.y=FLOOR;
 /* камера не заходить у стіни: якщо між героєм і камерою скеля — камера ближче до героя; і не вище склепіння */
 if(typeof cam!='undefined'){const hx=P.x,hy=FLOOR+1.5,hz=P.z,c=cam.position,dx=c.x-hx,dy=c.y-hy,dz=c.z-hz;let k=1;
  for(let t=.06;t<=1.0001;t+=.06){if(!walk(hx+dx*t,hz+dz*t,.55)){k=Math.max(.12,t-.08);break}}
  const top=inHall(P.x,P.z)?11.5:6.8;if(k<1||c.y>top){c.set(hx+dx*k,Math.min(hy+dy*k,top),hz+dz*k);cam.lookAt(P.x,FLOOR+1.2,P.z)}}});

/* 0.3.2: портал — у північній стіні хребта 2, праворуч (Старий ліс, Локація 2) */
/* портал вбудований у північну стіну хребта 2: кам'яний виступ-печера навколо, а за ним — гірський масив */
{const RG=window.RIDGES,PX=124,rzx=RG&&RG.rz?RG.rz(1,PX):0,PZ=rzx-(RG?RG.W:5.2)-3.4;setPortal(PX,PZ,Math.PI);caveMouth(PX,PZ,rzx)}
window.DUNGEON={enter,leave,setPortal,inBox,REC,lit:()=>inv._dgl.length,sconces:()=>SCON.length,boss:()=>BOSS&&BOSS.w};
}catch(e){console.warn('dungeon',e)}})();
