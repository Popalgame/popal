/* Вимір «Острів пробудження» — окремий маленький світ для навчання.
   Гра має два виміри: 'isle' (острів у скелях) і 'main' (звичайний світ). Вимір вибирається до завантаження світу:
   • ?realm=isle / ?realm=main у посиланні (для перевірки);
   • інакше — зі збереження: inv._rl ('isle' | 'main') — у якому вимірі гравець зараз (синхронізується з хмарою разом із прогресом);
   • немає збереження — новий гравець, починає на острові;
   • старе збереження без inv._rl: якщо воно належить акаунту (zi_uid) — звичайний світ; якщо гість без реєстрації — прогрес гостя
     відкладаємо в 'zi_guest_bak' (на випадок помилки), а сам гість починає з острова: портал відкриється лише після реєстрації.
   Острів малий: ~60 м суші, з півдня — пляж і море, з півночі, сходу й заходу — високі скелі. У північних скелях — вузька ущелина,
   за нею на майданчику стоїть арка-портал у звичайний світ. Цей файл — лише геометрія острова (висоти, біоми, де можна ходити);
   скелі, арку й табір малює isle.js. */
(function(){
let r=null;try{r=new URLSearchParams(location.search).get('realm')}catch(_){}
if(r!=='isle'&&r!=='main'){r='isle';try{const raw=localStorage.getItem('zi'),sv=raw?JSON.parse(raw):null;
 if(sv){const rl=sv.inv&&sv.inv._rl;if(rl==='isle'||rl==='main')r=rl;else if(localStorage.getItem('zi_uid'))r='main';
  else{localStorage.setItem('zi_guest_bak',raw);localStorage.removeItem('zi')}}}catch(_){r='main'}}
window.REALM=r==='isle'?'isle':'main';

/* ---------- спільні скелі для острова й спавну (isle.js, spawn-cliffs.js) ----------
   Матеріал: процедурна текстура з горизонтальними пластами породи, тріщинами й мохом на верхівках (сферичні UV брили: v=1 — верх),
   той самий малюнок — рельєф (bumpMap). Геометрія: «бита» брила з пласкою верхівкою. */
window.plCliff=(()=>{let mat=null;const geos={};
 function vnoise(n,seed){const g=[];let s=seed;const r=()=>(s=s*16807%2147483647)/2147483647;for(let i=0;i<n*n;i++)g.push(r());
  return(x,y)=>{x*=n;y*=n;const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),G=(a,b)=>g[((b%n+n)%n)*n+((a%n+n)%n)];
   return(G(i,j)*(1-u)+G(i+1,j)*u)*(1-v)+(G(i,j+1)*(1-u)+G(i+1,j+1)*u)*v}}
 function build(){const S=512,c=document.createElement('canvas'),b=document.createElement('canvas');c.width=b.width=c.height=b.height=S;
  const x=c.getContext('2d'),xb=b.getContext('2d'),im=x.createImageData(S,S),ib=xb.createImageData(S,S),d=im.data,db=ib.data;
  const n1=vnoise(8,11),n2=vnoise(16,23),n3=vnoise(40,37),n4=vnoise(6,51);
  let s=7;const r=()=>(s=s*16807%2147483647)/2147483647;
  /* пласти: межі з легкою хвилею */const L=[];let y=0;while(y<1){const h=.025+r()*.07;L.push([y,h,r()]);y+=h}
  for(let j=0;j<S;j++)for(let i=0;i<S;i++){const u=i/S,v=j/S,w=v+(n1(u,v)-.5)*.05+(n2(u*2,v)-.5)*.012;
   let k=0;while(k+1<L.length&&L[k+1][0]<=w)k++;const st=L[k],e=Math.min(w-st[0],st[0]+st[1]-w)/st[1];/* 0 біля межі пласта */
   const grain=n3(u,v)*.55+n2(u,v)*.45,edge=Math.min(1,e*7);
   let l=.6+(st[2]-.5)*.16+(grain-.5)*.22;l*=.8+.2*edge;/* темні шви між пластами */
   const crack=Math.abs(n1(u*2+.3,v*.6)-.5)<.006?.78:1;l*=crack;
   const top=Math.max(0,(.24-v)/.24),moss=top*(n2(u*1.7,v*1.7)>.45?1:.25)*(n1(u*3,v)>.4?1:.4);/* верх текстури — верхівка брили */
   let R=l*1.06,G_=l*1.0,B=l*.9;const warm=n4(u,v);R+= (warm-.5)*.08;B-=(warm-.5)*.05;
   R=R*(1-moss)+.33*moss*(.8+grain*.4);G_=G_*(1-moss)+.48*moss*(.8+grain*.4);B=B*(1-moss)+.22*moss;
   const o=(j*S+i)*4;d[o]=Math.min(255,R*255);d[o+1]=Math.min(255,G_*255);d[o+2]=Math.min(255,B*255);d[o+3]=255;
   const bh=(grain*.6+edge*.4)*crack*255;db[o]=db[o+1]=db[o+2]=bh;db[o+3]=255}
  x.putImageData(im,0,0);xb.putImageData(ib,0,0);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,1);
  const bt=new THREE.CanvasTexture(b);bt.wrapS=bt.wrapT=THREE.RepeatWrapping;bt.repeat.set(2,1);
  mat=new THREE.MeshStandardMaterial({map:t,bumpMap:bt,bumpScale:.035,roughness:.93,flatShading:true})}
 function geo(k){if(geos[k])return geos[k];const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=1+.2*Math.sin(v.x*3.1+k)*Math.cos(v.z*2.7-k)+.1*Math.sin(v.y*5.3+k*2)+.05*Math.sin(v.x*9+v.z*7+k);v.multiplyScalar(n);
   if(v.y>.35)v.y=.35+(v.y-.35)*.5;/* пласка верхівка */if(v.y<-.5)v.y=-.5+(v.y+.5)*.6;p.setXYZ(i,v.x,v.y,v.z)}
  g.computeVertexNormals();return geos[k]=g}
 return{mat:()=>{if(!mat)build();return mat},geo,
  /* кольори брил (множаться на текстуру) — теплі сіро-пісочні відтінки */
  cols:[0xe8e0d2,0xd6cec0,0xf2e9da,0xc9c1b3,0xdcd2c0]}})();
/* тверді брили: кола зіткнення за розміром кожної брили (сітка 4 м, щоб перевірка була швидкою). list — [{x,z,r}] */
window.plRockCol=list=>{const C=4,grid=new Map(),key=(i,j)=>i+','+j;
 for(const o of list){const i0=Math.floor((o.x-o.r)/C),i1=Math.floor((o.x+o.r)/C),j0=Math.floor((o.z-o.r)/C),j1=Math.floor((o.z+o.r)/C);
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const k=key(i,j);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(o)}}
 const near=(x,z)=>grid.get(key(Math.floor(x/C),Math.floor(z/C)))||[];
 return{hit(x,z,m){for(const o of near(x,z))if(Math.hypot(x-o.x,z-o.z)<o.r+m)return true;return false},
  push(P,m){for(let n=0;n<3;n++){let moved=false;for(const o of near(P.x,P.z)){const dx=P.x-o.x,dz=P.z-o.z,d=Math.hypot(dx,dz),R=o.r+m;if(d<R){if(d<1e-4){P.x+=R;continue}P.x=o.x+dx/d*R;P.z=o.z+dz/d*R;moved=true}}if(!moved)break}}}};
if(window.REALM!=='isle')return;

const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
/* обрис острова: радіус суші залежно від кута */
const RAD=a=>30+3.2*Math.sin(3*a+.7)+1.8*Math.sin(5*a+2.1)+1.1*Math.sin(8*a);
/* скелі стоять там, де z < CLZ (північ, схід, захід); з півдня — відкрите море */
const CLZ=9;
/* ущелина: коридор уздовж осі z на півночі, |x| < GW; за нею — майданчик арки */
const GW=3.4,G0=-29,G1=-47,PZ=-54,PR=8.5;
const inGorge=(x,z)=>z<G0+2&&z>G1-1&&Math.abs(x+Math.sin(z*.35)*.6)<GW;
const inPlaza=(x,z)=>Math.hypot(x,z-PZ)<PR;
/* «ділянка скель»: усе за внутрішнім краєм кільця скель, крім ущелини й майданчика */
function cliffBand(x,z){const a=Math.atan2(z,x),d=Math.hypot(x,z),rc=RAD(a)-1.5;return z<CLZ&&d>rc}
/* висота суші (значення сітки рельєфу, як у core-world: суша ≈ 0…1.2, вода < -0.45) */
function hAt(x,z){const a=Math.atan2(z,x),d=Math.hypot(x,z),R0=RAD(a);
 if(inPlaza(x,z))return .55;if(inGorge(x,z))return .5+Math.max(0,-z-30)*.004;
 if(cliffBand(x,z))return 2.6+sm(R0,R0+12,d)*3;/* під скелями — підвищення, його закривають камені */
 const land=sm(R0+5,R0-6,d);/* 1 на суші, 0 у морі */
 const hills=.18*Math.sin(x*.21)*Math.cos(z*.17)+.12*Math.sin((x+z)*.33);
 return -2.6+land*(2.6+.75+hills*(1-sm(R0-10,R0-3,d)))}
function bioAt(x,z){const h=hAt(x,z),a=Math.atan2(z,x),d=Math.hypot(x,z),R0=RAD(a);
 if(inPlaza(x,z)||inGorge(x,z))return'rock';if(cliffBand(x,z))return'rock';if(h<-1.2)return'deep';if(h<-.45)return'shal';
 if(d>R0-5&&z>CLZ-4)return'sand';if(x<-6&&z<4)return'forest';return'mead'}
/* куди можна ходити: суша острова всередині кільця скель, мілина біля пляжу, ущелина й майданчик арки */
function walk(x,z,m){m=m||0;if(inPlaza(x,z)||inGorge(x,z))return true;const a=Math.atan2(z,x),d=Math.hypot(x,z),R0=RAD(a);
 if(z<CLZ)return d<R0-2.3-m;return d<R0+7-m}
const spawnOk=(x,z,m)=>walk(x,z,m)&&!inGorge(x,z)&&!inPlaza(x,z)&&z>G0+4;/* дерева, каміння й дикі істоти — лише на самому острові */
window.ISLE={RAD,CLZ,GW,G0,G1,PZ,PR,hAt,bioAt,walk,spawnOk,inGorge,inPlaza,
 START:[0,20.5],/* пробудження на пляжі */
 /* опорні точки стежок (як SP у core-world): табір, верстак, гай, лука з попалами, вхід в ущелину */
 SP:[[0,12],[11,-4],[-13,-6],[-12,15],[0,-24]],
 /* табір Вітрила — це база острова: тут уже стоять Верстак I (у майстерні Шкварки) і кухня-багаття (біля Вітрила); не зберігаються в inv._b */
 BASE:[['B_wb',12.6,-4.6,2.7],['B_kit',1.5,11,0]],
 fill(W){const P=W.P,N=W.N;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=-P.R+i*P.STEP,z=-P.R+j*P.STEP;W.HG[j*N+i]=hAt(x,z);W.BG[j*N+i]=bioAt(x,z)}}};
})();
