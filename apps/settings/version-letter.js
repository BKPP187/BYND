(function () {
    'use strict';

    const storageKey = 'bynd_lastSeenVersion';
    const currentVersion = APP_VERSION.replace(/^v/, '');
    // Last committed release before version letters. Existing installations get
    // the first real update; a clean install establishes its current baseline.
    const legacyVersion = '1.1.704';
    const legacyKeys = ['my_characters_data', 'my_characters_data_meta', 'my_api_data', 'my_theme_data', 'desktop_layout_v2', 'bynd_startup_seen_v1'];
    let attempted = false;
    let activeLetter = null;

    function parseVersion(value) {
        const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value || ''));
        if (!match) return null;
        const parts = match.slice(1).map(Number);
        return parts.every(Number.isSafeInteger) ? parts : null;
    }

    function compareVersions(left, right) {
        const a = parseVersion(left), b = parseVersion(right);
        if (!a || !b) return null;
        for (let i = 0; i < 3; i++) {
            if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
        }
        return 0;
    }

    function releasedNotes(version = currentVersion, releases = window.ByndReleases || []) {
        return releases.filter(release => {
            const order = compareVersions(release.version, version);
            return order !== null && order <= 0;
        }).sort((a, b) => compareVersions(b.version, a.version));
    }

    function pendingRelease(version, lastSeenVersion, releases = window.ByndReleases || []) {
        if (compareVersions(version, lastSeenVersion) !== 1) return null;
        return releasedNotes(version, releases).find(release => release.announce === true
            && compareVersions(release.version, lastSeenVersion) === 1) || null;
    }

    // Capture before app initialization writes defaults into a fresh installation.
    const initialState = (() => {
        try {
            const seen = localStorage.getItem(storageKey);
            if (seen !== null) return { seen: parseVersion(seen) ? seen : currentVersion };
            const existing = legacyKeys.some(key => localStorage.getItem(key) !== null);
            return { seen: existing ? legacyVersion : currentVersion };
        } catch (error) {
            console.warn('版本来信：无法读取已读版本', error);
            return { error };
        }
    })();

    function rememberVersion() {
        try {
            const stored = localStorage.getItem(storageKey);
            if (compareVersions(stored, currentVersion) !== 1) localStorage.setItem(storageKey, currentVersion);
            return true;
        } catch (error) {
            console.warn('版本来信：已读版本保存失败', error);
            return false;
        }
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function renderSections(release) {
        const root = element('div', 'bynd-release-sections');
        for (const [key, label] of [['new', 'NEW'], ['improved', 'IMPROVED'], ['fixed', 'FIXED']]) {
            if (!Array.isArray(release[key]) || !release[key].length) continue;
            const section = element('section', 'bynd-release-section');
            const heading = element('h3', '', label);
            heading.appendChild(element('span', 'bynd-release-count', `${release[key].length} ITEMS`));
            section.appendChild(heading);
            const list = element('ul');
            release[key].forEach((item, index) => {
                const row = element('li');
                row.appendChild(element('small', 'bynd-release-number', `#${String(index + 1).padStart(2, '0')}`));
                row.appendChild(element('span', 'bynd-release-text', item));
                list.appendChild(row);
            });
            section.appendChild(list);
            root.appendChild(section);
        }
        return root;
    }

    function showLetter(release, { automatic = false } = {}) {
        const phone = document.querySelector('.phone-container');
        if (!phone || !release || activeLetter) return false;
        const previousFocus = document.activeElement;
        const overlay = element('section', 'bynd-version-letter');
        overlay.id = 'bynd-version-letter';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'bynd-letter-title');
        const scroll = element('div', 'bynd-letter-scroll');
        scroll.tabIndex = 0;
        scroll.setAttribute('aria-label', '本次更新内容');
        const ticket = element('article', 'bynd-letter-ticket');
        const artwork = element('img', 'bynd-letter-art');
        artwork.src = `assets/ui/version-letter-header.svg?v=${currentVersion}`;
        artwork.alt = '';
        ticket.appendChild(artwork);
        const content = element('div', 'bynd-letter-content');
        content.appendChild(element('p', 'bynd-letter-brand', `BYND · ${release.version}`));
        const title = element('h2', 'bynd-letter-title', 'BYND 更新来信');
        title.id = 'bynd-letter-title';
        content.appendChild(title);
        content.appendChild(element('p', 'bynd-letter-subtitle', 'A LITTLE MORE OF US'));
        const meta = element('div', 'bynd-letter-meta');
        const lines = element('div');
        lines.appendChild(element('p', '', `Issue: No.${release.version.split('.').at(-1)}`));
        lines.appendChild(element('p', '', `Date: ${release.date.replaceAll('-', ' / ')}`));
        meta.appendChild(lines);
        meta.appendChild(element('span', 'bynd-letter-stamp', 'BYND\n来信已送达'));
        content.appendChild(meta);
        content.appendChild(element('p', 'bynd-letter-intro', release.intro));
        content.appendChild(renderSections(release));
        ticket.appendChild(content);
        scroll.appendChild(ticket);
        overlay.appendChild(scroll);

        const footer = element('footer', 'bynd-letter-footer');
        const button = element('button', 'bynd-letter-go', '去看看新东西');
        button.type = 'button';
        footer.appendChild(button);
        footer.appendChild(element('p', 'bynd-letter-end', 'HAVE A NICE DAY'));
        footer.appendChild(element('p', 'bynd-letter-hint', '以后可在「关于 BYND」\n查看全部更新记录'));
        const status = element('p', 'bynd-letter-status');
        status.setAttribute('role', 'status');
        footer.appendChild(status);
        ticket.appendChild(footer);

        const siblings = Array.from(phone.children).map(node => ({ node, inert: node.inert }));
        const close = () => {
            overlay.remove();
            siblings.forEach(({ node, inert }) => { node.inert = inert; });
            activeLetter = null;
            if (automatic) {
                if (typeof unlockPhone === 'function') unlockPhone();
                document.getElementById('home-screen')?.setAttribute('tabindex', '-1');
                document.getElementById('home-screen')?.focus({ preventScroll: true });
            } else if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        };
        button.addEventListener('click', close);
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key === 'Tab') {
                event.preventDefault();
                (document.activeElement === button ? scroll : button).focus({ preventScroll: true });
            }
        });
        phone.appendChild(overlay);
        siblings.forEach(({ node }) => { node.inert = true; });
        activeLetter = overlay;
        // Mark when actually displayed, so relaunching before tapping won't repeat it.
        if (automatic && !rememberVersion()) status.textContent = '未能保存已读版本，重新打开可能再次提醒。';
        button.focus({ preventScroll: true });
        return true;
    }

    function init() {
        if (attempted) return false;
        attempted = true;
        if (initialState.error) return false; // Unreadable storage must not nag on every launch.
        const release = pendingRelease(currentVersion, initialState.seen);
        if (release) return showLetter(release, { automatic: true });
        rememberVersion(); // Quiet patches advance the baseline too; never downgrade it.
        return false;
    }

    function renderAbout() {
        const root = document.getElementById('bynd-update-history');
        if (!root) return;
        document.getElementById('bynd-about-version').textContent = `v${currentVersion}`;
        root.replaceChildren();
        for (const release of releasedNotes()) {
            const article = element('article', 'bynd-history-entry');
            const heading = element('header', 'bynd-history-heading');
            heading.appendChild(element('h3', '', `BYND · ${release.version}`));
            const date = element('time', '', release.date);
            date.dateTime = release.date;
            heading.appendChild(date);
            article.appendChild(heading);
            article.appendChild(element('p', 'bynd-history-intro', release.intro));
            article.appendChild(renderSections(release));
            if (release.announce) {
                const replay = element('button', 'bynd-history-replay', '重读这封版本来信');
                replay.type = 'button';
                replay.addEventListener('click', () => showLetter(release));
                article.appendChild(replay);
            }
            root.appendChild(article);
        }
        if (!root.children.length) root.appendChild(element('p', 'bynd-history-intro', '更新记录会从版本来信上线后开始保存。'));
    }

    window.ByndVersionLetter = { init, renderAbout, storageKey, currentVersion, compareVersions, pendingRelease, releasedNotes };
})();
