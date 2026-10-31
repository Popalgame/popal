/* 0.5.x: насіння, грядки, лежанки й верстаки за рівнем.
   • З ягідних кущів інколи випадає насіння 🌰 (герою й попалам-збирачам).
   • Грядка (B_garden, world-007.js) — 6 лунок: посадили насіння → паросток → кущик → ягоди (GROW_MS). По грядці можна ходити.
     Біля грядки «Дія» збирає стиглі кущики (2–3 ягоди, інколи насіння назад) і садить насіння в порожні лунки.
     Попали-збирачі з бригади роблять те саме (pal-ai.js, стан «farm»), насіння беруть зі скринь.
   • Лежанки (B_nest2 — 2 місця, B_nest5 — 5): попали без роботи лягають на вільне місце й сплять.
   • Кулі за рідкістю: зелену — біля Верстака I, синю — Верстака II, червону — Верстака III (старший верстак підходить і для молодших). */
(function(){try{
if(typeof inv=='undefined')return;
const GROW_MS=4*60*1000,SLOTS=[[-1.1,-.55],[0,-.55],[1.1,-.55],[-1.1,.55],[0,.55],[1.1,.55]];
IT.sd=[(window.plIconSrc&&plIconSrc('sd')&&window.plIcon)?plIcon('sd'):'🌰','Насіння ягід'];if(inv.sd==null)inv.sd=0;
if(!inv._gdn||typeof inv._gdn!='object')inv._gdn={};
const placed=()=>window.BPLACED||[];
const gkey=b=>Math.round(b.x*10)+','+Math.round(b.z*10);
const toW=(b,lx,lz)=>{const r=b.g.rotation.y,c=Math.cos(r),s=Math.sin(r);return[b.x+lx*c+lz*s,b.z-lx*s+lz*c]};
const toL=(b,x,z)=>{const r=b.g.rotation.y,c=Math.cos(r),s=Math.sin(r),dx=x-b.x,dz=z-b.z;return[dx*c-dz*s,dx*s+dz*c]};
const gardens=()=>placed().filter(b=>b.id=='B_garden');
const plots=b=>{const k=gkey(b);let a=inv._gdn[k];if(!Array.isArray(a)||a.length!=6)a=inv._gdn[k]=SLOTS.map(()=>0);return a};/* 0 — порожньо, інакше час посадки */
const stage=t=>!t?0:Math.min(3,1+Math.floor((Date.now()-t)/GROW_MS*2));/* 1 паросток, 2 кущик, 3 стиглі ягоди */
const ripe=t=>stage(t)==3;

/* ---------- вигляд рослин ---------- */
const M=c=>new THREE.MeshStandardMaterial({color:c,roughness:.85});
const LEAF=M(0x3f8a3a),LEAF2=M(0x5fae4a),BER=new THREE.MeshStandardMaterial({color:0x4a5fd6,roughness:.4}),BER2=new THREE.MeshStandardMaterial({color:0xd93b3b,roughness:.4}),SOIL=M(0x5a3a22);
const SPH=new THREE.SphereGeometry(1,10,8),CONE=new THREE.ConeGeometry(1,1,6);
function plant(st){const g=new THREE.Group();
 if(st==1){for(const a of[0,2.1,4.2]){const l=new THREE.Mesh(CONE,LEAF2);l.scale.set(.05,.18,.05);l.position.set(Math.cos(a)*.04,.33,Math.sin(a)*.04);l.rotation.set(Math.sin(a)*.5,0,-Math.cos(a)*.5);g.add(l)}}
 else{const r=st==2?.17:.23;for(let i=0;i<5;i++){const a=i/5*6.28,l=new THREE.Mesh(SPH,i%2?LEAF:LEAF2);l.scale.setScalar(r*(.75+.1*(i%3)));l.position.set(Math.cos(a)*r*.6,.3+r*.7+(i%2)*.05,Math.sin(a)*r*.6);l.castShadow=true;g.add(l)}
  if(st==3)for(let i=0;i<9;i++){const a=i*2.4,b=new THREE.Mesh(SPH,i%3?BER:BER2);b.scale.setScalar(.045);b.position.set(Math.cos(a)*r*.9,.32+r*(.4+.5*((i*7)%5)/5),Math.sin(a)*r*.9);g.add(b)}}
 return g}
function sync(){for(const b of gardens()){const a=plots(b);b.g.userData.pl=b.g.userData.pl||[];for(let i=0;i<6;i++){const st=stage(a[i]),cur=b.g.userData.pl[i];if(cur&&cur.userData.st===st)continue;
  if(cur){b.g.remove(cur)}if(!st){b.g.userData.pl[i]=null;continue}const m=plant(st);m.userData.st=st;m.position.set(SLOTS[i][0],0,SLOTS[i][1]);b.g.add(m);b.g.userData.pl[i]=m}}}
setInterval(sync,1500);setTimeout(sync,500);

/* ---------- садіння й збирання ---------- */
function harvest(b,i){const a=plots(b);if(!ripe(a[i]))return null;a[i]=0;const be=2+(Math.random()<.5?1:0),sd=Math.random()<.45?1:0;sync();return{be,sd}}
function sow(b,i){const a=plots(b);if(a[i])return false;a[i]=Date.now();sync();return true}
const gtNear=(x,z,b,m)=>{const[lx,lz]=toL(b,x,z);return Math.abs(lx)<1.8+m&&Math.abs(lz)<1.2+m};
function playerGarden(){for(const b of gardens())if(gtNear(P.x,P.z,b,.9))return b;return null}
const pl_=(n,f)=>{const m=n%10,h=n%100;return n+' '+(m==1&&h!=11?f[0]:m>=2&&m<=4&&(h<12||h>14)?f[1]:f[2])};/* 1 ягода, 2 ягоди, 5 ягід */
function tendByHand(b){const a=plots(b);let got=0,gs=0,sown=0;for(let i=0;i<6;i++){const r=harvest(b,i);if(r){got+=r.be;gs+=r.sd}}
 if(got){inv.be=(inv.be||0)+got;inv.sd=(inv.sd||0)+gs}
 for(let i=0;i<6;i++)if(!a[i]&&inv.sd>0){inv.sd--;sow(b,i);sown++}
 const left=a.filter(t=>t&&!ripe(t)),mins=left.length?Math.ceil(Math.min(...left.map(t=>GROW_MS-(Date.now()-t)))/60000):0;
 msg(got||sown?(got?'🫐 Зібрано '+pl_(got,['ягоду','ягоди','ягід'])+(gs?' і '+pl_(gs,['насінину','насінини','насінин']):'')+'. ':'')+(sown?'🌱 Посаджено '+pl_(sown,['кущик','кущики','кущиків'])+'. ':'')+(left.length?'Дозріють за ~'+Math.max(1,mins)+' хв':''):
  a.every(t=>!t)?'🌰 Немає насіння. Воно випадає з ягідних кущів':left.length?'🌱 Ще ростуть — дозріють за ~'+Math.max(1,mins)+' хв':'🌱 Грядка засаджена');
 try{if(window.dmg&&got)dmg('+'+got+' 🫐',{position:new THREE.Vector3(b.x,H(b.x,b.z)+.6,b.z)},'#ffe28a')}catch(_){}try{hud();save();ivR()}catch(_){}}
/* «Дія» біля грядки (як кухня в cooking.js) */
const hb=document.getElementById('hit');
if(hb){const h0=hb.onclick;hb.onclick=function(){const b=playerGarden();if(b&&!nearest(wild,2.6)&&!nearest(bushes,2.2)){tendByHand(b);return}return h0&&h0.apply(this,arguments)};
 let was=null,hit0=null;ANI.push(()=>{const n=!!playerGarden();if(n===was)return;was=n;if(n){hit0=hb.innerHTML;hb.innerHTML=(window.plIcon?plIcon('B_garden'):'🌱')+'<small>Грядка</small>'}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}})}

/* ---------- насіння з ягідних кущів ---------- */
window.onBerryPick=fo=>{if(Math.random()<.4){inv.sd=(inv.sd||0)+1;setTimeout(()=>{try{dmg('+1 🌰',fo.m,'#d9b56a')}catch(_){}},350)}};

/* ---------- для попалів (pal-ai.js) ---------- */
const claimed=new Map();/* "сад:лунка" → попал */
window.GARDEN={
 /* завдання для збирача: стиглий кущик або порожня лунка, якщо в скринях є насіння */
 task(p){let best=null,bd=1e9;const seeds=window.chCount?chCount('sd'):0;
  for(const b of gardens()){const a=plots(b);for(let i=0;i<6;i++){const k=gkey(b)+':'+i,c=claimed.get(k);if(c&&c!==p&&c.ai&&c.ai.s=='farm')continue;
   const job=ripe(a[i])?'pick':(!a[i]&&seeds>0?'sow':null);if(!job)continue;const[x,z]=toW(b,SLOTS[i][0],SLOTS[i][1]),d=Math.hypot(x-p.x,z-p.z)+(job=='sow'?1000:0);/* спершу збирає стиглі, потім садить */if(d<bd){bd=d;best={b,i,x,z,job,k}}}}
  if(best)claimed.set(best.k,p);return best},
 done(t,p){claimed.delete(t.k);if(t.job=='pick')return harvest(t.b,t.i);if(window.chTake&&chTake('sd',1)){sow(t.b,t.i);return{sown:1}}return null},
 release(t){if(t)claimed.delete(t.k)}};
const seats=new Map();/* "лежанка:місце" → попал */
function nestSlots(){const L=[];for(const b of placed()){if(b.id=='B_nest2')for(const lx of[-.3,.3])L.push([b,lx,0]);else if(b.id=='B_nest5'){L.push([b,0,0]);for(let i=0;i<4;i++){const a=i/4*6.28+.4;L.push([b,Math.cos(a)*.6,Math.sin(a)*.6])}}}return L}
window.NEST={claim(p){let best=null,bd=1e9;for(const[b,lx,lz]of nestSlots()){const k=gkey(b)+':'+lx.toFixed(2)+','+lz.toFixed(2),c=seats.get(k);if(c&&c!==p&&c.ai&&c.ai.s=='rest')continue;
   const[x,z]=toW(b,lx,lz),d=Math.hypot(x-p.x,z-p.z);if(d<bd){bd=d;best={k,x,z}}}if(best){for(const[k,v]of seats)if(v===p)seats.delete(k);seats.set(best.k,p)}return best},
 release(p){for(const[k,v]of seats)if(v===p)seats.delete(k)}};

/* ---------- кулі за рідкістю: крафт лише біля верстака потрібного рівня ---------- */
const TIER={B_wb:1,B_wb2:2,B_wb3:3},NEED={bg:1,bb:2,br:3},BN=['','Верстака I','Верстака II','Верстака III'];
const benchNear=n=>placed().some(b=>TIER[b.id]>=n&&Math.hypot(b.x-P.x,b.z-P.z)<=5);
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-r]');if(!t)return;const r=RC[+t.dataset.r];if(!r||!NEED[r.id])return;
 if(!benchNear(NEED[r.id])){e.stopImmediatePropagation();e.preventDefault();msg('🛠️ '+IT[r.id][1]+' створюється лише біля '+BN[NEED[r.id]]+(NEED[r.id]>1?' (або старшого)':'')+'. Підійдіть ближче')}},true);
}catch(e){console.warn('garden:',e)}})();
