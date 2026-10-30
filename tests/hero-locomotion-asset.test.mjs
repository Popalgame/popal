import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const env={console};env.window=env;env.self=env;vm.createContext(env);
vm.runInContext(readFileSync(new URL('../site/three.min.js',import.meta.url),'utf8'),env);
const T=env.THREE;
function glb(path){
 const bytes=readFileSync(new URL(path,import.meta.url)),length=bytes.readUInt32LE(12);
 return {json:JSON.parse(bytes.subarray(20,20+length).toString()),bin:bytes.subarray(28+length)};
}
function values(asset,index){
 const a=asset.json.accessors[index],view=asset.json.bufferViews[a.bufferView];
 assert.equal(a.componentType,5126);const count={SCALAR:1,VEC3:3,VEC4:4}[a.type],result=[];
 for(let i=0;i<a.count;i++)for(let j=0;j<count;j++)result.push(asset.bin.readFloatLE((view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||count*4)+j*4));
 return result;
}
function rig(asset){
 const nodes=asset.json.nodes.map(n=>{const o=new T.Bone();o.name=T.PropertyBinding.sanitizeNodeName(n.name||'');if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);return o});
 asset.json.nodes.forEach((n,i)=>(n.children||[]).forEach(j=>nodes[i].add(nodes[j])));
 const group=new T.Group();asset.json.scenes[asset.json.scene||0].nodes.forEach(i=>group.add(nodes[i]));
 return {group,bone:part=>nodes.find(n=>n.name.toLowerCase().replace(/[^a-z0-9]/g,'').endsWith(part.toLowerCase()))};
}
function clip(asset,animation){
 const tracks=animation.channels.map(c=>{
  const s=animation.samplers[c.sampler],name=T.PropertyBinding.sanitizeNodeName(asset.json.nodes[c.target.node].name),path={translation:'position',rotation:'quaternion',scale:'scale'}[c.target.path];
  assert.ok(['LINEAR','STEP'].includes(s.interpolation||'LINEAR'));
  if(s.interpolation==='STEP'){const v=values(asset,s.output),size=c.target.path==='rotation'?4:3;v.forEach((x,i)=>assert.ok(Math.abs(x-v[i%size])<.00001,'only constant channels may use STEP'));}
  const Type=c.target.path==='rotation'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack;
  return new Type(name+'.'+path,values(asset,s.input),values(asset,s.output),s.interpolation==='STEP'?T.InterpolateDiscrete:T.InterpolateLinear);
 });return new T.AnimationClip(animation.name,-1,tracks);
}
const asset=glb('../site/assets/models/hero-locomotion.glb');
const profiles=asset.json.scenes[0].extras.locomotion.profiles;
test('Blender locomotion preserves desktop/mobile rest rig and closes every loop',()=>{
 assert.equal(asset.json.meshes,undefined,'animation package adds no duplicate character mesh');
 assert.deepEqual(asset.json.animations.map(a=>a.name).sort(),['jog','run','walk']);
 for(const file of ['hero-rigged.glb','hero-mobile.glb']){
  const original=glb('../site/assets/models/'+file),byName=new Map(original.json.nodes.map(n=>[n.name,n]));
  for(const node of asset.json.nodes){
   const reference=byName.get(node.name);assert.ok(reference,'matching original bone '+node.name);
   for(const key of ['translation','rotation','scale']){
    const a=node[key]||({translation:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]})[key],b=reference[key]||({translation:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]})[key];
    const sign=key==='rotation'&&a.reduce((sum,v,i)=>sum+v*b[i],0)<0?-1:1;
    a.forEach((v,i)=>assert.ok(Math.abs(v-sign*b[i])<.0001,'rest transform '+node.name+'.'+key));
   }
  }
 }
 for(const a of asset.json.animations)for(const track of clip(asset,a).tracks){
  const size=track.getValueSize();for(const v of track.values)assert.ok(Number.isFinite(v));
  let error=0,opposite=0;for(let i=0;i<size;i++){error+=Math.abs(track.values[i]-track.values[track.values.length-size+i]);opposite+=Math.abs(track.values[i]+track.values[track.values.length-size+i])}if(size===4)error=Math.min(error,opposite);
  assert.ok(error<.001,'closed loop '+a.name+' '+track.name);
 }
});
test('baked legs stay in their lanes, bend forward and keep fixed lengths throughout each cycle',()=>{
 for(const a of asset.json.animations){
  const {group,bone}=rig(asset),animation=clip(asset,a),mixer=new T.AnimationMixer(group),action=mixer.clipAction(animation).play();
  const point=n=>bone(n).getWorldPosition(new T.Vector3()),lengths={};group.updateMatrixWorld(true);
  for(const side of ['Left','Right'])lengths[side]=[point(side+'UpLeg').distanceTo(point(side+'Leg')),point(side+'Leg').distanceTo(point(side+'Foot'))];
  for(let i=0;i<240;i++){
   action.time=i/240*animation.duration;mixer.update(0);group.updateMatrixWorld(true);
   for(const side of ['Left','Right']){
    const h=point(side+'UpLeg'),k=point(side+'Leg'),f=point(side+'Foot'),u=f.clone().sub(h),v=k.clone().sub(h);
    assert.ok(Math.abs(h.distanceTo(k)-lengths[side][0])<.0003,a.name+' fixed thigh');
    assert.ok(Math.abs(k.distanceTo(f)-lengths[side][1])<.0003,a.name+' fixed shin');
    assert.ok(u.z*v.y-u.y*v.z>.0001,a.name+' knee bends forward');
    assert.ok(f.y>.08,a.name+' foot clears flat ground throughout cycle at phase '+i/240+' height '+f.y);
    assert.ok(f.x*h.x>0,a.name+' own foot lane');assert.ok(Math.abs(f.x-h.x)<.05,a.name+' lateral weight shift bounded');
    const axis=f.clone().sub(h),bend=k.clone().sub(h),plane=new T.Vector3().crossVectors(axis,new T.Vector3(0,0,1)).normalize();
    assert.ok(Math.abs(bend.dot(plane))<.001,a.name+' knee bends in the hip-ankle plane');
   }
  }
 }
});
test('nominal speed cancels central stance foot travel on flat ground',()=>{
 for(const a of asset.json.animations){
  const {group,bone}=rig(asset),animation=clip(asset,a),mixer=new T.AnimationMixer(group),action=mixer.clipAction(animation).play(),profile=profiles[a.name];
  for(const [side,offset] of [['Left',0],['Right',.5]]){
   let previous=null;const velocities=[],heights=[];
   for(let i=0;i<500;i++){
    const phase=i/500,t=phase*animation.duration;action.time=t;mixer.update(0);group.updateMatrixWorld(true);
    const f=bone(side+'Foot').getWorldPosition(new T.Vector3());f.z+=profile.speed*t;
    const contact=(phase+offset)%1;
    if(previous&&contact>.025&&contact<profile.stance-.025){
     velocities.push(Math.abs(f.z-previous.z)/(animation.duration/500));heights.push(f.y);
    }
    previous=f;
   }
   velocities.sort((a,b)=>a-b);
   assert.ok(velocities.length>30,'enough contact samples');
   assert.ok(velocities.at(-1)<profile.speed*.04,a.name+' foot drift stays below 4% of nominal speed in central support');
   assert.ok(Math.min(...heights)>.09,a.name+' planted ankle clears the ground');
  }
 }
});

test('Blender combat closes back to embedded idle and animates the correct weapon hand',()=>{
 const combat=glb('../site/assets/models/hero-combat.glb'),original=glb('../site/assets/models/hero-rigged.glb');
 assert.equal(combat.json.meshes,undefined);assert.deepEqual(combat.json.animations.map(a=>a.name).sort(),['sword_hit','throw_right']);
 const idle=clip(original,original.json.animations.find(a=>a.name==='idle'));
 const reference=new Map(idle.tracks.map(t=>[t.name,t]));
 for(const a of combat.json.animations){
  const animation=clip(combat,a);assert.equal(animation.tracks.length,idle.tracks.length);
  for(const track of animation.tracks){
   assert.ok(reference.has(track.name),'same rig track '+track.name);
   const base=reference.get(track.name).values,size=track.getValueSize();
   for(const offset of [0,track.values.length-size]){
    let error=0,opposite=0;for(let i=0;i<size;i++){error+=Math.abs(track.values[offset+i]-base[i]);opposite+=Math.abs(track.values[offset+i]+base[i])}
    if(size===4)error=Math.min(error,opposite);assert.ok(error<.0001,a.name+' returns to idle '+track.name);
   }
  }
  const {group,bone}=rig(combat),mixer=new T.AnimationMixer(group),action=mixer.clipAction(animation).play(),left=[],right=[];
  for(let i=0;i<100;i++){action.time=i/99*animation.duration;mixer.update(0);group.updateMatrixWorld(true);left.push(bone('LeftHand').getWorldPosition(new T.Vector3()));right.push(bone('RightHand').getWorldPosition(new T.Vector3()))}
  const excursion=points=>Math.max(...points.map(p=>p.distanceTo(points[0]))),l=excursion(left),r=excursion(right);
  if(a.name==='sword_hit'){assert.ok(l>.3,'sword hand has a visible slash arc');assert.ok(r<l*.35,'right arm is not the attacking hand')}
  else{assert.ok(r>.2,'free right hand performs the throw');assert.ok(l<r*.4,'left sword stays carried during throw')}
 }
});
