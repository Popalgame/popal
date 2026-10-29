/* Stylized berry bushes. Keep resource objects and their gameplay state intact. */
(function(){try{
if(typeof THREE==='undefined'||typeof bushes==='undefined'||typeof mkBush!=='function')return;

function fallback(){
 const root=new THREE.Group();
 const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.35,1),new THREE.MeshStandardMaterial({color:0x236f32,roughness:1,flatShading:true}));
 core.position.y=.38;core.scale.set(1.22,.85,1);root.add(core);
 const leafPositions=[],berryPositions=[];
 function triangle(target,a,b,c){target.push(...a,...b,...c)}
 for(let i=0;i<18;i++){
  const angle=i*Math.PI*2/18,r=i%2?.35:.27,y=i%3?.48:.61;
  const x=Math.cos(angle)*r,z=Math.sin(angle)*r,dx=Math.cos(angle),dz=Math.sin(angle),tx=-dz,tz=dx;
  const base=[x-dx*.09,y,z-dz*.09],left=[x+tx*.085,y+.025,z+tz*.085],right=[x-tx*.085,y+.025,z-tz*.085],tip=[x+dx*.19,y+(i%2?.04:-.045),z+dz*.19];
  triangle(leafPositions,base,left,tip);triangle(leafPositions,base,tip,right);
 }
 const leafGeo=new THREE.BufferGeometry();leafGeo.setAttribute('position',new THREE.Float32BufferAttribute(leafPositions,3));leafGeo.computeVertexNormals();
 root.add(new THREE.Mesh(leafGeo,new THREE.MeshStandardMaterial({color:0x4eb843,roughness:1,side:THREE.DoubleSide})));
 for(let i=0;i<12;i++){
  const angle=i*Math.PI*2/12+.2,x=Math.cos(angle)*.42,z=Math.sin(angle)*.38,y=.34+(i%3)*.07,r=.055;
  const top=[x,y+r,z],bottom=[x,y-r,z],east=[x+r,y,z],west=[x-r,y,z],north=[x,y,z+r],south=[x,y,z-r];
  for(const face of [[top,east,north],[top,north,west],[top,west,south],[top,south,east],[bottom,north,east],[bottom,west,north],[bottom,south,west],[bottom,east,south]])triangle(berryPositions,...face);
 }
 const berryGeo=new THREE.BufferGeometry();berryGeo.setAttribute('position',new THREE.Float32BufferAttribute(berryPositions,3));berryGeo.computeVertexNormals();
 root.add(new THREE.Mesh(berryGeo,new THREE.MeshStandardMaterial({color:0x344fb7,roughness:.65,flatShading:true})));
 return root;
}

let template=fallback();
function appearance(root){
 for(const child of [...root.children])root.remove(child);
 for(const child of template.children){const mesh=child.clone();mesh.castShadow=false;mesh.receiveShadow=true;root.add(mesh)}
}
for(const bush of bushes)if(bush.m){
 // The original bush meshes own their geometries; their materials are shared.
 bush.m.traverse(node=>{if(node.isMesh&&node.geometry)node.geometry.dispose()});
 appearance(bush.m);
}
mkBush=function(){const root=new THREE.Group();appearance(root);return root};

if(!THREE.GLTFLoader)return;
new THREE.GLTFLoader().load('assets/models/berry-bush.glb',gltf=>{
 const model=gltf.scene,meshes=[];
 model.traverse(node=>{if(node.isMesh)meshes.push(node)});
 const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
 if(meshes.length!==1||meshes.some(mesh=>!mesh.geometry||!mesh.geometry.attributes.position||!mesh.geometry.attributes.color||mesh.geometry.attributes.position.count>6000)||
  !Number.isFinite(size.y)||bounds.min.y<-.12||bounds.min.y>.12||size.y<.4||size.y>1.2||size.x>1.6||size.z>1.6){
  console.warn('berry bushes: invalid model; retaining procedural bushes');return;
 }
 const next=new THREE.Group();
 for(const mesh of meshes){mesh.updateWorldMatrix(true,false);const child=mesh.clone();mesh.matrixWorld.decompose(child.position,child.quaternion,child.scale);next.add(child)}
 const old=template;template=next;
 for(const bush of bushes)if(bush.m)appearance(bush.m);
 old.traverse(node=>{if(node.isMesh){node.geometry.dispose();node.material.dispose()}});
},undefined,error=>console.warn('berry bushes: procedural fallback',error));
}catch(error){console.warn('berry bushes:',error)}})();
