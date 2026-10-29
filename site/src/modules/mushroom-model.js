/* One shared, vertex-colored mesh per collectible mushroom cluster. */
(function(){try{
if(typeof THREE==='undefined'||typeof shrooms==='undefined'||typeof mkShroom!=='function'||!THREE.GLTFLoader)return;

new THREE.GLTFLoader().load('assets/models/mushroom.glb',gltf=>{
 const meshes=[];
 gltf.scene.traverse(node=>{if(node.isMesh)meshes.push(node)});
 const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3());
 if(meshes.length!==1||!meshes[0].geometry?.attributes.position||!meshes[0].geometry.attributes.color||
  meshes[0].geometry.attributes.position.count>2000||!Number.isFinite(size.y)||
  bounds.min.y<-.04||bounds.min.y>.04||size.y<.25||size.y>.85||size.x>.9||size.z>.9){
  console.warn('mushrooms: invalid model; retaining procedural mushrooms');return;
 }
 const source=meshes[0];source.updateWorldMatrix(true,false);
 const geometry=source.geometry,material=source.material;
 function appearance(root){
  const old=[];root.traverse(node=>{if(node!==root&&node.isMesh&&node.geometry)old.push(node.geometry)});
  root.clear();
  const mesh=new THREE.Mesh(geometry,material);
  source.matrixWorld.decompose(mesh.position,mesh.quaternion,mesh.scale);
  // Vary the cluster itself so hit feedback on the root cannot erase its size.
  mesh.rotateY(Math.random()*Math.PI*2);mesh.scale.multiplyScalar(.85+Math.random()*.3);
  mesh.castShadow=false;mesh.receiveShadow=true;
  root.add(mesh);
  for(const geo of new Set(old))if(geo!==geometry)geo.dispose();
 }
 for(const shroom of shrooms)if(shroom.m)appearance(shroom.m);
 mkShroom=function(){const root=new THREE.Group();appearance(root);return root};
},undefined,error=>console.warn('mushrooms: procedural fallback',error));
}catch(error){console.warn('mushrooms:',error)}})();
