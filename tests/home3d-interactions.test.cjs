'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function harness(){
 const home={room:'living_room',moments:[],objectState:{}},data={activeCharId:'a'},notices=[],opened=[],calls=[];
 const row={area:'bedroom',local:{id:'bed'},placement:{id:'bedroom__bed'},item:{type:'bed',name:'床',actions:['Sleep','Lie']}};
 let floor=0,physical=[],finish,failSave=false;
 const H={session:1,Living:{labels:{}},UI:{notice:(...a)=>notices.push(a),updateStatus(){},showSettings(){opened.push('settings');}},Bridge:{open:id=>opened.push(id)},Rooms:{get:id=>({id,name:'卧室'})},Villa:{floorOf:()=>1},State:{load:()=>data,home:()=>home,withHome(fn){if(failSave)throw Error('存储空间不足');fn(home,data);}},runtime:{getFurniture:()=>row,furniture:()=>[],worldFurniture:()=>physical,stats:()=>({villa:{level:floor,browsing:true},camera:{mode:'isometric'}}),setViewpoint:async()=>{calls.push('view');},navigate:(id,intent)=>{calls.push(['navigate',id,intent]);return true;},interact:(id,action,cb)=>{calls.push(['interact',id,action]);finish=cb;return true;}}};
 const context=vm.createContext({window:{ByndHome3D:H},Date});vm.runInContext(fs.readFileSync(path.resolve('apps/home3d/interactions.js'),'utf8'),context);
 return{H,home,data,row,notices,opened,calls,arrive(){floor=1;physical=[row];H.Interactions.resume();},finish(){finish();},getFinish:()=>finish,failSave(){failSave=true;}};
}
test('a furniture intent exits survey, walks stairs, then executes and saves the target room',async()=>{
 const x=harness();await x.H.Interactions.perform('bedroom__bed','Sleep');assert.deepEqual(x.calls,['view',['navigate','bedroom',true]]);assert.equal(x.home.moments.length,0);
 x.arrive();assert.deepEqual(x.calls.at(-1),['interact','bedroom__bed','Sleep']);x.finish();assert.equal(x.home.objectState['bedroom:bed'].action,'Sleep');assert.equal(x.home.objectState['living_room:bed'],undefined);assert.equal(x.H.Interactions.hasPending(),false);
});
test('canceled travel and role/session changes cannot execute or save a stale furniture action',async()=>{
 for(const mode of ['cancel','role','session']){const x=harness();await x.H.Interactions.perform('bedroom__bed','Sleep');if(mode==='cancel')x.H.Interactions.cancel();if(mode==='role')x.data.activeCharId='b';if(mode==='session')x.H.session++;x.arrive();assert.equal(x.calls.some(c=>Array.isArray(c)&&c[0]==='interact'),false);assert.equal(x.home.moments.length,0);assert.equal(x.H.Interactions.hasPending(),false);}
});
test('blocked routes and failed persistence report failure without a saved success',async()=>{
 const blocked=harness();blocked.H.runtime.navigate=()=>false;await assert.rejects(blocked.H.Interactions.perform('bedroom__bed','Sleep'),/楼梯/);assert.equal(blocked.H.Interactions.hasPending(),false);
 const x=harness();await x.H.Interactions.perform('bedroom__bed','Sleep');x.arrive();x.failSave();x.finish();assert.deepEqual(x.notices.at(-1),['存储空间不足',true]);assert.equal(x.home.moments.length,0);assert.equal(x.home.objectState['bedroom:bed'],undefined);
});
test('a new selection replaces queued travel and an old finish cannot overwrite it',async()=>{
 const x=harness();await x.H.Interactions.perform('bedroom__bed','Sleep');x.arrive();const oldFinish=x.getFinish();await x.H.Interactions.perform('bedroom__bed','Lie');oldFinish();assert.equal(x.home.moments.length,0);x.arrive();x.finish();assert.equal(x.home.objectState['bedroom:bed'].action,'Lie');
});
test('desk gaming remains a furniture action instead of opening the standalone game app',async()=>{
 const x=harness();x.row.item={type:'desk',name:'书桌',actions:['Game']};await x.H.Interactions.perform('bedroom__bed','Game');assert.deepEqual(x.opened,[]);x.arrive();assert.equal(x.calls.at(-1)[2],'Game');
});
test('a selected object removed during floor travel reports failure instead of leaving a stuck intent',async()=>{
 const x=harness();await x.H.Interactions.perform('bedroom__bed','Sleep');x.H.runtime.worldFurniture=()=>[];x.arrive();assert.equal(x.H.Interactions.hasPending(),false);assert.deepEqual(x.notices.at(-1),['这件家具已经移动或移除，请重新选择。',true]);assert.equal(x.home.moments.length,0);
});
