/* Вигляд людей-NPC Острова пробудження (на основі моделі героя, див. npc-hero.js). Координати аксесуарів — у позі привʼязки моделі:
   ступні на y=0, обличчя дивиться на +z, руки розведені вбік (права кисть ≈ (-0.47, 1.15, 0), ліва ≈ (0.47, 1.15, 0)), голова ≈ y 1.27…1.8. */
(function(){
const T=window.THREE;if(!T)return;
const S=new T.SphereGeometry(1,20,14),C=new T.CylinderGeometry(1,1,1,20),B=new T.BoxGeometry(1,1,1),TO=new T.TorusGeometry(1,.14,10,28),CO=new T.ConeGeometry(1,1,24,1,true);
const mesh=(g,m,sx,sy,sz)=>{const o=new T.Mesh(g,m);o.scale.set(sx,sy==null?sx:sy,sz==null?sx:sz);return o};
const grp=(...a)=>{const g=new T.Group();a.forEach(([o,x,y,z,rx,ry,rz])=>{o.position.set(x,y,z);o.rotation.set(rx||0,ry||0,rz||0);g.add(o)});return g};
window.ISLE_LOOKS={
 /* 🧓 Дід Вітрило: синій бушлат, сиве волосся, борода й вуса, капітанський кашкет, палиця */
 vit:{jacket:'#2c4470',pants:'#3a3e4c',hair:'#eeeeea',scale:[1.03,1,1.05],acc(add,M){
  const W=M(0xf1f1ec,{roughness:.95});
  add('Head',grp([mesh(S,W,.13,.09,.08),0,0,0],[mesh(S,W,.09,.08,.06),0,-.07,.0],[mesh(S,W,.05,.07,.05),-.11,.04,-.03],[mesh(S,W,.05,.07,.05),.11,.04,-.03]),[0,1.225,.16]);
  add('Head',grp([mesh(S,W,.045,.02,.025),-.035,0,0,0,0,-.35],[mesh(S,W,.045,.02,.025),.035,0,0,0,0,.35]),[0,1.335,.245]);
  const hat=grp([mesh(C,M(0x1c2a48),.33,.15,.33),0,0,0],[mesh(C,W,.335,.04,.335),0,-.05,0],[mesh(C,M(0x111a30),.38,.018,.38),0,-.075,.06],[mesh(S,M(0xd9b24a,{metalness:.6,roughness:.3}),.04,.04,.015),0,.0,.33]);
  add('Head',hat,[0,1.71,-.01]);
  add('RightHand',grp([mesh(C,M(0x7a5230),.024,.95,.024),0,0,0,0,0,Math.PI/2],[mesh(S,M(0x6a4526),.045),.47,0,0]),[-.47-.5,1.15,0]);
 }},
 /* 🔨 Тесля Шкварка: зелена куртка, руде волосся з гулькою, гоглі на лобі, шкіряний фартух, молот у руці */
 shk:{jacket:'#4c7a34',pants:'#5a3c26',hair:'#d9541f',acc(add,M){
  const HR=M(0xc8461a,{roughness:.8});add('Head',mesh(S,HR,.12,.11,.11),[0,1.76,-.12]);
  const G=M(0x2e2e2e),L=M(0x9fe6ff,{metalness:.5,roughness:.15});
  add('Head',grp([mesh(TO,G,.06),-.085,0,0],[mesh(TO,G,.06),.085,0,0],[mesh(S,L,.055,.055,.02),-.085,0,0],[mesh(S,L,.055,.055,.02),.085,0,0],[mesh(C,G,.27,.025,.25),0,0,-.2]),[0,1.6,.23]);
  {const AP=M(0x6e4226,{roughness:.85,side:T.DoubleSide});const ap=new T.Mesh(new T.CylinderGeometry(.245,.29,.46,18,1,true,-.9,1.8),AP);const pk=mesh(B,M(0x4e2c16),.09,.07,.02);
  add('Spine1',grp([ap,0,0,0],[pk,.07,-.07,.275]),[0,.86,-.0]);}
  add('RightHand',grp([mesh(C,M(0x7a5230),.028,.6,.028),0,0,0,0,0,Math.PI/2],[mesh(B,M(0x6d7078,{metalness:.6,roughness:.35}),.13,.24,.2),-.32,0,0]),[-.47-.28,1.15,0]);
 }},
 /* 🐾 Пані Клубочок: фіолетова кофта, сиве волосся з гулькою й спицями, круглі окуляри, зелена шаль, кошик із клубками */
 klu:{jacket:'#6c3f7c',pants:'#5a3466',hair:'#cbc6d8',scale:[1.13,.97,1.13],acc(add,M){
  const HR=M(0xbdb8cc,{roughness:.85});add('Head',grp([mesh(S,HR,.13,.12,.12),0,0,0],[mesh(C,M(0xd9b24a),.007,.26,.007),-.05,.05,0,0,0,.6],[mesh(C,M(0xd9b24a),.007,.26,.007),.05,.05,0,0,0,-.6]),[0,1.77,-.1]);
  const F=M(0x8a6a2a,{metalness:.4,roughness:.4});add('Head',grp([mesh(TO,F,.058),-.075,0,0],[mesh(TO,F,.058),.075,0,0],[mesh(B,F,.04,.008,.008),0,0,0]),[0,1.45,.25]);
  add('Neck',grp([mesh(TO,M(0x4f9a5a,{roughness:.95}),.15,.15,.22),0,0,0,Math.PI/2],[mesh(S,M(0x4f9a5a),.05,.09,.03),.06,-.08,.13]),[0,1.2,.02]);
  add('LeftHand',grp([mesh(C,M(0xb08a50),.13,.11,.13),0,-.06,0],[mesh(S,M(0xff6a8a),.055),-.04,.02,0],[mesh(S,M(0x6ad0ff),.055),.05,.02,.03],[mesh(S,M(0xffd24a),.055),0,.02,-.05],[mesh(C,M(0x8a6a3a),.008,.16,.008),0,.08,0,0,0,Math.PI/2]),[.47+.14,1.05,0]);
 }}};
})();
