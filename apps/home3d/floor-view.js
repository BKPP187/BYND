(function(H){
    'use strict';
    // A read-only visual floor. No actors, activity callbacks or save writes.
    async function load(level,materials,home,isCurrent){
        const T=ByndHomeEngine,plan=H.Villa.plan(H.Villa.levelRoom(level)),group=new T.Group(),rows=[],walls=[],finishes=[],doors=[];
        group.name='villa-survey-floor-'+level;
        try{
            for(const node of plan.nodes){const shell=H.Villa.shell(node,plan,materials,home);shell.traverse(n=>{if(n.userData.villaWall)walls.push(n);if(n.userData.wallFinish)finishes.push(n);if(n.userData.door)doors.push(n);});group.add(shell);}
            group.add(H.Villa.staircase(plan,materials).group);
            if(!level)await H.Garden.populate(group,materials,isCurrent,home);
            const placements=plan.nodes.flatMap(n=>H.Rooms.placements(n.room,home).map(local=>({local,area:n.id,placement:{...local,id:n.id+'__'+local.id,floorY:plan.y,position:H.Villa.translate(plan,n.id,local.position)}})));
            let cursor=0;const failures=[];
            const worker=async()=>{while(cursor<placements.length&&isCurrent()){
                const row=placements[cursor++],item=H.Interiors.furniture(H.Furniture.get(row.placement.furnitureId),row.local,H.Rooms.get(row.area),home);
                try{const model=await H.Furniture.load(item,materials);if(!isCurrent()){H.Shapes.disposeGeometry(model);continue;}
                    model.position.fromArray(row.placement.position);model.rotation.y=row.placement.rotation||0;model.userData.furniture=row.placement.id;group.add(model);rows.push({...row,item,model});
                    if(H.Foods.supports(item))H.Foods.attach(model,await H.Foods.create(item,H.Foods.selected(home)));
                }catch(e){failures.push(e.message);}
            }};
            await Promise.all([worker(),worker(),worker()]);
            if(!isCurrent())throw Error('楼层查看已取消。');if(failures.length)throw Error('这层的家具暂时没能加载，请重试查看。');
            return{plan,group,rows,walls,finishes,doors};
        }catch(e){H.Shapes.disposeGeometry(group);throw e;}
    }
    function cutaway(floor){
        // Read-only dollhouse snapshots can bake every static mesh. Remove
        // front upper walls/closed door leaves before baking; navigation and
        // the real actors continue using the untouched physical floor.
        const removed=[];floor.group.traverse(n=>{const w=n.userData.villaWall;if(n.userData.door||w&&!w.cutaway)removed.push(n);});
        for(const node of removed)H.Shapes.disposeGeometry(node);
        const T=ByndHomeEngine;
        floor.group.updateMatrixWorld(true);
        const bounds=floor.rows.map(row=>({id:row.placement.id,box:row.pickBounds=new T.Box3().setFromObject(row.model)}));
        H.Architecture.bake(floor.group);
        // Analytic picking keeps baked furniture interactive without adding draws.
        for(const {id,box} of bounds){
            const proxy=new T.Object3D();proxy.userData.furniture=id;
            proxy.raycast=(caster,hits)=>{const point=caster.ray.intersectBox(box,new T.Vector3());if(!point)return;const distance=point.distanceTo(caster.ray.origin);if(distance>=caster.near&&distance<=caster.far)hits.push({object:proxy,point,distance});};
            floor.group.add(proxy);
        }
        floor.walls=[];floor.finishes=[];floor.doors=[];return floor;
    }
    H.FloorView={load,cutaway};
})(window.ByndHome3D);
