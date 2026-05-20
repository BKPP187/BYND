// WorldBook.js: 世界书系统

let currentReadingChar = null;
let currentEntryIndex = -1;
let _wbAudioCtx = null;
let _wbLastToneAt = 0;

const WB_TONES = [261.63, 293.66, 329.63, 392.00, 440.00, 493.88, 523.25];

function wbEscapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function wbEscapeAttr(value) {
    return wbEscapeHtml(value).replace(/`/g, '&#96;');
}

function getWorldBookEntries(char) {
    if (!char) return [];
    if (!Array.isArray(char.worldBook)) char.worldBook = [];
    return char.worldBook;
}

function getWorldBookEntryTitle(entry, fallbackIndex) {
    let keys = entry.keys || entry.key || [];
    if (Array.isArray(keys)) keys = keys.join(', ');
    return (entry.comment || entry.name || keys || `条目 ${fallbackIndex + 1}`).trim();
}

function playWorldBookTone(index, force) {
    const now = Date.now();
    if (!force && now - _wbLastToneAt < 120) return;
    _wbLastToneAt = now;
    try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) return;
        if (!_wbAudioCtx) _wbAudioCtx = new AudioContextCtor();
        if (_wbAudioCtx.state === 'suspended') _wbAudioCtx.resume();

        const oscillator = _wbAudioCtx.createOscillator();
        const gain = _wbAudioCtx.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = WB_TONES[Math.abs(index) % WB_TONES.length];
        gain.gain.setValueAtTime(0.0001, _wbAudioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.045, _wbAudioCtx.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, _wbAudioCtx.currentTime + 0.22);
        oscillator.connect(gain);
        gain.connect(_wbAudioCtx.destination);
        oscillator.start();
        oscillator.stop(_wbAudioCtx.currentTime + 0.24);
    } catch (e) {}
}

function initWorldBook() {
    currentReadingChar = null;
    currentEntryIndex = -1;
    const container = document.getElementById('wb-content-area');
    if (!container) return;
    container.innerHTML = '';

    if (!window.myCharacters || window.myCharacters.length === 0) {
        container.innerHTML = `
            <div class="wb-empty wb-library-empty">
                <i class="ri-book-3-line"></i>
                <strong>图书馆是空的</strong>
                <span>点击右上角 + 创建第一本书</span>
            </div>`;
        return;
    }
    renderBookshelf(container);
}

function renderBookshelf(container) {
    const chars = Array.isArray(window.myCharacters) ? window.myCharacters : [];
    container.innerHTML = `
        <div class="wb-library">
            <div class="wb-library-title">
                <span>World Score</span>
                <strong>角色世界书</strong>
                <em>每本书都会使用角色卡图片作为封面</em>
            </div>
            <div class="wb-score-stage">
                <div class="wb-score-lines" aria-hidden="true">
                    ${Array.from({ length: 7 }, (_, i) => `<span class="wb-string" style="--top:${28 + i * 3}px; --bottom:${26 + (6 - i) * 4}px; --left:${6 + i * 13.7}%; --skew:${-8 + i * 2}deg; --pull-factor:${0.42 + i * 0.05}"></span>`).join('')}
                </div>
                <div class="wb-shelf" id="wb-shelf">
                    ${chars.map((char, index) => {
                        const entries = getWorldBookEntries(char);
                        const color = stringToColor(char.name || `char-${index}`);
                        return `
                            <button type="button" class="wb-book" data-char-index="${index}" style="--book-color:${color}; --wb-scale:1; --wb-y:0px;">
                                <div class="wb-cover">
                                    <div class="wb-spine"></div>
                                    <img class="wb-cover-image" src="${wbEscapeAttr(char.avatar || '')}" alt="${wbEscapeAttr(char.name || '角色')}" onerror="this.classList.add('is-missing')">
                                    <div class="wb-cover-shine"></div>
                                    <span>${entries.length}</span>
                                </div>
                                <div class="wb-title">${wbEscapeHtml(char.name || '未命名角色')}</div>
                                <small>${entries.length ? `${entries.length} 条设定` : '空白书'}</small>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    const shelf = document.getElementById('wb-shelf');
    bindWorldBookShelfMotion(shelf);
}

function bindWorldBookShelfMotion(shelf) {
    if (!shelf) return;
    const stage = shelf.closest('.wb-score-stage');
    const update = () => {
        const rect = shelf.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        shelf.querySelectorAll('.wb-book').forEach((book, index) => {
            const b = book.getBoundingClientRect();
            const bookCenter = b.left + b.width / 2;
            const distance = Math.min(1, Math.abs(bookCenter - center) / 170);
            const scale = 1.16 - distance * 0.18;
            const y = 18 * distance;
            book.style.setProperty('--wb-scale', scale.toFixed(3));
            book.style.setProperty('--wb-y', `${y.toFixed(1)}px`);
            book.classList.toggle('is-near', distance < 0.32);
            book.style.opacity = String(1 - distance * 0.26);
            book.dataset.toneIndex = String(index);
        });
    };
    update();
    let startX = 0;
    let startScrollLeft = 0;
    let isPulling = false;
    if (stage) {
        stage.addEventListener('pointerdown', (event) => {
            if (event.target.closest('.wb-book')) return;
            isPulling = true;
            startX = event.clientX;
            startScrollLeft = shelf.scrollLeft;
            stage.classList.add('is-pulling');
        });
        stage.addEventListener('pointermove', (event) => {
            if (!isPulling) return;
            const diff = event.clientX - startX;
            const pull = Math.max(-18, Math.min(18, diff / 6));
            shelf.scrollLeft = startScrollLeft - diff;
            stage.querySelectorAll('.wb-string').forEach((stringEl, index) => {
                const factor = 0.42 + index * 0.05;
                stringEl.style.setProperty('--string-pull', `${pull * factor}px`);
            });
            update();
        });
        const stopPull = () => {
            isPulling = false;
            stage.classList.remove('is-pulling');
            stage.querySelectorAll('.wb-string').forEach(stringEl => {
                stringEl.style.setProperty('--string-pull', '0px');
            });
        };
        stage.addEventListener('pointerup', stopPull);
        stage.addEventListener('pointercancel', stopPull);
        stage.addEventListener('pointerleave', stopPull);
    }
    shelf.addEventListener('scroll', () => {
        update();
        const centered = Array.from(shelf.querySelectorAll('.wb-book')).find(book => book.classList.contains('is-near'));
        playWorldBookTone(Number(centered?.dataset.toneIndex || 0), false);
    }, { passive: true });
    shelf.addEventListener('click', (event) => {
        const book = event.target.closest('.wb-book');
        if (!book) return;
        const index = Number(book.dataset.charIndex);
        openWorldBookWithAnimation(index, book);
    });
    window.addEventListener('resize', update);
}

function openWorldBookWithAnimation(index, bookEl) {
    const char = (window.myCharacters || [])[index];
    if (!char) return;
    if (document.querySelector('.wb-transition-layer')) return;
    playWorldBookTone(index, true);
    const cover = bookEl.querySelector('.wb-cover');
    const rect = cover?.getBoundingClientRect();
    const phoneRect = document.querySelector('.phone-container')?.getBoundingClientRect() || document.body.getBoundingClientRect();
    if (!rect) {
        renderBookDetail(char);
        return;
    }

    const targetWidth = Math.min(206, phoneRect.width * 0.56);
    const targetHeight = targetWidth * 1.42;
    const targetLeft = phoneRect.left + phoneRect.width / 2 - targetWidth / 2;
    const targetTop = phoneRect.top + phoneRect.height / 2 - targetHeight / 2 - 18;
    const layer = document.createElement('div');
    layer.className = 'wb-transition-layer';
    layer.innerHTML = `
        <div class="wb-transition-book" style="left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; height:${rect.height}px;">
            <div class="wb-transition-pages">
                <span></span><span></span><span></span>
            </div>
            <div class="wb-transition-cover">
                <img src="${wbEscapeAttr(char.avatar || '')}" alt="${wbEscapeAttr(char.name || '角色')}" onerror="this.style.opacity='0.18'">
            </div>
        </div>
    `;
    document.body.appendChild(layer);
    bookEl.classList.add('is-opening');
    requestAnimationFrame(() => {
        const ghost = layer.querySelector('.wb-transition-book');
        if (!ghost) return;
        ghost.style.left = `${targetLeft}px`;
        ghost.style.top = `${targetTop}px`;
        ghost.style.width = `${targetWidth}px`;
        ghost.style.height = `${targetHeight}px`;
        ghost.classList.add('is-centered');
    });
    setTimeout(() => layer.querySelector('.wb-transition-book')?.classList.add('is-open'), 330);
    setTimeout(() => {
        layer.remove();
        bookEl.classList.remove('is-opening');
        renderBookDetail(char);
    }, 880);
}

function renderBookDetail(char) {
    currentReadingChar = char;
    const container = document.getElementById('wb-content-area');
    if (!container) return;
    const entries = getWorldBookEntries(char);

    container.innerHTML = `
        <div class="wb-detail-page">
            <div class="wb-nav-bar">
                <i class="ri-arrow-left-line" onclick="initWorldBook()"></i>
                <span>${wbEscapeHtml(char.name || '角色')} 的世界书</span>
                <i class="ri-add-circle-line" onclick="openCreateWBModal()"></i>
            </div>
            <div class="wb-open-book">
                <div class="wb-open-cover" style="--book-color:${stringToColor(char.name || '角色')}">
                    <img src="${wbEscapeAttr(char.avatar || '')}" onerror="this.style.opacity='0.25'">
                </div>
                <div class="wb-open-meta">
                    <strong>${wbEscapeHtml(char.name || '未命名角色')}</strong>
                    <span>${entries.length} 条世界设定</span>
                </div>
            </div>
            <div class="wb-detail-scroll">
                <div class="wb-list-container">${generateListHtml(entries)}</div>
            </div>
        </div>
    `;
}

function generateListHtml(entries) {
    if (!entries || entries.length === 0) {
        return `<div class="wb-empty wb-entry-empty">这本书是空白的<br><span>点击右上角 + 添加设定</span></div>`;
    }

    return entries.map((entry, index) => {
        if (typeof entry.enabled === 'undefined') entry.enabled = true;
        const isOn = entry.enabled !== false;
        let keys = entry.keys || entry.key || [];
        if (Array.isArray(keys)) keys = keys.join(', ');
        const title = getWorldBookEntryTitle(entry, index);

        return `
            <div class="wb-list-item ${isOn ? '' : 'is-off'}">
                <button type="button" class="wb-item-left" onclick="openEntryDetail(${index})">
                    <span class="wb-item-title">${wbEscapeHtml(title)}</span>
                    <span class="wb-item-keys">${wbEscapeHtml(keys || '无关键词')}</span>
                </button>
                <label class="re-switch" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isOn ? 'checked' : ''} onchange="toggleWBEntry(${index}, this.checked)">
                    <span class="re-slider"></span>
                </label>
            </div>
        `;
    }).join('');
}

function toggleWBEntry(index, enabled) {
    if (!currentReadingChar || !currentReadingChar.worldBook[index]) return;
    currentReadingChar.worldBook[index].enabled = enabled;
    if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    renderBookDetail(currentReadingChar);
}

function openEntryDetail(index) {
    if (!currentReadingChar || !currentReadingChar.worldBook[index]) return;
    currentEntryIndex = index;
    const entry = currentReadingChar.worldBook[index];
    const modal = document.getElementById('wb-detail-modal');
    if (!modal) return;

    let keys = entry.keys || entry.key || [];
    if (Array.isArray(keys)) keys = keys.join(', ');
    document.getElementById('wb-detail-key').value = keys;
    document.getElementById('wb-detail-content').value = entry.content || entry.entry || '';
    modal.classList.remove('hidden');
}

function saveEntryDetail() {
    if (currentEntryIndex === -1 || !currentReadingChar) return;

    const keysStr = document.getElementById('wb-detail-key').value;
    const content = document.getElementById('wb-detail-content').value;
    const entry = currentReadingChar.worldBook[currentEntryIndex];
    entry.keys = keysStr.split(/,|，/).map(k => k.trim()).filter(k => k);
    entry.content = content;

    if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    closeWBDetailModal();
    renderBookDetail(currentReadingChar);
}

function closeWBDetailModal() {
    document.getElementById('wb-detail-modal')?.classList.add('hidden');
    currentEntryIndex = -1;
}

function stringToColor(str) {
    const colors = ['#2f4f6f', '#7a5b8f', '#3d756b', '#9a6a3a', '#6a789d', '#8a4f64'];
    let hash = 0;
    const text = String(str || 'book');
    for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function openCreateWBModal() {
    if (currentReadingChar) {
        document.getElementById('wb-new-key').value = '';
        document.getElementById('wb-new-content').value = '';
        document.getElementById('wb-add-entry-modal').classList.remove('hidden');
    } else {
        document.getElementById('wb-book-name').value = '';
        document.getElementById('wb-create-book-modal').classList.remove('hidden');
    }
}

function saveNewWBEntry() {
    const keysStr = document.getElementById('wb-new-key').value;
    const content = document.getElementById('wb-new-content').value;
    if (!content) { alert('内容不能为空！'); return; }

    const newEntry = {
        keys: keysStr.split(/,|，/).map(k => k.trim()).filter(k => k),
        content,
        comment: '手动添加条目',
        enabled: true
    };

    if (!currentReadingChar.worldBook) currentReadingChar.worldBook = [];
    currentReadingChar.worldBook.push(newEntry);
    if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    document.getElementById('wb-add-entry-modal').classList.add('hidden');
    renderBookDetail(currentReadingChar);
}

function confirmCreateBook() {
    const name = document.getElementById('wb-book-name').value.trim();
    if (!name) { alert('书名不能为空！'); return; }

    const newChar = {
        id: 'char_' + Date.now(),
        name,
        avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        lastMsg: '...',
        worldBook: [],
        regex: [],
        history: []
    };

    window.myCharacters.push(newChar);
    if (typeof saveCharactersToStorage === 'function') saveCharactersToStorage();
    document.getElementById('wb-create-book-modal').classList.add('hidden');
    initWorldBook();
}
