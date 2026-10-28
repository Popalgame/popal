/* 0.1.28: реалістичніші дерева. Три породи за місцевістю:
   • сосна/ялина (тундра, гори, сніг, попіл) — ярусна хвоя, тонкий стовбур із корою;
   • дуб (ліс, пустеля, пісок) — товстий стовбур із гілками й пишна нерівна крона; частина — по-осінньому руда;
   • береза (луки, болота) — білий стовбур із чорними рисками, легка світла крона.
   Кора й листя мають процедурні текстури, кожне дерево трохи інше за кольором, розміром і нахилом. Крони гойдаються від вітру. */
(function(){try{
const G=n=>{try{return eval(n)}catch(e){return undefined}};
const TR=G('trees');if(!TR||typeof THREE==='undefined')return;
/* ---------- текстури ---------- */
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
function cv(f,w,h){const c=document.createElement('canvas');c.width=w||128;c.height=h||128;f(c.getContext('2d'),c.width,c.height);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;return t}
const bark=(base,dark)=>cv((x,w,h)=>{x.fillStyle=base;x.fillRect(0,0,w,h);for(let i=0;i<140;i++){x.strokeStyle=rnd()<.6?dark:'rgba(255,255,255,.08)';x.lineWidth=1+rnd()*2.5;const u=rnd()*w;x.beginPath();x.moveTo(u,0);let v=0,uu=u;while(v<h){v+=6+rnd()*14;uu+=(rnd()-.5)*5;x.lineTo(uu,v)}x.stroke()}});
const birch=cv((x,w,h)=>{x.fillStyle='#e8e4dc';x.fillRect(0,0,w,h);for(let i=0;i<46;i++){x.fillStyle=rnd()<.7?'#262422':'#8a8478';const y=rnd()*h,l=6+rnd()*26;x.fillRect(rnd()*w,y,l,1.5+rnd()*3)}for(let i=0;i<300;i++){x.fillStyle='rgba(120,110,100,.25)';x.fillRect(rnd()*w,rnd()*h,1,1)}});
const leaves=(a,b,c)=>cv((x,w,h)=>{x.fillStyle=a;x.fillRect(0,0,w,h);for(let i=0;i<900;i++){x.fillStyle=rnd()<.45?b:rnd()<.5?c:'rgba(0,0,0,.18)';const r=1+rnd()*3.5;x.beginPath();x.ellipse(rnd()*w,rnd()*h,r,r*.6,rnd()*3,0,7);x.fill()}});
const needles=cv((x,w,h)=>{x.fillStyle='#24502e';x.fillRect(0,0,w,h);for(let i=0;i<1400;i++){x.strokeStyle=rnd()<.5?'#3a7a40':rnd()<.5?'#173a22':'#4f8f4a';x.lineWidth=1;const u=rnd()*w,v=rnd()*h,a=rnd()*.8+1.2;x.beginPath();x.moveTo(u,v);x.lineTo(u+Math.cos(a)*5,v+Math.sin(a)*5);x.stroke()}});
const ST=(m,o)=>new THREE.MeshStandardMaterial(Object.assign({map:m,roughness:.92,flatShading:true},o||{}));
const W=(m,mode)=>window.plWind?plWind(m,mode):m;
const MAT={oakBark:ST(bark('#6b4a32','rgba(40,26,16,.55)')),pineBark:ST(bark('#7a4e36','rgba(50,28,18,.6)')),birchBark:ST(birch),
 oak:[W(ST(leaves('#3f8a34','#5aa844','#2c6a28')),1),W(ST(leaves('#4f9a3a','#6cba4a','#346e2c')),1),W(ST(leaves('#c8742a','#e8a040','#9a4a1e')),1),W(ST(leaves('#d89a30','#f0c050','#a8641e')),1)],
 pine:[W(ST(needles,{color:0xffffff}),1),W(ST(needles,{color:0xcfe0c8}),1)],birch:[W(ST(leaves('#7cba4a','#9ad45a','#5a9a3a')),1),W(ST(leaves('#d8c040','#f0dc60','#a89a2a')),1)]};
/* ---------- геометрії з нерівністю ---------- */
function bumpy(geo,amt,s){const p=geo.attributes.position,v=new THREE.Vector3(),h=(x,y,z)=>{const q=Math.sin(x*12.9+y*78.2+z*37.7+s*7.1)*43758.5;return q-Math.floor(q)};
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const k=1+(h(Math.round(v.x*50),Math.round(v.y*50),Math.round(v.z*50))-.5)*amt;p.setXYZ(i,v.x*k,v.y*k,v.z*k)}geo.computeVertexNormals();return geo}
const BLOB=[1,2,3,4].map(s=>bumpy(new THREE.IcosahedronGeometry(1,1),.35,s));
const CONE=[1,2].map(s=>bumpy(new THREE.ConeGeometry(1,1,9,2),.18,s));
const TRUNK=new THREE.CylinderGeometry(.11,.2,1,8),BR=new THREE.CylinderGeometry(.05,.09,1,6);
const add=(g,geo,mat,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy==null?sx:sy,sz==null?sx:sz);m.castShadow=true;m.receiveShadow=true;g.add(m);return m};
/* ---------- породи ---------- */
function oak(g){const autumn=Math.random()<.2,lm=MAT.oak[autumn?2+(Math.random()*2|0):(Math.random()*2|0)],th=1.5+Math.random()*.4;
 add(g,TRUNK,MAT.oakBark,0,th/2,0,1.5,th,1.5);
 for(let i=0;i<3;i++){const a=i*2.1+Math.random(),b=add(g,BR,MAT.oakBark,Math.cos(a)*.35,th*.85,Math.sin(a)*.35,1,1.1,1);b.rotation.set(Math.sin(a)*.9,0,-Math.cos(a)*.9)}
 const cl=[[0,th+.75,0,1.05],[.65,th+.45,.2,.75],[-.6,th+.5,-.25,.8],[.15,th+.35,-.7,.7],[-.2,th+.4,.65,.72],[.1,th+1.35,.1,.7]];
 for(const[x,y,z,s]of cl){const m=add(g,BLOB[Math.random()*4|0],lm,x,y,z,s*(.9+Math.random()*.25),s*.82,s*(.9+Math.random()*.25));m.rotation.y=Math.random()*6}}
function pine(g){const lm=MAT.pine[Math.random()*2|0],h=2.2+Math.random()*.8;add(g,TRUNK,MAT.pineBark,0,h*.4,0,.9,h*.8,.9);
 const n=4+(Math.random()*2|0);for(let i=0;i<n;i++){const k=i/(n-1),r=1.15-k*.8,y=.9+k*(h+.2);const m=add(g,CONE[i%2],lm,0,y,0,r,.95-k*.25,r);m.rotation.y=Math.random()*6}}
function birchT(g){const lm=MAT.birch[Math.random()<.18?1:0],th=2.1+Math.random()*.5,t=add(g,TRUNK,MAT.birchBark,0,th/2,0,.8,th,.8);t.rotation.z=(Math.random()-.5)*.12;
 const cl=[[0,th+.45,0,.7],[.4,th+.1,.15,.5],[-.35,th+.15,-.1,.55],[.05,th+.9,0,.55],[0,th-.3,.35,.42]];
 for(const[x,y,z,s]of cl){const m=add(g,BLOB[Math.random()*4|0],lm,x,y,z,s,s*1.15,s);m.rotation.y=Math.random()*6}}
const PINE={tundra:1,snow:1,rock:1,ash:1},BIRCH={mead:1,swamp:1};
function kind(x,z){let b='';try{b=BIO(x,z)}catch(_){}const r=Math.random();if(PINE[b])return r<.85?pine:oak;if(BIRCH[b])return r<.55?birchT:r<.8?oak:pine;return r<.62?oak:r<.82?pine:birchT}
function redress(o){const g=o.m;if(!g)return;while(g.children.length)g.remove(g.children[0]);kind(o.x,o.z)(g);g.rotation.y=Math.random()*6;g.rotation.x=(Math.random()-.5)*.05;g.rotation.z=(Math.random()-.5)*.05;
 try{g.updateMatrixWorld(true)}catch(_){}g.traverse(m=>{m.matrixAutoUpdate=true})}
TR.forEach(redress);
/* нові дерева (виросли після рубки) — теж нової породи */
const _sp=spawn;spawn=function(L){const r=_sp.apply(this,arguments);if(L===TR&&TR.length)redress(TR[TR.length-1]);return r};
window.plTreeRedress=redress;
}catch(e){console.warn('trees',e)}})();
