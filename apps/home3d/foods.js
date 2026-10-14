(function (H) {
    'use strict';
    const menus = {
        breakfast: { name: '暖暖早餐', foods: ['croissant', 'pancakes', 'egg-cooked', 'strawberry'], bite: '#e2ae62' },
        supper: { name: '家常晚餐', foods: ['meat-cooked', 'broccoli', 'carrot', 'salad', 'bowl-soup'], bite: '#c48f5f' },
        sushi: { name: '寿司与点心', foods: ['sushi-salmon', 'maki-vegetable', 'rice-ball', 'dim-sum'], bite: '#f0c4a6' },
        tea: { name: '甜甜下午茶', foods: ['cake', 'waffle', 'sandwich', 'strawberry'], bite: '#ddaa85' }
    };
    function selected(home, hour = new Date().getHours()) { return Object.hasOwn(menus, home?.mealId) ? home.mealId : hour < 11 ? 'breakfast' : hour < 17 ? 'tea' : 'supper'; }
    function supports(item) { return item.variant === 'dining' || item.type === 'stove' || item.variant === 'prep'; }
    async function create(item, id) {
        if (!Object.hasOwn(menus, id)) throw new Error('这个餐点暂时不可用。');
        const T = ByndHomeEngine, group = new T.Group(), templates = new Map(), menu = menus[id], [w, d] = item.footprint;
        group.name = 'meal-foods'; group.userData.mealId = id;
        function own(model) {
            model.traverse(node => {
                if (!node.isMesh) return;
                node.castShadow = node.receiveShadow = true; node.raycast = () => {};
                const ms = Array.isArray(node.material) ? node.material : [node.material];
                node.userData.ownedMaterials = ms; node.userData.ownedTextures = ms.flatMap(m => Object.values(m).filter(v => v?.isTexture));
            });
        }
        const dish = async (name, size, position, rotation = 0) => {
            if (!templates.has(name)) templates.set(name, new T.GLTFLoader().parseAsync(await H.Furniture.modelBuffer('food-' + name + '.glb'), '').then(gltf => gltf.scene));
            const source = await templates.get(name), bounds = new T.Box3().setFromObject(source), extent = bounds.getSize(new T.Vector3()), center = bounds.getCenter(new T.Vector3()), scale = size / Math.max(extent.x, extent.z, .001);
            const pivot = new T.Group(), model = source.clone(true); own(model); pivot.name = 'food-' + name; pivot.userData.food = name;
            model.scale.multiplyScalar(scale); model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale); pivot.add(model); pivot.position.fromArray(position); pivot.rotation.y = rotation; group.add(pivot);
        };
        try {
            if (item.variant === 'dining') {
                const h = item.height || .78;
                // Two components on each real plate, plus one shared centre dish.
                for (const [side, z] of [[-1, d * .29], [1, d * .29], [-1, -d * .29], [1, -d * .29]]) {
                    const x = side * w * .21, index = side < 0 ? 0 : 1;
                    await dish(id === 'supper' ? 'meat-cooked' : menu.foods[index], .155, [x - .025, h + .037, z], side * .2);
                    await dish(menu.foods[2], .07, [x + .074, h + .037, z + .035], -.3);
                    if (id === 'supper') await dish('broccoli', .055, [x + .074, h + .037, z - .037]);
                }
                if (id === 'supper') {
                    await dish('salad', .18, [0, h + .008, d * .22]);
                    await dish('bowl-soup', .17, [0, h + .008, -d * .22]);
                } else {
                    const material = new T.MeshStandardMaterial({ color: '#eee7d9', roughness: .38 });
                    const plate = new T.Mesh(new T.CylinderGeometry(.115, .105, .015, 24), material); plate.userData.ownedMaterial = material;
                    plate.position.set(0, h + .018, d * .22); plate.receiveShadow = true; plate.raycast = () => {}; group.add(plate);
                    for (const x of [-.045, .045]) await dish(menu.foods[menu.foods.length - 1], .07, [x, h + .026, d * .22], x * 4);
                }
            } else if (item.type === 'stove') {
                await dish(id === 'breakfast' ? 'egg-cooked' : 'meat-cooked', .15, [-w * .16, .968, d * .13]);
                await dish('broccoli', .055, [-w * .16 - .07, .968, d * .13 + .045]);
                await dish('carrot', .055, [-w * .16 + .055, .968, d * .13 - .045], .6);
            } else {
                const h = item.height || .88;
                for (let i = 0; i < 3; i++) await dish(['carrot', 'broccoli', 'rice-ball'][i], .09, [-w * .15 + (i - 1) * .105, h + .030, d * .30], i * .3);
            }
            return group;
        } catch (error) {
            H.Shapes.disposeGeometry(group);
            for (const template of templates.values()) { try { const model = await template; own(model); H.Shapes.disposeGeometry(model); } catch (_) {} }
            throw new Error('餐点模型没有加载成功，请重试。' + (error.message ? '（' + error.message + '）' : ''));
        }
    }
    function attach(root, group) {
        const previous = root.getObjectByName('meal-foods'); previous?.removeFromParent(); root.add(group);
        root.traverse(node => { if (node.userData.mealPlaceholder) node.visible = false; });
        return previous;
    }
    H.Foods = { menus, selected, supports, create, attach };
})(window.ByndHome3D);
