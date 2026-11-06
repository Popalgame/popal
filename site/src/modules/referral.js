/* 0.2.15: реферальна програма «🤝 Запроси друга» (плитка в лівому меню, news.js).
   • У кожного гравця з ID своє посилання: popalgame.pl/game.html?ref=<ID>. Новий гравець, що прийшов за ним, після входу в акаунт
     записує себе в Firestore: referrals/{uid} = {ref, pid, name, lv, t} і раз на хвилину оновлює рівень (як рейтинг, rating.js).
     Новачок одразу отримує подарунок другу (REF_GIFT).
   • Вікно показує запрошених друзів: імʼя, ID, коли був у грі, рівень, і нагороди за рівні друга 10 · 20 · 30 · 40 · 50.
     Нагорода стає доступною, коли друг досяг рівня; гравець забирає її натисканням (відмітка ✔ — inv._refc[uid] = [10,20,…]).
     Бонус за трьох друзів на 50 рівні — поки «?», згодом унікальний попал.
   • Правила Firestore для колекції referrals — docs/firestore-rules-mail-promo.md. Без них вікно пише «ще не ввімкнено на сервері». */
(function(){try{
const TIERS=[10,20,30,40,50];
/* нагороди запрошувачу за кожного друга */
const REW={10:{bg:5,hpp:3},20:{bb:5,hpp:5},30:{cr2:1},40:{br:5,hpp:5},50:{cr2:1}};
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

/* ---------- вікно ---------- */
const css=document.createElement('style');css.textContent=`
#rfx{position:fixed;inset:0;z-index:44;display:none;align-items:center;justify-content:center;font-family:system-ui,sans-serif;color:#eef4ff;background:rgba(4,10,22,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);
 padding:calc(env(safe-area-inset-top,0px) + 2.5vh) calc(env(safe-area-inset-right,0px) + 2.5vw) calc(env(safe-area-inset-bottom,0px) + 2.5vh) calc(env(safe-area-inset-left,0px) + 2.5vw)}
#rfx.on{display:flex}
#rfx .win{width:min(1000px,100%);height:100%;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;background:radial-gradient(120% 70% at 85% 0%,rgba(127,227,245,.12),transparent 60%),linear-gradient(180deg,#16264a,#0d1830 70%,#0a1426);border:2px solid #e2bf67;box-shadow:0 18px 50px rgba(0,0,0,.6)}
#rfx .hd{display:flex;align-items:center;gap:12px;padding:12px 14px 10px 16px;border-bottom:1px solid rgba(226,191,103,.3)}
#rfx .hd .co{width:42px;height:42px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:21px;background:radial-gradient(circle at 50% 35%,#f4d27a,#b8862e 62%,#7a5418);border:2px solid #ffe7a0}
#rfx .hd .tt{flex:1;min-width:0}#rfx .hd h2{margin:0;font-size:21px;font-weight:900;color:#ffe7a8}#rfx .hd small{display:block;color:#9fb3cf;font-size:12.5px;margin-top:2px}
#rfx .hd button{width:38px;height:38px;border-radius:12px;border:2px solid rgba(226,191,103,.55);background:rgba(255,255,255,.05);color:#ffe7a8;font-size:18px;font-weight:800;cursor:pointer}
#rfx .lk{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 14px 4px;padding:10px 12px;border-radius:14px;background:rgba(127,227,245,.08);border:1px solid rgba(127,227,245,.3)}
#rfx .lk code{flex:1;min-width:180px;font:700 14px ui-monospace,monospace;color:#bff3ff;word-break:break-all}
#rfx .lk button{padding:8px 14px;border-radius:12px;border:2px solid #e2bf67;background:linear-gradient(#5fb04a,#2f8a3a);color:#fff;font:800 13.5px system-ui,sans-serif;cursor:pointer}
#rfx .lk button.o{background:linear-gradient(#f39a4a,#d9532e)}
#rfx .lk small{flex-basis:100%;color:#a9bed6;font-size:12px}
#rfx .rfb{flex:1;min-height:0;overflow:auto;padding:8px 14px 14px;-webkit-overflow-scrolling:touch}
#rfx .grid{display:grid;grid-template-columns:minmax(170px,1.6fr) 58px repeat(5,58px) 76px;gap:6px 8px;align-items:center;min-width:640px}
#rfx .h{font:800 11.5px system-ui,sans-serif;color:#8fa6c4;text-transform:uppercase;letter-spacing:.5px;text-align:center}#rfx .h.l{text-align:left;padding-left:6px}
#rfx .pl{display:flex;align-items:center;gap:10px;min-width:0;padding:6px 8px;border-radius:12px;background:linear-gradient(180deg,rgba(31,52,92,.75),rgba(18,32,62,.75));border:1px solid rgba(226,191,103,.3);height:58px}
#rfx .av{width:40px;height:40px;flex:none;border-radius:10px;display:flex;align-items:center;justify-content:center;font:900 18px system-ui,sans-serif;color:#2a1a06;background:radial-gradient(circle at 50% 35%,#ffe9a8,#d9a43a 70%);border:2px solid #fff3c8}
#rfx .pl .nm{min-width:0}#rfx .pl b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#rfx .pl small{display:block;font-size:11.5px;color:#8fa6c4}#rfx .pl small.ago{color:#ffb38a}
#rfx .lv{justify-self:center;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:900 16px system-ui,sans-serif;color:#2a1a06;background:radial-gradient(circle at 50% 35%,#ffe9a8,#d9a43a 70%);border:2px solid #fff3c8}
#rfx .rw{position:relative;justify-self:center;width:54px;height:54px;border-radius:12px;border:2px solid rgba(226,191,103,.35);background:rgba(10,20,40,.6);display:flex;align-items:center;justify-content:center;padding:0;cursor:default;color:#fff}
#rfx .rw .ic{font-size:24px;line-height:1;display:flex}#rfx .rw .ic img{width:34px;height:34px}
#rfx .rw u{position:absolute;right:3px;bottom:1px;font:800 11px system-ui,sans-serif;text-decoration:none;color:#ffe7a8;text-shadow:0 1px 2px #000}
#rfx .rw.lock{opacity:.4;filter:grayscale(.7)}
#rfx .rw.ready{border-color:#ffd977;cursor:pointer;box-shadow:0 0 0 2px rgba(255,217,119,.35),0 0 14px rgba(255,217,119,.45);animation:rfp 1.4s ease-in-out infinite}
#rfx .rw.done::after{content:'✔';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 26px system-ui,sans-serif;color:#7fe3f5;text-shadow:0 0 6px #000,0 0 2px #000;background:rgba(5,15,30,.35);border-radius:10px}
@keyframes rfp{50%{transform:scale(1.06)}}
#rfx .rw.mys{width:62px;height:62px;border-color:#b98cff;background:radial-gradient(circle at 50% 40%,#3a2a6a,#160e30);box-shadow:0 0 14px rgba(185,140,255,.45)}#rfx .rw.mys .ic{font:900 34px system-ui,sans-serif;color:#e8d8ff;text-shadow:0 0 10px #b98cff}
#rfx .bonus small.soon{color:#d8c4ff;font-weight:700}
#rfx .bonus{grid-column:8;grid-row:2 / span var(--n,1);align-self:stretch;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border-left:2px solid rgba(226,191,103,.5);padding-left:8px}
#rfx .bonus small{font-size:11px;color:#a9bed6;text-align:center;line-height:1.3}
#rfx .em{margin:26px auto;max-width:520px;text-align:center;color:#c6d6e8;line-height:1.5}
#rfx .tip{margin:12px 2px 0;color:#a9bed6;font-size:12.5px;line-height:1.45}
@media (prefers-reduced-motion:reduce){#rfx .rw.ready{animation:none}}`;document.head.appendChild(css);
const X=document.createElement('section');X.id='rfx';X.setAttribute('aria-label','Реферальна програма');
X.innerHTML="<div class='win'><div class='hd'><span class='co'>🤝</span><div class='tt'><h2>Запроси друга</h2><small>Друзі ростуть — ви отримуєте нагороди</small></div><button class='cl' aria-label='Закрити'>✕</button></div><div class='lkw'></div><div class='rfb'></div></div>";document.body.appendChild(X);
const bd=X.querySelector('.rfb'),lkw=X.querySelector('.lkw');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ico=k=>window.plIcon?window.plIcon(k):(IT[k]?IT[k][0]:'🎁');
const ago=t=>{if(!t)return'';const m=Math.max(0,Math.round((Date.now()-t)/60000));if(m<5)return'у грі зараз';if(m<60)return m+' хв тому';const h=Math.round(m/60);if(h<24)return h+' год тому';return Math.round(h/24)+' дн. тому'};
const cell=(items,st,attrs)=>{const[k,n]=Object.entries(items)[0];return`<button class='rw ${st}' ${attrs||''} title='${Object.entries(items).map(([i,c])=>(IT[i]?IT[i][1]:i)+' ×'+c).join(', ')}'><span class='ic'>${ico(k)}</span><u>${Object.keys(items).length>1?'+':'×'+n}</u></button>`};
let list=[];
function give(items){for(const[i,n]of Object.entries(items))addI(i,n);try{msg('🎁 Нагорода за друга: '+Object.entries(items).map(([i,n])=>(IT[i]?IT[i][1]:i)+' ×'+n).join(', '));hud();save()}catch(_){}}
function claim(uid,lv){const f=list.find(x=>x.uid===uid);if(!f||(f.lv|0)<lv)return;const got=inv._refc[uid]||(inv._refc[uid]=[]);if(got.includes(lv))return;got.push(lv);give(REW[lv]);render()}
function claimBonus(){const n=list.filter(f=>(f.lv|0)>=BONUS.lv).length;if(n<BONUS.need||inv._refb||!BONUS.items)return;inv._refb=1;give(BONUS.items);render()}
function linkBox(){if(!window.myPid){lkw.innerHTML="<div class='lk'><small>Увійдіть в акаунт у меню героя — отримаєте ID і власне посилання для друзів.</small></div>";return}
 lkw.innerHTML=`<div class='lk'><code translate='no'>${esc(link())}</code><button data-cp>📋 Копіювати</button>${navigator.share?"<button class='o' data-sh>📤 Поділитися</button>":''}<small>Друг відкриває гру за цим посиланням і входить в акаунт — і одразу отримує подарунок: ${Object.entries(REF_GIFT).map(([i,n])=>(IT[i]?IT[i][1]:i)+' ×'+n).join(', ')}.</small></div>`;
 const cp=lkw.querySelector('[data-cp]');cp.onclick=()=>{const t=link();(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>msg('📋 Посилання скопійовано')).catch(()=>{try{prompt('Скопіюйте посилання',t)}catch(_){}})};
 const sh=lkw.querySelector('[data-sh]');if(sh)sh.onclick=()=>{navigator.share({title:'Regnum Land',text:'Грай зі мною в Regnum Land — лови попалів і будуй базу!',url:link()}).catch(()=>{})}}
function render(){linkBox();if(!list.length){bd.innerHTML="<div class='em'>Поки ніхто не прийшов за вашим посиланням. Надішліть його друзям — нагороди чекають на рівнях 10, 20, 30, 40 і 50.</div>"+tip();return}
 const n50=list.filter(f=>(f.lv|0)>=BONUS.lv).length,bst=inv._refb?'done':n50>=BONUS.need?'ready':'lock';
 let h=`<div class='grid' style='--n:${list.length}'><span class='h l'>Гравець</span><span class='h'>Рівень</span>${TIERS.map(t=>`<span class='h'>${t}</span>`).join('')}<span class='h'>Бонус</span>`;
 list.forEach((f,i)=>{const got=inv._refc[f.uid]||[];
  h+=`<div class='pl'><span class='av'>${esc((f.name||'?').slice(0,1).toUpperCase())}</span><span class='nm'><b>${esc(f.name)}</b><small>ID ${esc(f.pid)}</small><small class='ago'>${ago(f.t)}</small></span></div><span class='lv'>${f.lv|0}</span>`;
  for(const t of TIERS){const st=got.includes(t)?'done':(f.lv|0)>=t?'ready':'lock';h+=cell(REW[t],st,st=='ready'?`data-u='${esc(f.uid)}' data-l='${t}'`:'')}
  if(i==0)h+=`<div class='bonus'>${BONUS.items?cell(BONUS.items,bst,bst=='ready'?'data-b':''):`<span class='rw mys ${n50>=BONUS.need?'near':''}' title='Унікальний попал — скоро'><span class='ic'>?</span></span>`}<small>${n50} / ${BONUS.need} друзів<br>з ${BONUS.lv} рівнем</small><small class='soon'>Унікальний попал — скоро</small></div>`});
 bd.innerHTML=h+'</div>'+tip();
 bd.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>claim(b.dataset.u,+b.dataset.l));const bb=bd.querySelector('[data-b]');if(bb)bb.onclick=claimBonus}
const tip=()=>`<p class='tip'>Нагороду за рівень друга можна забрати, коли він його досягне — торкніться клітинки, що світиться. За кожного друга: 10 рів. — ${Object.entries(REW[10]).map(([i,n])=>(IT[i]?IT[i][1]:i)+' ×'+n).join(', ')}; 20 — ${Object.entries(REW[20]).map(([i,n])=>(IT[i]?IT[i][1]:i)+' ×'+n).join(', ')}; 30 — ${IT.cr2?IT.cr2[1]:''}; 40 — ${Object.entries(REW[40]).map(([i,n])=>(IT[i]?IT[i][1]:i)+' ×'+n).join(', ')}; 50 — ${IT.cr2?IT.cr2[1]:''}. Три друзі з 50 рівнем — таємний бонус: незабаром тут буде унікальний попал.</p>`;
async function load(){list=[];render();if(!ok()||!window.myPid){return}
 bd.insertAdjacentHTML('afterbegin',"<div class='em' data-ld>Завантаження…</div>");
 try{const q=await fbDb.collection('referrals').where('ref','==',window.myPid).limit(100).get();list=q.docs.map(d=>Object.assign({uid:d.id},d.data())).sort((a,b)=>(b.lv|0)-(a.lv|0));render()}
 catch(e){bd.innerHTML=e&&e.code=='permission-denied'?"<div class='em'>🤝 Реферальну програму ще не ввімкнено на сервері. Скоро запрацює!</div>":"<div class='em'>Не вдалося завантажити друзів. Перевірте інтернет і спробуйте ще раз.</div>";if(!(e&&e.code=='permission-denied'))console.warn('referral',e)}}
function open(){X.classList.add('on');load()}
function close(){X.classList.remove('on')}
X.querySelector('.cl').onclick=close;
addEventListener('keydown',e=>{if(e.key=='Escape'&&X.classList.contains('on'))close()});
window.plReferral={open,close,isOpen:()=>X.classList.contains('on'),REW,BONUS,REF_GIFT};
}catch(e){console.warn('referral',e)}})();
