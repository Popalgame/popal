/* 0.2.9: пошта й промокоди — окремі вкладки «📬 Пошта» і «🎟️ Промокод» у меню персонажа.
   • Листи з подарунками (предмети, кристали): «Забрати» кладе все в рюкзак.
     Джерела листів: системні (зберігаються в сейві, inv._mail), особисті від розробника (Firestore mail/{uid}/items)
     і листи всім гравцям (Firestore mailAll; що вже забрано — inv._mallc).
   • Промокод: гравець з акаунтом вводить код → нагорода приходить листом. Код можна використати один раз на акаунт
     (Firestore promo/{КОД}, позначка promo/{КОД}/used/{uid}, лічильник uses ≤ max, термін exp).
   • Розробник (ID 0001) бачить у цій вкладці панель: створити промокод і надіслати лист гравцю за ID або всім.
   Без правил доступу Firestore для promo / mail / mailAll серверна частина не працює — системні листи й надалі працюють. */
(function(){try{
if(typeof inv=='undefined'||typeof pfTab!='function')return;
const OWN='d.polataiko@gmail.com';
if(!Array.isArray(inv._mail))inv._mail=[];if(!Array.isArray(inv._mallc))inv._mallc=[];if(!Array.isArray(inv._mailc))inv._mailc=[];
const db=()=>{try{return fbDb}catch(_){return null}},user=()=>{try{return fbU}catch(_){return null}};
const isDev=()=>window.myPid==='0001'||((user()&&user().email)||'').toLowerCase()===OWN;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=k=>IT[k]?IT[k][1]:k,ico=k=>IT[k]?IT[k][0]:'🎁';
/* предмети: {ключ: кількість}; розбір рядка «cr2:5, w:100» */
const cleanItems=o=>{const r={};for(const[k,v]of Object.entries(o||{})){const n=Math.floor(+v);if(IT[k]&&n>0&&n<=100000)r[k]=n}return r};
const parseItems=s=>{const r={};for(const part of String(s||'').split(/[,;\n]+/)){const m=part.trim().match(/^([A-Za-z_0-9]+)\s*[:=x×*]?\s*(\d+)$/);if(m)r[m[1]]=(r[m[1]]||0)+ +m[2]}return cleanItems(r)};
const itemsTxt=o=>Object.entries(o||{}).map(([k,n])=>`<span class='mi'>${ico(k)}<b>×${n}</b><small>${esc(name(k))}</small></span>`).join('');

/* ---------- листи ---------- */
let remote=[],allMail=[],status='',busy=0;
/* системний лист (зберігається в сейві) — window.plMail.send({title,text,items,from}) */
function sendLocal(l){const id='l'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);inv._mail.unshift({id,t:Date.now(),from:l.from||'Popal',title:l.title||'Лист',text:l.text||'',items:cleanItems(l.items)});try{save()}catch(_){}badge();if(open)render();return id}
function letters(){const L=[];
 for(const m of inv._mail)L.push(Object.assign({src:'l'},m));
 for(const m of remote)if(!inv._mailc.includes(m.id))L.push(Object.assign({src:'r'},m));
 for(const m of allMail)if(!inv._mallc.includes(m.id)&&!(m.exp&&m.exp<Date.now()))L.push(Object.assign({src:'a'},m));
 return L.sort((a,b)=>(b.t||0)-(a.t||0))}
const unclaimed=()=>letters().filter(m=>!m.got).length;
async function refresh(){const d=db(),u=user();if(!d||!u)return;
 try{const s=await d.collection('mail').doc(u.uid).collection('items').get();remote=s.docs.map(x=>Object.assign({id:x.id},x.data(),{items:cleanItems(x.data().items)}))}catch(e){remote=[];if(isDev())status='⚠️ Пошта на сервері недоступна: '+(e.code||e.message)}
 try{const s=await d.collection('mailAll').orderBy('t','desc').limit(30).get();allMail=s.docs.map(x=>Object.assign({id:x.id},x.data(),{items:cleanItems(x.data().items)}))}catch(e){allMail=[]}
 badge();if(open)render()}
async function claim(id){const m=letters().find(x=>x.id===id);if(!m||m.got||busy)return;busy=1;
 try{if(m.src=='r'){inv._mailc.push(m.id);try{await db().collection('mail').doc(user().uid).collection('items').doc(m.id).delete()}catch(_){}remote=remote.filter(x=>x.id!==m.id)}
  else if(m.src=='a')inv._mallc.push(m.id);
  else{const l=inv._mail.find(x=>x.id===m.id);if(l)l.got=1}
  const it=cleanItems(m.items);for(const[k,n]of Object.entries(it))addI(k,n);
  const n=Object.keys(it).length;msg(n?'📬 Отримано: '+Object.entries(it).map(([k,v])=>name(k)+' ×'+v).join(', '):'📬 Лист прочитано');
  try{hud();save();if(typeof ivR=='function'&&typeof ivO!='undefined'&&ivO)ivR()}catch(_){}}
 finally{busy=0;badge();if(open)render()}}
function remove(id){inv._mail=inv._mail.filter(x=>x.id!==id||!x.got);try{save()}catch(_){}render()}

/* ---------- промокод ---------- */
async function redeem(raw){const code=String(raw||'').trim().toUpperCase().replace(/\s+/g,'');if(!code){say('Введіть промокод');return}
 if(!/^[A-Z0-9_-]{3,24}$/.test(code)){say('❌ Такого промокоду немає');return}
 const d=db(),u=user();if(!d||!u){say('🔐 Промокоди — для гравців з акаунтом. Увійдіть у меню гри');return}
 if((inv._promos||[]).includes(code)){say('Цей промокод уже використано');return}
 busy=1;say('⏳ Перевіряємо…');
 try{const ref=d.collection('promo').doc(code),used=ref.collection('used').doc(u.uid);
  const r=await d.runTransaction(async tx=>{const p=await tx.get(ref);if(!p.exists)return{e:'❌ Такого промокоду немає'};const P_=p.data();
   if(P_.off)return{e:'❌ Промокод вимкнено'};if(P_.exp&&P_.exp<Date.now())return{e:'⌛ Термін дії промокоду минув'};if(P_.max&&(P_.uses||0)>=P_.max)return{e:'❌ Промокод уже використали всі'};
   const us=await tx.get(used);if(us.exists)return{e:'Цей промокод уже використано на вашому акаунті'};
   tx.set(used,{t:Date.now(),pid:window.myPid||null});tx.update(ref,{uses:(P_.uses||0)+1});return{ok:1,p:P_}});
  if(r.e){say(r.e);return}
  inv._promos=(inv._promos||[]).concat(code);
  sendLocal({from:'🎟️ Промокод '+code,title:r.p.title||'Подарунок за промокодом',text:r.p.text||'Дякуємо, що граєте в Popal!',items:r.p.items});
  say('✅ Промокод прийнято! Подарунок — у пошті нижче');try{if(window.PSFX)PSFX.sfx('level')}catch(_){}}
 catch(e){say(e&&e.code=='permission-denied'?'⚠️ Промокоди ще не ввімкнені на сервері':'⚠️ Не вдалося перевірити код. Спробуйте пізніше')}
 finally{busy=0}}

/* ---------- розробник ---------- */
async function devPromo(f){const d=db();if(!d){dsay('Потрібен вхід в акаунт');return}
 const code=String(f.code.value||'').trim().toUpperCase().replace(/\s+/g,''),items=parseItems(f.items.value),max=Math.max(0,parseInt(f.max.value)||0),days=Math.max(0,parseFloat(f.days.value)||0);
 if(!/^[A-Z0-9_-]{3,24}$/.test(code)){dsay('Код: 3–24 символи — латиниця, цифри, _ або -');return}if(!Object.keys(items).length){dsay('Додайте предмети, наприклад: cr2:5, w:100');return}
 try{const ref=d.collection('promo').doc(code);if((await ref.get()).exists){dsay('Такий код уже є');return}
  await ref.set({items,max,uses:0,exp:days?Date.now()+days*864e5:0,title:f.title.value.trim()||'Подарунок за промокодом',text:f.text.value.trim(),t:Date.now(),by:window.myPid||''});
  dsay('✅ Промокод '+code+' створено');f.code.value='';listPromos()}catch(e){dsay('⚠️ '+(e.code||e.message))}}
async function devSend(f){const d=db();if(!d){dsay('Потрібен вхід в акаунт');return}
 const to=String(f.to.value||'').trim(),items=parseItems(f.items.value),l={title:f.title.value.trim()||'Лист від розробника',text:f.text.value.trim(),items,t:Date.now(),from:'Розробник Popal'};
 if(!l.text&&!Object.keys(items).length){dsay('Напишіть текст або додайте предмети');return}
 try{if(to=='*'||/^всім$/i.test(to)){await d.collection('mailAll').add(l);dsay('✅ Лист надіслано всім гравцям')}
  else{const pid=to.replace(/\D/g,'').padStart(4,'0');const q=await d.collection('profiles').where('pid','==',pid).limit(1).get();if(q.empty){dsay('Гравця з ID '+pid+' не знайдено');return}
   await d.collection('mail').doc(q.docs[0].id).collection('items').add(l);dsay('✅ Лист надіслано гравцю ID '+pid)}
  f.text.value='';f.items.value='';refresh()}catch(e){dsay('⚠️ '+(e.code||e.message))}}
let promos=[];
async function listPromos(){const d=db();if(!d)return;try{const s=await d.collection('promo').orderBy('t','desc').limit(20).get();promos=s.docs.map(x=>Object.assign({id:x.id},x.data()))}catch(e){promos=[];dsay('⚠️ Список промокодів недоступний: '+(e.code||e.message))}if(open)render()}
async function promoOff(id,off){try{await db().collection('promo').doc(id).update({off:!!off});listPromos()}catch(e){dsay('⚠️ '+(e.code||e.message))}}

/* ---------- інтерфейс ---------- */
const css=document.createElement('style');css.textContent=`
#mailp{flex:1 1 100%;display:flex;flex-direction:column;gap:10px}
#mailp .pr{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#mailp input,#mailp textarea{flex:1;min-width:140px;background:rgba(0,0,0,.35);border:2px solid #c9a24a;border-radius:10px;color:#fff;padding:8px 10px;font:600 15px system-ui;text-transform:none}
#mailp #mpc{text-transform:uppercase;letter-spacing:1px}
#mailp button{border:2px solid #c9a24a;border-radius:10px;background:linear-gradient(#ffa356,#c8431f);color:#fff;font-weight:800;padding:8px 14px;font-size:14px;cursor:pointer;font-family:inherit}
#mailp button.g{background:linear-gradient(#5fb04a,#2f8a3a)}#mailp button.s{background:rgba(255,255,255,.1);padding:5px 10px;font-size:12px}#mailp button:disabled{opacity:.4}
#mailp .ms{font-size:13px;min-height:16px;color:#ffe7a8}
#mailp .lt{background:rgba(255,255,255,.06);border:1px solid rgba(201,162,74,.45);border-radius:12px;padding:10px 12px}#mailp .lt.got{opacity:.55}
#mailp .lt header{display:flex;gap:8px;align-items:baseline}#mailp .lt header b{flex:1;color:#ffe7a8;font-size:15px}#mailp .lt header small{opacity:.65;font-size:11px}
#mailp .lt p{margin:4px 0 6px;font-size:13px;white-space:pre-wrap}#mailp .lt .fr{font-size:11px;opacity:.7}
#mailp .its{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px}#mailp .mi{display:flex;align-items:center;gap:4px;background:rgba(0,0,0,.3);border-radius:9px;padding:3px 8px;font-size:13px}#mailp .mi .iic{width:24px;height:24px}#mailp .mi small{opacity:.75}
#mailp .dev{border:1px dashed #7fe3f5;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px}#mailp .dev h5{margin:0;color:#bff6ff}#mailp .dev form{display:flex;flex-direction:column;gap:6px}
#mailp .dev .row{display:flex;gap:6px;flex-wrap:wrap}#mailp .dev small{opacity:.7;font-size:11px}#mailp .pl{font-size:12px;display:flex;flex-direction:column;gap:3px}#mailp .pl span{display:flex;gap:6px;align-items:center}
#avmb{position:absolute;right:-6px;top:-6px;min-width:20px;height:20px;border-radius:10px;background:#e8452c;color:#fff;font:800 12px/20px system-ui;text-align:center;padding:0 5px;box-shadow:0 0 0 2px #13211e;display:none;pointer-events:none;z-index:2}`;document.head.appendChild(css);
let open=0,sayTxt='',dsayTxt='';
const say=t=>{sayTxt=t;const e=document.getElementById('mps');if(e)e.textContent=t};
const dsay=t=>{dsayTxt=t;const e=document.getElementById('mds');if(e)e.textContent=t};
/* open: 'm' — вкладка «Пошта», 'pr' — вкладка «Промокод» */
const itemKeys=()=>`<small>Ключі предметів: ${Object.keys(IT).filter(k=>/^[a-z]/.test(k)).slice(0,60).map(k=>k+' — '+esc(name(k))).join(' · ')}</small>`;
function render(){const c=document.getElementById('pfc');if(!c||!open)return;const u=user(),dev=isDev();let h='';
 if(open=='pr'){h=`<h4>🎟️ Промокод</h4><div class='pr'><input id='mpc' placeholder='Введіть промокод' maxlength='24' autocomplete='off'><button id='mpb'>Активувати</button></div>
  <div class='ms' id='mps'>${esc(sayTxt||(u?'Подарунок за промокодом прийде у вкладку «📬 Пошта»':'🔐 Для промокодів увійдіть в акаунт'))}</div>`;
  if(dev)h+=`<div class='dev'><h5>🛠️ Розробник · промокоди</h5><div class='ms' id='mds'>${esc(dsayTxt)}</div>
  <form id='mdp'><b>Новий промокод</b><div class='row'><input name='code' placeholder='КОД, напр. POPAL2026' maxlength='24'><input name='max' type='number' min='0' placeholder='Скільки разів (0 — без меж)'><input name='days' type='number' min='0' step='1' placeholder='Діє днів (0 — завжди)'></div>
  <input name='items' placeholder='Предмети: cr2:5, cr3:1, w:100'><input name='title' placeholder='Заголовок листа'><textarea name='text' rows='2' placeholder='Текст листа'></textarea><button class='g'>Створити промокод</button></form>${itemKeys()}
  <div class='pl'><b>Промокоди</b>${promos.map(p=>`<span><b>${esc(p.id)}</b> ${p.uses||0}/${p.max||'∞'}${p.exp?' · до '+new Date(p.exp).toLocaleDateString('uk-UA'):''}${p.off?' · вимкнено':''} <button class='s' data-poff='${esc(p.id)}' data-v='${p.off?0:1}'>${p.off?'Увімкнути':'Вимкнути'}</button></span>`).join('')||'<small>немає або недоступні</small>'}</div></div>`}
 else{const L=letters();h=`<h4>📬 Пошта</h4>${L.length?L.map(m=>`<div class='lt ${m.got?'got':''}'><header><b>${esc(m.title)}</b><small>${new Date(m.t||Date.now()).toLocaleDateString('uk-UA')}</small></header><div class='fr'>Від: ${esc(m.from||'Popal')}</div>${m.text?`<p>${esc(m.text)}</p>`:''}${Object.keys(m.items||{}).length?`<div class='its'>${itemsTxt(m.items)}</div>`:''}${m.got?(m.src=='l'?`<button class='s' data-del='${m.id}'>Видалити</button>`:''):`<button class='g' data-claim='${m.id}'>${Object.keys(m.items||{}).length?'🎁 Забрати':'✔ Прочитано'}</button>`}</div>`).join(''):'<small>Листів поки немає</small>'}`;
  if(dev)h+=`<div class='dev'><h5>🛠️ Розробник · надіслати лист</h5><div class='ms' id='mds'>${esc(dsayTxt||status)}</div>
  <form id='mdm'><div class='row'><input name='to' placeholder='ID гравця (0007) або * — всім'><input name='title' placeholder='Заголовок'></div><textarea name='text' rows='2' placeholder='Текст'></textarea><input name='items' placeholder='Предмети (не обов’язково): cr2:3, be:20'><button class='g'>Надіслати</button></form>${itemKeys()}</div>`}
 c.innerHTML=`<div id='mailp'>${h}</div>`;
 const pc=document.getElementById('mpc'),pb=document.getElementById('mpb');if(pb){pb.onclick=()=>{if(!busy)redeem(pc.value)};pc.onkeydown=e=>{if(e.key=='Enter'){e.preventDefault();pb.click()}}}
 c.querySelectorAll('input,textarea').forEach(i=>i.addEventListener('keydown',e=>e.stopPropagation()));/* літери не керують героєм */
 c.querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>claim(b.dataset.claim));c.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>remove(b.dataset.del));
 c.querySelectorAll('[data-poff]').forEach(b=>b.onclick=()=>promoOff(b.dataset.poff,b.dataset.v=='1'));
 const fp=document.getElementById('mdp'),fm=document.getElementById('mdm');if(fp)fp.onsubmit=e=>{e.preventDefault();devPromo(fp)};if(fm)fm.onsubmit=e=>{e.preventDefault();devSend(fm)}}
/* вкладки в меню персонажа: «Пошта» й «Промокод» */
{const pfs=document.getElementById('pfs');if(pfs&&!pfs.querySelector("[data-t='m']")){const mk=(t,h)=>{const b=document.createElement('button');b.dataset.t=t;b.innerHTML=h;b.onclick=()=>pfTab(t);return b};
 const bm=mk('m',"📬 Пошта <span id='mtb'></span>"),bp=mk('pr','🎟️ Промокод'),p0=pfs.querySelector("[data-t='p']");if(p0)p0.after(bm,bp);else pfs.prepend(bm,bp)}}
const _pf=pfTab;pfTab=function(t){if(t!=='m'&&t!=='pr'){open=0;return _pf.apply(this,arguments)}
 document.querySelectorAll('#pfs button').forEach(b=>b.classList.toggle('on',b.dataset.t==t));open=t;sayTxt='';dsayTxt='';render();if(t=='m')refresh();else if(isDev())listPromos()};
/* значок непрочитаних на аватарці й на вкладці */
function badge(){const n=unclaimed(),av=document.getElementById('av');if(av&&av.parentElement){let b=document.getElementById('avmb');if(!b){b=document.createElement('div');b.id='avmb';av.parentElement.appendChild(b)}
  b.style.left=(av.offsetLeft+av.offsetWidth-14)+'px';b.style.top=(av.offsetTop-6)+'px';b.style.right='auto';b.style.display=n?'block':'none';b.textContent=n}
 const t=document.getElementById('mtb');if(t)t.textContent=n?'('+n+')':''}
badge();setTimeout(refresh,6000);setInterval(refresh,90000);
window.plMail={send:sendLocal,refresh,letters,redeem};
}catch(e){console.warn('mail',e)}})();
