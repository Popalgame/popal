/* Пал захищає гравця: коли дика істота б'є гравця, обраний пал біжить у відповідь */
window.palDefend=function(w){
 try{
  const p=pals[selP]||pals[0];if(!p||!w||p.nd||(window.palOn&&!palOn()))return;
  const dm=Math.round((6+3*(p.lv||1))*(window.elM?elM(p.ty,w.ty):1));
  let k=0;const iv=setInterval(()=>{p.x+=(w.x-p.x)*.35;p.z+=(w.z-p.z)*.35;p.a=Math.atan2(w.x-p.x,w.z-p.z);if(++k>=5)clearInterval(iv)},40);
  setTimeout(()=>{
   if(!wild.includes(w))return;
   w.hp-=dm;flash(w);dmg(String(dm),w.m,'#9fe4ff');
   if(w.hp<=0){
    sc.remove(w.m);wild.splice(wild.indexOf(w),1);
    res[T[w.ty].d]+=2;st.k++;st[T[w.ty].d]+=2;addXp(window.wXp?wXp(w,15):15);
    msg('🐾 Помічник захистив вас! '+T[w.ty].n+' переможено, +2 ресурси');hud();
   }
  },220);
 }catch(e){}
};
