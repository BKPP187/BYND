const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=path.resolve(__dirname,'../apps/study/study-trace.js');
function load(){const c=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(source,'utf8'),c);return c.window.ByndStudyTrace;}
function shape(){const size=64,mask=new Uint8Array(size*size);for(let y=10;y<54;y++)for(let x=14;x<50;x++)if(x<19||y<15||y>48)mask[y*size+x]=1;return mask;}
test('tracing accepts complete nearby handwriting and rejects blank, partial, displaced or flooded shapes',()=>{
 const S=load(),t=shape(),same=S.compareMasks(t,t,64,64);assert.equal(same.accepted,true);
 const near=new Uint8Array(t.length);for(let y=0;y<64;y++)for(let x=0;x<63;x++)near[y*64+x+1]=t[y*64+x];assert.equal(S.compareMasks(t,near,64,64).accepted,true);
 assert.equal(S.compareMasks(t,new Uint8Array(t.length),64,64).accepted,false);
 const partial=t.map((v,i)=>i%64<20?v:0);assert.equal(S.compareMasks(t,partial,64,64).accepted,false);
 const displaced=new Uint8Array(t.length);for(let y=0;y<64;y++)for(let x=0;x<40;x++)displaced[y*64+x+24]=t[y*64+x];assert.equal(S.compareMasks(t,displaced,64,64).accepted,false);
 assert.equal(S.compareMasks(t,new Uint8Array(t.length).fill(1),64,64).accepted,false);
});
test('small separate dots and marks cannot be omitted just because the main body is complete',()=>{
 const S=load(),t=shape(),ink=t.slice();for(let y=2;y<6;y++)for(let x=30;x<34;x++)t[y*64+x]=1;
 assert.equal(S.compareMasks(t,ink,64,64).accepted,false);
 assert.equal(S.compareMasks(t,t,64,64).accepted,true);
});
test('malformed or empty template masks are errors rather than handwriting failures',()=>{
 const S=load();assert.throws(()=>S.compareMasks([],[],64,64));assert.throws(()=>S.compareMasks(new Uint8Array(64),new Uint8Array(64),8,8));
});
