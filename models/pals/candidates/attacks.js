// node attacks.js <pal> <form> <вихід.png> — по 5 кадрів кожної з 9 атак (тіло + ефекти)
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
(async()=>{const [pal,form,outp]=process.argv.slice(2);const man=JSON.parse(fs.readFileSync(pal+'_attacks.json'));
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:480,height:360}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:5193/atk.html?pal='+pal+'&form='+form);await p.waitForFunction(()=>window.ready,null,{timeout:90000});
const shots=[];
for(const m of man){await p.evaluate(([c,t])=>{play(c);LA=[0,1.0,1.3];setView(1.3,.28,9.5,1.0);document.getElementById('l').textContent=t},[m.clip,m.name+' · '+m.anim+' · '+m.elem]);
 for(let i=0;i<5;i++){const f=Math.round(1+(m.frames-2)*[.15,.3,.45,.6,.8][i]);await p.evaluate(t=>setT(t),(f-1)/30+.0001);const n='_a'+shots.length+'.png';fs.writeFileSync(n,await p.screenshot());shots.push(n)}}
await b.close();execSync('python3 '+__dirname+'/grid.py '+outp+' 5 '+shots.join(' '));if(errs.length)console.log('ERR',errs)})();
