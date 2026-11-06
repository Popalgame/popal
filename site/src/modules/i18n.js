/* 0.2.11: мови гри — українська, English, Polski, русский.
   • Перший запуск: мова береться з мови телефона / браузера (navigator.languages): uk → українська, ru або be → русский,
     pl → Polski, будь-яка інша → English. Вибір у Налаштуваннях → «🌐 Мова» зберігається (localStorage zi_lang; «auto» — як на телефоні).
   • Код гри пише текст українською, а цей модуль перекладає те, що бачить гравець: текстові вузли сторінки, підказки (title, placeholder,
     aria-label, alt), повідомлення alert/confirm, написи на canvas (fillText) і заголовок вкладки. Логіка гри від мови не залежить.
   • Словник: site/src/i18n/strings.tsv (uk → en, pl, ru) → scripts/i18n-build.mjs → site/src/i18n/{en,pl,ru}.js.
     Спершу шукається весь рядок цілком, потім — відомі фрагменти всередині (найдовші першими), числа й імена лишаються як є.
   • Цей файл підключено в <head> до решти скриптів: словник обраної мови вантажиться одразу, тож гра з першого кадру потрібною мовою.
     Зміна мови в налаштуваннях — без перезапуску: довантажується словник і весь екран перекладається заново.
   • Вузли з атрибутом translate="no" (назви мов у налаштуваннях) не перекладаються. */
(function(){
const LANGS=[['uk','Українська'],['en','English'],['pl','Polski'],['ru','Русский']],OK=LANGS.map(l=>l[0]),KEY='zi_lang',VER='0.2.15';
const detect=()=>{let ls=[];try{ls=(navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'en']).map(s=>String(s).toLowerCase().split('-')[0])}catch(_){}
 for(const b of ls){if(b=='uk')return'uk';if(b=='ru'||b=='be')return'ru';if(b=='pl')return'pl';if(b=='en')return'en'}return'en'};
let pref='auto';try{pref=localStorage.getItem(KEY)||'auto'}catch(_){}
if(pref!='auto'&&!OK.includes(pref))pref='auto';
let lang=pref=='auto'?detect():pref;
const CY=/[А-Яа-яІіЇїЄєҐґ]/;
let DICT=null,RX=null,cache=new Map();
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function setDict(d){DICT=d||null;cache=new Map();RX=null;if(!DICT)return;
 const ks=Object.keys(DICT).filter(k=>k.trim().length>1||/[^\s\p{L}]/u.test(k)).sort((a,b)=>b.length-a.length);
 try{RX=new RegExp('(?<![\\p{L}])(?:'+ks.map(esc).join('|')+')(?![\\p{L}])','gu')}catch(e){console.warn('i18n rx',e)}}
/* переклад рядка: цілий рядок → фрагменти */
function tr(s){if(!DICT||typeof s!='string'||!CY.test(s))return s;const c=cache.get(s);if(c!==undefined)return c;
 let out;const t=s.trim();if(DICT[t]!==undefined){const i=s.indexOf(t);out=s.slice(0,i)+DICT[t]+s.slice(i+t.length)}
 else out=RX?s.replace(RX,m=>DICT[m]!==undefined?DICT[m]:m):s;
 if(cache.size>6000)cache.clear();cache.set(s,out);return out}
window.plT=tr;window.plLang=()=>lang;
/* ---------- DOM ---------- */
const SRC=new WeakMap(),OUT=new WeakMap();/* вузол → оригінал і наш переклад */
const ATTR=['title','placeholder','aria-label','alt'];
const skip=n=>{const p=n.nodeType==3?n.parentNode:n;if(!p||!p.closest)return false;const tg=p.nodeName;if(tg=='SCRIPT'||tg=='STYLE'||tg=='TEXTAREA')return true;return !!p.closest('[translate="no"]')};
let busy=false;
function doText(n){const v=n.nodeValue;if(!v)return;if(OUT.get(n)===v&&SRC.has(n)){/* вже наш переклад */return}
 if(skip(n))return;SRC.set(n,v);const t=DICT?tr(v):v;OUT.set(n,t);if(t!==v)n.nodeValue=t}
function doAttrs(el){if(!el.getAttribute)return;for(const a of ATTR){const v=el.getAttribute(a);if(!v)continue;const k='_i18n_'+a;const st=el[k];
  if(st&&st.out===v)continue;if(skip(el))continue;const t=DICT?tr(v):v;el[k]={src:v,out:t};if(t!==v)el.setAttribute(a,t)}
 if(el.nodeName=='INPUT'&&/^(button|submit)$/i.test(el.type)){const v=el.value,st=el._i18n_v;if(!(st&&st.out===v)){const t=DICT?tr(v):v;el._i18n_v={src:v,out:t};if(t!==v)el.value=t}}}
function walk(root){if(!root)return;if(root.nodeType==3){doText(root);return}if(root.nodeType!=1&&root.nodeType!=9&&root.nodeType!=11)return;
 if(root.nodeType==1){if(root.nodeName=='SCRIPT'||root.nodeName=='STYLE')return;doAttrs(root)}
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,{acceptNode:x=>(x.nodeName=='SCRIPT'||x.nodeName=='STYLE')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
 let n;while((n=w.nextNode())){if(n.nodeType==3)doText(n);else doAttrs(n)}}
const mo=new MutationObserver(list=>{if(busy)return;busy=true;try{for(const m of list){
 if(m.type=='characterData')doText(m.target);else if(m.type=='attributes')doAttrs(m.target);else for(const a of m.addedNodes)walk(a)}}finally{busy=false}});
function observe(){mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTR.concat('value')})}
/* повний перепереклад після зміни мови: беремо оригінал, якщо текст не змінювався грою */
function retranslate(){busy=true;try{const w=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;
 while((n=w.nextNode())){if(n.nodeType==3){const v=n.nodeValue;let src=v;if(SRC.has(n)&&OUT.get(n)===v)src=SRC.get(n);if(!src||skip(n))continue;const t=DICT?tr(src):src;SRC.set(n,src);OUT.set(n,t);if(t!==v)n.nodeValue=t}
  else{if(n.nodeName=='SCRIPT'||n.nodeName=='STYLE')continue;for(const a of ATTR){const v=n.getAttribute&&n.getAttribute(a);if(!v)continue;const k='_i18n_'+a,st=n[k],src=st&&st.out===v?st.src:v;const t=DICT?tr(src):src;n[k]={src,out:t};if(t!==v)n.setAttribute(a,t)}}}
 setTitle()}finally{busy=false}try{document.documentElement.lang=lang}catch(_){}try{window.dispatchEvent(new CustomEvent('pl-lang',{detail:lang}))}catch(_){}}
/* ---------- canvas, діалоги, заголовок ---------- */
try{const P=CanvasRenderingContext2D.prototype;for(const f of['fillText','strokeText','measureText']){const o=P[f];P[f]=function(t){if(DICT&&typeof t=='string'&&CY.test(t)){const a=[...arguments];a[0]=tr(t);return o.apply(this,a)}return o.apply(this,arguments)}}}catch(_){}
for(const f of['alert','confirm','prompt']){const o=window[f];if(o)window[f]=function(t){const a=[...arguments];if(typeof t=='string')a[0]=tr(t);return o.apply(window,a)}}
function setTitle(){/* назва гри однакова всіма мовами */}
/* ---------- завантаження словника ---------- */
const src=l=>'src/i18n/'+l+'.js?v='+VER;
function load(l,cb){if(l=='uk'){setDict(null);cb&&cb();return}
 const s=document.createElement('script');s.src=src(l);s.onload=()=>{setDict(window.I18N_DICT);cb&&cb()};s.onerror=()=>{console.warn('i18n: no dict',l);cb&&cb()};document.head.appendChild(s)}
window.plSetLang=function(p){pref=p;try{localStorage.setItem(KEY,p)}catch(_){}const l=p=='auto'?detect():p;if(l===lang&&(l=='uk'||DICT)){retranslate();return}
 lang=l;load(l,retranslate)};
window.plLangPref=()=>pref;window.plLangDetect=detect;window.PL_LANGS=LANGS;
try{document.documentElement.lang=lang}catch(_){}
if(lang!='uk'){
 /* синхронно, поки сторінка ще читається: словник буде готовий до першого кадру */
 if(document.readyState=='loading'){window.I18N_DICT=null;document.write('<script src="'+src(lang)+'"><\/script><script>window.plI18nReady&&plI18nReady()<\/script>');window.plI18nReady=()=>{setDict(window.I18N_DICT);walk(document.documentElement)}}
 else load(lang,()=>walk(document.documentElement))}
observe();
document.addEventListener('DOMContentLoaded',()=>{busy=true;try{walk(document.documentElement)}finally{busy=false}});
/* ---------- вкладка «🌐 Мова» в Налаштуваннях ---------- */
function tab(){const s=document.getElementById('pfs'),c0=document.getElementById('pfc');if(!s||!c0||typeof pfTab!='function'||document.querySelector("#pfs [data-t='lang']"))return;
 const css=document.createElement('style');css.textContent=`
#pfc .lgw{flex:1 1 100%;max-width:760px;margin:0 auto}
#pfc .lgw h4{font-size:17px}
#pfc .lgg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0 14px}
#pfc .lgb{position:relative;min-height:66px;border-radius:12px;border:2px solid #c9a24a;background:linear-gradient(#1c2752,#141c3c);color:#ffe7a8;font:800 21px system-ui,sans-serif;cursor:pointer;letter-spacing:.3px;box-shadow:inset 0 0 0 1px rgba(255,231,168,.08)}
#pfc .lgb:hover{border-color:#ffd977}
#pfc .lgb.on{background:linear-gradient(#ffa356,#c8431f);color:#fff;border-color:#ffe7a0;box-shadow:0 0 0 2px rgba(255,217,119,.35),0 6px 16px rgba(200,67,31,.35)}
#pfc .lgb.on::after{content:'✔';position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:18px}
#pfc .lga{width:100%;min-height:48px;border-radius:12px;border:2px solid #c9a24a;background:linear-gradient(#1c2752,#141c3c);color:#e6eefc;font:700 15px system-ui,sans-serif;cursor:pointer}
#pfc .lga.on{border-color:#7fe3f5;color:#fff;box-shadow:0 0 0 1px rgba(127,227,245,.35)}
#pfc .lgw p{margin:10px 2px 0;color:#c9d6e4;font-size:13px;line-height:1.45}
@media (max-height:430px){#pfc .lgb{min-height:52px;font-size:18px}#pfc .lgg{gap:9px;margin:8px 0 10px}}`;document.head.appendChild(css);
 const b=document.createElement('button');b.dataset.t='lang';b.textContent='🌐 Мова';const info=s.querySelector("[data-t='i']");s.insertBefore(b,info||null);
 b.onclick=()=>pfTab('lang');
 const _pf=pfTab;pfTab=function(t){if(t!=='lang')return _pf.apply(this,arguments);
  document.querySelectorAll('#pfs button').forEach(x=>x.classList.toggle('on',x.dataset.t=='lang'));const c=document.getElementById('pfc');c.className='';c.innerHTML='';render(c)};
 function render(c){const auto=pref=='auto',dn=(LANGS.find(l=>l[0]==detect())||LANGS[1])[1];
  c.innerHTML=`<div class='lgw'><h4>Мова гри</h4><div class='lgg' translate='no'>${LANGS.map(([k,n])=>`<button class='lgb ${!auto&&lang==k?'on':''}' data-lg='${k}'>${n}</button>`).join('')}</div>
  <button class='lga ${auto?'on':''}' data-lg='auto'>📱 <span>Як на телефоні</span> · <span translate='no'>${dn}</span>${auto?' ✔':''}</button>
  <p>Спочатку гра бере мову телефона. Тут її можна змінити — гра перемкнеться одразу.</p></div>`;
  c.querySelectorAll('[data-lg]').forEach(x=>x.onclick=()=>{window.plSetLang(x.dataset.lg);setTimeout(()=>{if(document.querySelector("#pfs [data-t='lang'].on"))render(c)},60)})}}
if(document.readyState=='complete')setTimeout(tab,0);else addEventListener('load',()=>setTimeout(tab,0));
})();
