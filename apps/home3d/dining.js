(function (H) {
    'use strict';
    function mouth(actor) {
        const T = ByndHomeEngine, y = actor.modelId === 'bunny-blue-v1' ? .720 : .815, front = actor.modelId === 'bunny-blue-v1' ? .07 : .026;
        const point = new T.Vector3();
        if (actor.mealLips?.model !== actor.modelRoot) {
            const candidates = [];
            for (const mesh of actor.meshes) {
                const positions = mesh.geometry.attributes.position;
                for (const index of new Set(mesh.geometry.index.array)) {
                    const x = positions.getX(index) / actor.modelHeight, dy = positions.getY(index) / actor.modelHeight - y, z = positions.getZ(index) / actor.modelHeight;
                    if (Math.abs(x) < .025 && Math.abs(dy) < .012 && z > front) candidates.push({ mesh, index, score: x * x + dy * dy });
                }
            }
            candidates.sort((a, b) => a.score - b.score);
            actor.mealLips = { model: actor.modelRoot, samples: candidates.slice(0, 12) };
        }
        const chosen = actor.mealLips.samples, result = new T.Vector3();
        if (!chosen.length) return actor.head.localToWorld(new T.Vector3(0, actor.modelHeight * .085, actor.modelHeight * .12));
        for (const sample of chosen) { sample.mesh.getVertexPosition(sample.index, point); result.add(point.applyMatrix4(sample.mesh.matrixWorld)); }
        return result.divideScalar(chosen.length);
    }
    function props(actor) {
        const T = ByndHomeEngine, ceramic = new T.MeshStandardMaterial({ color: '#eee7d9', roughness: .35 }), tea = new T.MeshStandardMaterial({ color: '#775437', roughness: .28 });
        const cup = new T.Group(); cup.name = 'held-ceramic-mug';
        function part(root, geometry, position, material, name) { const mesh = new T.Mesh(geometry, material); mesh.name = name; mesh.position.fromArray(position); mesh.castShadow = true; mesh.userData.ownedMaterial = material; mesh.raycast = () => {}; root.add(mesh); return mesh; }
        part(cup, new T.LatheGeometry([[0, 0], [.036, 0], [.045, .015], [.049, .09], [.043, .09], [.039, .013], [0, .013]].map(v => new T.Vector2(...v)), 24), [-.064, -.045, 0], ceramic, 'mug-bowl');
        part(cup, new T.TorusGeometry(.025, .006, 8, 20), [0, 0, 0], ceramic, 'mug-handle');
        part(cup, new T.CylinderGeometry(.041, .041, .003, 24), [-.064, .027, 0], tea, 'mug-tea');
        H.Shapes.disposeGeometry(actor.cup); actor.body.add(cup); actor.cup = cup;
        const spoon = new T.Group(), metal = new T.MeshStandardMaterial({ color: '#b0b4ae', metalness: .55, roughness: .32 }); spoon.name = 'held-meal-spoon'; spoon.userData.length = .18;
        part(spoon, new T.CylinderGeometry(.005, .006, .14, 10), [0, .05, 0], metal, 'spoon-handle');
        const bowl = part(spoon, new T.SphereGeometry(1, 16, 8), [0, .152, 0], metal, 'spoon-bowl'); bowl.scale.set(.019, .028, .006);
        const meal = H.Foods?.menus[H.Foods.selected(H.State?.home?.())];
        const bite = part(spoon, new T.SphereGeometry(1, 12, 8), [0, .151, .012], new T.MeshStandardMaterial({ color: meal?.bite || '#d8a260', roughness: .8 }), 'spoon-food'); bite.scale.set(.012, .013, .010);
        actor.body.add(spoon); actor.eatTool = spoon; spoon.visible = cup.visible = false;
    }
    function prepare(actor, feeding) {
        actor.diningCycle = null; if (actor.eatTool) actor.eatTool.visible = false;
        if (!['Eat', 'Drink'].includes(actor.action)) return;
        if (!actor.eatTool) props(actor);
        actor.cup.visible = actor.action === 'Drink'; actor.eatTool.visible = actor.action === 'Eat';
        const T = ByndHomeEngine, hands = H.Cooking.hands, rotation = actor.root.getWorldQuaternion(new T.Quaternion());
        actor.root.updateMatrixWorld(true); actor.skeleton.update();
        const localVector = v => new T.Vector3(...v).applyQuaternion(rotation);
        // Sample the reviewed lip region on the actual skinned face. The female
        // head-bone origin alone placed the cup down at her neckline.
        const mouthPoint = feeding?.mouthPoint || mouth(actor).add(localVector([0, .003, .018]));
        const eating = actor.action === 'Eat';
        const plate = actor.anchor?.meal ? new T.Vector3(...actor.anchor.meal.plate) : mouthPoint.clone().add(localVector([.12, -.23, .06]));
        const start = eating ? plate : mouthPoint.clone().add(localVector([.14, -.23, .04]));
        const spoonVector = feeding ? actor.arms.map(arm => arm.getWorldPosition(new T.Vector3())).reduce((a, b) => a.distanceTo(mouthPoint) < b.distanceTo(mouthPoint) ? a : b).sub(mouthPoint).normalize().multiplyScalar(.18) : localVector([.08, .09, -.134]);
        const desired = feeding ? mouthPoint.clone().add(spoonVector) : eating ? plate.clone().add(spoonVector) : start;
        const side = actor.arms.map((arm, i) => ({ i, distance: arm.getWorldPosition(new T.Vector3()).distanceTo(desired) })).sort((a, b) => a.distance - b.distance)[0].i;
        const shoulder = actor.arms[side].getWorldPosition(new T.Vector3());
        const joints = actor.arms.flatMap(arm => [arm, arm.children[0]]), base = joints.map(joint => joint.quaternion.clone()), frames = [];
        for (let i = 0; i < 12; i++) {
            joints.forEach((joint, j) => joint.quaternion.copy(base[j])); actor.root.updateMatrixWorld(true);
            const lift = Math.pow(.5 - .5 * Math.cos(i / 12 * Math.PI * 2), 2);
            const tip = start.clone().lerp(mouthPoint, lift);
            const vector = eating ? shoulder.clone().sub(tip).normalize().multiplyScalar(.18) : spoonVector;
            const grip = eating ? tip.clone().add(vector) : tip.clone().add(localVector([.064 * lift, -.045 * lift, .05 * lift]));
            const support = eating ? plate.clone().add(localVector([-.16, .08, -.14])) : grip.clone().add(localVector([-.10, -.02, 0]));
            const error = hands.reach(actor, side, grip), supportError = hands.reach(actor, 1 - side, support);
            frames.push({ tip, lift, error, supportError, rotations: joints.map(joint => joint.quaternion.clone()) });
        }
        actor.diningCycle = { joints, frames, side, eating, partner: feeding?.partner, maxError: Math.max(...frames.map(f => f.error)) };
        animate(actor, actor.startedAt, true);
    }
    function animate(actor, time, reduced, paired = false) {
        const cycle = actor.diningCycle;
        if (cycle?.partner && !paired) return;
        if (!cycle || actor.path.length || !['Eat', 'Drink'].includes(actor.action)) { if (actor.eatTool) actor.eatTool.visible = false; if (!['Eat', 'Drink'].includes(actor.action)) actor.cup.visible = false; return; }
        const T = ByndHomeEngine, phase = reduced ? 0 : ((time - actor.startedAt) / (cycle.duration || 5200) % 1 + 1) % 1 * cycle.frames.length;
        const index = Math.floor(phase), next = (index + 1) % cycle.frames.length, blend = phase - index;
        cycle.joints.forEach((joint, j) => joint.quaternion.copy(cycle.frames[index].rotations[j]).slerp(cycle.frames[next].rotations[j], blend));
        if (cycle.partner) {
            const a = cycle.frames[index], b = cycle.frames[next];
            H.Expressions.meal(actor, reduced ? 0 : a.open * (1 - blend) + b.open * blend, reduced ? 0 : a.smile * (1 - blend) + b.smile * blend, reduced ? 0 : a.blink * (1 - blend) + b.blink * blend);
            actor.mealPair.approach = a.approach * (1 - blend) + b.approach * blend;
        }
        const grip = H.Cooking.hands.sample(actor, cycle.side), tip = cycle.frames[index].tip.clone().lerp(cycle.frames[next].tip, blend);
        const lift = cycle.frames[index].lift * (1 - blend) + cycle.frames[next].lift * blend;
        const prop = cycle.eating ? actor.eatTool : actor.cup;
        prop.visible = true; prop.position.copy(actor.body.worldToLocal(grip.clone()));
        const inverse = actor.body.getWorldQuaternion(new T.Quaternion()).invert();
        if (cycle.eating) {
            prop.getObjectByName('spoon-food').visible = cycle.partner ? !!cycle.frames[index].food && lift < .995 : lift > .015 && lift < .98 && phase < cycle.frames.length / 2;
            const direction = tip.clone().sub(grip).normalize(), normal = new T.Vector3(0, 1, 0).addScaledVector(direction, -direction.y).normalize();
            prop.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3().crossVectors(direction, normal).applyQuaternion(inverse), direction.applyQuaternion(inverse), normal.applyQuaternion(inverse)));
        } else prop.quaternion.copy(inverse).multiply(actor.root.getWorldQuaternion(new T.Quaternion()));
        cycle.tip = tip; cycle.gripError = H.Cooking.hands.sample(actor, cycle.side).distanceTo(prop.getWorldPosition(new T.Vector3()));
    }
    function ease(a, b, value) { const t = Math.max(0, Math.min(1, (value - a) / (b - a))); return t * t * (3 - 2 * t); }
    // Both participants share a timeline. Torso/head rotations and hand IK are
    // authored once per action/LOD; the mobile render loop only interpolates.
    // The pelvis and every bone translation remain on the actual chair anchor.
    function preparePair(actors, table, time) {
        const T = ByndHomeEngine, hands = H.Cooking.hands, count = 24;
        const data = actors.map((actor, i) => {
            H.CharacterModels.pose(actor, 'Eat', actor.anchor);
            const spine = actor.hips.children.find(b => !actor.legs.includes(b));
            const joints = [spine, actor.head, ...actor.arms.flatMap(a => [a, a.children[0]])].filter(Boolean);
            const direction = actors[1 - i].root.position.clone().sub(actor.root.position).applyQuaternion(actor.root.getWorldQuaternion(new T.Quaternion()).invert());
            const side = actor.arms.map((arm, side) => ({ side, distance: arm.getWorldPosition(new T.Vector3()).distanceTo(actors[1 - i].root.position) })).sort((a, b) => a.distance - b.distance)[0].side;
            return { spine, joints, base: joints.map(b => b.quaternion.clone()), sign: Math.sign(direction.x), side, frames: [] };
        });
        for (let giver = 0; giver < 2; giver++) for (let step = 0; step < count; step++) {
            const p = step / count;
            // Look first, approach before lifting, pause to accept, withdraw the
            // empty spoon, then release the lean. No reaching across a fixed gap.
            const look = ease(0, .12, p) * (1 - ease(.84, 1, p));
            const approach = ease(.05, .24, p) * (1 - ease(.72, .97, p));
            const lift = ease(.25, .50, p) * (1 - ease(.59, .77, p));
            const open = ease(.36, .47, p) * (1 - ease(.54, .65, p));
            const smile = ease(.59, .74, p) * (1 - ease(.86, 1, p));
            actors.forEach((actor, i) => {
                const d = data[i]; d.joints.forEach((joint, j) => joint.quaternion.copy(d.base[j]));
                d.spine.rotation.z = -d.sign * (i === giver ? .44 : .48) * approach;
                d.spine.rotation.y = d.sign * .28 * look;
                actor.root.updateMatrixWorld(true); actor.skeleton.update();
            });
            const gazeTargets = actors.map(a => mouth(a));
            actors.forEach((actor, i) => {
                const direction = gazeTargets[1 - i].clone().sub(gazeTargets[i]).normalize();
                const facing = new T.Quaternion().setFromEuler(new T.Euler(-Math.asin(direction.y), Math.atan2(direction.x, direction.z), 0, 'YXZ'));
                const local = actor.head.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(facing);
                actor.head.quaternion.copy(data[i].base[1]).slerp(local, look);
                actor.root.updateMatrixWorld(true); actor.skeleton.update();
            });
            const lips = actors.map(a => mouth(a));
            actors.forEach((actor, i) => {
                const d = data[i], plate = new T.Vector3(...actor.anchor.meal.plate), rotation = actor.root.getWorldQuaternion(new T.Quaternion());
                const target = lips[1 - i].clone().add(new T.Vector3(0, 0, .012).applyQuaternion(actors[1 - i].head.getWorldQuaternion(new T.Quaternion())));
                const pickup = plate.clone().add(new T.Vector3(d.sign * .065, 0, -.055).applyQuaternion(rotation));
                const tip = pickup.lerp(target, i === giver ? lift : 0);
                // Keep the spoon above the table until it reaches the receiver.
                tip.y += i === giver ? Math.sin(lift * Math.PI) * .06 : 0;
                const shoulder = actor.arms[d.side].getWorldPosition(new T.Vector3());
                const grip = i === giver ? tip.clone().add(shoulder.sub(tip).normalize().multiplyScalar(.18)) : actor.hips.getWorldPosition(new T.Vector3()).add(new T.Vector3(d.sign * .15, .12, .23).applyQuaternion(rotation));
                if (i !== giver) tip.copy(grip).add(new T.Vector3(0, .18, 0));
                const support = actor.hips.getWorldPosition(new T.Vector3()).add(new T.Vector3(-d.sign * .15, .12, .23).applyQuaternion(rotation));
                const error = hands.reach(actor, d.side, grip), supportError = hands.reach(actor, 1 - d.side, support);
                const blinkPhase = p - (i === giver ? .025 : 0), blink = ease(.66, .70, blinkPhase) * (1 - ease(.70, .75, blinkPhase));
                d.frames.push({ tip, lift, approach, open: i === giver ? 0 : open, smile: smile * (i === giver ? .65 : 1), blink, food: i === giver && p >= .25 && p < .50, error, supportError, rotations: d.joints.map(j => j.quaternion.clone()) });
            });
        }
        actors.forEach((actor, i) => {
            const d = data[i];
            actor.diningCycle = { joints: d.joints, frames: d.frames, side: d.side, eating: true, duration: 10400, partner: actors[1 - i].who, maxError: Math.max(...d.frames.map(f => f.error)), maxSupportError: Math.max(...d.frames.map(f => f.supportError)) };
            actor.mealPair = { table, partner: actors[1 - i].who, index: i, startedAt: time, feeding: false, approach: 0 };
        });
    }
    function signature(actors) { return actors.map(a => [a.who, a.modelRoot.uuid, a.startedAt, a.anchor.seatId].join(':')).join('|'); }
    function update(furniture, actors, time, allowed = true, reduced = false) {
        for (const row of furniture.filter(r => r.item.variant === 'dining')) {
            const diners = actors.filter(a => a.visual === 'model3d' && a.root.visible && !a.path.length && a.action === 'Eat' && a.anchor?.placementId === row.placement.id && a.anchor.seatId);
            const T = ByndHomeEngine;
            const distance = diners.length === 2 ? diners[0].root.position.distanceTo(diners[1].root.position) : Infinity;
            const eligible = allowed && diners.length === 2 && diners[0].anchor.seatId !== diners[1].anchor.seatId && distance >= .62 && distance < .9 && Math.cos(diners[0].root.rotation.y - diners[1].root.rotation.y) > .85;
            if (!eligible) {
                actors.filter(a => a.mealPair?.table === row.placement.id).forEach(a => { a.mealPair = null; if (a.action === 'Eat') H.CharacterModels.pose(a, 'Eat', a.anchor); });
                row.model.userData.mealPairKey = null; continue;
            }
            diners.sort((a, b) => a.who.localeCompare(b.who));
            let key = signature(diners);
            if (row.model.userData.mealPairKey !== key) {
                preparePair(diners, row.placement.id, time);
                // Unreachable custom rigs/layouts retain supported solo eating.
                if (diners.some(a => Math.max(a.diningCycle.maxError, a.diningCycle.maxSupportError) > .018)) {
                    row.model.userData.mealReachErrors = diners.map(a => a.diningCycle.maxError);
                    diners.forEach(a => { a.mealPair = null; H.CharacterModels.pose(a, 'Eat', a.anchor); });
                }
                key = signature(diners); row.model.userData.mealPairKey = key;
            }
            diners.forEach(actor => {
                if (!actor.mealPair) return;
                const pair = actor.mealPair, elapsed = Math.max(0, time - pair.startedAt), index = Math.floor(elapsed / 5200) % 2;
                pair.feeding = !reduced && index === pair.index;
                animate(actor, actor.startedAt + elapsed, reduced, true);
                actor.eatTool.visible = pair.feeding;
            });
        }
    }
    H.Dining = { prepare, animate, mouth, update };
})(window.ByndHome3D);
