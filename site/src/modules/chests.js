/* 0.1.20: скрині на базі. Крафт 10 🪵 + 4 🥢, ставиться в радіусі 30 м від Попал-центру, скринь може бути скільки завгодно.
   Попали в центрі складають усе здобуте (деревину, палки, камінь, ягоди, гриби, страви) у найближчу скриню, а не гравцю в рюкзак.
   Кухарі беруть гриби, а носії — їжу для годівниці теж зі скринь. Ваги в скрині немає: гравець забирає, скільки потрібно. */
(function(){try{
const NEAR=1.9,BASE=30;
IT.B_ch=['📦','Скриня'];if(inv.B_ch==null)inv.B_ch=0;
{const i=RC.findIndex(r=>r.id=='B_cen');RC.splice(i+1,0,{id:'B_ch',n:'📦 Скриня',c:{w:10,sti:4},d:'Ставиться на базі. Попали складають сюди все, що добули. Без обмеження ваги'})}
if(!Array.isArray(inv._ch))inv._ch=[];
const CH=inv._ch;

/* ---------- модель ---------- */
const WD=new THREE.MeshStandardMaterial({color:0x9a6234,roughness:.85,flatShading:true}),WL=new THREE.MeshStandardMaterial({color:0xb87a44,roughness:.8,flatShading:true}),
      FE=new THREE.MeshStandardMaterial({color:0x4a4a56,roughness:.45,metalness:.4}),GO=new THREE.MeshStandardMaterial({color:0xe2bf67,roughness:.35,metalness:.5});
function mkChest(){const g=new THREE.Group(),m=(geo,mat,x,y,z)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
 m(new THREE.BoxGeometry(1.1,.5,.7),WD,0,.27,0);
 m(new THREE.BoxGeometry(1.16,.16,.76),WL,0,.6,0);m(new THREE.BoxGeometry(1.0,.08,.6),WL,0,.71,0);
 for(const x of[-.42,.42])m(new THREE.BoxGeometry(.08,.62,.8),FE,x,.36,0);
 m(new THREE.BoxGeometry(.18,.22,.06),GO,0,.5,.39);return g}
const meshes=[];
function showAll(){meshes.forEach(g=>sc.remove(g));meshes.length=0;CH.forEach(c=>{const g=mkChest();g.position.set(c.x,Math.max(-.2,H(c.x,c.z)),c.z);g.rotation.y=c.ry||0;sc.add(g);meshes.push(g)})}
showAll();

/* ---------- сховище ---------- */
const total=c=>Object.values(c.it||{}).reduce((a,n)=>a+n,0);
const near=(x,z)=>{let b=null,bd=1e9;for(const c of CH){const d=Math.hypot(c.x-x,c.z-z);if(d<bd){bd=d;b=c}}return b};
let wT=0;const warn=()=>{if(Date.now()-wT<90000)return;wT=Date.now();msg('📦 Попали не мають куди складати здобуте — поставте скриню на базі')};
window.chAny=()=>CH.length>0;
window.chStore=(k,n,x,z)=>{const c=near(x==null?P.x:x,z==null?P.z:z);if(!c){warn();return false}c.it=c.it||{};c.it[k]=(c.it[k]||0)+n;return true};
window.chCount=k=>CH.reduce((a,c)=>a+((c.it||{})[k]||0),0);
window.chTake=(k,n)=>{if(chCount(k)<n)return false;let left=n;for(const c of CH){const h=(c.it||{})[k]||0,t=Math.min(h,left);if(t){c.it[k]-=t;if(!c.it[k])delete c.it[k];left-=t}if(!left)break}return true};

/* ---------- встановлення ---------- */
function placeCh(){if(!(inv.B_ch>0))return;const C=inv._cen;if(!C){msg('🏠 Спершу поставте Попал-центр: скрині стоять на базі');return}
 const x=P.x+Math.sin(P.face||0)*1.6,z=P.z+Math.cos(P.face||0)*1.6,dc=Math.hypot(x-C[0],z-C[1]);
 if(dc>BASE){msg('📦 Скриню можна поставити лише на базі — до '+BASE+' м від Попал-центру');return}
 if(dc<4){msg('📦 Занадто близько до Попал-центру');return}
 if(H(x,z)<-.3){msg('🌊 Скриню не можна ставити у воді');return}
 if(CH.some(c=>Math.hypot(c.x-x,c.z-z)<1.3)){msg('📦 Тут уже стоїть скриня');return}
 inv.B_ch--;CH.push({x:+x.toFixed(2),z:+z.toFixed(2),ry:+((P.face||0)+Math.PI).toFixed(2),it:{}});showAll();hud();save();msg('📦 Скриню поставлено! Попали складатимуть сюди здобуте')}
document.addEventListener('click',e=>{const t=e.target.closest('[data-chplace]');if(!t)return;placeCh();ivR()});
const _r=ivR;ivR=function(){_r.apply(this,arguments);const c=$('ivc');if(!c||ivTab!='i')return;const on=c.querySelector('.i2g .i2s.on'),d=c.querySelector('.i2d');
 if(on&&on.dataset.sl=='B_ch'&&d&&!d.querySelector('[data-chplace]')){const b=document.createElement('button');b.dataset.chplace=1;b.textContent='📦 Поставити тут';d.appendChild(b)}};

/* ---------- взаємодія ---------- */
const nearCh=()=>{const c=near(P.x,P.z);return c&&Math.hypot(c.x-P.x,c.z-P.z)<NEAR?c:null};
const hb=$('hit'),h0=hb.onclick;hb.onclick=function(){const c=nearCh();if(c&&!nearest(wild,2.6)){openCh(c);return}return h0.apply(this,arguments)};
let was=null,hit0=null;ANI.push(()=>{const n=!!nearCh();if(n===was)return;was=n;if(n){hit0=hb.innerHTML;hb.innerHTML='📦<small>Скриня</small>'}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}});

/* ---------- вікно скрині ---------- */
const css=document.createElement('style');css.id='ch-css';css.textContent=`
#chs{display:none;position:fixed;left:calc(env(safe-area-inset-left,0px) + 5%);right:calc(env(safe-area-inset-right,0px) + 5%);top:calc(env(safe-area-inset-top,0px) + 4%);bottom:calc(env(safe-area-inset-bottom,0px) + 4%);z-index:36;flex-direction:column;background:rgba(14,20,42,.96);border:2px solid #e2bf67;border-radius:16px;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.5);overflow:hidden}
#chs header{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(226,191,103,.4)}#chs header b{font-size:18px;color:#ffe7a8;flex:1}#chs header small{opacity:.8}
#chs .cx{background:none;border:none;color:#e2bf67;font-size:24px;cursor:pointer}
#chs .cb{flex:1;display:flex;gap:12px;padding:10px 12px;min-height:0}#chs .col{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
#chs h5{margin:0 0 6px;color:#e2bf67;font-size:13px;display:flex;align-items:center;gap:8px}#chs h5 span{flex:1}
#chs .ls{flex:1;overflow:auto;display:flex;flex-direction:column;gap:5px;min-height:0;padding-right:4px}
#chs .r{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:4px 8px}
#chs .r .ic{font-size:22px;width:30px;text-align:center}#chs .r .nm{flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#chs .r .n{font-weight:700;color:#ffe7a8;min-width:34px;text-align:right}
#chs button.b{background:linear-gradient(#f39a4a,#d9532e);border:2px solid #e2bf67;color:#fff;border-radius:9px;padding:2px 9px;font-weight:700;cursor:pointer;font-size:12px;font-family:inherit}
#chs button.b.g{background:linear-gradient(#5fb04a,#2f8a3a)}#chs .em{opacity:.65;font-size:12px;padding:6px}#chs .wt{font-size:12px;opacity:.85}`;document.head.appendChild(css);
const box=document.createElement('div');box.id='chs';document.body.appendChild(box);
let cur=null;
const nm=k=>IT[k]?IT[k][1]:k,ic=k=>IT[k]?IT[k][0]:'❔';
const ownList=()=>Object.keys(IT).filter(k=>(cnt(k)||0)>0&&k!=eq.tool&&k!=eq.bag);
function openCh(c){cur=c;ivO=1;box.style.display='flex';render()}
function closeCh(){box.style.display='none';ivO=0;cur=null;hud();save()}
function take(k,n){const h=(cur.it||{})[k]||0;n=Math.min(n,h);if(!n)return;cur.it[k]-=n;if(!cur.it[k])delete cur.it[k];addI(k,n);render()}
function put(k,n){const h=cnt(k)||0;n=Math.min(n,h);if(!n)return;addI(k,-n);cur.it=cur.it||{};cur.it[k]=(cur.it[k]||0)+n;render()}
function render(){if(!cur)return;const it=cur.it||{},ks=Object.keys(it).filter(k=>it[k]>0).sort((a,b)=>it[b]-it[a]),own=ownList(),i=CH.indexOf(cur)+1;
 const w=window.invWt?invWt():0,cp=window.invCap?invCap():0;
 box.innerHTML=`<header><b>📦 Скриня ${CH.length>1?'№'+i:''}</b><small>Усього: ${total(cur)} · без обмеження ваги</small><button class='cx'>✕</button></header>
 <div class='cb'><div class='col'><h5><span>У скрині</span>${ks.length?"<button class='b g' data-all>⬇ Забрати все</button>":''}</h5><div class='ls'>${ks.length?ks.map(k=>`<div class='r'><span class='ic'>${ic(k)}</span><span class='nm'>${nm(k)}</span><span class='n'>${it[k]}</span><button class='b g' data-t='${k}' data-n='1'>1</button><button class='b g' data-t='${k}' data-n='10'>10</button><button class='b g' data-t='${k}' data-n='1e9'>Усе</button></div>`).join(''):"<div class='em'>Порожньо. Попали в Попал-центрі складатимуть сюди деревину, палки, камінь, ягоди й гриби.</div>"}</div></div>
 <div class='col'><h5><span>🎒 Рюкзак</span><span class='wt'>⚖️ ${Math.round(w*10)/10} / ${cp}</span></h5><div class='ls'>${own.length?own.map(k=>`<div class='r'><span class='ic'>${ic(k)}</span><span class='nm'>${nm(k)}</span><span class='n'>${cnt(k)}</span><button class='b' data-p='${k}' data-n='1'>1</button><button class='b' data-p='${k}' data-n='1e9'>Усе</button></div>`).join(''):"<div class='em'>Рюкзак порожній.</div>"}</div></div></div>`;
 box.querySelector('.cx').onclick=closeCh;
 box.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>take(b.dataset.t,+b.dataset.n));
 box.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>put(b.dataset.p,+b.dataset.n));
 const a=box.querySelector('[data-all]');if(a)a.onclick=()=>{for(const k of Object.keys(cur.it||{}))take(k,1e9)}}
addEventListener('keydown',e=>{if(e.key=='Escape'&&box.style.display=='flex')closeCh()});
window.openCh=openCh;
}catch(e){console.warn('chests',e)}})();
