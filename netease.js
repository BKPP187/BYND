// --- 网易云音乐：扫码登录 + 歌单导入 + 仿网易云三视图（我的/歌单/黑胶播放页） ---
// 依赖 script.js 的全局：fetchJsonWithTimeout / normalizeMusicTrack / musicTracks / musicCurrentIndex /
// musicAudio / musicIsPlaying / renderMusicApp / showMusicStatus / toggleMusicPlayback / selectMusicTrack /
// getMusicTrackKey / getMusicPlaylistsStore / saveMusicPlaylistsStore / renderMusicImportedPlaylists /
// parseLyricsLines / formatMusicTime / musicEscapeHtml / musicEscapeAttr / isMusicFavorite / toggleMusicFavorite

const NETEASE_AUTH_KEY = 'bynd_music_netease_auth_v1';
const NETEASE_API_BASE_KEY = 'bynd_music_netease_api_v1';
const NETEASE_AUDIO_PROXY_BASE_KEY = 'bynd_music_netease_audio_proxy_base_v1';
const NETEASE_LOCAL_API_BASE = 'http://127.0.0.1:18867';
const NETEASE_PUBLIC_API_BASE = 'https://bynd.ccwu.cc/netease/api';

let neteaseQrTimer = null;
let neteaseQrKey = '';
let neteaseQrCookie = '';
let neteaseSection = 'login';
let neteasePlaylistCache = { created: [], subscribed: [], likedCount: 0 };
let neteaseCurrentPlaylist = null; // { id, name, tracks, type }
let neteasePlayerTimer = null;
let neteasePlayerLyrics = { key: '', lines: [] };
let neteasePlayerBackTo = 'mine';
let neteaseMineLoading = false;
let neteaseAudioProxyOfflineUntil = 0;
let neteaseAudioProxyOfflineBase = '';

// ---------- 基础设施 ----------

function getNeteaseApiBase() {
    const saved = String(localStorage.getItem(NETEASE_API_BASE_KEY) || '').trim().replace(/\/+$/, '');
    if (saved && !shouldIgnoreLoopbackNeteaseBase(saved)) return saved;
    if (saved && shouldIgnoreLoopbackNeteaseBase(saved)) localStorage.removeItem(NETEASE_API_BASE_KEY);
    return getDefaultNeteaseApiBase();
}

function setNeteaseApiBase(value) {
    const clean = String(value || '').trim().replace(/\/+$/, '');
    if (clean) localStorage.setItem(NETEASE_API_BASE_KEY, clean);
    else localStorage.removeItem(NETEASE_API_BASE_KEY);
}

function getNeteaseAudioProxyBase() {
    const saved = String(localStorage.getItem(NETEASE_AUDIO_PROXY_BASE_KEY) || '').trim().replace(/\/+$/, '');
    if (saved) return saved;
    try {
        if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
    } catch (e) {}
    return '';
}

function setNeteaseAudioProxyBase(value) {
    const clean = String(value || '').trim().replace(/\/+$/, '');
    if (clean) localStorage.setItem(NETEASE_AUDIO_PROXY_BASE_KEY, clean);
    else localStorage.removeItem(NETEASE_AUDIO_PROXY_BASE_KEY);
}

function getDefaultNeteaseApiBase() {
    try {
        const host = location.hostname || '';
        const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
        if ((location.protocol === 'http:' || location.protocol === 'https:') && !isLocal) {
            return `${location.origin}/netease/api`;
        }
    } catch (e) {}
    return NETEASE_PUBLIC_API_BASE;
}

function shouldIgnoreLoopbackNeteaseBase(base) {
    if (!isLoopbackNeteaseBase(base)) return false;
    try {
        const host = location.hostname || '';
        return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
    } catch (e) {
        return false;
    }
}

function isLoopbackNeteaseBase(base) {
    try {
        const host = new URL(base).hostname;
        return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    } catch (e) {
        return false;
    }
}

function getNeteaseAuth() {
    try {
        const auth = JSON.parse(localStorage.getItem(NETEASE_AUTH_KEY) || 'null');
        return auth && auth.cookie ? auth : null;
    } catch (e) {
        return null;
    }
}

function saveNeteaseAuth(auth) {
    localStorage.setItem(NETEASE_AUTH_KEY, JSON.stringify(auth));
    renderNeteaseEntry();
}

function clearNeteaseAuth() {
    localStorage.removeItem(NETEASE_AUTH_KEY);
    neteasePlaylistCache = { created: [], subscribed: [], likedCount: 0 };
    renderNeteaseEntry();
}

async function neteaseApiFetch(path, params = {}, timeout = 15000) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value != null && value !== '') qs.set(key, String(value));
    });
    qs.set('timestamp', String(Date.now()));
    const auth = getNeteaseAuth();
    if (auth?.cookie && !('cookie' in params)) qs.set('cookie', auth.cookie);
    let lastError = null;
    for (const base of getNeteaseApiBaseCandidates()) {
        try {
            return await fetchJsonWithTimeout(`${base}${path}?${qs.toString()}`, {}, timeout);
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error('netease api unavailable');
}

function getNeteaseApiBaseCandidates() {
    const bases = [getNeteaseApiBase(), NETEASE_PUBLIC_API_BASE]
        .map(base => String(base || '').trim().replace(/\/+$/, ''))
        .filter(Boolean);
    return bases.filter((base, index) => bases.indexOf(base) === index);
}

function getNeteaseApiFailureText(error) {
    const base = getNeteaseApiBase();
    if (isLoopbackNeteaseBase(base)) {
        return '本机 18867 不可用，内置网易云 API 也暂时连不上，请检查网络后点「刷新二维码」。';
    }
    if (/\/netease\/api$/.test(base)) {
        return '连不上 bynd.ccwu.cc 的网易云 API 代理，请检查网络后点「刷新二维码」。';
    }
    const reason = error?.message ? `（${error.message}）` : '';
    return `连不上网易云 API：${base}${reason}`;
}

// ---------- 扫码登录 ----------

function stopNeteaseQrPolling() {
    clearInterval(neteaseQrTimer);
    neteaseQrTimer = null;
}

function setNeteaseQrStatus(text) {
    const el = document.getElementById('mn-qr-status');
    if (el) el.textContent = text;
}

async function startNeteaseQrLogin() {
    stopNeteaseQrPolling();
    const img = document.getElementById('mn-qr-img');
    if (img) img.innerHTML = '<div class="mn-qr-loading"><i class="ri-loader-4-line"></i></div>';
    setNeteaseQrStatus('正在获取二维码...');
    try {
        const keyRes = await neteaseApiFetch('/login/qr/key', { cookie: '' });
        neteaseQrKey = keyRes?.data?.unikey || keyRes?.unikey || '';
        neteaseQrCookie = String(keyRes?.data?.cookie || keyRes?.cookie || '');
        if (!neteaseQrKey) throw new Error('no unikey');
        const qrRes = await neteaseApiFetch('/login/qr/create', {
            key: neteaseQrKey,
            qrimg: 'true',
            platform: 'web',
            cookie: neteaseQrCookie
        });
        const qrimg = qrRes?.data?.qrimg || '';
        if (!qrimg) throw new Error('no qrimg');
        if (img) img.innerHTML = `<img src="${musicEscapeAttr(qrimg)}" alt="网易云登录二维码">`;
        setNeteaseQrStatus('打开网易云音乐 App，扫一扫登录');
        neteaseQrTimer = setInterval(checkNeteaseQrStatus, 1500);
    } catch (e) {
        if (img) img.innerHTML = '<div class="mn-qr-loading"><i class="ri-wifi-off-line"></i></div>';
        setNeteaseQrStatus(getNeteaseApiFailureText(e));
    }
}
window.startNeteaseQrLogin = startNeteaseQrLogin;

async function checkNeteaseQrStatus() {
    const view = document.getElementById('music-netease-view');
    if (!view || view.classList.contains('hidden') || neteaseSection !== 'login') {
        stopNeteaseQrPolling();
        return;
    }
    if (!neteaseQrKey) return;
    let res = null;
    try {
        res = await neteaseApiFetch('/login/qr/check', { key: neteaseQrKey, cookie: neteaseQrCookie });
    } catch (e) {
        return; // 网络抖动，下一轮再试
    }
    const code = Number(res?.code || 0);
    if (code === 800) {
        stopNeteaseQrPolling();
        setNeteaseQrStatus('二维码过期了，点「刷新」重新生成');
    } else if (code === 802) {
        setNeteaseQrStatus(`已扫码${res?.nickname ? `：${res.nickname}` : ''}，在手机上点「确认登录」`);
    } else if (code === 803) {
        stopNeteaseQrPolling();
        setNeteaseQrStatus('登录成功，正在拉取资料...');
        await neteaseHandleLoginSuccess(String(res?.cookie || neteaseQrCookie || ''));
    }
}

async function neteaseHandleLoginSuccess(cookie) {
    if (!cookie) {
        setNeteaseQrStatus('没拿到登录凭证，点「刷新」重试');
        return;
    }
    localStorage.setItem(NETEASE_AUTH_KEY, JSON.stringify({ cookie, profile: null, ts: Date.now() }));
    try {
        const status = await neteaseApiFetch('/login/status', {});
        const profile = status?.data?.profile || null;
        saveNeteaseAuth({
            cookie,
            profile: profile ? {
                userId: profile.userId,
                nickname: profile.nickname || '网易云用户',
                avatarUrl: String(profile.avatarUrl || '').replace(/^http:\/\//i, 'https://')
            } : null,
            ts: Date.now()
        });
    } catch (e) {
        saveNeteaseAuth({ cookie, profile: null, ts: Date.now() });
    }
    switchNeteaseSection('mine');
    loadNeteaseMine(true);
}

async function neteaseLogout() {
    try { await neteaseApiFetch('/logout', {}); } catch (e) {}
    clearNeteaseAuth();
    switchNeteaseSection('login');
    startNeteaseQrLogin();
    if (typeof showMusicStatus === 'function') showMusicStatus('已退出网易云账号。');
}
window.neteaseLogout = neteaseLogout;

// ---------- 数据层 ----------

function convertNeteaseTrack(song) {
    if (!song || !song.id) return null;
    const artists = (song.ar || song.artists || []).map(item => item?.name).filter(Boolean).join(' / ');
    const album = song.al || song.album || {};
    const pic = String(album.picUrl || '').replace(/^http:\/\//i, 'https://');
    return normalizeMusicTrack({
        id: `netease:${song.id}`,
        remoteId: String(song.id),
        trackName: song.name || 'Untitled',
        artistName: artists || 'Unknown Artist',
        collectionName: album.name || '网易云音乐',
        artworkUrl100: pic ? `${pic}?param=300y300` : '',
        audioUrl: '',
        trackViewUrl: `https://music.163.com/#/song?id=${song.id}`,
        sourceKey: 'netease',
        sourceMeta: JSON.stringify({ id: song.id }),
        sourceName: '网易云音乐',
        primaryGenreName: 'NetEase Music',
        duration: Math.round((song.dt || song.duration || 0) / 1000) || null
    });
}

async function fetchNeteaseUserPlaylists() {
    const auth = getNeteaseAuth();
    const uid = auth?.profile?.userId;
    if (!uid) return { created: [], subscribed: [] };
    const res = await neteaseApiFetch('/user/playlist', { uid, limit: 100 });
    const list = Array.isArray(res?.playlist) ? res.playlist : [];
    const created = [];
    const subscribed = [];
    list.forEach(item => {
        if (!item || !item.id) return;
        const row = {
            id: String(item.id),
            name: item.name || '未命名歌单',
            cover: String(item.coverImgUrl || '').replace(/^http:\/\//i, 'https://'),
            trackCount: item.trackCount || 0,
            isLiked: /喜欢的音乐$/.test(item.name || '') && item.creator?.userId === uid
        };
        if (item.subscribed) subscribed.push(row);
        else created.push(row);
    });
    return { created, subscribed };
}

async function fetchNeteaseLikedTracks() {
    const auth = getNeteaseAuth();
    const uid = auth?.profile?.userId;
    if (!uid) return [];
    const likeRes = await neteaseApiFetch('/likelist', { uid });
    const ids = Array.isArray(likeRes?.ids) ? likeRes.ids.slice(0, 500) : [];
    if (!ids.length) return [];
    const tracks = [];
    for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        try {
            const detail = await neteaseApiFetch('/song/detail', { ids: chunk.join(',') });
            (detail?.songs || []).forEach(song => {
                const track = convertNeteaseTrack(song);
                if (track) tracks.push(track);
            });
        } catch (e) {}
    }
    return tracks;
}

async function fetchNeteasePlaylistTracks(playlistId) {
    const res = await neteaseApiFetch('/playlist/track/all', { id: playlistId, limit: 500 });
    return (res?.songs || []).map(convertNeteaseTrack).filter(Boolean);
}

async function fetchNeteaseLyricLines(songId) {
    try {
        const res = await neteaseApiFetch('/lyric', { id: songId });
        const raw = res?.lrc?.lyric || '';
        if (!raw.trim()) return null;
        const lines = parseLyricsLines(raw);
        if (!lines.length) return null;
        return { source: '网易云歌词', lines };
    } catch (e) {
        return null;
    }
}
window.fetchNeteaseLyricLines = fetchNeteaseLyricLines;

async function createNeteaseAudioProxyUrl(songId, sourceUrl) {
    const proxyBase = getNeteaseAudioProxyBase();
    const auth = getNeteaseAuth();
    if (!proxyBase || !auth?.cookie || !sourceUrl) return '';
    if (neteaseAudioProxyOfflineBase === proxyBase && Date.now() < neteaseAudioProxyOfflineUntil) return '';
    try {
        const res = await fetchJsonWithTimeout(`${proxyBase}/netease/ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: String(songId || ''),
                url: String(sourceUrl || ''),
                cookie: auth.cookie
            })
        }, 3500);
        const audioUrl = res?.audioUrl || res?.data?.audioUrl || '';
        return audioUrl ? String(audioUrl) : '';
    } catch (e) {
        neteaseAudioProxyOfflineBase = proxyBase;
        neteaseAudioProxyOfflineUntil = Date.now() + 5 * 60 * 1000;
        return '';
    }
}

async function prepareNeteaseAudioUrl(songId, sourceUrl) {
    const cleanUrl = String(sourceUrl || '').replace(/^http:\/\//i, 'https://');
    if (!cleanUrl) return '';
    const proxyUrl = await createNeteaseAudioProxyUrl(songId, cleanUrl);
    return proxyUrl || cleanUrl;
}

async function resolveNeteaseAudioUrl(songId) {
    // 1) 自家 API：song/url/v1（带 cookie，会员歌也能拿）
    try {
        const res = await neteaseApiFetch('/song/url/v1', { id: songId, level: 'exhigh' });
        const url = res?.data?.[0]?.url || '';
        if (url) return prepareNeteaseAudioUrl(songId, url);
    } catch (e) {}
    try {
        const res = await neteaseApiFetch('/song/url', { id: songId, br: '320000' });
        const url = res?.data?.[0]?.url || '';
        if (url) return prepareNeteaseAudioUrl(songId, url);
    } catch (e) {}
    // 2) Meting 公共源兜底
    try {
        const settings = getMusicSourceSettings();
        const base = settings.metingBases?.[0];
        if (base) {
            const params = new URLSearchParams({ server: 'netease', type: 'url', id: String(songId), br: '320' });
            return `${base}?${params.toString()}`;
        }
    } catch (e) {}
    return '';
}

async function resolveAndPlayNeteaseMusic(track, autoplay = true) {
    if (!track || !track.remoteId || track._resolving) return;
    track._resolving = true;
    if (typeof showMusicStatus === 'function') showMusicStatus(`正在解析「${track.trackName}」...`);
    try {
        const url = await resolveNeteaseAudioUrl(track.remoteId);
        if (!url) {
            showMusicStatus('这首歌没拿到播放地址（可能是数字专辑），换一首试试。');
            return;
        }
        let storedIndex = musicTracks.findIndex(item => item === track);
        if (storedIndex < 0) {
            storedIndex = musicTracks.findIndex(item => item.sourceKey === 'netease' && String(item.remoteId) === String(track.remoteId));
        }
        if (storedIndex < 0) {
            storedIndex = musicTracks.findIndex(item => getMusicTrackKey(item) === getMusicTrackKey(track));
        }
        const stored = storedIndex >= 0 ? musicTracks[storedIndex] : null;
        if (stored) {
            stored.audioUrl = url;
            musicCurrentIndex = storedIndex;
        }
        track.audioUrl = url;
        if (typeof renderMusicApp === 'function') renderMusicApp();
        if (autoplay) toggleMusicPlayback(true);
        renderNeteasePlayer();
        if (typeof renderMusicNowPlaying === 'function') renderMusicNowPlaying();
        if (typeof updateMusicProgress === 'function') updateMusicProgress();
    } finally {
        track._resolving = false;
    }
}
window.resolveAndPlayNeteaseMusic = resolveAndPlayNeteaseMusic;

function importNeteaseTracksToMusic(name, playlistId, tracks) {
    if (!Array.isArray(tracks) || !tracks.length) return;
    const item = {
        id: `playlist_netease_${playlistId}`,
        platform: 'netease',
        platformLabel: '网易云',
        playlistId: String(playlistId),
        name: name || `网易云歌单 ${playlistId}`,
        sourceUrl: `https://music.163.com/#/playlist?id=${playlistId}`,
        tracks: tracks.slice(0, 300),
        createdAt: Date.now()
    };
    const list = getMusicPlaylistsStore().filter(row => row.id !== item.id);
    list.unshift(item);
    saveMusicPlaylistsStore(list);
    renderMusicImportedPlaylists();
    if (typeof showMusicStatus === 'function') showMusicStatus(`已导入「${item.name}」，${item.tracks.length} 首。`);
}

// ---------- 视图框架 ----------

function openNeteaseView() {
    const view = document.getElementById('music-netease-view');
    if (!view) return;
    view.classList.remove('hidden');
    const auth = getNeteaseAuth();
    if (auth) {
        switchNeteaseSection('mine');
        loadNeteaseMine(false);
    } else {
        switchNeteaseSection('login');
        startNeteaseQrLogin();
    }
}
window.openNeteaseView = openNeteaseView;

function closeNeteaseView() {
    const view = document.getElementById('music-netease-view');
    if (view) view.classList.add('hidden');
    stopNeteaseQrPolling();
    stopNeteasePlayerTimer();
}
window.closeNeteaseView = closeNeteaseView;

function switchNeteaseSection(name) {
    neteaseSection = name;
    document.querySelectorAll('#music-netease-view .mn-section').forEach(el => {
        el.classList.toggle('active', el.dataset.section === name);
    });
    if (name !== 'login') stopNeteaseQrPolling();
    if (name === 'player') startNeteasePlayerTimer();
    else stopNeteasePlayerTimer();
}
window.switchNeteaseSection = switchNeteaseSection;

function neteasePlayerBack() {
    switchNeteaseSection(neteasePlayerBackTo === 'playlist' && neteaseCurrentPlaylist ? 'playlist' : 'mine');
}
window.neteasePlayerBack = neteasePlayerBack;

function renderNeteaseEntry() {
    const statusEl = document.getElementById('music-netease-entry-status');
    if (!statusEl) return;
    const auth = getNeteaseAuth();
    statusEl.textContent = auth?.profile?.nickname
        ? `${auth.profile.nickname} · 点击进入`
        : '未登录 · 扫码登录导入歌单';
}

// ---------- 我的页 ----------

async function loadNeteaseMine(force) {
    renderNeteaseMine();
    if (neteaseMineLoading) return;
    if (!force && (neteasePlaylistCache.created.length || neteasePlaylistCache.subscribed.length)) return;
    neteaseMineLoading = true;
    try {
        const auth = getNeteaseAuth();
        if (auth && !auth.profile) {
            // 老登录态补拉资料
            try {
                const status = await neteaseApiFetch('/login/status', {});
                const profile = status?.data?.profile;
                if (profile) {
                    auth.profile = {
                        userId: profile.userId,
                        nickname: profile.nickname || '网易云用户',
                        avatarUrl: String(profile.avatarUrl || '').replace(/^http:\/\//i, 'https://')
                    };
                    saveNeteaseAuth(auth);
                } else {
                    clearNeteaseAuth();
                    switchNeteaseSection('login');
                    startNeteaseQrLogin();
                    return;
                }
            } catch (e) {}
        }
        const data = await fetchNeteaseUserPlaylists();
        const liked = data.created.find(item => item.isLiked);
        neteasePlaylistCache = {
            created: data.created.filter(item => !item.isLiked),
            subscribed: data.subscribed,
            likedCount: liked ? liked.trackCount : 0,
            likedId: liked ? liked.id : ''
        };
    } catch (e) {
        if (typeof showMusicStatus === 'function') showMusicStatus('拉取网易云歌单失败，检查 API 服务。');
    } finally {
        neteaseMineLoading = false;
        renderNeteaseMine();
    }
}

function renderNeteasePlaylistRow(item) {
    const cover = item.cover
        ? `<img src="${musicEscapeAttr(`${item.cover}?param=100y100`)}" alt="" loading="lazy">`
        : '<i class="ri-play-list-2-line"></i>';
    return `
        <button type="button" class="mn-playlist-row" onclick="openNeteasePlaylist('playlist','${musicEscapeAttr(item.id)}','${musicEscapeAttr(item.name)}')">
            <span class="mn-playlist-cover">${cover}</span>
            <span class="mn-playlist-meta">
                <strong>${musicEscapeHtml(item.name)}</strong>
                <em>${item.trackCount} 首</em>
            </span>
            <i class="ri-arrow-right-s-line"></i>
        </button>
    `;
}

function renderNeteaseMine() {
    const box = document.getElementById('mn-mine-body');
    if (!box) return;
    const auth = getNeteaseAuth();
    const profile = auth?.profile;
    const avatar = profile?.avatarUrl
        ? `<img src="${musicEscapeAttr(`${profile.avatarUrl}?param=120y120`)}" alt="">`
        : '<i class="ri-user-3-fill"></i>';
    const cache = neteasePlaylistCache;
    const loading = neteaseMineLoading && !cache.created.length && !cache.subscribed.length;
    box.innerHTML = `
        <div class="mn-user-card">
            <span class="mn-user-avatar">${avatar}</span>
            <span class="mn-user-meta">
                <strong>${musicEscapeHtml(profile?.nickname || '网易云用户')}</strong>
                <em>${profile?.userId ? `UID ${profile.userId}` : '资料拉取中'}</em>
            </span>
        </div>
        <button type="button" class="mn-liked-row" onclick="openNeteasePlaylist('liked','${musicEscapeAttr(cache.likedId || '')}','我喜欢的音乐')">
            <span class="mn-liked-heart"><i class="ri-heart-3-fill"></i></span>
            <span class="mn-playlist-meta">
                <strong>我喜欢的音乐</strong>
                <em>${cache.likedCount ? `${cache.likedCount} 首` : '点击查看'}</em>
            </span>
            <i class="ri-arrow-right-s-line"></i>
        </button>
        ${loading ? '<div class="mn-loading"><i class="ri-loader-4-line"></i><span>正在拉取歌单...</span></div>' : ''}
        ${cache.created.length ? `<div class="mn-group-title">创建的歌单<em>${cache.created.length}</em></div>${cache.created.map(renderNeteasePlaylistRow).join('')}` : ''}
        ${cache.subscribed.length ? `<div class="mn-group-title">收藏的歌单<em>${cache.subscribed.length}</em></div>${cache.subscribed.map(renderNeteasePlaylistRow).join('')}` : ''}
    `;
}

// ---------- 歌单详情页 ----------

async function openNeteasePlaylist(type, playlistId, name) {
    neteaseCurrentPlaylist = { id: playlistId, name: name || '歌单', tracks: [], type, loading: true };
    switchNeteaseSection('playlist');
    renderNeteasePlaylistView();
    try {
        let tracks = [];
        if (type === 'liked') {
            tracks = await fetchNeteaseLikedTracks();
            if (!tracks.length && playlistId) tracks = await fetchNeteasePlaylistTracks(playlistId);
        } else {
            tracks = await fetchNeteasePlaylistTracks(playlistId);
        }
        if (!neteaseCurrentPlaylist || neteaseCurrentPlaylist.id !== playlistId) return;
        neteaseCurrentPlaylist.tracks = tracks;
        neteaseCurrentPlaylist.loading = false;
    } catch (e) {
        if (neteaseCurrentPlaylist) {
            neteaseCurrentPlaylist.loading = false;
            neteaseCurrentPlaylist.error = true;
        }
    }
    renderNeteasePlaylistView();
}
window.openNeteasePlaylist = openNeteasePlaylist;

function renderNeteasePlaylistView() {
    const titleEl = document.getElementById('mn-playlist-title');
    const box = document.getElementById('mn-playlist-body');
    if (!box) return;
    const pl = neteaseCurrentPlaylist;
    if (titleEl) titleEl.textContent = pl?.name || '歌单';
    if (!pl) { box.innerHTML = ''; return; }
    if (pl.loading) {
        box.innerHTML = '<div class="mn-loading"><i class="ri-loader-4-line"></i><span>正在加载歌曲...</span></div>';
        return;
    }
    if (pl.error || !pl.tracks.length) {
        box.innerHTML = '<div class="mn-loading"><i class="ri-emotion-sad-line"></i><span>没有拿到歌曲，回上一页重试。</span></div>';
        return;
    }
    const currentKey = getMusicTrackKey(musicTracks[musicCurrentIndex] || {});
    box.innerHTML = `
        <div class="mn-playlist-actions">
            <button type="button" class="mn-play-all" onclick="playNeteasePlaylistTrack(0)"><i class="ri-play-circle-fill"></i><span>播放全部</span><em>${pl.tracks.length}</em></button>
            <button type="button" class="mn-import-btn" onclick="importCurrentNeteasePlaylist()"><i class="ri-download-2-line"></i><span>导入到音乐</span></button>
        </div>
        ${pl.tracks.map((track, index) => {
            const active = getMusicTrackKey(track) === currentKey;
            return `
                <button type="button" class="mn-track-row${active ? ' active' : ''}" onclick="playNeteasePlaylistTrack(${index})">
                    <span class="mn-track-index">${active ? '<i class="ri-volume-up-fill"></i>' : index + 1}</span>
                    <span class="mn-playlist-meta">
                        <strong>${musicEscapeHtml(track.trackName)}</strong>
                        <em>${musicEscapeHtml(track.artistName)} · ${musicEscapeHtml(track.collectionName)}</em>
                    </span>
                    <i class="ri-play-fill"></i>
                </button>
            `;
        }).join('')}
    `;
}

function importCurrentNeteasePlaylist() {
    const pl = neteaseCurrentPlaylist;
    if (!pl || !pl.tracks.length) return;
    importNeteaseTracksToMusic(pl.type === 'liked' ? '网易云 · 我喜欢的音乐' : `网易云 · ${pl.name}`, pl.id || `liked_${getNeteaseAuth()?.profile?.userId || '0'}`, pl.tracks);
    const btn = document.querySelector('#mn-playlist-body .mn-import-btn');
    if (btn) {
        btn.classList.add('done');
        btn.innerHTML = `<i class="ri-check-line"></i><span>已导入 ${pl.tracks.length} 首，回主页可见</span>`;
        setTimeout(() => renderNeteasePlaylistView(), 2500);
    }
}
window.importCurrentNeteasePlaylist = importCurrentNeteasePlaylist;

function playNeteasePlaylistTrack(index) {
    const pl = neteaseCurrentPlaylist;
    if (!pl || !pl.tracks[index]) return;
    musicTracks = pl.tracks.map(normalizeMusicTrack);
    musicCurrentIndex = index;
    musicMainTab = 'home';
    musicAlbumFilter = '';
    renderMusicApp();
    neteasePlayerBackTo = 'playlist';
    switchNeteaseSection('player');
    neteasePlayerLyrics = { key: '', lines: [] };
    renderNeteasePlayer();
    selectMusicTrack(index, true);
    renderNeteasePlaylistView();
}
window.playNeteasePlaylistTrack = playNeteasePlaylistTrack;

// ---------- 黑胶播放页 ----------

function startNeteasePlayerTimer() {
    stopNeteasePlayerTimer();
    neteasePlayerTimer = setInterval(() => {
        const view = document.getElementById('music-netease-view');
        if (!view || view.classList.contains('hidden') || neteaseSection !== 'player') {
            stopNeteasePlayerTimer();
            return;
        }
        renderNeteasePlayerProgress();
    }, 500);
    renderNeteasePlayer();
}

function stopNeteasePlayerTimer() {
    clearInterval(neteasePlayerTimer);
    neteasePlayerTimer = null;
}

async function ensureNeteasePlayerLyrics(track) {
    const key = getMusicTrackKey(track);
    if (neteasePlayerLyrics.key === key) return;
    neteasePlayerLyrics = { key, lines: [] };
    if (track.sourceKey === 'netease' && track.remoteId) {
        const lyrics = await fetchNeteaseLyricLines(track.remoteId);
        if (lyrics && neteasePlayerLyrics.key === key) neteasePlayerLyrics.lines = lyrics.lines.filter(line => line.time != null);
        renderNeteasePlayerProgress();
    }
}

function renderNeteasePlayer() {
    const box = document.getElementById('mn-player-body');
    if (!box) return;
    const track = musicTracks[musicCurrentIndex];
    if (!track) {
        box.innerHTML = '<div class="mn-loading"><i class="ri-music-2-line"></i><span>还没有歌曲，回去挑一首。</span></div>';
        return;
    }
    const titleEl = document.getElementById('mn-player-title');
    const artistEl = document.getElementById('mn-player-artist');
    if (titleEl) titleEl.textContent = track.trackName;
    if (artistEl) artistEl.textContent = track.artistName;
    const cover = track.artworkUrl100
        ? `<img src="${musicEscapeAttr(track.artworkUrl100)}" alt="">`
        : '<i class="ri-music-2-fill"></i>';
    const favorite = typeof isMusicFavorite === 'function' && isMusicFavorite(track);
    box.innerHTML = `
        <div class="mn-vinyl-wrap">
            <div class="mn-vinyl-stylus${musicIsPlaying ? ' playing' : ''}"></div>
            <div class="mn-vinyl-disc${musicIsPlaying ? ' spinning' : ''}" id="mn-vinyl-disc">
                <span class="mn-vinyl-cover">${cover}</span>
            </div>
        </div>
        <div class="mn-player-lyric" id="mn-player-lyric">&nbsp;</div>
        <div class="mn-player-progress mn-wave-progress" id="mn-player-progress" onclick="seekNeteasePlayer(event)" aria-label="播放进度">
            ${renderNeteaseWaveBars(track)}
        </div>
        <div class="mn-player-times"><span id="mn-player-elapsed">0:00</span><span id="mn-player-duration">--:--</span></div>
        <div class="mn-player-controls">
            <button type="button" class="mn-heart${favorite ? ' active' : ''}" onclick="toggleNeteasePlayerFavorite()"><i class="${favorite ? 'ri-heart-3-fill' : 'ri-heart-3-line'}"></i></button>
            <button type="button" onclick="playPrevMusicTrack();renderNeteasePlayer();"><i class="ri-skip-back-fill"></i></button>
            <button type="button" class="mn-play-btn" onclick="toggleMusicPlayback();setTimeout(renderNeteasePlayer,200);"><i class="${musicIsPlaying ? 'ri-pause-fill' : 'ri-play-fill'}" id="mn-player-play-icon"></i></button>
            <button type="button" onclick="playNextMusicTrack();renderNeteasePlayer();"><i class="ri-skip-forward-fill"></i></button>
            <button type="button" onclick="closeNeteaseView()"><i class="ri-fullscreen-exit-line"></i></button>
        </div>
    `;
    ensureNeteasePlayerLyrics(track);
    renderNeteasePlayerProgress();
}
window.renderNeteasePlayer = renderNeteasePlayer;

function renderNeteaseWaveBars(track) {
    const count = 76;
    const seed = getNeteaseWaveSeed(track);
    return Array.from({ length: count }, (_, index) => {
        const height = getNeteaseWaveHeight(seed, index, count);
        return `<span class="mn-wave-bar" style="--bar-h:${height}px;--bar-i:${index}"></span>`;
    }).join('');
}

function getNeteaseWaveSeed(track) {
    const text = `${track?.trackName || ''}|${track?.artistName || ''}|${track?.remoteId || track?.id || ''}`;
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function getNeteaseWaveHeight(seed, index, count) {
    const position = (index + 0.5) / count;
    const envelope = Math.sin(position * Math.PI);
    const pulseA = Math.abs(Math.sin((seed % 97 + index * 11.73) * 0.19));
    const pulseB = Math.abs(Math.cos((seed % 53 + index * 5.91) * 0.37));
    const pulseC = Math.abs(Math.sin((seed % 31 + index * 2.17) * 0.53));
    const mix = (pulseA * 0.48) + (pulseB * 0.32) + (pulseC * 0.2);
    return Math.round(4 + (mix * 18 * envelope) + (envelope * 12));
}

function renderNeteasePlayerProgress() {
    const progress = document.getElementById('mn-player-progress');
    if (!progress) return;
    const track = musicTracks[musicCurrentIndex];
    const current = musicAudio && Number.isFinite(musicAudio.currentTime) ? musicAudio.currentTime : 0;
    const total = musicAudio && Number.isFinite(musicAudio.duration) && musicAudio.duration > 0
        ? musicAudio.duration
        : (track?.duration || 0);
    const percent = total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : 0;
    progress.style.setProperty('--wave-progress', `${percent}%`);
    progress.classList.toggle('is-playing', !!musicIsPlaying);
    const bars = progress.querySelectorAll('.mn-wave-bar');
    const activeCount = Math.round((percent / 100) * bars.length);
    bars.forEach((bar, index) => {
        bar.classList.toggle('active', index < activeCount);
        bar.classList.toggle('near', Math.abs(index - activeCount) <= 3);
    });
    const elapsed = document.getElementById('mn-player-elapsed');
    const duration = document.getElementById('mn-player-duration');
    if (elapsed) elapsed.textContent = formatMusicTime(current);
    if (duration) duration.textContent = total > 0 ? formatMusicTime(total) : '--:--';
    const disc = document.getElementById('mn-vinyl-disc');
    if (disc) disc.classList.toggle('spinning', !!musicIsPlaying);
    const stylus = document.querySelector('.mn-vinyl-stylus');
    if (stylus) stylus.classList.toggle('playing', !!musicIsPlaying);
    const playIcon = document.getElementById('mn-player-play-icon');
    if (playIcon) playIcon.className = musicIsPlaying ? 'ri-pause-fill' : 'ri-play-fill';
    const lyricEl = document.getElementById('mn-player-lyric');
    if (lyricEl && neteasePlayerLyrics.lines.length) {
        lyricEl.innerHTML = renderNeteaseLyricWindow(neteasePlayerLyrics.lines, current);
    }
}
window.renderNeteasePlayerProgress = renderNeteasePlayerProgress;

function renderNeteaseLyricWindow(lines, current) {
    const cleanLines = (Array.isArray(lines) ? lines : [])
        .filter(line => line && Number.isFinite(line.time) && String(line.text || '').trim());
    if (!cleanLines.length) return '<div class="mn-lyric-stack"><span class="mn-lyric-line active">&nbsp;</span></div>';
    let activeIndex = cleanLines.findIndex(line => line.time > current) - 1;
    if (activeIndex < 0) activeIndex = 0;
    const maxLines = 4;
    let start = Math.max(0, activeIndex - 1);
    let end = Math.min(cleanLines.length, start + maxLines);
    start = Math.max(0, end - maxLines);
    const rows = cleanLines.slice(start, end).map((line, offset) => {
        const index = start + offset;
        const state = index === activeIndex ? ' active' : (index < activeIndex ? ' passed' : ' next');
        return `<span class="mn-lyric-line${state}">${musicEscapeHtml(line.text)}</span>`;
    }).join('');
    return `<div class="mn-lyric-stack">${rows}</div>`;
}

function seekNeteasePlayer(event) {
    if (!musicAudio || !musicAudio.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    musicAudio.currentTime = musicAudio.duration * percent;
    renderNeteasePlayerProgress();
}
window.seekNeteasePlayer = seekNeteasePlayer;

function toggleNeteasePlayerFavorite() {
    if (typeof toggleMusicFavorite === 'function') toggleMusicFavorite();
    renderNeteasePlayer();
}
window.toggleNeteasePlayerFavorite = toggleNeteasePlayerFavorite;

// ---------- 与现有设置面板对接 ----------

(function hookMusicSettingsUI() {
    const origSync = window.syncMusicSourceUI;
    window.syncMusicSourceUI = function () {
        if (typeof origSync === 'function') origSync();
        const input = document.getElementById('music-netease-api-base');
        if (input) {
            const saved = localStorage.getItem(NETEASE_API_BASE_KEY) || '';
            input.value = shouldIgnoreLoopbackNeteaseBase(saved) ? '' : saved;
        }
        const proxyInput = document.getElementById('music-netease-audio-proxy-base');
        if (proxyInput) proxyInput.value = localStorage.getItem(NETEASE_AUDIO_PROXY_BASE_KEY) || '';
        renderNeteaseEntry();
    };
    const origSave = window.saveMusicSourceSettingsFromUI;
    window.saveMusicSourceSettingsFromUI = function () {
        const input = document.getElementById('music-netease-api-base');
        if (input) setNeteaseApiBase(input.value);
        const proxyInput = document.getElementById('music-netease-audio-proxy-base');
        if (proxyInput) setNeteaseAudioProxyBase(proxyInput.value);
        if (typeof origSave === 'function') origSave();
    };
})();

// 启动时刷新入口状态（脚本在 body 末尾加载，DOM 已就绪）
renderNeteaseEntry();
