'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
function setup(){const context=vm.createContext({window:{ByndHome3D:{}},Date,console,AbortController});vm.runInContext(fs.readFileSync(path.join(root,'assets/vendor/home3d/engine.js'),'utf8'),context);for(const f of ['data/catalogs','rooms','interiors','daylight','garden','materials','architecture'])vm.runInContext(fs.readFileSync(path.join(root,'apps/home3d',f+'.js'),'utf8'),context);return{H:context.window.ByndHome3D,T:context.ByndHomeEngine};}
test('local 24-hour lighting is continuous around sunrise and sunset and lights the night without unlimited extra lights',()=>{
 const {H}=setup(),at=(h,m=0,s=0)=>H.Daylight.sample(new Date(2026,9,7,h,m,s));
 const noon=at(12),midnight=at(0);assert.equal(noon.daylight,1);assert.equal(midnight.daylight,0);assert.equal(midnight.night,true);assert.equal(midnight.lamps,1);assert.equal(noon.lamps,0);
 assert.ok(at(8).sun[0]<0&&at(16).sun[0]>0,'sun changes direction with the hour');assert.equal(at(6).phase,'晨光');assert.equal(at(18).phase,'黄昏');assert.equal(at(23,5).clock,'23:05');
 for(const [a,b]of [[at(5,59,59),at(6)],[at(17,59,59),at(18)],[at(23,59,59),at(0)]]){assert.ok(Math.abs(a.sunIntensity-b.sunIntensity)<.001);assert.ok(Math.abs(a.ambientIntensity-b.ambientIntensity)<.001);}
 for(let h=0;h<24;h++){const state=at(h);assert.ok(state.ambientIntensity>=.45);assert.ok(state.sun.every(Number.isFinite));}
});
test('reviewed garden assets preserve CC0 provenance, offline mirrors, compact topology and original material colors',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/home3d/garden-manifest.json')));assert.equal(manifest.license,'CC0-1.0');assert.match(fs.readFileSync(path.join(root,manifest.licenseFile),'utf8'),/Creative Commons Zero|CC0/i);
 let bytes=0;for(const asset of manifest.assets){const raw=fs.readFileSync(path.join(root,'assets/home3d/furniture',asset.file));assert.equal(createHash('sha256').update(raw).digest('hex'),asset.sha256);const mirror=fs.readFileSync(path.join(root,'assets/home3d/furniture',asset.file+'.js'),'utf8'),encoded=mirror.match(/,"([A-Za-z0-9+/=]+)"\);/)[1];assert.deepEqual(Buffer.from(encoded,'base64'),raw);assert.ok(asset.triangles<=200);assert.ok(/^[a-f0-9]{64}$/.test(asset.originalSha256));bytes+=raw.length;}
 assert.ok(bytes<80000);assert.equal(manifest.assets.length,6);
});
test('garden uses bounded instanced models, preserves separate PBR materials and uses home palettes, and disposes all staging resources on a cancelled load',async()=>{
 const {H,T}=setup(),disposed=[],make=id=>{const root=new T.Group(),mat=new T.MeshStandardMaterial({color:'#beba91'}),geo=new T.BoxGeometry(.2,.3,.2),mesh=new T.Mesh(geo,mat);mesh.userData.ownedMaterials=[mat];root.add(mesh);mat.addEventListener('dispose',()=>disposed.push(id));return root;};
 H.Furniture={load:async item=>{assert.equal(item.keepMaterials,true);return make(item.id);}};
 const parent=new T.Group(),group=await H.Garden.populate(parent,{});assert.equal(group.children.length,6);assert.ok(group.children.every(m=>m.isInstancedMesh));assert.equal(group.userData.gardenAssets.instances,210);assert.ok(H.Garden.blocks().some(b=>b.x===-1.8));
 H.Shapes.disposeGeometry(group);assert.equal(disposed.length,6);
 await assert.rejects(H.Garden.populate(parent,{},()=>false),/花园植物/);assert.equal(parent.children.length,0);assert.equal(disposed.length,12);
});
test('ceiling pendant is a lightweight open shade and cannot cover an entire room',()=>{
 const {H,T}=setup(),cache=new Map(),materials={get:(role,color)=>{const key=role+color;if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({color}));return cache.get(key);},glow:(color,intensity)=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity})};
 const fixture=H.Daylight.fixture(materials),b=new T.Box3().setFromObject(fixture);assert.ok(b.getSize(new T.Vector3()).x<.75);assert.ok(b.min.y>-.52);assert.equal(fixture.userData.ceilingLamp,true);assert.equal(fixture.children.length,4);H.Shapes.disposeGeometry(fixture);
});
test('static architecture baking preserves world bounds, UVs and owned material/texture disposal',()=>{
 const {H,T}=setup(),group=new T.Group(),sub=new T.Group();sub.position.set(2,1,3);group.add(sub);
 const texture=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1),material=new T.MeshStandardMaterial({map:texture});let disposedMaterials=0,disposedTextures=0;
 material.addEventListener('dispose',()=>disposedMaterials++);texture.addEventListener('dispose',()=>disposedTextures++);
 for(let i=0;i<50;i++){const mesh=new T.Mesh(new T.BoxGeometry(.2,.4,.3),material);mesh.position.x=i*.1;mesh.userData.ownedMaterials=[material];mesh.userData.ownedTextures=[texture];sub.add(mesh);}
 const before=new T.Box3().setFromObject(group);H.Architecture.bake(group);const after=new T.Box3().setFromObject(group),meshes=[];group.traverse(n=>{if(n.isMesh)meshes.push(n);});
 assert.equal(meshes.length,1);assert.ok(before.min.distanceTo(after.min)<1e-5&&before.max.distanceTo(after.max)<1e-5);assert.equal(meshes[0].geometry.attributes.uv.count,meshes[0].geometry.attributes.position.count);
 H.Shapes.disposeGeometry(group);assert.equal(disposedMaterials,1);assert.equal(disposedTextures,1);
});
