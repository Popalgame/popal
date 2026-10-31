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
  if(nearGorge(x,z)||nearPlaza(x,z))continue;
  const fade=Math.max(.25,Math.min(1,(I.CLZ+dd*.5-z)/9));/* скелі сходять у море біля пляжу */
  addRock(x,z,w*rr(.8,1.2),h*fade*rr(.75,1.25))}}
/* стіни ущелини: стрімкі брили обабіч вузького проходу */
for(let z=I.G0+3;z>I.G1-2;z-=1.6)for(const sd of[-1,1]){const xc=-Math.sin(z*.35)*.6;
 addRock(xc+sd*(I.GW+1.7+rr(0,.5)),z,rr(1.6,2.3),rr(11,16));addRock(xc+sd*(I.GW+4.5+rr(0,1)),z,rr(3,4),rr(15,22))}
/* навколо майданчика арки — півколо скель (вхід з ущелини вільний) */
for(let a=0;a<Math.PI*2;a+=.2){const x=Math.cos(a)*(I.PR+1.8),z=I.PZ+Math.sin(a)*(I.PR+1.8);if(z>I.PZ+I.PR-1&&Math.abs(x)<I.GW+1.5)continue;
 addRock(x,z,rr(2.2,3),rr(10,15));addRock(Math.cos(a)*(I.PR+6),I.PZ+Math.sin(a)*(I.PR+6),rr(4,5),rr(16,24))}
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
 for(let i=0;i<9;i++){const m=new THREE.Mesh(RG[i%3],SM);m.scale.set(rr(.6,1.1),rr(.6,1.2),rr(.6,1));m.position.set(rr(-1.6,1.6),rr(.2,1.4)+(i>5?1:0),rr(-.6,.6));m.rotation.y=rnd()*6;m.castShadow=true;gate.add(m)}
 const VM=new THREE.MeshStandardMaterial({color:0x58c46a,emissive:0x3cff9a,emissiveIntensity:.55,roughness:.6});
 for(let i=0;i<7;i++){const c=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.9,rr(.3,2.6),.7),new THREE.Vector3(rr(-.8,0),rr(.5,3),.9),new THREE.Vector3(rr(0,.8),rr(.5,3),.9),new THREE.Vector3(1.9,rr(.3,2.6),.7)]);
  const v=new THREE.Mesh(new THREE.TubeGeometry(c,24,.05,5,false),VM);v.userData.vine=1;gate.add(v)}}
/* відкритий прохід: ліани зникають, а каміння завалу лежить купою біля стіни ущелини (його туди відносить Брам, isle-npc.js) */
I.PILE=[3.5,I.G0+3.3];I.gate=gate;
const toPile=()=>{gate.children.forEach(o=>{if(o.userData.vine)o.visible=false});gate.position.set(I.PILE[0],H_(I.PILE[0],I.PILE[1])-.25,I.PILE[1]);gate.rotation.set(0,.7,0);gate.scale.set(.85,.6,.85);gate.visible=true};
const INV=G('inv')||{};INV._rl='isle';
let open=!!INV._isg;try{if(new URLSearchParams(location.search).get('gate')=='open')open=true}catch(_){}
if(open)toPile();
I.isOpen=()=>open;
I.open=()=>{open=true;toPile();INV._isg=1;try{save()}catch(_){}};

/* ---------- арка-портал ---------- */
const arch=new THREE.Group(),AX=0,AZ=I.PZ-1.5;arch.position.set(AX,H_(AX,AZ),AZ);sc_.add(arch);
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
put(fire,I.SP[0][0]+1.5,I.SP[0][1]-1);
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
const b0=window.BLDC;
window.BLDC=function(ox,oz){if(b0)b0.apply(this,arguments);if(ok(P_.x,P_.z,0))return;
 if(ok(P_.x,oz,0)){P_.z=oz;return}if(ok(ox,P_.z,0)){P_.x=ox;return}P_.x=ox;P_.z=oz};
const cb0=window.colBlocked;
window.colBlocked=function(x0,z0,x1,z1,r){if(!ok(x1,z1,.3))return true;return cb0?cb0.apply(this,arguments):false};
/* повернення з великого світу через печеру — до арки; збережена позиція з іншого виміру — на пляж */
try{if(localStorage.getItem('zi_isle_at')){localStorage.removeItem('zi_isle_at');open=true;toPile();INV._isg=1;P_.x=0;P_.z=I.PZ+3;P_.face=0;setTimeout(()=>{try{msg('🏝️ Ви повернулися на Острів пробудження')}catch(_){}},1500)}}catch(_){}
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
 setTimeout(()=>{try{INV._rl='main';localStorage.setItem('zi_arrive','1');if(window.save)save();const cp=G('cloudPush');if(cp)cp(true)}catch(_){}
  const u=new URL(location.href);u.searchParams.delete('realm');u.searchParams.delete('gate');location.replace(u.toString())},1400)};

/* ---------- анімація ---------- */
let t=0;const ANI_=G('ANI');
const tick=()=>{t+=.016;PU.t.value=t;PU.on.value+=((open?1:0)-PU.on.value)*.03;pl2.intensity=.6+PU.on.value*1.4+Math.sin(t*3)*.15;
 arch.userData.key.rotation.y=t;const kp=sg.attributes.position;for(let i=0;i<SPN;i++){const s=sv[i];s[1]+=s[3]*.016;if(s[1]>5.5)s[1]=0;kp.setXYZ(i,s[0]+Math.sin(t+i)*.1,s[1],s[2])}kp.needsUpdate=true;
 const f=fire.userData.fl;f.scale.set(1+Math.sin(t*9)*.1,1+Math.sin(t*7+1)*.18,1);
 if(open&&!going&&Math.hypot(P_.x-AX,P_.z-AZ)<1.6)I.travel()};
if(ANI_)ANI_.push(tick);else setInterval(tick,16);
}catch(e){console.warn('isle:',e)}})();
