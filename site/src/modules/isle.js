/* Острів пробудження (вимір 'isle', див. realm.js): високі скелі навколо, вузька ущелина на півночі, за нею — арка-портал у звичайний світ.
   Ущелину закриває завал із каменів і світних ліан, доки гравець не пройде цепочку навчання (ISLE.open()).
   Біля арки — перехід: затемнення, гра запамʼятовує вимір 'main' і перезавантажується, герой зʼявляється на точці спавну звичайного світу.
   Табір на острові: місце пробудження на пляжі, вогнище, хатина наставника, причал. */
(function(){try{
const I=window.ISLE;if(window.REALM!=='isle'||!I||typeof THREE=='undefined')return;
const G=n=>{try{return eval(n)}catch(_){return undefined}};
const sc_=G('sc'),P_=G('P'),H_=window.H;if(!sc_||!P_||!H_)return;
let seed=91;const rnd=()=>(seed=seed*16807%2147483647)/2147483647,rr=(a,b)=>a+rnd()*(b-a);

/* ---------- скелі: кілька варіантів «битого» каменю, інстансами ---------- */
const RG=[0,1,2].map(k=>plCliff.geo(k));
const RMAT=plCliff.mat();
const RC=plCliff.cols;
const rocks=[[],[],[]];/* [x,y,z,sx,sy,sz,ry,col] */
const addRock=(x,z,w,h,yo)=>{const k=(rnd()*3)|0;rocks[k].push([x,(yo||0)+H_(x,z)-h*.15,z,w*rr(.85,1.15),h,w*rr(.85,1.2),rnd()*6.28,RC[(rnd()*RC.length)|0]])};
const nearGorge=(x,z)=>z<I.G0+4&&z>I.G1-3&&Math.abs(x)<I.GW+1.6;
const nearPlaza=(x,z)=>Math.hypot(x,z-I.PZ)<I.PR+.8;
/* кільце скель: три ряди, кожен вищий за попередній */
for(let a=0;a<Math.PI*2;a+=.085){const R0=I.RAD(a),c=Math.cos(a),s=Math.sin(a);
 for(const[dd,w,h]of[[1.2,3.2,7],[5.5,4.5,13],[11,6,19],[18,8,24]]){const x=c*(R0+dd+rr(-.8,.8)),z=s*(R0+dd+rr(-.8,.8));
  if(z>I.CLZ+dd*.5)continue;/* південь — відкрите море */
  if((z<I.G0+6&&z>I.G1-6&&Math.abs(x)<I.GW+w*1.3+1)||Math.hypot(x,z-I.PZ)<I.PR+w*1.3)continue;/* брила разом із розміром не заходить в ущелину й на майданчик */
  const fade=Math.max(.25,Math.min(1,(I.CLZ+dd*.5-z)/9));/* скелі сходять у море біля пляжу */
  addRock(x,z,w*rr(.8,1.2),h*fade*rr(.75,1.25))}}
/* стіни ущелини: стрімкі брили обабіч вузького проходу */
for(let z=I.G0+3;z>I.G1-2;z-=1.6)for(const sd of[-1,1]){const xc=-Math.sin(z*.35)*.6;
 addRock(xc+sd*(I.GW+2.9+rr(0,.4)),z,rr(1.5,1.9),rr(5,8));addRock(xc+sd*(I.GW+7+rr(0,1)),z,rr(3,4),rr(13,19))/* біля стежки — нижчі, щоб камера бачила героя */}
/* навколо майданчика арки — півколо скель (вхід з ущелини вільний) */
for(let a=0;a<Math.PI*2;a+=.2){const x=Math.cos(a)*(I.PR+3.5),z=I.PZ+Math.sin(a)*(I.PR+3.5);if(z>I.PZ+I.PR-1&&Math.abs(x)<I.GW+1.5)continue;
 addRock(x,z,rr(2,2.6),rr(7,11));{const x2=Math.cos(a+.1)*(I.PR+1.7),z2=I.PZ+Math.sin(a+.1)*(I.PR+1.7);addRock(x2,z2,rr(1.3,1.7),rr(4,6.5))}/* низький ряд — закриває стіну землі за майданчиком */addRock(Math.cos(a)*(I.PR+8),I.PZ+Math.sin(a)*(I.PR+8),rr(4,5),rr(15,22))}
const dummy=new THREE.Object3D(),col=new THREE.Color();
rocks.forEach((L,k)=>{if(!L.length)return;const m=new THREE.InstancedMesh(RG[k],RMAT,L.length);
 L.forEach((r,i)=>{dummy.position.set(r[0],r[1],r[2]);dummy.scale.set(r[3],r[4],r[5]);dummy.rotation.set(0,r[6],0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);m.setColorAt(i,col.setHex(r[7]))});
 m.castShadow=true;m.receiveShadow=true;sc_.add(m)});
/* зелень на верхівках скель */
{const tops=[];rocks.forEach(L=>L.forEach(r=>{if(r[4]>9&&rnd()<.55)tops.push(r)}));
 const pine=new THREE.ConeGeometry(.9,2.6,6),pm=new THREE.InstancedMesh(pine,new THREE.MeshStandardMaterial({color:0x2f6b3a,roughness:.9,flatShading:true}),tops.length*2);let n=0;
 for(const r of tops)for(let j=0;j<2;j++){dummy.position.set(r[0]+rr(-1,1)*r[3]*.4,r[1]+r[4]*.35*1+.6+rr(0,.4),r[2]+rr(-1,1)*r[5]*.4);dummy.scale.setScalar(rr(.7,1.3));dummy.rotation.set(0,rnd()*6,0);dummy.updateMatrix();pm.setMatrixAt(n++,dummy.matrix)}
 pm.count=n;pm.castShadow=true;sc_.add(pm)}

/* ---------- завал в ущелині ---------- */
const gate=new THREE.Group();gate.position.set(0,H_(0,I.G0+1),I.G0+1);sc_.add(gate);
{const SM=plCliff.mat();
 /* завал на всю ширину ущелини: нижній ряд великих брил, верхній — менших, щілин немає */
 for(const dz of[-.6,.6])for(let row=0;row<9;row++){const n=Math.max(4,7-(row>>1)),y0=.35+row*1.05,sc0=(1.3-row*.05)*(dz<0?.95:1);for(let k=0;k<n;k++){const m=new THREE.Mesh(RG[(k+row)%3],SM);/* завал утричі вищий: 9 рядів до ~10 м */
  m.scale.set(sc0*rr(.9,1.15),sc0*rr(.8,1.05),sc0*rr(.85,1.1));m.position.set(-(I.GW+.4)+(k+.5)/n*2*(I.GW+.4)+rr(-.2,.2),y0+rr(-.1,.15),rr(-.3,.3)+dz+(row==1?.15:0));m.rotation.y=rnd()*6;m.castShadow=true;gate.add(m)}}
 const VM=new THREE.MeshStandardMaterial({color:0x58c46a,emissive:0x3cff9a,emissiveIntensity:.55,roughness:.6});
 for(let i=0;i<33;i++){const vz=i%3==0?.2:i%3==1?1.1:1.5;const c=new THREE.CatmullRomCurve3([new THREE.Vector3(-I.GW-.3,rr(.2,9.5),vz-.3),new THREE.Vector3(rr(-I.GW*.7,0),rr(.4,10),vz),new THREE.Vector3(rr(0,I.GW*.7),rr(.4,10),vz),new THREE.Vector3(I.GW+.3,rr(.2,9.5),vz-.3)]);
  const v=new THREE.Mesh(new THREE.TubeGeometry(c,24,.05,5,false),VM);v.userData.vine=1;gate.add(v)}}
/* відкритий прохід: ліани зникають, а каміння завалу лежить купою біля стіни ущелини (його туди відносить Брам, isle-npc.js) */
I.PILE=[11,I.G0+1];/* куди Брам жбурляє завал — за стіну ущелини */I.gate=gate;
const toPile=()=>{gate.visible=false};/* прохід відкрито — завалу більше немає зовсім (Брам жбурнув його за скелю) */
const INV=G('inv')||{};INV._rl='isle';
const DONE=()=>!!(INV._q&&INV._q.v2);/* навчання справді пройдене (isle-quests.js) */
if(INV._isg&&!DONE()&&!INV._skip)INV._isg=0;/* прохід, відкритий автоматично раніше, закривається, доки навчання не пройдене */
let open=!!INV._isg;try{if(new URLSearchParams(location.search).get('gate')=='open')open=true}catch(_){}
if(open)toPile();
I.isOpen=()=>open;
I.open=()=>{open=true;toPile();INV._isg=1;try{save()}catch(_){}};

/* ---------- арка-портал ---------- */
const arch=new THREE.Group(),AX=0,AZ=I.PZ;arch.position.set(AX,H_(AX,AZ),AZ);sc_.add(arch);
{const ST=new THREE.MeshStandardMaterial({color:0x9a9384,roughness:.9,flatShading:true}),RU=new THREE.MeshStandardMaterial({color:0x6fe6ff,emissive:0x39c8ff,emissiveIntensity:1.6});
 for(const s of[-1,1]){for(let i=0;i<5;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(.9-.04*i,.82,.9-.04*i),ST);b.position.set(s*2.15+rr(-.04,.04),.41+i*.8,0);b.rotation.y=rr(-.08,.08);b.castShadow=true;arch.add(b);
   if(i%2){const r=new THREE.Mesh(new THREE.BoxGeometry(.06,.36,.04),RU);r.position.set(s*2.15-s*.46,.41+i*.8,.2);arch.add(r)}}}
 const top=new THREE.Mesh(new THREE.TorusGeometry(2.15,.42,6,16,Math.PI),ST);top.position.y=4;top.castShadow=true;arch.add(top);
 const key=new THREE.Mesh(new THREE.OctahedronGeometry(.42),RU);key.position.set(0,6.3,.05);arch.add(key);arch.userData.key=key}
/* сяйво порталу: шейдер-вир */
const PU={t:{value:0},on:{value:0}};
const pmat=new THREE.ShaderMaterial({uniforms:PU,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
 vertexShader:'varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform float t,on;varying vec2 vU;void main(){vec2 p=vU*2.-1.;p.y*=1.;float r=length(p),a=atan(p.y,p.x);float sw=sin(a*5.-r*12.+t*3.)*.5+.5;float edge=smoothstep(1.,.75,r);vec3 c=mix(vec3(.15,.55,1.),vec3(.55,1.,.95),sw);float k=edge*(.35+.65*sw)*(.25+.75*on);gl_FragColor=vec4(c*k,k);}'});
const disc=new THREE.Mesh(new THREE.CircleGeometry(1,40),pmat);disc.scale.set(1.75,2.9,1);disc.position.set(0,2.95,0);arch.add(disc);
const pl2=new THREE.PointLight(0x5fd8ff,1.4,14,2);pl2.position.set(0,3,1.2);arch.add(pl2);
/* іскри над аркою */
const SPN=60,sg=new THREE.BufferGeometry(),spos=new Float32Array(SPN*3),sv=[];for(let i=0;i<SPN;i++){sv.push([rr(-1.6,1.6),rr(0,5),rr(-.3,.3),rr(.4,1.1)])}
sg.setAttribute('position',new THREE.BufferAttribute(spos,3));const spk=new THREE.Points(sg,new THREE.PointsMaterial({color:0x9ff2ff,size:.12,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));arch.add(spk);

/* ---------- табір ---------- */
const W=new THREE.MeshStandardMaterial({color:0x8e5a3a,roughness:.9}),WD=new THREE.MeshStandardMaterial({color:0x5a3418,roughness:.9}),TH=new THREE.MeshStandardMaterial({color:0xc9a44f,roughness:1,flatShading:true});
const put=(m,x,z,y,ry)=>{m.position.set(x,(y||0)+H_(x,z),z);if(ry)m.rotation.y=ry;m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});sc_.add(m);return m};
/* місце пробудження: підстилка з листя й уламки човна */
{const g=new THREE.Group(),bed=new THREE.Mesh(new THREE.CylinderGeometry(.9,1,.12,10),new THREE.MeshStandardMaterial({color:0x6f9b45,roughness:1}));bed.scale.z=1.5;bed.position.y=.06;g.add(bed);
 for(let i=0;i<4;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(.25,.12,2.2),W);p.position.set(2.2+i*.28,.1+Math.abs(i-1.5)*.08,1.6);p.rotation.set(0,.4,(i-1.5)*.18);g.add(p)}
 const rib=new THREE.Mesh(new THREE.TorusGeometry(.9,.08,5,10,Math.PI),WD);rib.position.set(2.6,0,1.6);rib.rotation.set(0,.4,0);g.add(rib);put(g,I.START[0]-1.2,I.START[1]+.6,0,.2)}
/* вогнище з колодами */
const fire=new THREE.Group();{for(let i=0;i<8;i++){const s=new THREE.Mesh(new THREE.DodecahedronGeometry(.17),new THREE.MeshStandardMaterial({color:0x8a8a8a,roughness:1}));const a=i/8*6.28;s.position.set(Math.cos(a)*.55,.1,Math.sin(a)*.55);fire.add(s)}
 for(let i=0;i<3;i++){const l=new THREE.Mesh(new THREE.CylinderGeometry(.07,.08,.8,6),WD);l.rotation.set(Math.PI/2-.35,i*2.1,0);l.position.y=.18;fire.add(l)}
 const fl=new THREE.Mesh(new THREE.ConeGeometry(.26,.75,7),new THREE.MeshStandardMaterial({color:0xff9a3a,emissive:0xff5a10,emissiveIntensity:2,transparent:true,opacity:.9}));fl.position.y=.5;fire.add(fl);fire.userData.fl=fl;
 const fpl=new THREE.PointLight(0xffa050,1.2,9,2);fpl.position.y=1;fire.add(fpl);
 for(const[a,r]of[[0,2.1],[2.3,2.2],[4.4,2]]){const lg=new THREE.Mesh(new THREE.CylinderGeometry(.22,.24,1.5,8),W);lg.rotation.set(0,a,Math.PI/2);lg.position.set(Math.cos(a)*r,.22,Math.sin(a)*r);lg.rotation.y=-a+Math.PI/2;fire.add(lg)}}
/* вогнище тепер — справжня кухня-багаття бази (ISLE.BASE) */
/* хатина наставника */
{const g=new THREE.Group(),w=new THREE.Mesh(new THREE.CylinderGeometry(1.9,2.05,2.1,10),W);w.position.y=1.05;g.add(w);
 const roof=new THREE.Mesh(new THREE.ConeGeometry(2.7,2,10),TH);roof.position.y=3.05;g.add(roof);
 const door=new THREE.Mesh(new THREE.BoxGeometry(.9,1.5,.1),WD);door.position.set(0,.75,2.02);g.add(door);
 for(let i=0;i<10;i++){const a=i/10*6.28,p=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,2.2,5),WD);p.position.set(Math.cos(a)*2.02,1.1,Math.sin(a)*2.02);g.add(p)}
 put(g,-7,7,0,.5);I.HUT=[-7,7,2.3]}
/* причал на пляжі */
{const g=new THREE.Group();for(let i=0;i<7;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(1.6,.12,.32),W);b.position.set(0,.55,i*.42);g.add(b)}
 for(const x of[-.7,.7])for(const z of[0,1.3,2.6]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.09,.1,1.8,6),WD);p.position.set(x,-.2,z);g.add(p)}
 put(g,8,31.5,-.45,-.35)}
/* вказівник біля входу в ущелину */
{const g=new THREE.Group(),post=new THREE.Mesh(new THREE.CylinderGeometry(.07,.08,1.6,6),WD);post.position.y=.8;g.add(post);
 const bd=new THREE.Mesh(new THREE.BoxGeometry(1.1,.36,.06),W);bd.position.set(.3,1.35,0);g.add(bd);put(g,2.3,I.G0+4,0,-.2)}

/* ---------- куди можна ходити ---------- */
const ok=(x,z,m)=>I.walk(x,z,m)&&(open||!(I.inGorge(x,z)&&z<I.G0+1.2)&&!I.inPlaza(x,z));
I.ok=ok;
/* ---------- оформлення ущелини й майданчика порталу ----------
   Бруківка кільцями, двоступеневий постамент під аркою, 4 обеліски з рунами (світяться в такт порталу), 2 жаровні біля входу,
   світні кристали біля підніжжя скель, плити-сходинки вздовж стежки в ущелині, світлячки, що повільно здіймаються. */
const DECOR=[];/* тверді оздоби — додаються до зіткнень брил */
const DC={};
{const g=new THREE.Group();sc_.add(g);
 const tc=document.createElement('canvas');tc.width=tc.height=512;{const x=tc.getContext('2d');x.fillStyle='#6f6a62';x.fillRect(0,0,512,512);
  let sd=5;const r=()=>(sd=sd*16807%2147483647)/2147483647;const C=256;
  for(let ring=0;ring<9;ring++){const r0=ring*28+8,r1=r0+26,n=Math.max(6,Math.round(ring*7.5));for(let k=0;k<n;k++){const a0=k/n*6.283+ring*.37,a1=(k+1)/n*6.283+ring*.37-.035;
    const l=150+r()*45|0;x.fillStyle=`rgb(${l},${l-6},${l-16})`;x.beginPath();x.arc(C,C,r1,a0,a1);x.arc(C,C,r0+2,a1,a0,true);x.closePath();x.fill();
    x.fillStyle='rgba(0,0,0,.08)';for(let m=0;m<6;m++){const aa=a0+(a1-a0)*r(),rr_=r0+(r1-r0)*r();x.beginPath();x.arc(C+Math.cos(aa)*rr_,C+Math.sin(aa)*rr_,1+r()*3,0,7);x.fill()}}}
  x.strokeStyle='rgba(120,220,255,.55)';x.lineWidth=3;x.beginPath();x.arc(C,C,40,0,7);x.stroke()}
 const tt=new THREE.CanvasTexture(tc);tt.encoding=THREE.sRGBEncoding;
 const floor=new THREE.Mesh(new THREE.CircleGeometry(I.PR-.2,48),new THREE.MeshStandardMaterial({map:tt,roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.set(0,H_(0,I.PZ)+.03,I.PZ);floor.receiveShadow=true;g.add(floor);
 const ST=new THREE.MeshStandardMaterial({color:0x9a958a,roughness:.9,flatShading:true});
 for(const[r,h]of[[3.1,.14],[2.4,.28]]){const st=new THREE.Mesh(new THREE.CylinderGeometry(r,r+.1,h,24),ST);st.position.set(0,H_(0,I.PZ)+h/2,I.PZ);st.receiveShadow=st.castShadow=true;g.add(st)}
 /* обеліски з рунами */
 const RU=new THREE.MeshStandardMaterial({color:0x6fe6ff,emissive:0x39c8ff,emissiveIntensity:1.4});DC.ru=RU;
 for(const[x,z]of[[-4.6,I.PZ-1.2],[4.6,I.PZ-1.2],[-6.3,I.PZ+2.8],[6.3,I.PZ+2.8]]){const o=new THREE.Group();o.position.set(x,H_(x,z),z);
  const b=new THREE.Mesh(new THREE.BoxGeometry(.9,.35,.9),ST);b.position.y=.17;o.add(b);
  const sh=new THREE.Mesh(new THREE.CylinderGeometry(.22,.38,3,4),ST);sh.position.y=1.85;sh.rotation.y=Math.PI/4;o.add(sh);
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.24,.5,4),ST);tip.position.y=3.6;tip.rotation.y=Math.PI/4;o.add(tip);
  for(let k=0;k<3;k++){const r=new THREE.Mesh(new THREE.BoxGeometry(.08,.22,.02),RU);r.position.set(0,1.1+k*.6,.31-k*.04);o.add(r)}
  o.lookAt(0,o.position.y,I.PZ);o.traverse(m=>{if(m.isMesh)m.castShadow=true});g.add(o);DECOR.push({x,z,r:.55})}
 /* жаровні біля входу на майданчик */
 DC.fl=[];const FM=new THREE.MeshStandardMaterial({color:0xffa040,emissive:0xff6010,emissiveIntensity:2.2,transparent:true,opacity:.92});
 for(const x of[-2.9,2.9]){const z=I.PZ+I.PR-1.4,o=new THREE.Group();o.position.set(x,H_(x,z),z);
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,1,6),new THREE.MeshStandardMaterial({color:0x3a3530,roughness:.6,metalness:.5}));leg.position.y=.5;o.add(leg);
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.45,.22,.3,10,1,true),new THREE.MeshStandardMaterial({color:0x4a4038,roughness:.5,metalness:.6,side:THREE.DoubleSide}));bowl.position.y=1.12;o.add(bowl);
  const f=new THREE.Mesh(new THREE.ConeGeometry(.3,.8,8),FM);f.position.y=1.55;o.add(f);DC.fl.push(f);
  const L=new THREE.PointLight(0xffa050,1.1,9,2);L.position.y=1.9;o.add(L);f.userData.L=L;
  o.traverse(m=>{if(m.isMesh)m.castShadow=true});g.add(o);DECOR.push({x,z,r:.5})}
 /* світні кристали */
 const CM=new THREE.MeshStandardMaterial({color:0x8ff0ff,emissive:0x2fb8e8,emissiveIntensity:1.2,roughness:.25,metalness:.1,transparent:true,opacity:.9});DC.cm=CM;
 const crys=(x,z,s)=>{const o=new THREE.Group();o.position.set(x,H_(x,z),z);for(let k=0;k<4;k++){const c=new THREE.Mesh(new THREE.OctahedronGeometry(.18,0),CM);c.scale.set(1,2.4+k*.5,1);
   c.position.set(Math.cos(k*1.7)*.18,.3+k*.06,Math.sin(k*1.7)*.18);c.rotation.set(Math.cos(k)*.4,k,Math.sin(k)*.4);o.add(c)}o.scale.setScalar(s);g.add(o)};
 for(let a=-2.6;a<=-.55;a+=.42)crys(Math.cos(a)*(I.PR-.7),I.PZ+Math.sin(a)*(I.PR-.7),1+Math.abs(Math.sin(a*3))*.6);
 for(const[x,z]of[[-1,-32],[1,-36],[-1,-40],[1,-44]])crys(x*(I.GW-.35),z,.8);
 /* плити-сходинки вздовж ущелини */
 const PM=new THREE.MeshStandardMaterial({color:0x8d877c,roughness:.95,flatShading:true});const PG=new THREE.CylinderGeometry(.55,.6,.12,7);
 const pv=[];for(let z=I.G0+3;z>I.G1-1;z-=1.15){const x=-Math.sin(z*.35)*.6+Math.sin(z*1.7)*.25;pv.push([x,z])}
 const pm=new THREE.InstancedMesh(PG,PM,pv.length),dm=new THREE.Object3D();pv.forEach(([x,z],i)=>{dm.position.set(x,H_(x,z)+.04,z);dm.rotation.set(0,i*1.3,0);dm.scale.set(1+(i%3)*.12,1,.85+(i%2)*.15);dm.updateMatrix();pm.setMatrixAt(i,dm.matrix)});
 pm.receiveShadow=true;g.add(pm);
 /* світлячки */
 const N=90,gp=new THREE.BufferGeometry(),pos=new Float32Array(N*3),mv=[];
 for(let k=0;k<N;k++){const inP=k<45,x=inP?(Math.random()-.5)*I.PR*1.6:(Math.random()-.5)*I.GW*1.6,z=inP?I.PZ+(Math.random()-.5)*I.PR*1.6:I.G0-Math.random()*(I.G0-I.G1);mv.push([x,z,Math.random()*4,.15+Math.random()*.3,Math.random()*6])}
 gp.setAttribute('position',new THREE.BufferAttribute(pos,3));DC.mv=mv;DC.gp=gp;
 g.add(new THREE.Points(gp,new THREE.PointsMaterial({color:0xbff6ff,size:.11,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending})))}
{let t=0;const A=G('ANI'),f=()=>{t+=.016;const k=open?1:.35;DC.ru.emissiveIntensity=(.8+Math.sin(t*2)*.4)*(.5+k*.7);DC.cm.emissiveIntensity=.9+Math.sin(t*1.3)*.35;
  for(const fl of DC.fl){fl.scale.set(1+Math.sin(t*11+fl.id)*.12,1+Math.sin(t*8+fl.id)*.22,1);fl.userData.L.intensity=.9+Math.sin(t*13+fl.id)*.25}
  const p=DC.gp.attributes.position;DC.mv.forEach((m,i)=>{m[2]+=m[3]*.016;if(m[2]>5)m[2]=0;p.setXYZ(i,m[0]+Math.sin(t+m[4])*.3,H_(m[0],m[1])+.3+m[2],m[1]+Math.cos(t*.7+m[4])*.3)});p.needsUpdate=true};
 if(A)A.push(f);else setInterval(f,16)}
/* брили тверді: герой і істоти не проходять крізь камінь */
const RCOL=window.plRockCol?window.plRockCol(rocks.flat().filter(r=>r[4]>2).map(r=>({x:r[0],z:r[2],r:Math.max(r[3],r[5])*.92})).concat(DECOR)):null;
I.RCOL=RCOL;const b0=window.BLDC;
window.BLDC=function(ox,oz){if(b0)b0.apply(this,arguments);if(RCOL)RCOL.push(P_,.35);if(ok(P_.x,P_.z,0))return;
 if(ok(P_.x,oz,0)){P_.z=oz;return}if(ok(ox,P_.z,0)){P_.x=ox;return}P_.x=ox;P_.z=oz};
const cb0=window.colBlocked;
window.colBlocked=function(x0,z0,x1,z1,r){if(!ok(x1,z1,.3)||(RCOL&&RCOL.hit(x1,z1,.4)))return true;return cb0?cb0.apply(this,arguments):false};
/* повернення з великого світу через печеру — до арки; збережена позиція з іншого виміру — на пляж */
/* повернення з великого світу через печеру: хто пройшов навчання (або Брам уже пропустив) — до арки; решта — на пляж, як новачок */
try{if(localStorage.getItem('zi_isle_at')){localStorage.removeItem('zi_isle_at');INV._cave=1;
 if(open){P_.x=0;P_.z=I.PZ+3;P_.face=0;setTimeout(()=>{try{msg('🏝️ Ви повернулися на Острів пробудження')}catch(_){}},1500)}
 else{P_.x=I.START[0];P_.z=I.START[1];P_.face=Math.PI;setTimeout(()=>{try{msg('🏝️ Острів пробудження: пройдіть навчання або попросіть Брама пропустити вас до порталу')}catch(_){}},1500)}}}catch(_){}
if(!ok(P_.x,P_.z,0)){P_.x=I.START[0];P_.z=I.START[1];P_.face=Math.PI}

/* ---------- перехід у звичайний світ ---------- */
const fade=document.createElement('div');fade.style.cssText='position:fixed;inset:0;background:radial-gradient(circle,#bff6ff 0%,#2a6fd8 55%,#06122e 100%);opacity:0;pointer-events:none;transition:opacity 1.2s;z-index:9999';document.body.appendChild(fade);
let going=false;
/* портал пропускає лише зареєстрованих: без акаунта — вікно реєстрації */
const reg=document.createElement('div');reg.id='isreg';reg.style.cssText='position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(4,12,30,.62);z-index:9998';
reg.innerHTML=`<div style="max-width:380px;margin:16px;padding:20px 22px;border-radius:16px;background:linear-gradient(#173a5a,#0e2236);border:2px solid #6fe6ff;color:#eaf6ff;font:15px/1.45 system-ui;text-align:center;box-shadow:0 0 40px rgba(80,200,255,.45)">
<div style="font-size:34px">🌀</div><b style="font-size:18px;color:#9ff2ff">Портал мовчить…</b>
<p style="margin:8px 0 14px">Руни світяться, але не пропускають безіменних. Назвіть себе — створіть акаунт, і портал відкриється. Усе з рюкзака й ваші попали вирушать із вами.</p>
<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button id="isg" style="padding:10px 14px;border-radius:10px;border:0;background:#fff;color:#123;font-weight:800">Увійти через Google</button><button id="ise" style="padding:10px 14px;border-radius:10px;border:0;background:#ffb04a;color:#2a1600;font-weight:800">Через пошту</button></div>
<button id="isx" style="margin-top:12px;background:none;border:0;color:#9fb8cc;text-decoration:underline">Пізніше</button></div>`;
document.body.appendChild(reg);let regT=0;
reg.querySelector('#isg').onclick=()=>{reg.style.display='none';try{G('googleAuth')()}catch(_){}};
reg.querySelector('#ise').onclick=()=>{reg.style.display='none';const e=document.getElementById('em');if(e)e.style.display='flex'};
reg.querySelector('#isx').onclick=()=>{reg.style.display='none';regT=Date.now()};
I.travel=()=>{if(going)return;if(!G('fbU')){if(reg.style.display!='flex'&&Date.now()-regT>6000)reg.style.display='flex';return}
 going=true;fade.style.opacity='1';try{if(window.msg)msg('✨ Портал підхоплює вас…')}catch(_){}
 setTimeout(()=>{try{INV._rl='main';INV._arr=1;localStorage.setItem('zi_arrive','1');if(window.save)save();const cp=G('cloudPush');if(cp)cp(true)}catch(_){}
  const u=new URL(location.href);u.searchParams.delete('realm');u.searchParams.delete('gate');location.replace(u.toString())},1400)};

/* ---------- камера в ущелині й біля арки — ближче, щоб не застрягала в скелях ---------- */
{const z0=window.plZoom;window.plZoom=()=>{const v=z0?z0():9.5;return(I.inGorge(P_.x,P_.z)||I.inPlaza(P_.x,P_.z))?Math.min(v,5.5):v}}
/* попали з бригади Попал-центру на острові не показуються самі: без центру core-world.js їх ховає; супутник лишається з героєм */
/* ---------- анімація ---------- */
let t=0;const ANI_=G('ANI');
const tick=()=>{t+=.016;PU.t.value=t;PU.on.value+=((open?1:0)-PU.on.value)*.03;pl2.intensity=.6+PU.on.value*1.4+Math.sin(t*3)*.15;
 arch.userData.key.rotation.y=t;const kp=sg.attributes.position;for(let i=0;i<SPN;i++){const s=sv[i];s[1]+=s[3]*.016;if(s[1]>5.5)s[1]=0;kp.setXYZ(i,s[0]+Math.sin(t+i)*.1,s[1],s[2])}kp.needsUpdate=true;
 const f=fire.userData.fl;f.scale.set(1+Math.sin(t*9)*.1,1+Math.sin(t*7+1)*.18,1);
 if(open&&!going&&Math.hypot(P_.x-AX,P_.z-AZ)<1.6)I.travel()};
if(ANI_)ANI_.push(tick);else setInterval(tick,16);
}catch(e){console.warn('isle:',e)}})();
