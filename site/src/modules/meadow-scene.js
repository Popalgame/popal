/* Original expedition landmark: terrain-fitted stonework, no external assets. */
(function(){try{
 if(typeof THREE==='undefined'||!window.H)return;
 const root=new THREE.Group();root.name='MeadowWaygate';
 // Keep existing player buildings clear. The scenery is never stored as inventory.
 const spots=[[14,-8],[19,-11],[24,-13.5]];
 const occupied=(x,z)=>(inv._b||[]).some(b=>Number.isFinite(b[2])&&Math.hypot(b[2]-x,b[3]-z)<7)||(inv._ch||[]).some(c=>Math.hypot(c.x-x,c.z-z)<6)||(inv._cen&&Math.hypot(inv._cen[0]-x,inv._cen[1]-z)<9);
 const spot=spots.find(([x,z])=>!occupied(x,z)&&H(x,z)>-.2);if(!spot)return;
 const [cx,cz]=spot,angle=-1.064,base=H(cx,cz),obstacles=[];
 root.position.set(cx,base,cz);root.rotation.y=angle;
 const texture=document.createElement('canvas');texture.width=texture.height=128;const ctx=texture.getContext('2d');
 ctx.fillStyle='#aaa79e';ctx.fillRect(0,0,128,128);let seed=171;
 const rnd=()=>{seed=seed*16807%2147483647;return seed/2147483647};
 for(let i=0;i<1600;i++){const value=130+Math.floor(rnd()*90);ctx.fillStyle=`rgba(${value},${value},${value-8},.35)`;ctx.fillRect(rnd()*128,rnd()*128,1+rnd()*4,1+rnd()*3)}
 for(let i=0;i<12;i++){const y=i*11;ctx.strokeStyle='rgba(55,56,47,.15)';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y+6*rnd());ctx.stroke()}
 const tex=new THREE.CanvasTexture(texture);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.encoding=THREE.sRGBEncoding;
 const stone=new THREE.MeshStandardMaterial({color:0xb2b2a2,map:tex,bumpMap:tex,bumpScale:.035,roughness:.95});
 const dark=new THREE.MeshStandardMaterial({color:0x737a66,map:tex,roughness:1});
 const moss=new THREE.MeshStandardMaterial({color:0x536e34,roughness:1});
 const bronze=new THREE.MeshStandardMaterial({color:0xa68b54,metalness:.65,roughness:.6});
 const shape=new THREE.Shape();shape.moveTo(-.5,-.5);shape.lineTo(.5,-.5);shape.lineTo(.5,.5);shape.lineTo(-.5,.5);shape.closePath();
 const block=new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.045,bevelThickness:.045,curveSegments:1});block.translate(0,0,-.5);
 const add=(geo,mat,x,y,z,sx,sy,sz,rz=0)=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.z=rz;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh};
 const world=(x,z)=>[cx+Math.cos(angle)*x+Math.sin(angle)*z,cz-Math.sin(angle)*x+Math.cos(angle)*z];
 for(const side of [-1,1]){
  const x=side*2.12,[wx,wz]=world(x,0),ground=H(wx,wz)-base;
  add(block,dark,x,ground+.18,0,.94,.34,1.04);
  const course=(2.24-ground-.36)/4;
  for(let i=0;i<4;i++)add(block,stone,x+Math.sin(i*3+side)*.025,ground+.36+(i+.5)*course,0,.65,course-.025,.74);
  add(block,dark,x,2.36,0,.94,.22,.9);
  add(block,moss,x-.04,ground+.37,.02,.73,.055,.81);
  obstacles.push({x:wx,z:wz,r:.57,h:2.65});
 }
 // Wedge-shaped voussoirs form an open arch, rather than a solid collision wall.
 for(let i=0;i<11;i++){
  const a=i*Math.PI/11+.015,b=(i+1)*Math.PI/11-.015,inner=1.8,outer=2.43;
  const wedge=new THREE.Shape();wedge.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);wedge.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);wedge.lineTo(Math.cos(b)*outer,Math.sin(b)*outer);wedge.lineTo(Math.cos(b)*inner,Math.sin(b)*inner);wedge.closePath();
  const geo=new THREE.ExtrudeGeometry(wedge,{depth:.7,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1,curveSegments:1});geo.translate(0,0,-.35);add(geo,i===5?dark:stone,0,2.4,0,1,1,1);
 }
 const emblem=new THREE.TorusGeometry(.16,.024,5,16);add(emblem,bronze,0,4.45,.4,1,1,1);
 add(new THREE.OctahedronGeometry(.12,0),bronze,0,4.45,.43,.65,1.3,.3);
 // Low, walkable pavers sit on the actual terrain along the route.
 for(let i=0;i<12;i++){const x=(rnd()-.5)*1.1,z=(i-5.5)*.62,[wx,wz]=world(x,z);add(block,i%3?stone:dark,x,H(wx,wz)-base+.015,z,.55+rnd()*.3,.025,.4+rnd()*.14,(rnd()-.5)*.15)}
 // Keep the passage open; these are generated resources, never player structures.
 for(let i=trees.length-1;i>=0;i--){const tree=trees[i],dx=tree.x-cx,dz=tree.z-cz;
  const localX=Math.cos(angle)*dx-Math.sin(angle)*dz,localZ=Math.sin(angle)*dx+Math.cos(angle)*dz;
  if(Math.abs(localX)<3&&Math.abs(localZ)<1.8){sc.remove(tree.m);trees.splice(i,1)}
 }
 sc.add(root);window.plSceneryObstacles=obstacles;
 if(window.plBatchModel)window.plBatchModel(root,new Set());
 root.updateMatrixWorld(true);root.traverse(m=>{m.matrixAutoUpdate=false});
 let checkedAt=0;ANI.push(()=>{const now=performance.now();if(now-checkedAt<500)return;checkedAt=now;root.visible=Math.hypot(P.x-cx,P.z-cz)<(sc.fog?sc.fog.far:80)+8});
 window.plMeadow={center:{x:cx,z:cz},root,obstacles};
 // One ordinary neutral encounter near the first trail; no free inventory or recurring spawn.
 if(!hasSave)ang=-.72;
 const encounter=wild.find(w=>w.ty===4);
 if(encounter&&!hasSave){const [x,z]=world(-3.5,2.5);if(H(x,z)>-.3){encounter.x=x;encounter.z=z;encounter.a=0;encounter.t=10;encounter.stop=true;encounter.m.position.set(x,H(x,z),z)}}
}catch(error){console.warn('meadow-scene',error)}})();
