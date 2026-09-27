/* The desktop loads only this tiny entry point. Renderer, catalogs and room assets are lazy. */
(function () {
    'use strict';
    const H = window.ByndHome3D = { runtime: null, session: 0, open: null, close: null };
    let pending = null;
    const loaded = new Set();
    function script(url) {
        if (loaded.has(url)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const node = document.createElement('script');
            const version = document.querySelector('script[src*="home3d/home3d.js"]')?.src.split('?')[1] || '';
            node.src = url + (version ? '?' + version : ''); node.async = false;
            node.onload = () => { loaded.add(url); resolve(); };
            node.onerror = () => { node.remove(); reject(new Error('小屋组件没能加载，请检查本地资源或网络后重试。')); };
            document.head.appendChild(node);
        });
    }
    async function ensure() {
        if (pending) return pending;
        pending = (async () => {
            await script('assets/vendor/home3d/engine.js');
            await script('apps/home3d/data/catalogs.js');
            await script('assets/home3d/characters/initial-portraits.js');
            for (const name of ['materials', 'furniture', 'rooms', 'characters', 'animation', 'state', 'bridge', 'portraits', 'living', 'scene', 'interactions', 'icons', 'ui']) await script('apps/home3d/' + name + '.js');
        })().catch(error => { pending = null; throw error; });
        return pending;
    }
    H.ensure = ensure;
    H.open = async () => {
        const session = ++H.session, root = document.getElementById('home3d-root');
        if (!root) return;
        root.innerHTML = '<div class="home3d-loading"><i class="ri-home-heart-line"></i><strong>把家的灯点亮…</strong><span>小屋第一次打开会准备 3D 资源</span><button type="button" data-home-back>返回桌面</button></div>';
        root.querySelector('[data-home-back]').onclick = () => window.closeApp('home3d');
        try {
            await ensure();
            if (window._wechatCharactersLoadPromise) await window._wechatCharactersLoadPromise;
            if (H.session !== session) return;
            await H.UI.open(root, session);
        } catch (error) {
            if (H.session !== session) return;
            root.replaceChildren();
            const box = document.createElement('div'); box.className = 'home3d-loading';
            const text = document.createElement('p'); text.textContent = error.message || '小屋暂时没能打开。'; box.appendChild(text);
            for (const [label, run] of [['再试一次', H.open], ['返回桌面', () => window.closeApp('home3d')]]) { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.onclick = run; box.appendChild(button); }
            root.appendChild(box);
        }
    };
    H.close = () => { H.session++; H.UI?.close(); H.runtime?.dispose(); H.runtime = null; };
})( );
