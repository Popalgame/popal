(function(){try{
if(HC.length<8)HC.push(0x7a1f3a,0x6b3f1e);if(SK.length<6)SK.push(0xf6d9c0,0x5a3a26);if(TC.length<7)TC.push(0x2f78d0);
const BRW=[0x3a2a1e,0x6b3f1e,0xc89a5a,0x7a1f3a,0x1a1a1a],EYC=[0x5a3a1e,0x2f6ad6,0x3a9a4a,0x8a5ad6,0x7a5a2a,0x1a1a1a];window.BRW=BRW;window.EYC=EYC;
const iLeo=HC.indexOf(0x6b3f1e),iMila=HC.indexOf(0x7a1f3a),iBlue=TC.indexOf(0x2f78d0);
const PRE=g=>g?{hr:6,top:4,hc:iMila,tc:2,br:3,ey:0}:{hr:5,top:3,hc:iLeo,tc:iBlue,br:1,ey:0};
Object.assign(DLOOK,{g:0,sk:0,model:0},PRE(0));
const HRN=['Коротка','Довга','Хвостик','Їжак','Шолом','Кучерява','Хвіст з намистинами'],TPN=['Туніка','Куртка','Броня','Худі мандрівника','Жилет слідопита'];
buildHero=function(g,lk){
// Only geometries allocated by this builder are released; world materials stay cached.
if(g.userData.heroGeometries)for(const geo of g.userData.heroGeometries)geo.dispose();
g.userData.heroGeometries=new Set();
while(g.children.length)g.remove(g.children[0]);
let partTag='body';const A=(geo,c,x,y,z,ry)=>{const m=add(g,geo,c,x,y,z,ry);m.userData.heroPart=partTag;m.userData.heroGeometry=true;g.userData.heroGeometries.add(geo);
 if(partTag==='body')m.position.y=y>=.58?.66+(y-.58)*1.13:y+.08;
 else if(partTag==='head'){m.position.set(x*.78,1.53+(y-1.42)*.78,z*.78);m.scale.multiplyScalar(.78)}
 return m};
const f=lk.g==1,sk=SK[lk.sk]||SK[0],hc=HC[lk.hc]||HC[0],tc=TC[lk.tc]||TC[0],bw=BRW[lk.br||0],ey=EYC[lk.ey||0],top=lk.top||0,hr=lk.hr||0;
const dk=c=>((c>>16&255)*.7|0)<<16|((c>>8&255)*.7|0)<<8|((c&255)*.7|0),LEA=0x7a4a26,LEA2=0x5a3418,GOLD=0xd9b45a;
const pc=top==3?0x3a3f4a:top==4?0x2a3a6a:0x3b4290;
for(const s of[-1,1]){
 partTag=s<0?'legUpperL':'legUpperR';
 A(Cy(.091,.084,.31,10),pc,s*.115,.535,0);
 A(Cy(.099,.095,.05,10),dk(pc),s*.115,.39,0);
 partTag=s<0?'legLowerL':'legLowerR';
 A(Cy(.076,.069,.29,10),pc,s*.115,.235,.012);
 if(top==4){A(Cy(.092,.095,.23,10),LEA,s*.115,.19,.015);A(Cy(.105,.103,.055,10),LEA2,s*.115,.31,.02)}
 else if(top==3){A(B(.125,.15,.18),0xc8642a,s*.115,.15,.035);A(B(.13,.025,.21),0xf2ede4,s*.115,.075,.04)}
 A(S(.12),LEA2,s*.115,.085,.07).scale.set(.81,.76,1.04);
 A(S(.13),top==3?0x4a505c:LEA,s*.115,.045,.11).scale.set(.82,.38,1.12);
 A(B(.12,.025,.15),GOLD,s*.115,.13,.11);
 A(B(.018,.2,.018),dk(pc),s*.115,.24,.09)
}
partTag='body';if(top==3){A(B(.06,.06,.02),0xd9532e,-.11,.3,.09);A(B(.05,.05,.02),0x3a8ee6,.12,.42,.09)}
const wT=f?.21:.23,wB=f?.25:.26;
if(top==3){A(Cy(wT,wB,.52,14),tc,0,.86,0);A(new THREE.TorusGeometry(.19,.065,8,18),0xe8903a,0,1.12,-.01).rotation.x=Math.PI/2;A(Co(.13,.16,4),0xb88a3a,0,1.06,.16).rotation.x=Math.PI;A(B(.26,.13,.03),dk(tc),0,.76,.25);for(const s of[-1,1])A(Cy(.008,.008,.16,4),0xffffff,s*.05,.98,.24)}
else if(top==4){A(Cy(wT,wB,.5,14),tc,0,.86,0);A(Cy(wB+.01,wB+.07,.2,14),tc,0,.52,0);for(const s of[-1,1]){A(B(.16,.44,.05),LEA,s*.11,.86,.215).rotation.y=s*.25;A(B(.06,.08,.05),LEA2,s*.1,.72,.25)}A(B(.4,.44,.05),LEA,0,.86,-.22);A(B(.05,.62,.03),LEA2,0,.86,.255).rotation.z=.6;A(B(.05,.04,.02),GOLD,-.04,.92,.27)}
else if(top==0)A(Cy(f?.19:.24,f?.36:.3,.6,14),tc,0,.82,0);
else if(top==1){A(Cy(wT,.27,.52,14),tc,0,.86,0);A(B(.05,.46,.04),0xf4d3b3,0,.88,.24)}
else{A(Cy(.26,.3,.52,8),0x9aa3b8,0,.86,0);A(B(.22,.24,.05),tc,0,.9,.27)}
A(Cy(wB+.01,wB+.01,.07,14),LEA2,0,.62,0);A(B(.07,.06,.03),GOLD,0,.62,wB+.01);for(const s of[-1,1]){A(B(.09,.1,.07),LEA,s*.17,.58,.18);A(B(.11,.17,.025),dk(tc),s*.13,1.08,.195).rotation.z=s*.16;A(B(.025,.29,.017),GOLD,s*.13,.91,.235).rotation.z=s*.14}
if(top==3)A(Cy(.05,.05,.02,12),GOLD,-.2,.55,.21).rotation.x=Math.PI/2;
const sl=top==2?0x9aa3b8:tc;
for(const s of[-1,1]){
 partTag=s<0?'armUpperL':'armUpperR';
 A(S(.085),sl,s*(wT+.06),1.22,0);
 A(Cy(.072,.061,.29,10),sl,s*(wT+.075),1.075,0).rotation.z=s*.12;
 if(top==3)A(Cy(.073,.073,.055,10),0xe8903a,s*(wT+.07),1.1,0);
 partTag=s<0?'armLowerL':'armLowerR';
 A(S(.065),sl,s*(wT+.08),.94,0);
 A(Cy(.063,.054,.26,10),sl,s*(wT+.095),.815,.008).rotation.z=s*.08;
 A(Cy(.074,.07,.075,10),LEA2,s*(wT+.105),.72,.012);
 A(S(.071),top==4?LEA:sk,s*(wT+.11),.69,.015);
 A(B(.035,.055,.02),GOLD,s*(wT+.11),.72,.08);
 if(top==3&&s>0)A(Cy(.07,.07,.04,8),0x3a8ee6,wT+.105,.74,0)
}
partTag='body';for(const side of[-1,1]){
 A(B(.045,.29,.035),LEA2,side*.15,.91,.22).rotation.z=side*.23;
 A(B(.075,.045,.035),GOLD,side*.2,1.045,.235)}
 partTag='head';const H0=1.42;A(Cy(.07,.08,.1,8),sk,0,1.13,0);A(S(.29),sk,0,H0,0).scale.set(.79,.99,.80);A(S(.16),sk,0,H0-.19,.055).scale.set(1.13,.55,.74);for(const s of[-1,1]){A(S(.057),sk,s*.29,H0-.015,0).scale.set(.7,1.1,.65);A(S(.075),sk,s*.16,H0-.065,.18).scale.set(1.1,.58,.54)}A(S(.038),dk(sk),0,H0-.04,.32).scale.set(.68,1.25,.75);
for(const s of[-1,1]){A(S(.055),0xffffff,s*.105,H0+.015,.27).scale.set(.86,.72,.35);A(S(.031),ey,s*.105,H0+.01,.297);A(S(.016),0x111111,s*.105,H0+.01,.317);
 A(S(.009),0xffffff,s*.098,H0+.026,.327);A(B(.105,.018,.022),bw,s*.105,H0+.105,.277).rotation.z=-s*.15;
 if(f){A(B(.09,.015,.02),0x111111,s*.13,H0+.075,.315).rotation.z=-s*.2;A(S(.035),0xe88a8a,s*.19,H0-.07,.27)}}
A(new THREE.TorusGeometry(.052,.009,6,10,Math.PI),0x7a3a2a,0,H0-.14,.3).rotation.z=Math.PI;
if(hr==4){A(S(.35),0x8089c8,0,H0+.08,-.02).scale.y=.574;A(Co(.07,.32,6),0xd93b3b,0,H0+.42,0)}
else if(hr==5){A(S(.32),hc,0,H0+.13,-.055).scale.set(.72,.52,.78);for(let i=0;i<9;i++){const a=i/9*Math.PI*2,x=Math.sin(a)*.205,z=Math.cos(a)*.19-.035;const strand=A(S(.12),hc,x,H0+.29+(i%3)*.018,z);strand.scale.set(.58,.39,1.05);strand.rotation.z=-.22+Math.sin(a)*.36}for(const x of[-.14,.015,.13]){const strand=A(S(.10),hc,x,H0+.27,.14);strand.scale.set(.68,.42,1.05);strand.rotation.z=-.35}}
else{A(S(.32),hc,0,H0+.14,-.06).scale.set(.75,.54,.8);for(const x of[-.14,0,.14]){const strand=A(S(.11),hc,x,H0+.27,.12);strand.scale.set(.67,.35,1.02);strand.rotation.z=-.28}
 if(hr==1)A(B(.56,.6,.16),hc,0,H0-.2,-.2);
 if(hr==2){A(S(.12),hc,0,H0+.12,-.34);A(Cy(.07,.03,.4,6),hc,0,H0-.12,-.38)}
 if(hr==3)for(let i=0;i<7;i++){const a=i/7*Math.PI*2;A(Co(.07,.26,5),hc,Math.cos(a)*.17,H0+.34,Math.sin(a)*.17-.03)}
 if(hr==6){A(S(.14),hc,0,H0+.33,-.18);const BD=[0x3ad0ff,0xffd34e,0xff7aa8,0x5fdc7a];for(let i=0;i<4;i++){A(Cy(.045,.03,.34,6),hc,(i-1.5)*.08,H0+.12,-.34).rotation.x=.35;A(S(.035),BD[i],(i-1.5)*.08,H0-.03,-.4)}for(const s of[-1,1]){A(Cy(.04,.025,.3,6),hc,s*.27,H0-.05,.12);A(S(.03),BD[s>0?0:2],s*.27,H0-.18,.12)}}}
partTag='body';let PZ=-.32;{const bg=(eq.bag&&inv[eq.bag]>0)?eq.bag:'',D={bp1:[.28,.3,.13],bp2:[.36,.42,.18],bp3:[.38,.46,.2]}[bg];if(D){const[w,h,d]=D,z=-(wB+d/2-.03),y=.92,c1=bg=='bp1'?0x9a6a3a:LEA,c2=bg=='bp1'?0x7a4a26:LEA2;PZ=z-d/2-.05;A(B(w,h,d),c1,0,y,z);A(B(w+.01,h*.32,d+.02),c2,0,y+h*.36,z);A(B(.06,.07,.02),GOLD,0,y+h*.2,z-d/2-.01);for(const s of[-1,1]){A(B(.045,.46,.03),c2,s*.12,.9,wT+.02);A(B(.045,.03,.32),c2,s*.12,1.13,-.03)}if(bg!='bp1')for(const s of[-1,1])A(B(.06,h*.45,d*.7),c2,s*(w/2+.03),y-.05,z);if(bg=='bp3'){A(Cy(.09,.09,w+.08,10),0x6a6f7a,0,y+h/2+.09,z).rotation.z=Math.PI/2;A(S(.07),0x5fdc7a,w/2+.08,y-.12,z+.02)}}}
{const tid=eq.tool||'',tcl=({axw:0xa8713f,axe:0x8a8f9e,axm:0xdfe8f2,pkw:0xa8713f,pick:0x8a8f9e,pkm:0xdfe8f2})[tid]||0x9aa3b8,hx=wT+.13;
 if(/^ax/.test(tid)){partTag='armLowerR';A(Cy(.025,.03,.6,6),0x8e5a3a,hx,.62,.14).rotation.x=.5;A(B(.2,.13,.03),tcl,hx,.86,.29).rotation.x=.5}
 if(/^p(k|ick)/.test(tid)){partTag='body';A(Cy(.025,.03,.6,6),0x8e5a3a,-.2,1,PZ).rotation.z=.6;A(B(.4,.05,.05),tcl,-.33,1.23,PZ).rotation.z=.6}}
outl(g)};
ccShow=function(){menuO=1;ccO=1;dlgX();$('mm').style.display='none';const first=!look;if(!look)look=Object.assign({},DLOOK);if(look.br==null)look.br=0;if(look.ey==null)look.ey=0;
const p=$('ccp');p.innerHTML=`<h2>${first?'Створення героя':'Зовнішność героя'}</h2><div class='ccr'><span>Імʼя героя</span><input id='ccn' maxlength='16'></div>`+ccRow('Модель 3D','model',['Класичний','Айко'])+ccRow('Стать','g',['Чоловіча','Жіноча'])+ccRow('Зачіска','hr',HRN)+ccRow('Колір волосся','hc',HC,1)+ccRow('Брови','br',BRW,1)+ccRow('Очі','ey',EYC,1)+ccRow('Одяг','top',TPN)+ccRow('Колір одягу','tc',TC,1)+ccRow('Тіло (шкіра)','sk',SK,1)+`<div id='cca'></div><button id='ccgo'>${first?'▶ Почати пригоду':'✔ Зберегти й грати'}</button>`;
$('ccn').value=pname;$('ccv').appendChild(R2.domElement);buildHero(hp2,look);ccSel();ccAcc();$('cc').style.display='grid';
$('ccgo').onclick=()=>{pname=$('ccn').value.trim()||'Гість';$('nm').textContent=pname;buildHero(pl,look);drawAv();$('cc').style.display='none';ccO=0;save();mmHide()}};
if($('mh'))$('mh').onclick=()=>ccShow();
$('ccp').addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(!b||!b.parentNode)return;const k=b.parentNode.dataset.k;
 if(k=='g'){Object.assign(look,PRE(look.g));ccSel();buildHero(hp2,look);return}
 if(k=='model'){look.model=+b.dataset.v;ccSel();const ids=window.importedHero&&window.importedHero.models,id=ids&&ids[look.model]||'classic';
  if(window.importedHero&&window.importedHero.setModel)window.importedHero.setModel(id).then(ok=>{if(ok){buildHero(hp2,look);drawAv()}});return}});
const _da=drawAv;drawAv=function(){_da();try{const lk=look||DLOOK,c=$('avc').getContext('2d'),h=v=>'#'+v.toString(16).padStart(6,'0');c.fillStyle=h(HC[lk.hc]||HC[0]);if(lk.hr==5)for(let i=0;i<7;i++){c.beginPath();c.arc(16+i*5.3,20+Math.abs(i-3)*2.2,6,0,7);c.fill()}if(lk.hr==6){c.beginPath();c.arc(32,12,7,0,7);c.fill()}c.fillStyle=h(EYC[lk.ey||0]);c.beginPath();c.arc(26,41,1.6,0,7);c.fill();c.beginPath();c.arc(38,41,1.6,0,7);c.fill();c.fillStyle=h(BRW[lk.br||0]);c.fillRect(22,35,8,2);c.fillRect(34,35,8,2)}catch(_){}};
/* v2 migration backfills PRE() defaults; keep a chosen 3D model across the upgrade */
if(look&&!look.v2){const m=look.model;Object.assign(look,PRE(look.g),{v2:1});if(m)look.model=m;setTimeout(()=>{try{save()}catch(_){}},500)}
buildHero(pl,look||DLOOK);buildHero(hp2,look||DLOOK);drawAv();if(ccO)ccShow();
}catch(e){console.warn('hero2',e)}})();
