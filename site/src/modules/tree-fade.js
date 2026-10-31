/* Дерева між камерою й героєм стають напівпрозорими (замість того, щоб камера відскакувала вбік чи наближалась — premium-fx.js).
   Кожен кадр перевіряємо відрізок «голова героя → камера» проти крони кожного дерева в радіусі 25 м; таке дерево плавно
   тьмяніє до 45 % непрозорості, а коли більше не заважає — повертається до звичайного вигляду (і своїх спільних матеріалів). */
(function(){try{
if(typeof THREE=='undefined')return;
const G=n=>{try{return eval(n)}catch(_){return undefined}};
const TR=G('trees'),cam_=G('cam'),pl_=G('pl'),ANI_=G('ANI');if(!TR||!cam_||!pl_||!ANI_)return;
window.plTreeFade=1;
const MIN=.45,live=new Set();let last=performance.now();
/* відрізок (hx,hz)→(cx,cz) проти кола (ox,oz,r): параметр t першого перетину або -1 */
function seg(hx,hz,cx,cz,ox,oz,r){const dx=cx-hx,dz=cz-hz,a=dx*dx+dz*dz;if(a<1e-6)return-1;let t=((ox-hx)*dx+(oz-hz)*dz)/a;t=Math.max(0,Math.min(1,t));
 const px=hx+dx*t-ox,pz=hz+dz*t-oz;return px*px+pz*pz<r*r?t:-1}
function setFade(o,v){const g=o.m;if(!g)return;const ud=g.userData;
 if(v>=.999){if(ud.fadeOn){g.traverse(m=>{if(m.isMesh&&m.userData.mat0){const c=m.material;m.material=m.userData.mat0;delete m.userData.mat0;if(c&&c!==m.material)c.dispose()}});ud.fadeOn=0}return}
 if(!ud.fadeOn){g.traverse(m=>{if(!m.isMesh||m.userData.mat0)return;m.userData.mat0=m.material;const c=m.material.clone();c.transparent=true;c.depthWrite=false;m.material=c});ud.fadeOn=1}
 g.traverse(m=>{if(m.isMesh&&m.userData.mat0)m.material.opacity=v})}
ANI_.push(()=>{const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;
 const hx=pl_.position.x,hz=pl_.position.z,hy=pl_.position.y+1.2,cx=cam_.position.x,cz=cam_.position.z,cy=cam_.position.y;
 const want=new Set();
 for(const o of TR){if(!o||!o.m)continue;const dx=o.x-hx,dz=o.z-hz;if(dx*dx+dz*dz>625)continue;const s=o.m.scale.x||1;
  const t=seg(hx,hz,cx,cz,o.x,o.z,1.25*s);if(t<0)continue;const y=hy+(cy-hy)*t,base=o.m.position.y;
  if(y>base+.4&&y<base+4.6*s)want.add(o)}
 for(const o of want)live.add(o);
 for(const o of live){const ud=o.m&&o.m.userData;if(!ud){live.delete(o);continue}const tgt=want.has(o)?MIN:1;ud.fade=ud.fade==null?1:ud.fade;
  ud.fade+=(tgt-ud.fade)*(1-Math.exp(-dt*10));if(Math.abs(ud.fade-tgt)<.01)ud.fade=tgt;setFade(o,ud.fade);if(ud.fade>=1&&!want.has(o))live.delete(o)}});
}catch(e){console.warn('tree-fade:',e)}})();
