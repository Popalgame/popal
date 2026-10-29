(function(){
 try{
 if(typeof THREE==='undefined'||typeof sc==='undefined'||typeof ANI==='undefined'||typeof cam==='undefined')return;
 /* Віньєтка/сяйво */
 const fx=document.createElement('div');fx.id='plfx';document.body.insertBefore(fx,document.body.firstChild);

 /* Хмари: видно, коли гравець нахиляє камеру до горизонту */
 const cm=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.92,fog:false,depthWrite:false});
 const sg=new THREE.SphereGeometry(1,10,8),CG=new THREE.Group(),clouds=[],PER=100;sc.add(CG);
 for(let i=0;i<9;i++){
  const c=new THREE.Group(),n=3+i%3;
  for(let k=0;k<n;k++){const m=new THREE.Mesh(sg,cm),s=2.4+Math.random()*1.8;m.scale.set(s*1.6,s*.55,s);m.position.set((k-n/2)*2.6,Math.random()*.7,(Math.random()-.5)*1.6);c.add(m)}
  c.userData={ox:Math.random()*PER,oz:Math.random()*PER-PER/2,y:18+Math.random()*6,sp:.5+Math.random()*.5};
  CG.add(c);clouds.push(c);
 }
 const wr=v=>((v+PER/2)%PER+PER)%PER-PER/2;
 ANI.push(t=>{const cx=cam.position.x,cz=cam.position.z;for(const c of clouds){const u=c.userData;c.position.set(cx+wr(u.ox+t*u.sp-cx),u.y,cz+wr(u.oz-cz))}});

 /* Частинки */
 const cv=document.createElement('canvas');cv.width=cv.height=32;const g=cv.getContext('2d'),gr=g.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'#fff');gr.addColorStop(.5,'rgba(255,255,255,.7)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,32,32);
 const ptex=new THREE.CanvasTexture(cv),bursts=[];let last=performance.now();
 function burst(x,y,z,col,n,sp,size){
  n=n||18;sp=sp||2.4;
  const pos=new Float32Array(n*3),vel=[];
  for(let i=0;i<n;i++){pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z;const a=Math.random()*6.283,u=Math.random()*.9+.2;vel.push(Math.cos(a)*sp*u,(Math.random()*.8+.4)*sp,Math.sin(a)*sp*u)}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({color:col,size:size||.32,map:ptex,transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending});
  const p=new THREE.Points(geo,mat);p.frustumCulled=false;sc.add(p);bursts.push({p,geo,mat,vel,t:0,n});
 }
 window.plBurst=burst;
 ANI.push(()=>{
  const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;
  for(let i=bursts.length-1;i>=0;i--){
   const b=bursts[i];b.t+=dt;const a=b.geo.attributes.position.array;
   for(let k=0;k<b.n;k++){b.vel[k*3+1]-=7*dt;a[k*3]+=b.vel[k*3]*dt;a[k*3+1]+=b.vel[k*3+1]*dt;a[k*3+2]+=b.vel[k*3+2]*dt}
   b.geo.attributes.position.needsUpdate=true;b.mat.opacity=Math.max(0,1-b.t/.8);
   if(b.t>=.8){sc.remove(b.p);b.geo.dispose();b.mat.dispose();bursts.splice(i,1)}
  }
 });


 /* Пульсація кнопки «Дія», коли поруч є з чим взаємодіяти */
 const hb=document.getElementById('hit');let ct=0;
 if(hb&&typeof nearest==='function')ANI.push(()=>{if(++ct%12)return;try{
  const on=NPCS.some(n=>Math.hypot(n.x-P.x,n.z-P.z)<3.2)||nearest(wild,2.6)||nearest(bushes,2.2)||nearest(shrooms,2)||nearest(trees,2.4)||nearest(rocks,2.4);
  hb.classList.toggle('near',!!on)}catch(e){}});
 }catch(e){console.warn('polish:',e)}
})();
