'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function harness() {
    const context = vm.createContext({ console, AbortController, window: { ByndHome3D: {} } });
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/vendor/home3d/engine.js'), 'utf8'), context);
    for (const name of ['data/catalogs', 'materials', 'bedding', 'furniture-visuals', 'furniture']) vm.runInContext(fs.readFileSync(path.join(root, 'apps/home3d', name + '.js'), 'utf8'), context);
    const H = context.window.ByndHome3D, T = context.ByndHomeEngine, cache = new Map();
    const materials = {
        get(id, color) { const key = id + color; if (!cache.has(key)) cache.set(key, new T.MeshStandardMaterial({ color: color || '#ffffff' })); return cache.get(key); },
        woven(color) { return this.get('woven', color); }, glow(color) { return this.get('glow', color); }
    };
    return { H, T, materials };
}

test('all bed styles have a closed, finite quilt, with a mattress at the declared sleep support', async () => {
    const { H, T, materials } = harness();
    for (const data of H.catalogs.furnitureCatalog.items.filter(i => i.type === 'bed')) {
        const item = H.Furniture.get(data.id), bed = await H.Furniture.load(item, materials), quilt = bed.getObjectByName('sleep-quilt');
        assert.ok(quilt, item.id); const g = quilt.geometry, pos = g.attributes.position, support = H.Furniture.support(item);
        assert.ok(g.index.count / 3 < 7000, 'bounded cloth geometry');
        assert.ok([...pos.array, ...g.attributes.normal.array].every(Number.isFinite));
        for(let i=0; i<quilt.userData.bedding.count; i++) assert.ok(Math.abs(pos.getY(i)-pos.getY(i+quilt.userData.bedding.count)-.035)<1e-6);
        bed.updateMatrixWorld(true);
        const hit = new T.Raycaster(new T.Vector3(0, support.mattressSurface+.4, -.05), new T.Vector3(0,-1,0)).intersectObject(bed,true)[0];
        assert.ok(Math.abs(hit.point.y-support.mattressSurface+.015)<.025,item.id+' mattress/support mismatch: '+hit.point.y);
        const edges=new Map();
        for(let i=0;i<g.index.count;i+=3)for(let n=0;n<3;n++){
            const a=g.index.array[i+n],b=g.index.array[i+(n+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)||0)+1);
        }
        assert.ok([...edges.values()].every(n=>n===2),'closed quilt has no open edge');
        let disposed=false;quilt.material.addEventListener('dispose',()=>disposed=true);H.Shapes.disposeGeometry(bed);assert.ok(disposed,'bed owns quilt material');
    }
});

test('two sleeping lanes follow a rotated/moved bed, do not refit every frame, and restore flat on waking',async()=>{
    const {H,T,materials}=harness(),item=H.Furniture.get('cream_bed'),bed=await H.Furniture.load(item,materials);
    const quilt=bed.getObjectByName('sleep-quilt'),b=quilt.userData.bedding,pos=quilt.geometry.attributes.position,flat=pos.array.slice();
    bed.position.set(2,.1,-3);bed.rotation.y=Math.PI/2;bed.updateMatrixWorld(true);
    const make=(who,x)=>{
        const root=new T.Group();root.position.copy(bed.position);root.rotation.copy(bed.rotation);
        const torso=new T.Mesh(new T.BoxGeometry(.4,.2,.7,4,2,7),new T.MeshStandardMaterial());torso.position.set(x,b.surface+.13,.30);root.add(torso);
        const shoulder=new T.Group();shoulder.position.set(x,b.surface+.2,-.2);root.add(shoulder);
        return {who,modelId:'fixture',level:'far',startedAt:1,action:'Sleep',anchor:{placementId:'bed'},root,meshes:[torso],arms:[shoulder],socks:[]};
    };
    const actors=[make('char',-.55),make('user',.55)],rows=[{model:bed,placement:{id:'bed'}}];
    H.Bedding.update(rows,actors);assert.equal(b.sleepers,2);assert.notDeepEqual(pos.array,flat);
    const original=quilt.raycast;quilt.raycast=T.Mesh.prototype.raycast;
    for(const actor of actors){
        const p=actor.meshes[0].getWorldPosition(new T.Vector3());p.y+=1;
        const hits=new T.Raycaster(p,new T.Vector3(0,-1,0)).intersectObject(quilt,false);
        assert.ok(hits[0].point.y>p.y-1+.13,'cloth underside clears body');
    }
    quilt.raycast=original;
    const version=pos.version;H.Bedding.update(rows,actors);assert.equal(pos.version,version,'unchanged sleep state reuses contour');
    actors[0].action='Idle';H.Bedding.update(rows,actors);assert.equal(b.sleepers,1);
    actors[1].action='Walk';H.Bedding.update(rows,actors);assert.equal(b.sleepers,0);assert.deepEqual(pos.array,flat);
    H.Shapes.disposeGeometry(bed);actors.forEach(a=>H.Shapes.disposeGeometry(a.root));
});
