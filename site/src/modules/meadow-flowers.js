/* global fm */
/* Replace the original instanced flower spheres when the Blender asset is ready. */
(()=>{
if(!THREE.GLTFLoader)return;
new THREE.GLTFLoader().load('assets/models/meadow-flowers.glb',gltf=>{
 let source=null;
 gltf.scene.updateMatrixWorld(true);
 gltf.scene.traverse(node=>{if(node.isMesh&&node.name==='MeadowFlower')source=node});
 if(!source||!source.geometry||!source.geometry.attributes.color){
  console.warn('meadow flowers: invalid mesh asset; keeping spheres');return;
 }
 const geometry=source.geometry.clone();
 geometry.applyMatrix4(source.matrixWorld);
 geometry.computeBoundingBox();
 const bounds=geometry.boundingBox;
 const triangles=geometry.index?geometry.index.count/3:geometry.attributes.position.count/3;
 if(triangles>90||bounds.min.y<-.15||bounds.min.y>-.05||bounds.max.y>.55||
    bounds.max.x-bounds.min.x>.5||bounds.max.z-bounds.min.z>.5){
  geometry.dispose();console.warn('meadow flowers: geometry outside placement budget');return;
 }
 const vertexColors=geometry.attributes.color;
 const petalMask=new Float32Array(vertexColors.count);
 for(let i=0;i<vertexColors.count;i++){
  petalMask[i]=vertexColors.getX(i)>.8&&vertexColors.getZ(i)>.6?1:0;
 }
 const tones=new Float32Array(fm.count);
 const palette=[0,.28,.65,1];
 for(let i=0;i<tones.length;i++){
  let seed=Math.imul(i+1,0x9e3779b1);
  seed^=seed>>>16;
  seed=Math.imul(seed,0x85ebca6b);
  tones[i]=palette[(seed^(seed>>>13))&3];
 }
 geometry.setAttribute('flowerPetal',new THREE.Float32BufferAttribute(petalMask,1));
 geometry.setAttribute('flowerTone',new THREE.InstancedBufferAttribute(tones,1));
 const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.85,side:THREE.DoubleSide});
 const sway={value:0};
 material.onBeforeCompile=shader=>{
  shader.uniforms.flowerTime=sway;
  shader.vertexShader='uniform float flowerTime;\nattribute float flowerPetal;\nattribute float flowerTone;\nvarying float vFlowerTone;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nvFlowerTone = flowerPetal * flowerTone;\nfloat flowerBend = max(0.0, position.y + 0.1);\ntransformed.x += flowerBend * 0.035 * sin(flowerTime * 1.7 + instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23);');
  shader.fragmentShader='varying float vFlowerTone;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
   '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.94, 0.84), vFlowerTone * 0.88);');
 };
 const previousGeometry=fm.geometry;
 const previousMaterial=fm.material;
 fm.geometry=geometry;
 fm.material=material;
 // Instance tint would multiply the green stems as well as the petals.
 for(let i=0;i<fm.count;i++)fm.setColorAt(i,new THREE.Color(0xffffff));
 fm.instanceColor.needsUpdate=true;
 previousGeometry.dispose();
 previousMaterial.dispose();
 ANI.push(time=>{sway.value=time});
},undefined,error=>console.warn('meadow flowers: keeping spheres',error));
})();
