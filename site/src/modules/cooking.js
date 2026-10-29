/* 0.1.28: їжу готують лише біля кухні-багаття (котелок над вогнем). Смажені гриби й ягідний пиріг у крафті закриті,
   доки кухню не збудовано (world-007.js, REQ), а готувати можна, лише стоячи поруч із нею (до 5 м).
   Вікно кухні (підійдіть і натисніть дію): замовлення — скільки страв приготувати; попал-кухар з бригади бере продукти
   зі скринь, готує на багатті рівно стільки й відносить страви у скриню. Замовлення зберігаються в inv._kord. */
(function(){try{
const FOODR={gm:1,pie:1},NEAR=5,DISH=['gm','pie'];
const kit=()=>(window.BPLACED||[]).find(b=>b.id=='B_kit');
window.nearKitchen=()=>{const b=kit();return !!b&&Math.hypot(b.x-P.x,b.z-P.z)<=NEAR};
/* перехоплюємо натискання «Створити» для страв раніше за обробник крафту */
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-r]');if(!t)return;const r=RC[+t.dataset.r];if(!r||!FOODR[r.id])return;
 if(!kit()){e.stopImmediatePropagation();e.preventDefault();msg('🍲 Щоб готувати, збудуйте кухню-багаття (котелок над вогнем)');return}
 if(!nearKitchen()){e.stopImmediatePropagation();e.preventDefault();msg('🍲 Підійдіть до кухні-багаття — їжу готують на вогні')}},true);

/* ---------- замовлення для кухаря ---------- */
if(!inv._kord||typeof inv._kord!='object')inv._kord={};const O=inv._kord;for(const d of DISH)O[d]=+O[d]||0;
const rc=d=>(RC.find(r=>r.id==d)||{}).c||{};
const cc=k=>window.chCount?chCount(k):0;
const avail=d=>{const c=rc(d);let n=Infinity;for(const k in c)n=Math.min(n,Math.floor(cc(k)/c[k]));return n==Infinity?0:n};
window.KIT={ord:O,rc,avail,any:()=>DISH.some(d=>O[d]>0),dish:()=>DISH.find(d=>O[d]>0&&avail(d)>0)||null,
 done:d=>{if(O[d]>0&&--O[d]==0)msg('🍲 Замовлення кухні виконано: '+IT[d][1].toLowerCase())}};

/* ---------- вікно кухні ---------- */
const css=document.createElement('style');css.textContent=`
#kitw{display:none;position:fixed;left:calc(env(safe-area-inset-left,0px) + 12%);right:calc(env(safe-area-inset-right,0px) + 12%);top:calc(env(safe-area-inset-top,0px) + 8%);max-height:84%;overflow:auto;z-index:36;flex-direction:column;background:rgba(14,20,42,.96);border:2px solid #e2bf67;border-radius:16px;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.5)}
#kitw header{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(226,191,103,.4)}#kitw header b{flex:1;font-size:18px;color:#ffe7a8}
#kitw .cx{background:none;border:none;color:#e2bf67;font-size:24px;cursor:pointer}
#kitw .dh{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 12px;padding:8px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(226,191,103,.35);border-radius:12px}
#kitw .dh .ic{font-size:30px;width:40px;text-align:center}#kitw .dh .ic img{width:38px;height:38px}#kitw .nm{flex:1;min-width:140px}#kitw .nm b{color:#ffe7a8}#kitw .nm small{display:block;opacity:.75;font-size:12px}#kitw .nm small img{width:18px;height:18px;vertical-align:-4px}
#kitw .od{display:flex;flex-wrap:wrap;align-items:center;gap:5px}#kitw .od span{font-size:13px;margin-right:2px}#kitw .od span b{color:#ffe7a8;font-size:17px}
#kitw button.q{background:rgba(255,255,255,.1);border:1px solid #e2bf67;color:#fff;border-radius:8px;padding:3px 9px;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px}
#kitw button.me{background:linear-gradient(#5fb04a,#2f8a3a);border:2px solid #e2bf67;color:#fff;border-radius:10px;padding:3px 10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px}
#kitw button:disabled{opacity:.35;filter:grayscale(1)}
#kitw .st{padding:2px 14px;font-size:13px;text-align:center}#kitw .st.no{color:#ff9a8a}#kitw .em{opacity:.65;font-size:12px;padding:6px 14px 10px;text-align:center}`;document.head.appendChild(css);
const box=document.createElement('div');box.id='kitw';document.body.appendChild(box);
const ico=k=>window.plIcon?plIcon(k):IT[k][0];
const cooks=()=>pals.filter(p=>p.wk&&p.cs!=null&&((T[p.ty]||{}).wk||{}).cook);
function render(){const cs=cooks(),busy=cs.find(p=>p.ai&&p.ai.s=='cook');let st,no=0;
 if(!cs.length){st='⚠️ У бригаді немає кухаря — додайте попала з навичкою «готування» (або готуйте самі)';no=1}
 else if(busy)st=`🍳 ${T[busy.ty].n}: ${busy.st||'готує'}`;
 else if(!KIT.any())st=`📋 Задайте замовлення — і ${T[cs[0].ty].n} приготує саме стільки страв`;
 else st=KIT.dish()?`${T[cs[0].ty].n} іде по продукти…`:'⚠️ У скринях бракує продуктів для замовлення';
 box.innerHTML=`<header><b>${ico('B_kit')} Кухня-багаття</b><button class='cx'>✕</button></header>`+DISH.map(d=>{const c=rc(d),r=RC.find(x=>x.id==d),mine=Object.keys(c).every(k=>cnt(k)>=c[k]);
  return `<div class='dh'><div class='ic'>${ico(d)}</div><div class='nm'><b>${IT[d][1]}</b><small>${Object.keys(c).map(k=>ico(k)+'×'+c[k]).join(' + ')} · у скринях вистачить на ${avail(d)} · ${r?r.d:''}</small></div>
  <div class='od'><span>📋 <b>${O[d]}</b></span><button class='q' data-d='${d}' data-o='-1' ${O[d]?'':'disabled'}>−1</button><button class='q' data-d='${d}' data-o='1'>+1</button><button class='q' data-d='${d}' data-o='5'>+5</button><button class='q' data-d='${d}' data-o='max' ${avail(d)>O[d]?'':'disabled'}>Усе (${avail(d)})</button><button class='q' data-d='${d}' data-o='0' ${O[d]?'':'disabled'}>✖</button>
  <button class='me' data-me='${d}' ${mine?'':'disabled'}>Приготувати самому</button></div></div>`}).join('')+
 `<div class='st ${no?'no':''}'>${st}</div><div class='em'>Замовлення: попал-кухар з бригади сам бере продукти й деревину зі скринь, готує тут на вогні рівно стільки страв і відносить їх у скриню.</div>`;
 box.querySelector('.cx').onclick=close;
 box.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{const d=b.dataset.d,o=b.dataset.o;O[d]=o=='0'?0:o=='max'?avail(d):Math.max(0,Math.min(999,O[d]+ +o));save();render()});
 box.querySelectorAll('[data-me]').forEach(b=>b.onclick=()=>{const d=b.dataset.me,c=rc(d);if(!Object.keys(c).every(k=>cnt(k)>=c[k]))return;for(const k in c)addI(k,-c[k]);addI(d,1);window.KIT_ACT=Date.now();msg('🍲 Приготовано: '+IT[d][1].toLowerCase());hud();save();render()})}
let iv=0;function open(){ivO=1;box.style.display='flex';render();clearInterval(iv);iv=setInterval(render,700)}
function close(){box.style.display='none';ivO=0;clearInterval(iv);save()}
const near=()=>{const b=kit();return b&&Math.hypot(b.x-P.x,b.z-P.z)<2.3};
const hb=$('hit'),h0=hb.onclick;hb.onclick=function(){if(near()&&!nearest(wild,2.6)){open();return}return h0.apply(this,arguments)};
let was=null,hit0=null;ANI.push(()=>{const n=!!near();if(n===was)return;was=n;if(n){hit0=hb.innerHTML;hb.innerHTML=ico('B_kit')+'<small>Кухня</small>'}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}});
addEventListener('keydown',e=>{if(e.key=='Escape'&&box.style.display=='flex')close()});
}catch(e){console.warn('cooking',e)}})();
