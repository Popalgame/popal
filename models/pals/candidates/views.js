// node views.js <файл.glb> <вихід.png> [порівняти_з.glb] — 4 ракурси (3/4, спереду, збоку, ззаду)
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
(async()=>{const [f,outp,old]=process.argv.slice(2);const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:500,height:440}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));const shots=[];
for(const file of [f,old].filter(Boolean)){await p.goto('http://localhost:5193/view.html?f='+file);await p.waitForFunction(()=>window.ready,null,{timeout:60000});
 for(const a of [.6,0,1.5708,3.1416]){await p.evaluate(a=>{setView(a,.22,5.0,.9);setT(0)},a);await p.waitForTimeout(200);const n='_v'+shots.length+'.png';fs.writeFileSync(n,await p.screenshot());shots.push(n)}}
await b.close();
execSync('python3 '+__dirname+'/grid.py '+outp+' 4 '+shots.join(' '));if(errs.length)console.log('ERR',errs)})();
