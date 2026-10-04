// Scrapbook presentation and recoverable synchronization with chat, memory and char phone.
const OUTING_MOODS = [
    ['happy', '开心', '#f6c9cd', '>ᴗ<'], ['flutter', '心动', '#f5e8a3', '>﹏<'],
    ['pleasure', '满足', '#f0c1e3', '⌒ᴗ⌒'], ['peaceful', '平静', '#c4ddc4', '˘ᴗ˘'],
    ['normal', '平常', '#cde2e2', '•‿•'], ['tired', '疲惫', '#dadcd5', '﹀_﹀'],
    ['sad', '难过', '#b4c9e9', '•︵•'], ['anxiety', '不安', '#d5c1e7', '⊙_⊙'],
    ['anger', '生气', '#eaa0b1', 'ˋ︿ˊ'], ['disappointed', '失落', '#f3dfa4', '˘︵˘'],
    ['stress', '有压力', '#e9b1ae', '＠_＠'], ['sleepy', '困困', '#c1d5e2', '−_−'],
    ['surprised', '惊喜', '#f0ceb4', '•o•'], ['numbness', '放空', '#e0cde5', '°_°']
];
const OUTING_STICKERS = { place: ['🌳', '🌊', '🏛️', '🎡', '📚', '🌷', '🛍️', '🏙️'], food: ['☕', '🍰', '🍜', '🍞', '🍦', '🍓', '🍔', '🍱'] };
let outingJournalView = 'today';
let outingViewedTripId = '';
let outingCalendarDate = new Date();
let outingEditorMood = 0;
let outingEditorSticker = '';
let outingModalReturnFocus = null;
const outingSyncJobs = new Map();

function migrateOutingJourney() {
    const state = getOutingState();
    if (state.active && !state.journey) {
        const char = getOutingCharacters().find(c => c.id === state.charId);
        state.journey = { id: outingId(), charId: state.charId || char?.id || '', charName: getOutingCharName(char), avatar: char?.avatar || '', startedAt: state.trail.find(e => e.kind === 'start')?.createdAt || Date.now(), destination: state.destination || '', points: state.trail.filter(e => isOutingPoint(e.point)).map(e => e.point), entries: state.lastPhoto ? [{ id: outingId(), kind: 'photo', text: '之前的出门照片', image: state.lastPhoto, createdAt: state.lastPhotoAt || Date.now(), point: state.currentPoint || null, legacy: true }] : [] };
        saveOutingState(state);
    }
}
function findOutingTrip(state, id) { return state.journey?.id === id ? state.journey : state.trips.find(t => t.id === id); }
function mutateOutingTrip(id, change) {
    const state = getOutingState(), trip = findOutingTrip(state, id);
    if (!trip) throw new Error('这次旅程已不在当前记录中。');
    change(trip); saveOutingState(state); return trip;
}
function getOutingMood(id) { return OUTING_MOODS.find(m => m[0] === id) || OUTING_MOODS[4]; }
function outingMoodFace(id, className = '') {
    const mood = getOutingMood(id);
    return `<span class="outing-mood-face ${className} mood-${mood[0]}" style="--mood-color:${mood[2]}" aria-label="${mood[1]}"><span>${mood[3]}</span></span>`;
}
function outingTripText(trip) {
    return [`${new Date(trip.startedAt).toLocaleDateString('zh-CN')}，和${trip.charName}一起出门。`, trip.destination ? `计划目的地：${trip.destination}（不代表实际到访）。` : '这次随心走走。', ...(trip.entries || []).filter(e => e.kind !== 'summary').map(e => `${formatOutingTime(e.createdAt)} · ${e.kind === 'mood' ? '心情' : e.kind === 'food' ? '吃了' : e.kind === 'photo' ? '照片' : '到访'}：${e.text}${e.comment ? `；${trip.charName}留言：${e.comment}` : ''}`)].join('\n');
}

function saveOutingMemory(char, id, title, content) {
    if (typeof getWechatMemoryStore !== 'function' || typeof saveWechatMemoryStore !== 'function') throw new Error('聊天记忆暂不可用，请稍后重试同步。');
    const store = getWechatMemoryStore(), bucket = getWechatMemoryBucket(store, char.id);
    const existing = [...bucket.segments, ...bucket.longTerm].find(m => m.id === id);
    const row = existing || { id, tier: 'segment', charId: char.id, category: 'relationship', enabled: true, auto: true, sourceCount: 1, createdAt: Date.now() };
    Object.assign(row, { title: title.slice(0, 32), content: content.slice(0, 900), updatedAt: Date.now() });
    if (!existing) bucket.segments.push(row);
    saveWechatMemoryStore(store);
}

async function syncOutingNearbyToChar(tripId) {
    const state = getOutingState(), trip = findOutingTrip(state, tripId), nearby = state.nearby;
    if (!nearby || trip && (!state.active || state.journey?.id !== tripId)) return;
    const char = trip ? getOutingCharacters().find(c => c.id === trip.charId) : getOutingSelectedChar();
    if (!char || nearby.sentTo?.[char.id] === nearby.at) return;
    const content = `【一起出门·附近】GPS：${formatOutingPoint(nearby.point)}\n${nearby.places.length ? nearby.places.map(p => `${p.name}（${p.category === 'food' ? '吃喝' : '玩乐'}，约${Math.round(p.distance)}米）`).join('\n') : '地图服务暂未收录附近地点。'}\n这些是地图查到的附近地点，不是已经到访的地方。目的地：${trip?.destination || state.destination || '随心走走'}。`;
    await appendOutingMessageToChar(char, { type: 'text', content, outingMessageId: `${char.id}_nearby_${nearby.at}` });
    const fresh = getOutingState();
    if (fresh.nearby?.at === nearby.at) { (fresh.nearby.sentTo ||= {})[char.id] = nearby.at; saveOutingState(fresh); }
}

async function generateOutingPhotoComment(char, trip, entry) {
    if (typeof callChatApi !== 'function') throw new Error('聊天服务尚未加载，请重试。');
    const persona = typeof getWechatCharacterPersonaText === 'function' ? getWechatCharacterPersonaText(char, 4000) : String(char.description || '');
    const world = typeof buildWechatWorldBookPrompt === 'function' ? buildWechatWorldBookPrompt(char, 12) : '';
    const memory = typeof buildWechatMemoryPrompt === 'function' ? buildWechatMemoryPrompt(char) : '';
    const history = typeof buildWechatRecentHistoryForPrompt === 'function' ? buildWechatRecentHistoryForPrompt(char, 12) : '';
    const identity = typeof buildWechatIdentityContextPrompt === 'function' ? buildWechatIdentityContextPrompt(char, typeof getWechatChatUserProfile === 'function' ? getWechatChatUserProfile(char) : {}) : `你是${trip.charName}，正与用户一起出门。`;
    const result = await callChatApi([
        { role: 'system', content: `${identity}\n${persona}\n${world}\n${memory}\n最近聊天：${history}\n你正在与用户一起出门。请观察真实照片，在照片旁留下符合人设的短留言。根据照片和你们的关系自主决定是否值得珍藏到你自己的手机相册。只返回 JSON：{"comment":"你的留言，最多180字","keepPhoto":true或false}。不要编造没有看到或没有记录的事。` },
        { role: 'user', content: [{ type: 'text', text: `旅程记录：${outingTripText(trip).slice(0, 5000)}\n拍摄位置：${formatOutingPoint(entry.point)}。请为这张照片留言。` }, { type: 'image_url', image_url: { url: entry.image } }] }
    ], { usageFeature: 'chat', usageChar: char, max_tokens: 500 });
    if (!result?.ok || !result.content) throw new Error(result?.error || '角色没有返回留言，请重试。');
    let data;
    try { data = JSON.parse(String(result.content).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch (_) { throw new Error('角色留言格式不完整，请重试。'); }
    if (typeof data.comment !== 'string' || !data.comment.trim() || typeof data.keepPhoto !== 'boolean') throw new Error('角色留言内容不完整，请重试。');
    return { comment: data.comment.trim().slice(0, 600), keepPhoto: data.keepPhoto };
}

async function saveOutingPhotoToCharAlbum(char, trip, entry) {
    char.chatConfig ||= {};
    // Keep real photos outside generated snapshots, which the phone may replace on sync.
    const album = char.chatConfig.outingPhotos ||= [];
    if (album.some(p => p.outingEntryId === entry.id)) return;
    const row = { outingEntryId: entry.id, title: `${trip.charName}珍藏的出门瞬间`, body: entry.comment, image: entry.image, section: 2, meta: new Date(entry.createdAt).toLocaleDateString('zh-CN'), time: formatOutingTime(entry.createdAt) };
    album.push(row);
    try { if (await saveCharactersToStorage() === false) throw new Error('角色相册保存失败，可重试。'); }
    catch (error) { const index = album.indexOf(row); if (index >= 0) album.splice(index, 1); throw error; }
}

function syncOutingEntry(tripId, entryId) {
    const key = `${tripId}/${entryId}`;
    if (outingSyncJobs.has(key)) return outingSyncJobs.get(key);
    const job = Promise.resolve().then(async () => {
        let trip = findOutingTrip(getOutingState(), tripId), entry = trip?.entries.find(e => e.id === entryId);
        const char = getOutingCharacters().find(c => c.id === trip?.charId);
        if (!trip || !entry || !char) throw new Error('同行角色不可用，记录已保留。');
        const update = changes => { trip = mutateOutingTrip(tripId, t => Object.assign(t.entries.find(e => e.id === entryId), changes)); entry = trip.entries.find(e => e.id === entryId); };
        update({ syncError: '' });
        const content = `【一起出门·${entry.kind === 'photo' ? '照片' : entry.kind === 'mood' ? '心情' : entry.kind === 'food' ? '美食' : entry.kind === 'summary' ? '旅程结束' : '到访'}】${entry.text}\n同行：${trip.charName}；时间：${formatOutingTime(entry.createdAt)}；${entry.point ? `GPS：${formatOutingPoint(entry.point)}` : '未取得位置'}。${entry.kind === 'photo' ? '这是真实出门照片。' : ''}`;
        if (!entry.sent) {
            await appendOutingMessageToChar(char, { type: entry.image ? 'image' : 'text', content: entry.image || content, ...(entry.image ? { imageUrl: entry.image, description: content } : {}), outingMessageId: entry.id }, { autoReply: entry.kind !== 'photo' });
            update({ sent: true });
        }
        // Store user records even if photo generation fails.
        if (!entry.memorySaved) { saveOutingMemory(char, `mem_${entry.id}`, '一起出门 · ' + entry.text, content); update({ memorySaved: true }); }
        if (entry.kind === 'photo') {
            if (!entry.comment) update(await generateOutingPhotoComment(char, trip, entry));
            if (!entry.commentSent) {
                await appendOutingMessageToChar(char, { type: 'text', content: entry.comment, outingMessageId: `${entry.id}_comment` }, { isMe: false });
                update({ commentSent: true });
            }
            if (!entry.commentMemorySaved) { saveOutingMemory(char, `mem_${entry.id}`, '一起出门 · 照片留言', `${content}\n${trip.charName}留言：${entry.comment}`); update({ commentMemorySaved: true }); }
            if (entry.keepPhoto && !entry.albumSaved) { await saveOutingPhotoToCharAlbum(char, trip, entry); update({ albumSaved: true }); }
        }
        update({ synced: true, syncError: '' });
        return true;
    }).catch(error => {
        try { mutateOutingTrip(tripId, t => { const entry = t.entries.find(e => e.id === entryId); if (entry) entry.syncError = error.message; }); } catch (saveError) { outingFail(saveError); }
        outingFail(error); return false;
    }).finally(() => { outingSyncJobs.delete(key); renderOutingJournal(); });
    outingSyncJobs.set(key, job); renderOutingJournal(); return job;
}

function showOutingModal(content, className = '') {
    const host = document.getElementById('outing-modal');
    outingModalReturnFocus = document.activeElement;
    host.innerHTML = `<section class="outing-dialog ${className}" role="dialog" aria-modal="true" aria-labelledby="outing-dialog-title"><button class="outing-dialog-close" onclick="closeOutingModal()" aria-label="关闭">×</button>${content}<p id="outing-editor-error" role="alert" hidden></p></section>`;
    host.hidden = false;
    host.querySelector('input,button')?.focus();
}
function closeOutingModal() { const host = document.getElementById('outing-modal'); host.hidden = true; host.innerHTML = ''; outingModalReturnFocus?.focus(); }
document.addEventListener('keydown', event => {
    const host = document.getElementById('outing-modal'); if (!host || host.hidden) return;
    if (event.key === 'Escape') closeOutingModal();
    if (event.key === 'Tab') {
        const controls = [...host.querySelectorAll('button,input,textarea,[tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
});

function openOutingEditor(kind, initial = '') {
    try {
        const state = getOutingState();
        if (kind !== 'destination' && !state.active) throw new Error('先点击出发，再记下这次出门的小事。');
        const titles = { destination: '今天，想去哪里？', mood: '此刻，你的心情', place: '把这个地方记下来', food: '今天吃到了什么？' };
        const placeholders = { destination: '目的地可选，也可以随心走走', mood: '发生了什么？写一句也好（可选）', place: '到过的地方', food: '好吃的名字' };
        outingEditorSticker = OUTING_STICKERS[kind]?.[0] || '';
        outingEditorMood = 0;
        const current = kind === 'destination' ? (state.active ? state.journey.destination : state.destination) || '' : initial;
        showOutingModal(`<small class="outing-eyebrow">${kind === 'destination' ? 'WHERE TO?' : 'A SMALL MOMENT'}</small><h2 id="outing-dialog-title">${titles[kind]}</h2>${kind === 'mood' ? `<div class="outing-mood-picker"><svg class="outing-mood-arc" viewBox="0 0 50 300" aria-hidden="true"><path d="M45 0 C-4 75 -4 225 45 300"/></svg><div class="outing-mood-wheel" id="outing-mood-wheel" role="listbox" aria-label="滑动选择心情" tabindex="0">${OUTING_MOODS.map((m, i) => `<button role="option" data-mood-index="${i}" aria-selected="${i === 0}" onclick="chooseOutingMood(${i})">${outingMoodFace(m[0])}<span>${m[1]}</span></button>`).join('')}</div></div><p class="outing-mood-hint">上下滑动，停在中间的就是现在的心情</p>` : `<div class="outing-sticker-picker">${(OUTING_STICKERS[kind] || ['✧']).map((sticker, i) => `<button type="button" data-sticker="${sticker}" aria-pressed="${i === 0}" onclick="chooseOutingSticker(this)">${sticker}</button>`).join('')}</div>`}<form id="outing-editor-form"><label class="outing-field"><input id="outing-editor-text" maxlength="160" aria-label="${titles[kind]}" value="${outingEscape(current)}" placeholder="${placeholders[kind]}"></label>${kind === 'destination' ? '<p class="outing-dialog-note">只记下你的计划，不填也可以出发。</p>' : ''}<button class="outing-save-btn" type="submit">${kind === 'destination' ? '就这样出发' : '贴进手账'}</button>${kind === 'destination' ? '<button class="outing-text-btn" type="button" onclick="saveOutingEditor(\'destination\', true)">不设目的地，随心走走</button>' : ''}</form>`, kind === 'destination' ? 'outing-destination-dialog' : '');
        document.getElementById('outing-editor-form').onsubmit = event => { event.preventDefault(); saveOutingEditor(kind); };
        if (kind === 'mood') {
            const wheel = document.getElementById('outing-mood-wheel');
            wheel.onscroll = () => chooseOutingMood(Math.round(wheel.scrollTop / 76), false);
            wheel.onkeydown = event => {
                if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault(); chooseOutingMood(event.key === 'Home' ? 0 : event.key === 'End' ? OUTING_MOODS.length - 1 : outingEditorMood + (event.key === 'ArrowDown' ? 1 : -1));
                }
            };
            chooseOutingMood(0, false);
        } else document.getElementById('outing-editor-text').focus();
    } catch (error) { outingFail(error); }
}
function chooseOutingSticker(button) { outingEditorSticker = button.dataset.sticker; button.parentElement.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed', String(el === button))); }
function chooseOutingMood(index, scroll = true) {
    outingEditorMood = Math.max(0, Math.min(OUTING_MOODS.length - 1, index));
    const wheel = document.getElementById('outing-mood-wheel'); if (!wheel) return;
    wheel.querySelectorAll('[data-mood-index]').forEach(el => el.setAttribute('aria-selected', String(Number(el.dataset.moodIndex) === outingEditorMood)));
    wheel.querySelectorAll('[data-mood-index]').forEach(el => { el.style.transform = `translateX(${Math.min(40, Math.abs(Number(el.dataset.moodIndex) - outingEditorMood) ** 2 * 8)}px)`; });
    if (scroll) wheel.scrollTo({ top: outingEditorMood * 76, behavior: 'smooth' });
}
async function saveOutingEditor(kind, skip = false) {
    try {
        const state = getOutingState(), text = skip ? '' : document.getElementById('outing-editor-text').value.trim();
        if (kind === 'destination') {
            state.destination = text; if (state.active && state.journey) state.journey.destination = text;
            saveOutingState(state); closeOutingModal(); renderOutingApp(); return;
        }
        if (!state.active || !state.journey) throw new Error('旅程已结束，请重新出发后再记录。');
        if (kind !== 'mood' && !text) throw new Error('写下名字，再把它贴进手账吧。');
        const mood = OUTING_MOODS[outingEditorMood];
        const entry = { id: outingId(), kind, text: kind === 'mood' ? `${mood[1]}${text ? ' · ' + text : ''}` : text, ...(kind === 'mood' ? { mood: mood[0] } : { sticker: outingEditorSticker }), createdAt: Date.now(), point: state.currentPoint || null };
        state.journey.entries.push(entry); saveOutingState(state);
        const tripId = state.journey.id; closeOutingModal(); outingJournalView = 'today'; renderOutingApp(); await syncOutingEntry(tripId, entry.id);
    } catch (error) {
        const el = document.getElementById('outing-editor-error'); if (el) { el.hidden = false; el.textContent = `保存失败：${error.message}`; } else outingFail(error);
    }
}

function finishOutingJourney() {
    try {
        const state = getOutingState(), trip = state.journey; if (!state.active || !trip) return;
        trip.endedAt = Date.now();
        const entry = { id: `${trip.id}_summary`, kind: 'summary', text: outingTripText(trip), createdAt: Date.now(), point: state.currentPoint || null };
        trip.entries.push(entry); state.trips.push(trip); state.active = false; state.journey = null;
        saveOutingState(state); stopOutingWatcher();
        outingViewedTripId = trip.id; outingJournalView = 'letter'; renderOutingApp();
        document.getElementById('outing-journal').scrollIntoView({ behavior: 'smooth', block: 'start' });
        syncOutingEntry(trip.id, entry.id);
    } catch (error) { outingFail(error); }
}

function outingEntryHtml(entry, trip) {
    const pending = outingSyncJobs.has(`${trip.id}/${entry.id}`);
    return `<article class="outing-entry ${entry.kind === 'photo' ? 'outing-photo-entry' : ''}">${entry.image ? `<div class="outing-photo-print"><img src="${outingEscape(entry.image)}" alt="${outingEscape(entry.text)}" loading="lazy"><span>${formatOutingTime(entry.createdAt)} · ${entry.point ? '路上遇见' : '随手记下'}</span></div>` : `<div class="outing-entry-sticker">${entry.mood ? outingMoodFace(entry.mood, 'is-small') : `<span>${outingEscape(entry.sticker || '✧')}</span>`}</div>`}<div class="outing-entry-copy">${entry.image ? '' : `<small>${formatOutingTime(entry.createdAt)} · ${entry.kind === 'mood' ? '此刻心情' : entry.kind === 'food' ? '好吃的' : '走过的地方'}</small><p>${outingEscape(entry.text)}</p>`}${entry.comment ? `<div class="outing-photo-comment"><img src="${outingEscape(trip.avatar || window.DEFAULT_AVATAR || '')}" alt="${outingEscape(trip.charName)}"><div><strong>${outingEscape(trip.charName)}</strong><p>${outingEscape(entry.comment)}</p></div></div>` : entry.kind === 'photo' ? `<p class="outing-comment-wait">${pending ? `${outingEscape(trip.charName)}正在看这张照片…` : '等待角色的留言'}</p>` : ''}${entry.albumSaved ? '<small class="outing-kept"><i class="ri-heart-line"></i> 角色把这张照片珍藏进了手机相册</small>' : ''}${pending ? '<small class="outing-sync-label" role="status">正在同步到聊天与记忆…</small>' : entry.syncError || !entry.synced ? `<p class="outing-inline-error">${outingEscape(entry.syncError || '记录已保存，尚未同步到聊天与记忆。')}</p><button class="outing-text-btn" data-retry-entry="${outingEscape(entry.id)}">${entry.comment ? '重试同步' : entry.kind === 'photo' ? '请角色留言／重试同步' : '重试同步'}</button>` : '<small class="outing-sync-label">已记进聊天记忆</small>'}</div></article>`;
}
function renderOutingJournal() {
    const host = document.getElementById('outing-journal-body'); if (!host) return;
    const state = getOutingState();
    const tools = document.querySelector('.outing-record-tools'); if (tools) tools.hidden = outingJournalView !== 'today';
    document.querySelectorAll('[data-outing-view]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.outingView === outingJournalView || el.dataset.outingView === 'calendar' && outingJournalView === 'letter')));
    if (outingJournalView === 'calendar') return renderOutingCalendar(host, state);
    const trip = outingJournalView === 'letter' ? findOutingTrip(state, outingViewedTripId) : state.journey;
    if (!trip) { host.innerHTML = '<div class="outing-journal-empty"><span>✧</span><p>把路上的小事，留在这一页</p><small>出发后，记录心情、地点、美食与照片</small></div>'; return; }
    const entries = trip.entries.filter(e => e.kind !== 'summary');
    const counts = ['mood', 'place', 'food', 'photo'].map(kind => entries.filter(e => e.kind === kind).length);
    host.innerHTML = `${trip.endedAt ? `<div class="outing-letter"><button class="outing-text-btn" onclick="switchOutingJournal('calendar')">‹ 返回回忆月历</button><header><span class="outing-letter-stamp">✧<small>DAY OUT</small></span><small>${new Date(trip.startedAt).toLocaleDateString('zh-CN')}</small><h2>把今天，寄给我们</h2><p>与 ${outingEscape(trip.charName)} 的一页回忆</p></header><div class="outing-letter-intro">${trip.destination ? `原本想去 ${outingEscape(trip.destination)}。` : '没有安排好的目的地，也留下了一些小小的瞬间。'}<br>${formatOutingTime(trip.startedAt)} — ${formatOutingTime(trip.endedAt)} · ${Math.max(1, Math.round((trip.endedAt - trip.startedAt) / 60000))} 分钟</div>` : ''}<div class="outing-summary-strip">${counts.map((count, i) => `<span><b>${count}</b>${['心情', '地点', '美食', '照片'][i]}</span>`).join('')}</div><div class="outing-entry-list">${entries.length ? entries.map(e => outingEntryHtml(e, trip)).join('') : '<p class="outing-empty">这次出门，还没有贴下小记。</p>'}</div>${trip.endedAt ? `<footer class="outing-letter-footer"><span>✧</span><p>这一页，留给一起走过的我们。</p>${(() => { const summary = trip.entries.find(e => e.kind === 'summary'); return summary && !summary.synced ? `<p class="outing-inline-error">${outingEscape(summary.syncError || '旅程汇总尚未同步到聊天记忆')}</p><button class="outing-text-btn" data-retry-entry="${summary.id}">重试同步汇总</button>` : '<small>旅程汇总已记入聊天记忆</small>'; })()}</footer></div>` : ''}`;
    host.querySelectorAll('[data-retry-entry]').forEach(el => el.onclick = () => syncOutingEntry(trip.id, el.dataset.retryEntry));
}
function switchOutingJournal(view) { outingJournalView = view; renderOutingJournal(); }
function changeOutingMonth(delta) { outingCalendarDate = new Date(outingCalendarDate.getFullYear(), outingCalendarDate.getMonth() + delta, 1); renderOutingJournal(); }
function outingDateKey(ts) { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function renderOutingCalendar(host, state) {
    const year = outingCalendarDate.getFullYear(), month = outingCalendarDate.getMonth(), first = (new Date(year, month, 1).getDay() + 6) % 7, days = new Date(year, month + 1, 0).getDate();
    const trips = state.trips.filter(t => new Date(t.startedAt).getFullYear() === year && new Date(t.startedAt).getMonth() === month);
    host.innerHTML = `<div class="outing-calendar"><div class="outing-calendar-heading"><button onclick="changeOutingMonth(-1)" aria-label="上个月">‹</button><strong>${year} 年 ${month + 1} 月</strong><button onclick="changeOutingMonth(1)" aria-label="下个月">›</button></div><div class="outing-calendar-week">${['一', '二', '三', '四', '五', '六', '日'].map(d => `<span>${d}</span>`).join('')}</div><div class="outing-calendar-grid">${'<span></span>'.repeat(first)}${Array.from({ length: days }, (_, i) => {
        const dayTrips = trips.filter(t => new Date(t.startedAt).getDate() === i + 1), entries = dayTrips.flatMap(t => t.entries), mood = entries.filter(e => e.mood).pop();
        return `<button ${dayTrips.length ? `data-outing-day="${i + 1}"` : 'disabled'} aria-label="${month + 1}月${i + 1}日，${dayTrips.length}次出门" ${mood ? `style="--day-color:${getOutingMood(mood.mood)[2]}"` : ''}><small>${i + 1}</small>${dayTrips.length ? `<span>${mood ? outingMoodFace(mood.mood, 'is-calendar') : '✧'}</span><em>${entries.filter(e => e.kind === 'food' || e.kind === 'place').slice(0, 2).map(e => outingEscape(e.sticker)).join('') || '·'}${dayTrips.length > 1 ? ` +${dayTrips.length - 1}` : ''}</em>` : ''}</button>`;
    }).join('')}</div><div class="outing-calendar-legend"><span>◌ 心情涂色</span><span>✧ 一起走过</span><span>${trips.length} 次出门</span></div></div><div id="outing-day-trips">${trips.length ? '<p class="outing-empty">点开有贴纸的日子，读一页回忆。</p>' : '<p class="outing-empty">这个月，还没有结束的旅程。</p>'}</div>`;
    host.querySelectorAll('[data-outing-day]').forEach(el => el.onclick = () => {
        const dayTrips = trips.filter(t => new Date(t.startedAt).getDate() === Number(el.dataset.outingDay));
        if (dayTrips.length === 1) { outingViewedTripId = dayTrips[0].id; outingJournalView = 'letter'; renderOutingJournal(); return; }
        const list = document.getElementById('outing-day-trips');
        list.innerHTML = dayTrips.map(t => `<button class="outing-trip-link" data-trip-id="${outingEscape(t.id)}"><span>✉</span><div><strong>与 ${outingEscape(t.charName)} 的小旅行</strong><small>${formatOutingTime(t.startedAt)} · ${outingEscape(t.destination || '随心走走')}</small></div><span>›</span></button>`).join('');
        list.querySelectorAll('[data-trip-id]').forEach(button => button.onclick = () => { outingViewedTripId = button.dataset.tripId; outingJournalView = 'letter'; renderOutingJournal(); });
    });
}

function playOutingDeparture(char) {
    const host = document.getElementById('outing-departure'); if (!host) return;
    host.innerHTML = `<div class="outing-departure-window"><div class="outing-departure-bar"><span>✧ A LITTLE ADVENTURE</span><button onclick="closeOutingDeparture()" aria-label="跳过出发动画">×</button></div><div class="outing-departure-scene"><span class="outing-sun">✿</span><div class="outing-walkers"><span class="outing-walker walker-user"><i>•ᴗ•</i></span><span class="outing-walker walker-char"><i>•ᴗ•</i></span></div><div class="outing-fence"></div></div><p>和 ${outingEscape(getOutingCharName(char))}，出发啦</p><small>今天的小事，也值得被记住。</small></div>`;
    host.hidden = false; setTimeout(closeOutingDeparture, 2800);
}
function closeOutingDeparture() { const host = document.getElementById('outing-departure'); if (host) host.hidden = true; }
Object.assign(window, { openOutingEditor, closeOutingModal, saveOutingEditor, chooseOutingMood, chooseOutingSticker, switchOutingJournal, changeOutingMonth, closeOutingDeparture, filterOutingNearby, loadOutingNearby });
