/* 0.2.0: premium-оправа — небо з циклом сонця й місяця, зорі, хмари,
   тіні, що йдуть за гравцем, кольорокорекція (vibrance/температура/контраст),
   вінʼєтка, bloom нової генерації + FXAA. Замінює старий bloom-конвеєр
   visuals.js (перемикач той самий: «Ефекти → Висока якість», ключ zi_gfx2).
   Все в try/catch: якщо щось не так — гра просто малюється як раніше.
   УВАГА (архітектура гри): локальні імена НЕ мають збігатися з глобальними —
   доступ до глобалів іде через eval, а однойменна локальна змінна в TDZ
   зламає resolve (саме тому тут oR/oSc/oCam/oSun/oAni/player()/todL). */
(function(){try{
const G=n=>{try{return eval(n)}catch(e){return undefined}};
const oR=G('R'),oSc=G('sc'),oCam=G('cam'),oSun=G('sun'),oAni=G('ANI');
if(!oR||!oSc||!oCam||!oSun||!oAni)return;
const player=()=>G('P'),HQ=()=>{try{return window.plVis&&window.plVis.Q?window.plVis.Q.hq:0}catch(e){return 0}};
const N0=G('N0')||.22,N1=G('N1')||.78;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const C=h=>new THREE.Color(h);
let frameDelta=1/60,lastTick=performance.now(),renderError=null;
/* Нижча орбіта відкриває горизонт та силует героя. */
pit=matchMedia('(pointer:coarse)').matches?.54:.46;

/* ================= 1. ПАЛІТРА ДНЯ (art-direction) =================
   Живі кольори + «золоті години» — ключ до premium-вигляду жанру (Palworld/BotW):
   теплий горизонт на світанку/занепаді, глибока ніч, насичений день. */
const PD={dawn:{z:C(0x3d68ad),h:C(0xffb367),s:C(0xffb066)},
 noon:{z:C(0x2f80e4),h:C(0xbde0f7),s:C(0xfff3d6)},
 dusk:{z:C(0x39478c),h:C(0xff9752),s:C(0xff8b4a)},
 night:{z:C(0x060a1c),h:C(0x121e46),s:C(0x9db8ff)}};
const mixP=(a,b,t)=>({z:a.z.clone().lerp(b.z,t),h:a.h.clone().lerp(b.h,t),s:a.s.clone().lerp(b.s,t)});
let todL=.32,nightF=0,duskF=0,dayT=0,sunEl=0,sunAz=70,moonEl=0,moonAz=110;
function skyState(){
  /* Джерело правди: window.ziTod() (замикання world-007). G('tod') тут не працює —
     tod closure-локальне, а window.tod — артефакт інших скриптів. */
  const tz=typeof window.ziTod==='function'?window.ziTod():null;
  const fb=G('tod');todL=(typeof tz==='number')?tz:((typeof fb==='number')?fb:.32);
  const inDay=todL>=N0&&todL<N1;
  dayT=inDay?(todL-N0)/(N1-N0):0;
  const nt=inDay?0:((todL>=N1?todL-N1:todL+1-N1)/(1-N1+N0));
  nightF=clamp((Math.abs(todL-.5)-.24)/.08,0,1);           /* той самий «d», що у world-007 */
  sunEl=inDay?Math.sin(dayT*Math.PI):0;                    /* 0..1 — висота сонця */
  sunAz=lerp(70,290,dayT);
  moonEl=nt>0?Math.sin(nt*Math.PI):0;moonAz=lerp(110,250,nt);
  duskF=clamp(1-Math.abs(sunEl-.13)/.13,0,1)*(1-nightF);   /* «золота година», крім ночі */
}
function palette(){
  if(nightF>.5)return PD.night;
  if(sunEl>.35)return mixP(PD.noon,PD.night,nightF*1.1);
  if(dayT<.5)return mixP(mixP(PD.night,PD.dawn,clamp(dayT*6,0,1)),PD.noon,clamp(dayT*3-.2,0,1));
  return mixP(PD.dusk,PD.noon,clamp((dayT-.5)*4-.3,0,1));
}
const sunDir=new THREE.Vector3(0,1,0),moonDir=new THREE.Vector3(0,-1,0);
function setDir(v,elDeg,azDeg){const el=elDeg*Math.PI/180,az=azDeg*Math.PI/180;
 v.set(Math.cos(el)*Math.sin(az),Math.sin(el),Math.cos(el)*Math.cos(az))}

/* ================= 2. НЕБО: купол + зорі + хмари ================= */
const skyUni={uZen:{value:C(0x2f80e4)},uHor:{value:C(0xbde0f7)},uSun:{value:C(0xfff3d6)},
 uSunDir:{value:new THREE.Vector3(0,1,0)},uMoonDir:{value:new THREE.Vector3(0,-1,0)},uSunI:{value:1},uMoonI:{value:0}};
const dome=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),new THREE.ShaderMaterial({
 uniforms:skyUni,side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false,
 vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:['varying vec3 vP;uniform vec3 uZen,uHor,uSun,uSunDir,uMoonDir;uniform float uSunI,uMoonI;',
 'void main(){',
 ' vec3 d=normalize(vP);',
 ' vec3 col=mix(uHor,uZen,smoothstep(-.02,.42,d.y));',
 ' float below=1.-smoothstep(-.42,-.02,d.y);col=mix(col,col*.30,below);',      /* під горизонтом темніше */
 ' float ss=dot(d,normalize(uSunDir));',
 ' col+=uSun*pow(max(ss,0.),600.)*2.4*uSunI;',                                  /* диск сонця */
 ' col+=uSun*(pow(max(ss,0.),24.)*.30+pow(max(ss,0.),4.)*.12)*uSunI;',          /* гало */
 ' float ms=dot(d,normalize(uMoonDir));',
 ' col+=vec3(.86,.90,1.)*pow(max(ms,0.),900.)*1.7*uMoonI;',                     /* місяць */
 ' col+=vec3(.55,.62,.90)*pow(max(ms,0.),40.)*.10*uMoonI;',
 ' gl_FragColor=vec4(col,1.);',
 '}'].join('\n')}));
dome.renderOrder=-100;dome.frustumCulled=false;oSc.add(dome);
try{oSc.background=null}catch(e){}

function starLayer(n,size){const g=new THREE.BufferGeometry(),a=new Float32Array(n*3);
 for(let i=0;i<n;i++){const u=Math.random()*2-1,th=Math.random()*Math.PI*2,r=Math.sqrt(1-u*u);
  a[i*3]=r*Math.cos(th);a[i*3+1]=Math.abs(u)*.95+.02;a[i*3+2]=r*Math.sin(th)}
 g.setAttribute('position',new THREE.BufferAttribute(a,3));
 const m=new THREE.PointsMaterial({color:0xffffff,size,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:false});
 const p=new THREE.Points(g,m);p.renderOrder=-99;p.frustumCulled=false;oSc.add(p);return p}
const st1=starLayer(420,1.6),st2=starLayer(140,2.6);

const clTex=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 for(let i=0;i<26;i++){const r=20+Math.random()*46,px=44+Math.random()*168,py=76+Math.random()*108;
  const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(255,255,255,.26)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,7);x.fill()}
 return new THREE.CanvasTexture(c)})();
const clouds=[];
for(let i=0;i<11;i++){const m=new THREE.SpriteMaterial({map:clTex,transparent:true,depthWrite:false,opacity:0,fog:false});
 const s=new THREE.Sprite(m),a=Math.random()*Math.PI*2,r=40+Math.random()*130;
 s.position.set(Math.cos(a)*r,30+Math.random()*36,Math.sin(a)*r);
 const w=36+Math.random()*44;s.scale.set(w,w*.55,1);s.renderOrder=-98;oSc.add(s);clouds.push(s)}

/* NOC ≠ CZERŃ: świat „usypia”, ale postaci mają pozostać czytelne
   (klasyczna reguła stylizowanych gier — Palworld/BotW nie całują bohatera w czerni).
   Dwa filery, oba grzane przez nf (w dzień 0 — bez kosztu):
   – hp — punktowa „księżycowa” przy bohaterze: czytelna sylwetka + blik na krawędziach + bliskie stwory,
   – dark — wypełniająca hemisferyczna dla całej sceny: żeby odległe stwory i budynki nie znikały w czerni. */
const hp=new THREE.PointLight(0xbcd2ff,0,7,2);oSc.add(hp);
const dark=new THREE.HemisphereLight(0x86a0e8,0x1f2947,0);oSc.add(dark);


/* ================= 3. КОНВЕЄР РЕНДЕРА =================
   Сцена → RT (MSAA на ПК) → [bloom] → [FXAA на мобільних] → кольорокорекція → екран.
   HWIAga: у three.js r128 render — це ВЛАСНІСТЬ ЕКЗЕМПЛЯРА (this.render у
   конструкторі), на прототипі його немає. Ловимо те, що є в `oR.render`:
   зазвичай це композер із visuals.js, але його guard «target!==null → surowy
   render» робить так, що свій bloom-конвеєр visuals.js ніколи не виконується —
   сцена малюється в наш RT чисто, а вся обробка — тут. */
const proto=oR.render;  /* r128: render jest na instancji, nie na prototypie! */
const VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const sh=(fs,u)=>new THREE.ShaderMaterial({uniforms:u,vertexShader:VS,fragmentShader:fs,depthTest:false,depthWrite:false,toneMapped:false});
const QS=new THREE.Scene(),QC=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const QM=new THREE.Mesh(new THREE.PlaneGeometry(2,2));QM.frustumCulled=false;QS.add(QM);
const pass=(mat,target)=>{QM.material=mat;oR.setRenderTarget(target);proto.call(oR,QS,QC)};

const BRIGHT=sh(
 'uniform sampler2D t;uniform float th;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb;'+
 'float l=max(c.r,max(c.g,c.b));float k=smoothstep(th,th+.22,l);gl_FragColor=vec4(c*k,1.);}',
 {t:{value:null},th:{value:.9}});
const BLUR=sh(
 'uniform sampler2D t;uniform vec2 d;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb*.227;'+
 'c+=(texture2D(t,vUv+d*1.385).rgb+texture2D(t,vUv-d*1.385).rgb)*.316;'+
 'c+=(texture2D(t,vUv+d*3.231).rgb+texture2D(t,vUv-d*3.231).rgb)*.07;gl_FragColor=vec4(c,1.);}',
 {t:{value:null},d:{value:new THREE.Vector2()}});
const COMB=sh(
 'uniform sampler2D t,b1,b2;uniform float k;varying vec2 vUv;void main(){'+
 'vec3 c=texture2D(t,vUv).rgb+(texture2D(b1,vUv).rgb*.55+texture2D(b2,vUv).rgb*.8)*k;'+
 'gl_FragColor=vec4(c,1.);}',{t:{value:null},b1:{value:null},b2:{value:null},k:{value:.45}});
const FXAA=sh([
 'uniform sampler2D t;uniform vec2 res;varying vec2 vUv;',
 'void main(){vec2 px=1./res;vec3 c=texture2D(t,vUv).rgb;',
 'float lN=dot(texture2D(t,vUv+vec2(0.,-px.y)).rgb,vec3(.299,.587,.114));',
 'float lS=dot(texture2D(t,vUv+vec2(0., px.y)).rgb,vec3(.299,.587,.114));',
 'float lW=dot(texture2D(t,vUv+vec2(-px.x,0.)).rgb,vec3(.299,.587,.114));',
 'float lE=dot(texture2D(t,vUv+vec2( px.x,0.)).rgb,vec3(.299,.587,.114));',
 'float gNS=abs(lN-lS),gWE=abs(lW-lE);',
 'float rn=clamp(max(gNS,gWE)/.25,0.,1.);',
 'float bx=(gWE>gNS)?rn*px.x:0.,by=(gWE>gNS)?0.:rn*px.y;',
 'vec3 o=texture2D(t,vUv+vec2( bx, by)).rgb+texture2D(t,vUv+vec2(-bx, by)).rgb',
 '        +texture2D(t,vUv+vec2( bx,-by)).rgb+texture2D(t,vUv+vec2(-bx,-by)).rgb;',
 'gl_FragColor=vec4(mix(c,o*.25,clamp((gNS+gWE)/.15,0.,1.)),1.);}'].join('\n'),
 {t:{value:null},res:{value:new THREE.Vector2(1,1)}});
/* ГОЛОВНЕ: кольорокорекція. vibrance — серце «premium»-вигляду (дослідження Palworld). */
const GRADE=sh([
 'uniform sampler2D t;uniform float uSat,uVib,uTemp,uContr,uVig,uNight,uDusk,uGrain;varying vec2 vUv;',
 'void main(){',
 ' vec3 c=texture2D(t,vUv).rgb;',
 ' c*=vec3(1.+uTemp*.05,1.+uTemp*.008,1.-uTemp*.05);',              /* температура */
 ' float l=dot(c,vec3(.299,.587,.114));',
 ' c=mix(vec3(l),c,uSat);',                                          /* насичення */
 ' float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b));',
 ' c=mix(vec3(l),c,1.+uVib*(1.-clamp(mx-mn,0.,1.)));',              /* vibrance */
 ' c=mix(vec3(.5),c,1.+uContr);',                                    /* мʼякий контраст */
 ' c=mix(c,c*vec3(1.07,.99,.90),uDusk*.8);',                         /* золота година */
 ' c=mix(vec3(l)*vec3(.88,.94,1.12),c,.72+uNight*.28);',             /* холодна ніч */
 ' c=pow(max(c,vec3(0.)),vec3(1.-uNight*.22));',                                   /* noc: gamma-lift — postaci czytelne */
 ' c+=vec3(uNight*.05)*(1.-c);',                                     /* ...i podłóż pod cienie (bez „czerwienia” czerni) */
 ' c+=(fract(sin(dot(vUv+uGrain,vec2(12.9898,78.233)))*43758.5453)*2.-1.)*.003;', /* зерно */
 ' float r=distance(vUv,vec2(.5));',
 ' c*=1.-uVig*smoothstep(.42,.92,r);',                               /* вінʼєтка */
 ' gl_FragColor=vec4(c,1.);}'].join('\n'),
 {t:{value:null},uSat:{value:1.04},uVib:{value:.16},uTemp:{value:.1},uContr:{value:.06},
  uVig:{value:.19},uNight:{value:0},uDusk:{value:0},uGrain:{value:0}});

let RT=null,RT2=null,T0=null,T1=null,T2=null,T3=null,BW=0,BH=0,hqL=-1;
const dbs=new THREE.Vector2();
function ensure(){
 oR.getDrawingBufferSize(dbs);const w=dbs.x|0,h=dbs.y|0,hq=HQ();
 if(RT&&w===BW&&h===BH&&hq===hqL)return;BW=w;BH=h;hqL=hq;
 [RT,RT2,T0,T1,T2,T3].forEach(r=>r&&r.dispose());
 const o={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:true};
 const plain={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:false};
 const ms=HQ()&&oR.capabilities.isWebGL2&&THREE.WebGLMultisampleRenderTarget;
 RT=ms?new THREE.WebGLMultisampleRenderTarget(BW,BH,o):new THREE.WebGLRenderTarget(BW,BH,o);
 if(RT.samples!==undefined&&ms)RT.samples=2;
 RT.texture.encoding=THREE.sRGBEncoding;RT.texture.generateMipmaps=false;
 RT2=new THREE.WebGLRenderTarget(BW,BH,plain);RT2.texture.encoding=THREE.sRGBEncoding;RT2.texture.generateMipmaps=false;
 const mk=d=>new THREE.WebGLRenderTarget(Math.max(1,BW/d|0),Math.max(1,BH/d|0),plain);
 T0=HQ()?mk(4):null;T1=HQ()?mk(4):null;T2=HQ()?mk(8):null;T3=HQ()?mk(8):null;
}
let nf=0;
oR.render=function(s,c){
 if(s!==oSc||oR.getRenderTarget()!==null)return proto.call(oR,s,c);
 try{
  ensure();oR.info.autoReset=false;oR.info.reset();
  oR.setRenderTarget(RT);proto.call(oR,s,c);         /* сцена → RT */
  const tgt=nightF;nf+=(tgt-nf)*(1-Math.exp(-frameDelta*2.5));
  if(HQ()){                                         /* BLOOM: вночі нижчий поріг — світяться ліхтарі/лава/світлячки */
   BRIGHT.uniforms.t.value=RT.texture;BRIGHT.uniforms.th.value=.93-.30*nf;pass(BRIGHT,T0);
   BLUR.uniforms.t.value=T0.texture;BLUR.uniforms.d.value.set(1/T0.width,0);pass(BLUR,T1);
   BLUR.uniforms.t.value=T1.texture;BLUR.uniforms.d.value.set(0,1/T1.height);pass(BLUR,T0);
   BLUR.uniforms.t.value=T0.texture;BLUR.uniforms.d.value.set(1/T2.width,1/T2.height);pass(BLUR,T2);
   BLUR.uniforms.t.value=T2.texture;BLUR.uniforms.d.value.set(0,1/T2.height);pass(BLUR,T3);
   COMB.uniforms.t.value=RT.texture;COMB.uniforms.b1.value=T0.texture;COMB.uniforms.b2.value=T3.texture;
   COMB.uniforms.k.value=.16+.8*nf;pass(COMB,RT2);
  }else{                                            /* мобільні: без bloom, але з FXAA */
   FXAA.uniforms.t.value=RT.texture;FXAA.uniforms.res.value.set(BW,BH);pass(FXAA,RT2);
  }
  GRADE.uniforms.t.value=RT2.texture;
  GRADE.uniforms.uNight.value=nf;GRADE.uniforms.uDusk.value=duskF;
  GRADE.uniforms.uTemp.value=lerp(.10,-.16,nf);GRADE.uniforms.uGrain.value=(performance.now()%997)/997;
  pass(GRADE,null);
  window.plFrameStats={drawCalls:oR.info.render.calls,triangles:oR.info.render.triangles,geometries:oR.info.memory.geometries,textures:oR.info.memory.textures};
 }catch(e){if(!renderError){renderError=String(e);console.warn('premium-render',e)}try{oR.setRenderTarget(null);proto.call(oR,s,c)}catch(_){}}
};

/* ================= 4. КОЖЕН КАДР: небо, сонце, тіні ================= */
const horMix=new THREE.Color();
/* ---- 4c. КАМЕРА: не залазить за крону/скелю (фікс «не видно персонажа») ----
   Кама у frame() (core-world.js:210) — орбіта без тесту перешкод: коли камера
   потрапляє за крону дерева / за скелю, екран — це один великий полігон.
   core-world не чіпаємо: як ОСТАННЯ петля ANI (перед рендером) рахуємо
   сегмент «голова гравця → камера» проти циліндра кожної перешкоди і тоді:
   • перешкода ДАЛЕКО (≥4.3 м від голови) → камера згортається ПЕРЕД нею;
   • перешкода БЛИЗЬКО → спершу sidestep: обертаємо азимут орбіти (±0.55,
     ±1.1, ±1.8 рад) на тій самій відстані/висоті й беремо перший чистий
     промінь; якщо всі зайняті — хід назад до 4.3 м + мʼякий підйом над кроною.
   Цільова позиція згладжується (camS), щоб не стрибало між кадрами.
   Без Raycaster: чиста математика r128, лише перешкоди в радіусі 20 м. */
const oT=G('trees')||[],oRk=G('rocks')||[],oHt=G('H'),oPlG=G('pl');
const SS=[.55,-.55,1.1,-1.1,1.8,-1.8];           /* candidate sidestep angles */
let camS=null,camBlocked=0,camBlockedRatio=1;
function pullHit(hx,hy,hz,cx,cy,cz){
 let hit=null;const dx=cx-hx,dz=cz-hz,Lh=Math.hypot(dx,dz);if(Lh<1.2)return null;
 const test=(ox,oz,r,bt,tp)=>{
  const gx=hx-ox,gz=hz-oz,c0=gx*gx+gz*gz-r*r,a=dx*dx+dz*dz,b=2*(gx*dx+gz*dz);
  if(c0<=0){                                        /* głowa wewnątrz obszaru (gracz pod koroną) */
   if(hy>bt&&hy<tp&&(!hit||hit.t>.01))hit={t:.01,tp:tp};
   return;
  }
  const D=b*b-4*a*c0;if(D<=0)return;
  const tt=(-b-Math.sqrt(D))/(2*a);if(tt<=.02||tt>=1)return;
  const hys=hy+(cy-hy)*tt;                          /* wysokość w punkcie przecięcia */
  if(hys>tp||hys<bt)return;                         /* przechodzi nad koroną / pod spodem — ok */
  if(!hit||tt<hit.t)hit={t:tt,tp:tp};
 };
 for(const w0 of oT){if(!w0||!w0.m)continue;const s0=w0.m.scale.x||1;
  const ddx=w0.x-hx,ddz=w0.z-hz;if(ddx*ddx+ddz*ddz>400)continue;
  test(w0.x,w0.z,1.4*s0,w0.m.position.y+1.35*s0,w0.m.position.y+3.7*s0)}
 for(const w1 of oRk){if(!w1||!w1.m)continue;const s1=w1.m.scale.x||1;
  const ddx=w1.x-hx,ddz=w1.z-hz;if(ddx*ddx+ddz*ddz>400)continue;
  test(w1.x,w1.z,1.15*s1,w1.m.position.y,w1.m.position.y+1.35*s1)}
 try{if(typeof colList==='function'){const lc=colList();for(let qi=0;qi<lc.length;qi++){const w2=lc[qi];if(!w2)continue;
  const ddx=w2.x-hx,ddz=w2.z-hz;if(ddx*ddx+ddz*ddz>400)continue;
  const baseY=oHt?oHt(w2.x,w2.z):0;test(w2.x,w2.z,(w2.r||.8)+.35,baseY,baseY+(w2.h||2.6))}}}catch(_){}
 if(hit)hit.Lh=Lh;
 return hit;
}
oAni.push(()=>{
 const now=performance.now();frameDelta=Math.min(.05,Math.max(.001,(now-lastTick)/1000));lastTick=now;const t=now/1000;skyState();
 const p=palette();
 horMix.copy(p.h);if(oSc.fog)horMix.lerp(oSc.fog.color,.30);       /* горизонт ↔ туман */
 skyUni.uZen.value.copy(p.z);skyUni.uHor.value.copy(horMix);skyUni.uSun.value.copy(p.s);
 setDir(sunDir,3+sunEl*66,sunAz);setDir(moonDir,4+moonEl*58,moonAz);
 skyUni.uSunDir.value.copy(sunDir);skyUni.uMoonDir.value.copy(moonDir);
 skyUni.uSunI.value=clamp(sunEl*6,0,1)*(1-nightF);
 skyUni.uMoonI.value=clamp(moonEl*5,0,1)*nightF;
 const S=oCam.far*.47;
 dome.scale.setScalar(S);dome.position.copy(oCam.position);
 st1.scale.setScalar(S*.97);st2.scale.setScalar(S*.97);
 st1.position.copy(oCam.position);st2.position.copy(oCam.position);
 st1.material.opacity=nightF*.9;
 st2.material.opacity=nightF*(.6+.4*(.5+.5*Math.sin(t*1.7)));
 for(const cl of clouds){
  cl.position.x+=frameDelta*.85;
  const pl=player();
  if(pl){const dx=cl.position.x-pl.x,dz=cl.position.z-pl.z,d=Math.hypot(dx,dz);
   if(d>170){cl.position.x=pl.x-dx/d*168;cl.position.z=pl.z-dz/d*168}}
  cl.material.opacity=clamp(.55-nightF*.38,.12,.55);
  cl.material.color.setRGB(lerp(1,.16,nightF)+duskF*.30,lerp(1,.20,nightF)+duskF*.10,lerp(1,.34,nightF));
 }
 /* сонце/місяць: світло й ТІНІ йдуть за гравцем (раніше тіні працювали лише біля центру світу) */
 const pl=player();
 if(pl&&oSun.target){
  const L=nightF>.5?moonDir:sunDir;
  const terrainY=oPlG?oPlG.position.y:0;oSun.position.set(pl.x+L.x*26,terrainY+Math.abs(L.y)*26+8,pl.z+L.z*26);
  oSun.target.position.set(pl.x,oPlG?oPlG.position.y:0,pl.z);oSun.target.updateMatrixWorld();
 }
 /* ЧИТЕЛЬНІСТЬ ПОСТАТЕЙ НИЧОРК: filery grane nf (w dzień 0); точкова світло сидить при гравцеві */
 if(pl)hp.position.set(pl.x,(oPlG?oPlG.position.y:0)+1.5,pl.z+0.01);
 hp.intensity=nf*1.15;
 dark.intensity=nf*.5;
 /* КАМЕРА (4c): свіжа орбіта з core-world → тест перешкод → sidestep/pull/raise */
 if(pl){
  const hy0=(oPlG&&oPlG.position?oPlG.position.y:0)+1.3;
  const dx0=oCam.position.x-pl.x,dz0=oCam.position.z-pl.z,Lo=Math.hypot(dx0,dz0);
  let tx=oCam.position.x,ty=oCam.position.y,tz=oCam.position.z;    /* target = fresh orbit */
  camBlocked=0;
  if(!window.__noPull&&Lo>1.2){
   const h0=pullHit(pl.x,hy0,pl.z,oCam.position.x,oCam.position.y,oCam.position.z);
   if(h0){
    camBlocked=1;
    const uX=dx0/Lo,uZ=dz0/Lo,dC=h0.t*Lo-.9;
    let ok=false;
    if(dC<4.3){
     /* sidestep: обхід перешкоди боком — та сама відстань Lo і висота,
        інший азимут; перша чиста candidato виграє (дзеркало спершу) */
     const bA=Math.atan2(dx0,dz0);
     for(let si=0;si<SS.length&&!ok;si++){
      const sx=pl.x+Math.sin(bA+SS[si])*Lo,sz=pl.z+Math.cos(bA+SS[si])*Lo,sy=oCam.position.y;
      if(!pullHit(pl.x,hy0,pl.z,sx,sy,sz)){tx=sx;ty=sy;tz=sz;ok=true}
     }
    }
    if(!ok){
     if(dC>=4.3){                                  /* далеко: зупиняємось перед перешкодою */
      tx=pl.x+uX*dC;tz=pl.z+uZ*dC;
     }else{                                        /* близько: хід назад до 4.3 м + підйом над кроною */
      tx=pl.x+uX*4.3;tz=pl.z+uZ*4.3;
      const tt2=(h0.t*Lo)/4.3;
      if(tt2>.02){
       const yc=hy0+(oCam.position.y-hy0)*tt2;
       if(yc<h0.tp+.9){                            /* на 4.3 м досі різає крону → легкий підйом */
        let yN=hy0+(h0.tp+.9-hy0)/tt2;
        yN=Math.min(yN,oCam.position.y+4);
        ty=Math.max(ty,yN);
       }
      }
     }
    }
   }
  }
  if(!camS||Math.hypot(camS.x-tx,camS.z-tz)>24)camS={x:oCam.position.x,y:oCam.position.y,z:oCam.position.z};
  const damping=1-Math.exp(-frameDelta*18);camS.x+=(tx-camS.x)*damping;camS.y+=(ty-camS.y)*damping;camS.z+=(tz-camS.z)*damping;
  camBlockedRatio=Lo>0?Math.hypot(camS.x-pl.x,camS.z-pl.z)/Lo:1;
  const mis=Math.abs(camS.x-oCam.position.x)+Math.abs(camS.y-oCam.position.y)+Math.abs(camS.z-oCam.position.z);
  if(mis>.04){
   let yv=camS.y;
   if(oHt){const fl=oHt(camS.x,camS.z)+.9;if(yv<fl)yv=fl}
   oCam.position.set(camS.x,yv,camS.z);
   const gA=G('ang')||0,gLA=G('LA')||0;
   oCam.lookAt(pl.x-Math.sin(gA)*gLA,hy0+.2,pl.z-Math.cos(gA)*gLA);
  }
 }
});
/* ================= 5. ДЕТАЛ ЗЕМЛІ: багатша текстура + анізотропія =================
   Терен малюється як vertexColor × карта деталей (paint). Оригінал — 256 px з редкими
   плямами. Тепер: 512 px, тонкий шум + мікро-«травинки» (направлені штрихи) — земля
   виглядає «намальованою», а не пластиком. Анізотропія загострює під гострим кутом. */
try{
 const PT=G('paint');
 if(PT&&PT.image){
  const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
  x.fillStyle='#ffffff';x.fillRect(0,0,512,512);
  /* мʼякі плями рельєфу */
  for(let i=0;i<90;i++){const l=235+Math.random()*20|0;x.fillStyle=`rgba(${l},${l},${l-6},.35)`;
   x.beginPath();x.arc(Math.random()*512,Math.random()*512,10+Math.random()*36,0,7);x.fill()}
  /* мікро-шум пікселів */
  const im=x.getImageData(0,0,512,512),d=im.data;
  for(let i=0;i<d.length;i+=4){const n=(Math.random()*14-7)|0;d[i]+=n;d[i+1]+=n;d[i+2]+=n}
  x.putImageData(im,0,0);
  /* направлені «травинки» */
  x.lineWidth=1;
  for(let i=0;i<1500;i++){const px=Math.random()*512,py=Math.random()*512,a=-.35+Math.random()*.7,L=2+Math.random()*5;
   const l=205+Math.random()*50|0;x.strokeStyle=`rgba(${l-4},${l},${l-14},.5)`;
   x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.sin(a)*L,py-L);x.stroke()}
  const maxAn=Math.min(16,oR.capabilities.getMaxAnisotropy?oR.capabilities.getMaxAnisotropy():1);
  PT.image=c;PT.anisotropy=maxAn;PT.needsUpdate=true;
  for(const n of['cobble','tileT','pathT','woodT']){const t=G(n);if(t&&t.image){t.anisotropy=maxAn;t.needsUpdate=true}}
 }
}catch(e){}

/* ================= 6. CSS-ВИНЬЄТКА: послаблюємо =================
   Шейдер GRADE уже має вінʼєтку — статичну CSS-ову (#plfx) лишаємо наполовину,
   щоб не темніти кути двічі, а теплий «відблиск» з кута зберігався ледь помітним. */
try{const fx=document.getElementById('plfx');if(fx)fx.style.opacity='.45'}catch(e){}

window.premFx={state:()=>({tod:todL,nightF,duskF,sunEl,hq:HQ(),nf,fills:[hp.intensity,dark.intensity],camBlocked:camBlocked,camPull:camBlockedRatio,error:renderError})};
}catch(e){console.warn('prem',e)}})();
