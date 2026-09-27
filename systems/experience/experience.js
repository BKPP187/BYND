// First discovery and character-scoped activity continuity.
(function () {
    'use strict';
    const keys = { discoveries: 'bynd_feature_discoveries_v1', traces: 'bynd_experiences_v1', positions: 'bynd_resume_positions_v1' };
    let activeApp = '', study = null, lastActivity = Date.now(), initialized = false;
    const read = (key, fallback) => { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); };
    const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    function warn(error) { console.warn('使用记录保存失败', error); window.showWechatToast?.('使用记录未能保存，请检查设备存储'); }
    function featureList() {
        return (window.ByndVersionLetter?.releasedNotes() || []).flatMap(release => (release.features || []).map(app => ({ app, id: `${app}@${release.version}` })));
    }
    function decorate() {
        const home = document.getElementById('home-screen');
        if (!home) return;
        let seen;
        try { seen = read(keys.discoveries, {}); } catch (error) { console.warn('新功能提示读取失败', error); return; }
        if (!seen || typeof seen !== 'object' || Array.isArray(seen)) { console.warn('新功能已读记录格式无效'); return; }
        const features = featureList();
        home.querySelectorAll('.app-item:not(.is-folder), .dock-item, .folder-grid > *').forEach(node => {
            const app = node.dataset.appId || node.dataset.layoutId?.replace(/^app-/, '') || /openApp\(['"]([^'"]+)/.exec(node.getAttribute('onclick') || '')?.[1];
            const badge = node.querySelector('.bynd-feature-dot');
            if (!features.some(feature => feature.app === app && !seen[feature.id])) { badge?.remove(); return; }
            if (badge) return;
            const mark = document.createElement('span'); mark.className = 'bynd-feature-dot'; mark.setAttribute('aria-label', '新功能，还未打开');
            (node.querySelector('.app-icon, .dock-icon-box') || node).appendChild(mark);
        });
    }
    function discover(app) {
        try {
            const seen = read(keys.discoveries, {});
            featureList().filter(item => item.app === app).forEach(item => { seen[item.id] = true; });
            write(keys.discoveries, seen); decorate(); return true;
        } catch (error) { warn(error); return false; }
    }
    function checkpoint(app, charId, detail) {
        if (!charId || charId === 'user') return false;
        try {
            const positions = read(keys.positions, {});
            positions[`${app}:${charId}`] = { app, charId: String(charId), detail: String(detail || '').slice(0, 220), at: Date.now() };
            write(keys.positions, Object.fromEntries(Object.entries(positions).sort((a,b) => b[1].at - a[1].at).slice(0, 100))); return true;
        } catch (error) { warn(error); return false; }
    }
    function record(app, charId, detail, seconds = 0) {
        if (!charId || !detail) return false;
        try {
            const rows = read(keys.traces, []);
            rows.push({ app, charId: String(charId), detail: String(detail).slice(0, 240), seconds: Math.max(0, Math.round(seconds)), at: Date.now() });
            write(keys.traces, rows.filter(row => row.at >= Date.now() - 7 * 86400000).slice(-100)); return true;
        } catch (error) { warn(error); return false; }
    }
    function tick() {
        if (!study) return;
        const at = Date.now(), elapsed = Math.max(0, Math.min(15000, at - study.tick));
        if (!document.hidden && activeApp === 'study' && at - lastActivity < 90000) study.ms += elapsed;
        study.tick = at;
    }
    function finishStudy() {
        if (!study) return;
        tick(); const session = study; study = null;
        const seconds = Math.floor(session.ms / 1000);
        if (seconds >= 1) record('study', session.charId, session.detail, seconds);
    }
    function startStudy() {
        finishStudy();
        const char = window.ByndStudy?.tutor?.(), target = window.ByndStudy?.primaryTarget?.();
        if (char) study = { charId: char.id, detail: `一起练习${target?.label || '语言'}`, ms: 0, tick: Date.now() };
        lastActivity = Date.now();
    }
    function opened(app) { finishStudy(); activeApp = app; discover(app); if (app === 'study') startStudy(); }
    function closed(app) { if (activeApp !== app) return; finishStudy(); activeApp = ''; }
    function prompt(char) {
        if (!char?.id || char.isGroupChat) return '';
        try {
            const resetAt = Number(char.chatConfig?.memoryResetAt || 0), now = Date.now(), today = new Date(now).toDateString();
            const rows = read(keys.traces, []).filter(row => row.charId === String(char.id) && row.at > resetAt && now - row.at < 7 * 86400000);
            const seconds = rows.filter(row => row.app === 'study' && new Date(row.at).toDateString() === today).reduce((sum, row) => sum + Number(row.seconds || 0), 0);
            const positions = Object.values(read(keys.positions, {})).filter(row => row.charId === String(char.id) && row.at > resetAt && now - row.at < 7 * 86400000).sort((a,b) => b.at - a.at).slice(0, 3);
            const lines = positions.map(row => `${new Date(row.at).toLocaleString('zh-CN')}：${row.detail}`);
            if (seconds >= 60) lines.unshift(`今天与你一起练习的前台活跃时间约 ${Math.floor(seconds / 60)} 分钟（闲置和后台不计入）。`);
            if (!lines.length) return '';
            return `【跨 App 的相处痕迹】\n${lines.join('\n')}\n这些是实际使用记录，不代表你知道用户其他私密内容。只在话题合适时自然提起，保持人设，不逐条汇报，不编造进度。`;
        } catch (error) { console.warn('相处痕迹读取失败', error); return ''; }
    }
    function init() {
        if (initialized) return; initialized = true;
        const home = document.getElementById('home-screen');
        if (home) {
            let queued = false;
            new MutationObserver(() => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; decorate(); }); }).observe(home, { childList: true, subtree: true });
            decorate();
        }
        document.addEventListener('pointerdown', () => { lastActivity = Date.now(); }, { passive: true });
        document.addEventListener('keydown', () => { lastActivity = Date.now(); });
        document.addEventListener('visibilitychange', () => { finishStudy(); if (!document.hidden && activeApp === 'study') startStudy(); });
        window.addEventListener('pagehide', finishStudy); setInterval(tick, 15000);
    }
    window.ByndExperience = { init, opened, closed, discover, decorate, checkpoint, record, prompt, startStudy, keys };
})();
