// 后台陪伴（仅安卓）: the native overlay tells us which app the user is in (and optionally a
// downscaled screen frame); one background request lets the bound character say ≤30 characters or stay silent.
(() => {
    'use strict';
    const STORE_KEY = 'bynd_screen_companion_v1';
    const OWN_PACKAGE = 'cc.ccwu.bynd';
    const MAX_TEXT = 30;
    const INTERVALS = [1, 3, 5, 10, 15];
    const GAPS = [1, 3, 5, 10, 20];
    // Payment, banking and password screens cannot be recognised reliably, so whole apps are skipped by package prefix.
    const DEFAULT_EXCLUDED = [
        'com.eg.android.AlipayGphone', 'com.alipay', 'com.unionpay', 'com.chinaums', 'com.icbc', 'com.chinamworld', 'com.android.bankabc',
        'cmb.pb', 'com.cmbchina', 'com.bankcomm', 'com.ecitic', 'com.citiccard', 'com.spdb', 'com.cib.', 'com.pingan.paces', 'com.hxb',
        'cn.com.cmbc', 'com.webank', 'com.mybank', 'com.psbc', 'com.cgbchina', 'com.jd.jrapp', 'com.paypal', 'com.google.android.apps.walletnfcrel',
        'com.huawei.wallet', 'com.hihonor.wallet', 'com.miui.tsmclient', 'com.finshell.wallet', 'com.vivo.wallet',
        'com.x8bit.bitwarden', 'com.agilebits.onepassword', 'com.lastpass', 'com.dashlane', 'keepass2android', 'com.kunzisoft.keepass', 'com.keepassdroid',
        'com.google.android.apps.authenticator2', 'com.azure.authenticator', 'com.authy', 'proton.android.pass',
        'com.android.settings', 'com.android.permissioncontroller', 'com.google.android.permissioncontroller', 'com.android.packageinstaller', 'com.google.android.packageinstaller'
    ];
    // BYND itself, system UI and launchers are never commented on (native also resolves the real launcher).
    const SYSTEM_EXCLUDED = [OWN_PACKAGE, 'android', 'com.android.systemui', 'com.miui.home', 'com.huawei.android.launcher', 'com.hihonor.android.launcher',
        'com.oppo.launcher', 'com.android.launcher', 'com.bbk.launcher2', 'com.google.android.apps.nexuslauncher', 'com.sec.android.app.launcher', 'net.oneplus.launcher',
        'com.android.documentsui', 'com.google.android.documentsui'];
    const PACKAGE = /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+\.?$/;
    const state = { inFlight: false, lastRequestAt: 0, lastText: '', note: '', native: null, frameSignature: '', frameTask: Promise.resolve() };

    const clean = (value, limit = 200) => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, limit);
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = text => { if (typeof showWechatToast === 'function') showWechatToast(text, 2200); };

    function bridge() {
        const android = window.ByndAndroid;
        return android && typeof android.companionStatus === 'function' && typeof android.setCompanionConfig === 'function' ? android : null;
    }
    function parseExclusions(text) {
        return [...new Set(String(text || '').split(/[\s,，;；]+/).map(item => item.trim()).filter(item => item.length <= 120 && PACKAGE.test(item)))].slice(0, 100);
    }
    function readSettings() {
        let raw = {};
        try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (_) {}
        return {
            enabled: raw.enabled === true,
            watchScreen: raw.watchScreen === true,
            intervalMin: INTERVALS.includes(Number(raw.intervalMin)) ? Number(raw.intervalMin) : 3,
            minGapMin: GAPS.includes(Number(raw.minGapMin)) ? Number(raw.minGapMin) : 3,
            exclusions: parseExclusions((Array.isArray(raw.exclusions) ? raw.exclusions : []).join('\n')),
            noVision: raw.noVision && typeof raw.noVision === 'object' ? raw.noVision : {}
        };
    }
    function saveSettings(patch) {
        const next = { ...readSettings(), ...patch };
        try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch (_) { return false; }
        return true;
    }
    const exclusionList = (settings = readSettings()) => [...new Set([...DEFAULT_EXCLUDED, ...settings.exclusions])];
    function isExcluded(pkg, settings = readSettings()) {
        const name = String(pkg || '');
        if (!name || SYSTEM_EXCLUDED.some(item => name === item || name.startsWith(item + '.')) || /launcher/i.test(name)) return true;
        return exclusionList(settings).some(prefix => name.startsWith(prefix));
    }
    function boundChar() {
        if (typeof isMonitorPetEnabled === 'function' && !isMonitorPetEnabled()) return null;
        return typeof getMonitorPetBoundChar === 'function' ? getMonitorPetBoundChar() : null;
    }
    const charName = char => char ? (typeof getMonitorCharName === 'function' ? getMonitorCharName(char) : clean(char.name, 40)) : '';
    function nativeStatus() {
        const android = bridge();
        if (!android) return { available: false };
        try { return { available: true, ...JSON.parse(android.companionStatus() || '{}') }; } catch (_) { return { available: true }; }
    }
    function syncNative() {
        const android = bridge();
        if (!android) return false;
        const settings = readSettings();
        try {
            android.setCompanionConfig(JSON.stringify({ enabled: settings.enabled, watchScreen: settings.watchScreen, intervalMin: settings.intervalMin, exclusions: [...SYSTEM_EXCLUDED, ...exclusionList(settings)], charName: charName(boundChar()) }));
            return true;
        } catch (error) { console.warn('后台陪伴配置同步失败', error); return false; }
    }
    function visionKey() {
        const api = typeof getDefaultApi === 'function' ? getDefaultApi() : null;
        return api ? clean(api.baseUrl, 200) + '|' + clean(api.model, 120) : '';
    }
    const visionUnsupported = (settings = readSettings()) => !!settings.noVision[visionKey()];
    const visionError = result => /不支持图片识别|vision|multi[- ]?modal|image_url|content\s*array/i.test(String(result?.error || '')) && [400, 415, 422, 0, undefined].includes(result?.httpStatus);
    function note(text) {
        state.note = clean(text, 200);
        const box = document.querySelector?.('[data-sc-status]');
        if (box) box.textContent = state.note;
    }
    function rerender() { try { window.ByndPetWorkspace?.render?.(); } catch (_) {} }

    // ---- One request per context ----
    function gate(ctx, now = Date.now()) {
        const settings = readSettings();
        const test = ctx?.reason === 'test';
        if (!settings.enabled && !test) return { ok: false, reason: 'disabled' };
        if (isExcluded(ctx?.package, settings)) return { ok: false, reason: 'excluded' };
        const char = boundChar();
        if (!char || !window.ByndCharacterPet || !window.ByndPetRequests || typeof callChatApi !== 'function') return { ok: false, reason: 'no-pet' };
        if (state.inFlight) return { ok: false, reason: 'busy' };
        if (!test && now - state.lastRequestAt < settings.minGapMin * 60000) return { ok: false, reason: 'gap' };
        return { ok: true, char, settings };
    }
    function screenImage(ctx, settings) {
        const url = typeof ctx?.imageDataUrl === 'string' && /^data:image\/(?:jpeg|png|webp);base64,/i.test(ctx.imageDataUrl) && ctx.imageDataUrl.length < 1500000 ? ctx.imageDataUrl : '';
        if (!settings.watchScreen) return { image: '', why: 'off' };
        if (!url) return { image: '', why: ctx?.secure ? 'secure' : 'none' };
        if (visionUnsupported(settings)) return { image: '', why: 'no-vision' };
        return { image: url, why: 'image' };
    }
    function buildMessages(char, ctx, look) {
        const C = window.ByndCharacterPet;
        const label = clean(ctx.label, 60) || clean(ctx.package, 120);
        const minutes = Math.max(1, Math.round((Number(ctx.dwellMs) || 0) / 60000));
        const moment = ctx.reason === 'test' ? '（用户点了「测试一下」）' : ctx.reason === 'periodic' ? `已经用了约 ${minutes} 分钟。` : '刚刚切换过去。';
        const sight = {
            image: '附图是这一刻用户屏幕的缩略截图（用户授权，只发给用户自己配置的模型），只依据确实可见的内容，不复述他人私信、账号、金额等敏感信息。',
            secure: '这个页面是受保护的黑屏画面（可能是支付、密码或版权视频），没有可见内容，只能根据应用名称说话，不要猜画面。',
            'no-vision': '当前聊天模型不支持看图，这次只有应用名称，不得假装看见了屏幕内容。'
        }[look.why] || '没有屏幕画面，只知道应用名称，不得假装看见了屏幕内容。';
        const active = C.active?.(char);
        const content = [
            clean(C.persona(char), 7000),
            '【最近互动】\n' + clean(C.recent(char), 1500),
            `【此刻】用户离开了 BYND，正在用「${label}」（${clean(ctx.package, 120)}），${moment}`,
            '【画面】' + sight,
            state.lastText ? `【上一句】${state.lastText}（刚说过，不要重复它的内容和句式）` : '',
            active ? '【可用外在表现】\n' + C.stateMenu(char) : '【外在表现】只有待机形象，state 固定填 idle。'
        ].filter(Boolean).join('\n\n');
        return [
            { role: 'system', content: '你是悬浮在用户手机屏幕边的桌宠，也是角色本人，正陪用户看着屏幕。大多数时候保持安静；只有真的有话想说、且符合人设与关系时才说一句。不说教、不催用户放下手机（除非人设就会这样），不评判隐私内容。发言不超过 30 个字，口语，不带旁白动作、引号或解释。输出前切换为角色一致性复核视角：发言必须符合角色卡、世界书、禁区、已确认关系和最近互动；过度亲昵、幼儿化、态度相反、无依据脑补、假装看见画面里没有的东西、涉及敏感信息或把握不足，都判 allow:false 并把 text 留空。只输出 JSON {"speak":true或false,"text":"不超过 30 字，可为空","state":"可用 id 或 idle","confidence":0.0到1.0,"allow":true或false,"note":"一句简短公开结论，不包含内部推理"}。' },
            { role: 'user', content: look.image ? [{ type: 'text', text: content }, { type: 'image_url', image_url: { url: look.image } }] : content }
        ];
    }
    function interpret(char, raw) {
        if (!raw || typeof raw !== 'object') return { speak: false, note: '模型没有返回可用的 JSON，这次保持安静。' };
        const publicNote = clean(raw.note, 160);
        const text = Array.from(clean(raw.text, 400).replace(/^["“”'「『]+|["“”'」』]+$/g, '')).slice(0, MAX_TEXT).join('').trim();
        if (raw.allow !== true) return { speak: false, note: publicNote || '本轮一致性检查未通过，保持安静。' };
        if (raw.speak === false || !text) return { speak: false, note: publicNote || '这次选择安静地陪着。' };
        const reaction = window.ByndCharacterPet.normalizeReaction(char, raw);
        return { speak: true, text, state: reaction.state, note: publicNote };
    }
    async function onContext(ctx) {
        const check = gate(ctx);
        if (!check.ok) return { spoke: false, reason: check.reason };
        const { char, settings } = check;
        const C = window.ByndCharacterPet, requests = window.ByndPetRequests;
        if (!C.hasPersona(char)) { note('请先在「角色列表」补充性格与关系，TA 才能按人设陪看。'); return { spoke: false, reason: 'persona' }; }
        state.inFlight = true;
        let lease = null;
        try {
            // Jev (when configured) decides whether to speak at all; otherwise the model decides inside its one reply.
            if (ctx.reason !== 'test' && window.ByndJev?.available?.('toolGate') && window.ByndDecider?.gate) {
                const verdict = await window.ByndDecider.gate(char, `用户正在用「${clean(ctx.label, 40)}」，主动在屏幕边说一句话`).catch(() => null);
                if (verdict && verdict.allow === false) { note('Jev 判断此刻不适合开口，TA 安静地陪着。'); return { spoke: false, reason: 'jev' }; }
            }
            const access = requests.acquire(ctx.reason === 'test' ? 'test' : 'observe', char.id);
            if (!access.lease) { note(access.message); return { spoke: false, reason: 'cooldown' }; }
            lease = access.lease;
            state.lastRequestAt = Date.now();
            const look = screenImage(ctx, settings);
            const result = await requests.call(lease, buildMessages(char, ctx, look), {
                usageChar: char, max_tokens: 300, temperature: 0.7, stage: '后台陪伴',
                canSend: () => (readSettings().enabled || ctx.reason === 'test') && boundChar() === char
            });
            if (!result?.ok) {
                // A model without vision rejects the image: later contexts go by app name only, never a second request now.
                if (look.image && visionError(result)) saveSettings({ noVision: { ...readSettings().noVision, [visionKey()]: true } });
                note(result?.cancelled ? '本次陪看已取消。' : requests.message(result, '后台陪伴'));
                return { spoke: false, reason: result?.cancelled ? 'cancelled' : 'error' };
            }
            const decision = interpret(char, C.parse(result.content));
            note(decision.note || '');
            if (!decision.speak) return { spoke: false, reason: 'silent', note: decision.note };
            state.lastText = decision.text;
            try { bridge()?.showCompanionBubble(decision.text, decision.state === 'idle' ? '' : decision.state); } catch (_) {}
            C.record?.(char, { text: decision.text, state: decision.state });
            if (ctx.reason === 'test') toast(charName(char) + '：' + decision.text);
            return { spoke: true, text: decision.text, state: decision.state };
        } catch (error) {
            note(clean(error?.message, 200) || '后台陪伴未完成。');
            return { spoke: false, reason: 'error' };
        } finally {
            if (lease) requests.release(lease);
            state.inFlight = false;
        }
    }

    // ---- Pet frames for the native overlay ----
    async function framesFor(char) {
        const C = window.ByndCharacterPet;
        const list = [];
        if (char && C?.active(char)) {
            const config = C.profile(char);
            const idle = await C.readAsset(config.idleKey).catch(() => null);
            const base = await C.readAsset(config.baseKey).catch(() => null);
            const first = idle?.transparent ? idle : base;
            if (first?.url) list.push({ key: 'idle', url: first.url });
            for (const item of C.available(char)) {
                const asset = await C.readAsset(item.assetKey).catch(() => null);
                if (asset?.transparent && asset.url) list.push({ key: item.id, url: asset.url });
            }
        } else {
            const saved = typeof getMonitorPetLibrary === 'function' ? getMonitorPetLibrary().find(pet => pet.id === getActiveMonitorPetId()) : null;
            const source = saved && typeof getMonitorPetDisplayImage === 'function' ? getMonitorPetDisplayImage(saved) : char?.avatar || '';
            if (source) list.push({ key: 'idle', url: source });
        }
        return list.filter(item => /^[a-zA-Z0-9_-]{1,40}$/.test(item.key));
    }
    async function rasterize(url) {
        if (/^data:image\/gif;base64,/i.test(url) && url.length < 3000000) return url;
        const blob = await (await fetch(url)).blob();
        const bitmap = await createImageBitmap(blob);
        const strip = typeof getMonitorPetStripLayout === 'function' ? getMonitorPetStripLayout(bitmap.width, bitmap.height, url) : null;
        const width = strip ? strip.width : bitmap.width, height = strip ? strip.height : bitmap.height;
        const scale = Math.min(1, 360 / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        return canvas.toDataURL('image/png');
    }
    function pushFrames(force = false) {
        state.frameTask = state.frameTask.catch(() => {}).then(async () => {
            const android = bridge();
            if (!android || !readSettings().enabled) return false;
            const char = boundChar();
            const list = await framesFor(char);
            const signature = (char?.id || '') + '|' + list.map(item => item.key + ':' + item.url.length + ':' + item.url.slice(-48)).join('|');
            if (!force && signature === state.frameSignature) return false;
            android.clearCompanionPetFrames?.();
            for (const item of list) {
                try { const data = await rasterize(item.url); if (data) android.setCompanionPetFrame(item.key, data); }
                catch (error) { console.warn('桌宠形象同步到悬浮窗失败', item.key, error); }
            }
            state.frameSignature = signature;
            return true;
        });
        return state.frameTask;
    }

    // ---- Native state and UI ----
    function onNativeState(info) {
        state.native = info && typeof info === 'object' ? info : null;
        const event = state.native?.event;
        if (['projection-denied', 'projection-ended', 'projection-failed'].includes(event) && readSettings().watchScreen) {
            saveSettings({ watchScreen: false });
            syncNative();
            note(event === 'projection-denied' ? '没有获得屏幕授权，「看屏幕」已关闭。' : '屏幕授权已结束，需要时请重新开启「看屏幕」。');
        }
        if (event === 'closed') { saveSettings({ enabled: false }); note('已从通知关闭后台陪伴。'); }
        rerender();
    }
    const oemGuides = {
        xiaomi: '小米/红米：安全中心 → 应用管理 → BYND 打开「自启动」；「其他权限」里允许「后台弹出界面」和「悬浮窗」；省电策略选「无限制」；游戏加速 → 设置 → 免打扰里关闭屏蔽悬浮窗。',
        huawei: '华为：设置 → 应用启动管理 → BYND 改为手动管理并全部允许；游戏助手 → 免打扰里允许悬浮窗。',
        honor: '荣耀：设置 → 应用启动管理 → BYND 改为手动管理并全部允许；游戏助手 → 免打扰里允许悬浮窗。',
        oppo: 'OPPO/一加/realme：允许「自启动」和「悬浮窗」；电池 → BYND 允许后台运行；游戏助手 → 游戏免打扰里允许悬浮窗。',
        vivo: 'vivo/iQOO：i 管家 → 应用管理 → 权限管理里允许「自启动」「悬浮窗」「后台弹出界面」；电池 → 后台高耗电允许 BYND；游戏魔盒 → 免打扰 → 悬浮窗白名单加入 BYND。'
    };
    function checkRow(kind, title, text, on) {
        const badge = on === true ? '<span class="sc-state is-on">已开启</span>' : on === false ? '<span class="sc-state">未开启</span>' : '<span class="sc-state is-manual">手动确认</span>';
        return `<div class="sc-check"><span><strong>${escape(title)}</strong><small>${escape(text)}</small></span>${badge}<button type="button" class="mh-text-button" data-sc-open="${kind}">去设置</button></div>`;
    }
    function renderSection() {
        const android = bridge();
        const head = '<div class="mh-section-heading"><h2 id="sc-title">后台陪伴（仅安卓）</h2></div>';
        if (!android) return `<section class="sc-section" aria-labelledby="sc-title">${head}<p class="mh-inline-note">后台陪伴需要 BYND 安卓 App：离开 BYND 后，桌宠会浮在其他应用上层陪你，偶尔说一句。网页版无法在后台显示。</p></section>`;
        const settings = readSettings(), info = nativeStatus(), oem = info.oem || 'other';
        const option = (list, value) => list.map(item => `<option value="${item}" ${item === value ? 'selected' : ''}>每 ${item} 分钟</option>`).join('');
        const screenText = !settings.watchScreen ? '关闭时只读取当前应用的名称' : info.projection ? '本次已授权 · 截图只在内存中' : '需要在系统弹窗里授权';
        const running = settings.enabled ? info.running ? info.paused ? '已暂停陪看' : '运行中 · 离开 BYND 后出现' : !info.overlay ? '还差「显示在其他应用上层」权限' : '准备中' : '离开 BYND 后，TA 浮在其他应用上层陪你';
        return `<section class="sc-section" aria-labelledby="sc-title">${head}
            <div class="mh-settings-block sc-block">
                <div class="sc-row"><span><strong>后台陪伴</strong><small>${escape(running)}</small></span><button type="button" class="mh-switch" role="switch" aria-label="后台陪伴" aria-checked="${settings.enabled}" data-sc-action="toggle-enabled"><span></span></button></div>
                <div class="sc-row"><span><strong>看屏幕</strong><small>${escape(screenText)}</small></span><button type="button" class="mh-switch" role="switch" aria-label="看屏幕" aria-checked="${settings.watchScreen}" data-sc-action="toggle-screen"><span></span></button></div>
                <label class="sc-row"><span><strong>看一眼的频率</strong><small>切换应用时也会看一眼，画面没变就不打扰</small></span><select id="sc-interval" data-sc-field="intervalMin">${option(INTERVALS, settings.intervalMin)}</select></label>
                <label class="sc-row"><span><strong>最短说话间隔</strong><small>两次开口之间至少隔这么久</small></span><select id="sc-gap" data-sc-field="minGapMin">${option(GAPS, settings.minGapMin)}</select></label>
            </div>
            <div class="mh-privacy-note"><i class="ri-shield-check-line" aria-hidden="true"></i><p>截图只发送给你自己配置的模型 API，不保存。银行、支付、密码类应用和 BYND 自身不会被读取；受保护的黑屏页面只按应用名称说话。${visionUnsupported(settings) ? '当前模型不支持看图，已自动改为只看应用名称。' : ''}</p></div>
            <div class="mh-settings-block sc-checklist">
                ${checkRow('overlay', '显示在其他应用上层', '桌宠浮在其他应用上层所必需', info.overlay === true)}
                ${checkRow('usage', '使用情况访问', '知道你正在用哪个应用（必需）', info.usage === true)}
                ${checkRow('notifications', '通知权限', '常驻通知里可暂停或关闭陪伴', info.notifications === true)}
                ${checkRow('battery', '忽略电池优化', '避免系统在后台停止陪伴', info.battery === true)}
                ${oem !== 'other' ? checkRow('autostart', '自启动', '部分系统需要才能保持后台运行', null) + checkRow('popup', '后台弹出界面 / 悬浮窗', '系统自带的悬浮窗开关', null) + checkRow('power', '省电策略', '选择「无限制」或允许后台运行', null) + checkRow('game', '游戏助手免打扰', '把 BYND 加入悬浮窗白名单，玩游戏时也在', null) : ''}
                <p class="sc-guide">${escape(oemGuides[oem] || '部分系统还需要在最近任务里锁定 BYND（下拉或长按卡片 → 锁定），避免被清理。')}${oemGuides[oem] ? ' 另外在最近任务里锁定 BYND（下拉或长按卡片 → 锁定）。' : ''}</p>
            </div>
            <details class="sc-exclusions"><summary>不读取的应用（默认 ${DEFAULT_EXCLUDED.length} 个 + 自定义 ${settings.exclusions.length} 个）</summary>
                <p>默认跳过银行、支付、钱包、密码管理与系统设置。每行填一个包名前缀即可追加，例如 com.tencent.mm（微信）。</p>
                <textarea id="sc-exclusions" data-sc-field="exclusions" rows="3" spellcheck="false" placeholder="com.tencent.mm">${escape(settings.exclusions.join('\n'))}</textarea></details>
            <div class="sc-actions"><button type="button" class="mh-secondary" data-sc-action="test">测试一下</button><button type="button" class="mh-text-button" data-sc-action="refresh">刷新权限状态</button></div>
            <p class="mh-inline-note" role="status" data-sc-status>${escape(state.note)}</p>
        </section>`;
    }
    async function test() {
        const android = bridge();
        if (!android) { toast('后台陪伴仅在安卓 App 中可用'); return { spoke: false, reason: 'web' }; }
        const info = nativeStatus();
        note('正在测试…');
        const result = await onContext({ package: info.lastPackage || 'com.example.companion.test', label: info.lastLabel || '（测试）某个应用', imageDataUrl: null, at: Date.now(), reason: 'test', secure: false });
        if (!result.spoke) {
            const reasons = { 'no-pet': '请先开启桌宠并绑定互动角色。', busy: '上一次陪看还在进行。', excluded: '最近的应用在排除列表里。' };
            if (reasons[result.reason]) note(reasons[result.reason]);
            toast(state.note || '这次 TA 选择安静地陪着。');
        }
        return result;
    }
    async function act(target) {
        const android = bridge();
        if (target.dataset.scOpen) {
            if (!android) return;
            const opened = android.openCompanionSetting(target.dataset.scOpen);
            if (opened === 'fallback') note('没找到对应的系统页面，已打开 BYND 的应用详情，请在里面查找相关开关。');
            else if (opened === 'failed') note('无法打开系统设置，请手动前往。');
            return;
        }
        const settings = readSettings();
        switch (target.dataset.scAction) {
            case 'toggle-enabled': {
                if (!android) { toast('后台陪伴仅在安卓 App 中可用'); return; }
                const enabled = !settings.enabled;
                saveSettings({ enabled });
                const info = nativeStatus();
                if (enabled && !info.overlay) note('请允许「显示在其他应用上层」，返回 BYND 后自动生效。');
                else if (enabled && !info.usage) note('再允许「使用情况访问」，TA 才知道你在看什么。');
                else note(enabled ? '已开启。离开 BYND 后，TA 会在屏幕边陪你。' : '后台陪伴已关闭。');
                if (!enabled && settings.watchScreen) android.stopCompanionScreenWatch?.();
                syncNative();
                if (enabled) pushFrames(true);
                break;
            }
            case 'toggle-screen': {
                if (!android) return;
                if (!settings.watchScreen && !settings.enabled) { note('请先开启后台陪伴。'); break; }
                const watchScreen = !settings.watchScreen;
                const noVision = { ...settings.noVision };
                if (watchScreen) delete noVision[visionKey()];
                saveSettings({ watchScreen, noVision });
                syncNative();
                if (watchScreen) { android.startCompanionScreenWatch?.(); note('请在系统弹窗中选择「整个屏幕」。截图只发送给你配置的模型，不保存。'); }
                else { android.stopCompanionScreenWatch?.(); note('已关闭看屏幕，只读取应用名称。'); }
                break;
            }
            case 'test': await test(); break;
            case 'refresh': note(''); break;
            default: return;
        }
        rerender();
    }
    let exclusionTimer = 0;
    function onField(event) {
        const field = event.target?.dataset?.scField;
        if (!field) return;
        if (field === 'exclusions') {
            clearTimeout(exclusionTimer);
            const value = event.target.value;
            exclusionTimer = setTimeout(() => { saveSettings({ exclusions: parseExclusions(value) }); syncNative(); }, event.type === 'change' ? 0 : 600);
            return;
        }
        if (event.type !== 'change') return;
        saveSettings({ [field]: Number(event.target.value) });
        syncNative();
    }
    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('click', event => {
            const target = event.target?.closest?.('[data-sc-action], [data-sc-open]');
            if (target) act(target).catch(error => note(error?.message || '操作未完成'));
        });
        document.addEventListener('change', onField);
        document.addEventListener('input', onField);
        document.addEventListener('visibilitychange', () => {
            if (!bridge() || !readSettings().enabled) return;
            // Hand the overlay the latest pet look as BYND leaves; refresh permission states on return.
            if (document.hidden) pushFrames();
            else { syncNative(); rerender(); }
        });
    }
    let frameTimer = 0;
    window.addEventListener?.('bynd:character-pet', () => {
        if (!bridge() || !readSettings().enabled) return;
        clearTimeout(frameTimer);
        frameTimer = setTimeout(() => pushFrames(), 1500);
    });
    if (bridge()) setTimeout(() => { if (readSettings().enabled) { syncNative(); pushFrames(); } }, 3000);

    window.ByndScreenCompanion = {
        onContext, onNativeState, gate, interpret, buildMessages, screenImage, isExcluded, exclusionList, parseExclusions,
        settings: readSettings, saveSettings, syncNative, pushFrames, renderSection, test, status: nativeStatus,
        DEFAULT_EXCLUDED, MAX_TEXT, _state: state
    };
})();
