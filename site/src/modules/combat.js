/* 0.5.x: бій у масштабі Palworld.
   Показники (як у Palworld): HP = 500 + 5·Рівень + базове HP·0.5·Рівень, Атака = 100 + база·0.075·Рівень, Захист = 50 + база·0.075·Рівень.
   Урон ≈ 1.1 · ((1.5·Рівень + 20) · Сила навички · Атака / Захист) / 15, далі множники:
   стихія ×1.5 за кожен уразливий тип цілі (два — ×2.25), ×0.66 за кожен стійкий або той самий (два — ×0.43);
   ×1.2, якщо стихія навички = стихія атакуючого; ×1.5 критичний удар (10%); ×3 по сплячій цілі; розкид ±10%.
   Уночі мирні дикі істоти сплять на місці — удар по сплячій потрійний і будить її.
   Герой: HP = 500 + 25·(Рівень−1), Атака = 100 + 8·(Рівень−1), Захист = 100 + 6·(Рівень−1), удар — сила 40 без стихії. */
(function(){try{
if(typeof T=='undefined')return;
const BEATS={wa:['fi'],fi:['gr'],gr:['ea'],ea:['wa','ai'],ai:['gr','da'],da:['ne'],ne:[]};
/* базові показники й активна навичка кожного виду (порядок — як у T з core-world.js) */
const BASE=[
 {hp:80,atk:80,def:80,sk:'Бамбуковий смерч',p:45},
 {hp:100,atk:85,def:115,sk:'Кристальна лавина',p:55},
 {hp:75,atk:110,def:70,sk:'Плазмова павутина',p:60},
 {hp:70,atk:95,def:75,sk:'Тіньовий двійник',p:50},
 {hp:90,atk:60,def:85,sk:'Хмарний відскок',p:40},
 {hp:70,atk:90,def:70,sk:'Пилковий вихор',p:45},
 {hp:95,atk:85,def:95,sk:'Крижаний спалах',p:55},
 {hp:85,atk:105,def:80,sk:'Грозовий стрибок',p:65},
 {hp:90,atk:95,def:85,sk:'Хвильовий укус',p:55},
 {hp:85,atk:100,def:85,sk:'Сонячний вінець',p:70}];
const DEF0={hp:80,atk:80,def:80,sk:'Удар',p:40};
const base=ty=>BASE[ty]||DEF0;
const els=ty=>(T[ty]&&T[ty].e&&T[ty].e.length)?T[ty].e:['ne'];
function stats(ty,lv){const b=base(ty);lv=Math.max(1,lv||1);return{hp:Math.round(500+5*lv+b.hp*.5*lv),atk:Math.round(100+b.atk*.075*lv),def:Math.round(50+b.def*.075*lv)}}
function skill(ty){const b=base(ty);return{n:b.sk,p:b.p,e:els(ty)[0]}}
/* стихійна ефективність навички стихії a проти цілі з типами ds */
function eff(a,ds){let m=1;if(!a)return 1;for(const d of ds){if(BEATS[a]&&BEATS[a].includes(d))m*=1.5;else if(d===a||(BEATS[d]&&BEATS[d].includes(a)))m*=.66}return m}
/* головна формула: o={lv,sp,atk,def,el,own,ds,sleep} */
function hit(o){const raw=1.1*((1.5*o.lv+20)*o.sp*o.atk/Math.max(1,o.def))/15;
 const e=o.ds?eff(o.el,o.ds):1,stab=o.el&&o.own&&o.own.includes(o.el)?1.2:1,crit=Math.random()<.1,slp=!!o.sleep;
 const v=Math.max(1,Math.round(raw*e*stab*(crit?1.5:1)*(slp?3:1)*(.9+Math.random()*.2)));
 return{v,e,crit,sleep:slp,tag:(e>1?' ✦':e<1?' ▽':'')+(crit?' !':'')+(slp?' 💤':'')}}
const hero=()=>{const L=typeof plv=='number'?plv:1;return{lv:L,atk:100+8*(L-1),def:100+6*(L-1)}};
function wake(w){if(w&&w.sl){w.sl=0;w.ag=1}}
const PW=window.PW={stats,skill,eff,hit,hero,
 /* попал (його навичка) б'є дику істоту */
 palHit(p,w){const s=stats(p.ty,p.lv),k=skill(p.ty),d=w.def||stats(w.ty,w.lv).def,r=hit({lv:p.lv||1,sp:k.p,atk:s.atk,def:d,el:k.e,own:els(p.ty),ds:els(w.ty),sleep:w.sl});wake(w);return r},
 /* герой б'є дику істоту */
 heroHit(w){const h=hero(),d=w.def||stats(w.ty,w.lv).def,r=hit({lv:h.lv,sp:40,atk:h.atk,def:d,sleep:w.sl});wake(w);return r},
 /* дика істота б'є героя (своєю навичкою; у героя немає стихії) */
 wildHit(w,avg){const s=w.atk?{atk:w.atk}:stats(w.ty,w.lv),k=skill(w.ty),o={lv:w.lv||1,sp:k.p*.4,atk:s.atk,def:hero().def,el:k.e,own:els(w.ty)};
  if(avg)return Math.round(1.1*((1.5*o.lv+20)*o.sp*o.atk/o.def)/15*1.2);return hit(o).v}};
window.hpMax=()=>500+25*((typeof plv=='number'?plv:1)-1);
/* сон: уночі мирні (неагресивні) дикі істоти засинають і стоять на місці; удар будить */
if(typeof ANI!='undefined'&&typeof wild!='undefined')ANI.push(()=>{const n=window.isNight&&window.isNight();for(const w of wild){
 if(n&&!w.ag){if(!w.sl){w.sl=1;w._sx=w.x;w._sz=w.z}else{w.x=w._sx;w.z=w._sz;if(w.m){w.m.position.x=w.x;w.m.position.z=w.z}}}
 else if(w.sl&&!n)w.sl=0}});
void PW;
}catch(e){console.warn('combat:',e)}})();
