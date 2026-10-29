/* 0.1.5: нове меню крафту — категорії, сітка карток, панель рецепта з прогресом матеріалів */
(function(){try{
const G=n=>{try{return eval(n)}catch(e){return undefined}};
const CAT=[['all','Усе','✨'],['tool','Інструменти','🛠️'],['ball','Кулі','🔮'],['food','Їжа','🍲'],['bag','Рюкзаки','🎒'],['build','Будівлі','🏗️'],['mat','Матеріали','🧱']];
const catOf=id=>/^(ax|pk|pick)/.test(id)?'tool':/^(b|bg|bb|br)$/.test(id)?'ball':/^(gm|pie)$/.test(id)?'food':/^bp/.test(id)?'bag':/^B_/.test(id)?'build':'mat';
const NM={w:'Деревина',s:'Камінь',sti:'Палки',ore:'Руда',ing:'Злиток',be:'Ягоди',mu:'Гриби',gm:'Смажені гриби',pie:'Ягідний пиріг',b:'Світло-синя куля'};
let cat='all',onlyOk=0,sel=null;
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);
function render(){
 const c=document.getElementById('ivc');if(!c)return;
 const RC=G('RC')||[],cnt=G('cnt'),IT=G('IT')||{};
 const rows=[...c.querySelectorAll('.rc')];if(!rows.length)return;
 const lv=c.querySelector('.cmlv'),lvH=lv?lv.outerHTML:'';
 /* збираємо дані з уже намальованих рядків (так зберігаються всі правила інших модулів) */
 const R=rows.map(row=>{const btn=row.querySelector('button[data-r]');if(!btn)return null;const i=+btn.dataset.r,r=RC[i]||{},bt=btn.textContent.trim();
  const chips=[...row.querySelectorAll('.rcost i')].map(x=>x.innerHTML);const ents=Object.entries(r.c||{});
  const cost=ents.map(([k,n],j)=>{const have=cnt?cnt(k):0;const icon=(IT[k]&&IT[k][0])||(chips[j]||'').replace(/\s*\d+\/\d+\s*$/,'');return{k,n,have,icon,name:(IT[k]&&IT[k][1])||NM[k]||k}});
  const own=/✔|Є/.test(bt),lock=/🔒/.test(bt),ok=!btn.disabled&&!own;
  return{i,id:r.id,name:(row.querySelector('.rt b')||{}).textContent.replace(/^🏗️\s*/,''),desc:(row.querySelector('.rt small')||{}).textContent||r.d||'',icon:(row.querySelector('.ri')||{}).innerHTML||'',cost,ok,own,lock,bt,cat:catOf(r.id||'')}}).filter(Boolean);
 const vis=R.filter(x=>(cat=='all'||x.cat==cat)&&(!onlyOk||x.ok));
 if(sel==null||!vis.some(x=>x.i===sel)){const f=vis.find(x=>x.ok)||vis[0];sel=f?f.i:null}
 const cnts={};R.forEach(x=>{cnts[x.cat]=(cnts[x.cat]||0)+(x.ok?1:0)});cnts.all=R.filter(x=>x.ok).length;
 const s=R.find(x=>x.i===sel)||vis[0]||R[0];
 const tabs=CAT.filter(([k])=>k=='all'||R.some(x=>x.cat==k)).map(([k,n,e])=>`<button class='cxc ${k==cat?'on':''}' data-cxc='${k}'><span>${(window.plIcon&&{tool:'pick',ball:'b',food:'pie',bag:'bp2',build:'B_wb',mat:'w'}[k]&&plIcon({tool:'pick',ball:'b',food:'pie',bag:'bp2',build:'B_wb',mat:'w'}[k]))||e}</span>${n}${cnts[k]?`<em>${cnts[k]}</em>`:''}</button>`).join('');
 const cards=vis.map(x=>`<button class='cxk ${x.ok?'ok':x.own?'own':x.lock?'lock':'no'} ${s&&x.i===s.i?'sel':''}' data-cxk='${x.i}'><span class='cxi'>${x.icon}</span><span class='cxn'>${esc(x.name)}</span>${x.ok?"<i class='cxb'>✓</i>":x.own?"<i class='cxb own'>Є</i>":x.lock?"<i class='cxb lk'>🔒</i>":''}</button>`).join('')||`<div class='cxe'>${onlyOk?'Поки нічого не можна створити — зберіть більше матеріалів':'Тут порожньо'}</div>`;
 let det='';
 if(s){const need=s.cost.map(q=>{const p=Math.min(1,q.have/q.n);return `<div class='cxr ${q.have>=q.n?'y':'n'}'><span class='cxri'>${q.icon}</span><span class='cxrn'>${esc(q.name)}</span><span class='cxrq'>${Math.min(q.have,999)} / ${q.n}</span><span class='cxbar'><span style='width:${p*100}%'></span></span></div>`}).join('');
  const lockTxt=s.lock?s.bt.replace('🔒','').trim():'';
  const act=s.own?`<button class='cxgo' disabled>✔ Вже є у вас</button>`:s.lock?`<button class='cxgo' disabled>🔒 Потрібна будівля: ${esc(lockTxt)}</button>`:`<button class='cxgo' data-r='${s.i}' ${s.ok?'':'disabled'}>${s.ok?'🔨 Створити':'Не вистачає матеріалів'}</button>`;
  det=`<div class='cxd'><div class='cxdh'><span class='cxdi'>${s.icon}</span><div><b>${esc(s.name)}</b><small>${esc(s.desc)}</small></div></div><div class='cxdl'>Потрібно</div>${need}${act}</div>`}
 c.innerHTML=`${lvH}<div class='cxt'>${tabs}<label class='cxo'><input type='checkbox' ${onlyOk?'checked':''} data-cxo>Лише доступні</label></div><div class='cxw'><div class='cxg'>${cards}</div>${det}</div>`;
}
const _iv=window.ivR;
if(typeof _iv==='function')window.ivR=function(){const r=_iv.apply(this,arguments);try{if(G('ivTab')==='c')render()}catch(e){console.warn('craft-ui',e)}return r};
document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;
 const rr=()=>{try{window.ivR()}catch(_){}};
 const k=t.closest('[data-cxk]');if(k){sel=+k.dataset.cxk;rr();return}
 const c=t.closest('[data-cxc]');if(c){cat=c.dataset.cxc;sel=null;rr();return}
 if(t.matches&&t.matches('[data-cxo]')){onlyOk=t.checked?1:0;rr()}});
}catch(e){console.warn('craft-ui',e)}})();
