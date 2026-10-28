(function(){try{
const BG={bp1:{n:'Шкіряна торба',w:40,s:6,t:'t1'},bp2:{n:'Рюкзак мандрівника',w:90,s:12,t:'t2'},bp3:{n:'Рюкзак слідопита',w:150,s:18,t:'t3'}};
for(const k in BG){IT[k]=[`<span class='${BG[k].t}'>🎒</span>`,BG[k].n];if(inv[k]==null)inv[k]=0}
if(eq.bag===undefined)eq.bag=null;
window.bagW=()=>eq.bag&&inv[eq.bag]>0?BG[eq.bag].w:0;window.bagS=()=>eq.bag&&inv[eq.bag]>0?BG[eq.bag].s:0;
RC.push({id:'bp1',n:'Шкіряна торба',c:{w:3,sti:2},d:'+40 до ваги, +6 клітинок',one:1},{id:'bp2',n:'Рюкзак мандрівника',c:{w:5,sti:3,s:2},d:'+90 до ваги, +12 клітинок',one:1},{id:'bp3',n:'Рюкзак слідопита',c:{w:8,sti:4,s:4},d:'+150 до ваги, +18 клітинок, скатка й фляга',one:1});
let wc=0,wf=1,warned=0;window.spdF=()=>{const n=performance.now();if(n-wc>500){wc=n;try{const o=invWt()>invCap();if(o&&!warned){warned=1;msg('⚖️ Перевантаження! Ви рухаєтесь повільніше. Створіть або надіньте рюкзак')}if(!o)warned=0;wf=o?.55:1}catch(_){wf=1}}return wf};
const reb=()=>{buildHero(pl,look||DLOOK);buildHero(hp2,look||DLOOK)};
function wear(k,silent){eq.bag=k||null;reb();if(!silent)msg(k?'🎒 Надіто: '+BG[k].n+' (+'+BG[k].w+' ваги, +'+BG[k].s+' клітинок)':'🎒 Рюкзак знято');try{hud();save()}catch(_){}}
let had=Object.keys(BG).filter(k=>inv[k]>0);
const _r=ivR;ivR=function(){const now=Object.keys(BG).filter(k=>inv[k]>0),nw=now.filter(k=>!had.includes(k));had=now;if(nw.length){const best=nw.sort().pop();if(!eq.bag||best>eq.bag)wear(best)}if(eq.bag&&!(inv[eq.bag]>0))wear(null,1);_r()};
document.addEventListener('click',e=>{const t=e.target.closest('#ivc [data-cyc="g"],#ivc [data-eqg]');if(!t)return;
if(t.dataset.eqg!==undefined)wear(t.dataset.eqg||null);else{const o=[null].concat(Object.keys(BG).filter(k=>inv[k]>0));if(o.length<2){msg('🎒 Рюкзаків ще немає: створіть у Крафті');return}wear(o[(o.indexOf(eq.bag)+1)%o.length])}ivR()});
reb();
}catch(e){console.warn('bags',e)}})();
