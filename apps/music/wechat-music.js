let wechatMusicCardPlaySeq = 0;
const WECHAT_MUSIC_QUEUE_ADDED_KEY = 'wechat_music_queue_added_tracks_v1';

function getWechatMusicAudioPlayer() {
    if (!window._wechatMusicCardAudio) {
        const existing = document.getElementById('wechat-music-card-audio');
        const audio = existing instanceof HTMLAudioElement ? existing : document.createElement('audio');
        audio.id = 'wechat-music-card-audio';
        audio.preload = 'auto';
        audio.removeAttribute('crossorigin');
        audio.playsInline = true;
        audio.muted = false;
        audio.volume = 1;
        audio.style.position = 'fixed';
        audio.style.left = '0';
        audio.style.bottom = '0';
        audio.style.width = '44px';
        audio.style.height = '24px';
        audio.style.opacity = '0.001';
        audio.style.pointerEvents = 'none';
        audio.style.zIndex = '2147483000';
        if (!audio.parentElement) document.body.appendChild(audio);
        audio.addEventListener('ended', handleWechatMusicPlaybackEnded);
        audio.addEventListener('error', () => {
            document.querySelectorAll('.msg-music-card.playing, .msg-music-card.loading').forEach(card => card.classList.remove('playing', 'loading'));
            updateWechatMusicListenProgress();
        });
        audio.addEventListener('timeupdate', () => {
            updateWechatMusicListenProgress();
            updateWechatMusicLyricsFloat(audio.currentTime || 0);
            updateWechatMusicIsland();
        });
        audio.addEventListener('loadedmetadata', updateWechatMusicListenProgress);
        audio.addEventListener('play', () => {
            updateWechatMusicListenProgress();
            updateWechatMusicIsland();
        });
        audio.addEventListener('pause', () => {
            updateWechatMusicListenProgress();
            updateWechatMusicIsland();
        });
        window._wechatMusicCardAudio = audio;
    }
    window._wechatMusicCardAudio.muted = false;
    window._wechatMusicCardAudio.volume = 1;
    return window._wechatMusicCardAudio;
}

function getWechatMusicAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!window._wechatMusicAudioContext) window._wechatMusicAudioContext = new AudioCtx();
    return window._wechatMusicAudioContext;
}

function stopWechatMusicBufferPlayback() {
    const playback = window._wechatMusicBufferPlayback;
    if (playback?.source) {
        try { playback.source.onended = null; playback.source.stop(0); } catch (e) {}
    }
    clearInterval(window._wechatMusicBufferTicker);
    window._wechatMusicBufferTicker = null;
    window._wechatMusicBufferPlayback = null;
}

function insertWechatRichInputLineBreak() {
    const richEl = getWechatRichInputElement();
    if (!richEl) return;
    richEl.focus();
    const selection = window.getSelection && window.getSelection();
    if (!selection || !selection.rangeCount || !isWechatSelectionInside(richEl)) {
        const br = document.createElement('br');
        const spacer = document.createTextNode('');
        richEl.appendChild(br);
        richEl.appendChild(spacer);
        setWechatRichInputCaretAfter(spacer);
        return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const br = document.createElement('br');
    const spacer = document.createTextNode('');
    range.insertNode(spacer);
    range.insertNode(br);
    range.setStartAfter(spacer);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

function getWechatMusicBufferPlaybackState() {
    const playback = window._wechatMusicBufferPlayback;
    if (!playback?.source || !playback.context) return null;
    const duration = Number(playback.duration || 0);
    const offset = Number(playback.offset || 0);
    const startedAt = Number(playback.startedAt || playback.context.currentTime || 0);
    const currentTime = Math.max(0, Math.min(duration || Infinity, offset + (playback.context.currentTime - startedAt)));
    if (duration > 0 && currentTime > duration + 0.25) return null;
    return {
        mode: 'buffer',
        playing: true,
        url: normalizeWechatUrl(playback.safeUrl || ''),
        currentTime,
        duration
    };
}

function getWechatMusicPlaybackState(targetUrl = '') {
    const target = normalizeWechatUrl(targetUrl || '');
    const audio = window._wechatMusicCardAudio;
    const audioUrl = normalizeWechatUrl(audio?.dataset?.cardUrl || '');
    if (audio && audioUrl && !audio.paused && !audio.ended && (!target || audioUrl === target)) {
        return {
            mode: 'audio',
            playing: true,
            url: audioUrl,
            currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
            duration: Number.isFinite(audio.duration) ? audio.duration : 0
        };
    }
    const bufferState = getWechatMusicBufferPlaybackState();
    if (bufferState && (!target || !bufferState.url || bufferState.url === target)) return bufferState;
    if (bufferState && !target) return bufferState;
    return { mode: '', playing: false, url: target || audioUrl, currentTime: 0, duration: 0 };
}

function startWechatMusicBufferTicker() {
    clearInterval(window._wechatMusicBufferTicker);
    window._wechatMusicBufferTicker = setInterval(() => {
        const state = getWechatMusicBufferPlaybackState();
        if (!state) {
            clearInterval(window._wechatMusicBufferTicker);
            window._wechatMusicBufferTicker = null;
            return;
        }
        updateWechatMusicListenProgress();
        updateWechatMusicLyricsFloat(state.currentTime || 0);
        updateWechatMusicIsland();
    }, 500);
}

function isWechatMusicBufferPlaying(safeUrl = '') {
    const playback = getWechatMusicBufferPlaybackState();
    const target = normalizeWechatUrl(safeUrl || '');
    return !!(playback && (!target || playback.url === target));
}

function isWechatMusicProxyUrl(url) {
    const safeUrl = normalizeWechatUrl(url || '');
    return /[?&]type=url\b/i.test(safeUrl) || /meting/i.test(safeUrl);
}

function isWechatTemporaryMusicCdnUrl(url) {
    const safeUrl = normalizeWechatUrl(url || '');
    return /(^https:\/\/m\d+\.music\.126\.net\/|\.music\.126\.net\/)/i.test(safeUrl)
        || /[?&](vuutv|authSecret|token|expires?)=/i.test(safeUrl);
}

function markWechatMusicCardNeedsTap(card, text = '音源准备好了，再点一次播放') {
    if (!card) return;
    card.classList.remove('loading');
    card.classList.add('needs-tap');
    card.dataset.playHint = text;
}

async function prepareWechatMusicCardPlayableUrl(card) {
    if (!card || card.dataset.playablePreparing === '1') return card?.dataset.audioUrl || '';
    const sourceUrl = normalizeWechatUrl(card.dataset.sourceUrl || card.dataset.audioUrl || '');
    if (!sourceUrl) return '';
    if (!isWechatMusicProxyUrl(sourceUrl)) {
        card.dataset.audioUrl = sourceUrl;
        card.dataset.sourceUrl = sourceUrl;
        card.dataset.playableReady = '1';
        return sourceUrl;
    }
    card.dataset.audioUrl = sourceUrl;
    card.dataset.sourceUrl = sourceUrl;
    card.dataset.playableReady = '1';
    return sourceUrl;
}

function getWechatResolvedMusicCache(url) {
    const cache = window._wechatResolvedMusicUrls || {};
    const item = cache[url];
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (Date.now() - Number(item.time || 0) > 3 * 60 * 1000) return '';
    return item.url || '';
}

function setWechatResolvedMusicCache(url, resolvedUrl) {
    if (!url || !resolvedUrl) return;
    window._wechatResolvedMusicUrls = window._wechatResolvedMusicUrls || {};
    window._wechatResolvedMusicUrls[url] = { url: resolvedUrl, time: Date.now() };
}

async function resolveWechatPlayableMusicUrl(url) {
    const safeUrl = normalizeWechatUrl(String(url || '').replace(/\\u0026/gi, '&'));
    if (!safeUrl) return '';
    const cached = getWechatResolvedMusicCache(safeUrl);
    if (cached) return cached;
    if (!/[?&]type=url\b/i.test(safeUrl) && !/meting/i.test(safeUrl)) {
        setWechatResolvedMusicCache(safeUrl, safeUrl);
        return safeUrl;
    }
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const resp = await fetch(safeUrl, { method: 'HEAD', redirect: 'follow', cache: 'no-store', signal: controller.signal });
        clearTimeout(timer);
        const contentType = resp.headers.get('content-type') || '';
        const finalUrl = normalizeWechatUrl(resp.url || '');
        if (resp.ok && finalUrl && (finalUrl !== safeUrl || /^audio\//i.test(contentType) || /\.(m4a|mp3|flac|aac|ogg)(\?|$)/i.test(finalUrl))) {
            setWechatResolvedMusicCache(safeUrl, finalUrl);
            return finalUrl;
        }
    } catch (e) {}
    setWechatResolvedMusicCache(safeUrl, safeUrl);
    return safeUrl;
}

function updateWechatMusicCardPlayingState(audioUrl, playing, loading = false) {
    document.querySelectorAll('.msg-music-card').forEach(card => {
        const matched = card.dataset.audioUrl === audioUrl;
        card.classList.toggle('playing', !!playing && matched);
        card.classList.toggle('loading', !!loading && matched);
        if (!matched) card.classList.remove('playing', 'loading');
    });
    const player = document.getElementById('wc-music-listen-player');
    if (player && player.dataset.audioUrl === audioUrl) {
        player.classList.toggle('playing', !!playing);
        player.classList.toggle('loading', !!loading);
        const icon = player.querySelector('.wc-music-listen-play i');
        if (icon) icon.className = loading ? 'ri-loader-4-line' : (playing ? 'ri-pause-fill' : 'ri-play-fill');
    }
}

function getWechatMusicCardMessageFromElement(card) {
    const row = card?.closest?.('.msg-row');
    const index = Number(row?.dataset?.msgIdx);
    const char = getCurrentChatChar();
    if (!char || !Array.isArray(char.history) || !Number.isInteger(index)) return null;
    const msg = char.history[index];
    return msg && msg.type === 'music_card' ? { char, msg, index } : null;
}

function getWechatMusicPlayerAvatars(char) {
    const userProfile = typeof getWechatChatUserProfile === 'function' ? getWechatChatUserProfile(char) : {};
    return {
        self: userProfile.avatar || '',
        peer: char?.avatar || DEFAULT_AVATAR
    };
}

function getWechatMusicOverlayRoot() {
    return getWechatModalRoot();
}

function mountWechatMusicOverlayElement(el) {
    const root = getWechatMusicOverlayRoot();
    if (el && root && el.parentElement !== root) root.appendChild(el);
    return el;
}

function ensureWechatMusicListenPlayer() {
    let panel = document.getElementById('wc-music-listen-player');
    if (panel) return mountWechatMusicOverlayElement(panel);
    panel = document.createElement('div');
    panel.id = 'wc-music-listen-player';
    panel.className = 'wc-music-listen-player hidden';
    panel.innerHTML = `
        <button type="button" class="wc-music-listen-close" onclick="closeWechatMusicListenPlayer()" aria-label="收起"><i class="ri-arrow-down-s-line"></i></button>
        <div class="wc-music-listen-art"><i class="ri-music-2-fill"></i></div>
        <div class="wc-music-listen-people">
            <img class="self" alt="">
            <img class="peer" alt="">
        </div>
        <div class="wc-music-listen-meta">
            <span>正在一起听歌</span>
            <strong></strong>
            <em></em>
        </div>
        <div class="wc-music-listen-progress" role="slider" aria-label="播放进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" onclick="seekWechatMusicListenProgress(event)" onpointerdown="beginWechatMusicListenSeek(event)"><span></span></div>
        <div class="wc-music-listen-actions">
            <button type="button" class="wc-music-listen-lyric" onclick="toggleWechatMusicLyricsFloat()" aria-label="歌词"><i class="ri-file-list-2-line"></i><span>歌词</span></button>
            <button type="button" onclick="playWechatMusicAdjacent(-1)" aria-label="上一首"><i class="ri-skip-back-fill"></i></button>
            <button type="button" class="wc-music-listen-play" onclick="toggleWechatMusicListenPlayback()" aria-label="播放"><i class="ri-play-fill"></i></button>
            <button type="button" onclick="playWechatMusicAdjacent(1)" aria-label="下一首"><i class="ri-skip-forward-fill"></i></button>
            <button type="button" onclick="toggleWechatMusicQueuePanel()" aria-label="音乐列表"><i class="ri-play-list-2-line"></i><span>列表</span></button>
            <button type="button" class="wc-music-listen-mode" onclick="cycleWechatMusicPlayMode()" aria-label="播放模式"><i class="ri-repeat-line"></i><span>列表循环</span></button>
            <button type="button" onclick="focusWechatMusicCommentInput()" aria-label="评论"><i class="ri-chat-1-line"></i><span>评论</span></button>
        </div>
        <div class="wc-music-queue-panel hidden">
            <div class="wc-music-queue-head"><span>音乐列表</span><button type="button" onclick="openWechatMusicQueueComposer()"><i class="ri-add-line"></i>继续添加音乐</button></div>
            <div class="wc-music-queue-list"></div>
        </div>
    `;
    mountWechatMusicOverlayElement(panel);
    bindWechatMusicQueueScroll(panel);
    return panel;
}

function bindWechatMusicQueueScroll(panel) {
    const list = panel?.querySelector('.wc-music-queue-list');
    if (!list || list.dataset.scrollBound === '1') return;
    list.dataset.scrollBound = '1';
    ['touchstart', 'touchmove', 'wheel'].forEach(type => {
        list.addEventListener(type, event => event.stopPropagation(), { passive: type !== 'touchmove' });
    });
}

function openWechatMusicListenPlayer(info, cardEl = null, msg = null, char = null) {
    const panel = ensureWechatMusicListenPlayer();
    const avatars = getWechatMusicPlayerAvatars(char || getCurrentChatChar());
    const previousKey = panel.dataset.trackKey || '';
    const nextKey = getWechatMusicTrackMatchKey(info || {});
    panel.dataset.audioUrl = info.audioUrl || '';
    panel.dataset.title = info.title || '一起听歌';
    panel.dataset.artist = info.artist || '';
    panel.dataset.artwork = info.artwork || '';
    panel.dataset.sourceUrl = info.sourceAudioUrl || info.audioUrl || '';
    panel.dataset.msgIndex = cardEl?.closest?.('.msg-row')?.dataset?.msgIdx || '';
    panel.dataset.lyricsText = info.lyricsText || '';
    panel.dataset.lyricsUrl = info.lyricsUrl || '';
    panel.dataset.sourceKey = info.sourceKey || '';
    panel.dataset.sourceMeta = info.sourceMeta || '';
    panel.dataset.sourceName = info.sourceName || '';
    panel.dataset.trackKey = nextKey;
    if (previousKey !== nextKey) {
        delete panel.dataset.lyricsLoaded;
        delete panel.dataset.lyricsLines;
        const lyricBox = document.getElementById('wc-music-lyrics-float');
        const lyricList = lyricBox?.querySelector('.wc-music-lyrics-lines');
        if (lyricList && lyricBox && !lyricBox.classList.contains('hidden')) {
            lyricList.innerHTML = '<p class="wc-music-lyrics-empty">正在载入歌词...</p>';
            getWechatMusicLyricsForPanel(panel).then(lines => {
                if (panel.dataset.trackKey !== nextKey) return;
                lyricList.innerHTML = lines.map((line, index) => `
                    <p class="wc-music-lyric-line" data-time="${Number.isFinite(line.time) ? line.time : ''}" data-line-index="${index}">${wcEscapeHtml(line.text)}</p>
                `).join('') || '<p class="wc-music-lyrics-empty">没有歌词内容</p>';
                updateWechatMusicLyricsFloat(window._wechatMusicCardAudio?.currentTime || 0, true);
            }).catch(() => {
                if (panel.dataset.trackKey === nextKey) lyricList.innerHTML = '<p class="wc-music-lyrics-empty">没有歌词内容</p>';
            });
        }
    }
    panel.querySelector('.wc-music-listen-art').innerHTML = info.artwork
        ? `<img src="${wcEscapeHtml(info.artwork)}" alt="" onerror="this.parentElement.innerHTML='<i class=&quot;ri-music-2-fill&quot;></i>'">`
        : '<i class="ri-music-2-fill"></i>';
    const selfAvatar = panel.querySelector('.wc-music-listen-people .self');
    const peerAvatar = panel.querySelector('.wc-music-listen-people .peer');
    if (selfAvatar) selfAvatar.src = avatars.self || DEFAULT_AVATAR;
    if (peerAvatar) peerAvatar.src = avatars.peer || DEFAULT_AVATAR;
    const titleEl = panel.querySelector('.wc-music-listen-meta strong');
    const artistEl = panel.querySelector('.wc-music-listen-meta em');
    if (titleEl) titleEl.textContent = info.title || '一起听歌';
    if (artistEl) artistEl.textContent = info.artist || info.sourceName || 'BYND Music';
    panel.classList.remove('hidden');
    hideWechatMusicIsland();
    renderWechatMusicPlayMode();
    renderWechatMusicQueuePanel();
    updateWechatMusicListenProgress();
    if (msg) {
        window._wechatMusicListenMessage = { msg, charId: char?.id || window.currentChatCharId || '' };
    }
}

function closeWechatMusicListenPlayer() {
    document.getElementById('wc-music-listen-player')?.classList.add('hidden');
    updateWechatMusicIsland();
}
window.closeWechatMusicListenPlayer = closeWechatMusicListenPlayer;

function collapseWechatMusicOverlaysToIsland() {
    document.getElementById('wc-music-listen-player')?.classList.add('hidden');
    document.getElementById('wc-music-lyrics-float')?.classList.add('hidden');
    updateWechatMusicIsland();
}
window.collapseWechatMusicOverlaysToIsland = collapseWechatMusicOverlaysToIsland;

function focusWechatMusicCommentInput() {
    closeWechatMusicListenPlayer();
    setTimeout(() => {
        const richInput = typeof getWechatRichInputElement === 'function' ? getWechatRichInputElement() : document.getElementById('wc-rich-msg-input');
        const input = (typeof isWechatRichInputEnabled === 'function' && isWechatRichInputEnabled() && richInput)
            ? richInput
            : (typeof getWechatActiveInputElement === 'function' ? getWechatActiveInputElement() : document.getElementById('wc-msg-input'));
        input?.focus?.();
        if (input?.isContentEditable) {
            const selection = window.getSelection && window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(input);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
        } else if (input && typeof input.setSelectionRange === 'function') {
            const end = input.value.length;
            input.setSelectionRange(end, end);
        }
    }, 30);
}
window.focusWechatMusicCommentInput = focusWechatMusicCommentInput;

function openWechatMusicQueueComposer() {
    openWechatComposer('music_card', null, { musicMode: 'queue' });
}
window.openWechatMusicQueueComposer = openWechatMusicQueueComposer;

function toggleWechatMusicListenPlayback() {
    const panel = document.getElementById('wc-music-listen-player');
    if (!panel) return;
    const playback = getWechatMusicPlaybackState(panel.dataset.audioUrl || '');
    if (playback.mode === 'buffer' && playback.playing) {
        stopWechatMusicBufferPlayback();
        updateWechatMusicCardPlayingState(panel.dataset.audioUrl || '', false);
        updateWechatMusicListenProgress();
        updateWechatMusicIsland();
        return;
    }
    playWechatMusicCard(panel.dataset.audioUrl || '', panel.dataset.title || '', panel.dataset.artist || '', panel, { toggle: true });
}
window.toggleWechatMusicListenPlayback = toggleWechatMusicListenPlayback;

function getWechatMusicPlayMode() {
    const mode = localStorage.getItem('wechat_music_play_mode') || 'list';
    return ['list', 'shuffle', 'one'].includes(mode) ? mode : 'list';
}

function renderWechatMusicPlayMode() {
    const btn = document.querySelector('#wc-music-listen-player .wc-music-listen-mode');
    if (!btn) return;
    const mode = getWechatMusicPlayMode();
    const meta = mode === 'shuffle'
        ? { icon: 'ri-shuffle-line', label: '随机' }
        : mode === 'one'
            ? { icon: 'ri-repeat-one-line', label: '单曲循环' }
            : { icon: 'ri-repeat-line', label: '列表循环' };
    btn.innerHTML = `<i class="${meta.icon}"></i><span>${meta.label}</span>`;
}

function cycleWechatMusicPlayMode() {
    const modes = ['list', 'shuffle', 'one'];
    const next = modes[(modes.indexOf(getWechatMusicPlayMode()) + 1) % modes.length];
    localStorage.setItem('wechat_music_play_mode', next);
    renderWechatMusicPlayMode();
}
window.cycleWechatMusicPlayMode = cycleWechatMusicPlayMode;

function getWechatMusicCardsInChat() {
    return Array.from(document.querySelectorAll('#chat-room-content .msg-music-card'))
        .filter(card => normalizeWechatUrl(card.dataset.audioUrl || ''));
}

function getWechatMusicQueueTracks() {
    const fromChat = getWechatMusicCardsInChat().map(card => ({
        title: card.dataset.title || '一起听歌',
        artist: card.dataset.artist || '',
        audioUrl: card.dataset.audioUrl || '',
        sourceAudioUrl: card.dataset.sourceUrl || card.dataset.audioUrl || '',
        artwork: card.dataset.artwork || '',
        lyricsText: card.dataset.lyricsText || '',
        lyricsUrl: card.dataset.lyricsUrl || '',
        sourceKey: card.dataset.sourceKey || '',
        sourceMeta: card.dataset.sourceMeta || '',
        sourceName: card.dataset.sourceName || '聊天'
    }));
    const added = getWechatPersistedMusicQueueTracks();
    let library = [];
    try {
        if (typeof getMusicLibraryTracks === 'function') {
            library = getMusicLibraryTracks().map(normalizeWechatMusicDraftTrack).filter(Boolean);
        }
    } catch (e) {}
    let favorites = [];
    try {
        const raw = typeof getMusicFavoritesStore === 'function'
            ? getMusicFavoritesStore()
            : JSON.parse(localStorage.getItem('bynd_music_favorites_v1') || '[]');
        favorites = (Array.isArray(raw) ? raw : []).map(normalizeWechatMusicDraftTrack).filter(Boolean);
    } catch (e) {}
    const seen = new Set();
    return [...fromChat, ...added, ...library, ...favorites].filter(track => {
        if (!track || !track.audioUrl) return false;
        const key = `${track.title}|${track.artist}|${track.audioUrl}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 40);
}

function isWechatMusicListenActive() {
    const panel = document.getElementById('wc-music-listen-player');
    const audio = window._wechatMusicCardAudio;
    const island = document.getElementById('wc-music-island');
    return !!(
        (panel && panel.dataset.audioUrl && !panel.classList.contains('hidden'))
        || (audio && audio.dataset && audio.dataset.cardUrl && !audio.ended && !audio.paused)
        || (island && island.classList.contains('show'))
    );
}

function getWechatPersistedMusicQueueTracks() {
    if (!Array.isArray(window._wechatMusicQueueAddedTracks)) {
        try {
            const raw = JSON.parse(localStorage.getItem(WECHAT_MUSIC_QUEUE_ADDED_KEY) || '[]');
            window._wechatMusicQueueAddedTracks = Array.isArray(raw) ? raw.map(normalizeWechatMusicDraftTrack).filter(Boolean) : [];
        } catch (e) {
            window._wechatMusicQueueAddedTracks = [];
        }
    }
    return window._wechatMusicQueueAddedTracks.map(normalizeWechatMusicDraftTrack).filter(Boolean);
}

function saveWechatPersistedMusicQueueTracks(tracks) {
    window._wechatMusicQueueAddedTracks = (Array.isArray(tracks) ? tracks : []).map(normalizeWechatMusicDraftTrack).filter(Boolean).slice(0, 80);
    try {
        localStorage.setItem(WECHAT_MUSIC_QUEUE_ADDED_KEY, JSON.stringify(window._wechatMusicQueueAddedTracks));
    } catch (e) {}
}

function addWechatMusicTrackToQueue(track) {
    const normalized = normalizeWechatMusicDraftTrack(track);
    if (!normalized || !normalized.audioUrl) return false;
    const added = getWechatPersistedMusicQueueTracks();
    const key = `${normalized.title}|${normalized.artist}|${normalized.audioUrl}`.toLowerCase();
    const exists = added.some(item => {
        const current = normalizeWechatMusicDraftTrack(item);
        return current && `${current.title}|${current.artist}|${current.audioUrl}`.toLowerCase() === key;
    });
    if (!exists) {
        added.unshift(normalized);
        saveWechatPersistedMusicQueueTracks(added);
    }
    renderWechatMusicQueuePanel();
    return true;
}
window.addWechatMusicTrackToQueue = addWechatMusicTrackToQueue;

function renderWechatMusicQueuePanel() {
    const panel = document.getElementById('wc-music-listen-player');
    const list = panel?.querySelector('.wc-music-queue-list');
    if (!panel || !list) return;
    const currentKey = getWechatMusicTrackMatchKey({
        title: panel.dataset.title || '',
        artist: panel.dataset.artist || '',
        audioUrl: panel.dataset.audioUrl || '',
        sourceAudioUrl: panel.dataset.sourceUrl || ''
    });
    const tracks = getWechatMusicQueueTracks();
    list.innerHTML = tracks.length ? tracks.map((track, index) => {
        const active = getWechatMusicTrackMatchKey(track) === currentKey;
        const art = track.artwork ? `<img src="${wcEscapeHtml(track.artwork)}" onerror="this.remove()">` : '<i class="ri-music-2-line"></i>';
        return `
            <button type="button" class="${active ? 'active' : ''}" onclick="playWechatMusicQueueTrack(${index})">
                <span>${art}</span>
                <b>${wcEscapeHtml(track.title || '一起听歌')}</b>
                <em>${wcEscapeHtml([track.artist, track.sourceName].filter(Boolean).join(' · ') || '音乐源')}</em>
                <i class="${active ? 'ri-volume-up-line' : 'ri-play-circle-line'}"></i>
            </button>
        `;
    }).join('') : '<div class="wc-music-queue-empty">当前没有可播放歌曲，点继续添加音乐。</div>';
    window._wechatMusicQueueTracks = tracks;
}

function toggleWechatMusicQueuePanel() {
    const panel = document.getElementById('wc-music-listen-player');
    const queue = panel?.querySelector('.wc-music-queue-panel');
    if (!queue) return;
    renderWechatMusicQueuePanel();
    queue.classList.toggle('hidden');
}
window.toggleWechatMusicQueuePanel = toggleWechatMusicQueuePanel;

function playWechatMusicQueueTrack(index) {
    const tracks = Array.isArray(window._wechatMusicQueueTracks) ? window._wechatMusicQueueTracks : getWechatMusicQueueTracks();
    const track = tracks[Number(index)];
    if (!track) return;
    playWechatMusicCard(track.audioUrl || track.playableUrl || track.sourceAudioUrl || '', track.title || '', track.artist || '', {
        dataset: {
            audioUrl: track.audioUrl || '',
            sourceUrl: track.sourceAudioUrl || track.audioUrl || '',
            playableUrl: track.playableUrl || '',
            title: track.title || '',
            artist: track.artist || '',
            artwork: track.artwork || '',
            lyricsText: track.lyricsText || '',
            lyricsUrl: track.lyricsUrl || '',
            sourceKey: track.sourceKey || '',
            sourceMeta: track.sourceMeta || '',
            sourceName: track.sourceName || ''
        },
        closest: () => null
    }, { queue: true });
}
window.playWechatMusicQueueTrack = playWechatMusicQueueTrack;

function getWechatMusicTrackMatchKey(track) {
    const audioUrl = normalizeWechatUrl(track?.audioUrl || '');
    const sourceUrl = normalizeWechatUrl(track?.sourceAudioUrl || track?.sourceUrl || '');
    const playableUrl = normalizeWechatUrl(track?.playableUrl || track?.resolvedAudioUrl || '');
    const title = String(track?.title || track?.trackName || track?.name || '').trim().toLowerCase();
    const artist = String(track?.artist || track?.artistName || track?.singer || '').trim().toLowerCase();
    return [audioUrl, sourceUrl, playableUrl].filter(Boolean).sort().join('|') || `${title}|${artist}`;
}

function playWechatMusicAdjacent(direction = 1, options = {}) {
    const tracks = getWechatMusicQueueTracks();
    if (!tracks.length) return;
    const panel = document.getElementById('wc-music-listen-player');
    const currentKey = getWechatMusicTrackMatchKey({
        title: panel?.dataset.title || '',
        artist: panel?.dataset.artist || '',
        audioUrl: panel?.dataset.audioUrl || '',
        sourceAudioUrl: panel?.dataset.sourceUrl || ''
    });
    const mode = options.mode || getWechatMusicPlayMode();
    let index = tracks.findIndex(track => getWechatMusicTrackMatchKey(track) === currentKey);
    if (mode === 'shuffle') {
        const next = tracks.length > 1
            ? Math.floor(Math.random() * (tracks.length - 1))
            : 0;
        index = tracks.length > 1 && next >= index ? next + 1 : next;
    } else {
        index = (index + Number(direction || 1) + tracks.length) % tracks.length;
    }
    if (index < 0) index = 0;
    window._wechatMusicQueueTracks = tracks;
    playWechatMusicQueueTrack(index);
}
window.playWechatMusicAdjacent = playWechatMusicAdjacent;

function handleWechatMusicPlaybackEnded() {
    document.querySelectorAll('.msg-music-card.playing').forEach(card => card.classList.remove('playing'));
    updateWechatMusicListenProgress();
    const audio = window._wechatMusicCardAudio;
    const panel = document.getElementById('wc-music-listen-player');
    const mode = getWechatMusicPlayMode();
    if (mode === 'one') {
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }
        const replayUrl = panel?.dataset.audioUrl || audio?.dataset.cardUrl || '';
        if (replayUrl) updateWechatMusicCardPlayingState(replayUrl, true);
        return;
    }
    const tracks = getWechatMusicQueueTracks();
    if (tracks.length > 1 || mode === 'list' || mode === 'shuffle') {
        playWechatMusicAdjacent(1, { mode });
    }
}

function formatWechatMusicTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function seekWechatMusicListenProgress(event) {
    const bar = event?.currentTarget || document.querySelector('#wc-music-listen-player .wc-music-listen-progress');
    const panel = document.getElementById('wc-music-listen-player');
    const playback = getWechatMusicPlaybackState(panel?.dataset?.audioUrl || '');
    if (!bar || !playback.playing || !Number.isFinite(playback.duration) || playback.duration <= 0) return false;
    const rect = bar.getBoundingClientRect();
    const clientX = Number(event?.clientX ?? event?.touches?.[0]?.clientX ?? 0);
    const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0;
    const nextTime = ratio * playback.duration;
    renderWechatMusicSeekPreview(bar, ratio, nextTime);
    if (playback.mode === 'audio' && window._wechatMusicCardAudio) {
        window._wechatMusicCardAudio.currentTime = nextTime;
    } else if (playback.mode === 'buffer') {
        const current = window._wechatMusicBufferPlayback;
        const sourceUrl = current?.sourceUrl || current?.playableUrl || current?.safeUrl || panel?.dataset?.audioUrl || '';
        playWechatAudioBufferUrl(sourceUrl, current?.safeUrl || playback.url, { offset: nextTime }).catch(e => console.warn('wechat buffer seek failed:', e));
    }
    updateWechatMusicLyricsFloat(nextTime, true);
    return true;
}
window.seekWechatMusicListenProgress = seekWechatMusicListenProgress;

function renderWechatMusicSeekPreview(bar, ratio, nextTime) {
    const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    const progressBar = bar || document.querySelector('#wc-music-listen-player .wc-music-listen-progress');
    const fill = progressBar?.querySelector('span');
    if (fill) fill.style.width = `${safeRatio * 100}%`;
    if (progressBar) {
        progressBar.setAttribute('aria-valuenow', String(Math.round(safeRatio * 100)));
        progressBar.dataset.seekPreviewTime = String(Math.max(0, Number(nextTime) || 0));
    }
}

function beginWechatMusicListenSeek(event) {
    const bar = event?.currentTarget;
    if (!bar) return;
    event.preventDefault();
    event.stopPropagation();
    bar.classList.add('is-seeking');
    if (typeof bar.setPointerCapture === 'function' && event.pointerId != null) {
        try { bar.setPointerCapture(event.pointerId); } catch (e) {}
    }
    seekWechatMusicListenProgress(event);
    const move = e => {
        e.preventDefault();
        seekWechatMusicListenProgress({ currentTarget: bar, clientX: e.clientX });
    };
    const end = () => {
        bar.classList.remove('is-seeking');
        delete bar.dataset.seekPreviewTime;
        updateWechatMusicListenProgress();
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('pointercancel', end, { once: true });
}
window.beginWechatMusicListenSeek = beginWechatMusicListenSeek;

function updateWechatMusicListenProgress() {
    const panel = document.getElementById('wc-music-listen-player');
    if (!panel || panel.classList.contains('hidden')) return;
    const fill = panel.querySelector('.wc-music-listen-progress span');
    const panelUrl = normalizeWechatUrl(panel.dataset.audioUrl || '');
    const playback = getWechatMusicPlaybackState(panelUrl);
    const isCurrent = !!(playback.playing && (!panelUrl || playback.url === panelUrl));
    const duration = isCurrent && Number.isFinite(playback.duration) ? playback.duration : 0;
    const current = isCurrent && Number.isFinite(playback.currentTime) ? playback.currentTime : 0;
    const percent = duration > 0 ? Math.max(0, Math.min(100, (current / duration) * 100)) : 0;
    const bar = panel.querySelector('.wc-music-listen-progress');
    if (!bar?.classList.contains('is-seeking')) {
        if (fill) fill.style.width = `${percent}%`;
        if (bar) bar.setAttribute('aria-valuenow', String(Math.round(percent)));
    }
    panel.classList.toggle('playing', !!isCurrent);
    const icon = panel.querySelector('.wc-music-listen-play i');
    if (icon && !panel.classList.contains('loading')) icon.className = isCurrent ? 'ri-pause-fill' : 'ri-play-fill';
}

function parseWechatMusicLyrics(raw, fallbackTitle = '') {
    const text = String(raw || '').trim();
    if (!text) return [];
    let autoTime = 0;
    return text.split(/\r?\n/).map(line => {
        const item = line.trim();
        if (!item) return null;
        const match = item.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
        if (match) {
            return {
                time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] || 0}`),
                text: match[4].trim()
            };
        }
        const next = { time: autoTime, text: item };
        autoTime += 6;
        return next;
    }).filter(item => item && item.text);
}

async function getWechatMusicLyricsForPanel(panel) {
    if (!panel) return [];
    if (panel.dataset.lyricsLoaded === '1') {
        try { return JSON.parse(panel.dataset.lyricsLines || '[]') || []; } catch (e) { return []; }
    }
    let raw = panel.dataset.lyricsText || '';
    if (!raw && panel.dataset.lyricsUrl) {
        try {
            const resp = await fetch(panel.dataset.lyricsUrl);
            if (resp.ok) raw = await resp.text();
        } catch (e) {}
    }
    if (!raw && panel.dataset.sourceKey === 'meting' && panel.dataset.sourceMeta && typeof fetchMetingTextAsset === 'function') {
        try {
            const meta = JSON.parse(panel.dataset.sourceMeta);
            raw = await fetchMetingTextAsset(meta.base, meta.platform, 'lrc', meta.lyricId);
        } catch (e) {}
    }
    if (!raw && typeof fetchMusicLyrics === 'function') {
        try {
            const lyrics = await fetchMusicLyrics({
                trackName: panel.dataset.title || '',
                artistName: panel.dataset.artist || '',
                lyricsText: panel.dataset.lyricsText || '',
                lyricsUrl: panel.dataset.lyricsUrl || '',
                sourceKey: panel.dataset.sourceKey || '',
                sourceMeta: panel.dataset.sourceMeta || '',
                sourceName: panel.dataset.sourceName || ''
            });
            const lines = Array.isArray(lyrics?.lines) ? lyrics.lines.filter(line => line && line.text) : [];
            if (lines.length) {
                panel.dataset.lyricsLines = JSON.stringify(lines);
                panel.dataset.lyricsLoaded = '1';
                return lines;
            }
        } catch (e) {}
    }
    const lines = parseWechatMusicLyrics(raw, panel.dataset.title || '');
    panel.dataset.lyricsLines = JSON.stringify(lines);
    panel.dataset.lyricsLoaded = '1';
    return lines;
}

function ensureWechatMusicLyricsFloat() {
    let box = document.getElementById('wc-music-lyrics-float');
    if (box) return mountWechatMusicOverlayElement(box);
    box = document.createElement('div');
    box.id = 'wc-music-lyrics-float';
    box.className = 'wc-music-lyrics-float hidden';
    box.innerHTML = `
        <div class="wc-music-lyrics-handle">
            <span></span>
            <button type="button" onclick="hideWechatMusicLyricsFloat()" aria-label="关闭歌词"><i class="ri-close-line"></i></button>
        </div>
        <div class="wc-music-lyrics-lines"></div>
    `;
    mountWechatMusicOverlayElement(box);
    bindWechatMusicLyricsDrag(box);
    return box;
}

async function toggleWechatMusicLyricsFloat() {
    const panel = document.getElementById('wc-music-listen-player');
    const box = ensureWechatMusicLyricsFloat();
    if (!panel || panel.classList.contains('hidden')) return;
    if (!box.classList.contains('hidden')) {
        box.classList.add('hidden');
        return;
    }
    const list = box.querySelector('.wc-music-lyrics-lines');
    if (list) list.innerHTML = '<p class="wc-music-lyrics-empty">正在载入歌词...</p>';
    box.classList.remove('hidden');
    hideWechatMusicIsland();
    const lines = await getWechatMusicLyricsForPanel(panel);
    if (list) {
        list.innerHTML = lines.map((line, index) => `
            <p class="wc-music-lyric-line" data-time="${Number.isFinite(line.time) ? line.time : ''}" data-line-index="${index}">${wcEscapeHtml(line.text)}</p>
        `).join('') || '<p class="wc-music-lyrics-empty">没有歌词内容</p>';
    }
    updateWechatMusicLyricsFloat(window._wechatMusicCardAudio?.currentTime || 0, true);
}
window.toggleWechatMusicLyricsFloat = toggleWechatMusicLyricsFloat;

function hideWechatMusicLyricsFloat() {
    document.getElementById('wc-music-lyrics-float')?.classList.add('hidden');
    updateWechatMusicIsland();
}
window.hideWechatMusicLyricsFloat = hideWechatMusicLyricsFloat;

function getWechatCurrentLyricText() {
    const active = document.querySelector('#wc-music-lyrics-float .wc-music-lyric-line.active');
    if (active?.textContent?.trim()) return active.textContent.trim();
    const panel = document.getElementById('wc-music-listen-player');
    if (!panel?.dataset.lyricsLines) return '';
    try {
        const lines = JSON.parse(panel.dataset.lyricsLines || '[]');
        const current = Number(getWechatMusicPlaybackState(panel.dataset.audioUrl || '').currentTime || 0);
        let picked = null;
        (Array.isArray(lines) ? lines : []).forEach(line => {
            if (line && Number(line.time) <= current) picked = line;
        });
        return picked?.text || '';
    } catch (e) {
        return '';
    }
}

function ensureWechatMusicIsland() {
    let island = document.getElementById('wc-music-island');
    if (island) {
        if (!island.querySelector('.wc-music-island-art') || !island.querySelector('.wc-message-island-text')) {
            island.innerHTML = `
                <div class="wc-message-island-main">
                    <div class="wc-music-island-art"><i class="ri-music-2-fill"></i></div>
                    <div class="wc-message-island-text">
                        <strong></strong>
                        <span></span>
                    </div>
                </div>
                <i class="ri-disc-line"></i>
            `;
        }
        return mountWechatMusicOverlayElement(island);
    }
    island = document.createElement('div');
    island.id = 'wc-music-island';
    island.className = 'wc-message-island wc-music-island';
    island.innerHTML = `
        <div class="wc-message-island-main">
            <div class="wc-music-island-art"><i class="ri-music-2-fill"></i></div>
            <div class="wc-message-island-text">
                <strong></strong>
                <span></span>
            </div>
        </div>
        <i class="ri-disc-line"></i>
    `;
    mountWechatMusicOverlayElement(island);
    return island;
}

function shouldShowWechatMusicIsland() {
    const panel = document.getElementById('wc-music-listen-player');
    const playback = getWechatMusicPlaybackState();
    if (!playback.playing) return false;
    const lyrics = document.getElementById('wc-music-lyrics-float');
    return (!panel || panel.classList.contains('hidden')) && (!lyrics || lyrics.classList.contains('hidden'));
}

function updateWechatMusicIsland() {
    const existing = document.getElementById('wc-music-island');
    if (!shouldShowWechatMusicIsland()) {
        existing?.classList.remove('show');
        return;
    }
    const panel = document.getElementById('wc-music-listen-player');
    const island = ensureWechatMusicIsland();
    const playback = getWechatMusicPlaybackState();
    const audioUrl = panel?.dataset.audioUrl || playback.url || window._wechatMusicCardAudio?.dataset.cardUrl || '';
    const title = panel?.dataset.title || '正在播放';
    const artist = panel?.dataset.artist || panel?.dataset.sourceName || '';
    const lyric = getWechatCurrentLyricText();
    const artwork = panel?.dataset.artwork || '';
    const artEl = island.querySelector('.wc-music-island-art');
    if (artEl && artEl.dataset.artwork !== artwork) {
        artEl.dataset.artwork = artwork;
        artEl.innerHTML = artwork
            ? `<img src="${wcEscapeAttr(artwork)}" alt="" onerror="this.parentElement.dataset.artwork='';this.parentElement.innerHTML='<i class=&quot;ri-music-2-fill&quot;></i>'">`
            : '<i class="ri-music-2-fill"></i>';
    }
    const titleEl = island.querySelector('.wc-message-island-text strong');
    const subEl = island.querySelector('.wc-message-island-text span');
    if (titleEl) titleEl.textContent = lyric || title;
    if (subEl) subEl.textContent = lyric ? `${title}${artist ? ' · ' + artist : ''}` : (artist || '正在播放');
    island.onclick = () => {
        island.classList.remove('show');
        if (panel) {
            mountWechatMusicOverlayElement(panel);
            panel.classList.remove('hidden');
            renderWechatMusicQueuePanel();
            updateWechatMusicListenProgress();
        } else if (audioUrl) {
            openWechatMusicListenPlayer({ title, artist, audioUrl, artwork, sourceAudioUrl: audioUrl });
        }
    };
    island.classList.add('show');
}

function hideWechatMusicIsland() {
    document.getElementById('wc-music-island')?.classList.remove('show');
}
window.updateWechatMusicIsland = updateWechatMusicIsland;
window.hideWechatMusicIsland = hideWechatMusicIsland;

function updateWechatMusicLyricsFloat(currentTime, force = false) {
    const box = document.getElementById('wc-music-lyrics-float');
    if (!box || box.classList.contains('hidden')) return;
    const lines = Array.from(box.querySelectorAll('.wc-music-lyric-line'));
    if (!lines.length) return;
    let activeIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        const time = Number(lines[i].dataset.time);
        if (Number.isFinite(time) && time <= currentTime + 0.2) activeIndex = i;
        else if (Number.isFinite(time)) break;
    }
    if (!force && Number(box.dataset.activeIndex) === activeIndex) return;
    box.dataset.activeIndex = String(activeIndex);
    lines.forEach((line, index) => {
        line.classList.toggle('active', index === activeIndex);
        line.classList.toggle('near-active', index === activeIndex + 1);
        line.classList.toggle('is-hidden', index !== activeIndex && index !== activeIndex + 1);
    });
    lines[activeIndex]?.scrollIntoView({ block: 'center', behavior: force ? 'auto' : 'smooth' });
    updateWechatMusicIsland();
}

function bindWechatMusicLyricsDrag(box) {
    if (!box || box.dataset.dragBound === '1') return;
    box.dataset.dragBound = '1';
    const handle = box.querySelector('.wc-music-lyrics-handle') || box;
    let drag = null;
    const move = event => {
        if (!drag) return;
        const point = event.touches ? event.touches[0] : event;
        const root = getWechatMusicOverlayRoot() || document.body;
        const rect = root.getBoundingClientRect();
        const width = box.offsetWidth || 260;
        const height = box.offsetHeight || 220;
        const left = Math.max(8, Math.min(rect.width - width - 8, point.clientX - rect.left - drag.x));
        const top = Math.max(70, Math.min(rect.height - height - 74, point.clientY - rect.top - drag.y));
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.right = 'auto';
        box.style.bottom = 'auto';
    };
    const end = () => {
        drag = null;
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', end);
        window.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', end);
    };
    const start = event => {
        if (event.target.closest('button')) return;
        const point = event.touches ? event.touches[0] : event;
        const boxRect = box.getBoundingClientRect();
        drag = { x: point.clientX - boxRect.left, y: point.clientY - boxRect.top };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);
        window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', end);
    };
    handle.addEventListener('mousedown', start);
    handle.addEventListener('touchstart', start, { passive: true });
}


function isWechatIncomingMusicInvite(msg) {
    if (!msg || msg.type !== 'music_card' || msg.isMe) return false;
    const music = msg.music && typeof msg.music === 'object' ? msg.music : {};
    return music.invite !== false && msg.musicInvite !== false;
}

function isWechatMusicInviteAccepted(msg) {
    const music = msg && msg.music && typeof msg.music === 'object' ? msg.music : {};
    return !!(music.inviteAccepted || msg.musicInviteAccepted || music.coListening);
}

function isWechatMusicInviteRejected(msg) {
    const music = msg && msg.music && typeof msg.music === 'object' ? msg.music : {};
    return !!(music.inviteRejected || msg.musicInviteRejected);
}

function getWechatMusicInvitePlayableUrl(msg) {
    const info = getWechatMusicMessageInfo(msg);
    return normalizeWechatUrl(info.audioUrl || info.playableUrl || info.sourceAudioUrl || msg?.url || '');
}

function startWechatMusicCoListenFromMessage(char, msg, options = {}) {
    if (!char || !msg || msg.type !== 'music_card' || typeof window.startMusicCoListenFromWechat !== 'function') return false;
    const info = getWechatMusicMessageInfo(msg);
    const audioUrl = getWechatMusicInvitePlayableUrl(msg);
    if (!audioUrl) return false;
    return !!window.startMusicCoListenFromWechat({
        id: msg.timestamp || `wechat:${info.title}:${audioUrl}`,
        trackName: info.title,
        title: info.title,
        artistName: info.artist,
        artist: info.artist,
        collectionName: '\u5fae\u4fe1\u4e00\u8d77\u542c\u6b4c',
        artworkUrl100: info.artwork,
        artwork: info.artwork,
        audioUrl,
        trackViewUrl: msg.url || '',
        sourceName: info.sourceName || '\u5fae\u4fe1\u97f3\u4e50'
    }, char.id, { autoplay: false, queueAi: !!options.queueAi, reason: options.reason || 'wechat-invite' });
}

async function acceptWechatMusicInvite(msgIndex) {
    const index = Number(msgIndex);
    const char = getCurrentChatChar();
    if (!char || !Array.isArray(char.history) || !Number.isInteger(index)) return;
    const msg = char.history[index];
    if (!msg || msg.type !== 'music_card' || msg.isMe) return;
    msg.music = msg.music && typeof msg.music === 'object' ? msg.music : {};
    msg.music.invite = true;
    msg.music.inviteAccepted = true;
    msg.music.inviteRejected = false;
    msg.music.coListening = true;
    msg.music.acceptedAt = Date.now();
    msg.music.rejectedAt = 0;
    msg.musicInviteAccepted = true;
    msg.musicInviteRejected = false;
    syncWechatMessageDescription(msg);
    saveCharactersToStorage();
    refreshChatView(char);
    renderChatList();
    if (typeof showWechatToast === 'function') showWechatToast('\u5df2\u540c\u610f\u4e00\u8d77\u542c\u6b4c');

    let playableUrl = getWechatMusicInvitePlayableUrl(msg);
    if (!playableUrl || msg.music.pendingSearch || msg.music.lookupFailed) {
        await enrichWechatMusicCardMessage(char, msg, { force: true, reason: 'music_invite_accept' });
        playableUrl = getWechatMusicInvitePlayableUrl(msg);
    }
    if (!playableUrl) {
        if (typeof showWechatToast === 'function') showWechatToast('\u8fd9\u9996\u6b4c\u8fd8\u6ca1\u627e\u5230\u53ef\u64ad\u653e\u97f3\u6e90\uff0c\u6362\u4e2a\u5173\u952e\u8bcd\u8bd5\u8bd5');
        refreshChatView(char);
        return;
    }
    startWechatMusicCoListenFromMessage(char, msg, { reason: 'wechat-invite-accepted' });
    const info = getWechatMusicMessageInfo(msg);
    const card = document.querySelector(`.msg-row[data-msg-idx="${index}"] .msg-music-card`);
    await playWechatMusicCard(playableUrl, info.title, info.artist, card);
}
window.acceptWechatMusicInvite = acceptWechatMusicInvite;

function rejectWechatMusicInvite(msgIndex) {
    const index = Number(msgIndex);
    const char = getCurrentChatChar();
    if (!char || !Array.isArray(char.history) || !Number.isInteger(index)) return;
    const msg = char.history[index];
    if (!msg || msg.type !== 'music_card' || msg.isMe || isWechatMusicInviteAccepted(msg)) return;
    msg.music = msg.music && typeof msg.music === 'object' ? msg.music : {};
    msg.music.invite = true;
    msg.music.inviteAccepted = false;
    msg.music.inviteRejected = true;
    msg.music.coListening = false;
    msg.music.rejectedAt = Date.now();
    msg.musicInviteAccepted = false;
    msg.musicInviteRejected = true;
    syncWechatMessageDescription(msg);
    const info = getWechatMusicMessageInfo(msg);
    char.history.push({
        type: 'user_event',
        isMe: true,
        hiddenFromChat: true,
        internalEvent: true,
        eventKind: 'music_invite_rejected',
        musicMessageTimestamp: msg.timestamp || '',
        content: `用户拒绝了你发起的一起听歌邀请：《${info.title || '这首歌'}》${info.artist ? ` - ${info.artist}` : ''}。请按你的人设、当前关系和最近聊天自然回应，可以失落、嘴硬、换话题或提出别的歌，但不要重复系统说明。`,
        timestamp: createMessageTimestamp()
    });
    saveCharactersToStorage();
    refreshChatView(char);
    renderChatList();
    if (typeof showWechatToast === 'function') showWechatToast('已拒绝一起听歌邀请');
    const contentEl = document.getElementById('chat-room-content');
    if (typeof queueWechatAutoReplyToChar === 'function') {
        queueWechatAutoReplyToChar(char.id);
    } else if (contentEl) {
        triggerAiAfterMessage(char, contentEl).catch(err => console.warn('music invite rejection reply failed:', err));
    }
}
window.rejectWechatMusicInvite = rejectWechatMusicInvite;

function bindWechatMusicCardPlayback(scope) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;
    scope.querySelectorAll('.msg-music-card').forEach(card => {
        if (card.dataset.musicPlaybackBound === '1') return;
        card.dataset.musicPlaybackBound = '1';
        prepareWechatMusicCardPlayableUrl(card).catch(() => {});
        card.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            const title = card.dataset.title || card.querySelector('.msg-music-main strong')?.textContent || '一起听歌';
            const artist = card.dataset.artist || card.querySelector('.msg-music-main em')?.textContent || '';
            playWechatMusicCard(card.dataset.audioUrl || '', title, artist, card);
        });
        card.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            const title = card.dataset.title || card.querySelector('.msg-music-main strong')?.textContent || '一起听歌';
            const artist = card.dataset.artist || card.querySelector('.msg-music-main em')?.textContent || '';
            playWechatMusicCard(card.dataset.audioUrl || '', title, artist, card);
        });
    });
}

function playWechatAudioUrl(audio, url, safeUrl) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const startTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const cleanup = () => {
            audio.removeEventListener('playing', onMaybePlaying);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('error', onError);
        };
        const finish = (ok, error) => {
            if (settled) return;
            settled = true;
            cleanup();
            ok ? resolve() : reject(error || audio.error || new Error('audio play failed'));
        };
        const hasAdvanced = () => !audio.paused && !audio.error && Number.isFinite(audio.currentTime) && audio.currentTime > startTime + 0.08;
        const onTimeUpdate = () => {
            if (hasAdvanced()) finish(true);
        };
        const onMaybePlaying = () => setTimeout(() => {
            if (hasAdvanced()) finish(true);
        }, 450);
        const onError = () => finish(false, audio.error || new Error('audio source error'));
        audio.addEventListener('playing', onMaybePlaying, { once: true });
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('error', onError, { once: true });
        audio.dataset.cardUrl = safeUrl;
        audio.muted = false;
        audio.volume = 1;
        if (audio.src !== url) {
            audio.src = url;
            audio.load();
        }
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(() => setTimeout(() => {
                if (hasAdvanced()) finish(true);
            }, 900)).catch(err => finish(false, err));
        }
        setTimeout(() => finish(false, new Error('audio clock stalled')), 2600);
    });
}

async function playWechatAudioBufferUrl(url, safeUrl, options = {}) {
    const context = getWechatMusicAudioContext();
    if (!context) throw new Error('Web Audio is not supported');
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') throw new Error('Web Audio is suspended');
    const playableUrl = await resolveWechatPlayableMusicUrl(url);
    const resp = await fetch(playableUrl || url, { cache: 'no-store', redirect: 'follow' });
    if (!resp.ok) throw new Error('audio fetch failed');
    const buffer = await context.decodeAudioData(await resp.arrayBuffer());
    stopWechatMusicBufferPlayback();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const offset = Math.max(0, Math.min(Number(options.offset || 0), Math.max(0, buffer.duration - 0.05)));
    window._wechatMusicBufferPlayback = { source, context, safeUrl, sourceUrl: url, playableUrl, startedAt: context.currentTime, duration: buffer.duration, offset };
    source.onended = () => {
        if (window._wechatMusicBufferPlayback?.source === source) {
            window._wechatMusicBufferPlayback = null;
            clearInterval(window._wechatMusicBufferTicker);
            window._wechatMusicBufferTicker = null;
            document.querySelectorAll('.msg-music-card.playing').forEach(card => card.classList.remove('playing'));
            handleWechatMusicPlaybackEnded();
        }
    };
    source.start(0, offset);
    startWechatMusicBufferTicker();
}

function getWechatMusicMessageInfo(msg) {
    const music = msg && msg.music && typeof msg.music === 'object' ? msg.music : {};
    return {
        title: music.title || msg?.title || '一起听歌',
        artist: music.artist || msg?.artist || '',
        audioUrl: normalizeWechatUrl(music.audioUrl || msg?.audioUrl || music.playableUrl || msg?.playableUrl || music.url || msg?.url || ''),
        playableUrl: normalizeWechatUrl(music.playableUrl || msg?.playableUrl || music.audioUrl || msg?.audioUrl || music.url || msg?.url || ''),
        sourceAudioUrl: normalizeWechatUrl(music.sourceAudioUrl || msg?.sourceAudioUrl || music.audioUrl || msg?.audioUrl || music.url || msg?.url || ''),
        artwork: music.artwork || msg?.artwork || '',
        sourceName: music.sourceName || msg?.sourceName || '',
        lyricsText: music.lyricsText || msg?.lyricsText || '',
        lyricsUrl: music.lyricsUrl || msg?.lyricsUrl || '',
        sourceKey: music.sourceKey || msg?.sourceKey || '',
        sourceMeta: music.sourceMeta || msg?.sourceMeta || ''
    };
}

function getWechatMusicTrackFromMessage(msg) {
    if (!msg || msg.type !== 'music_card') return null;
    const info = getWechatMusicMessageInfo(msg);
    return normalizeWechatMusicDraftTrack({
        title: info.title,
        artist: info.artist,
        audioUrl: info.audioUrl || info.playableUrl || info.sourceAudioUrl,
        playableUrl: info.playableUrl || info.audioUrl || info.sourceAudioUrl,
        sourceAudioUrl: info.sourceAudioUrl || info.audioUrl || info.playableUrl,
        artwork: info.artwork,
        sourceName: info.sourceName,
        sourceMeta: info.sourceMeta,
        sourceKey: info.sourceKey,
        lyricsText: info.lyricsText,
        lyricsUrl: info.lyricsUrl,
        url: msg.url || ''
    });
}

async function switchWechatMusicListenTrackFromAi(char, msg) {
    if (!char || !msg || msg.type !== 'music_card' || msg.isMe || !isWechatMusicListenActive()) return false;
    const tempMsg = {
        ...msg,
        music: {
            ...(msg.music && typeof msg.music === 'object' ? msg.music : {}),
            invite: false,
            inviteAccepted: true,
            coListening: true
        },
        musicInvite: false,
        musicInviteAccepted: true
    };
    if (!isWechatMusicMessagePlayable(tempMsg) || tempMsg.music?.pendingSearch || tempMsg.music?.lookupFailed) {
        await enrichWechatMusicCardMessage(char, tempMsg, { force: true, reason: 'ai_music_switch' });
    }
    let track = getWechatMusicTrackFromMessage(tempMsg);
    if (!track || !track.audioUrl) {
        const info = getWechatMusicMessageInfo(tempMsg);
        const found = await findWechatMusicTrackForCard(info.title, info.artist, info.audioUrl || info.sourceAudioUrl);
        track = found ? normalizeWechatMusicDraftTrack(found) : null;
    }
    if (!track || !track.audioUrl) {
        if (typeof showWechatToast === 'function') showWechatToast('这首切歌还没找到可播放音源');
        return true;
    }
    addWechatMusicTrackToQueue(track);
    const cardLike = {
        dataset: {
            audioUrl: track.audioUrl || '',
            sourceUrl: track.sourceAudioUrl || track.audioUrl || '',
            playableUrl: track.playableUrl || '',
            title: track.title || '',
            artist: track.artist || '',
            artwork: track.artwork || '',
            lyricsText: track.lyricsText || '',
            lyricsUrl: track.lyricsUrl || '',
            sourceKey: track.sourceKey || '',
            sourceMeta: track.sourceMeta || '',
            sourceName: track.sourceName || ''
        },
        closest: () => null
    };
    await playWechatMusicCard(track.audioUrl || track.playableUrl || track.sourceAudioUrl || '', track.title || '', track.artist || '', cardLike, { queue: true, aiSwitch: true });
    renderWechatMusicQueuePanel();
    if (typeof showWechatToast === 'function') showWechatToast(`已切到 ${track.title}`);
    return true;
}

function isWechatMusicMessagePlayable(msg) {
    const info = getWechatMusicMessageInfo(msg);
    return !!(info.audioUrl || info.playableUrl || info.sourceAudioUrl);
}

async function findWechatMusicTrackForCard(title, artist, avoidUrl = '') {
    const searcher = typeof window.searchAcrossMusicSources === 'function' ? window.searchAcrossMusicSources : null;
    if (!searcher || !title) return null;
    try {
        const mode = typeof window.getMusicSourceMode === 'function' ? window.getMusicSourceMode() : 'smart';
        const query = [title, artist].filter(Boolean).join(' ');
        const rows = await searcher(query, mode || 'smart');
        const avoid = normalizeWechatUrl(avoidUrl || '');
        const normalized = (Array.isArray(rows) ? rows : [])
            .map(item => normalizeWechatMusicDraftTrack(item))
            .filter(item => item && item.audioUrl && item.audioUrl !== avoid);
        if (!normalized.length) return null;
        const titleKey = String(title || '').trim().toLowerCase();
        const artistKey = String(artist || '').trim().toLowerCase();
        const exact = normalized.find(item => {
            const itemTitle = String(item.title || '').trim().toLowerCase();
            const itemArtist = String(item.artist || '').trim().toLowerCase();
            return itemTitle === titleKey && (!artistKey || itemArtist.includes(artistKey) || artistKey.includes(itemArtist));
        });
        return exact || normalized[0];
    } catch (e) {
        console.warn('wechat music search failed:', e);
        return null;
    }
}

function applyWechatMusicTrackToMessage(msg, track) {
    if (!msg || !track) return false;
    const normalized = normalizeWechatMusicDraftTrack(track);
    if (!normalized) return false;
    const sourceAudioUrl = normalized.sourceAudioUrl || normalized.audioUrl;
    const selectedCardUrl = isWechatMusicProxyUrl(sourceAudioUrl)
        ? sourceAudioUrl
        : (normalized.playableUrl || normalized.audioUrl);
    const previousMusic = msg.music && typeof msg.music === 'object' ? msg.music : {};
    msg.music = {
        title: normalized.title,
        artist: normalized.artist || '',
        audioUrl: selectedCardUrl,
        playableUrl: normalized.playableUrl || normalized.audioUrl,
        sourceAudioUrl,
        url: normalized.url || '',
        artwork: normalized.artwork || '',
        sourceName: normalized.sourceName || '',
        sourceMeta: normalized.sourceMeta || '',
        sourceKey: normalized.sourceKey || '',
        lyricsText: normalized.lyricsText || '',
        lyricsUrl: normalized.lyricsUrl || '',
        invite: !!previousMusic.invite,
        inviteAccepted: !!previousMusic.inviteAccepted,
        inviteRejected: !!previousMusic.inviteRejected,
        acceptedAt: previousMusic.acceptedAt || 0,
        rejectedAt: previousMusic.rejectedAt || 0,
        coListening: !!previousMusic.coListening
    };
    msg.title = normalized.title;
    msg.artist = normalized.artist || '';
    msg.audioUrl = selectedCardUrl;
    msg.playableUrl = normalized.playableUrl || normalized.audioUrl;
    msg.sourceAudioUrl = sourceAudioUrl;
    msg.url = normalized.url || '';
    msg.artwork = normalized.artwork || '';
    syncWechatMessageDescription(msg);
    return true;
}

async function enrichWechatMusicCardMessage(char, msg, options = {}) {
    if (!char || !msg || msg.type !== 'music_card') return false;
    msg.music = msg.music && typeof msg.music === 'object' ? msg.music : {};
    if (!options.force && isWechatMusicMessagePlayable(msg) && !msg.music.pendingSearch) return true;
    if (msg.music.resolving) return false;
    const info = getWechatMusicMessageInfo(msg);
    if (!info.title) return false;
    msg.music.resolving = true;
    msg.music.pendingSearch = true;
    syncWechatMessageDescription(msg);
    if (window.currentChatCharId === char.id) refreshChatView(char);
    try {
        const track = await findWechatMusicTrackForCard(info.title, info.artist, info.audioUrl || info.sourceAudioUrl);
        if (track && applyWechatMusicTrackToMessage(msg, track)) {
            msg.music.pendingSearch = false;
            msg.music.resolving = false;
            saveCharactersToStorage();
            if (window.currentChatCharId === char.id) refreshChatView(char);
            renderChatList();
            return true;
        }
        msg.music.pendingSearch = false;
        msg.music.resolving = false;
        msg.music.lookupFailed = true;
        syncWechatMessageDescription(msg);
        saveCharactersToStorage();
        if (window.currentChatCharId === char.id) refreshChatView(char);
        renderChatList();
        return false;
    } catch (e) {
        msg.music.pendingSearch = false;
        msg.music.resolving = false;
        msg.music.lookupFailed = true;
        saveCharactersToStorage();
        console.warn('wechat music enrich failed:', e);
        return false;
    }
}

function scheduleWechatMusicReaction(char, msg) {
    if (!char || !msg || msg.type !== 'music_card' || !msg.isMe || msg.musicReactionRequested) return;
    msg.musicReactionRequested = createMessageTimestamp();
    saveCharactersToStorage();
    setTimeout(() => requestWechatMusicReaction(char.id, msg.timestamp), 650);
}

async function requestWechatMusicReaction(charOrId, msgTimestamp) {
    const char = typeof charOrId === 'string'
        ? (window.myCharacters || []).find(c => c.id === charOrId)
        : charOrId;
    if (!char || typeof callChatApi !== 'function') return;
    if (isWechatAiRateLimitPaused() || isWechatBackgroundApiPaused()) return;
    if (window._wechatAiBusy) {
        setTimeout(() => requestWechatMusicReaction(char.id, msgTimestamp), 1500);
        return;
    }
    const musicMsg = (char.history || []).find(item => item && item.type === 'music_card' && item.isMe && item.timestamp === msgTimestamp);
    if (!musicMsg || musicMsg.musicReactionDone) return;
    musicMsg.musicReactionDone = true;
    const info = getWechatMusicMessageInfo(musicMsg);
    const contentEl = document.getElementById('chat-room-content');
    window._wechatAiBusy = true;
    setWechatBusyState(true);
    if (window.currentChatCharId === char.id) syncWechatCurrentChatTitleState('正在听歌...');
    try {
        const messages = typeof buildMessages === 'function'
            ? buildMessages(char, char.history || [], 26)
            : [{ role: 'system', content: `你是${getWechatCharDisplayName(char)}，按人设回复。` }];
        messages.push({
            role: 'system',
            content: `用户刚给你发了一张音乐卡片：《${info.title}》${info.artist ? ` - ${info.artist}` : ''}。你要像真的在微信里一起听歌一样，按你的人设、心情、记忆和最近上下文评价这首歌。喜欢就自然回复；如果你不喜欢、觉得不合气氛，或人设上会想掌控歌单，可以切歌。切歌时先用一条短消息说理由，再单独输出一段 [微信音乐:你想换的歌名|歌手|]，第三栏 URL 可以留空，系统会搜索可播放音源。不要每次都切歌，不要编造不存在的 URL。`
        });
        const result = await callChatApi(messages, { background: true, usageFeature: 'chat', usageChar: char });
        if (result && result.ok) {
            const parts = splitWechatAiResponseSegments(result.content, char);
            let appended = 0;
            for (let i = 0; i < parts.length; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 260 + Math.random() * 260));
                appended += appendWechatAiMessageParts(char, contentEl, parts[i]) || 0;
            }
            if (appended > 0) showWechatDesktopMessageIsland(char);
            scheduleWechatMemoryExtraction(char, 'music_reaction');
        }
    } catch (e) {
        console.warn('wechat music reaction failed:', e);
    } finally {
        saveCharactersToStorage();
        renderChatList();
        if (window.currentChatCharId === char.id) {
            syncWechatCurrentChatTitleState('');
            if (contentEl) contentEl.scrollTop = contentEl.scrollHeight;
        }
        setWechatBusyState(false);
        window._wechatAiBusy = false;
    }
}

async function recoverWechatMusicCardUrl(title, artist, currentUrl) {
    const searcher = typeof window.searchAcrossMusicSources === 'function' ? window.searchAcrossMusicSources : null;
    if (!searcher || !title) return '';
    try {
        const mode = typeof window.getMusicSourceMode === 'function' ? window.getMusicSourceMode() : 'smart';
        const rows = await searcher([title, artist].filter(Boolean).join(' '), mode || 'smart');
        const normalizedRows = (Array.isArray(rows) ? rows : [])
            .map(item => normalizeWechatMusicDraftTrack(item))
            .filter(item => item && item.audioUrl && item.audioUrl !== currentUrl);
        const titleKey = String(title || '').trim().toLowerCase();
        const artistKey = String(artist || '').trim().toLowerCase();
        const exact = normalizedRows.find(item => {
            const itemTitle = String(item.title || '').trim().toLowerCase();
            const itemArtist = String(item.artist || '').trim().toLowerCase();
            return itemTitle === titleKey && (!artistKey || itemArtist.includes(artistKey) || artistKey.includes(itemArtist));
        });
        return (exact || normalizedRows[0])?.audioUrl || '';
    } catch (e) {
        return '';
    }
}

async function playWechatMusicCard(audioUrl, title, artist, cardEl = null, options = {}) {
    const safeUrl = normalizeWechatUrl(String(audioUrl || '').replace(/\\u0026/gi, '&'));
    if (!safeUrl) {
        if (typeof showWechatToast === 'function') showWechatToast('这张音乐卡片没有可播放音频，先搜索选歌再发送');
        return;
    }
    const now = Date.now();
    const lastTap = window._wechatMusicCardLastTap || {};
    if (lastTap.url === safeUrl && now - Number(lastTap.time || 0) < 700) return;
    window._wechatMusicCardLastTap = { url: safeUrl, time: now };
    const sourceUrl = normalizeWechatUrl(cardEl?.dataset?.sourceUrl || safeUrl);
    const cardMessage = getWechatMusicCardMessageFromElement(cardEl);
    openWechatMusicListenPlayer({
        title: title || cardEl?.dataset?.title || '一起听歌',
        artist: artist || cardEl?.dataset?.artist || '',
        audioUrl: safeUrl,
        sourceAudioUrl: sourceUrl,
        artwork: cardEl?.dataset?.artwork || '',
        lyricsText: cardEl?.dataset?.lyricsText || '',
        lyricsUrl: cardEl?.dataset?.lyricsUrl || '',
        sourceKey: cardEl?.dataset?.sourceKey || '',
        sourceMeta: cardEl?.dataset?.sourceMeta || '',
        sourceName: cardEl?.dataset?.sourceName || ''
    }, cardEl, cardMessage?.msg, cardMessage?.char);
    if (cardEl && isWechatMusicProxyUrl(safeUrl) && cardEl.dataset.playableReady !== '1') {
        prepareWechatMusicCardPlayableUrl(cardEl).then(playable => {
            const nextUrl = normalizeWechatUrl(playable || '');
            if (nextUrl && nextUrl !== safeUrl && !isWechatTemporaryMusicCdnUrl(nextUrl)) {
                cardEl.dataset.audioUrl = nextUrl;
                cardEl.dataset.playableReady = '1';
                cardEl.classList.remove('loading');
            }
        }).catch(() => {});
    }
    const context = getWechatMusicAudioContext();
    if (context?.state === 'suspended') context.resume().catch(() => {});
    const audio = getWechatMusicAudioPlayer();
    if (!options.queue && ((audio.dataset.cardUrl === safeUrl && !audio.paused) || isWechatMusicBufferPlaying(safeUrl))) {
        if (!options.toggle) {
            updateWechatMusicCardPlayingState(safeUrl, true);
            return;
        }
        audio.pause();
        stopWechatMusicBufferPlayback();
        updateWechatMusicCardPlayingState(safeUrl, false);
        updateWechatMusicIsland();
        return;
    }
    stopWechatMusicBufferPlayback();
    const seq = ++wechatMusicCardPlaySeq;
    updateWechatMusicCardPlayingState(safeUrl, false, true);
    const candidates = [];
    const addCandidate = value => {
        const nextUrl = normalizeWechatUrl(value || '');
        if (nextUrl && !candidates.includes(nextUrl)) candidates.push(nextUrl);
    };
    const cached = getWechatResolvedMusicCache(sourceUrl || safeUrl);
    addCandidate(cached);
    addCandidate(safeUrl);
    if (!cardEl && isWechatMusicProxyUrl(safeUrl)) {
        try {
            const resolvedFirst = await resolveWechatPlayableMusicUrl(safeUrl);
            addCandidate(resolvedFirst);
        } catch (e) {}
    }
    let lastError = null;
    let nativeFallbackUrl = candidates.find(Boolean) || safeUrl;
    for (const candidate of candidates) {
        nativeFallbackUrl = candidate || nativeFallbackUrl;
        try {
            await playWechatAudioUrl(audio, candidate, safeUrl);
            if (seq === wechatMusicCardPlaySeq) {
                updateWechatMusicCardPlayingState(safeUrl, true);
            }
            return;
        } catch (e) {
            lastError = e;
        }
        if (!cardEl) {
            try {
                audio.pause();
                await playWechatAudioBufferUrl(candidate, safeUrl);
                if (seq === wechatMusicCardPlaySeq) {
                    updateWechatMusicCardPlayingState(safeUrl, true);
                }
                return;
            } catch (e) {
                lastError = e;
            }
        }
    }
    const resolved = await resolveWechatPlayableMusicUrl(safeUrl);
    if (resolved && !candidates.includes(resolved)) {
        nativeFallbackUrl = resolved;
        try {
            await playWechatAudioUrl(audio, resolved, safeUrl);
            if (seq === wechatMusicCardPlaySeq) updateWechatMusicCardPlayingState(safeUrl, true);
            return;
        } catch (e) {
            lastError = e;
        }
        try {
            audio.pause();
            await playWechatAudioBufferUrl(resolved, safeUrl);
            if (seq === wechatMusicCardPlaySeq) updateWechatMusicCardPlayingState(safeUrl, true);
            return;
        } catch (e) {
            lastError = e;
        }
    }
    const recovered = await recoverWechatMusicCardUrl(title, artist, safeUrl);
    if (recovered) {
        const nextUrl = normalizeWechatUrl(recovered);
        nativeFallbackUrl = nextUrl || nativeFallbackUrl;
        if (cardEl && nextUrl) cardEl.dataset.audioUrl = nextUrl;
        try {
            await playWechatAudioUrl(audio, nextUrl, nextUrl);
            if (seq === wechatMusicCardPlaySeq) updateWechatMusicCardPlayingState(nextUrl, true);
            return;
        } catch (e) {
            lastError = e;
        }
        try {
            audio.pause();
            await playWechatAudioBufferUrl(nextUrl, nextUrl);
            if (seq === wechatMusicCardPlaySeq) updateWechatMusicCardPlayingState(nextUrl, true);
            return;
        } catch (e) {
            lastError = e;
        }
    }
    window._wechatMusicLastError = {
        name: lastError?.name || '',
        message: lastError?.message || String(lastError || ''),
        url: safeUrl,
        time: Date.now()
    };
    updateWechatMusicCardPlayingState(safeUrl, false);
    const errorName = lastError?.name || '';
    if (typeof showWechatToast === 'function') {
        showWechatToast(errorName === 'NotAllowedError' ? '浏览器拦截了播放，请再点一次音乐卡片' : '播放失败，换一首或换一个音乐源试试');
    }
}

function normalizeWechatMusicDraftTrack(track) {
    if (!track || typeof track !== 'object') return null;
    const title = track.trackName || track.title || track.name || '';
    if (!title) return null;
    const audioUrl = normalizeWechatUrl(track.audioUrl || track.musicUrl || track.playUrl || track.src || '');
    const sourceAudioUrl = normalizeWechatUrl(track.sourceAudioUrl || track.sourceUrl || audioUrl);
    return {
        title,
        artist: track.artistName || track.artist || track.singer || '',
        audioUrl,
        playableUrl: normalizeWechatUrl(track.playableUrl || track.resolvedAudioUrl || audioUrl),
        sourceAudioUrl,
        url: normalizeWechatUrl(track.trackViewUrl || track.pageUrl || track.shareUrl || ''),
        artwork: track.artworkUrl100 || track.artwork || track.cover || track.pic || '',
        sourceName: track.sourceName || track.collectionName || '',
        sourceMeta: track.sourceMeta || '',
        sourceKey: track.sourceKey || '',
        lyricsText: track.lyricsText || '',
        lyricsUrl: track.lyricsUrl || '',
        raw: track
    };
}

function getWechatMusicCardDraft() {
    const track = typeof window.getCurrentMusicTrack === 'function' ? window.getCurrentMusicTrack() : null;
    const normalized = normalizeWechatMusicDraftTrack(track);
    if (normalized) return normalized;
    const inputValue = document.getElementById('music-search-input')?.value || '';
    return {
        title: inputValue.trim() || '一起听歌',
        artist: '',
        url: '',
        artwork: ''
    };
}

function getWechatMusicComposeOptions(existingMsg = null) {
    const options = [];
    const add = track => {
        const normalized = normalizeWechatMusicDraftTrack(track);
        if (!normalized) return;
        const key = `${normalized.title}|${normalized.artist}|${normalized.url}`.toLowerCase();
        if (options.some(item => item.key === key)) return;
        options.push({ ...normalized, key });
    };
    if (existingMsg) add(existingMsg.music || existingMsg);
    add(getWechatMusicCardDraft());
    try {
        const favorites = typeof getMusicFavoritesStore === 'function'
            ? getMusicFavoritesStore()
            : JSON.parse(localStorage.getItem('bynd_music_favorites_v1') || '[]');
        (Array.isArray(favorites) ? favorites : []).slice(0, 24).forEach(add);
    } catch (e) {}
    return options.length ? options : [getWechatMusicCardDraft()];
}

function renderWechatMusicComposeResults() {
    const list = document.getElementById('wc-compose-music-results');
    const status = document.getElementById('wc-compose-music-status');
    if (!list) return;
    const results = Array.isArray(window._wechatMusicComposeResults) ? window._wechatMusicComposeResults : [];
    const selected = window._wechatMusicComposeSelected || null;
    const isQueueMode = document.getElementById('wc-composer-modal')?.dataset.musicMode === 'queue';
    if (status) status.textContent = selected?.resolving
        ? '正在解析可播放地址...'
        : (selected?.audioUrl ? '已选择：' + selected.title : (results.length ? '请选择一首可播放音乐' : `搜索后选择一首歌再${isQueueMode ? '添加' : '发送'}`));
    list.innerHTML = results.length ? results.map((track, index) => {
        const active = selected && selected.audioUrl === track.audioUrl && selected.title === track.title;
        return `
            <button type="button" class="wc-music-result-item ${active ? 'active' : ''}" onclick="selectWechatMusicComposeTrack(${index})">
                <div class="wc-music-result-cover">${track.artwork ? `<img src="${wcEscapeHtml(track.artwork)}" onerror="this.remove()">` : '<i class="ri-music-2-line"></i>'}</div>
                <div>
                    <strong>${wcEscapeHtml(track.title)}</strong>
                    <span>${wcEscapeHtml([track.artist, track.sourceName].filter(Boolean).join(' · ') || '音乐源')}</span>
                </div>
                <i class="${active ? 'ri-checkbox-circle-fill' : 'ri-play-circle-line'}"></i>
            </button>
        `;
    }).join('') : '<div class="wc-music-result-empty">输入歌名或歌手，点搜索。</div>';
}

async function selectWechatMusicComposeTrack(index) {
    const results = Array.isArray(window._wechatMusicComposeResults) ? window._wechatMusicComposeResults : [];
    const track = results[index];
    if (!track || !track.audioUrl) {
        if (typeof showWechatToast === 'function') showWechatToast('这首没有可播放音频，换一个结果');
        return;
    }
    window._wechatMusicComposeSelected = { ...track, resolving: true };
    renderWechatMusicComposeResults();
    const sourceAudioUrl = track.sourceAudioUrl || track.audioUrl;
    let playableUrl = track.playableUrl || '';
    try {
        playableUrl = await resolveWechatPlayableMusicUrl(sourceAudioUrl);
    } catch (e) {
        playableUrl = track.audioUrl;
    }
    const primaryAudioUrl = isWechatMusicProxyUrl(sourceAudioUrl) ? sourceAudioUrl : (playableUrl || track.audioUrl);
    const nextTrack = { ...track, sourceAudioUrl, playableUrl: playableUrl || track.audioUrl, audioUrl: primaryAudioUrl, resolving: false };
    window._wechatMusicComposeResults[index] = nextTrack;
    window._wechatMusicComposeSelected = nextTrack;
    renderWechatMusicComposeResults();
}
window.selectWechatMusicComposeTrack = selectWechatMusicComposeTrack;

async function searchWechatMusicForComposer() {
    const input = document.getElementById('wc-compose-music-query');
    const status = document.getElementById('wc-compose-music-status');
    const query = String(input?.value || '').trim();
    if (!query) {
        if (typeof showWechatToast === 'function') showWechatToast('先输入歌名或歌手');
        return;
    }
    if (status) status.textContent = '正在搜索音乐...';
    window._wechatMusicComposeSelected = null;
    try {
        const mode = typeof window.getMusicSourceMode === 'function' ? window.getMusicSourceMode() : 'smart';
        const searcher = typeof window.searchAcrossMusicSources === 'function' ? window.searchAcrossMusicSources : null;
        let tracks = searcher ? await searcher(query, mode || 'smart') : [];
        tracks = (Array.isArray(tracks) ? tracks : []).map(normalizeWechatMusicDraftTrack).filter(item => item && item.audioUrl);
        window._wechatMusicComposeResults = tracks.slice(0, 18);
        const isQueueMode = document.getElementById('wc-composer-modal')?.dataset.musicMode === 'queue';
        if (status) status.textContent = tracks.length ? `搜索完成，选择一首后${isQueueMode ? '添加' : '发送'}` : '没有搜到可播放音频，换关键词试试';
    } catch (e) {
        window._wechatMusicComposeResults = [];
        if (status) status.textContent = '搜索失败，换关键词或音乐源再试';
    }
    renderWechatMusicComposeResults();
}
window.searchWechatMusicForComposer = searchWechatMusicForComposer;

