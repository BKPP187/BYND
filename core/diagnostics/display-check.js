// On-device measurements only. No chat, credentials, wallpaper URLs or uploads.
(function () {
    'use strict';
    let panel, report;
    const requested = () => /(?:\?|&)display-check=1(?:&|$)/.test(window.location?.search || '');
    const number = value => {
        const n = Number(value);
        return Number.isFinite(n) && Math.abs(n) <= 10000 ? Math.round(n * 100) / 100 : null;
    };
    function rect(node) {
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return { top: number(r.top), left: number(r.left), width: number(r.width), height: number(r.height), bottom: number(r.bottom) };
    }
    function snapshot() {
        const root = document.documentElement;
        const phone = document.querySelector('.phone-container');
        const bar = document.querySelector('.status-bar');
        const home = document.getElementById('home-screen');
        const barStyle = bar ? getComputedStyle(bar) : null;
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;left:-10000px;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
        (phone || document.body).appendChild(probe);
        let safeArea;
        try {
            const style = getComputedStyle(probe);
            safeArea = Object.fromEntries(['Top', 'Right', 'Bottom', 'Left'].map(side => [side.toLowerCase(), number(parseFloat(style['padding' + side]))]));
        } finally { probe.remove(); }
        const ua = window.navigator?.userAgent || '';
        const viewport = window.visualViewport;
        return {
            browser: /SamsungBrowser/i.test(ua) ? 'Samsung' : /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'other',
            os: /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : 'other',
            mode: window.matchMedia?.('(display-mode: fullscreen)').matches ? 'fullscreen' : window.matchMedia?.('(display-mode: standalone)').matches ? 'standalone' : 'browser',
            fullscreenElement: document.fullscreenElement === phone ? 'phone' : document.fullscreenElement ? 'other' : document.webkitFullscreenElement ? 'webkit' : 'none',
            fullscreenEnabled: document.fullscreenEnabled === true,
            screen: { width: number(window.screen?.width), height: number(window.screen?.height), availableHeight: number(window.screen?.availHeight) },
            viewport: { width: number(window.innerWidth), height: number(window.innerHeight), visualHeight: number(viewport?.height), visualOffsetTop: number(viewport?.offsetTop), scale: number(viewport?.scale), dpr: number(window.devicePixelRatio) },
            safeArea, phone: rect(phone), home: rect(home),
            bodyPaddingTop: number(parseFloat(getComputedStyle(document.body).paddingTop)),
            statusBar: { bounds: rect(bar), visible: !!barStyle && barStyle.display !== 'none' && barStyle.visibility !== 'hidden' && Number(barStyle.opacity) !== 0 && !!bar.getBoundingClientRect().height },
            flags: { installedAndroid: root.classList.contains('bynd-android-pwa'), nativeStatusBar: root.classList.contains('bynd-native-statusbar'), hiddenPhoneStatusBar: root.classList.contains('bynd-statusbar-hidden') },
            wallpaperPresent: !!home && getComputedStyle(home).backgroundImage !== 'none'
        };
    }
    function makeReport(before, after, fullscreenRequest) {
        const version = typeof APP_VERSION === 'string' && /^v\d+\.\d+\.\d+$/.test(APP_VERSION) ? APP_VERSION : 'unknown';
        const oldVersion = /(?:\?|&)v=(\d+\.\d+\.\d+)(?:&|$)/.exec(window.location?.search || '')?.[1] || null;
        return { format: 'BYND_DISPLAY_CHECK', appVersion: version, launchVersion: oldVersion, fullscreenRequest, windowRecovery: window.ByndFullscreenRecovery?.result() || null, before, after };
    }
    function status(text, failed = false) {
        const node = panel?.querySelector('[data-display-status]');
        if (node) { node.textContent = text; node.dataset.error = String(failed); }
    }
    function showReport() {
        const text = panel?.querySelector('textarea');
        if (text) { text.hidden = false; text.value = JSON.stringify(report, null, 2); }
    }
    async function copy() {
        try {
            if (!report) report = makeReport(snapshot(), null, { outcome: 'not_requested' });
        } catch (_) {
            status('显示检查未完成，请重试。', true);
            return false;
        }
        showReport();
        try {
            if (!window.navigator?.clipboard?.writeText) throw new Error('unavailable');
            await window.navigator.clipboard.writeText(JSON.stringify(report, null, 2));
            status('已复制检查结果，可以直接粘贴给我。');
            return true;
        } catch (_) {
            status('未能复制。结果已显示，可长按选择并复制。', true);
            return false;
        }
    }
    async function check() {
        const button = panel?.querySelector('[data-display-check]');
        if (button?.disabled) return null;
        if (button) button.disabled = true;
        status('正在读取手机当前的显示状态…');
        try {
            const before = snapshot();
            const target = document.querySelector('.phone-container');
            const request = target?.requestFullscreen || target?.webkitRequestFullscreen;
            let outcome = 'unsupported', errorType = null;
            if (document.fullscreenElement || document.webkitFullscreenElement) outcome = 'already_fullscreen';
            else if (request) {
                try {
                    // Called synchronously from the button gesture, before any await.
                    await request.call(target, ...(target.requestFullscreen ? [{ navigationUI: 'hide' }] : []));
                    outcome = document.fullscreenElement || document.webkitFullscreenElement ? 'entered' : 'resolved_without_element';
                } catch (error) {
                    outcome = 'rejected';
                    errorType = ['NotAllowedError', 'SecurityError', 'TypeError', 'NotSupportedError', 'AbortError'].includes(error?.name) ? error.name : 'other';
                }
            }
            if (typeof markByndDisplayMode === 'function') markByndDisplayMode();
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            report = makeReport(before, snapshot(), { outcome, errorType });
            showReport();
            status('已记录真实显示数据；这不代表白条已修复。');
            await copy();
            return report;
        } catch (_) {
            status('显示检查未完成，请重试。', true);
            return null;
        } finally { if (button) button.disabled = false; }
    }
    function open() {
        if (panel?.isConnected) return panel;
        const phone = document.querySelector('.phone-container');
        if (!phone) return null;
        panel = document.createElement('section');
        panel.id = 'bynd-display-check';
        panel.setAttribute('aria-label', '显示检查');
        panel.style.cssText = 'position:fixed;z-index:1000000;left:max(12px,env(safe-area-inset-left,0px));right:max(12px,env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));max-height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 32px);overflow:auto;box-sizing:border-box;padding:16px;border:1px solid #ddd;border-radius:18px;background:#fff;color:#171717;font:14px/1.5 system-ui;box-shadow:0 8px 32px #0002';
        panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><strong style="font-size:17px">显示检查</strong><button type="button" data-display-close aria-label="关闭显示检查">关闭</button></div><p style="margin:10px 0">只读取显示尺寸和全屏状态，不读取聊天、密钥或壁纸内容，也不上传数据。</p><p data-display-status role="status" style="margin:10px 0">点一下，记录进入全屏前后的实际情况。</p><div style="display:flex;gap:8px"><button type="button" data-display-check style="flex:1">检查并复制</button><button type="button" data-display-copy>复制结果</button></div><textarea readonly hidden aria-label="显示检查结果" rows="6" style="box-sizing:border-box;width:100%;margin-top:12px;resize:none;font:12px/1.5 monospace"></textarea>';
        panel.querySelectorAll('button').forEach(button => { button.style.cssText += ';min-height:40px;padding:8px 12px;border:1px solid #ddd;border-radius:10px;background:#f6f6f6;color:#171717;font:14px system-ui'; });
        panel.querySelector('[data-display-check]').addEventListener('click', check);
        panel.querySelector('[data-display-copy]').addEventListener('click', copy);
        panel.querySelector('[data-display-close]').addEventListener('click', () => panel.remove());
        phone.appendChild(panel);
        return panel;
    }
    window.ByndDisplayCheck = { requested, active: () => !!panel?.isConnected, snapshot, check, copy, open };
    if (requested()) {
        const start = () => setTimeout(() => Promise.resolve(window.__byndCoreReady).then(open, open), 0);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
        else start();
    }
})();
