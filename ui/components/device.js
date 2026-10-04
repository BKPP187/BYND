// --- 基础功能 ---
function initClock() {
    const timeEl = document.getElementById('clock-time-small');
    if (!timeEl) return;
    const update = () => {
        const now = new Date();
        timeEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    };
    update();
    setInterval(update, 1000);
}

let deviceStatusInitialized = false;
function initBattery() {
    if (deviceStatusInitialized) return;
    deviceStatusInitialized = true;
    initDeviceNetwork();
    initNativeStatusBar();
    const levelEl = document.getElementById('battery-level');
    const iconEl = document.getElementById('battery-icon');
    const unavailable = () => {
        if (levelEl) levelEl.textContent = '--%';
        if (iconEl) {
            iconEl.hidden = true;
            iconEl.querySelector?.('[data-battery-fill]')?.setAttribute('width', '0');
            iconEl.setAttribute('aria-label', '无法读取设备电量');
        }
    };
    unavailable();
    if (typeof navigator.getBattery === 'function') {
        Promise.resolve().then(() => navigator.getBattery()).then(battery => {
            const update = () => {
                if (typeof battery.level !== 'number' || !Number.isFinite(battery.level) || battery.level < 0 || battery.level > 1) {
                    unavailable(); return;
                }
                const percent = Math.round(battery.level * 100);
                if (levelEl) levelEl.textContent = `${percent}%`;
                if (iconEl) {
                    iconEl.hidden = false;
                    iconEl.className = 'device-battery-icon' + (battery.charging ? ' is-charging' : '') + (percent <= 20 ? ' is-low' : '');
                    // SVG chamber is 18 units wide: charging never replaces the level fill.
                    iconEl.querySelector?.('[data-battery-fill]')?.setAttribute('width', (18 * percent / 100).toFixed(2));
                    iconEl.setAttribute('aria-label', `电量 ${percent}%${battery.charging ? '，正在充电' : ''}`);
                }
            };
            update();
            battery.addEventListener('levelchange', update);
            battery.addEventListener('chargingchange', update);
            document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
        }).catch(unavailable);
    }
}

function initDeviceNetwork() {
    const icon = document.getElementById('network-icon');
    const label = document.getElementById('network-label');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const update = () => {
        if (!icon) return;
        const offline = navigator.onLine === false || connection?.type === 'none';
        const type = offline ? 'none' : connection?.type;
        // effectiveType describes throughput, never Wi-Fi/cellular transport or signal strength.
        icon.className = offline ? 'ri-wifi-off-line' : type === 'wifi' ? 'ri-wifi-line' : type === 'cellular' ? 'ri-sim-card-line' : 'ri-global-line';
        const description = offline ? '设备离线' : type === 'wifi' ? '已连接 Wi-Fi' : type === 'cellular' ? '正在使用移动数据' : '设备在线，无法读取网络类型';
        icon.hidden = false;
        icon.setAttribute('aria-label', description);
        icon.title = description;
        if (label) { label.hidden = type !== 'cellular'; label.textContent = type === 'cellular' ? '蜂窝' : ''; }
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    connection?.addEventListener?.('change', update);
    update();
}

function initNativeStatusBar() {
    const bridge = window.ByndAndroid;
    if (typeof bridge?.setSystemStatusBar !== 'function') return;
    document.documentElement.classList.add('bynd-native-statusbar');
    let previous = '';
    const sync = () => {
        const enabled = !document.documentElement.classList.contains('bynd-statusbar-hidden');
        const appOpen = !!document.querySelector('.app-window.active');
        const lock = document.getElementById('lock-screen');
        const locked = lock && !lock.classList.contains('unlocked');
        const lightIcons = !appOpen && (locked ? !!window.lockIsDark : !!window.homeIsDark);
        const next = `${enabled}:${lightIcons}`;
        if (previous === next) return;
        try { bridge.setSystemStatusBar(enabled, lightIcons); previous = next; }
        catch (error) { console.warn('Unable to update system status bar', error); }
    };
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });
    document.addEventListener('visibilitychange', sync);
    window.syncNativeStatusBar = sync;
    sync();
}

function initLockScreen() {
    const bigClock = document.getElementById('ls-big-clock');
    const updateTime = () => {
        const now = new Date();
        if(bigClock) bigClock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    };
    setInterval(updateTime, 1000);
    updateTime();
}

function initDate() {
    const dateEl = document.getElementById('ls-date');
    if (!dateEl) return;
    if (typeof window.updateLockDateDisplay === 'function') {
        window.updateLockDateDisplay();
        return;
    }
    const now = new Date();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    dateEl.innerHTML = `<span>${weekdays[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}</span>`;
}

function unlockPhone() {
    document.getElementById('lock-screen')?.classList.add('unlocked');
    document.getElementById('home-screen')?.classList.remove('hidden');
    resetDesktopToFirstPage();
    if (typeof scheduleDesktopVisibleLayoutRepair === 'function') scheduleDesktopVisibleLayoutRepair();
    if (typeof syncMonitorPetFloating === 'function') syncMonitorPetFloating();
    
    // 触发变色检查
    const statusBar = document.querySelector('.status-bar');
    if (statusBar && typeof window.homeIsDark !== 'undefined') {
        if (window.homeIsDark) statusBar.classList.add('white-text');
        else statusBar.classList.remove('white-text');
    }
}

function initCalendar() {
    const widgets = Array.from(document.querySelectorAll('.calendar-widget'));
    if (!widgets.length) return;

    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const today = now.getDate();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    widgets.forEach(widget => {
        const dayNameEl = widget.querySelector('.cal-day');
        const dateNumEl = widget.querySelector('.cal-date');
        const monthNameEl = widget.querySelector('.cal-month');
        const gridEl = widget.querySelector('.cal-grid');
        if (dayNameEl) dayNameEl.textContent = days[now.getDay()];
        if (dateNumEl) dateNumEl.textContent = today;
        if (monthNameEl) monthNameEl.textContent = months[now.getMonth()];
        if (!gridEl) return;
        gridEl.innerHTML = '';
        for (let i = 1; i <= totalDays; i++) {
            const dot = document.createElement('div');
            dot.className = 'cal-dot';
            dot.textContent = i;
            if (i === today) dot.classList.add('active');
            gridEl.appendChild(dot);
        }
    });
}

