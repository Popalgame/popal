/* 0.1.11: рівні диких істот за зонами світу (що далі від табору — то сильніші), досвід і шанс ловлі залежно від рівня, маленька шкала здоровʼя над істотою, яку атакують */
(function(){try{
const PMAX=50,WMAX=25;
/* зони: [від якої відстані від табору, назва, мін. рівень, макс. рівень]; суша закінчується ~205 від табору, межі підібрані так, щоб у кожній зоні вистачало суші.
   0.2.9: на локаціях 1 і 2 дикі попали — не вище 25 рівня і лише в першій формі (еволюція — у Колбі поліпшень, evolution.js).
   Сильніші (до 50 і еволюційовані) з'являться на наступних локаціях; спійманий попал і далі росте до 50 */
/* 0.3.2: Локація 2 — чотири зони знизу (південь) вгору (північ), між ними хребти з перевалами (ridges.js).
   Рівень дикого попала росте з півдня на північ у межах зони: Бухта прибуття 1–5, Зелені луки 5–12, Старий ліс 12–20, Дикі землі 20–25. */
const ZB=[['Бухта прибуття',110,240,1,5],['Зелені луки',0,110,5,12],['Старий ліс',-118,0,12,20],['Дикі землі',-240,-118,20,25]];
const ZN=ZB.map(b=>[0,b[0],b[3],b[4]]),REND=205;
const zoneAt=(x,z)=>z>=110?0:z>=0?1:z>=-118?2:3;
const ISL=window.REALM==='isle'&&window.ISLE;
/* точка появи — печера-портал на південному березі посередині (spawn-cliffs.js), обличчям на північ, до суші */
const SPAWN=window.SPAWN=ISL?[ISL.START[0],ISL.START[1],Math.PI]:(()=>{let best=null;
 for(let x=-24;x<=24;x+=4){let z=240;while(z>150&&H(x,z)<-.45)z-=.5;if(z<=150)continue;const zz=z-7,h=H(x,zz);if(h<-.2)continue;
  let sl=0;for(const[u,v]of[[1,0],[-1,0],[0,1],[0,-1]])sl=Math.max(sl,Math.abs(H(x+u*2,zz+v*2)-h)/2);const sc=sl+Math.abs(x)*.01;if(!best||sc<best.sc)best={sc,x,z:zz}}
 return best?[+best.x.toFixed(2),+best.z.toFixed(2),Math.PI]:[0,195,Math.PI]})();
const dSp=(x,z)=>Math.hypot(x-SPAWN[0],z-SPAWN[1]);
const inBay=()=>false;
const zoneEff=zoneAt;
function lvAt(x,z){if(ISL)return 1+(Math.random()<.4?1:0);/* на острові пробудження — лише 1–2 рівень */
 const b=ZB[zoneAt(x,z)],k=Math.max(0,Math.min(1,(b[2]-z)/(b[2]-b[1])));let L=b[3]+(b[4]-b[3])*k;if(dSp(x,z)<30)L=Math.min(L,2);/* біля печери прибуття — найслабші */
 return Math.max(1,Math.min(WMAX,Math.round(L+(Math.random()*2-1))))}
/* на самій точці появи не стоїть дерево */
try{const TR=eval('trees');for(let i=TR.length-1;i>=0;i--){const t=TR[i];if(dSp(t.x,t.z)<6){sc.remove(t.m);TR.splice(i,1)}}}catch(_){}
/* новий гравець (без збереження) починає в бухті, обличчям до суші */
{let hs=1;try{hs=eval('hasSave')}catch(_){}if(!hs){P.x=SPAWN[0];P.z=SPAWN[1];P.face=SPAWN[2]}}
/* прибуття з острова пробудження через портал — на точку спавну */
try{const INV_=(()=>{try{return eval('inv')}catch(_){return null}})();if(!ISL&&(localStorage.getItem('zi_arrive')||(INV_&&INV_._arr))){localStorage.removeItem('zi_arrive');if(INV_)delete INV_._arr;P.x=SPAWN[0];P.z=SPAWN[1];P.face=SPAWN[2];setTimeout(()=>{try{msg('🌊 Ви прибули у великий світ Regnum Land!')}catch(_){}},1500)}}catch(_){}
/* рівень визначає здоровʼя, шкоду по герою й агресію */
function setup(w){const L=lvAt(w.x,w.z),b=T[w.ty].hp;w.lv=L;
 if(window.PW){const s=PW.stats(w.ty,L);w.mh=s.hp;w.atk=s.atk;w.def=s.def;w.hp=Math.round(w.mh*Math.max(0,Math.min(1,w.hp/b)));w.dm=PW.wildHit(w,true)}/* 0.5.x: показники Palworld, combat.js */
 else{w.mh=Math.round(b*(1+.12*(L-1)));w.hp=Math.round(w.mh*Math.max(0,Math.min(1,w.hp/b)));w.dm=Math.round(10*(1+.06*(L-1)))}if(!w.ag&&L>plv+5)w.ag=1}
window.wLvSetup=w=>{w.lv=0;setup(w)};/* 0.3.2: перерахувати рівень після переміщення (loc2.js) */
/* досвід під таблицю XPT (core-world.js): усі нагороди ×5 (XPM), за бій ще +10% за кожен рівень істоти;
   за значно слабших дають менше (до 20%), за сильніших — трохи більше. Модель: 20 рівень ~1 год, 50 — ~10 год, 100 — ~130 год активного бою */
window.XPM=5;
window.wXp=(w,base)=>{const L=(w&&w.lv)||1,d=L-plv,m=d>=0?1+.05*Math.min(d,10):Math.max(.2,1+.05*d);return Math.max(1,Math.round(base*XPM*(1+.1*(L-1))*m))};
/* ловля: сильніших істот ловити важче — тут і стають у пригоді кращі кулі; ще важче, якщо істота вища за героя */
window.wCatch=(w,ch)=>{const L=(w&&w.lv)||1,d=L-plv;let c=ch/(1+(L-1)/30);if(d>0)c*=Math.max(.3,1-.04*d);return Math.min(.95,c)};
/* мирні справи (збір, крафт): +2% за рівень героя — повільніше за бій, але не марно на високих рівнях */
window.gXp=n=>Math.max(1,Math.round(n*XPM*(1+.02*(plv-1))));
/* здоровʼя героя росте з рівнем */
if(!window.PW)window.hpMax=()=>100+4*(plv-1);/* з combat.js — HP героя в масштабі Palworld */
window.wPalLv=w=>Math.max(1,Math.min(PMAX,plv,(w&&w.lv)||1));
window.zoneInfo=(x,z)=>{if(ISL)return{n:'Острів пробудження',a:1,b:2};if(inBay(x,z))return{n:'Тиха бухта',a:1,b:3};const Z=ZN[zoneEff(x,z)];return{n:Z[1],a:Z[2],b:Z[3]}};
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
  const k=w.lv+':'+Math.max(0,Math.ceil(w.hp))+':'+w.mh+':'+(w.sl?1:0);if(b.w!==w||b.k!==k){b.w=w;b.k=k;b.s.innerHTML=`<b>${w.lv}</b> ${w.name||T[w.ty].n}${w.sl?' 💤':''}`;b.u.style.width=Math.max(0,Math.min(100,w.hp/w.mh*100))+'%';b.d.classList.toggle('hi',w.lv>plv+5)}}
 /* повідомлення про зону, коли гравець переходить в іншу */
 zT+=1;if(!ISL&&zT>30){zT=0;const z=inBay(P.x,P.z)?-2:zoneEff(P.x,P.z);if(z!==zLast){if(zLast!==-1&&!busy){if(z==-2)msg('🏖️ Тиха бухта · істоти рівня 1–3');else{const Z=ZN[z];msg('🗺️ '+Z[1]+' · істоти рівня '+Z[2]+'–'+Z[3])}}zLast=z}}
}catch(e){}loop()})})();
}catch(e){console.warn('wild-levels',e)}})();
