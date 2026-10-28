/* 0.1.2: «живий» герой — розбирає модель на частини (голова, тулуб, руки, ноги)
   і анімує: дихання, ходьба/біг, плавання, удар, кидок кулі.
   Працює з будь-якою зачіскою/одягом/рюкзаком з редактора героя. */
(function(){try{
const G=n=>{try{return eval(n)}catch(e){return undefined}};const GC=(()=>{const c={};return n=>c[n]||(c[n]=G(n))})();
const RIGS=new Set();
function rig(g,lk){
 const f=lk&&lk.g==1,meshes=g.children.slice();
 /* плечі: шукаємо кулі плечей, щоб знайти точку обертання рук */
 let sh=.29;for(const m of meshes){if(m.isMesh&&Math.abs(m.position.y-1.06)<.02&&Math.abs(m.position.x)>.2&&Math.abs(m.position.x)<.4){sh=Math.abs(m.position.x);break}}
 const mk=(x,y,z)=>{const p=new THREE.Group();p.position.set(x,y,z);return p};
 const body=mk(0,.55,0),head=mk(0,1.13-.55,0),armL=mk(-sh-.01,1.06-.55,0),armR=mk(sh+.01,1.06-.55,0),legL=mk(-.11,.55,0),legR=mk(.11,.55,0);
 body.add(head,armL,armR);
 const put=(m,p,ox,oy,oz)=>{g.remove(m);m.position.x-=ox;m.position.y-=oy;m.position.z-=oz;p.add(m)};
 for(const m of meshes){const{x,y,z}=m.position,ax=Math.abs(x);
  if(z<-.28&&y<1.28){put(m,body,0,.55,0);continue}                       /* рюкзак, кирка за спиною */
  if(y>=1.12){put(m,head,0,1.13,0);continue}                              /* шия, голова, волосся */
  if(ax>=sh-.06&&y>.5&&z>-.2){const s=x<0;put(m,s?armL:armR,s?-sh-.01:sh+.01,1.06,0);continue} /* руки, долоні, сокира */
  if(y<.5&&ax<.24){const s=x<0;put(m,s?legL:legR,s?-.11:.11,.55,0);continue} /* ноги, черевики */
  put(m,body,0,.55,0)}
 g.add(body,legL,legR);
 if(f){legL.scale.set(.92,1,.92);legR.scale.set(.92,1,.92)}
 g.userData.rig={body,head,armL,armR,legL,legR,ph:Math.random()*6,act:null,actT:0,sw:0};
 RIGS.add(g)}
/* обгортаємо побудову героя: після будь-якої зміни зовнішності — новий скелет */
const _bh=window.buildHero;
if(typeof _bh==='function')window.buildHero=function(g,lk){const r=_bh.apply(this,arguments);try{rig(g,lk||{})}catch(e){console.warn('rig',e)}return r};
/* перебудувати вже створених героїв */
try{const pl=GC('pl'),hp2=G('hp2'),lk=G('look')||G('DLOOK');if(pl)window.buildHero(pl,lk);if(hp2)window.buildHero(hp2,lk)}catch(e){}
/* ---------- дії ---------- */
function act(kind){const pl=GC('pl');if(!pl||!pl.userData.rig)return;const r=pl.userData.rig;r.act=kind;r.actT=0}
window.heroAct=act;
document.addEventListener('pointerdown',e=>{if(!e.target.closest)return;
 if(e.target.closest('#hit')){const P=GC('P'),N=G('NPCS')||[];if(P&&N.some(n=>Math.hypot(n.x-P.x,n.z-P.z)<3.2))return;act('hit')}},true);
document.addEventListener('click',e=>{if(!e.target.closest||!e.target.closest('#throw'))return;const n0=(G('fx')||[]).length;setTimeout(()=>{if((G('fx')||[]).length>n0)act('throw')},0)},true);
/* ---------- анімація ---------- */
const DUR={hit:.38,throw:.5};
let lt=performance.now(),lx=null,lz=null,spd=0;
const lerp=(a,b,k)=>a+(b-a)*k;
(function loop(){requestAnimationFrame(loop);const n=performance.now(),dt=Math.min(.05,(n-lt)/1000);lt=n;const t=n/1000;
 const pl=GC('pl'),P=GC('P'),H=window.H;
 for(const g of RIGS){const r=g.userData.rig;if(!r||!g.parent){if(!g.parent)continue;continue}
  const isP=g===pl;let v=0,swim=false;
  if(isP&&P){const mv=lx==null?0:Math.hypot(P.x-lx,P.z-lz)/Math.max(dt,1e-3);lx=P.x;lz=P.z;spd=lerp(spd,Math.min(1,mv/5),Math.min(1,dt*10));v=G('menuO')?0:spd;swim=!!(H&&H(P.x,P.z)<-1.15)}
  r.sw=lerp(r.sw,swim?1:0,Math.min(1,dt*5));
  const{body,head,armL,armR,legL,legR}=r;
  /* базова поза: дихання */
  const br=Math.sin(t*2.2+r.ph);
  let bY=br*.008,bX=0,bZ=0,hX=-br*.02,hY=0,aLx=br*.04,aRx=-br*.04,aLz=-.08,aRz=.08,lLx=0,lRx=0;
  /* ходьба / біг */
  if(v>.05){r.ph+=dt*(6+v*6);const s=Math.sin(r.ph),c=Math.cos(r.ph),A=.35+v*.45;
   lLx=s*A;lRx=-s*A;aLx=-s*A*.85;aRx=s*A*.85;bY=Math.abs(c)*.035*v;bX=.06*v;hX=-.04*v;bZ=s*.03}
  /* плавання */
  if(r.sw>.01){const w=r.sw,s=Math.sin(t*5);bX=lerp(bX,.9,w);hX=lerp(hX,-.75,w);
   aLx=lerp(aLx,-2.4+Math.max(0,s)*1.8,w);aRx=lerp(aRx,-2.4+Math.max(0,-s)*1.8,w);aLz=lerp(aLz,-.5,w);aRz=lerp(aRz,.5,w);
   lLx=lerp(lLx,Math.sin(t*9)*.35,w);lRx=lerp(lRx,-Math.sin(t*9)*.35,w)}
  /* удар і кидок — права рука (та сокира в ній) */
  if(r.act){r.actT+=dt;const k=Math.min(1,r.actT/DUR[r.act]);
   if(r.act=='hit'){const up=k<.35?k/.35:1,dn=k<.35?0:(k-.35)/.65;aRx=-2.5*up+3.0*dn*(1-dn*.4);aRz=.25;bZ=-.08*Math.sin(k*Math.PI);hY=.15*Math.sin(k*Math.PI)}
   else if(r.act=='throw'){const wind=k<.4?k/.4:1,rel=k<.4?0:(k-.4)/.6;aRx=-1.2*wind-1.6*Math.sin(rel*Math.PI)*.6+rel*1.4;aRz=.35;aLx=.5*Math.sin(k*Math.PI);bZ=-.06*Math.sin(k*Math.PI);bX+= .1*Math.sin(rel*Math.PI)}
   if(k>=1)r.act=null}
  body.position.y=lerp(body.position.y,.55+bY,Math.min(1,dt*20));body.rotation.x=lerp(body.rotation.x,bX,Math.min(1,dt*12));body.rotation.z=lerp(body.rotation.z,bZ,Math.min(1,dt*12));
  head.rotation.x=lerp(head.rotation.x,hX,Math.min(1,dt*10));head.rotation.y=lerp(head.rotation.y,hY,Math.min(1,dt*10));
  const kA=r.act?Math.min(1,dt*30):Math.min(1,dt*14);
  armL.rotation.x=lerp(armL.rotation.x,aLx,kA);armR.rotation.x=lerp(armR.rotation.x,aRx,kA);armL.rotation.z=lerp(armL.rotation.z,aLz,kA);armR.rotation.z=lerp(armR.rotation.z,aRz,kA);
  legL.rotation.x=lerp(legL.rotation.x,lLx,Math.min(1,dt*16));legR.rotation.x=lerp(legR.rotation.x,lRx,Math.min(1,dt*16));
  /* у воді — тіло горизонтально, ноги позаду */
  legL.position.z=legR.position.z=lerp(legL.position.z,-r.sw*.35,Math.min(1,dt*8));legL.position.y=legR.position.y=.55+r.sw*.25}
})();
}catch(e){console.warn('hero-anim',e)}})();
