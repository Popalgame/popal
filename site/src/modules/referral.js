/* 0.2.15: реферальна програма «🤝 Запроси друга» (плитка в лівому меню, news.js).
   • У кожного гравця з ID своє посилання: popalgame.pl/game.html?ref=<ID>. Новий гравець, що прийшов за ним, після входу в акаунт
     записує себе в Firestore: referrals/{uid} = {ref, pid, name, lv, t} і раз на хвилину оновлює рівень (як рейтинг, rating.js).
     Новачок одразу отримує подарунок другу (REF_GIFT).
   • Вікно — таблиця на MAX=3 місця (як список друзів у RPG): аватар з рівнем, імʼя, коли був у грі, «довіра» (грав за тиждень),
     нагороди за рівні друга 10 · 20 · 30 · 40 · 50 і бонус зі скобкою праворуч. Друг займає місце назавжди (inv._refSlots),
     ✕ прибирає його (inv._refHide) і звільняє місце наступному. Порожні місця — «Вільне місце».
   • 0.2.17: раз на 10 хв гра сама перевіряє друзів; якщо є нагорода, яку можна забрати, — червона крапка на язичку меню
     і на плитці «Запроси друга» (news.js, window.plMenuBadge).
     Нагорода стає доступною, коли друг досяг рівня; гравець забирає її натисканням (відмітка ✔ — inv._refc[uid] = [10,20,…]).
     Бонус за трьох друзів на 50 рівні — поки «?», згодом унікальний попал.
   • Правила Firestore для колекції referrals — docs/firestore-rules-mail-promo.md. Без них вікно пише «ще не ввімкнено на сервері». */
(function(){try{
const TIERS=[10,20,30,40,50];
/* нагороди запрошувачу за кожного друга */
const REW={10:{bg:5},20:{bb:5},30:{xpb:1},40:{br:5},50:{_crx:1}};/* _crx — кристал стихії на вибір (evolution.js, EVO_CR) */
/* бонус за трьох друзів на 50 рівні — поки таємниця «?», згодом тут буде унікальний попал */
const BONUS={need:3,lv:50,items:null};
const REF_GIFT={bg:3,hpp:2};
const ok=()=>window.FB_OK&&window.fbDb&&window.firebase;
const me=()=>{try{return firebase.auth().currentUser}catch(_){return null}};
if(!inv._refc||typeof inv._refc!='object')inv._refc={};
/* ---------- посилання: ?ref=0012 запамʼятовуємо лише для нового гравця ---------- */
try{const r=(new URLSearchParams(location.search).get('ref')||'').trim();
 if(/^\d{4,6}$/.test(r)&&!inv._refSent&&!localStorage.getItem('zi_ref')&&(typeof plv=='undefined'||plv<=3))localStorage.setItem('zi_ref',r)}catch(_){}
const link=()=>'https://popalgame.pl/game.html?ref='+(window.myPid||'');
/* ---------- новачок записує себе до запрошувача ---------- */
let last='';
function push(){if(!ok())return;const u=me();if(!u||!window.myPid)return;let ref='';try{ref=localStorage.getItem('zi_ref')||''}catch(_){}
 if(!inv._refSent&&(!ref||ref===window.myPid))return;
 let lv=1,nm='Гравець';try{lv=plv|0;nm=String(pname||'Гравець').slice(0,16)}catch(_){}
 const k=[lv,nm].join('|');if(inv._refSent&&k===last)return;
 const doc=fbDb.collection('referrals').doc(u.uid);
 const data=inv._refSent?{name:nm,lv,t:Date.now()}:{ref,pid:window.myPid,name:nm,lv,t:Date.now()};
 (inv._refSent?doc.update(data):doc.set(data)).then(()=>{last=k;if(!inv._refSent){inv._refSent=ref;try{localStorage.removeItem('zi_ref')}catch(_){}
   if(!inv._refGift){inv._refGift=1;for(const[i,n]of Object.entries(REF_GIFT))addI(i,n);try{msg('🎁 Подарунок від друга: '+Object.entries(REF_GIFT).map(([i,n])=>(IT[i]?IT[i][1]:i)+' ×'+n).join(', '));hud();save()}catch(_){}}}})
 .catch(e=>{if(e&&e.code!='permission-denied')console.warn('referral',e)})}
setInterval(push,60000);setTimeout(push,9000);

/* ---------- вікно: таблиця на 3 місця (як «друзі» в RPG) ---------- */
const MAX=3;/* скільки друзів поміщається; згодом можна збільшити */
if(!Array.isArray(inv._refSlots))inv._refSlots=[];
if(!inv._refHide||typeof inv._refHide!='object')inv._refHide={};
const css=document.createElement('style');css.textContent=`
#rfx{position:fixed;inset:0;z-index:44;display:none;align-items:center;justify-content:center;font-family:system-ui,sans-serif;color:#eef4ff;background:rgba(4,10,22,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);
 padding:calc(env(safe-area-inset-top,0px) + 2.5vh) calc(env(safe-area-inset-right,0px) + 2.5vw) calc(env(safe-area-inset-bottom,0px) + 2.5vh) calc(env(safe-area-inset-left,0px) + 2.5vw)}
#rfx.on{display:flex}
#rfx .win{position:relative;width:min(1040px,100%);max-height:100%;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;background:radial-gradient(90% 80% at 85% 10%,rgba(80,170,180,.35),transparent 60%),linear-gradient(180deg,#1f5560,#123844 55%,#0d2a36);border:2px solid #c9a24f;box-shadow:0 18px 50px rgba(0,0,0,.6)}
#rfx .hd{display:flex;align-items:center;gap:12px;padding:10px 14px 8px 16px}
#rfx .hd .co{width:40px;height:40px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;background:radial-gradient(circle at 50% 35%,#f4d27a,#b8862e 62%,#7a5418);border:2px solid #ffe7a0}
#rfx .hd .tt{flex:1;min-width:0}#rfx .hd h2{margin:0;font-size:20px;font-weight:900;color:#ffe7a8}#rfx .hd small{display:block;color:#a9c8cf;font-size:12.5px;margin-top:2px}
#rfx .hd button{width:38px;height:38px;border-radius:12px;border:2px solid rgba(226,191,103,.55);background:rgba(255,255,255,.05);color:#ffe7a8;font-size:18px;font-weight:800;cursor:pointer}
#rfx .lk{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 14px 6px;padding:8px 12px;border-radius:12px;background:rgba(10,30,40,.45);border:1px solid rgba(127,227,245,.25)}
#rfx .lk code{flex:1;min-width:180px;font:700 13.5px ui-monospace,monospace;color:#bff3ff;word-break:break-all}
#rfx .lk button{padding:7px 13px;border-radius:11px;border:2px solid #e2bf67;background:linear-gradient(#5fb04a,#2f8a3a);color:#fff;font:800 13px system-ui,sans-serif;cursor:pointer}
#rfx .lk button.o{background:linear-gradient(#f39a4a,#d9532e)}
#rfx .lk small{flex-basis:100%;color:#a9c8cf;font-size:11.5px}
#rfx .rfb{flex:1;min-height:0;overflow:auto;padding:0 10px 12px;-webkit-overflow-scrolling:touch}
#rfx .tb{--rh:clamp(62px,13vh,86px);--cw:clamp(48px,6.4vw,66px);--tw:76px;--gw:64px;--g:10px;--bw:118px;min-width:660px}
@media (max-width:1100px){#rfx .tb{--tw:74px;--gw:0px;--g:6px;--bw:96px}#rfx .top span{font-size:13px}#rfx .top .cols span:nth-child(3){font-size:0;border:0}#rfx .pl .id{display:none}#rfx .pl{gap:8px}#rfx .tr{font-size:28px!important}#rfx .rw u{font-size:13px}}
#rfx .cols,#rfx .card{display:grid;grid-template-columns:minmax(140px,1fr) var(--tw) var(--gw) repeat(5,var(--cw));column-gap:var(--g);align-items:center}
#rfx .top{display:flex;align-items:stretch;background:rgba(18,52,64,.85);border-radius:4px;margin:0 0 8px}
#rfx .top .cols{flex:1;padding:0 14px}
#rfx .top span{font:600 15px system-ui,sans-serif;color:#e6eef2;text-align:center;padding:5px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rfx .top .l{text-align:left;padding-left:10px}#rfx .top .bd{border-left:1px solid rgba(255,255,255,.12)}
#rfx .top .bh{width:var(--bw);flex:none;border-left:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center}
#rfx .main{display:flex;align-items:stretch}
#rfx .rows{flex:1;display:flex;flex-direction:column;gap:10px;min-width:0}
#rfx .card{position:relative;height:var(--rh);padding:0 14px;border:2px solid #b8913f;border-radius:10px;--sp:calc(100% - 14px - var(--tw) - var(--gw) - 5 * var(--cw) - 6.5 * var(--g));background:linear-gradient(90deg,#14243f 0,#14243f var(--sp),#1f4a5c var(--sp))}
#rfx .card::before,#rfx .card::after{content:'';position:absolute;top:50%;width:8px;height:8px;margin-top:-5px;border:2px solid #b8913f;background:#0d2a36;transform:rotate(45deg)}
#rfx .card::before{left:-6px}#rfx .card::after{right:-6px}
#rfx .pl{display:flex;align-items:center;gap:clamp(8px,1.4vw,14px);min-width:0;height:100%}
#rfx .av{position:relative;width:calc(var(--rh) - 16px);height:calc(var(--rh) - 16px);flex:none;border-radius:4px;display:flex;align-items:center;justify-content:center;font:900 calc(var(--rh) * .4) system-ui,sans-serif;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.5);background:radial-gradient(circle at 50% 30%,hsl(var(--h),70%,62%),hsl(var(--h),55%,26%));border:2px solid #cfd7e0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.4)}
#rfx .av i{position:absolute;right:2px;bottom:0;font:800 15px system-ui,sans-serif;font-style:normal;color:#fff;text-shadow:0 0 3px #000,0 0 2px #000,0 1px 2px #000}
#rfx .pl .nm{min-width:0;flex:1;padding-right:26px}#rfx .pl b{display:block;font-size:clamp(15px,2.2vw,19px);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rfx .pl small{display:block;font-size:clamp(13px,1.9vw,17px);color:#ff5b52;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#rfx .pl small.on{color:#6fe08a}
#rfx .pl .id{font-size:11.5px;color:#8fa6c4;margin-left:6px;font-weight:600}
#rfx .del{position:absolute;top:4px;left:calc(var(--sp) - 32px);width:28px;height:28px;border:0;padding:0;background:none;color:#5ab8e8;font:900 24px/1 system-ui,sans-serif;cursor:pointer;text-shadow:0 0 2px #000}
#rfx .del:hover{color:#9fe0ff}
#rfx .tr{justify-self:center;font-size:34px;line-height:1;filter:grayscale(1) brightness(.7);opacity:.75}#rfx .tr.on{filter:hue-rotate(160deg) saturate(1.6) brightness(1.15);opacity:1}
#rfx .rw{position:relative;justify-self:center;width:var(--cw);height:var(--cw);max-height:calc(var(--rh) - 10px);max-width:calc(var(--rh) - 10px);border-radius:4px;border:2px solid #111a26;box-shadow:0 0 0 1px rgba(226,191,103,.35);background:radial-gradient(circle at 50% 40%,#3a3550,#14121e);display:flex;align-items:center;justify-content:center;padding:0;cursor:default;color:#fff}
#rfx .rw .ic{font-size:calc(var(--cw) * .5);line-height:1;display:flex}#rfx .rw .ic img{width:calc(var(--cw) * .7);height:calc(var(--cw) * .7)}
#rfx .rw u{position:absolute;left:0;right:0;bottom:0;text-align:center;font:700 15px system-ui,sans-serif;text-decoration:none;color:#fff;text-shadow:0 0 3px #000,0 0 2px #000}
#rfx .rw.lock .ic{opacity:.45;filter:grayscale(.8)}
#rfx .rw.ready{border-color:#ffd977;cursor:pointer;box-shadow:0 0 0 2px rgba(255,217,119,.4),0 0 14px rgba(255,217,119,.55);animation:rfp 1.4s ease-in-out infinite}
#rfx .rw.done::after{content:'';position:absolute;left:18%;top:16%;width:64%;height:56%;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 20'%3E%3Cpath d='M2 11l6 6L22 3' fill='none' stroke='%23000' stroke-opacity='.55' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M2 11l6 6L22 3' fill='none' stroke='%2371d3f5' stroke-width='3.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat}
@keyframes rfp{50%{transform:scale(1.06)}}
#rfx .rw .crx{position:relative;width:calc(var(--cw) * .7);height:calc(var(--cw) * .62);display:block}#rfx .rw .crx img{position:absolute;width:62%!important;height:auto!important}#rfx .rw .crx img:nth-child(1){left:0;top:22%}#rfx .rw .crx img:nth-child(2){left:19%;top:0;z-index:1}#rfx .rw .crx img:nth-child(3){left:38%;top:22%}
#rfx .card.emp{background:rgba(14,36,52,.55);border-style:dashed;border-color:rgba(184,145,63,.6)}
#rfx .card.emp .av{background:rgba(255,255,255,.06);border:2px dashed rgba(207,215,224,.45);color:rgba(255,255,255,.55);text-shadow:none}
#rfx .card.emp .nm{padding-right:0}#rfx .card.emp b{font-size:15px}#rfx .card.emp small{font-size:12.5px}#rfx .card.emp b{color:#bcd0da}#rfx .card.emp small{color:#8fb0bd}
#rfx .card.emp .rw{opacity:.35}
#rfx .brk{position:relative;width:var(--bw);flex:none}
#rfx .brk .v{position:absolute;left:14px;width:18px;border:2px solid #c9a24f;border-left:0;top:calc(var(--rh) / 2);bottom:calc(var(--rh) / 2)}
#rfx .brk .m{position:absolute;left:14px;width:18px;height:0;border-top:2px solid #c9a24f;top:50%}
#rfx .brk .h{position:absolute;left:34px;width:12px;height:0;border-top:2px solid #c9a24f;top:50%}
#rfx .brk .bx{position:absolute;left:44px;right:0;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:4px}
#rfx .brk small{font:700 11.5px system-ui,sans-serif;color:#d8e6ec;white-space:nowrap}
#rfx .rw.mys{background:radial-gradient(circle at 50% 40%,#4a3486,#160e30);border-color:#2a1a50;box-shadow:0 0 0 1px #c9a24f,0 0 12px rgba(185,140,255,.5)}#rfx .rw.mys .ic{font:900 calc(var(--cw) * .55) system-ui,sans-serif;color:#e8d8ff;text-shadow:0 0 10px #b98cff}
#rfx .more{margin:10px 4px 0;color:#bfe3ea;font-size:12.5px}
#rfx .tip{margin:8px 4px 0;color:#a9c8cf;font-size:12px;line-height:1.45}
#rfx .ld{margin:4px 4px 8px;color:#bfe3ea;font-size:13px}#rfx .ld.wr{padding:7px 12px;border-radius:10px;background:rgba(255,200,90,.1);border:1px solid rgba(255,200,90,.35);color:#ffe2a6}
#rfx .em{margin:20px auto;max-width:520px;text-align:center;color:#c6d6e8;line-height:1.5}
#rfx .rfch{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;background:rgba(4,10,22,.6)}
#rfx .rfch .bx{width:min(560px,92%);padding:16px;border-radius:18px;background:linear-gradient(180deg,#1b3f58,#13304a);border:2px solid #e2bf67;text-align:center;box-shadow:0 14px 40px rgba(0,0,0,.6)}
#rfx .rfch h3{margin:0 0 4px;color:#ffe7a8;font-size:19px}#rfx .rfch p{margin:0 0 12px;color:#c9d6e8;font-size:13px}
#rfx .rfch .gr{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
#rfx .rfch .gr button{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border-radius:12px;border:2px solid rgba(226,191,103,.4);background:rgba(10,20,40,.6);color:#fff;cursor:pointer;font:700 12px system-ui,sans-serif}
#rfx .rfch .gr button:hover{border-color:#ffd977}#rfx .rfch .gr img{width:44px;height:44px}
#rfx .rfch .no,#rfx .rfch .yes{margin:12px 4px 0;padding:8px 18px;border-radius:12px;border:2px solid rgba(226,191,103,.55);background:rgba(255,255,255,.05);color:#ffe7a8;font:800 13px system-ui,sans-serif;cursor:pointer}
#rfx .rfch .yes{background:linear-gradient(#e0533e,#a8301f);color:#fff;border-color:#ffb3a3}
@media (prefers-reduced-motion:reduce){#rfx .rw.ready{animation:none}}`;document.head.appendChild(css);
const X=document.createElement('section');X.id='rfx';X.setAttribute('aria-label','Реферальна програма');
X.innerHTML="<div class='win'><div class='hd'><span class='co'>🤝</span><div class='tt'><h2>Запроси друга</h2><small>До "+MAX+" друзів · друзі ростуть — ви отримуєте нагороди</small></div><button class='cl' aria-label='Закрити'>✕</button></div><div class='lkw'></div><div class='rfb'></div></div>";document.body.appendChild(X);
const bd=X.querySelector('.rfb'),lkw=X.querySelector('.lkw');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ico=k=>window.plIcon?window.plIcon(k):(IT[k]?IT[k][0]:'🎁');
const ONLINE=5*60000,TRUST=7*864e5;/* «довіра» — друг грав протягом останніх 7 днів */
const ago=t=>{if(!t)return'давно';const m=Math.max(0,Math.round((Date.now()-t)/60000));if(m*60000<ONLINE)return'у грі зараз';if(m<60)return m+' хв тому';const h=Math.round(m/60);if(h<24)return h+' год тому';const d=Math.floor(h/24);if(d<7)return d+' дн. тому';const w=Math.floor(d/7),r=d%7;return r?w+' тиж. '+r+' дн. тому':w+' тиж. тому'};
const hue=s=>{let h=0;for(const c of String(s||''))h=(h*31+c.charCodeAt(0))%360;return h};
const nm=i=>i=='_crx'?'Кристал стихії на вибір':(IT[i]?IT[i][1]:i);
const cell=(items,st,attrs)=>{const[k,n]=Object.entries(items)[0];const ic=k=='_crx'?`<span class='crx'>${['cr2_fi','cr2_wa','cr2_gr'].map(x=>ico(x)).join('')}</span>`:ico(k);return`<button class='rw ${st}' ${attrs||''} title='${Object.entries(items).map(([i,c])=>nm(i)+' ×'+c).join(', ')}'><span class='ic'>${ic}</span><u>${Object.keys(items).length>1?'+':n}</u></button>`};
let all=[],list=[],loading=false,err='';
/* друзі займають місця назавжди (inv._refSlots); вільне місце займає наступний за рівнем */
let saved=null;
function slot(){const by=Object.fromEntries(all.map(f=>[f.uid,f]));
 inv._refSlots=inv._refSlots.filter(u=>by[u]&&!inv._refHide[u]).slice(0,MAX);
 const rest=all.filter(f=>!inv._refHide[f.uid]&&!inv._refSlots.includes(f.uid)).sort((a,b)=>(b.lv|0)-(a.lv|0));
 while(inv._refSlots.length<MAX&&rest.length)inv._refSlots.push(rest.shift().uid);
 list=inv._refSlots.map(u=>by[u]);const k=inv._refSlots.join(',');if(k!==saved){saved=k;try{save()}catch(_){}}
 return rest.length}
/* скільки нагород можна забрати просто зараз — для червоної крапки в меню (news.js) */
function ready(){let n=0;for(const f of list){const got=inv._refc[f.uid]||[];for(const t of TIERS)if((f.lv|0)>=t&&!got.includes(t))n++}
 if(BONUS.items&&!inv._refb&&list.filter(f=>(f.lv|0)>=BONUS.lv).length>=BONUS.need)n++;return n}
const dot=()=>{try{window.plMenuBadge&&window.plMenuBadge()}catch(_){}};
/* фонова перевірка друзів: раз на 10 хв, поки вікно закрите */
async function poll(){if(!ok()||!window.myPid||X.classList.contains('on')||document.hidden)return;
 try{const q=await fbDb.collection('referrals').where('ref','==',window.myPid).limit(100).get();all=q.docs.map(d=>Object.assign({uid:d.id},d.data()));slot();dot()}catch(_){}}
setTimeout(poll,20000);setInterval(poll,600000);
function give(items){for(const[i,n]of Object.entries(items))addI(i,n);try{msg('🎁 Нагорода за друга: '+Object.entries(items).map(([i,n])=>(IT[i]?IT[i][1]:i)+' ×'+n).join(', '));hud();save()}catch(_){}}
function claim(uid,lv){const f=list.find(x=>x.uid===uid);if(!f||(f.lv|0)<lv)return;const got=inv._refc[uid]||(inv._refc[uid]=[]);if(got.includes(lv))return;
 if(REW[lv]._crx){choose(k=>{if(got.includes(lv))return;got.push(lv);give({[k]:1});render()});return}
 got.push(lv);give(REW[lv]);render()}
/* вибір кристала стихії */
function choose(cb){const ks=window.EVO_CR||[];const d=document.createElement('div');d.className='rfch';
 d.innerHTML=`<div class='bx'><h3>Виберіть кристал стихії</h3><p>Кристал потрібен для другої форми попала цієї стихії з 25 рівня.</p><div class='gr'>${ks.map(k=>`<button data-k='${k}'>${ico(k)}<b>${IT[k]?IT[k][1]:k}</b></button>`).join('')}</div><button class='no'>Скасувати</button></div>`;
 X.querySelector('.win').appendChild(d);d.onclick=e=>{const b=e.target.closest('[data-k]');if(b){d.remove();cb(b.dataset.k);return}if(e.target.closest('.no')||e.target===d)d.remove()}}
/* прибрати друга зі списку — звільняє місце */
function drop(uid){const f=list.find(x=>x.uid===uid);if(!f)return;const d=document.createElement('div');d.className='rfch';
 d.innerHTML=`<div class='bx'><h3>Прибрати друга?</h3><p><b translate='no'>${esc(f.name)}</b> зникне з вашого списку, а його місце стане вільним для нового друга. Повернути його не вийде.</p><button class='no'>Скасувати</button><button class='yes'>Прибрати</button></div>`;
 X.querySelector('.win').appendChild(d);d.onclick=e=>{if(e.target.closest('.yes')){d.remove();inv._refHide[uid]=1;inv._refSlots=inv._refSlots.filter(u=>u!==uid);render();return}if(e.target.closest('.no')||e.target===d)d.remove()}}
function claimBonus(){const n=list.filter(f=>(f.lv|0)>=BONUS.lv).length;if(n<BONUS.need||inv._refb||!BONUS.items)return;inv._refb=1;give(BONUS.items);render()}
function linkBox(){if(!window.myPid){lkw.innerHTML="<div class='lk'><small>Увійдіть в акаунт у меню героя — отримаєте ID і власне посилання для друзів.</small></div>";return}
 lkw.innerHTML=`<div class='lk'><code translate='no'>${esc(link())}</code><button data-cp>📋 Копіювати</button>${navigator.share?"<button class='o' data-sh>📤 Поділитися</button>":''}<small>Друг відкриває гру за цим посиланням і входить в акаунт — і одразу отримує подарунок: ${Object.entries(REF_GIFT).map(([i,n])=>(IT[i]?IT[i][1]:i)+' ×'+n).join(', ')}.</small></div>`;
 const cp=lkw.querySelector('[data-cp]');cp.onclick=()=>{const t=link();(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>msg('📋 Посилання скопійовано')).catch(()=>{try{prompt('Скопіюйте посилання',t)}catch(_){}})};
 const sh=lkw.querySelector('[data-sh]');if(sh)sh.onclick=()=>{navigator.share({title:'Regnum Land',text:'Грай зі мною в Regnum Land — лови попалів і будуй базу!',url:link()}).catch(()=>{})}}
function row(f){const got=inv._refc[f.uid]||[],lv=f.lv|0,on=f.t&&Date.now()-f.t<ONLINE,tr=f.t&&Date.now()-f.t<TRUST;
 let h=`<div class='card'><div class='pl'><span class='av' style='--h:${hue(f.name||f.uid)}' translate='no'>${esc((f.name||'?').slice(0,1).toUpperCase())}<i>${lv}</i></span><span class='nm'><b translate='no'>${esc(f.name)}<span class='id'>ID ${esc(f.pid)}</span></b><small class='${on?'on':''}'>${ago(f.t)}</small></span></div>`;
 h+=`<span class='tr ${tr?'on':''}' title='${tr?'Активний друг — грав протягом тижня':'Друг давно не грав'}'>🤝</span><span></span>`;
 for(const t of TIERS){const st=got.includes(t)?'done':lv>=t?'ready':'lock';h+=cell(REW[t],st,st=='ready'?`data-u='${esc(f.uid)}' data-l='${t}'`:'')}
 return h+`<button class='del' data-x='${esc(f.uid)}' aria-label='Прибрати друга' title='Прибрати друга'>✕</button></div>`}
const empty=()=>`<div class='card emp'><div class='pl'><span class='av'>+</span><span class='nm'><b>Вільне місце</b><small>Надішліть посилання другу</small></span></div><span></span><span></span>${TIERS.map(t=>cell(REW[t],'lock')).join('')}</div>`;
function render(){linkBox();
 const wait=all.length?slot():(list=[],0);
 const n50=list.filter(f=>(f.lv|0)>=BONUS.lv).length,bst=inv._refb?'done':n50>=BONUS.need?'ready':'lock';
 let h=err||(loading?"<div class='ld'>Завантаження друзів…</div>":'');
 h+=`<div class='tb'><div class='top'><div class='cols'><span class='l'>Гравець</span><span class='bd'>Довіра</span><span class='bd'>Рівень</span>${TIERS.map(t=>`<span>${t}</span>`).join('')}</div><span class='bh'>Бонус</span></div><div class='main'><div class='rows'>`;
 for(let i=0;i<MAX;i++)h+=list[i]?row(list[i]):empty();
 h+=`</div><div class='brk'><span class='v'></span><span class='m'></span><span class='h'></span><span class='bx'>${BONUS.items?cell(BONUS.items,bst,bst=='ready'?'data-b':''):`<span class='rw mys ${inv._refb?'done':''}' title='Унікальний попал — скоро'><span class='ic'>?</span></span>`}<small>${n50} / ${BONUS.need} · ${BONUS.lv} рів.</small></span></div></div></div>`;
 if(wait)h+=`<p class='more'>Чекають на вільне місце: ${wait}</p>`;
 bd.innerHTML=h+tip();dot();
 bd.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>claim(b.dataset.u,+b.dataset.l));
 bd.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>drop(b.dataset.x));
 const bb=bd.querySelector('[data-b]');if(bb)bb.onclick=claimBonus}
const tip=()=>`<p class='tip'>Нагороду за рівень друга можна забрати, коли він його досягне — торкніться клітинки, що світиться. За кожного друга: ${TIERS.map(t=>t+' рів. — '+Object.entries(REW[t]).map(([i,n])=>nm(i)+' ×'+n).join(', ')).join('; ')}. Три друзі з 50 рівнем — таємний бонус: незабаром тут буде унікальний попал.</p>`;
async function load(){err='';if(!ok()||!window.myPid){all=[];render();return}
 loading=true;render();
 try{const q=await fbDb.collection('referrals').where('ref','==',window.myPid).limit(100).get();all=q.docs.map(d=>Object.assign({uid:d.id},d.data()))}
 catch(e){all=[];err=e&&e.code=='permission-denied'?"<div class='ld wr'>🤝 Реферальну програму ще не ввімкнено на сервері. Скоро запрацює!</div>":"<div class='ld wr'>Не вдалося завантажити друзів. Перевірте інтернет і спробуйте ще раз.</div>";if(!(e&&e.code=='permission-denied'))console.warn('referral',e)}
 loading=false;render()}
function open(){X.classList.add('on');load()}
function close(){X.classList.remove('on')}
X.querySelector('.cl').onclick=close;
addEventListener('keydown',e=>{if(e.key=='Escape'&&X.classList.contains('on'))close()});
window.plReferral={open,close,ready,isOpen:()=>X.classList.contains('on'),REW,BONUS,REF_GIFT,MAX,_demo(a){all=a||[];err='';X.classList.add('on');render()}};
}catch(e){console.warn('referral',e)}})();
