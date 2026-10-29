/* Procedural trees: one shared leaf-card mesh per broadleaf canopy. */
(function(){try{
const G=n=>{try{return eval(n)}catch(_){return undefined}};
const TR=G('trees');if(!TR||typeof THREE==='undefined')return;
let seed=7;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
function cv(draw,w=128,h=128){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t}
const bark=(base,dark)=>cv((x,w,h)=>{x.fillStyle=base;x.fillRect(0,0,w,h);for(let i=0;i<140;i++){x.strokeStyle=rnd()<.6?dark:'rgba(255,255,255,.08)';x.lineWidth=1+rnd()*2.5;const u=rnd()*w;x.beginPath();x.moveTo(u,0);let v=0,uu=u;while(v<h){v+=6+rnd()*14;uu+=(rnd()-.5)*5;x.lineTo(uu,v)}x.stroke()}});
const birch=cv((x,w,h)=>{x.fillStyle='#e8e4dc';x.fillRect(0,0,w,h);for(let i=0;i<46;i++){x.fillStyle=rnd()<.7?'#262422':'#8a8478';x.fillRect(rnd()*w,rnd()*h,6+rnd()*26,1.5+rnd()*3)}for(let i=0;i<300;i++){x.fillStyle='rgba(120,110,100,.25)';x.fillRect(rnd()*w,rnd()*h,1,1)}});
const needles=cv(x=>{x.clearRect(0,0,128,128);x.strokeStyle='#d9e3d2';x.lineWidth=4;x.beginPath();x.moveTo(64,121);x.lineTo(64,9);x.stroke();
 for(let i=0;i<15;i++){const y=113-i*7,w=(1-i/18)*40;for(const side of [-1,1]){x.fillStyle=i%3?'#e4ebdd':'#c8d7c4';x.beginPath();x.moveTo(64,y+5);x.lineTo(64+side*w,y-8);x.lineTo(64+side*(w*.75),y-10);x.lineTo(64,y-2);x.fill()}}});
/* White leaf sprays are tinted by shared seasonal materials and per-card shades. */
const leafMap=cv(x=>{
 x.clearRect(0,0,128,128);x.lineCap='round';x.strokeStyle='rgba(105,105,105,.8)';x.lineWidth=3;
 x.beginPath();x.moveTo(64,113);x.quadraticCurveTo(62,60,64,19);x.stroke();
 const spray=[[29,83,-.7,25,16],[97,82,.7,25,16],[35,54,-.65,26,17],[93,52,.65,26,17],
  [42,27,-.45,24,16],[84,26,.45,24,16],[63,14,0,24,16],[63,47,0,22,15],[64,78,0,21,15]];
 for(const [cx,cy,a,len,w]of spray){x.save();x.translate(cx,cy);x.rotate(a);x.fillStyle='#f6f6ed';x.beginPath();x.moveTo(0,-len);x.bezierCurveTo(w,-len*.55,w,len*.5,0,len);x.bezierCurveTo(-w,len*.5,-w,-len*.55,0,-len);x.fill();x.strokeStyle='rgba(95,95,82,.32)';x.lineWidth=1;x.beginPath();x.moveTo(0,-len*.7);x.lineTo(0,len*.72);x.stroke();x.restore()}
});leafMap.generateMipmaps=true;leafMap.minFilter=THREE.LinearMipmapLinearFilter;
function ST(map,opts){return new THREE.MeshStandardMaterial(Object.assign({map,roughness:.94},opts))}
const W=(m,mode)=>window.plWind?plWind(m,mode):m;
const cutMat=(map,color,extra)=>W(ST(map,Object.assign({color,vertexColors:true,side:THREE.DoubleSide,alphaTest:.35},extra)),1);
const leafMat=color=>cutMat(leafMap,color);
const depthMat=map=>W(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map,alphaTest:.35,side:THREE.DoubleSide}),1);
const leafDepth=depthMat(leafMap),pineDepth=depthMat(needles);
const MAT={oakBark:ST(bark('#6b4a32','rgba(40,26,16,.55)')),pineBark:ST(bark('#7a4e36','rgba(50,28,18,.6)')),birchBark:ST(birch),
 oak:[leafMat(0x4e9a38),leafMat(0x60a944),leafMat(0xd58435),leafMat(0xe1a63f)],
 pine:[cutMat(needles,0x78af6e,{emissive:0x365e36,emissiveIntensity:.2}),
  cutMat(needles,0x89b884,{emissive:0x406943,emissiveIntensity:.2})],birch:[leafMat(0x92bc57),leafMat(0xd6c451)]};
const TRUNK=new THREE.CylinderGeometry(.11,.2,1,8),BR=new THREE.CylinderGeometry(.045,.09,1,6);
const add=(g,geo,mat,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy==null?sx:sy,sz==null?sx:sz);m.castShadow=m.receiveShadow=true;g.add(m);return m};
const up=new THREE.Vector3(0,1,0);
function limb(g,mat,a,b,r){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),d=to.sub(from),m=add(g,BR,mat,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,r/.07,d.length(),r/.07);m.quaternion.setFromUnitVectors(up,d.normalize())}
/* Templates amortize foliage geometry across all 540 trees. */
function canopy(lobes,variant,size=1){let state=79+variant*1871;const rand=()=>{state=state*16807%2147483647;return state/2147483647};
 const pos=[],uv=[],normal=[],colors=[],index=[];
 for(const [cx,cy,cz,rx,ry,rz,count]of lobes)for(let i=0;i<count;i++){
  const phi=rand()*Math.PI*2,ny=rand()*1.8-.9,rad=Math.sqrt(1-ny*ny),shell=.27+rand()*.76;
  const outward=new THREE.Vector3(Math.cos(phi)*rad,ny,Math.sin(phi)*rad),center=new THREE.Vector3(cx+outward.x*rx*shell,cy+outward.y*ry*shell,cz+outward.z*rz*shell);
  const right=new THREE.Vector3().crossVectors(up,outward).normalize();if(right.lengthSq()<.01)right.set(1,0,0);
  const tall=new THREE.Vector3().crossVectors(outward,right).normalize(),roll=rand()*Math.PI*2;
  const ax=right.clone().multiplyScalar(Math.cos(roll)).addScaledVector(tall,Math.sin(roll)),ay=tall.clone().multiplyScalar(Math.cos(roll)).addScaledVector(right,-Math.sin(roll));
  const width=(.57+rand()*.17)*(variant%2?.95:1)*size,height=width*(.98+rand()*.25),shade=.72+rand()*.27,base=pos.length/3;
  for(const [u,v]of [[0,0],[1,0],[0,1],[1,1]]){const p=center.clone().addScaledVector(ax,(u-.5)*width).addScaledVector(ay,(v-.5)*height);pos.push(p.x,p.y,p.z);uv.push(u,v);normal.push(outward.x,outward.y,outward.z);colors.push(shade,shade*(.95+rand()*.05),shade*.91)}
  index.push(base,base+1,base+2,base+2,base+1,base+3);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(index);geo.computeBoundingSphere();return geo;
}
const OAK_LOBES=[[0,.28,0,.82,.65,.76,64],[.7,-.12,.1,.64,.53,.57,42],[-.7,-.11,-.16,.65,.53,.57,42],
 [.07,-.12,-.67,.55,.52,.54,34],[-.04,.55,.42,.59,.52,.54,38],[.02,-.35,.36,.54,.43,.5,34]];
const BIRCH_LOBES=[[0,.22,0,.53,.75,.48,72],[.37,-.12,.12,.4,.51,.38,38],[-.36,-.08,-.1,.42,.51,.38,38],
 [0,.65,.13,.39,.48,.34,29],[.03,-.37,.3,.34,.39,.34,27]];
const PINE_LOBES=[[0,-.72,0,.97,.27,.97,66],[0,-.31,0,.79,.25,.79,56],[0,.09,0,.63,.25,.63,48],
 [0,.48,0,.46,.26,.46,40],[0,.85,0,.29,.29,.29,30]];
const OAK_GEO=[0,1,2,3].map(i=>canopy(OAK_LOBES,i)),BIRCH_GEO=[0,1,2].map(i=>canopy(BIRCH_LOBES,i+7)),
 PINE_GEO=[0,1].map(i=>canopy(PINE_LOBES,i+12,.76));
const sharedGeo=new Set([TRUNK,BR,...OAK_GEO,...BIRCH_GEO,...PINE_GEO]);
const sharedMat=new Set([MAT.oakBark,MAT.pineBark,MAT.birchBark,...MAT.oak,...MAT.pine,...MAT.birch]);
function crown(g,geo,mat,x,y,z,depth=leafDepth){const m=add(g,geo,mat,x,y,z,1,1,1);m.customDepthMaterial=depth;m.userData.leafCards=true}
function oak(g){const autumn=Math.random()<.2,lm=MAT.oak[autumn?2+(Math.random()*2|0):Math.random()*2|0],th=1.55+Math.random()*.36;
 add(g,TRUNK,MAT.oakBark,0,th/2,0,1.55,th,1.55);
 for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.random()*.35,r=.72+Math.random()*.14,tip=[Math.cos(a)*r,th+.35+Math.random()*.32,Math.sin(a)*r];limb(g,MAT.oakBark,[0,th*.73,0],tip,.09);limb(g,MAT.oakBark,tip,[tip[0]*1.27,tip[1]+.31,tip[2]*1.27],.055)}
 crown(g,OAK_GEO[Math.random()*OAK_GEO.length|0],lm,0,th+.52,0)}
function pine(g){const lm=MAT.pine[Math.random()*2|0],h=2.2+Math.random()*.8;add(g,TRUNK,MAT.pineBark,0,h*.47,0,.82,h*.94,.82);
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7,r=.8+Math.random()*.12;limb(g,MAT.pineBark,[0,h*.35,0],[Math.cos(a)*r,h*.42,Math.sin(a)*r],.045)}
 crown(g,PINE_GEO[Math.random()*PINE_GEO.length|0],lm,0,h*.65,0,pineDepth)}
function birchT(g){const lm=MAT.birch[Math.random()<.18?1:0],th=2.15+Math.random()*.48,t=add(g,TRUNK,MAT.birchBark,0,th/2,0,.8,th,.8);t.rotation.z=(Math.random()-.5)*.11;
 for(let i=0;i<3;i++){const a=i*2.09+.3,r=.42+Math.random()*.1;limb(g,MAT.birchBark,[0,th*.72,0],[Math.cos(a)*r,th+.18+Math.random()*.35,Math.sin(a)*r],.045)}
 crown(g,BIRCH_GEO[Math.random()*BIRCH_GEO.length|0],lm,0,th+.38,0)}
const PINE={tundra:1,snow:1,rock:1,ash:1},BIRCH={mead:1,swamp:1};
function kind(x,z){let b='';try{b=BIO(x,z)}catch(_){}const r=Math.random();if(PINE[b])return r<.85?pine:oak;if(BIRCH[b])return r<.55?birchT:r<.8?oak:pine;return r<.62?oak:r<.82?pine:birchT}
function redress(o){const g=o.m;if(!g)return;while(g.children.length){const old=g.children[0];g.remove(old);if(old.geometry&&!sharedGeo.has(old.geometry))old.geometry.dispose();if(old.material&&!sharedMat.has(old.material))old.material.dispose()}kind(o.x,o.z)(g);g.userData.staticBatchReady=0;g.rotation.y=Math.random()*6;g.rotation.x=(Math.random()-.5)*.05;g.rotation.z=(Math.random()-.5)*.05;
 g.updateMatrixWorld(true);g.traverse(m=>{m.matrixAutoUpdate=true})}
TR.forEach(redress);
/* Felling and respawn keep the same resource list and collision root. */
const _sp=spawn;spawn=function(L){const r=_sp.apply(this,arguments);if(L===TR&&TR.length)redress(TR[TR.length-1]);return r};
window.plTreeRedress=redress;
}catch(e){console.warn('trees',e)}})();
