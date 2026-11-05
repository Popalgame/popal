/* 0.3.2: перехід старих збережень на нову карту Локації 2 (один раз, inv._loc2).
   Острів став прямокутним, зони й хребти — інші, тож база могла б опинитися в морі, в горах чи серед сильних диких.
   Тому вся база гравця (Попал-центр, будівлі, скрині, грядки, кошики, стіни й дахи будинків, могили з речами) зсувається
   разом, не змінюючи розташування, у Бухту прибуття (SP[0]); сам гравець з'являється біля печери прибуття.
   Цей модуль іде одразу після core-world.js — раніше, ніж модулі будівель читають свої дані з inv. */
(function(){try{
if(window.REALM==='isle'||typeof inv=='undefined')return;let S0=null;try{S0=eval('SP')[0]}catch(_){}if(!S0)return;
if(inv._loc2)return;
const hasBase=!!(inv._cen||(Array.isArray(inv._b)&&inv._b.length)||(Array.isArray(inv._bs)&&inv._bs.length)||(Array.isArray(inv._ch)&&inv._ch.length));
let hs=0;try{hs=eval('hasSave')}catch(_){}
if(hs){
 if(hasBase){const ref=inv._cen||(inv._b&&inv._b[0]?[inv._b[0][2],inv._b[0][3]]:inv._ch&&inv._ch[0]?[inv._ch[0].x,inv._ch[0].z]:null);
  if(ref){const r3=v=>Math.round(v/3)*3,dx=r3(S0[0]-ref[0]),dz=r3(S0[1]-ref[1]);
   if(inv._cen)inv._cen=[+(inv._cen[0]+dx).toFixed(2),+(inv._cen[1]+dz).toFixed(2)];
   (inv._b||[]).forEach(b=>{b[2]=+(b[2]+dx).toFixed(2);b[3]=+(b[3]+dz).toFixed(2)});
   (inv._ch||[]).forEach(c=>{if(c&&c.x!=null){c.x=+(c.x+dx).toFixed(2);c.z=+(c.z+dz).toFixed(2)}});
   (inv._gd||[]).forEach(g=>{if(g&&g.x!=null){g.x+=dx;g.z+=dz}});
   (inv._bs||[]).forEach(p=>{p[1]+=dx/3;p[2]+=dz/3});
   const rekey=(o,f)=>{if(!o||typeof o!='object')return o;const n={};for(const k in o){const m=/^(-?[\d.]+),(-?[\d.]+)$/.exec(k);n[m?f(+m[1],+m[2]):k]=o[k]}return n};
   inv._gdn=rekey(inv._gdn,(x,z)=>Math.round(x+dx*10)+','+Math.round(z+dz*10));/* ключ грядки: x·10,z·10 (garden.js) */
   inv._bsk=rekey(inv._bsk,(x,z)=>Math.round((x+dx)*10)/10+','+Math.round((z+dz)*10)/10)}}
 delete inv._dgRet;try{localStorage.setItem('zi_arrive','1')}catch(_){}/* wild-levels.js поставить героя біля печери прибуття */
 setTimeout(()=>{try{msg('🗺️ Світ оновився: це Локація 2. Ваша база тепер у Бухті прибуття, поруч із печерою')}catch(_){}},4000)}
inv._loc2=1;
}catch(e){console.warn('loc2-migrate',e)}})();
