/* 0.3.2: Локація 2 — ворота на півночі, у Локацію 3 (поки зачинені: «ще будується»). */
(function(){try{
if(window.REALM==='isle'||typeof sc=='undefined')return;
let gz=-196;while(gz<-150&&H(0,gz)<-.2)gz+=1;const G=[0,gz];
const g=new THREE.Group(),st=new THREE.MeshStandardMaterial({color:0x8d8578,roughness:1,flatShading:true}),dk=new THREE.MeshStandardMaterial({color:0x3a3430,roughness:.8,metalness:.3}),gold=new THREE.MeshStandardMaterial({color:0xd8a948,roughness:.35,metalness:.8});
for(const sx of[-3.2,3.2]){const p=new THREE.Mesh(new THREE.BoxGeometry(1.4,7,1.4),st);p.position.set(sx,3.5,0);p.castShadow=true;g.add(p);const c=new THREE.Mesh(new THREE.BoxGeometry(1.8,.5,1.8),st);c.position.set(sx,7.2,0);g.add(c)}
const top=new THREE.Mesh(new THREE.BoxGeometry(8.6,1.1,1.6),st);top.position.y=7.8;g.add(top);
for(let i=-2;i<=2;i++){const b=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,6.2,6),dk);b.position.set(i*1.05,3.1,0);g.add(b)}
for(const y of[1.6,4.4]){const b=new THREE.Mesh(new THREE.BoxGeometry(5.2,.16,.16),dk);b.position.y=y;g.add(b)}
const sign=new THREE.Mesh(new THREE.BoxGeometry(3.2,.7,.12),gold);sign.position.set(0,8.6,.82);g.add(sign);
g.position.set(G[0],H(G[0],G[1]),G[1]);sc.add(g);
window.LOC3_GATE=G;
const near=()=>Math.hypot(P.x-G[0],P.z-G[1])<4.5;let t=0;
ANI.push(()=>{if(near()&&performance.now()-t>6000){t=performance.now();try{msg('🚧 Шлях у Локацію 3 ще будується. Повертайтеся згодом!')}catch(_){}}});
}catch(e){console.warn('loc2',e)}})();
