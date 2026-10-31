/* Короткий необов'язковий провідник. Стан етапів живе у звичайному збереженні гри. */
(function(){try{
if(window.REALM==='isle')return;/* на Острові пробудження — журнал завдань (isle-quests.js) */
const steps=[
 {title:'Зберіть першу деревину',hint:'Підійдіть до дерева й натискайте ⚔️ Дія.',done:()=>st.w>0||!!inv._cen},
 {title:'Створіть інструмент',hint:'У 🔨 Крафт зробіть палиці, тоді сокиру або кирку.',done:()=>['axw','axe','axm','pkw','pick','pkm'].some(k=>(inv[k]||0)>0)||!!inv._cen},
 {title:'Спіймайте першого попала',hint:'Ослабте дику істоту кнопкою ⚔️, потім киньте 🔮 кулю.',done:()=>st.c>0||pals.length>0},
 {title:'Поставте Попал-центр',hint:'Зберіть 20 🪵 і 15 🪨, створіть центр у 🔨 Крафт і поставте з рюкзака.',done:()=>!!inv._cen},
 {title:'Збудуйте й поставте скриню',hint:'Створіть 📦 скриню у 🔨 Крафт і поставте її біля центру.',done:()=>(inv._ch||[]).length>0},
 {title:'Додайте працівника',hint:'Біля центру натисніть ⚔️ Дія й призначте попала до бригади.',done:()=>pals.some(p=>p.cs!=null&&p.wk)},
 {title:'Наповніть годівницю',hint:'Зберіть ягоди або гриби. Біля центру відкрийте 🎒 й натисніть «Нагодувати».',done:()=>cf>0}
];
const style=document.createElement('style');style.textContent=`
#guide{position:fixed;z-index:18;top:calc(env(safe-area-inset-top,0px) + 90px);left:calc(env(safe-area-inset-left,0px) + 12px);width:min(240px,calc(100vw - 24px));box-sizing:border-box;color:#fff8e7;background:rgba(17,25,48,.91);border:1px solid rgba(226,191,103,.7);border-radius:12px;box-shadow:0 5px 20px #0006;padding:8px 10px;font:12px/1.35 system-ui,sans-serif;pointer-events:auto}
#guide[hidden]{display:none}#guide .gh{display:flex;align-items:center;gap:5px}#guide .gh strong{flex:1;color:#ffe7a8;font-size:12px}#guide .gh button{border:0;background:transparent;color:#ffe7a8;cursor:pointer;padding:2px 4px;font-size:16px;line-height:1}
#guide .gt{font-weight:700;margin-top:4px}#guide .gd{opacity:.86;margin-top:2px}#guide .gp{height:3px;background:#ffffff35;border-radius:4px;margin-top:7px}#guide .gp i{display:block;height:100%;background:#e2bf67;border-radius:4px}
@media(max-width:700px){#guide{width:min(210px,calc(100vw - 24px));font-size:11px;padding:6px 8px}}
@media(max-height:440px){#guide{top:calc(env(safe-area-inset-top,0px) + 90px);max-width:195px}}
`;document.head.appendChild(style);
const box=document.createElement('aside');box.id='guide';box.setAttribute('aria-label','Поради для початку гри');document.body.appendChild(box);
let collapsed=false,last='';
function visible(id){const el=document.getElementById(id);return !!el&&window.getComputedStyle(el).display!=='none'}
function blocked(){return document.body.classList.contains('bmode')||document.body.classList.contains('pmode')||['mm','iv','pf','cc','cen','chs','fur','kit','dlg','eqm'].some(visible)}
function advance(){let n=Math.max(0,Math.min(steps.length,Math.trunc(Number(inv._guideStep)||0)));
 while(n<steps.length&&steps[n].done())n++;
 if(n!==inv._guideStep){inv._guideStep=n;save()}return n}
function refresh(){const n=advance(),hide=!!inv._guideHidden||blocked();box.hidden=hide;if(hide)return;
 const key=n+'|'+collapsed;if(key===last)return;last=key;
 box.innerHTML=`<div class='gh'><strong>✦ Підказка ${Math.min(n+1,steps.length)}/${steps.length}</strong><button type='button' data-collapse aria-label='${collapsed?'Розгорнути підказку':'Згорнути підказку'}' aria-expanded='${!collapsed}'>${collapsed?'▸':'▾'}</button><button type='button' data-dismiss aria-label='Приховати підказки' title='Приховати підказки'>×</button></div>${collapsed?'':`<div class='gt'>${n===steps.length?'🎉 Основи опановано':steps[n].title}</div><div class='gd'>${n===steps.length?'Ви готові розвивати базу далі. Підказки можна відкрити в «Інфо».':steps[n].hint}</div><div class='gp' role='progressbar' aria-label='Кроки провідника' aria-valuemin='0' aria-valuemax='${steps.length}' aria-valuenow='${n}'><i style='width:${n/steps.length*100}%'></i></div>`}`}
box.addEventListener('click',e=>{if(e.target.closest('[data-collapse]')){collapsed=!collapsed;last='';refresh()}else if(e.target.closest('[data-dismiss]')){inv._guideHidden=1;save();refresh()}});
function helpButton(){const c=document.getElementById('pfc');if(!c||!c.textContent.includes('Як грати'))return;
 let b=c.querySelector('[data-guide-show]');if(!b){b=document.createElement('button');b.type='button';b.className='ob';b.dataset.guideShow='1';b.setAttribute('aria-label','Увімкнути підказки для початку гри');c.appendChild(b)}
 b.textContent=inv._guideHidden?'✦ Увімкнути підказки':'✦ Показати підказки'}
document.addEventListener('click',e=>{if(e.target.closest('#pfs [data-t="i"],#mi'))setTimeout(helpButton,0);
 if(e.target.closest('[data-guide-show]')){inv._guideHidden=0;collapsed=false;save();refresh();helpButton()}});
setInterval(refresh,500);refresh();
}catch(e){console.warn('onboarding',e)}})();
