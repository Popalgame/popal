(function(){try{
 const menu=document.createElement('div');menu.id='pdm';
 menu.innerHTML="<small></small><button data-d='1'>🛡️ Захищати</button><button data-d='0'>🚫 Не захищати</button>";
 document.body.appendChild(menu);
 const pm=document.getElementById('pwm'),pw2=document.getElementById('pw2');
 const badge=document.createElement('div');badge.id='pdb';pw2.appendChild(badge);
 const KEY='zi_nd';
 const save2=()=>{try{localStorage.setItem(KEY,JSON.stringify(pals.map((p,i)=>p.nd?i:-1).filter(i=>i>=0)))}catch(e){}};
 try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');pals.forEach((p,i)=>{p.nd=a.includes(i)})}catch(e){}
 const cur=()=>pals[selP]||pals[0];
 const paint=()=>{const p=cur();if(!p){badge.style.display='none';return}badge.style.display='block';badge.textContent=p.nd?'🚫':'🛡️';[...menu.querySelectorAll('button')].forEach(b=>b.classList.toggle('on',(b.dataset.d==='1')===!p.nd))};
 function open(){const p=cur();if(!p){msg('Спочатку зловіть істоту');return}menu.querySelector('small').textContent=T[p.ty].n+' у бою';paint();menu.style.display='flex';const r=pm.getBoundingClientRect();menu.style.left=Math.max(4,r.left+r.width/2-75)+'px';menu.style.bottom=(innerHeight-r.top+6)+'px'}
 const close=()=>{menu.style.display='none'};
 /* 0.1.13: дотик до портрета — призов/відкликання (pal-summon.js), меню відкривається довгим натисканням */
 window.pdmToggle=()=>{menu.style.display==='flex'?close():open()};
 menu.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const p=cur();if(!p)return;p.nd=b.dataset.d==='0';save2();paint();msg(p.nd?'🚫 '+T[p.ty].n+' не захищатиме вас':'🛡️ '+T[p.ty].n+' захищатиме вас');close()});
 document.addEventListener('pointerdown',e=>{if(menu.style.display==='flex'&&!menu.contains(e.target)&&e.target!==pm)close()});
 setInterval(paint,500);
}catch(e){console.warn('defmenu:',e)}})();
