/* The desktop loads only this tiny entry point. Renderer, catalogs and room assets are lazy. */
(function () {
    'use strict';
    const H = window.ByndHome3D = Object.assign({ runtime: null, session: 0, open: null, close: null }, window.ByndHome3D || {});
    // One compact, natural-language view of the home for chat (≤600 chars):
    // what Ta is doing now, what you two did today, one small thing from Ta's day.
    // No furniture list, raw need numbers or echoed chat text.
    const ago = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m < 2 ? '刚刚' : m < 60 ? m + '分钟前' : Math.round(m / 60) + '小时前'; };
    const clock = (minute) => { const h = Math.floor(minute / 60) % 24, m = minute % 60; return (h < 6 ? '凌晨' : h < 12 ? '上午' : h < 14 ? '中午' : h < 18 ? '下午' : '晚上') + (h % 12 || 12) + '点' + (m ? (m < 10 ? '0' : '') + m : ''); };
    H.lifeBrief = (home, now = Date.now()) => {
        if (!home) return '';
        const d = new Date(now), date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), minute = d.getHours() * 60 + d.getMinutes();
        const parts = ['【小屋生活】这是角色自己家里的日常，按人设自然地提起或不提；记录只代表小屋里的模拟生活，不要说成现实里做过的事。'];
        if (home.relationship) parts.push('关系：' + home.relationship + '。');
        const steps = home.schedule?.date === date ? home.schedule.steps || [] : [];
        const step = steps.find(s => s[0] <= minute && minute < s[1]);
        if (step) {
            parts.push('现在：' + (step[3] ? '在' + step[3] : '在家') + (step[4] || '') + '（从' + clock(step[0]) + '开始）。');
            const next = steps.find(s => s[0] >= step[1] && s[4] !== step[4] && !/走动|伸伸|歇/.test(s[4] || ''));
            if (next) parts.push('接下来大约' + clock(next[0]) + (next[4] || '') + '。');
        } else if (home.activity?.reason) parts.push('现在：' + home.activity.reason + '。');
        const receipt = home.executions?.char;
        if (receipt && ['blocked', 'cancelled'].includes(receipt.phase) && now - (receipt.at || 0) < 6 * 3600000) parts.push('刚才想' + (receipt.action ? (H.Living?.labels?.[receipt.action] || receipt.action) : '做点事') + '，没做成' + (receipt.reason ? '（' + String(receipt.reason).slice(0, 30) + '）' : '') + '，不要说成已经做了。');
        const shared = (home.moments || []).filter(m => m && m.source !== 'simulation' && now - m.at < 86400000 && m.at <= now).slice(-4);
        if (shared.length) parts.push('今天和你一起：' + shared.map(m => ago(now - m.at) + String(m.text || '').slice(0, 30)).join('；') + '。');
        const own = home.awaySummary?.until && now - home.awaySummary.until < 86400000 ? home.awaySummary.highlights?.[0] || home.awaySummary.text : (home.moments || []).filter(m => m?.source === 'simulation' && now - m.at < 86400000).slice(-1)[0]?.text;
        if (own) parts.push('Ta今天的一件小事：' + String(own).slice(0, 60) + '。');
        let text = parts.join('');
        if (text.length > 600) text = text.slice(0, 599) + '…';
        return text;
    };
    // Chat and single-actor Living World can read a saved home without loading WebGL.
    window.getByndHomeLifePrompt = char => {
        if (H.Living) return H.Living.prompt(char);
        if (!char?.id) return '';
        try {
            const home = JSON.parse(localStorage.getItem('bynd_home3d_v1') || '{}').homes?.[String(char.id)];
            if (!home) return '';
            return H.lifeBrief(home, Date.now());
        } catch (_) { return ''; }
    };
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
            await script('assets/home3d/doors/geometry.js');
            await script('assets/home3d/characters/initial-portraits.js');
            await script('assets/home3d/characters/initial-sleep-portraits.js');
            await script('assets/home3d/characters/initial-model-previews.js');
            for (const name of ['render-quality', 'room-camera', 'render-assets', 'materials', 'daylight', 'interiors', 'bedding', 'hygiene', 'cooking', 'dining', 'foods', 'television', 'furniture-visuals', 'furniture', 'garden', 'furniture-previews', 'rooms', 'villa', 'architecture', 'floor-view', 'expressions', 'character-models', 'sleep-pair', 'characters', 'animation', 'state', 'bridge', 'portraits', 'build', 'life-context', 'living', 'actions', 'scene', 'interactions', 'icons', 'ui', 'build-ui']) await script('apps/home3d/' + name + '.js');
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
