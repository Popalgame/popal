/* Дерева між камерою й героєм стають напівпрозорими (замість того, щоб камера відскакувала вбік чи наближалась — premium-fx.js).
   Кожен кадр перевіряємо відрізок «голова героя → камера» проти крони кожного дерева в радіусі 25 м; таке дерево плавно
   тьмяніє до 45 % непрозорості, а коли більше не заважає — повертається до звичайного вигляду (і своїх спільних матеріалів).
   0.2.7: так само — Попал-центр, скрині й будівлі бази (плавильня, верстаки, кухня…): камера біля них більше не смикається. */
(function(){try{
if(typeof THREE=='undefined')return;
const G=n=>{try{return eval(n)}catch(_){return undefined}};
const TR=G('trees'),cam_=G('cam'),pl_=G('pl'),ANI_=G('ANI');if(!TR||!cam_||!pl_||!ANI_)return;
window.plTreeFade=1;window.plBaseFade=1;
const MIN=.45,live=new Set();let last=performance.now();
/* відрізок (hx,hz)→(cx,cz) проти кола (ox,oz,r): параметр t першого перетину або -1 */
function seg(hx,hz,cx,cz,ox,oz,r){const dx=cx-hx,dz=cz-hz,a=dx*dx+dz*dz;if(a<1e-6)return-1;let t=((ox-hx)*dx+(oz-hz)*dz)/a;t=Math.max(0,Math.min(1,t));
 const px=hx+dx*t-ox,pz=hz+dz*t-oz;return px*px+pz*pz<r*r?t:-1}
function setFade(g,v){const ud=g.userData;
 if(v>=.999){if(ud.fadeOn){g.traverse(m=>{if(m.isMesh&&m.userData.mat0){const c=m.material;m.material=m.userData.mat0;delete m.userData.mat0;if(c&&c!==m.material)c.dispose()}});ud.fadeOn=0}return}
 if(!ud.fadeOn){g.traverse(m=>{if(!m.isMesh||m.userData.mat0||Array.isArray(m.material))return;m.userData.mat0=m.material;const c=m.material.clone();c.transparent=true;c.depthWrite=false;m.material=c});ud.fadeOn=1}
 g.traverse(m=>{if(m.isMesh&&m.userData.mat0)m.material.opacity=m.userData.mat0.transparent?Math.min(m.userData.mat0.opacity,v):v})}
/* висота й радіус будівлі — з габаритів моделі, один раз */
const _bx=new THREE.Box3(),_sz=new THREE.Vector3();
function dims(g){const ud=g.userData;if(ud.fdim)return ud.fdim;_bx.setFromObject(g);_bx.getSize(_sz);
 return ud.fdim=isFinite(_sz.y)&&_sz.y>0?{h:_sz.y,r:Math.max(.5,Math.min(3,Math.max(_sz.x,_sz.z)/2))}:{h:1.5,r:.8}}
const colR=()=>window.colR||{};
function bases(){const L=[],cr=colR();
 for(const b of window.BPLACED||[])if(b.g&&b.g.parent&&b.g.visible&&cr[b.id]!==0)L.push(b.g);/* 0 — пласкі (грядка, лежанки) */
 for(const g of window.chMeshes||[])if(g.parent)L.push(g);
 if(window.plCenG&&window.plCenG.parent)L.push(window.plCenG);return L}
ANI_.push(()=>{const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;
 const hx=pl_.position.x,hz=pl_.position.z,hy=pl_.position.y+1.2,cx=cam_.position.x,cz=cam_.position.z,cy=cam_.position.y;
 const want=new Set();
 for(const o of TR){if(!o||!o.m)continue;const dx=o.x-hx,dz=o.z-hz;if(dx*dx+dz*dz>625)continue;const s=o.m.scale.x||1;
  const t=seg(hx,hz,cx,cz,o.x,o.z,1.25*s);if(t<0)continue;const y=hy+(cy-hy)*t,base=o.m.position.y;
  if(y>base+.4&&y<base+4.6*s)want.add(o.m)}
 for(const g of bases()){const p=g.position,dx=p.x-hx,dz=p.z-hz;if(dx*dx+dz*dz>625)continue;const d=dims(g);
  const t=seg(hx,hz,cx,cz,p.x,p.z,d.r+.25);if(t<0)continue;const y=hy+(cy-hy)*t;
  if(y<p.y+d.h+.2)want.add(g)}
 for(const g of want)live.add(g);
 for(const g of live){const ud=g.userData;if(!g.parent){setFade(g,1);live.delete(g);continue}const tgt=want.has(g)?MIN:1;ud.fade=ud.fade==null?1:ud.fade;
  ud.fade+=(tgt-ud.fade)*(1-Math.exp(-dt*10));if(Math.abs(ud.fade-tgt)<.01)ud.fade=tgt;setFade(g,ud.fade);if(ud.fade>=1&&!want.has(g))live.delete(g)}});
}catch(e){console.warn('tree-fade:',e)}})();
