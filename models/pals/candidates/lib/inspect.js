const fs=require('fs');const f=process.argv[2];const b=fs.readFileSync(f);const jl=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+jl).toString());
const binOff=20+jl+8;const bin=b.slice(binOff);
const acc=i=>{const a=j.accessors[i],bv=j.bufferViews[a.bufferView];const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];const C={5126:Float32Array,5123:Uint16Array,5121:Uint8Array,5125:Uint32Array}[a.componentType];
 const st=bv.byteStride?bv.byteStride/C.BYTES_PER_ELEMENT:n;const arr=new C(bin.buffer,bin.byteOffset+(bv.byteOffset||0)+(a.byteOffset||0),(a.count-1)*st+n);return {a,arr,n,st}};
let tris=0,maxInf=0,badSum=0,neg=0,nonfin=0,colors=0,vc=0;
for(const m of j.meshes)for(const p of m.primitives){const ix=acc(p.indices);tris+=ix.a.count/3;if(p.attributes.COLOR_0!==undefined)colors++;
 const W=acc(p.attributes.WEIGHTS_0);const nm=W.a.normalized;const sc=W.a.componentType==5126?1:(W.a.componentType==5121?255:65535);
 for(let v=0;v<W.a.count;v++){let s=0,c=0;for(let k=0;k<4;k++){const x=W.arr[v*W.st+k]/sc;if(x<0)neg++;if(!isFinite(x))nonfin++;s+=x;if(x>0)c++}maxInf=Math.max(maxInf,c);if(Math.abs(s-1)>.01)badSum++}
 const P=acc(p.attributes.POSITION);for(let i=0;i<P.arr.length;i++)if(!isFinite(P.arr[i]))nonfin++;vc+=P.a.count}
const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
for(const m of j.meshes)for(const p of m.primitives){const a=j.accessors[p.attributes.POSITION];for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],a.min[k]);mx[k]=Math.max(mx[k],a.max[k])}}
console.log(JSON.stringify({file:f,bytes:b.length,scenes:j.scenes.length,nodes:j.nodes.length,meshes:j.meshes.length,prims:j.meshes.reduce((s,m)=>s+m.primitives.length,0),materials:(j.materials||[]).map(m=>m.name),skins:(j.skins||[]).length,joints:j.skins&&j.skins[0].joints.length,
 anims:(j.animations||[]).map(a=>a.name),cameras:(j.cameras||[]).length,lights:j.extensions?Object.keys(j.extensions):[],tris,verts:vc,maxInf,badSum,neg,nonfin,primsWithColor:colors,bboxMin:mn.map(v=>+v.toFixed(3)),bboxMax:mx.map(v=>+v.toFixed(3))}))
