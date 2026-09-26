    // ---- editor (storyboard, tags, dialogue) ----
    const WHO_LABEL = { char: 'Char', user: 'User', narration: '旁白', sfx: '拟声', other: '路人' };
    function option(list, selected) {
        return Object.entries(list).map(([key, label]) => `<option value="${esc(key)}" ${key === selected ? 'selected' : ''}>${esc(typeof label === 'string' ? label : label.label)}</option>`).join('');
    }
    function panelCard(book, part, panel, index, nai) {
        const type = typeOf(book.type);
        const drawing = state.job?.kind === 'render' && state.job.current === panel.id;
        const names = { char: book.charName, user: book.userName };
        return `<article class="ct-card${drawing ? ' drawing' : ''}" data-panel-card="${esc(panel.id)}">
            <header><b>${index + 1}</b>${type.fixedShot ? `<span class="ct-card-shot">${esc(shotOf(panel.shot).label)}</span>` : `<select data-panel-field="shot" aria-label="构图">${option(SHOTS, panel.shot)}</select>`}${type.layout === 'strip' ? `<select data-panel-field="gutter" aria-label="下方留白">${option(GUTTERS, panel.gutter)}</select><select data-panel-field="tone" aria-label="留白颜色">${option({ light: '白色留白', dark: '黑色留白' }, panel.tone)}</select>` : ''}<div class="ct-card-tools">${type.panels[1] > 1 ? `<button type="button" data-action="panel-up" data-id="${esc(panel.id)}" aria-label="上移"><i class="ri-arrow-up-s-line"></i></button><button type="button" data-action="panel-down" data-id="${esc(panel.id)}" aria-label="下移"><i class="ri-arrow-down-s-line"></i></button><button type="button" data-action="panel-delete" data-id="${esc(panel.id)}" aria-label="删除"><i class="ri-delete-bin-6-line"></i></button>` : ''}</div></header>
            <div class="ct-card-preview">${panelHtml(panel)}${drawing ? '<div class="ct-drawing"><i class="ri-brush-3-line"></i><span>正在画…</span></div>' : ''}</div>
            ${panel.error ? `<p class="ct-card-error"><i class="ri-error-warning-line"></i>${esc(panel.error)}</p>` : ''}
            <label class="ct-field"><span>剧情节拍</span><textarea data-panel-field="beat" rows="2">${esc(panel.beat)}</textarea></label>
            ${nai ? `<label class="ct-field"><span>场景标签 <em>NovelAI</em></span><textarea data-panel-field="scene" rows="2" spellcheck="false">${esc(panel.scene || '')}</textarea></label>${(panel.chars || []).map((person, at) => `<label class="ct-field ct-char-field"><span>${esc(names[person.who] || WHO_LABEL[person.who] || '人物')} 的动作表情<button type="button" data-action="char-remove" data-id="${esc(panel.id)}" data-index="${at}">移除</button></span><textarea data-char-field="${at}" rows="2" spellcheck="false">${esc(person.tags)}</textarea></label>`).join('')}<div class="ct-inline-actions"><button type="button" data-action="char-add" data-id="${esc(panel.id)}" data-who="char">＋ ${esc(book.charName)} 出镜</button><button type="button" data-action="char-add" data-id="${esc(panel.id)}" data-who="user">＋ ${esc(book.userName)} 出镜</button></div>` : `<label class="ct-field"><span>画面描述</span><textarea data-panel-field="prompt" rows="3">${esc(panel.prompt || '')}</textarea></label>`}
            <div class="ct-bubble-editor"><span class="ct-bubble-editor-title">台词气泡 <em>在上面的图里拖动位置</em></span>${(panel.bubbles || []).map(bubble => `<div class="ct-bubble-row" data-bubble-row="${esc(bubble.id)}"><select data-bubble-field="who">${option({ char: book.charName, user: book.userName, narration: '旁白', sfx: '拟声' }, bubble.who)}</select><select data-bubble-field="kind">${option(BUBBLE_KINDS, bubble.kind)}</select><input data-bubble-field="text" maxlength="80" value="${esc(bubble.text)}"><button type="button" data-action="bubble-remove" data-id="${esc(bubble.id)}" aria-label="删除气泡"><i class="ri-close-line"></i></button></div>`).join('')}<button type="button" class="ct-add-bubble" data-action="bubble-add" data-id="${esc(panel.id)}">＋ 气泡</button></div>
            <footer><button type="button" data-action="generate-panel" data-id="${esc(panel.id)}"><i class="ri-refresh-line"></i>${panel.imageKey ? '重画这一格' : '只画这一格'}</button><button type="button" data-action="upload-panel" data-id="${esc(panel.id)}"><i class="ri-upload-2-line"></i>用本地图片</button><input type="file" data-upload="${esc(panel.id)}" accept="image/png,image/jpeg,image/webp" hidden></footer>
        </article>`;
    }
    function extraFields(book, part) {
        const layout = typeOf(book.type).layout;
        const fields = [];
        if (['illust'].includes(layout)) fields.push(`<label class="ct-field"><span>配文</span><textarea data-edit="story" rows="4">${esc(part.story || '')}</textarea></label>`);
        if (layout === 'polaroid') fields.push(`<label class="ct-field"><span>手写便签</span><input data-edit="caption" maxlength="40" value="${esc(part.caption || '')}"></label>`);
        if (layout === 'poster') {
            const poster = part.poster || {};
            fields.push(`<div class="ct-field-grid">${[['title', '片名'], ['subtitle', '英文副标题'], ['tagline', '宣传语'], ['credits', '演职员'], ['date', '日期']].map(([key, label]) => `<label class="ct-field"><span>${label}</span><input data-edit="poster.${key}" maxlength="80" value="${esc(poster[key] || '')}"></label>`).join('')}</div>`);
        }
        fields.push(`<label class="ct-field"><span>作者的话</span><input data-edit="authorNote" maxlength="120" value="${esc(part.authorNote || '')}"></label>`);
        return fields.join('');
    }
    async function editor() {
        const book = await current();
        if (!book) return home();
        const part = chapter(book);
        if (!part) return openBook(book.id);
        state.view = 'editor';
        const type = typeOf(book.type);
        const route = imageRoute();
        const nai = (part.provider || route.provider) === 'novelai';
        const planning = state.job?.kind === 'plan' && state.job.chapterId === part.id;
        const missing = part.panels.filter(panel => !panel.imageKey).length;
        const rendering = state.job?.kind === 'render' && state.job.chapterId === part.id;
        let content;
        if (planning || (!part.panels.length && part.state === 'planning' && state.job)) {
            content = `<div class="ct-planning"><div class="ct-planning-pen"><i class="ri-quill-pen-line"></i></div><strong>${esc(book.charName)} 正在写分镜</strong><p>正在构思剧情、分格、台词和画面${nai ? '标签' : '描述'}，通常需要半分钟到一分钟。</p><div class="ct-skeleton">${Array.from({ length: Math.min(type.defaultPanels, 3) }, () => '<i></i>').join('')}</div></div>`;
        } else if (!part.panels.length) {
            content = `<div class="ct-planning failed"><i class="ri-draft-line"></i><strong>${part.planError ? '分镜没有写成' : '还没有分镜'}</strong>${part.planError ? `<p class="ct-card-error">${esc(part.planError)}</p>` : '<p>让 Char 根据剧情写分镜和台词。</p>'}<button type="button" class="ct-primary" data-action="replan">${part.planError ? '重新生成分镜' : '生成分镜'}</button></div>`;
        } else {
            content = `<details class="ct-cast"><summary><i class="ri-user-star-line"></i>角色外观${nai ? '标签' : ''}<em>每一格都会带上</em></summary><label class="ct-field"><span>${esc(book.charName)}</span><textarea data-edit="cast.char" rows="3" spellcheck="false">${esc(book.cast?.char || '')}</textarea></label><label class="ct-field"><span>${esc(book.userName)}</span><textarea data-edit="cast.user" rows="3" spellcheck="false">${esc(book.cast?.user || '')}</textarea></label><button type="button" data-action="save-cast">存为这两人的默认外观</button></details>${extraFields(book, part)}<div class="ct-board">${part.panels.map((panel, index) => panelCard(book, part, panel, index, nai)).join('')}</div><div class="ct-inline-actions board">${part.panels.length < type.panels[1] ? '<button type="button" data-action="panel-add">＋ 加一格</button>' : ''}<button type="button" data-action="replan">重写分镜</button></div>`;
        }
        const cta = part.panels.length && !planning
            ? (rendering ? '' : missing ? `<div class="ct-cta"><button type="button" class="ct-primary" data-action="generate">开始生成 ${missing} 张</button></div>` : `<div class="ct-cta"><button type="button" class="ct-primary" data-action="view">查看成品</button></div>`)
            : '';
        frame({
            title: type.series ? part.title : book.title,
            back: type.series ? 'series' : 'home',
            className: 'ct-editor',
            right: `<span class="ct-route-chip${route.provider ? '' : ' missing'}">${esc(route.provider === 'novelai' ? 'NovelAI' : route.provider === 'api' ? '中转站' : '未配置')}</span>`,
            body: `<div class="ct-editor-meta">${typeBadge(book.type)}<input class="ct-title-input" data-edit="title" maxlength="30" value="${esc(type.series ? part.title : book.title)}" aria-label="标题"></div>${content}${cta}`
        });
        fitBubbles();
        await fillImages();
    }
    async function refreshPanel(panelId) {
        if (state.view !== 'editor') return;
        const card = root()?.querySelector(`[data-panel-card="${CSS.escape(panelId)}"]`);
        if (!card) return;
        const book = await current();
        const part = chapter(book);
        const index = part?.panels.findIndex(panel => panel.id === panelId) ?? -1;
        if (index < 0) return;
        const nai = (part.provider || imageRoute().provider) === 'novelai';
        const holder = document.createElement('div');
        holder.innerHTML = panelCard(book, part, part.panels[index], index, nai);
        const fresh = holder.firstElementChild;
        card.replaceWith(fresh);
        fitBubbles(fresh);
        await fillImages(fresh);
    }
    // Bubbles are dragged inside the preview; positions are stored as fractions of the panel.
    function bindBubbleDrag(host) {
        host.addEventListener('pointerdown', event => {
            const bubble = event.target.closest('.ct-editor .ct-card-preview .ct-bubble');
            if (!bubble) return;
            const art = bubble.closest('.ct-panel-art');
            const card = bubble.closest('[data-panel-card]');
            if (!art || !card) return;
            event.preventDefault();
            const rect = art.getBoundingClientRect();
            const startX = event.clientX, startY = event.clientY;
            const originX = parseFloat(bubble.style.left) / 100, originY = parseFloat(bubble.style.top) / 100;
            bubble.setPointerCapture(event.pointerId);
            bubble.classList.add('dragging');
            let x = originX, y = originY;
            const move = moveEvent => {
                x = clamp(originX + (moveEvent.clientX - startX) / rect.width, 0, 0.92);
                y = clamp(originY + (moveEvent.clientY - startY) / rect.height, 0, 0.95);
                bubble.style.left = `${(x * 100).toFixed(2)}%`;
                bubble.style.top = `${(y * 100).toFixed(2)}%`;
                bubble.classList.toggle('tail-right', x >= 0.45);
                bubble.classList.toggle('tail-left', x < 0.45);
            };
            const end = () => {
                bubble.removeEventListener('pointermove', move);
                bubble.removeEventListener('pointerup', end);
                bubble.removeEventListener('pointercancel', end);
                bubble.classList.remove('dragging');
                if (Math.abs(x - originX) < 0.002 && Math.abs(y - originY) < 0.002) return;
                const bubbleId = bubble.dataset.bubble;
                mutatePanel(state.seriesId, state.chapterId, card.dataset.panelCard, (_, __, panel) => {
                    const target = panel.bubbles.find(item => item.id === bubbleId);
                    if (target) { target.x = Math.round(x * 1000) / 1000; target.y = Math.round(y * 1000) / 1000; }
                }).catch(error => say(`气泡位置保存失败：${error.message}`, true));
            };
            bubble.addEventListener('pointermove', move);
            bubble.addEventListener('pointerup', end);
            bubble.addEventListener('pointercancel', end);
        });
    }
