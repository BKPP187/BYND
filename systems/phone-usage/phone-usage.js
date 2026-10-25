/* 手机使用情况: how long the user used their real phone and which apps, kept on this device.
 * Sources: the Android shell (system usage access) or a 屏幕使用时间 screenshot read by the user's own
 * vision-capable model (iOS / web). Per-character consent is applied BEFORE any text is built:
 * off by default, "total only" or "per app", minus a 不让Ta看到的应用 list. Chat gets one summary line;
 * details only through the get-app-usage tool. */
(() => {
    'use strict';
    const storageKey = 'bynd_phone_usage_private_v1';
    const RETAIN_DAYS = 30;
    const DAY = 86400000;
    const HOUR = 3600000;
    const ANDROID_SYNC_MS = 15 * 60000;
    const LEVELS = { off: '不允许', total: '只看总时长', apps: '看各应用时长' };
    const SOURCES = { android: 'Android 系统统计', screenshot: '屏幕使用时间截图' };
    const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
    const clip = (value, limit) => String(value ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
    const pad = n => String(n).padStart(2, '0');
    const localDate = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const dayStart = date => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
    const validDate = date => typeof date === 'string' && /^\d{4}-\d\d-\d\d$/.test(date) && localDate(dayStart(date)) === date;
    const int = (value, min, max, label) => {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error(`${label}需要是 ${min}–${max} 的整数`);
        return value;
    };
    const duration = minutes => {
        const h = Math.floor(minutes / 60), m = minutes % 60;
        return h ? `${h} 小时${m ? ` ${m} 分钟` : ''}` : `${m} 分钟`;
    };
    const clock = at => { const d = new Date(at); return `${d.getHours()}:${pad(d.getMinutes())}`; };

    // ---- storage ---------------------------------------------------------------------
    const empty = () => ({ version: 1, paused: false, days: {}, grants: {}, android: { lastSync: 0 } });
    function read() {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return empty();
        const state = JSON.parse(raw);
        if (state?.version !== 1 || !state.days || typeof state.days !== 'object' || Array.isArray(state.days) || !state.grants || typeof state.grants !== 'object' || Array.isArray(state.grants)) throw new Error('手机使用数据损坏，请清除后重新读取');
        return { ...empty(), ...state, android: { lastSync: Number(state.android?.lastSync) || 0 } };
    }
    function write(state) {
        localStorage.setItem(storageKey, JSON.stringify(state));
        return state;
    }

    function normalizeApp(app) {
        if (!app || typeof app !== 'object' || Array.isArray(app)) throw new Error('应用记录格式不正确');
        const label = clip(app.label || app.name, 40);
        const id = clip(app.package || app.id || label, 120);
        if (!label) throw new Error('应用缺少名称');
        const out = { id, label, minutes: int(app.minutes, 0, 1500, `${label} 的时长`) };
        if (app.opens !== undefined && app.opens !== null) out.opens = int(app.opens, 0, 5000, `${label} 的打开次数`);
        return out;
    }
    function normalizeDay(raw, source, now = Date.now()) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('使用记录格式不正确');
        if (!own(SOURCES, source)) throw new Error('未知的数据来源');
        if (!validDate(raw.date) || raw.date > localDate(now)) throw new Error('使用记录日期无效或在未来');
        if (now - dayStart(raw.date) > (RETAIN_DAYS + 1) * DAY) throw new Error(`只保留最近 ${RETAIN_DAYS} 天`);
        const observedAt = Number(raw.observedAt);
        if (!Number.isFinite(observedAt) || observedAt > now + 5 * 60000 || observedAt < dayStart(raw.date)) throw new Error('读取时间无效');
        const apps = Array.isArray(raw.apps) ? raw.apps.slice(0, 60).map(normalizeApp) : [];
        const day = { date: raw.date, source, observedAt, totalMinutes: int(raw.totalMinutes, 0, 1500, '当天总时长'), apps };
        const start = dayStart(raw.date), end = start + DAY + HOUR; // DST days can be 25 hours long
        for (const key of ['firstUseAt', 'lastUseAt', 'lateNightUntil']) {
            if (raw[key] === undefined || raw[key] === null) continue;
            const at = Number(raw[key]);
            if (!Number.isFinite(at) || at < start || at > end || at > observedAt + 60000) throw new Error('使用时刻与日期不符');
            day[key] = at;
        }
        if (day.lateNightUntil && day.lateNightUntil - start > 5 * HOUR + 60000) throw new Error('凌晨使用时刻无效');
        if (raw.partial === true || (source === 'android' && raw.date === localDate(now))) day.partial = true;
        return day;
    }
    function prune(days, now) {
        const keep = {};
        for (const [date, day] of Object.entries(days)) if (validDate(date) && now - dayStart(date) <= RETAIN_DAYS * DAY) keep[date] = day;
        return keep;
    }
    // Validates every day before the first write: one bad entry keeps the old history untouched.
    function saveDays(list, source, now = Date.now()) {
        if (!Array.isArray(list) || !list.length || list.length > 31) throw new Error('需要 1–31 天的使用记录');
        const incoming = list.map(day => normalizeDay(day, source, now));
        const state = read();
        const days = { ...state.days };
        for (const day of incoming) {
            const old = days[day.date];
            // A screenshot never overwrites a newer system reading of the same day, and vice versa.
            if (!old || day.observedAt >= old.observedAt) days[day.date] = day;
        }
        write({ ...state, days: prune(days, now) });
        return incoming.length;
    }

    // ---- consent ---------------------------------------------------------------------
    function parseExclude(value) {
        const list = Array.isArray(value) ? value : String(value || '').split(/[\n,，、]+/);
        return [...new Set(list.map(item => clip(item, 60)).filter(Boolean))].slice(0, 50);
    }
    function grantFor(state, char) {
        const grant = char && !char.isGroupChat && own(state.grants, String(char.id)) ? state.grants[String(char.id)] : null;
        return { level: own(LEVELS, grant?.level) ? grant.level : 'off', exclude: parseExclude(grant?.exclude) };
    }
    function setGrant(char, grant) {
        if (!char?.id || char.isGroupChat || ['__proto__', 'constructor', 'prototype'].includes(String(char.id))) throw new Error('请先选择一个单聊角色');
        const state = read();
        const next = grantFor({ grants: { [char.id]: grant } }, char);
        write({ ...state, grants: { ...state.grants, [char.id]: next } });
        return next;
    }
    function setPaused(paused) { return write({ ...read(), paused: paused === true }); }
    const hidden = (app, grant) => grant.exclude.some(item => {
        const key = item.toLowerCase();
        return app.label.toLowerCase() === key || app.id.toLowerCase() === key || (key.length >= 2 && app.label.toLowerCase().includes(key));
    });

    // Only what this character may see; excluded apps are removed from totals as well.
    function visibleDays(char, now = Date.now(), { preview = false } = {}) {
        let state;
        try { state = read(); } catch (_) { return []; } // unreadable data fails closed
        const grant = grantFor(state, char);
        if (!char || char.isGroupChat || state.paused || (grant.level === 'off' && !preview)) return [];
        const level = grant.level === 'off' ? 'apps' : grant.level;
        return Object.values(state.days).sort((a, b) => b.date.localeCompare(a.date)).flatMap(raw => {
            let day;
            try { day = normalizeDay(raw, raw.source, now); } catch (_) { return []; }
            const shown = day.apps.filter(app => !hidden(app, grant));
            const removed = day.apps.filter(app => hidden(app, grant)).reduce((sum, app) => sum + app.minutes, 0);
            const view = { date: day.date, source: day.source, observedAt: day.observedAt, partial: !!day.partial, totalMinutes: Math.max(0, day.totalMinutes - removed) };
            if (day.lateNightUntil) view.lateNightUntil = day.lateNightUntil;
            if (level === 'apps') view.apps = shown.sort((a, b) => b.minutes - a.minutes);
            return [view];
        });
    }
    function dayName(date, now) {
        if (date === localDate(now)) return '今天';
        if (date === localDate(dayStart(localDate(now)) - DAY / 2)) return '昨天';
        return date.slice(5).replace('-', '月') + '日';
    }
    function summary(char, now = Date.now(), options = {}) {
        const day = visibleDays(char, now, options).find(item => now - dayStart(item.date) < 2 * DAY);
        if (!day) return '';
        const when = dayName(day.date, now) + (day.partial ? `（截至 ${clock(day.observedAt)}）` : '');
        const top = (day.apps || []).filter(app => app.minutes >= 5).slice(0, 3).map(app => `${app.label} ${duration(app.minutes)}`);
        const late = day.lateNightUntil ? `；凌晨 ${clock(day.lateNightUntil)} 还在用手机` : '';
        return `${when}用手机约 ${duration(day.totalMinutes)}${top.length ? `，${top.join('、')}` : ''}${late}`;
    }
    function freshEnough(char, now) {
        return visibleDays(char, now).some(day => now - day.observedAt < 36 * HOUR);
    }
    function prompt(char, now = Date.now()) {
        let state;
        try { state = read(); } catch (_) { return ''; }
        if (!char || char.isGroupChat || state.paused || grantFor(state, char).level === 'off') return '';
        syncAndroidIfStale(now);
        const line = summary(char, now);
        const ask = !android() && !freshEnough(char, now)
            ? '用户授权你了解 TA 的手机使用情况，但最近没有数据。只有在聊到熬夜、刷手机或作息时，才可以偶尔用你自己的口吻让用户把「屏幕使用时间」截图传到角色台；不要频繁要，被拒绝就别再提。'
            : '';
        if (!line && !ask) return '';
        return `【用户授权的手机使用情况】${line ? `${line}（${SOURCES[visibleDays(char, now)[0]?.source] || '本机记录'}）。` : ''}这是用户现实中的手机使用统计，不代表 TA 在做什么、和谁聊天或心情如何；不要播报数字，不要监督或说教，按人设自然地偶尔提起即可。${ask}【手机使用情况结束】`;
    }

    // ---- get-app-usage tool ------------------------------------------------------------
    function toolLine(char) {
        let state;
        try { state = read(); } catch (_) { return ''; }
        if (!char || char.isGroupChat || state.paused || grantFor(state, char).level === 'off' || !Object.keys(state.days).length) return '';
        return '{"name":"phone.usage","days":"1-7，可省略","app":"可选，只看某个应用"}：看用户最近几天的手机使用时长（用户授权的部分）';
    }
    function details(char, call = {}, now = Date.now()) {
        const span = Math.max(1, Math.min(7, Number.parseInt(call.days, 10) || 1));
        const days = visibleDays(char, now).filter(day => now - dayStart(day.date) < span * DAY);
        const want = clip(call.app, 40).toLowerCase();
        if (!days.length) return { ok: true, message: '没有可以看的手机使用记录', lines: [] };
        const lines = days.map(day => {
            const head = `${day.date}${day.partial ? `（截至 ${clock(day.observedAt)}）` : ''}：共 ${duration(day.totalMinutes)}`;
            const late = day.lateNightUntil ? `，凌晨 ${clock(day.lateNightUntil)} 还在用` : '';
            if (!day.apps) return head + late;
            const apps = (want ? day.apps.filter(app => app.label.toLowerCase().includes(want)) : day.apps.slice(0, 8))
                .map(app => `${app.label} ${duration(app.minutes)}${app.opens ? `（打开 ${app.opens} 次）` : ''}`);
            return `${head}${late}${apps.length ? `；${apps.join('、')}` : want ? '；没有这个应用的记录' : ''}`;
        });
        return { ok: true, message: lines.join('\n'), lines };
    }
    async function execute(char, call, event = {}) {
        event.tool = 'get-app-usage';
        event.title = '查看手机使用情况';
        event.input = clip([call.days ? `${call.days} 天` : '今天', call.app].filter(Boolean).join(' · '), 100);
        let state;
        try { state = read(); } catch (error) { return { ok: false, message: error.message }; }
        if (!char || char.isGroupChat) return { ok: false, message: '群聊里不能查看手机使用情况' };
        if (state.paused) return { ok: false, message: '用户暂停了所有角色读取手机使用情况' };
        if (grantFor(state, char).level === 'off') return { ok: false, message: '用户没有授权这个角色查看手机使用情况' };
        syncAndroidIfStale(Date.now(), true);
        const result = details(char, call);
        return { ...result, react: call.react === false ? '' : `用户的手机使用情况（用户授权的部分，不含被隐藏的应用）：\n${result.message}` };
    }

    // ---- Android ----------------------------------------------------------------------
    function android() {
        const bridge = window.ByndAndroid;
        return bridge && typeof bridge.phoneUsageRead === 'function' && typeof bridge.phoneUsageGranted === 'function' ? bridge : null;
    }
    function androidGranted() { try { return !!android()?.phoneUsageGranted(); } catch (_) { return false; } }
    function openAndroidSettings() {
        const bridge = window.ByndAndroid;
        if (typeof bridge?.openCompanionSetting !== 'function') throw new Error('当前不是 BYND Android 客户端');
        return bridge.openCompanionSetting('usage');
    }
    function syncAndroid(now = Date.now()) {
        const bridge = android();
        if (!bridge) throw new Error('当前不是 BYND Android 客户端');
        let reply;
        try { reply = JSON.parse(bridge.phoneUsageRead(10) || '{}'); } catch (_) { throw new Error('系统没有返回可读的使用统计'); }
        if (!reply.ok) {
            throw new Error({ 'usage-access-denied': '还没有打开「使用情况访问权限」', unsupported: '这个 Android 版本不支持读取使用情况', 'untrusted-page': '只能在 BYND 本地页面读取' }[reply.error] || '读取失败，请稍后再试');
        }
        const days = (Array.isArray(reply.days) ? reply.days : []).map(day => ({
            date: day.date, observedAt: Number(reply.observedAt) || now, totalMinutes: day.totalMinutes, partial: day.partial === true,
            firstUseAt: day.firstUseAt, lastUseAt: day.lastUseAt, lateNightUntil: day.lateNightUntil,
            apps: (day.apps || []).map(app => ({ package: app.package, label: app.label, minutes: app.minutes, opens: app.opens }))
        }));
        const count = days.length ? saveDays(days, 'android', now) : 0;
        const state = read();
        write({ ...state, android: { lastSync: now } });
        return count;
    }
    function syncAndroidIfStale(now = Date.now(), force = false) {
        if (!android() || !androidGranted()) return false;
        try {
            if (!force && now - read().android.lastSync < ANDROID_SYNC_MS) return false;
            syncAndroid(now);
            return true;
        } catch (error) { console.warn('手机使用情况同步失败', error?.message || error); return false; }
    }

    // ---- 屏幕使用时间 screenshot (iOS / web) --------------------------------------------
    const SCREENSHOT_PROMPT = '你是一个只做数据提取的助手。图片应是手机系统的「屏幕使用时间 / 数字健康」截图。只读取图中清楚可见的数字，不要推测。'
        + '只输出 JSON：{"readable":true,"date":"YYYY-MM-DD 或 null（图里能确定日期才填）","scope":"day 或 week","totalMinutes":整数,"apps":[{"label":"应用名","minutes":整数}]}。'
        + '如果看不到图片、图片不是屏幕使用时间页面、或数字看不清，只输出 {"readable":false,"reason":"简短原因"}。周视图只在能看到单日数据时按单日输出，否则 readable:false。';
    async function imageToDataUrl(file) {
        if (!file || !/^image\/(png|jpe?g|webp|heic|heif)$/i.test(file.type || '')) throw new Error('请选择 PNG、JPG 或 WebP 截图');
        if (file.size > 12 * 1024 * 1024) throw new Error('截图不能超过 12 MB');
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        return canvas.toDataURL('image/jpeg', 0.86);
    }
    function parseModelJson(text) {
        const raw = String(text || '').replace(/```(?:json)?/gi, '').trim();
        const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) return null;
        try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { return null; }
    }
    async function readScreenshot(dataUrl, date, now = Date.now()) {
        if (typeof window.callChatApi !== 'function') throw new Error('聊天接口尚未准备好');
        if (!validDate(date) || date > localDate(now)) throw new Error('请选择截图对应的日期');
        const result = await window.callChatApi([
            { role: 'system', content: SCREENSHOT_PROMPT },
            { role: 'user', content: [{ type: 'text', text: `截图对应的日期（用户选择）：${date}` }, { type: 'image_url', image_url: { url: dataUrl } }] }
        ], { background: true, stream: false, usageFeature: 'phone-usage' });
        if (!result?.ok) {
            const message = String(result?.error || '模型没有回应');
            if (/不支持图片识别|vision|multi[- ]?modal|image_url|content\s*array/i.test(message)) throw new Error('当前聊天模型不能看图。请在「设置 → API」换成支持图片输入的模型后再上传。');
            throw new Error(message);
        }
        const parsed = parseModelJson(result.content);
        if (!parsed) throw new Error('模型没有返回可用的数据；如果它不支持看图，请换成支持图片输入的模型');
        if (parsed.readable !== true) throw new Error(`没能读出截图：${clip(parsed.reason, 60) || '图片不是屏幕使用时间页面或看不清'}。如果模型不支持看图，请换一个支持图片的模型`);
        if (parsed.date && validDate(parsed.date) && parsed.date !== date) throw new Error(`截图上的日期是 ${parsed.date}，和你选择的 ${date} 不一致`);
        const apps = Array.isArray(parsed.apps) ? parsed.apps.filter(app => app && Number.isInteger(app.minutes) && app.minutes > 0) : [];
        return { date, observedAt: now, totalMinutes: parsed.totalMinutes, apps: apps.map(app => ({ label: app.label, minutes: app.minutes })), partial: date === localDate(now) };
    }
    async function importScreenshot(file, date, now = Date.now()) {
        const day = await readScreenshot(await imageToDataUrl(file), date, now);
        saveDays([day], 'screenshot', now);
        return normalizeDay(day, 'screenshot', now);
    }

    function clear() { localStorage.removeItem(storageKey); }
    function revokeAll() { const state = read(); return write({ ...state, grants: {} }); }
    function history(now = Date.now()) {
        return Object.values(read().days).filter(day => now - dayStart(day.date) <= RETAIN_DAYS * DAY).sort((a, b) => b.date.localeCompare(a.date));
    }

    window.ByndPhoneUsage = {
        storageKey, LEVELS, SOURCES, localDate, read, normalizeDay, saveDays, parseExclude, grantFor, setGrant, setPaused,
        visibleDays, summary, prompt, toolLine, details, execute, history, clear, revokeAll,
        android: () => !!android(), androidGranted, openAndroidSettings, syncAndroid, syncAndroidIfStale,
        readScreenshot, importScreenshot, parseModelJson
    };
})();
