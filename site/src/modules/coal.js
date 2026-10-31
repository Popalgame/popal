/* 0.1.28: вугілля ⚫ — за тим самим принципом, що й залізна руда (ore-veins.js): лише з вугільних жил (сірий камінь із чорними
   блискучими прожилками й антрацитовими самородками), лише кам’яною або металевою киркою, ті самі шанси, міцність і розподіл
   по карті (у горах, тундрі й на попелищі частіше). Вугілля — найкраще паливо для плавильні: 1 вугілля = 3 злитки (деревина — 1). */
(function(){try{
const G=n=>{try{return eval(n)}catch(e){return undefined}};
const RK=G('rocks');if(!RK)return;
IT.coal=['⚫','Вугілля'];if(inv.coal==null)inv.coal=0;

/* ---------- текстура як у залізної жили: сірий камінь із прожилками, тільки прожилки — чорні блискучі антрацитові ---------- */
function tex(){const S=256,c=document.createElement('canvas'),r=document.createElement('canvas');c.width=c.height=r.width=r.height=S;
 const x=c.getContext('2d'),y=r.getContext('2d'),im=x.createImageData(S,S),ir=y.createImageData(S,S);
 const vn=(cell,sd)=>{const n=S/cell,g=new Float32Array(n*n);let s2=sd;for(let i=0;i<g.length;i++){s2=(s2*16807)%2147483647;g[i]=s2/2147483647}const at=(a,b)=>g[((b%n+n)%n)*n+((a%n+n)%n)];
  return(u,v)=>{const X=u/cell,Y=v/cell,a=Math.floor(X),b=Math.floor(Y),fx=X-a,fy=Y-b,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),p=at(a,b),q=at(a+1,b),w=at(a,b+1),e=at(a+1,b+1);return p+(q-p)*sx+(w-p+(p-q+e-w)*sx)*sy}};
 const b1=vn(64,31),b2=vn(16,37),vein=[vn(64,41),vn(32,43)],fl=vn(4,47);
 for(let v=0;v<S;v++)for(let u=0;u<S;u++){const k=(v*S+u)*4,b=b1(u,v)*.7+b2(u,v)*.3;let L=70+b*70,ro=235,cr=L,cg=L,cb=L*1.04;
  const vv=vein[0](u,v)*.65+vein[1](u,v)*.35,rd=1-Math.abs(vv*2-1);
  if(rd>.9){const t=Math.min(1,(rd-.9)/.06);cr=cg=cb=lerp(30,8,t);cb+=4;ro=lerp(90,22,t)}else if(rd>.84){const t=(rd-.84)/.06;cr=lerp(cr,40,t);cg=lerp(cg,40,t);cb=lerp(cb,44,t)}
  const f=fl(u,v);if(f>.955&&rd>.8){cr=cg=185;cb=200;ro=20}
  im.data[k]=cr;im.data[k+1]=cg;im.data[k+2]=cb;im.data[k+3]=255;ir.data[k]=ir.data[k+1]=ir.data[k+2]=ro;ir.data[k+3]=255}
 x.putImageData(im,0,0);y.putImageData(ir,0,0);const T=q=>{const t=new THREE.CanvasTexture(q);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,1);return t};
 const m=T(c);m.encoding=THREE.sRGBEncoding;return new THREE.MeshStandardMaterial({map:m,roughnessMap:T(r),roughness:1,metalness:.1,flatShading:true})}
function lerp(a,b,t){return a+(b-a)*t}
const COAL=tex(),NUG=new THREE.MeshStandardMaterial({color:0x1a1c22,roughness:.15,metalness:.4,flatShading:true}),NG=new THREE.OctahedronGeometry(.13,0);
function makeCoal(g){const m=g.children[0];if(!m||g.userData.ore)return;g.userData.coal=1;m.material=COAL;
 for(let i=0;i<6;i++){const a=Math.random()*6.28,e=.15+Math.random()*1.1,u=new THREE.Mesh(NG,NUG);u.position.set(Math.cos(a)*Math.cos(e)*.66,m.position.y+Math.sin(e)*.66*m.scale.y,Math.sin(a)*Math.cos(e)*.66);u.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);u.scale.setScalar(.6+Math.random()*.7);u.castShadow=true;g.add(u)}}

/* ---------- на карті — як залізні жили: у горах, тундрі й на попелищі частіше; біля початку шляху — щонайменше 3 ---------- */
const RICH={rock:1,snow:1,ash:1,tundra:1};
for(const o of RK){if(!o.m||o.m.userData.ore)continue;let b='';try{b=BIO(o.x,o.z)}catch(_){}if(window.REALM!=='isle'&&Math.random()<(RICH[b]?.095:.035))makeCoal(o.m)}/* 0.2.6: удвічі менше *//* на Острові пробудження вугілля немає */
{const near=RK.filter(o=>!o.m.userData.ore&&Math.hypot(o.x-P.x,o.z-P.z)<45).sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z));
 let have=window.REALM==='isle'?99:near.filter(o=>o.m.userData.coal).length;for(const o of near){if(have>=2)break;if(!o.m.userData.coal&&Math.hypot(o.x-P.x,o.z-P.z)>8){makeCoal(o.m);have++}}}
/* розбита жила виростає знову (в іншому місці) як вугільна */
let pend=0;const _mk=mkRock;mkRock=function(){const g=_mk.apply(this,arguments);if(pend>0&&!g.userData.ore){pend--;makeCoal(g)}return g};

/* ---------- добування ---------- */
let sh=0;const tell=t=>{if(Date.now()-sh>2500){sh=Date.now();msg(t)}};
const _gh=window.gHit,_fb=window.fellB;
window.gHit=function(k,o){if(k!='s'||!o.m.userData.coal)return _gh.apply(this,arguments);
 const t=TT[eq.tool];if(!t||t.k!='s'||t.t<2){tell(t&&t.k=='s'?'⛏️ Дерев’яна кирка не бере вугілля: потрібна кам’яна або металева':'⛏️ Вугільну жилу не добути без кирки: створіть кам’яну кирку в Крафті');return -1}
 if(!o.mx)o.mx=o.hp=12;o.hp-=t.d;const n=t.t>=3?1+(Math.random()<.35?1:0):(Math.random()<.6?1:0);inv.coal=(inv.coal||0)+n;
 return{y:n,dm:t.d,tx:n?['+'+n+' ⚫']:[]}};
window.fellB=function(k,o){if(k!='s'||!o.m.userData.coal)return _fb.apply(this,arguments);
 const t=TT[eq.tool],n=t&&t.t>=3?3:2;inv.coal=(inv.coal||0)+n;res.s+=1;try{st.s+=1}catch(_){}regrowC();
 const p=o.m.position.clone();setTimeout(()=>dmg('+'+n+' ⚫ +1 🪨',{position:p},'#c8ccd6'),250)};
/* 0.2.6: вугільна жила відростає через 5 хвилин далеко від героя */
function regrowC(){setTimeout(()=>{const far=RK.filter(o=>o.m&&!o.m.userData.ore&&!o.m.userData.coal&&Math.hypot(o.x-P.x,o.z-P.z)>35);if(far.length)makeCoal(far[(Math.random()*far.length)|0].m)},300000)}
{const vg0=window.plVeinGone;window.plVeinGone=o=>{if(o&&o.m&&o.m.userData.coal)regrowC();if(vg0)vg0(o)}}
window.coalVeins=()=>RK.filter(o=>o.m.userData.coal);
}catch(e){console.warn('coal',e)}})();
