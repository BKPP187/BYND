let coreadCalendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let coreadCalendarDay = '';

function shiftCoReadCalendar(delta) {
    coreadCalendarMonth = new Date(coreadCalendarMonth.getFullYear(), coreadCalendarMonth.getMonth() + delta, 1);
    coreadCalendarDay = '';
    renderCoReadCalendarStats();
}
window.shiftCoReadCalendar = shiftCoReadCalendar;
function chooseCoReadCalendarDay(date) { coreadCalendarDay = date; renderCoReadCalendarStats(); }
window.chooseCoReadCalendarDay = chooseCoReadCalendarDay;

function coReadActivityCover(book) {
    return `<span class="coread-activity-cover">${book.coverUrl ? `<img alt="" loading="lazy" src="${musicEscapeAttr(book.coverUrl)}" onerror="this.hidden=true">` : ''}<span>${musicEscapeHtml(String(book.title || '书').slice(0, 2))}</span></span>`;
}
function openCoReadActivityBook(id) {
    if (getCoReadBook(id)) startCoReadBook(id);
}
window.openCoReadActivityBook = openCoReadActivityBook;
function rateCoReadActivityBook(id, value) {
    const library = getCoReadLibrary().map(book => ({ ...book }));
    const book = library.find(book => book.id === id);
    if (!book) return;
    book.rating = Math.max(0, Math.min(5, Number(value) || 0));
    try { saveCoReadLibrary(library); renderCoReadCalendarStats(); }
    catch (error) {
        renderCoReadCalendarStats();
        const status = document.getElementById('coread-activity-error');
        if (status) status.textContent = `评分未保存：${error.message || error}`;
    }
}
window.rateCoReadActivityBook = rateCoReadActivityBook;

function buildCoReadReadingInsights(month = coreadCalendarMonth, library = getCoReadLibrary()) {
    const start = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
    const rows = CoReadJournal.entries(start, end, library);
    const books = CoReadJournal.aggregate(rows);
    const yearStart = new Date(month.getFullYear(), 0, 1).getTime();
    const yearEnd = new Date(month.getFullYear() + 1, 0, 1).getTime();
    const annual = CoReadJournal.entries(yearStart, yearEnd, library);
    const yearBooks = CoReadJournal.aggregate(annual);
    const finishedMonths = Array.from({ length: 12 }, (_, index) => CoReadJournal.aggregate(annual.filter(row =>
        row.finishedAt && new Date(row.finishedAt).getMonth() === index)));
    const groups = new Map(), authors = new Map();
    const ratings = [0,0,0,0,0];
    yearBooks.forEach(item => {
        const tags = typeof getCoReadBookTags === 'function' ? getCoReadBookTags(item.book) : item.book.tags || [];
        const group = tags[0] || '未分类';
        groups.set(group, (groups.get(group) || 0) + 1);
        const author = String(item.book.author || '未知作者');
        authors.set(author, (authors.get(author) || 0) + 1);
        const rating = Math.round(Number(item.book.rating) || 0);
        if (rating >= 1 && rating <= 5) ratings[rating - 1]++;
    });
    const dates = [...new Set(annual.map(row => row.date))].sort();
    let bestStreak = 0, streak = 0, previous = null;
    for (const date of dates) {
        const stamp = new Date(date + 'T12:00:00');
        const expected = previous ? new Date(previous.getFullYear(), previous.getMonth(), previous.getDate() + 1) : null;
        streak = expected && CoReadJournal.dateKey(expected) === date ? streak + 1 : 1;
        bestStreak = Math.max(bestStreak, streak); previous = stamp;
    }
    return { rows, books, yearBooks, finishedMonths, groups: [...groups].sort((a,b) => b[1]-a[1]),
        authors: [...authors].sort((a,b) => b[1]-a[1]), ratings, bestStreak,
        minutes: rows.reduce((sum, row) => sum + row.seconds, 0) / 60,
        readDays: new Set(rows.map(row => row.date)).size };
}

function renderCoReadCalendarStats() {
    const stats = document.getElementById('coread-me-stats');
    const calendar = document.getElementById('coread-reading-calendar');
    if (!calendar) return;
    let model;
    try { model = buildCoReadReadingInsights(); }
    catch (error) { calendar.innerHTML = `<p class="coread-activity-error" role="alert">${musicEscapeHtml(`无法读取阅读记录：${error.message || error}`)}</p>`; return; }
    const year = coreadCalendarMonth.getFullYear(), month = coreadCalendarMonth.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    if (!coreadCalendarDay.startsWith(prefix)) coreadCalendarDay = prefix + String(new Date().getFullYear() === year && new Date().getMonth() === month ? new Date().getDate() : 1).padStart(2,'0');
    const days = new Date(year, month + 1, 0).getDate();
    const leading = new Date(year, month, 1).getDay();
    const dayRows = model.rows.filter(row => row.date === coreadCalendarDay);
    const finished = model.books.filter(item => item.finishedAt).length;
    if (stats) stats.innerHTML = `<div><strong>${model.books.length}</strong><span>本月读过</span></div><div><strong>${model.readDays}</strong><span>阅读天数</span></div><div><strong>${finished}</strong><span>本月读完</span></div>`;
    const bookRow = (item, rating = false) => {
        const book = item.book || item;
        const exists = !!getCoReadBook(book.id);
        return `<article class="coread-activity-book"><button type="button" data-book-id="${musicEscapeAttr(book.id)}" onclick="openCoReadActivityBook(this.dataset.bookId)" ${exists ? '' : 'disabled'}>
            ${coReadActivityCover(book)}<span><strong>${musicEscapeHtml(book.title)}</strong><small>${musicEscapeHtml(book.author || '未知作者')} · ${formatCoReadStatMinutes((item.seconds || 0) / 60)}${exists ? '' : ' · 已移出书架'}</small></span></button>
            ${rating && exists ? `<label>评分<select aria-label="${musicEscapeAttr(book.title)}评分" data-book-id="${musicEscapeAttr(book.id)}" onchange="rateCoReadActivityBook(this.dataset.bookId,this.value)">
                ${Array.from({length:6}, (_, rating) => `<option value="${rating}" ${Math.round(Number(book.rating) || 0) === rating ? 'selected' : ''}>${rating ? `${rating} 星` : '未评分'}</option>`).join('')}</select></label>` : ''}</article>`;
    };
    const palette = ['#202020','#777777','#a2a2a2','#c3c3c3','#dddddd','#555555'];
    let angle = 0;
    const segments = model.groups.map(([_, count], index) => {
        const from = angle; angle += count / Math.max(1, model.yearBooks.length) * 100;
        return `${palette[index % palette.length]} ${from}% ${angle}%`;
    });
    const ratingCount = model.ratings.reduce((sum, count) => sum + count, 0);
    const average = ratingCount ? (model.ratings.reduce((sum,count,index) => sum + count * (index + 1),0) / ratingCount).toFixed(1) : '—';
    const maxFinished = Math.max(1, ...model.finishedMonths.map(items => items.length));
    calendar.innerHTML = `
        <section class="coread-activity-card">
            <header class="coread-activity-head"><button type="button" onclick="shiftCoReadCalendar(-1)" aria-label="上个月">‹</button><strong>${year} / ${String(month + 1).padStart(2,'0')}</strong><button type="button" onclick="shiftCoReadCalendar(1)" aria-label="下个月">›</button></header>
            <p class="coread-streak">今年最长连续阅读 <b>${model.bestStreak}</b> 天</p>
            <div class="coread-activity-weekdays" aria-hidden="true">${['日','一','二','三','四','五','六'].map(day => `<span>${day}</span>`).join('')}</div>
            <div class="coread-book-calendar">${'<span class="coread-calendar-blank"></span>'.repeat(leading)}${Array.from({length:days},(_,index) => {
                const date = prefix + String(index + 1).padStart(2,'0');
                const entries = model.rows.filter(row => row.date === date);
                return `<button type="button" class="${entries.length ? 'has-reading ' : ''}${date === coreadCalendarDay ? 'selected' : ''}" data-day="${date}" onclick="chooseCoReadCalendarDay(this.dataset.day)" aria-label="${musicEscapeAttr(date + '，' + (entries.length ? entries.map(row=>row.title).join('、') : '没有阅读记录'))}" aria-pressed="${date === coreadCalendarDay}">
                    <span>${index + 1}</span>${entries[0] ? coReadActivityCover(entries[0].book) : ''}${entries.length > 1 ? `<small>+${entries.length - 1}</small>` : ''}</button>`;
            }).join('')}</div>
            <div class="coread-activity-day"><h3>${musicEscapeHtml(coreadCalendarDay)} <span>${dayRows.length} 本</span></h3>${dayRows.map(row => bookRow(row)).join('') || '<p class="coread-activity-empty">这一天没有阅读记录</p>'}</div>
            <small class="coread-activity-note">从本次更新起记录实际阅读；时长只计前台阅读，静置两分钟后暂停。</small>
        </section>
        <section class="coread-activity-card"><header><h3>本月书籍</h3><small>${model.books.length} 本 · ${formatCoReadStatMinutes(model.minutes)}</small></header>
            <div id="coread-activity-error" class="coread-activity-error" role="status"></div>
            ${model.books.map(item => bookRow(item, true)).join('') || '<p class="coread-activity-empty">这个月还没有阅读记录</p>'}
        </section>
        <section class="coread-activity-card"><header><h3>${year} 年读完的书</h3><strong>${model.finishedMonths.reduce((sum,items)=>sum+items.length,0)} 本</strong></header>
            <div class="coread-finished-chart">${model.finishedMonths.map((items,index) => `<button type="button" data-month="${index}" onclick="coreadCalendarMonth=new Date(${year},Number(this.dataset.month),1);coreadCalendarDay='';renderCoReadCalendarStats()" aria-label="${index+1}月读完${items.length}本">
                <span>${index+1}月</span><div><i style="width:${items.length/maxFinished*100}%"></i><div class="coread-finished-covers">${items.slice(0,6).map(item=>coReadActivityCover(item.book)).join('')}</div></div><b>${items.length}</b></button>`).join('')}</div>
            <small class="coread-activity-note">读完统计需浏览全部页，并在末页停留至少 5 秒。</small>
        </section>
        <section class="coread-activity-card"><header><h3>阅读分类</h3><small>${year} 年 · 按首个标签</small></header>
            <div class="coread-genre-chart"><div role="img" aria-label="${musicEscapeAttr(model.groups.map(([name,count])=>`${name}${count}本`).join('，') || '暂无分类数据')}" style="background:conic-gradient(${segments.join(',') || '#e9e8e5 0% 100%'})"><span>${model.yearBooks.length}<small>本书</small></span></div>
                <ul>${model.groups.map(([name,count],index)=>`<li><i style="background:${palette[index%palette.length]}"></i><span>${musicEscapeHtml(name)}</span><b>${count}</b></li>`).join('') || '<li>暂无分类数据</li>'}</ul></div>
        </section>
        <section class="coread-activity-card"><header><h3>平均评分 <strong>${average}</strong></h3><small>${ratingCount} 本已评分</small></header>
            <div class="coread-rating-chart" role="img" aria-label="${model.ratings.map((count,index)=>`${index+1}星${count}本`).join('，')}">${model.ratings.map((count,index)=>`<div><b>${count}</b><span><i style="height:${count/Math.max(1,...model.ratings)*100}%"></i></span><small>${index+1} 星</small></div>`).join('')}</div>
        </section>
        <section class="coread-activity-card"><header><h3>常读作者</h3><small>${year} 年 · 读过的书</small></header><ol class="coread-author-chart">${model.authors.slice(0,5).map(([author,count])=>`<li><span>${musicEscapeHtml(author)}</span><div><i style="width:${count/Math.max(1,...model.authors.map(item=>item[1]))*100}%"></i></div><b>${count} 本</b></li>`).join('') || '<li>暂无作者数据</li>'}</ol></section>`;
}
