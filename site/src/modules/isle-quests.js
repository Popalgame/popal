/* Цепочка завдань Острова пробудження: 10 кроків від чотирьох мешканців, від пробудження до порталу.
   Стан — inv._q = {i: номер завдання, s: 0 запропоновано / 1 виконується / 2 виконано (здати), g: здобуто з початку завдання}.
   Над NPC: «!» — є нове завдання, «?» — можна здати. Компас: ◆ + одне слово в напрямку місця (без точних координат),
   а коли завдання виконане — ім'я того, хто його дав. Журнал завдань — плашка зліва (замість підказок onboarding.js). */
(function(){try{
const I=window.ISLE,N=window.NPC;if(window.REALM!=='isle'||!I||!N)return;
const G=n=>{try{return eval(n)}catch(_){return undefined}};
const INV=G('inv'),CNT=G('cnt'),ADD=G('addI'),ST=G('st')||{};if(!INV||!CNT)return;
const C=(k)=>+CNT(k)||0,sfx=k=>{try{if(window.PSFX)PSFX.sfx(k)}catch(_){}};
const xp=n=>{try{if(window.addXp)addXp(n)}catch(_){}};
const AX=['axw','axe','axm'];
/* місця для підказки на компасі (середина району, не конкретний предмет) */
const mid=a=>{if(!a||!a.length)return null;let x=0,z=0;for(const o of a){x+=o.x;z+=o.z}return[x/a.length,z/a.length]};
const SPOT={
 'Гай':()=>[I.SP[2][0],I.SP[2][1]],
 'Ягідник':()=>mid(G('bushes'))||[0,0],
 'Гриби':()=>mid(G('shrooms'))||[0,0],
 'Лука':()=>[I.SP[3][0]+4,I.SP[3][1]-4],
 'Ущелина':()=>[0,I.G0+2],
 'Портал':()=>[0,I.PZ-1.5]};
/* ---------- завдання ---------- */
const Q=[
 {id:'hello',npc:'vit',title:'Знайомство',
  offer:['Ну що, оговтався? Ти на Острові пробудження. Сюди море приносить тих, кого кличе Popal.','Звідси є лише один шлях — крізь ущелину на півночі, до старого порталу. Але кам’яний Брам не пустить неготового.','Тож спершу облаштуйся. Розстав кнопки так, як тобі під руку, — я почекаю.'],
  buttons:[{t:'⚙️ Налаштувати кнопки',go:1,fn:()=>{try{window.hudEdit()}catch(_){}}},{t:'Мені й так зручно'}],
  instant:1,done:['Отак краще. А тепер іди до Шкварки — вона в майстерні, за стежкою праворуч.'],xp:10},
 {id:'gather',npc:'shk',title:'Перші запаси',area:'Гай',
  offer:['О! Нові руки! Руки — це добре, руками можна тримати молот.','Принеси 5 деревини й 3 каменю. Поки без інструментів: підійди до дерева чи каменя й тисни «Дія».'],
  goal:g=>[['Деревина',g.w||0,5],['Камінь',g.s||0,3]],done:['Оце так улов! Тепер зробимо з цього щось корисне.'],xp:20},
 {id:'axe',npc:'shk',title:'Перший інструмент',
  offer:['Відкрий 🔨 Крафт. Спершу зроби палиці, а з них — дерев’яну сокиру.','Сокира рубає вдвічі швидше. І руки після неї болять менше.'],
  goal:()=>[['Дерев’яна сокира',AX.some(k=>C(k)>0)?1:0,1]],done:['Гарна сокира! Тримай ще пару палиць — знадобляться.'],xp:20,give:{sti:2}},
 {id:'chop',npc:'shk',title:'Справжня робота',area:'Гай',
  offer:['Візьми сокиру в руки — на панелі внизу, праворуч від кулі.','І нарубай нею 4 деревини. Побачиш різницю.'],
  goal:g=>[['Деревина сокирою',g.wa||0,4]],done:['Чуєш, як дерево співає? Ні? Я теж. Але виглядало круто!'],xp:25},
 {id:'balls',npc:'shk',title:'Зелені кулі',area:'Ягідник',
  offer:['Тепер найважливіше — кулі. Ними ловлять попалів.','Зелена куля сильніша за звичайну, а робиться лише біля верстака — он він, у моїй майстерні.','Знадобляться деревина, камінь і ягоди — ягоди на кущах. Зроби 2 зелені кулі.'],
  goal:g=>[['Зелені кулі',g.bg||0,2]],done:['Блищать! Пані Клубочок давно чекає на того, хто вміє з ними поводитися.'],xp:30},
 {id:'catch',npc:'klu',title:'Перший попал',area:'Лука',
  offer:['Тсс… Попалів не ловлять, як рибу.','Спершу трохи ослаб його — кілька ударів, без жорстокості. Тоді кинь кулю: чим слабший попал, тим вірніше вона спрацює.','Спробуй з кимось на луці.'],
  goal:g=>[['Спіймано попалів',g.c||0,1]],done:['Ой, який гарний! Тепер ви — команда. Тримай ще одну кулю.'],xp:40,give:{bg:1}},
 {id:'fight',npc:'klu',title:'Разом сильніші',area:'Лука',
  offer:['Попал — не прикраса в кишені. Поклич його: торкнися портрета внизу.','А тоді разом переможіть дику істоту — він сам кинеться допомагати.'],
  goal:g=>[['Перемог разом із попалом',g.k||0,1]],done:['Бачиш? Разом ви сильніші. Бережи його.'],xp:40},
 {id:'camp',npc:'vit',title:'Табір',area:'Гриби',
  offer:['Дорога далека, а на голодний шлунок і Брам здається вищим.','Бачиш кухню-багаття біля мене? Це наша база: тут і верстак у Шкварки, і котелок над вогнем.','Збери грибів — вони ростуть у тіні дерев — і приготуй на кухні смажені гриби.'],
  goal:g=>[['Смажені гриби',g.gm||0,1]],done:['Ммм, пахне домом. Ти готовий, мандрівнику.','Іди до Брама, скажи — від мене. І… бувай. Мені тут добре.'],xp:50},
 {id:'gate',npc:'brm',title:'Брам',
  offer:['…ГРРР-РУМ. Вітрило каже, ти готовий.','Я — Брам. Мене звуть Брам. Я приберу каміння.','А далі — портал. Він пропускає лише тих, хто назвав себе.'],
  buttons:[{t:'Відкрий прохід',go:1}],instant:1,onAccept:()=>{try{I.open()}catch(_){}},done:null,xp:30},
 {id:'portal',npc:null,title:'Великий світ',area:'Портал',
  goal:()=>[[G('fbU')?'Пройти крізь портал':'Назвати себе — увійти в акаунт і пройти крізь портал',0,1]]}];
const S=INV._q=(INV._q&&typeof INV._q=='object')?INV._q:{i:0,s:0,g:{}};S.g=S.g||{};
const cur=()=>Q[Math.min(S.i,Q.length-1)];
const sv=()=>{try{save()}catch(_){}};
/* ---------- журнал ---------- */
const css=document.createElement('style');css.textContent=`
#qj{position:fixed;z-index:18;top:calc(env(safe-area-inset-top,0px) + 132px);left:calc(env(safe-area-inset-left,0px) + 12px);width:min(232px,calc(100vw - 24px));box-sizing:border-box;color:#fff8e7;background:rgba(17,25,48,.88);border:1px solid rgba(226,191,103,.7);border-radius:12px;box-shadow:0 5px 20px #0006;padding:8px 10px;font:12px/1.35 system-ui,sans-serif;pointer-events:auto}
#qj .qh{display:flex;align-items:center;gap:6px;color:#ffe7a8;font-weight:800}#qj .qh span{flex:1}#qj .qh button{border:0;background:none;color:#ffe7a8;font-size:15px;padding:0 3px}
#qj .qt{font-weight:800;margin-top:4px;font-size:13px}#qj .qw{opacity:.75;font-size:11px}
#qj .qo{display:flex;justify-content:space-between;gap:8px;margin-top:3px}#qj .qo.ok{color:#8ef0a0}#qj .qo.ok span::before{content:'✓ '}
#qj .qr{margin-top:5px;color:#8ef0a0;font-weight:700}
#qj.min .qb{display:none}
body.mmon #qj,body.hedit #qj,body.bmode #qj,body.pmode #qj{display:none}
@media(max-width:700px){#qj{width:min(205px,calc(100vw - 24px));font-size:11px;padding:6px 8px}}`;
document.head.appendChild(css);
const J=document.createElement('aside');J.id='qj';document.body.appendChild(J);
let min=false;J.addEventListener('click',e=>{if(e.target.closest('[data-min]')){min=!min;J.classList.toggle('min',min);e.stopPropagation()}});
const NM={vit:'Дід Вітрило',shk:'Тесля Шкварка',klu:'Пані Клубочок',brm:'Брам'};
let lastJ='';
function draw(){const q=cur();if(!q){J.style.display='none';return}const ob=q.goal&&S.s>=1?q.goal(S.g):null;
 let h=`<div class='qh'><span>📜 Завдання ${Math.min(S.i+1,Q.length)}/${Q.length}</span><button data-min>${min?'▸':'▾'}</button></div><div class='qb'><div class='qt'>${q.title}</div>`;
 if(S.s==0&&q.npc)h+=`<div class='qw'>Поговоріть: ${NM[q.npc]}</div>`;
 else if(ob){for(const[n,a,b]of ob){const okk=a>=b;h+=`<div class='qo${okk?' ok':''}'><span>${n}</span><b>${b>1?Math.min(a,b)+'/'+b:''}</b></div>`}}
 if(S.s==2&&q.npc)h+=`<div class='qr'>Готово — поверніться: ${NM[q.npc]}</div>`;
 h+='</div>';if(h!==lastJ){lastJ=h;J.innerHTML=h}}
/* ---------- маркери й компас ---------- */
function marks(){for(const n of N.list)N.mark(n.id,null);const q=cur();if(!q)return;
 if(q.npc&&S.s==0)N.mark(q.npc,'!');if(q.npc&&S.s==2)N.mark(q.npc,'?');
 const n=q.npc&&N.get(q.npc);
 if(S.s==1&&q.area&&SPOT[q.area]){const p=SPOT[q.area]();N.hint(p[0],p[1],q.area)}
 else if(n&&S.s!=1)N.hint(n.x,n.z,NM[q.npc].split(' ').pop());
 else if(!q.npc&&q.area){const p=SPOT[q.area]();N.hint(p[0],p[1],q.area)}
 else N.hint(null)}
/* ---------- лічильники здобутого (лише прибуток: витрачене на крафт не віднімається) ---------- */
const TR={w:'w',s:'s',bg:'bg',gm:'gm'};let last={};const snap=()=>{for(const k in TR)last[k]=C(k);last.c=+ST.c||0;last.k=+ST.k||0};snap();
function track(){const q=cur();if(!q||S.s!=1){snap();return}let ch=false;
 for(const k in TR){const v=C(k),d=v-(last[k]||0);if(d>0){S.g[k]=(S.g[k]||0)+d;if(k=='w'&&AX.includes((G('eq')||{}).tool))S.g.wa=(S.g.wa||0)+d;ch=true}last[k]=v}
 for(const k of['c','k']){const v=+ST[k]||0,d=v-(last[k]||0);if(d>0){S.g[k]=(S.g[k]||0)+d;ch=true}last[k]=v}
 if(q.goal){const ob=q.goal(S.g);if(ob.every(([,a,b])=>a>=b)){if(q.npc){S.s=2;sfx('quest_done');try{msg('✅ «'+q.title+'» виконано — поверніться: '+NM[q.npc])}catch(_){}marks()}else{/* останнє — портал */}ch=true}}
 if(ch)sv()}
/* ---------- розмови ---------- */
function next(){S.i++;S.s=0;S.g={};snap();sv();marks();draw();const q=cur();if(q&&!q.npc){S.s=1;marks();draw()}}
function finish(q){if(q.xp)xp(q.xp);if(q.give)for(const k in q.give){try{ADD(k,q.give[k])}catch(_){INV[k]=(INV[k]||0)+q.give[k]}}try{hud();ivR()}catch(_){}
 sfx('levelup');next()}
N.onTalk=id=>{const q=cur(),n=N.get(id);
 if(!q||q.npc!==id){N.say(id,[(n.lines&&n.lines[(Math.random()*n.lines.length)|0])||'…']);return true}
 if(S.s==0){const accept=()=>{sfx('quest_new');if(q.onAccept)q.onAccept();if(q.instant){if(q.done)N.say(id,q.done,{buttons:[{t:'Гаразд',go:1}]});finish(q);return}S.s=1;S.g={};snap();sv();marks();draw()};
  const bs=(q.buttons||[{t:'Берусь!',go:1}]).map(b=>({t:b.t,go:b.go,fn:()=>{if(b.fn)b.fn();accept()}}));if(!q.buttons)bs.push({t:'Пізніше'});
  if(!q.buttons)bs[0].fn=accept;
  N.say(id,q.offer,{buttons:bs});return true}
 if(S.s==1){const ob=q.goal?q.goal(S.g):[];const left=ob.filter(([,a,b])=>a<b).map(([t,a,b])=>t.toLowerCase()+(b>1?' '+Math.min(a,b)+'/'+b:'')).join(', ');
  N.say(id,['Ще не все: '+(left||'майже!')+'.'+(q.area?' Шукай — '+q.area.toLowerCase()+'.':'')]);return true}
 if(S.s==2){N.say(id,q.done||['Добре!'],{buttons:[{t:'Дякую!',go:1}]});finish(q);return true}
 return false};
/* старі збереження без кроку «портал»: якщо прохід уже відкритий — одразу до порталу */
if(I.isOpen&&I.isOpen()&&S.i<9){S.i=9;S.s=1;S.g={}}
if(cur()&&!cur().npc&&S.s==0)S.s=1;
marks();draw();
setInterval(()=>{track();draw();const q=cur();if(q&&q.id=='portal')marks()},500);
}catch(e){console.warn('isle-quests:',e)}})();
