/* Реалістичні NPC на основі тієї ж 3D-моделі, що й герой (assets/models/hero-mobile.glb, скелет Mixamo, анімація idle):
   • свій колір куртки й штанів (перефарбування текстури за відтінком), свій колір волосся (шейдер: темно-коричневі пікселі на голові);
   • меч героя прибрано (шейдер відкидає пікселі поза лівою кистю);
   • аксесуари (борода, кашкет, окуляри, гулька, молот, кошик…) кріпляться до кісток і рухаються разом з анімацією.
   NPCHERO.make(spec) повертає THREE.Group одразу; модель зʼявляється, щойно завантажиться GLB.
   spec: {jacket:'#rrggbb', pants:'#rrggbb', hair:'#rrggbb', scale:[x,y,z], acc(add,M)} — add(кістка, mesh, [x,y,z] у позі привʼязки), M(колір,опції) — матеріал. */
(function(){try{
const T=window.THREE;if(!T||!T.GLTFLoader||!T.SkeletonUtils)return;
const URL=window.NPCHERO_URL||'assets/models/hero-mobile.glb';
let gl=null;const wait=[];
new T.GLTFLoader().load(URL,g=>{gl=g;g.scene.updateMatrixWorld(true);wait.splice(0).forEach(f=>f())},undefined,e=>console.warn('npc-hero: GLB',e));
/* ---------- перефарбування текстури: куртка (насичений помаранчевий) і штани (хакі) ---------- */
const texCache={};
function hsv(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx==r)h=((g-b)/d)%6;else if(mx==g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360}return[h,mx?d/mx:0,mx]}
const hex=c=>{const n=typeof c=='number'?c:parseInt(String(c).replace('#',''),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};
function recolor(src,jacket,pants){const k=jacket+'|'+pants;if(texCache[k])return texCache[k];
 const im=src.image,c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);
 const d=x.getImageData(0,0,c.width,c.height),a=d.data,J=jacket!=null?hex(jacket):null,Pn=pants!=null?hex(pants):null;
 for(let i=0;i<a.length;i+=4){const r=a[i]/255,g=a[i+1]/255,b=a[i+2]/255,[h,s,v]=hsv(r,g,b);let t=null,w=0;
  if(J&&h>=8&&h<=34&&s>.58&&v>.32){t=J;w=Math.min(1,(s-.58)/.12)*Math.min(1,(v-.32)/.1)}/* куртка */
  else if(Pn&&h>=34&&h<=58&&s>.22&&s<.6&&v>.25&&v<.75){t=Pn;w=Math.min(1,(s-.22)/.08)}/* штани хакі */
  if(!t)continue;const L=v/.9,nr=t[0]*L*1.15,ng=t[1]*L*1.15,nb=t[2]*L*1.15;
  a[i]=Math.min(255,(r*(1-w)+nr*w)*255);a[i+1]=Math.min(255,(g*(1-w)+ng*w)*255);a[i+2]=Math.min(255,(b*(1-w)+nb*w)*255)}
 x.putImageData(d,0,0);const t=new T.CanvasTexture(c);t.encoding=src.encoding;t.flipY=src.flipY;t.wrapS=src.wrapS;t.wrapT=src.wrapT;return texCache[k]=t}
/* ---------- матеріал: волосся іншого кольору, без меча ---------- */
function material(base,spec){const m=base.clone();if(base.map&&spec.jacket!=null)m.map=recolor(base.map,spec.jacket,null);
 const lin=v=>v.map(c=>Math.pow(c,2.2)),hc=spec.hair!=null?lin(hex(spec.hair)):null,pc=spec.pants!=null?lin(hex(spec.pants)):null;
 m.onBeforeCompile=sh=>{sh.uniforms.uHair={value:new T.Vector3(...(hc||[0,0,0]))};sh.uniforms.uHairOn={value:hc?1:0};sh.uniforms.uPants={value:new T.Vector3(...(pc||[0,0,0]))};sh.uniforms.uPantsOn={value:pc?1:0};
  sh.vertexShader='varying vec3 vNP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvNP=position;');
  sh.fragmentShader='varying vec3 vNP;uniform vec3 uHair;uniform float uHairOn;uniform vec3 uPants;uniform float uPantsOn;\nvec3 npcHsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-10)),d/(q.x+1e-10),q.x);}\n'+
   sh.fragmentShader.replace('void main() {','void main() {\n if(vNP.x>.545&&vNP.y>.86)discard;').replace('#include <map_fragment>',`#include <map_fragment>
 if(uHairOn>.5&&vNP.y>1.4){vec3 hs=npcHsv(diffuseColor.rgb);bool eye=abs(vNP.x)<.15&&vNP.y<1.465&&vNP.y>1.38&&vNP.z>.1;
  if(!eye&&((hs.x>.02&&hs.x<.12&&hs.z<.62&&hs.y>.3)||((hs.x>.85||hs.x<.02)&&hs.y>.45))){float l=hs.z/.42;diffuseColor.rgb=mix(diffuseColor.rgb,uHair*clamp(l,.35,1.25),.92);}}
 if(uPantsOn>.5&&vNP.y>.2&&vNP.y<.72&&abs(vNP.x)<.27){vec3 hs=npcHsv(diffuseColor.rgb);if(hs.x>.06&&hs.x<.17&&hs.y>.12&&hs.y<.75){float l=hs.z/.45;diffuseColor.rgb=mix(diffuseColor.rgb,uPants*clamp(l,.3,1.4),.9);}}`)};
 m.customProgramCacheKey=()=>'npchero'+(hc?hc.join(','):'')+(spec.jacket||'')+(spec.pants||'');return m}
const mats={},M=(c,o)=>{const k=c+JSON.stringify(o||{});return mats[k]||(mats[k]=new T.MeshStandardMaterial(Object.assign({color:c,roughness:.75},o||{})))};
/* ---------- зібрати NPC ---------- */
function build(root,spec){const model=T.SkeletonUtils.clone(gl.scene);model.updateMatrixWorld(true);
 const bones={};model.traverse(n=>{if(n.isBone)bones[n.name.replace('mixamorig:','').replace('mixamorig','')]=n;if(n.isMesh){n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;n.material=material(n.material,spec)}});
 if(spec.scale)model.scale.set(...spec.scale);model.updateMatrixWorld(true);
 const add=(bn,mesh,p)=>{mesh.position.set(p[0],p[1],p[2]);mesh.traverse(o=>{if(o.isMesh)o.castShadow=true});model.add(mesh);model.updateMatrixWorld(true);(bones[bn]||model).attach(mesh);return mesh};
 /* предмети в руці: не приклеєні до кисті, а щокадру ставляться так, щоб кулак тримав їх (палиця стоїть на землі, кошик висить) */
 const held=[],v1=new T.Vector3(),v2=new T.Vector3();
 const hold=(bn,obj,fn)=>{model.add(obj);obj.traverse(o=>{if(o.isMesh)o.castShadow=true});held.push({b:bones[bn],fa:bones[bn.replace('Hand','ForeArm')],obj,fn})};
 if(spec.acc)spec.acc(add,M,bones,hold);
 root.add(model);
 const mixer=new T.AnimationMixer(model),clip=gl.animations.find(a=>/idle/i.test(a.name));if(clip){const a=mixer.clipAction(clip);a.time=Math.random()*clip.duration;a.play()}
 const ra=bones.RightArm,la=bones.LeftArm;let last=null,talk=false;
 root.userData.wave=t=>{talk=t!=null};
 root.userData.idle=t=>{const dt=last==null?0:Math.min(.1,Math.max(0,t-last));last=t;mixer.update(dt);
  if(talk&&la){la.rotation.z+=Math.sin(t*9)*.25-.9}/* ліва рука махає */
  if(spec.pose)spec.pose(bones,t,talk);
  if(held.length){model.updateMatrixWorld(true);for(const h of held){if(!h.b)continue;h.b.getWorldPosition(v1);if(h.fa){h.fa.getWorldPosition(v2);v2.subVectors(v1,v2).normalize().multiplyScalar(.07);v1.add(v2)}model.worldToLocal(v1);h.fn(h.obj,v1)}}};
 root.userData.bones=bones}
window.NPCHERO={make(spec){const root=new T.Group();root.userData.idle=()=>{};root.userData.wave=()=>{};
  const go=()=>{try{build(root,spec)}catch(e){console.warn('npc-hero',e)}};if(gl)go();else wait.push(go);return root},ready:()=>!!gl};
}catch(e){console.warn('npc-hero:',e)}})();
