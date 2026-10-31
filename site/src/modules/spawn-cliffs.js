/* Точка спавну великого світу: позаду героя — масив високих прибережних скель із печерою.
   Новий гравець (і той, хто пройшов портал з острова пробудження) зʼявляється біля виходу з печери, обличчям до суші.
   У глибині печери ледь світиться синім — слід порталу. Скелі тверді для героя й істот; дерева, каміння й істоти з-під скель прибрано. */
(function(){try{
if(window.REALM==='isle'||typeof THREE=='undefined')return;
const G=n=>{try{return eval(n)}catch(_){return undefined}};
const S=window.SPAWN,sc_=G('sc'),P_=G('P'),H_=window.H;if(!S||!sc_||!P_||!H_)return;
const fx=Math.sin(S[2]),fz=Math.cos(S[2]);/* напрям у бік суші; позаду — море */
const MO=[S[0]-fx*3.4,S[1]-fz*3.4];/* вхід у печеру */
let seed=313;const rnd=()=>(seed=seed*16807%2147483647)/2147483647,rr=(a,b)=>a+rnd()*(b-a);
const RU=25,RV=15;/* хребет уздовж берега: ±RU убік, RV углиб (до моря) */
/* локальні координати: u — убік, v — від печери вглиб масиву */
const toW=(u,v)=>[MO[0]-fx*v+fz*u,MO[1]-fz*v-fx*u];
const toL=(x,z)=>{const dx=x-MO[0],dz=z-MO[1];return[dx*fz-dz*fx,-(dx*fx+dz*fz)]};
const inTunnel=(x,z)=>{const[u,v]=toL(x,z);return v>-1&&v<7&&Math.abs(u)<1.5};

/* ---------- скелі ---------- */
function rockGeo(k){const g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position,v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=1+.22*Math.sin(v.x*3.1+k)*Math.cos(v.z*2.7-k)+.12*Math.sin(v.y*5.3+k*2);v.multiplyScalar(n);if(v.y>.35)v.y=.35+(v.y-.35)*.55;p.setXYZ(i,v.x,v.y,v.z)}
 g.computeVertexNormals();return g}
const RG=[0,1,2].map(rockGeo),RC=[0x8b8277,0x7a7268,0x968b7c,0x6e675e,0xa39886],L=[[],[],[]];
const add=(x,z,w,h)=>{L[(rnd()*3)|0].push([x,Math.min(H_(x,z),.4)-h*.12,z,w*rr(.85,1.15),h,w*rr(.85,1.2),rnd()*6.28,RC[(rnd()*RC.length)|0]])};
const taper=u=>Math.max(.28,1-Math.pow(Math.abs(u)/(RU+2),2.2));
for(let u=-RU;u<=RU;u+=2.1)for(const[v,w,h]of[[1.6,2.6,9],[4.6,3.6,14],[8.5,4.4,19],[12.5,4.6,15]]){
 const uu=u+rr(-.7,.7),vv=v+rr(-.6,.6)+Math.abs(u)*.12;if(Math.abs(uu)<1.9+w*.6&&vv<7.5)continue;/* прохід печери */
 const[x,z]=toW(uu,vv);add(x,z,w*rr(.85,1.15),h*taper(u)*rr(.8,1.2))}
/* склепіння над входом і тунелем */
for(let v=0;v<8;v+=1.4){const[x,z]=toW(0,v);L[v%3|0].push([x,H_(MO[0],MO[1])+4.3+v*.35,z,2.2,1.6+v*.4,1.8,rnd()*6,RC[(rnd()*5)|0]])}
for(const sd of[-1,1])for(let v=-.6;v<8;v+=1.3){const[x,z]=toW(sd*(2.35+Math.max(0,-v)*.6),v);add(x,z,1.25,7+v*.6)}
const dm=new THREE.Object3D(),cl=new THREE.Color(),RMAT=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,flatShading:true});
L.forEach((A,k)=>{if(!A.length)return;const m=new THREE.InstancedMesh(RG[k],RMAT,A.length);
 A.forEach((r,i)=>{dm.position.set(r[0],r[1],r[2]);dm.scale.set(r[3],r[4],r[5]);dm.rotation.set(0,r[6],0);dm.updateMatrix();m.setMatrixAt(i,dm.matrix);m.setColorAt(i,cl.setHex(r[7]))});
 m.castShadow=true;m.receiveShadow=true;sc_.add(m)});
/* зелень на верхівках */
{const T=[];L.forEach(A=>A.forEach(r=>{if(r[4]>11&&rnd()<.5)T.push(r)}));const pm=new THREE.InstancedMesh(new THREE.ConeGeometry(.9,2.6,6),new THREE.MeshStandardMaterial({color:0x2f6b3a,roughness:.9,flatShading:true}),T.length);
 T.forEach((r,i)=>{dm.position.set(r[0]+rr(-.6,.6),r[1]+r[4]*.35+.9,r[2]+rr(-.6,.6));dm.scale.setScalar(rr(.7,1.3));dm.rotation.set(0,rnd()*6,0);dm.updateMatrix();pm.setMatrixAt(i,dm.matrix)});pm.castShadow=true;sc_.add(pm)}
/* темна глибина печери і синє сяйво порталу всередині */
{const g=new THREE.Group(),y=H_(MO[0],MO[1]);g.position.set(MO[0],y,MO[1]);g.rotation.y=Math.atan2(fx,fz);
 const sh=new THREE.Shape();sh.moveTo(-1.2,0);sh.lineTo(-1.2,2);sh.absarc(0,2,1.2,Math.PI,0,true);sh.lineTo(1.2,0);sh.lineTo(-1.2,0);
 const mouth=new THREE.Mesh(new THREE.ShapeGeometry(sh,12),new THREE.MeshBasicMaterial({color:0x0b0a09}));mouth.position.set(0,.02,-2.6);g.add(mouth);
 const tun=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,7.5,12,1,true,Math.PI/2,Math.PI),new THREE.MeshStandardMaterial({color:0x1b1714,roughness:1,side:THREE.BackSide}));
 tun.rotation.x=Math.PI/2;tun.position.set(0,0,-3.6);g.add(tun);
 const back=new THREE.Mesh(new THREE.CircleGeometry(1.7,16),new THREE.MeshBasicMaterial({color:0x05080c}));back.position.set(0,1,-7.2);g.add(back);
 const gc=document.createElement('canvas');gc.width=gc.height=128;{const x=gc.getContext('2d'),gr=x.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(170,240,255,1)');gr.addColorStop(.35,'rgba(70,170,255,.55)');gr.addColorStop(1,'rgba(20,60,140,0)');x.fillStyle=gr;x.fillRect(0,0,128,128)}
 const glow=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(gc),transparent:true,opacity:.45,blending:THREE.AdditiveBlending,depthWrite:false}));
 glow.scale.set(.8,1.3,1);glow.position.set(0,1.3,-2.5);g.add(glow);
 const pl=new THREE.PointLight(0x5fd0ff,1.1,8,2);pl.position.set(0,1.4,-1.5);g.add(pl);sc_.add(g);
 const A=G('ANI');let t=0;if(A)A.push(()=>{t+=.016;glow.material.opacity=.28+Math.sin(t*2)*.08;pl.intensity=.9+Math.sin(t*2)*.25})}

/* ---------- прибрати все, що опинилось під скелями ---------- */
const inRidge=(x,z,m)=>{const[u,v]=toL(x,z);return Math.abs(u)<RU+1+m&&v>-.1-m+Math.abs(u)*.12&&v<RV+m};
const under=(x,z)=>inRidge(x,z,1.5);
for(const nm of['trees','rocks','bushes','shrooms']){const A=G(nm);if(!A)continue;for(let i=A.length-1;i>=0;i--)if(under(A[i].x,A[i].z)){sc_.remove(A[i].m);A.splice(i,1)}}
{const W=G('wild');if(W)for(const w of W)if(under(w.x,w.z)){w.x=S[0]+fx*16+rr(-4,4);w.z=S[1]+fz*16+rr(-4,4)}}

/* ---------- скелі тверді ---------- */
const blocked=(x,z,m)=>inRidge(x,z,m)&&!inTunnel(x,z);
const b0=window.BLDC;
window.BLDC=function(ox,oz){if(b0)b0.apply(this,arguments);if(!blocked(P_.x,P_.z,0))return;
 if(!blocked(P_.x,oz,0)){P_.z=oz;return}if(!blocked(ox,P_.z,0)){P_.x=ox;return}P_.x=ox;P_.z=oz};
const cb0=window.colBlocked;
window.colBlocked=function(x0,z0,x1,z1,r){if(blocked(x1,z1,.4))return true;return cb0?cb0.apply(this,arguments):false};
window.SPAWN_CAVE={MO,RU,RV,blocked};
/* камера на старті — з боку суші, щоб у кадрі були герой і печера за ним */
window.plCaveCam=()=>{try{eval('ang=S[2]')}catch(_){}};
if(Math.hypot(P_.x-S[0],P_.z-S[1])<1)window.plCaveCam();
}catch(e){console.warn('spawn-cliffs:',e)}})();
