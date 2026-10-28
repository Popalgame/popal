/* 0.1.25: викинуті з рюкзака речі не зникають одразу — падають на землю торбинкою.
   Біля торбинки «Дія» стає «👜 Підібрати» і повертає все в рюкзак. Торбинка лежить 10 хвилин, переживає перезапуск гри. */
(function(){try{
const LIFE=10*60*1000,NEAR=1.6;
if(!Array.isArray(inv._gd))inv._gd=[];
const GD=inv._gd;
const SACK=new THREE.MeshStandardMaterial({color:0xa8783f,roughness:.9,flatShading:true}),TIE=new THREE.MeshStandardMaterial({color:0x6b4422,roughness:.8});
function icoTex(k){const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');x.fillStyle='rgba(14,20,42,.75)';x.beginPath();x.arc(48,48,44,0,7);x.fill();x.strokeStyle='#e2bf67';x.lineWidth=5;x.stroke();
 const ic=(IT[k]?IT[k][0]:'❔').replace(/<[^>]+>/g,'');x.font='52px serif';x.textAlign='center';x.textBaseline='middle';x.fillText(ic,48,52);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
function mk(g){const o=new THREE.Group(),b=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),SACK);b.scale.set(1,.8,1);b.position.y=.22;b.castShadow=true;o.add(b);
 const n=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,.14,8),SACK);n.position.y=.48;o.add(n);const t=new THREE.Mesh(new THREE.TorusGeometry(.09,.025,6,12),TIE);t.rotation.x=Math.PI/2;t.position.y=.45;o.add(t);
 const k=Object.keys(g.it)[0],sp=new THREE.Sprite(new THREE.SpriteMaterial({map:icoTex(k),transparent:true,depthTest:false}));sp.scale.set(.5,.5,1);sp.position.y=1.0;o.add(sp);o.userData.sp=sp;return o}
const live=[];
function show(){live.forEach(e=>sc.remove(e.m));live.length=0;for(const g of GD){const m=mk(g);m.position.set(g.x,Math.max(-.3,H(g.x,g.z)),g.z);sc.add(m);live.push({g,m})}}
const prune=()=>{const now=Date.now();let ch=0;for(let i=GD.length-1;i>=0;i--){if(now-GD[i].t>LIFE||!Object.keys(GD[i].it).length){GD.splice(i,1);ch=1}}if(ch)show()};
prune();show();setInterval(prune,5000);
window.dropLoot=(k,n)=>{const a=P.face||0,x=P.x+Math.sin(a)*1.1,z=P.z+Math.cos(a)*1.1;let g=GD.find(q=>Math.hypot(q.x-x,q.z-z)<1.2);
 if(g){g.it[k]=(g.it[k]||0)+n;g.t=Date.now()}else{g={x:+x.toFixed(2),z:+z.toFixed(2),t:Date.now(),it:{[k]:n}};GD.push(g)}show();save()};
const nearG=()=>{let b=null,bd=NEAR;for(const g of GD){const d=Math.hypot(g.x-P.x,g.z-P.z);if(d<bd){bd=d;b=g}}return b};
function pick(g){const parts=[];for(const[k,n]of Object.entries(g.it)){addI(k,n);parts.push((IT[k]?IT[k][1]:k)+(n>1?' ×'+n:''))}
 GD.splice(GD.indexOf(g),1);show();msg('👜 Підібрано: '+parts.join(', '));if(window.plBurst)plBurst(g.x,H(g.x,g.z)+.5,g.z,0xffe28a,12,1.4,.3);try{eqUp()}catch(_){}hud();save()}
const hb=$('hit'),h0=hb.onclick;hb.onclick=function(){const g=nearG();if(g&&!nearest(wild,2.6)){pick(g);return}return h0.apply(this,arguments)};
let was=null,hit0=null;ANI.push(t=>{for(const e of live){e.m.userData.sp.position.y=1+Math.sin(t*2.4+e.g.x)*.08}
 const n=!!nearG();if(n===was)return;was=n;if(n){hit0=hb.innerHTML;hb.innerHTML='👜<small>Підібрати</small>'}else if(hit0!=null){hb.innerHTML=hit0;hit0=null}});
}catch(e){console.warn('drop',e)}})();
