/* NPC: персонажі, з якими можна поговорити. Загальна система (працює в будь-якому вимірі):
   • NPC.add({id,name,role,x,z,face,model,color,icon,lines}) — ставить персонажа; model — THREE.Group (будує isle-npc.js);
   • над головою — значок: «!» (є нове завдання), «?» (можна здати), нічого — просто розмова; NPC.mark(id,'!'|'?'|null);
   • поруч із NPC кнопка «Дія» стає «Говорити» — відкривається вікно діалогу з іменем, портретом, текстом (друкується) і кнопками;
   • NPC тверді (герой обходить), повертаються обличчям до героя, дихають і махають рукою, коли говорять;
   • компас: NPC.hint(x,z,слово) — на смузі компаса зʼявляється ◆ і одне слово в тому напрямку (без відстані й точного місця), NPC.hint(null) — прибрати.
   Діалог: NPC.say(id,[сторінки],{buttons:[{t,fn}]}) — сторінка — рядок; останню сторінку закривають кнопки (або «Бувай»).
   NPC.onTalk(id) — що робити, коли гравець заговорив (за замовчуванням — показати lines). */
(function(){try{
if(typeof THREE=='undefined')return;
const G=n=>{try{return eval(n)}catch(_){return undefined}};
const sc_=G('sc'),P_=G('P'),H_=window.H,ANI_=G('ANI');if(!sc_||!P_||!H_)return;
const L=[],byId={};
/* ---------- значки й підписи ---------- */
function tex(draw,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
const MK={'!':tex((x,w,h)=>{x.fillStyle='#2a1a00';x.beginPath();x.arc(w/2,h/2,w/2-2,0,7);x.fill();x.fillStyle='#ffd23a';x.beginPath();x.arc(w/2,h/2,w/2-8,0,7);x.fill();
  x.fillStyle='#3a2400';x.font='900 '+(h*.62|0)+'px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText('!',w/2,h/2+3)},96,96),
 '?':tex((x,w,h)=>{x.fillStyle='#002a1a';x.beginPath();x.arc(w/2,h/2,w/2-2,0,7);x.fill();x.fillStyle='#5dff9e';x.beginPath();x.arc(w/2,h/2,w/2-8,0,7);x.fill();
  x.fillStyle='#003a20';x.font='900 '+(h*.6|0)+'px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText('?',w/2,h/2+3)},96,96)};
function nameTex(n,role){return tex((x,w,h)=>{x.font='800 34px system-ui';x.textAlign='center';x.textBaseline='middle';x.lineWidth=7;x.strokeStyle='rgba(20,14,30,.85)';
  x.strokeText(n,w/2,26);x.fillStyle='#ffe7a8';x.fillText(n,w/2,26);if(role){x.font='600 22px system-ui';x.lineWidth=5;x.strokeText(role,w/2,62);x.fillStyle='#bfe7e2';x.fillText(role,w/2,62)}},512,80)}
/* ---------- додати NPC ---------- */
const NPC=window.NPC={list:L,add(o){const g=new THREE.Group();g.add(o.model);g.position.set(o.x,H_(o.x,o.z),o.z);g.rotation.y=o.face||0;sc_.add(g);
  const ht=o.height||1.9;
  const mk=new THREE.Sprite(new THREE.SpriteMaterial({map:MK['!'],depthTest:false,transparent:true}));mk.scale.set(.55,.55,1);mk.position.y=ht+.55;mk.renderOrder=10;mk.visible=false;g.add(mk);
  const nm=new THREE.Sprite(new THREE.SpriteMaterial({map:nameTex(o.name,o.role),depthTest:false,transparent:true,opacity:0}));nm.scale.set(2.6,.41,1);nm.position.y=ht+.1;nm.renderOrder=9;g.add(nm);
  const n=Object.assign({g,mk,nm,ht,r:o.r||.5,face0:o.face||0,t:Math.random()*6,talkT:0},o);L.push(n);byId[o.id]=n;return n},
 get:id=>byId[id],
 mark(id,m){const n=byId[id];if(!n)return;n.mark=m||null;n.mk.visible=!!m;if(m)n.mk.material.map=MK[m];n.mk.material.needsUpdate=true},
 near(d){let b=null,bd=d||2.6;for(const n of L){const k=Math.hypot(n.x-P_.x,n.z-P_.z)-n.r;if(k<bd){bd=k;b=n}}return b}};

/* ---------- вікно діалогу ---------- */
const st=document.createElement('style');st.textContent=`
#npcd{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);transform:translateX(-50%);width:min(640px,94vw);display:none;z-index:60;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#eef6f4}
#npcd .nb{position:relative;display:flex;gap:14px;padding:14px 16px 12px;border-radius:14px;background:linear-gradient(rgba(24,46,52,.94),rgba(14,28,34,.94));border:1px solid rgba(160,230,220,.35);box-shadow:0 10px 30px rgba(0,0,0,.45);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
#npcd .np{flex:0 0 74px;height:74px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;border:3px solid #ffd27a;box-shadow:inset 0 -6px 12px rgba(0,0,0,.3)}
#npcd .nt{flex:1;min-width:0}#npcd .nn{font-weight:900;font-size:17px;color:#ffd98a;letter-spacing:.2px}#npcd .nr{font-weight:600;font-size:12px;color:#9fd6cc;margin-left:6px}
#npcd .nx{margin-top:5px;font-size:15px;line-height:1.45;min-height:44px}
#npcd .nbtn{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:8px}
#npcd .nbtn button{padding:8px 14px;border-radius:10px;border:0;font:800 14px system-ui;background:#2e6d73;color:#eafffb;box-shadow:0 2px 0 #163a3e}
#npcd .nbtn button.go{background:#ffc94a;color:#3a2400;box-shadow:0 2px 0 #9b6b00}
#npcd .nmore{position:absolute;right:16px;bottom:10px;font-size:12px;color:#9fd6cc;animation:npcb 1s infinite}@keyframes npcb{50%{opacity:.35}}
@media (max-width:600px){#npcd .np{flex-basis:54px;height:54px;font-size:30px}#npcd .nx{font-size:14px}}
#cmps .cq{color:#ffd23a!important;font-size:11px!important;top:3px!important;white-space:nowrap;text-shadow:0 0 4px #000,0 1px 2px #000!important}`;
document.head.appendChild(st);
const D=document.createElement('div');D.id='npcd';D.innerHTML=`<div class='nb'><div class='np'></div><div class='nt'><div><span class='nn'></span><span class='nr'></span></div><div class='nx'></div><div class='nbtn'></div></div><span class='nmore'>▼</span></div>`;document.body.appendChild(D);
const $p=D.querySelector('.np'),$n=D.querySelector('.nn'),$r=D.querySelector('.nr'),$x=D.querySelector('.nx'),$b=D.querySelector('.nbtn'),$m=D.querySelector('.nmore');
let cur=null,pages=[],pi=0,typing=0,full='',shown=0,opts=null;
function show(){full=pages[pi];shown=0;typing=1;$x.textContent='';$b.innerHTML='';$m.style.display='none'}
function done(){typing=0;$x.textContent=full;const last=pi>=pages.length-1;$m.style.display=last?'none':'block';if(!last)return;
 const bs=(opts&&opts.buttons)||[{t:'Бувай'}];for(const b of bs){const e=document.createElement('button');e.textContent=b.t;if(b.go)e.className='go';e.onclick=ev=>{ev.stopPropagation();NPC.close();if(b.fn)b.fn()};$b.appendChild(e)}}
D.addEventListener('click',()=>{if(typing){done();return}if(pi<pages.length-1){pi++;show()}});
NPC.say=(id,pg,o)=>{const n=byId[id];if(!n)return;cur=n;pages=Array.isArray(pg)?pg:[pg];pi=0;opts=o||null;
 $p.textContent=n.icon||'🙂';$p.style.background=n.color||'#3a5a5a';$n.textContent=n.name;$r.textContent=n.role?'· '+n.role:'';D.style.display='block';n.talkT=2.5;show();
 try{if(window.sfx)window.sfx('open')}catch(_){}};
NPC.close=()=>{D.style.display='none';cur=null};
NPC.isOpen=()=>!!cur;
NPC.onTalk=null;
function talk(n){if(NPC.onTalk&&NPC.onTalk(n.id)!==false)return;NPC.say(n.id,n.lines||['…'])}

/* ---------- кнопка «Дія» біля NPC ---------- */
const hb=document.getElementById('hit');
if(hb){const h0=hb.onclick;hb.onclick=function(){const n=NPC.near();if(n){talk(n);return}return h0&&h0.apply(this,arguments)}}
let was=null,hit0=null;
/* ---------- компас: ◆ і одне слово в напрямку мети ---------- */
let hint=null;const cs=document.getElementById('cmps');let qEls=[];
NPC.hint=(x,z,w)=>{hint=x==null?null:{x,z,w};for(const e of qEls)e.remove();qEls=[];if(!hint||!cs)return;
 for(let k=0;k<3;k++){const e=document.createElement('span');e.className='cq';e.textContent='◆ '+(w||'');cs.appendChild(e);qEls.push(e)}};
const angG=()=>{try{return eval('ang')}catch(_){return 0}};
/* ---------- кадр ---------- */
const tick=()=>{const dt=.016;
 if(typing){shown+=1.6;$x.textContent=full.slice(0,shown|0);if(shown>=full.length)done()}
 for(const n of L){n.t+=dt;const d=Math.hypot(n.x-P_.x,n.z-P_.z);
  /* дихання */const m=n.model;m.scale.y=1+Math.sin(n.t*2.2)*.012;
  /* повертається до героя, коли той поруч; інакше — до початкового напрямку */
  const want=d<6?Math.atan2(P_.x-n.x,P_.z-n.z):n.face0;let df=want-n.g.rotation.y;df=Math.atan2(Math.sin(df),Math.cos(df));n.g.rotation.y+=df*.06;
  /* махає рукою, коли говорить */if(n.talkT>0)n.talkT-=dt;if(m.userData.wave)m.userData.wave(n.talkT>0?n.t:null);if(m.userData.idle)m.userData.idle(n.t);
  n.mk.position.y=n.ht+.55+Math.sin(n.t*3)*.07;
  const o=n.nm.material;o.opacity+=((d<9?1:0)-o.opacity)*.08;
  if(cur===n&&d>5)NPC.close()}
 /* кнопка «Дія» */
 if(hb){const n=NPC.near(),k=n?n.id:null;if(k!==was){was=k;if(n){if(hit0==null)hit0=hb.innerHTML;hb.innerHTML='💬<small>Говорити</small>'}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}}}
 /* компас */
 if(hint&&qEls.length){const a=Math.atan2(-(hint.x-P_.x),-(hint.z-P_.z));const Hd=((-a*57.2958)%360+360)%360;qEls.forEach((e,i)=>{e.style.left=((Hd-360+i*360)+360)*2+'px'});
  const near_=Math.hypot(hint.x-P_.x,hint.z-P_.z)<5;qEls.forEach(e=>{e.style.opacity=near_?.35:1})}
 void angG};
if(ANI_)ANI_.push(tick);else setInterval(tick,16);
/* NPC тверді: герой їх обходить */
const b0=window.BLDC;
window.BLDC=function(ox,oz){if(b0)b0.apply(this,arguments);for(const n of L){const dx=P_.x-n.x,dz=P_.z-n.z,d=Math.hypot(dx,dz),r=n.r+.35;if(d<r&&d>1e-4){P_.x=n.x+dx/d*r;P_.z=n.z+dz/d*r}}};
}catch(e){console.warn('npc:',e)}})();
