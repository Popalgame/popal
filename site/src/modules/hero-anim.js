/* Mixer-driven animation for the editor's real SkinnedMesh skeleton. */
(function(){
'use strict';
const T=window.THREE;if(!T)return;
const live=new Set(),prior=window.buildHero;
const get=n=>{try{return eval(n)}catch(_){return undefined}};
const names=window.heroSkinParts||[];
const bone=n=>'hero'+n[0].toUpperCase()+n.slice(1);
function clip(name,duration,frames){
 const tracks=[];
 for(const [key,values] of Object.entries(frames)){
  const split=key.split('.'),path='.bones['+bone(split[0])+'].'+split[1]+'['+split[2]+']';
  tracks.push(new T.NumberKeyframeTrack(path,values.map((_,i)=>i*duration/(values.length-1)),values));
 }
 return new T.AnimationClip(name,duration,tracks);
}
const base={
 'body.position.y':[.66,.66,.66],
 'body.rotation.x':[0,0,0],'body.rotation.z':[0,0,0],
 'head.rotation.x':[0,0,0],'head.rotation.y':[0,0,0],
 'armUpperL.rotation.x':[0,0,0],'armUpperR.rotation.x':[0,0,0],
 'armUpperL.rotation.z':[-.08,-.08,-.08],'armUpperR.rotation.z':[.08,.08,.08],
 'armLowerL.rotation.x':[-.12,-.12,-.12],'armLowerR.rotation.x':[-.12,-.12,-.12],
 'legUpperL.rotation.x':[0,0,0],'legUpperR.rotation.x':[0,0,0],
 'legLowerL.rotation.x':[0,0,0],'legLowerR.rotation.x':[0,0,0]
};
const make=(name,duration,changes)=>clip(name,duration,{...base,...changes});
const clips={
 idle:make('idle',2.4,{'body.position.y':[.66,.673,.66],'head.rotation.x':[0,-.025,0],'armUpperL.rotation.x':[0,.035,0],'armUpperR.rotation.x':[0,-.035,0]}),
 walk:make('walk',.8,{'body.position.y':[.66,.69,.66,.69,.66],'legUpperL.rotation.x':[0,.44,0,-.44,0],'legUpperR.rotation.x':[0,-.44,0,.44,0],'legLowerL.rotation.x':[0,.08,0,.46,0],'legLowerR.rotation.x':[0,.46,0,.08,0],'armUpperL.rotation.x':[0,-.35,0,.35,0],'armUpperR.rotation.x':[0,.35,0,-.35,0]}),
 run:make('run',.53,{'body.position.y':[.66,.72,.66,.72,.66],'body.rotation.x':[.12,.14,.12,.14,.12],'legUpperL.rotation.x':[0,.72,0,-.72,0],'legUpperR.rotation.x':[0,-.72,0,.72,0],'legLowerL.rotation.x':[0,.12,0,.72,0],'legLowerR.rotation.x':[0,.72,0,.12,0],'armUpperL.rotation.x':[0,-.6,0,.6,0],'armUpperR.rotation.x':[0,.6,0,-.6,0]}),
 swim:make('swim',1.15,{'body.rotation.x':[.72,.8,.72,.8,.72],'head.rotation.x':[-.45,-.5,-.45,-.5,-.45],'armUpperL.rotation.x':[-1.4,-2.4,-1.4,-.7,-1.4],'armUpperR.rotation.x':[-1.4,-.7,-1.4,-2.4,-1.4],'armUpperL.rotation.z':[-.42,-.42,-.42,-.42,-.42],'armUpperR.rotation.z':[.42,.42,.42,.42,.42],'legUpperL.rotation.x':[1.18,1.38,1.18,.98,1.18],'legUpperR.rotation.x':[1.18,.98,1.18,1.38,1.18],'legLowerL.rotation.x':[.25,.42,.25,.16,.25],'legLowerR.rotation.x':[.25,.16,.25,.42,.25]}),
 hit:clip('hit',.42,{'body.rotation.z':[0,-.09,.08,0],'head.rotation.y':[0,.13,-.08,0],'armUpperR.rotation.x':[0,-2.2,.6,0],'armLowerR.rotation.x':[0,-.98,-.26,0]}),
 throw:clip('throw',.56,{'body.rotation.z':[0,-.08,.09,0],'armUpperR.rotation.x':[0,-1.4,-2.4,0],'armLowerR.rotation.x':[0,-1.08,-.18,0],'armUpperL.rotation.x':[0,.45,.25,0]})
};
function install(g){
 const skin=g.userData.heroSkin;if(!skin)return;
 const prev=g.userData.rig;if(prev&&prev.mixer)prev.mixer.stopAllAction();live.delete(g);
 const mixer=new T.AnimationMixer(skin.mesh),actions={};
 for(const [key,animation] of Object.entries(clips)){const overlay=key==='hit'||key==='throw',a=mixer.clipAction(animation,undefined,overlay?T.AdditiveAnimationBlendMode:T.NormalAnimationBlendMode);a.setLoop(overlay?T.LoopOnce:T.LoopRepeat,Infinity);a.clampWhenFinished=overlay;actions[key]=a}
 actions.idle.play();skin.mixer=mixer;
 g.userData.rig={skeletal:true,mixer,actions,state:'idle',locomotion:'idle',action:null,actionUntil:0,speed:0,run:0,lastX:null,lastZ:null};live.add(g);
}
window.buildHero=function(g,lk){const result=prior.call(this,g,lk);install(g);return result};
try{const pl=get('pl'),hp2=get('hp2'),lk=get('look')||get('DLOOK');if(pl)window.buildHero(pl,lk);if(hp2)window.buildHero(hp2,lk)}catch(e){console.warn('hero-anim init',e)}
function choose(r,next,fade){if(next===r.locomotion)return;const from=r.actions[r.locomotion],to=r.actions[next];to.reset();to.enabled=true;to.play();to.crossFadeFrom(from,fade,false);r.locomotion=next}
function act(kind){const pl=get('pl'),r=pl&&pl.userData.rig;if(!r||(kind!=='hit'&&kind!=='throw'))return;
 if(r.action&&r.action!==kind)r.actions[r.action].fadeOut(.08);
 const a=r.actions[kind];a.reset().setEffectiveWeight(1).fadeIn(.08).play();r.action=kind;r.actionUntil=performance.now()/1000+clips[kind].duration;r.state=kind}
window.heroAct=act;
document.addEventListener('click',e=>{if(!e.target.closest)return;if(e.target.closest('#hit')){const P=get('P'),N=get('NPCS')||[];if(P&&N.some(n=>Math.hypot(n.x-P.x,n.z-P.z)<3.2))return;act('hit')}},true);
document.addEventListener('click',e=>{if(!e.target.closest||!e.target.closest('#throw'))return;const count=(get('fx')||[]).length;setTimeout(()=>{if((get('fx')||[]).length>count)act('throw')},0)},true);
let last=performance.now();const damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
(function loop(){requestAnimationFrame(loop);const now=performance.now(),dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;
 const pl=get('pl'),P=get('P'),H=window.H;
 for(const g of live){const r=g.userData.rig;if(!r||!g.userData.heroSkin){live.delete(g);continue}if(!g.parent)continue;
  let state='idle';if(g===pl&&P){const velocity=r.lastX==null?0:Math.hypot(P.x-r.lastX,P.z-r.lastZ)/Math.max(dt,.001);r.lastX=P.x;r.lastZ=P.z;r.speed=damp(r.speed,get('menuO')?0:Math.min(15,velocity),8,dt);r.run=damp(r.run,r.speed>3.3?1:0,7,dt);state=H&&H(P.x,P.z)<-1.15?'swim':r.speed>3.3?'run':r.speed>.24?'walk':'idle'}
  if(r.action&&now/1000>=r.actionUntil){r.actions[r.action].fadeOut(.1);r.action=null}
  choose(r,state,state==='swim'?.26:.17);r.state=r.action||r.locomotion;
  r.actions.walk.timeScale=Math.max(.65,Math.min(1.7,r.speed/2.1));r.actions.run.timeScale=Math.max(.8,Math.min(1.45,r.speed/5));
  r.mixer.update(dt);
 }
})();
window.heroAnimationClips=clips;
})();
