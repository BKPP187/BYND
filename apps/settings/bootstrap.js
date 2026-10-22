// --- ⚙️ apps/settings/settings.js: 设置 App (API 连接管理 + 字体设置) ---

const API_STORAGE_KEY = 'my_api_data';
const FONT_STORAGE_KEY = 'my_font_data';
const DEFAULT_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
let fontApplyToken = 0;

const FONT_PRESETS = [
    { id: 'system', name: '系统默认', family: DEFAULT_FONT_FAMILY, sample: '你好' },
    { id: 'serif', name: '衬线体', family: '"Noto Serif SC", "Songti SC", "SimSun", serif', sample: '你好' },
    { id: 'mono', name: '等宽体', family: '"JetBrains Mono", "Fira Code", "Consolas", monospace', sample: 'Code' },
    { id: 'rounded', name: '圆体', family: '"Yuanti SC", "HYYuanLiTiW", "Microsoft YaHei", sans-serif', sample: '你好' },
    { id: 'kai', name: '楷体', family: '"Kaiti SC", "STKaiti", "KaiTi", serif', sample: '你好' },
    { id: 'cursive', name: '手写体', family: '"Dancing Script", "Segoe Script", cursive', sample: 'Hello' },
];

// 1. 初始化
function initSettings() {
    renderApiList();
    window.ByndJev?.renderSettings();
    window.ByndTripo?.renderSettings();
    window.ByndVivix?.renderSettings();
    renderPresetList();
    initFontSettings();
    if (typeof renderProactiveNotifySettings === 'function') renderProactiveNotifySettings();
    // Settings opens on the grouped list. Links that need a page (for example
    // the video call shortcut) open their page right after this.
    openSettingsHome();
}

// --- Settings tab navigation ---
const SETTINGS_TAB_STORAGE_KEY = 'bynd_settings_tab_v1';
const SETTINGS_DEFAULT_TAB = 'api';

function readSettingsTab() {
    try { return localStorage.getItem(SETTINGS_TAB_STORAGE_KEY) || SETTINGS_DEFAULT_TAB; } catch (e) { return SETTINGS_DEFAULT_TAB; }
}

function openSettingsTab(name, options = {}) {
    const win = document.getElementById('app-settings-window');
    if (!win) return null;
    const panels = Array.from(win.querySelectorAll('[data-settings-panel]'));
    if (!panels.length) return null;
    const target = panels.some(panel => panel.dataset.settingsPanel === name) ? name : SETTINGS_DEFAULT_TAB;
    panels.forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== target; });
    let title = '';
    win.querySelectorAll('[data-settings-tab]').forEach(tab => {
        const active = tab.dataset.settingsTab === target;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        if (active) title = tab.querySelector?.('.set-row-title')?.textContent || '';
    });
    // Two-level layout: the list (.set-nav) is the home page, a panel is a detail page.
    win.classList?.add('settings-detail');
    const heading = win.querySelector('#settings-title');
    if (heading) heading.textContent = title || '设置';
    const content = win.querySelector('.window-content');
    if (content) content.scrollTop = 0;
    if (options.persist !== false) {
        try { localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, target); } catch (e) {}
    }
    if (target === 'usage') void renderSettingsUsageDashboard();
    if (target === 'lab') window.ByndPromptLab?.render();
    if (target === 'about') window.ByndVersionLetter?.renderAbout();
    return target;
}
window.openSettingsTab = openSettingsTab;

function openSettingsHome() {
    const win = document.getElementById('app-settings-window');
    if (!win) return;
    win.classList.remove('settings-detail');
    const heading = win.querySelector('#settings-title');
    if (heading) heading.textContent = '设置';
    const nav = win.querySelector('.set-nav');
    if (nav) nav.scrollTop = 0;
    renderSettingsSummaries();
}
window.openSettingsHome = openSettingsHome;

// One short status per row, so the list answers "what is set up" without opening pages.
function getSettingsSummaries() {
    const safe = read => { try { return read() || ''; } catch (_) { return ''; } };
    return {
        api: safe(() => {
            const data = getApiData();
            const chat = data.apis.find(api => api.id === data.defaultId && api.model);
            return chat ? `${chat.name || '聊天接口'} · ${chat.model}` : (data.apis.length ? '未选默认' : '未添加');
        }),
        voice: safe(() => {
            const data = getApiData();
            const ready = [
                isApiVoiceEnabled(normalizeVoiceApiData(data.voiceApi)),
                isOpenAiVoiceEnabled(normalizeOpenAiVoiceApiData(data.openAiVoiceApi)),
                isFishAudioVoiceEnabled(normalizeFishAudioVoiceApiData(data.fishAudioVoiceApi)),
                isElevenLabsVoiceEnabled(normalizeElevenLabsVoiceApiData(data.elevenLabsVoiceApi)),
                isLocalVoiceEnabled(normalizeLocalVoiceApiData(data.localVoiceApi))
            ].filter(Boolean).length;
            return ready ? `${ready} 个已启用` : '未启用';
        }),
        video: safe(() => (window.ByndVivix?.read()?.apiKey ? '已配置' : '未配置')),
        '3d': safe(() => (window.ByndTripo?.read()?.apiKey ? '已连接' : '未连接')),
        decision: safe(() => (window.ByndJev?.read()?.enabled ? 'Jev 辅助' : 'BYND 内置')),
        notify: safe(() => {
            if (typeof resolveProactiveNotifySettings !== 'function') return '';
            const settings = resolveProactiveNotifySettings();
            return settings.enabled ? formatProactiveNotifyInterval(settings.intervalHours) : '已关闭';
        }),
        font: safe(() => {
            const store = getFontStore();
            const custom = store.fonts.find(font => font.id === store.activeId);
            if (custom) return custom.name || '自定义字体';
            const preset = FONT_PRESETS.find(item => item.id === store.activeId);
            return preset ? preset.name : '系统默认';
        }),
        about: safe(() => (typeof APP_VERSION === 'string' ? APP_VERSION : ''))
    };
}

function renderSettingsSummaries() {
    const summaries = getSettingsSummaries();
    document.querySelectorAll('#app-settings-window [data-settings-summary]').forEach(el => {
        el.textContent = summaries[el.dataset.settingsSummary] || '';
    });
}

async function renderSettingsUsageDashboard() {
    const root = document.getElementById('bynd-usage-dashboard');
    if (!root) return;
    root.innerHTML = '<p class="set-nav-note">正在读取用量…</p>';
    const ledger = window.ByndUsageLedger;
    if (!ledger?.list) {
        root.innerHTML = '<p class="set-nav-note">账单尚未准备好，请稍后重试。</p>';
        return;
    }
    try {
        const entries = await ledger.list({ limit: 2000 });
        if (!root.isConnected) return;
        if (!entries.length) {
            root.innerHTML = '<div class="set-usage-empty"><i class="ri-bar-chart-box-line"></i><strong>还没有 API 用量记录</strong><span>聊天或使用工具后，这里会显示最近的用量。</span></div><button type="button" class="set-usage-open" onclick="openApp(\'bill\')">打开账单明细 <i class="ri-arrow-right-s-line"></i></button>';
            return;
        }
        const sum = key => entries.reduce((total, entry) => total + (Number(entry[key]) || 0), 0);
        const total = sum('total');
        const input = sum('input');
        const output = sum('output');
        const priced = entries.map(entry => ledger.costOf(entry)).filter(value => Number.isFinite(value));
        const cost = priced.reduce((a, b) => a + b, 0);
        const categories = new Map();
        for (const entry of entries) categories.set(entry.feature || 'other', (categories.get(entry.feature || 'other') || 0) + (Number(entry.total) || 0));
        const labels = new Map((ledger.FEATURES || []).map(item => [item.key, item.label]));
        const featureRows = [...categories].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, value]) => `<div class="set-usage-row"><span>${labels.get(key) || '其他'}</span><b>${value.toLocaleString('zh-CN')}</b></div>`).join('');
        root.innerHTML = `<div class="set-usage-summary"><div><small>最近 ${entries.length.toLocaleString('zh-CN')} 次请求</small><strong>${total.toLocaleString('zh-CN')}</strong><span>总 Token</span></div><div><small>参考费用</small><strong>${priced.length ? '$' + cost.toFixed(cost < 0.01 ? 4 : 2) : '—'}</strong><span>${priced.length < entries.length ? '部分模型暂无价格' : '按模型公开价格估算'}</span></div></div><div class="set-usage-split"><span>输入 ${input.toLocaleString('zh-CN')}</span><span>输出 ${output.toLocaleString('zh-CN')}</span></div><div class="set-usage-features"><h3>使用最多的功能</h3>${featureRows}</div><button type="button" class="set-usage-open" onclick="openApp('bill')">查看完整账单 <i class="ri-arrow-right-s-line"></i></button>`;
    } catch (error) {
        root.innerHTML = '<p class="set-nav-note">读取用量失败，请稍后重试。</p>';
        console.warn('用量汇总读取失败', error);
    }
}
// --- /Settings tab navigation ---
