let manualSearchMarks = [];
let manualSearchMarkIndex = -1;

function getManualSections() {
    return Array.from(document.querySelectorAll('#manual-sections .manual-section'));
}

function getManualSearchIdleStatus() {
    return '查找完整短语并定位每一处';
}

function updateManualMatchNavigation() {
    const nav = document.getElementById('manual-match-nav');
    const count = document.getElementById('manual-match-count');
    const hasMatches = manualSearchMarks.length > 0;
    nav?.classList.toggle('hidden', !hasMatches);
    if (count) {
        count.textContent = hasMatches ? `${manualSearchMarkIndex + 1}/${manualSearchMarks.length}` : '0/0';
    }
}

function clearManualHighlights() {
    const parents = new Set();
    document.querySelectorAll('#manual-sections mark.manual-search-mark').forEach(mark => {
        const parent = mark.parentNode;
        if (parent) parents.add(parent);
        mark.replaceWith(document.createTextNode(mark.textContent || ''));
    });
    parents.forEach(parent => parent.normalize());
    manualSearchMarks = [];
    manualSearchMarkIndex = -1;
    updateManualMatchNavigation();
}

function highlightManualPhrase(section, query) {
    const normalizedQuery = query.toLocaleLowerCase();
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.nodeValue || !node.parentElement) return NodeFilter.FILTER_REJECT;
            if (node.parentElement.closest('mark.manual-search-mark')) return NodeFilter.FILTER_REJECT;
            return node.nodeValue.toLocaleLowerCase().includes(normalizedQuery)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        }
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    const marks = [];
    textNodes.forEach(node => {
        const text = node.nodeValue || '';
        const lowered = text.toLocaleLowerCase();
        const fragment = document.createDocumentFragment();
        let cursor = 0;
        let matchIndex = lowered.indexOf(normalizedQuery);
        while (matchIndex !== -1) {
            if (matchIndex > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, matchIndex)));
            const mark = document.createElement('mark');
            mark.className = 'manual-search-mark';
            mark.textContent = text.slice(matchIndex, matchIndex + query.length);
            fragment.appendChild(mark);
            marks.push(mark);
            cursor = matchIndex + query.length;
            matchIndex = lowered.indexOf(normalizedQuery, cursor);
        }
        if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)));
        node.replaceWith(fragment);
    });
    return marks;
}

function scrollToManualMatch(index) {
    if (!manualSearchMarks.length) return;
    manualSearchMarkIndex = (index + manualSearchMarks.length) % manualSearchMarks.length;
    manualSearchMarks.forEach((mark, markIndex) => {
        mark.classList.toggle('active', markIndex === manualSearchMarkIndex);
        mark.setAttribute('aria-current', markIndex === manualSearchMarkIndex ? 'true' : 'false');
    });
    updateManualMatchNavigation();
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    manualSearchMarks[manualSearchMarkIndex].scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'center',
        inline: 'nearest'
    });
}

function goToManualMatch(direction) {
    if (!manualSearchMarks.length) return;
    scrollToManualMatch(manualSearchMarkIndex + Number(direction || 0));
}
window.goToManualMatch = goToManualMatch;

function resetManualSearchState() {
    clearManualHighlights();
    const input = document.getElementById('manual-search-input');
    if (input) input.value = '';
    getManualSections().forEach(section => { section.hidden = false; });
    document.getElementById('manual-no-results')?.classList.add('hidden');
    const status = document.getElementById('manual-search-status');
    if (status) status.textContent = getManualSearchIdleStatus();
    const toggle = document.querySelector('.manual-list-head button');
    if (toggle) toggle.textContent = '全部展开';
    updateManualMatchNavigation();
}

function initManualApp() {
    const win = document.getElementById('app-manual-window');
    const home = document.getElementById('home-screen');
    win?.classList.toggle('manual-dark-mode', !!(home?.classList.contains('dark-mode') || window.homeIsDark));
    resetManualSearchState();
    const sections = getManualSections();
    sections.forEach((section, index) => {
        section.open = index === 0;
    });
    const scroll = document.getElementById('manual-scroll');
    if (scroll) scroll.scrollTop = 0;
    requestAnimationFrame(() => win?.querySelector('.manual-back')?.focus({ preventScroll: true }));
}
window.initManualApp = initManualApp;

function handleManualSearch(value) {
    const query = String(value || '').trim();
    const sections = getManualSections();
    clearManualHighlights();

    if (query) {
        sections.forEach(section => {
            const sectionMarks = highlightManualPhrase(section, query);
            section.hidden = sectionMarks.length === 0;
            if (sectionMarks.length) {
                section.open = true;
                manualSearchMarks.push(...sectionMarks);
            }
        });
    } else {
        sections.forEach(section => { section.hidden = false; });
    }

    document.getElementById('manual-no-results')?.classList.toggle('hidden', !query || manualSearchMarks.length > 0);
    const status = document.getElementById('manual-search-status');
    if (status) {
        status.textContent = query
            ? `找到 ${manualSearchMarks.length} 处精准命中`
            : getManualSearchIdleStatus();
    }
    const toggle = document.querySelector('.manual-list-head button');
    if (toggle) toggle.textContent = '全部展开';
    manualSearchMarkIndex = manualSearchMarks.length ? 0 : -1;
    updateManualMatchNavigation();
    if (manualSearchMarks.length) {
        const firstMark = manualSearchMarks[0];
        requestAnimationFrame(() => {
            if (manualSearchMarks[0] === firstMark) scrollToManualMatch(0);
        });
    }
}
window.handleManualSearch = handleManualSearch;

function clearManualSearch() {
    const input = document.getElementById('manual-search-input');
    if (input) input.value = '';
    handleManualSearch('');
    if (input) input.focus({ preventScroll: true });
}
window.clearManualSearch = clearManualSearch;

function manualGoToSection(sectionId) {
    const input = document.getElementById('manual-search-input');
    if (input) input.value = '';
    handleManualSearch('');
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.open = true;
    requestAnimationFrame(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}
window.manualGoToSection = manualGoToSection;

function manualScrollToTop() {
    document.getElementById('manual-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
}
window.manualScrollToTop = manualScrollToTop;

function toggleAllManualSections() {
    const sections = Array.from(document.querySelectorAll('#manual-sections .manual-section:not([hidden])'));
    const shouldOpen = sections.some(section => !section.open);
    sections.forEach(section => { section.open = shouldOpen; });
    const toggle = document.querySelector('.manual-list-head button');
    if (toggle) toggle.textContent = shouldOpen ? '全部收起' : '全部展开';
}
window.toggleAllManualSections = toggleAllManualSections;

