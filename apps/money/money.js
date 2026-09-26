// --- Money App / 记账 ---
const MONEY_RECORDS_KEY = 'bynd_money_records_v1';
const MONEY_ACTIVE_TAB_KEY = 'bynd_money_active_tab_v1';
let moneyActiveTab = 'home';
let moneySearchText = '';
let moneyCategoryFilter = 'all';

const MONEY_TABS = [
    { id: 'home', label: '首页', icon: 'ri-home-5-fill' },
    { id: 'records', label: '明细', icon: 'ri-list-check-3' },
    { id: 'stats', label: '统计', icon: 'ri-pie-chart-2-line' },
    { id: 'settings', label: '设置', icon: 'ri-settings-3-line' }
];

const MONEY_CATEGORIES = [
    { name: '餐饮', icon: 'ri-restaurant-line' },
    { name: '交通', icon: 'ri-taxi-line' },
    { name: '购物', icon: 'ri-shopping-bag-3-line' },
    { name: '医疗', icon: 'ri-heart-pulse-line' },
    { name: '生活', icon: 'ri-home-5-line' },
    { name: '学习', icon: 'ri-book-open-line' },
    { name: '娱乐', icon: 'ri-gamepad-line' },
    { name: '日常', icon: 'ri-wallet-3-line' }
];

function getMoneyRecords() {
    try {
        const records = JSON.parse(localStorage.getItem(MONEY_RECORDS_KEY) || '[]');
        return Array.isArray(records) ? records : [];
    } catch (e) {
        return [];
    }
}

function saveMoneyRecords(records) {
    localStorage.setItem(MONEY_RECORDS_KEY, JSON.stringify(Array.isArray(records) ? records : []));
}

function formatMoneyDate(value, mode = 'time') {
    const date = value ? new Date(value) : new Date();
    const safe = Number.isNaN(date.getTime()) ? new Date() : date;
    if (mode === 'day') return `${safe.getMonth() + 1}月${safe.getDate()}日`;
    if (mode === 'month') return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, '0')}`;
    if (mode === 'full') return `${safe.getFullYear()}-${String(safe.getMonth() + 1).padStart(2, '0')}-${String(safe.getDate()).padStart(2, '0')} ${String(safe.getHours()).padStart(2, '0')}:${String(safe.getMinutes()).padStart(2, '0')}`;
    return `${String(safe.getHours()).padStart(2, '0')}:${String(safe.getMinutes()).padStart(2, '0')}`;
}

function getMoneyCategory(title) {
    const text = String(title || '');
    if (/奶|咖啡|茶|包子|饭|餐|吃|面|粉|鸡|肉|菜|水果|早餐|午餐|晚餐|夜宵/.test(text)) return { name: '餐饮', icon: 'ri-restaurant-line' };
    if (/车|打车|地铁|公交|高铁|机票|油/.test(text)) return { name: '交通', icon: 'ri-taxi-line' };
    if (/衣|鞋|包|化妆|美妆|护肤|口红|买/.test(text)) return { name: '购物', icon: 'ri-shopping-bag-3-line' };
    if (/药|医院|挂号|牙|检查/.test(text)) return { name: '医疗', icon: 'ri-heart-pulse-line' };
    if (/房租|水电|电费|话费|网费/.test(text)) return { name: '生活', icon: 'ri-home-5-line' };
    if (/书|课|学习|考试|文具|课程/.test(text)) return { name: '学习', icon: 'ri-book-open-line' };
    if (/电影|游戏|会员|演唱会|玩/.test(text)) return { name: '娱乐', icon: 'ri-gamepad-line' };
    return { name: '日常', icon: 'ri-wallet-3-line' };
}

function getMoneyCategoryMeta(name) {
    return MONEY_CATEGORIES.find(item => item.name === name) || getMoneyCategory(name) || MONEY_CATEGORIES[MONEY_CATEGORIES.length - 1];
}

function cleanupMoneyItemName(raw) {
    let text = String(raw || '')
        .replace(/[，,。；;、]/g, ' ')
        .replace(/\d+(?:\.\d+)?\s*(元|块|rmb|RMB)?/g, ' ')
        .replace(/(今天|早上|上午|中午|下午|晚上|夜里|刚刚|然后|还有|另外|我|给|在|去|了|的)/g, ' ')
        .replace(/(吃了|买了|花了|花|用了|消费|支出|付款|付了|付|买|吃|喝)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const parts = text.split(/\s+/).filter(Boolean);
    text = parts[parts.length - 1] || text;
    return text.slice(-10) || '消费';
}

function parseMoneyExpenses(text) {
    const source = String(text || '').replace(/[¥￥]/g, '元');
    const records = [];
    const pattern = /([\u4e00-\u9fa5A-Za-z0-9_·\s，,。；;、]{0,24}?)(花了|花|用了|消费|支出|付款|付了|付|买了|买)?\s*(\d+(?:\.\d+)?)(\s*(元|块|rmb|RMB))?/g;
    let match;
    while ((match = pattern.exec(source))) {
        const hasSpendVerb = !!match[2];
        const hasCurrencyUnit = !!match[5];
        if (!hasSpendVerb && !hasCurrencyUnit) continue;
        const amount = Number(match[3]);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 999999) continue;
        const before = source.slice(0, match.index + match[1].length);
        const chunk = before.split(/[，,。；;、\n]/).pop() || match[1] || '';
        const title = cleanupMoneyItemName(chunk);
        if (!title || /^\d+$/.test(title)) continue;
        records.push({ title, amount });
    }
    const deduped = [];
    records.forEach(item => {
        const key = `${item.title}-${item.amount}`;
        if (!deduped.some(old => `${old.title}-${old.amount}` === key)) deduped.push(item);
    });
    return deduped.slice(0, 8);
}

function addMoneyRecord(record) {
    const records = getMoneyRecords();
    const amount = Number(record?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const category = typeof record.category === 'string' ? getMoneyCategoryMeta(record.category) : (record.category || getMoneyCategory(record.title));
    const next = {
        id: record.id || `money_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
        title: String(record.title || '消费').trim().slice(0, 24),
        amount: Math.round(amount * 100) / 100,
        category: category.name || '日常',
        icon: category.icon || 'ri-wallet-3-line',
        source: record.source || 'manual',
        charId: record.charId || '',
        charName: record.charName || '',
        note: record.note || '',
        createdAt: record.createdAt || Date.now(),
        done: !!record.done
    };
    records.unshift(next);
    saveMoneyRecords(records.slice(0, 500));
    if (document.getElementById('app-money-window')?.classList.contains('active')) renderMoneyApp();
    return next;
}

function captureMoneyExpensesFromText(text, source = {}) {
    const expenses = parseMoneyExpenses(text);
    if (!expenses.length) return [];
    const added = expenses.map(item => addMoneyRecord({
        ...item,
        source: source.source || 'wechat',
        charId: source.charId || '',
        charName: source.charName || '',
        note: String(text || '').slice(0, 120)
    })).filter(Boolean);
    if (added.length && typeof showWechatToast === 'function') {
        showWechatToast(`已记账 ${added.length} 笔`);
    }
    return added;
}
window.captureMoneyExpensesFromText = captureMoneyExpensesFromText;

function isMoneyRecordToday(item) {
    return new Date(item.createdAt || Date.now()).toDateString() === new Date().toDateString();
}

function getMoneySummary(records) {
    const now = new Date();
    const monthKey = formatMoneyDate(now, 'month');
    const todayKey = now.toDateString();
    return records.reduce((acc, item) => {
        const date = new Date(item.createdAt || Date.now());
        if (formatMoneyDate(date, 'month') === monthKey) acc.month += Number(item.amount) || 0;
        if (date.toDateString() === todayKey) {
            acc.today += Number(item.amount) || 0;
            acc.todayCount += 1;
        }
        acc.total += Number(item.amount) || 0;
        return acc;
    }, { month: 0, today: 0, total: 0, todayCount: 0 });
}

function getMoneyStats(records) {
    const byCategory = {};
    records.forEach(item => {
        const category = item.category || '日常';
        if (!byCategory[category]) byCategory[category] = { category, total: 0, count: 0, icon: item.icon || getMoneyCategoryMeta(category).icon };
        byCategory[category].total += Number(item.amount) || 0;
        byCategory[category].count += 1;
    });
    return Object.values(byCategory).sort((a, b) => b.total - a.total);
}

function getMoneyFilteredRecords(records) {
    const query = moneySearchText.trim().toLowerCase();
    return records.filter(item => {
        const categoryOk = moneyCategoryFilter === 'all' || item.category === moneyCategoryFilter;
        const haystack = `${item.title || ''} ${item.category || ''} ${item.note || ''} ${item.charName || ''}`.toLowerCase();
        const queryOk = !query || haystack.includes(query);
        return categoryOk && queryOk;
    });
}

function renderMoneyRecordItem(item, options = {}) {
    const compact = !!options.compact;
    return `
        <div class="money-record-item ${item.done ? 'done' : ''}">
            <button type="button" class="money-record-main" onclick="toggleMoneyRecord('${musicEscapeAttr(item.id)}')">
                <i class="${musicEscapeAttr(item.icon || 'ri-wallet-3-line')}"></i>
                <div>
                    <strong>${musicEscapeHtml(item.title)}</strong>
                    <span>${musicEscapeHtml(item.category || '日常')} · ${musicEscapeHtml(compact ? formatMoneyDate(item.createdAt) : formatMoneyDate(item.createdAt, 'full'))}${item.charName ? ` · 来自 ${musicEscapeHtml(item.charName)}` : ''}</span>
                </div>
                <em>-￥${Number(item.amount || 0).toFixed(2)}</em>
            </button>
            ${compact ? '' : `
                <div class="money-record-actions">
                    <button type="button" onclick="editMoneyRecord('${musicEscapeAttr(item.id)}')"><i class="ri-edit-line"></i> 编辑</button>
                    <button type="button" onclick="deleteMoneyRecord('${musicEscapeAttr(item.id)}')"><i class="ri-delete-bin-line"></i> 删除</button>
                </div>
            `}
        </div>
    `;
}

function renderMoneyEmpty(text = '在微信里说“早餐包子花了4.5，牛奶3块”，这里会自动出现。') {
    return `
        <div class="money-empty">
            <i class="ri-chat-quote-line"></i>
            <strong>还没有账单</strong>
            <span>${musicEscapeHtml(text)}</span>
        </div>
    `;
}

function renderMoneyHome(records, summary, profile) {
    const todayRecords = records.filter(isMoneyRecordToday);
    const visible = todayRecords.length ? todayRecords.slice(0, 5) : records.slice(0, 5);
    return `
        <section class="money-hello">
            <div>
                <span>HELLO, <b>${musicEscapeHtml(profile.name || 'BYND')}</b></span>
                <strong>今天的消费已经整理好了</strong>
            </div>
            <em>${summary.todayCount} 笔</em>
        </section>
        <section class="money-id-card">
            <div class="money-id-main">
                <span>MONTHLY SPEND</span>
                <strong>￥${summary.month.toFixed(2)}</strong>
                <p>今日 ￥${summary.today.toFixed(2)} · 累计 ￥${summary.total.toFixed(2)}</p>
            </div>
            <div class="money-id-side">
                <i class="ri-wallet-3-line"></i>
                <div class="money-barcode"><span></span><span></span><span></span><span></span><span></span></div>
            </div>
        </section>
        <section class="money-list-card">
            <div class="money-section-head">
                <div><span>RECORDS</span><strong>${todayRecords.length ? '今日记录' : '最近记录'}</strong></div>
                <button type="button" onclick="addManualMoneyRecord()">+ 记一笔</button>
            </div>
            <div class="money-record-list">${visible.length ? visible.map(item => renderMoneyRecordItem(item, { compact: true })).join('') : renderMoneyEmpty()}</div>
        </section>
    `;
}

function renderMoneyRecords(records) {
    const categories = ['all', ...Array.from(new Set(records.map(item => item.category || '日常')))];
    const filtered = getMoneyFilteredRecords(records);
    return `
        <section class="money-list-card money-records-page">
            <div class="money-section-head">
                <div><span>DETAILS</span><strong>消费明细</strong></div>
                <button type="button" onclick="addManualMoneyRecord()">+ 记一笔</button>
            </div>
            <label class="money-search">
                <i class="ri-search-line"></i>
                <input type="search" value="${musicEscapeAttr(moneySearchText)}" placeholder="搜索内容、分类或角色" oninput="setMoneySearch(this.value)">
            </label>
            <div class="money-filter-row">
                ${categories.map(category => `
                    <button type="button" class="${moneyCategoryFilter === category ? 'active' : ''}" onclick="setMoneyCategoryFilter('${musicEscapeAttr(category)}')">${musicEscapeHtml(category === 'all' ? '全部' : category)}</button>
                `).join('')}
            </div>
            <div class="money-record-list">${filtered.length ? filtered.map(item => renderMoneyRecordItem(item)).join('') : renderMoneyEmpty('没有匹配到记录，换个关键词或分类试试。')}</div>
        </section>
    `;
}

function renderMoneyStats(records, summary) {
    const stats = getMoneyStats(records);
    const max = Math.max(1, ...stats.map(item => item.total));
    return `
        <section class="money-stats-hero">
            <span>THIS MONTH</span>
            <strong>￥${summary.month.toFixed(2)}</strong>
            <p>今日 ￥${summary.today.toFixed(2)} · 共 ${records.length} 笔记录</p>
        </section>
        <section class="money-list-card">
            <div class="money-section-head">
                <div><span>ANALYTICS</span><strong>分类统计</strong></div>
                <button type="button" onclick="switchMoneyTab('records')">看明细</button>
            </div>
            <div class="money-stat-list">
                ${stats.length ? stats.map(item => `
                    <div class="money-stat-item">
                        <i class="${musicEscapeAttr(item.icon || 'ri-wallet-3-line')}"></i>
                        <div>
                            <strong>${musicEscapeHtml(item.category)}</strong>
                            <span>${item.count} 笔 · ￥${item.total.toFixed(2)}</span>
                            <b style="width:${Math.max(8, Math.round((item.total / max) * 100))}%"></b>
                        </div>
                    </div>
                `).join('') : renderMoneyEmpty('还没有可统计的记录。')}
            </div>
        </section>
    `;
}

function renderMoneySettings(records, summary) {
    return `
        <section class="money-list-card money-settings-card">
            <div class="money-section-head">
                <div><span>SETTINGS</span><strong>记账设置</strong></div>
                <button type="button" onclick="addManualMoneyRecord()">+ 记一笔</button>
            </div>
            <div class="money-setting-grid">
                <button type="button" onclick="exportMoneyRecords()"><i class="ri-download-2-line"></i><strong>导出账本</strong><span>${records.length} 笔记录</span></button>
                <button type="button" onclick="importMoneyRecordsFromText()"><i class="ri-file-copy-2-line"></i><strong>粘贴导入</strong><span>支持 JSON</span></button>
                <button type="button" onclick="switchMoneyTab('stats')"><i class="ri-pie-chart-2-line"></i><strong>查看统计</strong><span>本月 ￥${summary.month.toFixed(2)}</span></button>
                <button type="button" class="danger" onclick="clearMoneyRecords()"><i class="ri-delete-bin-line"></i><strong>清空账本</strong><span>谨慎操作</span></button>
            </div>
        </section>
        <section class="money-help-card">
            <strong>微信自动记账</strong>
            <p>在微信聊天里发送“早上吃了包子花了4.5，牛奶3块”，会自动拆成多条记录。明细页可以编辑、删除和按分类筛选。</p>
        </section>
    `;
}

function renderMoneyTabbar() {
    const tabbar = document.getElementById('money-tabbar');
    if (!tabbar) return;
    tabbar.innerHTML = MONEY_TABS.map(tab => `
        <button type="button" class="${moneyActiveTab === tab.id ? 'active' : ''}" onclick="switchMoneyTab('${musicEscapeAttr(tab.id)}')">
            <i class="${musicEscapeAttr(tab.icon)}"></i><span>${musicEscapeHtml(tab.label)}</span>
        </button>
    `).join('');
}

function renderMoneyApp() {
    const content = document.getElementById('money-content');
    if (!content) return;
    const records = getMoneyRecords();
    const summary = getMoneySummary(records);
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    if (!MONEY_TABS.some(tab => tab.id === moneyActiveTab)) moneyActiveTab = 'home';
    if (moneyActiveTab === 'records') content.innerHTML = renderMoneyRecords(records);
    else if (moneyActiveTab === 'stats') content.innerHTML = renderMoneyStats(records, summary);
    else if (moneyActiveTab === 'settings') content.innerHTML = renderMoneySettings(records, summary);
    else content.innerHTML = renderMoneyHome(records, summary, profile);
    renderMoneyTabbar();
}

function initMoneyApp() {
    const saved = localStorage.getItem(MONEY_ACTIVE_TAB_KEY);
    moneyActiveTab = MONEY_TABS.some(tab => tab.id === saved) ? saved : 'home';
    renderMoneyApp();
}
window.initMoneyApp = initMoneyApp;

function switchMoneyTab(tab) {
    moneyActiveTab = MONEY_TABS.some(item => item.id === tab) ? tab : 'home';
    localStorage.setItem(MONEY_ACTIVE_TAB_KEY, moneyActiveTab);
    renderMoneyApp();
}
window.switchMoneyTab = switchMoneyTab;

function setMoneySearch(value) {
    moneySearchText = String(value || '');
    const list = document.querySelector('.money-records-page .money-record-list');
    if (!list) {
        renderMoneyApp();
        return;
    }
    const filtered = getMoneyFilteredRecords(getMoneyRecords());
    list.innerHTML = filtered.length ? filtered.map(item => renderMoneyRecordItem(item)).join('') : renderMoneyEmpty('没有匹配到记录，换个关键词或分类试试。');
}
window.setMoneySearch = setMoneySearch;

function setMoneyCategoryFilter(category) {
    moneyCategoryFilter = category || 'all';
    renderMoneyApp();
}
window.setMoneyCategoryFilter = setMoneyCategoryFilter;

function getMoneySheetCategoryButtons(activeCategory) {
    const active = getMoneyCategoryMeta(activeCategory || '日常').name;
    return MONEY_CATEGORIES.map(category => `
        <button type="button" class="${category.name === active ? 'active' : ''}" data-money-category="${musicEscapeAttr(category.name)}" onclick="selectMoneySheetCategory('${musicEscapeAttr(category.name)}')">
            <i class="${musicEscapeAttr(category.icon)}"></i><span>${musicEscapeHtml(category.name)}</span>
        </button>
    `).join('');
}

function openMoneyManualSheet(record = null) {
    closeMoneyManualSheet(true);
    const editing = !!record;
    const category = getMoneyCategoryMeta(record?.category || record?.title || '日常');
    const host = document.querySelector('#app-money-window .money-shell') || document.getElementById('app-money-window') || document.body;
    const sheet = document.createElement('div');
    sheet.id = 'money-manual-sheet';
    sheet.className = 'money-sheet-overlay';
    sheet.innerHTML = `
        <button type="button" class="money-sheet-backdrop" onclick="closeMoneyManualSheet()" aria-label="关闭记账表单"></button>
        <form class="money-sheet" onsubmit="submitMoneyManualSheet(event)">
            <div class="money-sheet-grip"></div>
            <div class="money-sheet-head">
                <div>
                    <span>${editing ? 'EDIT RECORD' : 'NEW RECORD'}</span>
                    <strong>${editing ? '编辑这笔账' : '记一笔'}</strong>
                </div>
                <button type="button" onclick="closeMoneyManualSheet()" aria-label="关闭"><i class="ri-close-line"></i></button>
            </div>
            <input type="hidden" id="money-sheet-id" value="${musicEscapeAttr(record?.id || '')}">
            <label class="money-field">
                <span>花在什么上</span>
                <input id="money-sheet-title" type="text" value="${musicEscapeAttr(record?.title || '')}" placeholder="比如 包子、牛奶、日语教材" autocomplete="off">
            </label>
            <label class="money-field">
                <span>金额</span>
                <input id="money-sheet-amount" type="number" inputmode="decimal" min="0" step="0.01" value="${record?.amount ? musicEscapeAttr(String(record.amount)) : ''}" placeholder="0.00">
            </label>
            <div class="money-field">
                <span>分类</span>
                <div class="money-category-picker" id="money-sheet-categories">${getMoneySheetCategoryButtons(category.name)}</div>
            </div>
            <label class="money-field">
                <span>备注</span>
                <textarea id="money-sheet-note" rows="2" placeholder="可选">${musicEscapeHtml(record?.note || '')}</textarea>
            </label>
            <button type="submit" class="money-sheet-submit">${editing ? '保存修改' : '保存这笔'}</button>
        </form>
    `;
    host.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
    setTimeout(() => document.getElementById('money-sheet-title')?.focus(), 120);
}
window.openMoneyManualSheet = openMoneyManualSheet;

function closeMoneyManualSheet(immediate = false) {
    const sheet = document.getElementById('money-manual-sheet');
    if (!sheet) return;
    if (immediate) {
        sheet.remove();
        return;
    }
    sheet.classList.remove('show');
    setTimeout(() => sheet.remove(), 180);
}
window.closeMoneyManualSheet = closeMoneyManualSheet;

function selectMoneySheetCategory(category) {
    const picker = document.getElementById('money-sheet-categories');
    if (!picker) return;
    picker.querySelectorAll('button').forEach(button => {
        button.classList.toggle('active', button.dataset.moneyCategory === category);
    });
}
window.selectMoneySheetCategory = selectMoneySheetCategory;

function submitMoneyManualSheet(event) {
    event?.preventDefault?.();
    const id = document.getElementById('money-sheet-id')?.value || '';
    const title = document.getElementById('money-sheet-title')?.value?.trim() || '';
    const amount = Number(document.getElementById('money-sheet-amount')?.value || 0);
    const activeCategory = document.querySelector('#money-sheet-categories button.active')?.dataset.moneyCategory || getMoneyCategory(title).name;
    const note = document.getElementById('money-sheet-note')?.value?.trim() || '';
    if (!title) {
        if (typeof showWechatToast === 'function') showWechatToast('先写这笔钱花在什么上');
        else alert('先写这笔钱花在什么上');
        return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        if (typeof showWechatToast === 'function') showWechatToast('金额不正确');
        else alert('金额不正确');
        return;
    }
    if (id) {
        const records = getMoneyRecords();
        const item = records.find(record => record.id === id);
        if (item) {
            const category = getMoneyCategoryMeta(activeCategory);
            item.title = title.slice(0, 24);
            item.amount = Math.round(amount * 100) / 100;
            item.category = category.name;
            item.icon = category.icon;
            item.note = note;
            item.updatedAt = Date.now();
            saveMoneyRecords(records);
        }
    } else {
        addMoneyRecord({ title, amount, category: activeCategory, note, source: 'manual' });
    }
    closeMoneyManualSheet();
    renderMoneyApp();
}
window.submitMoneyManualSheet = submitMoneyManualSheet;

function toggleMoneyRecord(id) {
    const records = getMoneyRecords();
    const item = records.find(record => record.id === id);
    if (item) item.done = !item.done;
    saveMoneyRecords(records);
    renderMoneyApp();
}
window.toggleMoneyRecord = toggleMoneyRecord;

function editMoneyRecord(id) {
    const records = getMoneyRecords();
    const item = records.find(record => record.id === id);
    if (!item) return;
    openMoneyManualSheet(item);
}
window.editMoneyRecord = editMoneyRecord;

function deleteMoneyRecord(id) {
    const records = getMoneyRecords();
    const item = records.find(record => record.id === id);
    if (!item) return;
    if (!confirm(`删除「${item.title}」这笔记录？`)) return;
    saveMoneyRecords(records.filter(record => record.id !== id));
    renderMoneyApp();
}
window.deleteMoneyRecord = deleteMoneyRecord;

function addManualMoneyRecord() {
    openMoneyManualSheet();
}
window.addManualMoneyRecord = addManualMoneyRecord;

function exportMoneyRecords() {
    const records = getMoneyRecords();
    const payload = JSON.stringify({ version: 'bynd-money-v1', exportedAt: new Date().toISOString(), records }, null, 2);
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(payload).then(() => alert('账本 JSON 已复制到剪贴板')).catch(() => prompt('复制账本 JSON', payload));
    } else {
        prompt('复制账本 JSON', payload);
    }
}
window.exportMoneyRecords = exportMoneyRecords;

function importMoneyRecordsFromText() {
    const text = prompt('粘贴账本 JSON');
    if (!text) return;
    try {
        const data = JSON.parse(text);
        const incoming = Array.isArray(data) ? data : data.records;
        if (!Array.isArray(incoming)) throw new Error('没有 records 数组');
        const normalized = incoming.map(item => {
            const category = getMoneyCategoryMeta(item.category || item.title || '日常');
            return {
                id: item.id || `money_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
                title: String(item.title || '消费').slice(0, 24),
                amount: Math.max(0, Number(item.amount) || 0),
                category: category.name,
                icon: item.icon || category.icon,
                source: item.source || 'import',
                charId: item.charId || '',
                charName: item.charName || '',
                note: item.note || '',
                createdAt: item.createdAt || Date.now(),
                done: !!item.done
            };
        }).filter(item => item.amount > 0);
        saveMoneyRecords([...normalized, ...getMoneyRecords()].slice(0, 500));
        alert(`已导入 ${normalized.length} 笔`);
        renderMoneyApp();
    } catch (e) {
        alert('导入失败：' + e.message);
    }
}
window.importMoneyRecordsFromText = importMoneyRecordsFromText;

function clearMoneyRecords() {
    if (!confirm('确定清空所有记账记录？')) return;
    saveMoneyRecords([]);
    renderMoneyApp();
}
window.clearMoneyRecords = clearMoneyRecords;

