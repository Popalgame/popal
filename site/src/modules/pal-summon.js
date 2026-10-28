/* 0.1.13: призов і відкликання попала. Призваним може бути лише обраний попал (або жоден) — решта чекає у сфері.
   Призов: герой кидає сферу, вона розкривається спалахом, попал «виростає». Відкликання: промінь, попал зменшується, сфера повертається до героя.
   Дотик до портрета — призвати/відкликати (T на ПК), довге натискання — меню «Захищати». ◀ ▶ при призваному попалі міняють його з анімацією */
(function(){try{
const KEY='zi_out',CD=1000;let out=1;try{const v=localStorage.getItem(KEY);if(v!==null)out=v==='1'?1:0}catch(e){}
const sv=()=>{try{localStorage.setItem(KEY,out?'1':'0')}catch(e){}};
let anim=null,cdT=0;
window.palOn=()=>!!out&&!anim&&!!pals[selP];
window.palShown=()=>!!out||!!anim;
const $=id=>document.getElementById(id),snd=k=>{try{PSFX.sfx(k)}catch(_){}};
const s0=p=>{if(p._s0==null)p._s0=p.m.scale.x||1;return p._s0};
pals.forEach(s0);
/* --- ефекти: одна сфера, кільце, іскри й промінь, що перевикористовуються --- */
const BM=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0x7fe3f5,emissiveIntensity:1.4});
const ball=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),BM);ball.visible=false;sc.add(ball);
const RM=new THREE.MeshBasicMaterial({color:0x7fe3f5,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
const ring=new THREE.Mesh(new THREE.RingGeometry(.25,.36,40),RM);ring.rotation.x=-Math.PI/2;ring.visible=false;sc.add(ring);
const NS=28,sg=new THREE.BufferGeometry(),sp=new Float32Array(NS*3),sv3=[];for(let i=0;i<NS;i++){const a=i/NS*6.283,e=Math.random()*.9;sv3.push([Math.cos(a)*Math.cos(e),Math.sin(e)+.2,Math.sin(a)*Math.cos(e)])}
sg.setAttribute('position',new THREE.BufferAttribute(sp,3));const SM=new THREE.PointsMaterial({color:0xffffff,size:.16,transparent:true,opacity:0,depthWrite:false});
const sparks=new THREE.Points(sg,SM);sparks.frustumCulled=false;sparks.visible=false;sc.add(sparks);
const LM=new THREE.MeshBasicMaterial({color:0xbff6ff,transparent:true,opacity:0,depthWrite:false});
const beam=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1,8,1,true),LM);beam.visible=false;sc.add(beam);
const col=p=>new THREE.Color((T[p.ty]&&T[p.ty].c)||0x7fe3f5);
const gy=(x,z)=>Math.max(-1.3,H(x,z));
const hand=()=>new THREE.Vector3(P.x,gy(P.x,P.z)+1.2,P.z);
const easeBack=t=>{const c=1.9;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
function burst(at,c,k){/* k: 0..1 */ring.visible=sparks.visible=k<1;ring.position.set(at.x,at.y-.75,at.z);ring.scale.setScalar(1+k*7);RM.opacity=(1-k)*.9;RM.color.copy(c);
 SM.opacity=1-k;SM.color.copy(c).lerp(new THREE.Color(0xffffff),.5);const r=.2+k*1.6;for(let i=0;i<NS;i++){const v=sv3[i];sp[i*3]=at.x+v[0]*r;sp[i*3+1]=at.y-.4+v[1]*r-k*k*.8;sp[i*3+2]=at.z+v[2]*r}sg.attributes.position.needsUpdate=true}
function setBeam(a,b,o){beam.visible=o>0;LM.opacity=o;const m=a.clone().add(b).multiplyScalar(.5),d=b.clone().sub(a),L=d.length();beam.position.copy(m);beam.scale.set(1,L,1);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())}
/* --- призов --- */
function summon(done){const p=pals[selP];if(!p)return;s0(p);
 const f=P.face||0,tx=P.x+Math.sin(f)*2.2,tz=P.z+Math.cos(f)*2.2,to=new THREE.Vector3(tx,gy(tx,tz)+.8,tz),from=hand(),c=col(p);
 BM.emissive.copy(c);out=1;p.x=tx;p.z=tz;p.m.scale.setScalar(.001);
 try{if(window.heroAct)heroAct('throw')}catch(_){}snd('throw');
 anim={t:0,run(dt){this.t+=dt;const t=this.t;
  if(t<.35){const k=t/.35;ball.visible=true;ball.position.lerpVectors(from,to,k);ball.position.y+=Math.sin(k*Math.PI)*1.1;ball.scale.setScalar(1);return}
  if(!this.op){this.op=1;ball.visible=false;snd('open');p.x=tx;p.z=tz}
  const k=Math.min(1,(t-.35)/.4);burst(to,c,k);p.m.scale.setScalar(s0(p)*Math.max(.001,easeBack(Math.min(1,(t-.35)/.35))));
  if(k>=1){p.m.scale.setScalar(s0(p));ring.visible=sparks.visible=false;return 1}}};
 anim.done=()=>{sv();done&&done()}}
/* --- відкликання --- */
function recall(done){const p=pals[selP];if(!p){out=0;sv();done&&done();return}s0(p);const c=col(p);BM.emissive.copy(c);LM.color.copy(c).lerp(new THREE.Color(0xffffff),.6);snd('close');
 anim={t:0,run(dt){this.t+=dt;const t=this.t,h=hand(),pp=new THREE.Vector3(p.m.position.x,p.m.position.y+.7,p.m.position.z);
  setBeam(h,pp,t<.45?Math.min(.85,t/.12*.85):Math.max(0,.85-(t-.45)/.15*.85));
  const k=Math.min(1,Math.max(0,(t-.1)/.35));p.m.scale.setScalar(s0(p)*Math.max(.001,1-k*k));
  if(t>=.35){const q=Math.min(1,(t-.35)/.25);ball.visible=q<1;ball.position.lerpVectors(pp,h,q);ball.scale.setScalar(.8)}
  if(t>=.62){beam.visible=ball.visible=false;out=0;p.m.scale.setScalar(s0(p));return 1}}};
 anim.done=()=>{sv();done&&done()}}
let T0=performance.now();
(function loop(){requestAnimationFrame(t=>{const dt=Math.min(.05,(t-T0)/1000);T0=t;
 if(anim){let end=0;try{end=anim.run(dt)}catch(e){end=1}if(end){const d=anim.done;anim=null;cdT=performance.now()+CD;d&&d();paint()}}loop()})})();
/* --- керування --- */
const blocked=()=>(typeof menuO!=='undefined'&&menuO)||document.body.classList.contains('hedit');
window.palToggle=function(){if(!pals.length){msg('Спочатку зловіть істоту 🔮');return}if(anim||blocked())return;
 if(performance.now()<cdT)return;const p=pals[selP];
 if(out){recall(()=>msg('🔮 '+T[p.ty].n+' повернувся у сферу'))}else summon(()=>msg('✨ '+T[p.ty].n+' з вами!'));paint()};
/* ◀ ▶: обраний попал іде в табір, новий — з анімацією, якщо попал був призваний */
const toCamp=p=>{if(!p)return;p.m.visible=true;p.m.scale.setScalar(s0(p));p.x=rn(-3,3);p.z=rn(-3,3)};
const sw0=pwSw;pwSw=function(d){if(pals.length<2||anim||blocked())return;const old=pals[selP];
 if(!out){sw0(d);toCamp(old);paint();return}
 recall(()=>{sw0(d);toCamp(old);summon()})};
/* портрет: дотик — призов/відкликання, довге натискання — меню захисту */
const pm=$('pwm');let lpT=0,lpAt=0;
pm.addEventListener('pointerdown',()=>{clearTimeout(lpT);lpT=setTimeout(()=>{lpAt=performance.now();if(window.pdmToggle)pdmToggle()},500)});
['pointerup','pointercancel','pointerleave'].forEach(t=>pm.addEventListener(t,()=>clearTimeout(lpT)));
pm.addEventListener('click',e=>{e.stopPropagation();if(performance.now()-lpAt<800)return;palToggle()});
pm.addEventListener('contextmenu',e=>e.preventDefault());
/* --- вигляд портрета: приглушений «у сфері» або з сяйвом, коли призваний --- */
const st=document.createElement('style');st.id='summon-css';
st.textContent=`#pw2.pin #pwm{filter:grayscale(.85) brightness(.55)}
#pw2.pout #pwm{filter:drop-shadow(0 0 5px #7fe3f5) drop-shadow(0 0 2px #fff)}
#pwst{position:absolute;pointer-events:none;text-align:center;font:800 9px/12px system-ui,sans-serif;color:#ffe9b0;text-shadow:0 1px 2px #000;display:none}
#pw2.pin #pwst{display:block}`;
document.head.appendChild(st);
const pw2=$('pw2'),lab=document.createElement('div');lab.id='pwst';lab.textContent='🔮 у сфері';pw2.appendChild(lab);
function paint(){const has=!!pals[selP],shown=!!out;pw2.classList.toggle('pin',has&&!shown&&!anim);pw2.classList.toggle('pout',has&&shown&&!anim);
 if(has){lab.style.left=(pm.offsetLeft-30)+'px';lab.style.width=(pm.offsetWidth+60)+'px';lab.style.top=(pm.offsetTop+pm.offsetHeight/2-6)+'px'}}
setInterval(paint,400);paint();
}catch(e){console.warn('pal-summon',e)}})();
