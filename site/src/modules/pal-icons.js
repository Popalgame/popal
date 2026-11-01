/* 0.2.7: значки попалів замість смайликів (🐑🐼🦌…). Під час завантаження кожен попал один раз «фотографується»
   з його справжньої 3D-моделі (pal-models.js) окремим маленьким рендерером — портрет у ¾, прозоре тло.
   Знімки підміняють EM[] (загін, Попалпедія, слот «Попал» у спорядженні) і drawCrit() (віджет вибору попала в HUD).
   Поки знімків немає (або WebGL недоступний) — лишаються старі смайлики. */
(function(){try{
if(!window.PALMODEL||typeof THREE=='undefined')return;
const SZ=160,IMG=[];window.PALIMG=IMG;
const css=document.createElement('style');css.textContent=`img.palic{width:1.25em;height:1.25em;object-fit:contain;vertical-align:middle;filter:drop-shadow(0 1px 1px rgba(0,0,0,.45))}
.i2p .card .em img.palic{width:48px;height:48px;margin:-6px 0 -6px -4px}`;document.head.appendChild(css);
function shoot(){let rr=null;try{
 const cv=document.createElement('canvas');cv.width=cv.height=SZ;
 rr=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:true,preserveDrawingBuffer:true});rr.setPixelRatio(1);rr.setSize(SZ,SZ,false);rr.setClearColor(0,0);
 if('outputEncoding' in rr)rr.outputEncoding=THREE.sRGBEncoding;
 const s=new THREE.Scene();s.add(new THREE.HemisphereLight(0xffffff,0x6a7a90,1.15));const k=new THREE.DirectionalLight(0xffffff,1.1);k.position.set(2,4,5);s.add(k);
 const cam=new THREE.PerspectiveCamera(28,1,.05,100),bx=new THREE.Box3(),c=new THREE.Vector3(),z=new THREE.Vector3();
 for(let i=0;i<PALMODEL.PALS.length;i++){let r=null;try{
  r=PALMODEL.build(i);const g=r.root;g.rotation.y=-.5;/* ¾ — трохи боком, лицем до камери */s.add(g);g.updateMatrixWorld(true);
  bx.setFromObject(g);bx.getCenter(c);bx.getSize(z);const h=Math.max(z.x,z.y,z.z)*.55/Math.tan(cam.fov*Math.PI/360);
  cam.position.set(c.x,c.y+h*.32,c.z+h);cam.lookAt(c.x,c.y,c.z);rr.render(s,cam);
  const im=new Image();im.src=cv.toDataURL('image/png');IMG[i]=im;s.remove(g);
 }catch(e){console.warn('pal-icons',i,e)}finally{try{if(r)PALMODEL.dispose(r)}catch(_){}}}
}catch(e){console.warn('pal-icons',e)}finally{try{if(rr){rr.dispose();rr.forceContextLoss()}}catch(_){}}}
function apply(){
 if(typeof EM!='undefined')IMG.forEach((im,i)=>{if(im)EM[i]=`<img class='palic' src='${im.src}' alt=''>`});
 const d0=window.drawCrit;if(typeof d0=='function'&&!d0._pi){
  const d=function(cv,col){const im=col==null?null:IMG[T.findIndex(t=>t.c===col)];if(!im||!im.complete||!im.naturalWidth)return d0(cv,col);
   const x=cv.getContext('2d'),W=cv.width;x.clearRect(0,0,W,W);x.fillStyle='#'+col.toString(16).padStart(6,'0');x.globalAlpha=.35;x.beginPath();x.arc(W/2,W/2,W/2,0,7);x.fill();x.globalAlpha=1;x.drawImage(im,W*.04,W*.04,W*.92,W*.92)};
  d._pi=1;window.drawCrit=d}
 try{if(typeof pwUp=='function')pwUp()}catch(_){}try{if(typeof ivO!='undefined'&&ivO&&typeof ivR=='function')ivR()}catch(_){}}
const go=()=>{shoot();if(!IMG.length)return;Promise.all(IMG.map(im=>im&&im.decode?im.decode().catch(()=>{}):0)).then(apply)};
/* після старту сцени, щоб не гальмувати перший кадр */
if(document.readyState=='complete')setTimeout(go,600);else addEventListener('load',()=>setTimeout(go,600));
}catch(e){console.warn('pal-icons',e)}})();
