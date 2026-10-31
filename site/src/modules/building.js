/* 0.1.8: будівництво в стилі Rust — сітка 3×3 м, фундаменти, стіни, проєми, двері, вікна,
   підлоги/стелі, сходи, дахи. Дерево або камінь. Ходити можна по поверхах, стіни не пускають. */
(function(){try{
const G=n=>{try{return eval(n)}catch(e){return undefined}};const GC=(()=>{const c={};return n=>c[n]||(c[n]=G(n))})();
const SCN=G('sc'),H=window.H;if(!SCN||!H)return;
const C=3,WH=3,MAXP=400;
const T=['found','wall','floor','stairs','roof'];
/* name, icon, type, variant, cost in wood (stone variant: same number of stone + 1/3 wood) */
const ITEMS=[
 {k:'found',n:'Фундамент',e:'⬛',t:0,v:0,c:8,cat:0},
 {k:'floor',n:'Підлога / стеля',e:'⬜',t:2,v:0,c:5,cat:0},
 {k:'stairs',n:'Сходи',e:'🪜',t:3,v:0,c:7,cat:0},
 {k:'wall',n:'Стіна',e:'🧱',t:1,v:0,c:6,cat:1},
 {k:'half',n:'Пів стіни',e:'▭',t:1,v:4,c:3,cat:1},
 {k:'low',n:'Низька стінка',e:'▬',t:1,v:5,c:2,cat:1},
 {k:'dframe',n:'Рамка під двері',e:'🚪',t:1,v:1,c:5,cat:2},
 {k:'dwood',n:'Дерев’яні двері',e:'🚪',t:5,v:0,fix:{w:4,sti:2},cat:2},
 {k:'dmetal',n:'Залізні двері',e:'🛡️',t:5,v:1,fix:{ing:3,w:1},cat:2},
 {k:'wframe',n:'Рамка під вікно',e:'🔲',t:1,v:2,c:5,cat:3},
 {k:'wglass',n:'Скло',e:'🪟',t:5,v:2,fix:{s:3},cat:3},
 {k:'wbars',n:'Грати',e:'⛓️',t:5,v:3,fix:{ing:2},cat:3},
 {k:'wshut',n:'Віконниці',e:'🪵',t:5,v:4,fix:{w:3},cat:3},
 {k:'roof',n:'Дах',e:'🔺',t:4,v:0,c:6,cat:4}];
const CATS=['🧱 Основа','🏠 Стіни','🚪 Двері','🪟 Вікна','🔺 Дах'],LEG={t:1,v:3,n:'Двері (стара)',c:7};
const cost=(it,m)=>it.fix?Object.assign({},it.fix):m?{s:it.c,w:Math.ceil(it.c/3),sti:it.sti||0}:{w:it.c,sti:it.sti||0};
const itemOf=p=>ITEMS.find(i=>i.t==p.t&&i.v==p.v)||LEG;
const NM={w:'🪵',s:'🪨',sti:'🥢',ing:'🔩'};
const inRes=k=>k=='w'||k=='s'||k=='b';const have=k=>{const res=G('res'),inv=G('inv');return inRes(k)?(res&&res[k]||0):(inv&&inv[k]||0)};
const canPay=c=>Object.entries(c).every(([k,n])=>!n||have(k)>=n);
function pay(c,sgn){const res=G('res'),inv=G('inv');for(const[k,n]of Object.entries(c)){if(!n)continue;const d=Math.round(n*sgn);if(!inRes(k))inv[k]=Math.max(0,(inv[k]||0)+d);else res[k]=Math.max(0,(res[k]||0)+d)}}
/* ---------- текстури ---------- */
function tex(draw){const c=document.createElement('canvas');c.width=c.height=128;draw(c.getContext('2d'));const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;return t}
const woodT=tex(x=>{x.fillStyle='#b98252';x.fillRect(0,0,128,128);for(let i=0;i<8;i++){x.fillStyle=i%2?'#a8743f':'#c08a58';x.fillRect(0,i*16,128,15);x.fillStyle='rgba(60,30,10,.35)';x.fillRect(0,i*16+15,128,1);for(let j=0;j<6;j++){x.fillStyle='rgba(90,50,20,.18)';x.fillRect(Math.random()*128,i*16+3+Math.random()*9,20+Math.random()*30,1)}x.fillStyle='rgba(50,25,10,.5)';x.fillRect((i*37)%128,i*16,1,15)}});
const stoneT=tex(x=>{x.fillStyle='#8f8b84';x.fillRect(0,0,128,128);for(let r=0;r<8;r++)for(let c=0;c<4;c++){const o=r%2?16:0,g=150+Math.random()*30|0;x.fillStyle=`rgb(${g},${g-4},${g-10})`;x.fillRect(c*32+o-31+32,r*16+1,30,14);x.fillRect(c*32+o-31,r*16+1,30,14)}});
function loadBuildingTexture(texture,path){const image=new Image();image.onload=()=>{texture.image=image;texture.needsUpdate=true};image.src=path}
loadBuildingTexture(woodT,'assets/building/wood-planks.png');
loadBuildingTexture(stoneT,'assets/building/stone-blocks.png');
const MAT=[[new THREE.MeshStandardMaterial({color:0xffffff,map:woodT,roughness:.9}),new THREE.MeshStandardMaterial({color:0xc49a74,map:woodT,roughness:.9})],
 [new THREE.MeshStandardMaterial({color:0xffffff,map:stoneT,roughness:.95}),new THREE.MeshStandardMaterial({color:0xa2a09a,map:stoneT,roughness:.95})]];
const GOOD=new THREE.MeshBasicMaterial({color:0x5cff7a,transparent:true,opacity:.42,depthWrite:false}),BAD=new THREE.MeshBasicMaterial({color:0xff4a4a,transparent:true,opacity:.42,depthWrite:false}),DEL=new THREE.MeshBasicMaterial({color:0xff3030,transparent:true,opacity:.35,depthWrite:false});
/* ---------- геометрія ---------- */
const DIRS=[[0,1],[1,0],[0,-1],[-1,0]];
const cxz=(cx,cz)=>[cx*C+C/2,cz*C+C/2];
let roofModel=null;
const roofGeometries=new Set();
function disposeGroup(g){g.traverse(o=>{if(o.isMesh&&o.geometry&&!roofGeometries.has(o.geometry))o.geometry.dispose()})}
function box(g,m,w,h,d,x,y,z){const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.castShadow=b.receiveShadow=true;g.add(b);return b}
function groundMin(cx,cz){let m=99;for(const[a,b]of[[0,0],[C,0],[0,C],[C,C],[C/2,C/2]])m=Math.min(m,H(cx*C+a,cz*C+b));return m}
function groundMax(cx,cz){let m=-99;for(const[a,b]of[[0,0],[C,0],[0,C],[C,C],[C/2,C/2]])m=Math.max(m,H(cx*C+a,cz*C+b));return m}
function mkPiece(p,ghost){const g=new THREE.Group(),[m0,m1]=ghost?[ghost,ghost]:MAT[p.m];const[x,z]=cxz(p.cx,p.cz);g.position.set(x,0,z);
 if(p.t==0){const yb=groundMin(p.cx,p.cz)-.5,h=p.y-yb;box(g,m1,C,h,C,0,yb+h/2,0);box(g,m0,C-.06,.12,C-.06,0,p.y-.06,0)}
 else if(p.t==1){const w=new THREE.Group();g.add(w);const[dx,dz]=DIRS[p.s];w.position.set(dx*C/2,p.y,dz*C/2);w.rotation.y=p.s%2?Math.PI/2:0;const T_=.24;
  if(p.v==0)box(w,m0,C,WH,T_,0,WH/2,0);
  else if(p.v==4){box(w,m0,C,1.5,T_,0,.75,0);if(!ghost)box(w,m1,C+.02,.12,T_+.06,0,1.5,0)}
  else if(p.v==5){box(w,m0,C,1,T_,0,.5,0);if(!ghost)box(w,m1,C+.02,.12,T_+.06,0,1,0)}
  else if(p.v==2){box(w,m0,C,1.05,T_,0,.525,0);box(w,m0,C,.8,T_,0,WH-.4,0);box(w,m0,.95,1.15,T_,-C/2+.475,1.05+.575,0);box(w,m0,.95,1.15,T_,C/2-.475,1.05+.575,0);if(!ghost){box(w,m1,1.14,.08,T_+.06,0,1.05,0);box(w,m1,1.14,.08,T_+.06,0,2.2,0)}}
  else{box(w,m0,.9,WH,T_,-C/2+.45,WH/2,0);box(w,m0,.9,WH,T_,C/2-.45,WH/2,0);box(w,m0,1.2,.7,T_,0,WH-.35,0);
   if(p.v==3){const hg=new THREE.Group();hg.position.set(-.6,0,0);w.add(hg);box(hg,ghost||m1,1.18,2.28,.1,.59,1.14,0);if(!ghost)box(hg,new THREE.MeshStandardMaterial({color:0xe2bf67,metalness:.6,roughness:.3}),.08,.08,.16,1.05,1.1,0);g.userData.door=hg}}}
 else if(p.t==2){box(g,m0,C,.22,C,0,p.y-.11,0);if(!ghost){box(g,m1,.18,.18,C,-C/2+.09,p.y-.31,0);box(g,m1,.18,.18,C,C/2-.09,p.y-.31,0)}}
 else if(p.t==3){const[dx,dz]=DIRS[p.s],n=8;for(let i=0;i<n;i++){const st=new THREE.Group();g.add(st);const f=(i+.5)/n-.5;st.position.set(dx*f*C,0,dz*f*C);st.rotation.y=p.s%2?Math.PI/2:0;box(st,m0,1.6,.18,C/n+.02,0,p.y+(i+1)*WH/n-.09,0)}
}
 else if(p.t==5){const w=new THREE.Group();g.add(w);const[dx,dz]=DIRS[p.s];w.position.set(dx*C/2,p.y,dz*C/2);w.rotation.y=p.s%2?Math.PI/2:0;
  const WD=new THREE.MeshStandardMaterial({color:0xffffff,map:woodT,roughness:.9}),MT=new THREE.MeshStandardMaterial({color:0x7d848c,metalness:.7,roughness:.35}),GD=new THREE.MeshStandardMaterial({color:0xe2bf67,metalness:.6,roughness:.3});
  const A=ghost||WD,B=ghost||MT;
  if(p.v<=1){const hg=new THREE.Group();hg.position.set(-.6,0,0);w.add(hg);const pm=p.v?B:A;box(hg,pm,1.18,2.28,.1,.59,1.14,0);
   if(!ghost){if(p.v){for(const y of[.4,1.14,1.9])box(hg,MT,1.1,.06,.13,.59,y,0);for(const x of[.1,1.08])for(const y of[.25,2.05])box(hg,GD,.05,.05,.14,x,y,0)}else{box(hg,new THREE.MeshStandardMaterial({color:0x8a5a34}),1.1,.1,.13,.59,.5,0);box(hg,new THREE.MeshStandardMaterial({color:0x8a5a34}),1.1,.1,.13,.59,1.8,0)}box(hg,GD,.08,.08,.18,1.05,1.1,0)}
   g.userData.door=hg}
  else if(p.v==2)box(w,ghost||new THREE.MeshStandardMaterial({color:0x9fd8ff,transparent:true,opacity:.35,roughness:.05,metalness:.2}),1.12,1.17,.04,0,1.625,0);
  else if(p.v==3){for(let i=0;i<6;i++)box(w,B,.05,1.17,.05,-.48+i*.19,1.625,0);box(w,B,1.12,.05,.05,0,1.3,0);box(w,B,1.12,.05,.05,0,1.95,0)}
  else{for(const sx of[-1,1]){const sg=new THREE.Group();sg.position.set(sx*.56,1.625,.14);w.add(sg);sg.rotation.y=sx*.35;for(let i=0;i<5;i++)box(sg,A,.56,.17,.05,-sx*.28,-.46+i*.23,0)}}}
 else if(p.t==4){if(roofModel){const roof=roofModel.clone(true);roof.traverse(o=>{if(!o.isMesh)return;o.material=ghost||(/Roof_Trim/.test(o.name)?m1:m0);o.castShadow=o.receiveShadow=!ghost});roof.position.y=p.y;g.add(roof)}
  else{const cone=new THREE.Mesh(new THREE.ConeGeometry(C/Math.SQRT2*1.08,1.7,4,1),m0);cone.rotation.y=Math.PI/4;cone.position.y=p.y+.85;cone.castShadow=true;g.add(cone)}}
 if(ghost)g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.renderOrder=5}});
 return g}
/* ---------- дані ---------- */
let pieces=[];
const ekey=(cx,cz,s)=>s==2?[cx,cz-1,0]:s==3?[cx-1,cz,1]:[cx,cz,s];
const near=(a,b)=>Math.abs(a-b)<.3;
const at=(t,cx,cz,y)=>pieces.find(p=>p.t==t&&p.cx==cx&&p.cz==cz&&(y==null||near(p.y,y)));
function edgeAt(t,cx,cz,s,y){const[a,b,ss]=ekey(cx,cz,s);return pieces.find(p=>p.t==t&&near(p.y,y)&&(()=>{const[c,d,e]=ekey(p.cx,p.cz,p.s);return c==a&&d==b&&e==ss})())}
const wallAt=(cx,cz,s,y)=>edgeAt(1,cx,cz,s,y),insAt=(cx,cz,s,y)=>edgeAt(5,cx,cz,s,y),fullAt=(cx,cz,s,y)=>{const w=wallAt(cx,cz,s,y);return w&&w.v<=3?w:null};
function tops(cx,cz){return pieces.filter(p=>p.cx==cx&&p.cz==cz&&(p.t==0||p.t==2)).map(p=>p.y)}
function saveB(){const inv=G('inv');if(!inv)return;inv._bs=pieces.map(p=>[p.t,p.cx,p.cz,Math.round(p.y*100),p.s,p.m,p.v]);if(window.plRefreshVegetation)window.plRefreshVegetation();try{G('save')()}catch(e){}}
function freezePiece(g){const d=g.userData.door;if(d)d.traverse(x=>x.userData.noFreeze=1);g.updateMatrixWorld(true);g.traverse(x=>{if(!x.userData.noFreeze)x.matrixAutoUpdate=false})}
function add(p,noSave){p.g=mkPiece(p);SCN.add(p.g);freezePiece(p.g);pieces.push(p);if(!noSave)saveB()}
function remove(p){SCN.remove(p.g);disposeGroup(p.g);pieces=pieces.filter(x=>x!==p);saveB()}
{const inv=G('inv');(inv&&inv._bs||[]).forEach(a=>{try{add({t:a[0],cx:a[1],cz:a[2],y:a[3]/100,s:a[4],m:a[5],v:a[6]},true)}catch(e){}})}
/* Dachy odtworzone z zapisu startują jako prosta bryła, a po wczytaniu GLB
   dostają detal bez zmiany pozycji, danych zapisu ani reguł kolizji. */
if(THREE.GLTFLoader)new THREE.GLTFLoader().load('assets/models/building-roof.glb',gltf=>{
 const meshes=[];gltf.scene.traverse(o=>{if(o.isMesh)meshes.push(o)});
 const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3());
 if(meshes.length!==2||!meshes.some(o=>o.name==='Roof_Surface')||!meshes.some(o=>o.name==='Roof_Trim')||meshes.some(o=>!o.geometry.attributes.uv)||size.x>3.7||size.z>3.7||size.y>2.2||size.y<1){console.warn('building roof: invalid model');return}
 roofModel=gltf.scene;meshes.forEach(o=>roofGeometries.add(o.geometry));
 for(const p of pieces){if(p.t!==4)continue;SCN.remove(p.g);disposeGroup(p.g);p.g=mkPiece(p);SCN.add(p.g);freezePiece(p.g)}
 ghostKey='';
},undefined,e=>console.warn('building roof: procedural fallback',e));
/* ---------- поверхні й зіткнення ---------- */
let py=null;
function surf(x,z,cur){const cx=Math.floor(x/C),cz=Math.floor(z/C);let best=-99;
 for(const p of pieces){if(p.cx!=cx||p.cz!=cz)continue;let h=-99;
  if(p.t==0||p.t==2)h=p.y;
  else if(p.t==3){const[dx,dz]=DIRS[p.s],[ox,oz]=cxz(cx,cz),f=((x-ox)*dx+(z-oz)*dz)/C+.5;h=p.y+Math.max(0,Math.min(1,f))*WH}
  if(h<=cur+1.25&&h>best)best=h}return best}
window.BLDY=function(x,z,dt){const gh=H(x,z);if(py==null)py=gh;const s=surf(x,z,py);if(s<-90){py=gh;return gh}
 const tgt=Math.max(gh,s);if(tgt>=py)py=tgt;else py=Math.max(tgt,py-14*(dt||.016));return py};
const blocks=(ax,az,bx,bz,y)=>{for(const p of pieces){if(p.t==0){if(p.y>y+1.25){const x0=p.cx*C-.3,z0=p.cz*C-.3,x1=x0+C+.6,z1=z0+C+.6;if(bx>x0&&bx<x1&&bz>z0&&bz<z1&&!(ax>x0&&ax<x1&&az>z0&&az<z1))return true}continue}
  if(p.t!=1||p.v==1||p.v==3)continue;if(y<p.y-.6||y>p.y+WH-.4)continue;
  const[cx,cz]=cxz(p.cx,p.cz),[dx,dz]=DIRS[p.s],ex=cx+dx*C/2,ez=cz+dz*C/2,R=.45;
  if(p.s%2){if((ax-ex)*(bx-ex)<=0||Math.abs(bx-ex)<R){if(Math.abs(bz-ez)<C/2+.1&&(Math.abs(bx-ex)<R||(ax-ex)*(bx-ex)<0))return true}}
  else{if((az-ez)*(bz-ez)<=0||Math.abs(bz-ez)<R){if(Math.abs(bx-ex)<C/2+.1&&(Math.abs(bz-ez)<R||(az-ez)*(bz-ez)<0))return true}}}return false};
window.BLDBLK=blocks;/* 0.1.23: та сама перевірка стін — для попалів і диких істот (collide.js) */
window.BLDC=function(ox,oz){const P=GC('P');if(!P||!pieces.length)return;const y=py==null?H(P.x,P.z):py;
 if(!blocks(ox,oz,P.x,P.z,y))return;if(!blocks(ox,oz,P.x,oz,y)){P.z=oz;return}if(!blocks(ox,oz,ox,P.z,y)){P.x=ox;return}P.x=ox;P.z=oz};
/* ---------- розміщення ---------- */
let tab=0,on=0,cur=0,mat=0,rot=0,del=0,ghost=null,ghostKey='',plan=null;
function facing(){const P=GC('P');const f=P.face||0;const q=Math.round(f/(Math.PI/2));return((q%4)+4)%4} /* 0:+z 1:+x 2:-z 3:-x */
function planFor(){const P=GC('P'),it=ITEMS[cur],y0=py==null?H(P.x,P.z):py,fd=(facing()+rot)%4,[dx,dz]=DIRS[fd];
 const pcx=Math.floor(P.x/C),pcz=Math.floor(P.z/C),fcx=Math.floor((P.x+dx*2.2)/C),fcz=Math.floor((P.z+dz*2.2)/C);
 const base=(cx,cz)=>{const t=tops(cx,cz).filter(v=>v<=y0+1.3);return t.length?Math.max(...t):null};
 let p={t:it.t,v:it.v,m:mat,s:0,cx:fcx,cz:fcz,y:0},ok=true,why='';
 if(it.t==0){const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>at(0,fcx+a,fcz+b)).find(Boolean);
  p.y=nb?nb.y:groundMax(fcx,fcz)+.35;
  if(at(0,fcx,fcz)){ok=false;why='Тут уже є фундамент'}
  else if(groundMin(fcx,fcz)<-.9){ok=false;why='Тут вода'}
  else if(p.y-groundMin(fcx,fcz)>3.2){ok=false;why='Занадто нерівно'}
  else{const C=(G('inv')||{})._cen;const[x,z]=cxz(fcx,fcz);if(!C){ok=false;why='Спершу збудуйте Попал-центр'}else{const dc=Math.hypot(C[0]-x,C[1]-z);if(dc>30){ok=false;why='Будувати можна в радіусі 30 м від Попал-центру'}else if(dc<3.6){ok=false;why='Занадто близько до Попал-центру'}}
   const wp=[...(GC('wild')||[])].concat([]);}}
 else if(it.t==1){let b=base(pcx,pcz),cx=pcx,cz=pcz,s=fd;
  if(b==null){cx=fcx;cz=fcz;s=(fd+2)%4;b=base(cx,cz)}
  if(b==null){ok=false;why='Потрібен фундамент або підлога';p.y=y0}else p.y=b;
  p.cx=cx;p.cz=cz;p.s=s;if(ok&&wallAt(cx,cz,s,p.y)){ok=false;why='Тут уже є стіна'}}
 else if(it.t==2){const b=base(pcx,pcz);
  let cx=fcx,cz=fcz,y=null;
  if(b!=null&&[0,1,2,3].some(s=>fullAt(pcx,pcz,s,b))&&!tops(pcx,pcz).some(v=>near(v,b+WH))){cx=pcx;cz=pcz;y=b+WH}
  else if(b!=null){y=b}
  p.cx=cx;p.cz=cz;p.y=y==null?y0+WH:y;
  const sup=[0,1,2,3].some(s=>fullAt(cx,cz,s,p.y-WH))||[[1,0],[-1,0],[0,1],[0,-1]].some(([a,c])=>tops(cx+a,cz+c).some(v=>near(v,p.y)));
  if(tops(cx,cz).some(v=>near(v,p.y))){ok=false;why='Тут уже є підлога'}else if(!sup){ok=false;why='Потрібна опора: стіни знизу або сусідня підлога'}}
 else if(it.t==3){const b=base(fcx,fcz);p.cx=fcx;p.cz=fcz;p.s=fd;p.y=b==null?y0:b;
  if(b==null){ok=false;why='Сходи ставляться на фундамент або підлогу'}else if(pieces.some(q=>q.t==3&&q.cx==fcx&&q.cz==fcz&&near(q.y,b))){ok=false;why='Тут уже є сходи'}}
 else if(it.t==5){const door=it.v<=1,need=door?1:2;let f=null;
  for(const[cx,cz,ss]of[[pcx,pcz,fd],[fcx,fcz,(fd+2)%4]]){const b=base(cx,cz);if(b==null)continue;const w=wallAt(cx,cz,ss,b);if(w&&w.v==need){f=w;break}}
  if(!f){ok=false;why=door?'Спочатку поставте рамку під двері':'Спочатку поставте рамку під вікно';p.y=y0;p.cx=fcx;p.cz=fcz;p.s=(fd+2)%4}
  else{p.cx=f.cx;p.cz=f.cz;p.s=f.s;p.y=f.y;if(insAt(f.cx,f.cz,f.s,f.y)){ok=false;why=door?'Тут уже є двері':'Тут уже є вікно'}}}
 else if(it.t==4){let cx=pcx,cz=pcz,b=base(cx,cz);if(b==null||![0,1,2,3].some(s=>fullAt(cx,cz,s,b))){cx=fcx;cz=fcz;b=base(cx,cz)}
  p.cx=cx;p.cz=cz;p.y=(b==null?y0:b)+WH;
  if(b==null||![0,1,2,3].some(s=>fullAt(cx,cz,s,b))){ok=false;why='Дах ставиться на повні стіни'}else if(at(4,cx,cz,p.y)||tops(cx,cz).some(v=>near(v,p.y))){ok=false;why='Тут уже щось є'}}
 if(ok&&pieces.length>=MAXP){ok=false;why='Досягнуто ліміт '+MAXP+' деталей'}
 const c=cost(it,mat);if(ok&&!canPay(c)){ok=false;why='Не вистачає: '+Object.entries(c).filter(([k,n])=>n&&have(k)<n).map(([k,n])=>NM[k]+(n-have(k))).join(' ')}
 return{p,ok,why,c}}
function delTarget(){const P=GC('P'),[dx,dz]=DIRS[facing()],y0=py==null?H(P.x,P.z):py,tx=P.x+dx*1.6,tz=P.z+dz*1.6;let best=null,bd=2.8;
 for(const p of pieces){const[cx,cz]=cxz(p.cx,p.cz);let x=cx,z=cz,y=p.t==1||p.t==5?p.y+1.5:p.y;if(p.t==1||p.t==5){const[a,b]=DIRS[p.s];x+=a*C/2;z+=b*C/2}
  if(y<y0-1.5||y>y0+3.6)continue;const d=Math.hypot(x-tx,z-tz)+Math.abs(y-(y0+1))*.3;if(d<bd){bd=d;best=p}}return best}
/* ---------- інтерфейс ---------- */
const bt=document.createElement('button');bt.id='bld';bt.innerHTML='🏗️<small>Будова</small>';
document.body.appendChild(bt);
const bar=document.createElement('div');bar.id='bbar';document.body.appendChild(bar);
const tip=document.createElement('div');tip.id='btip';document.body.appendChild(tip);
const side=document.createElement('div');side.id='bside';side.innerHTML="<button id='bx' title='Вийти'>✕</button><button id='brot'>↻<small>Поворот</small></button><button id='bdel'>🔨<small>Розібрати</small></button><button id='bok'>✔<small>Поставити</small></button>";document.body.appendChild(side);
/* 0.5.x: намальовані значки деталей і вкладок (icons.js: BP_<деталь>_<w|s>, BP_<двері/вікно>); без icons.js — емодзі */
const bIco=(it,m)=>{const pi=window.plIconSrc,k=it.fix?'BP_'+it.k:'BP_'+it.k+'_'+(m?'s':'w'),src=pi&&pi(k);return src?`<img class='bico' src='${src}' alt=''>`:it.e};
const CICO=['found','wall','dwood','wglass','roof'];
const catLbl=(i,c,m)=>{const it=ITEMS.find(x=>x.k==CICO[i]),im=it?bIco(it,m):'';return im.startsWith('<img')?im+'<span>'+c.replace(/^\S+\s/,'')+'</span>':c};
{const st=document.createElement('style');st.textContent='.bitems .bico{width:54px;height:54px;display:block;margin:0 auto;pointer-events:none}.btab .bico{width:28px;height:28px;display:inline-block;vertical-align:middle;margin:-6px 6px -4px -4px;pointer-events:none}.btab span{vertical-align:middle}';document.head.appendChild(st)}
function costTxt(c){return Object.entries(c).filter(([,n])=>n).map(([k,n])=>`<span class='${have(k)>=n?'':'no'}'>${NM[k]}${n}</span>`).join(' ')}
function drawBar(){bar.innerHTML=`<div class='bmat'>${CATS.map((c,i)=>`<button data-bc='${i}' class='btab ${i==tab?'on':''}'>${catLbl(i,c,mat)}</button>`).join('')}<span class='bsep'></span><button data-bm='0' class='bmt ${mat?'':'on'}' title='Дерево'>🪵</button><button data-bm='1' class='bmt ${mat?'on':''}' title='Камінь'>🪨</button></div><div class='bitems'>`+
 ITEMS.map((it,i)=>it.cat!=tab?'':`<button data-bi='${i}' class='${i==cur&&!del?'on':''} ${it.fix?'fix':mat?'stone':'wood'}'><b>${bIco(it,mat)}</b><i>${it.n}${it.fix?'':`<u>${mat?'камінь':'дерево'}</u>`}</i><em>${costTxt(cost(it,mat))}</em></button>`).join('')+'</div>';
 document.getElementById('bdel').classList.toggle('on',!!del);document.getElementById('bok').innerHTML=del?'🔨<small>Розібрати</small>':'✔<small>Поставити</small>'}
function dropGhost(){if(ghost){SCN.remove(ghost);disposeGroup(ghost);ghost=null}}
function setOn(v){on=v;document.body.classList.toggle('bmode',!!on);if(!on){dropGhost();ghostKey='';tip.textContent='';del=0}else{drawBar()}}
bt.onclick=()=>{if(G('menuO'))return;setOn(on?0:1)};
document.getElementById('bx').onclick=()=>setOn(0);
document.getElementById('brot').onclick=()=>{rot=(rot+1)%4;ghostKey=''};
document.getElementById('bdel').onclick=()=>{del=del?0:1;drawBar();ghostKey=''};
bar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.bc!=null){tab=+b.dataset.bc;cur=ITEMS.findIndex(i=>i.cat==tab);del=0;rot=0;ghostKey=''}if(b.dataset.bm!=null){mat=+b.dataset.bm;ghostKey=''}if(b.dataset.bi!=null){cur=+b.dataset.bi;del=0;rot=0;ghostKey=''}drawBar()});
const SFX=k=>{try{PSFX.sfx(k)}catch(e){}};
document.getElementById('bok').onclick=()=>{const msg=G('msg');
 if(del){const p=delTarget();if(!p){msg('🔨 Поруч нічого розбирати');SFX('error');return}const it=itemOf(p);const half=c=>pay(Object.fromEntries(Object.entries(c).map(([k,n])=>[k,Math.floor(n/2)])),1);half(cost(it,p.m));if(p.t==1){const q=insAt(p.cx,p.cz,p.s,p.y);if(q){half(cost(itemOf(q),0));remove(q)}}remove(p);msg('🔨 Розібрано: '+it.n+' (повернуто половину)');SFX('mine');try{G('hud')()}catch(e){}ghostKey='';return}
 if(!plan)return;if(!plan.ok){msg('⚠️ '+plan.why);SFX('error');return}
 pay(plan.c,-1);add(Object.assign({},plan.p));SFX('build');try{G('hud')()}catch(e){};drawBar();ghostKey=''};
/* ---------- цикл ---------- */
let lt=performance.now();
(function loop(){requestAnimationFrame(loop);const n=performance.now(),dt=Math.min(.05,(n-lt)/1000);lt=n;const P=GC('P');if(!P)return;
 /* двері відчиняються, коли гравець поруч */
 for(const p of pieces){const d=p.g&&p.g.userData.door;if(!d)continue;const[cx,cz]=cxz(p.cx,p.cz),[a,b]=DIRS[p.s],x=cx+a*C/2,z=cz+b*C/2;const o=Math.hypot(P.x-x,P.z-z)<2&&Math.abs((py||0)-p.y)<2;d.rotation.y+=((o?-1.45:0)-d.rotation.y)*Math.min(1,dt*8)}
 if(!on||G('menuO')||G('ivO')){if(ghost){ghost.visible=false}return}
 if(del){const p=delTarget();const k='del'+(p?pieces.indexOf(p):'-');if(k!==ghostKey){ghostKey=k;dropGhost();ghost=p?mkPiece(p,DEL):null;if(ghost){ghost.scale.setScalar(1.02);SCN.add(ghost)}}
  tip.textContent=p?'Торкніться 🔨, щоб розібрати (повернеться половина ресурсів)':'Підійдіть до деталі, яку хочете розібрати';return}
 plan=planFor();const k=JSON.stringify([plan.p,plan.ok]);if(k!==ghostKey){ghostKey=k;dropGhost();ghost=mkPiece(plan.p,plan.ok?GOOD:BAD);SCN.add(ghost)}ghost.visible=true;
 tip.innerHTML=plan.ok?`${ITEMS[cur].e} ${ITEMS[cur].n}: ${costTxt(plan.c)} — натисніть ✔`:'⚠️ '+plan.why;
})();
window.BUILD={get pieces(){return pieces},setOn,ITEMS};
}catch(e){console.warn('building',e)}})();
