/* 0.3.1: боси.
   Рушій (window.BOSSKIT.add(cfg)) спільний для всіх босів:
   • бос живе на своїй арені (cfg.home, cfg.arena): коли герой поруч — нападає й іде за ним, утекли — повертається й лікується;
   • заклинання з часом підготовки: під смугою здоров'я боса — друга смуга «чаклує…», вона заповнюється 3–4 с, а на землі
     росте червоне коло, з якого треба встигнути вийти; коли смуга повна — удар;
   • кулею не ловиться; здобич щоразу різна — кілька кидків по таблиці cfg.loot; повертається через cfg.respawn (час у сейві inv._boss);
   • смуга здоров'я й заклинання — угорі екрана, коли ви на арені.
   Перший бос тут же — 👑 Страж ущелини (вогняний Ігніс-Виверг третьої форми в Старому лісі). Бос підземелля — у dungeon.js. */
(function(){try{
if(window.REALM==='isle'||typeof wild=='undefined')return;
if(!inv._boss||typeof inv._boss!='object')inv._boss={};
const L=[];/* усі боси */
const now=()=>Date.now();
const hpOf=w=>Math.max(0,Math.ceil(w.hp));
/* 0.3.2: шкода боса — частка здоров'я героя (так бій однаково важкий на будь-якому рівні), × різниця рівнів (combat.js, gapTake).
   Звичайний удар — b.melee від макс. здоров'я раз на секунду; заклинання — a.k від макс. здоров'я, якщо не встигли вийти з кола. */
const HPmax=()=>window.hpMax?window.hpMax():(typeof HPM!='undefined'?HPM:500);
const gapK=w=>window.PW&&PW.gapTake?PW.gapTake((w.lv||1)-(typeof plv!='undefined'?plv:1)):1;
const heroDmg=(w,k)=>Math.max(1,Math.round(HPmax()*k*gapK(w)*(window.plHeroDmgK?window.plHeroDmgK():1)));
if(window.PW&&PW.wildHit){const h0=PW.wildHit;PW.wildHit=function(w,avg){if(w&&w.boss){const b=L.find(q=>q.id===w.boss);if(b)return Math.max(1,Math.round(HPmax()*b.melee*gapK(w)))}return h0.apply(this,arguments)}}
function hurtHero(v,txt){P.hp-=v;try{dmg((txt||'')+'-'+v,pl,'#ff6b3a');hud()}catch(_){}if(P.hp<=0&&window.plHeroDown)window.plHeroDown()}
function hurtPal(w,R,x,z,k){const p=pals[selP];k=k*.6;if(!p||!p.m||!p.m.visible||p.cs!=null)return;if(Math.hypot(p.x-x,p.z-z)>R)return;
 const st=window.PW?PW.stats(p.ty,p.lv):{hp:500};const st2=window.PW?PW.stats(p.ty,p.lv):{hp:500},v=Math.max(1,Math.round(st2.hp*k));p.chp=(p.chp==null?st.hp:p.chp)-v;try{dmg('-'+v,p.m,'#ffb070')}catch(_){}
 if(p.chp<=0){p.chp=0;try{msg('💫 '+T[p.ty].n+' знесилився й повертається у сферу. Відновиться за хвилину');if(window.palToggle)palToggle()}catch(_){}}}

/* ---------- ефекти ---------- */
const fx=[];
function burst(x,y,z,c,n){for(let i=0;i<(n||10);i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.2,7,5),new THREE.MeshBasicMaterial({color:c,transparent:true}));m.position.set(x,y,z);sc.add(m);fx.push({m,v:[(Math.random()-.5)*8,Math.random()*7+2,(Math.random()-.5)*8],t:0})}}
function circle(x,y,z,R,col){const g=new THREE.Group(),d=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide})),
 r=new THREE.Mesh(new THREE.RingGeometry(.93,1,48),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide}));g.add(d,r);g.rotation.x=-Math.PI/2;g.position.set(x,y+.08,z);g.scale.setScalar(R);d.scale.setScalar(.02);sc.add(g);return{g,d,r}}

/* ---------- здобич: кілька кидків по таблиці, щоразу різне ---------- */
function roll(tab){const sum=tab.reduce((a,e)=>a+e.w,0);let r=Math.random()*sum;for(const e of tab){r-=e.w;if(r<=0)return e}return tab[tab.length-1]}
function giveLoot(b){const got={};for(const t of b.loot){if(t.chance!=null&&Math.random()>t.chance)continue;const e=roll(t.tab);const n=e.n[0]+Math.floor(Math.random()*(e.n[1]-e.n[0]+1));if(n>0)got[e.k]=(got[e.k]||0)+n}
 for(const k in got){if(k in res)res[k]+=got[k];else inv[k]=(inv[k]||0)+got[k]}showLoot(b,got);return got}
const lootBox=document.createElement('div');lootBox.id='bossloot';document.body.appendChild(lootBox);
function showLoot(b,got){const ico=k=>window.plIcon?plIcon(k):(IT[k]?IT[k][0]:'');
 lootBox.innerHTML=`<h4>🏆 ${b.name} переможений!</h4><div class='lg'>${Object.entries(got).map(([k,n])=>`<span>${ico(k)}<b>×${n}</b><small>${IT[k]?IT[k][1]:k}</small></span>`).join('')}</div><small class='nx'>Повернеться за ${Math.round(b.respawn/60000)} хв</small>`;
 lootBox.classList.add('on');clearTimeout(lootBox._t);lootBox._t=setTimeout(()=>lootBox.classList.remove('on'),6500)}

/* ---------- смуги ---------- */
const bar=document.createElement('div');bar.id='bossbar';bar.innerHTML="<b class='bn'></b><i class='hp'><u></u></i><small class='hv'></small><div class='cs'><em></em><i><u></u></i></div>";document.body.appendChild(bar);
const css=document.createElement('style');css.textContent=`#bossbar{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 50px);transform:translateX(-50%);width:min(440px,70vw);z-index:14;pointer-events:none;display:none;text-align:center;font-family:system-ui,sans-serif}
#bossbar .bn{display:block;color:#ffd34e;font:900 15px system-ui;letter-spacing:.5px;text-shadow:0 2px 4px #000}
#bossbar .hp{display:block;height:12px;margin-top:4px;border-radius:7px;background:rgba(20,8,6,.75);border:1.5px solid rgba(255,190,90,.7);overflow:hidden;box-shadow:0 0 14px rgba(255,90,30,.45)}
#bossbar .hp u{display:block;height:100%;background:linear-gradient(90deg,#ff3a1a,#ff9a3a);transition:width .2s}#bossbar .hv{display:block;margin-top:2px;color:#fff;font:700 11px system-ui;text-shadow:0 1px 2px #000}
#bossbar .cs{margin:6px auto 0;width:78%;visibility:hidden}#bossbar .cs.on{visibility:visible}
#bossbar .cs em{display:block;font:800 12px system-ui;font-style:normal;color:#e9d4ff;text-shadow:0 1px 3px #000}
#bossbar .cs i{display:block;height:8px;margin-top:3px;border-radius:5px;background:rgba(18,10,30,.8);border:1px solid rgba(200,160,255,.7);overflow:hidden}
#bossbar .cs u{display:block;height:100%;width:0;background:linear-gradient(90deg,#8a5aff,#e9d4ff)}
#bossloot{position:fixed;left:50%;top:32%;transform:translate(-50%,-50%);min-width:260px;max-width:86vw;z-index:9000;pointer-events:none;display:none;background:rgba(14,22,34,.94);border:2px solid #e2bf67;border-radius:16px;padding:14px 18px;text-align:center;color:#fff;font-family:system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)}
#bossloot.on{display:block;transform:translate(-50%,-50%)}#bossloot h4{margin:0 0 10px;color:#ffd34e;font-size:16px}
#bossloot .lg{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}#bossloot .lg span{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:66px;padding:6px;border-radius:10px;background:rgba(255,255,255,.06)}
#bossloot .lg img{width:40px;height:40px}#bossloot .lg b{color:#ffe28a}#bossloot .lg small{font-size:11px;color:#c9d6e4}#bossloot .nx{display:block;margin-top:8px;color:#9fb6d8;font-size:12px}`;document.head.appendChild(css);
const $b=s=>bar.querySelector(s);
function showBar(b){bar.style.display='block';$b('.bn').textContent=b.name+' · рів. '+b.lv;const w=b.w;$b('.hp u').style.width=Math.max(0,w.hp/w.mh*100)+'%';$b('.hv').textContent=hpOf(w).toLocaleString('uk-UA')+' / '+w.mh.toLocaleString('uk-UA');
 const c=b.cast,cs=$b('.cs');if(c){cs.classList.add('on');$b('.cs em').textContent='🔮 '+c.a.n+' · '+Math.max(0,c.T-c.t).toFixed(1)+' с';$b('.cs u').style.width=Math.min(100,c.t/c.T*100)+'%'}else cs.classList.remove('on')}

/* ---------- один бос ---------- */
function spawn(b){const m=mkPal(T[b.ty].c);sc.add(m);const s=window.PW?PW.stats(b.ty,b.lv):{hp:400,atk:60,def:40};
 const w={m,ty:b.ty,lv:b.lv,fm:b.fm,name:b.name,boss:b.id,hp:Math.round(s.hp*b.hpMul),mh:Math.round(s.hp*b.hpMul),atk:Math.round(s.atk*b.atkMul),def:Math.round(s.def*1.4),x:b.home[0],z:b.home[1],a:0,t:0,ag:0,cd:0,_r:b.r||2.2};
 m.position.set(w.x,b.y(w.x,w.z),w.z);m.scale.setScalar(b.scale);wild.push(w);b.w=w;b.cast=null;b.cds={};b.raged=0}
function release(b){const c=b.cast;b.cast=null;for(const z of c.zones){sc.remove(z.v.g);burst(z.x,b.y(z.x,z.z)+.4,z.z,c.a.col,12);
  if(Math.hypot(P.x-z.x,P.z-z.z)<=z.R)hurtHero(heroDmg(b.w,c.a.k),c.a.icon||'💥 ');hurtPal(b.w,z.R,z.x,z.z,c.a.k)}
 try{dmg((c.a.icon||'💥')+' '+c.a.n,b.w.m,'#ffcf7a')}catch(_){}}
function startCast(b,a){const w=b.w,zones=[];
 if(a.kind=='nova')zones.push({x:w.x,z:w.z,R:a.R});
 else for(let k=0;k<(a.cnt||3);k++){const ang=Math.random()*6.28,d=k?1.5+Math.random()*3.5:0,x=P.x+Math.cos(ang)*d,z=P.z+Math.sin(ang)*d;zones.push({x,z,R:a.R})}
 for(const z of zones)z.v=circle(z.x,b.y(z.x,z.z),z.z,z.R,a.col);b.cast={a,t:0,T:a.cast*(w.hp<w.mh*.35?.8:1),zones,px:w.x,pz:w.z};b.cds[a.n]=a.cd;try{dmg('🔮 '+a.n+'…',w.m,'#e9d4ff')}catch(_){}}
let last=performance.now(),shownB=null;
ANI.push(()=>{const t0=performance.now(),dt=Math.min(.05,(t0-last)/1000);last=t0;
 for(let i=fx.length-1;i>=0;i--){const f=fx[i];f.t+=dt;f.v[1]-=14*dt;f.m.position.x+=f.v[0]*dt;f.m.position.y+=f.v[1]*dt;f.m.position.z+=f.v[2]*dt;f.m.material.opacity=1-f.t;if(f.t>=1){sc.remove(f.m);f.m.geometry.dispose();fx.splice(i,1)}}
 let show=null;
 for(const b of L){
  if(!b.w||!wild.includes(b.w)){if(b.cast){for(const z of b.cast.zones)sc.remove(z.v.g);b.cast=null}if(b.enabled()&&(!inv._boss[b.id]||now()>=inv._boss[b.id]))spawn(b);continue}
  const w=b.w;w.m.scale.setScalar(b.scale);w.fm=b.fm;
  const inA=b.enabled()&&Math.hypot(P.x-b.home[0],P.z-b.home[1])<b.arena+2;
  if(!inA){w.ag=0;w._fightT=0;if(b.cast){for(const z of b.cast.zones)sc.remove(z.v.g);b.cast=null}const dh=Math.hypot(w.x-b.home[0],w.z-b.home[1]);
   if(dh>1.5){w.a=Math.atan2(b.home[0]-w.x,b.home[1]-w.z);w.x+=Math.sin(w.a)*3*dt;w.z+=Math.cos(w.a)*3*dt}w.hp=Math.min(w.mh,w.hp+w.mh*.03*dt)}
  else{w.ag=1;show=b;const dH=Math.hypot(P.x-w.x,P.z-w.z);
   if(b.cast){b.cast.t+=dt;w.x=b.cast.px;w.z=b.cast.pz;for(const z of b.cast.zones){z.v.d.scale.setScalar(Math.min(1,b.cast.t/b.cast.T));z.v.r.material.opacity=.55+.45*Math.sin(b.cast.t*14)}if(b.cast.t>=b.cast.T)release(b)}
   else{w.a=Math.atan2(P.x-w.x,P.z-w.z);const reach=(w._r||2)+.9;if(dH>reach&&b.chase){w.x+=Math.sin(w.a)*2.4*dt;w.z+=Math.cos(w.a)*2.4*dt}
    const rage=w.hp<w.mh*.35;if(rage&&!b.raged){b.raged=1;try{dmg('😡 Лють!',w.m,'#ff4a2a');msg('😡 '+b.name+' у люті: заклинання частіше!')}catch(_){}}
    for(const a of b.abil){b.cds[a.n]=(b.cds[a.n]==null?a.first:b.cds[a.n])-dt*(rage?1.6:1)}
    const ready=b.abil.filter(a=>b.cds[a.n]<=0&&(a.kind!='nova'||dH<a.R+2));if(ready.length)startCast(b,ready[Math.random()*ready.length|0])}}
  const dh=Math.hypot(w.x-b.home[0],w.z-b.home[1]),lim=b.arena-2;if(dh>lim){w.x=b.home[0]+(w.x-b.home[0])*lim/dh;w.z=b.home[1]+(w.z-b.home[1])*lim/dh}
  w.m.position.set(w.x,b.y(w.x,w.z),w.z);w.m.rotation.y=w.a}
 if(show){shownB=show;showBar(show)}else if(shownB){shownB=null;bar.style.display='none'}});

/* велика істота: герой дістає її з відстані її розміру (core-world.js: nearest(wild,2.6) — для звичайних) */
window.plBigTarget=()=>{let best=null,bd=1e9;for(const b of L){const w=b.w;if(!w||!wild.includes(w))continue;const d=Math.hypot(w.x-P.x,w.z-P.z);if(d<(w._r||2)+1.6&&d<bd){bd=d;best=w}}return best};
/* боса не спіймати */
{const c0=window.wCatch;window.wCatch=(w,ch)=>{if(w&&w.boss){setTimeout(()=>{try{msg('👑 Боса не спіймати — тільки перемогти')}catch(_){}},50);return 0}return c0?c0(w,ch):Math.min(.95,ch)}}
/* перемога */
{const sp=wild.splice;wild.splice=function(){const out=sp.apply(this,arguments);for(const w of out){if(!w||!w.boss||w.hp>0)continue;const b=L.find(q=>q.id===w.boss);if(!b)continue;
 try{inv._boss[b.id]=now()+b.respawn;giveLoot(b);addXp(window.wXp?wXp(w,b.xp||400):400);const p=w.m.position.clone();burst(p.x,p.y+2,p.z,0xffd34e,24);if(b.onWin)b.onWin();hud();save()}catch(e){console.warn('boss win',e)}}return out}}

window.BOSSKIT={add(cfg){const b=Object.assign({fm:3,scale:3,arena:18,hpMul:20,atkMul:1.6,melee:.02,respawn:600000,xp:400,chase:1,abil:[],loot:[],enabled:()=>true,y:(x,z)=>H(x,z)},cfg);L.push(b);return b},list:L,
 /* для перевірки: одразу почати вміння боса */castNow(id,i){const b=L.find(q=>q.id===id);if(b&&b.w&&!b.cast)startCast(b,b.abil[i||0])}};

/* ================= 👑 Страж ущелини ================= */
if(window.RIDGES){const RG=window.RIDGES,ARENA=18;
 let Lp=[-85,-62];/* 0.3.2: Старий ліс, ліворуч від озера (Локація 2) */
 for(let r=0;r<30;r+=2){let ok=null;for(let a=0;a<6.28&&!ok;a+=.5){const x=Lp[0]+Math.cos(a)*r,z=Lp[1]+Math.sin(a)*r;if(H(x,z)>-.2&&H(x,z)<6&&!RG.blocked(x,z,ARENA*.6))ok=[x,z]}if(ok){Lp=ok;break}}
 const HOME=Lp;window.BOSS_HOME=HOME;(window.MAPMARKS=window.MAPMARKS||[]).push({x:HOME[0],z:HOME[1],c:'#ff5a3a',t:''});
 /* арена: коло з брил і вогняних чаш; на ній нічого не росте, інші дикі туди не заходять */
 {const g=new THREE.Group(),y0=H(HOME[0],HOME[1]),stone=new THREE.MeshStandardMaterial({color:0x8d8578,roughness:1,flatShading:true}),dark=new THREE.MeshStandardMaterial({color:0x4a4038,roughness:1,flatShading:true});
  for(let i=0;i<14;i++){if(i%7==3)continue;const a=i/14*Math.PI*2,x=HOME[0]+Math.cos(a)*ARENA,z=HOME[1]+Math.sin(a)*ARENA;const m=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),i%2?stone:dark);m.scale.set(1.1,2.2+(i%3)*.7,1);m.position.set(x,H(x,z)+1,z);m.rotation.y=a;m.castShadow=true;g.add(m)}
  const fireM=new THREE.MeshStandardMaterial({color:0xff8a3a,emissive:0xff5a10,emissiveIntensity:1.6});
  for(const a of[.5,2.1,3.7,5.3]){const x=HOME[0]+Math.cos(a)*(ARENA-3),z=HOME[1]+Math.sin(a)*(ARENA-3),y=H(x,z);const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.6,.35,.6,10),dark);bowl.position.set(x,y+1,z);g.add(bowl);
   const leg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,1,6),dark);leg.position.set(x,y+.4,z);g.add(leg);const f=new THREE.Mesh(new THREE.ConeGeometry(.42,.9,8),fireM);f.position.set(x,y+1.65,z);f.userData.fire=1;g.add(f)}
  {const l=new THREE.PointLight(0xff7a2a,1.1,ARENA*1.6,2);l.position.set(HOME[0],y0+5,HOME[1]);g.add(l)}/* одне світло на всю арену — менше навантаження */
  const scorch=new THREE.Mesh(new THREE.CircleGeometry(ARENA-1.5,40),new THREE.MeshStandardMaterial({color:0x5a4a34,roughness:1,transparent:true,opacity:.45,depthWrite:false}));scorch.rotation.x=-Math.PI/2;scorch.position.set(HOME[0],y0+.05,HOME[1]);g.add(scorch);
  sc.add(g);ANI.push(()=>{const t=performance.now()/120;g.children.forEach((c,i)=>{if(c.userData.fire)c.scale.y=1+Math.sin(t+i)*.18})})}
 for(const nm of['trees','rocks','bushes','shrooms']){let A;try{A=eval(nm)}catch(_){A=null}if(!Array.isArray(A))continue;for(let i=A.length-1;i>=0;i--){const o=A[i];if(o&&Math.hypot(o.x-HOME[0],o.z-HOME[1])<ARENA+1.5){if(o.m)sc.remove(o.m);A.splice(i,1)}}}
 setInterval(()=>{for(const w of wild){if(w.boss||w.dg)continue;const d=Math.hypot(w.x-HOME[0],w.z-HOME[1]);if(d<ARENA+2){const k=(ARENA+4)/Math.max(.1,d);w.x=HOME[0]+(w.x-HOME[0])*k;w.z=HOME[1]+(w.z-HOME[1])*k}}},2000);
 if(typeof inv._bossT=='number'&&inv._bossT>0&&!inv._boss.warden){inv._boss.warden=inv._bossT}delete inv._bossT;/* сейв попередньої версії */
 window.BOSSKIT.add({id:'warden',name:'👑 Страж ущелини',ty:2,lv:25,fm:3,scale:3.1,r:2.4,home:HOME,arena:ARENA,hpMul:15,/* 0.2.15: було 24 — з паузою між ударами героя (0.5 с) бій тривав ~55 с і вимагав 5–6 зіль; тепер ~35 с і 2–3 зілля */atkMul:1.6,melee:.03,respawn:600000,xp:400,
  abil:[{n:'Вогняне коло',icon:'🔥 ',kind:'nova',R:7,cast:3,cd:9,first:5,k:.45,col:0xff3a1a},
        {n:'Вогняний дощ',icon:'☄️ ',kind:'rain',cnt:4,R:2.6,cast:3.2,cd:8,first:8,k:.32,col:0xff7a2a}],
  loot:[{tab:[{k:'cr2',n:[1,1],w:50},{k:'cr2',n:[2,2],w:15},{k:'hpp',n:[1,2],w:35}]},
        {chance:.6,tab:[{k:'hpp',n:[1,3],w:60},{k:'cr2',n:[1,1],w:40}]}]})}
window.BOSS={get:()=>{const b=L.find(q=>q.id=='warden');return b&&b.w},home:window.BOSS_HOME};
}catch(e){console.warn('boss',e)}})();
