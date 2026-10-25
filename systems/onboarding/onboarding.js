// 新手指引: a game-style first-run tour. A spotlight cuts the target out of a dim layer and a
// bubble explains it; 下一步 / 上一步 / 跳过. It runs once for a fresh install, remembers being
// finished or skipped, and can be replayed from 设置 → 关于 BYND.
(function () {
    'use strict';

    const storageKey = 'bynd_onboarding_v1';
    // Existing installations already know the app; only a clean install gets the automatic tour.
    const legacyKeys = ['my_characters_data', 'my_characters_data_meta', 'my_api_data', 'my_theme_data', 'desktop_layout_v2', 'bynd_startup_seen_v1', 'bynd_lastSeenVersion'];
    const AUTO_POLL_MS = 700;
    const SETTLE_MS = 420;

    const visible = node => {
        if (!node || !node.isConnected) return false;
        const rect = node.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return false;
        const phone = document.querySelector('.phone-container')?.getBoundingClientRect();
        if (!phone) return true;
        return rect.right > phone.left + 2 && rect.left < phone.right - 2 && rect.bottom > phone.top + 2 && rect.top < phone.bottom - 2;
    };
    const firstVisible = selectors => {
        for (const selector of selectors) {
            const node = Array.from(document.querySelectorAll(selector)).find(visible);
            if (node) return node;
        }
        return null;
    };

    function showDesktop() {
        document.querySelectorAll('.app-window.active').forEach(win => {
            const id = (win.id.match(/^app-(.+)-window$/) || [])[1];
            if (id && typeof closeApp === 'function') closeApp(id);
        });
        if (typeof closeFolderOverlay === 'function' && !document.getElementById('folder-overlay')?.classList.contains('hidden')) {
            try { closeFolderOverlay({ target: document.getElementById('folder-overlay') }); } catch (_) {}
        }
        if (typeof resetDesktopToFirstPage === 'function') resetDesktopToFirstPage();
    }

    function showApiSettings() {
        if (typeof openApp === 'function' && !document.getElementById('app-settings-window')?.classList.contains('active')) openApp('settings');
        if (typeof openSettingsTab === 'function') openSettingsTab('api');
    }

    const steps = [
        {
            id: 'welcome', kicker: 'WELCOME', title: '欢迎来到 BYND',
            body: '这是一台住着角色的小手机。花半分钟认识几个主要入口，随时可以跳过。',
            prepare: showDesktop
        },
        {
            id: 'wechat', kicker: '聊天', title: '微信：和角色说话的地方',
            body: '第一次打开会推荐内置角色，也能在「通讯录」导入角色卡。聊天、朋友圈和群聊都在里面。',
            prepare: showDesktop,
            target: () => firstVisible(['.app-item[data-app-id="wechat"]', '.dock-item[onclick*="\'wechat\'"]', '.app-item[data-layout-id="app-wechat"]'])
        },
        {
            id: 'apps', kicker: '桌面', title: '点开就玩，长按整理',
            body: '点图标打开应用；长按进入编辑，可以拖动位置、叠成文件夹或换组件。',
            prepare: showDesktop,
            target: () => firstVisible(['.desktop-page[data-page="0"] .desktop-reference-app-grid', '.desktop-page[data-page="0"] .page2-app-grid', '#pages-container'])
        },
        {
            id: 'tools', kicker: '工具', title: '设置和手册在「工具」里',
            body: '设置、MCP、角色工具和使用手册都收在这个文件夹。',
            prepare: showDesktop,
            target: () => {
                const folders = Array.from(document.querySelectorAll('.app-item.is-folder')).filter(visible);
                return folders.find(node => /工具/.test(node.textContent || '')) || folders[0]
                    || firstVisible(['.app-item[data-app-id="settings"]']);
            }
        },
        {
            id: 'pages', kicker: '翻页', title: '左右滑动换一页',
            body: '第二页还有漫画、小屋、月伴、桌宠等应用。',
            prepare: showDesktop,
            // The dots row spans the screen; light up only the dots themselves.
            target: () => {
                const dots = Array.from(document.querySelectorAll('#page-dots .page-dot')).filter(visible);
                if (!dots.length) return null;
                return {
                    isConnected: true,
                    getBoundingClientRect() {
                        const rects = dots.map(dot => dot.getBoundingClientRect());
                        const left = Math.min(...rects.map(r => r.left)) - 10, right = Math.max(...rects.map(r => r.right)) + 10;
                        const top = Math.min(...rects.map(r => r.top)) - 8, bottom = Math.max(...rects.map(r => r.bottom)) + 8;
                        return { left, right, top, bottom, width: right - left, height: bottom - top };
                    }
                };
            }
        },
        {
            id: 'dock', kicker: 'DOCK', title: '常用的放在底栏',
            body: '预设、相机、音乐固定在这里；相机拍下的照片可以直接发给角色。',
            prepare: showDesktop,
            target: () => firstVisible(['.dock-bar'])
        },
        {
            id: 'api', kicker: '必做一步', title: '先接上一个模型接口',
            body: '在「设置 → API」添加接口，填 Base URL、Key 和模型。角色回复、生图和语音都从这里调用。',
            prepare: showApiSettings,
            target: () => firstVisible(['#settings-tab-api .api-list-heading button', '#settings-tab-api', '#settings-nav-api'])
        },
        {
            id: 'done', kicker: 'READY', title: '准备好了',
            body: '想再看一遍，在「设置 → 关于 BYND」点「重新播放新手指引」。',
            prepare: showApiSettings,
            finish: showDesktop
        }
    ];

    function readState() {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw === null) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : { status: 'done' };
        } catch (error) {
            return { status: 'unknown', error };
        }
    }

    function writeState(status, step) {
        try {
            localStorage.setItem(storageKey, JSON.stringify({ status, step, at: Date.now() }));
            return true;
        } catch (error) {
            console.warn('新手指引：完成状态保存失败', error);
            return false;
        }
    }

    // Captured at load, before app initialization writes defaults into a fresh installation.
    const initialState = (() => {
        try {
            if (localStorage.getItem(storageKey) !== null) return { seen: true };
            return { seen: false, existing: legacyKeys.some(key => localStorage.getItem(key) !== null) };
        } catch (error) {
            return { error };
        }
    })();

    function shouldAutoStart(initial = initialState, current = readState()) {
        if (initial.error || initial.seen || initial.existing) return false;
        return current === null;
    }

    // Wait until the desktop is actually in front: unlocked, no app, letter or dialog on top.
    function desktopReady() {
        if (document.visibilityState === 'hidden') return false;
        if (!document.getElementById('lock-screen')?.classList.contains('unlocked')) return false;
        if (document.getElementById('home-screen')?.classList.contains('hidden')) return false;
        if (document.querySelector('.app-window.active, #bynd-version-letter')) return false;
        return !Array.from(document.querySelectorAll('[aria-modal="true"]')).some(visible);
    }

    let active = null;
    let autoTimer = null;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function build() {
        const overlay = element('section', 'bynd-tour');
        overlay.id = 'bynd-tour';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'bynd-tour-title');
        overlay.setAttribute('aria-describedby', 'bynd-tour-body');
        const probe = element('i', 'bynd-tour-safe-probe');
        probe.setAttribute('aria-hidden', 'true');
        const spot = element('div', 'bynd-tour-spot');
        spot.setAttribute('aria-hidden', 'true');
        const bubble = element('div', 'bynd-tour-bubble');
        const head = element('div', 'bynd-tour-head');
        const kicker = element('span', 'bynd-tour-kicker');
        const count = element('span', 'bynd-tour-count');
        head.append(kicker, count);
        const title = element('h2', 'bynd-tour-title');
        title.id = 'bynd-tour-title';
        const body = element('p', 'bynd-tour-body');
        body.id = 'bynd-tour-body';
        const dots = element('div', 'bynd-tour-dots');
        dots.setAttribute('aria-hidden', 'true');
        steps.forEach(() => dots.appendChild(element('i')));
        const status = element('p', 'bynd-tour-status');
        status.setAttribute('role', 'status');
        const actions = element('div', 'bynd-tour-actions');
        const skip = element('button', 'bynd-tour-skip', '跳过');
        const back = element('button', 'bynd-tour-back', '上一步');
        const next = element('button', 'bynd-tour-next', '下一步');
        [skip, back, next].forEach(button => { button.type = 'button'; });
        actions.append(skip, back, next);
        bubble.append(head, title, body, dots, status, actions);
        overlay.append(probe, spot, bubble);
        skip.addEventListener('click', () => close('skipped'));
        back.addEventListener('click', () => go(active.index - 1));
        next.addEventListener('click', () => (active.index >= steps.length - 1 ? close('done') : go(active.index + 1)));
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close('skipped'); }
            else if (event.key === 'ArrowRight') { event.preventDefault(); next.click(); }
            else if (event.key === 'ArrowLeft' && active.index > 0) { event.preventDefault(); back.click(); }
            else if (event.key === 'Tab') {
                const order = [skip, back, next].filter(button => !button.hidden && !button.disabled);
                const at = order.indexOf(document.activeElement);
                event.preventDefault();
                order[(at + (event.shiftKey ? order.length - 1 : 1)) % order.length]?.focus({ preventScroll: true });
            }
        });
        // Taps on the dim layer do nothing; the tour only moves through its own buttons.
        overlay.addEventListener('pointerdown', event => { if (!bubble.contains(event.target)) event.preventDefault(); });
        return { overlay, probe, spot, bubble, kicker, count, title, body, dots, status, skip, back, next };
    }

    function layout() {
        if (!active) return;
        const { overlay, probe, spot, bubble } = active.nodes;
        const box = overlay.getBoundingClientRect();
        const safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
        const minTop = safeTop + 12;
        const margin = 12;
        const target = active.target && visible(active.target) ? active.target : null;
        overlay.classList.toggle('no-target', !target);
        let hole = null;
        if (target) {
            const rect = target.getBoundingClientRect();
            const pad = 6;
            const left = Math.max(4, rect.left - box.left - pad);
            const top = Math.max(minTop - 6, rect.top - box.top - pad);
            const right = Math.min(box.width - 4, rect.right - box.left + pad);
            const bottom = Math.min(box.height - 4, rect.bottom - box.top + pad);
            hole = { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
            Object.assign(spot.style, { left: `${hole.left}px`, top: `${hole.top}px`, width: `${hole.width}px`, height: `${hole.height}px` });
        }
        const width = Math.min(320, box.width - margin * 2);
        bubble.style.width = `${width}px`;
        const height = bubble.offsetHeight;
        let top;
        let left = (box.width - width) / 2;
        let placement = 'center';
        if (hole) {
            const below = hole.top + hole.height + 14;
            const above = hole.top - 14 - height;
            if (below + height <= box.height - margin) { top = below; placement = 'below'; }
            else if (above >= minTop) { top = above; placement = 'above'; }
            else { top = Math.max(minTop, box.height - margin - height); placement = 'inside'; }
            left = Math.min(Math.max(margin, hole.left + hole.width / 2 - width / 2), box.width - margin - width);
            const arrow = Math.min(Math.max(22, hole.left + hole.width / 2 - left), width - 22);
            bubble.style.setProperty('--tour-arrow-x', `${arrow}px`);
        } else {
            top = Math.max(minTop, (box.height - height) / 2);
        }
        bubble.dataset.placement = placement;
        bubble.style.left = `${Math.round(left)}px`;
        bubble.style.top = `${Math.round(top)}px`;
    }

    function render() {
        const { kicker, count, title, body, dots, back, next, overlay } = active.nodes;
        const step = steps[active.index];
        kicker.textContent = step.kicker;
        count.textContent = `${active.index + 1} / ${steps.length}`;
        title.textContent = step.title;
        body.textContent = step.body;
        Array.from(dots.children).forEach((dot, i) => dot.classList.toggle('on', i === active.index));
        back.hidden = active.index === 0;
        next.textContent = active.index === 0 ? '开始' : active.index >= steps.length - 1 ? '完成' : '下一步';
        overlay.dataset.step = step.id;
        layout();
    }

    function go(index) {
        if (!active) return;
        const target = Math.max(0, Math.min(steps.length - 1, index));
        const token = ++active.token;
        active.index = target;
        active.target = null;
        const step = steps[target];
        try { step.prepare?.(); } catch (error) { console.warn('新手指引：准备步骤失败', error); }
        render();
        // Apps open with a short transition; place the spotlight once they settle.
        setTimeout(() => {
            if (!active || active.token !== token) return;
            try { active.target = step.target?.() || null; } catch (_) { active.target = null; }
            layout();
            active.nodes.next.focus({ preventScroll: true });
        }, step.target ? SETTLE_MS : 0);
    }

    function start({ automatic = false } = {}) {
        const phone = document.querySelector('.phone-container');
        if (!phone || active) return false;
        stopAuto();
        const nodes = build();
        phone.appendChild(nodes.overlay);
        const onResize = () => layout();
        window.addEventListener('resize', onResize);
        active = { nodes, index: 0, token: 0, target: null, automatic, onResize, previousFocus: document.activeElement };
        // Shown once: relaunching mid-tour must not replay it automatically.
        if (automatic && !writeState('seen', 0)) nodes.status.textContent = '未能保存指引状态，下次打开可能再次出现。';
        go(0);
        return true;
    }

    function close(status = 'done') {
        if (!active) return false;
        const { nodes, onResize, index, previousFocus } = active;
        const step = steps[index];
        const saved = writeState(status, steps[index].id);
        active = null;
        window.removeEventListener('resize', onResize);
        nodes.overlay.remove();
        try { (status === 'done' ? step.finish : showDesktop)?.(); } catch (_) {}
        if (!saved && typeof showWechatToast === 'function') showWechatToast('指引状态没有保存成功，下次打开可能再次出现');
        if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({ preventScroll: true });
        return saved;
    }

    function stopAuto() {
        if (autoTimer) clearInterval(autoTimer);
        autoTimer = null;
    }

    function init() {
        if (!shouldAutoStart()) return false;
        stopAuto();
        autoTimer = setInterval(() => {
            if (!shouldAutoStart()) { stopAuto(); return; }
            if (desktopReady()) start({ automatic: true });
        }, AUTO_POLL_MS);
        return true;
    }

    function renderReplayButton() {
        const card = document.querySelector('#settings-tab-about .bynd-about-card');
        if (!card || card.querySelector('.bynd-tour-replay')) return;
        const button = element('button', 'bynd-tour-replay', '重新播放新手指引');
        button.type = 'button';
        button.addEventListener('click', () => start());
        const history = card.querySelector('h3');
        card.insertBefore(button, history || null);
    }

    window.ByndOnboarding = {
        storageKey, steps, init, start, close, readState, shouldAutoStart, desktopReady, renderReplayButton,
        get active() { return active ? { step: steps[active.index].id, index: active.index } : null }
    };

    const boot = () => {
        renderReplayButton();
        // main.js declares byndStylesReady as a top-level const, so it is not a window property.
        const ready = typeof byndStylesReady !== 'undefined' && typeof byndStylesReady?.then === 'function' ? byndStylesReady : Promise.resolve();
        ready.then(init, init);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();
