/* 0.1.28: «могила» (d:1) — речі після смерті у складному режимі: не зникає, видно здалеку (світний стовп), позначка ☠ на міні-карті.
   0.1.25: викинуті з рюкзака речі не зникають одразу — падають на землю торбинкою.
   Біля торбинки «Дія» стає «👜 Підібрати» і повертає все в рюкзак. Торбинка лежить 10 хвилин, переживає перезапуск гри. */
(function(){try{
const LIFE=10*60*1000,NEAR=1.6;
if(!Array.isArray(inv._gd))inv._gd=[];
const GD=inv._gd;
const SACK=new THREE.MeshStandardMaterial({color:0xa8783f,roughness:.9,flatShading:true}),TIE=new THREE.MeshStandardMaterial({color:0x6b4422,roughness:.8});
function icoTex(k){const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');x.fillStyle='rgba(14,20,42,.75)';x.beginPath();x.arc(48,48,44,0,7);x.fill();x.strokeStyle='#e2bf67';x.lineWidth=5;x.stroke();
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const src=window.plIconSrc&&plIconSrc(k);
 if(src){const im=new Image();im.onload=()=>{x.drawImage(im,16,16,64,64);t.needsUpdate=true};im.src=src;return t}
 const ic=(IT[k]?IT[k][0]:'❔').replace(/<[^>]+>/g,'');x.font='52px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(ic,48,52);t.needsUpdate=true;return t}
const GRV=new THREE.MeshStandardMaterial({color:0x8a8a94,roughness:.9,flatShading:true}),BEAM=new THREE.MeshBasicMaterial({color:0xc070ff,transparent:true,opacity:.35,depthWrite:false,fog:false,toneMapped:false});
function mkGrave(g){const o=new THREE.Group(),m=(geo,mat,x,y,z)=>{const q=new THREE.Mesh(geo,mat);q.position.set(x,y,z);q.castShadow=true;o.add(q);return q};
 m(new THREE.BoxGeometry(.5,.7,.14),GRV,0,.35,-.25);m(new THREE.CylinderGeometry(.25,.25,.14,12,1,false,0,Math.PI),GRV,0,.7,-.25).rotation.set(Math.PI/2,0,Math.PI/2);
 const b=m(new THREE.SphereGeometry(.3,10,8),SACK,0,.2,.15);b.scale.set(1,.7,1);
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,40,10,1,true),BEAM);beam.position.y=20;beam.renderOrder=2;o.add(beam);
 const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:skull(),transparent:true,depthTest:false}));sp.scale.set(.7,.7,1);sp.position.y=1.4;o.add(sp);o.userData.sp=sp;return o}
function skull(){const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');x.fillStyle='rgba(40,10,60,.8)';x.beginPath();x.arc(48,48,44,0,7);x.fill();x.strokeStyle='#c070ff';x.lineWidth=5;x.stroke();x.font='54px serif';x.textAlign='center';x.textBaseline='middle';x.fillText('☠️',48,52);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
function mk(g){if(g.d)return mkGrave(g);const o=new THREE.Group(),b=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),SACK);b.scale.set(1,.8,1);b.position.y=.22;b.castShadow=true;o.add(b);
 const n=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,.14,8),SACK);n.position.y=.48;o.add(n);const t=new THREE.Mesh(new THREE.TorusGeometry(.09,.025,6,12),TIE);t.rotation.x=Math.PI/2;t.position.y=.45;o.add(t);
 const k=Object.keys(g.it)[0],sp=new THREE.Sprite(new THREE.SpriteMaterial({map:icoTex(k),transparent:true,depthTest:false}));sp.scale.set(.5,.5,1);sp.position.y=1.0;o.add(sp);o.userData.sp=sp;return o}
const live=[];
function show(){live.forEach(e=>sc.remove(e.m));live.length=0;for(const g of GD){const m=mk(g);m.position.set(g.x,Math.max(-.3,H(g.x,g.z)),g.z);sc.add(m);live.push({g,m})}}
const prune=()=>{const now=Date.now();let ch=0;for(let i=GD.length-1;i>=0;i--){if((!GD[i].d&&now-GD[i].t>LIFE)||!Object.keys(GD[i].it).length){GD.splice(i,1);ch=1}}if(ch)show()};
prune();show();setInterval(prune,5000);
window.dropLoot=(k,n)=>{const a=P.face||0,x=P.x+Math.sin(a)*1.1,z=P.z+Math.cos(a)*1.1;let g=GD.find(q=>Math.hypot(q.x-x,q.z-z)<1.2);
 if(g){g.it[k]=(g.it[k]||0)+n;g.t=Date.now()}else{g={x:+x.toFixed(2),z:+z.toFixed(2),t:Date.now(),it:{[k]:n}};GD.push(g)}show();save()};
window.dropGrave=(x,z,items)=>{GD.push({x:+x.toFixed(2),z:+z.toFixed(2),t:Date.now(),it:items,d:1});show();save()};
const nearG=()=>{let b=null,bd=1e9;for(const g of GD){const d=Math.hypot(g.x-P.x,g.z-P.z),lim=g.d?2.2:NEAR;if(d<lim&&d<bd){bd=d;b=g}}return b};
function pick(g){const parts=[];for(const[k,n]of Object.entries(g.it)){addI(k,n);parts.push((IT[k]?IT[k][1]:k)+(n>1?' ×'+n:''))}
 GD.splice(GD.indexOf(g),1);show();msg((g.d?'☠️ Ви повернули свої речі: ':'👜 Підібрано: ')+parts.join(', '));if(window.plBurst)plBurst(g.x,H(g.x,g.z)+.5,g.z,0xffe28a,12,1.4,.3);try{eqUp()}catch(_){}hud();save()}
const hb=$('hit'),h0=hb.onclick;hb.onclick=function(){const g=nearG();if(g&&!nearest(wild,2.6)){pick(g);return}return h0.apply(this,arguments)};
let was=0,hit0=null;ANI.push(t=>{for(const e of live){e.m.userData.sp.position.y=1+Math.sin(t*2.4+e.g.x)*.08}
 const g=nearG(),n=g?(g.d?2:1):0;if(n===was)return;if(n&&hit0==null)hit0=hb.innerHTML;was=n;if(n)hb.innerHTML=n==2?'☠️<small>Забрати</small>':'👜<small>Підібрати</small>';else if(hit0!=null){hb.innerHTML=hit0;hit0=null}});
}catch(e){console.warn('drop',e)}})();
