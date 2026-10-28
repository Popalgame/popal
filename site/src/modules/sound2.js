/* 0.1.1: звуки гри — музика дня/ночі, ефекти, голоси попалів.
   Налаштування гучності беруться з модуля sound.js (window.Sound). */
(function(){try{
if(!window.Sound)return;
const G=n=>{try{return eval(n)}catch(e){return undefined}},GC=(()=>{const c={};return n=>c[n]||(c[n]=G(n))})(),WL=()=>GC('wild')||[],PL=()=>GC('pals')||[],TL=()=>G('T')||[],SEL=()=>{const p=PL(),i=G('selP');return p[i|0]};
const BASE='sounds/',PALS=['01_bambuzl','02_grumrok','03_ignis-vyverh','04_mirazhbr','05_pukhoklub','06_krylosha','07_mororih','08_hrozovyk','09_khvylezub','10_sontseklyuv'];
const SFX=['ball_hit','build','catch_fail','catch_ok','chop','click','close','craft','eat','error','gather','heal','hit','hurt','levelup','mine','open','pickup','quest_done','quest_new','shake','step','tab','throw'];
const buf={},loading={},last={};
let ready=0;
function ac(){return Sound.ctx()}
function decode(c,ab){return new Promise((ok,no)=>{try{const p=c.decodeAudioData(ab,ok,no);if(p&&p.then)p.then(ok,no)}catch(e){no(e)}})}
function load(path){if(buf[path])return Promise.resolve(buf[path]);if(loading[path])return loading[path];const c=ac();if(!c)return Promise.resolve(null);
 loading[path]=fetch(BASE+path+'.mp3').then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).then(ab=>decode(c,ab)).then(b=>{buf[path]=b;return b}).catch(()=>null);return loading[path]}
/* відтворення ефекту: kind — шлях без .mp3, v — гучність 0..1, rate — висота */
function play(path,v,rate,delay){if(!Sound.on||!Sound.vol('sfx'))return;const c=ac();if(!c)return;if(c.state=='suspended')c.resume();
 const n=performance.now();if(last[path]&&n-last[path]<55)return;last[path]=n;
 const go=b=>{if(!b)return;const s=c.createBufferSource(),g=c.createGain();s.buffer=b;s.playbackRate.value=rate||1;g.gain.value=v==null?1:v;s.connect(g);g.connect(Sound.sfxNode);s.start(c.currentTime+(delay||0))};
 if(buf[path])go(buf[path]);else{const t0=n;load(path).then(b=>{if(performance.now()-t0<700)go(b)})}}
const sfx=(k,v,r,d)=>play('sfx/'+k,v,r,d);
const voice=(ty,kind,v,d)=>{if(ty==null||!PALS[ty])return;play('pals/'+PALS[ty]+'_'+kind,v==null?.9:v,.96+Math.random()*.08,d)};
window.PSFX={sfx,voice};
/* ---------- музика ---------- */
const mus={};let musOn=0,nightMix=0;
function mkMusic(id){const a=new Audio(BASE+'music/'+id+'.mp3');a.loop=true;a.preload='auto';a.crossOrigin='anonymous';const c=ac();const g=c.createGain();g.gain.value=0;try{c.createMediaElementSource(a).connect(g)}catch(e){}g.connect(Sound.musicNode);return{a,g}}
function startMusic(){if(musOn)return;const c=ac();if(!c)return;musOn=1;mus.day=mkMusic('day');mus.night=mkMusic('night');tickMusic(true)}
function tickMusic(now){if(!musOn)return;const c=ac(),hidden=document.hidden,want=!Sound.on||!Sound.vol('music')||hidden?-1:(window.isNight&&isNight()?1:0);
 const tgt={day:want==0?1:0,night:want==1?1:0},t=c.currentTime;
 for(const k of['day','night']){const m=mus[k];if(!m)continue;m.g.gain.setTargetAtTime(tgt[k],t,now?.05:1.2);
  if(tgt[k]>0&&m.a.paused&&!document.hidden){m.a.play().catch(()=>{})}
  if(tgt[k]==0&&!m.a.paused){clearTimeout(m.st);m.st=setTimeout(()=>{if(m.g.gain.value<.02)m.a.pause()},4000)}}}
setInterval(()=>tickMusic(false),1500);
/* гра згорнута або закрита: повністю зупиняємо звук, щоб iPhone не показував «грає» */
function sleepAudio(){for(const k in mus){const m=mus[k];try{clearTimeout(m.st);m.g.gain.value=0;m.a.pause()}catch(e){}}const c=Sound.ctx&&ac();if(c&&c.state=='running')c.suspend().catch(()=>{});try{if(navigator.mediaSession)navigator.mediaSession.playbackState='none'}catch(e){}}
function wakeAudio(){if(document.hidden||!ready)return;const c=ac();if(c&&c.state!='running')c.resume().catch(()=>{});tickMusic(true)}
document.addEventListener('visibilitychange',()=>{if(document.hidden)sleepAudio();else wakeAudio()});
window.addEventListener('pagehide',sleepAudio);window.addEventListener('freeze',sleepAudio);window.addEventListener('pageshow',wakeAudio);
/* перший дотик: дозвіл на звук + попереднє завантаження ефектів */
function first(){if(ready){if(!document.hidden){const c=ac();if(c&&c.state!='running'){c.resume().catch(()=>{});tickMusic(true)}}return}const c=ac();if(!c)return;if(c.state=='suspended')c.resume();ready=1;startMusic();SFX.forEach(k=>load('sfx/'+k))}
['pointerdown','touchend','keydown'].forEach(e=>window.addEventListener(e,first,{passive:true}));
/* ---------- підключення до подій гри ---------- */
const wrap=(name,fn)=>{const o=window[name];if(typeof o!=='function')return;window[name]=function(){try{fn.apply(this,arguments)}catch(e){}return o.apply(this,arguments)}};
const after=(name,fn)=>{const o=window[name];if(typeof o!=='function')return;window[name]=function(){const r=o.apply(this,arguments);try{fn(r,arguments)}catch(e){}return r}};
/* повідомлення → звуки подій */
wrap('msg',s=>{s=String(s||'');
 if(s.startsWith('🎉')){const w=TL().findIndex(t=>s.includes(t.n));sfx('ball_hit');sfx('shake',.8,1,.25);sfx('shake',.8,1.05,.5);sfx('catch_ok',1,1,.75);if(w>=0)voice(w,'catch',1,1.4);return}
 if(s.startsWith('Вирвалась')){sfx('ball_hit');sfx('shake',.8,1,.25);sfx('catch_fail',1,1,.55);return}
 if(s.startsWith('⭐ Рівень')||s.startsWith('🏕️ Рівень табору')){sfx('levelup');return}
 if(s.startsWith('📜 Новий квест')){sfx('quest_new');return}
 if(s.startsWith('🎁')){sfx('quest_done');return}
 if(s.startsWith('🏗️')){sfx('build');return}
 if(s.startsWith('🔨 Створено')||s.startsWith('Створено кулю')){sfx('craft');return}
 if(s.startsWith('🍖 Істоти нагодовані')){sfx('eat');if(SEL())voice(SEL().ty,'happy',.8,.5);return}
 if(s.startsWith('😴')){sfx('heal');return}
 if(s.startsWith('🐾 З вами')){if(SEL())voice(SEL().ty,'happy',.85);return}
 if(/Немає|потрібно|можна лише|повний|немає місця|Камінь руками|Спочатку|Перевантаження|закінчилась|Поруч нічого|вже збудовано|ще немає/.test(s)){sfx('error',.8);return}
});
/* числа шкоди → удари, поранення, голоси */
wrap('dmg',(t,o,col)=>{t=String(t||'');if(!o)return;
 if(o===GC('pl')){if(t.startsWith('-')){sfx('hurt');const w=WL().filter(w=>w.ag).sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z))[0];if(w)voice(w.ty,'attack',.7)}return}
 const w=WL().find(w=>w.m===o);
 if(w){if(/^\d/.test(t)&&col!=='#9fe4ff'){sfx('hit');if(Math.random()<.6)voice(w.ty,'hurt',.75,.08)}
  else{const p=SEL();if(p&&Math.random()<.7)voice(p.ty,'attack',.8);sfx('hit',.7,1.1,.15);if(Math.random()<.4)voice(w.ty,'hurt',.6,.25)}return}
 if(/🫐|🍄/.test(t)){sfx('gather');return}
 if(/🥢|🟤/.test(t)&&!/🪵|🪨/.test(t)){sfx('pickup',.7);return}
});
/* видобуток: дерево і камінь (на кожен удар, навіть без здобичі) */
after('gHit',(r,a)=>{if(r===-1)return;const k=a[0];sfx(k=='w'?'chop':'mine',k=='w'?1:.9,.95+Math.random()*.1);if(r&&r.tx&&r.tx.some(x=>/🥢|🟤/.test(x)))sfx('pickup',.6,1,.2)});
after('fellB',(r,a)=>{sfx(a[0]=='w'?'chop':'mine',1,.8,.12);sfx('pickup',.7,1,.35)});
/* інвентар */
wrap('ivOpen',()=>sfx('open',.8));
/* кнопки інтерфейсу */
document.addEventListener('pointerdown',e=>{const el=e.target.closest&&e.target.closest('button,[data-t],[data-place],.ob,#mmap,#pwl,#pwr');if(!el)return;
 if(el.id=='hit'||el.id=='throw')return;
 if(el.id=='ivx'||el.closest('#pfx')||/✕|×/.test(el.textContent.trim())&&el.textContent.trim().length<3){sfx('close',.8);return}
 if(el.matches('[data-t]')||el.closest('#pfm')){sfx('tab',.7);return}
 sfx('click',.6)},true);
/* кидок кулі: звук лише якщо куля справді полетіла */
document.addEventListener('click',e=>{if(!e.target.closest||!e.target.closest('#throw'))return;const n0=(G('fx')||[]).length;setTimeout(()=>{if((G('fx')||[]).length>n0)sfx('throw')},0)},true);
/* кроки та голоси диких істот */
let lx=null,lz=null,stT=0,idT=4,lt=performance.now();
(function step(){requestAnimationFrame(step);const n=performance.now(),dt=Math.min(.1,(n-lt)/1000);lt=n;if(typeof P=='undefined'||!ready)return;
 if(typeof menuO!=='undefined'&&menuO){lx=P.x;lz=P.z;return}
 const mv=lx==null?0:Math.hypot(P.x-lx,P.z-lz);lx=P.x;lz=P.z;
 const swim=window.H&&H(P.x,P.z)<-1.15;
 if(mv>.02&&!swim){stT-=dt;if(stT<=0){stT=.34;sfx('step',.35,.9+Math.random()*.2)}}else stT=.05;
 idT-=dt;if(idT<=0){idT=6+Math.random()*8;const near=WL().filter(w=>Math.hypot(w.x-P.x,w.z-P.z)<12);if(near.length){const w=near[Math.random()*near.length|0],d=Math.hypot(w.x-P.x,w.z-P.z);voice(w.ty,'idle',.25+.55*(1-d/12))}}
})();
/* перевірка в налаштуваннях: справжні звуки замість тестових */
const _pf=pfTab;pfTab=function(t){_pf(t);if(t!='o')return;const m=document.getElementById('stm'),f=document.getElementById('stf');
 if(m&&!m.dataset.real){m.dataset.real=1;m.onclick=()=>{first();startMusic();tickMusic(true)};m.textContent='▶ Музика грає у фоні'}
 if(f&&!f.dataset.real){f.dataset.real=1;f.onclick=()=>{first();sfx('levelup')}}};
}catch(e){console.warn('sound2',e)}})();
