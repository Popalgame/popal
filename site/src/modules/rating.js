/* 0.2.10: рейтинг гравців за рівнем героя.
   • У рейтингу лише зареєстровані гравці з присвоєним ID (identity.js: window.myPid). Гість без акаунта рейтинг бачить, але сам у нього не потрапляє.
   • Кожен гравець з ID сам записує свій рядок у Firestore: leaders/{uid} = {pid, name, lv, xp, t} — після входу, раз на хвилину, коли змінився
     рівень чи досвід, і коли гра ховається. Правила (docs/firestore-rules-mail-promo.md) дозволяють писати лише свій рядок і лише зі своїм pid.
   • Вікно «Рейтинг» відкривається з лівого меню (news.js): топ-100 за рівнем, при рівному рівні — за досвідом; ваш рядок підсвічено.
     Якщо вас немає в топі — ваш рядок унизу. Без правил на сервері вікно пише «ще не ввімкнено». */
(function(){try{
const TOP=100;
const ok=()=>window.FB_OK&&window.fbDb&&window.firebase;
const me=()=>{try{return firebase.auth().currentUser}catch(_){return null}};
let last='';
function push(force){if(!ok())return;const u=me();if(!u||!window.myPid)return;let lv=1,x=0,nm='Гравець';try{lv=plv|0;x=Math.round(xp)|0;nm=String(pname||'Гравець').slice(0,16)}catch(_){}
 const k=[window.myPid,nm,lv,x].join('|');if(!force&&k===last)return;last=k;
 fbDb.collection('leaders').doc(u.uid).set({pid:window.myPid,name:nm,lv,xp:x,t:Date.now()}).catch(e=>{last='';if(e&&e.code!='permission-denied')console.warn('rating',e)})}
setInterval(()=>push(false),60000);setTimeout(()=>push(true),8000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)push(false)});

/* ---------- вікно ---------- */
const css=document.createElement('style');css.textContent=`
#rtx{position:fixed;inset:0;z-index:44;display:none;align-items:center;justify-content:center;font-family:system-ui,sans-serif;color:#eef4ff;
 background:rgba(4,10,22,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);
 padding:calc(env(safe-area-inset-top,0px) + 2.5vh) calc(env(safe-area-inset-right,0px) + 2.5vw) calc(env(safe-area-inset-bottom,0px) + 2.5vh) calc(env(safe-area-inset-left,0px) + 2.5vw)}
#rtx.on{display:flex}
#rtx .win{width:min(760px,100%);height:100%;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;
 background:radial-gradient(120% 70% at 85% 0%,rgba(255,217,119,.12),transparent 60%),linear-gradient(180deg,#16264a,#0d1830 70%,#0a1426);border:2px solid #e2bf67;box-shadow:0 18px 50px rgba(0,0,0,.6)}
#rtx .hd{display:flex;align-items:center;gap:12px;padding:12px 14px 10px 16px;border-bottom:1px solid rgba(226,191,103,.3)}
#rtx .hd .co{width:42px;height:42px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:21px;background:radial-gradient(circle at 50% 35%,#f4d27a,#b8862e 62%,#7a5418);border:2px solid #ffe7a0}
#rtx .hd .tt{flex:1;min-width:0}#rtx .hd h2{margin:0;font-size:21px;font-weight:900;color:#ffe7a8}#rtx .hd small{display:block;color:#9fb3cf;font-size:12.5px;margin-top:2px}
#rtx .hd button{width:38px;height:38px;border-radius:12px;border:2px solid rgba(226,191,103,.55);background:rgba(255,255,255,.05);color:#ffe7a8;font-size:18px;font-weight:800;cursor:pointer}
#rtx .rbd{flex:1;min-height:0;overflow-y:auto;padding:12px 14px 16px;-webkit-overflow-scrolling:touch}
#rtx .tbl{display:flex;flex-direction:column;gap:7px}
#rtx .rw{display:grid;grid-template-columns:44px 1fr 52px 90px;align-items:center;gap:10px;padding:7px 12px 7px 8px;border-radius:14px;border:2px solid rgba(226,191,103,.28);background:linear-gradient(180deg,rgba(31,52,92,.75),rgba(18,32,62,.75))}
#rtx .rw.hh{background:none;border:0;padding:0 12px 0 8px;color:#8fa6c4;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
#rtx .rw .pl{width:36px;height:36px;justify-self:center;border-radius:10px;display:flex;align-items:center;justify-content:center;font:900 16px system-ui,sans-serif;color:#cfe0f0;background:rgba(255,255,255,.06)}
#rtx .rw.hh .pl{background:none;height:auto}
#rtx .rw .nm{min-width:0;font-weight:800;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#rtx .rw .nm small{display:block;font-weight:700;font-size:11.5px;color:#8fa6c4}
#rtx .rw .lv{justify-self:center;min-width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:900 16px system-ui,sans-serif;color:#2a1a06;background:radial-gradient(circle at 50% 35%,#ffe9a8,#d9a43a 70%);border:2px solid #fff3c8;box-shadow:0 2px 6px rgba(0,0,0,.4)}
#rtx .rw.hh .lv{background:none;border:0;box-shadow:none;color:#8fa6c4;height:auto;font:800 11px system-ui,sans-serif}
#rtx .rw .xp{text-align:right;font-size:12.5px;font-weight:700;color:#a9bed6}
#rtx .rw.rk1 .pl{background:linear-gradient(#ffe08a,#d9a43a);color:#3a2408}#rtx .rw.rk1{border-color:#ffd977;box-shadow:0 0 14px rgba(255,217,119,.25)}
#rtx .rw.rk2 .pl{background:linear-gradient(#f1f5fa,#aab6c4);color:#26303c}#rtx .rw.rk2{border-color:#cfd8e4}
#rtx .rw.rk3 .pl{background:linear-gradient(#f0b27a,#b8692e);color:#331a08}#rtx .rw.rk3{border-color:#d08a4a}
#rtx .rw.me{border-color:#7fe3f5;background:linear-gradient(180deg,rgba(31,76,110,.85),rgba(18,48,80,.85));box-shadow:0 0 0 1px rgba(127,227,245,.3),0 0 14px rgba(127,227,245,.2)}
#rtx .sep{text-align:center;color:#8fa6c4;margin:2px 0;letter-spacing:4px}
#rtx .msg{margin:36px auto;max-width:480px;text-align:center;color:#c6d6e8;line-height:1.5}
@media (max-width:520px){#rtx .rw{grid-template-columns:40px 1fr 48px;gap:8px}#rtx .rw .xp{display:none}#rtx .hd small{display:none}}`;document.head.appendChild(css);
const X=document.createElement('section');X.id='rtx';X.setAttribute('aria-label','Рейтинг');
X.innerHTML="<div class='win'><div class='hd'><span class='co'>🏆</span><div class='tt'><h2>Рейтинг</h2><small>Лідери за рівнем героя · лише гравці з ID</small></div><button class='cl' aria-label='Закрити'>✕</button></div><div class='rbd'></div></div>";document.body.appendChild(X);
const bd=X.querySelector('.rbd');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const medal=i=>String(i+1);
const row=(r,i,mine)=>`<div class='rw ${i<3&&i>=0?'rk'+(i+1):''} ${mine?'me':''}'><span class='pl'>${i>=0?medal(i):'—'}</span><span class='nm'><span translate='no'>${esc(r.name)}</span>${mine?' (ви)':''}<small>ID ${esc(r.pid)}</small></span><span class='lv'>${r.lv|0}</span><span class='xp'>${(r.xp|0).toLocaleString('uk-UA')} XP</span></div>`;
async function load(){bd.innerHTML="<div class='msg'>Завантаження…</div>";
 if(!ok()){bd.innerHTML="<div class='msg'>Рейтинг працює лише з підключенням до сервера. Спробуйте пізніше.</div>";return}
 push(true);const u=me();
 try{const q=await fbDb.collection('leaders').orderBy('lv','desc').limit(TOP*2).get();
  const L=q.docs.map(d=>Object.assign({uid:d.id},d.data())).filter(r=>r.pid&&r.lv>0).sort((a,b)=>(b.lv-a.lv)||((b.xp||0)-(a.xp||0))).slice(0,TOP);
  if(!L.length){bd.innerHTML="<div class='msg'>Поки в рейтингу нікого немає. Увійдіть в акаунт — і станете першим!</div>";return}
  const mi=u?L.findIndex(r=>r.uid===u.uid):-1;
  let h="<div class='tbl'><div class='rw hh'><span class='pl'>№</span><span>Гравець</span><span class='lv'>Рівень</span><span class='xp'>Досвід</span></div>"+L.map((r,i)=>row(r,i,u&&r.uid===u.uid)).join('');
  if(u&&window.myPid&&mi<0){let lv=1,x=0;try{lv=plv;x=xp}catch(_){}h+="<div class='sep'>· · ·</div>"+row({name:pname,pid:window.myPid,lv,xp:x},-1,true)}
  h+='</div>';if(!u)h+="<div class='msg'>Увійдіть в акаунт у меню героя, щоб отримати ID і потрапити в рейтинг.</div>";bd.innerHTML=h;
  const m=bd.querySelector('.rw.me');if(m&&mi>6)m.scrollIntoView({block:'center'})}
 catch(e){bd.innerHTML=e&&e.code=='permission-denied'?"<div class='msg'>🏆 Рейтинг ще не ввімкнено на сервері. Скоро запрацює!</div>":"<div class='msg'>Не вдалося завантажити рейтинг. Перевірте інтернет і спробуйте ще раз.</div>";if(!(e&&e.code=='permission-denied'))console.warn('rating',e)}}
function open(){X.classList.add('on');load()}
function close(){X.classList.remove('on')}
X.querySelector('.cl').onclick=close;
addEventListener('keydown',e=>{if(e.key=='Escape'&&X.classList.contains('on'))close()});
window.plRating={open,close,push,isOpen:()=>X.classList.contains('on')};
}catch(e){console.warn('rating',e)}})();
