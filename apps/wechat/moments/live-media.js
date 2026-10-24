// One foreground live room owns its media. Provider credentials and RTC handles
// never enter room persistence or backups.
(() => {
    const D = () => window.ByndDiscoverStory;
    let current = null;
    function hasImage() {
        if (typeof callWechatImageGenerationApi !== 'function') return false;
        if (typeof getImageRouteForFeature === 'function') {
            const route = getImageRouteForFeature('chat');
            return route?.provider === 'novelai' ? !!(route.settings?.enabled && route.settings?.token) : !!(route?.api?.baseUrl && route.api.imageModel);
        }
        const api = typeof getDefaultImageApi === 'function' ? getDefaultImageApi() : null;
        return !!(api?.baseUrl && api?.imageModel);
    }
    const validImage = value => /^(?:https?:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(String(value || ''));
    const active = session => !!session && current === session && !session.controller.signal.aborted;
    function status() { return current ? { kind: current.kind, phase: current.phase, note: current.note, blocked: current.blocked, hasSound: current.stream?.hasSound, sound: current.sound } : { kind: 'text', phase: '', note: '' }; }
    function paint(session) {
        if (!active(session)) return;
        const node = session.node;
        node.dataset.kind = session.kind;
        const picture = node.querySelector(':scope > img');
        if (picture) {
            picture.hidden = session.kind !== 'image';
            if (session.image && picture.getAttribute('src') !== session.image) picture.src = session.image;
        }
        const rtc = node.querySelector('.wc-live-rtc'); if (rtc) rtc.hidden = session.kind !== 'video' && session.phase !== 'video';
        D().refresh();
    }
    async function compactImage(url, signal) {
        if (!validImage(url)) throw new Error('画面地址无效。');
        const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('直播图片加载失败。');
        const blob = await response.blob();
        if (blob.size > 24 * 1024 * 1024 || !/^image\/(png|jpeg|webp)/i.test(blob.type)) throw new Error('直播图片格式或大小不支持。');
        const bitmap = await createImageBitmap(blob);
        try {
            const ratio = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
            canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const result = canvas.toDataURL('image/webp', .82);
            if (result.length > 650000) throw new Error('直播图片过大，未写入本机。');
            return result;
        } finally { bitmap.close(); }
    }
    async function imageFallback(session, room, reason = '') {
        if (!active(session)) return;
        session.phase = hasImage() ? 'image' : ''; session.note = reason; paint(session);
        if (!hasImage()) { session.kind = 'text'; session.note = reason ? '视频暂不可用，已切换头像直播' : '头像直播'; paint(session); return; }
        try {
            const char = D().character(room.hostId || room.sourceCharId);
            if (!char) throw new Error('主播已不可用。');
            let referenceImage = char.chatConfig?.imageReference || char.avatar || '';
            if (referenceImage && !validImage(referenceImage) && typeof loadWechatAvatarForVision === 'function') referenceImage = await loadWechatAvatarForVision(referenceImage, 1024);
            if (!active(session)) return;
            const result = await callWechatImageGenerationApi('绘制角色此刻的竖屏直播画面。保持角色外观、画风和剧情中的服装与环境，直播摄像机视角，主体清楚，画面不含手机边框、文字、字幕或水印。角色：' + D().name(char) + '\n人设：' + D().clip(char.description, 2000) + '\n场景：' + D().clip(room.caption, 1600), {
                usageChar: char, feature: 'chat', size: '1024x1536', referenceImage, signal: session.controller.signal
            });
            if (!active(session) || D().character(char.id) !== char) return;
            if (!result?.ok || !validImage(result.url)) throw new Error('生图没有返回可用画面。');
            const url = await compactImage(result.url, session.controller.signal);
            if (!active(session)) return;
            const latest = window.ByndLive?.state().rooms.find(item => item.id === room.id);
            if (!latest || latest.status === 'ended') return;
            // The caption may progress while a picture is being drawn. Keep its
            // scene version explicit; never pass an old picture off as the new one.
            D().change('live', s => { const target = s.rooms.find(item => item.id === room.id); if (target) target.visual = { kind: 'image', url, version: Number(room.version || 0), at: Date.now() }; });
            session.image = url; session.kind = 'image'; session.note = reason ? '视频暂不可用，已切换场景图片' : '场景图片';
        } catch (_) {
            if (!active(session)) return;
            session.kind = session.image ? 'image' : 'text';
            session.note = session.image ? '新画面未生成，保留上一幕' : '画面生成暂不可用，已切换头像直播';
        } finally { if (active(session)) { session.phase = ''; paint(session); } }
    }
    async function begin(session, room, forceImage = false) {
        const char = D().character(room.hostId || room.sourceCharId);
        if (!char || room.status === 'ended') return;
        let video = false;
        try { video = !forceImage && !!window.ByndVivix?.read().apiKey; } catch (_) { session.note = '视频设置不可用'; }
        if (video) {
            session.phase = 'video'; paint(session);
            try {
                const stream = await window.ByndVivix.openBroadcast(char, { scene: room.caption, view: session.node.querySelector('.wc-live-rtc').id,
                    signal: session.controller.signal,
                    onBlocked: () => { if (active(session)) { session.blocked = true; paint(session); } },
                    onFailure: () => { if (active(session)) { session.stream = null; void imageFallback(session, window.ByndLive?.state().rooms.find(item => item.id === room.id) || room, '视频连接中断'); } }
                });
                if (!active(session) || D().character(char.id) !== char) { await stream.close(); return; }
                session.stream = stream; session.kind = 'video'; session.phase = ''; session.note = '实时画面'; paint(session);
                update(window.ByndLive?.state().rooms.find(item => item.id === room.id) || room);
                return;
            } catch (_) { if (!active(session)) return; }
        }
        if (session.image && !forceImage) { session.phase = ''; session.kind = 'image'; session.note = '已恢复场景图片'; paint(session); return; }
        await imageFallback(session, room, video ? '视频连接失败' : session.note);
    }
    function leave() {
        const session = current; if (!session) return;
        current = null; session.controller.abort(); void session.stream?.close();
        session.node.remove();
    }
    function mount(room) {
        const slot = document.querySelector('[data-live-media-slot]');
        if (!slot) { leave(); return; }
        if (current?.roomId !== room.id) {
            leave();
            const node = document.createElement('div'); node.className = 'wc-live-media'; node.dataset.liveMedia = room.id;
            const rtc = document.createElement('div'); rtc.id = 'wc-live-rtc-' + D().uid('view'); rtc.className = 'wc-live-rtc'; rtc.hidden = true;
            const image = document.createElement('img'); image.alt = '当前直播场景'; image.hidden = true;
            node.append(rtc, image);
            const cached = validImage(room.visual?.url) ? room.visual.url : '';
            current = { roomId: room.id, node, controller: new AbortController(), kind: cached ? 'image' : 'text', phase: '', image: cached, version: -1, note: '', sound: false };
            image.onerror = () => { if (current?.node === node) { current.kind = 'text'; current.image = ''; current.note = '画面无法加载，已切换头像直播'; paint(current); } };
            slot.replaceWith(node);
            const session = current;
            // Start only after entry, never from publication or a background AI job.
            void begin(session, room);
        } else slot.replaceWith(current.node);
        if (room.status === 'ended') {
            current.kind = current.image ? 'image' : 'text'; current.phase = ''; current.note = '已收播';
            current.controller.abort(); void current.stream?.close();
            const root = document.querySelector('[data-live-room]'); if (root) root.dataset.mediaKind = current.kind;
            const label = document.querySelector('.wc-live-status'); if (label) label.textContent = '已收播';
        }
        current.node.dataset.kind = current.kind;
        const image = current.node.querySelector(':scope > img'); image.hidden = current.kind !== 'image'; if (current.image && image.getAttribute('src') !== current.image) image.src = current.image;
        current.node.querySelector('.wc-live-rtc').hidden = current.kind !== 'video' && current.phase !== 'video';
        if (room.status !== 'ended') update(room);
    }
    function update(room) {
        const session = current;
        if (!active(session) || session.roomId !== room.id || session.version === Number(room.version || 0) || !session.stream) return;
        session.version = Number(room.version || 0);
        const speech = (room.lines || []).filter(line => String(line.actor?.charId) === String(room.hostId)).slice(-2).map(line => line.text).join('\n');
        void session.stream.perform({ speech, action: room.caption }).catch(() => {});
    }
    async function retry(room) { leave(); mount(room); }
    async function refreshImage(room) {
        if (!current || current.roomId !== room.id || current.phase || current.kind === 'video') return;
        await imageFallback(current, room);
    }
    async function sound() {
        if (!current?.stream) return;
        try { await current.stream.resume(); current.sound = !current.sound; await current.stream.sound(current.sound); current.blocked = false; paint(current); }
        catch (_) { if (current) { current.note = '播放受限，请再点一次'; paint(current); } }
    }
    window.addEventListener('pagehide', leave);
    new MutationObserver(() => {
        if (!current) return;
        const app = document.getElementById('app-wechat-window');
        if (app?.classList.contains('active')) current.wasActive = true;
        if (!document.querySelector('#wc-feature-screen.active [data-live-room="' + current.roomId + '"]') || app?.classList.contains('hidden') || (current.wasActive && !app?.classList.contains('active'))) leave();
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    window.ByndLiveMedia = { mount, leave, status, retry, refreshImage, sound, hasImage, validImage };
})();
