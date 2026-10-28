/* 0.1.10: оптимізація — нерухомі об'єкти не перераховуються щокадру,
   далекі істоти не малюються, менше трикутників у дрібних деталях */
(function(){try{
const G=n=>{try{return eval(n)}catch(e){return undefined}};
const SCN=G('sc');if(!SCN)return;
function freeze(o){if(!o)return;o.updateMatrix();o.updateMatrixWorld(true);o.traverse(x=>{if(!x.userData.noFreeze){x.matrixAutoUpdate=false}})}
function freezeLists(){for(const n of['trees','rocks','bushes','shrooms']){const L=G(n)||[];for(const o of L){const m=o.m||o;if(m&&m.matrixAutoUpdate!==false||(m&&m.children[0]&&m.children[0].matrixAutoUpdate))freeze(m)}}
 for(const c of SCN.children){if(c.isMesh&&c.geometry&&(c.geometry.type=='PlaneGeometry'||c.isInstancedMesh)&&c.matrixAutoUpdate)freeze(c)}}
/* «тремтіння» дерева чи каменю при ударі: тимчасово розморожуємо */
const _fl=window.flash;
if(typeof _fl==='function')window.flash=function(o){const m=o&&o.m;if(m&&!m.matrixAutoUpdate){m.matrixAutoUpdate=true;setTimeout(()=>{try{m.updateMatrix();m.matrixAutoUpdate=false}catch(e){}},260)}return _fl.apply(this,arguments)};
/* нові дерева/камені з'являються з часом — доморожуємо раз на кілька секунд */
setTimeout(freezeLists,1500);setInterval(freezeLists,5000);
/* далекі істоти й попали в таборі: не малюємо за туманом */
setInterval(()=>{const P=G('P');if(!P)return;const far=(SCN.fog?SCN.fog.far:80)+6;for(const n of['wild','pals']){for(const o of G(n)||[]){if(!o.m)continue;const v=Math.hypot(o.x-P.x,o.z-P.z)<far;if(o.m.visible!==v)o.m.visible=v;const hr=o._hi&&o._hi.root;for(const c of o.m.children){if(c!==hr&&c.matrixAutoUpdate)freeze(c)}}}},400);
}catch(e){console.warn('perf',e)}})();
