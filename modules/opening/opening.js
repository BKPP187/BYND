(() => {
    const KEY = 'bynd_opening_seen_v1';
    const root = document.getElementById('bynd-opening');
    if (!root) return;
    let shown = document.documentElement.classList.contains('bynd-opening-pending');
    try { shown = !localStorage.getItem(KEY); } catch (_) {}
    if (!shown) {
        document.documentElement.classList.remove('bynd-opening-pending');
        root.remove();
        return;
    }
    document.documentElement.classList.add('bynd-opening-pending');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
        if (!root.isConnected) return;
        try { localStorage.setItem(KEY, String(Date.now())); } catch (_) {}
        root.classList.add('is-leaving');
        document.documentElement.classList.remove('bynd-opening-pending');
        setTimeout(() => root.remove(), 500);
    };
    root.querySelector('#bynd-opening-skip')?.addEventListener('click', finish);
    const timer = setTimeout(finish, reduced ? 1500 : 6600);
    window.addEventListener('pagehide', () => clearTimeout(timer), { once: true });
})();
