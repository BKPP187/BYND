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
    window.ByndCharacterTools?.renderSettings();
    renderPresetList();
    initFontSettings();
    if (typeof renderProactiveNotifySettings === 'function') renderProactiveNotifySettings();
    openSettingsTab(readSettingsTab(), { persist: false, smooth: false });
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
    const nav = win.querySelector('.set-nav');
    win.querySelectorAll('[data-settings-tab]').forEach(tab => {
        const active = tab.dataset.settingsTab === target;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        if (active && nav) {
            nav.scrollTo?.({ left: Math.max(0, tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2), behavior: options.smooth === false ? 'auto' : 'smooth' });
        }
    });
    const content = win.querySelector('.window-content');
    if (content) content.scrollTop = 0;
    if (options.persist !== false) {
        try { localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, target); } catch (e) {}
    }
    if (target === 'usage') void renderSettingsUsageDashboard();
    return target;
}
window.openSettingsTab = openSettingsTab;

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

