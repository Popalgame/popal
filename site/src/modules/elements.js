(function(){try{
const E={wa:['💧','Вода'],fi:['🔥','Вогонь'],ea:['⛰️','Земля'],ai:['🌪️','Повітря'],gr:['🌿','Трава'],da:['🌑','Темрява'],ne:['⚪','Нейтральний']};
const BEATS={wa:['fi'],fi:['gr'],gr:['ea'],ea:['wa','ai'],ai:['gr','da'],da:['ne'],ne:[]};
const J={chop:['🪓','Рубка дерева'],mine:['⛏️','Видобуток каменю'],gather:['🫐','Збір ягід і грибів'],carry:['📦','Перенесення їжі в годівницю'],cook:['🔥','Готування їжі'],water:['💧','Поливання'],cool:['❄️','Охолодження їжі']};
const SP2=[{e:['gr'],w:{chop:2,gather:3}},{e:['ea'],w:{mine:3,carry:1}},{e:['fi'],w:{cook:3,mine:1}},{e:['da'],w:{carry:3}},{e:['ne'],w:{gather:2,carry:1}},{e:['ai'],w:{gather:3}},{e:['wa'],w:{cool:3,mine:2}},{e:['da','ai'],w:{carry:2,chop:1}},{e:['wa'],w:{water:3,chop:1}},{e:['fi','ai'],w:{cook:2,carry:2}}];
const pips=l=>'●'.repeat(l)+'○'.repeat(4-l);
T.forEach((t,i)=>{const s=SP2[i];if(!s)return;t.e=s.e;t.wk=s.w;t.el=s.e.map(k=>E[k][1]).join(' / ');EL[i]=E[s.e[0]][0];t.sk=Object.entries(s.w).map(([k,l])=>J[k][0]+' '+J[k][1].split(' ')[0]+' '+l).join(' · ');t.d=s.w.mine?'s':'w'});
window.elM=(a,b)=>{const A=(T[a]&&T[a].e)||[],B=(T[b]&&T[b].e)||[];let m=1;for(const x of A)for(const y of B){if(BEATS[x].includes(y))m=Math.max(m,1.5);if(BEATS[y].includes(x))m=Math.min(m,.75)}return m};
let tipT=0;window.elTip=m=>{if(Date.now()-tipT<4000)return;tipT=Date.now();msg(m>1?'✦ Стихія ефективна! Пал б’є сильніше':'▽ Стихія слабка проти цієї істоти')};
const camp=()=>pals.filter((p,i)=>i!==selP),lv=j=>camp().reduce((a,p)=>Math.max(a,(T[p.ty].wk||{})[j]||0),0);
window.coolF=()=>{const l=lv('cool');return l?1-.12*l:1};
const ACT=['chop','mine','gather','carry','cook'];
window.palWork=function(p,dt){const wk=T[p.ty].wk||{},jobs=ACT.filter(j=>wk[j]);if(!jobs.length)return;p.w=(p.w||0)+dt*(1+.15*lv('water'));if(p.w<(cf>0?7:18))return;p.w=0;p.j=((p.j||0)+1)%jobs.length;const job=jobs[p.j],L=wk[job],n=L>=3?2:1;let t='';
switch(job){case'chop':res.w+=n;t='+'+n+' 🪵';break;
case'mine':res.s+=n;t='+'+n+' 🪨';if(L>=3&&Math.random()<.3){inv.ore=(inv.ore||0)+1;t+=' +1 🟤'}break;
case'gather':{const k=Math.random()<.6?'be':'mu';inv[k]+=n;t='+'+n+(k=='be'?' 🫐':' 🍄');break}
case'cook':if(inv.mu>=2){inv.mu-=2;inv.gm++;t='+1 🍢'}break;
case'carry':if(cf<20){const k=['be','mu','gm','pie'].find(k=>inv[k]>0);if(k){inv[k]--;cf+=FOOD[k];t='📦 +'+FOOD[k]+' 🍖'}}break}
p.job=job;if(t&&Math.hypot(P.x-p.x,P.z-p.z)<16)dmg(t,p.m,'#bdf5c9');hud()};
const _iv=ivR;ivR=function(){_iv();const c=$('ivc');
if(ivTab=='d'&&c.children.length>1){const d=document.createElement('div');d.className='elc';d.innerHTML='<b>Сила стихій</b>'+Object.entries(BEATS).filter(([k,v])=>v.length).map(([k,v])=>E[k][0]+' '+E[k][1]+' → '+v.map(x=>E[x][0]+' '+E[x][1]).join(', ')).join(' · ')+'<br><small>Сильна стихія: удар ×1,5. Слабка: ×0,75.</small>';c.insertBefore(d,c.children[1])}
if(ivTab=='p'){c.querySelectorAll('.i2p .card').forEach((el,i)=>{const p=pals[i];if(!p)return;const w=document.createElement('div');w.className='wk';w.innerHTML=Object.entries(T[p.ty].wk||{}).map(([k,l])=>`<span>${J[k][0]} ${J[k][1]}<i>${pips(l)}</i></span>`).join('');const s=document.createElement('small');s.className='jb';s.textContent=i===selP?'🚶 Іде з вами й допомагає в бою':p.job?'⚙️ Зараз: '+J[p.job][1].toLowerCase():'⚙️ Працює в таборі';const b=el.querySelector('button');el.insertBefore(w,b);el.insertBefore(s,b)})}};
try{pwUp()}catch(_){}
}catch(e){console.warn('elem',e)}})();
