/* Read-only native bridge. OS consent and character consent remain independent. */
(() => {
    'use strict';
    const storageKey = 'bynd_health_connection_private_v1';
    const pending = new Map();
    const supported = ['sleep', 'steps', 'exercise', 'cycle'];
    let sequence = 0;
    let busy = false;
    let generation = 0;
    const available = () => window.location?.protocol === 'bynd-app:' && window.location?.hostname === 'app' && !!window.webkit?.messageHandlers?.byndHealth;
    function read() {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return { connected: false, types: [] };
        const state = JSON.parse(raw);
        if (!Array.isArray(state.types) || state.types.some(type => !supported.includes(type))) throw new Error('健康连接设置损坏');
        return state;
    }
    function request(action, types = []) {
        if (!available()) return Promise.reject(new Error('请使用带 HealthKit 的 iPhone 原生版本；浏览器和桌面网页不能读取 Apple 健康'));
        return new Promise((resolve, reject) => {
            const id = `health-${Date.now()}-${++sequence}`;
            const timer = setTimeout(() => { pending.delete(id); reject(new Error('健康读取超时，请重试')); }, 60000);
            pending.set(id, { resolve, reject, timer });
            try { window.webkit.messageHandlers.byndHealth.postMessage({ id, action, types }); }
            catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
        });
    }
    function onReply(reply) {
        if (!reply || typeof reply.id !== 'string') return;
        const job = pending.get(reply.id);
        if (!job) return;
        pending.delete(reply.id); clearTimeout(job.timer);
        if (reply.ok === true) job.resolve(reply.data);
        else job.reject(new Error(String(reply.error || '健康读取失败')));
    }
    function clearNative() {
        window.ByndLifeState?.replaceNativeSummary({ version: 1, records: [] });
        window.ByndMoon?.replaceNativeDays([]);
    }
    async function connect(types) {
        const chosen = [...new Set(types)].filter(type => supported.includes(type));
        if (!chosen.length) throw new Error('请先选择至少一类数据');
        if (busy) throw new Error('正在读取，请稍后');
        const token = ++generation;
        await request('authorize', chosen);
        if (token !== generation) throw new Error('健康连接已取消');
        // Completion means the OS permission sheet finished; it does NOT prove read access.
        clearNative();
        localStorage.setItem(storageKey, JSON.stringify({ connected: true, types: chosen }));
        return sync();
    }
    async function sync() {
        if (busy) throw new Error('正在读取，请稍后');
        const state = read();
        if (!state.connected || !state.types.length) throw new Error('请先连接 Apple 健康');
        busy = true;
        const token = generation;
        try {
            // Remove the previous native snapshot before a fresh read. Denied/empty reads cannot reuse it.
            clearNative();
            const data = await request('read', state.types);
            if (token !== generation || !read().connected) throw new Error('健康连接已取消');
            if (data?.version !== 1 || !Array.isArray(data.records) || !Array.isArray(data.flowDays)) throw new Error('健康返回格式无效');
            const allowedFields = new Set(state.types.flatMap(type => ({ sleep: ['sleepMinutes', 'bedtime', 'wakeTime'], steps: ['steps'], exercise: ['exerciseMinutes'], cycle: [] })[type]));
            if (data.records.some(record => Object.keys(record?.values || {}).some(key => !allowedFields.has(key))) || (!state.types.includes('cycle') && data.flowDays.length)) throw new Error('健康返回了未选择的数据类型');
            try {
                window.ByndLifeState.replaceNativeSummary({ version: 1, records: data.records });
                window.ByndMoon?.replaceNativeDays(state.types.includes('cycle') ? data.flowDays : []);
                localStorage.setItem(storageKey, JSON.stringify({ ...state, lastSync: new Date().toISOString() }));
            } catch (error) { clearNative(); throw error; }
            return { count: data.records.length, flowDays: data.flowDays.length, empty: !data.records.length && !data.flowDays.length };
        } finally { busy = false; }
    }
    function disconnect() {
        generation += 1;
        // Revoke connection FIRST. Late callbacks cannot restore disconnected health data.
        localStorage.removeItem(storageKey);
        clearNative();
    }
    document.addEventListener?.('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || !available() || busy) return;
        try {
            if (read().connected) sync().catch(error => console.warn('健康汇总刷新失败', error.message));
        } catch (error) { console.warn('健康连接读取失败', error.message); }
    });
    window.ByndNativeHealth = { storageKey, available, read, request, onReply, connect, sync, disconnect };
})();
