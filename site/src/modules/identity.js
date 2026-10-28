(function(){try{
const OWN='d.polataiko@gmail.com',RX=/^[\p{L}\p{N} _-]{3,16}$/u;
const nk=n=>n.trim().toLowerCase().replace(/\s+/g,' ').replace(/[\/.#$\[\]]/g,'_');
window.myPid=null;const show=()=>{const e=document.getElementById('ppid');if(e)e.innerHTML=myPid?'🆔 ID гравця: <b>'+myPid+'</b>':(window.pidErr?'🆔 ID гравця: <small>'+window.pidErr+'</small>':(window.fbU?'🆔 ID гравця: <small>отримуємо…</small>':'🆔 ID гравця: <small>з’явиться після входу в акаунт</small>'))};
const bkp=async()=>{const e=document.getElementById('ppbk');if(!e)return;e.innerHTML='';if(!ok()||!window.fbU)return;try{const d=await fbDb.collection('players').doc(fbU.uid).get();if(!d.exists)return;const v=d.data();let loc=null;try{loc=JSON.parse(localStorage.getItem('zi')||'null')}catch(x){}const cs=v.score||0,bs=v.bestScore||0,ls=window.zsc?zsc(loc):0;let lv=1;try{lv=JSON.parse(v.best||v.data).plv||1}catch(x){}e.innerHTML='☁️ <small>Прогрес збережено в акаунті'+(myPid?' ID '+myPid:'')+'</small>';if(v.best&&bs>ls){const btn=document.createElement('button');btn.className='ppbtn';btn.textContent='↩ Відновити найкращий прогрес (рівень '+lv+')';btn.onclick=()=>{if(!confirm('Замінити поточний прогрес на збережений рівень '+lv+'?'))return;localStorage.setItem('zi',v.best);localStorage.setItem('zi_uid',fbU.uid);location.reload()};e.appendChild(document.createElement('br'));e.appendChild(btn)}}catch(x){}};const _pt=pfTab;pfTab=function(t){_pt(t);if(t!='p')return;if(document.getElementById('ppid')){bkp();return}const a=document.querySelector('#pfc .ppw');if(!a)return;const d=document.createElement('div');d.className='ppid';d.id='ppid';a.after(d);const k=document.createElement('div');k.className='ppid';k.id='ppbk';d.after(k);show();bkp()};
const ok=()=>window.FB_OK&&window.fbDb&&window.firebase;
const err=e=>e&&e.code=='permission-denied'?'⚠️ Firebase: оновіть правила Firestore (Rules)':'⚠️ '+((e&&(e.code||e.message))||'помилка');
async function ensureProfile(u){const db=fbDb,ref=db.collection('profiles').doc(u.uid),p=await ref.get();if(p.exists){myPid=p.data().pid;show();return p.data()}
let pid;if((u.email||'').toLowerCase()===OWN){pid='0001';await ref.set({pid,name:pname,key:''})}
else await db.runTransaction(async tx=>{const cr=db.collection('meta').doc('counter'),c=await tx.get(cr),n=c.exists?c.data().next:11;pid=String(n).padStart(4,'0');if(c.exists)tx.update(cr,{next:n+1});else tx.set(cr,{next:n+1});tx.set(ref,{pid,name:pname,key:''})});
myPid=pid;show();return{pid,name:pname,key:''}}
async function claim(u,name){const db=fbDb,key=nk(name),pr=db.collection('profiles').doc(u.uid),nr=db.collection('names').doc(key);
await db.runTransaction(async tx=>{const p=await tx.get(pr),n=await tx.get(nr);if(n.exists&&n.data().uid!==u.uid)throw{code:'name-taken'};const old=p.exists?(p.data().key||''):'';if(!n.exists)tx.set(nr,{uid:u.uid});if(old&&old!==key)tx.delete(db.collection('names').doc(old));tx.update(pr,{name,key})})}
window.pidClaim=claim;
if(ok())firebase.auth().onAuthStateChanged(async u=>{if(!u){myPid=null;window.pidErr=null;show();return}window.pidErr=null;try{const p=await ensureProfile(u);
if(!p.key){try{await claim(u,pname)}catch(e){if(e.code=='name-taken')msg('⚠️ Імʼя «'+pname+'» вже зайняте іншим гравцем. Змініть його в профілі');else msg(err(e))}}
else if(p.name&&p.name!==pname){pname=p.name;const nm=document.getElementById('nm');if(nm)nm.textContent=pname;save()}}catch(e){window.pidErr=err(e);show();msg(err(e))}});
document.addEventListener('click',async e=>{const b=e.target.closest('#ccgo,#pns');if(!b||b.dataset.ok)return;e.stopImmediatePropagation();e.preventDefault();
const inp=document.getElementById(b.id=='ccgo'?'ccn':'pni'),name=((inp&&inp.value)||'').trim().replace(/\s+/g,' ');
if(!RX.test(name)){msg('✎ Імʼя: від 3 до 16 символів, лише літери, цифри, пробіл, _ або -');return}
if(ok()){const u=firebase.auth().currentUser;try{if(u&&myPid)await claim(u,name);else{const n=await fbDb.collection('names').doc(nk(name)).get();if(n.exists&&(!u||n.data().uid!==u.uid)){msg('⚠️ Імʼя «'+name+'» вже зайняте. Виберіть інше');return}}}
catch(x){if(x.code=='name-taken'){msg('⚠️ Імʼя «'+name+'» вже зайняте. Виберіть інше');return}if(x.code!=='unavailable')msg(err(x))}}
inp.value=name;b.dataset.ok=1;b.click();delete b.dataset.ok},true);
}catch(e){console.warn('ids',e)}})();
