/* 0.1.7: нові моделі попалів (мультяшний стиль, версії 1.0.3 … 10.0.2) */
(function(){try{


/* ===== Спільний набір інструментів ===== */
const std=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.85,metalness:0},o||{}));
const phy=(c,o)=>new THREE.MeshPhysicalMaterial(Object.assign({color:c,roughness:.3,metalness:0,clearcoat:.6,clearcoatRoughness:.25},o||{}));
const glw=(c,e,i)=>new THREE.MeshStandardMaterial({color:c,emissive:e,emissiveIntensity:i||1.2,roughness:.4});
const gls=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.12,metalness:.15,transparent:true,opacity:.8},o||{}));
const _sg={};const SPH=(w,h)=>{const k=(w||12)+','+(h||9);return _sg[k]||(_sg[k]=new THREE.SphereGeometry(1,w||12,h||9))};
const CYL=(a,b,h,s)=>new THREE.CylinderGeometry(a,b,h,s||10),CON=(r,h,s)=>new THREE.ConeGeometry(r,h,s||6),TOR=(r,t,a,s)=>new THREE.TorusGeometry(r,t,6,s||18,a||6.2832),BOX=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
const lathe=(pts,s)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),s||12);
function vcol(geo,top,bot){geo=geo.clone();const p=geo.attributes.position,col=new Float32Array(p.count*3),a=new THREE.Color(top),b=new THREE.Color(bot),t=new THREE.Color();
 for(let i=0;i<p.count;i++){const k=Math.max(0,Math.min(1,(p.getY(i)+1)/2));t.copy(b).lerp(a,k);col[i*3]=t.r;col[i*3+1]=t.g;col[i*3+2]=t.b}
 geo.setAttribute('color',new THREE.BufferAttribute(col,3));return geo}
function part(geo,mat,x,y,z,sx,sy,sz,rx,ry,rz){const m=new THREE.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);
 if(sx!==undefined)m.scale.set(sx,sy===undefined?sx:sy,sz===undefined?sx:sz);if(rx||ry||rz)m.rotation.set(rx||0,ry||0,rz||0);m.castShadow=true;m.receiveShadow=true;return m}
const mk=(g,geo,m,x,y,z,sx,sy,sz,rx,ry,rz)=>{const p=part(geo,m,x,y,z,sx,sy,sz,rx,ry,rz);g.add(p);return p};
const piv=(g,x,y,z)=>{const p=new THREE.Group();p.position.set(x||0,y||0,z||0);g.add(p);return p};
function bone(g,m,a,b,r0,r1,seg){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz)||1e-3;
 const p=part(CYL(r1,r0,l,seg||7),m,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
 p.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dx/l,dy/l,dz/l));g.add(p);return p}
function chain(g,m,pts,r0,r1,n){n=n||3;const tot=(pts.length-1)*n;for(let i=0;i<pts.length-1;i++)for(let k=0;k<n;k++){const f=k/n,t=(i*n+k)/tot,r=r0+(r1-r0)*t;
 mk(g,SPH(9,7),m,pts[i][0]+(pts[i+1][0]-pts[i][0])*f,pts[i][1]+(pts[i+1][1]-pts[i][1])*f,pts[i][2]+(pts[i+1][2]-pts[i][2])*f,r)}}
function furTex(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#d9d9d9';x.fillRect(0,0,256,256);
 let s=11;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<7000;i++){const px=r()*256,py=r()*256,l=r()*3+3,a=(r()-.5)*.8,v=r()<.5?(170+r()*40)|0:(235+r()*20)|0;x.strokeStyle='rgba('+v+','+v+','+v+',.55)';x.lineWidth=1+r();x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.sin(a)*l,py+Math.cos(a)*l);x.stroke()}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,3);t.encoding=THREE.sRGBEncoding;return t}
const FT=furTex();
const fur=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,map:FT,bumpMap:FT,bumpScale:1.4,roughness:.95},o||{}));
const MTE={W:phy(0xffffff,{roughness:.12,clearcoat:1,clearcoatRoughness:.1}),P:std(0x070909,{roughness:.1})};
function eye(g,x,y,z,r,col,glow){const e=piv(g,x,y,z);mk(e,SPH(10,8),MTE.W,0,0,0,r,r*1.05,r*.8);
 mk(e,SPH(9,7),std(col,{roughness:.2,emissive:col,emissiveIntensity:glow||0}),0,0,r*.45,r*.68,r*.74,r*.5);mk(e,SPH(7,6),MTE.P,0,0,r*.62,r*.34,r*.48,r*.3);mk(e,SPH(5,4),MTE.W,-r*.3,r*.3,r*.9,r*.18);return e}
function orb(g,x,y,z,r,col,glow){const e=piv(g,x,y,z);mk(e,SPH(10,8),phy(col,{roughness:.15,clearcoat:1,emissive:col,emissiveIntensity:glow||0}),0,0,0,r);mk(e,SPH(5,4),MTE.W,-r*.3,r*.35,r*.8,r*.2);return e}
function newRig(cy,dist,gait){const root=new THREE.Group(),body=new THREE.Group();root.add(body);return{root,body,legs:[],arms:[],eyes:[],ears:[],wings:[],flash:[],cy:cy||.9,dist:dist||1,gait:gait||'quad'}}
function leg(rig,body,x,y,z,l1,l2,r,m,mf){const h=piv(body,x,y,z);mk(h,CYL(r*1.1,r*.85,l1,8),m,0,-l1/2,0);const k=piv(h,0,-l1,0);mk(k,SPH(8,6),m,0,0,0,r*.9);mk(k,CYL(r*.85,r*.65,l2,8),m,0,-l2/2,0);
 const f=piv(k,0,-l2,0);mk(f,SPH(9,7),mf||m,0,-.02,r*.7,r*1.15,r*.6,r*1.7);h.userData.k=k;rig.legs.push(h);return h}
function tris(o){let n=0;o.traverse(m=>{if(m.isMesh){const g=m.geometry;n+=(g.index?g.index.count:g.attributes.position.count)/3}});return Math.round(n)}
/* ===== Загальна анімація ===== */
const ease=x=>x*x*(3-2*x);
function poseG(rig,t,mode,hurt){
 const L=rig.legs;
 if(!rig.tb&&rig.torso)rig.tb=[rig.torso.scale.x,rig.torso.scale.y,rig.torso.scale.z];
 const br=Math.sin(t*2.2)*.5+.5;if(rig.torso)rig.torso.scale.set(rig.tb[0]*(1+.012*br),rig.tb[1]*(1+.03*br),rig.tb[2]);
 let by=0,bz=0,lean=0,roll=0,hy=0,hx=0,u=0,s=0,flap=3,fA=1,sway=3,ph=0,mv=0,j=0;
 if(mode==='walk'){ph=t*7;mv=1;by=Math.abs(Math.sin(ph))*.05;roll=Math.sin(ph)*.04;hy=Math.sin(ph*.5)*.1;flap=6}
 else if(mode==='attack'){const p=(t%1.5)/1.5;if(p<.4)u=ease(p/.4);else if(p<.52){s=ease((p-.4)/.12);u=1-s}else s=1-ease(Math.min(1,(p-.52)/.4));flap=10;bz=-.1*u+.45*s;lean=-.15*u+.3*s;hx=.3*u-.4*s}
 else if(mode==='happy'){j=Math.abs(Math.sin(t*4.2));by=j*.4;hy=Math.sin(t*4.2)*.25;roll=Math.sin(t*4.2)*.06;flap=8;sway=9}
 else{hy=Math.sin(t*.8)*.2;fA=.55}
 L.forEach((l,i)=>{const off=rig.gait==='bi'?(i%2)*Math.PI:rig.gait==='spi'?(i%2)*Math.PI+(i>>1)*.5:[0,Math.PI,Math.PI,0][i%4];
  const sw=Math.sin(ph+off),lift=Math.max(0,Math.cos(ph+off))*mv;
  if(rig.legFn)rig.legFn(i,l,sw*mv,lift,t);else{const a=rig.legAmp||.55;l.rotation.x=sw*a*mv-(j?.25*j:0);if(l.userData.k)l.userData.k.rotation.x=lift*a*1.2+(j?.4*j:0)}});
 rig.arms.forEach((a,i)=>{const bx=a.userData.rx||0,bz=a.userData.rz||0,sw=-Math.sin(ph+(i%2)*Math.PI)*.5*mv;if(j){a.rotation.x=-2.5;a.rotation.z=(i%2?1:-1)*.5}else{a.rotation.x=bx+sw;a.rotation.z=bz}});
 for(const w of rig.wings){const calm=(mode==='idle'&&w.calm)?.15:1;w.g.rotation.z=w.s*(w.base+Math.sin(t*flap+(w.ph||0))*w.amp*calm*fA)}
 if(rig.atk)rig.atk(u,s,t);
 let sq=0;if(hurt>0){sq=Math.sin(hurt*Math.PI)*.12;bz-=Math.sin(hurt*Math.PI)*.18;lean-=Math.sin(hurt*Math.PI)*.2}
 rig.body.position.set(0,by-sq*.4+(rig.hover?Math.sin(t*2)*rig.hover:0),bz);rig.body.rotation.x=lean;rig.body.rotation.z=roll;rig.body.scale.set(1+sq,1-sq,1+sq);
 if(rig.head){rig.head.rotation.y=hy;rig.head.rotation.x=hx+Math.sin(t*1.7)*.03-lean*.4}
 rig.ears.forEach((e,i)=>{e.rotation.z=Math.sin(t*3+i)*.08*(i?-1:1)});
 if(rig.tail)rig.tail.rotation.y=Math.sin(t*sway)*.4;
 if(rig.jaw)rig.jaw.rotation.x=mode==='attack'?.6*u:.04+.03*Math.sin(t*2);
 const bl=(t%3.3)<.13?.12:1;rig.eyes.forEach(e=>{e.scale.y=bl});
 const fl=hurt>0?Math.sin(hurt*Math.PI):0;for(const m of rig.flash)m.emissive.setRGB(.5*fl,0,0);
 if(rig.tick)rig.tick(t,mode);
}
function poseAny(rig,t,mode,hurt){(rig.customPose||poseG)(rig,t,mode,hurt)}

/* ===== Милий мультяшний стиль ===== */
const SOFTM=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.8}),SOFTT=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.5,transparent:true,opacity:.84});
let OLM=new THREE.MeshBasicMaterial({color:0x1b2a2a,side:THREE.BackSide}),BMAT=SOFTM;
const outl=c=>{OLM=new THREE.MeshBasicMaterial({color:c,side:THREE.BackSide});BMAT=SOFTM};
function blob(g,top,bot,x,y,z,sx,sy,sz,rx,ry,rz,res){res=res||14;const hh=Math.round(res*.72),m=new THREE.Mesh(vcol(SPH(res,hh),top,bot),BMAT);m.position.set(x,y,z);m.scale.set(sx,sy===undefined?sx:sy,sz===undefined?sx:sz);
 if(rx||ry||rz)m.rotation.set(rx||0,ry||0,rz||0);m.castShadow=true;m.receiveShadow=true;g.add(m);
 if(res>=14){const o=new THREE.Mesh(SPH(res,hh),OLM);o.position.copy(m.position);o.rotation.copy(m.rotation);o.scale.set(m.scale.x*1.05+.012,m.scale.y*1.05+.012,m.scale.z*1.05+.012);g.add(o)}return m}
const sf=(rx,ry,rz,x,y)=>rz*Math.sqrt(Math.max(.04,1-(x/rx)*(x/rx)-(y/ry)*(y/ry)));
function ceye(g,x,y,z,r,iris){const e=piv(g,x,y,z);mk(e,SPH(12,9),std(0xffffff,{roughness:.2}),0,0,0,r,r*1.12,r*.55);mk(e,SPH(10,8),std(iris,{roughness:.25}),0,0,r*.22,r*.78,r*.9,r*.5);
 mk(e,SPH(8,6),MTE.P,0,0,r*.38,r*.45,r*.55,r*.42);mk(e,SPH(6,5),MTE.W,-r*.28,r*.34,r*.62,r*.3,r*.3,r*.2);mk(e,SPH(5,4),MTE.W,r*.25,-r*.3,r*.6,r*.14,r*.14,r*.12);return e}
const smile=(g,x,y,z,w,c)=>mk(g,TOR(w,w*.16,3.1416,10),std(c||0x4a2424),x,y,z,1,1,1,0,0,Math.PI);
const cheek=(g,x,y,z,r)=>mk(g,SPH(8,6),std(0xff9aa8,{transparent:true,opacity:.6}),x,y,z,r,r*.65,r*.25);
const OCT=new THREE.OctahedronGeometry(1,0),gem=(g,m,x,y,z,r,h,rz)=>mk(g,OCT,m,x,y,z,r,h,r,0,0,rz||0);
function sleg(rig,body,x,y,z,r,len,top,bot,foot,res){const h=piv(body,x,y,z);blob(h,top,bot,0,-len*.5,0,r,len*.6,r,0,0,0,res||10);blob(h,foot,foot,0,-len,r*.5,r*1.1,r*.55,r*1.3,0,0,0,9);rig.legs.push(h);return h}
function quad(o){outl(o.ol);const rig=newRig(o.cy,o.dist),b=rig.body,tg=piv(b,0,0,0),B=o.body,H=o.head;rig.torso=tg;
 blob(tg,o.top,o.bot,0,B.y,B.z,B.rx,B.ry,B.rz);if(o.belly)blob(tg,o.belly[0],o.belly[1],0,B.y-B.ry*.25,B.z+B.rz*.42,B.rx*.62,B.ry*.62,B.rz*.4,0,0,0,10);
 const h=rig.head=piv(b,0,H.y,H.z);blob(h,H.top||o.top,H.bot||o.bot,0,0,0,H.rx,H.ry,H.rz);const S=(x,y)=>sf(H.rx,H.ry,H.rz,x,y),E=o.eye;
 for(const s of[-1,1]){rig.eyes.push(ceye(h,s*E.x,E.y,S(E.x,E.y)-.015,E.r,E.iris));cheek(h,s*(E.x+.13),E.y-.15,S(E.x+.13,E.y-.15)-.02,.07)}
 const M=o.muzzle;let zf=S(0,-.1)+.02;if(M){const zc=S(0,M.y)-M.rz*.55;blob(h,M.c[0],M.c[1],0,M.y,zc,M.rx,M.ry,M.rz,0,0,0,10);zf=zc+M.rz*.95}
 mk(h,SPH(8,6),std(o.nose,{roughness:.3}),0,(M?M.y+M.ry*.35:-.02),zf,.055,.045,.04);smile(h,0,(M?M.y-M.ry*.3:-.12),zf-.01,.07);
 const L=o.leg;for(const s of[-1,1])sleg(rig,b,s*L.x,L.len+L.r*.5,L.zF,L.r,L.len,L.top,L.bot,L.foot);for(const s of[-1,1])sleg(rig,b,s*L.x,L.len+L.r*.5,L.zB,L.r,L.len,L.top,L.bot,L.foot);
 if(o.ears)o.ears(h,rig);if(o.tail)o.tail(b,rig);rig.flash=[SOFTM];rig.S=S;return rig}

/* ===== №1 Бамбузл 1.0.3 ===== */
function buildBam(){outl(0x1f4a2a);const rig=newRig(.95,1.05,'bi'),b=rig.body,tg=piv(b,0,0,0);rig.torso=tg;
 const CR=[0xfffbe6,0xeee6c0],DG=[0x3a8a45,0x256a32];
 blob(tg,0xa6ea72,0x62bb48,0,.62,0,.5,.46,.44);blob(tg,CR[0],CR[1],0,.56,.33,.3,.3,.14,0,0,0,10);
 const h=rig.head=piv(b,0,1.3,.04);blob(h,0xb2f27c,0x78cc55,0,0,0,.58,.5,.52);const S=(x,y)=>sf(.58,.5,.52,x,y);
 for(const s of[-1,1]){blob(h,DG[0],DG[1],s*.24,.06,S(s*.24,.06)-.05,.15,.19,.09,0,0,s*.45,10);rig.eyes.push(ceye(h,s*.24,.08,S(s*.24,.08)+.005,.095,0x7a4a1a));
  rig.ears.push(blob(h,DG[0],DG[1],s*.4,.38,-.05,.17,.17,.11,0,0,0,12));blob(h,0xffeedd,0xffd9c0,s*.4,.38,.03,.09,.09,.05,0,0,0,8);cheek(h,s*.38,-.1,.37,.075)}
 blob(h,CR[0],CR[1],0,-.14,.4,.2,.15,.14,0,0,0,10);mk(h,SPH(8,6),std(0x1d2a22,{roughness:.3}),0,-.09,.53,.06,.05,.045);smile(h,0,-.19,.53,.07);
 const sp=piv(h,0,.5,0);for(const a of[-.8,0,.8])blob(sp,0x7fd45a,0x4fae3a,Math.sin(a)*.1,.1+(a?0:.05),0,.06,.13,.025,0,0,-a*.9,8);rig.sprout=sp;
 for(const s of[-1,1]){const a=piv(b,s*.5,.9,.04);a.userData.rz=s*.25;a.rotation.z=s*.25;blob(a,DG[0],DG[1],0,-.2,0,.15,.28,.15,0,0,0,10);rig.arms.push(a)}
 const A=rig.arms[1];A.userData.rx=-.7;A.rotation.x=-.7;const bam=piv(A,0,-.4,.05);bam.rotation.x=.7;
 for(let i=0;i<3;i++){mk(bam,CYL(.04,.04,.4,8),std(0x9fd45a),0,.05+i*.42,0);mk(bam,TOR(.045,.014,6.28,10),std(0x5f9132),0,.25+i*.42,0,1,1,1,Math.PI/2,0,0)}
 for(const a of[-.8,0,.8])blob(bam,0x6fcf55,0x45a83a,Math.sin(a)*.16,1.32+(a?0:.06),0,.06,.2,.02,0,0,-a*.9,8);
 for(const s of[-1,1]){const hp=piv(b,s*.24,.3,0);blob(hp,DG[0],DG[1],0,-.1,0,.17,.2,.2,0,0,0,10);blob(hp,CR[0],CR[1],0,-.25,.1,.14,.06,.17,0,0,0,8);rig.legs.push(hp)}
 const tl=rig.tail=piv(b,0,.45,-.4);blob(tl,CR[0],CR[1],0,0,-.08,.14,.14,.14,0,0,0,10);
 rig.flash=[SOFTM];rig.tick=t=>{sp.rotation.z=Math.sin(t*2)*.12};
 rig.atk=(u,s)=>{A.rotation.x+=-1.8*u+2.2*s};return rig}
/* ===== №2 Грумрок 2.0.2 ===== */
function buildGrumrok(){const rig=quad({ol:0x4a3322,cy:.65,dist:1.1,top:0xd9b47e,bot:0x946f48,belly:[0xf6e8c8,0xdcc7a0],body:{y:.62,z:-.05,rx:.58,ry:.5,rz:.62},
  head:{y:.8,z:.62,rx:.46,ry:.4,rz:.42,top:0xe3bf8a,bot:0xa57d52},eye:{x:.2,y:.08,r:.085,iris:0x4a3216},muzzle:{c:[0xf6e8c8,0xdcc7a0],y:-.1,rx:.2,ry:.14,rz:.2},nose:0xc86a6a,
  leg:{r:.15,len:.22,x:.32,zF:.38,zB:-.4,top:0xa57d52,bot:0x6a4a30,foot:0x5a3f2a},
  ears:(h,rig)=>{for(const s of[-1,1])rig.ears.push(blob(h,0xa57d52,0x6a4a30,s*.3,.3,-.05,.1,.1,.07,0,0,0,10))},
  tail:(b,rig)=>{rig.tail=piv(b,0,.5,-.68);blob(rig.tail,0xa57d52,0x6a4a30,0,0,-.1,.12,.1,.16,0,0,0,10)}}),b=rig.body,tg=rig.torso;
 for(let i=0;i<3;i++)blob(tg,0x8a6a48,0x4a3322,0,1.08-Math.abs(i-1)*.04,.3-i*.3,.34-Math.abs(i-1)*.04,.13,.19,-.1+i*.1,0,0,12);
 const GM=gls(0x6fe8d6,{emissive:0x1aa598,emissiveIntensity:.7,opacity:.9});
 [[0,1.2,.15,.1,.26,.1],[-.2,1.15,-.1,.075,.2,-.35],[.2,1.15,-.12,.08,.22,.35],[.0,1.13,-.4,.065,.17,0]].forEach(c=>gem(tg,GM,c[0],c[1],c[2],c[3],c[4],c[5]));
 const MET=std(0xc5ccd8,{metalness:.7,roughness:.35});for(const i of[0,1])for(let k=0;k<3;k++)mk(rig.legs[i],SPH(10,8),MET,0,-.2,.2+k*.09,.1-k*.025);
 rig.tick=t=>{GM.emissiveIntensity=.55+.3*Math.sin(t*2.2)};rig.atk=(u,s)=>{rig.legs[0].rotation.x+=-.9*u+1.2*s;rig.legs[1].rotation.x+=-.9*u+1.2*s};return rig}
/* ===== №3 Ігніс-Виверг 3.0.2 ===== */
function buildIgnis(){outl(0x1d1428);const rig=newRig(.6,1.3,'spi'),b=rig.body,tg=piv(b,0,0,0);rig.torso=tg;
 const GL=glw(0xff8a2a,0xff5a10,1.2),YL=glw(0xffe070,0xffb030,1.2);
 blob(tg,0x7a5a8a,0x32243f,0,.62,-.35,.52,.46,.55);const top=(x,z)=>.62+.46*Math.sqrt(Math.max(.02,1-(x/.52)*(x/.52)-((z+.35)/.55)*((z+.35)/.55)));
 [[-.25,-.3],[.25,-.3],[-.18,-.62],[.18,-.62],[0,-.45]].forEach(p=>mk(tg,SPH(8,6),GL,p[0],top(p[0],p[1])-.02,p[1],.09,.04,.09));
 rig.flames=[];for(const p of[[-.15,-.05],[.0,.0],[.15,-.05]]){const f=piv(tg,p[0],top(p[0],p[1])-.02,p[1]-.0);mk(f,SPH(9,7),GL,0,.1,0,.08,.14,.08);mk(f,SPH(7,5),YL,0,.22,0,.045,.09,.045);rig.flames.push(f)}
 const h=rig.head=piv(b,0,.62,.34);blob(h,0x8a6a9a,0x3a2a4a,0,.04,.1,.4,.34,.36);
 for(const s of[-1,1]){rig.eyes.push(ceye(h,s*.15,.1,.4,.1,0xff8a2a));cheek(h,s*.26,-.04,.38,.07);blob(h,0x3a2a4a,0x1d1428,s*.12,-.13,.4,.06,.06,.07,0,0,0,9)}
 smile(h,0,-.06,.44,.08);
 for(const s of[-1,1])for(let i=0;i<3;i++){const lg=piv(b,s*.28,.45,.3-i*.28),phi=(35-i*35)*Math.PI/180;lg.rotation.y=s>0?-phi:Math.PI+phi;lg.userData.a=lg.rotation.y;lg.userData.sgn=s>0?-1:1;
  blob(lg,0x8a6a9a,0x4a3a5a,.17,.05,0,.2,.075,.075,0,0,.3,10);const K=piv(lg,.3,.1,0);blob(K,0x8a6a9a,0x4a3a5a,.1,-.25,0,.3,.075,.075,0,0,-1.19,10);blob(K,0xffb870,0xe8803a,.2,-.5,0,.09,.07,.09,0,0,0,9);lg.userData.k=K;rig.legs.push(lg)}
 rig.legFn=(i,l,sw,lift)=>{l.rotation.y=l.userData.a+l.userData.sgn*sw*.28;l.userData.k.rotation.z=lift*.5};rig.flash=[SOFTM];
 rig.tick=t=>{rig.flames.forEach((f,i)=>{f.scale.y=1+.2*Math.sin(t*9+i*1.7);f.scale.x=1+.1*Math.sin(t*7+i)});GL.emissiveIntensity=1+.4*Math.sin(t*3)};
 rig.atk=(u,s)=>{for(const i of[0,3]){rig.legs[i].userData.k.rotation.z+=1.1*u-.7*s}};return rig}
/* ===== №4 Міражбр 4.0.2 ===== */
function buildMiraj(){outl(0x3a2a6a);const rig=newRig(.75,1.25),b=rig.body,tg=piv(b,0,0,0);rig.torso=tg;rig.hover=.05;BMAT=SOFTT;
 const CO=glw(0xd8c6ff,0xa070ff,1),TE=glw(0x5ff0e0,0x18b8a8,1);
 blob(tg,0xcdb4ff,0x8a64e0,0,.62,0,.5,.46,.62);mk(tg,SPH(10,8),CO,0,.62,.05,.24,.2,.3);
 for(const p of[[0,1.1,.1,.08,.2],[-.15,1.05,-.15,.06,.16],[.15,1.05,-.15,.06,.16]])gem(tg,TE,p[0],p[1],p[2],p[3],p[4]);
 const h=rig.head=piv(b,0,.8,.55);blob(h,0xdcc8ff,0xa07af0,0,0,.05,.42,.36,.38);
 for(const s of[-1,1]){blob(h,0xcdb4ff,0x9a78e8,s*.2,.24,.12,.14,.14,.14,0,0,0,10);rig.eyes.push(ceye(h,s*.2,.24,.25,.1,0x3ad0c0));cheek(h,s*.28,-.08,.3,.07)}
 smile(h,0,-.08,.4,.09);
 for(const z of[.35,-.35])for(const s of[-1,1])sleg(rig,b,s*.3,.3,z,.09,.22,0xb494f5,0x7a5ad6,0x6a4ac4,10);
 const tgl=rig.tail=piv(b,0,0,0);for(let k=0;k<=12;k++){const t=k/12,th=t*2.5*Math.PI,r=.34*(1-.62*t);blob(tgl,0xcdb4ff,0x8a64e0,0,.62+r*Math.sin(th),-.95+r*Math.cos(th),.11-.07*t,.11-.07*t,.11-.07*t,0,0,0,10)}
 mk(tgl,SPH(8,6),TE,0,.8,-.9,.06);rig.wisps=[];for(let i=0;i<5;i++)rig.wisps.push(mk(b,SPH(6,5),CO,0,1.1,0,.045));
 rig.flash=[SOFTT];rig.tick=t=>{TE.emissiveIntensity=.8+.4*Math.sin(t*2.4);CO.emissiveIntensity=1+.5*Math.sin(t*3);rig.wisps.forEach((w,i)=>{const a=t*1.3+i*1.26;w.position.set(Math.cos(a)*.6,1.2+Math.sin(t*2+i)*.1,Math.sin(a)*.6)})};return rig}
/* ===== №5 Пухоклуб 5.0.2 ===== */
function buildPuff(){outl(0xb9b3a6);const rig=newRig(.6,1,'quad'),b=rig.body,fl=piv(b,0,0,0);rig.torso=fl;rig.puffs=[];
 const m0=blob(fl,0xffffff,0xe8eefc,0,.65,-.05,.46,.4,.46);
 for(let i=0;i<9;i++){const a=i*.8+.4,x=Math.cos(a)*.42,z=Math.sin(a)*.4-.05;if(z>.22)continue;const sc=.27,m=blob(fl,0xffffff,0xe0e8fa,x,.55+Math.sin(i*1.7)*.12,z,sc,sc,sc,0,0,0,12);m.userData.s=sc;rig.puffs.push(m)}
 blob(fl,0xffffff,0xe0e8fa,0,.98,-.1,.3,.24,.3,0,0,0,12);
 const h=rig.head=piv(b,0,.62,.42);blob(h,0xfff0e0,0xffd9c0,0,0,.02,.27,.25,.2);const S=(x,y)=>sf(.27,.25,.2,x,y)+.02;
 for(const s of[-1,1]){rig.eyes.push(ceye(h,s*.1,.05,S(.1,.05)-.02,.075,0x4a3a6a));cheek(h,s*.17,-.06,S(.17,-.06)-.03,.055);rig.ears.push(blob(h,0xffe0cc,0xffc8b0,s*.27,.04,-.04,.09,.14,.06,0,0,s*.3,10));
  for(const p of[[.12,.22,-.02,.065],[.19,.3,-.05,.05],[.23,.37,-.09,.04]])blob(h,0xffe08a,0xe8b030,s*p[0],p[1],p[2],p[3],p[3],p[3],0,0,0,9)}
 mk(h,SPH(6,5),std(0xe88a8a),0,-.02,S(0,-.02),.03,.024,.02);smile(h,0,-.07,S(0,-.07),.045);
 for(const z of[.22,-.2])for(const s of[-1,1])sleg(rig,b,s*.2,.2,z,.07,.16,0x6a6a84,0x4a4a60,0x3a3a50,9);
 rig.flash=[SOFTM];rig.tick=t=>{rig.puffs.forEach((p,i)=>p.scale.setScalar(p.userData.s*(1+.05*Math.sin(t*2+i))))};return rig}
/* ===== №6 Крилоша 6.0.2 ===== */
function buildKryl(){outl(0x7a3a14);const rig=newRig(1.0,1.15,'bi'),b=rig.body,tg=piv(b,0,0,0);rig.torso=tg;rig.hover=.07;
 const GL=glw(0xffe08a,0xffb030,.8),wm=(c,e)=>std(c,{side:THREE.DoubleSide,transparent:true,opacity:.9,roughness:.5,emissive:e,emissiveIntensity:.25}),WO=wm(0xffa860,0x5a2a00),WP=wm(0xb888f0,0x2a0a50);
 blob(tg,0xffb45a,0xf08a30,0,.95,0,.24,.3,.22);blob(tg,0xffe58a,0xffc84a,0,.64,-.06,.18,.24,.17);
 const h=rig.head=piv(b,0,1.32,.04);blob(h,0xffeaa0,0xffc84a,0,0,0,.3,.27,.26);const S=(x,y)=>sf(.3,.27,.26,x,y);
 for(const s of[-1,1]){rig.eyes.push(ceye(h,s*.12,.03,S(.12,.03)-.01,.095,0xc23a30));cheek(h,s*.2,-.1,S(.2,-.1)-.02,.06);
  blob(h,0xf08a30,0xd9602a,s*.1,.28,.02,.04,.04,.04,0,0,0,8);blob(h,0xf08a30,0xd9602a,s*.17,.38,.04,.04,.04,.04,0,0,0,8);mk(h,SPH(8,6),std(0xe04a3a),s*.22,.47,.05,.055)}
 smile(h,0,-.1,S(0,-.1),.05);
 const F=new THREE.Shape();F.moveTo(0,0);F.bezierCurveTo(.15,.5,.75,.85,1.0,.55);F.bezierCurveTo(1.1,.25,.75,0,.4,-.12);F.lineTo(0,-.05);
 const Hd=new THREE.Shape();Hd.moveTo(0,0);Hd.bezierCurveTo(.4,-.05,.8,-.2,.82,-.55);Hd.bezierCurveTo(.7,-.85,.25,-.75,0,-.15);
 const gF=new THREE.ShapeGeometry(F,12),gH=new THREE.ShapeGeometry(Hd,12);
 for(const s of[-1,1]){const a=piv(b,s*.1,1.1,0),m=mk(a,gF,WO,0,0,0,s,1,1,Math.PI/2,0,0);[[.62,.42],[.82,.4],[.5,.2]].forEach(p=>mk(m,SPH(6,5),GL,p[0],p[1],.01,.04,.04,.01));rig.wings.push({g:a,s,base:.35,amp:.5,ph:0});
  const c=piv(b,s*.08,.98,0),m2=mk(c,gH,WP,0,0,0,s,1,1,Math.PI/2,0,0);[[.4,-.3],[.55,-.5]].forEach(p=>mk(m2,SPH(6,5),GL,p[0],p[1],.01,.04,.04,.01));rig.wings.push({g:c,s,base:.2,amp:.45,ph:.6})}
 for(const s of[-1,1])sleg(rig,b,s*.07,.5,0,.035,.14,0xd9602a,0xb84a20,0x8a3a18,8);
 rig.pollen=[];for(let i=0;i<8;i++)rig.pollen.push(mk(b,SPH(5,4),GL,0,1,0,.02));
 rig.flash=[SOFTM];rig.tick=t=>{rig.pollen.forEach((p,i)=>{const f=(t*.3+i*.37)%1,a=t*.8+i*1.1;p.position.set(Math.cos(a)*(.35+f*.2),1.25-f*1.1,Math.sin(a)*(.35+f*.2))})};return rig}
/* ===== №7 Мороріг 7.0.2 ===== */
function buildMoror(){const IC=gls(0x9aeaff,{emissive:0x2a9ad0,emissiveIntensity:.6,opacity:.88}),rig=quad({ol:0x35607a,cy:.85,dist:1.25,top:0xeef8ff,bot:0xa9d4ea,belly:[0xffffff,0xeaf6ff],body:{y:.7,z:-.05,rx:.46,ry:.42,rz:.58},
  head:{y:1.12,z:.5,rx:.42,ry:.38,rz:.4},eye:{x:.18,y:.05,r:.085,iris:0x3b6fb8},muzzle:{c:[0xffffff,0xe8f2fa],y:-.1,rx:.17,ry:.12,rz:.18},nose:0xe58aa0,
  leg:{r:.1,len:.34,x:.24,zF:.3,zB:-.32,top:0xdcefff,bot:0xa9d4ea,foot:0x5a6a86},
  ears:(h,rig)=>{for(const s of[-1,1])rig.ears.push(blob(h,0xeef8ff,0xbfe2f2,s*.36,.2,-.05,.1,.19,.07,0,0,-s*.8,10))},
  tail:(b,rig)=>{rig.tail=piv(b,0,.85,-.62);blob(rig.tail,0xffffff,0xe8f2fa,0,0,-.05,.1,.1,.1,0,0,0,10)}}),b=rig.body,h=rig.head;
 blob(rig.torso,0xffffff,0xe8f2fa,0,.78,.45,.3,.28,.2,0,0,0,12);
 for(const s of[-1,1]){gem(h,IC,s*.15,.46,-.02,.06,.24,-s*.3);gem(h,IC,s*.27,.62,-.02,.045,.18,-s*.8);gem(h,IC,s*.08,.7,-.04,.04,.16,-s*.15)}
 rig.sp=[];for(let i=0;i<6;i++)rig.sp.push(mk(h,SPH(5,4),glw(0xffffff,0x9ae8ff,1),0,.6,-.1,.02));
 rig.tick=t=>{IC.emissiveIntensity=.5+.25*Math.sin(t*2);rig.sp.forEach((p,i)=>{const a=t*1+i*1.05;p.position.set(Math.cos(a)*.3,.6+Math.sin(t*1.5+i)*.12,-.05+Math.sin(a)*.12)})};
 rig.atk=(u,s)=>{rig.head.rotation.x+=.4*u-.7*s};return rig}
/* ===== №8 Грозовик 8.0.2 ===== */
function buildWolf(){const NE=glw(0x6ae8ff,0x1a9fff,1.5),rig=quad({ol:0x14142a,cy:.8,dist:1.25,top:0x7a7aa4,bot:0x34344e,belly:[0xd6dcf5,0xb3bde6],body:{y:.6,z:-.05,rx:.45,ry:.4,rz:.55},
  head:{y:.98,z:.55,rx:.5,ry:.44,rz:.44},eye:{x:.2,y:.06,r:.09,iris:0x2ad0ff},muzzle:{c:[0xd6dcf5,0xb3bde6],y:-.12,rx:.2,ry:.14,rz:.2},nose:0x14141c,
  leg:{r:.13,len:.26,x:.26,zF:.35,zB:-.38,top:0x5a5a80,bot:0x34344e,foot:0x24243a},
  ears:(h,rig)=>{for(const s of[-1,1]){rig.ears.push(blob(h,0x6a6a94,0x34344e,s*.3,.4,-.02,.12,.22,.08,0,0,-s*.25,12));blob(h,0xffc8d8,0xe89ab0,s*.3,.38,.03,.06,.12,.04,0,0,-s*.25,8)}},
  tail:(b,rig)=>{const t=rig.tail=piv(b,0,.65,-.55);blob(t,0x5a5a80,0x34344e,0,.12,-.2,.14,.14,.3,.6,0,0,12);gem(t,NE,0,.34,-.4,.06,.16,.4)}}),b=rig.body,h=rig.head;
 for(const p of[[.28,.0],[.0,.06],[-.28,.0]])mk(h,BOX(.04,.16,.02),NE,p[0]*.3,.3,.33,1,1,1,0,0,(p[1]?0:(p[0]>0?-.5:.5)));
 for(let i=0;i<3;i++)gem(rig.torso,NE,0,1.02-i*.0,.3-i*.3,.05,.14,0);
 for(const s of[-1,1])for(let i=0;i<2;i++)mk(b,BOX(.025,.14,.02),NE,s*.43,.6,.2-i*.3,1,1,1,0,0,i?.5:-.5);
 rig.tick=t=>{NE.emissiveIntensity=1.2+.6*Math.abs(Math.sin(t*5)*Math.sin(t*1.3))};rig.atk=(u,s)=>{rig.head.rotation.x+=.1*u-.15*s};return rig}
/* ===== №9 Хвилезуб 9.0.2 ===== */
function buildShark(){const rig=quad({ol:0x203a5a,cy:.55,dist:1.3,top:0x8cc4f2,bot:0x4a86c0,belly:[0xffffff,0xe3eef8],body:{y:.55,z:0,rx:.5,ry:.46,rz:.85},
  head:{y:.62,z:.72,rx:.46,ry:.4,rz:.42},eye:{x:.22,y:.12,r:.09,iris:0xe8b020},nose:0x1d3a5a,
  leg:{r:.12,len:.16,x:.3,zF:.45,zB:-.5,top:0x5a96d0,bot:0x3a6aa0,foot:0x2e5f96},
  tail:(b,rig)=>{const t=rig.tail=piv(b,0,.58,-.85);blob(t,0x6aa6e0,0x2e5f96,0,.18,-.18,.06,.3,.2,-.9,0,0,10);blob(t,0x6aa6e0,0x2e5f96,0,-.12,-.16,.05,.2,.16,-2.3,0,0,10)}}),b=rig.body,tg=rig.torso,h=rig.head;
 blob(tg,0x6aa6e0,0x2e5f96,0,1.08,-.05,.06,.3,.22,-.2,0,0,10);
 for(const s of[-1,1])blob(tg,0x6aa6e0,0x2e5f96,s*.52,.45,.2,.2,.05,.12,0,0,s*.5,10);
 for(const s of[-1,1])mk(h,SPH(7,5),std(0xffffff,{roughness:.3}),s*.07,-.17,rig.S(.07,-.17)-.01,.03,.04,.025);
 rig.atk=(u,s)=>{rig.head.rotation.x+=.3*u-.5*s};return rig}
/* ===== №10 Сонцеклюв 10.0.2 ===== */
function buildSun(){outl(0x6a1a14);const rig=newRig(.95,1.3,'bi'),b=rig.body,tg=piv(b,0,0,0);rig.torso=tg;const SU=glw(0xffd34e,0xffa020,1.4);
 blob(tg,0xff8a6a,0xd9402e,0,.65,0,.5,.5,.46);blob(tg,0xffeccc,0xffd9a8,0,.58,.3,.32,.34,.16,0,0,0,10);
 const h=rig.head=piv(b,0,1.3,.1);blob(h,0xff9a7a,0xe04a34,0,0,0,.4,.36,.36);const S=(x,y)=>sf(.4,.36,.36,x,y);
 for(const s of[-1,1]){rig.eyes.push(ceye(h,s*.17,.06,S(.17,.06)-.015,.085,0x8a4a10));cheek(h,s*.28,-.1,S(.28,-.1)-.02,.07)}
 blob(h,0xffe08a,0xf0b030,0,-.08,S(0,-.08)+.03,.1,.075,.11,0,0,0,10);
 for(let i=0;i<3;i++)blob(h,0xffd34e,0xe8803a,(i-1)*.08,.38+(i==1?.05:0),0,.045,.11,.045,0,0,(i-1)*.3,9);
 const sg=piv(b,0,1.3,-.3);mk(sg,TOR(.55,.04,6.28,28),SU,0,0,0);for(let i=0;i<10;i++){const a=i/10*6.2832;gem(sg,SU,Math.cos(a)*.74,Math.sin(a)*.74,0,.05,.12,a-Math.PI/2)}
 for(const s of[-1,1]){const wg=piv(b,s*.48,.8,0);blob(wg,0xe8583e,0xb83422,s*.1,-.14,-.02,.14,.3,.17,0,0,0,12);rig.wings.push({g:wg,s,base:.15,amp:.9,ph:0,calm:1})}
 for(const s of[-1,1])sleg(rig,b,s*.2,.28,.05,.05,.22,0xf0c24a,0xd9a02a,0xd9a02a,8);
 for(let i=0;i<3;i++)blob(b,0xe8583e,0xb83422,(i-1)*.12,.75,-.5,.1,.24,.08,-.7,0,(i-1)*.3,10);
 rig.flash=[SOFTM];rig.tick=t=>{sg.rotation.z=t*.4;SU.emissiveIntensity=1.2+.3*Math.sin(t*2)};return rig}

/* ===== Список істот ===== */
const PALS=[
 {k:'bambuzl',n:'Бамбузл',num:1,ver:'1.0.3',el:'Трав’яний',role:'Збір врожаю',b:buildBam},
 {k:'grumrok',n:'Грумрок',num:2,ver:'2.0.2',el:'Земля / Кристал',role:'Видобуток',b:buildGrumrok},
 {k:'ignis',n:'Ігніс-Виверг',num:3,ver:'3.0.2',el:'Вогняний',role:'Плавлення',b:buildIgnis},
 {k:'mirazhbr',n:'Міражбр',num:4,ver:'4.0.2',el:'Темрява / Привид',role:'Перенесення',b:buildMiraj},
 {k:'pukhoklub',n:'Пухоклуб',num:5,ver:'5.0.2',el:'Нормальний',role:'',b:buildPuff},
 {k:'krylosha',n:'Крилоша',num:6,ver:'6.0.2',el:'Повітряний',role:'',b:buildKryl},
 {k:'mororyh',n:'Мороріг',num:7,ver:'7.0.2',el:'Лід',role:'',b:buildMoror},
 {k:'hrozovyk',n:'Грозовик',num:8,ver:'8.0.2',el:'Електро',role:'',b:buildWolf},
 {k:'khvylezub',n:'Хвилезуб',num:9,ver:'9.0.2',el:'Вода',role:'',b:buildShark},
 {k:'sontseklyv',n:'Сонцеклюв',num:10,ver:'10.0.2',el:'Вогонь / Повітря',role:'',b:buildSun}];

window.PALMODEL={PALS,build:i=>PALS[i].b(),pose:poseAny,tris};
}catch(e){console.warn('pal-models',e)}})();
/* ===== Підключення до гри: близькі істоти отримують нову модель і анімації ===== */
(function(){try{
if(!window.PALMODEL)return;
const G=n=>{try{return eval(n)}catch(e){return undefined}};const GC=(()=>{const c={};return n=>c[n]||(c[n]=G(n))})();
const SC=.8,NEAR=32,MAXHI=16,pool={};
const getR=ty=>{const p=pool[ty];if(p&&p.length)return p.pop();const r=PALMODEL.build(ty);r.root.scale.setScalar(SC);r.root.traverse(m=>{if(m.isMesh){m.castShadow=true;m.frustumCulled=true}});return r};
const putR=(ty,r)=>{(pool[ty]=pool[ty]||[]).push(r)};
const live=new Set();
function attach(o){if(o._hi||!o.m)return;const r=getR(o.ty);o._hi=r;o._hiTy=o.ty;o._ph=o._ph||Math.random()*20;
 o.m.children.forEach(c=>{if(c!==r.root){c.userData._lo=1;c.visible=false}});o.m.add(r.root);live.add(o)}
function detach(o){const r=o._hi;if(!r)return;if(r.root.parent)r.root.parent.remove(r.root);if(o.m)o.m.children.forEach(c=>{if(c.userData._lo)c.visible=true});putR(o._hiTy,r);o._hi=null;live.delete(o)}
window.palHi={attach,detach,live};
/* події: поранення, атаки, радість */
const all=()=>[...(GC('wild')||[]),...(GC('pals')||[])];
const _dmg=window.dmg;
if(typeof _dmg==='function')window.dmg=function(t,o,col){try{const e=all().find(x=>x.m===o);if(e){e._hurt=1e-3;if(col&&col!=='#ffd34e'&&!/^\d/.test(String(t))){const P=GC('pals'),s=P&&P[G('selP')|0];if(s)s._atk=.9}}}catch(_){}return _dmg.apply(this,arguments)};
const _msg=window.msg;
if(typeof _msg==='function')window.msg=function(s){try{s=String(s||'');const P=GC('pals')||[];
 if(s.startsWith('🎉')&&P.length)P[P.length-1]._happy=2.6;
 if(s.startsWith('🍖 Істоти нагодовані'))P.forEach(p=>p._happy=2);
 if(s.startsWith('🐾 З вами')){const p=P[G('selP')|0];if(p)p._happy=1.6}}catch(_){}return _msg.apply(this,arguments)};
/* цикл: вибір найближчих і анімація */
let lt=performance.now(),acc=1;
(function loop(){requestAnimationFrame(loop);const n=performance.now(),dt=Math.min(.05,(n-lt)/1000);lt=n;const t=n/1000;
 const P=GC('P');if(!P)return;
 acc+=dt;if(acc>.3){acc=0;
  const W=GC('wild')||[],PL=GC('pals')||[],list=[...W,...PL];
  for(const o of [...live])if(!list.includes(o)||!o.m||!o.m.parent)detach(o);
  const c=list.filter(o=>o.m&&o.m.parent&&o.ty!=null).map(o=>[o,Math.hypot(o.x-P.x,o.z-P.z)]).filter(a=>a[1]<NEAR).sort((a,b)=>a[1]-b[1]).slice(0,MAXHI).map(a=>a[0]);
  const want=new Set(c);for(const o of [...live])if(!want.has(o))detach(o);for(const o of c)attach(o)}
 const PL=GC('pals')||[],sel=PL[G('selP')|0],menu=G('menuO');
 for(const o of live){const r=o._hi;if(!r)continue;
  const vx=o._lx==null?0:Math.hypot(o.x-o._lx,o.z-o._lz)/Math.max(dt,1e-3);o._lx=o.x;o._lz=o.z;o._v=(o._v||0)*.8+vx*.2;
  let mode=o._v>.35?'walk':'idle';
  if(o.ag&&Math.hypot(o.x-P.x,o.z-P.z)<1.7&&!menu)mode='attack';
  if(o._atk>0){o._atk-=dt;mode='attack'}
  if(o._happy>0){o._happy-=dt;mode='happy'}
  else if(PL.includes(o)&&o!==sel&&mode=='idle'){o._ht=(o._ht||Math.random()*12)-dt;if(o._ht<=0){o._ht=8+Math.random()*12;o._happy=1.4}}
  let h=0;if(o._hurt>0){o._hurt+=dt/.45;if(o._hurt>=1)o._hurt=0;h=o._hurt}
  try{PALMODEL.pose(r,t+o._ph,mode,h)}catch(e){}}
})();
}catch(e){console.warn('pal-hi',e)}})();
