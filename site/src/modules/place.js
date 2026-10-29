/* 0.1.27: передперегляд під час встановлення. Коли ставите Попал-центр, скриню чи будівлю бази, перед героєм з’являється
   (у напрямку камери) напівпрозорий «привид» об’єкта: зелений — можна ставити, червоний — ні (і пояснення чому). Кнопки: ✅ Поставити, ↻ Повернути, ✖ Скасувати
   (на ПК — Enter, R, Esc). Межу бази (30 м від центру) видно на землі як світле кільце — під час встановлення і в режимі «Будова». */
(function(){try{
const BASE=30;
/* ---------- кільце межі бази: стрічка, що лягає на рельєф ---------- */
function ringGeo(cx,cz,R){const N=180,pos=[],idx=[];for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
  for(const r of[R-.22,R+.22]){const x=cx+c*r,z=cz+s*r;let h=0;try{h=H(x,z)}catch(_){}pos.push(x,Math.max(-.45,h)+.14,z)}
  if(i<N){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2)}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);return g}
const RM=new THREE.MeshBasicMaterial({color:0x7fe3f5,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide,fog:false,toneMapped:false});
let ring=null,rk='';
function showRing(cx,cz,col){const k=cx.toFixed(1)+','+cz.toFixed(1);if(!ring){ring=new THREE.Mesh(new THREE.BufferGeometry(),RM);ring.renderOrder=3;ring.frustumCulled=false;sc.add(ring)}
 if(k!==rk){rk=k;ring.geometry.dispose();ring.geometry=ringGeo(cx,cz,BASE)}ring.visible=true;RM.color.setHex(col||0x7fe3f5)}
const hideRing=()=>{if(ring)ring.visible=false};
window.plRing=showRing;window.plRingHide=hideRing;

/* ---------- привид ---------- */
const GOK=new THREE.MeshStandardMaterial({color:0x5fe08a,emissive:0x2a8a4a,emissiveIntensity:.6,transparent:true,opacity:.55,depthWrite:false}),
      GNO=new THREE.MeshStandardMaterial({color:0xff5a5a,emissive:0x9a2020,emissiveIntensity:.6,transparent:true,opacity:.55,depthWrite:false});
function ghostify(g){const ms=[];g.traverse(o=>{if(o.isMesh){o.material=GOK;o.castShadow=o.receiveShadow=false;ms.push(o)}else if(o.isSprite)o.visible=false;else if(o.isLight)o.intensity=0});return ms}

/* ---------- панель ---------- */
const css=document.createElement('style');css.id='place-css';css.textContent=`
#plc{display:none;position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 14px);z-index:30;background:rgba(14,20,42,.92);border:2px solid #e2bf67;border-radius:16px;padding:8px 12px;color:#fff;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.5);min-width:280px}
#plc b{display:block;color:#ffe7a8;font-size:15px}#plc small{display:block;min-height:16px;font-size:12px;margin:2px 0 6px}#plc small.no{color:#ff8a8a}#plc small.ok{color:#8af0a8}
#plc .r{display:flex;gap:8px;justify-content:center}#plc button{border:2px solid #e2bf67;color:#fff;border-radius:12px;padding:6px 14px;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;background:linear-gradient(#5a6a8a,#3a4560)}
#plc button.y{background:linear-gradient(#5fb04a,#2f8a3a)}#plc button.y:disabled{opacity:.45;filter:grayscale(.8)}
body.pmode #btns,body.pmode #bld{display:none!important}`;document.head.appendChild(css);
const ui=document.createElement('div');ui.id='plc';ui.innerHTML="<b></b><small></small><div class='r'><button class='y' data-a='ok'>✅ Поставити</button><button data-a='rot'>↻</button><button data-a='no'>✖</button></div>";document.body.appendChild(ui);
let PM=null;
function stop(){if(!PM)return;sc.remove(PM.g);PM=null;ui.style.display='none';document.body.classList.remove('pmode');hideRing()}
function confirm(){if(!PM)return;const{x,z,why,opt}=PM,ry=PM.g.rotation.y;if(why){msg('⛔ '+why);return}stop();opt.onOk(x,z,ry)}
ui.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b||!PM)return;const a=b.dataset.a;if(a=='ok')confirm();else if(a=='rot')PM.ry+=Math.PI/2;else stop()});
addEventListener('keydown',e=>{if(!PM)return;if(e.key=='Enter'){e.preventDefault();confirm()}else if(e.key=='r'||e.key=='R'||e.key=='к'||e.key=='К'){PM.ry+=Math.PI/2}else if(e.key=='Escape')stop()});
/* спільна перевірка: суша, межі бази, інші будівлі */
function check(opt,x,z){let h=0;try{h=H(x,z)}catch(_){}if(h<-.3)return 'Тут вода';
 const C=inv._cen;if(!opt.center){if(!C)return 'Спершу поставте Попал-центр';if(Math.hypot(x-C[0],z-C[1])>BASE-opt.r*.5)return 'За межами бази (30 м від Попал-центру)'}
 for(const c of(window.colList?colList():[])){if(Math.hypot(x-c.x,z-c.z)<c.r+opt.r+.15)return 'Заважає інша будівля'}
 if(Math.hypot(x-P.x,z-P.z)<opt.r+.3)return 'Відійдіть трохи — об’єкт стоїть на вас';
 return opt.valid?opt.valid(x,z)||'':''}
/* opt: {name, mk()→Group, r — радіус, dist — відстань перед героєм, center — це Попал-центр, valid(x,z)→'' або причина, onOk(x,z,ry)} */
window.plPlace=function(opt){stop();try{if(typeof ivO!=='undefined'&&ivO){const x=$('ivx');if(x)x.click()}}catch(_){}
 const g=opt.mk(),ms=ghostify(g);sc.add(g);PM={opt,g,ms,ry:0,x:P.x,z:P.z,why:''};
 ui.querySelector('b').textContent=opt.name;ui.style.display='block';document.body.classList.add('pmode')};
window.plPlacing=()=>!!PM;
/* привид стоїть перед героєм у напрямку погляду камери (його завжди видно на екрані) і повернутий лицем до гравця */
ANI.push(t=>{if(PM){const o=PM.opt,A=typeof ang=='number'?ang:0,d=Math.max(o.dist||0,o.r+2.2,4),x=P.x-Math.sin(A)*d,z=P.z-Math.cos(A)*d;PM.x=+x.toFixed(2);PM.z=+z.toFixed(2);
  PM.g.position.set(x,Math.max(-.3,H(x,z)),z);PM.g.rotation.y=A+PM.ry;const why=check(o,x,z);
  if(why!==PM.why||!PM.init){PM.init=1;PM.why=why;PM.ms.forEach(m=>m.material=why?GNO:GOK);const s=ui.querySelector('small');s.textContent=why||'Можна ставити тут';s.className=why?'no':'ok';ui.querySelector('[data-a=ok]').disabled=!!why}
  RM.opacity=.55+.3*Math.sin(t*4);
  if(o.center)showRing(x,z,why?0xff7a7a:0x7fe3f5);else if(inv._cen)showRing(inv._cen[0],inv._cen[1],0x7fe3f5);else hideRing();return}
 if(inv._cen&&document.body.classList.contains('bmode')){RM.opacity=.55+.3*Math.sin(t*4);showRing(inv._cen[0],inv._cen[1],0x7fe3f5)}else hideRing()});
}catch(e){console.warn('place',e)}})();
