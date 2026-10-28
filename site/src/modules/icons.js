/* 0.1.28: однакові за стилем значки руди й вугілля (рюкзак, скрині, плавильня, крафт): шматок сірого каменю з прожилками —
   у залізної руди мідними з самородками, у вугілля чорними блискучими з антрацитовими гранями. Як і самі жили на карті. */
(function(){try{
function lump(kind){const S=96,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');let s=kind=='ore'?11:23;const r=()=>(s=(s*16807)%2147483647)/2147483647;
 const pts=[];for(let i=0;i<9;i++){const a=i/9*Math.PI*2,R=30+r()*9;pts.push([48+Math.cos(a)*R*1.08,52+Math.sin(a)*R*.86])}
 const path=()=>{x.beginPath();pts.forEach(([u,v],i)=>i?x.lineTo(u,v):x.moveTo(u,v));x.closePath()};
 x.save();x.translate(2,4);path();x.fillStyle='rgba(0,0,0,.35)';x.fill();x.restore();
 path();const g=x.createLinearGradient(20,18,78,86);g.addColorStop(0,kind=='ore'?'#b4b0b4':'#8e8e96');g.addColorStop(1,kind=='ore'?'#5e5a60':'#3e3e46');x.fillStyle=g;x.fill();
 x.save();path();x.clip();
 for(let i=0;i<5;i++){x.fillStyle=`rgba(255,255,255,${.04+r()*.06})`;x.beginPath();x.moveTo(20+r()*50,15+r()*60);x.lineTo(30+r()*50,15+r()*60);x.lineTo(20+r()*50,15+r()*60);x.fill()}
 for(let i=0;i<4;i++){let u=10+r()*20,v=20+r()*56;x.beginPath();x.moveTo(u,v);for(let k=0;k<6;k++){u+=10+r()*6;v+=(r()-.5)*16;x.lineTo(u,v)}
  x.lineCap='round';x.lineJoin='round';x.strokeStyle=kind=='ore'?'#8a4a22':'#0c0c10';x.lineWidth=6;x.stroke();x.strokeStyle=kind=='ore'?'#f0a860':'#3a3a48';x.lineWidth=2.5;x.stroke()}
 for(let i=0;i<5;i++){const u=24+r()*48,v=26+r()*44,R=4+r()*4;x.beginPath();for(let k=0;k<4;k++){const a=k/4*Math.PI*2+r();x.lineTo(u+Math.cos(a)*R,v+Math.sin(a)*R)}x.closePath();
  x.fillStyle=kind=='ore'?(r()<.7?'#e8944a':'#e6ecf4'):'#14141a';x.fill();x.fillStyle=kind=='ore'?'rgba(255,240,210,.8)':'rgba(200,210,230,.85)';x.fillRect(u-1,v-R*.6,2,2)}
 x.restore();path();x.strokeStyle='rgba(20,18,24,.85)';x.lineWidth=2.5;x.stroke();return c.toDataURL()}
const css=document.createElement('style');css.textContent='img.iic{width:1.25em;height:1.25em;vertical-align:-.25em;object-fit:contain;pointer-events:none}';document.head.appendChild(css);
const img=(src,alt)=>`<img class='iic' src='${src}' alt='${alt}'>`;
if(IT.ore)IT.ore[0]=img(lump('ore'),'🟤');if(IT.coal)IT.coal[0]=img(lump('coal'),'⚫');
window.plIconSrc=k=>{const m=/src='([^']+)'/.exec((IT[k]||[''])[0]);return m?m[1]:null};
}catch(e){console.warn('icons',e)}})();
