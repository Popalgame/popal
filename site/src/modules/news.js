/* 0.3.2: банер новин зліва.
   • На лівому краю екрана — язичок ☰ (золота рамка). Торкніться — висувається стрічка новин із картками; ще раз або ✕ — ховається.
   • Враховує виріз-«чубчик» на iPhone та Android (env(safe-area-inset-*)), у горизонтальному й вертикальному положенні.
   • Язичок можна пересувати й змінювати розмір у редакторі розташування інтерфейсу (hud-layout.js, id «nwb»); стрічка відкривається поруч із ним.
   • Нові новини — червона крапка на язичку, доки стрічку не відкрили (localStorage zi_news).
   • Картки — у масиві NEWS нижче; кнопка картки може відкрити пошту, мапу тощо. */
(function(){try{
const NEWS=[
 {id:'rl',ico:'👑',title:'Popal тепер — Regnum Land',text:'Нова назва, логотип та іконка. Та сама гра, ваші попали й прогрес — на місці.'},
 {id:'loc2',ico:'🗺️',title:'Локація 2: нова мапа',text:'Прямокутний острів і чотири зони. Що далі на північ, за хребти й перевали, — то сильніші дикі попали.',btn:'Відкрити мапу',act:'map'},
 {id:'dg1',ico:'🕳️',title:'Підземелля: Кришталеві печери',text:'Вхід — печера в стіні хребта біля правого перевалу (фіолетова позначка на мапі). Візьміть ліхтарі: всередині темно. Рекомендовано 16+ рівень.',btn:'Показати на мапі',act:'map'},
 {id:'boss',ico:'🔥',title:'Страж ущелини',text:'',live:'boss',btn:'Показати на мапі',act:'map'},
 {id:'needs',ico:'🧺',title:'Попали їдять і сплять',text:'Кошик з їжею, лежанки й Стіл зіль із зіллям здоров’я (+300 HP). Голодні й утомлені попали не працюють.'},
 {id:'mail',ico:'📬',title:'Пошта й промокоди',text:'Подарунки від розробників і промокоди з нашого Instagram — у меню героя.',btn:'Відкрити пошту',act:'mail'}];
const VER=NEWS.map(n=>n.id).join(',');
let seen='';try{seen=localStorage.getItem('zi_news')||''}catch(_){}
const css=document.createElement('style');css.textContent=`
#nwb{position:fixed;left:calc(env(safe-area-inset-left,0px) + 0px);top:calc(50% - 34px);z-index:19;width:44px;height:68px;padding:0;border:2px solid #d9b45a;border-left:0;border-radius:0 16px 16px 0;
 background:linear-gradient(180deg,#1b3442,#0f2029);box-shadow:0 4px 14px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,230,160,.12);display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation}
#nwb i{display:block;width:20px;height:4px;border-radius:2px;background:linear-gradient(#ffe7a0,#c9952e);box-shadow:0 -7px 0 #e9c46a,0 7px 0 #e9c46a}
#nwb b{position:absolute;right:-5px;top:-5px;width:13px;height:13px;border-radius:50%;background:#ff4a3a;border:2px solid #0f2029;display:none}#nwb.new b{display:block}
#nwb:focus-visible{outline:2px solid #ffe7a0;outline-offset:2px}
#nwp{position:fixed;left:calc(env(safe-area-inset-left,0px) + 0px);top:calc(env(safe-area-inset-top,0px) + 8px);bottom:calc(env(safe-area-inset-bottom,0px) + 8px);width:min(340px,calc(86vw - env(safe-area-inset-left,0px)));z-index:43;
 transform:translateX(-110%);transition:transform .28s ease;display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(18,36,46,.97),rgba(10,22,30,.97));border:2px solid #d9b45a;border-left:0;border-radius:0 18px 18px 0;box-shadow:6px 0 30px rgba(0,0,0,.55);color:#eef4f6;font-family:system-ui,sans-serif}
#nwp.on{transform:none}
#nwp header{display:flex;align-items:center;gap:8px;padding:12px 12px 10px 16px;border-bottom:1px solid rgba(217,180,90,.35)}
#nwp header h3{margin:0;flex:1;font-size:17px;color:#ffd977;letter-spacing:.3px}
#nwp header button{width:32px;height:32px;border-radius:10px;border:1px solid rgba(217,180,90,.5);background:rgba(255,255,255,.06);color:#fff;font-size:16px;cursor:pointer}
#nwp .ls{flex:1;overflow-y:auto;padding:10px 12px 14px 14px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}
#nwp .nc{display:grid;grid-template-columns:52px 1fr;gap:10px;align-items:start;padding:10px;border-radius:14px;background:linear-gradient(180deg,rgba(255,226,140,.12),rgba(255,226,140,.04));border:1px solid rgba(217,180,90,.35)}
#nwp .nc .ic{width:52px;height:52px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:30px;background:radial-gradient(circle at 50% 35%,#2f5a6c,#122a35);border:1px solid rgba(217,180,90,.5)}
#nwp .nc h4{margin:0 0 3px;font-size:14px;color:#fff;line-height:1.25}#nwp .nc p{margin:0;font-size:12.5px;line-height:1.4;color:#c6d6dc}
#nwp .nc button{grid-column:1/-1;margin-top:2px;padding:8px 10px;border-radius:10px;border:0;background:linear-gradient(#ffe08a,#d9a43a);color:#2a1a06;font-weight:800;font-size:13px;cursor:pointer}
#nwp .nc.new{border-color:#ffd977;box-shadow:0 0 0 1px rgba(255,217,119,.4)}
body.hedit #nwp{display:none}
#guide{left:calc(env(safe-area-inset-left,0px) + 52px)!important}/* підказка — правіше язичка, щоб не перекривала його */
@media (prefers-reduced-motion:reduce){#nwp{transition:none}}`;document.head.appendChild(css);
const tab=document.createElement('button');tab.id='nwb';tab.setAttribute('aria-label','Новини');tab.innerHTML='<i></i><b></b>';document.body.appendChild(tab);
const pan=document.createElement('aside');pan.id='nwp';pan.setAttribute('aria-label','Новини');pan.innerHTML="<header><h3>📰 Новини</h3><button aria-label='Закрити'>✕</button></header><div class='ls'></div>";document.body.appendChild(pan);
const ls=pan.querySelector('.ls');
const live=n=>{if(n.live!=='boss')return n.text;const b=window.BOSS&&window.BOSS.get&&window.BOSS.get();
 if(b&&typeof wild!='undefined'&&wild.includes(b))return'Вогняний бос 25 рівня чекає на своїй арені в Старому лісі. Червоні кола на землі — відбігайте! Здобич: Кристали еволюції й зілля.';
 const t=(typeof inv!='undefined'&&inv._boss&&inv._boss.warden)||0,s=Math.max(0,Math.round((t-Date.now())/1000));return s?'Переможений. З’явиться знову через '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')+'.':'Вогняний бос 25 рівня в Старому лісі.'};
function render(){const old=new Set(seen.split(','));ls.innerHTML=NEWS.map(n=>`<div class='nc ${old.has(n.id)?'':'new'}'><div class='ic'>${n.ico}</div><div><h4>${n.title}</h4><p data-live='${n.id}'>${live(n)}</p></div>${n.btn?`<button data-act='${n.act}'>${n.btn}</button>`:''}</div>`).join('')}
function badge(){tab.classList.toggle('new',seen!==VER)}
function open(on){pan.classList.toggle('on',on);if(on){render();seen=VER;try{localStorage.setItem('zi_news',VER)}catch(_){}badge()}}
tab.onclick=()=>{if(document.body.classList.contains('hedit'))return;open(!pan.classList.contains('on'))};
pan.querySelector('header button').onclick=()=>open(false);
ls.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;open(false);
 if(a==='map'){const m=document.getElementById('mmap');if(m&&!m.classList.contains('big'))m.click()}
 else if(a==='mail'){try{const av=document.getElementById('av');if(av)av.click();setTimeout(()=>{try{pfTab('m')}catch(_){}},150)}catch(_){}}});
setInterval(()=>{if(!pan.classList.contains('on'))return;const p=ls.querySelector("[data-live='boss']");if(p)p.textContent=live(NEWS.find(n=>n.id=='boss'))},1000);
/* язичок ховається там, де ховаються інші кнопки (меню, інвентар, діалоги) */
setInterval(()=>{const hide=(typeof menuO!='undefined'&&menuO&&!document.body.classList.contains('hedit'))||(typeof ivO!='undefined'&&ivO)||(typeof pfO!='undefined'&&pfO);tab.style.visibility=hide?'hidden':'';if(hide&&pan.classList.contains('on'))open(false)},400);
badge();
}catch(e){console.warn('news',e)}})();
