/* Пал захищає гравця: коли дика істота б'є гравця, обраний пал біжить у відповідь */
window.palDefend=function(w){
 try{
  const p=pals[selP];if(!p||!w||p.nd||(window.palOn&&!palOn()))return;
  const r=window.PW?PW.palHit(p,w):null,dm=r?r.v:Math.round((6+3*(p.lv||1))*(window.elM?elM(p.ty,w.ty):1));/* 0.5.x: формула урону — combat.js */
  /* 0.5.x: ривок не в саму істоту (вона стоїть упритул до героя), а збоку від неї ~1.4 м — з того боку, що ближчий до попала */
  const ux=P.x-w.x,uz=P.z-w.z,ul=Math.hypot(ux,uz)||1,bx=ux/ul,bz=uz/ul,c=-.17,sn=.98;
  const spots=[1,-1].map(sg=>[w.x+(bx*c-bz*sn*sg)*1.4,w.z+(bx*sn*sg+bz*c)*1.4]).sort((a,b)=>Math.hypot(a[0]-p.x,a[1]-p.z)-Math.hypot(b[0]-p.x,b[1]-p.z)),tx=spots[0][0],tz=spots[0][1];
  let k=0;const iv=setInterval(()=>{p.x+=(tx-p.x)*.35;p.z+=(tz-p.z)*.35;p.a=Math.atan2(w.x-p.x,w.z-p.z);if(++k>=5)clearInterval(iv)},40);
  setTimeout(()=>{
   if(!wild.includes(w))return;
   w.hp-=dm;flash(w);dmg(dm+(r?r.tag:''),w.m,'#9fe4ff');
   if(w.hp<=0){
    sc.remove(w.m);wild.splice(wild.indexOf(w),1);
    res[T[w.ty].d]+=2;st.k++;st[T[w.ty].d]+=2;addXp(window.wXp?wXp(w,15):15);
    msg('🐾 Помічник захистив вас! '+T[w.ty].n+' переможено, +2 ресурси');hud();
   }
  },220);
 }catch(e){}
};

/* 0.5.x: особистий простір за реальним розміром моделей — дика істота не залазить у героя, обраний попал — у героя й у диких істот.
   Радіус моделі заміряється один раз (габарити по x/z) і запамʼятовується в об'єкті */
const RAD=o=>{if(o._r==null){let r=.5;try{const b=new THREE.Box3().setFromObject(o.m),sz=b.getSize(new THREE.Vector3());if(isFinite(sz.x)&&sz.x>0)r=Math.min(2.5,Math.max(.3,Math.max(sz.x,sz.z)*.42))}catch(_){}o._r=r}return o._r};
const HERO_R=.35;
if(typeof ANI!=='undefined')ANI.push(()=>{
 for(const w of wild){if(!w.m)continue;const dx=w.x-P.x,dz=w.z-P.z;if(Math.abs(dx)>4||Math.abs(dz)>4)continue;const r=RAD(w)+HERO_R,d=Math.hypot(dx,dz);
  if(d<r){const k=d>1e-3?r/d:0;w.x=P.x+(k?dx*k:r);w.z=P.z+(k?dz*k:0);w.m.position.x=w.x;w.m.position.z=w.z}}
 const p=pals[selP];if(!p||!p.m||!p.m.visible)return;let mv=0;const pr=RAD(p);
 const push=(x,z,r)=>{const dx=p.x-x,dz=p.z-z,d=Math.hypot(dx,dz);if(d>=r)return;if(d>1e-3){p.x=x+dx/d*r;p.z=z+dz/d*r}else{p.x=x+r}mv=1};
 for(const w of wild)if(w.m&&Math.abs(w.x-p.x)<5&&Math.abs(w.z-p.z)<5)push(w.x,w.z,(RAD(w)+pr)*.85);push(P.x,P.z,pr+HERO_R+.2);
 if(mv)p.m.position.set(p.x,p.m.position.y,p.z)});
