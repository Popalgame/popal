/* 0.1.28: намальовані значки замість смайликів — для всіх предметів (матеріали, їжа, інструменти, рюкзаки, будівлі)
   і головних кнопок (рюкзак, крафт, будова, дія). Малюються процедурно на canvas один раз під час завантаження:
   об’єм градієнтами, темний контур, блік і м’яка тінь — в одному стилі з кулями. Кулі лишаються як були. */
(function(){try{
const S=96,OL='rgba(26,18,22,.92)';
const mk=f=>{const c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');x.lineJoin='round';x.lineCap='round';f(x);return c.toDataURL()};
const lg=(x,a,b,c,d,st)=>{const g=x.createLinearGradient(a,b,c,d);st.forEach(([o,k])=>g.addColorStop(o,k));return g};
const rg=(x,cx,cy,r,st)=>{const g=x.createRadialGradient(cx-r*.35,cy-r*.4,r*.08,cx,cy,r);st.forEach(([o,k])=>g.addColorStop(o,k));return g};
const fillOL=(x,fill,lw)=>{x.fillStyle=fill;x.fill();x.lineWidth=lw||3;x.strokeStyle=OL;x.stroke()};
const shade=(x,cx,cy,rx,ry)=>{x.save();x.fillStyle='rgba(0,0,0,.3)';x.beginPath();x.ellipse(cx,cy,rx,ry,0,0,7);x.fill();x.restore()};
const rr=(x,X,Y,W,H,R)=>{x.beginPath();x.moveTo(X+R,Y);x.arcTo(X+W,Y,X+W,Y+H,R);x.arcTo(X+W,Y+H,X,Y+H,R);x.arcTo(X,Y+H,X,Y,R);x.arcTo(X,Y,X+W,Y,R);x.closePath()};
const poly=(x,P)=>{x.beginPath();P.forEach(([u,v],i)=>i?x.lineTo(u,v):x.moveTo(u,v));x.closePath()};
const shine=(x,X,Y,W,H)=>{x.save();x.fillStyle='rgba(255,255,255,.55)';x.beginPath();x.ellipse(X,Y,W,H,-.5,0,7);x.fill();x.restore()};
let sd=1;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
/* матеріали для інструментів */
const MAT={w:[[0,'#e2b47a'],[1,'#8a5a30']],s:[[0,'#cfcac2'],[1,'#6a6660']],m:[[0,'#f6f9fd'],[.5,'#b9c2d0'],[1,'#5e6676']]};
const WOODH=[[0,'#b07a46'],[1,'#5e3a1c']];

/* ---------- матеріали ---------- */
const log=()=>mk(x=>{shade(x,50,80,34,7);x.save();x.translate(48,50);x.rotate(-.35);
 rr(x,-34,-16,62,32,14);fillOL(x,lg(x,0,-16,0,16,[[0,'#a8743e'],[.5,'#7a4e28'],[1,'#4e2e14']]));
 x.strokeStyle='rgba(40,22,10,.55)';x.lineWidth=1.6;for(let i=0;i<6;i++){x.beginPath();x.moveTo(-28+i*9,-12+rnd()*4);x.lineTo(-26+i*9,12-rnd()*4);x.stroke()}
 x.beginPath();x.ellipse(28,0,10,16,0,0,7);fillOL(x,rg(x,28,0,16,[[0,'#f2d49a'],[1,'#c8955a']]));
 x.strokeStyle='rgba(140,90,40,.7)';x.lineWidth=1.4;for(const r of[3,6,9]){x.beginPath();x.ellipse(28,0,r*.62,r,0,0,7);x.stroke()}x.restore()});
const stone=()=>mk(x=>{shade(x,48,82,32,7);poly(x,[[18,60],[22,34],[40,20],[62,22],[78,40],[76,66],[54,78],[30,76]]);fillOL(x,lg(x,20,20,78,78,[[0,'#d6d2cc'],[1,'#6c6862']]));
 x.fillStyle='rgba(255,255,255,.22)';poly(x,[[22,34],[40,20],[48,40],[30,48]]);x.fill();x.fillStyle='rgba(0,0,0,.18)';poly(x,[[54,78],[76,66],[64,52],[48,60]]);x.fill();
 x.strokeStyle='rgba(30,26,24,.5)';x.lineWidth=1.5;x.beginPath();x.moveTo(48,40);x.lineTo(62,52);x.lineTo(64,52);x.stroke()});
const sticks=()=>mk(x=>{shade(x,48,82,32,6);const st=(a,dx,col)=>{x.save();x.translate(48+dx,52);x.rotate(a);rr(x,-4,-36,8,72,4);fillOL(x,lg(x,-4,0,4,0,col),2.5);x.restore()};
 st(-.5,-6,[[0,'#b88a56'],[1,'#6a4424']]);st(.45,6,[[0,'#c49660'],[1,'#704a28']]);st(-.05,0,[[0,'#a8784a'],[1,'#5e3c1e']]);
 x.strokeStyle='#7a4e28';x.lineWidth=3;x.beginPath();x.moveTo(40,58);x.bezierCurveTo(44,54,52,54,56,58);x.stroke();x.strokeStyle='#d8b070';x.lineWidth=2;x.beginPath();x.moveTo(36,52);x.lineTo(60,52);x.stroke()});
const ingot=()=>mk(x=>{shade(x,48,78,34,7);poly(x,[[16,64],[28,40],[76,40],[84,64]]);fillOL(x,lg(x,0,40,0,64,[[0,'#eef2f7'],[1,'#8c94a2']]));
 poly(x,[[28,40],[34,30],[70,30],[76,40]]);fillOL(x,lg(x,0,30,0,40,[[0,'#ffffff'],[1,'#c6ccd6']]));poly(x,[[76,40],[70,30],[78,52],[84,64]]);x.fillStyle='rgba(60,66,80,.5)';x.fill();
 x.strokeStyle='rgba(255,255,255,.8)';x.lineWidth=2;x.beginPath();x.moveTo(26,58);x.lineTo(40,46);x.stroke()});
function lump(kind){return mk(x=>{sd=kind=='ore'?11:23;const pts=[];for(let i=0;i<9;i++){const a=i/9*Math.PI*2,R=30+rnd()*9;pts.push([48+Math.cos(a)*R*1.08,52+Math.sin(a)*R*.86])}
 shade(x,50,82,32,6);poly(x,pts);x.fillStyle=lg(x,20,18,78,86,[[0,kind=='ore'?'#b4b0b4':'#8e8e96'],[1,kind=='ore'?'#5e5a60':'#3e3e46']]);x.fill();
 x.save();poly(x,pts);x.clip();
 for(let i=0;i<4;i++){let u=10+rnd()*20,v=20+rnd()*56;x.beginPath();x.moveTo(u,v);for(let k=0;k<6;k++){u+=10+rnd()*6;v+=(rnd()-.5)*16;x.lineTo(u,v)}
  x.strokeStyle=kind=='ore'?'#8a4a22':'#0c0c10';x.lineWidth=6;x.stroke();x.strokeStyle=kind=='ore'?'#f0a860':'#3a3a48';x.lineWidth=2.5;x.stroke()}
 for(let i=0;i<5;i++){const u=24+rnd()*48,v=26+rnd()*44,R=4+rnd()*4;x.beginPath();for(let k=0;k<4;k++){const a=k/4*Math.PI*2+rnd();x.lineTo(u+Math.cos(a)*R,v+Math.sin(a)*R)}x.closePath();
  x.fillStyle=kind=='ore'?(rnd()<.7?'#e8944a':'#e6ecf4'):'#14141a';x.fill();x.fillStyle=kind=='ore'?'rgba(255,240,210,.8)':'rgba(200,210,230,.85)';x.fillRect(u-1,v-R*.6,2,2)}
 x.restore();poly(x,pts);x.strokeStyle=OL;x.lineWidth=3;x.stroke()})}
/* ---------- їжа ---------- */
const berries=()=>mk(x=>{shade(x,48,82,30,6);
 x.fillStyle='#3f8a34';x.strokeStyle=OL;x.lineWidth=2.5;for(const[a,b,r]of[[34,26,-.6],[58,24,.5]]){x.save();x.translate(a,b);x.rotate(r);x.beginPath();x.ellipse(0,0,13,6,0,0,7);x.fill();x.stroke();x.restore()}
 for(const[a,b,r]of[[36,52,14],[60,50,14],[48,66,15],[30,70,11],[66,70,11]]){x.beginPath();x.arc(a,b,r,0,7);fillOL(x,rg(x,a,b,r,[[0,'#8fa6ff'],[.5,'#3a4fd6'],[1,'#1c2470']]),2.5);shine(x,a-r*.35,b-r*.4,r*.28,r*.16);x.fillStyle='rgba(20,20,60,.7)';x.beginPath();x.arc(a+r*.2,b-r*.55,1.8,0,7);x.fill()}});
const shroom=(x,cx,cy,s)=>{rr(x,cx-6*s,cy-4*s,12*s,24*s,5*s);fillOL(x,lg(x,cx-6*s,0,cx+6*s,0,[[0,'#fff8ec'],[1,'#d8c8a8']]),2.5);
 x.beginPath();x.moveTo(cx-20*s,cy);x.quadraticCurveTo(cx-18*s,cy-22*s,cx,cy-22*s);x.quadraticCurveTo(cx+18*s,cy-22*s,cx+20*s,cy);x.quadraticCurveTo(cx,cy+5*s,cx-20*s,cy);x.closePath();
 fillOL(x,rg(x,cx,cy-10*s,22*s,[[0,'#ff7a6a'],[.6,'#d6322a'],[1,'#8a1a16']]),2.5);x.fillStyle='#fff';for(const[a,b,r]of[[-9,-10,3],[4,-15,2.6],[10,-6,2.4],[-2,-5,2]]){x.beginPath();x.arc(cx+a*s,cy+b*s,r*s,0,7);x.fill()}};
const mush=()=>mk(x=>{shade(x,50,84,30,6);shroom(x,34,54,1);shroom(x,62,62,.85)});
const skewer=()=>mk(x=>{shade(x,50,84,32,6);x.save();x.translate(48,48);x.rotate(-.75);rr(x,-3,-42,6,86,3);fillOL(x,lg(x,-3,0,3,0,WOODH),2);
 for(const y of[-24,-4,16]){x.beginPath();x.ellipse(0,y,13,9,0,0,7);fillOL(x,rg(x,0,y,13,[[0,'#d89a5a'],[.6,'#9a5a2a'],[1,'#5a2e12']]),2.5);x.strokeStyle='rgba(40,16,6,.8)';x.lineWidth=2;x.beginPath();x.moveTo(-8,y-2);x.lineTo(8,y+2);x.stroke()}x.restore()});
const pie=()=>mk(x=>{shade(x,48,80,36,7);x.beginPath();x.ellipse(48,60,36,16,0,0,Math.PI);x.lineTo(12,52);x.closePath();fillOL(x,lg(x,0,52,0,76,[[0,'#c88a4a'],[1,'#7a4a22']]));
 x.beginPath();x.ellipse(48,52,36,16,0,0,7);fillOL(x,rg(x,48,52,36,[[0,'#9a5ad6'],[1,'#4a1e7a']]));
 x.save();x.beginPath();x.ellipse(48,52,34,14,0,0,7);x.clip();x.strokeStyle='#e8b26a';x.lineWidth=5;for(let i=-3;i<=3;i++){x.beginPath();x.moveTo(48+i*10-12,36);x.lineTo(48+i*10+12,68);x.stroke();x.beginPath();x.moveTo(48+i*10+12,36);x.lineTo(48+i*10-12,68);x.stroke()}x.restore();
 x.beginPath();x.ellipse(48,52,36,16,0,0,7);x.lineWidth=5;x.strokeStyle='#d89a52';x.stroke();x.lineWidth=2.5;x.strokeStyle=OL;x.stroke()});
/* ---------- інструменти (ручка по діагоналі) ---------- */
const handle=x=>{rr(x,-4.5,-40,9,82,4);fillOL(x,lg(x,-4.5,0,4.5,0,WOODH),2.5);x.strokeStyle='rgba(255,230,190,.35)';x.lineWidth=1.5;x.beginPath();x.moveTo(-1,-34);x.lineTo(-1,36);x.stroke();
 rr(x,-6,22,12,14,3);fillOL(x,lg(x,-6,0,6,0,[[0,'#7a3a22'],[1,'#3e1c10']]),2)};
const bind=(x,y)=>{x.strokeStyle='#c8a46a';x.lineWidth=2.5;for(let i=0;i<3;i++){x.beginPath();x.moveTo(-6,y-4+i*4);x.lineTo(6,y-2+i*4);x.stroke()}};
const axe=t=>mk(x=>{shade(x,50,84,30,6);x.save();x.translate(46,50);x.rotate(.62);handle(x);
 poly(x,t=='w'?[[2,-36],[16,-40],[24,-30],[24,-18],[14,-16],[2,-20]]:[[2,-38],[14,-42],[28,-36],[32,-24],[28,-12],[14,-16],[2,-18]]);
 fillOL(x,lg(x,0,-42,30,-12,MAT[t]));if(t=='m'){x.strokeStyle='rgba(255,255,255,.95)';x.lineWidth=2;x.beginPath();x.moveTo(29,-34);x.quadraticCurveTo(33,-24,28,-14);x.stroke()}
 if(t=='s'){x.fillStyle='rgba(0,0,0,.15)';poly(x,[[18,-34],[26,-30],[22,-22]]);x.fill()}bind(x,-28);x.restore()});
const pick=t=>mk(x=>{shade(x,50,84,30,6);x.save();x.translate(48,52);x.rotate(.62);handle(x);
 x.beginPath();x.moveTo(-34,-22);x.quadraticCurveTo(0,-54,34,-22);x.lineTo(30,-18);x.quadraticCurveTo(0,-40,-30,-18);x.closePath();fillOL(x,lg(x,-30,-46,30,-18,MAT[t]));
 if(t=='m'){x.strokeStyle='rgba(255,255,255,.95)';x.lineWidth=2;x.beginPath();x.moveTo(-26,-28);x.quadraticCurveTo(0,-48,26,-28);x.stroke()}bind(x,-34);x.restore()});
/* ---------- рюкзаки ---------- */
const bp1=()=>mk(x=>{shade(x,48,84,28,6);x.beginPath();x.moveTo(34,30);x.bezierCurveTo(14,40,14,82,48,82);x.bezierCurveTo(82,82,82,40,62,30);x.closePath();
 fillOL(x,rg(x,48,58,36,[[0,'#d8a468'],[1,'#7a4a24']]));x.beginPath();x.moveTo(32,30);x.quadraticCurveTo(48,20,64,30);x.lineTo(60,36);x.quadraticCurveTo(48,30,36,36);x.closePath();fillOL(x,'#a06a38',2.5);
 x.strokeStyle='#e8c890';x.lineWidth=2.5;x.beginPath();x.moveTo(40,34);x.bezierCurveTo(30,20,40,14,46,24);x.stroke();x.beginPath();x.moveTo(56,34);x.bezierCurveTo(66,20,58,14,52,24);x.stroke();
 x.strokeStyle='rgba(60,30,10,.5)';x.setLineDash([3,3]);x.beginPath();x.moveTo(30,50);x.quadraticCurveTo(48,58,66,50);x.stroke();x.setLineDash([])});
const pack=(body,flap,extra)=>mk(x=>{shade(x,48,86,30,6);
 x.strokeStyle='#3e2414';x.lineWidth=5;x.beginPath();x.moveTo(30,26);x.quadraticCurveTo(48,12,66,26);x.stroke();
 rr(x,22,26,52,56,12);fillOL(x,lg(x,22,0,74,0,body));rr(x,30,56,36,18,5);fillOL(x,lg(x,0,56,0,74,[[0,'rgba(0,0,0,.05)'],[1,'rgba(0,0,0,.25)']]),2);
 x.beginPath();x.moveTo(22,40);x.quadraticCurveTo(22,24,48,24);x.quadraticCurveTo(74,24,74,40);x.lineTo(70,52);x.quadraticCurveTo(48,58,26,52);x.closePath();fillOL(x,lg(x,0,24,0,56,flap));
 rr(x,43,46,10,10,2);fillOL(x,lg(x,43,46,53,56,[[0,'#ffe9a8'],[1,'#b8862a']]),2);if(extra)extra(x)});
const bp2=()=>pack([[0,'#b4783e'],[1,'#6a4020']],[[0,'#8a5a2e'],[1,'#5a3618']]);
const bp3=()=>pack([[0,'#7a9a4a'],[1,'#3e5a26']],[[0,'#5e7a36'],[1,'#34481c']],x=>{rr(x,20,12,56,14,7);fillOL(x,lg(x,0,12,0,26,[[0,'#d8584a'],[1,'#8a2a22']]),2.5);x.strokeStyle='#3e2414';x.lineWidth=3;for(const u of[32,64]){x.beginPath();x.moveTo(u,11);x.lineTo(u,27);x.stroke()}
 x.beginPath();x.ellipse(80,62,8,11,0,0,7);fillOL(x,lg(x,72,0,88,0,[[0,'#cfd6e0'],[1,'#6a7484']]),2.5)});
/* ---------- будівлі ---------- */
const bed=()=>mk(x=>{shade(x,48,82,38,7);rr(x,10,48,76,22,4);fillOL(x,lg(x,0,48,0,70,[[0,'#a06a38'],[1,'#5e3a1c']]));rr(x,10,30,10,44,3);fillOL(x,'#7a4a24');
 rr(x,20,40,64,14,5);fillOL(x,'#f4ede0',2.5);rr(x,22,34,20,12,5);fillOL(x,'#ffffff',2.5);rr(x,44,38,42,16,5);fillOL(x,lg(x,0,38,0,54,[[0,'#6a7ae6'],[1,'#323aa0']]),2.5)});
const kitchen=()=>mk(x=>{shade(x,48,84,34,6);x.strokeStyle='#4a2c16';x.lineWidth=4;for(const[a,b]of[[20,82],[76,82],[48,80]]){x.beginPath();x.moveTo(48,16);x.lineTo(a,b);x.stroke()}
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2;x.beginPath();x.arc(48+Math.cos(a)*20,78+Math.sin(a)*5,5,0,7);fillOL(x,'#8a8680',2)}
 for(const[a,s]of[[40,1],[56,.8],[48,1.2]]){x.beginPath();x.moveTo(a-7*s,78);x.quadraticCurveTo(a,58-10*s,a+7*s,78);x.closePath();fillOL(x,lg(x,0,56,0,78,[[0,'#ffe066'],[1,'#ff5a1a']]),2)}
 x.strokeStyle=OL;x.lineWidth=2;x.beginPath();x.moveTo(48,16);x.lineTo(48,34);x.stroke();x.beginPath();x.ellipse(48,46,18,13,0,0,7);fillOL(x,rg(x,48,46,18,[[0,'#6a6a74'],[1,'#1e1e24']]));
 x.beginPath();x.ellipse(48,37,16,4,0,0,7);fillOL(x,'#c8803a',2);x.strokeStyle='rgba(255,255,255,.5)';x.lineWidth=2;for(const u of[42,52]){x.beginPath();x.moveTo(u,30);x.bezierCurveTo(u-4,24,u+4,20,u,14);x.stroke()}});
const bench=()=>mk(x=>{shade(x,48,84,38,6);for(const u of[18,72])rr(x,u,46,8,34,2),fillOL(x,'#5e3a1c',2.5);rr(x,10,38,76,12,3);fillOL(x,lg(x,0,38,0,50,[[0,'#c8945a'],[1,'#7a4e28']]));
 x.save();x.translate(36,30);x.rotate(-.15);poly(x,[[-16,4],[16,4],[16,-4],[-12,-6]]);fillOL(x,lg(x,0,-6,0,4,[[0,'#eef2f7'],[1,'#8c94a2']]),2);x.strokeStyle=OL;x.lineWidth=1;for(let i=-14;i<16;i+=4){x.beginPath();x.moveTo(i,4);x.lineTo(i+2,7);x.stroke()}rr(x,16,-4,10,8,2);fillOL(x,'#7a3a22',2);x.restore();
 x.save();x.translate(64,30);x.rotate(.6);rr(x,-2,-4,4,22,2);fillOL(x,'#7a4a24',2);rr(x,-8,-10,16,8,2);fillOL(x,lg(x,0,-10,0,-2,[[0,'#d0d6e0'],[1,'#5e6676']]),2);x.restore()});
const furnace=()=>mk(x=>{shade(x,48,84,36,6);rr(x,58,8,14,40,2);fillOL(x,lg(x,58,0,72,0,[[0,'#c2603e'],[1,'#7a2e1c']]));x.strokeStyle='rgba(60,30,20,.6)';x.lineWidth=1.5;for(let y=16;y<46;y+=8){x.beginPath();x.moveTo(58,y);x.lineTo(72,y);x.stroke()}
 x.beginPath();x.moveTo(14,80);x.lineTo(14,52);x.quadraticCurveTo(14,24,48,24);x.quadraticCurveTo(82,24,82,52);x.lineTo(82,80);x.closePath();fillOL(x,lg(x,14,24,82,80,[[0,'#c8c2b8'],[1,'#6a645c']]));
 x.strokeStyle='rgba(40,36,30,.45)';x.lineWidth=1.5;for(const[a,b,c,d]of[[20,44,40,42],[56,40,76,44],[18,62,36,62],[60,62,80,62],[30,32,46,30]]){x.beginPath();x.moveTo(a,b);x.lineTo(c,d);x.stroke()}
 x.beginPath();x.moveTo(34,80);x.lineTo(34,62);x.quadraticCurveTo(34,50,48,50);x.quadraticCurveTo(62,50,62,62);x.lineTo(62,80);x.closePath();fillOL(x,'#1a0e0a');
 x.beginPath();x.moveTo(36,80);x.lineTo(36,64);x.quadraticCurveTo(36,54,48,54);x.quadraticCurveTo(60,54,60,64);x.lineTo(60,80);x.closePath();x.fillStyle=rg(x,48,72,16,[[0,'#fff1a0'],[.4,'#ff9a2a'],[1,'#a02a0a']]);x.fill()});
const farm=()=>mk(x=>{shade(x,48,84,38,6);poly(x,[[10,62],[48,48],[86,62],[48,80]]);fillOL(x,lg(x,0,48,0,80,[[0,'#8a5a32'],[1,'#4a2c16']]));
 for(const[a,b]of[[30,56],[48,50],[66,58],[48,66]]){x.beginPath();x.arc(a,b-6,10,0,7);fillOL(x,rg(x,a,b-6,10,[[0,'#6ac04a'],[1,'#2a6a22']]),2.5);for(const[d,e,c]of[[-4,-8,'#3a4fd6'],[4,-4,'#d63a3a'],[1,-11,'#3a4fd6']]){x.beginPath();x.arc(a+d,b+e,2.6,0,7);x.fillStyle=c;x.fill()}}});
const lamp=()=>mk(x=>{x.fillStyle=rg(x,48,38,30,[[0,'rgba(255,220,120,.6)'],[1,'rgba(255,200,80,0)']]);x.beginPath();x.arc(48,38,30,0,7);x.fill();shade(x,48,86,16,4);
 rr(x,45,44,6,40,2);fillOL(x,'#2a2a33',2.5);rr(x,36,26,24,22,4);fillOL(x,rg(x,48,37,16,[[0,'#fff6c8'],[.6,'#ffc04a'],[1,'#c06a14']]));
 x.strokeStyle=OL;x.lineWidth=2;x.beginPath();x.moveTo(48,26);x.lineTo(48,48);x.stroke();poly(x,[[32,26],[48,14],[64,26]]);fillOL(x,'#2a2a33',2.5)});
const fence=()=>mk(x=>{shade(x,48,84,38,5);for(const y of[44,64]){rr(x,8,y,80,7,2);fillOL(x,lg(x,0,y,0,y+7,[[0,'#b07a46'],[1,'#6a4424']]),2)}
 for(const u of[14,34,54,74]){x.beginPath();x.moveTo(u,84);x.lineTo(u,30);x.lineTo(u+5,22);x.lineTo(u+10,30);x.lineTo(u+10,84);x.closePath();fillOL(x,lg(x,u,0,u+10,0,[[0,'#d0a066'],[1,'#7a4e28']]),2.5)}});
const center=()=>mk(x=>{shade(x,48,84,38,6);x.beginPath();x.ellipse(48,72,38,12,0,0,7);fillOL(x,lg(x,0,60,0,84,[[0,'#d6d0dc'],[1,'#7a748a']]));
 for(const u of[20,76,32,64]){rr(x,u-4,46,8,24,2);fillOL(x,lg(x,u-4,0,u+4,0,[[0,'#e2dce8'],[1,'#8a849a']]),2);x.beginPath();x.moveTo(u,40);x.lineTo(u+4,46);x.lineTo(u,50);x.lineTo(u-4,46);x.closePath();fillOL(x,'#7fe3f5',1.5)}
 x.beginPath();x.ellipse(48,40,27,8,0,0,7);x.strokeStyle='#7fe3f5';x.lineWidth=3;x.stroke();x.beginPath();x.arc(48,38,17,0,7);fillOL(x,rg(x,48,38,17,[[0,'#e6f8ff'],[.5,'#5fb8f0'],[1,'#1e4a8a']]));
 x.strokeStyle='rgba(255,255,255,.75)';x.lineWidth=2.5;x.beginPath();x.arc(48,38,11,-2.4,-.4);x.stroke();shine(x,42,31,4,2.5)});
const chest=()=>mk(x=>{shade(x,48,84,36,6);rr(x,14,44,68,36,4);fillOL(x,lg(x,0,44,0,80,[[0,'#b8783e'],[1,'#6a4020']]));
 x.beginPath();x.moveTo(14,46);x.lineTo(14,36);x.quadraticCurveTo(48,16,82,36);x.lineTo(82,46);x.closePath();fillOL(x,lg(x,0,22,0,46,[[0,'#d09050'],[1,'#8a5a2e']]));
 for(const u of[24,66]){rr(x,u,26,7,54,1);fillOL(x,lg(x,u,0,u+7,0,[[0,'#8a8e9a'],[1,'#3a3e48']]),2)}rr(x,42,42,12,14,2);fillOL(x,lg(x,42,42,54,56,[[0,'#ffe9a8'],[1,'#b8862a']]),2);x.fillStyle=OL;x.fillRect(47,48,2,5)});
/* ---------- кнопки ---------- */
const btnBag=()=>pack([[0,'#e85a4a'],[1,'#8a2420']],[[0,'#c03a2e'],[1,'#7a1c16']]);
const btnCraft=()=>mk(x=>{shade(x,50,84,26,5);x.save();x.translate(48,50);x.rotate(-.75);rr(x,-4,-6,8,48,3);fillOL(x,lg(x,-4,0,4,0,WOODH),2.5);
 rr(x,-20,-24,40,18,4);fillOL(x,lg(x,0,-24,0,-6,MAT.m));x.strokeStyle='rgba(255,255,255,.9)';x.lineWidth=2;x.beginPath();x.moveTo(-16,-20);x.lineTo(14,-20);x.stroke();x.restore()});
const btnBuild=()=>mk(x=>{shade(x,48,84,36,6);x.strokeStyle=OL;x.lineWidth=3;
 x.beginPath();x.moveTo(14,80);x.lineTo(14,46);x.lineTo(48,18);x.lineTo(82,46);x.lineTo(82,80);x.closePath();x.fillStyle='rgba(255,220,150,.12)';x.fill();
 const beam=(a,b,c,d)=>{x.lineWidth=8;x.strokeStyle=OL;x.beginPath();x.moveTo(a,b);x.lineTo(c,d);x.stroke();x.lineWidth=5;x.strokeStyle='#c8945a';x.stroke()};
 beam(14,80,14,46);beam(82,80,82,46);beam(14,46,48,18);beam(82,46,48,18);beam(14,60,82,60);beam(48,18,48,60);beam(14,80,82,80);
 x.save();x.translate(64,64);x.rotate(.7);rr(x,-3,-4,6,30,2);fillOL(x,lg(x,-3,0,3,0,WOODH),2);rr(x,-12,-12,24,10,3);fillOL(x,lg(x,0,-12,0,-2,MAT.m),2.5);x.restore()});
const btnHit=()=>mk(x=>{shade(x,48,86,26,5);const sw=a=>{x.save();x.translate(48,50);x.rotate(a);poly(x,[[-4,-40],[0,-46],[4,-40],[4,14],[-4,14]]);fillOL(x,lg(x,-4,0,4,0,MAT.m),2.5);
 rr(x,-14,14,28,6,3);fillOL(x,'#e2bf67',2);rr(x,-3.5,20,7,16,2);fillOL(x,lg(x,-3.5,0,3.5,0,[[0,'#7a3a22'],[1,'#3e1c10']]),2);x.beginPath();x.arc(0,38,4,0,7);fillOL(x,'#e2bf67',2);x.restore()};sw(-.7);sw(.7)});

/* ---------- застосування ---------- */
const css=document.createElement('style');css.textContent='img.iic{width:1.25em;height:1.25em;vertical-align:-.25em;object-fit:contain;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25))}#bag img.iic,#craft img.iic,#hit img.iic,#bld img.iic{width:1.45em;height:1.45em;display:block;margin:0 auto}.i2s img.iic,.ivs img.iic{width:40px;height:40px}.i2q img.iic{width:34px;height:34px}#chs .sl img.iic{width:38px;height:38px}#chs .r .ic img.iic,#chs .tk img.iic{width:28px;height:28px}.rc .ri img.iic{width:44px;height:44px}#fur .bx i img.iic{width:34px;height:34px}';document.head.appendChild(css);
const img=(src,alt)=>`<img class='iic' src='${src}' alt='${alt||''}'>`;
/* 0.5.x: шерсть (пухке руно) і шкіра (розтягнута шкура зі швом) — здобич із диких істот, creature-drops.js */
const wool=()=>mk(x=>{shade(x,48,82,34,7);sd=37;const B=[[30,58,17],[48,62,19],[66,57,17],[38,42,16],[58,40,17],[48,50,18]];
 x.beginPath();B.forEach(([u,v,r])=>{x.moveTo(u+r,v);x.arc(u,v,r,0,7)});x.lineWidth=6;x.strokeStyle=OL;x.stroke();
 B.forEach(([u,v,r])=>{x.beginPath();x.arc(u,v,r,0,7);x.fillStyle=rg(x,u,v,r,[[0,'#fffaf0'],[.6,'#efe2c8'],[1,'#c9b48e']]);x.fill()});
 x.strokeStyle='rgba(150,120,80,.55)';x.lineWidth=2;for(let i=0;i<9;i++){const u=26+rnd()*44,v=34+rnd()*34,r=3+rnd()*3;x.beginPath();x.arc(u,v,r,.3,4.6);x.stroke()}
 shine(x,40,36,9,4)});
const leather=()=>mk(x=>{shade(x,48,86,34,6);x.save();x.translate(48,49);x.rotate(-.12);
 /* розтягнута шкура: шия, передні лапи, бока, задні лапи, хвіст (симетрично) */
 const R=[[0,-38],[7,-30],[11,-27],[30,-34],[33,-27],[17,-15],[19,0],[18,14],[32,30],[27,37],[12,24],[5,32],[2,42]];
 const P=R.concat(R.slice(0,-1).reverse().map(([u,v])=>[-u,v]).slice(0,-1));
 x.beginPath();x.moveTo(P[0][0],P[0][1]);for(let i=1;i<=P.length;i++){const[u,v]=P[i%P.length],[pu,pv]=P[i-1];x.quadraticCurveTo(pu,pv,(pu+u)/2,(pv+v)/2)}x.closePath();
 fillOL(x,rg(x,0,0,40,[[0,'#e3b07a'],[.55,'#b07440'],[1,'#6e4020']]),3.5);
 x.save();x.clip();x.globalAlpha=.16;sd=53;for(let i=0;i<46;i++){x.fillStyle=rnd()<.5?'#3a1e0c':'#ffe0b0';x.beginPath();x.arc(-30+rnd()*60,-38+rnd()*80,.8+rnd()*1.8,0,7);x.fill()}x.restore();
 shine(x,-8,-12,7,3);x.restore()});
const D={wool,lth:leather,w:log,s:stone,sti:sticks,ing:ingot,ore:()=>lump('ore'),coal:()=>lump('coal'),be:berries,mu:mush,gm:skewer,pie,
 axw:()=>axe('w'),axe:()=>axe('s'),axm:()=>axe('m'),pkw:()=>pick('w'),pick:()=>pick('s'),pkm:()=>pick('m'),bp1,bp2,bp3,
 B_bed:bed,B_kit:kitchen,B_wb:bench,B_fur:furnace,B_farm:farm,B_lamp:lamp,B_fen:fence,B_cen:center,B_ch:chest};
const SRC={};for(const k in D){try{SRC[k]=D[k]();if(IT[k])IT[k][0]=img(SRC[k],IT[k][1])}catch(e){console.warn('icon '+k,e)}}
window.plIconSrc=k=>SRC[k]||((/src='([^']+)'/.exec((IT[k]||[''])[0])||[])[1])||null;
window.plIcon=k=>SRC[k]?img(SRC[k]):(IT[k]?IT[k][0]:'');
/* головні кнопки */
const B={bag:btnBag(),craft:btnCraft(),bld:btnBuild(),hit:btnHit()};window.plBtnIcon=B;
const setBtn=(id,src)=>{const e=document.getElementById(id);if(!e)return;const sm=e.querySelector('small');e.innerHTML=img(src)+(sm?sm.outerHTML:'')};
setBtn('bag',B.bag);setBtn('craft',B.craft);setBtn('bld',B.bld);setBtn('hit',B.hit);
}catch(e){console.warn('icons',e)}})();
