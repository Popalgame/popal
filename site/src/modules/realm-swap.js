/* Окремі бази для двох вимірів. Будівлі (inv._b), скрині (inv._ch), стіни й підлоги «Будови» (inv._bs) і Попал-центр (inv._cen)
   належать тому виміру, де їх поставили. Збереження одне, тому на Острові пробудження база великого світу відкладається в inv._M…,
   а острівна береться з inv._I…; у великому світі — навпаки. Завантажується одразу після core-world.js, до модулів, що будують базу. */
(function(){try{
const INV=(()=>{try{return eval('inv')}catch(_){return null}})();if(!INV)return;
const K=['_b','_ch','_bs','_cen'],D=k=>k=='_cen'?null:[];
const isle=window.REALM==='isle';
if(isle){const fresh=!K.some(k=>('_M'+k) in INV);/* щойно з великого світу (або перший запуск) */
 if(fresh)for(const k of K){INV['_M'+k]=INV[k]===undefined?D(k):INV[k];INV[k]=('_I'+k) in INV?INV['_I'+k]:D(k);delete INV['_I'+k]}}
else if(K.some(k=>('_M'+k) in INV)){/* повернулися з острова: острівне — у _I…, своє — назад */
 for(const k of K){INV['_I'+k]=INV[k]===undefined?D(k):INV[k];INV[k]=('_M'+k) in INV?INV['_M'+k]:D(k);delete INV['_M'+k]}}
}catch(e){console.warn('realm-swap:',e)}})();
