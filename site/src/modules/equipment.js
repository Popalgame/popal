(function(){try{
window.TT={axw:{k:'w',t:1,d:3,y:1},axe:{k:'w',t:2,d:4,y:1},axm:{k:'w',t:3,d:8,y:2},pkw:{k:'s',t:1,d:2,y:1},pick:{k:'s',t:2,d:4,y:1},pkm:{k:'s',t:3,d:8,y:2}};
for(const k of['sti','ore','ing','axw','axm','pkw','pkm'])if(inv[k]==null)inv[k]=0;
Object.assign(IT,{sti:['🥢','Палки'],ore:['🟤','Залізна руда'],ing:['🔩','Залізний злиток'],axw:["<span class='t1'>🪓</span>",'Дерев’яна сокира'],axe:["<span class='t2'>🪓</span>",'Кам’яна сокира'],axm:["<span class='t3'>🪓</span>",'Металева сокира'],pkw:["<span class='t1'>⛏️</span>",'Дерев’яна кирка'],pick:["<span class='t2'>⛏️</span>",'Кам’яна кирка'],pkm:["<span class='t3'>⛏️</span>",'Металева кирка']});
TOOLS.splice(0,TOOLS.length,{id:null,i:'✋',n:'Руки',d:'🌲 повільно, 🪨 ні'},{id:'axw',i:IT.axw[0],n:'Дерев’яна сокира',d:'🌲 ×3'},{id:'axe',i:IT.axe[0],n:'Кам’яна сокира',d:'🌲 ×4'},{id:'axm',i:IT.axm[0],n:'Металева сокира',d:'🌲 ×8'},{id:'pkw',i:IT.pkw[0],n:'Дерев’яна кирка',d:'🪨 ×2'},{id:'pick',i:IT.pick[0],n:'Кам’яна кирка',d:'🪨 ×4 · руда й вугілля'},{id:'pkm',i:IT.pkm[0],n:'Металева кирка',d:'🪨 ×8 · руда'});
const NR=[{id:'sti',n:'Палки ×2',c:{w:1},d:'Основа для всіх інструментів',q:2},{id:'axw',n:'Дерев’яна сокира',c:{sti:3,w:2},d:'Рубає втричі швидше за руки',one:1},{id:'pkw',n:'Дерев’яна кирка',c:{sti:3,w:3},d:'Дозволяє добувати камінь',one:1},{id:'axe',n:'Кам’яна сокира',c:{sti:2,s:3,w:2},d:'Сильніший удар, більше деревини',one:1},{id:'pick',n:'Кам’яна кирка',c:{sti:2,s:4,w:2},d:'Швидше б’є камінь і добуває залізну руду й вугілля з жил',one:1},{id:'ing',n:'Залізний злиток',c:{ore:2,w:1},d:'Переплавлена руда для металевих інструментів'},{id:'axm',n:'Металева сокира',c:{sti:2,ing:3,w:2},d:'Валить дерево з одного удару, ×2 деревини',one:1},{id:'pkm',n:'Металева кирка',c:{sti:2,ing:4,w:2},d:'Розбиває скелю з одного удару, більше руди з жил',one:1}];
RC.splice(0,RC.length,...NR,...RC.filter(r=>r.id!='axe'&&r.id!='pick'));
let hint=0,sh=0;
window.gHit=function(k,o){const t=TT[eq.tool],ok=!!t&&t.k==k;if(!o.mx)o.mx=o.hp=8;
if(k=='s'&&!ok){if(Date.now()-sh>2500){sh=Date.now();msg('⛏️ Камінь руками не добути: створіть кирку в Крафті')}return -1}
const dm=ok?t.d:1;o.hp-=dm;const y=ok?t.y:0,tx=[];if(y){res[k]+=y;st[k]+=y;tx.push('+'+y+(k=='w'?' 🪵':' 🪨'))}
if(k=='w'&&Math.random()<(ok?.2:.35)){inv.sti++;tx.push('+1 🥢')}
if(k=='w'&&!ok&&!hint){hint=1;msg('✋ Руками дерево рубається повільно. З палок 🥢 створіть сокиру')}
return{y,dm,tx}};
window.fellB=function(k,o){const t=TT[eq.tool],ok=!!t&&t.k==k,b=ok?t.t+1:2,tx=['+'+b+(k=='w'?' 🪵':' 🪨')];res[k]+=b;st[k]+=b;
if(k=='w'){const n=1+(Math.random()*2|0);inv.sti+=n;tx.push('+'+n+' 🥢')}
const p=o.m.position.clone();setTimeout(()=>dmg(tx.join(' '),{position:p},'#ffd34e'),250)};
try{eqUp()}catch(_){}
}catch(e){console.warn('tools2:',e)}})();
