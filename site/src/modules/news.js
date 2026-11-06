/* 0.3.2: меню зліва. 0.2.10: вікно новин на весь екран.
   • На лівому краю екрана — язичок ☰ (золота рамка). Торкніться — висувається «Меню» з круглими іконками («Новини» і «Рейтинг», rating.js).
   • «Новини» відкривають вікно на весь екран: вкладки «Оновлення» / «Загальне» (з лічильником непрочитаних), кнопка «Прочитати все»,
     зліва велика картка найновішої новини, справа список карток з мініатюрою, мітками (розділ, дата, «НОВЕ»), назвою й підзаголовком.
     Оформлення — як у вікнах гри: темно-синя панель із золотою рамкою, бірюзові акценти, заокруглені кути.
     Торкнулися картки — відкривається новина повністю (картинка, текст, кнопка дії: мапа, пошта); ← — назад до списку.
   • Непрочитані — мітка «НОВЕ» й бірюзова рамка на картці, лічильник на вкладці, червона крапка на іконці «Новини» й на язичку (localStorage zi_news — id прочитаних).
   • Враховує виріз-«чубчик» на iPhone та Android (env(safe-area-inset-*)). Язичок можна пересувати в редакторі інтерфейсу (hud-layout.js, «nwb»).
   • Новини — у масиві NEWS нижче (найновіші зверху); картинки — img/news/*.webp, 960×480. */
(function(){try{
const NEWS=[
 {id:'lang',cat:'main',d:'06.11.2026',img:'',ico:'🌐',title:'Чотири мови',sub:'Українська, English, Polski, русский',text:'Гра сама вмикає мову вашого телефона. Змінити її можна в Налаштуваннях → «🌐 Мова» — гра перемкнеться одразу. А ще в головному меню з’явилась Telegram-група розробників.'},
 {id:'pen',cat:'main',d:'06.11.2026',img:'pen',title:'Загін для попалів',sub:'Шерсть і шкіра — без полювання',text:'Збудуйте Загін і поселіть туди Пухоклуба, Моророга, Грозовика чи Бамбузла: вони гуляють за парканом і дають шерсть або шкіру. Що вищий рівень попала, то частіше. Усе складається у скриню загону біля хвіртки — підійдіть і натисніть «Дія», щоб забрати.'},
 {id:'needs',cat:'main',d:'05.11.2026',img:'bask',title:'Попали їдять і сплять',sub:'Кошик з їжею, лежанки й Стіл зіль',text:'Попали бригади голоднішають і втомлюються. Покладіть їжу в Кошик — вони самі прийдуть поїсти. Уночі сплять на лежанках. Голодні й утомлені попали не працюють. На Столі зіль варять зілля здоров’я: +300 HP.'},
 {id:'boss',cat:'main',d:'04.11.2026',img:'boss',title:'Страж ущелини',sub:'Вогняний бос 25 рівня',live:'boss',btn:'Показати на мапі',act:'map'},
 {id:'dg1',cat:'main',d:'04.11.2026',img:'dg1',title:'Підземелля: Кришталеві печери',sub:'Візьміть ліхтарі — всередині темно',text:'Вхід — печера в стіні хребта біля правого перевалу (фіолетова позначка на мапі). Поставте ліхтарі на підставки, переможіть мешканців печер і Кришталевого Владику. Рекомендовано 16+ рівень. Здобич: Кристали еволюції й зілля.',btn:'Показати на мапі',act:'map'},
 {id:'loc2',cat:'main',d:'04.11.2026',img:'loc2',title:'Локація 2: нова мапа',sub:'Прямокутний острів і чотири зони',text:'Що далі на північ, за хребти й перевали, — то сильніші дикі попали. Бухта прибуття, Зелені луки, Старий ліс і Дикі землі. Між зонами — лише через перевали.',btn:'Відкрити мапу',act:'map'},
 {id:'rl',cat:'gen',d:'04.11.2026',img:'rl',title:'Popal тепер — Regnum Land',sub:'Нова назва, логотип та іконка',text:'Та сама гра, ваші попали й прогрес — на місці.'},
 {id:'mail',cat:'gen',d:'01.11.2026',img:'',ico:'📬',title:'Пошта й промокоди',sub:'Подарунки від розробників',text:'Подарунки від розробників і промокоди з нашого Instagram — у меню героя, вкладка «Пошта».',btn:'Відкрити пошту',act:'mail'}];
const IMG=k=>'img/news/'+k+'.webp';
let seen=new Set();try{seen=new Set((localStorage.getItem('zi_news')||'').split(',').filter(Boolean))}catch(_){}
const keep=()=>{try{localStorage.setItem('zi_news',[...seen].join(','))}catch(_){}};
const unread=n=>!seen.has(n.id);
const css=document.createElement('style');css.textContent=`
#nwb{position:fixed;left:0;top:calc(46% - 38px);z-index:19;width:calc(env(safe-area-inset-left,0px) + 34px);height:76px;padding:0 0 0 env(safe-area-inset-left,0px);box-sizing:border-box;border:1px solid rgba(205,230,229,.25);border-left:0;border-radius:0 18px 18px 0;
 background:rgba(13,28,36,.9);box-shadow:0 4px 14px #05151d40;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation}
#nwb i{display:block;width:17px;height:4px;border-radius:2px;background:#eef3f4;box-shadow:0 -8px 0 #eef3f4,0 8px 0 #eef3f4}
#nwb b{position:absolute;right:-6px;top:-6px;width:13px;height:13px;border-radius:50%;background:#ff4a3a;border:2px solid #0f2029;display:none}#nwb.new b{display:block}
#nwb:focus-visible{outline:2px solid #b8ebe2;outline-offset:2px}#nwb:hover{border-color:#b8ebe2}
#nwp{position:fixed;left:0;padding-left:env(safe-area-inset-left,0px);box-sizing:border-box;top:calc(env(safe-area-inset-top,0px) + 8px);bottom:calc(env(safe-area-inset-bottom,0px) + 8px);width:min(calc(340px + env(safe-area-inset-left,0px)),86vw);z-index:43;
 transform:translateX(calc(-100% - 40px));visibility:hidden;transition:transform .28s ease,visibility 0s linear .28s;display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(18,36,46,.97),rgba(10,22,30,.97));border:2px solid #d9b45a;border-left:0;border-radius:0 18px 18px 0;box-shadow:6px 0 30px rgba(0,0,0,.55);color:#eef4f6;font-family:system-ui,sans-serif}
#nwp.on{transform:none;visibility:visible;transition:transform .28s ease,visibility 0s}
#nwp header{display:flex;align-items:center;gap:8px;padding:12px 12px 10px 16px;border-bottom:1px solid rgba(217,180,90,.35)}
#nwp header h3{margin:0;flex:1;font-size:17px;color:#ffd977;letter-spacing:.3px}
#nwp header button{width:32px;height:32px;border-radius:10px;border:1px solid rgba(217,180,90,.5);background:rgba(255,255,255,.06);color:#fff;font-size:16px;cursor:pointer}
#nwp .mn{flex:1;overflow-y:auto;padding:16px 12px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px 6px;align-content:start}
#nwp .mt{display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:0;color:#fff;cursor:pointer;font:700 13px system-ui,sans-serif;padding:0;position:relative;text-shadow:0 1px 2px #000}
#nwp .mt .ci{position:relative;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;background:radial-gradient(circle at 50% 35%,#f4d27a,#b8862e 62%,#7a5418);border:3px solid #ffe7a0;box-shadow:0 4px 10px rgba(0,0,0,.5),inset 0 -4px 8px rgba(0,0,0,.25)}
#nwp .mt .ci i{position:absolute;right:-2px;top:-2px;width:15px;height:15px;border-radius:50%;background:#ff3a2a;border:2px solid #fff;display:none}#nwp .mt.new .ci i{display:block}
#nwp .mt:active .ci{transform:scale(.94)}
body.hedit #nwp,body.hedit #nwx{display:none}
#guide{left:calc(env(safe-area-inset-left,0px) + 52px)!important}/* підказка — правіше язичка, щоб не перекривала його */
/* ---------- вікно новин — у стилі вікон гри (рюкзак, скрині): темно-синя панель, золото й бірюза, заокруглені кути ---------- */
#nwx{position:fixed;inset:0;z-index:44;display:none;align-items:center;justify-content:center;font-family:system-ui,sans-serif;color:#eef4ff;
 background:rgba(4,10,22,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);
 padding:calc(env(safe-area-inset-top,0px) + 2.5vh) calc(env(safe-area-inset-right,0px) + 2.5vw) calc(env(safe-area-inset-bottom,0px) + 2.5vh) calc(env(safe-area-inset-left,0px) + 2.5vw)}
#nwx.on{display:flex}
#nwx .win{position:relative;width:min(1080px,100%);height:100%;display:flex;flex-direction:column;border-radius:20px;overflow:hidden;
 background:radial-gradient(120% 70% at 85% 0%,rgba(127,227,245,.12),transparent 60%),linear-gradient(180deg,#16264a,#0d1830 70%,#0a1426);
 border:2px solid #e2bf67;box-shadow:0 18px 50px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,231,168,.12)}
#nwx .hd{display:flex;align-items:center;gap:12px;padding:12px 14px 10px 16px}
#nwx .hd .co{width:42px;height:42px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:21px;background:radial-gradient(circle at 50% 35%,#f4d27a,#b8862e 62%,#7a5418);border:2px solid #ffe7a0;box-shadow:0 3px 8px rgba(0,0,0,.45)}
#nwx .hd .tt{flex:1;min-width:0}#nwx .hd h2{margin:0;font-size:21px;font-weight:900;color:#ffe7a8;letter-spacing:.3px;line-height:1.1}#nwx .hd small{display:block;color:#9fb3cf;font-size:12.5px;margin-top:2px}
#nwx .hd button{flex:none;width:38px;height:38px;border-radius:12px;border:2px solid rgba(226,191,103,.55);background:rgba(255,255,255,.05);color:#ffe7a8;font-size:18px;font-weight:800;cursor:pointer}
#nwx .hd .bk{display:none}#nwx.dt .hd .bk{display:block}#nwx.dt .hd .co{display:none}
#nwx .tb{display:flex;align-items:center;gap:8px;padding:0 16px 10px;border-bottom:1px solid rgba(226,191,103,.3)}
#nwx .tb .t{position:relative;padding:8px 16px;border-radius:12px;border:2px solid rgba(226,191,103,.35);background:#16244a;color:#d7e2f5;font:800 14.5px system-ui,sans-serif;cursor:pointer}
#nwx .tb .t.on{color:#fff;border-color:#7fe3f5;background:linear-gradient(180deg,#1f3c66,#16284a);box-shadow:0 0 0 1px rgba(127,227,245,.25),0 4px 12px rgba(63,198,220,.25)}
#nwx .tb .t u{display:none;margin-left:7px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#ff5a3a;color:#fff;font:800 12px/20px system-ui,sans-serif;text-decoration:none;vertical-align:1px}#nwx .tb .t.new u{display:inline-block}
#nwx .tb .sp{flex:1}
#nwx .tb .ra{padding:8px 14px;border-radius:12px;border:2px solid #e2bf67;background:linear-gradient(#5fb04a,#2f8a3a);color:#fff;font:800 13.5px system-ui,sans-serif;cursor:pointer}
#nwx .tb .ra:disabled{opacity:.4;filter:grayscale(.6);cursor:default}
#nwx .nbd{flex:1;min-height:0;display:flex;gap:14px;padding:14px 16px 16px}
#nwx .nf{position:relative;flex:1.05;min-width:0;min-height:0;border-radius:18px;overflow:hidden;border:2px solid rgba(226,191,103,.7);background:#0b1426 center/cover no-repeat;cursor:pointer;padding:0;color:#fff;text-align:left;box-shadow:0 8px 22px rgba(0,0,0,.45)}
#nwx .nf .im{position:absolute;inset:0;background:center/cover no-repeat;transition:transform .5s ease}#nwx .nf:hover .im{transform:scale(1.04)}
#nwx .nf .tx{position:absolute;left:10px;right:10px;bottom:10px;padding:12px 14px;border-radius:14px;background:rgba(10,20,40,.82);border:1px solid rgba(127,227,245,.3);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
#nwx .nf .tx b{display:block;font-size:20px;font-weight:900;color:#ffe7a8;line-height:1.2}#nwx .nf .tx span{display:block;font-size:14px;color:#cfe0f0;margin-top:3px}
#nwx .lst{flex:1;min-width:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:2px 4px 2px 0;-webkit-overflow-scrolling:touch}
#nwx .nr{position:relative;display:grid;grid-template-columns:132px 1fr;gap:12px;align-items:center;padding:8px;border-radius:16px;border:2px solid rgba(226,191,103,.35);background:linear-gradient(180deg,rgba(31,52,92,.75),rgba(18,32,62,.75));color:#fff;text-align:left;cursor:pointer;flex:none}
#nwx .nr:hover{border-color:#e2bf67}#nwx .nr:active{transform:scale(.99)}
#nwx .nr .im{width:132px;aspect-ratio:2/1;border-radius:11px;background:center/cover no-repeat;border:1px solid rgba(255,231,168,.25)}
#nwx .nr b{display:block;font-size:15.5px;font-weight:800;color:#fff;line-height:1.25}#nwx .nr span.s{display:block;font-size:12.5px;color:#a9bed6;margin-top:2px}
#nwx .em{display:flex;align-items:center;justify-content:center;font-size:44px;background:radial-gradient(circle at 50% 40%,#2c4f86,#14254a)!important}#nwx .nf .em{position:absolute;inset:0;font-size:110px}
#nwx .ch{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:5px}
#nwx .ch em{font-style:normal;font-size:11px;font-weight:800;letter-spacing:.3px;padding:2px 8px;border-radius:8px;background:rgba(127,227,245,.14);color:#bff3ff;border:1px solid rgba(127,227,245,.3)}
#nwx .ch em.d{background:rgba(255,255,255,.07);color:#c9d6e8;border-color:rgba(255,255,255,.14)}
#nwx .ch em.n{display:none;background:linear-gradient(#ffe08a,#e2a93a);color:#3a2408;border-color:#fff3c8}#nwx .new .ch em.n{display:inline-block}
#nwx .new.nr{border-color:#7fe3f5;box-shadow:0 0 0 1px rgba(127,227,245,.3),0 0 14px rgba(127,227,245,.18)}
#nwx .none{margin:auto;opacity:.75;text-align:center}
/* повна новина */
#nwx .full{display:none;flex:1;min-height:0;overflow-y:auto;padding:4px 16px 18px;justify-content:center}#nwx.dt .full{display:flex}#nwx.dt .tb,#nwx.dt .nbd{display:none}
#nwx .full article{width:min(780px,100%)}
#nwx .full .pic{width:100%;aspect-ratio:2/1;border-radius:18px;border:2px solid rgba(226,191,103,.7);background:#0b1426 center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-size:110px;box-shadow:0 8px 22px rgba(0,0,0,.45)}
#nwx .full .bx{margin-top:-28px;position:relative;margin-left:14px;margin-right:14px;padding:14px 16px 16px;border-radius:16px;background:linear-gradient(180deg,#1b2f58,#13234a);border:2px solid rgba(127,227,245,.35);box-shadow:0 8px 20px rgba(0,0,0,.4)}
#nwx .full h3{margin:2px 0 3px;font-size:23px;font-weight:900;color:#ffe7a8}#nwx .full h4{margin:0 0 10px;font-size:15px;color:#bff3ff;font-weight:700}
#nwx .full p{margin:0 0 14px;font-size:15px;line-height:1.55;color:#d9e5f3}
#nwx .full .go{padding:10px 20px;border-radius:12px;border:2px solid #e2bf67;background:linear-gradient(#f39a4a,#d9532e);color:#fff;font:800 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.35)}
@media (max-width:760px){#nwx{padding:calc(env(safe-area-inset-top,0px) + 6px) calc(env(safe-area-inset-right,0px) + 6px) calc(env(safe-area-inset-bottom,0px) + 6px) calc(env(safe-area-inset-left,0px) + 6px)}
 #nwx .nbd{flex-direction:column;overflow-y:auto}#nwx .nf{flex:none;aspect-ratio:2/1}#nwx .lst{flex:none;overflow:visible}#nwx .nr{grid-template-columns:104px 1fr}#nwx .nr .im{width:104px}#nwx .hd small{display:none}}
@media (max-height:460px){#nwx .hd{padding:8px 12px 6px 14px}#nwx .hd .co{width:34px;height:34px;font-size:17px}#nwx .hd h2{font-size:18px}#nwx .tb{padding-bottom:8px}#nwx .tb .t,#nwx .tb .ra{padding:6px 12px;font-size:13px}#nwx .nbd{padding:10px 12px 12px;gap:10px}#nwx .nf .tx b{font-size:17px}#nwx .nf .tx span{font-size:12.5px}#nwx .nr{grid-template-columns:110px 1fr;padding:6px}#nwx .nr .im{width:110px}#nwx .nr b{font-size:14px}}
@media (prefers-reduced-motion:reduce){#nwp{transition:none}}`;document.head.appendChild(css);
const tab=document.createElement('button');tab.id='nwb';tab.setAttribute('aria-label','Меню');tab.innerHTML='<i></i><b></b>';document.body.appendChild(tab);
const pan=document.createElement('aside');pan.id='nwp';pan.setAttribute('aria-label','Меню');pan.innerHTML="<header><h3>☰ Меню</h3><button class='cl' aria-label='Закрити'>✕</button></header><div class='mn'><button class='mt' data-v='news'><span class='ci'>📰<i></i></span>Новини</button><button class='mt' data-v='rate'><span class='ci'>🏆</span>Рейтинг</button></div>";document.body.appendChild(pan);
const mn=pan.querySelector('.mn');
const X=document.createElement('section');X.id='nwx';X.setAttribute('aria-label','Новини');
X.innerHTML=`<div class='win'><div class='hd'><button class='bk' aria-label='Назад'>←</button><span class='co'>📰</span><div class='tt'><h2>Новини</h2><small>Що нового в Regnum Land</small></div><button class='cl' aria-label='Закрити'>✕</button></div>
<div class='tb'><button class='t' data-c='main'>Оновлення<u></u></button><button class='t' data-c='gen'>Загальне<u></u></button><span class='sp'></span><button class='ra'>✓ Прочитати все</button></div>
<div class='nbd'></div><div class='full'></div></div>`;document.body.appendChild(X);
let cat='main',cur=null;
const live=n=>{if(n.live!=='boss')return n.text;const b=window.BOSS&&window.BOSS.get&&window.BOSS.get();
 if(b&&typeof wild!='undefined'&&wild.includes(b))return'Вогняний бос 25 рівня чекає на своїй арені в Старому лісі. Червоні кола на землі — відбігайте! Здобич: Кристали еволюції й зілля.';
 const t=(typeof inv!='undefined'&&inv._boss&&inv._boss.warden)||0,s=Math.max(0,Math.round((t-Date.now())/1000));return s?'Переможений. З’явиться знову через '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')+'. Здобич: Кристали еволюції й зілля.':'Вогняний бос 25 рівня в Старому лісі. Червоні кола на землі — відбігайте! Здобич: Кристали еволюції й зілля.'};
const TAG={lang:'👑 Гра',pen:'🏠 База',needs:'🏠 База',boss:'🔥 Бос',dg1:'🕳️ Підземелля',loc2:'🗺️ Світ',rl:'👑 Гра',mail:'📬 Пошта'};
const pic=n=>n.img?`<span class='im' style="background-image:url('${IMG(n.img)}')"></span>`:`<span class='im em'>${n.ico||'📰'}</span>`;
const chips=n=>`<span class='ch'><em class='n'>НОВЕ</em><em>${TAG[n.id]||'📰 Новина'}</em><em class='d'>${n.d}</em></span>`;
const feat=n=>`<button class='nf ${unread(n)?'new':''}' data-id='${n.id}'>${pic(n)}<span class='tx'>${chips(n)}<b>${n.title}</b><span>${n.sub}</span></span></button>`;
const row=n=>`<button class='nr ${unread(n)?'new':''}' data-id='${n.id}'>${pic(n)}<span>${chips(n)}<b>${n.title}</b><span class='s'>${n.sub}</span></span></button>`;
function badge(){const any=NEWS.some(unread);tab.classList.toggle('new',any);mn.querySelector("[data-v='news']").classList.toggle('new',any);
 X.querySelectorAll('.tb .t').forEach(t=>{const k=NEWS.filter(n=>n.cat==t.dataset.c&&unread(n)).length;t.classList.toggle('new',k>0);t.querySelector('u').textContent=k||''});X.querySelector('.ra').disabled=!NEWS.some(unread)}
function list(){X.classList.remove('dt');cur=null;const L=NEWS.filter(n=>n.cat==cat);X.querySelectorAll('.tb .t').forEach(t=>t.classList.toggle('on',t.dataset.c==cat));
 const b=X.querySelector('.nbd');b.innerHTML=L.length?feat(L[0])+(L.length>1?`<div class='lst'>${L.slice(1).map(row).join('')}</div>`:''):"<div class='none'>Поки немає новин</div>";b.scrollTop=0;badge()}
function full(n){cur=n;seen.add(n.id);keep();X.classList.add('dt');const f=X.querySelector('.full');
 f.innerHTML=`<article><div class='pic ${n.img?'':'em'}' style="${n.img?`background-image:url('${IMG(n.img)}')`:''}">${n.img?'':(n.ico||'📰')}</div><div class='bx'><span class='ch'><em>${TAG[n.id]||'📰 Новина'}</em><em class='d'>${n.d}</em></span><h3>${n.title}</h3><h4>${n.sub}</h4><p data-live='${n.id}'>${live(n)}</p>${n.btn?`<button class='go' data-act='${n.act}'>${n.btn}</button>`:''}</div></article>`;f.scrollTop=0;badge()}
function openX(){pan.classList.remove('on');X.classList.add('on');if(!NEWS.some(n=>n.cat==cat&&unread(n))&&NEWS.some(n=>n.cat!=cat&&unread(n)))cat=cat=='main'?'gen':'main';list()}
function closeX(){X.classList.remove('on','dt');cur=null}
X.querySelector('.hd .cl').onclick=closeX;X.querySelector('.hd .bk').onclick=list;
X.querySelectorAll('.tb .t').forEach(t=>t.onclick=()=>{cat=t.dataset.c;list()});
X.querySelector('.ra').onclick=()=>{NEWS.forEach(n=>seen.add(n.id));keep();list()};
X.addEventListener('click',e=>{const c=e.target.closest('[data-id]');if(c){full(NEWS.find(n=>n.id==c.dataset.id));return}
 const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;closeX();
 if(a==='map'){const m=document.getElementById('mmap');if(m&&!m.classList.contains('big'))m.click()}
 else if(a==='mail'){try{const av=document.getElementById('av');if(av)av.click();setTimeout(()=>{try{pfTab('m')}catch(_){}},150)}catch(_){}}});
addEventListener('keydown',e=>{if(e.key=='Escape'&&X.classList.contains('on')){if(X.classList.contains('dt'))list();else closeX()}});
/* меню */
function open(on){pan.classList.toggle('on',on);if(on)badge()}
mn.addEventListener('click',e=>{const t=e.target.closest('[data-v]');if(!t)return;if(t.dataset.v=='news')openX();else if(t.dataset.v=='rate'&&window.plRating){pan.classList.remove('on');window.plRating.open()}});
tab.onclick=()=>{if(document.body.classList.contains('hedit'))return;open(!pan.classList.contains('on'))};
pan.querySelector('header .cl').onclick=()=>open(false);
setInterval(()=>{if(!cur||cur.live!='boss'||!X.classList.contains('on'))return;const p=X.querySelector("[data-live='boss']");if(p)p.textContent=live(cur)},1000);
/* язичок ховається там, де ховаються інші кнопки (меню, інвентар, діалоги) і поки відкрите вікно новин */
/* 0.2.13: язичок прикріплений до лівого краю посередині висоти (як бічне меню в мобільних RPG): на iPhone заходить під виріз, смужки — правіше від нього. */
setInterval(()=>{const hide=X.classList.contains('on')||(window.plRating&&window.plRating.isOpen())||(typeof menuO!='undefined'&&menuO&&!document.body.classList.contains('hedit'))||(typeof ivO!='undefined'&&ivO)||(typeof pfO!='undefined'&&pfO);tab.style.visibility=hide?'hidden':'';if(hide&&pan.classList.contains('on'))open(false)},400);
window.plNews={open:openX,list:NEWS};
badge();
}catch(e){console.warn('news',e)}})();
