/* 0.3.1: перший бос — Страж ущелини.
   • Величезний вогняний Ігніс-Виверг третьої форми, 30 рівень, живе в кам'яному колі за ущелиною (з боку від центру острова її не видно).
   • Б'є як звичайна дика істота, але сильніше; широкий удар по площі (червоне коло) і «вогняний дощ» — три кола довкола героя,
     з яких за секунду б'є вогонь. Відбігайте з кіл.
   • Далеко від свого кола не ходить: якщо герой утік за межу арени — бос повертається й поступово відновлює здоров'я.
   • Спіймати кулею не можна. Переможений — 1–2 Кристали еволюції, досвід і ресурси; з'являється знову через 10 хв (час у сейві: inv._bossT).
   • Над екраном — смуга здоров'я боса, коли ви поруч. */
(function(){try{
if(window.REALM==='isle'||typeof wild=='undefined'||!window.RIDGES)return;
const TY=2,LV=30,FM=3,SCALE=3.1,ARENA=18,RESPAWN=10*60*1000,NAME='👑 Страж ущелини';
const RG=window.RIDGES,G=RG.GZ,N=[-.157,.988];
/* лігво — за ущелиною, з протилежного від центру острова боку */
let L=[G[0]-N[0]*34,G[1]-N[1]*34];
for(let r=0;r<30;r+=2){let ok=null;for(let a=0;a<6.28&&!ok;a+=.5){const x=L[0]+Math.cos(a)*r,z=L[1]+Math.sin(a)*r;if(H(x,z)>-.2&&H(x,z)<6&&!RG.blocked(x,z,ARENA*.6))ok=[x,z]}if(ok){L=ok;break}}
const HOME=L;window.BOSS_HOME=HOME;
/* арена: коло з кам'яних брил і вогняних чаш */
{const g=new THREE.Group(),y0=H(HOME[0],HOME[1]),stone=new THREE.MeshStandardMaterial({color:0x8d8578,roughness:1,flatShading:true}),dark=new THREE.MeshStandardMaterial({color:0x4a4038,roughness:1,flatShading:true});
 for(let i=0;i<14;i++){const a=i/14*Math.PI*2,x=HOME[0]+Math.cos(a)*ARENA,z=HOME[1]+Math.sin(a)*ARENA;if(i%7==3)continue;/* два проходи */
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),i%2?stone:dark);m.scale.set(1.1,2.2+(i%3)*.7,1);m.position.set(x,H(x,z)+1,z);m.rotation.y=a;m.castShadow=true;g.add(m)}
 const fireM=new THREE.MeshStandardMaterial({color:0xff8a3a,emissive:0xff5a10,emissiveIntensity:1.6});
 for(const a of[.5,2.1,3.7,5.3]){const x=HOME[0]+Math.cos(a)*(ARENA-3),z=HOME[1]+Math.sin(a)*(ARENA-3),y=H(x,z);
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.6,.35,.6,10),dark);bowl.position.set(x,y+1,z);g.add(bowl);const leg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,1,6),dark);leg.position.set(x,y+.4,z);g.add(leg);
  const f=new THREE.Mesh(new THREE.ConeGeometry(.42,.9,8),fireM);f.position.set(x,y+1.65,z);f.userData.fire=1;g.add(f);const l=new THREE.PointLight(0xff7a2a,.9,9,2);l.position.set(x,y+2,z);g.add(l)}
 const scorch=new THREE.Mesh(new THREE.CircleGeometry(ARENA-1.5,40),new THREE.MeshStandardMaterial({color:0x5a4a34,roughness:1,transparent:true,opacity:.45,depthWrite:false}));scorch.rotation.x=-Math.PI/2;scorch.position.set(HOME[0],y0+.05,HOME[1]);g.add(scorch);
 sc.add(g);ANI.push(()=>{const t=performance.now()/120;g.children.forEach((c,i)=>{if(c.userData.fire)c.scale.y=1+Math.sin(t+i)*.18})})}

/* на арені нічого не росте: прибрати дерева, каміння, кущі й гриби; інших диких істот — геть з кола */
for(const nm of['trees','rocks','bushes','shrooms']){let A;try{A=eval(nm)}catch(_){A=null}if(!Array.isArray(A))continue;for(let i=A.length-1;i>=0;i--){const o=A[i];if(o&&Math.hypot(o.x-HOME[0],o.z-HOME[1])<ARENA+1.5){if(o.m)sc.remove(o.m);A.splice(i,1)}}}
setInterval(()=>{for(const w of wild){if(w.boss)continue;const d=Math.hypot(w.x-HOME[0],w.z-HOME[1]);if(d<ARENA+2){const k=(ARENA+4)/Math.max(.1,d);w.x=HOME[0]+(w.x-HOME[0])*k;w.z=HOME[1]+(w.z-HOME[1])*k}}},2000);
/* ---------- сам бос ---------- */
let B=null;
const bossStats=()=>{const s=window.PW?PW.stats(TY,LV):{hp:400,atk:60,def:40};return{hp:Math.round(s.hp*22),atk:Math.round(s.atk*1.7),def:Math.round(s.def*1.5)}};
function spawn(){if(B&&wild.includes(B))return;const m=mkPal(T[TY].c);m.position.set(HOME[0],H(HOME[0],HOME[1]),HOME[1]);m.scale.setScalar(SCALE);sc.add(m);
 const s=bossStats();B={m,ty:TY,lv:LV,fm:FM,name:NAME,boss:1,hp:s.hp,mh:s.hp,atk:s.atk,def:s.def,x:HOME[0],z:HOME[1],a:0,t:0,ag:0,cd:0,aoeR:6,_r:2.4};wild.push(B);inv._bossT=0}
const due=()=>!inv._bossT||Date.now()>=inv._bossT;
setInterval(()=>{if((!B||!wild.includes(B))&&due())spawn()},3000);if(due())spawn();

/* не ловиться кулею */
{const c0=window.wCatch;window.wCatch=(w,ch)=>{if(w&&w.boss){setTimeout(()=>{try{msg('👑 Боса не спіймати — тільки перемогти')}catch(_){}},50);return 0}return c0?c0(w,ch):Math.min(.95,ch)}}
/* бос б'є сильніше */
if(window.PW&&PW.wildHit){const h0=PW.wildHit;PW.wildHit=function(w){const v=h0.apply(this,arguments);return w&&w.boss?Math.round(v*1.6):v}}

/* перемога: кристали, досвід, ресурси; наступна поява — через 10 хв */
{const sp=wild.splice;wild.splice=function(){const out=sp.apply(this,arguments);for(const w of out)if(w&&w.boss&&w.hp<=0)try{won(w)}catch(e){console.warn('boss',e)}return out}}
function won(w){inv._bossT=Date.now()+RESPAWN;const n=Math.random()<.35?2:1;inv.cr2=(inv.cr2||0)+n;inv.w=(inv.w||0);res.w+=20;res.s+=20;
 try{addXp(window.wXp?wXp(w,400):400)}catch(_){}
 const p=w.m.position.clone();for(let i=0;i<24;i++)burst(p.x,p.y+2,p.z,i%2?0xffd34e:0x7fe3f5);
 msg('🏆 Страж ущелини переможений! 💎 Кристал еволюції ×'+n+' · 🪵 +20 · 🪨 +20 · повернеться за 10 хв');try{dmg('💎 ×'+n,{position:p},'#7fe3f5');hud();save()}catch(_){}hideBar()}

/* ---------- поведінка: тримається арени, лікується, якщо герой утік ---------- */
const fx=[];
function burst(x,y,z,c){const m=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),new THREE.MeshBasicMaterial({color:c,transparent:true}));m.position.set(x,y,z);sc.add(m);fx.push({m,v:[(Math.random()-.5)*8,Math.random()*7+2,(Math.random()-.5)*8],t:0})}
function circle(x,z,R){const g=new THREE.Group(),d=new THREE.Mesh(new THREE.CircleGeometry(1,36),new THREE.MeshBasicMaterial({color:0xff3a1a,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide})),
 r=new THREE.Mesh(new THREE.RingGeometry(.92,1,44),new THREE.MeshBasicMaterial({color:0xff6a2a,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide}));g.add(d,r);g.rotation.x=-Math.PI/2;g.position.set(x,H(x,z)+.08,z);g.scale.setScalar(R);sc.add(g);return{g,d}}
const rains=[];let rainCd=8,last=performance.now();
function rainNow(){for(let k=0;k<3;k++){const a=Math.random()*6.28,d=k?1.5+Math.random()*3:0,x=P.x+Math.cos(a)*d,z=P.z+Math.sin(a)*d;rains.push({x,z,t:0,c:circle(x,z,2.2)})}try{dmg('🔥 Вогняний дощ!',B.m,'#ffb070')}catch(_){}}
ANI.push(()=>{const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;
 for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.t+=dt;f.v[1]-=14*dt;f.m.position.x+=f.v[0]*dt;f.m.position.y+=f.v[1]*dt;f.m.position.z+=f.v[2]*dt;f.m.material.opacity=1-f.t;if(f.t>=1){sc.remove(f.m);fx.splice(i,1)}}
 for(let i=rains.length-1;i>=0;i--){const r=rains[i];r.t+=dt;r.c.d.scale.setScalar(Math.min(1,r.t/1.1));
  if(r.t>=1.1){sc.remove(r.c.g);rains.splice(i,1);for(let k=0;k<8;k++)burst(r.x,H(r.x,r.z)+.3,r.z,0xff7a2a);
   if(Math.hypot(P.x-r.x,P.z-r.z)<=2.2){const v=Math.max(1,Math.round((window.PW?PW.wildHit(B||{ty:TY,lv:LV}):40)*.7*(window.plHeroDmgK?window.plHeroDmgK():1)));P.hp-=v;try{dmg('🔥 -'+v,pl,'#ff6b3a');hud()}catch(_){}if(P.hp<=0&&window.plHeroDown)window.plHeroDown()}}}
 if(!B||!wild.includes(B)||!B.m)return;
 B.m.scale.setScalar(SCALE);B.fm=FM;
 const dHome=Math.hypot(B.x-HOME[0],B.z-HOME[1]),dHero=Math.hypot(P.x-HOME[0],P.z-HOME[1]),near=dHero<ARENA+2;
 if(near&&(B._fightT>0||B.ag||Math.hypot(P.x-B.x,P.z-B.z)<ARENA*.8))B.ag=1;
 if(!near){B.ag=0;B._fightT=0;if(dHome>1.5){B.a=Math.atan2(HOME[0]-B.x,HOME[1]-B.z);B.x+=Math.sin(B.a)*3*dt;B.z+=Math.cos(B.a)*3*dt}B.hp=Math.min(B.mh,B.hp+B.mh*.02*dt)}/* утекли — повертається й лікується */
 if(dHome>ARENA-1.5){const k=(ARENA-1.5)/dHome;B.x=HOME[0]+(B.x-HOME[0])*k;B.z=HOME[1]+(B.z-HOME[1])*k}
 /* вогняний дощ: три кола довкола героя */
 if(B.ag&&near){rainCd-=dt;if(rainCd<=0){rainCd=9+Math.random()*4;rainNow()}}
 showBar(near)});

/* ---------- смуга здоров'я боса ---------- */
const bar=document.createElement('div');bar.id='bossbar';bar.innerHTML="<b></b><i><u></u></i><small></small>";document.body.appendChild(bar);
const css=document.createElement('style');css.textContent=`#bossbar{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 54px);transform:translateX(-50%);width:min(440px,70vw);z-index:14;pointer-events:none;display:none;text-align:center;font-family:system-ui,sans-serif}
#bossbar b{display:block;color:#ffd34e;font:900 15px system-ui;letter-spacing:.5px;text-shadow:0 2px 4px #000}
#bossbar i{display:block;height:12px;margin-top:4px;border-radius:7px;background:rgba(20,8,6,.75);border:1.5px solid rgba(255,190,90,.7);overflow:hidden;box-shadow:0 0 14px rgba(255,90,30,.45)}
#bossbar u{display:block;height:100%;background:linear-gradient(90deg,#ff3a1a,#ff9a3a);transition:width .2s}#bossbar small{display:block;margin-top:2px;color:#fff;font:700 11px system-ui;text-shadow:0 1px 2px #000}`;document.head.appendChild(css);
let shown=false;function showBar(on){if(!on){if(shown)hideBar();return}shown=true;bar.style.display='block';bar.querySelector('b').textContent=NAME+' · рів. '+LV;bar.querySelector('u').style.width=Math.max(0,B.hp/B.mh*100)+'%';bar.querySelector('small').textContent=Math.max(0,Math.ceil(B.hp)).toLocaleString('uk-UA')+' / '+B.mh.toLocaleString('uk-UA')}
function hideBar(){shown=false;bar.style.display='none'}
window.BOSS={get:()=>B,home:HOME,spawn,rainNow};
}catch(e){console.warn('boss',e)}})();
