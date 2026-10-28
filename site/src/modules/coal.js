/* 0.1.28: вугілля ⚫. Вугільні жили — чорні скелі з блискучими антрацитовими гранями — трапляються по всьому краю
   (у лісах і на луках частіше, ніж рудні жили). Добуваються будь-якою киркою, навіть дерев’яною.
   Вугілля — найкраще паливо для плавильні: 1 вугілля = 3 злитки (деревина — лише 1). */
(function(){try{
const G=n=>{try{return eval(n)}catch(e){return undefined}};
const RK=G('rocks');if(!RK)return;
IT.coal=['⚫','Вугілля'];if(inv.coal==null)inv.coal=0;

/* ---------- текстура: чорний камінь із блискучими гранями ---------- */
function tex(){const S=256,c=document.createElement('canvas'),r=document.createElement('canvas');c.width=c.height=r.width=r.height=S;
 const x=c.getContext('2d'),y=r.getContext('2d'),im=x.createImageData(S,S),ir=y.createImageData(S,S);let s=97;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
 const g=new Float32Array(33*33);for(let i=0;i<g.length;i++)g[i]=rnd();const at=(i,j)=>g[(j%32)*33+(i%32)];
 const n=(u,v)=>{const X=u/8,Y=v/8,i=Math.floor(X),j=Math.floor(Y),fx=X-i,fy=Y-j,a=at(i,j),b=at(i+1,j),c2=at(i,j+1),d=at(i+1,j+1);return a+(b-a)*fx+(c2-a+(a-b+d-c2)*fx)*fy};
 for(let v=0;v<S;v++)for(let u=0;u<S;u++){const k=(v*S+u)*4,b=n(u,v)*.6+n(u*3,v*3)*.4;let L=18+b*40,ro=230;const sp=rnd();
  if(sp>.985){L=150+rnd()*60;ro=25}else if(b>.72){L+=18;ro=120}
  im.data[k]=L*.92;im.data[k+1]=L*.94;im.data[k+2]=L*1.05;im.data[k+3]=255;ir.data[k]=ir.data[k+1]=ir.data[k+2]=ro;ir.data[k+3]=255}
 x.putImageData(im,0,0);y.putImageData(ir,0,0);const T=q=>{const t=new THREE.CanvasTexture(q);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,1);return t};
 const m=T(c);m.encoding=THREE.sRGBEncoding;return new THREE.MeshStandardMaterial({map:m,roughnessMap:T(r),roughness:1,metalness:.15,flatShading:true})}
const COAL=tex(),NUG=new THREE.MeshStandardMaterial({color:0x1a1c22,roughness:.15,metalness:.4,flatShading:true}),NG=new THREE.OctahedronGeometry(.13,0);
function makeCoal(g){const m=g.children[0];if(!m||g.userData.ore)return;g.userData.coal=1;m.material=COAL;
 for(let i=0;i<6;i++){const a=Math.random()*6.28,e=.15+Math.random()*1.1,u=new THREE.Mesh(NG,NUG);u.position.set(Math.cos(a)*Math.cos(e)*.66,m.position.y+Math.sin(e)*.66*m.scale.y,Math.sin(a)*Math.cos(e)*.66);u.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);u.scale.setScalar(.6+Math.random()*.7);u.castShadow=true;g.add(u)}}

/* ---------- на карті: ~12% звичайних скель стають вугільними; біля початку шляху — щонайменше 3 ---------- */
const MORE={forest:1,mead:1,swamp:1,tundra:1};
for(const o of RK){if(!o.m||o.m.userData.ore)continue;let b='';try{b=BIO(o.x,o.z)}catch(_){}if(Math.random()<(MORE[b]?.15:.08))makeCoal(o.m)}
{const near=RK.filter(o=>!o.m.userData.ore&&Math.hypot(o.x-P.x,o.z-P.z)<45).sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z));
 let have=near.filter(o=>o.m.userData.coal).length;for(const o of near){if(have>=3)break;if(!o.m.userData.coal&&Math.hypot(o.x-P.x,o.z-P.z)>8){makeCoal(o.m);have++}}}
/* розбита жила виростає знову (в іншому місці) як вугільна */
let pend=0;const _mk=mkRock;mkRock=function(){const g=_mk.apply(this,arguments);if(pend>0&&!g.userData.ore){pend--;makeCoal(g)}return g};

/* ---------- добування ---------- */
let sh=0;const tell=t=>{if(Date.now()-sh>2500){sh=Date.now();msg(t)}};
const _gh=window.gHit,_fb=window.fellB;
window.gHit=function(k,o){if(k!='s'||!o.m.userData.coal)return _gh.apply(this,arguments);
 const t=TT[eq.tool];if(!t||t.k!='s'){tell('⛏️ Вугілля не добути руками: візьміть будь-яку кирку');return -1}
 if(!o.mx)o.mx=o.hp=10;o.hp-=t.d;const n=t.t>=3?2:(t.t>=2?1+(Math.random()<.3?1:0):1);inv.coal=(inv.coal||0)+n;
 return{y:n,dm:t.d,tx:['+'+n+' ⚫']}};
window.fellB=function(k,o){if(k!='s'||!o.m.userData.coal)return _fb.apply(this,arguments);
 const t=TT[eq.tool],n=t&&t.t>=3?3:2;inv.coal=(inv.coal||0)+n;res.s+=1;try{st.s+=1}catch(_){}pend++;
 const p=o.m.position.clone();setTimeout(()=>dmg('+'+n+' ⚫ +1 🪨',{position:p},'#c8ccd6'),250)};
window.coalVeins=()=>RK.filter(o=>o.m.userData.coal);
}catch(e){console.warn('coal',e)}})();
