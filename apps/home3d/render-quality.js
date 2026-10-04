(function (H) {
    'use strict';
    const key = 'bynd_home3d_render_quality_v1', names = ['smooth', 'balanced', 'ultra'], labels = { smooth: '流畅', balanced: '均衡', ultra: '极致', auto: '自动' };
    const presets = {
        smooth: { fps: 30, maxDpr: 1.25, maxPixels: 900000, shadowSize: 512, shadowFps: 10, anisotropy: 2, textureSize: 1024, heroTextureSize: 2048, textureMiB: 64, triangles: 180000, drawCalls: 150, lights: 0, particles: 0, lodBias: 1.4 },
        balanced: { fps: 60, maxDpr: 1.75, maxPixels: 1500000, shadowSize: 1024, shadowFps: 20, anisotropy: 4, textureSize: 2048, heroTextureSize: 2048, textureMiB: 128, triangles: 300000, drawCalls: 220, lights: 1, particles: 6, lodBias: 1 },
        ultra: { fps: 60, maxDpr: 2.25, maxPixels: 2400000, shadowSize: 2048, shadowFps: 30, anisotropy: 8, textureSize: 2048, heroTextureSize: 4096, textureMiB: 192, triangles: 450000, drawCalls: 280, lights: 2, particles: 12, lodBias: .8 }
    };
    const valid = mode => mode === 'auto' || names.includes(mode);
    function preference() { try { const mode = localStorage.getItem(key); return valid(mode) ? mode : 'auto'; } catch (_) { return 'auto'; } }
    function save(mode) {
        if (!valid(mode)) throw new Error('不支持的画质选项。');
        try { localStorage.setItem(key, mode); } catch (_) { throw new Error('画质设置没有保存成功，请释放设备空间后重试。'); }
    }
    function deviceTier(device = {}) {
        if (device.software || device.saveData || (device.memory && device.memory <= 3) || (device.cores && device.cores <= 4) || (device.maxTextureSize && device.maxTextureSize < 4096)) return 'smooth';
        // Capability hints set only a starting ceiling; they never promise a hardware FPS.
        if (device.memory >= 8 && device.cores >= 8 && device.maxTextureSize >= 8192 && device.highGpu) return 'ultra';
        return 'balanced';
    }
    function detect(renderer) {
        const gl = renderer.getContext(); let gpu = '';
        try { const extension = gl.getExtension('WEBGL_debug_renderer_info'); if (extension) gpu = String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)); } catch (_) {}
        return { cores: navigator.hardwareConcurrency || 0, memory: navigator.deviceMemory || 0, saveData: !!navigator.connection?.saveData, maxTextureSize: renderer.capabilities.maxTextureSize, software: /swiftshader|llvmpipe|software/i.test(gpu), highGpu: /adreno.*7\d\d|mali.*g7[12]\d|apple.*gpu|nvidia|radeon/i.test(gpu) };
    }
    function ratio(profile, width, height, dpr = 1, scale = 1, maxBuffer = 8192) {
        const w = Math.max(1, width), h = Math.max(1, height), native = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
        return Math.min(native, profile.maxDpr, Math.sqrt(profile.maxPixels / (w * h)), maxBuffer / w, maxBuffer / h) * scale;
    }
    function controller(mode, device = {}) {
        if (!valid(mode)) throw new Error('不支持的画质选项。');
        let ceiling = names.indexOf(mode === 'auto' ? deviceTier(device) : mode), tier = ceiling, scale = 1, start = null, samples = [], stableWindows = 0, lastChange = -Infinity, measurements = { fps: 0, frameMs: 0, gpuMs: null };
        const current = () => ({ mode, tier: names[tier], ...presets[names[tier]], renderScale: scale, postProcessing: 'off', antialias: true, measurements: { ...measurements } });
        function reset() { start = null; samples = []; stableWindows = 0; }
        function setMode(value) { if (!valid(value)) throw new Error('不支持的画质选项。'); mode = value; ceiling = names.indexOf(mode === 'auto' ? deviceTier(device) : mode); tier = ceiling; scale = 1; reset(); return current(); }
        function observe(sample) {
            if (!Number.isFinite(sample.time) || !Number.isFinite(sample.interval) || sample.interval <= 0 || sample.interval > 250) { reset(); return false; }
            if (start === null) start = sample.time;
            samples.push(sample); if (sample.time - start < 4000) return false;
            const count = samples.length, mean = field => samples.reduce((sum, s) => sum + (Number.isFinite(s[field]) ? s[field] : 0), 0) / count;
            const gpu = samples.filter(s => Number.isFinite(s.gpuMs));
            measurements = { fps: 1000 / mean('interval'), frameMs: mean('cpuMs'), gpuMs: gpu.length ? gpu.reduce((s, x) => s + x.gpuMs, 0) / gpu.length : null };
            const budget = 1000 / presets[names[tier]].fps, slow = measurements.fps < presets[names[tier]].fps * .82 || measurements.frameMs > budget * .88 || measurements.gpuMs > budget * .88;
            const healthy = measurements.fps >= presets[names[tier]].fps * .94 && measurements.frameMs < budget * .65 && (measurements.gpuMs === null || measurements.gpuMs < budget * .65);
            samples = []; start = sample.time; stableWindows = healthy ? stableWindows + 1 : 0;
            if (slow && sample.time - lastChange >= 8000) {
                if (scale > .8) scale = Math.max(.8, Math.round((scale - .1) * 10) / 10);
                else if (tier > 0) { tier--; scale = 1; }
                else return false;
                lastChange = sample.time; stableWindows = 0; return true;
            }
            if (healthy && stableWindows >= 6 && sample.time - lastChange >= 30000) {
                if (scale < 1) scale = Math.min(1, Math.round((scale + .1) * 10) / 10);
                else if (tier < ceiling) tier++;
                else return false;
                lastChange = sample.time; stableWindows = 0; return true;
            }
            return false;
        }
        return { current, setMode, observe, reset };
    }
    // Optional non-blocking GPU samples. Disjoint or unavailable timings are discarded.
    function gpuTimer(gl) {
        const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2'), pending = []; let active = null;
        if (!extension) return { begin() {}, end() {}, read: () => null, dispose() {} };
        return {
            begin() { if (!active && pending.length < 3) { active = gl.createQuery(); gl.beginQuery(extension.TIME_ELAPSED_EXT, active); } },
            end() { if (active) { gl.endQuery(extension.TIME_ELAPSED_EXT); pending.push(active); active = null; } },
            read() {
                if (gl.getParameter(extension.GPU_DISJOINT_EXT)) { pending.splice(0).forEach(q => gl.deleteQuery(q)); return null; }
                const query = pending[0]; if (!query || !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return null;
                pending.shift(); const ms = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(query); return ms;
            },
            dispose() { if (active) { gl.endQuery(extension.TIME_ELAPSED_EXT); gl.deleteQuery(active); active = null; } pending.splice(0).forEach(q => gl.deleteQuery(q)); }
        };
    }
    H.RenderQuality = { labels, presets, preference, save, detect, deviceTier, ratio, controller, gpuTimer };
})(window.ByndHome3D);
