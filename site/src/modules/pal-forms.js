/* 0.2.9: вигляд форм 2 і 3 для кожного попала — та сама істота, але дорослішає й отримує нові частини тіла.
   PALFORM.ensure(rig, ty, fm) додає до моделі з pal-models.js деталі потрібної форми (і прибирає деталі іншої форми,
   бо моделі беруться з пулу). Деталі кріпляться до вузлів скелета (голова, тулуб, хвіст, лапи, крила), тож рухаються разом із ними,
   і мають такий самий темний контур, як і самі моделі.
   Бамбузл — бамбукові наплічники й спис → панцир і бамбукова корона; Грумрок — кристали, бури, ріг → кристалевий гребінь і кам'яні пластини;
   Ігніс-Виверг — вогняні роги → вогняна корона, палаючі лапи, крила з плазми; Міражбр — хвіст-спіраль, гребінь, тіньові плавці → ширяє, плащ-крила, світні візерунки;
   Пухоклуб — більша хмара вовни, ріжки → грозова хмара, великі роги, блискавка; Крилоша — більші крила, вуса → 4 крила, корона з пилку, сяйний шлейф;
   Мороріг — крижані гілки на рогах, грива → крижана корона, нагрудник; Грозовик — грива з шипами, хвіст-блискавка → розряди, броньовані лапи;
   Хвилезуб — більший плавник, плавці на лапах → подвійний плавник, броньована морда; Сонцеклюв — хвіст із пір'я, більший вінець → вогняні крила, корона, хвіст-полум'я. */
(function(){try{
if(typeof THREE=='undefined')return;
const TAG='pform';
const std=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.62,metalness:.05},o||{}));
const glw=(c,e,i)=>new THREE.MeshStandardMaterial({color:c,emissive:e==null?c:e,emissiveIntensity:i||1.1,roughness:.35});
const ice=(c)=>new THREE.MeshStandardMaterial({color:c,emissive:0x2a9ad0,emissiveIntensity:.55,roughness:.12,metalness:.15,transparent:true,opacity:.9,flatShading:true});
const veil=(c,o)=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.5,transparent:true,opacity:o||.55,side:THREE.DoubleSide,depthWrite:false,roughness:.5});
const OLM={};const olMat=c=>OLM[c]||(OLM[c]=new THREE.MeshBasicMaterial({color:c,side:THREE.BackSide}));
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
/* ---------- побудова ---------- */
function ctx(r){r.root.updateMatrixWorld(true);const box=(n,sz)=>{const b=new THREE.Box3();if(n)b.setFromObject(n);if(b.isEmpty()&&n){/* вузол без власної геометрії (кістка скелета) — беремо його місце й типовий розмір */const p=n.getWorldPosition(V());b.setFromCenterAndSize(p,sz||V(.5,.46,.5))}return b};
 const body=r.body||r.torso||r.root,B=box(r.torso||r.body||r.root);if(r.body&&r.torso)B.union(box(r.body));
 if(!r.torso){/* тулуб без окремого вузла (Пухоклуб) — уся модель без голови */const A=box(r.root);B.copy(A);B.max.y=Math.min(A.max.y,box(r.head).min.y+.12)}
 const Hd=box(r.head),Tl=r.tail?box(r.tail,V(.3,.3,.3)):null;
 return{r,B,H:Hd,T:Tl,hc:Hd.getCenter(V()),bc:B.getCenter(V()),body}}
/* деталь кріпиться до вузла node; p — точка в просторі моделі */
function put(node,mesh,p,rot,ol){node=node||mesh;const q=p.clone();node.worldToLocal(q);mesh.position.copy(q);if(rot)mesh.rotation.set(rot[0]||0,rot[1]||0,rot[2]||0);mesh.userData[TAG]=1;mesh.castShadow=true;node.add(mesh);
 if(ol!==0&&mesh.geometry&&!mesh.material.transparent){const o=new THREE.Mesh(mesh.geometry,olMat(ol||0x1a1a2a));o.scale.setScalar(1.07);o.userData[TAG]=1;mesh.add(o)}return mesh}
const M=(geo,mat)=>new THREE.Mesh(geo,mat);
const cone=(r,h,s)=>new THREE.ConeGeometry(r,h,s||7),cyl=(a,b,h,s)=>new THREE.CylinderGeometry(a,b,h,s||10),sph=(r,w,h)=>new THREE.SphereGeometry(r,w||14,h||10),oct=r=>new THREE.OctahedronGeometry(r,0);
/* вигнутий ріг/вус: ланцюжок звужених циліндрів уздовж кривої (точки — у просторі моделі) */
function horn(node,pts,r0,mat,ol){const c=new THREE.CatmullRomCurve3(pts),n=7,g=new THREE.Group();
 for(let i=0;i<n;i++){const a=c.getPoint(i/n),b=c.getPoint((i+1)/n),L=a.distanceTo(b),r1=r0*(1-i/n)+.008,r2=r0*(1-(i+1)/n)+.006,s=M(cyl(r2,r1,L*1.12,8),mat);
  s.position.copy(a).add(b).multiplyScalar(.5);s.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize());g.add(s)}
 g.userData[TAG]=1;const pv=V(0,0,0);node.worldToLocal(pv);g.position.copy(pv);node.add(g);
 if(ol!==0)g.children.forEach(s=>{const o=new THREE.Mesh(s.geometry,olMat(ol||0x1a1a2a));o.scale.set(1.12,1.02,1.12);s.add(o)});return g}
/* плоска форма (крило, плавник, перо): pts — контур у площині XY, товщина d */
function slab(pts,d){const s=new THREE.Shape();pts.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));
 const g=new THREE.ExtrudeGeometry(s,{depth:d||.03,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:1,curveSegments:8});g.translate(0,0,-(d||.03)/2);return g}
function curveSlab(pts,d){const s=new THREE.Shape();s.moveTo(pts[0][0],pts[0][1]);for(let i=1;i+2<pts.length;i+=3)s.bezierCurveTo(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],pts[i+2][0],pts[i+2][1]);
 const g=new THREE.ExtrudeGeometry(s,{depth:d||.03,bevelEnabled:true,bevelThickness:.01,bevelSize:.01,bevelSegments:1,curveSegments:10});g.translate(0,0,-(d||.03)/2);return g}
const FEATHER=[[0,0],[.08,.22],[.06,.62],[0,.9],[-.06,.62],[-.08,.22],[0,0]];
function zig(node,a,b,n,amp,mat,th){th=th||.022;const g=new THREE.Group(),d=b.clone().sub(a),side=V(-d.z,0,d.x).normalize().multiplyScalar(amp);let prev=a.clone();
 for(let i=1;i<=n;i++){const p=a.clone().add(d.clone().multiplyScalar(i/n)).add(i<n?side.clone().multiplyScalar(i%2?1:-1):V());const L=prev.distanceTo(p),s=M(cyl(th,th,L,6),mat);
  s.position.copy(prev).add(p).multiplyScalar(.5);s.quaternion.setFromUnitVectors(V(0,1,0),p.clone().sub(prev).normalize());g.add(s);prev=p}
 g.userData[TAG]=1;const pv=V(0,0,0);node.worldToLocal(pv);g.position.copy(pv);node.add(g);return g}
const legTips=c=>(c.r.legs||[]).map(l=>{const n=l.g||l,b=new THREE.Box3().setFromObject(n),m=b.getCenter(V());return{n,p:V(m.x,b.min.y+.05,m.z),b}});
/* темніший і насиченіший колір хутра/шкіри у формі 3 */
function deepen(r,on){r.root.traverse(o=>{if(!o.isMesh||o.userData[TAG]||!o.material||!o.material.color||o.material.isMeshBasicMaterial||Array.isArray(o.material))return;
 if(!on&&!o.userData.pfMat)return;if(!o.userData.pfMat){const c=o.material.clone();c.userData={c0:o.material.color.getHex()};o.userData.pfOrig=o.material;o.material=c;o.userData.pfMat=1}/* власна копія матеріалу — інші попали не темніють */
 const m=o.material;m.color.setHex(m.userData.c0);if(on){const h={};m.color.getHSL(h);if(h.l<.8&&!m.vertexColors)m.color.setHSL(h.h,Math.min(1,h.s*1.12),h.l*.88)}})}/* світлу вовну, лід і пір'я не чіпаємо */

/* ---------- 10 видів ---------- */
const BAMBOO=std(0x7cc04a),BAMD=std(0x4f8f2e),LEAF=std(0xb2f27c,{side:THREE.DoubleSide});
function bambooStalk(node,a,b,r){const g=new THREE.Group(),d=b.clone().sub(a),L=d.length(),n=Math.max(2,Math.round(L/.22));
 for(let i=0;i<n;i++){const s=M(cyl(r,r*1.04,L/n*.96,10),BAMBOO);s.position.y=-L/2+L/n*(i+.5);g.add(s);const k=M(new THREE.TorusGeometry(r*1.04,r*.18,6,14),BAMD);k.rotation.x=Math.PI/2;k.position.y=-L/2+L/n*i;g.add(k)}
 g.position.copy(a).add(b).multiplyScalar(.5);g.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());const w=g.position.clone();node.worldToLocal(w);g.position.copy(w);g.userData[TAG]=1;node.add(g);
 g.children.forEach(s=>{if(s.geometry.type=='CylinderGeometry'){const o=new THREE.Mesh(s.geometry,olMat(0x1f4a2a));o.scale.set(1.12,1.01,1.12);s.add(o)}});return g}
const F={
 0(c,fm){const{r,B,H,hc,bc}=c,t=r.torso||r.body,O=0x1f4a2a;
  for(const s of[-1,1]){const y=H.min.y+.04;for(let i=0;i<3;i++){const x=s*(.27+.05*i);bambooStalk(t,V(x,y-.06*i,bc.z+.17),V(x+s*.03,y-.06*i-.03,bc.z-.17),.062)}}/* наплічники — на плечах під головою */
  bambooStalk(t,V(-.38,.35,B.min.z-.06),V(.42,2.0+(fm>2?.2:0),B.min.z-.12),.045);
  const tip=put(t,M(cone(.09,.42,6),LEAF),V(.47,2.2+(fm>2?.2:0),B.min.z-.13),[0,0,-.42],O);tip.scale.z=.35;
  if(fm>=3){const tb=new THREE.Box3().setFromObject(t),tc=tb.getCenter(V()),fz=tb.max.z-.06;for(let i=0;i<5;i++){const a=(i-2)*.36,x=tc.x+Math.sin(a)*.2,z=fz-(1-Math.cos(a))*.12;bambooStalk(t,V(x,tc.y-.2,z),V(x,tc.y+.18,z+.02),.042)}/* панцир на грудях */
   for(let i=0;i<7;i++){const a=i/7*Math.PI*2,x=hc.x+Math.cos(a)*.24,z=hc.z+Math.sin(a)*.22;bambooStalk(r.head,V(x,H.max.y-.08,z),V(x*1.05,H.max.y+.12+(i%2)*.08,z*1.05),.035);
    const l=put(r.head,M(cone(.05,.16,5),LEAF),V(x*1.08,H.max.y+.22+(i%2)*.08,z*1.08),[0,a,.6],O);l.scale.z=.3}}},
 1(c,fm){const{r,B,H,hc,bc}=c,t=r.torso||r.body,CR=glw(0x9af0ff,0x2ab8e8,.7),O=0x4a3322,n=fm>=3?9:5;
  for(let i=0;i<n;i++){const k=i/(n-1),z=B.max.z-.2-(B.max.z-B.min.z-.35)*k,s=(fm>=3?.17:.13)*(1-Math.abs(k-.45)*.6),m=put(t,M(oct(s),CR),V(bc.x+(i%2?.05:-.05),B.max.y+s*.6,z),[0,i,(i%2?.25:-.25)],0x1a5a7a);m.scale.y=2.1}
  const hn=put(r.head,M(cone(.07,.34,6),CR),V(hc.x,H.max.y+.08,H.max.z-.08),[.55,0,0],0x1a5a7a);if(fm>=3){for(const s of[-1,1])put(r.head,M(cone(.05,.24,6),CR),V(hc.x+s*.13,H.max.y+.02,H.max.z-.14),[.5,0,-s*.35],0x1a5a7a);hn.scale.setScalar(1.3)}
  const DR=std(0x8a8f9e,{metalness:.5,roughness:.35});legTips(c).slice(0,2).forEach(l=>put(l.n,M(cone(.07,.26,8),DR),V(l.p.x,l.p.y+.06,l.b.max.z+.08),[Math.PI/2,0,0],O));
  if(fm>=3){const ST=std(0x7a6a5a,{roughness:.9,flatShading:true});const tb=new THREE.Box3().setFromObject(t),tc=tb.getCenter(V()),hw=(tb.max.x-tb.min.x)/2;for(const s of[-1,1])for(let i=0;i<3;i++){put(t,M(new THREE.BoxGeometry(.05,.2,.24),ST),V(tc.x+s*(hw-.04),tc.y+.12,tc.z+.25-i*.25),[0,0,s*.45],O)}/* пластини лежать на боках */}},
 2(c,fm){const{r,B,H,hc}=c,t=r.torso||r.body,PU=std(0x4a3a5a),FL=glw(0xffb85a,0xff7a2a,1.4),O=0x1d1428;
  for(const s of[-1,1]){horn(r.head,[V(hc.x+s*.12,H.max.y-.05,hc.z),V(hc.x+s*.2,H.max.y+.12,hc.z-.02),V(hc.x+s*.16,H.max.y+.3,hc.z-.08)],.055,PU,O);
   const f=put(r.head,M(cone(.06,.2,7),FL),V(hc.x+s*.16,H.max.y+.38,hc.z-.09),[-.2,0,-s*.2],0);f.scale.set(1,1,.8)}
  for(let i=0;i<3;i++)put(t,M(cone(.08-.015*i,.36-.06*i,7),FL),V(0,B.max.y+.12,B.min.z+.25-i*.12),[-.35,0,0],0);
  (r.legs||[]).forEach(l=>{(l.g||l).scale.y=fm>=3?1.18:1.12});
  if(fm>=3){for(let i=0;i<6;i++){const a=i/6*Math.PI*2;put(r.head,M(cone(.045,.2,6),FL),V(hc.x+Math.cos(a)*.16,H.max.y+.12,hc.z+Math.sin(a)*.14),[Math.sin(a)*.3,0,-Math.cos(a)*.3],0)}
   legTips(c).forEach(l=>put(l.n,M(sph(.06,10,8),FL),l.p,null,0));
   const WG=curveSlab([[0,0],[.2,.5],[.6,.8],[1.05,.6],[.8,.35],[.75,.15],[.5,.05],[.3,.08],[.15,-.02],[0,0]],.02);
   for(const s of[-1,1]){const w=put(t,M(WG,veil(0xffa040,.42)),V(s*.12,B.max.y-.05,B.min.z+.3),[0,s>0?-.25:Math.PI+.25,s*.55],0);w.scale.setScalar(1.05);w.material.emissiveIntensity=1.1}}},
 3(c,fm){const{r,B,hc,bc}=c,t=r.torso||r.body,LV=std(0xb494f5),SH=veil(0x4a2a8a,.5),GL=glw(0x9fe8ff,0x6ad0ff,1.4),O=0x3a2a6a;
  const T=r.tail||t,tb=c.T||B,tz=tb.min.z;for(let i=0;i<14;i++){const a=i*.62,rr=.16*(1-i/16),p=V(bc.x+Math.cos(a)*rr,bc.y+.05+Math.sin(a)*rr,tz-.02-i*.006);const s=put(T,M(sph(.05*(1-i/18),10,8),LV),p,null,i%3?0:O)}
  for(let i=0;i<5;i++){const f=put(t,M(slab([[0,0],[.08,.18],[.18,0]],.02),std(0x8a64e0)),V(-.02,B.max.y-.04,B.max.z-.3-i*.16),[0,Math.PI/2,0],O);f.scale.setScalar(1+.2*Math.sin(i))}
  for(const s of[-1,1]){const f=put(t,M(slab([[0,0],[.3,.12],[.5,-.05],[.25,-.12],[0,0]],.015),SH),V(s*(B.max.x-.02),bc.y,bc.z),[0,s>0?-.3:Math.PI+.3,0],0)}
  if(fm>=3){if(r.hover!=null)r.hover=Math.max(r.hover||0,.32);else r.root.position.y+=.25;
   const WG=curveSlab([[0,0],[.1,.6],[.55,.95],[1.1,.7],[.85,.45],[.9,.2],[.6,.12],[.35,.15],[.15,0],[0,0]],.015);
   for(const s of[-1,1])put(t,M(WG,SH),V(s*.12,B.max.y-.05,bc.z-.1),[0,s>0?-.2:Math.PI+.2,s*.15],0);
   for(let i=0;i<8;i++){const s=i%2?1:-1,p=V(s*(B.max.x-.03),bc.y+.08-(i>>1)*.05,B.max.z-.25-(i>>1)*.2);put(t,M(sph(.035,8,6),GL),p,null,0)}}},
 4(c,fm){const{r,B,H,hc,bc}=c,body=r.body||r.root,W=std(fm>=3?0xb8c4dc:0xffffff,{roughness:.95}),HN=std(0xe8c48a),O=fm>=3?0x4a5470:0xd8c9bd;
  for(let i=0;i<(fm>=3?9:6);i++){const a=i/6*Math.PI*2,p=V(bc.x+Math.cos(a)*.3,B.max.y-.05+(i%3)*.04,bc.z+Math.sin(a)*.42);put(body,M(sph(.2+(i%2)*.05,14,10),W),p,null,O)}
  for(const s of[-1,1]){const g=new THREE.TorusGeometry(fm>=3?.14:.1,fm>=3?.045:.035,8,18,Math.PI*1.5);const h=put(r.head,M(g,HN),V(hc.x+s*.2,H.max.y-.12,hc.z-.06),[0,Math.PI/2,s>0?-.6:Math.PI+.6],0x8a6a3a)}
  if(fm>=3){const LT=glw(0xffe14a,0xffc000,1.6);zig(body,V(bc.x+.1,B.max.y+.75,bc.z-.05),V(bc.x+.02,B.max.y+.28,bc.z-.08),4,.09,LT,.045);
   const CL=std(0x6a7898,{roughness:.95});for(let i=0;i<4;i++)put(body,M(sph(.16,12,9),CL),V(bc.x+(i-1.5)*.18,B.max.y+.22,bc.z-.05+(i%2)*.1),null,0x3a4058);
   if(r.hover!=null)r.hover=Math.max(r.hover||0,.25);else r.root.position.y+=.2}},
 5(c,fm){const{r,H,hc,B}=c,t=r.torso||r.body,AN=std(0x7a3a14),PO=glw(0xffe08a,0xffc84a,.9),O=0x7a3a14;
  (r.wings||[]).forEach(w=>{const g=w.g||w;g.scale.multiplyScalar(fm>=3?1.35:1.25)});
  for(const s of[-1,1]){horn(r.head,[V(hc.x+s*.06,H.max.y-.04,hc.z+.04),V(hc.x+s*.16,H.max.y+.22,hc.z+.12),V(hc.x+s*.3,H.max.y+.32,hc.z+.06)],.016,AN,0);put(r.head,M(sph(.05,10,8),PO),V(hc.x+s*.31,H.max.y+.33,hc.z+.06),null,O)}
  if(fm>=3){(r.wings||[]).forEach(w=>{const g=w.g||w;if(!g.parent)return;const k=g.clone();k.traverse(o=>{o.userData[TAG]=1});k.userData[TAG]=1;k.scale.multiplyScalar(.72);k.position.y-=.18;k.rotation.z+=(k.position.x>0?-.35:.35);g.parent.add(k)});
   for(let i=0;i<8;i++){const a=i/8*Math.PI*2;put(r.head,M(sph(.04+(i%2)*.015,8,6),PO),V(hc.x+Math.cos(a)*.16,H.max.y+.04+(i%2)*.05,hc.z+Math.sin(a)*.14),null,0)}
   const SP=new THREE.SpriteMaterial({color:0xffd34e,transparent:true,opacity:.75,depthWrite:false,blending:THREE.AdditiveBlending});
   for(let i=0;i<6;i++){const s=new THREE.Sprite(SP.clone());s.scale.setScalar(.22-i*.025);s.material.opacity=.7-i*.1;put(t,s,V(0,B.min.y+.2-i*.03,B.min.z-.12-i*.16),null,0)}}},
 6(c,fm){const{r,B,H,hc,bc}=c,IC=ice(0xbff2ff),MN=std(0xeaf6ff,{roughness:.95}),O=0x356a8a;
  for(const s of[-1,1]){const n=fm>=3?4:2;for(let i=0;i<n;i++){const y=H.max.y+.1+i*.12,m=put(r.head,M(cone(.04,.22+i*.04,6),IC),V(hc.x+s*(.2+i*.07),y,hc.z-.05-i*.03),[-.2,0,-s*(.7+i*.15)],0);}
   if(fm>=3)put(r.head,M(cone(.07,.55,6),IC),V(hc.x+s*.18,H.max.y+.32,hc.z-.12),[-.15,0,-s*.25],0)}
  for(let i=0;i<5;i++)put(r.head,M(sph(.1-.01*i,12,9),MN),V(hc.x+(i%2?.06:-.06),H.min.y+.05+i*.04,H.min.z-.02-i*.05),null,0xa9d4ea);
  if(fm>=3){const tb=new THREE.Box3().setFromObject(r.body||r.torso),tc=tb.getCenter(V()),cz=Math.min(tb.max.z,H.min.z+.05);const PL=put(r.torso||r.body,M(new THREE.SphereGeometry(.22,16,10,0,Math.PI*2,0,Math.PI/2),IC),V(tc.x,tc.y-.04,cz-.02),[Math.PI/2,0,0],0);PL.scale.set(1,.42,1);/* крижаний нагрудник на грудях */
   for(let i=0;i<5;i++){const a=(i-2)*.4;put(r.head,M(oct(.06),IC),V(hc.x+Math.sin(a)*.12,H.max.y+.06+Math.cos(a)*.04,hc.z+.06),[0,0,a],0).scale.y=2.2}}},
 7(c,fm){const{r,B,H,hc,bc}=c,t=r.torso||r.body,DK=std(0x34344e),NE=glw(0x6ae8ff,0x1a9fff,1.6),O=0x14142a;
  const n=fm>=3?11:8;for(let i=0;i<n;i++){const a=(i/(n-1)-.5)*Math.PI*1.3,p=V(hc.x+Math.sin(a)*.24,H.min.y+.12+Math.cos(a)*.18,H.min.z-.02);put(r.head,M(cone(.06,.3,6),DK),p,[-.9,0,-Math.sin(a)*1.1],O)}
  const T=r.tail||t,tb=c.T||B;zig(T,V(bc.x,tb.max.y-.02,tb.min.z+.05),V(bc.x+.05,tb.max.y+.35,tb.min.z-.35),4,.07,NE);
  if(fm>=3){t.scale.multiply(V(1.08,1.05,1.06));for(let i=0;i<3;i++)zig(r.head,V(hc.x-.2+i*.2,H.max.y-.05,H.min.z+.02),V(hc.x-.24+i*.22,H.max.y+.22,H.min.z-.12),3,.04,NE);
   const AR=std(0x5a5a80,{metalness:.55,roughness:.3});legTips(c).forEach(l=>put(l.n,M(new THREE.BoxGeometry(.17,.14,.2),AR),V(l.p.x,l.p.y+.06,l.p.z+.02),null,O))}},
 8(c,fm){const{r,B,H,hc,bc}=c,t=r.torso||r.body,BL=std(0x2e5f96),FN=std(0x4a86c0),O=0x203a5a;
  const fin=(z,s)=>put(t,M(curveSlab([[0,0],[.05,.35],[.2,.6],[.42,.62],[.3,.4],[.32,.18],[.36,0],[.2,0],[.1,0],[0,0]],.05),BL),V(0,B.max.y-.08,z),[0,Math.PI/2,0],O).scale.setScalar(s);
  fin(bc.z+.1,fm>=3?1.15:1.05);if(fm>=3)fin(bc.z-.35,.7);
  legTips(c).forEach(l=>put(l.n,M(slab([[0,0],[.22,.06],[.28,-.04],[.1,-.08],[0,0]],.025),FN),V(l.p.x+(l.p.x>0?.05:-.05),l.p.y+.12,l.p.z),[0,l.p.x>0?0:Math.PI,-.4],O));
  if(fm>=3){const AR=std(0x8a9ab0,{metalness:.6,roughness:.3});const p=put(r.head,M(new THREE.SphereGeometry(.2,16,10,0,Math.PI*2,0,Math.PI/2),AR),V(hc.x,H.max.y-.08,H.max.z-.14),[.5,0,0],O);p.scale.set(1.05,.55,1.3);
   const WV=new THREE.Mesh(new THREE.TorusGeometry(.75,.05,8,40),veil(0x6ad0ff,.45));WV.rotation.x=Math.PI/2;put(r.root,WV,V(0,.06,0),[Math.PI/2,0,0],0)}},
 9(c,fm){const{r,B,H,hc,bc}=c,t=r.torso||r.body,RD=std(0xe8583e),GD=glw(0xffd34e,0xffb020,.8),FL=glw(0xffc04a,0xff7a2a,1.5),O=0x6a1a14;
  const n=fm>=3?5:3;for(let i=0;i<n;i++){const a=(i-(n-1)/2)*.28,f=put(t,M(slab(FEATHER,.03),i%2?RD:std(0xffb45a)),V(bc.x+Math.sin(a)*.1,bc.y-.1,B.min.z+.05),[-1.25,a,0],O);f.scale.setScalar(fm>=3?1.35:1.1)}
  {const ring=new THREE.TorusGeometry(fm>=3?.42:.34,.025,8,36);const R=put(t,M(ring,GD),V(bc.x,H.max.y-.05,hc.z-.32),null,0);
   for(let i=0;i<12;i++){const a=i/12*Math.PI*2,sp=M(cone(.035,.12,5),GD);sp.position.set(Math.cos(a)*(fm>=3?.48:.4),Math.sin(a)*(fm>=3?.48:.4),0);sp.rotation.z=a-Math.PI/2;sp.userData[TAG]=1;R.add(sp)}}
  if(fm>=3){(r.wings||[]).forEach(w=>{const g=w.g||w,s=g.position.x>0?1:-1;g.scale.multiplyScalar(1.3);
    const fw=put(g,M(curveSlab([[0,0],[.2,.4],[.6,.75],[1.15,.6],[.9,.38],[1,.18],[.75,.08],[.55,.14],[.35,0],[.18,-.05],[.08,-.02],[0,0]],.02),FL),g.getWorldPosition(V()).add(V(0,.05,-.05)),[0,s>0?0:Math.PI,.2],0);fw.scale.setScalar(.75)});
   for(let i=0;i<5;i++)put(r.head,M(cone(.04,.18,5),GD),V(hc.x+(i-2)*.07,H.max.y+.06-Math.abs(i-2)*.02,hc.z+.02),[0,0,(i-2)*-.2],0x8a5a10);
   for(let i=0;i<3;i++)put(t,M(cone(.08-.015*i,.42-.06*i,7),FL),V(bc.x+(i-1)*.08,bc.y-.15,B.min.z-.25-i*.05),[-1.9,0,(i-1)*.3],0)}}};

/* ---------- застосування ---------- */
function clear(r){const kill=[];r.root.traverse(o=>{if(o.userData[TAG]&&o.parent&&!(o.parent.userData&&o.parent.userData[TAG]))kill.push(o)});
 kill.forEach(o=>{o.parent.remove(o);o.traverse(q=>{if(q.geometry&&!q.isSprite&&q.geometry.type!=='SphereGeometry')q.geometry.dispose()})})}
function ensure(r,ty,fm){if(!r||!r.root)return;fm=fm||1;if(r._pf===fm)return;
 if(r._pf0==null)r._pf0={rootY:r.root.position.y,hover:r.hover,torso:(r.torso||r.body)?(r.torso||r.body).scale.clone():null,legs:(r.legs||[]).map(l=>(l.g||l).scale.clone()),wings:(r.wings||[]).map(w=>(w.g||w).scale.clone())};
 clear(r);const z=r._pf0;r.root.position.y=z.rootY;if(z.hover!==undefined)r.hover=z.hover;if(z.torso)(r.torso||r.body).scale.copy(z.torso);
 (r.legs||[]).forEach((l,i)=>(l.g||l).scale.copy(z.legs[i]));(r.wings||[]).forEach((w,i)=>(w.g||w).scale.copy(z.wings[i]));deepen(r,fm>=3&&ty!==4);/* білу вовну Пухоклуба не темнимо */
 r._pf=fm;if(fm<2||!F[ty])return;const sc0=r.root.scale.clone(),pos0=r.root.position.clone(),rot0=r.root.rotation.clone();
 /* будуємо в просторі моделі без масштабу й повороту, тоді повертаємо як було */
 /* модель тимчасово відчеплюємо від істоти у світі: інакше точки деталей рахувалися б від місця істоти, і далеко від центру світу, наприклад, спис Бамбузла розтягувався через усю сцену */
 const par=r.root.parent;if(par)par.remove(r.root);
 r.root.scale.set(1,1,1);r.root.position.set(0,0,0);r.root.rotation.set(0,0,0);
 try{F[ty](ctx(r),fm)}catch(e){console.warn('pal-forms',ty,fm,e)}
 r.root.scale.copy(sc0);r.root.position.add(pos0);r.root.rotation.copy(rot0);if(par)par.add(r.root)}
window.PALFORM={ensure};
}catch(e){console.warn('pal-forms',e)}})();
