(function (H) {
    'use strict';
    // Shared local coordinates keep cookware, hands and editable stations aligned.
    function station(item) {
        const [w, d] = item.footprint, y = item.type === 'stove' ? .88 : item.height || .88;
        if (item.type === 'stove') return { mode: 'stir', tip: [-w * .16, y + .10, d * .13], vector: [.19, .15, .23], hold: [-w * .16, y + .115, d * .13 + .25] };
        if (item.variant === 'prep') return { mode: 'chop', tip: [-w * .15, y + .055, d * .30], vector: [.03, .19, .14], hold: [-w * .15 - .11, y + .09, d * .30 + .13] };
        return null;
    }
    function hand(actor, side) {
        const T = ByndHomeEngine, point = new T.Vector3(), sum = new T.Vector3(), samples = actor.grips[side];
        actor.root.updateMatrixWorld(true); actor.skeleton.update();
        if (!samples.length) return actor.arms[side].children[0].localToWorld(new T.Vector3(0, -actor.modelHeight * .17, .025));
        for (const sample of samples) { sample.mesh.getVertexPosition(sample.index, point); sum.add(point.applyMatrix4(sample.mesh.matrixWorld)); }
        return sum.divideScalar(samples.length);
    }
    function reach(actor, side, target) {
        const T = ByndHomeEngine, upper = actor.arms[side];
        for (let pass = 0; pass < 12; pass++) for (const joint of [upper.children[0], upper]) {
            const origin = joint.getWorldPosition(new T.Vector3()), end = hand(actor, side).sub(origin), goal = target.clone().sub(origin);
            if (end.lengthSq() < 1e-8 || goal.lengthSq() < 1e-8) continue;
            const inverse = joint.parent.getWorldQuaternion(new T.Quaternion()).invert();
            end.applyQuaternion(inverse).normalize(); goal.applyQuaternion(inverse).normalize();
            joint.quaternion.premultiply(new T.Quaternion().slerp(new T.Quaternion().setFromUnitVectors(end, goal), .55)).normalize();
            actor.root.updateMatrixWorld(true); actor.skeleton.update();
        }
        return hand(actor, side).distanceTo(target);
    }
    function tool(actor, mode, length) {
        const T = ByndHomeEngine, root = new T.Group(), wood = new T.MeshStandardMaterial({ color: '#b58e64', roughness: .82 }), metal = new T.MeshStandardMaterial({ color: '#b7b7ab', roughness: .38, metalness: .55 });
        root.name = 'held-cooking-tool'; root.userData.length = length; root.userData.mode = mode;
        function part(geometry, y, material) { const mesh = new T.Mesh(geometry, material); mesh.position.y = y; mesh.castShadow = true; mesh.userData.ownedMaterial = material; mesh.raycast = () => {}; root.add(mesh); }
        part(new T.CylinderGeometry(.012, .014, length - .05, 12), (length - .05) / 2 - .028, wood);
        part(new T.RoundedBoxGeometry(mode === 'stir' ? .075 : .055, .09, .009, 1, .004), length - .045, mode === 'stir' ? wood : metal);
        root.visible = false; actor.body.add(root); return root;
    }
    function prepare(actor) {
        actor.cookCycle = null;
        if (actor.cookTool) actor.cookTool.visible = false;
        if (actor.action !== 'Cook' || !actor.anchor?.cooking || actor.visual !== 'model3d') return;
        const T = ByndHomeEngine, data = actor.anchor.cooking, vector = new T.Vector3(...data.vector), length = vector.length();
        if (!actor.cookTool || actor.cookTool.userData.mode !== data.mode || Math.abs(actor.cookTool.userData.length - length) > .001) {
            if (actor.cookTool) H.Shapes.disposeGeometry(actor.cookTool);
            actor.cookTool = tool(actor, data.mode, length);
        }
        actor.cookTool.visible = true;
        // A slight forward stance brings the counter within reach without scaling
        // the avatar or extending bone lengths. CCD runs only at pose/LOD changes.
        actor.body.position.z = .10; actor.head.rotation.x = .16; actor.root.updateMatrixWorld(true);
        const center = new T.Vector3(...data.tip), hold = new T.Vector3(...data.hold), grip = center.clone().add(vector);
        const side = actor.arms.map((arm, i) => ({ i, distance: arm.getWorldPosition(new T.Vector3()).distanceTo(grip) })).sort((a, b) => a.distance - b.distance)[0].i;
        const joints = actor.arms.flatMap(arm => [arm, arm.children[0]]), base = joints.map(joint => joint.quaternion.clone()), frames = [];
        for (let i = 0; i < 8; i++) {
            joints.forEach((joint, j) => joint.quaternion.copy(base[j])); actor.root.updateMatrixWorld(true);
            const angle = i / 8 * Math.PI * 2, tip = center.clone();
            if (data.mode === 'stir') { tip.x += Math.cos(angle) * .035 * Math.cos(data.rotation); tip.z -= Math.cos(angle) * .035 * Math.sin(data.rotation); tip.x += Math.sin(angle) * .025 * Math.sin(data.rotation); tip.z += Math.sin(angle) * .025 * Math.cos(data.rotation); }
            else tip.y += Math.max(0, Math.sin(angle)) * .055;
            const error = reach(actor, side, tip.clone().add(vector)), holdError = reach(actor, 1 - side, hold);
            frames.push({ tip, error, holdError, rotations: joints.map(joint => joint.quaternion.clone()) });
        }
        actor.cookCycle = { joints, frames, side, mode: data.mode, vector, maxError: Math.max(...frames.map(frame => frame.error)), maxHoldError: Math.max(...frames.map(frame => frame.holdError)) };
        animate(actor, actor.startedAt, true);
    }
    function animate(actor, time, reduced) {
        const cycle = actor.cookCycle;
        if (actor.action !== 'Cook' || !cycle || actor.path.length) { if (actor.cookTool) actor.cookTool.visible = false; return; }
        const phase = reduced ? 0 : ((time - actor.startedAt) / 2600 % 1 + 1) % 1 * cycle.frames.length, index = Math.floor(phase), next = (index + 1) % cycle.frames.length, blend = phase - index;
        cycle.joints.forEach((joint, j) => joint.quaternion.copy(cycle.frames[index].rotations[j]).slerp(cycle.frames[next].rotations[j], blend));
        actor.root.updateMatrixWorld(true); actor.skeleton.update();
        const T = ByndHomeEngine, grip = hand(actor, cycle.side), tip = cycle.frames[index].tip.clone().lerp(cycle.frames[next].tip, blend);
        actor.cookTool.visible = true; actor.cookTool.position.copy(actor.body.worldToLocal(grip.clone()));
        const direction = tip.clone().sub(grip).normalize().applyQuaternion(actor.body.getWorldQuaternion(new T.Quaternion()).invert());
        actor.cookTool.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction);
        cycle.tip = tip; cycle.tipError = grip.distanceTo(tip) - actor.cookTool.userData.length;
    }
    function steam(item) {
        const T = ByndHomeEngine, data = station(item), p = data.tip;
        const geometry = new T.TubeGeometry(new T.CatmullRomCurve3([[0, 0, 0], [.02, .06, 0], [-.018, .12, .005], [.02, .18, -.006]].map(v => new T.Vector3(...v))), 12, .005, 5, false);
        const material = new T.MeshBasicMaterial({ color: '#fff9e9', transparent: true, opacity: .26, depthWrite: false });
        const root = new T.InstancedMesh(geometry, material, 3); root.name = 'cooking-steam'; root.position.set(p[0], p[1], p[2]); root.visible = false;
        root.userData.effect = 'steam'; root.userData.ownedMaterial = material; root.raycast = () => {}; return root;
    }
    function update(rows, actors, time, profile, reduced) {
        const T = ByndHomeEngine, matrix = new T.Object3D();
        for (const row of rows) {
            const mist = row.model.getObjectByName('cooking-steam'); if (!mist) continue;
            const active = actors.some(actor => actor.root.visible && actor.action === 'Cook' && actor.anchor?.placementId === row.placement.id && !actor.path.length);
            mist.visible = active && !reduced && profile.particles > 0;
            if (!mist.visible) continue;
            mist.count = Math.min(3, profile.particles);
            for (let i = 0; i < mist.count; i++) { const progress = (time * .00025 + i / 3) % 1; matrix.position.set((i - 1) * .06, progress * .16, Math.sin(time * .001 + i) * .015); matrix.scale.setScalar(.65 + progress * .6); matrix.rotation.y = i * 2; matrix.updateMatrix(); mist.setMatrixAt(i, matrix.matrix); }
            mist.instanceMatrix.needsUpdate = true;
        }
    }
    H.Cooking = { station, hand, prepare, animate, steam, update };
})(window.ByndHome3D);
