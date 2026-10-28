/* 0.1.11: рівні диких істот за зонами світу (що далі від табору — то сильніші), досвід і шанс ловлі залежно від рівня, маленька шкала здоровʼя над істотою, яку атакують */
(function(){try{
const PMAX=50,WMAX=100;
/* зони: [від якої відстані від табору, назва, мін. рівень, макс. рівень]; суша закінчується ~205 від табору, межі підібрані так, щоб у кожній зоні вистачало суші.
   Дикі істоти — до 100 рівня, щоб герою 50–100 рівня було з ким битися; спійманий попал усе одно не вище 50 */
const ZN=[[0,'Долина',1,3],[30,'Луки',3,10],[70,'Ліс',10,25],[110,'Гори',25,45],[145,'Дикі землі',45,70],[175,'Край світу',70,100]],REND=205;
const zoneAt=(x,z)=>{const r=Math.hypot(x,z);let i=0;while(i+1<ZN.length&&r>=ZN[i+1][0])i++;return i};
function lvAt(x,z){const i=zoneAt(x,z),Z=ZN[i],r=Math.hypot(x,z),r1=ZN[i+1]?ZN[i+1][0]:REND,k=Math.min(1,(r-Z[0])/(r1-Z[0]));
 return Math.max(1,Math.min(WMAX,Math.round(Z[2]+(Z[3]-Z[2])*k+(Math.random()*2-1))))}
/* рівень визначає здоровʼя, шкоду по герою й агресію */
function setup(w){const L=lvAt(w.x,w.z),b=T[w.ty].hp;w.lv=L;w.mh=Math.round(b*(1+.12*(L-1)));w.hp=Math.round(w.mh*Math.max(0,Math.min(1,w.hp/b)));w.dm=Math.round(10*(1+.06*(L-1)));if(!w.ag&&L>plv+5)w.ag=1}
/* досвід під таблицю XPT (core-world.js): усі нагороди ×5 (XPM), за бій ще +10% за кожен рівень істоти;
   за значно слабших дають менше (до 20%), за сильніших — трохи більше. Модель: 20 рівень ~1 год, 50 — ~10 год, 100 — ~130 год активного бою */
window.XPM=5;
window.wXp=(w,base)=>{const L=(w&&w.lv)||1,d=L-plv,m=d>=0?1+.05*Math.min(d,10):Math.max(.2,1+.05*d);return Math.max(1,Math.round(base*XPM*(1+.1*(L-1))*m))};
/* ловля: сильніших істот ловити важче — тут і стають у пригоді кращі кулі; ще важче, якщо істота вища за героя */
window.wCatch=(w,ch)=>{const L=(w&&w.lv)||1,d=L-plv;let c=ch/(1+(L-1)/30);if(d>0)c*=Math.max(.3,1-.04*d);return Math.min(.95,c)};
/* мирні справи (збір, крафт): +2% за рівень героя — повільніше за бій, але не марно на високих рівнях */
window.gXp=n=>Math.max(1,Math.round(n*XPM*(1+.02*(plv-1))));
/* здоровʼя героя росте з рівнем */
window.hpMax=()=>100+4*(plv-1);
window.wPalLv=w=>Math.max(1,Math.min(PMAX,plv,(w&&w.lv)||1));
window.zoneInfo=(x,z)=>{const Z=ZN[zoneAt(x,z)];return{n:Z[1],a:Z[2],b:Z[3]}};
/* старі збереження: рівні в межах нових максимумів, зайвий досвід обрізається */
if(plv>100)plv=100;if(plv>=100)xp=0;else if(xp>=xpN(plv))xp=xpN(plv)-1;
for(const p of pals){if((p.lv||1)>PMAX)p.lv=PMAX;if(window.palXpNeed&&(p.xp||0)>=palXpNeed(p.lv||1))p.xp=0}
HPM=hpMax();P.hp=HPM;
for(const w of wild)if(!w.lv)setup(w);
/* у дальніх зонах дерева й скелі щедріші: +1 ресурс за кожні дві зони від табору */
const fb0=window.fellB;if(fb0)window.fellB=function(k,o){fb0(k,o);const p=o.m.position,b=Math.floor(zoneAt(p.x,p.z)/2);if(b>0){res[k]+=b;st[k]+=b;const q=p.clone();setTimeout(()=>dmg('+'+b+(k=='w'?' 🪵':' 🪨')+' зона',{position:q},'#9ff0a0'),500)}};
/* нові істоти отримують рівень одразу при появі (spawnWild з core-world.js) */
const sw0=spawnWild;spawnWild=function(){const n=wild.length;sw0();for(let i=n;i<wild.length;i++)if(!wild[i].lv)setup(wild[i])};
try{hud()}catch(_){}
/* --- шкала здоровʼя над дикою істотою --- */
const st=document.createElement('style');st.id='wild-css';
st.textContent=`.wbar{position:fixed;left:0;top:0;z-index:3;pointer-events:none;display:none;flex-direction:column;align-items:center;gap:1px;transform:translate(-50%,-100%);will-change:transform}
.wbar span{font:800 9px/10px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000;white-space:nowrap}
.wbar span b{color:#ffd34e}
.wbar i{display:block;width:44px;height:5px;border-radius:3px;background:rgba(10,16,30,.75);box-shadow:0 0 0 1px rgba(255,255,255,.55);overflow:hidden}
.wbar i u{display:block;height:100%;background:linear-gradient(#ff8a8a,#d23c3c);transition:width .2s}
.wbar.hi span b{color:#ff6b6b}`;
document.head.appendChild(st);
const POOL=[],NB=6,v3=new THREE.Vector3();
for(let i=0;i<NB;i++){const d=document.createElement('div');d.className='wbar';d.innerHTML='<span></span><i><u></u></i>';document.body.appendChild(d);POOL.push({d,s:d.firstChild,u:d.lastChild.firstChild,w:null,k:''})}
let zT=0,zLast=-1;
(function loop(){requestAnimationFrame(()=>{try{
 const now=performance.now(),list=[];
 for(const w of wild){if(!w.lv)setup(w);
  if(w._lh!==undefined&&w.hp<w._lh)w.ht=now;w._lh=w.hp;
  const d=Math.hypot(w.x-P.x,w.z-P.z);if(d<22&&(now-(w.ht||-1e9)<6000||(w.ag&&d<8)))list.push([d,w])}
 list.sort((a,b)=>a[0]-b[0]);
 const busy=(typeof menuO!=='undefined'&&menuO)||document.body.classList.contains('hedit');
 for(let i=0;i<NB;i++){const b=POOL[i],it=!busy&&list[i];if(!it){if(b.w){b.d.style.display='none';b.w=null}continue}
  const w=it[1];if(!w._h){try{w._h=Math.min(2.4,(new THREE.Box3().setFromObject(w.m).max.y-w.m.position.y)/(w.m.scale.y||1))+.15}catch(_){w._h=1.8}}
  v3.set(w.x,w.m.position.y+w._h,w.z).project(cam);if(v3.z>1||Math.abs(v3.x)>1.1||Math.abs(v3.y)>1.1){b.d.style.display='none';b.w=null;continue}
  const x=(v3.x+1)/2*innerWidth,y=(1-v3.y)/2*innerHeight;b.d.style.display='flex';b.d.style.transform=`translate(${x|0}px,${y|0}px) translate(-50%,-100%)`;
  const k=w.lv+':'+Math.max(0,Math.ceil(w.hp))+':'+w.mh;if(b.w!==w||b.k!==k){b.w=w;b.k=k;b.s.innerHTML=`<b>${w.lv}</b> ${T[w.ty].n}`;b.u.style.width=Math.max(0,Math.min(100,w.hp/w.mh*100))+'%';b.d.classList.toggle('hi',w.lv>plv+5)}}
 /* повідомлення про зону, коли гравець переходить в іншу */
 zT+=1;if(zT>30){zT=0;const z=zoneAt(P.x,P.z);if(z!==zLast){if(zLast>=0&&!busy){const Z=ZN[z];msg('🗺️ '+Z[1]+' · істоти рівня '+Z[2]+'–'+Z[3])}zLast=z}}
}catch(e){}loop()})})();
}catch(e){console.warn('wild-levels',e)}})();
