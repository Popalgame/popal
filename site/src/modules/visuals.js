/* 0.1.16: краща графіка — деталізована земля (плями, відтінки, скелясті схили), жива вода (хвилі, відблиски, мілина й піна біля берега),
   вітер у деревах, кущах і траві, делікатніші частинки вдень і світлячки вночі.
   Опція «Ефекти: Висока» — світіння (bloom) ліхтарів, вогню й відблисків і чіткіші тіні; для слабких телефонів — «Звичайні». */
(function(){try{
const G=n=>{try{return eval(n)}catch(e){return undefined}};
const SC=G('sc'),RR=G('R'),CAM=G('cam');if(!SC||!RR||typeof THREE==='undefined')return;
const U={uT:{value:0}};
ANI.push(()=>{U.uT.value=performance.now()/1000%3600});

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
  vec3 c=diffuseColor.rgb*(.74+.5*nn);
  c=mix(c,c*vec3(1.12,1.05,.78),smoothstep(.58,.82,d2.r)*.55);
  c=mix(c,c*vec3(.78,.93,.84),smoothstep(.6,.85,d2.b)*.45);
  float sl=(1.-smoothstep(.6,.84,vWN.y))*step(-.2,vWP.y);
  c=mix(c,vec3(.25,.235,.215)*(.7+.6*d3.r)*(.85+.3*d1.g),sl);
  diffuseColor.rgb=c;`);};
 m.customProgramCacheKey=()=>'pl-ground';m.needsUpdate=true}

/* ---------- вода ---------- */
const WT=G('water'),HF=G('H'),WR=(G('WG_R')||250);
if(WT&&WT.material&&HF){
 const S=256,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),im=x.createImageData(S,S);
 for(let j=0;j<S;j++)for(let i=0;i<S;i++){const wx=-WR+(i+.5)/S*2*WR,wz=-WR+(j+.5)/S*2*WR;let h=0;try{h=HF(wx,wz)}catch(_){}const d=Math.max(0,Math.min(1,(-.5-h)/3.2)),k=(j*S+i)*4;im.data[k]=im.data[k+1]=im.data[k+2]=d*255;im.data[k+3]=255}
 x.putImageData(im,0,0);const DT=new THREE.CanvasTexture(c);DT.wrapS=DT.wrapT=THREE.ClampToEdgeWrapping;DT.flipY=false;
 const m=WT.material;m.roughness=.06;m.opacity=1;
 m.onBeforeCompile=s=>{s.uniforms.uT=U.uT;s.uniforms.uDep={value:DT};s.uniforms.uR={value:WR};
  s.vertexShader='varying vec3 vWP;\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;');
  s.fragmentShader='uniform float uT;uniform sampler2D uDep;uniform float uR;varying vec3 vWP;\n'+s.fragmentShader
  .replace('#include <color_fragment>',`#include <color_fragment>
  vec2 tuv=(vWP.xz+uR)/(2.*uR);
  float dep=(tuv.x<0.||tuv.x>1.||tuv.y<0.||tuv.y>1.)?1.:texture2D(uDep,tuv).r;
  vec3 wc=mix(vec3(.10,.55,.52),vec3(.015,.13,.30),smoothstep(0.,.6,dep));
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
 m.onBeforeCompile=s=>{s.uniforms.uT=U.uT;
  s.vertexShader='uniform float uT;\n'+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  #ifdef USE_INSTANCING
  vec3 wb=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
  #else
  vec3 wb=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
  #endif
  float wp=uT*1.6+wb.x*.33+wb.z*.27,gust=.65+.35*sin(uT*.37+wb.x*.02);
  ${mode==0?`float k=clamp((position.y+.31)/.62,0.,1.);k*=k;transformed.x+=sin(wp)*.11*k*gust;transformed.z+=cos(wp*.8)*.07*k*gust;`
   :mode==1?`transformed.x+=sin(wp)*.07*gust+sin(uT*4.7+position.y*6.+position.x*4.)*.015;transformed.z+=cos(wp*.9)*.05*gust+cos(uT*5.3+position.z*5.)*.012;`
   :`transformed.x+=sin(wp*1.3)*.025*gust;transformed.z+=cos(wp)*.02*gust;`}`);};
 m.customProgramCacheKey=()=>'pl-wind'+mode;return WIND[key]=m};
const GM=G('gm');if(GM&&GM.material)GM.material=windMat(GM.material,0);
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
const QS=new THREE.Scene(),QC=new THREE.OrthographicCamera(-1,1,1,-1,0,1),QG=new THREE.PlaneGeometry(2,2),QM=new THREE.Mesh(QG);QM.frustumCulled=false;QS.add(QM);
const VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const sh=(fs,u)=>new THREE.ShaderMaterial({uniforms:u,vertexShader:VS,fragmentShader:fs,depthTest:false,depthWrite:false,toneMapped:false});
const BRIGHT=sh(`uniform sampler2D t;uniform float th;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb;float l=max(c.r,max(c.g,c.b));float k=smoothstep(th,th+.18,l);gl_FragColor=vec4(c*k,1.);}`,{t:{value:null},th:{value:.8}});
const BLUR=sh(`uniform sampler2D t;uniform vec2 d;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb*.227;
 c+=(texture2D(t,vUv+d*1.385).rgb+texture2D(t,vUv-d*1.385).rgb)*.316;c+=(texture2D(t,vUv+d*3.231).rgb+texture2D(t,vUv-d*3.231).rgb)*.07;gl_FragColor=vec4(c,1.);}`,{t:{value:null},d:{value:new THREE.Vector2()}});
const COMB=sh(`uniform sampler2D t,b1,b2;uniform float k;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb+(texture2D(b1,vUv).rgb*.6+texture2D(b2,vUv).rgb*.9)*k;gl_FragColor=vec4(c,1.);}`,{t:{value:null},b1:{value:null},b2:{value:null},k:{value:.4}});
let RT=null,A1,B1,A2,B2,W=0,H2=0;const sz=new THREE.Vector2();
function ensure(){RR.getDrawingBufferSize(sz);if(RT&&sz.x===W&&sz.y===H2)return;W=sz.x;H2=sz.y;[RT,A1,B1,A2,B2].forEach(r=>r&&r.dispose());
 const o={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat};
 RT=RR.capabilities.isWebGL2&&THREE.WebGLMultisampleRenderTarget?new THREE.WebGLMultisampleRenderTarget(W,H2,o):new THREE.WebGLRenderTarget(W,H2,o);
 if(RT.samples!==undefined)RT.samples=4;RT.texture.encoding=THREE.sRGBEncoding;
 const h=(d)=>new THREE.WebGLRenderTarget(Math.max(1,W/d|0),Math.max(1,H2/d|0),o);A1=h(2);B1=h(2);A2=h(4);B2=h(4)}
function pass(mat,target){QM.material=mat;RR.setRenderTarget(target);_rr(QS,QC)}
const _rr=RR.render.bind(RR);let nf=0;
RR.render=function(s,c){if(!Q.hq||s!==SC||RR.getRenderTarget()!==null)return _rr(s,c);
 ensure();RR.setRenderTarget(RT);_rr(s,c);
 const tgt=window.isNight&&isNight()?1:0;nf+=(tgt-nf)*.03;
 BRIGHT.uniforms.t.value=RT.texture;BRIGHT.uniforms.th.value=.95-.33*nf;pass(BRIGHT,A1);
 BLUR.uniforms.t.value=A1.texture;BLUR.uniforms.d.value.set(1/A1.width,0);pass(BLUR,B1);
 BLUR.uniforms.t.value=B1.texture;BLUR.uniforms.d.value.set(0,1/A1.height);pass(BLUR,A1);
 BLUR.uniforms.t.value=A1.texture;BLUR.uniforms.d.value.set(1/A2.width,0);pass(BLUR,B2);
 BLUR.uniforms.t.value=B2.texture;BLUR.uniforms.d.value.set(0,1/A2.height);pass(BLUR,A2);
 COMB.uniforms.t.value=RT.texture;COMB.uniforms.b1.value=A1.texture;COMB.uniforms.b2.value=A2.texture;COMB.uniforms.k.value=.16+1.01*nf;pass(COMB,null)};

/* вкладка «Графіка» (раніше «Опції»): перемикач якості ефектів поруч з іншими налаштуваннями графіки */
const _pf=pfTab;pfTab=function(t){_pf.apply(this,arguments);if(t!='o'&&t!='g')return;const host=document.getElementById('gfxp');if(!host||document.getElementById('gfxq'))return;
 const d=document.createElement('div');d.id='gfxq';
 d.innerHTML=`<h4>Ефекти</h4><div class='gseg' id='gq'>${['Звичайні','Висока якість'].map((a,i)=>`<button data-i='${i}' class='${i==Q.hq?'on':''}'>${a}</button>`).join('')}</div><small class='gnote'>Висока — світіння вогню й ліхтарів, чіткіші тіні. Для потужних телефонів і ПК</small>`;
 host.appendChild(d);d.querySelectorAll('#gq button').forEach(b=>b.onclick=()=>{Q.hq=+b.dataset.i;sv();applyShadow();d.querySelectorAll('#gq button').forEach(x=>x.classList.toggle('on',x===b))})};
window.plVis={U,Q,setHQ:v=>{Q.hq=v?1:0;applyShadow()}};
}catch(e){console.warn('visuals',e)}})();
