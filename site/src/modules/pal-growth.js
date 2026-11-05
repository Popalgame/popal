/* 0.2.9: розвиток попалів — ролі, атаки за рівнем і бій супутника за роллю.
   • Ролі: ⚔️ ДД (ближній бій), 🏹 РДД (дальній бій), 💚 Хіл (лікує героя), 🛡️ Танк (забирає ворогів на себе).
     Пасивні вміння ролі: Танк — дикі істоти поруч б'ють його, а не героя, і він отримує на 25% менше урону;
     Хіл — підлікує героя, коли HP нижче 80%; ДД — +15% урону впритул; РДД — тримає дистанцію 6–7 м.
   • Атаки: у кожного попала 9 атак — 1 стандартна (з 1 рівня), 4 можливі для 2-го слота (відкривається на 10 рівні)
     і 4 інші для 3-го слота (30 рівень). Атака слота обирається випадково, тож у кожного гравця свій набір.
   • Супутник сам обирає атаку: хіл лікує, танк провокує, решта б'є найсильнішою готовою; кожна атака має свою перезарядку.
   • У супутника є здоров'я. Дикі істоти б'ють того, хто ближче (героя чи попала), а танка — в першу чергу.
     Знесилений попал повертається у сферу й відновлюється.
   • Атаки диких — по одній цілі (герой або попал) і масові: удар по площі з червоним колом-попередженням б'є всіх у колі.
   • Форма (1–3) підсилює атаку, захист і здоров'я — evolution.js. Дані зберігаються в inv._pg (за порядком pals). */
(function(){try{
if(typeof pals=='undefined'||typeof THREE=='undefined')return;

/* ---------- ролі ---------- */
const ROLE={dd:['⚔️','ДД','Ближній бій'],rdd:['🏹','РДД','Дальній бій'],heal:['💚','Хіл','Лікує героя'],tank:['🛡️','Танк','Забирає ворогів на себе']};
const ROLES=['tank','tank','rdd','dd','heal','heal','rdd','dd','dd','rdd'];
const COL={gr:0x5fdc7a,ea:0xc89a5a,cr:0x7fe3f5,fi:0xff7a2a,da:0xa77ae6,ne:0xfff4fa,pk:0xffa8c8,ai:0xe8f4ff,po:0xffd34e,ic:0x9fe8ff,el:0xffe14a,wa:0x3ad0ff,su:0xffc94a};

/* ---------- атаки ----------
   k: shot — снаряд; multi — кілька снарядів (n); beam — промінь; melee — ривок і удар (hits — кількість ударів);
      aoe — вибух навколо цілі (R); nova — хвиля навколо попала (R); dot — горіння/отрута (dps × 4 с);
      heal — лікує героя (h — частка HP); shield — щит на героя (d с, −40% урону); taunt — провокація (R, d с)
   slow: true — ціль сповільнюється на 3 с. p — сила, cd — перезарядка (с), r — дальність (м), c — колір */
const A=(n,k,p,cd,c,x)=>Object.assign({n,k,p,cd,c,r:k=='melee'?2.4:k=='nova'||k=='heal'||k=='shield'||k=='taunt'?30:9},x||{});
const SK=[
 /* 0 Бамбузл · трава · танк */
 {s:A('Бамбуковий удар','melee',40,2.2,COL.gr),
  a2:[A('Кличний рик','taunt',0,14,COL.gr,{R:8,d:6}),A('Бамбуковий смерч','nova',55,8,COL.gr,{R:3.2}),A('Листяний щит','shield',0,16,COL.gr,{d:6}),A('Пастка коріння','aoe',30,10,COL.gr,{R:2.6,slow:1})],
  a3:[A('Панда-таран','melee',85,7,COL.gr),A('Бамбуковий гай','aoe',70,11,COL.gr,{R:3.8}),A('Непохитна панда','taunt',0,18,COL.gr,{R:10,d:8}),A('Бамбуковий град','multi',30,6,COL.gr,{n:3})]},
 /* 1 Грумрок · земля/кристал · танк */
 {s:A('Кам’яний удар','melee',42,2.3,COL.ea),
  a2:[A('Гірський рев','taunt',0,14,COL.ea,{R:8,d:6}),A('Кристальна лавина','aoe',60,9,COL.cr,{R:3}),A('Кам’яна шкіра','shield',0,16,COL.ea,{d:6}),A('Земляний поштовх','nova',50,10,COL.ea,{R:3,slow:1})],
  a3:[A('Кристалевий бур','melee',90,7,COL.cr),A('Обвал','aoe',75,12,COL.ea,{R:4}),A('Кристальний бастіон','taunt',0,18,COL.cr,{R:10,d:8}),A('Самоцвітний залп','multi',32,6,COL.cr,{n:3})]},
 /* 2 Ігніс-Виверг · вогонь · РДД */
 {s:A('Вогняний плювок','shot',40,2,COL.fi),
  a2:[A('Плазмова павутина','shot',35,7,COL.fi,{slow:1}),A('Вогняна злива','multi',30,6,COL.fi,{n:3}),A('Палаюча мітка','dot',22,8,COL.fi,{dps:14}),A('Вибух лави','aoe',60,9,COL.fi,{R:2.8})],
  a3:[A('Плазмовий промінь','beam',85,7,COL.fi),A('Вулканічний дощ','aoe',70,11,COL.fi,{R:4}),A('Пекельна сітка','dot',30,10,COL.fi,{dps:24,slow:1}),A('Вогняний вихор','nova',70,10,COL.fi,{R:3.5})]},
 /* 3 Міражбр · темрява · ДД */
 {s:A('Тіньовий кіготь','melee',42,1.9,COL.da),
  a2:[A('Тіньовий двійник','melee',30,6,COL.da,{hits:2}),A('Удар із тіні','melee',65,6,COL.da,{dash:1}),A('Отрута сутінків','dot',20,8,COL.da,{dps:16}),A('Міражний ривок','melee',50,7,COL.da,{dash:1,slow:1})],
  a3:[A('Безодня','aoe',70,11,COL.da,{R:3}),A('Тіньовий шквал','melee',95,7,COL.da,{dash:1}),A('Прокляття тіні','dot',30,10,COL.da,{dps:26}),A('Примарний вир','nova',75,10,COL.da,{R:3})]},
 /* 4 Пухоклуб · нейтральний · хіл */
 {s:A('Пухнастий стусан','shot',32,2.4,COL.ne),
  a2:[A('Хмаринка здоров’я','heal',0,10,COL.pk,{h:.15}),A('Пухова завіса','shield',0,16,COL.ne,{d:6}),A('Хмарний відскок','melee',45,6,COL.ne,{dash:1}),A('Колискова','aoe',20,12,COL.pk,{R:3,slow:1})],
  a3:[A('Велике зцілення','heal',0,16,COL.pk,{h:.3}),A('Пуховий кокон','shield',0,20,COL.ne,{d:9}),A('Грозова хмара','aoe',55,10,COL.ne,{R:3.5}),A('Дощ із хмаринок','heal',0,13,COL.pk,{h:.22})]},
 /* 5 Крилоша · повітря · хіл */
 {s:A('Пилковий постріл','shot',32,2.2,COL.po),
  a2:[A('Цілющий пилок','heal',0,10,COL.po,{h:.15}),A('Пилковий вихор','aoe',45,8,COL.po,{R:3}),A('Крилатий щит','shield',0,16,COL.ai,{d:6}),A('Сонний пилок','aoe',20,12,COL.po,{R:3,slow:1})],
  a3:[A('Квітковий дощ','heal',0,16,COL.po,{h:.3}),A('Буревій','nova',65,10,COL.ai,{R:3.8}),A('Веселкова завіса','shield',0,20,COL.ai,{d:9}),A('Метеликова зграя','multi',25,6,COL.po,{n:4})]},
 /* 6 Мороріг · лід · РДД */
 {s:A('Крижаний спис','shot',42,2.1,COL.ic),
  a2:[A('Крижаний спалах','aoe',55,9,COL.ic,{R:2.8,slow:1}),A('Град','multi',30,6,COL.ic,{n:3}),A('Морозний подих','beam',55,7,COL.ic,{slow:1}),A('Ожеледь','aoe',25,11,COL.ic,{R:3.5,slow:1})],
  a3:[A('Крижана комета','shot',95,8,COL.ic,{big:1}),A('Хуртовина','aoe',70,12,COL.ic,{R:4.5,slow:1}),A('Абсолютний нуль','beam',90,8,COL.ic),A('Крижані роги','multi',45,7,COL.ic,{n:2})]},
 /* 7 Грозовик · темрява/повітря · ДД */
 {s:A('Грозовий укус','melee',45,1.9,COL.el),
  a2:[A('Грозовий стрибок','melee',60,6,COL.el,{dash:1}),A('Ланцюгова блискавка','beam',50,6,COL.el),A('Іскристі кігті','dot',25,8,COL.el,{dps:15}),A('Тіньовий рик','nova',45,8,COL.da,{R:2.8})],
  a3:[A('Громовий удар','aoe',80,10,COL.el,{R:3.5}),A('Блискавичний шквал','melee',95,7,COL.el,{dash:1}),A('Буря тіней','nova',75,11,COL.da,{R:3.8}),A('Розряд','beam',90,8,COL.el)]},
 /* 8 Хвилезуб · вода · ДД */
 {s:A('Хвильовий укус','melee',45,2,COL.wa),
  a2:[A('Акулячий ривок','melee',65,6,COL.wa,{dash:1}),A('Водяний вир','nova',50,8,COL.wa,{R:3,slow:1}),A('Кровожерний укус','dot',25,8,COL.wa,{dps:15}),A('Водяний струмінь','beam',50,6,COL.wa)],
  a3:[A('Цунамі','aoe',75,12,COL.wa,{R:4.5}),A('Пожирач','melee',100,8,COL.wa,{dash:1}),A('Глибинний вир','nova',70,10,COL.wa,{R:3.8,slow:1}),A('Шторм іклів','melee',35,7,COL.wa,{hits:3})]},
 /* 9 Сонцеклюв · вогонь/повітря · РДД */
 {s:A('Сонячне перо','shot',40,2,COL.su),
  a2:[A('Сонячний вінець','nova',55,8,COL.su,{R:3}),A('Вогняні пера','multi',30,6,COL.su,{n:3}),A('Сонячний промінь','beam',60,7,COL.su),A('Сліпучий спалах','aoe',45,9,COL.su,{R:3,slow:1})],
  a3:[A('Пікірування фенікса','melee',95,8,COL.fi,{dash:1}),A('Сонячна буря','aoe',75,12,COL.su,{R:4.5}),A('Зоряний промінь','beam',100,9,COL.su),A('Дощ вогняних пер','multi',28,7,COL.su,{n:5})]}];
const ELK={gr:'gr',ea:'ea',fi:'fi',da:'da',ne:'ne',ai:'ai',wa:'wa'};
const elOf=(ty)=>{const e=(T[ty]&&T[ty].e)||['ne'];return ELK[e[0]]||'ne'};

/* ---------- стан попала: форма, атаки слотів 2 і 3, здоров'я ---------- */
if(!Array.isArray(inv._pg))inv._pg=[];
pals.forEach((p,i)=>{const g=inv._pg[i];if(Array.isArray(g)){p.fm=g[0]||1;p.at=[g[1]==null?-1:g[1],g[2]==null?-1:g[2]];if(g[3]!=null)p.chp=g[3]}});
const FORM=[1,1,1.2,1.45];
const role=p=>ROLES[p.ty]||'dd';
const kit=p=>SK[p.ty]||SK[0];
function slots(p){const k=kit(p),at=p.at||[-1,-1];return[k.s,at[0]>=0?k.a2[at[0]]:null,at[1]>=0?k.a3[at[1]]:null]}
function stats(p){const s=window.PW?PW.stats(p.ty,p.lv||1):{hp:300,atk:100,def:80},f=FORM[p.fm||1]||1;return{hp:Math.round(s.hp*f),atk:Math.round(s.atk*f),def:Math.round(s.def*f)}}
function roll(pool,not){const L=pool.map((_,i)=>i).filter(i=>i!==not);return L[Math.floor(Math.random()*L.length)]}
/* відкриття атак за рівнем; quiet — без повідомлення (при завантаженні) */
function unlock(p,quiet){p.at=p.at||[-1,-1];const k=kit(p),lv=p.lv||1,nm=(T[p.ty]||{}).n||'Попал';let got=null;
 if(lv>=10&&p.at[0]<0){p.at[0]=roll(k.a2);got=k.a2[p.at[0]]}
 if(lv>=30&&p.at[1]<0){p.at[1]=roll(k.a3);got=k.a3[p.at[1]]}
 if(got&&!quiet){try{msg('✨ '+nm+' вивчив нову атаку: «'+got.n+'»!');if(window.PSFX)PSFX.sfx('level')}catch(_){}}}
pals.forEach(p=>unlock(p,true));
/* нові попали: форма 1, атаки за рівнем (спійманий 12-го рівня одразу знає другу атаку) */
setInterval(()=>{for(const p of pals){if(p.fm==null)p.fm=1;const L=p.lv||1;if(p._lvSeen!==L){p._lvSeen=L;unlock(p,p._seen0==null);p._seen0=1}}},700);
/* збереження: wrap save() — дані пишуться в inv перед кожним збереженням */
const _sv=save;save=function(){try{inv._pg=pals.map(p=>[p.fm||1,(p.at||[-1,-1])[0],(p.at||[-1,-1])[1],p.chp==null?null:Math.round(p.chp)])}catch(_){}return _sv.apply(this,arguments)};

/* ---------- ефекти ---------- */
const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
 g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
const FX=[];
/* прибрати об'єкт ефекту й звільнити пам'ять (геометрію спрайтів three.js ділить між усіма — її не чіпаємо) */
function kill(m){sc.remove(m);m.traverse(o=>{if(o.geometry&&!o.isSprite)o.geometry.dispose();if(o.material)o.material.dispose()})}
function glow(c,s){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:c,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));m.scale.setScalar(s);return m}
function orb(c,s){const g=new THREE.Group(),core=new THREE.Mesh(new THREE.SphereGeometry(s*.32,12,10),new THREE.MeshBasicMaterial({color:0xffffff}));g.add(core,glow(c,s*1.6));return g}
function ringFx(x,y,z,c,R,t){const m=new THREE.Mesh(new THREE.RingGeometry(.82,1,40),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
 m.rotation.x=-Math.PI/2;m.position.set(x,y+.08,z);sc.add(m);FX.push({m,t:0,d:t||.55,u(k){m.scale.setScalar(.2+R*k);m.material.opacity=.85*(1-k)}})}
function burstFx(x,y,z,c,n,up){for(let i=0;i<(n||8);i++){const s=glow(c,.35+Math.random()*.3),a=Math.random()*6.28,v=1+Math.random()*1.5;s.position.set(x,y,z);sc.add(s);
 FX.push({m:s,t:0,d:.6+Math.random()*.3,u(k){s.position.set(x+Math.cos(a)*v*k,y+(up?2.2*k:Math.sin(k*Math.PI)*.8),z+Math.sin(a)*v*k);s.material.opacity=1-k}})}}
function beamFx(a,b,c){const d=b.clone().sub(a),L=d.length(),g=new THREE.Group();
 const core=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,L,8,1,true),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false}));
 const halo=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,L,10,1,true),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));
 g.add(core,halo);g.position.copy(a).add(b).multiplyScalar(.5);g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());sc.add(g);
 FX.push({m:g,t:0,d:.4,u(k){core.material.opacity=1-k;halo.material.opacity=.55*(1-k);g.scale.set(1-k*.6,1,1-k*.6)}})}
function bubble(o,c,dur){const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending}));
 sc.add(m);FX.push({m,t:0,d:dur,u(k){m.position.set(o.position.x,o.position.y+.9,o.position.z);m.scale.setScalar(1.05+Math.sin(k*dur*6)*.04);m.material.opacity=.22*(k>.85?(1-k)/.15:1)}})}
function tickFx(dt){for(let i=FX.length-1;i>=0;i--){const f=FX[i];f.t+=dt;const k=Math.min(1,f.t/f.d);f.u(k);if(k>=1){kill(f.m);FX.splice(i,1)}}}
/* снаряд: летить дугою від попала до цілі, по прибутті — on() */
const SH=[];
function shoot(from,w,c,big,on,delay){const m=orb(c,big?.9:.55);m.visible=false;sc.add(m);SH.push({m,w,x0:from.x,y0:from.y,z0:from.z,t:-(delay||0),c,on})}
function tickShots(dt){for(let i=SH.length-1;i>=0;i--){const s=SH[i];s.t+=dt*2.4;if(s.t<0)continue;s.m.visible=true;const k=Math.min(1,s.t),w=s.w,ty=H(w.x,w.z)+.8;
 s.m.position.set(s.x0+(w.x-s.x0)*k,s.y0+(ty-s.y0)*k+Math.sin(k*Math.PI)*.7,s.z0+(w.z-s.z0)*k);if(k<1)continue;kill(s.m);SH.splice(i,1);if(wild.includes(w)){burstFx(w.x,ty,w.z,s.c,6);s.on(w)}}}

/* ---------- урон ---------- */
const cur=()=>{const p=pals[selP];return p&&(!window.palOn||palOn())&&p.m&&p.m.visible?p:null};
function hitWild(p,w,a,mult){if(!wild.includes(w))return;const s=stats(p),e=elOf(p.ty),rl=role(p);
 let r;if(window.PW){r=PW.hit({lv:p.lv||1,sp:a.p*(mult||1)*(rl=='dd'&&a.k=='melee'?1.15:1),atk:s.atk,def:w.def||PW.stats(w.ty,w.lv).def,el:e,own:(T[p.ty]&&T[p.ty].e)||[e],ds:(T[w.ty]&&T[w.ty].e)||['ne'],sleep:w.sl});if(w.sl){w.sl=0}}
 else r={v:Math.round(a.p*(mult||1)*.3*(1+.1*(p.lv||1))),tag:''};
 w.hp=Math.max(1,w.hp-r.v);w.ag=1;w._fightT=10;try{flash(w)}catch(_){}
 dmg(a.n+' '+r.v+(r.tag||''),w.m,'#'+a.c.toString(16).padStart(6,'0'));if(a.slow)w._slow=3;
 if(window.palXp)palXp(p,3);if(w.hp<=1&&!w.wk){w.wk=1;msg('🔮 '+T[w.ty].n+' ослаблена! Киньте кулю')}}
/* DoT — горіння/отрута/струм */
setInterval(()=>{for(const w of wild){if(!(w._dot>0))continue;w._dot--;const p=w._dotP;if(!p)continue;w.hp=Math.max(1,w.hp-w._dotV);try{dmg(String(w._dotV),w.m,'#'+w._dotC.toString(16).padStart(6,'0'));burstFx(w.x,H(w.x,w.z)+.9,w.z,w._dotC,3,1)}catch(_){}if(w.hp<=1&&!w.wk){w.wk=1;msg('🔮 '+T[w.ty].n+' ослаблена! Киньте кулю')}}},1000);

/* ---------- щит героя, урон по героях ---------- */
let shieldT=0;
window.plHeroDmgK=()=>shieldT>0?.6:1;
const HP=()=>{try{return HPM}catch(_){return window.hpMax?hpMax():500}};
function healHero(p,a){const add=Math.round(HP()*a.h*(FORM[p.fm||1]||1));P.hp=Math.min(HP(),P.hp+add);p.chp=Math.min(stats(p).hp,(p.chp||0)+add*.5);
 try{dmg('+'+add+' ❤️',pl,'#7dff9a');hud()}catch(_){}burstFx(P.x,(pl.position.y||0)+.4,P.z,a.c,12,1);ringFx(P.x,pl.position.y,P.z,a.c,2.2,.7)}

/* ---------- виконання атаки ---------- */
function cast(p,a,w){const c=a.c,from=new THREE.Vector3(p.x,(p.m.position.y||0)+.8,p.z),y=w?H(w.x,w.z):0;
 switch(a.k){
  case'shot':shoot(from,w,c,a.big,t=>hitWild(p,t,a));break;
  case'multi':for(let i=0;i<a.n;i++)shoot(from,w,c,0,t=>hitWild(p,t,a),i*.12);break;
  case'beam':{beamFx(from,new THREE.Vector3(w.x,y+.8,w.z),c);burstFx(w.x,y+.8,w.z,c,8);hitWild(p,w,a);break}
  case'melee':{p._dash=a.dash?.35:.18;const n=a.hits||1;for(let i=0;i<n;i++)setTimeout(()=>{if(!wild.includes(w))return;ringFx(w.x,H(w.x,w.z),w.z,c,1.6,.35);burstFx(w.x,H(w.x,w.z)+.8,w.z,c,6);hitWild(p,w,a)},180+i*160);break}
  case'aoe':shoot(from,w,c,1,t=>{const x=t.x,z=t.z;ringFx(x,H(x,z),z,c,a.R*1.1,.6);burstFx(x,H(x,z)+.5,z,c,14);for(const o of wild.slice())if(Math.hypot(o.x-x,o.z-z)<=a.R)hitWild(p,o,a)});break;
  case'nova':{ringFx(p.x,p.m.position.y,p.z,c,a.R*1.15,.6);burstFx(p.x,p.m.position.y+.6,p.z,c,14);for(const o of wild.slice())if(Math.hypot(o.x-p.x,o.z-p.z)<=a.R)hitWild(p,o,a);break}
  case'dot':shoot(from,w,c,0,t=>{hitWild(p,t,a);t._dot=4;t._dotP=p;t._dotC=c;t._dotV=Math.max(1,Math.round(a.dps*(1+.04*(p.lv||1))*(FORM[p.fm||1]||1)))});break;
  case'heal':healHero(p,a);break;
  case'shield':{shieldT=a.d;bubble(pl,c,a.d);ringFx(P.x,pl.position.y,P.z,c,2,.6);try{msg('🛡️ '+(T[p.ty]||{}).n+': «'+a.n+'» — урон по вас −40%')}catch(_){}break}
  case'taunt':{p._tauntT=a.d;ringFx(p.x,p.m.position.y,p.z,c,a.R,.8);for(const o of wild)if(Math.hypot(o.x-p.x,o.z-p.z)<=a.R&&(o.ag||o._fightT>0)){o._taunt=a.d}try{dmg('«'+a.n+'»',p.m,'#ffdd88')}catch(_){}break}}
 p._face=w?Math.atan2(w.x-p.x,w.z-p.z):null}

/* ---------- мозок супутника ---------- */
let target=null,gcd=0;
const enemyOk=w=>wild.includes(w)&&!w.wk&&w.hp>1;
function pickTarget(p){if(p.nd)return null;let best=null,bd=1e9;
 for(const w of wild){if(!enemyOk(w))continue;const fight=w.ag||w._fightT>0;if(!fight)continue;const dh=Math.hypot(w.x-P.x,w.z-P.z);if(dh>11)continue;
  const sc_=dh-(w._taunt>0?3:0)-(w._fightT>0?2:0);if(sc_<bd){bd=sc_;best=w}}return best}
function choose(p,w){const sl=slots(p),cds=p._cds||(p._cds={}),ready=a=>a&&!(cds[a.n]>0),rl=role(p),hpK=P.hp/HP();
 const d=w?Math.hypot(w.x-p.x,w.z-p.z):99;
 for(const a of sl)if(ready(a)&&a.k=='heal'&&hpK<.7)return a;
 for(const a of sl)if(ready(a)&&a.k=='shield'&&w&&shieldT<=0&&Math.hypot(w.x-P.x,w.z-P.z)<4)return a;
 for(const a of sl)if(ready(a)&&a.k=='taunt'&&w)return a;
 if(!w)return null;let best=null;
 for(const a of sl){if(!ready(a)||['heal','shield','taunt'].includes(a.k))continue;if(a.k=='nova'&&d>a.R)continue;if(a.k!='nova'&&d>a.r+(rl=='rdd'?1:0))continue;if(!best||a.p>best.p)best=a}
 return best}
/* позиція супутника в бою за роллю (core-world.js питає palCombatPos) */
window.palCombatPos=p=>{if(p!==cur()||!target||!enemyOk(target))return null;const w=target,rl=role(p);
 const hx=P.x-w.x,hz=P.z-w.z,hl=Math.hypot(hx,hz)||1,ux=hx/hl,uz=hz/hl,fa=Math.atan2(w.x-p.x,w.z-p.z),sp=p._dash>0?14:4.5;
 if(rl=='dd'){const px=p.x-w.x,pz=p.z-w.z,pl_=Math.hypot(px,pz)||1;return[w.x+px/pl_*1.3,w.z+pz/pl_*1.3,fa,sp]}
 if(rl=='tank')return[w.x+ux*1.4-uz*.6,w.z+uz*1.4+ux*.6,fa,sp];
 if(rl=='rdd'){const D=6.5;return[w.x+ux*D+uz*1.2,w.z+uz*D-ux*1.2,fa,4]}
 return[P.x+ux*1.8-uz*1.1,P.z+uz*1.8+ux*1.1,fa,4]};

/* ---------- дикі б'ють попала (по одній цілі) ---------- */
function palTakeHit(p,w,k){const s=stats(p),rl=role(p),sk=window.PW?PW.skill(w.ty):{p:40};
 const v=window.PW?PW.hit({lv:w.lv||1,sp:sk.p*.4*(k||1),atk:w.atk||100,def:s.def*(rl=='tank'?1.33:1)*(p._tauntT>0?1.25:1),el:sk.e,own:(T[w.ty]&&T[w.ty].e)||[],ds:(T[p.ty]&&T[p.ty].e)||[]}).v:8;
 p.chp=(p.chp==null?s.hp:p.chp)-v;try{dmg('-'+v,p.m,'#ffb070')}catch(_){}
 if(p.chp<=0){p.chp=0;try{msg('💫 '+(T[p.ty]||{}).n+' знесилився й повертається у сферу. Відновиться за хвилину')}catch(_){}target=null;if(window.palToggle)palToggle()}}
window.wildVsPal=(w,dt,dHero)=>{if(w._tele>0)return 1e-4;/* замахується для масового удару — стоїть */
 const p=cur();if(!p||w.wk)return 0;if(w._taunt>0)w._taunt-=dt;if(w._fightT>0)w._fightT-=dt;
 const dp=Math.hypot(w.x-p.x,w.z-p.z),rl=role(p);if(!(w.ag||w._fightT>0))return 0;
 const want=w._taunt>0||(rl=='tank'&&dp<4.5)||(dp<dHero-.6&&dp<8);if(!want)return 0;
 w.a=Math.atan2(p.x-w.x,p.z-w.z);w.cd=(w.cd||0)-dt;
 const reach=(w._r||.6)+(p._r||.5)+.45;/* «особистий простір» (pal-defense.js) тримає їх на відстані розмірів моделей */
 if(dp<reach&&w.cd<=0){w.cd=1;palTakeHit(p,w,1)}
 return dp>reach-.2?2.6:0};

/* ---------- масові атаки диких: удар по площі зачіпає всіх у колі — і героя, і попала ----------
   Дика істота в бою раз на 7–11 с замахується: на землі 0.8 с росте червоне коло-попередження (можна відбігти),
   потім удар її стихійною навичкою по всіх у радіусі. Сила — 80% одиночного удару по кожному. */
const AOE_R=[3,3.2,2.8,2.6,2.8,3,3,2.8,3,3];
function teleFx(w,R){const m=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({color:0xff3a2a,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}));
 const rim=new THREE.Mesh(new THREE.RingGeometry(.94,1,48),new THREE.MeshBasicMaterial({color:0xff5a3a,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide}));
 const g=new THREE.Group();g.add(m,rim);g.rotation.x=-Math.PI/2;g.scale.setScalar(R);sc.add(g);
 FX.push({m:g,t:0,d:.8,u(k){g.position.set(w.x,H(w.x,w.z)+.07,w.z);m.scale.setScalar(k);m.material.opacity=.18+.25*k;rim.material.opacity=.5+.5*Math.sin(k*20)}})}
function slam(w,R){if(!wild.includes(w))return;const sk=window.PW?PW.skill(w.ty):{n:'Удар',e:'ne'},c=COL[sk.e]||0xff7a5a,y=H(w.x,w.z);
 ringFx(w.x,y,w.z,c,R*1.1,.5);burstFx(w.x,y+.4,w.z,c,16);let hit=0;
 if(Math.hypot(w.x-P.x,w.z-P.z)<=R){const v=Math.max(1,Math.round((window.PW?PW.wildHit(w):(w.dm||10))*.8*window.plHeroDmgK()));P.hp-=v;hit=1;
  try{dmg('-'+v,pl,'#ff6b6b');hud()}catch(_){}if(P.hp<=0&&window.plHeroDown)window.plHeroDown()}
 const p=cur();if(p&&Math.hypot(w.x-p.x,w.z-p.z)<=R){palTakeHit(p,w,.8);hit=1}
 if(hit)try{dmg('💥 '+sk.n,w.m,'#ffcf7a')}catch(_){}}
function wildAoe(dt){const p=cur();for(const w of wild){if(w.wk||w.sl||!(w.ag||w._fightT>0))continue;const R=w.aoeR||AOE_R[w.ty]||2.8;/* бос — ширше коло (boss.js) */
 if(w._tele>0){w._tele-=dt;if(w._tele<=0)slam(w,R);continue}
 const dh=Math.hypot(w.x-P.x,w.z-P.z),dp=p?Math.hypot(w.x-p.x,w.z-p.z):99;if(Math.min(dh,dp)>R*1.6){continue}
 w._acd=(w._acd==null?3+Math.random()*4:w._acd)-dt;
 if(w._acd<=0&&Math.min(dh,dp)<R*.9){w._acd=7+Math.random()*4;w._tele=.8;teleFx(w,R)}}}
/* герой ударив істоту — вона й супутник вступають у бій */
if(window.PW){const h0=PW.heroHit;PW.heroHit=function(w){if(w){w._fightT=10}return h0.apply(this,arguments)}}

/* ---------- смужка здоров'я супутника під портретом ---------- */
const bar=document.createElement('div');bar.id='pchp';bar.innerHTML='<i></i><span></span>';
const css=document.createElement('style');css.textContent=`#pchp{position:absolute;left:66px;top:66px;width:72px;height:7px;border-radius:4px;background:rgba(10,20,40,.7);border:1px solid rgba(255,255,255,.25);overflow:hidden;pointer-events:none}
#pchp i{display:block;height:100%;width:100%;background:linear-gradient(#8dffa8,#2fbf5a);transition:width .25s}#pchp span{position:absolute;right:-30px;top:-5px;font:700 11px system-ui;color:#fff;text-shadow:0 1px 2px #000}
.pgr{margin-top:6px;padding-top:6px;border-top:1px dashed rgba(255,255,255,.18);font-size:12px;line-height:1.45;color:#dfe8f5;clear:both}
.pgr .rl{display:inline-block;padding:1px 8px;border-radius:9px;background:rgba(242,193,78,.18);color:#ffe7a8;font-weight:700;margin-right:4px}
.pgr .fm{display:inline-block;padding:1px 8px;border-radius:9px;background:rgba(127,227,245,.18);color:#bff3ff;font-weight:700}
.pgr .at{display:block}.pgr .at.lk{opacity:.5}`;document.head.appendChild(css);
{const w2=document.getElementById('pw2');if(w2)w2.appendChild(bar)}

/* ---------- картка попала в загоні: роль, форма, атаки ---------- */
const kindTxt={shot:'постріл',multi:'залп',beam:'промінь',melee:'ближній удар',aoe:'вибух по площі',nova:'хвиля навколо',dot:'горіння',heal:'лікування',shield:'щит',taunt:'провокація'};
window.palGrowthHTML=p=>{const r=ROLE[role(p)],sl=slots(p),fm=p.fm||1;
 const line=(a,i,lv)=>a?`<span class='at'>${i}. <b>${a.n}</b> · ${kindTxt[a.k]}${a.p?' · сила '+a.p:''}</span>`:`<span class='at lk'>${i}. 🔒 відкриється на ${lv} рівні</span>`;
 return`<div class='pgr'><span class='rl'>${r[0]} ${r[1]}</span><span class='fm'>Форма ${fm}</span>${line(sl[0],1)}${line(sl[1],2,10)}${line(sl[2],3,30)}</div>`};
if(typeof ivR=='function'){const _r=ivR;ivR=function(){_r.apply(this,arguments);try{if(typeof ivTab=='undefined'||ivTab!='p')return;const cards=document.querySelectorAll('#ivc .i2p .card');
 cards.forEach((c,i)=>{const p=pals[i];if(p&&!c.querySelector('.pgr'))c.insertAdjacentHTML('beforeend',window.palGrowthHTML(p))})}catch(_){}}}

/* ---------- цикл ---------- */
window.plPalCombat=1;
let last=performance.now();
ANI.push(()=>{const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;tickFx(dt);tickShots(dt);if(!(typeof menuO!='undefined'&&menuO))wildAoe(dt);if(shieldT>0)shieldT-=dt;
 for(const q of pals){const mx=stats(q).hp;if(q.chp==null)q.chp=mx;const out=q===cur();if(!out||!target)q.chp=Math.min(mx,q.chp+mx*(out?.02:.016)*dt);if(q._tauntT>0)q._tauntT-=dt;
  if(q._cds)for(const k in q._cds)q._cds[k]-=dt}
 const p=cur();
 if(p&&p.chp<=0)p.chp=stats(p).hp*.1;
 {const b=bar;if(p){const mx=stats(p).hp;b.style.display='block';b.firstChild.style.width=Math.max(0,Math.min(100,p.chp/mx*100))+'%';b.lastChild.textContent=Math.ceil(p.chp)}else b.style.display='none'}
 if(!p||(typeof menuO!='undefined'&&menuO)||(typeof ivO!='undefined'&&ivO)){target=null;return}
 if(p._dash>0)p._dash-=dt;
 if(!target||!enemyOk(target)||Math.hypot(target.x-P.x,target.z-P.z)>14)target=pickTarget(p);
 /* пасивне лікування хіла */
 if(role(p)=='heal'){p._ph=(p._ph||0)-dt;if(p._ph<=0&&P.hp<HP()*.8){p._ph=8;healHero(p,{h:.06,c:COL.pk})}}
 gcd-=dt;if(gcd>0)return;
 const a=choose(p,target);if(!a)return;
 if(['heal','shield'].includes(a.k)||a.k=='taunt'||target){gcd=.6;(p._cds||(p._cds={}))[a.n]=a.cd;cast(p,a,target)}});
window.PALGROWTH={ROLE,ROLES,SK,role,slots,stats,unlock,FORM};
}catch(e){console.warn('pal-growth',e)}})();
