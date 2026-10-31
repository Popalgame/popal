/* 0.1.23: будівлі тверді (з 0.5.x — ще й дерева, скелі та рудні жили). Крізь Попал-центр, скрині, будівлі бази (ліжко, кухню, верстак, плавильню, грядку, ліхтар, паркан)
   і стіни з «Будови» не проходять ні гравець, ні попали, ні дикі істоти. Щоб ніхто не застрягав:
   • рух ковзає вздовж перешкоди замість зупинки;
   • якщо гравця «накрило» новою будівлею — його м’яко виштовхує назовні;
   • попал, який кілька секунд не може дійти до цілі (стіна без проходу), перескакує до неї зі спалахом;
   • попал-супутник, що відстав за стіною, з’являється поруч із гравцем. */
(function(){try{
const BR={B_bed:1.0,B_kit:.75,B_wb:.85,B_wb2:.95,B_wb3:1.0,B_rep:.8,B_fur:1.15,B_garden:0,B_nest2:0,B_nest5:0,B_lamp:.25,B_fen:.9};/* 0 — прохідні: грядка й лежанки */
/* круглі перешкоди: центр, скрині, будівлі бази */
/* 0.5.x: дерева (стовбур) і скелі / рудні жили теж тверді. Беремо лише ті, що в кількох метрах від точки (x,z) — їх у світі сотні.
   Радіус скелі — 80% її півширини, не більше 0.8 м: так попали-працівники й далі підходять на 1.25 м і добувають */
const G_=n=>{try{return eval(n)}catch(_){return undefined}};
const TREE_R=.4,rockR=o=>{if(o._cr==null){let r=.7;try{const s=new THREE.Box3().setFromObject(o.m).getSize(new THREE.Vector3());if(isFinite(s.x)&&s.x>0)r=Math.min(.8,Math.max(.35,Math.max(s.x,s.z)/2*.8))}catch(_){}o._cr=r}return o._cr};
function nature(L,x,z){if(x==null)return;const T=G_('trees')||[],R=G_('rocks')||[];
 for(const o of T)if(Math.abs(o.x-x)<3&&Math.abs(o.z-z)<3)L.push({x:o.x,z:o.z,r:TREE_R});
 for(const o of R)if(o.m&&Math.abs(o.x-x)<3.5&&Math.abs(o.z-z)<3.5)L.push({x:o.x,z:o.z,r:rockR(o)})}
function cols(x,z){const L=[...(window.plSceneryObstacles||[])],C=inv._cen;if(C)L.push({x:C[0],z:C[1],r:2.2});nature(L,x,z);
 for(const c of inv._ch||[])L.push({x:c.x,z:c.z,r:.7});
 for(const b of window.BPLACED||[]){const r=BR[b.id];if(r===0)continue;L.push({x:b.x,z:b.z,r:r||.8})}return L}
window.colList=cols;window.colR=BR;
const wall=(ax,az,bx,bz)=>{try{return !!(window.BLDBLK&&BLDBLK(ax,az,bx,bz,H(bx,bz)))}catch(_){return false}};
/* виштовхування з кіл (ковзання по дотичній виходить само собою) */
function circles(x,z,r,L){for(const c of L){const dx=x-c.x,dz=z-c.z,d=Math.hypot(dx,dz),R=c.r+r;if(d<R){if(d<1e-4){x=c.x+R}else{x=c.x+dx/d*R;z=c.z+dz/d*R}}}return[x,z]}
/* крок з (ax,az) у (bx,bz): стіни — ковзання по осях, кола — виштовхування */
function step(ax,az,bx,bz,r){let x=bx,z=bz;if(wall(ax,az,x,z)){if(!wall(ax,az,x,az))z=az;else if(!wall(ax,az,ax,z))x=ax;else{x=ax;z=az}}
 const q=circles(x,z,r,cols(x,z));if(wall(ax,az,q[0],q[1]))return[x,z];return q}
window.colStep=step;
window.colBlocked=(ax,az,bx,bz,r)=>{if(wall(ax,az,bx,bz))return true;for(const c of cols(bx,bz)){const R=c.r+r;if(Math.hypot(bx-c.x,bz-c.z)<R&&Math.hypot(ax-c.x,az-c.z)>=R-.05)return true}return false};

/* ---------- гравець: стіни вже обробляє building.js (BLDC), тут — кола ---------- */
const b0=window.BLDC;
window.BLDC=function(ox,oz){if(b0)b0.apply(this,arguments);const q=circles(P.x,P.z,.38,cols(P.x,P.z));P.x=q[0];P.z=q[1]};

/* ---------- попал-супутник ---------- */
window.colPal=function(p,ox,oz,dd){const q=step(ox,oz,p.x,p.z,.4);p.x=q[0];p.z=q[1];
 const moved=Math.hypot(p.x-ox,p.z-oz);p._stk=(dd>2.5&&moved<.004)?(p._stk||0)+1:0;
 if(p._stk>90||dd>25){p._stk=0;const a=(P.face||0)+Math.PI,t=step(P.x,P.z,P.x+Math.sin(a)*1.3,P.z+Math.cos(a)*1.3,.4);p.x=t[0];p.z=t[1];if(window.plBurst)plBurst(p.x,H(p.x,p.z)+.6,p.z,0x7fe3f5,14,1.6,.3)}};

/* ---------- попали бригади: крок з колізією + рятування від застрягання ---------- */
window.colPalStep=function(p,nx,nz,tx,tz,stop,dt){const q=step(p.x,p.z,nx,nz,.42);const ox=p.x,oz=p.z;p.x=q[0];p.z=q[1];
 const want=Math.hypot(nx-ox,nz-oz),got=Math.hypot(p.x-ox,p.z-oz),A=p.ai||{};
 A.stk=(want>1e-4&&got<want*.35)?(A.stk||0)+dt:Math.max(0,(A.stk||0)-dt*2);
 if(A.stk>3.5){A.stk=0;const dx=p.x-tx,dz=p.z-tz,d=Math.hypot(dx,dz)||1,k=Math.max(stop,1)+.3;let x=tx+dx/d*k,z=tz+dz/d*k;
  const r=circles(x,z,.42,cols(x,z));x=r[0];z=r[1];if(window.plBurst){plBurst(p.x,H(p.x,p.z)+.6,p.z,0x7fe3f5,12,1.5,.3);plBurst(x,H(x,z)+.6,z,0x7fe3f5,12,1.5,.3)}p.x=x;p.z=z}};
}catch(e){console.warn('collide',e)}})();
