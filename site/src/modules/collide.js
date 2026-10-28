/* 0.1.23: будівлі тверді. Крізь Попал-центр, скрині, будівлі бази (ліжко, кухню, верстак, плавильню, грядку, ліхтар, паркан)
   і стіни з «Будови» не проходять ні гравець, ні попали, ні дикі істоти. Щоб ніхто не застрягав:
   • рух ковзає вздовж перешкоди замість зупинки;
   • якщо гравця «накрило» новою будівлею — його м’яко виштовхує назовні;
   • попал, який кілька секунд не може дійти до цілі (стіна без проходу), перескакує до неї зі спалахом;
   • попал-супутник, що відстав за стіною, з’являється поруч із гравцем. */
(function(){try{
const BR={B_bed:1.0,B_kit:.75,B_wb:.85,B_fur:.8,B_farm:1.0,B_lamp:.25,B_fen:.9};
/* круглі перешкоди: центр, скрині, будівлі бази */
function cols(){const L=[],C=inv._cen;if(C)L.push({x:C[0],z:C[1],r:2.2});
 for(const c of inv._ch||[])L.push({x:c.x,z:c.z,r:.7});
 for(const b of window.BPLACED||[])L.push({x:b.x,z:b.z,r:BR[b.id]||.8});return L}
window.colList=cols;
const wall=(ax,az,bx,bz)=>{try{return !!(window.BLDBLK&&BLDBLK(ax,az,bx,bz,H(bx,bz)))}catch(_){return false}};
/* виштовхування з кіл (ковзання по дотичній виходить само собою) */
function circles(x,z,r,L){for(const c of L){const dx=x-c.x,dz=z-c.z,d=Math.hypot(dx,dz),R=c.r+r;if(d<R){if(d<1e-4){x=c.x+R}else{x=c.x+dx/d*R;z=c.z+dz/d*R}}}return[x,z]}
/* крок з (ax,az) у (bx,bz): стіни — ковзання по осях, кола — виштовхування */
function step(ax,az,bx,bz,r){let x=bx,z=bz;if(wall(ax,az,x,z)){if(!wall(ax,az,x,az))z=az;else if(!wall(ax,az,ax,z))x=ax;else{x=ax;z=az}}
 const q=circles(x,z,r,cols());if(wall(ax,az,q[0],q[1]))return[x,z];return q}
window.colStep=step;
window.colBlocked=(ax,az,bx,bz,r)=>{if(wall(ax,az,bx,bz))return true;for(const c of cols()){const R=c.r+r;if(Math.hypot(bx-c.x,bz-c.z)<R&&Math.hypot(ax-c.x,az-c.z)>=R-.05)return true}return false};

/* ---------- гравець: стіни вже обробляє building.js (BLDC), тут — кола ---------- */
const b0=window.BLDC;
window.BLDC=function(ox,oz){if(b0)b0.apply(this,arguments);const q=circles(P.x,P.z,.38,cols());P.x=q[0];P.z=q[1]};

/* ---------- попал-супутник ---------- */
window.colPal=function(p,ox,oz,dd){const q=step(ox,oz,p.x,p.z,.4);p.x=q[0];p.z=q[1];
 const moved=Math.hypot(p.x-ox,p.z-oz);p._stk=(dd>2.5&&moved<.004)?(p._stk||0)+1:0;
 if(p._stk>90||dd>25){p._stk=0;const a=(P.face||0)+Math.PI,t=step(P.x,P.z,P.x+Math.sin(a)*1.3,P.z+Math.cos(a)*1.3,.4);p.x=t[0];p.z=t[1];if(window.plBurst)plBurst(p.x,H(p.x,p.z)+.6,p.z,0x7fe3f5,14,1.6,.3)}};

/* ---------- попали бригади: крок з колізією + рятування від застрягання ---------- */
window.colPalStep=function(p,nx,nz,tx,tz,stop,dt){const q=step(p.x,p.z,nx,nz,.42);const ox=p.x,oz=p.z;p.x=q[0];p.z=q[1];
 const want=Math.hypot(nx-ox,nz-oz),got=Math.hypot(p.x-ox,p.z-oz),A=p.ai||{};
 A.stk=(want>1e-4&&got<want*.35)?(A.stk||0)+dt:Math.max(0,(A.stk||0)-dt*2);
 if(A.stk>3.5){A.stk=0;const dx=p.x-tx,dz=p.z-tz,d=Math.hypot(dx,dz)||1,k=Math.max(stop,1)+.3;let x=tx+dx/d*k,z=tz+dz/d*k;
  const r=circles(x,z,.42,cols());x=r[0];z=r[1];if(window.plBurst){plBurst(p.x,H(p.x,p.z)+.6,p.z,0x7fe3f5,12,1.5,.3);plBurst(x,H(x,z)+.6,z,0x7fe3f5,12,1.5,.3)}p.x=x;p.z=z}};
}catch(e){console.warn('collide',e)}})();
