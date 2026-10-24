'use strict';
// Renders the 2.5D home's pose sprites from the packaged 3D characters (no generation service).
// Usage: node scripts/render-home25-sprites.cjs <output-dir>   then   python3 scripts/pack-home25-sprites.py <output-dir>
// Needs Playwright (BYND_PLAYWRIGHT) and a WebGL-capable Chromium (SwiftShader is fine).
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '..'), OUT = path.resolve(process.argv[2] || path.join(root, 'artifacts/home25-sprites'));
const { chromium } = require(process.env.BYND_PLAYWRIGHT || 'playwright');
const page = '<!doctype html><meta charset="utf-8"><body style="margin:0"><script src="/apps/home3d/home3d.js"></script><script>ByndHome3D.ensure().then(() => { window.ready = true; });</script>';
const mime = { '.js': 'application/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png' };
function jobs() {
    const list = [], q = Math.PI / 2;
    for (const who of ['user', 'char']) {
        for (let k = 0; k < 8; k++) {
            const r = k * Math.PI / 4;
            list.push({ name: who + '-idle-r' + k, who, kind: 'stand', action: 'Idle', rotation: r });
            for (let f = 0; f < 4; f++) list.push({ name: who + '-walk' + f + '-r' + k, who, kind: 'walk', action: 'Walk', rotation: r, phase: f * Math.PI / 2 });
        }
        for (let k = 0; k < 4; k++) {
            const r = k * q, tag = '-r' + k * 2;
            list.push({ name: who + '-cook' + tag, who, kind: 'stand', action: 'Cook', rotation: r });
            for (const [action, t] of [['Sit', 'sit'], ['Read', 'read'], ['Use Phone', 'phone']]) list.push({ name: who + '-sofa-' + t + tag, who, kind: 'sit', action, furnitureId: 'sofa_cream_01', rotation: r });
            for (const [action, t] of [['Sit', 'sit'], ['Read', 'read'], ['Work', 'work']]) list.push({ name: who + '-chair-' + t + tag, who, kind: 'sit', action, furnitureId: 'cream_chair', rotation: r });
            for (const [action, t] of [['Sleep', 'sleep'], ['Lie', 'lie']]) {
                list.push({ name: who + '-bed-' + t + tag, who, kind: 'lie', action, furnitureId: 'bed_cloud_01', rotation: r });
                list.push({ name: who + '-sofabed-' + t + tag, who, kind: 'lie', action, furnitureId: 'sofa_cream_01', rotation: r });
            }
        }
    }
    return list;
}
(async()=>{const s=http.createServer((req,res)=>{const r=decodeURIComponent(req.url.split('?')[0]);if(r==='/page.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end(page);return;}const f=path.join(root,r);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});fs.mkdirSync(OUT,{recursive:true});await new Promise(r=>s.listen(8830,r));
const b=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist']});const p=await b.newPage();
p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
await p.goto('http://127.0.0.1:8830/page.html');await p.waitForFunction('window.ready',null,{timeout:60000});
// setup renderer & models once
await p.evaluate(async()=>{
  const T=ByndHomeEngine,H=ByndHome3D;
  window.R={};
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  const W=1000,HH=1000; renderer.setSize(W,HH); renderer.setPixelRatio(1); renderer.setClearColor(0,0);
  renderer.outputColorSpace=T.SRGBColorSpace; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=false;
  const span=3.4; // meters across
  const cam=new T.OrthographicCamera(-span/2,span/2,span*0.62,-span*0.38,-20,40);
  const d=10; cam.position.set(d,d,d); cam.up.set(0,1,0); cam.lookAt(0,0,0); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  R.renderer=renderer;R.cam=cam;R.W=W;R.H=HH;R.span=span;
  R.actors={};
  for(const [who,id] of [['user','bunny-blue-v1'],['char','silver-red-v1']]){
    const bytes=await fetch('/assets/home3d/characters/'+id+'/near.glb').then(r=>r.arrayBuffer());
    const gltf=await new T.GLTFLoader().parseAsync(bytes,'');
    const actor={who,modelId:id,root:new T.Group(),visual:'model3d'};
    Object.assign(actor,H.CharacterModels.rig(gltf,actor)); actor.root.add(actor.modelRoot);
    const scene=new T.Scene(); scene.add(actor.root);
    scene.add(new T.HemisphereLight('#fff6ee','#c9c2c6',2.1));
    const key=new T.DirectionalLight('#fffaf2',2.3); key.position.set(-2,6,5); scene.add(key);
    const rim=new T.DirectionalLight('#ffe9f0',0.9); rim.position.set(5,3,-4); scene.add(rim);
    R.actors[who]={actor,scene,id};
  }
  // origin pixel of world (0,0,0)
  const v=new T.Vector3(0,0,0).project(cam); R.origin=[(v.x+1)/2*W,(1-v.y)/2*HH];
});
const list=jobs();
const meta={};
for(const job of list){
  let res; try { res=await p.evaluate((job)=>{
    const T=ByndHomeEngine,H=ByndHome3D,{actor,scene}=R.actors[job.who];
    actor.root.position.set(0,0,0);actor.root.rotation.set(0,0,0);
    let anchor=null;
    if(job.kind==='stand'||job.kind==='walk'){ H.CharacterModels.pose(actor,job.action||'Idle'); actor.root.position.set(0,.07,0); actor.root.rotation.y=job.rotation; }
    else { const pl={id:'x',furnitureId:job.furnitureId,position:[0,0,0],rotation:job.rotation}; const item=H.Furniture.get(job.furnitureId); anchor=H.Rooms.anchor(pl,job.action,job.who,item); if(job.kind==='sit') anchor.seatId='x'; H.CharacterModels.pose(actor,job.action,anchor); actor.bootPile.visible=false; }
    if(job.kind==='walk'){ const phase=job.phase; actor.legs.forEach((leg,i)=>{const a=phase+i*Math.PI;leg.rotation.x=Math.sin(a)*.28;actor.knees[i].rotation.x=Math.max(0,-Math.cos(a))*.55;actor.knees[i].children[0].rotation.x=-leg.rotation.x-actor.knees[i].rotation.x;actor.arms[i].rotation.x=-Math.sin(a)*.18;actor.arms[i].rotation.z=i?-.10:.10;});
      actor.book.visible=actor.phone.visible=actor.cup.visible=false; actor.body.position.y=-(actor.modelHeight||1.55)*.45*(1-Math.cos(Math.sin(phase)*.28)); actor.root.updateMatrixWorld(true); actor.skeleton.update(); H.CharacterModels.updateProps(actor);}
    actor.root.updateMatrixWorld(true);
    R.renderer.render(scene,R.cam);
    return {url:R.renderer.domElement.toDataURL('image/png'),origin:R.origin,anchor:anchor?{x:anchor.x,y:anchor.y,z:anchor.z,rotation:anchor.rotation,lying:!!anchor.lying,surface:anchor.restSurface}:{x:0,y:.07,z:0,rotation:job.rotation}};
  },job); } catch(e){ console.log('FAIL',job.name,e.message.split('\n')[0]); continue; }
  fs.writeFileSync(path.join(OUT,job.name+'.png'),Buffer.from(res.url.split(',')[1],'base64'));
  meta[job.name]={origin:res.origin,anchor:res.anchor};
}
fs.writeFileSync(path.join(OUT,'raw-meta.json'),JSON.stringify({meta,W:1000,span:3.4},null,0));
console.log('rendered',Object.keys(meta).length);await b.close();s.close();})();
