'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { memoryStorage } = require('./helpers/harness.cjs');
function setup() {
    const localStorage = memoryStorage(), window = { ByndHome3D: {}, myCharacters: [{id:'a',name:'A'}] }, context = vm.createContext({window,localStorage,Date,console,performance,AbortController});
    vm.runInContext(fs.readFileSync(path.resolve('assets/vendor/home3d/engine.js'),'utf8'),context);
    vm.runInContext(fs.readFileSync(path.resolve('assets/home3d/doors/geometry.js'),'utf8'),context);
    for (const file of ['data/catalogs','materials','interiors','furniture','rooms','villa','characters','state','bridge','animation','build']) vm.runInContext(fs.readFileSync(path.resolve('apps/home3d',file+'.js'),'utf8'),context);
    const H=window.ByndHome3D; H.State.bind('a'); return {H,T:context.ByndHomeEngine,localStorage,window};
}
test('villa floor graphs connect all requested spaces and physical doors fit both avatar hulls',()=>{
    const {H}=setup();
    for(const id of ['living_room','bedroom']) {
        const plan=H.Villa.plan(id),seen=new Set([plan.nodes[0].id]);
        for(let pass=0;pass<plan.nodes.length;pass++)for(const d of plan.doors)if(seen.has(d.a)||seen.has(d.b)){seen.add(d.a);seen.add(d.b);}
        assert.equal(seen.size,plan.nodes.length);
        for(const d of plan.doors) {
            const a={x:d.x,z:d.z},b={x:d.x,z:d.z};a[d.axis]-=.65;b[d.axis]+=.65;
            assert.ok(H.Animation.segmentClear(a,b,H.Villa.blocks(plan),plan.size,.52),d.a+' doorway to '+d.b);
        }
        for(const n of plan.nodes)assert.equal(H.Rooms.available(n.room,H.State.home()),true);
    }
    assert.equal(H.Villa.includes('music_room'),false);
});
test('world transforms round-trip without changing durable per-room furniture coordinates',()=>{
    const {H,localStorage}=setup(),before=localStorage.getItem(H.State.key);
    for(const id of ['living_room','bedroom']) {
        const plan=H.Villa.plan(id);
        for(const n of plan.nodes)for(const p of H.Rooms.placements(n.room,H.State.home())){
            const world=H.Villa.translate(plan,n.id,p.position),back=H.Villa.translate(plan,n.id,world,false);
            back.forEach((value,i)=>assert.ok(Math.abs(value-p.position[i])<1e-10));assert.equal(world[1],p.position[1]+plan.y);
        }
    }
    assert.equal(localStorage.getItem(H.State.key),before);
});
test('stairs share one reversible route with intermediate landing and bounded static draw batches',()=>{
    const {H,T}=setup(),cache=new Map(),materials={get(role,color){const key=role+color;if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({color}));return cache.get(key);},dispose(){cache.forEach(m=>m.dispose());}};
    const down=H.Villa.staircase(H.Villa.plan('living_room'),materials),up=H.Villa.staircase(H.Villa.plan('bedroom'),materials);
    assert.deepEqual(JSON.parse(JSON.stringify(down.path)),JSON.parse(JSON.stringify(up.path.slice().reverse())));
    assert.equal(down.entry.y,.07);assert.equal(down.exit.y,3.27);
    assert.ok(down.path.some(p=>p.y===1.67&&p.z===-6.4));
    for(let i=1;i<down.path.length;i++)assert.ok(down.path[i].y>=down.path[i-1].y-1e-10);
    assert.ok(down.group.children.length<12,'stairs instance the repeating treads and railing posts');
    const bounds=new T.Box3().setFromObject(down.group);assert.ok(bounds.max.y>3.2&&bounds.min.y<=0);
    H.Shapes.disposeGeometry(down.group);H.Shapes.disposeGeometry(up.group);materials.dispose();
});
test('floor navigation rejects the empty outside world and garden obstacles',()=>{
    const {H}=setup(),plan=H.Villa.plan('living_room');
    assert.equal(H.Animation.clear({x:0,z:-9},[],plan.size,.52),false);
    assert.equal(H.Animation.clear({x:3.3,z:6.25},H.Villa.blocks(plan),plan.size,.52),false);
    assert.equal(H.Animation.clear({x:.7,z:8.7},H.Villa.blocks(plan),plan.size,.38),false);
    assert.equal(H.Animation.segmentClear({x:-4,z:0},{x:4,z:0},H.Villa.blocks(plan),plan.size,.52),false,'solid partition cannot be traversed');
});
test('blocked doors and stairwell drafts fail atomically while original layouts remain intact',()=>{
    const {H,localStorage}=setup(),before=localStorage.getItem(H.State.key);
    assert.throws(()=>H.Build.commit('living_room',{id:'blocked-door',furnitureId:'cream_chair',position:[2.6,0,1.8],rotation:0}),/门口和楼梯/);
    assert.throws(()=>H.Build.commit('stair_hall',{id:'blocked-stairs',furnitureId:'cream_chair',position:[-1.05,0,0],rotation:0}),/门口和楼梯/);
    assert.equal(localStorage.getItem(H.State.key),before);
    localStorage.setItem=()=>{throw new Error('quota');};
    assert.throws(()=>H.State.withHome(h=>{h.room='garden';}),/没有保存成功/);assert.equal(H.State.home().room,'living_room');
});
test('upstairs furniture anchors keep seat, mattress and local floor heights independent',()=>{
    const {H}=setup(),plan=H.Villa.plan('bedroom');
    for(const id of ['bedroom','game_room']) {
        const room=H.Rooms.get(id),rows=H.Rooms.placements(room,H.State.home()).map(p=>({placement:{...p,id:id+'__'+p.id,floorY:plan.y,position:H.Villa.translate(plan,id,p.position)},item:H.Furniture.get(p.furnitureId)}));
        const bed=rows.find(r=>r.item.type==='bed'),desk=rows.find(r=>r.item.type==='desk');
        if(bed){const a=H.Rooms.anchor(bed.placement,'Sleep','char');assert.equal(a.floorY,3.2);assert.ok(a.restSurface>3.7&&a.y>3.7);}
        if(desk){const a=H.Rooms.anchorInRoom(rows,desk,'Game','char');assert.ok(a?.seatId?.startsWith('game_room__'));assert.equal(a.floorY,3.2);assert.ok(a.y>3.5&&a.y<4);}
    }
});

test('double doors open before the larger avatar enters and close after both actors leave',()=>{
    const {H,T}=setup(),materials={get:(role,color)=>new T.MeshStandardMaterial({color})},p=H.Villa.plan('living_room'),entry=p.doors.find(d=>d.b==='garden'),door=H.Villa.doorway(entry,p.y,materials),root=new T.Group();
    root.visible=true;root.position.set(entry.x+1.9,.07,entry.z);
    H.Villa.updateDoors([door],[{root}],.2,false);assert.ok(door.userData.door.angle>1.4);
    assert.equal(door.children.filter(c=>c.name==='door-hinge').length,2);
    root.position.x+=5;H.Villa.updateDoors([door],[{root}],.6,false);assert.ok(door.userData.door.angle<.01);
    const before=JSON.stringify(H.Villa.blocks(p));door.visible=false;assert.equal(JSON.stringify(H.Villa.blocks(p)),before,'wall rendering cannot remove collision partitions');
    H.Shapes.disposeGeometry(door);
});

test('door use determines genuinely different geometry and sliding leaves clear the same passage',()=>{
    const {H,T}=setup(),materials={get:(role,color)=>new T.MeshStandardMaterial({color})};
    const ground=H.Villa.plan('living_room'),upper=H.Villa.plan('bedroom');
    assert.equal(H.Villa.doorStyle(ground.doors[0]),'passage');
    assert.equal(H.Villa.doorStyle(ground.doors.find(d=>d.a==='kitchen')),'cafe');
    assert.equal(H.Villa.doorStyle(upper.doors[0]),'panel');
    assert.equal(H.Villa.doorStyle(ground.doors.find(d=>d.b==='garden')),'glazed');
    const entry=upper.doors.find(d=>d.a==='bathroom'),door=H.Villa.doorway(entry,upper.y,materials),actor=new T.Group();
    actor.position.set(entry.x,upper.y,entry.z);H.Villa.updateDoors([door],[{root:actor}],1,true);
    for(const leaf of door.children.filter(n=>n.name==='door-hinge')){const b=new T.Box3().setFromObject(leaf);assert.equal(leaf.rotation.y,0);assert.ok(Math.abs(leaf.position.x)>entry.width*.9);}
    actor.position.set(100,0,100);H.Villa.updateDoors([door],[{root:actor}],1,true);
    for(const leaf of door.children.filter(n=>n.name==='door-hinge'))assert.equal(leaf.position.x,leaf.userData.restX);
    const arch=H.Villa.doorway(ground.doors[0],0,materials);assert.equal(arch.children.filter(n=>n.name==='door-hinge').length,0);
    let disposed=false;door.userData.ownedMaterial.addEventListener('dispose',()=>{disposed=true;});H.Shapes.disposeGeometry(door);assert.equal(disposed,true);
});

test('door imports carry verified CC0 provenance and stay inside mobile geometry budgets',()=>{
    const {createHash}=require('node:crypto'),manifest=JSON.parse(fs.readFileSync('assets/home3d/door-manifest.json','utf8'));
    assert.equal(manifest.license,'CC0-1.0');assert.match(fs.readFileSync(manifest.licenseFile,'utf8'),/CC0/);
    const bytes=fs.readFileSync(manifest.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);assert.ok(bytes.length<50000);
    for(const a of manifest.assets){assert.ok(a.triangles<=160);assert.match(a.originalSha256,/^[a-f0-9]{64}$/);}
});
test('every default furniture placement passes its own placement validation, also after a full rotation', () => {
    const {H}=setup(),home=H.State.home(),failures=[];
    for(const level of ['living_room','bedroom'])for(const n of H.Villa.plan(level).nodes)for(const p of H.Rooms.placements(n.room,home))for(const turn of [0,Math.PI*2]){
        try{H.Build.validate(n.room,home,{...p,position:[...p.position],rotation:(p.rotation||0)+turn});}catch(e){failures.push(n.id+'/'+p.id+': '+e.message);}
    }
    assert.deepEqual(failures,[]);
});
