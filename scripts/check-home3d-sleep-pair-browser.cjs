'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createServer}=require('./check-home3d-renderer-browser.cjs');
const output=path.resolve('artifacts/home3d-renderer/sleep-pair-v1');
async function main(){
 const {chromium}=require('C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/room?pose=sleep&close=1');
 await page.waitForFunction(()=>ByndHome3D.runtime?.stats().actors.length===2&&!document.querySelector('.home3d-scene.is-loading')&&ByndHome3D.runtime.stats().camera.zoom>2.19&&ByndHome3D.runtime.stats().actors.every(a=>['middle','near'].includes(a.pose.level)));
 await page.evaluate(()=>{const H=ByndHome3D,update=H.SleepPair.update;H.SleepPair.update=(f,a,c)=>{window.pairActors=a;update(f,a,c);};H.runtime.interact('bed','Sleep');});
 await page.waitForFunction(()=>ByndHome3D.runtime.stats().actors.every(a=>a.pose.sleepPair),{},{timeout:30000}).catch(async e=>{console.error(JSON.stringify(await page.evaluate(()=>({stats:ByndHome3D.runtime.stats(),notice:document.querySelector('.home3d-notice').textContent})),null,2));await page.screenshot({path:path.join(output,'failure.png')});throw e;});
 await page.evaluate(()=>ByndHome3D.runtime.camera.focus(.05,-1.55));
 await page.screenshot({path:path.join(output,'pair-mobile.png')});
 const report=await page.evaluate(()=>{
  const H=ByndHome3D,T=ByndHomeEngine,bed=H.runtime.furniture().find(f=>f.placement.id==='bed').model,q=bed.getObjectByName('sleep-quilt');
  q.visible=false;
  return pairActors.map(a=>{const p=new T.Vector3(),rows=[];for(const m of a.meshes)for(const i of new Set(m.geometry.index.array)){const r=m.geometry.attributes.position,y=r.getY(i)/a.modelHeight;m.getVertexPosition(i,p);p.applyMatrix4(m.matrixWorld);bed.worldToLocal(p);let aw=0;for(const f of ['getX','getY','getZ','getW']){let bone=a.skeleton.bones[m.geometry.attributes.skinIndex[f](i)];while(bone&&!a.arms.includes(bone))bone=bone.parent;if(bone)aw+=m.geometry.attributes.skinWeight[f](i);}
if(p.z>q.userData.bedding.z0&&y<.72&&aw<=.45)rows.push({i,rest:[r.getX(i),y,r.getZ(i)],world:p.toArray(),bones:['getX','getY','getZ','getW'].map(f=>[a.skeleton.bones[m.geometry.attributes.skinIndex[f](i)].name,m.geometry.attributes.skinWeight[f](i)])});}rows.sort((a,b)=>b.world[1]-a.world[1]);const original=q.raycast;q.raycast=T.Mesh.prototype.raycast;
const gaps=[],ray=new T.Raycaster(),eye=[];let count=0,covered=0;
for(const m of a.meshes){const drawn=[...new Set(m.geometry.index.array)],stride=Math.max(1,Math.floor(drawn.length/5000));for(let n=0;n<drawn.length;n+=stride){const i=drawn[n],r=m.geometry.attributes.position,y=r.getY(i)/a.modelHeight;m.getVertexPosition(i,p);p.applyMatrix4(m.matrixWorld);const local=bed.worldToLocal(p.clone());let armWeight=0;for(const f of ['getX','getY','getZ','getW']){let bone=a.skeleton.bones[m.geometry.attributes.skinIndex[f](i)];while(bone&&!a.arms.includes(bone))bone=bone.parent;if(bone)armWeight+=m.geometry.attributes.skinWeight[f](i);}
if(armWeight<=.45&&y>.13&&y<.59&&r.getZ(i)>0&&local.z>q.userData.bedding.z0+.14&&local.z<q.userData.bedding.z1-.12&&Math.abs(local.x)<q.userData.bedding.x1-.15){ray.set(p.clone().add(new T.Vector3(0,2,0)),new T.Vector3(0,-1,0));const hits=ray.intersectObject(q,false);count++;if(hits[0]&&hits[0].distance<1.99){covered++;gaps.push(2-hits[0].distance);}}
const eyeY=a.who==='user'?.766:.858;if(Math.abs(y-eyeY)<.014&&Math.abs(r.getX(i)/a.modelHeight)<.07&&r.getZ(i)/a.modelHeight>(a.who==='user'?.07:.026)){ray.set(p.clone().add(new T.Vector3(0,2,0)),new T.Vector3(0,-1,0));eye.push(!ray.intersectObject(q,false).some(h=>h.distance<1.995));}
}}q.raycast=original;gaps.sort((a,b)=>a-b);
return{who:a.who,pose:H.CharacterModels.geometry(a),torso:H.SleepPair.bounds(a,bed,.5,.74),head:H.SleepPair.bounds(a,bed,.8,1),coverage:{count,covered,eye:eye.length,visible:eye.filter(Boolean).length,medianGap:gaps[Math.floor(gaps.length/2)]},top:rows.slice(0,3)};});
 });
 await page.screenshot({path:path.join(output,'pair-uncovered-mobile.png')});
 await page.evaluate(()=>ByndHome3D.runtime.furniture().find(f=>f.placement.id==='bed').model.getObjectByName('sleep-quilt').visible=true);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));for(const a of report){assert.ok(a.pose.sleepPair);assert.equal(a.pose.eyesClosed,true);assert.ok(a.torso.min.y>=1.01,'torso contact');assert.ok(a.head.min.y>=1.005,'head contact');assert.ok(a.coverage.count>15);assert.ok(a.coverage.covered/a.coverage.count>.98,'quilt covers torso/legs: '+JSON.stringify(a.coverage));assert.ok(a.coverage.visible/a.coverage.eye>.95,'face remains exposed');assert.ok(a.coverage.medianGap<.15,'quilt follows body rather than a fixed dome');} assert.ok(report.find(a=>a.who==='char').pose.sleepPair.reachError<.055);await page.setViewportSize({width:320,height:740});
 await page.waitForFunction(()=>ByndHome3D.runtime.stats().actors.length===2&&ByndHome3D.runtime.stats().actors.every(a=>a.pose.sleepPair));
 await page.screenshot({path:path.join(output,'pair-mobile-320.png')});
 await page.evaluate(()=>ByndHome3D.State.withHome(home=>{home.consentHug=false;}));
 await page.waitForFunction(()=>ByndHome3D.runtime.stats().actors.every(a=>!a.pose.sleepPair&&a.action==='Sleep'));
 await page.evaluate(()=>ByndHome3D.State.withHome(home=>{home.consentHug=true;}));
 await page.waitForFunction(()=>ByndHome3D.runtime.stats().actors.every(a=>a.pose.sleepPair));
 assert.equal(await page.evaluate(()=>ByndHome3D.runtime.interact('bed','Sit')),true);
 await page.waitForFunction(()=>ByndHome3D.runtime.stats().actors.every(a=>!a.pose.sleepPair)&&ByndHome3D.runtime.stats().actors.find(a=>a.who==='user').pose.kind==='seated');
 assert.equal(await page.evaluate(()=>ByndHome3D.runtime.stats().actors.find(a=>a.who==='char').pose.eyesClosed),true);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('Mobile pair contour, head/body contacts, reach, coverage, face exposure, hug opt-out and solo recovery passed');
 }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
