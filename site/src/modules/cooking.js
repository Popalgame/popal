/* 0.1.28: їжу готують лише біля кухні-багаття (котелок над вогнем). Смажені гриби й ягідний пиріг у крафті закриті,
   доки кухню не збудовано (world-007.js, REQ), а готувати можна, лише стоячи поруч із нею (до 5 м). */
(function(){try{
const FOODR={gm:1,pie:1},NEAR=5;
const kit=()=>(window.BPLACED||[]).find(b=>b.id=='B_kit');
window.nearKitchen=()=>{const b=kit();return !!b&&Math.hypot(b.x-P.x,b.z-P.z)<=NEAR};
/* перехоплюємо натискання «Створити» для страв раніше за обробник крафту */
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-r]');if(!t)return;const r=RC[+t.dataset.r];if(!r||!FOODR[r.id])return;
 if(!kit()){e.stopImmediatePropagation();e.preventDefault();msg('🍲 Щоб готувати, збудуйте кухню-багаття (котелок над вогнем)');return}
 if(!nearKitchen()){e.stopImmediatePropagation();e.preventDefault();msg('🍲 Підійдіть до кухні-багаття — їжу готують на вогні')}},true);
}catch(e){console.warn('cooking',e)}})();
