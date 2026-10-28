(function(){try{
if(HC.length<8)HC.push(0x7a1f3a,0x6b3f1e);if(SK.length<6)SK.push(0xf6d9c0,0x5a3a26);if(TC.length<7)TC.push(0x2f78d0);
const BRW=[0x3a2a1e,0x6b3f1e,0xc89a5a,0x7a1f3a,0x1a1a1a],EYC=[0x5a3a1e,0x2f6ad6,0x3a9a4a,0x8a5ad6,0x7a5a2a,0x1a1a1a];window.BRW=BRW;window.EYC=EYC;
const iLeo=HC.indexOf(0x6b3f1e),iMila=HC.indexOf(0x7a1f3a),iBlue=TC.indexOf(0x2f78d0);
const PRE=g=>g?{hr:6,top:4,hc:iMila,tc:2,br:3,ey:0}:{hr:5,top:3,hc:iLeo,tc:iBlue,br:1,ey:0};
Object.assign(DLOOK,{g:0,sk:0},PRE(0));
const HRN=['Коротка','Довга','Хвостик','Їжак','Шолом','Кучерява','Хвіст з намистинами'],TPN=['Туніка','Куртка','Броня','Худі мандрівника','Жилет слідопита'];
buildHero=function(g,lk){while(g.children.length)g.remove(g.children[0]);
const f=lk.g==1,sk=SK[lk.sk]||SK[0],hc=HC[lk.hc]||HC[0],tc=TC[lk.tc]||TC[0],bw=BRW[lk.br||0],ey=EYC[lk.ey||0],top=lk.top||0,hr=lk.hr||0;
const dk=c=>((c>>16&255)*.7|0)<<16|((c>>8&255)*.7|0)<<8|((c&255)*.7|0),LEA=0x7a4a26,LEA2=0x5a3418,GOLD=0xd9b45a;
const pc=top==3?0x3a3f4a:top==4?0x2a3a6a:0x3b4290;
for(const s of[-1,1]){add(g,Cy(.085,.08,.42,10),pc,s*.11,.36,0);
 if(top==4){add(g,Cy(.09,.095,.32,10),LEA,s*.11,.17,0);add(g,Cy(.105,.105,.07,10),LEA2,s*.11,.33,0);add(g,B(.13,.07,.12),LEA,s*.11,.035,.05)}
 else if(top==3){add(g,B(.13,.1,.22),0xc8642a,s*.11,.07,.03);add(g,B(.14,.03,.23),0xf2ede4,s*.11,.015,.03);add(g,B(.07,.1,.08),0x4a505c,s*.17,.42,.02)}
 else add(g,B(.13,.09,.2),0x5a3a26,s*.11,.05,.03)}
if(top==3){add(g,B(.06,.06,.02),0xd9532e,-.11,.3,.09);add(g,B(.05,.05,.02),0x3a8ee6,.12,.42,.09)}
const wT=f?.21:.23,wB=f?.25:.26;
if(top==3){add(g,Cy(wT,wB,.52,14),tc,0,.86,0);add(g,new THREE.TorusGeometry(.19,.065,8,18),0xe8903a,0,1.12,-.01).rotation.x=Math.PI/2;add(g,Co(.13,.16,4),0xb88a3a,0,1.06,.16).rotation.x=Math.PI;add(g,B(.26,.13,.03),dk(tc),0,.76,.25);for(const s of[-1,1])add(g,Cy(.008,.008,.16,4),0xffffff,s*.05,.98,.24)}
else if(top==4){add(g,Cy(wT,wB,.5,14),tc,0,.86,0);add(g,Cy(wB+.01,wB+.07,.2,14),tc,0,.52,0);for(const s of[-1,1]){add(g,B(.16,.44,.05),LEA,s*.11,.86,.215).rotation.y=s*.25;add(g,B(.06,.08,.05),LEA2,s*.1,.72,.25)}add(g,B(.4,.44,.05),LEA,0,.86,-.22);add(g,B(.05,.62,.03),LEA2,0,.86,.255).rotation.z=.6;add(g,B(.05,.04,.02),GOLD,-.04,.92,.27)}
else if(top==0)add(g,Cy(f?.19:.24,f?.36:.3,.6,14),tc,0,.82,0);
else if(top==1){add(g,Cy(wT,.27,.52,14),tc,0,.86,0);add(g,B(.05,.46,.04),0xf4d3b3,0,.88,.24)}
else{add(g,Cy(.26,.3,.52,8),0x9aa3b8,0,.86,0);add(g,B(.22,.24,.05),tc,0,.9,.27)}
add(g,Cy(wB+.01,wB+.01,.07,14),LEA2,0,.62,0);add(g,B(.07,.06,.03),GOLD,0,.62,wB+.01);for(const s of[-1,1])add(g,B(.09,.1,.07),LEA,s*.17,.58,.18);
if(top==3)add(g,Cy(.05,.05,.02,12),GOLD,-.2,.55,.21).rotation.x=Math.PI/2;
const sl=top==2?0x9aa3b8:tc;
for(const s of[-1,1]){add(g,S(.085),sl,s*(wT+.06),1.06,0);add(g,Cy(.065,.058,.44,8),sl,s*(wT+.08),.85,0).rotation.z=s*.12;
 if(top==3)add(g,Cy(.068,.068,.05,8),0xe8903a,s*(wT+.075),.93,0).rotation.z=s*.12;
 add(g,S(.075),top==4?LEA:sk,s*(wT+.11),.6,.01);if(top==3&&s>0)add(g,Cy(.07,.07,.04,8),0x3a8ee6,wT+.105,.67,0)}
const H0=1.42;add(g,Cy(.07,.08,.1,8),sk,0,1.13,0);add(g,S(.33),sk,0,H0,0);for(const s of[-1,1])add(g,S(.06),sk,s*.32,H0,0);add(g,S(.035),dk(sk),0,H0-.04,.32);
for(const s of[-1,1]){add(g,S(.075),0xffffff,s*.12,H0+.01,.27).scale.set(1,1.1,.55);add(g,S(.05),ey,s*.12,H0,.305);add(g,S(.025),0x111111,s*.12,H0,.33);add(g,S(.012),0xffffff,s*.105,H0+.02,.34);add(g,B(.12,.028,.03),bw,s*.12,H0+.12,.3).rotation.z=-s*.15;
 if(f){add(g,B(.09,.015,.02),0x111111,s*.13,H0+.075,.315).rotation.z=-s*.2;add(g,S(.035),0xe88a8a,s*.19,H0-.07,.27)}}
add(g,new THREE.TorusGeometry(.05,.012,6,10,Math.PI),0x7a3a2a,0,H0-.13,.3).rotation.z=Math.PI;
if(hr==4){add(g,S(.35),0x8089c8,0,H0+.08,-.02).scale.y=.7;add(g,Co(.07,.32,6),0xd93b3b,0,H0+.42,0)}
else if(hr==5){for(const e of[.5,.85,1.2])for(let a=-Math.PI;a<Math.PI;a+=e>1?.9:.6){if(Math.abs(a)<1.1&&e<.9)continue;add(g,S(.13),hc,Math.cos(e)*Math.sin(a)*.34,H0+Math.sin(e)*.34,Math.cos(e)*Math.cos(a)*.34)}add(g,S(.14),hc,0,H0+.34,0);for(const x of[-.12,0,.12])add(g,S(.09),hc,x,H0+.27,.2)}
else{add(g,S(.345),hc,0,H0+.14,-.06).scale.set(1,.75,1.02);
 if(hr==1)add(g,B(.56,.6,.16),hc,0,H0-.2,-.2);
 if(hr==2){add(g,S(.12),hc,0,H0+.12,-.34);add(g,Cy(.07,.03,.4,6),hc,0,H0-.12,-.38)}
 if(hr==3)for(let i=0;i<7;i++){const a=i/7*Math.PI*2;add(g,Co(.07,.26,5),hc,Math.cos(a)*.17,H0+.34,Math.sin(a)*.17-.03)}
 if(hr==6){add(g,S(.14),hc,0,H0+.33,-.18);const BD=[0x3ad0ff,0xffd34e,0xff7aa8,0x5fdc7a];for(let i=0;i<4;i++){add(g,Cy(.045,.03,.34,6),hc,(i-1.5)*.08,H0+.12,-.34).rotation.x=.35;add(g,S(.035),BD[i],(i-1.5)*.08,H0-.03,-.4)}for(const s of[-1,1]){add(g,Cy(.04,.025,.3,6),hc,s*.27,H0-.05,.12);add(g,S(.03),BD[s>0?0:2],s*.27,H0-.18,.12)}}}
let PZ=-.32;{const bg=(eq.bag&&inv[eq.bag]>0)?eq.bag:'',D={bp1:[.28,.3,.13],bp2:[.36,.42,.18],bp3:[.38,.46,.2]}[bg];if(D){const[w,h,d]=D,z=-(wB+d/2-.03),y=.92,c1=bg=='bp1'?0x9a6a3a:LEA,c2=bg=='bp1'?0x7a4a26:LEA2;PZ=z-d/2-.05;add(g,B(w,h,d),c1,0,y,z);add(g,B(w+.01,h*.32,d+.02),c2,0,y+h*.36,z);add(g,B(.06,.07,.02),GOLD,0,y+h*.2,z-d/2-.01);for(const s of[-1,1]){add(g,B(.045,.46,.03),c2,s*.12,.9,wT+.02);add(g,B(.045,.03,.32),c2,s*.12,1.13,-.03)}if(bg!='bp1')for(const s of[-1,1])add(g,B(.06,h*.45,d*.7),c2,s*(w/2+.03),y-.05,z);if(bg=='bp3'){add(g,Cy(.09,.09,w+.08,10),0x6a6f7a,0,y+h/2+.09,z).rotation.z=Math.PI/2;add(g,S(.07),0x5fdc7a,w/2+.08,y-.12,z+.02)}}}
{const tid=eq.tool||'',tcl=({axw:0xa8713f,axe:0x8a8f9e,axm:0xdfe8f2,pkw:0xa8713f,pick:0x8a8f9e,pkm:0xdfe8f2})[tid]||0x9aa3b8,hx=wT+.13;
 if(/^ax/.test(tid)){add(g,Cy(.025,.03,.6,6),0x8e5a3a,hx,.62,.14).rotation.x=.5;add(g,B(.2,.13,.03),tcl,hx,.86,.29).rotation.x=.5}
 if(/^p(k|ick)/.test(tid)){add(g,Cy(.025,.03,.6,6),0x8e5a3a,-.2,1,PZ).rotation.z=.6;add(g,B(.4,.05,.05),tcl,-.33,1.23,PZ).rotation.z=.6}}
outl(g)};
ccShow=function(){menuO=1;ccO=1;dlgX();$('mm').style.display='none';const first=!look;if(!look)look=Object.assign({},DLOOK);if(look.br==null)look.br=0;if(look.ey==null)look.ey=0;
const p=$('ccp');p.innerHTML=`<h2>${first?'Створення героя':'Зовнішність героя'}</h2><div class='ccr'><span>Імʼя</span><input id='ccn' maxlength='16'></div>`+ccRow('Стать','g',['Чоловіча','Жіноча'])+ccRow('Зачіска','hr',HRN)+ccRow('Колір волосся','hc',HC,1)+ccRow('Брови','br',BRW,1)+ccRow('Очі','ey',EYC,1)+ccRow('Одяг','top',TPN)+ccRow('Колір одягу','tc',TC,1)+ccRow('Тіло (шкіра)','sk',SK,1)+`<div id='cca'></div><button id='ccgo'>${first?'▶ Почати пригоду':'✔ Зберегти й грати'}</button>`;
$('ccn').value=pname;$('ccv').appendChild(R2.domElement);buildHero(hp2,look);ccSel();ccAcc();$('cc').style.display='grid';
$('ccgo').onclick=()=>{pname=$('ccn').value.trim()||'Меглен';$('nm').textContent=pname;buildHero(pl,look);drawAv();$('cc').style.display='none';ccO=0;save();mmHide()}};
if($('mh'))$('mh').onclick=()=>ccShow();
$('ccp').addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(!b||!b.parentNode||b.parentNode.dataset.k!='g')return;Object.assign(look,PRE(look.g));ccSel();buildHero(hp2,look)});
const _da=drawAv;drawAv=function(){_da();try{const lk=look||DLOOK,c=$('avc').getContext('2d'),h=v=>'#'+v.toString(16).padStart(6,'0');c.fillStyle=h(HC[lk.hc]||HC[0]);if(lk.hr==5)for(let i=0;i<7;i++){c.beginPath();c.arc(16+i*5.3,20+Math.abs(i-3)*2.2,6,0,7);c.fill()}if(lk.hr==6){c.beginPath();c.arc(32,12,7,0,7);c.fill()}c.fillStyle=h(EYC[lk.ey||0]);c.beginPath();c.arc(26,41,1.6,0,7);c.fill();c.beginPath();c.arc(38,41,1.6,0,7);c.fill();c.fillStyle=h(BRW[lk.br||0]);c.fillRect(22,35,8,2);c.fillRect(34,35,8,2)}catch(_){}};
if(look&&!look.v2){Object.assign(look,PRE(look.g),{v2:1});setTimeout(()=>{try{save()}catch(_){}},500)}
buildHero(pl,look||DLOOK);buildHero(hp2,look||DLOOK);drawAv();if(ccO)ccShow();
}catch(e){console.warn('hero2',e)}})();
