// --- 📱 script.js: 核心系统与路由 ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化核心功能
    initClock();
    initBattery();
    initDate();
    initLockScreen();
    initCalendar();
    
    // 2. 初始化其他模块 (如果在 html 中引入了)
    if (typeof initIconGrid === 'function') initIconGrid();
    if (typeof initTheme === 'function') initTheme(); 
});

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
    if (dateEl) dateEl.textContent = new Date().toDateString().slice(0, 10) + " ☁️ 24°";
}

function unlockPhone() {
    document.getElementById('lock-screen').classList.add('unlocked');
    document.getElementById('home-screen').classList.remove('hidden');
}

function initCalendar() {
    const dayNameEl = document.getElementById('cal-day-name');
    const dateNumEl = document.getElementById('cal-date-num');
    const monthNameEl = document.getElementById('cal-month-name');
    const gridEl = document.getElementById('cal-grid');

    if (!dateNumEl) return;

    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    dayNameEl.textContent = days[now.getDay()];
    dateNumEl.textContent = now.getDate();
    monthNameEl.textContent = months[now.getMonth()];

    gridEl.innerHTML = ''; 
    const today = now.getDate();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); 

    for (let i = 1; i <= totalDays; i++) {
        const dot = document.createElement('div');
        dot.className = 'cal-dot';
        dot.textContent = i;
        if (i === today) dot.classList.add('active');
        gridEl.appendChild(dot);
    }
}

// --- 统一路由控制 (App Switcher) ---

function openApp(appName) {
    if (appName === 'theme') {
        const win = document.getElementById('app-theme-window');
        if (win) { 
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10); 
            // 调用 theme.js 里的读取设置
            if (typeof loadSavedSettings === 'function') loadSavedSettings();
        }
    } 
    else if (appName === 'wechat') {
        const win = document.getElementById('app-wechat-window');
        if (win) { 
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10);
            // 调用 wechat.js 里的渲染列表
            if (typeof renderChatList === 'function') renderChatList(); 
        }
    } 
    else if (appName === 'preset') {
        alert("预设功能开发中... \n这里将配置正则和API！");
    } 
    else {
        alert("正在打开: " + appName);
    }
}

function closeApp(appName) {
    if (appName === 'theme') {
        const win = document.getElementById('app-theme-window');
        if (win) { win.classList.remove('active'); setTimeout(() => win.classList.add('hidden'), 300); }
    } 
    else if (appName === 'wechat') {
        const win = document.getElementById('app-wechat-window');
        if (win) { 
            win.classList.remove('active'); 
            setTimeout(() => win.classList.add('hidden'), 300);
            // 退出微信时关闭子窗口
            setTimeout(() => {
                if (typeof closeChat === 'function') closeChat();
            }, 300);
        }
    }
}