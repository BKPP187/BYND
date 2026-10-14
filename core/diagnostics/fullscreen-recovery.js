// Bounded Samsung installed-webapp recovery, based on Chromium's dynamic viewport-fit path.
// This requests a native-window recalculation. It never fabricates CSS viewport dimensions.
(function () {
    'use strict';
    let attempted = false, pending = null, last = null, scheduled = false;
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    function measure() {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px)';
        document.body.appendChild(probe);
        try {
            return {
                screenHeight: Number(window.screen?.height),
                viewportHeight: Number(window.visualViewport?.height || window.innerHeight),
                safeTop: parseFloat(getComputedStyle(probe).paddingTop)
            };
        } finally { probe.remove(); }
    }
    function eligible() {
        const root = document.documentElement;
        if (window.ByndAndroid || !root.classList.contains('bynd-android-pwa') || root.classList.contains('bynd-ios')) return false;
        if (!/Android/i.test(window.navigator?.userAgent || '') || !/SamsungBrowser/i.test(window.navigator?.userAgent || '')) return false;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) return false;
        if (document.hidden || window.ByndDisplayCheck?.active()) return false;
        const focus = document.activeElement;
        if (/^(INPUT|TEXTAREA)$/.test(focus?.tagName || '') || focus?.isContentEditable) return false;
        const scale = Number(window.visualViewport?.scale || 1);
        if (Math.abs(scale - 1) > .01 || Math.abs(Number(window.screen?.width) - window.innerWidth) > 4) return false;
        const sizes = measure();
        const gap = sizes.screenHeight - sizes.viewportHeight;
        // A modest missing strip with no reported top safe area matches the observed failure.
        // Large gaps (keyboard/split window) and already edge-to-edge windows are left alone.
        return sizes.safeTop === 0 && gap >= 16 && gap <= 96;
    }
    function check() {
        if (pending) return pending;
        if (attempted) return Promise.resolve(last);
        let meta, original, temporary, before;
        try {
            if (!eligible()) return Promise.resolve(null);
            meta = document.querySelector('meta[name="viewport"]');
            original = meta?.getAttribute('content');
            if (!original || !/\bviewport-fit\s*=\s*cover\b/i.test(original)) return Promise.resolve(null);
            temporary = original.replace(/\bviewport-fit\s*=\s*cover\b/i, 'viewport-fit=auto');
            before = measure();
        } catch (_) { return Promise.resolve(null); }
        attempted = true;
        pending = (async () => {
            try {
                try {
                    meta.setAttribute('content', temporary);
                    // Give the renderer/browser a frame to apply DEFAULT before restoring COVER.
                    await delay(80);
                } finally {
                    // Preserve another caller's concurrent viewport edit.
                    if (meta.getAttribute('content') === temporary) meta.setAttribute('content', original);
                }
                await delay(160);
                const after = measure();
                last = { attempted: true, outcome: after.viewportHeight > before.viewportHeight + 1 ? 'expanded' : 'unchanged', before, after };
            } catch (_) {
                last = { attempted: true, outcome: 'failed', before, after: null };
            }
            // An expanded viewport is evidence of a change, not proof that the visible strip is fixed.
            return last;
        })().finally(() => { pending = null; });
        return pending;
    }
    function schedule() {
        if (scheduled || pending || attempted) return;
        scheduled = true;
        setTimeout(() => { scheduled = false; check(); }, 80);
    }
    window.ByndFullscreenRecovery = { check, result: () => last };
    document.addEventListener('fullscreenchange', schedule);
    document.addEventListener('webkitfullscreenchange', schedule);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
    window.addEventListener('pageshow', schedule);
    const start = () => Promise.resolve(window.__byndCoreReady).then(schedule, schedule);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
