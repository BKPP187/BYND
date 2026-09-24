/* BYND private comics. Prompt templates are editable here; provider rules remain in force. */
(() => {
    'use strict';
    const DB = 'bynd_comics_v1';
    const root = () => document.getElementById('comic-root');
    const state = { view: 'shelf', filter: 'all', charId: '', seriesId: '', chapterId: '', busy: false, source: null, selectedHistory: new Set(), status: '' };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const id = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const chars = () => (window.myCharacters || []).filter(char => char && char.id);
    const charById = charId => chars().find(char => String(char.id) === String(charId));
    const nameOf = char => typeof getWechatCharDisplayName === 'function' ? getWechatCharDisplayName(char) : (char?.name || '角色');
    const date = time => time ? new Date(time).toLocaleDateString('zh-CN') : '—';
    const say = (message, error = false) => { state.status = message; const el = root()?.querySelector('.comic-status'); if (el) { el.textContent = message; el.classList.toggle('error', error); } };
    function db() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) return reject(new Error('当前环境无法保存漫画：IndexedDB 不可用'));
            const request = indexedDB.open(DB, 1);
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains('series')) database.createObjectStore('series', { keyPath: 'id' });
                if (!database.objectStoreNames.contains('images')) database.createObjectStore('images', { keyPath: 'id' });
                if (!database.objectStoreNames.contains('materials')) database.createObjectStore('materials', { keyPath: 'id' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('漫画数据库打开失败'));
        });
    }
    async function query(store, mode, action) {
        const database = await db();
        return new Promise((resolve, reject) => {
            let result;
            const tx = database.transaction(store, mode);
            const req = action(tx.objectStore(store));
            if (req) { req.onsuccess = () => { result = req.result; }; req.onerror = () => reject(req.error || new Error('数据库读写失败')); }
            tx.oncomplete = () => { database.close(); resolve(result); };
            tx.onerror = () => { database.close(); reject(tx.error || new Error('漫画保存失败')); };
            tx.onabort = () => { database.close(); reject(tx.error || new Error('漫画保存已中断')); };
        });
    }
    const all = store => query(store, 'readonly', object => object.getAll());
    const get = (store, key) => query(store, 'readonly', object => object.get(key));
    const put = (store, value) => query(store, 'readwrite', object => object.put(value));
    const remove = (store, key) => query(store, 'readwrite', object => object.delete(key));
    const series = async () => (await all('series')).sort((a, b) => b.updatedAt - a.updatedAt);
    const current = async () => get('series', state.seriesId);
    const chapter = book => book?.chapters?.find(item => item.id === state.chapterId);
    const profile = char => typeof getWechatChatUserProfile === 'function' ? getWechatChatUserProfile(char) : (typeof getUserProfile === 'function' ? getUserProfile() : {});
    const charReference = char => typeof getWechatImageReferenceForChar === 'function' ? getWechatImageReferenceForChar(char) : (char?.chatConfig?.imageReference || char?.avatar || '');
    function historyRows(char) {
        return (char?.history || []).filter(row => row && (row.content || row.text) && !['image', 'image_stack'].includes(row.type)).slice(-40).map((row, index) => ({
            key: String(row.id || row.timestamp || index),
            speaker: row.isMe ? (profile(char).name || 'User') : nameOf(char),
            text: String(row.content || row.text).slice(0, 900)
        }));
    }
    function transcript(char) {
        const rows = historyRows(char);
        const selected = rows.filter(row => state.selectedHistory.has(row.key));
        return (selected.length ? selected : rows.slice(-12)).map(row => `${row.speaker}：${row.text}`).join('\n');
    }
    async function fileData(file) {
        if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) throw new Error('请选择 PNG、JPG 或 WebP 图片');
        return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图片读取失败')); reader.readAsDataURL(file); });
    }
    async function durableImage(source) {
        if (/^data:image\/(png|jpeg|webp);base64,/i.test(source)) return source;
        if (!/^https?:\/\//i.test(source)) throw new Error('图片地址无效');
        const response = await fetch(source);
        if (!response.ok) throw new Error(`图片下载失败 (${response.status})`);
        const blob = await response.blob();
        if (!/^image\/(png|jpeg|webp)$/i.test(blob.type)) throw new Error('生图服务返回了不支持的图片格式');
        return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图片转存失败')); reader.readAsDataURL(blob); });
    }
    async function storeImage(source) { const key = id('img'); await put('images', { id: key, data: await durableImage(source) }); return key; }
    async function image(key) { return key ? (await get('images', key))?.data || '' : ''; }
    async function save(book) { book.updatedAt = Date.now(); await put('series', book); }
    async function run(fn) { if (state.busy) return; state.busy = true; try { await fn(); } catch (error) { console.error('漫画操作失败', error); say(error.message || '操作失败', true); } finally { state.busy = false; } }
    function frame(title, body, back = 'shelf', right = '') {
        root().innerHTML = `<div class="comic-shell"><header class="comic-topbar"><button type="button" data-action="back" data-view="${back}" aria-label="返回"><i class="ri-arrow-left-s-line"></i></button><div><small>BYND · PRIVATE COMICS</small><strong>${esc(title)}</strong></div>${right}</header><div class="comic-status${state.status ? '' : ' hidden'}">${esc(state.status)}</div><main class="comic-main">${body}</main></div>`;
    }
    async function shelf() {
        state.view = 'shelf';
        const books = await series();
        const active = books.filter(book => (state.filter === 'all' || book.status === state.filter) && (!state.charId || book.charId === state.charId));
        frame('漫画之家', `<section class="comic-hero"><span>只属于你们的故事</span><h1>把每次心动，画成连载。</h1><p>按角色收藏每一条世界线，从聊天续写下一话。</p><button data-action="create">＋ 新建漫画</button></section><nav class="comic-filters">${[['all','全部'],['ongoing','连载中'],['complete','完结'],['draft','草稿'],['private','私密']].map(([key,label]) => `<button data-action="filter" data-id="${key}" class="${state.filter === key ? 'active' : ''}">${label}</button>`).join('')}</nav><div class="comic-char-filter"><button data-action="char-filter" data-id="" class="${!state.charId ? 'active' : ''}">全部角色</button>${chars().map(char => `<button data-action="char-filter" data-id="${esc(char.id)}" class="${state.charId === String(char.id) ? 'active' : ''}">${esc(nameOf(char))}</button>`).join('')}</div><div class="comic-section-heading"><strong>我的作品</strong><span>${active.length} 部系列</span></div><div class="comic-books">${active.map(book => `<button class="comic-book" data-action="series" data-id="${esc(book.id)}"><div class="comic-cover" data-cover="${esc(book.coverKey || '')}"><i class="ri-book-open-line"></i></div><strong>${esc(book.title)}</strong><span>${esc(book.charName)} × ${esc(book.userName)}</span><small>${book.chapters.length} 话 · ${date(book.updatedAt)}</small></button>`).join('') || '<div class="comic-empty"><i class="ri-booklet-line"></i><strong>书架还是空的</strong><p>从一段聊天或一个新设定开始。</p></div>'}</div><button class="comic-material-link" data-action="materials"><i class="ri-gallery-line"></i> 打开素材库 <i class="ri-arrow-right-s-line"></i></button><button class="comic-material-link" data-action="import-project"><i class="ri-upload-2-line"></i> 恢复漫画项目 <i class="ri-arrow-right-s-line"></i></button><input id="comic-import-file" type="file" accept="application/json,.json" hidden>`, 'close', '<button type="button" data-action="materials" aria-label="素材库"><i class="ri-gallery-line"></i></button>');
        for (const box of root().querySelectorAll('[data-cover]')) { const src = await image(box.dataset.cover); if (src) box.innerHTML = `<img src="${esc(src)}" alt="封面">`; }
    }
    function newForm(prefill = {}) {
        state.view = 'create';
        // A source without a resolvable character (forum NPC or user post) must ask instead of silently picking the first one.
        const askChar = !prefill.charId && !!state.source && !charById(state.source.charId);
        const chosen = prefill.charId || (askChar ? '' : state.source?.charId || chars()[0]?.id || '');
        const char = charById(chosen); const user = profile(char);
        frame('新建漫画', `<form id="comic-create-form" class="comic-form"><label>关联角色<select name="charId" id="comic-char">${askChar ? '<option value="" selected>请选择关联角色</option>' : ''}${chars().map(item => `<option value="${esc(item.id)}" ${String(item.id) === String(chosen) ? 'selected' : ''}>${esc(nameOf(item))}</option>`).join('')}</select>${chars().length ? '' : '<small>请先在微信中创建角色。</small>'}</label><label>系列标题<input name="title" required maxlength="80" placeholder="给这条世界线起名" value="${esc(prefill.title || '')}"></label><label>User Persona<select name="personaId" id="comic-persona"></select></label><label>章节标题<input name="chapterTitle" maxlength="80" value="第一话 · 相遇"></label><label>生成来源<select name="source"><option value="custom">自定义剧情</option><option value="chat" ${state.source?.kind === 'chat' ? 'selected' : ''}>聊天剧情</option><option value="forum" ${state.source?.kind === 'forum' ? 'selected' : ''}>论坛剧情</option><option value="dream" ${state.source?.kind === 'dream' ? 'selected' : ''}>盗梦空间</option></select></label><label>剧情梗概 / 自定义剧情<textarea name="plot" rows="5" placeholder="写下要画成漫画的情节">${esc(prefill.plot || state.source?.text || '')}</textarea></label><div class="comic-history" id="comic-history"></div><label>画风<input name="style" value="${esc(prefill.style || '细腻的彩色竖向条漫，电影感构图，人物外形一致')}" maxlength="300"></label><div class="comic-reference-grid"><label>Char 参考图<input type="file" name="charRef" accept="image/png,image/jpeg,image/webp"><select name="charMaterial" id="comic-char-material"></select><small>默认使用角色已保存的参考图</small></label><label>User 参考图<input type="file" name="userRef" accept="image/png,image/jpeg,image/webp"><select name="userMaterial" id="comic-user-material"></select><small>默认使用当前 User Persona 头像</small></label></div><label>复用服装 / 场景 / 画风素材<select name="extraMaterial" id="comic-extra-material"></select></label><button class="comic-primary" type="submit">创建草稿并生成分镜</button></form>`, 'shelf');
        updatePersona(); updateHistory(); updateMaterialOptions().catch(error => say(error.message, true));
    }
    async function updateMaterialOptions() { const items = await all('materials'); for (const [selectId,kind] of [['comic-char-material','char'],['comic-user-material','user'],['comic-extra-material','extra']]) { const select = root()?.querySelector(`#${selectId}`); if (select) select.innerHTML = `<option value="">使用已有参考图</option>${items.filter(item => kind === 'extra' ? ['clothing','scene','style'].includes(item.kind) : item.kind === kind).map(item => `<option value="${esc(item.imageKey)}">${esc(item.title)}</option>`).join('')}`; } }
    function updatePersona() {
        const char = charById(root()?.querySelector('#comic-char')?.value); const selected = profile(char); const personas = typeof getWechatUserPersonaLibrary === 'function' ? getWechatUserPersonaLibrary() : [];
        const select = root()?.querySelector('#comic-persona'); if (!select) return;
        select.innerHTML = `<option value="">当前人设 · ${esc(selected.name || '我')}</option>${personas.map(item => `<option value="${esc(item.id)}" ${item.id === selected.personaId ? 'selected' : ''}>${esc(item.title || item.name || '人设')}</option>`).join('')}`;
    }
    function updateHistory() {
        const char = charById(root()?.querySelector('#comic-char')?.value); const rows = historyRows(char); const target = root()?.querySelector('#comic-history'); if (!target) return;
        target.innerHTML = `<strong>聊天选段 <small>未选时使用最近 12 条</small></strong><div>${rows.map(row => `<label><input type="checkbox" data-history="${esc(row.key)}" ${state.selectedHistory.has(row.key) ? 'checked' : ''}><span><b>${esc(row.speaker)}</b> ${esc(row.text.slice(0, 120))}</span></label>`).join('') || '<p>这个角色还没有聊天记录</p>'}</div>`;
    }
    async function create(form) {
        const values = new FormData(form); const char = charById(values.get('charId')); if (!char) throw new Error('请先选择角色');
        const persona = (typeof getWechatUserPersonaLibrary === 'function' ? getWechatUserPersonaLibrary() : []).find(item => item.id === values.get('personaId'));
        const user = persona || profile(char); const selectedTranscript = values.get('source') === 'chat' ? transcript(char) : '';
        const plot = String(values.get('plot') || '').trim() || selectedTranscript;
        if (!plot) throw new Error('请填写剧情或选择聊天内容');
        const charRef = values.get('charRef')?.size ? await fileData(values.get('charRef')) : (await image(values.get('charMaterial'))) || charReference(char);
        const userRef = values.get('userRef')?.size ? await fileData(values.get('userRef')) : (await image(values.get('userMaterial'))) || user.avatar || profile(char).avatar || '';
        const extraRef = await image(values.get('extraMaterial'));
        const extraMaterial = (await all('materials')).find(item => item.imageKey === values.get('extraMaterial'));
        const now = Date.now(); const book = { id: id('series'), title: String(values.get('title') || '').trim() || `${nameOf(char)}的故事`, charId: char.id, charName: nameOf(char), personaId: user.id || user.personaId || '', userName: user.name || 'User', userBio: user.bio || '', status: 'draft', source: String(values.get('source')), style: String(values.get('style') || '').trim(), charRef, userRef, extraRef, createdAt: now, updatedAt: now, coverKey: '', chapters: [] };
        if (extraMaterial) book.extraMaterial = { kind: extraMaterial.kind, title: extraMaterial.title };
        const part = { id: id('chapter'), title: String(values.get('chapterTitle') || '').trim() || '第一话', source: book.source, plot, transcript: selectedTranscript, createdAt: now, updatedAt: now, sceneState: {}, panels: [], progress: 0 };
        book.chapters.push(part); await save(book); state.seriesId = book.id; state.chapterId = part.id; state.source = null; state.selectedHistory.clear();
        await editor(); await generatePlan(book, part);
    }
    function promptContext(book, part) {
        const char = charById(book.charId);
        const world = typeof getWechatCharacterPersonaText === 'function' && char ? getWechatCharacterPersonaText(char, 10000) : (char?.description || '');
        return `Char：${book.charName}\nUser：${book.userName}\nUser 设定：${book.userBio || ''}\n角色设定与世界书：${world}\n系列画风：${book.style}\n已完成章节：${book.chapters.filter(item => item.id !== part.id).map(item => item.title + '：' + item.plot.slice(0, 400)).join('\n')}\n本话剧情：${part.plot}\n聊天选段：${part.transcript || ''}`;
    }
    function parseJson(text) {
        const clean = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        try { return JSON.parse(clean); } catch (_) { const start = clean.indexOf('{'), end = clean.lastIndexOf('}'); if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1)); throw new Error('分镜脚本不是有效 JSON'); }
    }
    function validatePlan(raw) {
        if (!raw || !Array.isArray(raw.panels) || !raw.panels.length || raw.panels.length > 16) throw new Error('分镜需要 1 到 16 格');
        const scene = raw.sceneState || {};
        const keys = ['charAppearance','userAppearance','clothing','location','time','positions','mood','props','style'];
        for (const key of keys) scene[key] = String(scene[key] || '').slice(0, 400);
        return { scene, panels: raw.panels.map((item, index) => ({ id: id('panel'), order: index, description: String(item.description || '').trim(), dialogue: String(item.dialogue || '').trim(), prompt: String(item.prompt || '').trim(), imageKey: '', error: '' })).filter(item => item.description && item.prompt) };
    }
    async function generatePlan(book, part) {
        if (typeof callChatApi !== 'function') throw new Error('请先配置文字 AI API');
        say('正在理解剧情、提取场景状态和规划分镜…');
        const result = await callChatApi([{ role: 'system', content: '你是私人连载漫画的编剧与分镜导演。只返回 JSON 对象：{ "sceneState": {"charAppearance":"","userAppearance":"","clothing":"","location":"","time":"","positions":"","mood":"","props":"","style":""}, "panels":[{"description":"画面/动作","dialogue":"对白","prompt":"供绘图模型绘制这一格的完整可视化提示词"}] }。生成 4-8 格竖向连续漫画。逐格继承人物外貌、服装、位置、道具和场景；不要把整段剧情交给图像模型；对白存为文字层，不要求图像模型画文字。尊重所选图像服务的内容规则。' }, { role: 'user', content: promptContext(book, part) }], { max_tokens: 4500, temperature: 0.7, usageFeature: 'comic', usageChar: charById(book.charId) });
        if (!result?.ok) throw new Error(result?.error || '分镜生成失败');
        const plan = validatePlan(parseJson(result.content)); if (!plan.panels.length) throw new Error('AI 没有返回可用分镜');
        part.sceneState = plan.scene; part.panels = plan.panels; part.updatedAt = Date.now(); await save(book); say('分镜已保存，可以逐格生成图片。'); await editor();
    }
    async function detail() {
        state.view = 'detail'; const book = await current(); if (!book) return shelf();
        frame(book.title, `<div class="comic-detail"><div class="comic-detail-cover" data-cover="${esc(book.coverKey)}"><i class="ri-book-open-line"></i></div><h1>${esc(book.title)}</h1><p>${esc(book.charName)} × ${esc(book.userName)} · ${book.chapters.length} 话 · 更新于 ${date(book.updatedAt)}</p><div class="comic-actions"><button data-action="continue">继续阅读</button><button data-action="next">生成下一话</button><button data-action="new-extra">创建番外</button></div><div class="comic-actions"><button data-action="char-led">让 ${esc(book.charName)} 创作一话</button><button data-action="toggle-auto">${book.autoCreate ? '关闭' : '开启'}每周主动连载</button></div><label>作品状态<select id="comic-status-select">${[['ongoing','连载中'],['complete','完结'],['draft','草稿'],['private','私密']].map(([key,label]) => `<option value="${key}" ${book.status === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><h2>章节目录</h2>${book.chapters.map((part, index) => `<div class="comic-chapter-row"><button data-action="reader" data-id="${esc(part.id)}"><b>${String(index + 1).padStart(2, '0')}</b><span><strong>${esc(part.title)}</strong><small>${part.panels.length} 格 · ${date(part.updatedAt)}</small></span><i class="ri-arrow-right-s-line"></i></button><button data-action="edit-chapter" data-id="${esc(part.id)}" aria-label="编辑章节"><i class="ri-edit-line"></i></button></div>`).join('')}<div class="comic-export-menu"><button data-action="export-project">导出项目数据</button><button data-action="import-project">导入项目数据</button><input id="comic-import-file" type="file" accept="application/json,.json" hidden></div></div>`, 'shelf');
        const cover = root().querySelector('[data-cover]'); const src = await image(book.coverKey); if (src) cover.innerHTML = `<img src="${esc(src)}" alt="封面">`;
    }
    async function editor() {
        state.view = 'editor'; const book = await current(); const part = chapter(book); if (!part) return detail();
        frame(`编辑 · ${part.title}`, `<div class="comic-editor"><div class="comic-edit-head"><label>章节标题<input id="comic-chapter-title" value="${esc(part.title)}" maxlength="80"></label><button data-action="plan">${part.panels.length ? '重新规划分镜' : '生成分镜'}</button><button data-action="generate-all">生成未完成图片</button></div><label>剧情<textarea id="comic-plot" rows="4">${esc(part.plot)}</textarea></label><details><summary>场景 / 视觉状态</summary><textarea id="comic-scene" rows="7">${esc(JSON.stringify(part.sceneState || {}, null, 2))}</textarea></details><div class="comic-panels">${part.panels.map((panel, index) => `<article class="comic-panel" data-panel="${esc(panel.id)}"><div class="comic-panel-head"><strong>分镜 ${index + 1}</strong><div><button data-action="up" data-id="${esc(panel.id)}" aria-label="上移">↑</button><button data-action="down" data-id="${esc(panel.id)}" aria-label="下移">↓</button><button data-action="delete-panel" data-id="${esc(panel.id)}" aria-label="删除">×</button></div></div><div class="comic-panel-image" data-image="${esc(panel.imageKey)}"><i class="ri-image-line"></i></div><label>画面描述<input data-field="description" value="${esc(panel.description)}"></label><label>对白<input data-field="dialogue" value="${esc(panel.dialogue)}"></label><label>生图 Prompt<textarea data-field="prompt" rows="4">${esc(panel.prompt)}</textarea></label>${panel.error ? `<small class="comic-error">${esc(panel.error)}</small>` : ''}<div class="comic-panel-actions"><button data-action="generate-panel" data-id="${esc(panel.id)}">${panel.imageKey ? '重新生成' : '生成该格'}</button><button data-action="replace-panel" data-id="${esc(panel.id)}">替换图片</button><button data-action="save-panel" data-id="${esc(panel.id)}">保存单格</button><input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${esc(panel.id)}" hidden></div></article>`).join('')}</div><button data-action="add-panel">＋ 添加新分镜</button><div class="comic-actions"><button data-action="reader" data-id="${esc(part.id)}">预览阅读</button><button data-action="export" data-format="long">导出整话长图</button><button data-action="export" data-format="images">导出章节图片</button><button data-action="export" data-format="zip">导出 ZIP 原图</button><button data-action="export" data-format="pdf">导出 PDF</button></div></div>`, 'detail');
        for (const box of root().querySelectorAll('[data-image]')) { const src = await image(box.dataset.image); if (src) box.innerHTML = `<img src="${esc(src)}" alt="漫画分镜">`; }
    }
    async function reader() {
        state.view = 'reader'; const book = await current(), part = chapter(book); if (!part) return detail();
        frame(part.title, `<div class="comic-reader" id="comic-reader">${part.panels.map((panel, index) => `<section data-index="${index}" class="comic-read-panel"><div data-image="${esc(panel.imageKey)}" class="comic-read-image">${panel.imageKey ? '' : '<span>图片尚未生成</span>'}</div>${panel.dialogue ? `<p>${esc(panel.dialogue)}</p>` : ''}</section>`).join('')}<div class="comic-reader-end">本话完 <button data-action="edit-chapter" data-id="${esc(part.id)}">继续创作</button><button data-action="next">下一话</button></div></div>`, 'detail', '<button data-action="edit-chapter" aria-label="编辑"><i class="ri-edit-line"></i></button>');
        for (const box of root().querySelectorAll('[data-image]')) { const src = await image(box.dataset.image); if (src) box.innerHTML = `<img src="${esc(src)}" alt="漫画分镜">`; }
        const container = root().querySelector('.comic-main'); const target = root().querySelector(`[data-index="${Math.min(part.progress || 0, part.panels.length - 1)}"]`); if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
        container.onscroll = () => { const rows = [...container.querySelectorAll('[data-index]')]; let visible = null; for (const row of rows) if (row.getBoundingClientRect().top < container.getBoundingClientRect().top + 90) visible = row; const progress = Number(visible?.dataset.index || 0); if (progress !== part.progress) { part.progress = progress; clearTimeout(state.progressTimer); state.progressTimer = setTimeout(() => save(book).catch(error => say(`阅读位置保存失败：${error.message}`, true)), 600); } };
    }
    async function generatePanel(panelId) {
        const book = await current(), part = chapter(book), panel = part?.panels.find(item => item.id === panelId); if (!panel) throw new Error('找不到分镜');
        if (typeof callWechatImageGenerationApi !== 'function') throw new Error('请先配置生图 API');
        const scene = Object.entries(part.sceneState || {}).map(([key,value]) => `${key}: ${value}`).join('\n');
        const prompt = `${book.style}\n连续性设定：\n${scene}\n本格画面：${panel.prompt}\n${book.extraRef ? `附加素材参考图是${book.extraMaterial?.kind || '素材'}「${book.extraMaterial?.title || ''}」，仅用于所述素材，不替换 Char 或 User 身份。` : ''}\n只绘制本格，不排成整话；对白由漫画阅读器叠加，无需在图片里绘制文字。`;
        say(`正在绘制第 ${part.panels.indexOf(panel) + 1} 格…`);
        const refs = [book.charRef, book.userRef, book.extraRef].filter(Boolean);
        const result = await callWechatImageGenerationApi(prompt, { referenceImage: refs[0] || '', additionalReferences: refs.slice(1), size: '1024x1536', requireReference: false, usageChar: charById(book.charId) });
        if (!result?.ok || !result.url) { panel.error = result?.error || '生图服务没有返回图片'; await save(book); await editor(); throw new Error(panel.error); }
        const key = await storeImage(result.url); const oldKey = panel.imageKey; panel.imageKey = key; panel.error = ''; if (!book.coverKey || book.coverKey === oldKey) book.coverKey = key; part.updatedAt = Date.now(); await save(book); if (oldKey && oldKey !== book.coverKey) await remove('images', oldKey).catch(console.warn); say('图片已保存'); await editor();
    }
    async function materials() {
        state.view = 'materials'; const items = await all('materials');
        frame('素材库', `<div class="comic-materials"><p>保存人物、服装、场景与画风，后续章节可直接复用。</p><form id="comic-material-form"><input name="title" required placeholder="素材名称"><select name="kind"><option value="char">Char 参考图</option><option value="user">User 参考图</option><option value="clothing">服装</option><option value="scene">场景</option><option value="style">画风</option></select><input name="file" type="file" accept="image/png,image/jpeg,image/webp" required><button>保存素材</button></form><div class="comic-material-grid">${items.map(item => `<article><div data-image="${esc(item.imageKey)}"></div><strong>${esc(item.title)}</strong><small>${esc(item.kind)}</small><button data-action="delete-material" data-id="${esc(item.id)}">删除</button></article>`).join('')}</div></div>`, 'shelf');
        for (const box of root().querySelectorAll('[data-image]')) { const src = await image(box.dataset.image); if (src) box.innerHTML = `<img src="${esc(src)}" alt="素材">`; }
    }
    async function nextChapter(extra = false) {
        const book = await current(); if (!book) return;
        const char = charById(book.charId); const recent = transcript(char);
        const title = extra ? `番外 · ${book.chapters.length + 1}` : `第${book.chapters.length + 1}话`;
        const plot = prompt(`请输入「${title}」的剧情；可基于最近聊天续写：`, recent.slice(-1600)); if (plot === null) return;
        const part = { id: id('chapter'), title, source: recent ? 'chat' : 'custom', plot: plot.trim(), transcript: recent, createdAt: Date.now(), updatedAt: Date.now(), sceneState: { ...(book.chapters.at(-1)?.sceneState || {}) }, panels: [], progress: 0 };
        if (!part.plot) throw new Error('下一话需要剧情内容'); book.chapters.push(part); await save(book); state.chapterId = part.id; await editor(); await generatePlan(book, part);
    }
    async function charLed(book) {
        const char = charById(book.charId); if (!char) throw new Error('关联角色已不存在');
        if (typeof callChatApi !== 'function') throw new Error('请先配置文字 AI API');
        const recent = transcript(char); if (!recent) throw new Error('需要先和角色聊天，才能由角色主动续画');
        say(`${book.charName} 正在构思与你的互动…`);
        const result = await callChatApi([{ role:'system', content:'你是漫画系列中的 Char。基于真实聊天、角色卡和已有章节，主动提出一话 Char × User 互动剧情。只返回 JSON：{"title":"章节标题","plot":"约 200 字的连续漫画情节"}。由 Char 的真实意图推动，不能捏造已经发生的共同经历。具体内容遵守所选服务规则。' }, { role:'user', content:`${promptContext(book,{id:'new',plot:'',transcript:recent})}\n请为下一话提出剧情。` }], { max_tokens:900, temperature:.85, usageFeature:'comic', usageChar:char });
        if (!result?.ok) throw new Error(result?.error || '角色构思失败');
        const idea = parseJson(result.content); if (!String(idea.plot || '').trim()) throw new Error('角色没有返回有效剧情');
        const part = { id:id('chapter'), title:String(idea.title || `第${book.chapters.length+1}话`).slice(0,80), source:'char-led', plot:String(idea.plot).slice(0,3000), transcript:recent, createdAt:Date.now(), updatedAt:Date.now(), sceneState:{ ...(book.chapters.at(-1)?.sceneState || {}) }, panels:[], progress:0 };
        book.chapters.push(part); book.lastProactiveAt = Date.now(); book.status = 'ongoing'; await save(book); state.seriesId = book.id; state.chapterId = part.id;
        await generatePlan(book, part);
        for (const panel of part.panels) await generatePanel(panel.id);
        await detail(); say(`${book.charName} 的新漫画已保存`);
    }
    async function maybeProactive() {
        const due = (await series()).find(book => book.autoCreate && book.status !== 'complete' && Date.now() - (book.lastProactiveAt || book.createdAt) >= 7 * 86400000 && (charById(book.charId)?.history || []).some(row => Number(row.timestamp || 0) > (book.lastProactiveAt || book.createdAt)));
        if (due) await run(() => charLed(due));
    }
    async function download(data, filename, type) {
        const blob = data instanceof Blob ? data : new Blob([data], { type });
        const bridge = window.ByndAndroid;
        if (bridge?.beginDocumentExport && bridge?.appendBackupExportChunk && bridge?.finishBackupExport) {
            return new Promise((resolve, reject) => {
                const token = id('comicexport');
                let done = false;
                const cleanup = () => {
                    window.removeEventListener('bynd:backup-export-ready', ready);
                    window.removeEventListener('bynd:backup-export', finished);
                    clearTimeout(timer);
                };
                const fail = error => {
                    if (done) return;
                    done = true; cleanup();
                    try { bridge.abortBackupExport(token); } catch (_) {}
                    reject(error instanceof Error ? error : new Error(String(error)));
                };
                const finished = event => {
                    if (event.detail?.id !== token || done) return;
                    if (!event.detail.ok) return fail(new Error(event.detail.message || '导出失败'));
                    done = true; cleanup(); resolve(event.detail.message || '文件已保存');
                };
                const ready = async event => {
                    if (event.detail?.id !== token || done) return;
                    try {
                        for (let offset = 0; offset < blob.size; offset += 192 * 1024) {
                            const chunk = blob.slice(offset, offset + 192 * 1024);
                            const base64 = await new Promise((resolveChunk, rejectChunk) => {
                                const reader = new FileReader();
                                reader.onload = () => resolveChunk(String(reader.result).split(',')[1] || '');
                                reader.onerror = () => rejectChunk(new Error('导出文件读取失败'));
                                reader.readAsDataURL(chunk);
                            });
                            if (done) return;
                            const accepted = bridge.appendBackupExportChunk(token, base64);
                            if (accepted !== true && accepted !== 'true') throw new Error('导出分段写入失败');
                            await new Promise(next => setTimeout(next, 0));
                        }
                        bridge.finishBackupExport(token);
                    } catch (error) { fail(error); }
                };
                const timer = setTimeout(() => fail(new Error('系统文件选择或写入超时')), 120000);
                window.addEventListener('bynd:backup-export-ready', ready);
                window.addEventListener('bynd:backup-export', finished);
                try { bridge.beginDocumentExport(token, filename, type); } catch (error) { fail(error); }
            });
        }
        const url = URL.createObjectURL(blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = filename; document.body.appendChild(anchor);
        anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    async function exportProject() { const book = await current(); const keys = new Set([book.coverKey, ...book.chapters.flatMap(part => part.panels.map(panel => panel.imageKey))].filter(Boolean)); const images = {}; for (const key of keys) images[key] = await image(key); await download(JSON.stringify({ format: 'bynd-comic', version: 1, series: book, images }, null, 2), `${book.title}.bynd-comic.json`, 'application/json'); }
    async function importProject(file) {
        const payload = JSON.parse(await file.text()); if (payload?.format !== 'bynd-comic' || !payload.series || !Array.isArray(payload.series.chapters)) throw new Error('这不是有效的 BYND 漫画项目');
        const book = structuredClone(payload.series); book.id = id('series'); book.createdAt = Date.now(); book.updatedAt = Date.now();
        const keys = [...new Set([book.coverKey, ...book.chapters.flatMap(part => part.panels.map(panel => panel.imageKey))].filter(Boolean))];
        for (const key of keys) if (!/^data:image\/(png|jpeg|webp);base64,/i.test(payload.images?.[key] || '')) throw new Error(`项目缺少有效图片 ${key}`);
        const remap = new Map();
        for (const key of keys) { const next = id('img'); await put('images', { id: next, data: payload.images[key] }); remap.set(key, next); }
        book.coverKey = remap.get(book.coverKey) || '';
        for (const part of book.chapters) for (const panel of part.panels) panel.imageKey = remap.get(panel.imageKey) || '';
        await save(book); state.seriesId = book.id; await detail(); say('漫画项目已导入');
    }
    async function savePanel(panelId) { const panel = chapter(await current())?.panels.find(item => item.id === panelId); const source = await image(panel?.imageKey); if (!source) throw new Error('这格还没有图片'); const picture = await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('图片无法读取'));img.src=source;}); const canvas=document.createElement('canvas');canvas.width=picture.width;canvas.height=picture.height;canvas.getContext('2d').drawImage(picture,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('图片保存失败');await download(blob,`${panelId}.png`,'image/png'); }
    function toBytes(dataUrl) { const [head, body] = dataUrl.split(','); const raw = atob(body); const bytes = Uint8Array.from(raw, char => char.charCodeAt(0)); return { bytes, mime: head.match(/data:([^;]+)/)?.[1] || 'image/png' }; }
    async function exportChapter(format) {
        const book = await current(), part = chapter(book); const panels = [];
        for (const panel of part.panels) { const source = await image(panel.imageKey); if (!source) throw new Error(`分镜 ${part.panels.indexOf(panel) + 1} 尚未生成图片`); panels.push(source); }
        if (!panels.length) throw new Error('章节还没有图片');
        if (format === 'images') { for (let index = 0; index < part.panels.length; index++) await savePanel(part.panels[index].id); return; }
        if (format === 'zip') { const files = panels.map((source, index) => { const decoded = toBytes(source); return { name: `${String(index + 1).padStart(3, '0')}.${decoded.mime === 'image/jpeg' ? 'jpg' : decoded.mime === 'image/webp' ? 'webp' : 'png'}`, bytes: decoded.bytes }; }); await download(makeZip(files), `${part.title}.zip`, 'application/zip'); return; }
        const pictures = await Promise.all(panels.map(source => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('章节图片无法读取')); img.src = source; })));
        const width = 1024;
        const frames = pictures.map((picture, index) => {
            const pictureHeight = Math.round(picture.height * width / picture.width);
            const dialogue = String(part.panels[index].dialogue || '');
            const measure = document.createElement('canvas').getContext('2d'); measure.font = '26px sans-serif';
            const lines = []; let line = '';
            for (const char of dialogue) {
                if (char === '\n' || measure.measureText(line + char).width > width - 100) { lines.push(line); line = char === '\n' ? '' : char; }
                else line += char;
            }
            if (line) lines.push(line);
            const captionHeight = lines.length ? 44 + lines.length * 38 : 0;
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = pictureHeight + captionHeight;
            const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, canvas.height);
            context.drawImage(picture, 0, 0, width, pictureHeight);
            if (lines.length) { context.fillStyle = '#302823'; context.font = '26px sans-serif'; lines.forEach((text, row) => context.fillText(text, 50, pictureHeight + 49 + row * 38)); }
            return canvas;
        });
        if (format === 'long') { const total = frames.reduce((height, frame) => height + frame.height, 0); if (total > 30000) throw new Error('整话太长，浏览器无法导出单张长图；请改用 ZIP 或 PDF'); const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = total; const ctx = canvas.getContext('2d'); let y = 0; frames.forEach(frame => { ctx.drawImage(frame, 0, y); y += frame.height; }); const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png')); if (!blob) throw new Error('长图导出失败'); await download(blob, `${part.title}.png`, 'image/png'); return; }
        if (format === 'pdf') { const pages = frames.map(frame => ({ width, height: frame.height, bytes: toBytes(frame.toDataURL('image/jpeg',.88)).bytes })); await download(makePdf(pages), `${part.title}.pdf`, 'application/pdf'); }
    }
    const crcTable = Array.from({length:256}, (_,i) => { let c=i; for(let n=0;n<8;n++) c=(c&1)?0xedb88320^(c>>>1):c>>>1; return c>>>0; });
    function makeZip(files) {
        const encoder = new TextEncoder(), chunks = [], directory = [];
        let offset = 0;
        const set16 = (view, at, value) => view.setUint16(at, value, true);
        const set32 = (view, at, value) => view.setUint32(at, value >>> 0, true);
        for (const file of files) {
            const name = encoder.encode(file.name), data = file.bytes;
            let crc = 0xffffffff;
            for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
            crc = (crc ^ 0xffffffff) >>> 0;
            const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
            set32(lv, 0, 0x04034b50); set16(lv, 4, 20);
            set32(lv, 14, crc); set32(lv, 18, data.length); set32(lv, 22, data.length);
            set16(lv, 26, name.length); local.set(name, 30);
            chunks.push(local, data);
            const entry = new Uint8Array(46 + name.length), ev = new DataView(entry.buffer);
            set32(ev, 0, 0x02014b50); set16(ev, 4, 20); set16(ev, 6, 20);
            set32(ev, 16, crc); set32(ev, 20, data.length); set32(ev, 24, data.length);
            set16(ev, 28, name.length); set32(ev, 42, offset); entry.set(name, 46);
            directory.push(entry); offset += local.length + data.length;
        }
        const size = directory.reduce((total, entry) => total + entry.length, 0);
        const footer = new Uint8Array(22), view = new DataView(footer.buffer);
        set32(view, 0, 0x06054b50); set16(view, 8, files.length); set16(view, 10, files.length);
        set32(view, 12, size); set32(view, 16, offset);
        return new Blob([...chunks, ...directory, footer], { type: 'application/zip' });
    }
    function makePdf(pages) { const enc=new TextEncoder(), parts=[], offsets=[0]; let length=0; const add=value=>{const bytes=typeof value==='string'?enc.encode(value):value; parts.push(bytes); length+=bytes.length;}; add('%PDF-1.4\n'); const objects=[]; const count=2+pages.length*3; objects[1]='<< /Type /Catalog /Pages 2 0 R >>'; objects[2]=`<< /Type /Pages /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] /Count ${pages.length} >>`; pages.forEach((page,i)=>{const base=3+i*3; objects[base]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /Im${i} ${base+1} 0 R >> >> /Contents ${base+2} 0 R >>`; objects[base+1]=[`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,page.bytes,'\nendstream'];const stream=`q ${page.width} 0 0 ${page.height} 0 0 cm /Im${i} Do Q`;objects[base+2]=`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}\nendstream`;}); for(let i=1;i<=count;i++){offsets[i]=length;add(`${i} 0 obj\n`);const obj=objects[i]; if(Array.isArray(obj)) obj.forEach(add); else add(obj); add('\nendobj\n');} const xref=length;add(`xref\n0 ${count+1}\n0000000000 65535 f \n`);for(let i=1;i<=count;i++) add(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);add(`trailer\n<< /Size ${count+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);return new Blob(parts,{type:'application/pdf'}); }
    async function action(button) {
        const type = button.dataset.action, key = button.dataset.id;
        if (type === 'back') { if (button.dataset.view === 'close') closeApp('comic'); else if (button.dataset.view === 'detail') await detail(); else await shelf(); }
        if (type === 'create') newForm();
        if (type === 'filter') { state.filter = key; await shelf(); }
        if (type === 'char-filter') { state.charId = key; await shelf(); }
        if (type === 'series') { state.seriesId = key; await detail(); }
        if (type === 'materials') await materials();
        if (type === 'reader') { if (key) state.chapterId = key; await reader(); }
        if (type === 'edit-chapter') { if (key) state.chapterId = key; await editor(); }
        if (type === 'continue') { const book = await current(); state.chapterId = book.chapters.find(part => part.progress < part.panels.length - 1)?.id || book.chapters.at(-1)?.id; await reader(); }
        if (type === 'plan') { const book = await current(), part = chapter(book); if (part.panels.length && !confirm('重新规划会替换当前分镜和图片，确定继续吗？')) return; const old = part.panels.map(panel => panel.imageKey).filter(Boolean); if (old.includes(book.coverKey)) book.coverKey = ''; await generatePlan(book, part); for (const imageKey of old) await remove('images', imageKey).catch(console.warn); }
        if (type === 'generate-all') { const part = chapter(await current()); for (const panel of part.panels.filter(item => !item.imageKey)) await generatePanel(panel.id); }
        if (type === 'generate-panel') await generatePanel(key);
        if (type === 'next' || type === 'new-extra') await nextChapter(type === 'new-extra');
        if (type === 'char-led') await charLed(await current());
        if (type === 'toggle-auto') { const book = await current(); book.autoCreate = !book.autoCreate; await save(book); await detail(); say(book.autoCreate ? '已开启每周主动连载：打开漫画时若有新聊天，会自动生成一话' : '已关闭每周主动连载'); }
        if (type === 'export-project') await exportProject();
        if (type === 'import-project') root().querySelector('#comic-import-file')?.click();
        if (type === 'export') await exportChapter(button.dataset.format);
        if (type === 'save-panel') await savePanel(key);
        if (type === 'replace-panel') root().querySelector(`[data-upload="${CSS.escape(key)}"]`)?.click();
        if (type === 'add-panel' || ['up','down','delete-panel'].includes(type)) { const book = await current(), part = chapter(book); let deletedImage = ''; if (type === 'add-panel') part.panels.push({id:id('panel'),description:'',dialogue:'',prompt:'',imageKey:'',error:''}); else { const index = part.panels.findIndex(item => item.id === key); if(index<0)return; if(type==='delete-panel'){if(!confirm('删除这一格？'))return;deletedImage = part.panels[index].imageKey;part.panels.splice(index,1);if (book.coverKey === deletedImage) book.coverKey = part.panels.find(panel => panel.imageKey)?.imageKey || '';}else {const target=index+(type==='up'?-1:1);if(target<0||target>=part.panels.length)return;[part.panels[index],part.panels[target]]=[part.panels[target],part.panels[index]];} } part.panels.forEach((panel,index)=>panel.order=index); await save(book); if (deletedImage && deletedImage !== book.coverKey) await remove('images',deletedImage).catch(console.warn); await editor(); }
        if (type === 'delete-material') { const item = await get('materials', key); if (!item || !confirm('删除这个素材？')) return; await remove('materials', key); await remove('images', item.imageKey); await materials(); }
    }
    function bind() {
        const host = root(); if (!host || host.dataset.bound) return; host.dataset.bound = '1';
        host.addEventListener('click', event => { const button = event.target.closest('[data-action]'); if (button) { event.preventDefault(); run(() => action(button)); } });
        host.addEventListener('submit', event => { event.preventDefault(); const form = event.target; run(async () => { if (form.id === 'comic-create-form') await create(form); if (form.id === 'comic-material-form') { const data = new FormData(form); const imageKey = await storeImage(await fileData(data.get('file'))); await put('materials', { id:id('material'), title:String(data.get('title')).trim(), kind:String(data.get('kind')), imageKey, createdAt:Date.now() }); await materials(); } }); });
        host.addEventListener('change', event => { const target = event.target; run(async () => { if (target.id === 'comic-char') { state.selectedHistory.clear(); updatePersona(); updateHistory(); } if (target.dataset.history) { target.checked ? state.selectedHistory.add(target.dataset.history) : state.selectedHistory.delete(target.dataset.history); } if (target.id === 'comic-status-select') { const book = await current(); book.status = target.value; await save(book); say('作品状态已保存'); } if (target.id === 'comic-import-file' && target.files[0]) await importProject(target.files[0]); if (target.dataset.upload && target.files[0]) { const book = await current(), part = chapter(book), panel = part.panels.find(item => item.id === target.dataset.upload); const imageKey = await storeImage(await fileData(target.files[0])); panel.imageKey = imageKey; if (!book.coverKey) book.coverKey = imageKey; await save(book); await editor(); } if (target.id === 'comic-chapter-title' || target.id === 'comic-plot' || target.id === 'comic-scene' || target.dataset.field) { const book = await current(), part = chapter(book); if(target.id==='comic-chapter-title')part.title=target.value.trim()||part.title; if(target.id==='comic-plot')part.plot=target.value; if(target.id==='comic-scene')part.sceneState=JSON.parse(target.value); if(target.dataset.field)part.panels.find(item=>item.id===target.closest('[data-panel]').dataset.panel)[target.dataset.field]=target.value; part.updatedAt=Date.now(); await save(book); say('修改已保存'); } }); });
    }
    async function open(source = null) { bind(); state.source = source; if (source) { state.selectedHistory.clear(); newForm(); } else { await run(shelf); await maybeProactive(); } }
    window.ByndComic = { open, fromChat(charId) { window._comicPendingSource = {kind:'chat',charId}; openApp('comic'); }, fromSource(kind, charId, text) { window._comicPendingSource = {kind,charId,text}; openApp('comic'); }, storage: { all, get, put, remove }, _test: { validatePlan, durableImage, makeZip, makePdf } };
})();
