// --- 基础功能 ---
function initClock() {
    const timeEl = document.getElementById('clock-time-small');
    if (!timeEl) return;
    setInterval(() => {
        const now = new Date();
        timeEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }, 1000);
}

function initBattery() {
    const levelEl = document.getElementById('battery-level');
    const iconEl = document.getElementById('battery-icon');
    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            const update = () => {
                levelEl.textContent = `${Math.round(battery.level * 100)}%`;
                iconEl.className = battery.charging ? "ri-battery-2-charge-fill" : "ri-battery-fill";
            };
            update();
        });
    } else {
        levelEl.textContent = "100%";
    }
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

