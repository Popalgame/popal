/* 0.1.27: плавильня. Нова модель (кам’яна піч із куполом, цегляний димар, жерло з вогнем, міхи, купки руди й злитків),
   жар, світло й дим, коли піч працює. Руду плавить лише вогняний попал з бригади (Ігніс-Виверг, Сонцеклюв):
   сам бере зі скринь руду й деревину, несе в піч, плавить і відносить злитки назад у скриню.
   Рецепт: 2 руди + 1 паливо → 1 залізний злиток (0.1.28: деревина = 1 паливо, вугілля = 3). Час на злиток: 30 с / (1 + 0,5 × (навичка вогню − 1)),
   тобто 30 с на 1-му рівні, 20 с на 2-му, 15 с на 3-му; нагодовані попали — на чверть швидше.
   Гравець сам злитки більше не крафтить, але може покласти руду/деревину в піч і забрати злитки. */
(function(){try{
if(!inv._fur||typeof inv._fur!='object')inv._fur={ore:0,w:0,ing:0,p:0};
const F=inv._fur;for(const k of['ore','fuel','ing','p','ord'])F[k]=+F[k]||0;
/* 0.1.28: паливо в одиницях: деревина = 1, вугілля = 3 (стара деревина в печі переходить у паливо) */if(F.w){F.fuel+=+F.w||0;delete F.w}
/* гравець більше не плавить сам */
{const i=RC.findIndex(r=>r.id=='ing');if(i>=0)RC.splice(i,1)}

/* ---------- модель ---------- */
const M=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.9,flatShading:true},o||{}));
const STN=M(0x8c867c),STD=M(0x5e5a54),BRK=M(0x9a4a32),MOR=M(0x6e5a4e),IRN=M(0x3a3a42,{roughness:.5,metalness:.4}),
      WOOD=M(0x8a5a32),LTH=M(0x6b3f22),ORE=M(0x6a4a3a),ING=M(0xc8ccd6,{roughness:.3,metalness:.5,flatShading:false});
window.mkFurnace=function(){const g=new THREE.Group(),m=(geo,mat,x,y,z,ry)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);if(ry)o.rotation.y=ry;o.castShadow=o.receiveShadow=true;g.add(o);return o};
 m(new THREE.BoxGeometry(2.3,.22,2.0),STD,0,.11,0);
 m(new THREE.CylinderGeometry(.92,1.02,1.05,10),STN,0,.74,0);
 for(let i=0;i<10;i++){const a=i/10*Math.PI*2+.3;m(new THREE.BoxGeometry(.34,.2,.14),STD,Math.cos(a)*1.0,.38+(i%2)*.36,Math.sin(a)*1.0,-a+Math.PI/2)}
 const dome=m(new THREE.SphereGeometry(.92,10,6,0,Math.PI*2,0,Math.PI/2),STN,0,1.26,0);dome.scale.y=.8;
 /* жерло: темна ніша, жар усередині, залізна рамка */
 m(new THREE.BoxGeometry(.66,.56,.3),M(0x140c0a),0,.72,.86);
 const glowM=new THREE.MeshStandardMaterial({color:0xff7a2a,emissive:0xff5a10,emissiveIntensity:.35,roughness:1});
 m(new THREE.PlaneGeometry(.56,.46),glowM,0,.72,1.0);
 for(const[x,y,w,h]of[[0,1.03,.78,.08],[0,.42,.78,.08],[-.36,.72,.08,.6],[.36,.72,.08,.6]])m(new THREE.BoxGeometry(w,h,.06),IRN,x,y,1.03);
 const FIRE=new THREE.MeshStandardMaterial({color:0xffa040,emissive:0xff6a10,emissiveIntensity:1.8,transparent:true,opacity:.9}),fires=[];
 for(const[x,s]of[[-.13,.8],[.12,.65],[0,1]]){const f=m(new THREE.ConeGeometry(.09*s,.32*s,6),FIRE,x,.6+.16*s,.94);f.castShadow=false;fires.push(f)}
 /* цегляний димар позаду */
 m(new THREE.BoxGeometry(.5,1.6,.5),BRK,0,1.8,-.5);for(let y=1.15;y<2.6;y+=.3)m(new THREE.BoxGeometry(.52,.035,.52),MOR,0,y,-.5);m(new THREE.BoxGeometry(.62,.12,.62),STD,0,2.66,-.5);
 /* міхи ліворуч, дрова, руда й злитки праворуч */
 const bel=m(new THREE.BoxGeometry(.5,.14,.32),LTH,-1.0,.36,.45,.5);m(new THREE.ConeGeometry(.06,.36,6),IRN,-.82,.36,.66).rotation.set(Math.PI/2,0,.5);
 for(let i=0;i<4;i++)m(new THREE.CylinderGeometry(.08,.08,.7,7),WOOD,-.85+(i%2)*.17,.3+Math.floor(i/2)*.16,-.55).rotation.z=Math.PI/2;
 for(let i=0;i<5;i++)m(new THREE.DodecahedronGeometry(.11,0),ORE,.85+Math.cos(i*1.7)*.15,.3+(i==4?.12:0),.45+Math.sin(i*1.7)*.15);
 const ings=[];for(let i=0;i<4;i++)ings.push(m(new THREE.BoxGeometry(.24,.08,.12),ING,.9,.27+Math.floor(i/2)*.09,-.4+(i%2)*.14));
 const lt=new THREE.PointLight(0xff8a3a,0,7);lt.position.set(0,.9,1.3);g.add(lt);
 g.userData.fur={glowM,fires,lt,ings,top:new THREE.Vector3(0,2.75,-.5)};return g};

/* ---------- стан, API для попалів ---------- */
const furB=()=>(window.BPLACED||[]).find(b=>b.id=='B_fur');
const isFire=p=>((T[p.ty]&&T[p.ty].e)||[]).includes('fi');
const fireLv=p=>(((T[p.ty]||{}).wk||{}).cook)||1;
const tIngot=p=>30/(1+.5*(fireLv(p)-1))*(cf>0?.75:1);
/* 0.1.28: замовлення — скільки злитків виплавити (F.ord); попал плавить і підносить руду лише під замовлення */
const canMake=()=>{const cc=k=>window.chCount?chCount(k):0,ore=F.ore+cc('ore'),fuel=F.fuel+cc('w')+3*cc('coal');return Math.floor(Math.min(ore/2,fuel))};
const done=()=>{if(F.ord>0&&--F.ord==0)msg('🔩 Замовлення плавильні виконано!')};
window.FUR={get:()=>F,done,canMake,pos:()=>{const b=furB();return b?[b.x,b.z]:null},fire:isFire,time:tIngot};
/* перемалювати вже поставлену плавильню новою моделлю */
if(furB()&&window.respawnB)respawnB();

/* ---------- жар, світло, дим ---------- */
const sc2=document.createElement('canvas');sc2.width=sc2.height=64;{const x=sc2.getContext('2d'),gr=x.createRadialGradient(32,32,2,32,32,30);gr.addColorStop(0,'rgba(200,200,205,.9)');gr.addColorStop(1,'rgba(200,200,205,0)');x.fillStyle=gr;x.fillRect(0,0,64,64)}
const SMK=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(sc2),transparent:true,depthWrite:false,opacity:.5});
const puffs=[];let pT=0;
ANI.push(t=>{const b=furB();const act=Date.now()-(F.act||0)<1500;
 for(let i=puffs.length-1;i>=0;i--){const s=puffs[i];s.userData.t+=.016;const k=s.userData.t/3;s.position.y+=.012;s.position.x+=Math.sin(t+i)*.003;s.scale.setScalar(.4+k*1.6);s.material.opacity=.45*(1-k);if(k>=1){sc.remove(s);s.material.dispose();puffs.splice(i,1)}}
 if(!b||!b.g.userData.fur)return;const u=b.g.userData.fur,fl=Math.sin(t*13)*.25+Math.sin(t*7.3)*.2;
 u.glowM.emissiveIntensity=act?2.4+fl:.35+.1*Math.sin(t*2);u.lt.intensity=act?1.8+fl:0;u.fires.forEach((f,i)=>{f.visible=act;f.scale.set(1,1+Math.sin(t*14+i*2)*.25,1)});
 u.ings.forEach((m,i)=>m.visible=i<Math.min(4,F.ing));
 if(act&&(pT+=.016)>.35){pT=0;const s=new THREE.Sprite(SMK.clone());const p=u.top.clone().applyMatrix4(b.g.matrixWorld);s.position.copy(p);s.userData.t=0;s.scale.setScalar(.4);sc.add(s);puffs.push(s)}});

/* ---------- вікно плавильні ---------- */
const css=document.createElement('style');css.id='fur-css';css.textContent=`
#fur{display:none;position:fixed;left:calc(env(safe-area-inset-left,0px) + 12%);right:calc(env(safe-area-inset-right,0px) + 12%);top:calc(env(safe-area-inset-top,0px) + 8%);z-index:36;flex-direction:column;background:rgba(14,20,42,.96);border:2px solid #e2bf67;border-radius:16px;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.5);overflow:hidden}
#fur header{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(226,191,103,.4)}#fur header b{flex:1;font-size:18px;color:#ffe7a8}
#fur .cx{background:none;border:none;color:#e2bf67;font-size:24px;cursor:pointer}
#fur .fl{display:flex;align-items:center;justify-content:center;gap:10px;padding:12px}
#fur .bx{background:rgba(255,255,255,.06);border:1px solid rgba(226,191,103,.4);border-radius:12px;padding:8px 12px;text-align:center;min-width:86px}
#fur .bx i{font-style:normal;font-size:26px;display:block}#fur .bx b{font-size:18px;color:#ffe7a8}#fur .bx small{display:block;opacity:.75;font-size:11px}
#fur .ar{font-size:22px;opacity:.8;text-align:center}#fur .pb{width:120px;height:10px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:4px}#fur .pb i{display:block;height:100%;background:linear-gradient(90deg,#ff9a3a,#ffd34e)}
#fur .st{padding:0 14px;font-size:13px;text-align:center}#fur .st.no{color:#ff9a8a}
#fur .bt{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:10px 12px}
#fur .bt button{background:linear-gradient(#f39a4a,#d9532e);border:2px solid #e2bf67;color:#fff;border-radius:10px;padding:4px 10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px}#fur .bt button.g{background:linear-gradient(#5fb04a,#2f8a3a)}#fur .bt button:disabled{opacity:.4;filter:grayscale(1)}
#fur .od{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;padding:0 12px 8px}#fur .od span{font-size:14px;margin-right:4px}#fur .od b{color:#ffe7a8;font-size:17px}
#fur .od button{background:rgba(255,255,255,.1);border:1px solid #e2bf67;color:#fff;border-radius:8px;padding:3px 9px;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px}#fur .od button:disabled{opacity:.35}
#fur .em{opacity:.65;font-size:12px;padding:0 14px 10px;text-align:center}`;document.head.appendChild(css);
const box=document.createElement('div');box.id='fur';document.body.appendChild(box);
const smelter=()=>pals.find(p=>p.wk&&p.cs!=null&&p.ai&&p.ai.s=='fsmelt');
const fireCrew=()=>pals.filter(p=>p.wk&&p.cs!=null&&isFire(p));
function render(){const s=smelter(),fc=fireCrew(),t=s?tIngot(s):fc.length?tIngot(fc[0]):30,pc=Math.min(100,F.p/t*100);
 const can=F.ore>=2&&F.fuel>=1,mk=canMake();let st,no=0;
 if(s)st=`🔥 ${T[s.ty].n} плавить руду · злиток кожні ${Math.round(t)} с`;
 else if(!F.ord)st='📋 Задайте замовлення — скільки злитків виплавити, і вогняний попал візьметься до роботи';
 else if(!fc.length){st='⚠️ Плавить лише вогняний попал у бригаді: Ігніс-Виверг або Сонцеклюв';no=1}
 else if(!can)st=`${T[fc[0].ty].n} чекає: потрібні 2 руди й паливо (деревина або вугілля) — у печі чи у скрині`;
 else st=`${T[fc[0].ty].n} іде до печі…`;
 box.innerHTML=`<header><b>🔥 Плавильня</b><button class='cx'>✕</button></header>
 <div class='fl'><div class='bx'><i>${IT.ore[0]}</i><b>${F.ore}</b><small>руда</small></div><div class='bx'><i>🔥</i><b>${F.fuel}</b><small>паливо</small></div>
 <div class='ar'>➜<div class='pb'><i style='width:${pc}%'></i></div></div><div class='bx'><i>🔩</i><b>${F.ing}</b><small>злитки</small></div></div>
 <div class='od'><span>📋 Замовлення: <b>${F.ord}</b> 🔩</span><button data-o='-1' ${F.ord?'':'disabled'}>−1</button><button data-o='1'>+1</button><button data-o='5'>+5</button><button data-o='10'>+10</button><button data-o='max' ${mk>F.ord?'':'disabled'}>Усе можливе (${mk})</button><button data-o='0' ${F.ord?'':'disabled'}>✖</button></div>
 <div class='st ${no?'no':''}'>${st}</div>
 <div class='bt'><button data-a='ore2' ${cnt('ore')>=2?'':'disabled'}>${IT.ore[0]} Покласти 2 руди</button><button data-a='oreA' ${cnt('ore')>=1?'':'disabled'}>${IT.ore[0]} Усю руду (${cnt('ore')||0})</button>
 <button data-a='w1' ${cnt('w')>=1?'':'disabled'}>🪵 +1 деревина</button><button data-a='wA' ${cnt('w')>=1?'':'disabled'}>🪵 Усю (${cnt('w')||0})</button><button data-a='c1' ${cnt('coal')>=1?'':'disabled'}>${IT.coal?IT.coal[0]:'⚫'} +1 вугілля</button><button data-a='cA' ${cnt('coal')>=1?'':'disabled'}>${IT.coal?IT.coal[0]:'⚫'} Усе (${cnt('coal')||0})</button><button class='g' data-a='take' ${F.ing?'':'disabled'}>🔩 Забрати злитки</button></div>
 <div class='em'>2 руди + 1 паливо → 1 залізний злиток. Паливо: деревина = 1, вугілля = 3. Задайте замовлення — і вогняний попал з бригади виплавить саме стільки злитків: сам носить руду й паливо зі скринь (спершу вугілля), плавить і відносить злитки у скриню.</div>`;
 box.querySelector('.cx').onclick=close;
 box.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{const o=b.dataset.o;F.ord=o=='0'?0:o=='max'?canMake():Math.max(0,Math.min(999,F.ord+ +o));save();render()});
 box.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const a=b.dataset.a;
  if(a=='ore2'||a=='oreA'){const n=a=='ore2'?2:cnt('ore');addI('ore',-n);F.ore+=n}
  else if(a=='w1'||a=='wA'){const n=a=='w1'?1:cnt('w');addI('w',-n);F.fuel+=n}
  else if(a=='c1'||a=='cA'){const n=a=='c1'?1:cnt('coal');addI('coal',-n);F.fuel+=3*n}
  else if(a=='take'){addI('ing',F.ing);msg('🔩 Забрано злитків: '+F.ing);F.ing=0}
  hud();save();render()})}
let iv=0;function open(){ivO=1;box.style.display='flex';render();clearInterval(iv);iv=setInterval(render,600)}
function close(){box.style.display='none';ivO=0;clearInterval(iv);save()}
const near=()=>{const b=furB();return b&&Math.hypot(b.x-P.x,b.z-P.z)<2.5};
const hb=$('hit'),h0=hb.onclick;hb.onclick=function(){if(near()&&!nearest(wild,2.6)){open();return}return h0.apply(this,arguments)};
let was=null,hit0=null;ANI.push(()=>{const n=!!near();if(n===was)return;was=n;if(n){hit0=hb.innerHTML;hb.innerHTML=(window.plIcon?plIcon('B_fur'):'🔥')+'<small>Плавильня</small>'}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}});
addEventListener('keydown',e=>{if(e.key=='Escape'&&box.style.display=='flex')close()});
}catch(e){console.warn('furnace',e)}})();
