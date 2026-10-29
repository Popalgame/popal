/* 0.1.15: рудні жили — металеву руду 🟤 можна добути лише з рудних жил (камінь із мідно-сріблястими прожилками й самородками).
   Звичайні скелі дають тільки камінь. Нові процедурні текстури каменю й руди. Жилу бере лише кам’яна або металева кирка. */
(function(){try{
const G=n=>{try{return eval(n)}catch(e){return undefined}};
const RK=G('rocks'),BIO=G('BIO');if(!RK||typeof THREE==='undefined')return;

/* ---------- шум, що тайлиться ---------- */
const S=256;
function vnoise(cell,seed){const n=S/cell,g=new Float32Array(n*n);let s=seed;for(let i=0;i<g.length;i++){s=(s*16807)%2147483647;g[i]=s/2147483647}
 const at=(x,y)=>g[((y%n+n)%n)*n+((x%n+n)%n)];
 return(x,y)=>{const gx=x/cell,gy=y/cell,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const a=at(ix,iy),b=at(ix+1,iy),c=at(ix,iy+1),d=at(ix+1,iy+1);return a+(b-a)*sx+(c-a+(a-b+d-c)*sx)*sy}}
function fbm(seed){const o=[[64,.45],[32,.27],[16,.16],[8,.08],[4,.04]].map(([c,w],i)=>[vnoise(c,seed*31+i*977+1),w]);return(x,y)=>{let v=0;for(const[f,w]of o)v+=f(x,y)*w;return v}}
const lerp=(a,b,t)=>a+(b-a)*t,cl=v=>v<0?0:v>1?1:v;
function canvas(){const c=document.createElement('canvas');c.width=c.height=S;return c}
/* тріщини: ламані з темною лінією і світлим краєм */
function cracks(x,n,seed){let s=seed;const r=()=>(s=(s*16807)%2147483647)/2147483647;
 for(let k=0;k<n;k++){let px=r()*S,py=r()*S,a=r()*6.28;const pts=[[px,py]];for(let j=0;j<6+r()*8;j++){a+=(r()-.5)*1.1;px+=Math.cos(a)*9;py+=Math.sin(a)*9;pts.push([px,py])}
  for(const[col,w,o]of[['rgba(255,255,255,.18)',1.4,1],['rgba(28,30,40,.55)',1.6,0]]){x.strokeStyle=col;x.lineWidth=w;x.beginPath();pts.forEach(([u,v],i)=>i?x.lineTo(u+o,v+o):x.moveTo(u+o,v+o));x.stroke()}}}

/* ---------- текстури: колір, рельєф, шорсткість ---------- */
function makeTex(ore){
 const col=canvas(),bmp=canvas(),rgh=canvas(),cx=col.getContext('2d'),bx=bmp.getContext('2d'),rx=rgh.getContext('2d');
 const ci=cx.createImageData(S,S),bi=bx.createImageData(S,S),ri=rx.createImageData(S,S);
 const base=fbm(ore?7:3),tint=fbm(ore?11:5),vein=fbm(ore?19:13),fleck=vnoise(4,ore?23:29);
 /* палітра каменю: холодний сірий з теплими плямами */
 const DK=ore?[50,49,56]:[66,69,82],LT=ore?[118,115,122]:[150,153,166],WM=ore?[98,80,68]:[138,126,110];
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){const i=(y*S+x)*4;
  let v=cl((base(x,y)-.32)*2.5),w=cl((tint(x,y)-.45)*2.6)*.45;
  let r=lerp(DK[0],LT[0],v),g=lerp(DK[1],LT[1],v),b=lerp(DK[2],LT[2],v);r=lerp(r,WM[0],w);g=lerp(g,WM[1],w);b=lerp(b,WM[2],w);
  const f=fleck(x,y);if(f>.93){r+=28;g+=28;b+=30}else if(f<.06){r-=26;g-=26;b-=24}
  let h=v*200+30,ro=235;
  if(ore){/* прожилки: «хребти» шуму → мідь з яскравим осердям, плюс сріблясті іскри */
   const rd=1-Math.abs(vein(x,y)*2-1);
   if(rd>.94){const k=cl((rd-.94)/.05);r=lerp(150,246,k);g=lerp(78,190,k);b=lerp(40,120,k);h=200+k*55;ro=lerp(110,40,k)}
   else if(rd>.9){const k=(rd-.9)/.04;r=lerp(r,112,k);g=lerp(g,62,k);b=lerp(b,36,k)}
   if(f>.955){r=g=210;b=226;h=255;ro=30}}
  ci.data[i]=r;ci.data[i+1]=g;ci.data[i+2]=b;ci.data[i+3]=255;
  bi.data[i]=bi.data[i+1]=bi.data[i+2]=h;bi.data[i+3]=255;
  ri.data[i]=ri.data[i+1]=ri.data[i+2]=ro;ri.data[i+3]=255}
 cx.putImageData(ci,0,0);bx.putImageData(bi,0,0);rx.putImageData(ri,0,0);
 cracks(cx,ore?7:10,ore?41:43);bx.globalAlpha=.9;cracks(bx,ore?7:10,ore?41:43);
 const T=c=>{const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,1);try{t.anisotropy=Math.min(16,R.capabilities.getMaxAnisotropy())}catch(_){}return t};
 const map=T(col);map.encoding=THREE.sRGBEncoding;
 return new THREE.MeshStandardMaterial({map,bumpMap:T(bmp),bumpScale:.035,roughnessMap:T(rgh),roughness:1,metalness:0,flatShading:true});
}
const STONE=makeTex(0),ORE=makeTex(1);
const NUG=[new THREE.MeshStandardMaterial({color:0xd98a46,roughness:.28,metalness:.35,emissive:0x2a1204,flatShading:true}),
           new THREE.MeshStandardMaterial({color:0xe6ecf4,roughness:.2,metalness:.3,emissive:0x1a1e26,flatShading:true})];
const NGEO=new THREE.OctahedronGeometry(.13,0);

/* ---------- форми каменів: кілька «горбкуватих» варіантів ---------- */
function rockGeo(seed){const g=new THREE.DodecahedronGeometry(.7,1),p=g.attributes.position,v=new THREE.Vector3();
 const h=(x,y,z)=>{const s=Math.sin(x*12.9898+y*78.233+z*37.719+seed*17.17)*43758.5453;return s-Math.floor(s)};
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const k=.84+.28*h(Math.round(v.x*100),Math.round(v.y*100),Math.round(v.z*100));v.multiplyScalar(k);p.setXYZ(i,v.x,v.y,v.z)}
 g.computeVertexNormals();return g}
const GEO=[1,2,3,4,5,6].map(rockGeo),pick=a=>a[Math.random()*a.length|0];
let importedGEO=null;
const stoneGeo=()=>pick(importedGEO||GEO);

function dressStone(m){const old=m.geometry;m.geometry=pick(GEO);if(old&&GEO.indexOf(old)<0)old.dispose();m.material=STONE;m.castShadow=m.receiveShadow=true}
function makeOre(g){const m=g.children[0];if(!m)return;g.userData.ore=1;m.material=ORE;
 const n=5+(Math.random()*3|0);for(let i=0;i<n;i++){const a=Math.random()*6.28,e=.15+Math.random()*1.1,d=new THREE.Vector3(Math.cos(a)*Math.cos(e),Math.sin(e),Math.sin(a)*Math.cos(e));
  const u=new THREE.Mesh(NGEO,NUG[Math.random()<.7?0:1]);u.position.set(d.x*.66,m.position.y+d.y*.66*m.scale.y,d.z*.66);u.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);u.scale.setScalar(.7+Math.random()*.7);u.castShadow=true;g.add(u)}}

/* нові камені (зокрема відновлені після розбиття) — у новому вигляді; після розбитої жили наступний камінь стає жилою */
let pend=0;
mkRock=function(){const ore=pend>0,g=new THREE.Group(),m=new THREE.Mesh(ore?pick(GEO):stoneGeo(),STONE);m.position.y=.45;m.scale.y=.8;m.rotation.y=Math.random()*6;m.castShadow=m.receiveShadow=true;g.add(m);if(ore){pend--;makeOre(g)}return g};

/* ---------- перетворюємо наявні скелі: ~16% стають жилами, у горах і тундрі частіше; біля табору — щонайменше 3 ---------- */
const RICH={rock:1,snow:1,ash:1,tundra:1};
for(const o of RK){const m=o.m&&o.m.children[0];if(!m)continue;dressStone(m);let b='';try{b=BIO(o.x,o.z)}catch(_){}
 if(Math.random()<(RICH[b]?.32:.12))makeOre(o.m)}
const near=RK.filter(o=>Math.hypot(o.x,o.z)<45).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
let have=near.filter(o=>o.m.userData.ore).length;for(const o of near){if(have>=3)break;if(!o.m.userData.ore&&Math.hypot(o.x,o.z)>12){makeOre(o.m);have++}}

/* Model arrives after the world is built. Only ordinary stones change shape; resource markers and groups stay intact. */
if(THREE.GLTFLoader)new THREE.GLTFLoader().load('assets/models/terrain-rocks.glb',gltf=>{
 const variants=[];gltf.scene.traverse(node=>{if(node.isMesh&&/^Rock_\d+$/.test(node.name)&&node.geometry)variants.push(node.geometry)});
 if(variants.length!==3||variants.some(geo=>!geo.attributes.position||!geo.attributes.uv||geo.attributes.position.count>1000)){
  console.warn('terrain rocks: invalid mesh asset');return;
 }
 importedGEO=variants;
 for(const o of RK){if(o.m.userData.ore||o.m.userData.coal)continue;const m=o.m.children[0];if(m)m.geometry=stoneGeo()}
},undefined,error=>console.warn('terrain rocks: procedural fallback',error));

/* ---------- добування ---------- */
let sh=0;const tell=t=>{if(Date.now()-sh>2500){sh=Date.now();msg(t)}};
const _gh=window.gHit,_fb=window.fellB;
window.gHit=function(k,o){if(k!='s'||!o.m.userData.ore)return _gh.apply(this,arguments);
 const t=TT[eq.tool];if(!t||t.k!='s'||t.t<2){tell(t&&t.k=='s'?'⛏️ Дерев’яна кирка не бере руду: потрібна кам’яна або металева':'⛏️ Рудну жилу не добути без кирки: створіть кам’яну кирку в Крафті');return -1}
 if(!o.mx)o.mx=o.hp=12;o.hp-=t.d;const n=t.t>=3?1+(Math.random()<.35?1:0):(Math.random()<.6?1:0);inv.ore=(inv.ore||0)+n;
 return{y:n,dm:t.d,tx:n?['+'+n+' 🟤']:[]}};
window.fellB=function(k,o){if(k!='s'||!o.m.userData.ore)return _fb.apply(this,arguments);
 const t=TT[eq.tool],n=t&&t.t>=3?3:2;inv.ore=(inv.ore||0)+n;res.s+=1;try{st.s+=1}catch(_){}pend++;
 const p=o.m.position.clone();setTimeout(()=>dmg('+'+n+' 🟤 +1 🪨',{position:p},'#ffb070'),250)};
window.oreVeins=()=>RK.filter(o=>o.m.userData.ore);
}catch(e){console.warn('ore-veins',e)}})();
