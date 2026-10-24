/* The desktop loads only this tiny entry point. Renderer, catalogs and room assets are lazy. */
(function () {
    'use strict';
    const H = window.ByndHome3D = { runtime: null, session: 0, open: null, close: null };
    // Chat and single-actor Living World can read a saved home without loading WebGL.
    window.getByndHomeLifePrompt = char => {
        if (H.Living) return H.Living.prompt(char);
        if (!char?.id) return '';
        try {
            const home = JSON.parse(localStorage.getItem('bynd_home3d_v1') || '{}').homes?.[String(char.id)];
            if (!home) return '';
            return '【小屋生活】这是这个角色私密小屋的本地存档，不是公开消息，不得让其他角色自动知道。lastActivity只是计划；execution是上次执行回执，blocked/cancelled不能说成完成。离开期间与未显示楼层的记录属于本地生活推演，不要声称做了现实中的事。' + JSON.stringify({ relationship: home.relationship, lastActivity: home.activity, execution: home.executions?.char || null, preferences: home.preferences, updatedAt: home.lastLifeAt, needs: home.needs, recent: (home.moments || []).slice(-5) }).slice(0, 2400);
        } catch (_) { return ''; }
    };
    let pending = null;
    const loaded = new Set(), loading = new Map();
    function script(url) {
        if (loaded.has(url)) return Promise.resolve();
        if (loading.has(url)) return loading.get(url);
        const request = new Promise((resolve, reject) => {
            const node = document.createElement('script');
            const version = document.querySelector('script[src*="home3d/home3d.js"]')?.src.split('?')[1] || '';
            node.src = url + (version ? '?' + version : ''); node.async = false;
            node.onload = () => { loaded.add(url); loading.delete(url); resolve(); };
            node.onerror = () => { loading.delete(url); node.remove(); reject(new Error('小屋组件没能加载，请检查本地资源或网络后重试。')); };
            document.head.appendChild(node);
        });
        loading.set(url, request); return request;
    }
    H.loadScript = script;
    async function ensure() {
        if (pending) return pending;
        pending = (async () => {
            await Promise.all(['assets/vendor/home3d/engine.js', 'apps/home3d/data/catalogs.js', 'assets/home3d/doors/geometry.js'].map(script));
            // async=false preserves registration order while requests overlap.
            // Multi-megabyte portrait mirrors are only needed by the 2D renderer.
            await Promise.all(['render-quality', 'room-camera', 'render-assets', 'materials', 'daylight', 'interiors', 'atmosphere', 'bedding', 'hygiene', 'cooking', 'dining', 'foods', 'television', 'furniture-visuals', 'furniture', 'garden', 'furniture-previews', 'rooms', 'villa', 'architecture', 'floor-view', 'expressions', 'character-models', 'sleep-pair', 'characters', 'animation', 'state', 'bridge', 'portraits', 'build', 'life-context', 'living', 'actions', 'scene', 'interactions', 'icons', 'ui', 'build-ui'].map(name => script('apps/home3d/' + name + '.js')));
        })().catch(error => { pending = null; throw error; });
        return pending;
    }
    H.ensure = ensure;
    // The illustrated (2.5D) home shares saves, planner and receipts with 3D but never loads WebGL.
    let pending25 = null;
    function ensure25() {
        if (pending25) return pending25;
        pending25 = (async () => {
            await script('apps/home3d/data/catalogs.js');
            await Promise.all(['materials', 'interiors', 'bedding', 'hygiene', 'cooking', 'dining', 'foods', 'furniture-visuals', 'furniture', 'garden', 'rooms', 'villa', 'expressions', 'character-models', 'characters', 'animation', 'state', 'bridge', 'build', 'life-context', 'living', 'actions', 'interactions', 'icons'].map(name => script('apps/home3d/' + name + '.js')));
            await Promise.all(['illustrated/art', 'illustrated/sprites', 'illustrated/room', 'illustrated/ui'].map(name => script('apps/home3d/' + name + '.js')));
        })().catch(error => { pending25 = null; throw error; });
        return pending25;
    }
    H.ensure25 = ensure25;
    const preferredView = () => { try { return localStorage.getItem('bynd_home_view_v1') === '3d' ? '3d' : 'illustrated'; } catch (_) { return 'illustrated'; } };
    H.open = async () => {
        const session = ++H.session, root = document.getElementById('home3d-root');
        if (!root) return;
        const illustrated = preferredView() === 'illustrated';
        root.className = '';
        root.innerHTML = '<div class="home3d-loading"><i class="ri-home-heart-line"></i><strong>把家的灯点亮…</strong><span>' + (illustrated ? '正在准备插画小屋' : '小屋第一次打开会准备 3D 资源') + '</span><button type="button" data-home-back>返回桌面</button></div>';
        root.querySelector('[data-home-back]').onclick = () => window.closeApp('home3d');
        try {
            await (illustrated ? ensure25() : ensure());
            if (window._wechatCharactersLoadPromise) await window._wechatCharactersLoadPromise;
            if (H.session !== session) return;
            await (illustrated ? H.UI25.open(root, session) : H.UI.open(root, session));
        } catch (error) {
            if (H.session !== session) return;
            root.replaceChildren();
            const box = document.createElement('div'); box.className = 'home3d-loading';
            const text = document.createElement('p'); text.textContent = error.message || '小屋暂时没能打开。'; box.appendChild(text);
            for (const [label, run] of [['再试一次', H.open], ['返回桌面', () => window.closeApp('home3d')]]) { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.onclick = run; box.appendChild(button); }
            root.appendChild(box);
        }
    };
    H.close = () => { H.session++; H.UI25?.close(); H.UI?.close(); H.runtime?.dispose(); H.runtime = null; };
})( );
