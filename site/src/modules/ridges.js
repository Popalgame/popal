/* Гірські хребти Локації 2: три хребти поперек острова відділяють чотири зони; пройти можна лише ущелинами-перевалами
   (кам'яні стіни в три яруси, арка, стежка з каменів). Гори тверді для героя й істот; дерева, каміння й істоти з-під гір прибрано. */
(function(){try{
if(window.REALM==='isle'||typeof THREE=='undefined'||typeof plCliff=='undefined')return;
const G=n=>{try{return eval(n)}catch(_){return undefined}};
const sc_=G('sc'),P_=G('P'),H_=window.H;if(!sc_||!P_||!H_)return;
let seed=7919;const rnd=()=>(seed=seed*16807%2147483647)/2147483647,rr=(a,b)=>a+rnd()*(b-a);
/* 0.3.2: Локація 2 — три хребти поперек острова; пройти можна лише перевалами (ущелинами):
   хребет 1 (z≈110) — перевал посередині; хребет 2 (z≈0) — два перевали, лівий і правий; хребет 3 (z≈−118) — перевал посередині.
   У кожній ущелині s — уздовж хребта (вісь x), q — уздовж проходу (вісь z). */
const GW=6,GL=16,W=5.2;/* півширина проходу, напівдовжина ущелини, півширина хребта */
const RZ=[110,0,-118],rz=(k,x)=>RZ[k]+4*Math.sin(x*.045+k*1.7)+2*Math.sin(x*.11+k);
const PASSES=[[0,0],[1,-95],[1,95],[2,0]].map(([k,x])=>({k,GZ:[x,rz(k,x)]}));
const LINES=[];/* відрізки хребтів між перевалами, від берега до берега */
for(let k=0;k<3;k++){const gaps=PASSES.filter(p=>p.k==k).map(p=>p.GZ[0]).sort((a,b)=>a-b);let x0=-160;
 for(const g of[...gaps,999]){const x1=g==999?160:g-GW-4.5;const L=[];for(let x=x0;x<x1;x+=10)L.push([x,rz(k,x)]);L.push([x1,rz(k,x1)]);if(L.length>1)LINES.push({k,L,coastA:x0<=-159,coastB:g==999});x0=g+GW+4.5}}
function segD(L,x,z){let best=1e9,bt=0,acc=0,tot=0;for(let i=1;i<L.length;i++)tot+=Math.hypot(L[i][0]-L[i-1][0],L[i][1]-L[i-1][1]);
 for(let i=1;i<L.length;i++){const a=L[i-1],b=L[i],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz,l=Math.sqrt(l2);let t=((x-a[0])*dx+(z-a[1])*dz)/l2;t=Math.max(0,Math.min(1,t));
  const d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);if(d<best){best=d;bt=(acc+l*t)/tot}acc+=l}return[best,bt]}
const gL=(P,x,z)=>[x-P.GZ[0],z-P.GZ[1]];
const inPass=(x,z,m)=>PASSES.some(P=>{const[s,q]=gL(P,x,z);return Math.abs(s)<GW-.6-m&&Math.abs(q)<GL+6});
const inWall=(x,z,m)=>PASSES.some(P=>{const[s,q]=gL(P,x,z);return Math.abs(s)>=GW-.6-m&&Math.abs(s)<GW+9.6+m&&Math.abs(q)<GL+m});
const inRidge=(x,z,m)=>LINES.some(o=>Math.abs(z-RZ[o.k])<16&&segD(o.L,x,z)[0]<W+m);
const blockedRaw=(x,z,m)=>!inPass(x,z,m)&&(inRidge(x,z,m)||inWall(x,z,m));

/* ---------- скелі ---------- */
const RG=[0,1,2].map(k=>plCliff.geo(k)),RC=plCliff.cols,L=[[],[],[]],SNOW=0xb8b0a4;/* 0.3.1: без снігу — світлий камінь */
const add=(x,z,w,h,col)=>{const y=H_(x,z);if(y<-2.5)return;L[(rnd()*3)|0].push([x,Math.min(y,.6)-h*.1,z,w*rr(.85,1.15),h,w*rr(.85,1.2),rnd()*6.28,col||RC[(rnd()*RC.length)|0]])};
/* профіль висоти: до моря хребет нижчає, біля ущелини — високі стіни */
const prof=(t,coastA,coastB)=>{let k=1;if(coastA)k=Math.min(k,.35+.65*Math.min(1,t*5));if(coastB)k=Math.min(k,.35+.65*Math.min(1,(1-t)*5));return k};
function ridge(Lp,coastA,coastB){let tot=0;for(let i=1;i<Lp.length;i++)tot+=Math.hypot(Lp[i][0]-Lp[i-1][0],Lp[i][1]-Lp[i-1][1]);
 let acc=0;for(let i=1;i<Lp.length;i++){const a=Lp[i-1],b=Lp[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),nx=-dz/l,nz=dx/l;
  for(let s=0;s<l;s+=2.3){const t=(acc+s)/tot,k=prof(t,coastA,coastB),px=a[0]+dx*s/l,pz=a[1]+dz*s/l,peak=(.75+.5*Math.abs(Math.sin(px*.21+pz)))*k;
   for(const[o,w,h]of[[-4.2,3.4,9],[-1.5,4.4,17],[1.5,4.4,17],[4.2,3.4,9]]){const oo=o+rr(-.6,.6),hh=h*peak*rr(.85,1.2);add(px+nx*oo,pz+nz*oo,w*rr(.85,1.15),hh)}
   if(peak>.95&&rnd()<.55)add(px+nx*rr(-.8,.8),pz+nz*rr(-.8,.8),2.6,24*peak*rr(.9,1.1),SNOW)}/* світлі кам'яні піки */
  acc+=l}}
for(const o of LINES)ridge(o.L,o.coastA,o.coastB);
/* ущелини: три яруси брил обабіч проходу, кам'яна арка над серединою, валуни біля підніжжя */
const RIM=[];
for(const PS of PASSES){const[gx,gz]=PS.GZ;
 for(const sd of[-1,1])for(let q=-GL;q<=GL;q+=1.6){const taper=1-Math.pow(Math.abs(q)/(GL+4),2)*.4;
  for(const[o,w,h]of[[GW+2.8,2.6,10],[GW+5.4,3.4,17],[GW+8.2,4.2,25]]){const x=gx+sd*(o+rr(-.3,.3)),z=gz+q;const hh=h*taper*rr(.85,1.15);add(x,z,w,hh);if(o>GW+7)RIM.push([x,z,hh])}}
 for(let a=0;a<=Math.PI+1e-6;a+=Math.PI/11){const x=gx-Math.cos(a)*(GW+1.6),y=Math.sin(a)*7.5+4.5;L[(rnd()*3)|0].push([x,H_(gx,gz)+y,gz,1.9,1.5,1.7,rnd()*6.28,RC[(rnd()*RC.length)|0]])}
 for(const sd of[-1,1])for(let q=-GL+2;q<=GL-2;q+=rr(3.5,6))add(gx+sd*rr(GW-.9,GW-.3),gz+q,rr(.7,1.1),rr(1.1,1.8))}
const dm=new THREE.Object3D(),cl=new THREE.Color(),RMAT=plCliff.mat();
L.forEach((A,k)=>{if(!A.length)return;const m=new THREE.InstancedMesh(RG[k],RMAT,A.length);
 A.forEach((r,i)=>{dm.position.set(r[0],r[1],r[2]);dm.scale.set(r[3],r[4],r[5]);dm.rotation.set(0,r[6],0);dm.updateMatrix();m.setMatrixAt(i,dm.matrix);m.setColorAt(i,cl.setHex(r[7]))});
 m.castShadow=true;m.receiveShadow=true;sc_.add(m)});
/* ялинки на схилах */
{const TR=[];L.forEach(A=>A.forEach(r=>{if(r[4]>8&&r[4]<16&&r[7]!==SNOW&&rnd()<.35)TR.push(r)}));
 const pm=new THREE.InstancedMesh(new THREE.ConeGeometry(.9,2.6,6),new THREE.MeshStandardMaterial({color:0x2f6b3a,roughness:.9,flatShading:true}),TR.length);
 TR.forEach((r,i)=>{dm.position.set(r[0]+rr(-.6,.6),r[1]+r[4]*.36+.9,r[2]+rr(-.6,.6));dm.scale.setScalar(rr(.7,1.3));dm.rotation.set(0,rnd()*6,0);dm.updateMatrix();pm.setMatrixAt(i,dm.matrix)});
 pm.castShadow=true;sc_.add(pm)}

/* стежка з пласких каменів посередині проходу і ялинки на краях каньйону */
{const sg=new THREE.CylinderGeometry(.55,.62,.16,9),sm=new THREE.MeshStandardMaterial({color:0xb9ad98,roughness:1,flatShading:true}),n1=Math.floor(GL*2/1.25)+1,st=new THREE.InstancedMesh(sg,sm,n1*PASSES.length);let ii=0;
 for(const PS of PASSES)for(let i=0;i<n1;i++){const q=-GL+i*1.25,s=Math.sin(q*.35)*.9+rr(-.25,.25),x=PS.GZ[0]+s,z=PS.GZ[1]+q;dm.position.set(x,H_(x,z)+.03,z);dm.scale.set(rr(.8,1.2),1,rr(.7,1.1));dm.rotation.set(0,rnd()*6,0);dm.updateMatrix();st.setMatrixAt(ii++,dm.matrix)}
 st.receiveShadow=true;sc_.add(st);
 const pg=new THREE.ConeGeometry(1.1,3.4,7),pm=new THREE.MeshStandardMaterial({color:0x2c6a3a,roughness:.9,flatShading:true}),P=RIM.filter(()=>rnd()<.6),pi=new THREE.InstancedMesh(pg,pm,P.length*2);let k=0;
 P.forEach(r=>{for(let t=0;t<2;t++){dm.position.set(r[0]+rr(-1.2,1.2),Math.min(H_(r[0],r[2]),.6)+r[2]*.33+1.4,r[1]+rr(-1.2,1.2));dm.scale.setScalar(rr(.7,1.25));dm.rotation.set(0,rnd()*6,0);dm.updateMatrix();pi.setMatrixAt(k++,dm.matrix)}});
 pi.count=k;pi.castShadow=true;sc_.add(pi)}

/* ---------- прибрати все, що опинилось під горами ---------- */
const under=(x,z)=>blockedRaw(x,z,1.5);
for(const nm of['trees','rocks','bushes','shrooms','veins','ores']){const A=G(nm);if(!Array.isArray(A))continue;for(let i=A.length-1;i>=0;i--)if(A[i]&&A[i].x!=null&&under(A[i].x,A[i].z)){if(A[i].m)sc_.remove(A[i].m);A.splice(i,1)}}
/* виштовхнути точку з гір на найближче вільне місце */
const free=(x,z)=>{if(!blockedRaw(x,z,.6))return[x,z];for(let r=2;r<40;r+=1.5)for(let a=0;a<6.28;a+=.4){const nx=x+Math.cos(a)*r,nz=z+Math.sin(a)*r;if(!blockedRaw(nx,nz,.8)&&H_(nx,nz)>-.4)return[nx,nz]}return[x,z]};
{const Wd=G('wild');if(Wd)for(const w of Wd)if(under(w.x,w.z)){const f=free(w.x,w.z);w.x=f[0];w.z=f[1];if(w.m)w.m.position.set(w.x,H_(w.x,w.z),w.z)}}
/* герой, збережений усередині гір (старий сейв), — поруч на вільному місці */


/* ---------- гори тверді ---------- */
/* кожна брила тверда за своїм розміром — і на краях хребта, і в стінах ущелини (раніше герой заходив у бічні брили) */
const RCOL=window.plRockCol?window.plRockCol(L.flat().filter(r=>r[1]<H_(r[0],r[2])+1.5).map(r=>({x:r[0],z:r[2],r:Math.max(r[3],r[5])*1.05}))):null;
const blocked=(x,z,m)=>blockedRaw(x,z,m)||(!!RCOL&&RCOL.hit(x,z,m+.3));
const b0=window.BLDC;
window.BLDC=function(ox,oz){if(b0)b0.apply(this,arguments);if(!blocked(P_.x,P_.z,0))return;
 if(!blocked(P_.x,oz,0)){P_.z=oz;return}if(!blocked(ox,P_.z,0)){P_.x=ox;return}P_.x=ox;P_.z=oz};
const cb0=window.colBlocked;
window.colBlocked=function(x0,z0,x1,z1,r){if(blocked(x1,z1,.4))return true;return cb0?cb0.apply(this,arguments):false};
/* герой, збережений усередині гір чи брили (старий сейв), — поруч на вільному місці */
if(blocked(P_.x,P_.z,0)){for(let r=1.5;r<40;r+=1.5){let ok=null;for(let a=0;a<6.28&&!ok;a+=.4){const nx=P_.x+Math.cos(a)*r,nz=P_.z+Math.sin(a)*r;if(!blocked(nx,nz,.5)&&H_(nx,nz)>-.4)ok=[nx,nz]}if(ok){P_.x=ok[0];P_.z=ok[1];break}}}
window.RIDGES={blocked,snow:(x,z)=>LINES.some(o=>Math.abs(z-RZ[o.k])<8&&segD(o.L,x,z)[0]<1.6),GZ:PASSES[0].GZ,PASSES,RZ,rz,W};
}catch(e){console.warn('ridges:',e)}})();
