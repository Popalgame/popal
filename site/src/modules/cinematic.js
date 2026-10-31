/* Кінематографічна сцена пробудження на Острові пробудження (лише для нового гравця, один раз; inv._cin=1 після показу).
   1) Темрява, шум прибою. Очі повільно розплющуються (повіки зверху й знизу, розмиття).
   2) Вид від першої особи з піску вгору: над героєм схиляються Пухоклуб (принюхується впритул), Бамбузл і Крилоша (пурхає в небі) — з їхніми голосами.
   3) Над головою з'являється Дід Вітрило: «Ого! Живий!» — попали розбігаються, очі заплющуються.
   4) Вид збоку: кінематографічні смуги, камера спускається з висоти до пляжу, герой лежить біля уламків човна й підводиться.
   5) Камера повертається до гри, Вітрило кличе до вогнища й іде туди сам.
   Кнопка «Пропустити» одразу переходить до кінця. Для перевірки: ?cine=1 у посиланні або ISLE.cine(). */
(function(){try{
const I=window.ISLE,N=window.NPC;if(window.REALM!=='isle'||!I||!N||typeof THREE=='undefined')return;
const G=n=>{try{return eval(n)}catch(_){return undefined}};
const sc_=G('sc'),P_=G('P'),cam_=G('cam'),pl_=G('pl'),ANI_=G('ANI'),INV=G('inv')||{},H_=window.H;if(!sc_||!P_||!cam_||!pl_||!ANI_)return;
let force=false;try{force=new URLSearchParams(location.search).get('cine')=='1'}catch(_){}
let fresh=false;try{fresh=!eval('hasSave')}catch(_){}
if(!force&&(INV._cin||INV._isg||!fresh)){INV._cin=1;return}

/* ---------- накладка: повіки, смуги, субтитри, «Пропустити» ---------- */
const st=document.createElement('style');st.textContent=`
body.cine :is(#pc,#mbt,#bag,#mmap,.inmap,#cmp,#pw2,#eqp,#eqm,#btns,#bld,#joy,#hud,#guide,#msg,#pqt,#pdm,#emb,#hit,#npcd,#hpb){visibility:hidden!important;pointer-events:none!important}
#cine{position:fixed;inset:0;z-index:9000;pointer-events:none;overflow:hidden}
#cine .eye{position:absolute;left:50%;top:50%;width:150vw;height:0;transform:translate(-50%,-50%);border-radius:50%;box-shadow:0 0 6vh 3vh #000,0 0 0 200vmax #000}
#cine .bar{position:absolute;left:0;right:0;height:0;background:#000;transition:height .8s ease}#cine .b1{top:0}#cine .b2{bottom:0}
#cine .sub{position:absolute;left:50%;bottom:13%;transform:translateX(-50%);max-width:86vw;padding:6px 14px;border-radius:10px;background:rgba(0,0,0,.45);color:#fff;font:600 17px/1.4 system-ui,sans-serif;text-align:center;opacity:0;transition:opacity .35s;text-shadow:0 1px 3px #000}
#cine .sub b{color:#ffd98a}
#cine .skip{position:absolute;right:calc(env(safe-area-inset-right,0px) + 14px);top:calc(env(safe-area-inset-top,0px) + 12px);pointer-events:auto;padding:7px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.35);color:#fff;font:700 13px system-ui,sans-serif;opacity:.8}`;
document.head.appendChild(st);
const O=document.createElement('div');O.id='cine';O.innerHTML=`<div class='bar b1'></div><div class='bar b2'></div><div class='eye'></div><div class='sub'></div><button class='skip'>Пропустити ▸▸</button>`;
const eye=O.querySelector('.eye'),b1=O.querySelector('.b1'),b2=O.querySelector('.b2'),sub=O.querySelector('.sub'),skip=O.querySelector('.skip');
/* око: еліптична щілина, що розкривається (o=0 — заплющене, 1 — розплющене) */
const lids=o=>{eye.style.height=(o*o*170)+'vh';eye.style.display=o>=.999?'none':'block'};
const say=t=>{if(!t){sub.style.opacity=0;return}sub.innerHTML=t;sub.style.opacity=1};
const voice=(ty,k)=>{try{if(window.PSFX)PSFX.voice(ty,k,.8)}catch(_){}};

/* ---------- попали над героєм ---------- */
const mk=(i,s)=>{try{if(!window.PALMODEL)return null;const r=PALMODEL.build(i);r.root.scale.multiplyScalar(s);r.root.traverse(o=>{if(o.isMesh)o.frustumCulled=false});sc_.add(r.root);return r}catch(_){return null}};
const ease=x=>x<0?0:x>1?1:x*x*(3-2*x),lerp=(a,b,k)=>a+(b-a)*k,seg=(t,a,b)=>ease((t-a)/(b-a));
/* сцена: герой лежить на пляжі головою до моря (+z), ногами до острова */
const HX=I.START[0],HZ=I.START[1];
const HEAD=new THREE.Vector3(HX,H_(HX,HZ+1.45)+.32,HZ+1.45);
const v=new THREE.Vector3(),look=new THREE.Vector3();
let t0=0,on=false,pals=[],stage=0,done_=false,vit=null,vitHome=null;
function begin(){on=true;t0=performance.now();document.body.classList.add('cine');document.body.appendChild(O);lids(0);
 P_.x=HX;P_.z=HZ;P_.face=Math.PI;pl_.rotation.order='YXZ';
 pals=[{r:mk(4,.72),ty:4,a:[-1.5,1.7,-1.2],b:[-.75,1.45,-.95],c:[-.3,1.0,-.55]},{r:mk(0,.68),ty:0,a:[1.6,1.8,-1.4],b:[.95,1.6,-1.15]},{r:mk(5,.6),ty:5,a:[.6,3.4,-2.6],b:[.1,3.0,-2.2]}].filter(p=>p.r);
 vit=N.get('vit');if(vit){vitHome=[vit.x,vit.z,vit.face0];vit.busy=1;vit.g.visible=false}
 skip.onclick=()=>{finish()}}
function setPal(p,t){const k1=seg(t,2.5,4.2),k2=p.c?seg(t,5,6.1)*(1-seg(t,6.4,6.9)):0,flee=seg(t,6.5,7.6);
 const a=p.a,b=p.b,c=p.c||p.b;let x=lerp(lerp(a[0],b[0],k1),c[0],k2),y=lerp(lerp(a[1],b[1],k1),c[1],k2),z=lerp(lerp(a[2],b[2],k1),c[2],k2);
 const tt=t*1.0;y+=Math.sin(tt*3+x)*.03;if(p.ty==5){x+=Math.sin(tt*2.2)*.25;y+=Math.sin(tt*5)*.12}
 x+=Math.sign(x||1)*flee*3.5;y+=flee*(p.ty==5?3:.6);z-=flee*1.5;
 p.r.root.position.set(HEAD.x+x,HEAD.y+y,HEAD.z+z);p.r.root.lookAt(cam_.position);p.r.root.rotateZ(Math.sin(tt*1.7+x)*.15);/* хилить голову набік */
 if(p.r.mixer)p.r.mixer.update(.016)}
let fz=null;/* для запису відео: заморожений час сцени */
function tick(){if(!on)return;const t=fz!=null?fz:(performance.now()-t0)/1000;
 P_.x=HX;P_.z=HZ;P_.face=Math.PI;
 if(t<8.1){/* ---- від першої особи ---- */
  pl_.visible=false;
  let o=0;if(t<1.4)o=0;else if(t<2.2)o=.35*seg(t,1.4,2.2);else if(t<2.5)o=.35*(1-seg(t,2.2,2.5));else if(t<3.3)o=.72*seg(t,2.5,3.3);else if(t<4.6)o=.72;
  else if(t<4.75)o=.72*(1-seg(t,4.6,4.75));else if(t<5.1)o=seg(t,4.75,5.1);else if(t<7.5)o=1;else o=1-seg(t,7.5,8.05);lids(o);
  const bl=t<4.8?Math.max(0,7-t*1.4):0;R_.domElement.style.filter=bl>.2?'blur('+bl.toFixed(1)+'px)':'';
  const sh=t>5.3&&t<6.1?.012:0;/* Пухоклуб тицяється носом — камера здригається */
  cam_.up.set(0,0,-1);cam_.position.set(HEAD.x+(Math.random()-.5)*sh,HEAD.y+(Math.random()-.5)*sh,HEAD.z);look.set(HEAD.x+Math.sin(t*.5)*.3,HEAD.y+6,HEAD.z-2.4);{const k=seg(t,6.0,6.8);look.z+=k*4.2;look.y-=k*2.4}/* погляд — на обличчя Вітрила */cam_.lookAt(look);
  for(const p of pals)setPal(p,t);
  if(vit){const k=seg(t,6.0,6.7);vit.g.visible=t>5.9;vit.nm.visible=vit.mk.visible=false;/* стоїть за головою героя (з боку моря) і нахиляється над обличчям */
   vit.g.position.set(HX,H_(HX,HEAD.z+1.1),HEAD.z+1.2+(1-k)*.7);vit.g.rotation.set(.45*k,Math.PI,0,'YXZ');}
  if(stage<1&&t>.4){stage=1;say('<i>…шшш… шшш… шум прибою…</i>')}
  if(stage<2&&t>2.0){stage=2;say('');voice(4,'idle')}
  if(stage<3&&t>3.5){stage=3;voice(0,'idle')}
  if(stage<4&&t>4.1){stage=4;voice(5,'happy')}
  if(stage<5&&t>5.25){stage=5;voice(4,'happy');say('<b>Пухоклуб:</b> Пух? Пух-пух!')}
  if(stage<6&&t>6.2){stage=6;say('<b>Дід Вітрило:</b> Ого! Живий!');voice(4,'hurt')}
 }else if(t<12){/* ---- вид збоку: камера спускається, герой підводиться ---- */
  if(stage<7){stage=7;lids(1);R_.domElement.style.filter='';cam_.up.set(0,1,0);for(const p of pals)sc_.remove(p.r.root);pals=[];b1.style.height=b2.style.height='11%';say('');
   if(vit){vit.g.rotation.set(0,0,0);N.place('vit',HX-1.6,HZ-1.4,2.3);vit.g.visible=true;vit.nm.visible=true;vit.mk.visible=!!vit.mark}}
  pl_.visible=true;const k=seg(t,8.1,10.6),up=seg(t,10.4,11.6);
  pl_.rotation.x=-Math.PI/2*(1-up);pl_.position.y=H_(HX,HZ)+.12*(1-up)+Math.sin(up*Math.PI)*.15;
  v.set(lerp(HX+9,HX+3.2,k),lerp(H_(HX,HZ)+10,H_(HX,HZ)+2.4,k),lerp(HZ+7,HZ+3.8,k));cam_.position.copy(v);look.set(HX,H_(HX,HZ)+.5+up*.6,HZ+.3);cam_.lookAt(look);
  if(stage<8&&t>10.2){stage=8;say('<b>Дід Вітрило:</b> Вставай, мандрівнику. Ходімо до вогнища — там тепло й є що розповісти.')}
 }else finish()}
function finish(){if(done_)return;done_=true;on=false;
 pl_.rotation.x=0;pl_.rotation.order='XYZ';pl_.visible=true;cam_.up.set(0,1,0);R_.domElement.style.filter='';for(const p of pals)sc_.remove(p.r.root);pals=[];
 lids(1);b1.style.height=b2.style.height='0';say('');setTimeout(()=>{O.remove();document.body.classList.remove('cine')},850);
 try{eval('ang=Math.PI')}catch(_){}
 INV._cin=1;try{save()}catch(_){}
 if(vit&&vitHome){vit.g.rotation.set(0,vit.g.rotation.y,0);vit.nm.visible=true;vit.mk.visible=!!vit.mark;if(!vit.g.visible||Math.hypot(vit.x-HX,vit.z-HZ)>6)N.place('vit',HX-1.6,HZ-1.4,2.3);vit.g.visible=true;
  N.walkTo('vit',vitHome[0],vitHome[1],()=>{vit.face0=vitHome[2]},1.2)}}
const R_=G('R');
/* старт: коли гравець створив героя й гра почалась */
let waitT=0;const A=()=>{if(on){tick();return}if(done_)return;waitT++;if(waitT%10)return;
 let ready=false;try{ready=!!eval('started')&&!eval('menuO')&&!eval('ccO')}catch(_){}if(ready)begin()};
ANI_.push(A);
I.cine=()=>{done_=false;stage=0;begin()};I.cineAt=t=>{fz=t};
}catch(e){console.warn('cinematic:',e)}})();
