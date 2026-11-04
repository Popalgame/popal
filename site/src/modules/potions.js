/* 0.3.0: зілля.
   • Зілля здоров'я (hpp) — варять біля Столу зіль (B_alch, world-007.js) з ягід і грибів; випити в рюкзаку — +40% здоров'я героя.
   • Зілля досвіду (xpp) — +10 000 досвіду попалу, з яким ви ходите. Лише для тестів розробника: 300 штук приходять листом гравцю з ID 0001,
     у крафті його немає. Цей досвід піднімає попала навіть вище рівня героя, щоб можна було випробувати еволюції (25 і 50 рівень).
   • Значки зіль і будівель Стіл зіль та Кошик з їжею малюються з їхніх 3D-моделей. */
(function(){try{
if(typeof IT=='undefined'||typeof inv=='undefined')return;
IT.hpp=['❤️','Зілля здоров’я'];IT.xpp=['✨','Зілля досвіду'];
for(const k of['hpp','xpp'])if(inv[k]==null)inv[k]=0;
if(typeof RC!='undefined'&&!RC.find(r=>r.id=='hpp'))RC.push({id:'hpp',n:'Зілля здоров’я',c:{be:3,mu:2},d:'Відновлює 40% здоров’я героя. Варять біля Столу зіль'});
try{if(window.DS)Object.assign(window.DS,{hpp:'Відновлює 40% здоров’я героя. Варять біля Столу зіль з ягід і грибів',xpp:'Тестове зілля розробника: +10 000 досвіду попалу, з яким ви ходите. Не має ваги'})}catch(_){}
try{const w0=window.itemW;if(w0)window.itemW=k=>k=='xpp'?0:k=='hpp'?.2:w0(k)}catch(_){}
const HPmax=()=>typeof HPM!='undefined'?HPM:100;

/* ---------- дія зіль ---------- */
function drinkHp(){if(!(inv.hpp>0))return;if(P.hp>=HPmax()){msg('❤️ Здоров’я вже повне');return}inv.hpp--;const add=Math.round(HPmax()*.4);P.hp=Math.min(HPmax(),P.hp+add);
 try{dmg('+'+add+' ❤️',pl,'#8dffa8')}catch(_){}msg('❤️ Випито зілля здоров’я: +'+add+' HP');try{hud();save()}catch(_){}}
function giveXp(times){times=Math.max(1,Math.min(times||1,inv.xpp||0));if(!(inv.xpp>0))return;const p=pals[selP];if(!p||p.cs!=null){msg('✨ Візьміть попала з собою, щоб дати йому зілля');return}
 const need=window.palXpNeed;if(!need){msg('✨ Досвід попалів ще не завантажився');return}if((p.lv||1)>=50){msg('✨ '+T[p.ty].n+' уже 50 рівня');return}
 inv.xpp-=times;let xpn=(p.xp||0)+10000*times,lv=p.lv||1;while(lv<50&&xpn>=need(lv)){xpn-=need(lv);lv++}/* без обмеження рівнем героя — для тестів */
 const up=lv-(p.lv||1);p.lv=lv;p.xp=lv>=50?0:xpn;try{inv._px=pals.map(q=>q.xp||0)}catch(_){}
 msg('✨ '+T[p.ty].n+': +'+(10000*times).toLocaleString('uk-UA')+' досвіду'+(up?' · рівень '+lv:''));try{dmg('✨ +'+10000*times,p.m,'#ffe28a');pwUp();save()}catch(_){}}
window.plPotion={drinkHp,giveXp};

/* кнопка в рюкзаку: виберіть зілля — під описом з'явиться «Випити» або «Дати попалу» */
if(typeof ivR=='function'){const _r=ivR;ivR=function(){_r.apply(this,arguments);try{if(typeof ivTab!='undefined'&&ivTab!='i')return;const on=document.querySelector('#ivc .i2s.on'),k=on&&on.dataset.sl,d=document.querySelector('#ivc .i2d');
 if(!d||(k!='hpp'&&k!='xpp'))return;const btn=(t,f)=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>{f();ivR()};d.insertBefore(b,d.querySelector('[data-drop]'))};if(k=='hpp')btn('❤️ Випити',drinkHp);else{btn('✨ Дати попалу',()=>giveXp(1));if(inv.xpp>=10)btn('✨ Дати ×10',()=>giveXp(10))}}catch(_){}}}

/* ---------- тестове зілля досвіду для ID 0001 — листом ---------- */
const gift=setInterval(()=>{if(inv._xpg){clearInterval(gift);return}if(window.myPid!=='0001'||!window.plMail)return;inv._xpg=1;clearInterval(gift);
 window.plMail.send({from:'Розробник Regnum Land',title:'✨ Зілля досвіду для тестів',text:'Кожне дає +10 000 досвіду попалу, з яким ви ходите (навіть вище рівня героя). Щоб випробувати еволюції: 25 рівень — друга форма (з 1 рівня — приблизно 14 зіль), 50 — третя (приблизно 150 зіль). Кнопка «Дати ×10» — щоб швидше.',items:{xpp:300}});
 try{msg('📬 Нова пошта: зілля досвіду для тестів')}catch(_){}},2000);

/* ---------- значки з 3D-моделей ---------- */
function bottle(c){const g=new THREE.Group(),gl=new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.5,transparent:true,opacity:.9,roughness:.12});
 const b=new THREE.Mesh(new THREE.SphereGeometry(.42,24,16),gl);b.position.y=.42;g.add(b);
 const n=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,.36,16),new THREE.MeshStandardMaterial({color:0xe8f2f8,transparent:true,opacity:.8,roughness:.1}));n.position.y=.92;g.add(n);
 const k=new THREE.Mesh(new THREE.CylinderGeometry(.14,.13,.14,14),new THREE.MeshStandardMaterial({color:0x8a5a32,roughness:.9}));k.position.y=1.14;g.add(k);
 const h=new THREE.Mesh(new THREE.SphereGeometry(.12,12,9),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:.6,transparent:true,opacity:.75}));h.position.set(-.18,.6,.3);h.scale.set(.6,1,.4);g.add(h);return g}
function iconOf(make,rotY){const S=192,cv=document.createElement('canvas');cv.width=cv.height=S;
 const rr=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:true,preserveDrawingBuffer:true});rr.setPixelRatio(1);rr.setSize(S,S,false);rr.setClearColor(0,0);if('outputEncoding' in rr)rr.outputEncoding=THREE.sRGBEncoding;
 const s=new THREE.Scene();s.add(new THREE.HemisphereLight(0xffffff,0x5a6a80,1.15));const k=new THREE.DirectionalLight(0xffffff,1.2);k.position.set(3,5,4);s.add(k);
 const g=make();g.rotation.y=rotY||0;s.add(g);g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g),c=b.getCenter(new THREE.Vector3()),z=b.getSize(new THREE.Vector3());
 const cam=new THREE.PerspectiveCamera(26,1,.05,100),d=Math.max(z.x,z.y,z.z)*.55/Math.tan(13*Math.PI/180);cam.position.set(c.x,c.y+d*.32,c.z+d);cam.lookAt(c.x,c.y-.03,c.z);rr.render(s,cam);
 const o=document.createElement('canvas');o.width=o.height=96;const x=o.getContext('2d');x.fillStyle='rgba(0,0,0,.3)';x.beginPath();x.ellipse(48,87,22,5,0,0,7);x.fill();
 const sil=document.createElement('canvas');sil.width=sil.height=96;const y=sil.getContext('2d');y.drawImage(cv,0,0,96,96);y.globalCompositeOperation='source-in';y.fillStyle='rgba(26,18,22,.92)';y.fillRect(0,0,96,96);
 for(const[dx,dy]of[[-2,0],[2,0],[0,-2],[0,2],[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]])x.drawImage(sil,dx,dy);x.drawImage(cv,0,0,96,96);
 const url=o.toDataURL('image/png');rr.dispose();rr.forceContextLoss();g.traverse(m=>{if(m.geometry)m.geometry.dispose()});return url}
const SRC={};
function makeIcons(){try{const L=[['hpp',()=>bottle(0xff4a6a)],['xpp',()=>bottle(0xffc83a)]];
 if(window.mkBuilding)L.push(['B_alch',()=>window.mkBuilding('B_alch'),-.5],['B_bask',()=>window.mkBuilding('B_bask'),-.4]);
 for(const[k,f,r]of L){try{SRC[k]=iconOf(f,r);if(IT[k])IT[k][0]=`<img class='iic' src='${SRC[k]}' alt=''>`}catch(e){console.warn('icon '+k,e)}}
 const s0=window.plIconSrc;window.plIconSrc=k=>SRC[k]||(s0?s0(k):null);
 try{if(typeof ivO!='undefined'&&ivO&&typeof ivR=='function')ivR()}catch(_){}}catch(e){console.warn('potion icons',e)}}
if(document.readyState=='complete')setTimeout(makeIcons,1200);else addEventListener('load',()=>setTimeout(makeIcons,1200));
}catch(e){console.warn('potions',e)}})();
