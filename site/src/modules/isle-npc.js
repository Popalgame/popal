/* Мешканці Острова пробудження (моделі й розстановка; розмови — npc.js):
   🧓 Дід Вітрило — старий моряк, теж колись прокинувся на цьому пляжі; головний наставник (біля вогнища).
   🔨 Тесля Шкварка — майстриня з величезним молотом; вчить добувати, крафтити й будувати (біля старого верстака).
   🐾 Пані Клубочок — доглядачка попалів у круглих окулярах, з клубками пряжі й своїм Пухоклубом (на луці).
   🗿 Кам'яний Страж Брам — ожила брила біля завалу в ущелині; пропускає далі тих, хто готовий. */
(function(){try{
const I=window.ISLE,N=window.NPC;if(window.REALM!=='isle'||!I||!N||typeof THREE=='undefined')return;
const G=n=>{try{return eval(n)}catch(_){return undefined}};
const sc_=G('sc'),H_=window.H;
const mc={},M=(c,o)=>{const k=c+(o?JSON.stringify(o):'');return mc[k]||(mc[k]=new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.8},o||{})))};
const SPH=new THREE.SphereGeometry(1,16,12),CYL=new THREE.CylinderGeometry(1,1,1,14),CON=new THREE.ConeGeometry(1,1,16),BOX=new THREE.BoxGeometry(1,1,1),TOR=new THREE.TorusGeometry(1,.18,8,20);
function P(g,geo,c,x,y,z,sx,sy,sz,o){const m=new THREE.Mesh(geo,typeof c=='object'?c:M(c,o));m.position.set(x,y,z);m.scale.set(sx,sy==null?sx:sy,sz==null?sx:sz);m.castShadow=true;g.add(m);return m}
/* ---------- людина в стилі гри: велика голова, короткий тулуб ---------- */
function human(o){const g=new THREE.Group(),sk=o.skin||0xf0c8a0,W=o.wide||1;
 /* ноги й черевики */for(const s of[-1,1]){P(g,CYL,o.pants,s*.1*W,.3,0,.085*W,.5,.085);P(g,SPH,o.shoe||0x3a2618,s*.1*W,.06,.05,.1,.07,.15)}
 /* тулуб */const body=P(g,CYL,o.top,0,.8,0,.21*W,.56,.17*W);body.geometry=new THREE.CylinderGeometry(.85,1.1,1,16);
 P(g,SPH,o.top,0,1.07,0,.22*W,.1,.17*W);/* плечі */
 if(o.skirt)P(g,CON,o.skirt,0,.42,0,.34*W,.62,.3*W);
 /* руки: група-плече, щоб махати */
 const arms=[];for(const s of[-1,1]){const a=new THREE.Group();a.position.set(s*.25*W,1.04,0);g.add(a);P(a,CYL,o.sleeve||o.top,0,-.22,0,.08,.46,.08);P(a,SPH,sk,0,-.48,0,.085);a.rotation.z=s*.12;arms.push(a)}
 /* голова */const hd=new THREE.Group();hd.position.y=1.42;g.add(hd);P(hd,SPH,sk,0,0,0,.25,.24,.23);
 for(const s of[-1,1]){P(hd,SPH,0xffffff,s*.085,.02,.2,.045,.05,.03);P(hd,SPH,0x1d1a24,s*.085,.015,.225,.028,.034,.02);P(hd,SPH,0xffffff,s*.078,.03,.238,.009);
  P(hd,SPH,0xff9a9a,s*.14,-.06,.17,.04,.025,.02,{transparent:true,opacity:.55});P(hd,SPH,sk,s*.245,0,0,.04,.06,.03)}
 P(hd,SPH,sk,0,-.04,.235,.035,.03,.03);P(hd,BOX,0x8a3a3a,0,-.11,.21,.06,.012,.01);
 g.userData={arms,hd,wave:t=>{const a=arms[1];if(t==null){a.rotation.z+=(.12-a.rotation.z)*.1;a.rotation.x*=.9;return}a.rotation.z=2.2+Math.sin(t*9)*.35;a.rotation.x=-.2}};
 return g}
/* 🧓 Дід Вітрило */
function vitrylo(){const g=human({top:0x23406a,pants:0x2f3442,sleeve:0x23406a,skin:0xeec4a0,skirt:0x23406a}),hd=g.userData.hd;
 for(const y of[.62,.78,.94])P(g,SPH,0xd8b04a,.0,y,.17,.025);/* ґудзики */P(g,BOX,0x6b4a2a,0,.6,0,.44,.06,.36);/* пасок */
 P(hd,SPH,0xf2f2ee,0,-.15,.1,.2,.17,.15);P(hd,SPH,0xf2f2ee,0,-.06,.2,.11,.04,.05);/* борода й вуса */
 for(const s of[-1,1])P(hd,BOX,0xf2f2ee,s*.085,.085,.215,.07,.02,.02).rotation.z=s*-.25;/* брови */
 P(hd,CYL,0x1d2c4a,0,.2,0,.24,.13,.24);P(hd,CYL,0x1d2c4a,0,.14,.04,.3,.02,.3);P(hd,CYL,0xf2f2ee,0,.15,0,.245,.025,.245);P(hd,SPH,0xd8b04a,0,.21,.23,.035,.035,.015);/* кашкет */
 const pipe=new THREE.Group();pipe.position.set(.08,-.12,.22);hd.add(pipe);P(pipe,CYL,0x5a3418,.06,0,.05,.012,.14,.012).rotation.x=1.3;P(pipe,CYL,0x4a2a12,.06,.04,.12,.03,.06,.03);
 /* палиця */const st=new THREE.Group();g.userData.arms[0].add(st);P(st,CYL,0x7a5230,0,-.6,.05,.025,1.1,.025);P(st,SPH,0x7a5230,0,-.07,.05,.045);
 /* димок з люльки */const sm=[];for(let i=0;i<4;i++)sm.push(P(hd,SPH,0xffffff,.14,0,.34,.03,.03,.03,{transparent:true,opacity:.5}));
 g.userData.idle=t=>{sm.forEach((s,i)=>{const k=(t*.5+i/4)%1;s.position.set(.14+Math.sin(t+i)*.03,.06+k*.5,.34);s.scale.setScalar(.02+k*.05);s.material.opacity=.5*(1-k)})};
 return g}
/* 🔨 Тесля Шкварка */
function shkvarka(){const g=human({top:0x5f8a3a,pants:0x6b4a2a,sleeve:0x5f8a3a,skin:0xe8b48a,shoe:0x2a1a10}),hd=g.userData.hd;
 P(g,BOX,0x8a5a32,0,.72,.14,.36,.62,.04);P(g,BOX,0x8a5a32,0,1.0,.15,.2,.16,.03);/* фартух */P(g,BOX,0xb8b8b8,.08,.7,.17,.06,.08,.02);/* кишеня з цвяхами */
 P(hd,SPH,0xd9542a,0,.06,-.04,.265,.24,.25);P(hd,SPH,0xd9542a,0,.22,-.14,.12,.11,.11);/* волосся й гулька */
 for(let i=-2;i<=2;i++)P(hd,SPH,0xd9542a,i*.07,.13,.18,.06,.05,.05);/* чубчик */
 for(const s of[-1,1]){P(hd,TOR,0x3a3a3a,s*.09,.14,.2,.06,.06,.06).rotation.x=-.3;P(hd,SPH,0x8fe0ff,s*.09,.14,.2,.05,.05,.02,{metalness:.4,roughness:.2})}P(hd,CYL,0x3a3a3a,0,.13,0,.258,.03,.24);/* окуляри-гоглі на лобі */
 for(let i=0;i<5;i++)P(hd,SPH,0xb06a40,(i%2?1:-1)*(.08+i*.02),-.04,.215,.01);/* веснянки */
 /* великий молот: головка на землі, руків'я в правій руці */
 P(g,CYL,0x7a5230,-.4,.36,.06,.032,.62,.032);P(g,BOX,0x6d7078,-.4,.1,.06,.3,.2,.2,{metalness:.5,roughness:.4});P(g,BOX,0x8a8d94,-.4,.1,.06,.32,.08,.22,{metalness:.6,roughness:.3});
 g.userData.arms[0].rotation.z=-.32;const w1=g.userData.wave;g.userData.wave=t=>{if(t==null){g.userData.arms[1].rotation.z+=(-.12-g.userData.arms[1].rotation.z)*.1;g.userData.arms[1].rotation.x*=.9;return}w1(t)};
 return g}
/* 🐾 Пані Клубочок */
function klubochok(){const g=human({top:0x7a4a8a,pants:0x7a4a8a,sleeve:0x7a4a8a,skin:0xf2cfae,skirt:0x7a4a8a,wide:1.25}),hd=g.userData.hd;
 P(g,CON,0x4f9a5a,0,1.03,0,.36,.26,.3).rotation.x=Math.PI;/* шаль */for(let i=0;i<6;i++)P(g,SPH,0xf0e070,Math.cos(i)*.3,.88,Math.sin(i)*.24,.025);
 P(hd,SPH,0xc8c0d8,0,.07,-.05,.265,.23,.25);P(hd,SPH,0xc8c0d8,0,.27,-.06,.13,.12,.12);/* сиве волосся з гулькою */
 for(const s of[-1,1])P(hd,CYL,0xd8b04a,s*.05,.36,-.06,.008,.22,.008).rotation.z=s*.5;/* спиці в гульці */
 for(const s of[-1,1])P(hd,TOR,0x8a6a2a,s*.085,.02,.23,.055,.055,.055);P(hd,BOX,0x8a6a2a,0,.02,.235,.05,.01,.01);/* круглі окуляри */
 /* кошик із клубками */const b=new THREE.Group();b.position.set(0,-.5,.08);g.userData.arms[1].add(b);P(b,CYL,0xb08a50,0,0,0,.13,.1,.13);
 for(const[c,x,z]of[[0xff6a8a,-.05,0],[0x6ad0ff,.05,.03],[0xffd24a,0,-.05]])P(b,SPH,c,x,.08,z,.06);g.userData.arms[1].rotation.z=.35;
 const w0=g.userData.wave;g.userData.wave=t=>{if(t==null){g.userData.arms[1].rotation.z+=(.35-g.userData.arms[1].rotation.z)*.1;return}w0(t)};
 return g}
/* 🗿 Кам'яний Страж Брам */
function bram(){const g=new THREE.Group(),C=window.plCliff,mat=C?C.mat():M(0x8b8277,{flatShading:true}),geo=k=>C?C.geo(k):new THREE.IcosahedronGeometry(1,1);
 const R=(k,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(geo(k),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;g.add(m);return m};
 R(0,0,1.3,0,.75,.8,.6);R(1,0,.55,0,.55,.45,.45);for(const s of[-1,1]){R(2,s*.32,.25,0,.28,.3,.28);R(1,s*.95,1.35,0,.32,.5,.32);R(0,s*1.05,.75,.08,.3,.32,.3)}
 const hd=R(2,0,2.25,.05,.42,.38,.38);
 const E=M(0x6fe6ff,{emissive:0x39c8ff,emissiveIntensity:2});for(const s of[-1,1]){const e=new THREE.Mesh(SPH,E);e.scale.set(.07,.05,.03);e.position.set(s*.15,2.3,.4);g.add(e)}
 const ru=new THREE.Mesh(new THREE.TorusGeometry(.18,.025,6,6),E);ru.position.set(0,1.45,.55);g.add(ru);
 for(let i=0;i<5;i++)P(g,SPH,0x4f8a3a,Math.cos(i*1.3)*.3,2.55+(i%2)*.04,Math.sin(i*1.3)*.25,.16,.06,.14);/* мох на голові */
 g.userData.idle=t=>{ru.rotation.z=t*.6;E.emissiveIntensity=1.6+Math.sin(t*2)*.5;hd.rotation.y=Math.sin(t*.4)*.12};
 return g}
/* ---------- реквізит біля NPC ---------- */
const put=(m,x,z,ry)=>{m.position.set(x,H_(x,z),z);m.rotation.y=ry||0;m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});sc_.add(m);return m};
/* старий верстак і ковадло Шкварки */
{const g=new THREE.Group(),W=0x8e5a3a;P(g,BOX,W,0,.8,0,1.5,.12,.7);for(const x of[-.65,.65])for(const z of[-.28,.28])P(g,BOX,0x6b4228,x,.4,z,.1,.8,.1);
 P(g,BOX,0xb0b0b0,-.4,.9,.1,.25,.08,.12,{metalness:.5});P(g,CYL,0x7a5230,.3,.9,-.1,.03,.4,.03).rotation.z=1.5;P(g,BOX,0x6b4228,.45,.4,0,.9,.06,.5);
 put(g,I.SP[1][0]+1.6,I.SP[1][1]-.6,-.4);const a=new THREE.Group();P(a,CYL,0x5a3a22,0,.25,0,.22,.5,.22);P(a,BOX,0x55585e,0,.58,0,.5,.16,.22,{metalness:.6,roughness:.4});put(a,I.SP[1][0]-1.2,I.SP[1][1]-1.1,.3)}
/* загорода з клубками на луці Клубочок */
{const g=new THREE.Group();for(let i=0;i<14;i++){const a=i/14*Math.PI*2;if(i==3)continue;P(g,CYL,0x8e5a3a,Math.cos(a)*2.6,.35,Math.sin(a)*2.6,.05,.7,.05);
  const b=(i+1)/14*Math.PI*2;if(i!=2){const r=P(g,BOX,0x9a6a40,Math.cos((a+b)/2)*2.55,.5,Math.sin((a+b)/2)*2.55,.08,.06,1.18);r.rotation.y=-(a+b)/2}}
 for(const[c,x,z]of[[0xff6a8a,.6,.4],[0x6ad0ff,-.7,.9],[0xffd24a,.2,-.9]])P(g,SPH,c,x,.12,z,.12);put(g,I.SP[3][0]-1,I.SP[3][1]+.5)}
/* ---------- розстановка ---------- */
/* реалістичні моделі на основі героя (npc-hero.js + isle-npc-looks.js); якщо їх немає — прості моделі вище */
const LK=(k,fb)=>window.NPCHERO&&window.ISLE_LOOKS&&window.ISLE_LOOKS[k]?window.NPCHERO.make(window.ISLE_LOOKS[k]):fb();
const fire=[I.SP[0][0]+1.5,I.SP[0][1]-1];
N.add({id:'vit',name:'Дід Вітрило',role:'старий моряк',x:fire[0]-2.4,z:fire[1]+1.2,face:2.2,model:LK('vit',vitrylo),height:2.05,color:'#2d4f7a',icon:'🧓',
 lines:['Ого, прокинувся! А я вже думав, море принесло мені ще одну колоду.','Мене звуть Вітрило. Колись мене теж викинуло на цей берег… років сорок тому. Чи п’ятдесят.','Ходи-но сюди, поговоримо, як звідси вибратися. Хоча я ось так і не вибрався, хе-хе.']});
N.add({id:'shk',name:'Тесля Шкварка',role:'майстриня',x:I.SP[1][0]+.2,z:I.SP[1][1]+.8,face:2.6,model:LK('shk',shkvarka),height:1.95,color:'#a8542a',icon:'🔨',
 lines:['О! Нові руки! Руки — це добре. Руками можна тримати молот.','Я Шкварка. Все, що на цьому острові стоїть, — я збудувала. Все, що впало, — теж я.','Принеси мені деревини — покажу, як із неї зробити щось корисне. Або вибухове. Жартую. Мабуть.']});
N.add({id:'klu',name:'Пані Клубочок',role:'доглядачка попалів',x:I.SP[3][0]+2.4,z:I.SP[3][1]-1.6,face:-.6,model:LK('klu',klubochok),height:1.95,color:'#6a3f7a',icon:'🐾',
 lines:['Тсс! Не налякай Пушинку. Вона сьогодні вже двічі ховалася в мій кошик.','Я — пані Клубочок. Попали — як клубки пряжі: якщо до них з любов’ю, вони не заплутуються.','Коли будеш готовий, навчу тебе, як подружитися з першим попалом.']});
N.add({id:'brm',name:'Брам',role:'кам’яний страж',x:-2.6,z:I.G0+5.6,face:.25,model:bram(),color:'#4a5560',icon:'🗿',r:.9,height:2.8,
 lines:['…ГРРР-РУМ. Хто йде?','Я — Брам. Мене звуть Брам. Мене завжди звали Брам. Триста років — Брам.','Завал не прибрати, доки ти не готовий до великого світу. Іди до Вітрила. Він… балакучий.']});
/* Пушинка — Пухоклуб пані Клубочок */
try{if(window.PALMODEL){const r=PALMODEL.build(4),m=r.root;m.scale.multiplyScalar(.8);put(m,I.SP[3][0]-1.4,I.SP[3][1]+.9,.6);
 let t=0;const A=G('ANI');if(A)A.push(()=>{t+=.016;m.position.y=H_(m.position.x,m.position.z)+Math.abs(Math.sin(t*3))*.12;if(r.mixer)r.mixer.update(.016)})}}catch(e){console.warn('isle-npc pal',e)}
/* поки що — розмови-знайомства: «!» над Вітрилом, компас показує на нього */
N.mark('vit','!');N.hint(N.get('vit').x,N.get('vit').z,'Вітрило');
const seen=new Set();N.onTalk=id=>{const n=N.get(id);N.say(id,n.lines);seen.add(id);if(id=='vit'){N.mark('vit',null);N.mark('shk','!');N.mark('klu','!');N.hint(n.x+12,n.z-14,'Майстерня')}else N.mark(id,null);return true};
}catch(e){console.warn('isle-npc:',e)}})();
