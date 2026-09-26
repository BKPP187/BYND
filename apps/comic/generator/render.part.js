    const joinTags = (...parts) => window.ByndNovelAi?.joinTags
        ? window.ByndNovelAi.joinTags(...parts)
        : parts.flat().map(part => String(part || '').trim()).filter(Boolean).join(', ');
    function naiInput(book, panel) {
        const type = typeOf(book.type);
        const style = styleOf(book.styleKey);
        const cast = book.cast || {};
        const [width, height] = shotOf(panel.shot).nai;
        const characters = (panel.chars || []).map(person => ({
            prompt: joinTags(person.who === 'char' ? cast.char : person.who === 'user' ? cast.user : '', person.tags),
            x: person.x,
            y: person.y
        })).filter(person => person.prompt);
        return {
            prompt: joinTags(panel.scene, book.styleTags || style?.tags || ''),
            characters,
            width,
            height,
            negative: book.negative || '',
            dropNegative: [...(type.dropNegative || []), ...(style?.dropNegative || [])],
            seed: Number.isInteger(panel.seed) ? panel.seed : undefined
        };
    }
    function apiPrompt(book, panel) {
        const type = typeOf(book.type);
        const cast = book.cast || {};
        const layout = {
            photo: '像真实拍下的合影照片，两人都看镜头。',
            wallpaper: '手机竖屏壁纸构图，上方留出简洁背景给时钟，没有任何文字。',
            poster: '电影海报式主视觉，留出标题区域，但画面里不要出现文字。'
        }[book.type] || '';
        return [
            `画风：${book.style || '韩国条漫风格，精致上色'}`,
            `人物外观（每格保持一致）：${book.charName}：${cast.char || '按参考图'}；${book.userName}：${cast.user || '按参考图'}`,
            `画面：${panel.prompt || panel.beat}`,
            layout,
            `这是${type.label}中的一格，只画这一格：不要分格、不要文字、不要对话气泡、不要水印。`
        ].filter(Boolean).join('\n');
    }
    // Reload before each write so edits made while pictures render are never overwritten.
    async function mutatePanel(bookId, chapterId, panelId, mutate) {
        const book = upgradeBook(await get('series', bookId));
        const part = book?.chapters.find(item => item.id === chapterId);
        const panel = part?.panels.find(item => item.id === panelId);
        if (!panel) return null;
        const result = await mutate(book, part, panel);
        part.updatedAt = Date.now();
        await save(book);
        return result;
    }
    async function renderPanel(bookId, chapterId, panelId, signal) {
        const book = upgradeBook(await get('series', bookId));
        const panel = book?.chapters.find(item => item.id === chapterId)?.panels.find(item => item.id === panelId);
        if (!panel) throw new Error('找不到这一格分镜，可能已被删除');
        const route = imageRoute();
        const char = charById(book.charId);
        let result;
        if (route.provider === 'novelai') {
            if (!panel.scene && !(panel.chars || []).some(person => person.tags)) throw new Error('这一格没有 NovelAI 标签，请先在编辑里补上或重新生成分镜');
            result = await callNovelAiImageGeneration(naiInput(book, panel), { settings: route.settings, signal, usageFeature: 'comic', usageChar: char, onProgress: say });
        } else if (route.provider === 'api') {
            const refs = [book.charRef, book.userRef, book.extraRef].filter(Boolean);
            result = await callWechatImageGenerationApi(apiPrompt(book, panel), { feature: 'comic', referenceImage: refs[0] || '', additionalReferences: refs.slice(1), size: shotOf(panel.shot).api, requireReference: false, usageChar: char });
        } else {
            throw new Error('还没有可用的生图服务：设置 → API → 生图服务');
        }
        if (result?.cancelled) return { ok: false, cancelled: true };
        if (!result?.ok || !result.url) {
            const error = result?.error || '生图服务没有返回图片';
            await mutatePanel(bookId, chapterId, panelId, (_, __, target) => { target.error = error; });
            return { ok: false, error };
        }
        const key = await storeImage(result.url);
        const oldKey = await mutatePanel(bookId, chapterId, panelId, (target, part, item) => {
            const previous = item.imageKey;
            item.imageKey = key;
            item.error = '';
            item.provider = route.provider;
            if (Number.isInteger(result.seed)) item.seed = result.seed;
            if (!target.coverKey || target.coverKey === previous) target.coverKey = part.panels[0]?.imageKey || key;
            return previous;
        });
        if (oldKey === null) {
            await remove('images', key).catch(console.warn);
            throw new Error('这一格在生成期间被删除，图片未保存');
        }
        const latest = await get('series', bookId);
        if (oldKey && oldKey !== latest?.coverKey) await remove('images', oldKey).catch(console.warn);
        return { ok: true };
    }
    // Long work (writing a storyboard, drawing pictures) runs as one background job so
    // navigation and small edits stay responsive; only one job runs at a time.
    async function withJob(kind, bookId, chapterId, fn) {
        if (state.job) throw new Error(state.job.kind === 'plan' ? '正在写另一个分镜，请稍等' : '正在生成另一组图片，请等它完成或先停止');
        const job = state.job = { kind, bookId, chapterId, controller: new AbortController(), total: 0, done: 0, current: '', error: '' };
        renderJob();
        try {
            return await fn(job);
        } finally {
            state.job = null;
            renderJob();
        }
    }
    function launch(task) {
        Promise.resolve().then(task).catch(error => { console.error('漫画任务失败', error); say(error.message || '操作失败', true); });
    }
    const watching = (bookId, chapterId) => state.seriesId === bookId && state.chapterId === chapterId;
    async function refreshIfWatching(bookId, chapterId) {
        if (watching(bookId, chapterId) && state.view === 'editor') await editor();
    }
    async function planChapter(bookId, chapterId, options = {}) {
        try {
            await withJob('plan', bookId, chapterId, async () => {
                await mutateChapter(bookId, chapterId, part => { part.state = 'planning'; part.planError = ''; });
                await refreshIfWatching(bookId, chapterId);
                await generatePlan(bookId, chapterId, options);
            });
        } catch (error) {
            await mutateChapter(bookId, chapterId, part => { if (!part.panels.length) part.state = 'failed'; part.planError = error.message || '分镜生成失败'; }).catch(() => {});
            throw error;
        } finally {
            await refreshIfWatching(bookId, chapterId);
        }
    }
    async function mutateChapter(bookId, chapterId, mutate) {
        const book = upgradeBook(await get('series', bookId));
        const part = book?.chapters.find(item => item.id === chapterId);
        if (!part) return null;
        const result = await mutate(part, book);
        part.updatedAt = Date.now();
        await save(book);
        return result;
    }
    async function startGeneration(bookId, chapterId, panelIds = null) {
        const book = upgradeBook(await get('series', bookId));
        const part = book?.chapters.find(item => item.id === chapterId);
        if (!part) throw new Error('找不到这一话');
        const targets = part.panels.filter(panel => panelIds ? panelIds.includes(panel.id) : !panel.imageKey).map(panel => panel.id);
        if (!targets.length) { say('这一话的图片都已经生成好了'); return; }
        let finishedJob = null;
        await withJob('render', bookId, chapterId, async job => {
            finishedJob = job;
            job.total = targets.length;
            await mutateChapter(bookId, chapterId, item => { item.state = 'generating'; });
            renderJob();
            for (const panelId of targets) {
                if (job.controller.signal.aborted) break;
                job.current = panelId;
                renderJob();
                refreshPanel(panelId);
                const outcome = await renderPanel(bookId, chapterId, panelId, job.controller.signal).catch(error => ({ ok: false, error: error.message }));
                if (outcome.cancelled) break;
                if (outcome.ok) job.done++;
                job.current = '';
                refreshPanel(panelId);
                renderJob();
                if (!outcome.ok) { job.error = outcome.error || '生成失败'; break; }
            }
        });
        const latest = upgradeBook(await get('series', bookId));
        const latestPart = latest?.chapters.find(item => item.id === chapterId);
        const complete = !!latestPart && latestPart.panels.length > 0 && latestPart.panels.every(panel => panel.imageKey);
        if (latestPart) {
            latestPart.state = complete ? 'done' : 'planned';
            if (complete && latest.status === 'draft') latest.status = typeOf(latest.type).series ? 'ongoing' : 'complete';
            await save(latest);
        }
        if (finishedJob?.error) say(finishedJob.error, true);
        else if (finishedJob?.controller.signal.aborted) say(`已停止，完成 ${finishedJob.done}/${finishedJob.total} 张`);
        else if (complete) say(`《${latest.title}》${typeOf(latest.type).series ? latestPart.title : ''}完成了`);
        if (watching(bookId, chapterId) && state.view === 'editor') {
            if (complete && !finishedJob?.error) await viewer();
            else await editor();
        }
    }
    function stopGeneration() {
        state.job?.controller.abort();
    }
