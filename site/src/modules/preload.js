/* global R, sc, cam */
/* 0.2.19: справжній екран завантаження (як у великих мобільних іграх).
   Раніше смуга на заставці була просто анімацією 1,7 с, а моделі героя (до 5 МБ), текстури й шейдери
   догружалися вже в грі — звідси ривки в перші хвилини. Тепер заставка не пускає в гру, поки:
   1) не скачано й не розібрано всі файли, які гра почала вантажити (GLB-моделі, текстури) — рахуємо справжні байти,
      швидкість і час, що лишився;
   2) не готовий герой разом з анімаціями ходьби й бою;
   3) не скомпільовано шейдери всіх матеріалів сцени (R.compile) — це головна причина «підвисань» при першій появі речей;
   4) світ «устоявся»: трава розставлена, кадри рівні (20 кадрів поспіль без ривків).
   Модуль підключено одразу після three.js/GLTFLoader, до решти модулів, щоб бачити всі завантаження.
   Якщо мережа дуже повільна, через 60 с гра все одно відкривається (завантаження триває далі в грі). */
(function(){try{
const T=window.THREE;if(!T)return;
const $=id=>document.getElementById(id);
const files=new Map();let tracking=true,shown=0,stage='files',ready=false;
const EST=180000; /* оцінка розміру, поки сервер не сказав справжній */
/* відомі розміри моделей — щоб загальний обсяг було видно одразу, а не лише після відповіді сервера */
const SIZE={'berry-bush.glb':99320,'building-roof.glb':65408,'hero-aiko-combat.glb':40884,'hero-aiko-locomotion.glb':107232,'hero-aiko.glb':2465520,'hero-combat.glb':42420,'hero-locomotion.glb':106808,'hero-mobile.glb':2812912,'hero-rigged.glb':5340368,'hero-walk-clip.glb':26524,'meadow-flowers.glb':7684,'mushroom.glb':29972,'terrain-rocks.glb':101184};
const nm=u=>String(u).split('?')[0].split('/').pop();
/* головна модель героя тягне за собою ще дві (ходьба й бій) — реєструємо їх наперед, щоб відсотки не відкочувались */
const NEXT=u=>{const m=/(hero-aiko|hero)(?:-rigged|-mobile)?\.glb/.exec(nm(u));if(!m||/locomotion|combat|walk/.test(nm(u)))return[];const b=String(u).replace(/[^/]*$/,'');return[b+m[1]+'-locomotion.glb',b+m[1]+'-combat.glb']};
const skipUrl=u=>!u||/^(data|blob):/.test(u);
function track(key,onLoad,onProgress,onError,img){
 if(!tracking||skipUrl(key))return[onLoad,onProgress,onError];
 let f=files.get(key);
 /* повторне завантаження вже скачаного файлу (напр. модель героя для NPC) береться з кешу — лише чекаємо його, байти не додаємо */
 if(f&&f.done){f={l:0,t:0,done:0,rep:1};files.set(key+'#'+files.size,f)}
 else if(!f){f={l:0,t:img?60000:(SIZE[nm(key)]||0),done:0};files.set(key,f)}f.pre=0;
 for(const n of NEXT(key))if(!files.has(n))files.set(n,{l:0,t:SIZE[nm(n)]||0,done:0,pre:1});
 if(f.rep)return[function(){f.done=1;if(onLoad)onLoad.apply(this,arguments)},onProgress,function(){f.done=1;if(onError)onError.apply(this,arguments)}];
 return[function(r){f.done=1;const n=r&&(r.byteLength||r.length)||0;f.l=f.t=Math.max(f.l,f.t||0,n||f.l);if(onLoad)onLoad.apply(this,arguments)},
  function(e){if(e&&e.lengthComputable&&e.total)f.t=e.total;if(e&&e.loaded)f.l=e.loaded;if(onProgress)onProgress.apply(this,arguments)},
  function(){f.done=1;f.err=1;if(onError)onError.apply(this,arguments)}]}
function patch(C,img){if(!C||!C.prototype||C.prototype.__plPre)return;const L=C.prototype.load;
 C.prototype.load=function(url,a,b,c){let key=url;try{key=(this.path||'')+url;if(this.manager&&this.manager.resolveURL)key=this.manager.resolveURL(key)}catch(_){}
  const w=track(key,a,b,c,img);return L.call(this,url,w[0],w[1],w[2])};C.prototype.__plPre=1}
patch(T.FileLoader,0);patch(T.ImageLoader,1);

function bytes(){let l=0,t=0,open=0;for(const f of files.values()){if(f.rep){if(!f.done)open++;continue}const tt=f.t||Math.max(EST,f.l);l+=Math.min(f.done?tt:f.l,tt);t+=tt;if(!f.done)open++}return{l,t,open}}
const fmt=b=>(b/1048576).toFixed(b<10485760?2:1)+'M';
const hist=[];function speed(l){const now=performance.now();hist.push([now,l]);while(hist.length>2&&now-hist[0][0]>2000)hist.shift();const a=hist[0],dt=(now-a[0])/1000;return dt>.3?Math.max(0,(l-a[1])/dt):0}
const tm=s=>{s=Math.max(0,Math.round(s));const m=Math.floor(s/60);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};

const LBL={files:'Завантаження ресурсів…',hero:'Готуємо героя…',shaders:'Підготовка графіки…',world:'Будуємо світ…',done:'Готово'};
function ui(p,info){p=Math.max(shown,Math.min(100,p));shown=p;
 const bar=$('spbi'),pc=$('sppc'),st=$('spst'),mb=$('spmb'),sp=$('spsp');if(!bar)return;
 bar.style.width=p.toFixed(1)+'%';pc.textContent=p.toFixed(2)+'%';if(st.dataset.s!==stage){st.dataset.s=stage;st.textContent=LBL[stage]}
 mb.textContent=info&&info.mb||'';sp.textContent=info&&info.sp||''}

function dropPre(){for(const f of files.values())if(f.pre&&!f.done){f.done=1;f.t=f.l=0}}
function heroSettled(){const h=window.importedHero;if(!h){dropPre();return true}if(h.status==='loading')return false;
 if(h.status!=='ready')dropPre();
 if(h.status!=='ready')return true;return !!(h.__plLoco&&h.__plCombat)}
function watchHero(){const h=window.importedHero;if(!h)return;
 const w=k=>{const p=h[k==='l'?'locomotionReady':'combatReady'];if(p&&p.then){p.then(()=>{h[k==='l'?'__plLoco':'__plCombat']=1},()=>{h[k==='l'?'__plLoco':'__plCombat']=1});return true}return false};
 const t0=performance.now();(function loop(){const a=h.__plLoco||w('l'),b=h.__plCombat||w('c');if(!(a&&b)&&h.status!=='failed'&&performance.now()-t0<60000)setTimeout(loop,100);else if(h.status==='failed'){h.__plLoco=h.__plCombat=1}})()}

let t0=performance.now(),domReady=false;
function compileAll(){try{if(typeof R==='undefined'||typeof sc==='undefined'||typeof cam==='undefined')return;
 R.compile(sc,cam)}catch(e){console.warn('preload compile',e)}}
function finish(){if(ready)return;ready=true;stage='done';tracking=false;ui(100,{mb:'',sp:''});
 const k=$('spk');if(k)k.classList.add('rd');document.body.classList.add('pl-loaded');
 window.plPreload.ms=Math.round(performance.now()-t0);window.plPreload._res()}
function stepFiles(){const b=bytes(),s=speed(b.l),all=b.open===0&&domReady&&document.readyState==='complete',hero=heroSettled();
 const p=b.t?b.l/b.t:0;ui(Math.min(84,p*80+(hero?4:0)),{mb:'('+fmt(b.l)+' / '+fmt(b.t)+')',sp:s>1024?fmt(s)+'/s '+tm((b.t-b.l)/s):''});
 if(stage==='files'&&b.open===0&&!hero)stage='hero';
 if(all&&hero)return true;return false}
let res;window.plPreload={done:new Promise(r=>{res=r}),files,stats:()=>({...bytes(),stage,shown,ready}),_res:()=>res()};
const HARD=60000;
function run(){if(ready)return;
 if(performance.now()-t0>HARD){finish();return}
 if(stage==='files'||stage==='hero'){if(stepFiles()){stage='shaders';ui(86);setTimeout(()=>{compileAll();stage='world';ui(92);world()},30)}else setTimeout(run,120);return}}
/* світ: чекаємо, доки кадри стануть рівними (трава розставлена, шейдери тіней зібрані) */
function world(){let last=performance.now(),good=0;const ts=performance.now(),ok=[];
 (function f(){if(ready)return;const now=performance.now(),dt=now-last;last=now;ok.push(dt);if(ok.length>40)ok.shift();
  const med=ok.slice().sort((a,b)=>a-b)[ok.length>>1]||16;good=dt<Math.max(50,med*1.8)?good+1:0;
  ui(92+Math.min(8,good/20*8));
  if(good>=20&&now-ts>600||now-ts>9000||now-t0>HARD){finish();return}requestAnimationFrame(f)})()}
document.addEventListener('DOMContentLoaded',()=>{domReady=true;watchHero()});
if(document.readyState!=='loading'){domReady=true;setTimeout(watchHero)}
/* рамка версії */
document.addEventListener('DOMContentLoaded',()=>{const v=$('spver');if(v){const s=document.querySelector('script[src*="i18n.js?v="]');if(s)v.textContent=s.src.split('v=')[1]}});
setTimeout(run,60);
}catch(e){console.warn('preload',e);window.plPreload={done:Promise.resolve(),files:new Map()}}})();
