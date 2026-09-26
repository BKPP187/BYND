// --- 音乐 App ---
const MUSIC_COMMENTS_KEY = 'bynd_music_comments_v1';
const MUSIC_FAVORITES_KEY = 'bynd_music_favorites_v1';
const MUSIC_CO_LISTEN_KEY = 'bynd_music_co_listen_v1';
const MUSIC_CO_LISTEN_CHAR_KEY = 'bynd_music_co_listen_char_v1';
const MUSIC_SOURCE_MODE_KEY = 'bynd_music_source_mode_v1';
const MUSIC_SOURCE_SETTINGS_KEY = 'bynd_music_source_settings_v1';
const MUSIC_PLAYLISTS_KEY = 'bynd_music_playlists_v1';
const MUSIC_LIBRARY_STATE_KEY = 'bynd_music_library_state_v1';
const MUSIC_SOURCE_DEFAULTS = {
    metingBases: [
        'https://meting.mikus.ink/api',
        'https://meting.elysium-stack.cn/api'
    ],
    goApiBase: ''
};
const MUSIC_PLATFORM_LABELS = {
    smart: '多源',
    netease: '网易云',
    archive: '公开曲库',
    local: '本地'
};
const MUSIC_PLATFORM_ORDER = ['netease'];
const MUSIC_FALLBACK_TRACKS = [
    {
        id: 'archive:GeorgeFridericHandelHallelujah:Handel__Messiah__44_Hallelujah.mp3',
        trackName: 'Hallelujah Chorus',
        artistName: 'George Frideric Handel',
        collectionName: 'Messiah',
        artworkUrl100: 'https://archive.org/services/img/GeorgeFridericHandelHallelujah',
        audioUrl: 'https://archive.org/download/GeorgeFridericHandelHallelujah/Handel__Messiah__44_Hallelujah.mp3',
        trackViewUrl: 'https://archive.org/details/GeorgeFridericHandelHallelujah',
        primaryGenreName: 'Classical',
        sourceName: 'Internet Archive'
    },
    {
        id: 'archive:CanonInD-Pachelbel:07CanonPachelbel.m4a',
        trackName: 'Canon in D',
        artistName: 'Johann Pachelbel',
        collectionName: 'Public Domain Recording',
        artworkUrl100: 'https://archive.org/services/img/CanonInD-Pachelbel',
        audioUrl: 'https://archive.org/download/CanonInD-Pachelbel/07CanonPachelbel.m4a',
        trackViewUrl: 'https://archive.org/details/CanonInD-Pachelbel',
        primaryGenreName: 'Classical',
        sourceName: 'Internet Archive'
    }
];
const MUSIC_PLACEHOLDER_TRACK = {
    id: 'placeholder:bynd-music',
    trackName: '暂无播放',
    artistName: '搜索或导入音乐',
    collectionName: 'BYND Music',
    artworkUrl100: '',
    audioUrl: '',
    trackViewUrl: '',
    primaryGenreName: 'Music',
    sourceName: '音乐'
};

let musicAudio = null;
let musicTracks = [];
let musicCurrentIndex = 0;
let musicIsPlaying = false;
let musicSearchTimer = null;
let musicProgressTimer = null;
let musicLyricsCache = {};
let musicDetailTab = 'lyrics';
let musicMainTab = 'home';
let musicAlbumFilter = '';
let musicShuffleEnabled = false;
let musicRepeatMode = 'all';
let musicCoListening = false;
let musicCoListenBusy = false;
let musicAiMessages = [];
let musicActiveLyricIndex = -1;
let musicCoListenLastTrackKey = '';
let musicCoListenCharId = localStorage.getItem(MUSIC_CO_LISTEN_CHAR_KEY) || '';

function musicEscapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function musicEscapeAttr(value) {
    return musicEscapeHtml(value).replace(/`/g, '&#96;');
}

function getMusicArtwork(track) {
    return track?.artworkUrl100 || track?.artwork || '';
}

function normalizeMetingAsset(value) {
    if (!value) return '';
    const text = String(value).trim();
    return /^https?:\/\//i.test(text) ? text.replace(/^http:\/\//i, 'https://') : '';
}

function getFallbackCover() {
    return `
        <div class="music-cover-fallback">
            <i class="ri-disc-line"></i>
            <span>BYND</span>
        </div>
    `;
}

function normalizeMusicTrack(track) {
    return {
        id: track.id || `music_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        trackName: track.trackName || track.title || track.collectionName || 'Untitled',
        artistName: track.artistName || track.creator || 'Unknown Artist',
        collectionName: track.collectionName || track.album || track.primaryGenreName || 'Full track',
        artworkUrl100: track.artworkUrl100 || '',
        audioUrl: track.audioUrl || '',
        trackViewUrl: track.trackViewUrl || '',
        lyricsUrl: track.lyricsUrl || '',
        lyricsText: track.lyricsText || '',
        remoteId: track.remoteId || track.songId || '',
        sourceKey: track.sourceKey || '',
        sourceMeta: track.sourceMeta || '',
        primaryGenreName: track.primaryGenreName || 'Archive Audio',
        sourceName: track.sourceName || 'Internet Archive',
        duration: track.duration || null
    };
}

function getMusicPlaceholderTrack() {
    return normalizeMusicTrack(MUSIC_PLACEHOLDER_TRACK);
}

function isMusicFallbackTrack(track) {
    const id = String(track?.id || '');
    if (id === MUSIC_PLACEHOLDER_TRACK.id) return true;
    return MUSIC_FALLBACK_TRACKS.some(item => String(item.id || '') === id);
}

function getUserMusicTracks() {
    return (Array.isArray(musicTracks) ? musicTracks : []).filter(track => track && !isMusicFallbackTrack(track));
}

function getUserMusicTrackEntries() {
    return (Array.isArray(musicTracks) ? musicTracks : [])
        .map((track, index) => ({ track, index }))
        .filter(item => item.track && !isMusicFallbackTrack(item.track));
}

function getPersistableMusicTracks() {
    return (Array.isArray(musicTracks) ? musicTracks : [])
        .filter(track => track && !isMusicFallbackTrack(track))
        .map(track => normalizeMusicTrack(track))
        .slice(0, 500);
}

function saveMusicLibraryState(source = 'music') {
    try {
        const tracks = getPersistableMusicTracks();
        if (!tracks.length) return;
        const currentKey = getMusicTrackKey(musicTracks[musicCurrentIndex]);
        const currentIndex = Math.max(0, tracks.findIndex(track => getMusicTrackKey(track) === currentKey));
        localStorage.setItem(MUSIC_LIBRARY_STATE_KEY, JSON.stringify({
            tracks,
            currentIndex,
            mainTab: musicMainTab,
            albumFilter: musicAlbumFilter,
            source,
            updatedAt: Date.now()
        }));
    } catch (e) {}
}
window.saveMusicLibraryState = saveMusicLibraryState;

function restoreMusicLibraryState() {
    try {
        const state = JSON.parse(localStorage.getItem(MUSIC_LIBRARY_STATE_KEY) || 'null');
        const tracks = Array.isArray(state?.tracks)
            ? state.tracks.map(normalizeMusicTrack).filter(track => track && !isMusicFallbackTrack(track))
            : [];
        if (!tracks.length) return false;
        musicTracks = tracks;
        const index = Number(state.currentIndex);
        musicCurrentIndex = Number.isFinite(index) ? Math.min(Math.max(0, index), musicTracks.length - 1) : 0;
        if (['home', 'search', 'albums', 'favorites'].includes(state.mainTab)) musicMainTab = state.mainTab;
        musicAlbumFilter = state.albumFilter ? String(state.albumFilter) : '';
        return true;
    } catch (e) {
        return false;
    }
}

function loadMusicSourceSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(MUSIC_SOURCE_SETTINGS_KEY) || '{}') || {};
        const metingBases = Array.isArray(saved.metingBases) ? saved.metingBases : String(saved.metingBases || '').split(/\n|,/);
        return {
            metingBases: metingBases.map(url => cleanMusicBaseUrl(url)).filter(Boolean),
            goApiBase: cleanMusicBaseUrl(saved.goApiBase || '')
        };
    } catch (e) {
        return { ...MUSIC_SOURCE_DEFAULTS };
    }
}

function getMusicSourceSettings() {
    const settings = loadMusicSourceSettings();
    if (!settings.metingBases.length) settings.metingBases = [...MUSIC_SOURCE_DEFAULTS.metingBases];
    return settings;
}

function cleanMusicBaseUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

function getMusicSourceMode() {
    const mode = localStorage.getItem(MUSIC_SOURCE_MODE_KEY) || 'smart';
    return MUSIC_PLATFORM_LABELS[mode] ? mode : 'smart';
}

function setMusicSourceMode(mode) {
    const nextMode = MUSIC_PLATFORM_LABELS[mode] ? mode : 'smart';
    localStorage.setItem(MUSIC_SOURCE_MODE_KEY, nextMode);
    syncMusicSourceUI();
    const input = document.getElementById('music-search-input');
    searchMusic(input?.value || '周杰伦');
}
window.setMusicSourceMode = setMusicSourceMode;

function toggleMusicSourceConfig() {
    const panel = document.getElementById('music-source-config');
    if (!panel) return;
    panel.classList.toggle('hidden');
    syncMusicSourceUI();
}
window.toggleMusicSourceConfig = toggleMusicSourceConfig;

function syncMusicSourceUI() {
    const mode = getMusicSourceMode();
    document.querySelectorAll('#music-source-chips button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.source === mode);
    });
    const settings = getMusicSourceSettings();
    const metingInput = document.getElementById('music-meting-bases');
    const goInput = document.getElementById('music-go-api-base');
    if (metingInput) metingInput.value = settings.metingBases.join('\n');
    if (goInput) goInput.value = settings.goApiBase || '';
    renderMusicImportedPlaylists();
}

function saveMusicSourceSettingsFromUI() {
    const metingBases = String(document.getElementById('music-meting-bases')?.value || '')
        .split(/\n|,/)
        .map(url => cleanMusicBaseUrl(url))
        .filter(Boolean);
    const settings = {
        metingBases,
        goApiBase: cleanMusicBaseUrl(document.getElementById('music-go-api-base')?.value || '')
    };
    localStorage.setItem(MUSIC_SOURCE_SETTINGS_KEY, JSON.stringify(settings));
    syncMusicSourceUI();
    const input = document.getElementById('music-search-input');
    searchMusic(input?.value || '周杰伦');
}
window.saveMusicSourceSettingsFromUI = saveMusicSourceSettingsFromUI;

function getMusicPlaylistsStore() {
    try {
        const list = JSON.parse(localStorage.getItem(MUSIC_PLAYLISTS_KEY) || '[]');
        return Array.isArray(list) ? list.filter(item => item && item.id) : [];
    } catch (e) {
        return [];
    }
}

function saveMusicPlaylistsStore(list) {
    localStorage.setItem(MUSIC_PLAYLISTS_KEY, JSON.stringify(Array.isArray(list) ? list.slice(0, 30) : []));
}

function renderMusicImportedPlaylists() {
    const el = document.getElementById('music-imported-playlists');
    if (!el) return;
    const list = getMusicPlaylistsStore();
    if (!list.length) {
        el.innerHTML = '<div class="music-import-empty">还没有导入歌单，粘贴网易云歌单链接或纯数字 ID 试试。</div>';
        return;
    }
    el.innerHTML = list.map(item => `
        <div class="music-import-row">
            <button type="button" onclick="loadImportedMusicPlaylist('${musicEscapeAttr(item.id)}')">
                <i class="ri-play-list-2-line"></i>
                <span>${musicEscapeHtml(item.name || item.platformLabel || '导入歌单')}</span>
                <em>${musicEscapeHtml(item.platformLabel || '')} · ${Array.isArray(item.tracks) ? item.tracks.length : 0} 首</em>
            </button>
            <i class="ri-close-line" onclick="deleteImportedMusicPlaylist('${musicEscapeAttr(item.id)}')"></i>
        </div>
    `).join('');
}

function extractMusicPlaylistInfo(raw, fallbackPlatform) {
    const text = String(raw || '').trim();
    const platform = fallbackPlatform || 'netease';
    let id = '';
    const patterns = [
        /[?&]id=(\d+)/i,
        /playlist[/?#]+(?:id=)?(\d+)/i,
        /songlist[/?#]+(\d+)/i,
        /specialid=(\d+)/i,
        /\/(\d{5,})(?:[/?#]|$)/
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) { id = match[1]; break; }
    }
    if (!id && /^\d{4,}$/.test(text)) id = text;
    return { platform, id, raw: text };
}

async function importMusicPlaylist() {
    const input = document.getElementById('music-playlist-url');
    const select = document.getElementById('music-playlist-platform');
    const info = extractMusicPlaylistInfo(input?.value || '', select?.value || 'netease');
    if (!info.id) {
        showMusicStatus('没有识别到歌单 ID，换成完整歌单链接或纯数字 ID。');
        return;
    }
    showMusicStatus('正在导入歌单...');
    try {
        let tracks = await fetchCustomMusicPlaylist(info.platform, info.id);
        if (!tracks.length) tracks = await fetchMetingPlaylist(info.platform, info.id);
        if (!tracks.length) throw new Error('empty playlist');
        const platformLabel = MUSIC_PLATFORM_LABELS[info.platform] || info.platform;
        const item = {
            id: `playlist_${info.platform}_${info.id}`,
            platform: info.platform,
            platformLabel,
            playlistId: info.id,
            name: `${platformLabel}歌单 ${info.id}`,
            sourceUrl: info.raw,
            tracks: tracks.slice(0, 80),
            createdAt: Date.now()
        };
        const list = getMusicPlaylistsStore().filter(row => row.id !== item.id);
        list.unshift(item);
        saveMusicPlaylistsStore(list);
        if (input) input.value = '';
        musicTracks = item.tracks.map(normalizeMusicTrack);
        musicCurrentIndex = 0;
        musicMainTab = 'home';
        musicAlbumFilter = '';
        closeMusicDetail();
        saveMusicLibraryState('playlist-import');
        renderMusicApp();
        renderMusicImportedPlaylists();
        showMusicStatus(`已导入 ${platformLabel} 歌单，${musicTracks.length} 首。`);
    } catch (e) {
        showMusicStatus('导入失败：当前公开 Meting 源没有返回可播放音频，换个源或接自己的后端。');
    }
}
window.importMusicPlaylist = importMusicPlaylist;

async function fetchMetingPlaylist(platform, playlistId) {
    const settings = getMusicSourceSettings();
    const bases = settings.metingBases?.length ? settings.metingBases : MUSIC_SOURCE_DEFAULTS.metingBases;
    const settled = await Promise.allSettled(bases.map(async base => {
        const params = new URLSearchParams({ server: platform, type: 'playlist', id: String(playlistId) });
        const json = await fetchJsonWithTimeout(`${base}?${params.toString()}`, {}, 10000);
        const rows = extractMusicRows(json).slice(0, 40);
        const hydrated = await Promise.allSettled(rows.map(item => hydrateMetingTrack(base, platform, item)));
        return hydrated.flatMap(item => item.status === 'fulfilled' && item.value ? [item.value] : []);
    }));
    return dedupeMusicTracks(settled.flatMap(item => item.status === 'fulfilled' ? item.value : []));
}

async function fetchCustomMusicPlaylist(platform, playlistId) {
    const settings = getMusicSourceSettings();
    if (settings.goApiBase) {
        const base = settings.goApiBase;
        const urls = [
            `${base}/playlist?${new URLSearchParams({ id: String(playlistId), source: platform }).toString()}`,
            `${base}/api/playlist?${new URLSearchParams({ id: String(playlistId), platform }).toString()}`,
            `${base}/music/playlist?${new URLSearchParams({ id: String(playlistId), platform }).toString()}`
        ];
        for (const url of urls) {
            try {
                const json = await fetchJsonWithTimeout(url, {}, 10000);
                const rows = extractMusicRows(json).slice(0, 80);
                const tracks = rows.map(item => normalizeGenericMusicTrack(item, platform, '聚合歌单')).filter(track => track.audioUrl);
                if (tracks.length) return dedupeMusicTracks(tracks);
            } catch (e) {}
        }
    }

    return [];
}

function loadImportedMusicPlaylist(id) {
    const item = getMusicPlaylistsStore().find(row => row.id === id);
    if (!item || !Array.isArray(item.tracks)) return;
    musicTracks = item.tracks.map(normalizeMusicTrack);
    musicCurrentIndex = 0;
    musicMainTab = 'home';
    musicAlbumFilter = '';
    closeMusicDetail();
    saveMusicLibraryState('playlist-open');
    renderMusicApp();
    showMusicStatus(`已打开歌单：${item.name || item.platformLabel || '导入歌单'}`);
}
window.loadImportedMusicPlaylist = loadImportedMusicPlaylist;

function deleteImportedMusicPlaylist(id) {
    saveMusicPlaylistsStore(getMusicPlaylistsStore().filter(item => item.id !== id));
    renderMusicImportedPlaylists();
}
window.deleteImportedMusicPlaylist = deleteImportedMusicPlaylist;

function initMusicApp() {
    const win = document.getElementById('app-music-window');
    if (!win || win.dataset.ready === '1') return;
    win.dataset.ready = '1';
    if (!restoreMusicLibraryState()) {
        musicTracks = [];
        musicCurrentIndex = 0;
    }
    syncMusicSourceUI();
    const input = document.getElementById('music-search-input');
    if (input) input.value = '';
    renderMusicApp();
}

function renderMusicApp() {
    renderMusicNowPlaying();
    renderMusicMainTab();
    renderMusicDetail();
    updateMusicProgress();
}

function renderMusicNowPlaying() {
    const track = musicTracks[musicCurrentIndex] || getMusicPlaceholderTrack();
    const cover = document.getElementById('music-now-cover');
    const title = document.getElementById('music-now-title');
    const artist = document.getElementById('music-now-artist');
    const album = document.getElementById('music-now-album');
    const playIcon = document.getElementById('music-play-icon');
    const detailPlayIcon = document.getElementById('music-detail-play-icon');
    const source = document.getElementById('music-source-link');
    const win = document.getElementById('app-music-window');
    const artwork = getMusicArtwork(track);

    if (win) win.classList.toggle('is-playing', musicIsPlaying);
    if (cover) {
        cover.innerHTML = artwork
            ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(track.trackName)}" onerror="this.parentElement.innerHTML=getFallbackCover()">`
            : getFallbackCover();
    }
    if (title) title.textContent = track.trackName;
    if (artist) artist.textContent = track.artistName;
    if (album) album.textContent = track.collectionName || track.primaryGenreName || track.sourceName;
    if (playIcon) playIcon.className = musicIsPlaying ? 'ri-pause-fill' : 'ri-play-fill';
    if (detailPlayIcon) detailPlayIcon.className = musicIsPlaying ? 'ri-pause-fill' : 'ri-play-fill';
    if (source) {
        source.textContent = track.sourceName || 'Source';
        source.classList.remove('hidden');
        source.removeAttribute('href');
        source.removeAttribute('target');
        source.onclick = event => event.preventDefault();
    }
    updateMusicFavoriteButton();
    syncMusicPlaybackModeButtons();
    updateMusicProgress();
}

function syncMusicPlaybackModeButtons() {
    const shuffleBtn = document.getElementById('music-shuffle-btn');
    const repeatBtn = document.getElementById('music-repeat-btn');
    if (shuffleBtn) {
        shuffleBtn.classList.toggle('active', musicShuffleEnabled);
        shuffleBtn.setAttribute('aria-pressed', musicShuffleEnabled ? 'true' : 'false');
    }
    if (repeatBtn) {
        const icon = repeatBtn.querySelector('i');
        const isActive = musicRepeatMode !== 'off';
        repeatBtn.dataset.mode = musicRepeatMode;
        repeatBtn.classList.toggle('active', isActive);
        repeatBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        repeatBtn.setAttribute('aria-label', musicRepeatMode === 'one'
            ? '单曲循环'
            : (musicRepeatMode === 'off' ? '顺序播放' : '列表循环'));
        if (icon) icon.className = musicRepeatMode === 'one' ? 'ri-repeat-one-line' : 'ri-repeat-line';
    }
}

function toggleMusicShuffle() {
    musicShuffleEnabled = !musicShuffleEnabled;
    syncMusicPlaybackModeButtons();
}
window.toggleMusicShuffle = toggleMusicShuffle;

function toggleMusicRepeatMode() {
    musicRepeatMode = musicRepeatMode === 'all' ? 'one' : (musicRepeatMode === 'one' ? 'off' : 'all');
    syncMusicPlaybackModeButtons();
}
window.toggleMusicRepeatMode = toggleMusicRepeatMode;

function switchMusicMainTab(tab) {
    musicMainTab = ['home', 'search', 'albums', 'favorites'].includes(tab) ? tab : 'home';
    closeMusicOverlayForMainTab();
    if (musicMainTab !== 'albums') musicAlbumFilter = '';
    syncMusicMainTabs();
    renderMusicMainTab();
    if (musicMainTab === 'search') {
        setTimeout(() => document.getElementById('music-search-input')?.focus(), 60);
    }
}
window.switchMusicMainTab = switchMusicMainTab;

function closeMusicOverlayForMainTab() {
    const neteaseView = document.getElementById('music-netease-view');
    if (neteaseView && !neteaseView.classList.contains('hidden')) {
        if (typeof window.closeNeteaseView === 'function') window.closeNeteaseView();
        else neteaseView.classList.add('hidden');
    }
}

function ensureMusicConceptNav() {
    const bar = document.querySelector('#app-music-window .music-bottom-nav');
    if (!bar || bar.dataset.conceptNav === '1') return;
    bar.dataset.conceptNav = '1';
    bar.innerHTML = `
        <button type="button" data-music-tab="home" onclick="switchMusicMainTab('home')"><i class="ri-home-5-fill"></i><span>首页</span></button>
        <button type="button" data-music-tab="search" onclick="switchMusicMainTab('search')"><i class="ri-search-line"></i><span>搜索</span></button>
        <button type="button" data-music-tab="albums" onclick="switchMusicMainTab('albums')"><i class="ri-album-line"></i><span>曲库</span></button>
        <button type="button" data-music-tab="favorites" onclick="switchMusicMainTab('favorites')"><i class="ri-fire-line"></i><span>热榜</span></button>
    `;
}

function syncMusicMainTabs() {
    ensureMusicConceptNav();
    const win = document.getElementById('app-music-window');
    if (win) win.dataset.musicTab = musicMainTab;
    document.querySelectorAll('.music-bottom-nav button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.musicTab === musicMainTab);
    });
}

function renderMusicMainTab() {
    syncMusicMainTabs();
    const title = document.querySelector('.music-list-title strong');
    if (title) {
        title.textContent = musicMainTab === 'albums'
            ? (musicAlbumFilter || '专辑')
            : (musicMainTab === 'favorites' ? 'Hotlist' : (musicMainTab === 'search' ? 'Search' : 'Now Playing'));
    }
    if (musicMainTab === 'albums') {
        renderMusicAlbums();
    } else if (musicMainTab === 'favorites') {
        renderMusicFavorites();
    } else {
        renderMusicList();
    }
}

function renderMusicHomePlaylists() {
    const list = getMusicPlaylistsStore();
    if (!list.length) return '';
    return `
        <div class="music-home-playlists">
            <div class="music-home-playlists-title">我的歌单<em>${list.length}</em></div>
            ${list.map(item => `
                <button type="button" class="music-home-playlist-row" onclick="loadImportedMusicPlaylist('${musicEscapeAttr(item.id)}')">
                    <i class="ri-play-list-2-line"></i>
                    <span>${musicEscapeHtml(item.name || item.platformLabel || '导入歌单')}</span>
                    <em>${Array.isArray(item.tracks) ? item.tracks.length : 0} 首</em>
                </button>
            `).join('')}
        </div>
    `;
}

function renderMusicList() {
    const list = document.getElementById('music-track-list');
    if (!list) return;
    const entries = getUserMusicTrackEntries();
    if (!entries.length) {
        list.innerHTML = `${renderMusicHomePlaylists()}<div class="music-empty-state"><strong>没有搜索结果</strong><span>换个歌名、歌手或切换音乐源试试。</span></div>`;
        return;
    }
    list.innerHTML = renderMusicHomePlaylists() + entries.map(({ track, index }) => {
        const artwork = getMusicArtwork(track);
        const liked = isMusicFavorite(track);
        return `
            <button type="button" class="music-track-item ${index === musicCurrentIndex ? 'active' : ''}" onclick="openMusicDetail(${index})">
                <div class="music-track-art">
                    ${artwork ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(track.trackName)}" onerror="this.remove()">` : '<i class="ri-music-2-line"></i>'}
                </div>
                <div class="music-track-meta">
                    <strong>${musicEscapeHtml(track.trackName)}</strong>
                    <span>${musicEscapeHtml(track.artistName)} · ${musicEscapeHtml(track.sourceName || 'Full audio')}</span>
                </div>
                <i class="${liked ? 'ri-heart-3-fill' : (index === musicCurrentIndex && musicIsPlaying ? 'ri-volume-up-line' : 'ri-arrow-right-s-line')}"></i>
            </button>
        `;
    }).join('');
}

function renderMusicAlbums() {
    const list = document.getElementById('music-track-list');
    if (!list) return;
    const libraryEntries = getUserMusicTrackEntries();
    if (musicAlbumFilter) {
        const rows = libraryEntries
            .filter(item => (item.track.collectionName || '未命名专辑') === musicAlbumFilter);
        list.innerHTML = `
            <button type="button" class="music-album-back" onclick="closeMusicAlbum()">
                <i class="ri-arrow-left-s-line"></i><span>返回专辑列表</span>
            </button>
            ${rows.map(({ track, index }) => renderMusicTrackRow(track, index, false)).join('') || '<div class="music-empty-state"><strong>这张专辑还没有歌曲</strong></div>'}
        `;
        return;
    }

    const groups = new Map();
    libraryEntries.forEach(({ track, index }) => {
        const name = track.collectionName || '未命名专辑';
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push({ track, index });
    });
    if (!groups.size) {
        list.innerHTML = '<div class="music-empty-state"><strong>还没有专辑</strong><span>先搜索几首歌，专辑会自动聚合。</span></div>';
        return;
    }
    list.innerHTML = Array.from(groups.entries()).map(([name, items]) => {
        const first = items[0]?.track || {};
        const artwork = getMusicArtwork(first);
        const artists = Array.from(new Set(items.map(item => item.track.artistName).filter(Boolean))).slice(0, 2).join(' / ');
        const action = items.length === 1
            ? `openMusicDetail(${items[0].index})`
            : `openMusicAlbum(this.dataset.album)`;
        return `
            <button type="button" class="music-album-item" data-album="${musicEscapeAttr(name)}" onclick="${action}">
                <div class="music-album-art">${artwork ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(name)}" onerror="this.remove()">` : '<i class="ri-album-line"></i>'}</div>
                <div class="music-track-meta">
                    <strong>${musicEscapeHtml(name)}</strong>
                    <span>${musicEscapeHtml(artists || first.sourceName || 'Album')} · ${items.length} 首</span>
                </div>
                <i class="ri-arrow-right-s-line"></i>
            </button>
        `;
    }).join('');
}

function openMusicAlbum(name) {
    musicAlbumFilter = String(name || '');
    renderMusicMainTab();
}
window.openMusicAlbum = openMusicAlbum;

function closeMusicAlbum() {
    musicAlbumFilter = '';
    renderMusicMainTab();
}
window.closeMusicAlbum = closeMusicAlbum;

function renderMusicTrackRow(track, index, playDirect = false) {
    const artwork = getMusicArtwork(track);
    const liked = isMusicFavorite(track);
    const action = playDirect ? `playMusicTrackFromAlbum(${index})` : `openMusicDetail(${index})`;
    return `
        <button type="button" class="music-track-item ${index === musicCurrentIndex ? 'active' : ''}" onclick="${action}">
            <div class="music-track-art">
                ${artwork ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(track.trackName)}" onerror="this.remove()">` : '<i class="ri-music-2-line"></i>'}
            </div>
            <div class="music-track-meta">
                <strong>${musicEscapeHtml(track.trackName)}</strong>
                <span>${musicEscapeHtml(track.artistName)} · ${musicEscapeHtml(track.sourceName || 'Full audio')}</span>
            </div>
            <i class="${liked ? 'ri-heart-3-fill' : (playDirect ? 'ri-play-circle-line' : 'ri-arrow-right-s-line')}"></i>
        </button>
    `;
}

function playMusicTrackFromAlbum(index) {
    if (!musicTracks[index]) return;
    selectMusicTrack(index, true);
}
window.playMusicTrackFromAlbum = playMusicTrackFromAlbum;

function getMusicFavoritesStore() {
    try {
        return JSON.parse(localStorage.getItem(MUSIC_FAVORITES_KEY) || '[]') || [];
    } catch (e) {
        return [];
    }
}

function saveMusicFavoritesStore(list) {
    localStorage.setItem(MUSIC_FAVORITES_KEY, JSON.stringify(Array.isArray(list) ? list : []));
}

function getMusicTrackKey(track) {
    if (!track) return '';
    return `${track.remoteId || track.id || ''}|${track.audioUrl || ''}|${track.trackName || ''}|${track.artistName || ''}`.toLowerCase();
}

function isMusicFavorite(track) {
    const key = getMusicTrackKey(track);
    if (!key) return false;
    return getMusicFavoritesStore().some(item => getMusicTrackKey(item) === key);
}

function toggleMusicFavorite() {
    const track = musicTracks[musicCurrentIndex];
    if (!track) return;
    const key = getMusicTrackKey(track);
    const store = getMusicFavoritesStore();
    const index = store.findIndex(item => getMusicTrackKey(item) === key);
    if (index >= 0) {
        store.splice(index, 1);
        showMusicStatus('已取消收藏。');
    } else {
        store.unshift({ ...track, favoritedAt: Date.now() });
        showMusicStatus('已加入收藏。');
    }
    saveMusicFavoritesStore(store.slice(0, 120));
    updateMusicFavoriteButton();
    renderMusicMainTab();
}
window.toggleMusicFavorite = toggleMusicFavorite;

function openCurrentMusicDetail() {
    if (!getUserMusicTracks().length) {
        showMusicStatus('还没有歌曲，先搜索或导入音乐。');
        return;
    }
    openMusicDetail(musicCurrentIndex);
}
window.openCurrentMusicDetail = openCurrentMusicDetail;

function renderMusicFavorites() {
    const list = document.getElementById('music-track-list');
    if (!list) return;
    const favorites = getMusicFavoritesStore().map(normalizeMusicTrack);
    if (!favorites.length) {
        list.innerHTML = '<div class="music-empty-state"><strong>还没有收藏</strong><span>在歌词页面点收藏，喜欢的歌会留在这里。</span></div>';
        return;
    }
    list.innerHTML = favorites.map((track, index) => {
        const artwork = getMusicArtwork(track);
        return `
            <button type="button" class="music-track-item" onclick="openFavoriteMusicTrack(${index})">
                <div class="music-track-art">${artwork ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(track.trackName)}" onerror="this.remove()">` : '<i class="ri-heart-3-line"></i>'}</div>
                <div class="music-track-meta">
                    <strong>${musicEscapeHtml(track.trackName)}</strong>
                    <span>${musicEscapeHtml(track.artistName)} · ${musicEscapeHtml(track.collectionName || track.sourceName || '收藏')}</span>
                </div>
                <i class="ri-arrow-right-s-line"></i>
            </button>
        `;
    }).join('');
}

function openFavoriteMusicTrack(index) {
    const track = getMusicFavoritesStore().map(normalizeMusicTrack)[index];
    if (!track) return;
    const existingIndex = musicTracks.findIndex(item => getMusicTrackKey(item) === getMusicTrackKey(track));
    if (existingIndex >= 0) {
        openMusicDetail(existingIndex);
        return;
    }
    musicTracks.unshift(track);
    openMusicDetail(0);
}
window.openFavoriteMusicTrack = openFavoriteMusicTrack;

function getCurrentMusicTrack() {
    const track = musicTracks[musicCurrentIndex];
    return track ? { ...track } : null;
}
window.getCurrentMusicTrack = getCurrentMusicTrack;

function getMusicLibraryTracks() {
    return getUserMusicTracks().map(track => ({ ...track }));
}
window.getMusicLibraryTracks = getMusicLibraryTracks;

function selectMusicTrack(index, autoplay) {
    if (!musicTracks[index]) return;
    const prevKey = getMusicTrackKey(musicTracks[musicCurrentIndex]);
    musicCurrentIndex = index;
    const track = musicTracks[musicCurrentIndex];
    const nextKey = getMusicTrackKey(track);
    if (prevKey !== nextKey) {
        musicActiveLyricIndex = -1;
        musicCoListenLastTrackKey = '';
    }
    if (!musicAudio) setupMusicAudio();
    if (track.audioUrl && musicAudio.src !== track.audioUrl) {
        musicAudio.src = track.audioUrl;
        musicAudio.load();
    } else if (!track.audioUrl) {
        musicAudio.removeAttribute('src');
        musicAudio.load();
    }
    musicIsPlaying = false;
    saveMusicLibraryState('select');
    renderMusicApp();
    if (autoplay) toggleMusicPlayback(true);
}
window.selectMusicTrack = selectMusicTrack;

function setupMusicAudio() {
    if (musicAudio) return;
    musicAudio = new Audio();
    musicAudio.preload = 'metadata';
    musicAudio.addEventListener('play', () => {
        musicIsPlaying = true;
        startMusicProgressTimer();
        renderMusicNowPlaying();
        renderMusicMainTab();
        if (typeof window.renderNeteasePlayerProgress === 'function') window.renderNeteasePlayerProgress();
    });
    musicAudio.addEventListener('pause', () => {
        musicIsPlaying = false;
        renderMusicNowPlaying();
        renderMusicMainTab();
        if (typeof window.renderNeteasePlayerProgress === 'function') window.renderNeteasePlayerProgress();
    });
    musicAudio.addEventListener('loadedmetadata', updateMusicProgress);
    musicAudio.addEventListener('ended', handleMusicEnded);
    musicAudio.addEventListener('timeupdate', updateMusicProgress);
}

function toggleMusicPlayback(forcePlay) {
    const track = musicTracks[musicCurrentIndex];
    if (!track) return;
    if (!track.audioUrl) {
        if (track.sourceKey === 'netease' && track.remoteId && typeof window.resolveAndPlayNeteaseMusic === 'function') {
            window.resolveAndPlayNeteaseMusic(track, true);
            return;
        }
        showMusicStatus('这条结果没有可播放的完整音频，换一首试试。');
        return;
    }
    setupMusicAudio();
    if (musicAudio.src !== track.audioUrl) {
        musicAudio.src = track.audioUrl;
        musicAudio.load();
    }
    if (forcePlay || musicAudio.paused) {
        musicAudio.play().catch(() => showMusicStatus('浏览器拦截了播放，点一下播放键再试。'));
        if (musicCoListening) queueMusicAiReaction('play');
    } else {
        musicAudio.pause();
    }
}
window.toggleMusicPlayback = toggleMusicPlayback;


function startMusicCoListenFromWechat(trackData, charId, options = {}) {
    const track = normalizeMusicTrack({
        ...trackData,
        trackName: trackData?.trackName || trackData?.title || '\u4e00\u8d77\u542c\u6b4c',
        artistName: trackData?.artistName || trackData?.artist || 'Unknown Artist',
        artworkUrl100: trackData?.artworkUrl100 || trackData?.artwork || '',
        audioUrl: trackData?.audioUrl || trackData?.playableUrl || trackData?.url || '',
        sourceName: trackData?.sourceName || '\u5fae\u4fe1\u97f3\u4e50'
    });
    if (!track.audioUrl) return false;
    const char = (window.myCharacters || []).find(item => item && item.id === charId);
    if (char) {
        musicCoListenCharId = char.id;
        localStorage.setItem(MUSIC_CO_LISTEN_CHAR_KEY, char.id);
    }
    const existingIndex = musicTracks.findIndex(item => getMusicTrackKey(item) === getMusicTrackKey(track));
    if (existingIndex >= 0) musicCurrentIndex = existingIndex;
    else {
        musicTracks.unshift(track);
        musicCurrentIndex = 0;
    }
    saveMusicLibraryState('wechat-co-listen');
    musicCoListening = true;
    musicCoListenLastTrackKey = '';
    setupMusicAudio();
    if (musicAudio.src !== track.audioUrl) {
        musicAudio.src = track.audioUrl;
        musicAudio.load();
    }
    renderMusicApp();
    if (options.autoplay) toggleMusicPlayback(true);
    if (options.queueAi) queueMusicAiReaction(options.reason || 'wechat-invite');
    if (typeof showMusicStatus === 'function') showMusicStatus('\u5df2\u63a5\u5165\u5fae\u4fe1\u4e00\u8d77\u542c\u6b4c\u3002');
    return true;
}
window.startMusicCoListenFromWechat = startMusicCoListenFromWechat;

function getNextMusicIndex() {
    if (!musicTracks.length) return 0;
    if (musicShuffleEnabled && musicTracks.length > 1) {
        let nextIndex = musicCurrentIndex;
        while (nextIndex === musicCurrentIndex) {
            nextIndex = Math.floor(Math.random() * musicTracks.length);
        }
        return nextIndex;
    }
    return (musicCurrentIndex + 1) % musicTracks.length;
}

function handleMusicEnded() {
    if (!musicTracks.length) return;
    if (musicRepeatMode === 'one' && musicAudio) {
        musicAudio.currentTime = 0;
        musicAudio.play().catch(() => {
            musicIsPlaying = false;
            renderMusicNowPlaying();
        });
        return;
    }
    if (musicRepeatMode === 'off' && !musicShuffleEnabled && musicCurrentIndex >= musicTracks.length - 1) {
        musicIsPlaying = false;
        renderMusicNowPlaying();
        renderMusicMainTab();
        return;
    }
    playNextMusicTrack();
}

function playNextMusicTrack() {
    if (!musicTracks.length) return;
    musicCurrentIndex = getNextMusicIndex();
    selectMusicTrack(musicCurrentIndex, true);
}
window.playNextMusicTrack = playNextMusicTrack;

function playPrevMusicTrack() {
    if (!musicTracks.length) return;
    musicCurrentIndex = (musicCurrentIndex - 1 + musicTracks.length) % musicTracks.length;
    selectMusicTrack(musicCurrentIndex, true);
}
window.playPrevMusicTrack = playPrevMusicTrack;

function updateMusicProgress() {
    const bar = document.getElementById('music-progress-fill');
    const elapsed = document.getElementById('music-time-elapsed');
    const duration = document.getElementById('music-time-duration');
    const wave = document.querySelector('#app-music-window .music-wave');
    const current = musicAudio && Number.isFinite(musicAudio.currentTime) ? musicAudio.currentTime : 0;
    const trackDuration = musicTracks[musicCurrentIndex]?.duration;
    const total = musicAudio && Number.isFinite(musicAudio.duration) ? musicAudio.duration : (trackDuration || 0);
    const percent = total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : 0;
    if (bar) bar.style.width = `${percent}%`;
    if (wave) {
        const bars = wave.querySelectorAll('span');
        const activeCount = Math.max(1, Math.round((percent / 100) * bars.length));
        wave.classList.toggle('is-playing', !!musicIsPlaying);
        wave.style.setProperty('--music-wave-progress', `${percent}%`);
        bars.forEach((item, index) => {
            item.style.setProperty('--wave-i', index);
            item.classList.toggle('active', index < activeCount);
        });
    }
    if (elapsed) elapsed.textContent = formatMusicTime(current);
    if (duration) duration.textContent = total > 0 ? formatMusicTime(total) : '--:--';
    updateActiveMusicLyric(current);
    if (typeof window.renderNeteasePlayerProgress === 'function') window.renderNeteasePlayerProgress();
}

function startMusicProgressTimer() {
    clearInterval(musicProgressTimer);
    musicProgressTimer = setInterval(() => {
        if (!musicAudio || musicAudio.paused) {
            clearInterval(musicProgressTimer);
            return;
        }
        updateMusicProgress();
    }, 400);
}

function formatMusicTime(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function seekMusic(event) {
    if (!musicAudio || !musicAudio.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    musicAudio.currentTime = musicAudio.duration * percent;
    updateMusicProgress();
}
window.seekMusic = seekMusic;

function handleMusicSearchInput(value) {
    clearTimeout(musicSearchTimer);
    musicSearchTimer = setTimeout(() => searchMusic(value), 420);
}
window.handleMusicSearchInput = handleMusicSearchInput;

async function searchMusic(term) {
    const query = String(term || '').trim() || '周杰伦';
    musicMainTab = 'home';
    musicAlbumFilter = '';
    const mode = getMusicSourceMode();
    const label = MUSIC_PLATFORM_LABELS[mode] || '多源';
    showMusicStatus(`正在搜索${label}音乐源...`);
    try {
        const tracks = await searchAcrossMusicSources(query, mode);
        if (!tracks.length) throw new Error('empty result');
        musicTracks = tracks;
        musicCurrentIndex = 0;
        saveMusicLibraryState('search');
        if (musicAudio) musicAudio.pause();
        musicIsPlaying = false;
        closeMusicDetail();
        renderMusicApp();
        showMusicStatus(buildMusicSourceSummary(tracks));
    } catch (e) {
        musicTracks = [];
        musicCurrentIndex = 0;
        if (musicAudio) musicAudio.pause();
        musicIsPlaying = false;
        closeMusicDetail();
        renderMusicApp();
        showMusicStatus('在线音乐源暂时不可用，换个关键词或稍后再试。');
    }
}
window.searchMusic = searchMusic;

window.searchAcrossMusicSources = searchAcrossMusicSources;
window.normalizeMusicTrack = normalizeMusicTrack;
window.getMusicSourceMode = getMusicSourceMode;

async function searchAcrossMusicSources(query, mode) {
    const settings = getMusicSourceSettings();
    const tasks = [];
    const platforms = mode === 'smart' ? MUSIC_PLATFORM_ORDER : [mode];

    platforms.filter(platform => platform !== 'archive').forEach(platform => {
        tasks.push(searchMetingMusic(query, platform, settings));
        if (settings.goApiBase) tasks.push(searchGoMusicApi(query, platform, settings));
    });

    if (mode === 'archive' || mode === 'smart') {
        tasks.push(searchInternetArchiveMusic(query));
    }

    const settled = await Promise.allSettled(tasks);
    const tracks = settled.flatMap(item => item.status === 'fulfilled' ? item.value : []);
    return dedupeMusicTracks(tracks).slice(0, 28);
}

function dedupeMusicTracks(tracks) {
    const seen = new Set();
    return tracks.filter(track => {
        if (!track?.audioUrl) return false;
        const key = `${track.sourceName}|${track.remoteId || track.audioUrl || track.trackViewUrl || track.trackName}|${track.trackName}|${track.artistName}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildMusicSourceSummary(tracks) {
    const counts = tracks.reduce((acc, track) => {
        const name = track.sourceName || '音乐源';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
    }, {});
    const text = Object.entries(counts).slice(0, 4).map(([name, count]) => `${name} ${count}`).join(' · ');
    return text ? `已聚合：${text}` : '已载入搜索结果。';
}

async function fetchJsonWithTimeout(url, options = {}, timeout = 6500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        if (!res.ok) throw new Error(`music api ${res.status}`);
        const text = await res.text();
        if (!text.trim()) return null;
        return JSON.parse(text);
    } finally {
        clearTimeout(timer);
    }
}

async function searchMetingMusic(query, platform, settings) {
    const bases = settings.metingBases?.length ? settings.metingBases : MUSIC_SOURCE_DEFAULTS.metingBases;
    const settled = await Promise.allSettled(bases.map(base => searchMetingBase(base, platform, query)));
    return dedupeMusicTracks(settled.flatMap(item => item.status === 'fulfilled' ? item.value : []));
}

async function searchMetingBase(base, platform, query) {
    const params = new URLSearchParams({
        server: platform,
        type: 'search',
        id: query,
        limit: '10'
    });
    const json = await fetchJsonWithTimeout(`${base}?${params.toString()}`);
    const rows = extractMusicRows(json).slice(0, 8);
    const settled = await Promise.allSettled(rows.map(item => hydrateMetingTrack(base, platform, item)));
    return settled.flatMap(item => item.status === 'fulfilled' && item.value ? [item.value] : []);
}

async function hydrateMetingTrack(base, platform, item) {
    const id = item.id || item.song_id || item.songmid || item.mid || item.url_id;
    const urlId = item.url_id || item.id || item.song_id || item.songmid || item.mid;
    const lyricId = item.lyric_id || item.id || item.song_id || item.songmid || item.mid;
    const picId = item.pic_id || item.picId || item.cover_id || item.id;
    const directUrl = pickMusicUrl(item);
    const directLyrics = pickMusicLyrics(item.lrc || item.lyric || item.lyrics);
    const lyricsUrl = normalizeMetingAsset(item.lrc || item.lyric || item.lyrics);
    const [audioUrl, artworkUrl100] = await Promise.all([
        directUrl ? Promise.resolve(directUrl) : fetchMetingAsset(base, platform, 'url', urlId),
        item.pic || item.cover || item.artwork || item.artworkUrl100 ? Promise.resolve(item.pic || item.cover || item.artwork || item.artworkUrl100) : fetchMetingAsset(base, platform, 'pic', picId, { size: '300' })
    ]);
    return normalizeMusicTrack({
        id: `meting:${platform}:${id || urlId || item.name}:${audioUrl}`,
        remoteId: String(id || urlId || ''),
        trackName: item.name || item.title || item.songname || 'Untitled',
        artistName: normalizeMusicArtist(item.artist || item.artists || item.singer || item.author),
        collectionName: item.album || item.albumname || MUSIC_PLATFORM_LABELS[platform],
        artworkUrl100,
        audioUrl,
        trackViewUrl: getMusicPlatformUrl(platform, id || urlId),
        primaryGenreName: 'Online Music',
        sourceName: MUSIC_PLATFORM_LABELS[platform] || platform,
        sourceKey: 'meting',
        sourceMeta: JSON.stringify({ base, platform, lyricId }),
        lyricsUrl,
        lyricsText: directLyrics,
        duration: normalizeMusicDuration(item.duration || item.interval)
    });
}

async function fetchMetingAsset(base, platform, type, id, extra = {}) {
    if (!id) return '';
    const params = new URLSearchParams({ server: platform, type, id: String(id), ...extra });
    if (type === 'url') {
        params.set('br', '320');
        params.set('r', '320');
    }
    const requestUrl = `${base}?${params.toString()}`;
    if (type === 'url' || type === 'pic') return requestUrl;
    try {
        const json = await fetchJsonWithTimeout(requestUrl);
        return type === 'lyric' ? pickMusicLyrics(json) : pickMusicUrl(json);
    } catch (e) {}
    return '';
}

async function searchGoMusicApi(query, platform, settings) {
    const base = settings.goApiBase;
    if (!base) return [];
    const urls = [
        `${base}/search?${new URLSearchParams({ keywords: query, source: platform, limit: '10' }).toString()}`,
        `${base}/api/search?${new URLSearchParams({ keyword: query, source: platform, limit: '10' }).toString()}`,
        `${base}/music/search?${new URLSearchParams({ keyword: query, platform, limit: '10' }).toString()}`
    ];
    for (const url of urls) {
        try {
            const json = await fetchJsonWithTimeout(url);
            const rows = extractMusicRows(json).slice(0, 10);
            const tracks = rows.map(item => normalizeGenericMusicTrack(item, platform, '聚合后端')).filter(track => track.audioUrl);
            if (tracks.length) return tracks;
        } catch (e) {}
    }
    return [];
}

function normalizeGenericMusicTrack(item, platform, sourceName) {
    const id = item.id || item.songId || item.song_id || item.mid || item.hash || item.rid || item.url;
    return normalizeMusicTrack({
        id: `generic:${platform}:${id || item.name || item.title}`,
        remoteId: String(id || ''),
        trackName: item.name || item.title || item.songname || item.songName || 'Untitled',
        artistName: normalizeMusicArtist(item.artist || item.artists || item.singer || item.author),
        collectionName: item.album || item.albumname || item.albumName || MUSIC_PLATFORM_LABELS[platform] || 'Online Music',
        artworkUrl100: item.pic || item.cover || item.image || item.artwork || item.artworkUrl100 || '',
        audioUrl: pickMusicUrl(item),
        trackViewUrl: item.link || item.url_page || item.share || getMusicPlatformUrl(platform, id),
        sourceName,
        sourceKey: 'generic',
        lyricsText: pickMusicLyrics(item),
        duration: normalizeMusicDuration(item.duration || item.interval)
    });
}

function extractMusicRows(json) {
    if (Array.isArray(json)) return json;
    if (!json || typeof json !== 'object') return [];
    const candidates = [
        json.data,
        json.result,
        json.result?.songs,
        json.result?.list,
        json.songs,
        json.list,
        json.items,
        json.records
    ];
    for (const item of candidates) {
        if (Array.isArray(item)) return item;
        if (item && typeof item === 'object') {
            const nested = extractMusicRows(item);
            if (nested.length) return nested;
        }
    }
    return [];
}

function flattenMusicPayload(value) {
    if (!value || typeof value !== 'object') return {};
    if (Array.isArray(value)) return flattenMusicPayload(value[0]);
    for (const key of ['data', 'result', 'song', 'songs', 'info']) {
        const nested = value[key];
        if (Array.isArray(nested)) return { ...value, ...flattenMusicPayload(nested[0]) };
        if (nested && typeof nested === 'object') return { ...value, ...flattenMusicPayload(nested) };
    }
    return value;
}

function pickMusicUrl(value) {
    if (!value) return '';
    if (typeof value === 'string') return /^https?:\/\//i.test(value) ? value : '';
    if (Array.isArray(value)) {
        for (const item of value) {
            const url = pickMusicUrl(item);
            if (url) return url;
        }
        return '';
    }
    const directKeys = ['url', 'audioUrl', 'playUrl', 'musicUrl', 'src', 'file', 'location'];
    for (const key of directKeys) {
        const url = pickMusicUrl(value[key]);
        if (url) return url;
    }
    const containers = ['data', 'result', 'song', 'music_urls', 'musicUrls', 'urls'];
    for (const key of containers) {
        const url = pickMusicUrl(value[key]);
        if (url) return url;
    }
    if (value.flac || value.ape || value['320'] || value.m4a || value['128']) {
        return pickMusicUrl(value.flac || value.ape || value['320'] || value.m4a || value['128']);
    }
    return '';
}

function pickMusicLyrics(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.includes('\n') || value.includes('[') ? value : '';
    if (Array.isArray(value)) return value.map(pickMusicLyrics).find(Boolean) || '';
    const keys = ['lrc', 'lyric', 'lyrics', 'plainLyrics', 'syncedLyrics', 'original', 'translation'];
    for (const key of keys) {
        const text = pickMusicLyrics(value[key]);
        if (text) return text;
    }
    for (const key of ['data', 'result', 'lyric']) {
        const text = pickMusicLyrics(value[key]);
        if (text) return text;
    }
    return '';
}

function normalizeMusicArtist(value) {
    if (Array.isArray(value)) {
        return value.map(item => {
            if (typeof item === 'string') return item;
            return item?.name || item?.artistName || item?.title || '';
        }).filter(Boolean).join(', ') || 'Unknown Artist';
    }
    if (value && typeof value === 'object') return value.name || value.artistName || value.title || 'Unknown Artist';
    return String(value || '').trim() || 'Unknown Artist';
}

function normalizeMusicDuration(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num > 10000 ? Math.round(num / 1000) : num;
}

function getMusicPlatformUrl(platform, id) {
    if (!id) return '';
    const encoded = encodeURIComponent(id);
    if (platform === 'netease') return `https://music.163.com/song?id=${encoded}`;
    return '';
}

async function searchInternetArchiveMusic(query) {
    const q = `${query} AND mediatype:audio`;
    const params = new URLSearchParams();
    params.set('q', q);
    params.append('fl[]', 'identifier');
    params.append('fl[]', 'title');
    params.append('fl[]', 'creator');
    params.append('fl[]', 'date');
    params.append('sort[]', 'downloads desc');
    params.set('rows', '14');
    params.set('page', '1');
    params.set('output', 'json');
    const res = await fetch(`https://archive.org/advancedsearch.php?${params.toString()}`);
    if (!res.ok) throw new Error(`Archive search ${res.status}`);
    const json = await res.json();
    const docs = json?.response?.docs || [];
    const hydrated = await Promise.all(docs.slice(0, 10).map(hydrateArchiveTrack));
    return hydrated.filter(Boolean).slice(0, 12);
}

async function hydrateArchiveTrack(doc) {
    const identifier = doc?.identifier;
    if (!identifier) return null;
    try {
        const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
        if (!res.ok) return null;
        const json = await res.json();
        const file = pickArchiveAudioFile(json.files || []);
        if (!file) return null;
        const meta = json.metadata || {};
        const title = file.title || meta.title || doc.title || file.name;
        const creator = normalizeArchiveCreator(meta.creator || doc.creator);
        const album = meta.album || meta.collection || meta.title || 'Internet Archive';
        const duration = Number.parseFloat(file.length || meta.runtime || '');
        return normalizeMusicTrack({
            id: `archive:${identifier}:${file.name}`,
            trackName: title,
            artistName: creator || 'Internet Archive',
            collectionName: Array.isArray(album) ? album[0] : album,
            artworkUrl100: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
            audioUrl: `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeArchivePath(file.name)}`,
            trackViewUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
            primaryGenreName: file.format || 'Archive Audio',
            sourceName: 'Internet Archive',
            duration: Number.isFinite(duration) ? duration : null
        });
    } catch (e) {
        return null;
    }
}

function pickArchiveAudioFile(files) {
    const audioFiles = files.filter(file => {
        const name = String(file.name || '');
        const format = String(file.format || '').toLowerCase();
        return /\.(mp3|m4a|ogg|oga|wav)$/i.test(name)
            || format.includes('mp3')
            || format.includes('ogg')
            || format.includes('mpeg4 audio');
    }).filter(file => !/_sample\./i.test(file.name || ''));
    const score = file => {
        const name = String(file.name || '').toLowerCase();
        const format = String(file.format || '').toLowerCase();
        if (format.includes('vbr mp3') || name.endsWith('.mp3')) return 4;
        if (name.endsWith('.m4a')) return 3;
        if (format.includes('ogg') || name.endsWith('.ogg') || name.endsWith('.oga')) return 2;
        if (name.endsWith('.wav')) return 1;
        return 0;
    };
    return audioFiles.sort((a, b) => score(b) - score(a))[0] || null;
}

function encodeArchivePath(path) {
    return String(path || '').split('/').map(part => encodeURIComponent(part)).join('/');
}

function normalizeArchiveCreator(value) {
    if (Array.isArray(value)) return value.filter(Boolean).join(', ');
    return String(value || '').trim();
}

function showMusicStatus(text) {
    const el = document.getElementById('music-status');
    if (el) el.textContent = text || '';
}

function openMusicDetail(index) {
    selectMusicTrack(index, false);
    const detail = document.getElementById('music-detail-view');
    if (detail) detail.classList.remove('hidden');
    switchMusicDetailTab('lyrics');
    renderMusicDetail();
    refreshMusicLyrics();
}
window.openMusicDetail = openMusicDetail;

function closeMusicDetail() {
    document.getElementById('music-detail-view')?.classList.add('hidden');
}
window.closeMusicDetail = closeMusicDetail;

function goBackMusicView() {
    closeMusicDetail();
    renderMusicMainTab();
}
window.goBackMusicView = goBackMusicView;

function handleMusicHeaderBack() {
    const detail = document.getElementById('music-detail-view');
    if (detail && !detail.classList.contains('hidden')) {
        goBackMusicView();
        return;
    }
    const neteaseView = document.getElementById('music-netease-view');
    if (neteaseView && !neteaseView.classList.contains('hidden')) {
        if (typeof window.closeNeteaseView === 'function') window.closeNeteaseView();
        else neteaseView.classList.add('hidden');
        return;
    }
    if (musicMainTab === 'albums' && musicAlbumFilter) {
        closeMusicAlbum();
        return;
    }
    closeApp('music');
}
window.handleMusicHeaderBack = handleMusicHeaderBack;

function renderMusicDetail() {
    const detail = document.getElementById('music-detail-view');
    if (!detail || detail.classList.contains('hidden')) return;
    const track = musicTracks[musicCurrentIndex] || getMusicPlaceholderTrack();
    const cover = document.getElementById('music-detail-cover');
    const source = document.getElementById('music-detail-source');
    const title = document.getElementById('music-detail-title');
    const artist = document.getElementById('music-detail-artist');
    const artwork = getMusicArtwork(track);
    if (cover) {
        cover.innerHTML = artwork
            ? `<img src="${musicEscapeAttr(artwork)}" alt="${musicEscapeAttr(track.trackName)}" onerror="this.parentElement.innerHTML=getFallbackCover()">`
            : getFallbackCover();
    }
    if (source) source.textContent = track.sourceName || 'Full track';
    if (title) title.textContent = track.trackName;
    if (artist) artist.textContent = track.artistName;
    updateMusicFavoriteButton();
    renderMusicAiPanel();
    renderMusicComments();
}

function updateMusicFavoriteButton() {
    const btn = document.getElementById('music-favorite-btn');
    const nowBtn = document.getElementById('music-now-favorite-btn');
    const track = musicTracks[musicCurrentIndex];
    if (!track) return;
    const liked = isMusicFavorite(track);
    if (btn) {
        btn.classList.toggle('active', liked);
        btn.innerHTML = `<i class="${liked ? 'ri-heart-3-fill' : 'ri-heart-3-line'}"></i><span>${liked ? '已收藏' : '收藏'}</span>`;
    }
    if (nowBtn) {
        nowBtn.classList.toggle('active', liked);
        nowBtn.setAttribute('aria-label', liked ? '取消收藏' : '收藏');
        nowBtn.innerHTML = `<i class="${liked ? 'ri-heart-fill' : 'ri-heart-line'}"></i>`;
    }
}

function getMusicCurrentChar() {
    const chars = window.myCharacters || [];
    if (musicCoListenCharId) {
        const selected = chars.find(c => c.id === musicCoListenCharId);
        if (selected) return selected;
    }
    if (typeof getCurrentChatChar === 'function') {
        const current = getCurrentChatChar();
        if (current) return current;
    }
    if (window.currentChatCharId) {
        const current = chars.find(c => c.id === window.currentChatCharId);
        if (current) return current;
    }
    return chars[0] || null;
}

function getMusicCharName(char) {
    return (char?.chatConfig && char.chatConfig.nickname) || char?.name || 'AI';
}

function selectMusicCoListenChar(charId) {
    const char = (window.myCharacters || []).find(c => c.id === charId);
    if (!char) return;
    musicCoListenCharId = char.id;
    localStorage.setItem(MUSIC_CO_LISTEN_CHAR_KEY, char.id);
    musicCoListenLastTrackKey = '';
    renderMusicAiPanel();
    if (musicCoListening) queueMusicAiReaction('switch-char');
}
window.selectMusicCoListenChar = selectMusicCoListenChar;

function getMusicCoListenStore() {
    try {
        return JSON.parse(localStorage.getItem(MUSIC_CO_LISTEN_KEY) || '{}') || {};
    } catch (e) {
        return {};
    }
}

function saveMusicCoListenStore(store) {
    localStorage.setItem(MUSIC_CO_LISTEN_KEY, JSON.stringify(store || {}));
}

function getMusicCoListenThread(track, char) {
    const store = getMusicCoListenStore();
    const key = `${char?.id || 'ai'}::${getMusicTrackKey(track)}`;
    return { store, key, items: Array.isArray(store[key]) ? store[key] : [] };
}

function saveMusicAiMessage(track, char, text, kind) {
    const thread = getMusicCoListenThread(track, char);
    const cleanText = cleanMusicAiCommentText(text);
    const item = {
        name: getMusicCharName(char),
        text: cleanText,
        kind: kind || 'comment',
        time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    };
    if (!item.text) return;
    thread.items.unshift(item);
    thread.store[thread.key] = thread.items.slice(0, 18);
    saveMusicCoListenStore(thread.store);
    musicAiMessages = thread.store[thread.key];
}

function renderMusicAiPanel() {
    const panel = document.getElementById('music-ai-panel');
    const btn = document.getElementById('music-ai-listen-btn');
    const track = musicTracks[musicCurrentIndex];
    const char = getMusicCurrentChar();
    if (!panel || !btn || !track) return;
    const thread = getMusicCoListenThread(track, char);
    musicAiMessages = thread.items;
    btn.classList.toggle('active', musicCoListening);
    btn.innerHTML = `<i class="${musicCoListening ? 'ri-user-heart-fill' : 'ri-user-heart-line'}"></i><span>${musicCoListening ? '正在共听' : '共同听歌'}</span>`;
    panel.classList.toggle('hidden', !musicCoListening && !thread.items.length && !musicCoListenBusy);
    if (panel.classList.contains('hidden')) return;
    const charName = getMusicCharName(char);
    const avatar = char?.avatar || '';
    const chars = (window.myCharacters || []).filter(item => item && item.id && !item.isGroupChat);
    const chooserHtml = chars.length ? `
        <div class="music-ai-char-list">
            ${chars.map(item => `
                <button type="button" class="${item.id === char?.id ? 'active' : ''}" onclick="selectMusicCoListenChar('${musicEscapeAttr(item.id)}')">
                    ${item.avatar ? `<img src="${musicEscapeAttr(item.avatar)}" alt="${musicEscapeAttr(getMusicCharName(item))}">` : '<i class="ri-user-smile-line"></i>'}
                    <span>${musicEscapeHtml(getMusicCharName(item))}</span>
                </button>
            `).join('')}
        </div>
    ` : '';
    const visibleMessages = thread.items
        .map(item => ({ ...item, text: cleanMusicAiCommentText(item.text) }))
        .filter(item => item.text);
    const messagesHtml = visibleMessages.length
        ? visibleMessages.map(item => `
            <div class="music-ai-message ${musicEscapeAttr(item.kind || 'comment')}">
                <strong>${musicEscapeHtml(item.name || charName)}</strong>
                <p>${musicEscapeHtml(item.text)}</p>
                <span>${musicEscapeHtml(item.time || '')}</span>
            </div>
        `).join('')
        : '<div class="music-ai-empty">开始播放后，角色会按人设评价、点歌或切歌。</div>';
    panel.innerHTML = `
        <div class="music-ai-head">
            <div class="music-ai-avatar">${avatar ? `<img src="${musicEscapeAttr(avatar)}" alt="${musicEscapeAttr(charName)}" onerror="this.remove()">` : '<i class="ri-user-smile-line"></i>'}</div>
            <div>
                <strong>${musicEscapeHtml(charName)}</strong>
                <span>${musicCoListening ? '正在和你一起听' : '共听记录'}</span>
            </div>
            ${musicCoListenBusy ? '<em class="music-ai-thinking"><i class="ri-loader-4-line"></i><span>思考中...</span></em>' : '<button type="button" onclick="queueMusicAiReaction(\'manual\')"><span>问一句</span></button>'}
        </div>
        ${chooserHtml}
        <div class="music-ai-messages">${messagesHtml}</div>
    `;
}

function toggleMusicCoListen() {
    const char = getMusicCurrentChar();
    if (!char) {
        showMusicStatus('先在微信导入或选择一个角色，再一起听歌。');
        return;
    }
    musicCoListening = !musicCoListening;
    renderMusicAiPanel();
    if (musicCoListening) queueMusicAiReaction('start');
}
window.toggleMusicCoListen = toggleMusicCoListen;

function queueMusicAiReaction(reason) {
    if (musicCoListenBusy) return;
    const track = musicTracks[musicCurrentIndex];
    if (!track || !musicCoListening && reason !== 'manual') return;
    const key = `${getMusicTrackKey(track)}::${reason}`;
    if (reason === 'play' && musicCoListenLastTrackKey === key) return;
    musicCoListenLastTrackKey = key;
    requestMusicAiReaction(reason).catch(err => {
        console.warn('music ai reaction failed:', err);
        musicCoListenBusy = false;
        renderMusicAiPanel();
        showMusicStatus('共同听歌暂时没有回复，检查 API 或换个模型再试。');
    });
}
window.queueMusicAiReaction = queueMusicAiReaction;

async function requestMusicAiReaction(reason) {
    const track = musicTracks[musicCurrentIndex];
    const char = getMusicCurrentChar();
    if (!track || !char || typeof callChatApi !== 'function') return;
    musicCoListenBusy = true;
    renderMusicAiPanel();
    const charName = getMusicCharName(char);
    const userProfile = typeof getUserProfile === 'function' ? getUserProfile() : { name: '我' };
    const context = [
        `当前正在共同听歌。`,
        `歌曲：${track.trackName}`,
        `歌手：${track.artistName}`,
        `专辑/来源：${track.collectionName || track.sourceName || ''}`,
        `用户：${userProfile.name || '我'}`,
        `触发：${reason}`
    ].join('\n');
    const history = Array.isArray(char.history) ? char.history.slice(-10) : [];
    const messages = typeof buildMessages === 'function'
        ? buildMessages(char, history)
        : [{ role: 'system', content: `你是${charName}。` }];
    messages.push({
        role: 'system',
        content: '你正在 BYND Music 里和用户一起听歌。请按角色卡和最近聊天，用自然口吻给出一句短评论；只允许输出角色自己说的话。不要写旁白、动作描写、舞台说明、心理描写、括号说明、分隔符或思考过程。如果你想点歌或不喜欢当前歌，可以在回复末尾单独加一行 JSON：{"action":"request","query":"歌名 歌手","comment":"理由"} 或 {"action":"skip","comment":"理由"}。'
    });
    messages.push({ role: 'user', content: context });
    const result = await callChatApi(messages, { usageFeature: 'music', usageChar: char });
    musicCoListenBusy = false;
    if (!result?.ok) {
        saveMusicAiMessage(track, char, result?.error || '我这边暂时听不清，等一下再说。', 'error');
        renderMusicAiPanel();
        return;
    }
    const parsed = parseMusicAiCommand(result.content);
    const text = cleanMusicAiCommentText(parsed.comment || parsed.text || result.content);
    saveMusicAiMessage(track, char, text, parsed.action || 'comment');
    renderMusicAiPanel();
    addMusicCommentFromAi(char, text);
    if (parsed.action === 'skip') {
        showMusicStatus(`${charName} 切掉了这首。`);
        setTimeout(() => playNextMusicTrack(), 600);
    } else if (parsed.action === 'request' && parsed.query) {
        const input = document.getElementById('music-search-input');
        if (input) input.value = parsed.query;
        showMusicStatus(`${charName} 点了一首：${parsed.query}`);
        setTimeout(() => searchMusic(parsed.query), 600);
    }
}

function parseMusicAiCommand(content) {
    const raw = String(content || '').trim();
    const match = raw.match(/\{[\s\S]*\}\s*$/);
    if (!match) return { action: 'comment', text: cleanMusicAiCommentText(raw) };
    try {
        const json = JSON.parse(match[0]);
        const text = cleanMusicAiCommentText(raw.slice(0, match.index).trim());
        const action = ['request', 'skip', 'comment'].includes(json.action) ? json.action : 'comment';
        return {
            action,
            query: String(json.query || '').trim(),
            comment: cleanMusicAiCommentText(json.comment || text || ''),
            text
        };
    } catch (e) {
        return { action: 'comment', text: cleanMusicAiCommentText(raw) };
    }
}

function cleanMusicAiCommentText(value) {
    let text = String(value || '').trim();
    if (!text) return '';
    text = text.replace(/```[\s\S]*?```/g, '').trim();
    text = text.replace(/\|\|\|/g, '\n');
    text = text.replace(/^[\s\-–—*]*(旁白|系统|舞台|动作|心理|内心|narration|narrator|aside|stage|action)\s*[：:]\s*.*$/gim, '');
    text = text.replace(/[\[【(（]\s*(旁白|系统|舞台|动作|心理|内心|narration|narrator|aside|stage|action)\s*[：:][\s\S]*?[\]】)）]/gim, '');
    text = text.replace(/[\[【(（][^()[\]（）【】]*(低声|轻声|笑|叹气|看着|望向|屏幕|手机|镜头|回视线|摩挲|沉默|停顿|靠近|转头)[^()[\]（）【】]*[\]】)）]/g, '');
    text = text.split(/\n+/)
        .map(line => line.trim())
        .filter(line => line && !/^(旁白|系统|舞台|动作|心理|内心|narration|narrator|aside|stage|action)\s*[：:]/i.test(line))
        .join('\n')
        .trim();
    return text.replace(/\n{2,}/g, '\n').trim();
}

function addMusicCommentFromAi(char, text) {
    const track = musicTracks[musicCurrentIndex];
    const cleanText = cleanMusicAiCommentText(text);
    if (!track || !cleanText) return;
    const store = getMusicCommentsStore();
    if (!Array.isArray(store[track.id])) store[track.id] = [];
    store[track.id].unshift({
        name: getMusicCharName(char),
        text: cleanText,
        time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    saveMusicCommentsStore(store);
    renderMusicComments();
}

function switchMusicDetailTab(tab) {
    musicDetailTab = tab === 'comments' ? 'comments' : 'lyrics';
    document.getElementById('music-detail-view')?.classList.toggle('music-detail-comments-mode', musicDetailTab === 'comments');
    document.querySelectorAll('.music-detail-tabs button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === musicDetailTab);
    });
    document.getElementById('music-lyrics-panel')?.classList.toggle('active', musicDetailTab === 'lyrics');
    document.getElementById('music-comments-panel')?.classList.toggle('active', musicDetailTab === 'comments');
}
window.switchMusicDetailTab = switchMusicDetailTab;

async function refreshMusicLyrics() {
    const track = musicTracks[musicCurrentIndex];
    if (!track) return;
    const lyricsBox = document.getElementById('music-lyrics-box');
    const status = document.getElementById('music-lyrics-status');
    if (status) status.textContent = '正在匹配歌词...';
    if (lyricsBox) lyricsBox.innerHTML = '<div class="music-lyrics-empty">正在查找歌词。</div>';
    try {
        const lyrics = musicLyricsCache[track.id] || await fetchMusicLyrics(track);
        musicLyricsCache[track.id] = lyrics;
        renderMusicLyrics(lyrics);
        if (status) status.textContent = lyrics.source || '歌词已载入';
    } catch (e) {
        if (status) status.textContent = '没有匹配到歌词';
        if (lyricsBox) {
            lyricsBox.innerHTML = `
                <div class="music-lyrics-empty">
                    <strong>暂时没有找到歌词</strong>
                    <span>这首完整音频来自公开档案，歌词库可能没有收录。可以先在评论里记下想法。</span>
                </div>
            `;
        }
    }
}
window.refreshMusicLyrics = refreshMusicLyrics;

async function fetchMusicLyrics(track) {
    const directLyrics = await fetchMusicSourceLyrics(track);
    if (directLyrics) return directLyrics;

    const params = new URLSearchParams();
    params.set('q', `${track.trackName} ${track.artistName}`);
    const res = await fetch(`https://lrclib.net/api/search?${params.toString()}`);
    if (!res.ok) throw new Error(`lyrics ${res.status}`);
    const results = await res.json();
    const item = Array.isArray(results) ? results[0] : null;
    if (!item || (!item.syncedLyrics && !item.plainLyrics)) throw new Error('no lyrics');
    const raw = item.syncedLyrics || item.plainLyrics;
    return {
        source: item.syncedLyrics ? 'LRCLIB 同步歌词' : 'LRCLIB 普通歌词',
        lines: parseLyricsLines(raw)
    };
}

async function fetchMusicSourceLyrics(track) {
    if (track.lyricsText) {
        return {
            source: `${track.sourceName || '音乐源'} 歌词`,
            lines: parseLyricsLines(track.lyricsText)
        };
    }
    if (track.lyricsUrl) {
        try {
            const res = await fetch(track.lyricsUrl);
            if (res.ok) {
                const text = await res.text();
                if (text.trim()) {
                    return {
                        source: `${track.sourceName || '音乐源'} 歌词`,
                        lines: parseLyricsLines(text)
                    };
                }
            }
        } catch (e) {}
    }
    if (track.sourceKey === 'netease' && track.remoteId && typeof window.fetchNeteaseLyricLines === 'function') {
        try {
            const lyrics = await window.fetchNeteaseLyricLines(track.remoteId);
            if (lyrics) return lyrics;
        } catch (e) {}
    }
    if (track.sourceKey === 'meting' && track.sourceMeta) {
        try {
            const meta = JSON.parse(track.sourceMeta);
            const text = await fetchMetingTextAsset(meta.base, meta.platform, 'lrc', meta.lyricId);
            if (text) {
                return {
                    source: `${MUSIC_PLATFORM_LABELS[meta.platform] || track.sourceName} 歌词`,
                    lines: parseLyricsLines(text)
                };
            }
        } catch (e) {}
    }
    return null;
}

async function fetchMetingTextAsset(base, platform, type, id) {
    if (!base || !platform || !id) return '';
    const params = new URLSearchParams({ server: platform, type, id: String(id) });
    const res = await fetch(`${base}?${params.toString()}`);
    if (!res.ok) return '';
    return res.text();
}

function parseLyricsLines(raw) {
    return String(raw || '').split(/\r?\n/).map(line => {
        const match = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
        if (!match) return { time: null, text: line.trim() };
        const seconds = Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] || 0}`);
        return { time: seconds, text: match[4].trim() };
    }).filter(line => line.text);
}

function renderMusicLyrics(lyrics) {
    const box = document.getElementById('music-lyrics-box');
    if (!box) return;
    musicActiveLyricIndex = -1;
    if (!lyrics?.lines?.length) {
        box.innerHTML = '<div class="music-lyrics-empty">没有歌词内容。</div>';
        return;
    }
    box.innerHTML = lyrics.lines.map((line, index) => `
        <div class="music-lyric-line" data-time="${line.time == null ? '' : line.time}" data-line-index="${index}">
            <span>${line.time == null ? '' : formatMusicTime(line.time)}</span>
            <p>${musicEscapeHtml(line.text)}</p>
        </div>
    `).join('');
    updateActiveMusicLyric(musicAudio?.currentTime || 0, true);
}

function updateActiveMusicLyric(currentTime, force) {
    const box = document.getElementById('music-lyrics-box');
    if (!box || !box.querySelector('.music-lyric-line[data-time]')) return;
    const lines = Array.from(box.querySelectorAll('.music-lyric-line'));
    let activeIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        const rawTime = lines[i].dataset.time;
        if (rawTime === '') continue;
        const time = Number(rawTime);
        if (!Number.isFinite(time)) continue;
        if (time <= currentTime + 0.18) activeIndex = i;
        else break;
    }
    if (activeIndex < 0) activeIndex = lines.findIndex(line => line.dataset.time !== '' && Number.isFinite(Number(line.dataset.time)));
    if (activeIndex < 0 || (!force && activeIndex === musicActiveLyricIndex)) return;
    musicActiveLyricIndex = activeIndex;
    lines.forEach((line, index) => line.classList.toggle('active', index === activeIndex));
    const active = lines[activeIndex];
    if (active && document.getElementById('music-detail-view') && !document.getElementById('music-detail-view').classList.contains('hidden')) {
        active.scrollIntoView({ block: 'center', behavior: force ? 'auto' : 'smooth' });
    }
}

function getMusicCommentsStore() {
    try {
        return JSON.parse(localStorage.getItem(MUSIC_COMMENTS_KEY) || '{}') || {};
    } catch (e) {
        return {};
    }
}

function saveMusicCommentsStore(store) {
    localStorage.setItem(MUSIC_COMMENTS_KEY, JSON.stringify(store || {}));
}

function renderMusicComments() {
    const list = document.getElementById('music-comments-list');
    const track = musicTracks[musicCurrentIndex];
    if (!list || !track) return;
    const store = getMusicCommentsStore();
    const comments = (store[track.id] || [])
        .map(comment => ({ ...comment, text: cleanMusicAiCommentText(comment.text) }))
        .filter(comment => comment.text);
    if (!comments.length) {
        list.innerHTML = `
            <div class="music-comments-empty">
                <strong>还没有留言</strong>
                <span>可以记录这首歌适合什么场景，或者想转发给谁。</span>
            </div>
        `;
        return;
    }
    list.innerHTML = comments.map(comment => `
        <div class="music-comment-item">
            <strong>${musicEscapeHtml(comment.name || '我')}</strong>
            <p>${musicEscapeHtml(comment.text)}</p>
            <span>${musicEscapeHtml(comment.time)}</span>
        </div>
    `).join('');
}

function addMusicComment() {
    const input = document.getElementById('music-comment-input');
    const track = musicTracks[musicCurrentIndex];
    if (!input || !track) return;
    const text = input.value.trim();
    if (!text) return;
    const store = getMusicCommentsStore();
    if (!Array.isArray(store[track.id])) store[track.id] = [];
    store[track.id].unshift({
        name: '我',
        text,
        time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    });
    saveMusicCommentsStore(store);
    input.value = '';
    renderMusicComments();
}
window.addMusicComment = addMusicComment;

