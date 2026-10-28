(function(){try{
const N=42;let ORD=[];try{ORD=JSON.parse(localStorage.getItem('zi_ord')||'[]')}catch(_){}
const sv=()=>{try{localStorage.setItem('zi_ord',JSON.stringify(ORD))}catch(_){}};
function sync(){const ks=Object.keys(IT).filter(k=>cnt(k)>0);while(ORD.length<N)ORD.push(null);ORD=ORD.slice(0,N).map(k=>k&&ks.includes(k)?k:null);const SNv=24+(window.bagS?bagS():0);for(const k of ks)if(!ORD.includes(k)){let i=ORD.findIndex((x,j)=>x==null&&j<SNv);if(i<0)i=ORD.indexOf(null);if(i>=0)ORD[i]=k}}
function bar(g){const t=g.parentNode.querySelector('.i2sb');if(!t)return;const th=t.firstChild,r=Math.min(1,g.clientHeight/(g.scrollHeight||1)),h=Math.max(18,r*t.clientHeight),mx=g.scrollHeight-g.clientHeight;th.style.height=h+'px';th.style.transform='translateY('+(mx>0?g.scrollTop/mx*(t.clientHeight-h):0)+'px)';t.style.opacity=r>=1?.35:1}
const _r=ivR;ivR=function(){_r();const c=$('ivc');if(ivTab!='i'){c.classList.remove('fix');return}c.classList.add('fix');const g=c.querySelector('.i2g');if(!g)return;const on=(g.querySelector('.i2s.on')||{dataset:{}}).dataset.sl;sync();sv();
g.innerHTML=ORD.map((k,i)=>k?`<button class='i2s ${k==on?'on':''}' data-sl='${k}' data-ix='${i}'>${IT[k][0]}<b>${cnt(k)}</b></button>`:`<div class='i2s${i>=24+(window.bagS?bagS():0)?' lk':''}' data-ix='${i}'>${i>=24+(window.bagS?bagS():0)?'🔒':''}</div>`).join('');
const w=document.createElement('div');w.className='i2gw';g.parentNode.insertBefore(w,g);w.appendChild(g);const tr=document.createElement('div');tr.className='i2sb';tr.innerHTML='<i></i>';w.appendChild(tr);
g.scrollTop=ivR.st||0;requestAnimationFrame(()=>bar(g));g.onscroll=()=>{ivR.st=g.scrollTop;bar(g)};
const sc=y=>{const r=tr.getBoundingClientRect();g.scrollTop=Math.max(0,Math.min(1,(y-r.top)/r.height))*(g.scrollHeight-g.clientHeight)};
tr.onpointerdown=e=>{e.preventDefault();tr.setPointerCapture(e.pointerId);sc(e.clientY);tr.onpointermove=ev=>sc(ev.clientY);tr.onpointerup=tr.onpointercancel=()=>{tr.onpointermove=null}}};
let D=null,gh=null,noClick=0;
const under=(x,y)=>{const el=document.elementFromPoint(x,y);return el&&el.closest('.i2g .i2s[data-ix]')};
function start(){if(!D||D.go)return;D.go=1;clearTimeout(D.t);D.s.classList.add('drg');gh=document.createElement('div');gh.className='i2ghost';gh.innerHTML=D.s.innerHTML;document.body.appendChild(gh);mv(D.x,D.y);if(navigator.vibrate)navigator.vibrate(15)}
function mv(x,y){gh.style.left=x+'px';gh.style.top=y+'px';document.querySelectorAll('.i2s.ov').forEach(e=>e.classList.remove('ov'));const t=under(x,y);if(t&&t!==D.s)t.classList.add('ov')}
function end(x,y,ok){if(!D)return;clearTimeout(D.t);if(D.go){noClick=Date.now();if(gh){gh.remove();gh=null}const t=ok&&under(x,y);if(t&&t!==D.s&&!(t.classList.contains('lk')&&!ORD[+t.dataset.ix])){const a=D.ix,b=+t.dataset.ix;[ORD[a],ORD[b]]=[ORD[b],ORD[a]];sv()}D=null;ivR();return}D=null}
document.addEventListener('pointerdown',e=>{const s=e.target.closest('#ivc .i2g .i2s[data-sl]');if(!s)return;D={s,ix:+s.dataset.ix,x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,go:0};D.t=setTimeout(start,220)});
document.addEventListener('pointermove',e=>{if(!D)return;D.x=e.clientX;D.y=e.clientY;if(!D.go){const dx=e.clientX-D.x0,dy=e.clientY-D.y0;if(Math.hypot(dx,dy)>8){if(Math.abs(dy)>Math.abs(dx)){clearTimeout(D.t);D=null}else start()}}if(D&&D.go)mv(e.clientX,e.clientY)});
document.addEventListener('touchmove',e=>{if(D&&D.go)e.preventDefault()},{passive:false});
document.addEventListener('pointerup',e=>end(e.clientX,e.clientY,true));
document.addEventListener('pointercancel',e=>{if(D&&D.go)end(D.x,D.y,true);else end(0,0,false)});
document.addEventListener('click',e=>{if(Date.now()-noClick<400&&e.target.closest('#ivc')){e.stopImmediatePropagation();e.preventDefault()}},true);
}catch(e){console.warn('dnd',e)}})();
