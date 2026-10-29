/* 0.0.12: налаштування звуку. Звуків у грі ще немає — тут готова «звукова система»,
   до якої підключатимуться майбутні музика й ефекти:
   Sound.sfxNode / Sound.musicNode — вузли WebAudio, Sound.vol('sfx'|'music') — гучність 0..1 */
(function(){try{
const KEY='zi_snd';let S={on:1,master:80,music:60,sfx:80};
try{Object.assign(S,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const sv=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
let ac=null,mG=null,muG=null,sfG=null;
function ctx(){if(ac)return ac;const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;
 ac=new A();mG=ac.createGain();muG=ac.createGain();sfG=ac.createGain();muG.connect(mG);sfG.connect(mG);mG.connect(ac.destination);apply();return ac}
function vol(k){if(!S.on)return 0;return (S.master/100)*((k=='music'?S.music:k=='sfx'?S.sfx:100)/100)}
function apply(){if(!ac)return;const t=ac.currentTime;mG.gain.setTargetAtTime(S.on?S.master/100:0,t,.02);muG.gain.setTargetAtTime(S.music/100,t,.02);sfG.gain.setTargetAtTime(S.sfx/100,t,.02);
 document.querySelectorAll('audio[data-snd]').forEach(a=>a.volume=vol(a.dataset.snd))}
/* браузер дозволяє звук лише після дотику — «будимо» його при першій взаємодії */
const wake=()=>{const c=ctx();if(c&&c.state=='suspended')c.resume()};
['pointerdown','touchstart','keydown'].forEach(e=>window.addEventListener(e,wake,{passive:true}));
function beep(kind){const c=ctx();if(!c||!vol(kind))return;if(c.state=='suspended')c.resume();
 const o=c.createOscillator(),g=c.createGain(),t=c.currentTime;o.type=kind=='music'?'triangle':'square';
 const notes=kind=='music'?[523,659,784]:[880,1175];
 notes.forEach((f,i)=>o.frequency.setValueAtTime(f,t+i*.12));
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.25,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+notes.length*.12+.1);
 o.connect(g);g.connect(kind=='music'?muG:sfG);o.start(t);o.stop(t+notes.length*.12+.15)}
window.Sound={get on(){return!!S.on},vol,play:beep,ctx,get sfxNode(){ctx();return sfG},get musicNode(){ctx();return muG}};
/* --- вкладка Опції --- */
const row=(id,lab,v)=>`<div class='srow'><span>${lab}</span><input type='range' id='${id}' min='0' max='100' step='5' value='${v}'><b id='${id}v'>${v}%</b></div>`;
const _pf=pfTab;pfTab=function(t){_pf(t);if(t!='o')return;const c=document.getElementById('pfc');if(!c||document.getElementById('sndp'))return;
 const host=c.querySelector('.pcol')||c,d=document.createElement('div');d.id='sndp';
 d.innerHTML=`<h4>🔊 Звук</h4><div class='gseg' id='sonb'><button data-i='1' class='${S.on?'on':''}'>Увімкнено</button><button data-i='0' class='${S.on?'':'on'}'>Вимкнено</button></div>
 <div id='ssl' class='${S.on?'':'soff'}'>${row('smst','Загальна',S.master)}${row('smus','Музика',S.music)}${row('ssfx','Ефекти',S.sfx)}
 <div class='gseg'><button id='stm'>▶ Музика</button><button id='stf'>▶ Ефект</button></div></div>
 <small class='gnote'>Звуків у грі поки немає — налаштування спрацюють, щойно вони з'являться. Кнопками ▶ можна перевірити гучність.</small>`;
 host.appendChild(d);
 d.querySelectorAll('#sonb button').forEach(b=>b.onclick=()=>{S.on=+b.dataset.i;sv();apply();d.querySelectorAll('#sonb button').forEach(x=>x.classList.toggle('on',x===b));d.querySelector('#ssl').classList.toggle('soff',!S.on)});
 [['smst','master'],['smus','music'],['ssfx','sfx']].forEach(([id,k])=>{const r=d.querySelector('#'+id);r.oninput=()=>{S[k]=+r.value;d.querySelector('#'+id+'v').textContent=r.value+'%';sv();apply()}});
 d.querySelector('#stm').onclick=()=>beep('music');d.querySelector('#stf').onclick=()=>beep('sfx')};
}catch(e){console.warn('sound',e)}})();
