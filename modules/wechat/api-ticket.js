// Per-request diagnostics for the visible chat reply. No API key or image data is stored.
(() => {
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const estimate = value => {
        const text = String(value ?? '');
        const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
        return Math.max(0, Math.ceil(cjk * 1.35 + (text.length - cjk) / 3.8));
    };
    const textOf = content => typeof content === 'string' ? content : Array.isArray(content)
        ? content.map(part => typeof part === 'string' ? part : (part?.type === 'text' ? part.text || '' : '[图片输入]')).join('\n') : '';
    const clipped = (value, length = 1800) => String(value ?? '').replace(/data:image\/[^\s"']+/gi, '[图片数据]').slice(0, length);
    const sourceLabel = { system: '系统 Prompt / 预设', character: 'Char 卡', persona: 'User Persona', worldbook: '世界书', regex: '正则相关', sticker: '表情包 / 变量', dynamic: '动态注入', history: '聊天历史' };
    const sum = values => values.reduce((total, value) => total + (Number(value) || 0), 0);
    const readable = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('zh-CN') : '—';
    const entryToneStates = new WeakMap();

    function chooseEntryTone(rgb) {
        const channel = value => {
            const normalized = Math.max(0, Math.min(255, Number(value) || 0)) / 255;
            return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        };
        const luminance = 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
        return luminance > 0.179
            ? { color: '#17212b', shadow: '0 1px 2px rgba(255,255,255,.9)' }
            : { color: '#ffffff', shadow: '0 1px 3px rgba(0,0,0,.95)' };
    }

    function parseBackgroundColor(value) {
        const match = String(value || '').match(/rgba?\(([^)]+)\)/i);
        if (!match) return null;
        const parts = match[1].split(',').map(item => Number.parseFloat(item));
        if (parts.length < 3 || parts.slice(0, 3).some(item => !Number.isFinite(item)) || parts[3] === 0) return null;
        return { r: parts[0], g: parts[1], b: parts[2] };
    }

    function getEntryToneState(contentEl, char) {
        let state = entryToneStates.get(contentEl);
        if (state) { state.char = char; return state; }
        state = { char, src: '', image: null, loaded: false, canvas: null, context: null, frame: 0 };
        entryToneStates.set(contentEl, state);
        contentEl.addEventListener('scroll', () => {
            if (state.frame) return;
            state.frame = requestAnimationFrame(() => {
                state.frame = 0;
                refreshEntryTones(contentEl, state.char);
            });
        }, { passive: true });
        return state;
    }

    function getEntryBackgroundSource(contentEl, char) {
        if (char?.chatConfig?.chatBgImage) return String(char.chatConfig.chatBgImage);
        const image = getComputedStyle(contentEl).backgroundImage;
        const match = String(image || '').match(/^url\(["']?(.*?)["']?\)$/i);
        return match ? match[1] : '';
    }

    function ensureEntryImage(state, contentEl, src) {
        if (state.src === src) return;
        state.src = src;
        state.loaded = false;
        state.canvas = null;
        state.context = null;
        if (!src || typeof Image !== 'function') return;
        const image = new Image();
        if (/^https?:/i.test(src)) image.crossOrigin = 'anonymous';
        state.image = image;
        image.onload = () => {
            if (state.src !== src) return;
            state.loaded = true;
            refreshEntryTones(contentEl, state.char);
        };
        image.onerror = () => { if (state.src === src) state.loaded = false; };
        image.src = src;
    }

    function sampleEntryBackground(state, contentEl, ticket) {
        if (!state.loaded || !state.image?.naturalWidth || !state.image?.naturalHeight) return null;
        const contentRect = contentEl.getBoundingClientRect();
        const ticketRect = ticket.getBoundingClientRect();
        if (!contentRect.width || !contentRect.height || !ticketRect.width || !ticketRect.height) return null;
        const width = 96;
        const height = Math.max(96, Math.min(240, Math.round(width * contentRect.height / contentRect.width)));
        if (!state.canvas || state.canvas.height !== height) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) return null;
            const scale = Math.max(width / state.image.naturalWidth, height / state.image.naturalHeight);
            const drawWidth = state.image.naturalWidth * scale;
            const drawHeight = state.image.naturalHeight * scale;
            context.drawImage(state.image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
            state.canvas = canvas;
            state.context = context;
        }
        const x = Math.max(6, Math.min(width - 6, Math.round((ticketRect.left + ticketRect.width / 2 - contentRect.left) / contentRect.width * width)));
        const y = Math.max(6, Math.min(height - 6, Math.round((ticketRect.top + ticketRect.height / 2 - contentRect.top) / contentRect.height * height)));
        const pixels = state.context.getImageData(x - 6, y - 6, 12, 12).data;
        let r = 0, g = 0, b = 0, weight = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            const alpha = pixels[i + 3] / 255;
            r += pixels[i] * alpha;
            g += pixels[i + 1] * alpha;
            b += pixels[i + 2] * alpha;
            weight += alpha;
        }
        return weight ? { r: r / weight, g: g / weight, b: b / weight } : null;
    }

    function syncEntryTone(ticket, char) {
        const contentEl = ticket?.closest?.('.wc-room-content');
        if (!contentEl || typeof getComputedStyle !== 'function') return;
        const state = getEntryToneState(contentEl, char);
        const src = getEntryBackgroundSource(contentEl, char);
        ensureEntryImage(state, contentEl, src);
        let rgb = null;
        if (src) {
            try { rgb = sampleEntryBackground(state, contentEl, ticket); } catch (_) {}
        }
        if (!rgb && !src) {
            let node = contentEl;
            while (node && !rgb) {
                rgb = parseBackgroundColor(getComputedStyle(node).backgroundColor);
                node = node.parentElement;
            }
        }
        const tone = chooseEntryTone(rgb || (src ? { r: 18, g: 22, b: 28 } : { r: 255, g: 255, b: 255 }));
        ticket.style.setProperty('--bynd-api-ticket-fg', tone.color);
        ticket.style.setProperty('--bynd-api-ticket-shadow', tone.shadow);
    }

    function refreshEntryTones(contentEl, char) {
        contentEl?.querySelectorAll?.('.bynd-api-ticket-entry').forEach(ticket => syncEntryTone(ticket, char));
    }

    function worldBookRows(char, messages) {
        const entries = Array.isArray(char?.worldBook) ? char.worldBook : [];
        const systemText = messages.filter(msg => msg?.role === 'system').map(msg => textOf(msg.content)).join('\n');
        const historyText = messages.filter(msg => msg?.role !== 'system').map(msg => textOf(msg.content)).join('\n');
        return entries.slice(0, 80).map((entry, index) => {
            const raw = String(entry?.content || entry?.text || entry?.entry || entry?.value || entry?.comment || '');
            const title = String(entry?.name || entry?.title || entry?.key || entry?.keys || `条目 ${index + 1}`);
            const keys = String(entry?.key || entry?.keys || entry?.keyword || '').split(/[,，|/;；]/).map(item => item.trim()).filter(Boolean);
            const injected = !!raw && systemText.includes(raw.slice(0, Math.min(32, raw.length)));
            return { title: clipped(title, 72), injected, keywordHit: keys.some(key => historyText.includes(key)), disabled: entry?.enabled === false, preview: clipped(raw, 180), estimatedTokens: injected ? estimate(raw) : 0 };
        });
    }

    function snapshot(messages, options = {}) {
        const safeMessages = Array.isArray(messages) ? messages : [];
        const sources = Object.fromEntries(Object.keys(sourceLabel).map(key => [key, 0]));
        const rows = safeMessages.map((message, index) => {
            const content = textOf(message?.content);
            let source = message?.role === 'system' ? 'dynamic' : 'history';
            if (index === 0 || index === 1 || /【本轮回复前最后校验】/.test(content)) source = 'system';
            else if (/正则|regex/i.test(content) && message?.role === 'system') source = 'regex';
            else if (/表情包|贴纸|sticker/i.test(content) && message?.role === 'system') source = 'sticker';
            const tokens = estimate(content);
            sources[source] += tokens;
            return { role: message?.role || '?', source, tokens, preview: clipped(content, index < 2 ? 2600 : 950) };
        });
        const prompt = safeMessages.slice(0, 2).map(msg => textOf(msg?.content)).join('\n');
        const char = options.char;
        const worldbook = worldBookRows(char, safeMessages);
        const bookTokens = sum(worldbook.map(row => row.estimatedTokens));
        const description = String(char?.description || char?.personality || '');
        const charTokens = description && prompt.includes(description.slice(0, Math.min(32, description.length))) ? estimate(description) : 0;
        const personaPieces = [char?.chatConfig?.userProfile?.bio, char?.chatConfig?.userProfile?.signature].filter(Boolean);
        const personaTokens = sum(personaPieces.filter(piece => prompt.includes(String(piece).slice(0, 24))).map(estimate));
        const known = Math.min(sources.system, bookTokens + charTokens + personaTokens);
        const scale = known && bookTokens + charTokens + personaTokens > sources.system ? sources.system / (bookTokens + charTokens + personaTokens) : 1;
        sources.worldbook = Math.round(bookTokens * scale);
        sources.character = Math.round(charTokens * scale);
        sources.persona = Math.round(personaTokens * scale);
        sources.system = Math.max(0, sources.system - sources.worldbook - sources.character - sources.persona);
        const historyCount = Array.isArray(char?.history) ? char.history.length : 0;
        const historySent = rows.filter(row => row.source === 'history').length;
        return {
            at: Date.now(), model: String(options.model || ''), sources, rows, worldbook,
            historyCount, historySent, historyWindow: Math.min(historyCount, 30),
            historyTruncated: historyCount > 30,
            inputEstimate: sum(Object.values(sources)),
            contextLimit: Number(options.contextLimit) > 0 ? Number(options.contextLimit) : null,
            outputLimit: Number(options.outputLimit) > 0 ? Number(options.outputLimit) : null
        };
    }

    function normalizeUsage(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const input = Number(raw.prompt_tokens ?? raw.input_tokens);
        const output = Number(raw.completion_tokens ?? raw.output_tokens);
        const total = Number(raw.total_tokens);
        if (![input, output, total].some(Number.isFinite)) return null;
        return {
            input: Number.isFinite(input) ? input : null,
            output: Number.isFinite(output) ? output : null,
            total: Number.isFinite(total) ? total : (Number.isFinite(input) && Number.isFinite(output) ? input + output : null),
            cached: Number(raw.prompt_tokens_details?.cached_tokens ?? raw.input_tokens_details?.cached_tokens) || 0
        };
    }

    function finishRequest(record, rawUsage, content, error = '') {
        if (!record) return;
        record.usage = normalizeUsage(rawUsage);
        record.outputEstimate = estimate(content);
        record.error = clipped(error, 240);
        record.status = error ? '失败' : '完成';
    }

    function totalFor(records) {
        const entries = (Array.isArray(records) ? records : []).filter(Boolean);
        return {
            input: sum(entries.map(item => item.usage?.input ?? item.inputEstimate)),
            output: sum(entries.map(item => item.usage?.output ?? item.outputEstimate)),
            total: sum(entries.map(item => item.usage?.total ?? ((item.usage?.input ?? item.inputEstimate) + (item.usage?.output ?? item.outputEstimate)))),
            estimated: entries.some(item => !item.usage || item.usage.input == null || item.usage.output == null)
        };
    }

    function renderRows(record) {
        const sources = record.sources || {};
        return Object.entries(sourceLabel).map(([key, label]) => `<div class="bynd-api-ticket__line"><span>${escape(label)}</span><b>${readable(sources[key])}</b></div>`).join('');
    }

    function renderDetails(record) {
        const rows = Array.isArray(record.rows) ? record.rows : [];
        return rows.map((row, index) => `<details><summary><span>${String(index + 1).padStart(2, '0')} ${escape(row.role)} · ${escape(sourceLabel[row.source] || row.source)}</span><b>≈${readable(row.tokens)}</b></summary><pre>${escape(row.preview)}${row.preview?.length >= (index < 2 ? 2600 : 950) ? '\n…已截取预览' : ''}</pre></details>`).join('');
    }

    function openTicket(charId, messageIndex) {
        const char = (window.myCharacters || []).find(item => String(item.id) === String(charId));
        const records = char?.history?.[Number(messageIndex)]?.apiUsageRecords;
        if (!Array.isArray(records) || !records.length) return;
        renderTicket(records, document.getElementById('app-wechat-window'));
    }

    // One global-ledger entry (modules/usage/ledger.js); list() entries carry no ticket, so fetch it.
    async function openLedgerTicket(entry) {
        if (!entry) return false;
        let ticket = entry.ticket;
        if (!ticket && entry.id && window.ByndUsageLedger?.get) ticket = (await window.ByndUsageLedger.get(entry.id))?.ticket;
        if (!ticket || typeof ticket !== 'object') return false;
        renderTicket([ticket], document.getElementById('app-bill-window'));
        return true;
    }

    function renderTicket(records, mount) {
        document.getElementById('bynd-api-ticket-layer')?.remove();
        const totals = totalFor(records);
        const latest = records[records.length - 1];
        const layer = document.createElement('div');
        layer.id = 'bynd-api-ticket-layer';
        layer.className = 'bynd-api-ticket-layer';
        layer.setAttribute('role', 'dialog');
        layer.setAttribute('aria-modal', 'true');
        layer.setAttribute('aria-label', 'API 小票');
        layer.innerHTML = `<button type="button" class="bynd-api-ticket__shade" aria-label="关闭小票"></button><div class="bynd-api-ticket__printer" aria-hidden="true"><span></span></div><section class="bynd-api-ticket__paper" tabindex="-1"><div class="bynd-api-ticket__mast"><span>✧ &nbsp; BYND / API &nbsp; ✧</span><button type="button" class="bynd-api-ticket__close" aria-label="关闭小票">×</button></div><div class="bynd-api-ticket__stars">✦ &nbsp; · &nbsp; ✳ &nbsp; · &nbsp; ✦ &nbsp; · &nbsp; ✳</div><h2>API 小票</h2><div class="bynd-api-ticket__sub">USAGE ANALYSIS · CONTEXT DEBUGGER</div><div class="bynd-api-ticket__rule"></div><div class="bynd-api-ticket__line"><span>模型</span><b>${escape(latest.model || '未知')}</b></div><div class="bynd-api-ticket__line"><span>请求次数</span><b>${records.length}</b></div><div class="bynd-api-ticket__line"><span>输入 Token</span><b>${totals.estimated ? '≈' : ''}${readable(totals.input)}</b></div><div class="bynd-api-ticket__line"><span>输出 Token</span><b>${totals.estimated ? '≈' : ''}${readable(totals.output)}</b></div><div class="bynd-api-ticket__total"><span>合计 TOTAL</span><strong>${totals.estimated ? '≈' : ''}${readable(totals.total)}</strong></div><p class="bynd-api-ticket__note">${totals.estimated ? '≈ 为本地估算；接口未返回完整 usage。' : 'Token 总量来自接口返回的 usage。'}分类是按实际发送内容估算，不能当作服务商逐项账单。</p><div class="bynd-api-ticket__barcode" aria-hidden="true"></div><div class="bynd-api-ticket__section">01 / 上下文占用</div><div class="bynd-api-ticket__line"><span>本轮输入</span><b>${readable(latest.usage?.input ?? latest.inputEstimate)} ${latest.usage?.input == null ? '≈' : ''}</b></div><div class="bynd-api-ticket__line"><span>窗口上限</span><b>${latest.contextLimit ? readable(latest.contextLimit) : '接口未提供'}</b></div>${latest.contextLimit ? `<div class="bynd-api-ticket__meter"><i style="width:${Math.min(100, Math.round((latest.usage?.input ?? latest.inputEstimate) / latest.contextLimit * 100))}%"></i></div>` : ''}<div class="bynd-api-ticket__line"><span>历史消息总数 / 发出</span><b>${readable(latest.historyCount)} / ${readable(latest.historySent)}</b></div><p class="bynd-api-ticket__note">${latest.historyTruncated ? `聊天构建仅取最近 ${latest.historyWindow} 条，较早消息未直接送出。` : '聊天历史未触发条数裁剪；仍可能受提示词自身压缩影响。'}</p><div class="bynd-api-ticket__section">02 / 输入内容拆解 <small>约数</small></div>${renderRows(latest)}<div class="bynd-api-ticket__section">03 / 世界书实录</div><p class="bynd-api-ticket__note">“已注入”表示条目内容出现在实际请求里；“关键词出现”只检查本轮发出的非系统消息，不代表条件式触发。</p>${latest.worldbook?.length ? latest.worldbook.map(item => `<div class="bynd-api-ticket__book"><b>${escape(item.title)}</b><span>${item.injected ? '已注入' : '未注入'} · ${item.keywordHit ? '关键词出现' : '关键词未出现'}${item.disabled ? ' · 已禁用' : ''}</span><small>${escape(item.preview)}</small></div>`).join('') : '<p class="bynd-api-ticket__note">没有角色世界书条目。</p>'}<div class="bynd-api-ticket__section">04 / 请求逐笔明细</div>${records.map((record, index) => `<details class="bynd-api-ticket__request" ${index === records.length - 1 ? 'open' : ''}><summary>第 ${index + 1} 次 · ${escape(record.status || '未知')} <b>${readable(record.usage?.total ?? (record.inputEstimate + record.outputEstimate))}${record.usage ? '' : '≈'}</b></summary>${record.error ? `<p class="bynd-api-ticket__error">${escape(record.error)}</p>` : ''}${renderDetails(record)}</details>`).join('')}<div class="bynd-api-ticket__end">✦ &nbsp; THANK YOU FOR READING &nbsp; ✦</div></section>`;
        const close = () => { layer.classList.remove('is-open'); setTimeout(() => layer.remove(), 260); };
        layer.querySelectorAll('.bynd-api-ticket__shade, .bynd-api-ticket__close').forEach(node => node.addEventListener('click', close));
        layer.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
        (mount || document.body).appendChild(layer);
        requestAnimationFrame(() => { layer.classList.add('is-open'); layer.querySelector('.bynd-api-ticket__paper')?.focus(); });
    }

    window.ByndApiTicket = { snapshot, finishRequest, totalFor, openTicket, openLedgerTicket, chooseEntryTone, syncEntryTone, refreshEntryTones };
})();
