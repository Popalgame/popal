/* Shared, vertex-coloured skin for every editable hero. Loaded after the editor builder. */
(function(){
'use strict';
const T=window.THREE,previous=window.buildHero;
if(!T||typeof previous!=='function')return;
const names=['body','head','armUpperL','armLowerL','armUpperR','armLowerR','legUpperL','legLowerL','legUpperR','legLowerR'];
const parent=[-1,0,0,2,0,4,-1,6,-1,8];
const rest=[[0,.66,0],[0,.64,0],[-.29,.56,0],[0,-.28,0],[.29,.56,0],[0,-.28,0],[-.115,.69,0],[0,-.31,0],[.115,.69,0],[0,-.31,0]];
const index=Object.fromEntries(names.map((n,i)=>[n,i]));
function skin(g){
 const pieces=g.children.filter(m=>m.isMesh&&!m.isSkinnedMesh),pos=[],nor=[],col=[],idx=[],si=[],sw=[];
 const v=new T.Vector3(),n=new T.Vector3(),nm=new T.Matrix3(),c=new T.Color(),tubeColors={};let offset=0;
 for(const m of pieces){
  const geometry=m.geometry,p=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
  if(!p||!normal)continue;
  const tag=m.userData.heroPart||'body',bone=index[tag]===undefined?0:index[tag];
  // The original isolated sleeve/trouser cylinders become one continuously skinned tube.
  if(/^armLower[LR]$/.test(tag)&&geometry.type==='SphereGeometry'&&Math.abs(m.position.y-.94)<.04)continue;
  if(/^(arm|leg)(Upper|Lower)[LR]$/.test(tag)&&geometry.type==='CylinderGeometry'&&geometry.parameters.height>.25){
   tubeColors[tag]=m.material.color.clone();continue;
  }
  m.updateMatrix();nm.getNormalMatrix(m.matrix);c.copy(m.material.color||new T.Color(0xffffff));
  for(let i=0;i<p.count;i++){
   v.fromBufferAttribute(p,i).applyMatrix4(m.matrix);n.fromBufferAttribute(normal,i).applyMatrix3(nm).normalize();
   pos.push(v.x,v.y,v.z);nor.push(n.x,n.y,n.z);col.push(c.r,c.g,c.b);si.push(bone,0,0,0);sw.push(1,0,0,0);
  }
  const gi=geometry.index;if(gi)for(let i=0;i<gi.count;i++)idx.push(offset+gi.getX(i));
  else for(let i=0;i<p.count;i++)idx.push(offset+i);
  offset+=p.count;
 }
 function limb(side,type){
  const isArm=type==='arm',upper=index[type+'Upper'+side],lower=index[type+'Lower'+side];
  const top=isArm?1.22:.69,joint=isArm?.94:.38,bottom=isArm?.70:.10;
  const upperColor=tubeColors[type+'Upper'+side]||new T.Color(0x6874a0),lowerColor=tubeColors[type+'Lower'+side]||upperColor;
  const sign=side==='L'?-1:1,base=offset,rings=18,sides=12;
  for(let row=0;row<=rings;row++){
   const t=row/rings,y=top+(bottom-top)*t;
   const radius=isArm?(.079-.023*t+Math.exp(-(((y-joint)/.055)**2))*.005):(.096-.028*t+Math.exp(-(((y-joint)/.06)**2))*.005);
   const centerX=isArm?sign*(.29+.026*t):sign*.115;
   const blend=Math.max(0,Math.min(1,(y-joint)/.15+.5));
   const upperWeight=blend*blend*(3-2*blend),lowerWeight=1-upperWeight;
   const color=upperColor.clone().lerp(lowerColor,t);
   for(let sideIndex=0;sideIndex<=sides;sideIndex++){
    const a=sideIndex/sides*Math.PI*2,cs=Math.cos(a),sn=Math.sin(a);
    pos.push(centerX+cs*radius,y,sn*radius);nor.push(cs,0,sn);col.push(color.r,color.g,color.b);
    si.push(upper,lower,0,0);sw.push(upperWeight,lowerWeight,0,0);
   }
  }
  for(let row=0;row<rings;row++)for(let sideIndex=0;sideIndex<sides;sideIndex++){
   const a=base+row*(sides+1)+sideIndex,b=a+sides+1;idx.push(a,a+1,b,b,a+1,b+1);
  }
  offset+=(rings+1)*(sides+1);
 }
 for(const side of ['L','R']){limb(side,'arm');limb(side,'leg')}
 if(!offset)throw Error('Hero has no skin geometry');
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(nor,3));geometry.setAttribute('color',new T.Float32BufferAttribute(col,3));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));geometry.setIndex(idx);geometry.computeBoundingSphere();
 const bones=names.map((name,i)=>{const b=new T.Bone();b.name='hero'+name[0].toUpperCase()+name.slice(1);b.position.set(...rest[i]);return b});
 bones.forEach((b,i)=>{if(parent[i]>=0)bones[parent[i]].add(b)});
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.84,metalness:.04,skinning:true});
 const mesh=new T.SkinnedMesh(geometry,material);mesh.name='heroSkin';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 for(const b of bones)if(!b.parent)mesh.add(b);
 mesh.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));
 for(const m of pieces)g.remove(m);
 if(g.userData.heroGeometries)for(const old of g.userData.heroGeometries)old.dispose();
 g.userData.heroGeometries=new Set([geometry]);mesh.userData.heroGeometry=true;
 g.add(mesh);g.userData.heroSkin={mesh,bones};return mesh;
}
window.buildHero=function(g,lk){
 const old=g.userData.heroSkin;if(old){if(old.mixer){old.mixer.stopAllAction();old.mixer.uncacheRoot(old.mesh)}old.mesh.skeleton.dispose();old.mesh.material.dispose();g.userData.heroSkin=null}
 const result=previous.call(this,g,lk);skin(g);return result;
};
window.heroSkinParts=names.slice();
try{if(typeof pl!=='undefined'&&pl)window.buildHero(pl,look||DLOOK);if(typeof hp2!=='undefined'&&hp2)window.buildHero(hp2,look||DLOOK)}catch(e){console.warn('hero-skeleton init',e)}
})();
