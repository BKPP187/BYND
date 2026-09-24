// 账单 · TOKEN USAGE — a thermal-receipt dashboard over window.ByndUsageLedger.
// Drill path: 年度 → 月度 → 日 → 小时 → 分钟 → 秒 → API Request → 查看小票.
(function () {
    'use strict';

    const UNITS = ['year', 'month', 'day', 'hour', 'minute', 'second'];
    const UNIT_LABELS = { year: '年', month: '月', day: '日', hour: '时', minute: '分', second: '秒' };
    const METRICS = [
        { key: 'input', label: '输入' },
        { key: 'output', label: '输出' },
        { key: 'cacheRead', label: 'Cache Read' },
        { key: 'cacheWrite', label: 'Cache Write' },
        { key: 'total', label: '总 Token' },
        { key: 'cost', label: '成本' },
        { key: 'requests', label: '请求次数' }
    ];
    const FILTERS = [
        { key: 'provider', all: '全部 Provider' },
        { key: 'model', all: '全部模型' },
        { key: 'feature', all: '全部功能' },
        { key: 'charId', all: '全部角色' }
    ];
    const PRICE_FIELDS = [
        { key: 'input', label: '输入' },
        { key: 'output', label: '输出' },
        { key: 'cacheRead', label: '缓存读' },
        { key: 'cacheWrite', label: '缓存写' }
    ];
    const LEAF_DEPTH = 6; // a single second: request list only
    const YEAR_LOOKBACK = 9;
    const REQUEST_LIST_LIMIT = 300;
    const REQUEST_LIST_DEPTH = 4; // hour ranges and finer list individual requests
    const LIVE_DEBOUNCE_MS = 450;

    const state = {
        open: false,
        path: [],
        metric: 'total',
        filters: { provider: '', model: '', feature: '', charId: '' },
        selected: null,
        pricesOpen: false,
        model: null
    };
    let renderToken = 0;
    let unsubscribe = null;
    let liveTimer = null;

    // ---------- formatting ----------
    const pad = value => String(value).padStart(2, '0');
    const num = value => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
    const trimFixed = (value, digits) => String(Number(value.toFixed(digits)));
    const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

    function formatExact(value) {
        const n = Math.round(num(value));
        return String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',').replace(/^/, n < 0 ? '-' : '');
    }

    function formatAbbr(value) {
        const n = num(value);
        const abs = Math.abs(n);
        if (abs >= 1e8) return `${trimFixed(n / 1e8, abs >= 1e10 ? 0 : abs >= 1e9 ? 1 : 2)} 亿`;
        if (abs >= 1e4) return `${trimFixed(n / 1e4, abs >= 1e6 ? 0 : 1)} 万`;
        return formatExact(n);
    }

    function formatCost(value) {
        const n = num(value);
        if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`;
        return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    }

    function formatMetric(metric, value, abbreviate = true) {
        if (metric === 'cost') return formatCost(value);
        if (metric === 'requests') return `${formatExact(value)} 次`;
        return abbreviate ? formatAbbr(value) : formatExact(value);
    }

    function formatRate(rate) {
        if (rate == null || !Number.isFinite(rate)) return '—';
        return `${trimFixed(rate * 100, 1)}%`;
    }

    // ---------- time buckets ----------
    function pathStart(path) {
        const [y, mo = 0, d = 1, h = 0, mi = 0, s = 0] = path;
        return new Date(y, mo, d, h, mi, s, 0).getTime();
    }

    function pathEnd(path) {
        const [y, mo = 0, d = 1, h = 0, mi = 0, s = 0] = path;
        switch (path.length) {
            case 1: return new Date(y + 1, 0, 1).getTime();
            case 2: return new Date(y, mo + 1, 1).getTime();
            case 3: return new Date(y, mo, d + 1).getTime();
            case 4: return new Date(y, mo, d, h + 1).getTime();
            case 5: return new Date(y, mo, d, h, mi + 1).getTime();
            default: return new Date(y, mo, d, h, mi, s + 1).getTime();
        }
    }

    function pathFromTime(time, depth) {
        const d = new Date(time);
        return [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].slice(0, Math.max(0, Math.min(LEAF_DEPTH, depth)));
    }

    function crumbLabel(path, index) {
        const [y, mo, d, h, mi, s] = path;
        return [
            () => `${y} 年`, () => `${mo + 1} 月`, () => `${d} 日`,
            () => `${pad(h)}:00`, () => `${pad(h)}:${pad(mi)}`, () => `${pad(h)}:${pad(mi)}:${pad(s)}`
        ][index]();
    }

    function crumbsFor(path) {
        return [{ depth: 0, label: '全部年份' }, ...path.map((_, index) => ({ depth: index + 1, label: crumbLabel(path, index) }))];
    }

    function bucketLabels(unit, path, part) {
        const [y, mo, d, h, mi] = path;
        switch (unit) {
            case 'year': return { short: String(part), long: `${part} 年` };
            case 'month': return { short: String(part + 1), long: `${y} 年 ${part + 1} 月` };
            case 'day': return { short: String(part), long: `${mo + 1} 月 ${part} 日` };
            case 'hour': return { short: String(part), long: `${mo + 1} 月 ${d} 日 ${pad(part)}:00` };
            case 'minute': return { short: String(part), long: `${pad(h)}:${pad(part)}` };
            default: return { short: String(part), long: `${pad(h)}:${pad(mi)}:${pad(part)}` };
        }
    }

    // Builds the visible range and its empty buckets. Depth 0 = year overview, 1 = a year
    // (12 months), 2 = a month (its days), 3 = a day (24 h), 4 = an hour (60 min),
    // 5 = a minute (60 s, the automatic second level), 6 = one second (no chart).
    function buildRange(path, years = {}) {
        const depth = Math.min(LEAF_DEPTH, path.length);
        if (depth === 0) {
            const endYear = Number.isInteger(years.endYear) ? years.endYear : new Date().getFullYear();
            const startYear = Number.isInteger(years.startYear) ? Math.min(years.startYear, endYear) : endYear - 2;
            const buckets = [];
            for (let y = startYear; y <= endYear; y += 1) {
                buckets.push({ part: y, from: new Date(y, 0, 1).getTime(), to: new Date(y + 1, 0, 1).getTime(), ...bucketLabels('year', [], y) });
            }
            return { depth, unit: 'year', from: buckets[0].from, to: buckets[buckets.length - 1].to, buckets };
        }
        const base = path.slice(0, depth);
        const from = pathStart(base);
        const to = pathEnd(base);
        if (depth >= LEAF_DEPTH) return { depth, unit: null, from, to, buckets: [] };
        const unit = UNITS[depth];
        let parts;
        if (unit === 'month') parts = Array.from({ length: 12 }, (_, i) => i);
        else if (unit === 'day') parts = Array.from({ length: new Date(base[0], base[1] + 1, 0).getDate() }, (_, i) => i + 1);
        else if (unit === 'hour') parts = Array.from({ length: 24 }, (_, i) => i);
        else parts = Array.from({ length: 60 }, (_, i) => i);
        const buckets = parts.map(part => {
            const childPath = [...base, part];
            return { part, from: pathStart(childPath), to: pathEnd(childPath), ...bucketLabels(unit, base, part) };
        });
        return { depth, unit, from, to, buckets };
    }

    function bucketIndexFor(at, range) {
        if (!range?.unit || !range.buckets.length) return -1;
        const d = new Date(at);
        switch (range.unit) {
            case 'year': return d.getFullYear() - range.buckets[0].part;
            case 'month': return d.getMonth();
            case 'day': return d.getDate() - 1;
            case 'hour': return d.getHours();
            case 'minute': return d.getMinutes();
            default: return d.getSeconds();
        }
    }

    function drillPath(path, range, index) {
        const bucket = range?.buckets?.[index];
        if (!bucket || path.length >= LEAF_DEPTH) return path.slice();
        return [...path, bucket.part];
    }

    function crumbPath(path, depth) {
        return path.slice(0, Math.max(0, Math.min(path.length, depth)));
    }

    // Switching the granularity keeps the current prefix and fills the rest from the
    // selected bucket, "now" (if inside the view), the latest bucket with data, or the start.
    function unitPath(path, unit, context = {}) {
        const depth = Math.max(0, UNITS.indexOf(unit));
        if (depth === 0) return [];
        if (path.length >= depth) return path.slice(0, depth);
        const range = context.range;
        const now = context.now ?? Date.now();
        const selected = range?.buckets?.[context.selected];
        let ref = selected?.from;
        if (ref == null && range && now >= range.from && now < range.to) ref = now;
        if (ref == null && Array.isArray(context.buckets)) ref = [...context.buckets].reverse().find(bucket => bucket.requests > 0)?.from;
        if (ref == null) ref = range ? range.from : now;
        return pathFromTime(ref, depth);
    }

    // ---------- aggregation ----------
    function entryTotal(entry) {
        const total = Number(entry?.total);
        return Number.isFinite(total) && total > 0 ? total : num(entry?.input) + num(entry?.output);
    }

    function entryCost(entry, costOf) {
        try {
            const cost = typeof costOf === 'function' ? costOf(entry) : null;
            return typeof cost === 'number' && Number.isFinite(cost) ? cost : null;
        } catch (_) { return null; }
    }

    function metricOf(entry, metric, cost) {
        if (metric === 'requests') return 1;
        if (metric === 'cost') return cost || 0;
        if (metric === 'total') return entryTotal(entry);
        return num(entry?.[metric]);
    }

    // One pass over the entries of the visible range: buckets, summary and feature ranking.
    function aggregate(entries, range, options = {}) {
        const metric = options.metric || 'total';
        const buckets = (range?.buckets || []).map(bucket => ({ ...bucket, amount: 0, requests: 0 }));
        const summary = { total: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0, failed: 0, cost: 0, priced: 0, unpriced: 0, estimated: false, unpricedModels: [] };
        const unpricedModels = new Set();
        const features = new Map();
        const inRange = [];
        for (const entry of Array.isArray(entries) ? entries : []) {
            const at = Number(entry?.at);
            if (!Number.isFinite(at) || at < range.from || at >= range.to) continue;
            inRange.push(entry);
            const cost = entryCost(entry, options.costOf);
            summary.requests += 1;
            summary.total += entryTotal(entry);
            summary.input += num(entry.input);
            summary.output += num(entry.output);
            summary.cacheRead += num(entry.cacheRead);
            summary.cacheWrite += num(entry.cacheWrite);
            if (entry.ok === false) summary.failed += 1;
            if (entry.estimated) summary.estimated = true;
            if (cost == null) { summary.unpriced += 1; unpricedModels.add(entry.model || entry.apiName || '未知模型'); }
            else { summary.priced += 1; summary.cost += cost; }
            const amount = metricOf(entry, metric, cost);
            const index = bucketIndexFor(at, range);
            if (index >= 0 && index < buckets.length) {
                buckets[index].amount += amount;
                buckets[index].requests += 1;
            }
            const key = entry.feature || 'other';
            const feature = features.get(key) || { key, amount: 0, total: 0, requests: 0 };
            feature.amount += amount;
            feature.total += entryTotal(entry);
            feature.requests += 1;
            features.set(key, feature);
        }
        summary.unpricedModels = Array.from(unpricedModels);
        summary.cacheHitRate = summary.input > 0 ? summary.cacheRead / summary.input : null;
        summary.costState = summary.requests === 0 ? 'empty' : summary.priced === 0 ? 'none' : summary.unpriced > 0 ? 'partial' : 'full';
        const ranking = Array.from(features.values()).sort((a, b) => b.amount - a.amount || b.requests - a.requests || a.key.localeCompare(b.key));
        return { buckets, summary, features: ranking, entries: inRange };
    }

    function niceMax(value) {
        if (!(value > 0)) return 1;
        const power = 10 ** Math.floor(Math.log10(value));
        const fraction = value / power;
        const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
        return step * power;
    }

    // ---------- data ----------
    function getLedger() {
        const ledger = window.ByndUsageLedger;
        return ledger && typeof ledger.list === 'function' ? ledger : null;
    }

    function featureLabel(key, ledger) {
        const found = (Array.isArray(ledger?.FEATURES) ? ledger.FEATURES : []).find(item => item?.key === key);
        return found?.label || key || '其他';
    }

    function optionPairs(values, kind, ledger) {
        return (Array.isArray(values) ? values : []).map(item => {
            if (item && typeof item === 'object') {
                const value = String(item.id ?? item.key ?? item.value ?? item.name ?? '');
                return { value, label: String(item.name ?? item.label ?? (kind === 'feature' ? featureLabel(value, ledger) : value)) };
            }
            const value = String(item ?? '');
            return { value, label: kind === 'feature' ? featureLabel(value, ledger) : value };
        }).filter(item => item.value);
    }

    function activeFilters(filters = state.filters) {
        const out = {};
        FILTERS.forEach(({ key }) => { if (filters[key]) out[key] = filters[key]; });
        return out;
    }

    async function settle(value) {
        try { return await value; } catch (_) { return null; }
    }

    async function buildViewModel(ledger, view = state, now = Date.now()) {
        if (!ledger) return { missing: true };
        const filters = activeFilters(view.filters);
        const [facets, prices] = await Promise.all([settle(ledger.facets?.()), settle(ledger.getPrices?.())]);
        let range;
        let entries;
        if (!view.path.length) {
            const nowYear = new Date(now).getFullYear();
            entries = await ledger.list({ ...filters, from: new Date(nowYear - YEAR_LOOKBACK, 0, 1).getTime(), to: new Date(nowYear + 1, 0, 1).getTime() });
            const firstAt = (entries || []).map(entry => Number(entry?.at)).find(Number.isFinite);
            const firstYear = firstAt != null ? new Date(firstAt).getFullYear() : nowYear;
            range = buildRange([], { startYear: Math.min(nowYear - 2, Math.max(firstYear, nowYear - 5)), endYear: nowYear });
        } else {
            range = buildRange(view.path);
            entries = await ledger.list({ ...filters, from: range.from, to: range.to });
        }
        // costOf resolves manual, OpenRouter and built-in prices through a per-model cache inside the ledger.
        const costOf = entry => ledger.costOf?.(entry) ?? null;
        const agg = aggregate(entries || [], range, { metric: view.metric, costOf });
        const facetModels = optionPairs(facets?.models, 'model', ledger).map(item => item.value);
        const priceModels = Object.keys(prices && typeof prices === 'object' ? prices : {});
        const allPriceModels = Array.from(new Set([...facetModels, ...priceModels]));
        return {
            missing: false,
            range,
            ...agg,
            facets: facets || {},
            prices: prices && typeof prices === 'object' ? prices : {},
            priceModels: allPriceModels,
            resolvedPrices: allPriceModels.map(name => ledger.resolvePrice?.(name) || null),
            autoPrices: ledger.autoPriceInfo?.() || null,
            featureLabel: key => featureLabel(key, ledger),
            ledger
        };
    }

    // ---------- markup ----------
    function renderChart(model, view, width) {
        const { buckets, range } = model;
        if (!buckets.length) return '';
        const W = Math.max(260, Math.round(width || 330));
        const H = 184;
        const padL = 46, padR = 8, padT = 24, padB = 24;
        const plotW = W - padL - padR;
        const plotH = H - padT - padB;
        const count = buckets.length;
        const band = plotW / count;
        const barW = Math.max(1.5, Math.min(24, band - 2));
        const top = niceMax(Math.max(...buckets.map(bucket => bucket.amount)));
        const y = value => padT + plotH - (value / top) * plotH;
        const ticks = [0, top / 2, top].filter(value => view.metric !== 'requests' || Number.isInteger(value));
        const selected = Number.isInteger(view.selected) && buckets[view.selected] ? view.selected : null;
        const parts = [];
        ticks.forEach(value => {
            const ty = y(value).toFixed(1);
            parts.push(`<line class="bill-grid" x1="${padL}" x2="${W - padR}" y1="${ty}" y2="${ty}"/>`);
            parts.push(`<text class="bill-tick" x="${padL - 6}" y="${ty}" dy="3.5" text-anchor="end">${escapeHtml(formatMetric(view.metric, value).replace(' 次', ''))}</text>`);
        });
        const every = range.unit === 'day' ? (part => part === 1 || part % 5 === 0)
            : range.unit === 'hour' ? (part => part % (band >= 10 ? 3 : 6) === 0)
            : (range.unit === 'minute' || range.unit === 'second') ? (part => part % 10 === 0)
            : range.unit === 'month' ? (part => band >= 16 || part % 2 === 0)
            : (() => true);
        buckets.forEach((bucket, index) => {
            const x = padL + index * band + (band - barW) / 2;
            const cls = selected == null ? '' : index === selected ? ' is-selected' : ' is-dim';
            if (bucket.amount > 0) {
                const h = Math.max(1.5, (bucket.amount / top) * plotH);
                const yTop = padT + plotH - h;
                const r = Math.min(4, barW / 2, h);
                const base = padT + plotH;
                parts.push(`<path class="bill-bar${cls}" d="M${x.toFixed(2)} ${base}V${(yTop + r).toFixed(2)}Q${x.toFixed(2)} ${yTop.toFixed(2)} ${(x + r).toFixed(2)} ${yTop.toFixed(2)}H${(x + barW - r).toFixed(2)}Q${(x + barW).toFixed(2)} ${yTop.toFixed(2)} ${(x + barW).toFixed(2)} ${(yTop + r).toFixed(2)}V${base}Z"/>`);
            } else {
                parts.push(`<rect class="bill-empty${cls}" x="${x.toFixed(2)}" y="${padT + plotH - 2}" width="${barW.toFixed(2)}" height="2"/>`);
            }
            if (every(bucket.part)) parts.push(`<text class="bill-xlabel${index === selected ? ' is-selected' : ''}" x="${(padL + index * band + band / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle">${escapeHtml(bucket.short)}</text>`);
        });
        parts.push(`<line class="bill-axis" x1="${padL}" x2="${W - padR}" y1="${padT + plotH}" y2="${padT + plotH}"/>`);
        if (selected != null) {
            const bucket = buckets[selected];
            const cx = Math.min(W - padR - 30, Math.max(padL + 30, padL + selected * band + band / 2));
            const cy = Math.max(12, y(bucket.amount) - 7);
            parts.push(`<text class="bill-value-label" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle">${escapeHtml(formatMetric(view.metric, bucket.amount))}</text>`);
        }
        buckets.forEach((bucket, index) => {
            parts.push(`<rect class="bill-hit" data-bucket="${index}" x="${(padL + index * band).toFixed(2)}" y="0" width="${band.toFixed(2)}" height="${H}"><title>${escapeHtml(`${bucket.long} · ${formatMetric(view.metric, bucket.amount, false)} · ${bucket.requests} 次请求`)}</title></rect>`);
        });
        const metricLabel = METRICS.find(item => item.key === view.metric)?.label || '';
        return `<svg class="bill-chart" data-plot-left="${padL}" data-plot-width="${plotW}" data-count="${count}" viewBox="0 0 ${W} ${H}" width="100%" role="img" tabindex="0" aria-label="${escapeHtml(`${metricLabel}，按${UNIT_LABELS[range.unit]}分 ${count} 格。左右键选择，回车进入`)}">${parts.join('')}</svg>`;
    }

    function renderPick(model, view) {
        const bucket = model.buckets[view.selected];
        if (!bucket) return `<div class="bill-pick is-hint">点柱子看数值 · 再点一次进入下一级</div>`;
        const canDrill = bucket.requests > 0;
        return `<div class="bill-pick"><div><b>${escapeHtml(bucket.long)}</b><span>${escapeHtml(formatMetric(view.metric, bucket.amount, false))} · ${bucket.requests} 次请求</span></div><button type="button" data-action="drill" data-bucket="${view.selected}" ${canDrill ? '' : 'disabled'}>进入 ›</button></div>`;
    }

    function renderSummary(model) {
        const s = model.summary;
        const approx = s.estimated ? '≈' : '';
        let cost = `<b>${approx}${formatCost(s.cost)}</b>`;
        let hint = '';
        if (s.costState === 'none') {
            cost = '<b>—</b>';
            hint = '这些模型暂时查不到公开价格 · 查看价格 ›';
        } else if (s.costState === 'partial') {
            cost = `<b>${approx}${formatCost(s.cost)} <small>部分</small></b>`;
            hint = `${s.unpriced} 次请求的模型查不到公开价格（${escapeHtml(s.unpricedModels.slice(0, 3).join('、'))}${s.unpricedModels.length > 3 ? ' 等' : ''}）›`;
        }
        return `
            <div class="bill-total"><span>总 Token</span><strong>${approx}${formatExact(s.total)}</strong></div>
            <div class="bill-line"><span>输入</span><b>${approx}${formatExact(s.input)}</b></div>
            <div class="bill-line"><span>输出</span><b>${approx}${formatExact(s.output)}</b></div>
            <div class="bill-line"><span>缓存命中 <small>命中率 ${formatRate(s.cacheHitRate)}</small></span><b>${formatExact(s.cacheRead)}</b></div>
            <div class="bill-line"><span>缓存写入</span><b>${formatExact(s.cacheWrite)}</b></div>
            <div class="bill-line"><span>API 请求</span><b>${formatExact(s.requests)} 次${s.failed ? ` <small>失败 ${s.failed}</small>` : ''}</b></div>
            <div class="bill-line"><span>估算成本</span>${cost}</div>
            ${hint ? `<button type="button" class="bill-hint" data-action="open-prices">${hint}</button>` : ''}
            ${s.estimated ? '<p class="bill-note">≈ 表示包含本地估算的用量（接口未返回完整 usage）。</p>' : ''}`;
    }

    function renderFeatures(model, view) {
        if (!model.features.length) return '';
        const max = Math.max(...model.features.map(item => item.amount), 0) || 1;
        return `<div class="bill-section">02 / 功能排行 <small>点一项筛选</small></div><div class="bill-features">${model.features.map(item => {
            const active = view.filters.feature === item.key;
            return `<button type="button" class="bill-feature${active ? ' is-active' : ''}" data-action="feature" data-feature="${escapeHtml(item.key)}" aria-pressed="${active}"><span class="bill-feature__head"><span>${escapeHtml(model.featureLabel(item.key))}</span><b>${escapeHtml(formatMetric(view.metric, item.amount))}</b></span><span class="bill-feature__bar"><i style="width:${Math.max(item.amount > 0 ? 1.5 : 0, item.amount / max * 100).toFixed(1)}%"></i></span></button>`;
        }).join('')}</div>`;
    }

    function renderRequests(model) {
        const all = model.entries;
        if (!all.length) return '';
        const rows = all.slice(-REQUEST_LIST_LIMIT);
        const offset = all.length - rows.length;
        return `<div class="bill-section">03 / API REQUEST <small>${all.length} 次 · 点一行查看小票</small></div>${offset ? `<p class="bill-note">仅显示最近 ${REQUEST_LIST_LIMIT} 次请求。</p>` : ''}<div class="bill-requests">${rows.map((entry, index) => {
            const d = new Date(Number(entry.at));
            const who = [model.featureLabel(entry.feature || 'other'), entry.charName, entry.provider].filter(Boolean).join(' · ');
            return `<button type="button" class="bill-request${entry.ok === false ? ' is-failed' : ''}" data-action="request" data-entry="${offset + index}"><span class="bill-request__time">${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}</span><span class="bill-request__main"><b>${escapeHtml(entry.model || entry.apiName || '未知模型')}</b><small>${escapeHtml(who)}${entry.ok === false ? ' · 失败' : ''}</small></span><span class="bill-request__num">${entry.estimated ? '≈' : ''}${formatExact(entryTotal(entry))}</span></button>`;
        }).join('')}</div>`;
    }

    const PRICE_SOURCE_LABEL = { openrouter: 'OpenRouter 自动', builtin: '官方价格', manual: '手动' };
    const formatUnitPrice = value => (value == null || value === '' ? '—' : `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 4 })}`);

    // Prices come from OpenRouter automatically; a manual form only appears for models it doesn't list
    // (or when the user wants to correct a relay that charges differently).
    function renderPrices(model, view) {
        const models = model.priceModels;
        const body = models.length ? models.map((name, index) => {
            const resolved = model.resolvedPrices?.[index] || null;
            const manual = model.prices[name] || {};
            const form = `<form class="bill-price__form" data-model-index="${index}"><div class="bill-price__grid">${PRICE_FIELDS.map(field => `<label><span>${field.label}</span><input type="number" inputmode="decimal" min="0" step="any" name="${field.key}" value="${manual[field.key] != null && manual[field.key] !== '' ? escapeHtml(manual[field.key]) : ''}" placeholder="—"></label>`).join('')}</div><button type="submit">保存</button></form>`;
            const head = `<div class="bill-price__head"><b>${escapeHtml(name)}</b>${resolved ? `<small>${escapeHtml(PRICE_SOURCE_LABEL[resolved.source] || resolved.source)}${resolved.source === 'openrouter' && resolved.matchedId !== name ? ` · ${escapeHtml(resolved.matchedId)}` : ''}</small>` : '<small class="is-missing">查不到公开价格</small>'}</div>`;
            if (!resolved) return `<div class="bill-price">${head}<p class="bill-note">OpenRouter 上没有这个模型名（常见于中转站自定义名称），需要时可以手动填写：</p>${form}</div>`;
            const price = resolved.price || {};
            return `<div class="bill-price">${head}<div class="bill-price__grid is-readonly">${PRICE_FIELDS.map(field => `<span><em>${field.label}</em>${escapeHtml(formatUnitPrice(price[field.key] ?? (field.key === 'cacheRead' || field.key === 'cacheWrite' ? null : price[field.key])))}</span>`).join('')}</div><details class="bill-price__override"><summary>${resolved.source === 'manual' ? '修改手动价格' : '中转站收费不同？手动覆盖'}</summary>${form}</details></div>`;
        }).join('') : '<p class="bill-note">账本里还没有出现过模型。</p>';
        const auto = model.autoPrices;
        const updated = auto?.fetchedAt ? new Date(auto.fetchedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const status = auto?.count ? `价格自动来自 OpenRouter 公开价目表（${auto.count} 个模型，${updated} 更新，每天自动刷新）。` : '正在获取 OpenRouter 公开价目表…';
        return `<details class="bill-prices" ${view.pricesOpen ? 'open' : ''}><summary><span>04 / 价格</span><small>USD / 1M tokens</small></summary><p class="bill-note">${status}成本按官方价估算，中转站的实际收费可能不同。</p><button type="button" class="bill-hint" data-action="refresh-prices">刷新价格</button>${body}</details>`;
    }

    function renderFilters(model, view) {
        const ledger = model.ledger;
        const lists = {
            provider: optionPairs(model.facets.providers, 'provider', ledger),
            model: optionPairs(model.facets.models, 'model', ledger),
            feature: optionPairs(model.facets.features, 'feature', ledger),
            charId: optionPairs(model.facets.chars, 'char', ledger)
        };
        return `<div class="bill-filters">${FILTERS.map(({ key, all }) => {
            const value = view.filters[key] || '';
            const options = lists[key].slice();
            if (value && !options.some(item => item.value === value)) options.push({ value, label: key === 'feature' ? featureLabel(value, ledger) : value });
            return `<label class="bill-pill${value ? ' is-active' : ''}"><select data-filter="${key}" aria-label="${all}"><option value="">${all}</option>${options.map(item => `<option value="${escapeHtml(item.value)}" ${item.value === value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}</select><span aria-hidden="true">▾</span></label>`;
        }).join('')}</div>`;
    }

    function renderHtml(model, view = state, options = {}) {
        const head = `<div class="bill-mast"><span>✧ &nbsp; BYND / BILL &nbsp; ✧</span><span>${escapeHtml(options.stamp || '')}</span></div><div class="bill-stars">✦ &nbsp; · &nbsp; ✳ &nbsp; · &nbsp; ✦ &nbsp; · &nbsp; ✳</div><h2>TOKEN USAGE</h2><div class="bill-sub">账单 · API 用量明细</div>`;
        const end = '<div class="bill-end">✦ &nbsp; THANK YOU FOR USING &nbsp; ✦</div>';
        if (!model || model.missing) return `${head}<div class="bill-rule"></div><div class="bill-empty-state"><b>账本还没准备好</b><span>用量记录模块未加载，稍后再打开账单。</span></div>${end}`;
        const depth = model.range.depth;
        const activeUnit = UNITS[Math.min(depth, UNITS.length - 1)];
        const units = `<div class="bill-units" role="tablist" aria-label="时间粒度">${UNITS.map(unit => `<button type="button" role="tab" data-action="unit" data-unit="${unit}" aria-selected="${unit === activeUnit}" class="${unit === activeUnit ? 'is-active' : ''}">${UNIT_LABELS[unit]}</button>`).join('<i aria-hidden="true">｜</i>')}</div>`;
        const crumbs = crumbsFor(view.path);
        const trail = `<nav class="bill-crumbs" aria-label="钻取路径">${crumbs.map((crumb, index) => index === crumbs.length - 1
            ? `<span aria-current="page">${escapeHtml(crumb.label)}</span>`
            : `<button type="button" data-action="crumb" data-depth="${crumb.depth}">${escapeHtml(crumb.label)}</button><i aria-hidden="true">→</i>`).join('')}</nav>`;
        const metrics = `<div class="bill-metrics" role="tablist" aria-label="图表指标">${METRICS.map(item => `<button type="button" role="tab" data-action="metric" data-metric="${item.key}" aria-selected="${item.key === view.metric}" class="${item.key === view.metric ? 'is-active' : ''}">${item.label}</button>`).join('')}</div>`;
        const empty = model.summary.requests === 0;
        const chart = model.buckets.length ? `<div class="bill-section">01 / 用量走势 <small>按${UNIT_LABELS[model.range.unit]} · ${model.buckets.length} 格</small></div>${metrics}<div class="bill-chart-wrap">${renderChart(model, view, options.width)}</div>${renderPick(model, view)}<details class="bill-table"><summary>数据表</summary><table><thead><tr><th>时间</th><th>${escapeHtml(METRICS.find(item => item.key === view.metric)?.label || '')}</th><th>请求</th></tr></thead><tbody>${model.buckets.filter(bucket => bucket.requests > 0).map(bucket => `<tr><td>${escapeHtml(bucket.long)}</td><td>${escapeHtml(formatMetric(view.metric, bucket.amount, false))}</td><td>${bucket.requests}</td></tr>`).join('') || '<tr><td colspan="3">这段时间没有请求</td></tr>'}</tbody></table></details>` : '';
        const features = depth <= REQUEST_LIST_DEPTH ? renderFeatures(model, view) : '';
        const requests = depth >= REQUEST_LIST_DEPTH ? renderRequests(model) : '';
        const emptyNote = empty ? `<div class="bill-empty-state"><b>这段时间还没有 API 请求</b><span>${Object.keys(activeFilters(view.filters)).length ? '也可以放宽上面的筛选条件。' : '聊天、朋友圈、论坛等功能调用接口后，会自动记在这里。'}</span></div>` : '';
        return `${head}${units}${trail}${renderFilters(model, view)}<div class="bill-rule"></div>${renderSummary(model)}<div class="bill-barcode" aria-hidden="true"></div>${emptyNote}${chart}${features}${requests}${renderPrices(model, view)}${end}`;
    }

    // ---------- receipts ----------
    function builtinTicketHtml(entry, ledger) {
        const d = new Date(Number(entry.at));
        const cost = entryCost(entry, e => ledger?.costOf?.(e));
        const approx = entry.estimated ? '≈' : '';
        const line = (label, value) => `<div class="bynd-api-ticket__line"><span>${label}</span><b>${escapeHtml(value)}</b></div>`;
        return `<button type="button" class="bynd-api-ticket__shade" aria-label="关闭小票"></button><div class="bynd-api-ticket__printer" aria-hidden="true"><span></span></div><section class="bynd-api-ticket__paper" tabindex="-1"><div class="bynd-api-ticket__mast"><span>✧ &nbsp; BYND / API &nbsp; ✧</span><button type="button" class="bynd-api-ticket__close" aria-label="关闭小票">×</button></div><div class="bynd-api-ticket__stars">✦ &nbsp; · &nbsp; ✳ &nbsp; · &nbsp; ✦ &nbsp; · &nbsp; ✳</div><h2>API 小票</h2><div class="bynd-api-ticket__sub">SINGLE REQUEST · LEDGER ENTRY</div><div class="bynd-api-ticket__rule"></div>${line('时间', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`)}${line('功能', featureLabel(entry.feature || 'other', ledger))}${line('Provider', entry.provider || '—')}${line('API', entry.apiName || '—')}${line('模型', entry.model || '未知')}${entry.charName ? line('角色', entry.charName) : ''}${line('输入 Token', approx + formatExact(entry.input))}${line('输出 Token', approx + formatExact(entry.output))}${line('Cache Read', formatExact(entry.cacheRead))}${line('Cache Write', formatExact(entry.cacheWrite))}<div class="bynd-api-ticket__total"><span>合计 TOTAL</span><strong>${approx}${formatExact(entryTotal(entry))}</strong></div>${line('估算成本', cost == null ? '— 未设置单价' : formatCost(cost))}${line('耗时', Number.isFinite(Number(entry.durationMs)) && entry.durationMs != null ? `${(Number(entry.durationMs) / 1000).toFixed(2)} s` : '—')}${line('状态', entry.ok === false ? '失败' : '完成')}${entry.error ? `<p class="bynd-api-ticket__error">${escapeHtml(entry.error)}</p>` : ''}<p class="bynd-api-ticket__note">${entry.estimated ? '≈ 为本地估算；接口未返回完整 usage。' : 'Token 数来自接口返回的 usage。'}</p><div class="bynd-api-ticket__barcode" aria-hidden="true"></div><div class="bynd-api-ticket__end">✦ &nbsp; ${escapeHtml(entry.ticket || entry.id || 'THANK YOU')} &nbsp; ✦</div></section>`;
    }

    function showTicketLayer(layer) {
        const win = document.getElementById('app-bill-window');
        const close = () => { layer.classList.remove('is-open'); setTimeout(() => layer.remove(), 260); };
        layer.querySelectorAll('.bynd-api-ticket__shade, .bynd-api-ticket__close').forEach(node => node.addEventListener('click', close));
        layer.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
        (win || document.body).appendChild(layer);
        requestAnimationFrame(() => { layer.classList.add('is-open'); layer.querySelector('.bynd-api-ticket__paper')?.focus(); });
    }

    function openBuiltinTicket(entry) {
        document.getElementById('bynd-api-ticket-layer')?.remove();
        const layer = document.createElement('div');
        layer.id = 'bynd-api-ticket-layer';
        layer.className = 'bynd-api-ticket-layer';
        layer.setAttribute('role', 'dialog');
        layer.setAttribute('aria-modal', 'true');
        layer.setAttribute('aria-label', 'API 小票');
        layer.innerHTML = builtinTicketHtml(entry, getLedger());
        showTicketLayer(layer);
    }

    // The shared receipt mounts inside the WeChat window; while 账单 is on top, move it here
    // (bill-app.css carries the same receipt rules for #app-bill-window).
    function adoptTicketLayer() {
        const layer = document.getElementById('bynd-api-ticket-layer');
        const win = document.getElementById('app-bill-window');
        if (!layer || !win) return false;
        if (!win.contains(layer) && !layer.closest('.app-window.active')) win.appendChild(layer);
        return true;
    }

    async function openEntryTicket(entry) {
        if (!entry) return;
        const api = window.ByndApiTicket;
        document.getElementById('bynd-api-ticket-layer')?.remove();
        try {
            if (typeof api?.openLedgerTicket === 'function') {
                const result = api.openLedgerTicket(entry);
                if (result && typeof result.then === 'function') await result;
            } else if (entry.source && typeof api?.openTicket === 'function') {
                api.openTicket(entry.source.charId, entry.source.msgIndex);
            }
        } catch (error) {
            console.warn('[bill] receipt failed, using built-in detail:', error);
        }
        if (!adoptTicketLayer()) openBuiltinTicket(entry);
    }

    // ---------- DOM glue ----------
    function getRoot() { return document.getElementById('bill-root'); }

    function paperWidth(root) {
        const paper = root?.querySelector('.bill-paper');
        const width = paper ? paper.clientWidth - 36 : (root?.clientWidth || 360) - 56;
        return width > 0 ? width : 320;
    }

    function ensureShell(root) {
        if (root.querySelector('.bill-paper')) return;
        root.innerHTML = '<div class="bill-printer" aria-hidden="true"><span></span></div><div class="bill-scroll"><section class="bill-paper" aria-live="polite"></section></div>';
        bindEvents(root);
    }

    function stamp() {
        const d = new Date();
        return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    async function render() {
        const root = getRoot();
        if (!root) return;
        ensureShell(root);
        const token = ++renderToken;
        let model;
        try {
            model = await buildViewModel(getLedger(), state);
        } catch (error) {
            console.warn('[bill] ledger query failed:', error);
            model = { missing: true };
        }
        if (token !== renderToken) return;
        state.model = model;
        if (!model.missing && !(Number.isInteger(state.selected) && model.buckets[state.selected])) state.selected = null;
        const paper = root.querySelector('.bill-paper');
        const scroller = root.querySelector('.bill-scroll');
        const scrollTop = scroller ? scroller.scrollTop : 0;
        paper.innerHTML = renderHtml(model, state, { width: paperWidth(root), stamp: stamp() });
        if (scroller) scroller.scrollTop = scrollTop;
        const status = document.getElementById('bill-status');
        if (status) status.textContent = model.missing ? '' : `${formatAbbr(model.summary.total)} Token`;
        requestAnimationFrame(() => root.classList.add('is-fed'));
    }

    // Selection only redraws the chart + pick card; no ledger query.
    function repaintSelection() {
        const root = getRoot();
        const model = state.model;
        if (!root || !model || model.missing) return;
        const wrap = root.querySelector('.bill-chart-wrap');
        const pick = root.querySelector('.bill-pick');
        if (wrap) wrap.innerHTML = renderChart(model, state, paperWidth(root));
        if (pick) pick.outerHTML = renderPick(model, state);
        root.querySelector('.bill-chart')?.focus({ preventScroll: true });
    }

    function go(path) {
        state.path = path;
        state.selected = null;
        render();
    }

    function drill(index) {
        const model = state.model;
        if (!model || model.missing || !model.buckets[index]) return;
        go(drillPath(state.path, model.range, index));
    }

    function bucketFromPointer(svg, clientX) {
        const rect = svg.getBoundingClientRect();
        const box = svg.viewBox?.baseVal;
        const scale = box && box.width ? rect.width / box.width : 1;
        const left = Number(svg.dataset.plotLeft) * scale;
        const width = Number(svg.dataset.plotWidth) * scale;
        const count = Number(svg.dataset.count);
        if (!(width > 0) || !(count > 0)) return null;
        return Math.max(0, Math.min(count - 1, Math.floor((clientX - rect.left - left) / (width / count))));
    }

    function bindEvents(root) {
        let press = null;
        root.addEventListener('pointerdown', event => {
            const svg = event.target.closest?.('.bill-chart');
            if (!svg) return;
            press = { index: bucketFromPointer(svg, event.clientX), x: event.clientX, scrubbed: false, wasSelected: false };
            press.wasSelected = press.index === state.selected;
        });
        root.addEventListener('pointermove', event => {
            if (!press || (!press.scrubbed && Math.abs(event.clientX - press.x) < 6)) return;
            const svg = event.target.closest?.('.bill-chart') || root.querySelector('.bill-chart');
            const index = svg ? bucketFromPointer(svg, event.clientX) : null;
            if (index != null && index !== press.index) {
                press.index = index;
                press.scrubbed = true;
                state.selected = index;
                repaintSelection();
            }
        });
        const endPress = () => { setTimeout(() => { press = null; }, 0); };
        root.addEventListener('pointerup', endPress);
        root.addEventListener('pointercancel', endPress);
        root.addEventListener('click', event => {
            const svg = event.target.closest?.('.bill-chart');
            if (svg) {
                if (press?.scrubbed) return;
                const index = bucketFromPointer(svg, event.clientX);
                if (index == null) return;
                if (index === state.selected && (press ? press.wasSelected : true)) { drill(index); return; }
                state.selected = index;
                repaintSelection();
                return;
            }
            const button = event.target.closest?.('[data-action]');
            if (!button || !root.contains(button) || button.disabled) return;
            const action = button.dataset.action;
            if (action === 'unit') {
                const model = state.model;
                go(unitPath(state.path, button.dataset.unit, { range: model?.range, buckets: model?.buckets, selected: state.selected }));
            } else if (action === 'crumb') {
                go(crumbPath(state.path, Number(button.dataset.depth)));
            } else if (action === 'drill') {
                drill(Number(button.dataset.bucket));
            } else if (action === 'metric') {
                state.metric = button.dataset.metric;
                render();
            } else if (action === 'feature') {
                state.filters.feature = state.filters.feature === button.dataset.feature ? '' : button.dataset.feature;
                render();
            } else if (action === 'request') {
                openEntryTicket(state.model?.entries?.[Number(button.dataset.entry)]);
            } else if (action === 'refresh-prices') {
                const ledger = getLedger();
                button.disabled = true;
                button.textContent = '正在刷新…';
                Promise.resolve(ledger?.refreshAutoPrices?.({ force: true })).finally(() => render());
            } else if (action === 'open-prices') {
                state.pricesOpen = true;
                const details = root.querySelector('.bill-prices');
                if (details) { details.open = true; details.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            }
        });
        root.addEventListener('keydown', event => {
            const svg = event.target.closest?.('.bill-chart');
            if (!svg || !state.model?.buckets?.length) return;
            const count = state.model.buckets.length;
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                const step = event.key === 'ArrowRight' ? 1 : -1;
                state.selected = state.selected == null ? (step > 0 ? 0 : count - 1) : (state.selected + step + count) % count;
                repaintSelection();
                event.preventDefault();
            } else if (event.key === 'Enter' && state.selected != null) {
                drill(state.selected);
                event.preventDefault();
            }
        });
        root.addEventListener('change', event => {
            const select = event.target.closest?.('select[data-filter]');
            if (!select) return;
            state.filters[select.dataset.filter] = select.value;
            state.selected = null;
            render();
        });
        root.addEventListener('toggle', event => {
            if (event.target.classList?.contains('bill-prices')) state.pricesOpen = event.target.open;
        }, true);
        root.addEventListener('submit', async event => {
            const form = event.target.closest?.('form.bill-price__form');
            if (!form) return;
            event.preventDefault();
            const ledger = getLedger();
            const name = state.model?.priceModels?.[Number(form.dataset.modelIndex)];
            if (!ledger || typeof ledger.setPrice !== 'function' || !name) return;
            const price = {};
            PRICE_FIELDS.forEach(({ key }) => {
                const raw = form.elements[key]?.value;
                const value = raw === '' || raw == null ? null : Number(raw);
                price[key] = Number.isFinite(value) && value >= 0 ? value : null;
            });
            const button = form.querySelector('button[type="submit"]');
            try {
                await ledger.setPrice(name, price);
                if (button) button.textContent = '已保存';
                document.activeElement?.blur?.();
                setTimeout(render, 500);
            } catch (error) {
                if (button) button.textContent = '保存失败';
                console.warn('[bill] setPrice failed:', error);
            }
        });
    }

    function scheduleLive() {
        clearTimeout(liveTimer);
        liveTimer = setTimeout(() => {
            if (!state.open) return;
            const active = document.activeElement;
            // Don't wipe a price the user is still typing.
            if (active && getRoot()?.contains(active) && /^(INPUT|SELECT)$/.test(active.tagName)) { scheduleLive(); return; }
            render();
        }, LIVE_DEBOUNCE_MS);
    }

    function open() {
        state.open = true;
        const ledger = getLedger();
        if (!unsubscribe && typeof ledger?.subscribe === 'function') {
            try {
                const off = ledger.subscribe(scheduleLive);
                unsubscribe = typeof off === 'function' ? off : null;
            } catch (_) { unsubscribe = null; }
        }
        getRoot()?.classList.remove('is-fed');
        // Refresh the price list if it is older than a day; the ledger's subscribe event re-renders when it lands.
        Promise.resolve(ledger?.refreshAutoPrices?.()).catch(() => {});
        return render();
    }

    function close() {
        state.open = false;
        clearTimeout(liveTimer);
        if (unsubscribe) { try { unsubscribe(); } catch (_) {} unsubscribe = null; }
        const layer = document.getElementById('bynd-api-ticket-layer');
        if (layer && document.getElementById('app-bill-window')?.contains(layer)) layer.remove();
    }

    window.ByndBillApp = {
        open,
        close,
        render,
        _internal: {
            UNITS, METRICS, buildRange, bucketIndexFor, pathFromTime, crumbsFor, drillPath, crumbPath, unitPath,
            aggregate, niceMax, formatExact, formatAbbr, formatCost, formatRate, buildViewModel, renderHtml, renderChart, state
        }
    };
})();
