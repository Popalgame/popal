/* 0.2.9: рівний і охайний профіль гравця (меню з аватарки → «Профіль»).
   Дві колонки, що починаються на одній лінії: ліворуч — картка героя (3D-модель, ім'я, сила акаунта, ID гравця),
   праворуч — рівень і здоров'я смужками, плитки статистики, досягнення однаковими плитками з прогресом і «Мої істоти» зі значками попалів.
   Вміст бере з наявної вкладки (core-world.js, identity.js) — поле імені, 3D-перегляд і ID лишаються ті самі елементи з тими самими обробниками. */
(function(){try{
if(typeof pfTab!='function')return;
const css=document.createElement('style');css.textContent=`
#pfc.pvw{display:block;padding:12px calc(env(safe-area-inset-right,0px) + 14px) 14px 12px}
.pv{display:grid;grid-template-columns:minmax(200px,240px) 1fr;gap:14px;align-items:start;max-width:980px;margin:0 auto}
.pv .card{background:rgba(6,16,22,.42);border:1px solid rgba(201,162,74,.35);border-radius:14px;padding:12px}
.pv-hero{display:flex;flex-direction:column;gap:10px}
.pv-hero #pv3{width:100%!important;height:250px!important;margin:0!important;border-radius:12px;background:radial-gradient(circle at 50% 72%,rgba(127,227,245,.32),rgba(0,0,0,0) 70%);display:flex;justify-content:center}
.pv-hero #pv3 canvas{width:200px!important;height:250px!important;display:block}/* 3D-перегляд має сталий розмір — не розтягуємо */
.pv-hero .pnm{display:flex;gap:6px}.pv-hero .pnm input{flex:1;min-width:0}
.pv-pow{display:flex;justify-content:space-between;align-items:baseline;color:#e2bf67;font-size:13px;font-weight:700}
.pv-pow b{color:#ffd34e;font-size:20px;font-variant-numeric:tabular-nums}
.pv-hero .ppid{margin:0;font-size:12px;line-height:1.35;color:#c9d6e4}.pv-hero .ppid:empty{display:none}
.pv-main{display:flex;flex-direction:column;gap:12px;min-width:0}
.pv-bars{display:flex;flex-direction:column;gap:9px}
.pv-row{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;font-weight:700;color:#e8eef6;margin-bottom:4px}
.pv-row b{color:#ffd34e;font-size:16px}.pv-row span{font-variant-numeric:tabular-nums;color:#c9d6e4}
.pv-bar{height:10px;border-radius:6px;background:rgba(255,255,255,.1);overflow:hidden}.pv-bar i{display:block;height:100%;border-radius:6px}
.pv-bar.xp i{background:linear-gradient(90deg,#4fd0f0,#7fe3f5)}.pv-bar.hp i{background:linear-gradient(90deg,#e8574a,#ff9a7a)}
.pv-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.pv-tile{background:rgba(255,255,255,.05);border:1px solid rgba(201,162,74,.25);border-radius:12px;padding:8px 6px;text-align:center}
.pv-tile .v{display:flex;align-items:center;justify-content:center;gap:6px;font-size:18px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums}
.pv-tile .v img{width:22px;height:22px}.pv-tile small{display:block;font-size:11px;color:#9fb6d8;margin-top:2px}
.pv h4{margin:0 0 8px;color:#e2bf67;font-size:14px;text-align:left;border-bottom:1px solid rgba(201,162,74,.4);padding-bottom:4px}
.pv-ach{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.pv-ach .bd{flex:0 0 calc((100% - 16px)/3);box-sizing:border-box}
.pv-ach .bd{filter:none;opacity:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px 6px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px}
.pv-ach .bd>span{font-size:28px;line-height:1;display:block;filter:grayscale(1);opacity:.45}.pv-ach .bd>span img{width:32px;height:32px}
.pv-ach .bd.ok{border-color:rgba(255,211,78,.6);background:rgba(255,211,78,.08)}.pv-ach .bd.ok>span{filter:none;opacity:1}
.pv-ach .bd b{font-size:12px;color:#fff}.pv-ach .bd small{font-size:10.5px;color:#9fb6d8}
.pv-ach .pg{width:100%;height:5px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden}.pv-ach .pg i{display:block;height:100%;background:#ffd34e}
.pv-pals{display:flex;flex-wrap:wrap;gap:8px}
.pv-pal{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid rgba(201,162,74,.35);border-radius:12px;padding:4px 10px 4px 4px;font-size:13px;font-weight:700}
.pv-pal img{width:30px;height:30px}.pv-pal i{font-style:normal;color:#ffd34e}
.pv-empty{font-size:13px;color:#9fb6d8}
@media (min-width:1000px){.pv-tiles{grid-template-columns:repeat(6,1fr)}.pv-ach .bd{flex-basis:calc((100% - 32px)/5)}}
@media (max-width:640px){.pv{grid-template-columns:1fr}}/* рівні ряди: ПК — 6 плиток і 5 досягнень в один ряд; телефон — по 3, останній ряд по центру */`;document.head.appendChild(css);
const fmt=n=>Math.max(0,Math.round(n)).toLocaleString('uk-UA');
function build(){const c=document.getElementById('pfc');if(!c)return;const v3=document.getElementById('pv3'),nm=c.querySelector('.pnm'),pw=c.querySelector('.ppw');if(!v3||!nm||!pw)return;
 const S=(typeof st!='undefined'&&st)||{},L=typeof plv!='undefined'?plv:1,X=typeof xp!='undefined'?xp:0,XN=typeof xpN=='function'?xpN(L):100,HMax=typeof HPM!='undefined'?HPM:500,hp=typeof P!='undefined'?P.hp:HMax;
 const team=typeof palTeam=='function'?palTeam().length:pals.length,all=typeof pals!='undefined'?pals.length:0;
 const ico=k=>window.plIconSrc&&plIconSrc(k)?`<img src='${plIconSrc(k)}' alt=''>`:'';
 const ach=[['axe','🪓','Лісоруб','деревини',S.w||0,50],['pick','⛏️','Каменяр','каменю',S.s||0,40],[null,'🏹','Мисливець','перемог',S.k||0,10],['b','🔮','Ловець','істот',S.c||0,5],[null,'⭐','Ветеран','рівень',L,10]];
 const oldB=[...c.querySelectorAll('.pbd .bd>span')].map(s=>s.innerHTML);/* значки досягнень, як їх намалювала гра */
 const pc=(typeof T!='undefined'?T:[]).map((t,i)=>{const n=pals.filter(p=>p.ty==i).length;return n?`<div class='pv-pal'>${(typeof EM!='undefined'&&EM[i])||'🐾'}<span>${t.n}</span><i>×${n}</i></div>`:''}).join('');
 const ids=[...c.querySelectorAll('.ppid')];
 const wrap=document.createElement('div');wrap.className='pv';
 wrap.innerHTML=`<section class='pv-hero card'></section>
 <section class='pv-main'>
  <div class='card pv-bars'><div><div class='pv-row'><span>⭐ Рівень <b>${L}</b></span><span>${fmt(X)} / ${fmt(XN)} XP</span></div><div class='pv-bar xp'><i style='width:${Math.min(100,X/Math.max(1,XN)*100)}%'></i></div></div>
   <div><div class='pv-row'><span>❤️ Здоров’я</span><span>${fmt(Math.ceil(hp))} / ${fmt(HMax)}</span></div><div class='pv-bar hp'><i style='width:${Math.min(100,hp/Math.max(1,HMax)*100)}%'></i></div></div></div>
  <div class='pv-tiles'>
   <div class='pv-tile'><div class='v'>🐾 ${all}</div><small>попалів</small></div><div class='pv-tile'><div class='v'>🏠 ${all-team}</div><small>у Попал-центрі</small></div>
   <div class='pv-tile'><div class='v'>${ico('w')||'🪵'} ${fmt(S.w||0)}</div><small>деревини</small></div><div class='pv-tile'><div class='v'>${ico('s')||'🪨'} ${fmt(S.s||0)}</div><small>каменю</small></div>
   <div class='pv-tile'><div class='v'>⚔️ ${fmt(S.k||0)}</div><small>перемог</small></div><div class='pv-tile'><div class='v'>${ico('b')||'🔮'} ${fmt(S.c||0)}</div><small>спіймано</small></div></div>
  <div class='card'><h4>Досягнення</h4><div class='pv-ach'>${ach.map(([k,e,n,u,have,need],i)=>{const ok=have>=need;return`<div class='bd${ok?' ok':''}'><span>${oldB[i]||e}</span><b>${n}</b><small>${ok?'✔ виконано':fmt(Math.min(have,need))+' / '+need+' '+u}</small><div class='pg'><i style='width:${Math.min(100,have/need*100)}%'></i></div></div>`}).join('')}</div></div>
  <div class='card'><h4>Мої істоти</h4>${pc?`<div class='pv-pals'>${pc}</div>`:'<div class=\'pv-empty\'>Поки немає. Ловіть істот кулями 🔮</div>'}</div>
 </section>`;
 const hero=wrap.querySelector('.pv-hero');hero.appendChild(v3);hero.appendChild(nm);
 const pow=document.createElement('div');pow.className='pv-pow';pow.innerHTML=`<span>Сила акаунта</span>${pw.querySelector('b')?pw.querySelector('b').outerHTML:''}`;hero.appendChild(pow);
 ids.forEach(e=>hero.appendChild(e));/* ID гравця й резервна копія (identity.js) — ті самі елементи */
 c.innerHTML='';c.appendChild(wrap);c.classList.add('pvw');c.scrollTop=0}
const _pf=pfTab;pfTab=function(t){const c=document.getElementById('pfc');if(c)c.classList.remove('pvw');const r=_pf.apply(this,arguments);if(t==='p')try{build()}catch(e){console.warn('profile-view',e)}return r};
}catch(e){console.warn('profile-view',e)}})();
