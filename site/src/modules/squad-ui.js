/* 0.2.17: нове меню «Загін» (вкладка рюкзака). Замість вузьких карток із дрібним текстом — три колонки, як у Попалпедії:
   • ліворуч список попалів (портрет, рівень, роль, де він зараз), окремо «З вами» і «У Попал-центрі»;
   • посередині 3D-модель вибраного попала в його справжній формі та кнопка «Взяти з собою»;
   • праворуч усе про нього: показники, ситість і бадьорість, три атаки, робота на базі.
   Модуль підключається останнім і перемальовує вкладку після inventory.js, elements.js, pal-growth.js і pal-needs.js;
   кнопка «Взяти з собою» лишається з data-pp, тож її обробляє той самий слухач в inventory.js. */
(function(){try{
if(typeof ivR!='function'||typeof pals=='undefined'||typeof T=='undefined')return;
const EC={wa:['#3a9be0','💧','Вода'],fi:['#e8603a','🔥','Вогонь'],ea:['#a8713f','⛰️','Земля'],ai:['#5fb8c8','🌪️','Повітря'],gr:['#5fb04a','🌿','Трава'],da:['#7a5ad6','🌑','Темрява'],ne:['#8e8ea0','⚪','Нейтральний']};
const J={chop:['🪓','Рубка дерева'],mine:['⛏️','Видобуток каменю'],gather:['🫐','Збір ягід і грибів'],carry:['📦','Перенесення їжі в годівницю'],cook:['🔥','Готування їжі'],smelt:['🔥','Плавлення руди'],water:['💧','Поливання'],cool:['❄️','Охолодження їжі']};
const css=document.createElement('style');css.id='squad-css';css.textContent=`
#ivc .sq{display:grid;grid-template-columns:minmax(170px,27%) minmax(150px,27%) 1fr;gap:10px;height:100%;min-height:0;color:#fff}
#ivc .sql{display:flex;flex-direction:column;min-height:0}
#ivc .sqls{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:5px;padding-right:4px}
#ivc .sqls h6{margin:4px 0 0;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:#8fd8e8;font-weight:800}
#ivc .sqi{display:flex;align-items:center;gap:8px;text-align:left;width:100%;background:linear-gradient(90deg,rgba(255,255,255,.08),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:5px 8px;color:#fff;cursor:pointer;font-family:inherit}
#ivc .sqi.on{background:linear-gradient(90deg,#3a8ee6,#2d6fc0);border-color:#7fc4ff}
#ivc .sqi.me{box-shadow:inset 3px 0 0 #ffd34e}
#ivc .sqi .pt{width:40px;height:40px;flex:none;display:flex;align-items:center;justify-content:center;font-size:28px;line-height:1}#ivc .sqi .pt img.palic{width:44px;height:44px;margin:0}
#ivc .sqi .nm{flex:1;min-width:0}#ivc .sqi .nm b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#ivc .sqi .nm small{display:block;font-size:11px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ivc .sqi .st{flex:none;font-size:16px}
#ivc .sqm{display:flex;flex-direction:column;min-height:0;min-width:0;gap:6px}
#ivc .sqh b{display:block;font-size:19px;line-height:1.15}#ivc .sqh small{font-size:12px;opacity:.85}
#ivc .sqe{display:inline-block;font-size:10.5px;font-weight:700;border-radius:4px;padding:1px 6px;color:#fff;white-space:nowrap;margin:2px 4px 0 0}
#ivc .sqv{flex:1;min-height:90px;position:relative;border-radius:12px;background:radial-gradient(circle at 50% 60%,rgba(127,227,245,.14),transparent 68%)}
#ivc .sqv canvas{position:absolute;inset:0;width:100%!important;height:100%!important}
#ivc .sqv .pt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:70px}#ivc .sqv .pt img.palic{width:70%;height:auto;max-height:90%;margin:0}
#ivc .sqm button.go{min-height:38px;border-radius:10px;border:2px solid #e2bf67;background:linear-gradient(#5fb04a,#2f8a3a);color:#fff;font:800 14px inherit;font-family:inherit;cursor:pointer}
#ivc .sqm button.go:disabled{background:rgba(255,255,255,.06);border-color:rgba(226,191,103,.45);color:#ffe7a8;opacity:1;cursor:default}
#ivc .sqr{overflow:auto;min-height:0;display:flex;flex-direction:column;gap:6px;padding-right:4px}
#ivc .sqr h6{margin:0;background:rgba(255,255,255,.1);padding:2px 8px;font-size:12px;color:#dfe8f0;border-radius:3px}
#ivc .sqs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
#ivc .sqs div{background:rgba(255,255,255,.06);border-radius:8px;padding:4px 6px;text-align:center;font-size:11px;color:#b9cbe0}#ivc .sqs b{display:block;font-size:clamp(13px,1.6vw,16px);color:#fff;white-space:nowrap}
#ivc .sqx{font-size:11.5px;padding:0 2px}#ivc .sqx i{display:block;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:2px}#ivc .sqx i b{display:block;height:100%;background:linear-gradient(90deg,#7fe3f5,#3a9be0)}
#ivc .sqr .pgn{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0;padding:0 2px;border:0;font-size:11.5px}
#ivc .sqa{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border-radius:8px;padding:4px 8px;font-size:12px}
#ivc .sqa u{flex:none;width:20px;height:20px;border-radius:50%;background:rgba(242,193,78,.2);color:#ffe7a8;font:800 12px/20px inherit;font-family:inherit;text-align:center;text-decoration:none}
#ivc .sqa b{font-size:13.5px}#ivc .sqa small{margin-left:auto;opacity:.75;white-space:nowrap}#ivc .sqa.lk{opacity:.5}
#ivc .sqw{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;padding:0 4px}#ivc .sqw i{font-style:normal;color:#ffd34e;letter-spacing:1px}
#ivc .sqn{font-size:12px;line-height:1.4;padding:0 4px;color:#bdf5c9}#ivc .sqn.dim{color:#a9bed6}
@media (max-width:760px){#ivc .sq{grid-template-columns:minmax(130px,32%) 1fr;grid-template-rows:auto 1fr}#ivc .sql{grid-row:1/3}#ivc .sqm{flex-direction:row;align-items:center}#ivc .sqv{flex:none;width:84px;height:84px;min-height:0}#ivc .sqh{flex:1;min-width:0}#ivc .sqm button.go{flex:none;padding:0 10px}}`;
document.head.appendChild(css);

/* ---------- 3D-перегляд вибраного попала у його формі ---------- */
let VR=null,VS=null,VC=null,VM=null,vKey='',raf=0,vOff=false;
function fit(){const r=VM.root;r.scale.set(1,1,1);r.position.set(0,0,0);r.rotation.set(0,0,0);r.updateMatrixWorld(true);
 const b=new THREE.Box3().setFromObject(r),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3()),k=1.45/Math.max(s.x,s.y,s.z);
 r.scale.setScalar(k);r.position.set(-c.x*k,-b.min.y*k-.75,-c.z*k)}
function view(host,p){if(vOff||typeof THREE=='undefined'||!window.PALMODEL)return false;
 try{if(!VR){VR=new THREE.WebGLRenderer({antialias:true,alpha:true});VR.setPixelRatio(Math.min(devicePixelRatio||1,2));VR.outputEncoding=THREE.sRGBEncoding;
   VS=new THREE.Scene();VS.add(new THREE.HemisphereLight(0xf0f6ff,0x3a3050,1.15));const d=new THREE.DirectionalLight(0xfff0d8,1.5);d.position.set(2,4,3);VS.add(d);const r=new THREE.DirectionalLight(0x7fe3f5,.7);r.position.set(-3,2,-2);VS.add(r);
   VC=new THREE.PerspectiveCamera(32,1,.1,50);VC.position.set(0,.35,4.6);VC.lookAt(0,0,0)}
  const fm=p.fm||1,key=p.ty+':'+fm;
  if(key!==vKey){if(VM){VS.remove(VM.root);try{window.PALMODEL.dispose(VM)}catch(_){}VM=null}
   VM=window.PALMODEL.build(p.ty);if(fm>1&&window.PALFORM)window.PALFORM.ensure(VM,p.ty,fm);fit();VS.add(VM.root);vKey=key}
  host.appendChild(VR.domElement);const w=host.clientWidth||200,h=host.clientHeight||200;VR.setSize(w,h,false);VC.aspect=w/h;VC.updateProjectionMatrix();
  if(!raf)raf=requestAnimationFrame(loop);return true}
 catch(e){console.warn('squad view',e);vOff=true;return false}}
function loop(t){raf=0;if(!VR||!VM||!VR.domElement.isConnected||typeof ivO=='undefined'||!ivO||ivTab!='p')return;
 VM.root.rotation.y=.5+Math.sin(t/1000*.7)*.55;try{window.PALMODEL.pose(VM,t/1000,'idle',0)}catch(_){}
 VR.render(VS,VC);raf=requestAnimationFrame(loop)}

/* ---------- вміст ---------- */
let cur=-1;
const pips=l=>'●'.repeat(l)+'○'.repeat(Math.max(0,4-l));
const els=p=>((T[p.ty]||{}).e&&T[p.ty].e.length?T[p.ty].e:['ne']);
const chip=k=>`<span class='sqe' style='background:${EC[k][0]}'>${EC[k][1]} ${EC[k][2]}</span>`;
const where=(p,i)=>i===selP?'🚶':p.cs==null?'🔮':p.wk?'⚒️':'🗄️';
function row(p,i){const G=window.PALGROWTH,r=G?G.ROLE[G.role(p)]:null,fm=p.fm||1;
 return `<button class='sqi ${i===cur?'on':''} ${i===selP?'me':''}' data-sq='${i}'><span class='pt'>${EM[p.ty]||''}</span><span class='nm'><b>${T[p.ty].n}</b><small>рів. ${p.lv||1}${r?' · '+r[0]+' '+r[1]:''}${fm>1?' · Форма '+fm:''}</small></span><span class='st'>${where(p,i)}</span></button>`}
function info(p,i){const G=window.PALGROWTH,t=T[p.ty],wk=t.wk||{},lv=p.lv||1;let h='';
 if(G){const s=G.stats(p),hp=p.chp==null?s.hp:Math.max(0,Math.min(s.hp,Math.round(p.chp)));
  h+=`<h6>Показники</h6><div class='sqs'><div><b>${hp} / ${s.hp}</b>❤️ Здоровʼя</div><div><b>${s.atk}</b>⚔️ Атака</div><div><b>${s.def}</b>🛡️ Захист</div></div>`}
 try{if(typeof palXpNeed=='function'&&lv<50){const n=palXpNeed(lv),x=Math.min(n,Math.round(p.xp||0));h+=`<div class='sqx'>Досвід ${x} / ${n}<i><b style='width:${n?x/n*100:0}%'></b></i></div>`}}catch(_){}
 if(window.palNeedsHTML)h+=window.palNeedsHTML(p);
 if(G){const sl=G.slots(p),KT=G.kindTxt||{},line=(a,n,need)=>a?`<div class='sqa'><u>${n}</u><b>${a.n}</b><small>${KT[a.k]||''}${a.p?' · сила '+a.p:''}</small></div>`:`<div class='sqa lk'><u>${n}</u><span>🔒 відкриється на рівні ${need}</span></div>`;
  h+=`<h6>Атаки</h6>${line(sl[0],1)}${line(sl[1],2,10)}${line(sl[2],3,30)}`}
 h+=`<h6>Робота на базі</h6>${Object.entries(wk).map(([k,l])=>`<div class='sqw'><span>${(J[k]||['',k])[0]} ${(J[k]||['',k])[1]}</span><i>${pips(l)}</i></div>`).join('')}`;
 if(wk.water)h+=`<div class='sqn dim'>У бригаді прискорює роботу на 15% за рівень. Діє найсильніший фахівець.</div>`;
 if(els(p).includes('fi'))h+=`<div class='sqn dim'>🔥 Плавить руду в печі</div>`;
 h+=`<div class='sqn'>${i===selP?'🚶 Іде з вами й допомагає в бою':p.cs==null?'🔮 У сфері: не працює. Покладіть у Попал-центр':!p.wk?'🗄️ У сховищі центру: відпочиває':p.job?'⚙️ Зараз: '+((J[p.job]||[])[1]||'працює').toLowerCase():'⚙️ Працює в Попал-центрі'}</div>`;
 return h}
function draw(){const c=document.getElementById('ivc');if(!c||!pals.length)return;
 const old=c.querySelector('.sq'),sc0=old?[old.querySelector('.sqls').scrollTop,old.querySelector('.sqr').scrollTop]:[0,0];
 if(cur<0||cur>=pals.length)cur=pals[selP]?selP:0;
 const p=pals[cur],team=[],cen=[];pals.forEach((q,i)=>(q.cs==null?team:cen).push(i));
 const cap=window.palCap?window.palCap():8,G=window.PALGROWTH,r=G?G.ROLE[G.role(p)]:null,fm=p.fm||1;
 c.innerHTML=`<div class='sq'><div class='sql'><div class='sqls'><h6>З вами ${team.length} / ${cap}</h6>${team.map(i=>row(pals[i],i)).join('')||"<small style='opacity:.6'>Нікого. Заберіть попала з Попал-центру.</small>"}${cen.length?`<h6>У Попал-центрі ${cen.length}</h6>${cen.map(i=>row(pals[i],i)).join('')}`:''}</div></div>
  <div class='sqm'><div class='sqh'><b>${T[p.ty].n}</b><small>рів. ${p.lv||1}${r?' · '+r[0]+' '+r[1]:''} · Форма ${fm}</small><div>${els(p).map(chip).join('')}</div></div>
   <div class='sqv'></div><button class='go' data-pp='${cur}' ${cur===selP||p.cs!=null?'disabled':''}>${cur===selP?'✔ З вами':p.cs!=null?'🏠 У центрі':'Взяти з собою'}</button></div>
  <div class='sqr'>${info(p,cur)}</div></div>`;
 c.querySelector('.sqls').scrollTop=sc0[0];c.querySelector('.sqr').scrollTop=sc0[1];
 c.querySelectorAll('[data-sq]').forEach(b=>b.onclick=()=>{cur=+b.dataset.sq;draw()});
 const v=c.querySelector('.sqv');if(!view(v,p))v.innerHTML=`<span class='pt'>${EM[p.ty]||''}</span>`}
const _r=ivR;ivR=function(){const r=_r.apply(this,arguments);try{if(typeof ivTab!='undefined'&&ivTab=='p'&&pals.length)draw()}catch(e){console.warn('squad',e)}return r};
}catch(e){console.warn('squad-ui',e)}})();
