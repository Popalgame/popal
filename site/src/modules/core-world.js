const _sh=THREE.Color.prototype.setHex;THREE.Color.prototype.setHex=function(h){_sh.call(this,h);return this.convertSRGBToLinear()};
const R=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});R.outputEncoding=THREE.sRGBEncoding;R.setPixelRatio(Math.min(devicePixelRatio,2));R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=.86;document.body.appendChild(R.domElement);
const sc=new THREE.Scene();const sk=document.createElement('canvas');sk.width=2;sk.height=256;const sx=sk.getContext('2d'),gd=sx.createLinearGradient(0,0,0,256);gd.addColorStop(0,'#2f7fe0');gd.addColorStop(.6,'#7db8ef');gd.addColorStop(1,'#bcdcf3');sx.fillStyle=gd;sx.fillRect(0,0,2,256);const bt=new THREE.CanvasTexture(sk);bt.encoding=THREE.sRGBEncoding;sc.background=bt;sc.fog=new THREE.Fog(0xa9cfee,44,78);
const cam=new THREE.PerspectiveCamera(50,1,.1,80);let ang=0,CD=9.5,CHt=7,LA=0,pit=.72,ly=0,camD=9.5,fovCur=50;
function rs(){const cw=R.domElement.clientWidth||innerWidth,ch=R.domElement.clientHeight||innerHeight;R.setSize(cw,ch,false);const a=cw/ch;cam.aspect=a;cam.fov=50;CD=8;CHt=7;LA=0;cam.updateProjectionMatrix();try{screen.orientation.lock('landscape').catch(()=>{})}catch(e){}}addEventListener('resize',rs);rs();
sc.add(new THREE.HemisphereLight(0xcde4ff,0x4f6b2e,.7));
const sun=new THREE.DirectionalLight(0xffe6bf,2.2);sun.position.set(10,18,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.0005;
Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:60});sc.add(sun,sun.target);
const gmT=(()=>{const t=new THREE.DataTexture(new Uint8Array([120,120,120,255,175,175,175,255,225,225,225,255,255,255,255,255]),4,1,THREE.RGBAFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t})();
const OM=new THREE.MeshBasicMaterial({color:0x2b1830,side:THREE.BackSide});
/* celowo wyłączony efekt obrysu — kod zostawiony na przyszłość */
function outl(g,t=.05){return;
// eslint-disable-next-line no-unreachable
const a=[];g.traverse(m=>{if(m.isMesh)a.push(m)});a.forEach(m=>{const o=new THREE.Mesh(m.geometry,OM);o.scale.setScalar(1+t);m.add(o)})}
function cv2(n,f){const c=document.createElement('canvas');c.width=c.height=n;f(c.getContext('2d'),n);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;try{t.anisotropy=Math.min(16,R.capabilities.getMaxAnisotropy())}catch(e){}return t}
const paint=cv2(256,(x,n)=>{x.fillStyle='#fff';x.fillRect(0,0,n,n);for(let i=0;i<260;i++){x.fillStyle=Math.random()<.5?'rgba(0,0,0,.07)':'rgba(255,255,200,.12)';x.beginPath();x.arc(Math.random()*n,Math.random()*n,6+Math.random()*18,0,7);x.fill()}});paint.repeat.set(36,36);
const cobble=cv2(256,(x,n)=>{x.fillStyle='#8f8372';x.fillRect(0,0,n,n);for(let r=0;r<6;r++)for(let c=0;c<6;c++){const w=n/6,o=(r%2)*w/2,l=150+Math.random()*50|0;x.fillStyle='rgb('+l+','+(l-8)+','+(l-22)+')';x.fillRect(c*w+o+3,r*w+3,w-6,w-6)}});cobble.repeat.set(3,3);
const mc={},M=c=>mc[c]||(mc[c]=new THREE.MeshStandardMaterial({color:c,roughness:.85,metalness:0}));
const B=(w,h,d)=>new THREE.BoxGeometry(w,h,d),Cy=(a,b,h,s=8)=>new THREE.CylinderGeometry(a,b,h,s),Co=(r,h,s=8)=>new THREE.ConeGeometry(r,h,s),S=r=>new THREE.SphereGeometry(r,12,9);
function add(g,geo,c,x,y,z,ry){const m=new THREE.Mesh(geo,M(c));m.position.set(x,y,z);if(ry)m.rotation.y=ry;m.castShadow=true;m.receiveShadow=true;g.add(m);return m}
const SZ=230,rn=(a,b)=>a+Math.random()*(b-a);
const SP=[[0,0],[54,-30],[-60,42],[24,84],[-42,-72]],PC=new THREE.Color(0xc9a66b);
const nearS=(x,z,r)=>SP.some(s=>Math.hypot(x-s[0],z-s[1])<r);
/* ===== 0.1.10: новий світ POPAL-11638-g15-s75-o40-v1 (генератор як у прототипі) ===== */
const WG={seed:11638,mount:.15,land:.75,frag:4.0,volc:1,R:250,STEP:2};
const WGEN=(()=>{const P=WG;function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const perm=new Uint8Array(512),gr=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];{const r=mul(P.seed),p=[...Array(256).keys()];for(let i=255;i>0;i--){const j=(r()*(i+1))|0;[p[i],p[j]]=[p[j],p[i]]}for(let i=0;i<512;i++)perm[i]=p[i&255]}
const F2=.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
function sn(x,y){const s=(x+y)*F2,i=Math.floor(x+s),j=Math.floor(y+s),t=(i+j)*G2,x0=x-(i-t),y0=y-(j-t),i1=x0>y0?1:0,j1=x0>y0?0:1,x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2,ii=i&255,jj=j&255;let n=0;
let t0=.5-x0*x0-y0*y0;if(t0>0){const g=gr[perm[ii+perm[jj]]&7];t0*=t0;n+=t0*t0*(g[0]*x0+g[1]*y0)}
let t1=.5-x1*x1-y1*y1;if(t1>0){const g=gr[perm[ii+i1+perm[jj+j1]]&7];t1*=t1;n+=t1*t1*(g[0]*x1+g[1]*y1)}
let t2=.5-x2*x2-y2*y2;if(t2>0){const g=gr[perm[ii+1+perm[jj+1]]&7];t2*=t2;n+=t2*t2*(g[0]*x2+g[1]*y2)}return 70*n}
function fbm(x,y,o){let a=1,f=1,s=0,m=0;for(let k=0;k<o;k++){s+=a*sn(x*f,y*f);m+=a;a*=.5;f*=2.02}return s/m}
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
let VC=null;{const r=mul(P.seed*7+3);let bv=-9;for(let k=0;k<40;k++){const a=r()*6.283,d=.18+r()*.38,u=Math.cos(a)*d,v=Math.sin(a)*d,val=fbm(u*P.frag,v*P.frag,4);if(val>bv){bv=val;VC={x:u,z:v}}}}
function sample(u,v,boost){const wx=fbm(u*1.4+11.3,v*1.4+3.7,3)*.22,wz=fbm(u*1.4-7.1,v*1.4+19.4,3)*.22,x=u+wx,z=v+wz,f=P.frag,d=Math.hypot(u,v);
let land=fbm(x*f,z*f,5)*.62+(P.land-.5)*.9+.12-sm(.6,1.02,d)*1.3+boost;
let cone=0;if(P.volc){const dv=Math.hypot(u-VC.x,v-VC.z);cone=Math.max(0,1-dv/.13);land+=cone*.5}
let h;if(land<=0)h=Math.max(-35,land*40);else{const hills=fbm(x*f*3.1+5,z*f*3.1-9,4)*.5+.5,rg=1-Math.abs(sn(x*f*2.3+40,z*f*2.3-40)),ridge=rg*rg*rg,mm=sm(.08,.42,land);
h=land*16+hills*7*sm(0,.12,land)+ridge*mm*P.mount*75+mm*P.mount*12;if(cone>0){const c=Math.pow(cone,1.6);h=h*(1-c*.6)+c*62*Math.max(.55,P.mount);if(cone>.86)h-=(cone-.86)*120}}
const m=fbm(u*2.1+71,v*2.1-33,4),t=-v*.85+fbm(u*1.3-51,v*1.3+17,3)*.35-Math.max(0,h)/110;return{h,m,t,cone}}
function biome(o){const{h,m,t,cone}=o;if(h<-12)return'deep';if(h<0)return'shal';if(P.volc&&cone>.86)return'lava';if(P.volc&&cone>.28)return'ash';if(h>52||(t<-.55&&h>18))return'snow';if(h>34)return'rock';if(h<2.2)return t<-.45?'rock':'sand';if(t<-.3)return'tundra';if(t>.24&&m<.02)return'desert';if(m>.32&&h<9)return'swamp';if(m>-.02)return'forest';return'mead'}
const N=Math.round(2*P.R/P.STEP)+1,HG=new Float32Array(N*N),BG=new Array(N*N);
return{P,N,HG,BG,sample,biome,VC,fill(boostFn){for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=-P.R+i*P.STEP,z=-P.R+j*P.STEP,o=sample(x/P.R,z/P.R,boostFn(x,z));HG[j*N+i]=o.h<0?o.h*.2-.45:(P.volc&&o.cone>0?Math.max(o.h*.07,Math.pow(o.cone,1.6)*7.5-(o.cone>.86?(o.cone-.86)*18:0)):o.h*.07)-.45+(o.h>0?Math.min(.35,o.h*.06):0);BG[j*N+i]=biome(o)}}}})();
const MT=[];window.MT=MT;
const mh=()=>0;
function pathD(x,z){let m=99;for(let i=1;i<5;i++){const a=SP[0],b=SP[i],dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz,Ls=Math.sqrt(L);let t=((x-a[0])*dx+(z-a[1])*dz)/L;t=Math.max(0,Math.min(1,t));const w=Math.sin(t*9+i)*1.3,px=a[0]+dx*t-dz/Ls*w,pz=a[1]+dz*t+dx/Ls*w;m=Math.min(m,Math.hypot(x-px,z-pz))}return m}

{const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
WGEN.fill((x,z)=>{let b=0;for(const c of SP){const d=Math.hypot(x-c[0],z-c[1]);b=Math.max(b,.5*(1-sm(14,32,d)))}b=Math.max(b,.24*(1-sm(3,9,pathD(x,z))));return b})}
const WG_N=WGEN.N,WG_R=WG.R,WG_S=WG.STEP,WG_H=WGEN.HG;
function GH(x,z){let fx=(x+WG_R)/WG_S,fz=(z+WG_R)/WG_S;if(fx<0)fx=0;if(fz<0)fz=0;if(fx>WG_N-1.001)fx=WG_N-1.001;if(fz>WG_N-1.001)fz=WG_N-1.001;const i=fx|0,j=fz|0,a=fx-i,b=fz-j,k=j*WG_N+i;return(WG_H[k]*(1-a)+WG_H[k+1]*a)*(1-b)+(WG_H[k+WG_N]*(1-a)+WG_H[k+WG_N+1]*a)*b}
const H=(x,z)=>{let k=1;for(let i=0;i<5;i++){const s=SP[i];k=Math.min(k,Math.max(0,(Math.hypot(x-s[0],z-s[1])-(i?3:5))/6))}return k>=1?GH(x,z):k*GH(x,z)};
window.H=H;
const BCOL={deep:0x1d5d86,shal:0x3aa6b9,sand:0xe9d79a,mead:0x649e42,forest:0x4a8838,swamp:0x7a8a3e,desert:0xe8c46e,tundra:0x7fae8a,rock:0x9a988f,snow:0xf2f6fc,ash:0x544040,lava:0xff5a1f};
function BIO(x,z){const i=Math.max(0,Math.min(WG_N-1,Math.round((x+WG_R)/WG_S))),j=Math.max(0,Math.min(WG_N-1,Math.round((z+WG_R)/WG_S)));return WGEN.BG[j*WG_N+i]}
window.BIO=BIO;window.BCOL=BCOL;
{const v=WGEN.VC;MT.push([v.x*WG_R,v.z*WG_R,24,0])}
const tg=new THREE.PlaneGeometry(2*WG_R,2*WG_R,WG_N-1,WG_N-1);tg.rotateX(-Math.PI/2);const tp=tg.attributes.position,tcol=[],c1=new THREE.Color();
function colorHash(i,j){let h=Math.imul(i,374761393)^Math.imul(j,668265263)^WG.seed;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295}
function colorNoise(x,z){const ix=Math.floor(x),iz=Math.floor(z),a=x-ix,b=z-iz,u=a*a*(3-2*a),v=b*b*(3-2*b);
const lo=colorHash(ix,iz)*(1-u)+colorHash(ix+1,iz)*u,hi=colorHash(ix,iz+1)*(1-u)+colorHash(ix+1,iz+1)*u;return lo*(1-v)+hi*v}
for(let i=0;i<tp.count;i++){const x=tp.getX(i),z=tp.getZ(i),h=H(x,z);tp.setY(i,h);const n=(colorNoise(x*.018,z*.018)*.5+colorNoise(x*.065+19.7,z*.065-8.3)*.32+colorNoise(x*.16-31.1,z*.16+42.5)*.18-.5)*.12;const bi=BIO(x,z);c1.set(BCOL[bi]);c1.offsetHSL(0,0,n);if(h>-.3&&h<5.5){const trail=Math.max(0,Math.min(1,(2.1-pathD(x,z))/.95));c1.lerp(PC,trail*.88)}tcol.push(c1.r,c1.g,c1.b)}
tg.setAttribute('color',new THREE.Float32BufferAttribute(tcol,3));tg.computeVertexNormals();
const gr=new THREE.Mesh(tg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,map:paint}));gr.receiveShadow=true;sc.add(gr);
const water=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),new THREE.MeshStandardMaterial({color:0x22b4f2,transparent:true,opacity:.78,roughness:.15}));water.rotation.x=-Math.PI/2;water.position.y=-.5;sc.add(water);
{const bed=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),new THREE.MeshStandardMaterial({color:0x1d5d86,roughness:1}));bed.rotation.x=-Math.PI/2;bed.position.y=-9.5;sc.add(bed)}
const FL_=110,GL_=64,GN=20000,FN=700,gm=new THREE.InstancedMesh(new THREE.ConeGeometry(.045,.62,3,1,true),M(0xffffff),GN),du=new THREE.Object3D(),grd0=[],fld0=[];
for(let i=0;i<GN;i++){grd0.push([rn(0,GL_),rn(0,GL_),rn(-.2,.2),rn(0,6),rn(-.2,.2),rn(.7,1.5)]);gm.setColorAt(i,new THREE.Color([0x66903e,0x739b47,0x608b3b,0x82a650,0x6d9442][i%5]))}sc.add(gm);gm.frustumCulled=false;
const fm=new THREE.InstancedMesh(new THREE.SphereGeometry(.09,6,4),new THREE.MeshStandardMaterial({roughness:.6}),FN),fc=[0xffffff,0xffe040,0xff5c9a,0xa870ff];
for(let i=0;i<FN;i++){fld0.push([rn(0,FL_),rn(0,FL_)]);fm.setColorAt(i,new THREE.Color(fc[i%4]))}sc.add(fm);fm.frustumCulled=false;
let gcx=1e9,gcz=1e9;
const NOGR={lava:1,ash:1,snow:1},SPGR={desert:1,sand:1,rock:1};/* 0.1.16: без трави на лаві, попелі й снігу; рідка — на піску, у пустелі й на скелях */
function regrass(cx,cz){gcx=cx;gcz=cz;
for(let i=0;i<GN;i++){const d=grd0[i],x=d[0]+GL_*Math.round((cx-d[0])/GL_),z=d[1]+GL_*Math.round((cz-d[1])/GL_),h=H(x,z),bi=BIO(x,z);du.position.set(x,(h<-.35||h>5.5||NOGR[bi]||pathD(x,z)<1.05+.16*Math.sin(x*3+z*5)||(SPGR[bi]&&i%5))?-5:h,z);du.rotation.set(d[2],d[3],d[4]);du.scale.setScalar(d[5]);du.updateMatrix();gm.setMatrixAt(i,du.matrix)}
for(let i=0;i<FN;i++){const d=fld0[i],x=d[0]+FL_*Math.round((cx-d[0])/FL_),z=d[1]+FL_*Math.round((cz-d[1])/FL_),h=H(x,z),bi=BIO(x,z);du.position.set(x,(h<-.35||h>5.5||NOGR[bi]||SPGR[bi]||pathD(x,z)<1.7)?-5:h+.1,z);du.rotation.set(0,0,0);du.scale.setScalar(1);du.updateMatrix();fm.setMatrixAt(i,du.matrix)}
gm.instanceMatrix.needsUpdate=true;fm.instanceMatrix.needsUpdate=true}
regrass(0,0);
/* base */
const base=new THREE.Group();sc.add(base);
/* camp & world art */
const ANI=[];function envUp(t){for(const f of ANI)f(t)}
ANI.push(()=>{if(gm.visible&&Math.hypot(P.x-gcx,P.z-gcz)>10)regrass(P.x,P.z)});
const woodT=cv2(128,(x,n)=>{x.fillStyle='#fff';x.fillRect(0,0,n,n);for(let i=0;i<8;i++){const l=200+Math.random()*50|0;x.fillStyle='rgb('+l+','+l+','+l+')';x.fillRect(i*16+1,0,14,n);x.fillStyle='rgba(50,25,8,.4)';x.fillRect(i*16,0,2,n);for(let k=0;k<4;k++)x.fillRect(i*16+3+Math.random()*9,Math.random()*n,1,8+Math.random()*16)}});
const tileT=cv2(128,(x,n)=>{x.fillStyle='#bbb';x.fillRect(0,0,n,n);for(let r=0;r<9;r++)for(let c=-1;c<9;c++){const l=185+Math.random()*70|0;x.fillStyle='rgb('+l+','+l+','+l+')';x.beginPath();x.arc(c*16+(r%2)*8+8,r*14,9,0,Math.PI);x.rect(c*16+(r%2)*8-1,r*14-14,18,14);x.fill();x.strokeStyle='rgba(0,0,0,.4)';x.lineWidth=1.5;x.stroke()}});
const pathT=cv2(128,(x,n)=>{x.fillStyle='#b99a62';x.fillRect(0,0,n,n);for(let r=0;r<8;r++)for(let c=0;c<5;c++){const w=n/5,l=170+Math.random()*55|0;x.fillStyle='rgb('+l+','+(l-14)+','+(l-34)+')';x.fillRect(c*w+(r%2)*w/2+2,r*16+2,w-4,12)}x.globalCompositeOperation='destination-in';const g=x.createLinearGradient(0,0,n,0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.14,'#000');g.addColorStop(.86,'#000');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,n,n)});
const WM=c=>new THREE.MeshStandardMaterial({map:woodT,color:c,roughness:.9}),TM=c=>new THREE.MeshStandardMaterial({map:tileT,color:c,roughness:.75}),SM=c=>new THREE.MeshStandardMaterial({map:cobble,color:c,roughness:.95}),CM=c=>new THREE.MeshStandardMaterial({color:c,roughness:.8}),GL=new THREE.MeshStandardMaterial({color:0xffe08a,emissive:0xffb040,emissiveIntensity:1,roughness:.3});
function bx(g,w,h,d,m,x,y,z,ry){const o=new THREE.Mesh(B(w,h,d),m);o.position.set(x,y,z);if(ry)o.rotation.y=ry;o.castShadow=o.receiveShadow=true;g.add(o);return o}
function cyl(g,a,b,h,s,m,x,y,z){const o=new THREE.Mesh(Cy(a,b,h,s),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o}
function roof(g,w,d,rh,y,mats){const hw=d/2+.28,sh=new THREE.Shape();sh.moveTo(-hw,0);sh.lineTo(hw,0);sh.lineTo(0,rh);sh.lineTo(-hw,0);const len=w+.5,geo=new THREE.ExtrudeGeometry(sh,{depth:len,bevelEnabled:false});geo.translate(0,0,-len/2);geo.rotateY(Math.PI/2);const m=new THREE.Mesh(geo,mats);m.position.y=y;m.castShadow=true;g.add(m);return m}
function smoke(g,x,y,z){const ps=[0,1,2].map(k=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.14,8,6),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.5,depthWrite:false}));g.add(m);return m});ANI.push(t=>{ps.forEach((m,k)=>{const f=(t*.25+k/3)%1;m.position.set(x+f*.5,y+f*1.8,z);m.scale.setScalar(.6+f*2);m.material.opacity=.5*(1-f)})})}
function mkHouse(o){const g=new THREE.Group(),w=o.w,d=o.d,h=o.h,rh=o.rh||1.1,y0=.32,wm=o.stone?SM(o.wc):WM(o.wc),rm=TM(o.rc),tm=WM(o.tc||0x6b3f22),dm=WM(0x7a4a2a),sm=WM(o.sc||0x2f8f6a);
bx(g,w+.3,.55,d+.3,SM(0xd8d2c4),0,.05,0);bx(g,w,h,d,wm,0,y0+h/2,0);
for(const sx of[-1,1])for(const sz of[-1,1])bx(g,.14,h,.14,tm,sx*w/2,y0+h/2,sz*d/2);
bx(g,w+.12,.12,d+.12,tm,0,y0+h,0);
if(!o.stone){bx(g,w,.09,.05,tm,0,y0+h*.5,d/2+.03);bx(g,w,.09,.05,tm,0,y0+h*.5,-d/2-.03)}
roof(g,w,d,rh,y0+h+.04,[wm,rm]);bx(g,w+.65,.1,.14,tm,0,y0+h+.04+rh,0);
bx(g,.66,1.04,.07,tm,0,y0+.52,d/2+.02);bx(g,.5,.92,.09,dm,0,y0+.47,d/2+.04);bx(g,.58,.08,.1,tm,0,y0+.97,d/2+.05);cyl(g,.04,.04,.06,8,CM(0xe2bf67),.16,y0+.45,d/2+.1).rotation.x=Math.PI/2;
bx(g,.9,.12,.45,SM(0xcfc8b8),0,.12,d/2+.3);
for(const sx of[-1,1]){const x=sx*w*.3,y=y0+h*.62;bx(g,.52,.5,.05,tm,x,y,d/2+.03);bx(g,.4,.38,.06,GL,x,y,d/2+.04);bx(g,.14,.5,.05,sm,x-.34,y,d/2+.05);bx(g,.14,.5,.05,sm,x+.34,y,d/2+.05);bx(g,.58,.13,.16,tm,x,y-.32,d/2+.1);for(let k=0;k<3;k++){const f=new THREE.Mesh(S(.06),CM([0xff5f9a,0xffe14e,0xff7a3a][k]));f.position.set(x-.17+k*.17,y-.22,d/2+.1);g.add(f)}
bx(g,.05,.5,.52,tm,sx*(w/2+.03),y,0);bx(g,.06,.38,.4,GL,sx*(w/2+.04),y,0)}
bx(g,.42,1.3,.42,SM(0xb4aa9c),w*.28,y0+h+rh*.55,-d*.18);bx(g,.52,.1,.52,CM(0x6e665c),w*.28,y0+h+rh*.55+.68,-d*.18);smoke(g,w*.28,y0+h+rh*.55+.8,-d*.18);
return g}
const fc2=(x,z,tx,tz)=>Math.atan2(tx-x,tz-z);
function put(g,x,z,ry){g.position.set(x,Math.max(0,H(x,z)),z);g.rotation.y=ry||0;base.add(g);return g}
function lamp(x,z){cyl(base,.05,.07,2,6,CM(0x3a3340),x,1,z);bx(base,.26,.3,.26,GL,x,2.15,z);cyl(base,0,.2,.2,4,CM(0x3a3340),x,2.4,z)}
function barrel(x,z){cyl(base,.27,.27,.55,12,WM(0x9a6a3a),x,.28,z);for(const y of[.14,.42])cyl(base,.285,.285,.05,12,CM(0x3a3a44),x,y,z)}
function crate(x,z,s,r){bx(base,s,s,s,WM(0xc89a5a),x,s/2,z,r)}
function plaza(x,z,r){cyl(base,r,r+.1,.1,28,SM(0xe6dfcf),x,.05,z).castShadow=false}
function fire(x,z,L){for(let i=0;i<9;i++){const a=i/9*6.283,s=new THREE.Mesh(new THREE.DodecahedronGeometry(.17,0),M(0x8e8e9a));s.position.set(x+Math.cos(a)*.5,.12,z+Math.sin(a)*.5);s.castShadow=true;base.add(s)}
for(let i=0;i<3;i++){const l=cyl(base,.07,.07,.75,6,WM(0x6b3f22),x,.14,z);l.rotation.z=1.45;l.rotation.y=i*2.1}
const f1=new THREE.Mesh(Co(.28,.8,8),new THREE.MeshBasicMaterial({color:0xff7a1a})),f2=new THREE.Mesh(Co(.16,.55,8),new THREE.MeshBasicMaterial({color:0xffd34e}));f1.position.set(x,.5,z);f2.position.set(x,.45,z);base.add(f1,f2);ANI.push(t=>{f1.scale.set(1+Math.sin(t*14)*.08,.9+Math.sin(t*11+1)*.2,1);f2.scale.set(1,.9+Math.sin(t*17)*.25,1);if(L)fl.intensity=1.3+Math.sin(t*13)*.25})}
function well(x,z){cyl(base,.85,.9,.7,16,SM(0xd8d2c4),x,.35,z);cyl(base,.66,.66,.04,16,CM(0x2f9fe0),x,.62,z);for(const s of[-1,1]){bx(base,.1,1.5,.1,WM(0x6b3f22),x+s*.78,1.1,z);const p=bx(base,1.0,.07,1.3,TM(0xb6452e),x+s*.45,2.0,z);p.rotation.z=-s*.55}bx(base,.1,.1,1.3,WM(0x6b3f22),x,2.28,z);cyl(base,.04,.04,1.6,6,WM(0x6b3f22),x,1.7,z).rotation.z=Math.PI/2;cyl(base,.14,.12,.2,8,WM(0x9a6a3a),x,1.3,z)}
function stall(x,z,ry){const s=new THREE.Group();bx(s,1.8,.7,.6,WM(0xa87a4a),0,.35,0);for(const sx of[-1,1])for(const sz of[-1,1])cyl(s,.05,.05,1.9,6,WM(0x6b3f22),sx*.9,.95,sz*.5);for(let k=0;k<6;k++){const a=bx(s,.32,.06,1.25,CM(k%2?0xffffff:0xe04a3a),-.8+k*.32,1.95,.02);a.rotation.x=.2}for(let k=0;k<5;k++){const f=new THREE.Mesh(S(.1),CM(k%2?0xff4a3a:0x8fe04a));f.position.set(-.6+k*.3,.8,0);s.add(f)}s.position.set(x,0,z);s.rotation.y=ry;base.add(s)}
function flag(x,z,c){const g=new THREE.Group();cyl(g,.04,.06,3.4,6,CM(0x5a4a3a),0,1.7,0);const f=bx(g,.95,.55,.03,CM(c),.5,3.0,0);ANI.push(t=>{f.rotation.y=Math.sin(t*2.2+x)*.18});g.position.set(x,0,z);base.add(g)}
function fence(){const ex=[[223,36],[324,32],[110,18],[331,22],[145,22],[74,22],[240,22],[273,20]],ok=a=>!ex.some(e=>Math.abs((a-e[0]+540)%360-180)<e[1]),pm=WM(0x8a5a30);for(let a=0;a<360;a+=13){if(!ok(a))continue;const r=a*Math.PI/180,x=Math.cos(r)*4.85,z=Math.sin(r)*4.85;cyl(base,.05,.06,.95,6,pm,x,.47,z);if(ok(a+13)){const r2=(a+13)*Math.PI/180,x2=Math.cos(r2)*4.85,z2=Math.sin(r2)*4.85,L=Math.hypot(x2-x,z2-z),ry=-Math.atan2(z2-z,x2-x);for(const y of[.4,.72])bx(base,L,.07,.05,pm,(x+x2)/2,y,(z+z2)/2,ry)}}}
/* 0.1.17: старий табір, стоянки NPC і стежки прибрано — гравець ставить власну базу навколо Попал-центру */

let plv=1,xp=0,qi=0,qa=0,wasN=-1,qT=0,pname='Меглен',gq=1,pfO=0,menuO=1,hasSave=0,started=0,look=null,ccO=0,cf=0,cfT=0,ivO=0,selP=0;const EL=['🌿','💎','🔥','👻','⚪','🌪️','❄️','⚡','💧','☀️'];const inv={be:0,mu:0,gm:0,pie:0,axe:0,pick:0,bg:0,bb:0,br:0};const BALL=[{id:'b',n:'Світло-синя куля',s:'Світло-синя',m:1,h:0x7fd8ff,c:['#9fe4ff','#2f8fc8']},{id:'bg',n:'Зелена куля',s:'Зелена',m:1.4,h:0x5fdc7a,c:['#8cf0a2','#1f8a41']},{id:'bb',n:'Синя куля',s:'Синя',m:1.9,h:0x3f6fe8,c:['#7fa2ff','#1a2f8f']},{id:'br',n:'Червона куля',s:'Червона',m:2.6,h:0xee4a3c,c:['#ff8a7a','#96160d']}];const eq={tool:null,ball:'b'};const st={w:0,s:0,k:0,c:0};/* 0.1.11: таблиця досвіду героя: XPT[l] — скільки треба, щоб із рівня l-1 перейти на l (усього до 100 рівня — 46 638 815) */
const XPT=[0,0,100,150,225,340,500,700,950,1250,1600,2000,2500,3100,3800,4600,5500,6500,7600,8800,10100,11500,13000,14600,16300,18100,20000,22000,24100,26300,28600,31000,33500,36100,38800,41600,44500,47500,50600,53800,57100,61000,65100,69400,73900,78600,83500,88600,93900,99400,105100,112000,119200,126700,134500,142600,151000,159700,168700,178000,187600,200000,213000,226600,240800,255600,271000,287000,303600,320800,338600,365000,393000,422600,453800,486600,521000,557000,594600,633800,674600,730000,789000,851600,917800,987600,1061000,1138000,1218600,1302800,1390600,1550000,1725000,1916000,2124000,2350000,2595000,2860000,3146000,3454000,3785000];
const XPMAX=100,xpN=l=>XPT[Math.min(XPMAX,l+1)];
function pcUp(){const mx=plv>=XPMAX;$('xt').textContent=mx?'МАКС':xp+' / '+xpN(plv)+' XP';$('lv').textContent=plv;$('xf').style.width=mx?'100%':Math.min(100,xp/xpN(plv)*100)+'%';$('pv').textContent=(100+plv*125+pals.length*210).toLocaleString('uk-UA')}
function addXp(n){if(plv>=XPMAX){xp=0;hud();return}xp+=n;dmg('+'+n+' XP',pl,'#7fe3f5');let up=0;while(plv<XPMAX&&xp>=xpN(plv)){xp-=xpN(plv);plv++;up=1;res.b+=1;if(window.hpMax)HPM=hpMax();P.hp=HPM}if(plv>=XPMAX)xp=0;if(up)msg('⭐ Рівень '+plv+'! +1 світло-синя куля');hud();save()}
/* fx */
const tgR=new THREE.Mesh(new THREE.RingGeometry(.75,.95,32),new THREE.MeshBasicMaterial({color:0xff5a5a,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));tgR.rotation.x=-Math.PI/2;tgR.visible=false;sc.add(tgR);
function dmg(t,o,col){const v=new THREE.Vector3(o.position.x,o.position.y+2,o.position.z).project(cam),d=document.createElement('div');d.className='dmg';d.textContent=t;if(col)d.style.color=col;d.style.left=(v.x*.5+.5)*innerWidth+'px';d.style.top=(-v.y*.5+.5)*innerHeight+'px';document.body.appendChild(d);requestAnimationFrame(()=>{d.style.transform='translate(-50%,-70px)';d.style.opacity=0});setTimeout(()=>d.remove(),950)}
/* player */
const SK=[0xf0c9a4,0xe0ac80,0xb7835a,0x7a5235,0xf6d9c0,0x5a3a26],HC=[0x3a2a1e,0x8a5a2b,0xe8c25a,0xd93b3b,0x5b6bd6,0xf4f4f4,0x7a1f3a,0x6b3f1e],TC=[0x5b6bd6,0xd93b3b,0x4f9a4a,0xe8803a,0x8e5a3a,0x2e3658,0x2f78d0],DLOOK={g:0,hr:4,hc:0,top:0,tc:0,sk:0};
function buildHero(g,lk){while(g.children.length)g.remove(g.children[0]);const sk=SK[lk.sk],hc=HC[lk.hc],tc=TC[lk.tc],f=lk.g==1;
add(g,Cy(.09,.09,.42,8),0x3b4290,-.12,.2,0);add(g,Cy(.09,.09,.42,8),0x3b4290,.12,.2,0);
if(lk.top==0)add(g,Cy(f?.19:.24,f?.36:.3,.7,14),tc,0,.75,0);
else if(lk.top==1){add(g,Cy(f?.21:.24,.27,.7,14),tc,0,.75,0);add(g,Cy(.265,.265,.09,14),0x8e5a3a,0,.52,0);add(g,B(.05,.5,.04),0xf4d3b3,0,.82,.24)}
else{add(g,Cy(.26,.3,.7,8),0x9aa3b8,0,.75,0);add(g,B(.22,.24,.05),tc,0,.85,.27);add(g,S(.15),0x9aa3b8,-.29,1.05,0);add(g,S(.15),0x9aa3b8,.29,1.05,0)}
for(const s of[-1,1]){add(g,Cy(.055,.06,.48,6),tc,s*.3,.82,0).rotation.z=s*.12;add(g,S(.07),sk,s*.33,.55,0)}
add(g,S(.27),sk,0,1.36,0);add(g,S(.04),0x111111,-.09,1.38,.24);add(g,S(.04),0x111111,.09,1.38,.24);if(f){add(g,S(.035),0xe88a8a,-.15,1.3,.22);add(g,S(.035),0xe88a8a,.15,1.3,.22)}
if(lk.hr==4){add(g,S(.3),0x8089c8,0,1.46,-.02).scale.y=.65;add(g,Co(.07,.32,6),0xd93b3b,0,1.78,0)}
else{add(g,S(.285),hc,0,1.47,-.04).scale.y=.7;
if(lk.hr==1)add(g,B(.5,.55,.16),hc,0,1.16,-.17);
if(lk.hr==2){add(g,S(.11),hc,0,1.52,-.3);add(g,Cy(.06,.025,.38,6),hc,0,1.29,-.36)}
if(lk.hr==3){for(let i=0;i<6;i++){const a=i/6*Math.PI*2;add(g,Co(.07,.24,5),hc,Math.cos(a)*.15,1.68,Math.sin(a)*.15-.03)}}}
add(g,B(.34,.4,.2),0xa8613a,0,.85,-.28);{const tc=({axw:0xa8713f,axe:0x8a8f9e,axm:0xdfe8f2,pkw:0xa8713f,pick:0x8a8f9e,pkm:0xdfe8f2})[eq.tool]||0x9aa3b8;if(/^ax/.test(eq.tool||'')){add(g,Cy(.025,.03,.6,6),0x8e5a3a,.36,.62,.14).rotation.x=.5;add(g,B(.2,.13,.03),tc,.36,.86,.29).rotation.x=.5}if(/^p(k|ick)/.test(eq.tool||'')){add(g,Cy(.025,.03,.6,6),0x8e5a3a,-.2,.95,-.36).rotation.z=.6;add(g,B(.4,.05,.05),tc,-.33,1.18,-.36).rotation.z=.6}}outl(g)}
const pl=new THREE.Group();sc.add(pl);buildHero(pl,DLOOK);
var HPM=100;const P={x:0,z:3,hp:HPM,face:0},res={w:5,s:3,b:3};
/* world objects */
const trees=[],rocks=[],wild=[],pals=[],fx=[],bushes=[],shrooms=[];
function mkTree(){const g=new THREE.Group(),or=Math.random()<.2,cs=or?[0xff7a22,0xffa03a,0xffc84a]:[0x2fb14a,0x4fd05a,0x82ea6a];add(g,Cy(.13,.22,1.3,7),0x8e5a3a,0,.65,0);for(let i=0;i<3;i++)add(g,new THREE.IcosahedronGeometry(.95-i*.2,1),cs[i],(i%2?.12:-.1),1.5+i*.65,(i==1?.1:0));g.rotation.y=Math.random()*6;g.scale.setScalar(rn(.85,1.3));return g}
function mkRock(){const g=new THREE.Group(),m=add(g,new THREE.DodecahedronGeometry(.7,1),0xa8acd0,0,.45,0);m.scale.y=.8;m.rotation.y=Math.random()*6;return g}
const TDENS={forest:1,tundra:.8,swamp:.5,mead:.22,desert:.03,sand:.02,rock:.05,snow:.05,ash:0,lava:0,deep:0,shal:0},RDENS={rock:1,desert:.7,tundra:.6,mead:.5,forest:.35,swamp:.3,snow:.5,sand:.3,ash:.8,lava:0,deep:0,shal:0};
function spawn(list,mk,hp){let x,z,g=0;do{x=rn(-SZ,SZ);z=rn(-SZ,SZ);g++}while(Math.hypot(x,z)<3||pathD(x,z)<(list===trees?2.8:1.8)||H(x,z)<-.35||H(x,z)>7.5||(g<400&&Math.random()>(list===trees?TDENS:list===rocks?RDENS:TDENS)[BIO(x,z)]*(list===trees||list===rocks?1:1.6)));const m=mk();m.position.set(x,H(x,z),z);sc.add(m);list.push({m,hp,x,z})}
for(let i=0;i<540;i++)spawn(trees,mkTree,3);for(let i=0;i<260;i++)spawn(rocks,mkRock,3);
function mkBush(){const g=new THREE.Group();for(let i=0;i<3;i++)add(g,S(.32),[0x3fb83a,0x58d046,0x32a431][i],(i-1)*.25,.3+(i%2)*.08,(i%2)*.15);for(let i=0;i<8;i++){const a=i*.8;add(g,S(.055),0x4a5fd6,Math.cos(a)*.38,.3+Math.sin(i*1.7)*.15,Math.sin(a)*.3)}return g}
function mkShroom(){const g=new THREE.Group(),n=1+(Math.random()*3|0);for(let i=0;i<n;i++){const x=(i-1)*.16,z=(i%2)*.12,s=.8+Math.random()*.5;add(g,Cy(.04*s,.05*s,.22*s,8),0xf4ead8,x,.11*s,z);const c=add(g,S(.13*s),0xd93b3b,x,.24*s,z);c.scale.y=.55;add(g,S(.022),0xffffff,x+.05*s,.29*s,z+.05*s);add(g,S(.022),0xffffff,x-.05*s,.3*s,z-.02)}return g}
for(let i=0;i<150;i++)spawn(bushes,mkBush,2);for(let i=0;i<150;i++)spawn(shrooms,mkShroom,1);
const T=[{n:'Бамбузл',c:0x5fb04a,d:'w',hp:35,ag:0,el:'Трав’яний',sk:'Збір врожаю 3 · Бамбуковий смерч'},{n:'Грумрок',c:0x8a6a4a,d:'s',hp:45,ag:0,el:'Земля/Кристал',sk:'Видобуток 3 · Кристальна лавина'},{n:'Ігніс-Виверг',c:0x2a2630,d:'s',hp:30,ag:1,el:'Вогняний',sk:'Плавлення 4 · Плазмова павутина'},{n:'Міражбр',c:0x8a6ad6,d:'w',hp:25,ag:0,el:'Темрява/Привид',sk:'Перенесення 4 · Тіньовий двійник'},{n:'Пухоклуб',c:0xf4f4f8,d:'w',hp:30,ag:0,el:'Нормальний',sk:'Збір урожаю 2 · Хмарний відскок'},{n:'Крилоша',c:0xe8903a,d:'w',hp:22,ag:0,el:'Повітряний',sk:'Запилення 3 · Пилковий вихор'},{n:'Мороріг',c:0xa9d8ee,d:'s',hp:40,ag:0,el:'Лід',sk:'Охолодження 3 · Крижаний спалах'},{n:'Грозовик',c:0x1e1e2a,d:'s',hp:38,ag:1,el:'Електро',sk:'Генерація 4 · Грозовий стрибок'},{n:'Хвилезуб',c:0x4a78a8,d:'w',hp:34,ag:0,el:'Вода',sk:'Поливання 3 · Хвильовий укус'},{n:'Сонцеклюв',c:0xc8382a,d:'w',hp:32,ag:0,el:'Вогонь/Повітря',sk:'Розпалювання 3 · Сонячний вінець'}];
function mkPal(c){const g=new THREE.Group(),mx=(k,f)=>f(c>>16&255,k)<<16|f(c>>8&255,k)<<8|f(c&255,k),lt=mx(.55,(v,k)=>v+(255-v)*k|0),dk=mx(.7,(v,k)=>v*k|0);
add(g,S(.45),c,0,.62,0).scale.set(1,.9,1.3);add(g,S(.3),lt,0,.5,.3).scale.set(1,.9,1);
add(g,S(.36),c,0,1.0,.55);add(g,S(.14),lt,0,.93,.84).scale.z=.8;add(g,S(.05),0x222222,0,.97,.95);
for(const s of[-1,1]){add(g,Co(.13,.34,6),dk,s*.2,1.35,.5).rotation.z=-s*.25;add(g,S(.09),0xffffff,s*.15,1.05,.82);add(g,S(.05),0x111111,s*.15,1.05,.89);add(g,S(.15),dk,s*.22,.15,.4);add(g,S(.15),dk,s*.22,.15,-.35)}
add(g,S(.2),lt,0,.7,-.65);outl(g);return g}
function spawnWild(){let x,z;do{x=rn(-SZ,SZ);z=rn(-SZ,SZ)}while(Math.hypot(x-P.x,z-P.z)<9||(inv._cen&&Math.hypot(x-inv._cen[0],z-inv._cen[1])<12)||H(x,z)<-.35||H(x,z)>7.5);const ty=Math.random()*T.length|0,m=mkPal(T[ty].c);m.position.set(x,H(x,z),z);sc.add(m);wild.push({m,ty,hp:T[ty].hp,x,z,a:rn(0,6),t:0,ag:T[ty].ag,cd:0})}
const WILDN=80;for(let i=0;i<WILDN;i++)spawnWild();
/* вказівники між островами */
const SIGNS=[];window.SIGNS=SIGNS;
/* npc */
function lab(t,fs,col,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.font='bold '+fs+'px system-ui';x.textAlign='center';x.textBaseline='middle';x.lineWidth=6;x.strokeStyle='#2a1a2a';x.strokeText(t,w/2,h/2);x.fillStyle=col;x.fillText(t,w/2,h/2);const tx=new THREE.CanvasTexture(c);tx.encoding=THREE.sRGBEncoding;return tx}
const MK={'!':lab('!',90,'#ffd34e',128,128),'?':lab('?',90,'#ffd34e',128,128)};
const NPCS=[],QS=[];/* 0.1.17: NPC і квести прибрано */
function say(nm,t,bs){const d=$('dlg');d.style.display='block';$('dn').textContent=nm;const e=$('dt');e.textContent='';let i=0;clearInterval(say.iv);say.iv=setInterval(()=>{e.textContent=t.slice(0,++i);if(i>=t.length)clearInterval(say.iv)},22);const b=$('db');b.innerHTML='';bs.forEach(([l,f])=>{const x=document.createElement('button');x.textContent=l;x.onclick=()=>{if(f)f();dlgX()};b.appendChild(x)})}
function dlgX(){$('dlg').style.display='none';clearInterval(say.iv)}
function qUp(){const el=$('qt');if(el)el.style.display='none'}
/* save/load */
/* Only primitive cargo is persisted: AI targets and scene objects are rebuilt at runtime. */
function palCargo(ai){if(!ai)return null;const bag={};for(const [k,n] of Object.entries(ai.bag||{}))if(/^[a-z][a-z0-9_]*$/.test(k)&&Number.isSafeInteger(n)&&n>0)bag[k]=n;const food=typeof ai.food==='string'&&['be','mu','gm','pie'].includes(ai.food)?ai.food:null;return Object.keys(bag).length||food?{bag,food}:null}
function restorePalCargo(p,raw){if(!raw||typeof raw!=='object'||Array.isArray(raw))return;const cargo=palCargo(raw);if(cargo)p.ai={s:Object.keys(cargo.bag).length?'deliver':cargo.food?'fetch':'pick',bag:cargo.bag,food:cargo.food,t:0}}
try{const s=JSON.parse(localStorage.getItem('zi')||'null');if(s){hasSave=1;/* 0.1.28: з’являємось там, де вийшли з гри */if(Array.isArray(s.pos)&&isFinite(s.pos[0])&&isFinite(s.pos[1])){P.x=s.pos[0];P.z=s.pos[1];P.face=+s.pos[2]||0}Object.assign(res,s.res);plv=s.plv||1;xp=s.xp||0;qi=s.qi||0;pname=s.pname||pname;look=s.look||null;Object.assign(inv,s.inv||{});cf=s.cf||0;qa=s.qa||0;Object.assign(st,s.st||{});Object.assign(eq,s.eq||{});(s.pals||[]).forEach(t=>{if(Array.isArray(t)){addPal(t[0],true,t[1],t[2]>=0?t[2]:null);const p=pals[pals.length-1];if(t[3])p.wk=1;if(t[4])p.cr=t[4];restorePalCargo(p,t[5])}else addPal(t,true)})}}catch(e){}
/* 0.1.17: cs — номер слота в Попал-центрі (0…239) або null, якщо попал з гравцем (у сфері).
   0.1.21: wk — попал у бригаді центру: лише такі ходять базою й працюють, решта в сховищі відпочиває */
function addPal(ty,quiet,lv,cs){const m=mkPal(T[ty].c);const a=rn(0,6);m.position.set(Math.cos(a)*3,0,Math.sin(a)*3);sc.add(m);pals.push({m,ty,lv:lv||1,t:rn(0,6),x:m.position.x,z:m.position.z,a:0,cs:cs==null?null:cs})}
const palTeam=()=>pals.reduce((a,p,i)=>(p.cs==null&&a.push(i),a),[]);window.palTeam=palTeam;
function save(){if(window.zNoSave)return;/* вихід з акаунта: не записуємо прогрес назад до перезавантаження */try{localStorage.setItem('zi',JSON.stringify({res,plv,xp,qi,qa,st,pname,look,inv,eq,cf,t:Date.now(),pals:pals.map(p=>[p.ty,p.lv||1,p.cs==null?-1:p.cs,p.wk&&p.cs!=null?1:0,p.cr||0,palCargo(p.ai)]),pos:[+P.x.toFixed(1),+P.z.toFixed(1),+(P.face||0).toFixed(2)]}))}catch(e){}cloudPush()}setInterval(save,5000);
/* ui */
const $=id=>document.getElementById(id);let mt;
function msg(s){$('msg').textContent=s;$('msg').style.display='block';clearTimeout(mt);mt=setTimeout(()=>$('msg').style.display='none',3500)}
function hud(){$('a').textContent='🪵 '+res.w;$('b').textContent='🪨 '+res.s;$('c').textContent='🔮 '+res.b;$('d').textContent='❤️ '+Math.ceil(P.hp)+'/'+HPM;$('hpf').style.width=(Math.max(0,P.hp)/HPM*100)+'%';$('hpt').textContent='❤ '+Math.ceil(P.hp)+' / '+HPM;$('hf').style.width=(Math.max(0,P.hp)/HPM*100)+'%';$('ht').textContent='❤ '+Math.ceil(Math.max(0,P.hp))+' / '+HPM;$('e').textContent='🐾 '+palTeam().length+'/'+(window.palCap?palCap():8);pcUp();qUp();pwUp();eqUp();$('quest').textContent=''}
/* input */
let jx=0,jy=0,jid=null;const joy=$('joy'),kn=$('knob');
function jm(e){const r=joy.getBoundingClientRect(),hw2=r.width/2;let dx=e.clientX-r.left-hw2,dy=e.clientY-r.top-hw2;const l=Math.hypot(dx,dy);if(l>45){dx*=45/l;dy*=45/l}kn.style.left=45+dx+'px';kn.style.top=45+dy+'px';jx=dx/45;jy=dy/45}
joy.addEventListener('pointerdown',e=>{e.preventDefault();jid=e.pointerId;try{joy.setPointerCapture(e.pointerId)}catch(_){}jm(e)});
joy.addEventListener('pointermove',e=>{if(e.pointerId==jid)jm(e)});
const je=e=>{if(e.pointerId==jid){jid=null;jx=jy=0;kn.style.left=kn.style.top='45px'}};joy.addEventListener('pointerup',je);joy.addEventListener('pointercancel',je);joy.addEventListener('lostpointercapture',je);
let lx=null;R.domElement.addEventListener('pointerdown',e=>{
 /* fullscreen only on touch — a mouse click now captures the pointer (premium TPP/FP look) */
 if(e.pointerType==='touch')try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen({navigationUI:'hide'}).then(()=>screen.orientation.lock('landscape').catch(()=>{})).catch(()=>{})}catch(e2){}
 lx=e.clientX;ly=e.clientY;R.domElement.setPointerCapture(e.pointerId)});
R.domElement.addEventListener('pointermove',e=>{if(lx===null||(e.pointerType==='mouse'&&!document.pointerLockElement&&!e.buttons))return;
 ang-=(e.clientX-lx)*.01;pit=Math.max(.18,Math.min(1.4,pit+(e.clientY-ly)*.006));lx=e.clientX;ly=e.clientY});
const lxEnd=()=>lx=null;R.domElement.addEventListener('pointerup',lxEnd);R.domElement.addEventListener('pointercancel',lxEnd);
document.addEventListener('pointerlockchange',()=>{lx=null});
function nearest(list,max){let b=null,bd=max;for(const o of list){const d=Math.hypot(o.x-P.x,o.z-P.z);if(d<bd){bd=d;b=o}}return b}
function flash(o){o.m.scale.setScalar(1.18);setTimeout(()=>o.m.scale.setScalar(1),120)}
$('hit').onclick=()=>{
const w=nearest(wild,2.6);if(w){const pon=pals[selP]&&(!window.palOn||palOn()),em=pon&&window.elM?elM(pals[selP].ty,w.ty):1,cb=pon?(window.PW?Math.round(PW.palHit(pals[selP],w).v*.25):Math.round((4+(pals[selP].lv||1))*em)):0,hr=window.PW?PW.heroHit(w):null,hd=(hr?hr.v:10+Math.round((plv-1)*.8))+cb;w.hp-=hd;w.ag=1;flash(w);dmg(String(hd)+(em>1?' ✦':em<1?' ▽':''),w.m,em>1?'#ffd34e':undefined);if(em!=1&&window.elTip)elTip(em);addXp(window.wXp?wXp(w,3):3);msg(T[w.ty].n+(w.lv?' · рів. '+w.lv:'')+': '+Math.max(0,w.hp)+' HP');if(w.hp<=0){sc.remove(w.m);wild.splice(wild.indexOf(w),1);res[T[w.ty].d]+=2;st.k++;st[T[w.ty].d]+=2;addXp(window.wXp?wXp(w,15):15);msg(T[w.ty].n+' переможено! +2 ресурси');hud()}return}
const fb=nearest(bushes,2.2),fm=nearest(shrooms,2),fo=fb||fm;if(fo){const kk=fo===fb?'be':'mu',L2=fo===fb?bushes:shrooms,nn=kk=='be'?2:1;inv[kk]+=nn;if(kk=='be'&&window.onBerryPick)window.onBerryPick(fo);fo.hp--;flash(fo);addXp(window.gXp?gXp(2):2);dmg('+'+nn+' '+(kk=='be'?'🫐':'🍄'),fo.m,'#ffe28a');if(fo.hp<=0){sc.remove(fo.m);L2.splice(L2.indexOf(fo),1);setTimeout(()=>spawn(L2,L2==bushes?mkBush:mkShroom,kk=='be'?2:1),25000)}hud();return}
let o=nearest(trees,2.4),k='w',L=trees;const r=nearest(rocks,2.4);if(r&&(!o||Math.hypot(r.x-P.x,r.z-P.z)<Math.hypot(o.x-P.x,o.z-P.z))){o=r;k='s';L=rocks}
if(!o){msg('Поруч нічого немає. Підійдіть до дерева, скелі чи істоти.');return}
const G=gHit(k,o);if(G===-1){hud();return}flash(o);{const gx=G.y?(k=='w'?3:2):1;addXp(window.gXp?gXp(gx):gx)}dmg(G.tx.length?G.tx.join(' '):'-'+G.dm,o.m,G.tx.length?'#ffe28a':'#ffffff');if(o.hp<=0){fellB(k,o);setTimeout(()=>{addXp(window.gXp?gXp(k=='w'?8:6):(k=='w'?8:6));msg(k=='w'?'🌲 Дерево зрубано! Бонус досвіду':'🪨 Скелю розбито! Бонус досвіду')},350);sc.remove(o.m);L.splice(L.indexOf(o),1);setTimeout(()=>spawn(L,L==trees?mkTree:mkRock,3),20000)}hud()};
$('craft').onclick=()=>{if(res.w>=3&&res.s>=2){res.w-=3;res.s-=2;res.b++;addXp(window.gXp?gXp(5):5);msg('Створено кулю 🔮');hud()}else msg('Для кулі потрібно 3 🪵 і 2 🪨')};
$('throw').onclick=()=>{const w=nearest(wild,9);if(!w){msg('Немає істот поблизу');return}
if(ec(eq.ball)<1){msg(BALL.some(b=>ec(b.id)>0)?'Обрана куля закінчилась. Оберіть іншу в меню ліворуч':'Немає куль! Натисніть 🔨');return}if(palTeam().length>=(window.palCap?palCap():8)&&!(window.cenFree&&cenFree()>=0)){msg('З вами вже '+palTeam().length+' попалів, а '+(inv._cen?'Попал-центр заповнений':'Попал-центру ще немає')+'. Покладіть попалів у центр або збудуйте його');return}
const bk=eq.ball,bd=BALL.find(b=>b.id==bk)||BALL[0];addI(bk,-1);hud();const s=new THREE.Mesh(new THREE.SphereGeometry(.24,18,14),(window.plBallMat?plBallMat(bk,bd):M(bd.h)));s.position.set(P.x,1,P.z);sc.add(s);
fx.push({s,w,t:0,x0:P.x,z0:P.z,bk})};
/* loop */
let T0=0,spT=0,hurt=0,fpsA=0,fpsN=0,motionX=0,motionY=0,heroFacing=0;
function frame(ts){const tm=ts/1000,dt=Math.min(.05,tm-T0);T0=tm;if(menuO){ang+=dt*.08;jx=jy=0}fpsA+=dt;if(++fpsN==90){if(!window.plQuality&&fpsA/90>(window.gfxFps?1.35/window.gfxFps:.03)&&R.getPixelRatio()>1.25){R.setPixelRatio(1.25);rs()}fpsA=fpsN=0}
const blocked=menuO||ivO||pfO||ccO,blend=1-Math.exp(-dt*18);if(blocked){motionX=motionY=0}else{motionX+=(jx-motionX)*blend;motionY+=(jy-motionY)*blend}const f=[-Math.sin(ang),-Math.cos(ang)],rt=[Math.cos(ang),-Math.sin(ang)],mx=f[0]*-motionY+rt[0]*motionX,mz=f[1]*-motionY+rt[1]*motionX,ml=Math.hypot(mx,mz);
const swim=H(P.x,P.z)<-1.15;const ox_=P.x,oz_=P.z;if(ml>.1){const sp=5*(window.spdF?spdF():1)*(swim?.55:1)*dt;P.x=Math.max(-SZ,Math.min(SZ,P.x+mx/ml*Math.min(1,ml)*sp));P.z=Math.max(-SZ,Math.min(SZ,P.z+mz/ml*Math.min(1,ml)*sp));P.face=Math.atan2(mx,mz)}if(window.BLDC)BLDC(ox_,oz_);
{const gh=window.BLDY?BLDY(P.x,P.z,dt):H(P.x,P.z);pl.position.set(P.x,gh<-1.15?-1.25+Math.sin(tm*2.4)*.06:gh,P.z)}heroFacing+=Math.atan2(Math.sin(P.face-heroFacing),Math.cos(P.face-heroFacing))*(1-Math.exp(-dt*18));pl.rotation.y=heroFacing;
const gy=window.BLDY?Math.max(H(P.x,P.z),pl.position.y-.08):H(P.x,P.z);
/* premium TPP: зум колесом, ведення цілі за рухом героя, легкий FOV-кік на бігу */
const vNow=Math.hypot(P.x-ox_,P.z-oz_)/Math.max(dt,.001),sprinting=!!(window.plRun&&window.plRun())&&ml>.1;
const wantD=(window.plZoom?window.plZoom():CD)+(sprinting?.7:0);camD+=(wantD-camD)*(1-Math.exp(-dt*5));
const laT=Math.min(1.2,vNow*.12);LA+=(laT-LA)*(1-Math.exp(-dt*4));
const cr=camD*Math.cos(pit),cx2=P.x+Math.sin(ang)*cr,cz2=P.z+Math.cos(ang)*cr;
cam.position.set(cx2,Math.max(gy+camD*Math.sin(pit),H(cx2,cz2)+.8),cz2);
if(!window.camLookT)window.camLookT=[0,0,0];const cl=window.camLookT;
cl[0]=P.x+Math.sin(P.face||0)*LA;cl[1]=gy+1.02;cl[2]=P.z+Math.cos(P.face||0)*LA;
cam.lookAt(cl[0],cl[1],cl[2]);
const tfov=50+(sprinting?5:0);if(Math.abs(tfov-fovCur)>.02){fovCur+=(tfov-fovCur)*(1-Math.exp(-dt*6));cam.fov=fovCur;cam.updateProjectionMatrix()}
sun.position.set(P.x+14,14,P.z+6);sun.target.position.set(P.x,0,P.z);
if(inv._cen&&Math.hypot(P.x-inv._cen[0],P.z-inv._cen[1])<4&&P.hp<HPM){P.hp=Math.min(HPM,P.hp+HPM*.15*dt);hud()}
for(const w of wild){w.t-=dt;const d=Math.hypot(P.x-w.x,P.z-w.z);let sp=0;
if(w.ag&&d<8&&!menuO&&!ivO){w.a=Math.atan2(P.x-w.x,P.z-w.z);sp=2.6;w.cd-=dt;if(d<1.3&&w.cd<=0){w.cd=1;const wd=window.PW?PW.wildHit(w):(w.dm||10);P.hp-=wd;dmg('-'+wd,pl,'#ff6b6b');if(window.palDefend)palDefend(w);hud();if(P.hp<=0){if(window.plDeath)plDeath(P.x,P.z);P.hp=HPM;const C=inv._cen,S0=window.SPAWN||[0,3];P.x=C?C[0]:S0[0];P.z=C?C[1]+3:S0[1];msg(C?'Вас повалили! Ви прокинулись біля Попал-центру.':'Вас повалили! Ви прокинулись у Тихій бухті.')}}}
else{if(w.t<=0){w.t=rn(1,4);w.a=rn(0,6.3);w.stop=Math.random()<.4}sp=w.stop?0:1}
{const nx=Math.max(-SZ,Math.min(SZ,w.x+Math.sin(w.a)*sp*dt)),nz=Math.max(-SZ,Math.min(SZ,w.z+Math.cos(w.a)*sp*dt));if(H(nx,nz)<-.4||(window.colBlocked&&colBlocked(w.x,w.z,nx,nz,.5))){w.a+=Math.PI*(.6+Math.random()*.8)}else{w.x=nx;w.z=nz}}w.m.position.set(w.x,H(w.x,w.z),w.z);w.m.rotation.y=w.a}
for(const p of pals){if(p===pals[selP]){if(window.palShown&&!palShown()){p.m.visible=false;p.x=P.x;p.z=P.z;continue}const tx=P.x-Math.sin(P.face)*1.3+Math.cos(P.face)*.9,tz=P.z-Math.cos(P.face)*1.3-Math.sin(P.face)*.9,dx=tx-p.x,dz=tz-p.z,dd=Math.hypot(dx,dz),kf=Math.min(1,dt*(dd>8?6:3));{const ox=p.x,oz=p.z;p.x+=dx*kf;p.z+=dz*kf;if(window.colPal)colPal(p,ox,oz,dd)}if(dd>.25)p.a=Math.atan2(dx,dz);p.m.position.set(p.x,Math.max(-1.3,H(p.x,p.z))+(dd>.3?Math.abs(Math.sin(tm*12))*.07:0),p.z);p.m.rotation.y=p.a;continue}const C=inv._cen;if(p.cs==null||!p.wk||!C){p.m.visible=false;p.x=P.x;p.z=P.z;continue}if(!p.m.visible||Math.hypot(p.x-C[0],p.z-C[1])>40){p.m.visible=true;const a0=rn(0,6.3);p.x=C[0]+Math.cos(a0)*rn(2,5);p.z=C[1]+Math.sin(a0)*rn(2,5)}
if(window.palAI){palAI(p,dt,tm);continue}/* 0.1.22: працівник бригади сам ходить до дерев, скель і скринь (pal-ai.js) */
p.t-=dt;if(p.t<=0){p.t=rn(1,3);p.a=rn(0,6.3)}p.x+=Math.sin(p.a)*.8*dt;p.z+=Math.cos(p.a)*.8*dt;const d=Math.hypot(p.x-C[0],p.z-C[1]);if(d>7||d<1.6){p.a=Math.atan2(C[0]-p.x,C[1]-p.z)+(d<1.6?Math.PI:0)}p.m.position.set(p.x,H(p.x,p.z)+Math.abs(Math.sin(tm*5+p.x))*.08,p.z);p.m.rotation.y=p.a;
if(window.palWork)palWork(p,dt);else{p.w=(p.w||0)+dt;if(p.w>(cf>0?6:16)){p.w=0;res[T[p.ty].d]++;hud()}}}
for(let i=fx.length-1;i>=0;i--){const e=fx[i];e.t+=dt*2;const k=Math.min(1,e.t);e.s.position.set(e.x0+(e.w.x-e.x0)*k,1+Math.sin(k*Math.PI)*1.5,e.z0+(e.w.z-e.z0)*k);
if(k>=1){sc.remove(e.s);fx.splice(i,1);if(!wild.includes(e.w))continue;const bm=(BALL.find(b=>b.id==e.bk)||BALL[0]).m,ch0=(.12+.8*(1-e.w.hp/(e.w.mh||T[e.w.ty].hp)))*bm,ch=window.wCatch?wCatch(e.w,ch0):Math.min(.95,ch0);
if(Math.random()<ch){sc.remove(e.w.m);wild.splice(wild.indexOf(e.w),1);addPal(e.w.ty,0,window.wPalLv?wPalLv(e.w):Math.max(1,plv-1+(Math.random()*3|0)));const np=pals[pals.length-1];let toC=0;if(palTeam().length>(window.palCap?palCap():8)&&window.cenFree){const f=cenFree();if(f>=0){np.cs=f;toC=1}}st.c++;addXp(window.wXp?wXp(e.w,25):25);msg('🎉 '+T[e.w.ty].n+' піймано! '+(toC?'З вами вже повна команда — його відправлено в Попал-центр.':'Він з вами у сфері. Щоб працював — покладіть у Попал-центр.'));pwUp();save()}
else{e.w.ag=1;msg('Вирвалась! Ослабте істоту ⚔️ і спробуйте ще (шанс '+Math.round(ch*100)+'%)')}hud()}}
spT+=dt;if(spT>6){spT=0;if(wild.length<WILDN)spawnWild()}
water.position.y=-.5+Math.sin(tm*1.5)*.04;envUp(tm);
{const H2=((-ang*57.2958)%360+360)%360;$('cmps').style.transform='translateX('+(120-(H2+360)*2)+'px)'}cfT+=dt*pals.filter(q=>q.wk&&q.cs!=null).length*(window.coolF?coolF():1);if(cfT>30){cfT=0;if(cf>0){cf--;if(!cf)msg('🍖 Годівниця порожня: істоти працюють повільніше')}}qT+=dt;if(qT>.35){qT=0;qUp()}if(pfO||ccO||ivO){if(ivO)hp2.rotation.y=-.35;else hp2.rotation.y+=dt*.7;R2.render(sc2,cam2)}

{const tw=nearest(wild,9);if(tw){tgR.visible=true;tgR.position.set(tw.x,H(tw.x,tw.z)+.08,tw.z);tgR.scale.setScalar(1+Math.sin(tm*6)*.08)}else tgR.visible=false}
R.render(sc,cam);requestAnimationFrame(frame)}
hud();requestAnimationFrame(frame);
{const c=$('avc').getContext('2d'),gr2=c.createLinearGradient(0,0,0,64);gr2.addColorStop(0,'#3e6a52');gr2.addColorStop(1,'#1d3a30');c.fillStyle=gr2;c.fillRect(0,0,64,64);c.fillStyle='#5b6bd6';c.fillRect(12,54,40,12);c.fillStyle='#f0c9a4';c.beginPath();c.arc(32,38,16,0,7);c.fill();c.fillStyle='#8089c8';c.beginPath();c.arc(32,32,19,Math.PI,0);c.fill();c.fillRect(13,31,38,5);c.fillStyle='#d93b3b';c.beginPath();c.moveTo(28,14);c.lineTo(32,3);c.lineTo(36,14);c.fill();c.fillStyle='#2a1a2a';c.beginPath();c.arc(26,41,2.5,0,7);c.arc(38,41,2.5,0,7);c.fill()}
$('nm').textContent=pname;
const R2=new THREE.WebGLRenderer({antialias:true,alpha:true});R2.outputEncoding=THREE.sRGBEncoding;R2.toneMapping=THREE.ACESFilmicToneMapping;R2.setPixelRatio(Math.min(devicePixelRatio,2));R2.setSize(200,250);
const sc2=new THREE.Scene();sc2.add(new THREE.HemisphereLight(0xdfe8ff,0x7a7fb0,.9));const l2=new THREE.DirectionalLight(0xffe0aa,1.2);l2.position.set(2,3,4);sc2.add(l2);
const cam2=new THREE.PerspectiveCamera(35,200/250,.1,20);cam2.position.set(0,1.4,4.2);cam2.lookAt(0,1.05,0);
const hp2=new THREE.Group();sc2.add(hp2);add(sc2,Cy(.7,.75,.1,24),0x2e3658,0,-.05,0);
$('av').onclick=()=>{pfO=1;$('pf').style.display='grid';pfTab('p')};
$('pfx').onclick=()=>{pfO=0;$('pf').style.display='none'};
document.querySelectorAll('#pfs button').forEach(b=>b.onclick=()=>pfTab(b.dataset.t));
function pfTab(t){document.querySelectorAll('#pfs button').forEach(b=>b.classList.toggle('on',b.dataset.t==t));const c=$('pfc');
if(t=='p'){const bd=[['🪓','Лісоруб','50 деревини',st.w>=50],['⛏️','Каменяр','40 каменю',st.s>=40],['🏹','Мисливець','10 перемог',st.k>=10],['🔮','Ловець','5 істот',st.c>=5],['⭐','Ветеран','10 рівень',plv>=10]];
const pc=T.map((ty,i)=>{const n=pals.filter(p=>p.ty==i).length;return n?`<div class='pp'><i style='background:#${ty.c.toString(16).padStart(6,'0')}'></i>${ty.n} ×${n}</div>`:''}).join('')||'<small>Поки немає. Ловіть істот 🔮</small>';
c.innerHTML=`<div class='pcol'><div id='pv3'></div></div><div class='pcol'><div class='pnm'><input id='pni' maxlength='16'><button id='pns'>✎</button></div><div class='ppw'>Сила акаунта: <b>${(100+plv*125+pals.length*210).toLocaleString('uk-UA')}</b></div><div class='pst'>⭐ Рівень <b>${plv}</b> · XP ${xp}/${xpN(plv)}<br>❤️ Здоровʼя ${Math.ceil(P.hp)}/${HPM}<br>🐾 Попалів: ${pals.length} · у Попал-центрі: ${pals.length-palTeam().length}<br>🪵 ${st.w} · 🪨 ${st.s} · ⚔️ ${st.k} · 🔮 ${st.c}</div></div><div class='pcol'><h4>Досягнення</h4><div class='pbd'>${bd.map(([e,n,d,ok])=>`<div class='bd${ok?' ok':''}'><span>${e}</span><small>${n}<br>${d}</small></div>`).join('')}</div><h4>Мої істоти</h4><div class='ppl'>${pc}</div></div>`;
$('pv3').appendChild(R2.domElement);$('pni').value=pname;$('pns').onclick=()=>{pname=$('pni').value.trim()||'Меглен';$('nm').textContent=pname;save();msg('✎ Імʼя змінено')};return}
if(t=='o'){c.innerHTML=`<div class='pcol'><h4>Графіка</h4><button class='ob' id='gqb'>Якість: ${gq?'Висока':'Низька'}</button></div>`;
$('gqb').onclick=()=>{gq=gq?0:1;sun.castShadow=!!gq;gm.visible=!!gq;pfTab('o')};
return}
c.innerHTML=`<div class='pcol'><h4>Як грати</h4><div class='pst'>🎮 Рухайтеся клавішами WASD або стрілками; на телефоні — джойстиком. Натискайте дію біля дерев і каменів.<br>🪵 Зберіть деревину, зробіть палиці, сокиру й кирку в меню крафту.<br>🔮 Послабте дику істоту ударом, потім киньте кулю, щоб її зловити.<br>🏠 Для Попал-центру потрібно 20 деревини й 15 каменю. Поставте скриню та додайте двох істот до бригади.<br>🍖 Кладіть їжу в годівницю біля центру, щоб працівники не голодували.<br>💾 Гра зберігається автоматично на цьому пристрої. Можна грати гостем; вхід в акаунт відкриває хмарне збереження.</div></div><div id='pfv'>Версія Beta 0.2.2</div>`}
document.addEventListener('gesturestart',e=>e.preventDefault());
if(/iPhone|iPad/.test(navigator.userAgent)&&!navigator.standalone)setTimeout(()=>msg('📲 Повний екран на iPhone: Поділитись → «На початковий екран»'),4500);
function mmShow(){menuO=1;dlgX();$('mm').style.display='flex';$('mc').textContent=look?'▶ Продовжити':'▶ Почати гру'}
function mmHide(){menuO=0;started=1;$('mm').style.display='none'}
function startFlow(e){e?.preventDefault();if(!look)ccShow();else mmHide()}
$('mc').addEventListener('click',startFlow);
$('ms').onclick=()=>{pfO=1;$('pf').style.display='grid';pfTab('o')};
$('mi').onclick=()=>{pfO=1;$('pf').style.display='grid';pfTab('i')};
$('mbt').onclick=mmShow;
{const sp=$('sp');let ok=0,closed=0;const closeSplash=()=>{if(!ok||closed)return;closed=1;try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{})}catch(e){}sp.classList.add('out');setTimeout(()=>sp.remove(),650)};setTimeout(()=>{ok=1;$('spk').classList.add('rd');setTimeout(closeSplash,900)},1700);sp.onclick=closeSplash}
/* cloud */
var FB_OK=!!window.firebase&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'),fbU=null,fbDb=null,fbLast=0,startPending=0;
function fbErr(e){const m={'auth/invalid-email':'Неправильна адреса пошти','auth/missing-password':'Введіть пароль','auth/weak-password':'Пароль має бути щонайменше 6 символів','auth/email-already-in-use':'Ця пошта вже зареєстрована. Натисніть «Увійти»','auth/invalid-credential':'Неправильна пошта або пароль','auth/wrong-password':'Неправильна пошта або пароль','auth/user-not-found':'Акаунт не знайдено. Натисніть «Зареєструватися»','auth/popup-closed-by-user':'Вхід скасовано','auth/unauthorized-domain':'Цей домен не додано в Firebase (Authorized domains)','auth/operation-not-allowed':'Цей спосіб входу не увімкнено в Firebase','auth/network-request-failed':'Немає зʼєднання з інтернетом','permission-denied':'Немає доступу до бази: перевірте Rules у Firestore'};return m[e.code]||('Помилка: '+(e.code||e.message))}
var cloudReady=0,cloudBlock=0;window.zsc=o=>o?((o.plv||1)*1e6+(o.qi||0)*1e4+(o.pals?o.pals.length:0)*100+Math.min(99,(o.xp||0))):0;
function cloudPush(f,force){if(!fbU||!fbDb||!cloudReady||cloudBlock)return Promise.resolve();const n=Date.now();if(!f&&n-fbLast<20000)return Promise.resolve();fbLast=n;let s=null,loc=null;try{s=localStorage.getItem('zi');loc=JSON.parse(s)}catch(e){}if(!s||!loc)return Promise.resolve();
const ref=fbDb.collection('players').doc(fbU.uid),ls=zsc(loc);let behind=null;
return fbDb.runTransaction(async tx=>{behind=null;const d=await tx.get(ref),cur=d.exists?d.data():null;let cd=null;try{cd=cur&&cur.data?JSON.parse(cur.data):null}catch(e){}
const cs=zsc(cd),bs=Math.max(cur&&cur.bestScore||0,cs);
if(!force&&cd&&((cd.plv||1)>(loc.plv||1)||((cd.plv||1)==(loc.plv||1)&&(cd.qi||0)>(loc.qi||0)))){behind=cur.data;return}
const up={data:s,t:n,name:pname,score:ls,pid:window.myPid||null,reset:!!force};if(ls>=bs){up.best=s;up.bestScore=ls;up.bestT=n}else if(cur&&!cur.best&&cd){up.best=cur.data;up.bestScore=cs;up.bestT=cur.t||n}tx.set(ref,up,{merge:true})})
.then(()=>{if(behind){cloudBlock=1;msg('☁️ В акаунті є більше прогресу з іншого пристрою — завантажую його');window.zNoSave=1;try{localStorage.setItem('zi',behind)}catch(e){}setTimeout(()=>location.reload(),1800)}}).catch(e=>console.warn('cloud',e))}
function googleAuth(){if(!window.firebase||!firebase.auth){startPending=0;msg('🔐 Firebase Auth ще не завантажився');return}const p=new firebase.auth.GoogleAuthProvider();firebase.auth().signInWithPopup(p).catch(e=>{if(e.code=='auth/popup-blocked'||e.code=='auth/operation-not-supported-in-this-environment')firebase.auth().signInWithRedirect(p);else{startPending=0;msg(fbErr(e))}})}
function accUI(){ccAcc();const a=$('acc');if(!a)return;if(!FB_OK){a.innerHTML=`<small>☁️ Акаунти й хмарні збереження працюють на popalgame.pl</small>`;return}
if(fbU){a.innerHTML=`<small>☁️ ${fbU.email||'Акаунт'}: прогрес зберігається в хмарі</small><button id='alo'>Вийти з акаунта</button>`;$('alo').onclick=()=>{save();cloudPush(true).finally(()=>firebase.auth().signOut().then(()=>{window.zNoSave=1;try{localStorage.removeItem('zi');localStorage.removeItem('zi_uid')}catch(e){}location.reload()}))}}
else{a.innerHTML=`<small>Гість: прогрес лише на цьому пристрої</small><div class='row'><button id='ag'>Увійти через Google</button><button id='ae'>Увійти через пошту</button></div>`;
	$('ag').onclick=googleAuth;
$('ae').onclick=()=>{$('emr').textContent='';$('em').style.display='flex'}}}
if(FB_OK){firebase.initializeApp({apiKey:'AIzaSyDSgadzJVuuCZB4qzXuqx1RXLkP4M8JBoQ',authDomain:'popal-4da6b.firebaseapp.com',projectId:'popal-4da6b',storageBucket:'popal-4da6b.firebasestorage.app',messagingSenderId:'579761049389',appId:'1:579761049389:web:24f36059be545e2a65cda4'});fbDb=firebase.firestore();
const au=firebase.auth(),em=$('em'),er=$('emr'),ev=()=>[$('eme').value.trim(),$('emp').value];
$('eml').onclick=()=>{const[a,b]=ev();au.signInWithEmailAndPassword(a,b).then(()=>em.style.display='none').catch(e=>er.textContent=fbErr(e))};
$('ems').onclick=()=>{const[a,b]=ev();au.createUserWithEmailAndPassword(a,b).then(()=>{em.style.display='none';msg('✅ Акаунт створено')}).catch(e=>er.textContent=fbErr(e))};
$('emf').onclick=()=>{const[a]=ev();if(!a){er.textContent='Введіть пошту';return}au.sendPasswordResetEmail(a).then(()=>er.textContent='Лист для скидання пароля надіслано').catch(e=>er.textContent=fbErr(e))};
au.onAuthStateChanged(async u=>{fbU=u;cloudReady=0;accUI();if(u&&$('mm').style.display=='flex')$('mc').style.display='block';if(!u)return;try{
if(localStorage.getItem('zi_new')){localStorage.removeItem('zi_new');localStorage.setItem('zi_uid',u.uid);cloudReady=1;save();cloudPush(true,true);return}
const d=await fbDb.collection('players').doc(u.uid).get();let loc=null;try{loc=JSON.parse(localStorage.getItem('zi')||'null')}catch(e){}const own=localStorage.getItem('zi_uid')===u.uid;
/* сейв на пристрої належить іншому акаунту (сесія того акаунта закінчилась без «Вийти») — у цей акаунт його не переносимо */
if(loc&&localStorage.getItem('zi_uid')&&!own){window.zNoSave=1;cloudBlock=1;let raw=null;if(d.exists){const dd=d.data();raw=dd.data;try{const bc=dd.best?JSON.parse(dd.best):null,c0=JSON.parse(raw);if(bc&&!dd.reset&&zsc(bc)>zsc(c0))raw=dd.best}catch(e){}}try{localStorage.removeItem('zi');if(raw)localStorage.setItem('zi',raw);localStorage.setItem('zi_uid',u.uid)}catch(e){}msg('☁️ На пристрої був прогрес іншого акаунта — завантажую ваш');setTimeout(()=>location.reload(),1200);return}
if(d.exists){const dd=d.data();let raw=dd.data,c=null;try{c=JSON.parse(raw)}catch(e){}let bc=null;try{bc=dd.best?JSON.parse(dd.best):null}catch(e){}if(bc&&!dd.reset&&zsc(bc)>zsc(c)){raw=dd.best;c=bc}const sc=zsc,cs=sc(c),ls=sc(loc);const useCloud=!loc||cs>ls||(cs==ls&&(c.t||0)>(loc.t||0)+2000)||(own&&ls==cs&&(c.t||0)>(loc.t||0));if(useCloud&&raw!==localStorage.getItem('zi')){window.zNoSave=1;/* до перезавантаження не записуємо старий стан поверх завантаженого */localStorage.setItem('zi',raw);localStorage.setItem('zi_uid',u.uid);location.reload();return}if(!useCloud&&ls>cs)msg('☁️ На цьому пристрої більше прогресу — зберігаю його в хмару')}
cloudReady=1;localStorage.setItem('zi_uid',u.uid);if(!d.exists&&pname=='Меглен'&&u.displayName){pname=u.displayName.split(' ')[0].slice(0,16);$('nm').textContent=pname}save();cloudPush(true);msg('☁️ Прогрес синхронізовано')}catch(e){msg('☁️ '+fbErr(e))}if(startPending){startPending=0;setTimeout(()=>{if(!look)ccShow();else mmHide()},0)}})}
$('emx').onclick=()=>$('em').style.display='none';
document.addEventListener('visibilitychange',()=>{if(document.hidden){save();cloudPush(true)}});
accUI();
/* creator */
function drawAv(){const lk=look||DLOOK,c=$('avc').getContext('2d'),h=v=>'#'+(v==null?0x888888:v).toString(16).padStart(6,'0'),g2=c.createLinearGradient(0,0,0,64);g2.addColorStop(0,'#3e6a52');g2.addColorStop(1,'#1d3a30');c.fillStyle=g2;c.fillRect(0,0,64,64);c.fillStyle=h(TC[lk.tc]);c.fillRect(12,54,40,12);
if(lk.hr==1){c.fillStyle=h(HC[lk.hc]);c.fillRect(13,28,38,30)}
c.fillStyle=h(SK[lk.sk]);c.beginPath();c.arc(32,38,16,0,7);c.fill();
c.fillStyle=lk.hr==4?'#8089c8':h(HC[lk.hc]);c.beginPath();c.arc(32,32,lk.hr==4?19:17,Math.PI,0);c.fill();if(lk.hr==4){c.fillRect(13,31,38,5);c.fillStyle='#d93b3b';c.beginPath();c.moveTo(28,14);c.lineTo(32,3);c.lineTo(36,14);c.fill()}
if(lk.hr==3){c.fillStyle=h(HC[lk.hc]);for(let i=0;i<5;i++){c.beginPath();c.moveTo(18+i*7,20);c.lineTo(21+i*7,8);c.lineTo(24+i*7,20);c.fill()}}
if(lk.hr==2){c.fillStyle=h(HC[lk.hc]);c.beginPath();c.arc(48,22,6,0,7);c.fill()}
c.fillStyle='#2a1a2a';c.beginPath();c.arc(26,41,2.5,0,7);c.arc(38,41,2.5,0,7);c.fill()}
function ccRow(lbl,k,opts,col){return `<div class='ccr'><span>${lbl}</span><div class='cco' data-k='${k}'>${opts.map((o,i)=>col?`<button data-v='${i}' class='csw' style='background:#${o.toString(16).padStart(6,'0')}'></button>`:`<button data-v='${i}'>${o}</button>`).join('')}</div></div>`}
function ccSel(){document.querySelectorAll('#ccp .cco').forEach(r=>r.querySelectorAll('button').forEach(b=>b.classList.toggle('on',+b.dataset.v===look[r.dataset.k])))}
function ccAcc(){const c=$('cca');if(!c)return;if(!FB_OK){c.textContent='💾 Гість: прогрес зберігається на цьому пристрої';return}if(fbU){c.textContent='☁️ '+(fbU.email||'Акаунт')+': прогрес у хмарі';return}
c.innerHTML=`Грайте як гість — прогрес збережеться на цьому пристрої. Для хмарного збереження увійдіть:<br><button id='cag'>Google</button><button id='cae'>Пошта</button>`;$('cag').onclick=()=>{if($('ag'))$('ag').onclick()};$('cae').onclick=()=>{if($('ae'))$('ae').onclick()}}
function ccShow(){menuO=1;ccO=1;dlgX();$('mm').style.display='none';const first=!look;if(!look)look=Object.assign({},DLOOK);
	const p=$('ccp');p.innerHTML=`<h2>${first?'Створення героя':'Зовнішність героя'}</h2><div class='ccr'><span>Імʼя</span><input id='ccn' maxlength='16' placeholder='Введіть імʼя героя'></div>`+ccRow('Стать','g',['Чоловіча','Жіноча'])+ccRow('Зачіска','hr',['Коротка','Довга','Хвостик','Їжак','Шолом'])+ccRow('Колір волосся','hc',HC,1)+ccRow('Одяг','top',['Туніка','Куртка','Броня'])+ccRow('Колір одягу','tc',TC,1)+ccRow('Шкіра','sk',SK,1)+`<div id='cca'></div><button id='ccgo'>${first?'▶ Почати пригоду':'✔ Зберегти й грати'}</button>`;
		$('ccn').value=first?'':pname;$('ccv').appendChild(R2.domElement);buildHero(hp2,look);ccSel();ccAcc();$('cc').style.display='grid';
	$('ccgo').onclick=()=>{const entered=$('ccn').value.trim();if(!entered){msg('✍️ Введіть імʼя героя');$('ccn').focus();return}pname=entered;$('nm').textContent=pname;buildHero(pl,look);drawAv();$('cc').style.display='none';ccO=0;save();msg(fbU?'☁️ Прогрес героя збережено':'💾 Прогрес героя збережено на цьому пристрої');mmHide()}}
$('ccp').addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(!b||!b.parentNode.dataset.k)return;const k=b.parentNode.dataset.k;look[k]=+b.dataset.v;if(k=='g')look.hr=look.g?1:0;ccSel();buildHero(hp2,look)});
if($('mh'))$('mh').onclick=ccShow;
try{buildHero(pl,look||DLOOK);buildHero(hp2,look||DLOOK);drawAv()}catch(e){console.warn('hero',e)}mmShow();
{const L={0:'Пн',45:'ПнСх',90:'Сх',135:'ПдСх',180:'Пд',225:'ПдЗх',270:'Зх',315:'ПнЗх'};let h='';for(let d=-360;d<=720;d+=15){const v=((d%360)+360)%360;h+=`<span style='left:${(d+360)*2}px' class='${L[v]?'cl':'ct'}'>${L[v]||'|'}</span>`}$('cmps').innerHTML=h}
/* inventory & craft */
const IT={w:['🪵','Деревина'],s:['🪨','Камінь'],b:['🔮','Кулі'],be:['🫐','Ягоди'],mu:['🍄','Гриби'],gm:['🍢','Смажені гриби'],pie:['🥧','Ягідний пиріг'],axe:['🪓','Сокира'],pick:['⛏️','Кирка']},FOOD={be:2,mu:2,gm:6,pie:12};
const RC=[{id:'b',n:'Світло-синя куля',c:{w:3,s:2},d:'Звичайна куля для ловлі істот'},{id:'axe',n:'Сокира',c:{w:5,s:3},d:'Удвічі більше деревини, коли в руках',one:1},{id:'pick',n:'Кирка',c:{w:4,s:5},d:'Удвічі більше каменю, коли в руках',one:1},{id:'gm',n:'Смажені гриби',c:{mu:2,w:1},d:'Їжа для істот: +6 ситості'},{id:'pie',n:'Ягідний пиріг',c:{be:3,mu:1,w:1},d:'Ситна їжа: +12 ситості'}];
const cnt=k=>k in res?res[k]:inv[k],addI=(k,n)=>{if(k in res)res[k]+=n;else inv[k]+=n};let ivTab='i';
function ivOpen(t){ivO=1;ivTab=t;$('iv').style.display='flex';ivR()}
function ivR(){document.querySelectorAll('#ivh [data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t==ivTab));const c=$('ivc');
if(ivTab=='i'){const ks=Object.keys(IT).filter(k=>cnt(k)>0);c.innerHTML=`<div class='ivn'>🍖 Годівниця Попал-центру: <b>${cf}</b>. Поки в ній є їжа, попали в центрі працюють утричі швидше.</div><div class='ivg'>${ks.map(k=>`<div class='ivs'><span>${IT[k][0]}</span><b>${cnt(k)}</b><small>${IT[k][1]}</small>${FOOD[k]?`<button data-f='${k}'>Нагодувати +${FOOD[k]}</button>`:''}</div>`).join('')||'<small>Рюкзак порожній. Збирайте ресурси кнопкою ⚔️</small>'}</div>`}
else c.innerHTML=RC.map((r,i)=>{const ok=Object.entries(r.c).every(([k,n])=>cnt(k)>=n),own=r.one&&cnt(r.id)>0;return `<div class='rc'><span class='ri'>${IT[r.id][0]}</span><div class='rt'><b>${r.n}</b><small>${r.d}</small><div class='rcost'>${Object.entries(r.c).map(([k,n])=>`<i class='${cnt(k)>=n?'':'no'}'>${IT[k][0]} ${cnt(k)}/${n}</i>`).join('')}</div></div><button data-r='${i}' ${ok&&!own?'':'disabled'}>${own?'✔ Є':'Створити'}</button></div>`}).join('')}
$('ivc').addEventListener('click',e=>{const f=e.target.closest('[data-f]'),r=e.target.closest('[data-r]');
if(f){const k=f.dataset.f;if(!inv._cen||Math.hypot(P.x-inv._cen[0],P.z-inv._cen[1])>8){msg('🏠 Годувати попалів можна лише біля Попал-центру');return}if(inv[k]>0){inv[k]--;cf+=FOOD[k];msg('🍖 Істоти нагодовані! Годівниця: '+cf);save();ivR()}}
if(r&&!r.disabled){const R=RC[+r.dataset.r];for(const[k,n]of Object.entries(R.c))addI(k,-n);addI(R.id,R.q||1);if(window.TT&&TT[R.id]){const c=TT[eq.tool];if(!c||(c.k==TT[R.id].k&&c.t<TT[R.id].t))eq.tool=R.id;buildHero(pl,look||DLOOK);try{eqUp()}catch(_){}}msg('🔨 Створено: '+R.n);addXp(window.gXp?gXp(5):5);ivR()}});
document.querySelectorAll('#ivh [data-t]').forEach(b=>b.onclick=()=>{ivTab=b.dataset.t;ivR()});
$('ivx').onclick=()=>{ivO=0;$('iv').style.display='none'};$('bag').onclick=()=>ivOpen('i');$('craft').onclick=()=>ivOpen('c');

/* equip panel */
function ec(k){return k in res?res[k]:inv[k]}
function ballHtml(b,sz){return `<i class='bl' style='background:radial-gradient(circle at 35% 30%,#fff 0,${b.c[0]} 22%,${b.c[1]} 100%);${sz?'width:'+sz+'px;height:'+sz+'px':''}'></i>`}
BALL.forEach(b=>{IT[b.id]=[ballHtml(b),b.n]});
var TOOLS=[{id:null,i:'✋',n:'Руки',d:'без бонусу'},{id:'axe',i:'🪓',n:'Сокира',d:'🪵 ×2'},{id:'pick',i:'⛏️',n:'Кирка',d:'🪨 ×2'}];
let eqK=null;
function tx(id,v){const e=$(id);if(e.textContent!=v)e.textContent=v}
function eqUp(){if(!TOOLS)return;const b=BALL.find(x=>x.id==eq.ball)||BALL[0],n=ec(b.id),t=TOOLS.find(x=>x.id==eq.tool)||TOOLS[0];if(eqUp.bk!=b.id){eqUp.bk=b.id;$('eqbi').innerHTML=ballHtml(b,34)}tx('eqbn',b.s);tx('eqbc','×'+n);$('eqbc').style.opacity=n>0?1:.45;if(eqUp.tk!=t.i){eqUp.tk=t.i;$('eqti').innerHTML=t.i}tx('eqtn',t.n);tx('eqtc',t.d)}
function eqClose(){eqK=null;$('eqm').style.display='none'}
function eqOpen(k,btn){const m=$('eqm');if(eqK==k){eqClose();return}eqK=k;let h='';
if(k=='b'){let any=0;BALL.forEach(b=>{const n=ec(b.id);if(n>0||b.id==eq.ball){if(n>0)any=1;h+=`<button class='eqo${b.id==eq.ball?' on':''}' data-b='${b.id}'><div class='eqi'>${ballHtml(b,30)}</div><small>${b.s}</small><small>×${n} · шанс ×${b.m}</small></button>`}});if(!any)h+=`<small class='eqh'>Куль немає. Створіть у 🔨 Крафт</small>`}
else{h=TOOLS.filter(t=>!t.id||inv[t.id]>0).map(t=>`<button class='eqo${t.id==eq.tool?' on':''}' data-t='${t.id||''}'><div class='eqi'>${t.i}</div><small>${t.n}</small><small>${t.d}</small></button>`).join('');if(!inv.axe&&!inv.pick)h+=`<small class='eqh'>Сокиру й кирку можна створити в 🔨 Крафт</small>`}
m.innerHTML=h;m.style.display='flex';const r=btn.getBoundingClientRect();m.style.left=Math.max(4,Math.min(r.left,innerWidth-m.offsetWidth-4))+'px';m.style.bottom=(innerHeight-r.top+6)+'px'}
$('eqb').onclick=e=>eqOpen('b',e.currentTarget);$('eqt').onclick=e=>eqOpen('t',e.currentTarget);
$('eqm').addEventListener('click',e=>{const o=e.target.closest('.eqo');if(!o)return;if(o.dataset.b){eq.ball=o.dataset.b;const b=BALL.find(x=>x.id==eq.ball);msg('Куля: '+b.s+' (шанс ×'+b.m+')')}else if('t' in o.dataset){const t=o.dataset.t||null;if(t!==eq.tool){eq.tool=t;buildHero(pl,look||DLOOK)}msg('В руках: '+(TOOLS.find(x=>x.id==t)||TOOLS[0]).n)}eqClose();eqUp();save()});
document.addEventListener('pointerdown',e=>{if(eqK&&!e.target.closest('#eqm,#eqp'))eqClose()},true);
if(!(eq.tool&&inv[eq.tool]>0))eq.tool=inv.axe>0?'axe':inv.pick>0?'pick':null;if(!BALL.some(b=>b.id==eq.ball))eq.ball='b';buildHero(hp2,look||DLOOK);eqUp();
buildHero(pl,look||DLOOK);
/* pal widget */
function drawCrit(cv,c){const x=cv.getContext('2d'),W=cv.width;x.clearRect(0,0,W,W);if(c==null)return;x.save();x.scale(W/120,W/120);x.translate(2,14);x.fillStyle='#'+c.toString(16).padStart(6,'0');x.beginPath();x.ellipse(54,58,34,24,0,0,7);x.fill();x.beginPath();x.arc(80,40,22,0,7);x.fill();x.beginPath();x.moveTo(68,24);x.lineTo(74,2);x.lineTo(82,20);x.closePath();x.fill();x.beginPath();x.moveTo(86,20);x.lineTo(98,4);x.lineTo(98,28);x.closePath();x.fill();x.beginPath();x.arc(20,50,10,0,7);x.fill();x.fillStyle='rgba(255,255,255,.45)';x.beginPath();x.ellipse(50,64,18,12,0,0,7);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(74,40,6,0,7);x.fill();x.beginPath();x.arc(88,40,6,0,7);x.fill();x.fillStyle='#1d2433';x.beginPath();x.arc(75,41,3.2,0,7);x.fill();x.beginPath();x.arc(89,41,3.2,0,7);x.fill();x.restore()}
function pwUp(){const tm=palTeam(),n=tm.length;let k=tm.indexOf(selP);if(n&&k<0){k=0;selP=tm[0]}if(!n)selP=-1;const at=j=>pals[tm[((j%n)+n)%n]];
if(!n){drawCrit($('pwm'),null);drawCrit($('pwa'),null);drawCrit($('pwb'),null);$('pwn').textContent=pals.length?'Усі попали в Попал-центрі':'Немає істот: зловіть 🔮';$('pwhf').style.width='0';$('pwl').style.visibility=$('pwr').style.visibility='hidden';return}
const p=at(k);drawCrit($('pwm'),T[p.ty].c);drawCrit($('pwa'),n>2?T[at(k-1).ty].c:null);drawCrit($('pwb'),n>1?T[at(k+1).ty].c:null);
$('pwn').textContent=EL[p.ty]+' ['+(p.lv||1)+'] '+T[p.ty].n;$('pwhf').style.width='100%';$('pwl').style.visibility=$('pwr').style.visibility=n>1?'visible':'hidden'}
function pwSw(d){const tm=palTeam(),n=tm.length;if(n<2)return;let k=tm.indexOf(selP);if(k<0)k=0;selP=tm[(k+d+n)%n];pwUp();msg('🐾 З вами тепер: '+T[pals[selP].ty].n+' (допомагає в бою)')}
$('pwl').onclick=()=>pwSw(-1);$('pwr').onclick=()=>pwSw(1);pwUp();
/* species models */
var EM=['🐼','🦔','🕷️','🦎','🐑','🦋','🦌','🐺','🦈','🐦'];
function mats(){if(!window._MT)window._MT={GLOW:new THREE.MeshStandardMaterial({color:0xff8a3a,emissive:0xff5a10,emissiveIntensity:1.3}),GHO:new THREE.MeshStandardMaterial({color:0x8a6ad6,emissive:0x2a1a5a,roughness:.35,metalness:.25,transparent:true,opacity:.9}),CRY:new THREE.MeshStandardMaterial({color:0x7fe3f5,emissive:0x1a6a80,emissiveIntensity:.6,roughness:.2,metalness:.1})};return window._MT}
function addM(g,geo,mt,x,y,z){const m=new THREE.Mesh(geo,mt);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m}
function eyes(g,x,y,z,r){for(const s of[-1,1]){add(g,S(r),0xffffff,s*x,y,z);add(g,S(r*.55),0x1d2433,s*x,y,z+r*.6)}}
function drawCrit(cv,c){const x=cv.getContext('2d'),W=cv.width;x.clearRect(0,0,W,W);if(c==null)return;const ty=T.findIndex(t=>t.c===c);x.fillStyle='#'+c.toString(16).padStart(6,'0');x.globalAlpha=.4;x.beginPath();x.arc(W/2,W/2,W/2,0,7);x.fill();x.globalAlpha=1;x.font=(W*.6)+'px serif';x.textAlign='center';x.textBaseline='middle';x.fillText((EM&&EM[ty])||'🐾',W/2,W*.54)}
function mkPal(c){const ty=T.findIndex(t=>t.c===c),g=new THREE.Group(),MT=mats();
if(ty==0){const G=0x5fb04a,L=0xe6f2d0,D=0x2f6a2a;add(g,S(.42),G,0,.6,0).scale.set(1,1.1,.9);add(g,S(.3),L,0,.55,.18).scale.set(1,1.1,.6);
for(const s of[-1,1]){add(g,Cy(.12,.13,.32,8),D,s*.2,.16,0);add(g,Cy(.09,.1,.42,8),D,s*.42,.75,.05).rotation.z=s*.6;add(g,S(.11),D,s*.24,1.45,-.02);add(g,S(.085),D,s*.12,1.2,.25).scale.set(1,1.3,.6)}
add(g,S(.32),G,0,1.15,0);add(g,S(.14),L,0,1.07,.26).scale.set(1.2,.8,.8);add(g,S(.04),0x1d2433,0,1.12,.38);for(const s of[-1,1]){add(g,S(.035),0xffffff,s*.12,1.21,.3);add(g,S(.02),0x111111,s*.12,1.21,.33)}
const sa=Math.sin(.7),ca=Math.cos(.7);add(g,Cy(.035,.035,1.4,8),0x8fc44a,.45,1,-.1).rotation.z=-.7;for(let i=0;i<4;i++)add(g,Cy(.043,.043,.03,8),0x6f9a3a,.45+(i-1.5)*.3*sa,1+(i-1.5)*.3*ca,-.1).rotation.z=-.7;for(let i=0;i<3;i++)add(g,Co(.05,.28,4),0x6fbf4a,.45+.62*sa+(i-1)*.06,1+.62*ca+.08,-.1).rotation.z=-1.2+i*.5}
else if(ty==1){const B1=0x8a6a4a,B2=0x5a4632;add(g,S(.45),B1,0,.5,0).scale.set(1.1,.8,1.4);for(let i=0;i<4;i++)add(g,S(.3),B2,0,.72-i*.03,.35-i*.28).scale.set(1.05,.45,.5);
for(let i=0;i<6;i++){const cr=addM(g,Co(.07+(i%2)*.03,.3+(i%3)*.1,5),MT.CRY,(i%2?.12:-.12)+(i%3-1)*.05,.92,.3-i*.13);cr.rotation.set(-.3,i,i%2?-.35:.35)}
add(g,S(.26),B1,0,.48,.62);add(g,Co(.1,.28,6),0x6a5a4a,0,.44,.9).rotation.x=Math.PI/2;
for(const s of[-1,1]){add(g,Co(.12,.5,8),0x9aa3b8,s*.36,.28,.72).rotation.x=Math.PI/2;add(g,Cy(.1,.1,.12,8),0x5a5a66,s*.36,.28,.45).rotation.x=Math.PI/2;add(g,Cy(.08,.09,.28,6),B2,s*.3,.14,-.3)}eyes(g,.12,.58,.8,.045)}
else if(ty==2){const K=0x2a2630,M2=0x3a3440;add(g,S(.42),K,0,.62,-.3).scale.set(1,.85,1.2);for(let i=0;i<5;i++)addM(g,S(.05),MT.GLOW,Math.sin(i*2.1)*.25,.78+Math.cos(i*1.3)*.08,-.3+Math.cos(i*2.5)*.3);
for(let i=0;i<3;i++){const f=addM(g,Co(.12-i*.02,.5-i*.08,6),MT.GLOW,(i-1)*.12,1.1-i*.03,-.35+(i%2)*.1);f.rotation.z=(i-1)*.25}
add(g,S(.26),M2,0,.58,.22);for(let i=0;i<4;i++)addM(g,S(.035),MT.GLOW,(i%2?.07:-.07)*(i<2?1:1.8),.64+(i<2?.04:0),.44);
for(const s of[-1,1])for(let i=0;i<4;i++){const lg=new THREE.Group();lg.position.set(s*.18,.6,.25-i*.17);lg.rotation.y=-s*(.6-i*.4);g.add(lg);add(lg,Cy(.035,.035,.54,6),M2,s*.22,.16,0).rotation.z=-s*.93;addM(lg,S(.05),MT.GLOW,s*.43,.32,0);add(lg,Cy(.03,.012,.95,6),M2,s*.62,-.13,0).rotation.z=s*.45}}
else if(ty==3){addM(g,S(.35),MT.GHO,0,.6,0).scale.set(.8,.85,1.6);for(let i=0;i<4;i++){const r=.36-Math.abs(i-1.5)*.05,st=addM(g,Cy(r,r,.06,14),MT.CRY,0,.6,.35-i*.22);st.rotation.x=Math.PI/2;st.scale.set(.82,1,.85)}
addM(g,S(.25),MT.GHO,0,.68,.62).scale.set(.9,.85,1.15);addM(g,Co(.12,.3,5),MT.CRY,0,.95,.5).rotation.x=-.6;for(const s of[-1,1]){add(g,S(.1),0x4fd0c8,s*.17,.74,.66);add(g,S(.05),0x1d2433,s*.21,.75,.72);for(const f of[.35,-.35])add(g,Cy(.04,.035,.5,6),0x5a4aa6,s*.3,.25,f).rotation.z=s*.5}
const tl=addM(g,new THREE.TorusGeometry(.2,.06,8,20,Math.PI*1.6),MT.GHO,0,.45,-.75);tl.rotation.y=Math.PI/2}
else{const MX=window._MX||(window._MX={NEON:new THREE.MeshStandardMaterial({color:0x3ad0ff,emissive:0x1a9fff,emissiveIntensity:1.4}),SUN:new THREE.MeshStandardMaterial({color:0xffd34e,emissive:0xffa020,emissiveIntensity:1.1}),WO:new THREE.MeshStandardMaterial({color:0xe8703a,side:THREE.DoubleSide,transparent:true,opacity:.92,roughness:.5}),WP:new THREE.MeshStandardMaterial({color:0x9a5ad6,side:THREE.DoubleSide,transparent:true,opacity:.9,roughness:.5})});
if(ty==4){for(let i=0;i<7;i++){const a=i/7*6.28;add(g,S(.26),0xf4f4f8,Math.cos(a)*.28,.55+Math.sin(i*1.9)*.08,Math.sin(a)*.28)}add(g,S(.34),0xffffff,0,.72,0);add(g,S(.22),0xffe2c8,0,.62,.36).scale.set(1,.85,.6);eyes(g,.08,.66,.48,.04);for(const s of[-1,1]){add(g,Co(.05,.2,6),0xe2bf67,s*.15,.92,.28).rotation.z=-s*.5;for(const f of[.2,-.2])add(g,Cy(.05,.04,.28,6),0x5a5a66,s*.18,.14,f)}}
else if(ty==5){add(g,S(.2),0xe8903a,0,.9,0).scale.set(1,1.3,1);add(g,S(.16),0xffd34e,0,1.22,.05);eyes(g,.06,1.25,.17,.035);for(const s of[-1,1]){add(g,Cy(.01,.01,.3,4),0x3a2a1e,s*.06,1.45,.05).rotation.z=-s*.3;add(g,S(.03),0xd93b3b,s*.11,1.59,.05);const w1=addM(g,S(.42),MX.WO,s*.44,1.08,-.06);w1.scale.set(1,.72,.06);w1.rotation.z=s*.35;const w2=addM(g,S(.3),MX.WP,s*.36,.72,-.06);w2.scale.set(1,.7,.06);w2.rotation.z=-s*.3;for(let i=0;i<3;i++)add(g,S(.06),0xffe08a,s*(.3+i*.14),1.1+(i%2)*.08,-.04)}}
else if(ty==6){const W=0xa9d8ee;add(g,S(.4),W,0,.85,0).scale.set(.9,.8,1.5);add(g,S(.22),0xffffff,0,1.08,.32).scale.set(1.1,1,.9);add(g,Cy(.12,.15,.45,8),W,0,1.18,.45).rotation.x=-.5;add(g,S(.18),W,0,1.4,.62).scale.set(.9,.9,1.3);add(g,S(.06),0x2a3a5a,0,1.36,.84);eyes(g,.09,1.44,.75,.035);for(const s of[-1,1]){for(const f of[.42,-.42])add(g,Cy(.05,.04,.8,6),0x8ab8d0,s*.18,.4,f);const an=addM(g,Co(.04,.55,5),MT.CRY,s*.12,1.75,.55);an.rotation.z=-s*.4;for(let i=0;i<2;i++){const br=addM(g,Co(.03,.28,5),MT.CRY,s*(.2+i*.08),1.72+i*.14,.55+(i?.05:-.05));br.rotation.z=-s*1.1}}}
else if(ty==7){const K=0x1e1e2a;add(g,S(.38),K,0,.62,0).scale.set(.85,.75,1.5);add(g,S(.24),K,0,.82,.6);add(g,B(.14,.12,.26),K,0,.75,.84);addM(g,S(.035),MX.NEON,-.08,.88,.8);addM(g,S(.035),MX.NEON,.08,.88,.8);for(const s of[-1,1]){add(g,Co(.07,.22,4),K,s*.11,1.04,.56);for(const f of[.38,-.38])add(g,Cy(.06,.05,.5,6),K,s*.18,.25,f);for(let i=0;i<3;i++){const sp=addM(g,B(.04,.05,.42),MX.NEON,s*.3,.65+(i-1)*.08,.1-i*.25);sp.rotation.x=.4*(i-1)}}for(let i=0;i<4;i++)addM(g,Co(.06,.22,4),MX.NEON,0,.94-i*.02,.3-i*.22).rotation.x=-.4;const tl=addM(g,Co(.1,.6,5),MX.NEON,0,.82,-.78);tl.rotation.x=-2.1}
else if(ty==8){const BL=0x4a78a8;add(g,S(.4),BL,0,.55,0).scale.set(.8,.7,1.6);add(g,S(.3),0xeef4f8,0,.45,.15).scale.set(.9,.6,1.3);add(g,Co(.18,.45,4),BL,0,.98,-.05).scale.z=.3;for(const s of[-1,1]){const tf=add(g,Co(.12,.38,4),BL,s*.12,.62,-.78);tf.rotation.x=-1.9;tf.rotation.z=s*.4;add(g,Cy(.08,.06,.25,6),0x3a5a80,s*.24,.12,.3);add(g,Cy(.08,.06,.25,6),0x3a5a80,s*.24,.12,-.35);add(g,Co(.06,.25,4),BL,s*.33,.5,.2).rotation.z=s*1.6}for(let i=0;i<5;i++)add(g,Co(.025,.07,4),0xffffff,(i-2)*.07,.43,.72).rotation.x=Math.PI;add(g,S(.045),0xffd34e,-.16,.68,.55);add(g,S(.045),0xffd34e,.16,.68,.55);add(g,S(.022),0x111111,-.17,.69,.59);add(g,S(.022),0x111111,.17,.69,.59)}
else{const RD=0xc8382a;add(g,S(.3),RD,0,.9,0).scale.set(1,1.2,1.1);add(g,Cy(.07,.09,.4,8),RD,0,1.3,.1);add(g,S(.14),0xf4e2c8,0,1.52,.15);add(g,Co(.05,.18,5),0xe2bf67,0,1.5,.32).rotation.x=Math.PI/2;eyes(g,.06,1.55,.25,.03);const ring=addM(g,new THREE.TorusGeometry(.32,.03,6,24),MX.SUN,0,1.55,-.05);for(let i=0;i<10;i++){const a=i/10*6.28,r=addM(g,Co(.04,.16,4),MX.SUN,Math.cos(a)*.42,1.55+Math.sin(a)*.42,-.06);r.rotation.z=a-Math.PI/2}for(const s of[-1,1]){add(g,Cy(.025,.02,.6,5),0xe2bf67,s*.1,.3,0);add(g,S(.22),0x8a2a20,s*.27,.92,-.02).scale.set(.3,.9,1)}for(let i=0;i<3;i++)add(g,Co(.07,.5,4),i==1?0xe2bf67:RD,(i-1)*.1,.7,-.42).rotation.x=-2.3}}
return g}
wild.forEach(w=>{const np=mkPal(T[w.ty].c);np.position.copy(w.m.position);np.rotation.y=w.m.rotation.y;sc.remove(w.m);sc.add(np);w.m=np});pals.forEach(p=>{const np=mkPal(T[p.ty].c);np.position.copy(p.m.position);sc.remove(p.m);sc.add(np);p.m=np});pwUp();
