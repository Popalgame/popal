/* 0.1.16: краща графіка — деталізована земля (плями, відтінки, скелясті схили), жива вода (хвилі, відблиски, мілина й піна біля берега),
   вітер у деревах, кущах і траві, делікатніші частинки вдень і світлячки вночі.
   Опція «Ефекти: Висока» — світіння (bloom) ліхтарів, вогню й відблисків і чіткіші тіні; для слабких телефонів — «Звичайні». */
(function(){try{
const G=n=>{try{return eval(n)}catch(e){return undefined}};
const SC=G('sc'),RR=G('R'),CAM=G('cam');if(!SC||!RR||typeof THREE==='undefined')return;
const U={uT:{value:0},uActor:{value:new THREE.Vector2()}};
ANI.push(()=>{U.uT.value=performance.now()/1000%3600;U.uActor.value.set(P.x,P.z)});

/* ---------- тайловий шум у 3 каналах ---------- */
function vnoise(S,cell,seed){const n=S/cell,g=new Float32Array(n*n);let s=seed;for(let i=0;i<g.length;i++){s=(s*16807)%2147483647;g[i]=s/2147483647}
 const at=(x,y)=>g[((y%n+n)%n)*n+((x%n+n)%n)];
 return(x,y)=>{const gx=x/cell,gy=y/cell,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const a=at(ix,iy),b=at(ix+1,iy),c=at(ix,iy+1),d=at(ix+1,iy+1);return a+(b-a)*sx+(c-a+(a-b+d-c)*sx)*sy}}
function noiseTex(S,seed){const c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),im=x.createImageData(S,S);
 const ch=[0,1,2].map(k=>[[S/4,.5],[S/8,.3],[S/16,.2]].map(([cl,w],i)=>[vnoise(S,cl,seed+k*101+i*7),w]));
 for(let y=0;y<S;y++)for(let X=0;X<S;X++){const i=(y*S+X)*4;for(let k=0;k<3;k++){let v=0;for(const[f,w]of ch[k])v+=f(X,y)*w;im.data[i+k]=Math.max(0,Math.min(255,(v-.5)*2.2*128+128))}im.data[i+3]=255}
 x.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;try{t.anisotropy=Math.min(4,RR.capabilities.getMaxAnisotropy())}catch(_){}return t}
const DET=noiseTex(128,7);

/* ---------- земля: деталь у світових координатах + скелясті схили ---------- */
const GR=G('gr');
if(GR&&GR.material){const m=GR.material;
 m.onBeforeCompile=s=>{s.uniforms.uDet={value:DET};
  s.vertexShader='varying vec3 vWP;varying vec3 vWN;\n'+s.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvWN=normalize(mat3(modelMatrix)*objectNormal);')
   .replace('#include <project_vertex>','#include <project_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
  s.fragmentShader='uniform sampler2D uDet;varying vec3 vWP;varying vec3 vWN;\n'+s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
  vec4 d1=texture2D(uDet,vWP.xz*.085),d2=texture2D(uDet,vWP.xz*.019+.37),d3=texture2D(uDet,vWP.xz*.6);
  float nn=d1.r*.5+d2.g*.32+d3.b*.28;
  vec3 c=diffuseColor.rgb*(.79+.38*nn);
  c=mix(c,c*vec3(1.04,1.02,.90),smoothstep(.58,.82,d2.r)*.35);
  c=mix(c,c*vec3(.85,.97,.91),smoothstep(.6,.85,d2.b)*.35);
  float grit=smoothstep(.69,.85,d3.r)*(1.-smoothstep(.55,.76,d3.g));
  c*=1.-grit*.08;
  float sl=(1.-smoothstep(.6,.84,vWN.y))*step(-.2,vWP.y);
  c=mix(c,vec3(.27,.265,.24)*(.75+.5*d3.r)*(.87+.25*d1.g),sl);
  diffuseColor.rgb=c;`);};
 m.customProgramCacheKey=()=>'pl-ground';m.needsUpdate=true}

/* ---------- вода ---------- */
const WT=G('water'),HF=G('H'),WR=(G('WG_R')||250);
if(WT&&WT.material&&HF){
 const S=256,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),im=x.createImageData(S,S);
 for(let j=0;j<S;j++)for(let i=0;i<S;i++){const wx=-WR+(i+.5)/S*2*WR,wz=-WR+(j+.5)/S*2*WR;let h=0;try{h=HF(wx,wz)}catch(_){}const d=Math.max(0,Math.min(1,(-.5-h)/3.2)),k=(j*S+i)*4;im.data[k]=im.data[k+1]=im.data[k+2]=d*255;im.data[k+3]=255}
 x.putImageData(im,0,0);const DT=new THREE.CanvasTexture(c);DT.wrapS=DT.wrapT=THREE.ClampToEdgeWrapping;DT.flipY=false;
 const m=WT.material;m.roughness=.16;m.opacity=1;WT.userData.noFreeze=1;
 m.onBeforeCompile=s=>{s.uniforms.uT=U.uT;s.uniforms.uDep={value:DT};s.uniforms.uR={value:WR};
  s.vertexShader='varying vec3 vWP;\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
  s.fragmentShader='uniform float uT;uniform sampler2D uDep;uniform float uR;varying vec3 vWP;\n'+s.fragmentShader
  .replace('#include <color_fragment>',`#include <color_fragment>
  vec2 tuv=(vWP.xz+uR)/(2.*uR);
  float dep=(tuv.x<0.||tuv.x>1.||tuv.y<0.||tuv.y>1.)?1.:texture2D(uDep,tuv).r;
  vec3 wc=mix(vec3(.10,.49,.43),vec3(.025,.16,.29),smoothstep(0.,.6,dep));
  float fres=pow(1.-clamp(dot(normalize(cameraPosition-vWP),vec3(0.,1.,0.)),0.,1.),3.);
  wc=mix(wc,vec3(.37,.66,.79),fres*.5);
  float caustic=pow(max(0.,sin(vWP.x*2.4+uT*.7)*sin(vWP.z*2.1-uT*.5)),9.);
  wc+=vec3(.07,.13,.10)*caustic*(1.-smoothstep(.04,.4,dep));
  float fn=sin(vWP.x*1.7+uT*1.3)*sin(vWP.z*1.9-uT*1.1)*.5+.5;
  float foam=(1.-smoothstep(0.,.045+.035*fn,dep))*(.6+.4*sin(uT*2.2-dep*110.));
  foam=clamp(foam,0.,1.);
  wc=mix(wc,vec3(.92,.96,1.),foam*.8);
  diffuseColor.rgb=wc;diffuseColor.a=clamp(mix(.55,.9,smoothstep(0.,.45,dep))+foam*.35,0.,1.);`)
  .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  {vec2 p=vWP.xz;float t=uT;vec2 g=vec2(0.);
  g+=vec2(.8,.6)*cos(dot(p,vec2(.8,.6))*.9+t*1.2)*.054;
  g+=vec2(-.5,.86)*cos(dot(p,vec2(-.5,.86))*1.7+t*1.7)*.051;
  g+=vec2(.2,-.98)*cos(dot(p,vec2(.2,-.98))*3.1+t*2.3)*.037;
  g+=vec2(-.95,-.3)*cos(dot(p,vec2(-.95,-.3))*5.3+t*3.1)*.022;
  normal=normalize((viewMatrix*vec4(normalize(vec3(-g.x,1.,-g.y)),0.)).xyz);}`);};
 m.customProgramCacheKey=()=>'pl-water';m.needsUpdate=true}

/* ---------- вітер ---------- */
const WIND={},windMat=(src,mode)=>{const key=src.uuid+mode;if(WIND[key])return WIND[key];const m=src.clone();
 m.onBeforeCompile=s=>{s.uniforms.uT=U.uT;s.uniforms.uActor=U.uActor;
  s.vertexShader='uniform float uT;uniform vec2 uActor;varying float vBlade;\n'+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  #ifdef USE_INSTANCING
  vec3 wb=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
  #else
  vec3 wb=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
  #endif
  float wp=uT*1.6+wb.x*.33+wb.z*.27,gust=.65+.35*sin(uT*.37+wb.x*.02);
  vBlade=uv.y;
  ${mode==0?`float k=vBlade*vBlade;
   vec2 away=wb.xz-uActor;float nearActor=1.-smoothstep(.15,1.1,length(away));
   float wave=sin(wb.x*.48+wb.z*.31-uT*1.45)*.5+.5;
   vec2 bend=vec2(.75,.4)*(.025+.065*wave)*gust+vec2(sin(wp*2.1),cos(wp*1.7))*.012;
   bend+=away/max(length(away),.05)*nearActor*.22;
   // Convert world wind into the rotated tuft's local space.
   transformed.x+=dot(bend,normalize(instanceMatrix[0].xz))*k;
   transformed.z+=dot(bend,normalize(instanceMatrix[2].xz))*k;
   transformed.y-=nearActor*k*.12;`
   :mode==1?`float tip=.45+.55*smoothstep(-.5,.8,position.y);transformed.x+=sin(wp)*.045*gust*tip+sin(uT*4.7+position.y*6.+position.x*4.)*.012;transformed.z+=cos(wp*.9)*.035*gust*tip+cos(uT*5.3+position.z*5.)*.01;`
   :`transformed.x+=sin(wp*1.3)*.025*gust;transformed.z+=cos(wp)*.02*gust;`}`);
  if(mode===0)s.fragmentShader='varying float vBlade;\n'+s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(vec3(.48,.62,.32),vec3(1.12,1.12,.82),smoothstep(0.,1.,vBlade));').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mat3(viewMatrix)*vec3(0.,1.,0.));');};
 m.customProgramCacheKey=()=>'pl-wind'+mode;return WIND[key]=m};
window.plWind=windMat;/* 0.1.28: для нових дерев (trees.js) */
const GM=G('gm');if(GM&&GM.material){
 // Nine narrow curved leaves per tuft, with roots sunk slightly into the soil.
 const blade=new THREE.BufferGeometry(),pos=[],uv=[],col=[],indices=[];
 for(let leaf=0;leaf<9;leaf++){
  const angle=leaf*2.39996,dx=Math.cos(angle),dz=Math.sin(angle),height=.20+(leaf%4)*.055;
  const spread=.065+(leaf%3)*.06,width=.012+(leaf%3)*.003,lean=.09+(leaf%4)*.03,start=pos.length/3;
  for(let row=0;row<4;row++){
   const t=row/3,w=width*(1-t)*(.8+.5*Math.sin(t*Math.PI)),curve=spread+t*t*lean;
   for(const side of [-1,1]){
    pos.push(dx*curve-dz*w*side,height*t-.035,dz*curve+dx*w*side);
    uv.push((side+1)/2,t);const shade=.91+(leaf%3)*.045;col.push(shade,shade,shade);
   }
  }
  for(let row=0;row<3;row++){const n=start+row*2;indices.push(n,n+1,n+2);if(row<2)indices.push(n+2,n+1,n+3)}
 }
 blade.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 blade.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 blade.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 blade.setIndex(indices);blade.computeVertexNormals();blade.computeBoundingSphere();
 GM.geometry.dispose();GM.geometry=blade;GM.material=windMat(GM.material,0);GM.material.side=THREE.DoubleSide;GM.material.roughness=1;GM.material.color.setHex(0xd1dbb3);GM.material.vertexColors=true;GM.material.needsUpdate=true;
 GM.receiveShadow=true;

}
function windTree(g){g.children.forEach((c,i)=>{if(i>0&&c.isMesh&&c.geometry&&c.geometry.type=='IcosahedronGeometry')c.material=windMat(c.material,1)});return g}
function windBush(g){g.children.forEach(c=>{if(c.isMesh)c.material=windMat(c.material,2)});return g}
for(const o of G('trees')||[])windTree(o.m);for(const o of G('bushes')||[])windBush(o.m);
try{const _mt=mkTree;mkTree=function(){return windTree(_mt.apply(this,arguments))}}catch(_){}
try{const _mb=mkBush;mkBush=function(){return windBush(_mb.apply(this,arguments))}}catch(_){}

/* ---------- частинки: вдень ледь помітний пилок, уночі — світлячки ---------- */
const PTS=G('pts'),DAYC=new THREE.Color(0xfff6d8),NIGHTC=new THREE.Color(0xc8ff7a);
if(PTS&&PTS.material){const pm=PTS.material;ANI.push(()=>{const n=window.isNight&&isNight()?1:0,f=pm.userData.f=(pm.userData.f||0)+(n-(pm.userData.f||0))*.02;
 pm.opacity=.22+.78*f;pm.size=.22+.16*f;pm.color.copy(DAYC).lerp(NIGHTC,f)})}

/* ---------- «Ефекти: Висока» — bloom + чіткіші тіні ---------- */
const KEY='zi_gfx2';let Q={hq:matchMedia&&matchMedia('(pointer:fine)').matches?1:0};
try{Object.assign(Q,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(_){}
const sv=()=>{try{localStorage.setItem(KEY,JSON.stringify(Q))}catch(_){}};
const SUN=G('sun');
function applyShadow(){if(!SUN)return;const n=Q.hq?2048:1024;if(SUN.shadow.mapSize.x!==n){SUN.shadow.mapSize.set(n,n);if(SUN.shadow.map){SUN.shadow.map.dispose();SUN.shadow.map=null}}}
applyShadow();
/* Один конвеєр постобробки — premium-fx.js. Налаштування якості спільні. */
/* вкладка «Графіка» (раніше «Опції»): перемикач якості ефектів поруч з іншими налаштуваннями графіки */
const _pf=pfTab;pfTab=function(t){_pf.apply(this,arguments);if(t!='o'&&t!='g')return;const host=document.getElementById('gfxp');if(!host||document.getElementById('gfxq'))return;
 const d=document.createElement('div');d.id='gfxq';
 d.innerHTML=`<h4>Ефекти</h4><div class='gseg' id='gq'>${['Звичайні','Висока якість'].map((a,i)=>`<button data-i='${i}' class='${i==Q.hq?'on':''}'>${a}</button>`).join('')}</div><small class='gnote'>Висока — світіння вогню й ліхтарів, чіткіші тіні. Для потужних телефонів і ПК</small>`;
 host.appendChild(d);d.querySelectorAll('#gq button').forEach(b=>b.onclick=()=>{Q.hq=+b.dataset.i;sv();applyShadow();d.querySelectorAll('#gq button').forEach(x=>x.classList.toggle('on',x===b))})};
window.plVis={U,Q,setHQ:v=>{Q.hq=v?1:0;applyShadow();document.querySelectorAll('#gq button').forEach(b=>b.classList.toggle('on',+b.dataset.i===Q.hq))}};
}catch(e){console.warn('visuals',e)}})();
