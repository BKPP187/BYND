(function (H) {
    'use strict';
    function refresh(actor) { actor.root.updateMatrixWorld(true); actor.skeleton.update(); }
    function hand(actor, side) {
        const T=ByndHomeEngine, result=new T.Vector3(), point=new T.Vector3(), samples=actor.grips[side];
        refresh(actor);
        for(const sample of samples) {sample.mesh.getVertexPosition(sample.index,point);result.add(point.applyMatrix4(sample.mesh.matrixWorld));}
        return result.divideScalar(samples.length);
    }
    function reach(actor, side, target) {
        const T=ByndHomeEngine, upper=actor.arms[side], joints=[upper.children[0],upper];
        for(let pass=0;pass<12;pass++) for(const joint of joints) {
            const origin=joint.getWorldPosition(new T.Vector3()), end=hand(actor,side).sub(origin), goal=target.clone().sub(origin);
            if(end.lengthSq()<1e-8||goal.lengthSq()<1e-8)continue;
            const parent=joint.parent.getWorldQuaternion(new T.Quaternion()), inverse=parent.clone().invert();
            end.applyQuaternion(inverse).normalize();goal.applyQuaternion(inverse).normalize();
            const delta=new T.Quaternion().setFromUnitVectors(end,goal), bounded=new T.Quaternion().slerp(delta,.55);
            joint.quaternion.premultiply(bounded).normalize();refresh(actor);
        }
        return hand(actor,side).distanceTo(target);
    }
    function bounds(actor, bed, low, high, frontOnly=false) {
        const T=ByndHomeEngine, box=new T.Box3(), p=new T.Vector3();refresh(actor);
        for(const mesh of actor.meshes) for(const i of new Set(mesh.geometry.index.array)) {
            const rest=mesh.geometry.attributes.position,y=rest.getY(i)/actor.modelHeight;
            if(y<low||y>high||(frontOnly&&(Math.abs(rest.getX(i))>actor.modelHeight*.12||(frontOnly===true&&rest.getZ(i)<0))))continue;
            mesh.getVertexPosition(i,p);p.applyMatrix4(mesh.matrixWorld);bed.worldToLocal(p);box.expandByPoint(p);
        }
        return box;
    }
    function lean(actor, bed, side) {
        const T=ByndHomeEngine, anchor=actor.anchor;
        H.CharacterModels.pose(actor,'Sleep',anchor);
        const p=bed.worldToLocal(actor.root.position.clone());p.x=side*.32;actor.root.position.copy(bed.localToWorld(p));
        actor.body.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-side*.32));
        actor.head.rotation.y=-side*.10;
        if(actor.modelId==='bunny-blue-v1') {
            const hip=bed.worldToLocal(actor.hips.getWorldPosition(new T.Vector3())),origin=bed.getWorldPosition(new T.Vector3());
            for(let i=0;i<2;i++) {
                const shoulder=bed.worldToLocal(actor.arms[i].getWorldPosition(new T.Vector3()));
                const target=new T.Vector3(p.x+(shoulder.x>p.x?.14:-.14),anchor.restSurface-origin.y+.18,hip.z-.08);
                reach(actor,i,bed.localToWorld(target));
            }
        }
        const torso=bounds(actor,bed,.50,.74);
        const origin=bed.getWorldPosition(new T.Vector3());
        actor.body.position.y+=anchor.restSurface-origin.y+.008-torso.min.y;
        const head=bounds(actor,bed,.8,1);
        actor.body.position.y+=Math.max(0,anchor.pillowSurface-origin.y+.005-head.min.y);
        H.CharacterModels.settleFeet(actor,(anchor.quiltSurface??anchor.restSurface)+.006);refresh(actor);
    }
    function fit(row, left, right) {
        const T=ByndHomeEngine, bed=row.model;
        lean(left,bed,-1);lean(right,bed,1);
        // Hair/ears retain their volume. Keep the head envelopes separate while
        // allowing the shoulders and the embracing arm to meet naturally.
        const a=bounds(left,bed,.75,1),b=bounds(right,bed,.72,1), overlap=a.max.x-b.min.x+.012;
        if(overlap>0) for(const [actor,side] of [[left,-1],[right,1]]) {
            const p=bed.worldToLocal(actor.root.position.clone());p.x+=side*Math.min(.12,overlap/2);actor.root.position.copy(bed.localToWorld(p));refresh(actor);
        }
        const side=left.arms.map((arm,i)=>({i,x:bed.worldToLocal(arm.getWorldPosition(new T.Vector3())).x})).sort((a,b)=>b.x-a.x)[0].i;
        const inner=right.arms.map(arm=>({arm,x:bed.worldToLocal(arm.getWorldPosition(new T.Vector3())).x})).sort((a,b)=>a.x-b.x)[0].arm;
        const local=bed.worldToLocal(inner.getWorldPosition(new T.Vector3()));local.x-=.08;local.y+=.10;local.z+=.08;
        const world=bed.localToWorld(local);
        const error=reach(left,side,world);
        left.sleepPair={placementId:row.placement.id,partner:right.who,arm:side,target:world.toArray(),reachError:error};
        right.sleepPair={placementId:row.placement.id,partner:left.who,arm:null};
        // The second sleeper rests an arm near their chest, beneath the quilt.
        refresh(right);
    }
    function signature(actors) { return actors.map(a=>[a.who,a.modelRoot?.uuid,a.level,a.startedAt].join(':')).join('|'); }
    function update(furniture, actors, allowed=true) {
        for(const row of furniture) {
            if(row.item?.type!=='bed'||row.item.positions.length<2)continue;
            const sleepers=actors.filter(a=>a.root.visible&&a.action==='Sleep'&&a.anchor?.placementId===row.placement.id&&a.visual==='model3d');
            if(!allowed||sleepers.length!==2) {
                actors.filter(a=>a.sleepPair?.placementId===row.placement.id).forEach(a=>{
                    if(a.action==='Sleep')H.CharacterModels.pose(a,'Sleep',a.anchor);else a.sleepPair=null;
                });row.model.userData.sleepPairKey=null;continue;
            }
            const key=signature(sleepers);
            if(row.model.userData.sleepPairKey===key&&sleepers.every(a=>a.sleepPair))continue;
            const bed=row.model,T=ByndHomeEngine;
            sleepers.sort((a,b)=>bed.worldToLocal(a.root.position.clone()).x-bed.worldToLocal(b.root.position.clone()).x);
            fit(row,...sleepers);row.model.userData.sleepPairKey=signature(sleepers);
        }
    }
    H.SleepPair={update,hand,bounds};
})(window.ByndHome3D);
