/* Вимір «Острів пробудження» — окремий маленький світ для навчання.
   Гра має два виміри: 'isle' (острів у скелях) і 'main' (звичайний світ). Вимір вибирається до завантаження світу:
   • ?realm=isle / ?realm=main у посиланні (для перевірки);
   • інакше — з localStorage 'zi_realm', який виставляє цепочка навчання (поки що лише вручну).
   Острів малий: ~60 м суші, з півдня — пляж і море, з півночі, сходу й заходу — високі скелі. У північних скелях — вузька ущелина,
   за нею на майданчику стоїть арка-портал у звичайний світ. Цей файл — лише геометрія острова (висоти, біоми, де можна ходити);
   скелі, арку й табір малює isle.js. */
(function(){
let r=null;try{r=new URLSearchParams(location.search).get('realm')}catch(_){}
if(r!=='isle'&&r!=='main'){try{r=localStorage.getItem('zi_realm')}catch(_){r=null}}
window.REALM=r==='isle'?'isle':'main';
if(window.REALM!=='isle')return;

const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
/* обрис острова: радіус суші залежно від кута */
const RAD=a=>30+3.2*Math.sin(3*a+.7)+1.8*Math.sin(5*a+2.1)+1.1*Math.sin(8*a);
/* скелі стоять там, де z < CLZ (північ, схід, захід); з півдня — відкрите море */
const CLZ=9;
/* ущелина: коридор уздовж осі z на півночі, |x| < GW; за нею — майданчик арки */
const GW=1.7,G0=-29,G1=-47,PZ=-52,PR=6;
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
 fill(W){const P=W.P,N=W.N;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=-P.R+i*P.STEP,z=-P.R+j*P.STEP;W.HG[j*N+i]=hAt(x,z);W.BG[j*N+i]=bioAt(x,z)}}};
})();
