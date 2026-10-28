/* 0.1.19: Попалпедія в стилі довідника — список видів (№, імʼя, стихії), 3D-модель попала, вкладки «Характеристики» і «Зона проживання»,
   навик супутника, робочі вміння з рівнями, трофеї, опис і бонус за поїмку (перші 10 попалів кожного виду дають додатковий досвід).
   Не зустрінутий вид — темний силует і «???»; зустрінутий — модель і імʼя; спійманий — уся інформація. */
(function(){try{
const N=T.length,CB=10,CBXP=40;
/* ---------- облік: зустрінуто / спіймано ---------- */
if(!inv._dx||!Array.isArray(inv._dx.s))inv._dx={s:Array(N).fill(0),c:Array(N).fill(0)};
const DX=inv._dx;for(let i=0;i<N;i++){DX.s[i]=DX.s[i]||0;DX.c[i]=DX.c[i]||0}
pals.forEach(p=>{const n=pals.filter(q=>q.ty===p.ty).length;if(DX.c[p.ty]<n)DX.c[p.ty]=n;if(DX.s[p.ty]<DX.c[p.ty])DX.s[p.ty]=DX.c[p.ty]});
setInterval(()=>{for(const w of wild){if(w._sn)continue;if(Math.hypot(w.x-P.x,w.z-P.z)<14){w._sn=1;DX.s[w.ty]++}}},500);
const _ap=addPal;addPal=function(ty,quiet){const r=_ap.apply(this,arguments);if(!quiet&&T[ty]){DX.c[ty]++;if(DX.s[ty]<DX.c[ty])DX.s[ty]=DX.c[ty];
 if(DX.c[ty]<=CB)setTimeout(()=>{addXp(CBXP);msg('📖 Бонус за поїмку '+T[ty].n+': '+DX.c[ty]+' / '+CB+' · +'+CBXP+' XP')},1200)}return r};

/* ---------- дані для довідника ---------- */
const EC={wa:['#3a9be0','💧'],fi:['#e8603a','🔥'],ea:['#a8713f','⛰️'],ai:['#5fb8c8','🌪️'],gr:['#5fb04a','🌿'],da:['#7a5ad6','🌑'],ne:['#8e8ea0','⚪']};
const EN={wa:'Вода',fi:'Вогонь',ea:'Земля',ai:'Повітря',gr:'Трава',da:'Темрява',ne:'Нейтральний'};
const ATK={wa:'Водяний струмінь',fi:'Вогняний плювок',ea:'Кам’яний удар',ai:'Вихор',gr:'Бамбуковий смерч',da:'Тіньова куля',ne:'Наскок'};
const JOBS=[['chop','🪓','Рубка дерева'],['mine','⛏️','Видобуток каменю'],['gather','🫐','Збір ягід і грибів'],['carry','📦','Перенесення їжі'],['cook','🔥','Готування їжі'],['water','💧','Поливання'],['cool','❄️','Охолодження їжі']];
const LORE=['Добродушний ласун, що жує бамбук цілими днями. Там, де він пройде, дерева ростуть швидше — кажуть, він їм наспівує.',
 'Ходячий шматок гори. Кристали на спині світяться, коли поруч є руда, тож шахтарі здавна беруть його з собою.',
 'Живе біля гарячих каменів і дихає іскрами. Розлючений Ігніс плюється вогнем так, що плавиться навіть залізо.',
 'Тінь, що навчилася ходити. Уміє з’являтися там, де його не чекають, і тихо переносить речі, поки ніхто не дивиться.',
 'Пухнастий, як хмаринка, і такий самий легкий. Коли боїться — підстрибує так високо, що зникає з очей.',
 'Метелик-трудівник: перелітає з квітки на квітку й приносить найсолодші ягоди. Де Крилоша — там завжди врожай.',
 'Його роги вкриті інеєм навіть улітку. Де пройде Мороріг, там довго тримається холод — їжа не псується тижнями.',
 'Народжується під час грози й носить її в собі. Шерсть тріщить від іскор, а стрибає він швидше за блискавку.',
 'Вправний плавець з гострими зубами. Поливає грядки краще за будь-яку лійку, але кусає тих, хто лізе до води без дозволу.',
 'Птах, що бачив світанок над краєм світу. Його пір’я гріє, як багаття, а крик розганяє туман.'];
const elsOf=i=>(T[i].e||['ne']);
const chip=k=>`<span class='dxe' style='background:${EC[k][0]}'>${EC[k][1]} ${EN[k]}</span>`;

/* ---------- 3D-перегляд ---------- */
let VR=null,VS=null,VC=null,VM=null,vTy=-1,vSil=false;const BLK=new THREE.MeshBasicMaterial({color:0x07080e});
function viewer(host){if(!VR){VR=new THREE.WebGLRenderer({antialias:true,alpha:true});VR.setPixelRatio(Math.min(devicePixelRatio,2));VR.outputEncoding=THREE.sRGBEncoding;VR.toneMapping=THREE.ACESFilmicToneMapping;
  VS=new THREE.Scene();VS.add(new THREE.HemisphereLight(0xe8f2ff,0x3a3050,1.1));const d=new THREE.DirectionalLight(0xfff0d8,1.6);d.position.set(2,4,3);VS.add(d);const r=new THREE.DirectionalLight(0x7fe3f5,.8);r.position.set(-3,2,-2);VS.add(r);
  VC=new THREE.PerspectiveCamera(32,1,.1,50)}
 host.appendChild(VR.domElement);const w=host.clientWidth||300,h=host.clientHeight||260;VR.setSize(w,h);VC.aspect=w/h;VC.updateProjectionMatrix()}
function setModel(ty,sil){if(vTy===ty&&VM){vSil=sil;return}if(VM){VS.remove(VM.root);VM=null}vTy=ty;vSil=sil;
 try{VM=window.PALMODEL?PALMODEL.build(ty):null;if(VM)VM._pm=1}catch(e){VM=null}if(!VM)VM={root:mkPal(T[ty].c)};
 const b=new THREE.Box3().setFromObject(VM.root),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3()),k=1.6/Math.max(s.x,s.y,s.z);
 VM.root.scale.multiplyScalar(k);VM.root.position.set(-c.x*k,-b.min.y*k-.8,-c.z*k);VS.add(VM.root);VC.position.set(0,.35,4.6);VC.lookAt(0,0,0)}
let raf=0;function loop(t){raf=0;const host=document.querySelector('#ivc .dxv');if(!host||!VR||typeof ivO==='undefined'||!ivO||ivTab!='d'||tab!=0)return;
 if(VM){VM.root.rotation.y=t/1000*.6;if(VM._pm)try{PALMODEL.pose(VM,t/1000,'idle',0)}catch(_){}
  VS.overrideMaterial=vSil?BLK:null;VR.render(VS,VC)}
 raf=requestAnimationFrame(loop)}

/* ---------- вкладка «Попалпедія» ---------- */
const css=document.createElement('style');css.id='dex-css';css.textContent=`
#ivc .dx{display:grid;grid-template-columns:minmax(150px,27%) 1fr minmax(200px,32%);grid-template-rows:auto 1fr;gap:8px;height:100%;min-height:0;color:#fff}
#ivc .dxl{grid-row:1/3;display:flex;flex-direction:column;min-height:0}
#ivc .dxls{flex:1;overflow:auto;display:flex;flex-direction:column;gap:5px;padding-right:4px}
#ivc .dxi{background:linear-gradient(90deg,rgba(255,255,255,.08),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:5px 8px;cursor:pointer;display:flex;flex-direction:column;gap:2px}
#ivc .dxi.on{background:linear-gradient(90deg,#3a8ee6,#2d6fc0);border-color:#7fc4ff}
#ivc .dxi .nm{display:flex;align-items:center;gap:6px;font-size:11px;opacity:.85}#ivc .dxi b{font-size:15px}#ivc .dxi.un b{opacity:.45}
#ivc .dxe{display:inline-block;font-size:10px;font-weight:700;border-radius:4px;padding:1px 6px;color:#fff;white-space:nowrap}
#ivc .dxc{display:flex;gap:6px;padding-top:6px;font-size:11px}#ivc .dxc span{flex:1;background:rgba(255,255,255,.06);border-radius:6px;padding:3px 6px}
#ivc .dxt{grid-column:2/4;display:flex;gap:0;border:1px solid rgba(127,227,245,.4);border-radius:6px;overflow:hidden}
#ivc .dxt button{flex:1;background:rgba(127,227,245,.06);color:#9fc8d8;border:none;padding:5px;font-weight:700;cursor:pointer;font-family:inherit}#ivc .dxt button.on{background:#7fb8c8;color:#0e1a2a}
#ivc .dxm{position:relative;display:flex;flex-direction:column;min-height:0;min-width:0}
#ivc .dxv{flex:1;min-height:0;position:relative;border-radius:12px;background:radial-gradient(circle at 50% 55%,rgba(127,227,245,.12),transparent 65%)}
#ivc .dxv canvas{position:absolute;inset:0;width:100%!important;height:100%!important}
#ivc .dxh{position:absolute;left:8px;top:6px;font-size:13px;opacity:.9}#ivc .dxh b{font-size:18px;display:block}
#ivc .dxd{background:rgba(10,14,28,.85);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px 10px;font-size:12px;line-height:1.35;margin-top:6px}
#ivc .dxr{overflow:auto;min-height:0;display:flex;flex-direction:column;gap:6px;padding-right:4px}
#ivc .dxr h6{margin:0;background:rgba(255,255,255,.1);padding:2px 8px;font-size:12px;color:#dfe8f0;border-radius:3px}
#ivc .dxr .bx{font-size:11.5px;line-height:1.35;padding:2px 4px;opacity:.92}#ivc .dxr .bx b{display:block;font-size:13px;border-left:3px solid #e2bf67;padding-left:6px;margin-bottom:3px}
#ivc .dxw{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:11.5px;padding:0 4px}#ivc .dxw span{display:flex;justify-content:space-between;gap:4px}#ivc .dxw span.no{opacity:.28}
#ivc .dxp{display:flex;align-items:center;gap:3px;padding:0 4px;font-size:12px}#ivc .dxp i{width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25)}#ivc .dxp i.on{background:#7fe3f5;box-shadow:0 0 6px #7fe3f5}#ivc .dxp b{margin-left:auto}
#ivc .dxmap{width:100%;height:100%;object-fit:contain}`;document.head.appendChild(css);
let cur=0,tab=0;
function card(i){const s=DX.s[i]>0,c=DX.c[i]>0,t=T[i];return `<div class='dxi ${i==cur?'on':''} ${s?'':'un'}' data-dx='${i}'><div class='nm'>No.${String(i+1).padStart(3,'0')} ${s?elsOf(i).map(chip).join(''):''}</div><b>${s?t.n:'???'}</b></div>`}
function infoTab(i){const t=T[i],c=DX.c[i]>0,s=DX.s[i]>0,e0=elsOf(i)[0];
 if(!c)return `<h6>Навик супутника</h6><div class='bx'>${s?'Спіймайте цього попала, щоб дізнатися про нього більше.':'Ви ще не зустрічали цього попала.'}</div>`+capPips(i);
 const wk=t.wk||{};
 return `<h6>Навик супутника</h6><div class='bx'><b>${EC[e0][1]} ${ATK[e0]}</b>Поки попал призваний, він сам атакує агресивних істот поруч: 8 + 2 × рівень шкоди, ×1,5 проти слабшої стихії. А ще додає 4 + рівень до ваших ударів.</div>
 <h6>Робочі вміння</h6><div class='dxw'>${JOBS.map(([k,ic,nm])=>`<span class='${wk[k]?'':'no'}'><em>${ic} ${nm}</em>${wk[k]?'<b>Lv'+wk[k]+'</b>':''}</span>`).join('')}</div>
 <h6>Характеристики</h6><div class='bx'>❤️ Здоровʼя: ${t.hp} · ${t.ag?'😠 Нападає першим':'🙂 Мирний'}<br>Стихія: ${elsOf(i).map(k=>EC[k][1]+' '+EN[k]).join(' / ')}</div>
 <h6>Трофеї</h6><div class='bx'>${t.d=='s'?'🪨 Камінь ×2':'🪵 Деревина ×2'} — за перемогу</div>`+capPips(i)}
function capPips(i){const n=Math.min(CB,DX.c[i]);return `<h6>Бонус за поїмку</h6><div class='dxp'>${Array.from({length:CB},(_,k)=>`<i class='${k<n?'on':''}'></i>`).join('')}<b>${n} / ${CB}</b></div><div class='bx' style='opacity:.6'>Кожен з перших ${CB} спійманих попалів цього виду дає +${CBXP} XP</div>`}
function habitatTab(i){const ZN=[[0,'Долина',1,3],[30,'Луки',3,10],[70,'Ліс',10,25],[110,'Гори',25,45],[145,'Дикі землі',45,70],[175,'Край світу',70,100]];const n=wild.filter(w=>w.ty===i).length;
 return `<h6>Зона проживання</h6><div class='bx'>${DX.s[i]?`Трапляється по всьому краю. Зараз у світі: <b style='display:inline;border:none;padding:0'>${n}</b> (на карті — сині точки).`:'Ви ще не зустрічали цього попала.'}</div>
 <h6>Рівні за зонами</h6><div class='bx'>${ZN.map(z=>`${z[1]}: рів. ${z[2]}–${z[3]}`).join('<br>')}<br><span style='opacity:.6'>Що далі від центру світу — то сильніші дикі попали.</span></div>`}
function drawMap(cv,i){const x=cv.getContext('2d'),S=cv.width,R0=230,tp=(a,b)=>[S/2+a/R0*S/2,S/2+b/R0*S/2];x.clearRect(0,0,S,S);
 x.fillStyle='rgba(30,70,110,.6)';x.beginPath();x.arc(S/2,S/2,S/2-2,0,7);x.fill();
 for(let gx=0;gx<120;gx++)for(let gz=0;gz<120;gz++){const wx=(gx/120*2-1)*R0,wz=(gz/120*2-1)*R0;let h=-9;try{h=H(wx,wz)}catch(_){}if(h<-.4)continue;x.fillStyle='#'+BCOL[BIO(wx,wz)].toString(16).padStart(6,'0');const[a,b]=tp(wx,wz);x.fillRect(a,b,S/120+1,S/120+1)}
 x.strokeStyle='rgba(255,255,255,.25)';x.setLineDash([4,4]);[30,70,110,145,175].forEach(r=>{x.beginPath();x.arc(S/2,S/2,r/R0*S/2,0,7);x.stroke()});x.setLineDash([]);
 if(DX.s[i])for(const w of wild){if(w.ty!==i)continue;const[a,b]=tp(w.x,w.z);x.fillStyle='#3aa0ff';x.strokeStyle='#fff';x.lineWidth=1.5;x.beginPath();x.arc(a,b,5,0,7);x.fill();x.stroke()}
 if(inv._cen){const[a,b]=tp(inv._cen[0],inv._cen[1]);x.fillStyle='#7fe3f5';x.font='16px serif';x.textAlign='center';x.fillText('🏠',a,b+5)}
 const[a,b]=tp(P.x,P.z);x.fillStyle='#ffd34e';x.strokeStyle='#1a2040';x.lineWidth=2;x.beginPath();x.arc(a,b,5,0,7);x.fill();x.stroke()}
function render(){const c=$('ivc');if(!c)return;const t=T[cur],s=DX.s[cur]>0,cc=DX.c[cur]>0;
 const seenN=DX.s.filter(v=>v>0).length,caughtN=DX.c.filter(v=>v>0).length;
 c.innerHTML=`<div class='dx'><div class='dxl'><div class='dxls'>${T.map((_,i)=>card(i)).join('')}</div><div class='dxc'><span>👁 Зустрінуто: ${seenN} / ${N}</span><span>📖 Спіймано: ${caughtN} / ${N}</span></div></div>
 <div class='dxt'><button data-dt='0' class='${tab==0?'on':''}'>Характеристики</button><button data-dt='1' class='${tab==1?'on':''}'>Зона проживання</button></div>
 <div class='dxm'>${tab==0?`<div class='dxv'><div class='dxh'>No.${String(cur+1).padStart(3,'0')}<b>${s?t.n:'???'}</b>${s?elsOf(cur).map(chip).join(' '):''}</div></div>`:`<div class='dxv'><canvas class='dxmap' width='420' height='420'></canvas></div>`}
 <div class='dxd'>${cc?LORE[cur]:s?'Ви бачили цього попала. Спіймайте його, щоб прочитати опис.':'Про цього попала поки нічого не відомо.'}</div></div>
 <div class='dxr'>${tab==0?infoTab(cur):habitatTab(cur)}</div></div>`;
 c.querySelectorAll('[data-dx]').forEach(e=>e.onclick=()=>{cur=+e.dataset.dx;render()});
 c.querySelectorAll('[data-dt]').forEach(e=>e.onclick=()=>{tab=+e.dataset.dt;render()});
 const on=c.querySelector('.dxi.on');if(on)on.scrollIntoView({block:'nearest'});
 if(tab==0){const v=c.querySelector('.dxv');viewer(v);v.insertBefore(VR.domElement,v.firstChild);setModel(cur,!s);if(!raf)raf=requestAnimationFrame(loop)}
 else drawMap(c.querySelector('.dxmap'),cur)}
const _r=ivR;ivR=function(){_r.apply(this,arguments);if(ivTab=='d')render()};
window.plDex={DX,open:i=>{if(i!=null)cur=i;ivOpen('d')}};
}catch(e){console.warn('popaldex',e)}})();
