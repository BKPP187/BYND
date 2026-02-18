// --- 📱 script.js: 核心系统与路由 (最终完整版) ---

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initBattery();
    initDate();
    initLockScreen();
    initCalendar();
    
    if (typeof initIconGrid === 'function') initIconGrid();
    if (typeof initTheme === 'function') initTheme();
    if (typeof loadCharactersFromStorage === 'function') loadCharactersFromStorage(); 
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
    
    // 触发变色检查
    const statusBar = document.querySelector('.status-bar');
    if (typeof window.homeIsDark !== 'undefined') {
        if (window.homeIsDark) statusBar.classList.add('white-text');
        else statusBar.classList.remove('white-text');
    }
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

// --- 🌟 路由控制 (这里修复了！) ---

function openApp(appName) {
    // 1. 美化 App
    if (appName === 'theme') {
        const win = document.getElementById('app-theme-window');
        if (win) { 
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10); 
            if (typeof loadSavedSettings === 'function') loadSavedSettings();
        }
    } 
    // 在 openApp 函数的 else if 链中添加：
    else if (appName === 'sillytavern') {
        const win = document.getElementById('app-sillytavern-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            // 调用 wechat.js 里的新函数来渲染酒馆首页
            if (typeof initSillyTavern === 'function') initSillyTavern();
        }
    }
    // 2. 微信 App
    else if (appName === 'wechat') {
        const win = document.getElementById('app-wechat-window');
        if (win) { 
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof renderChatList === 'function') renderChatList(); 
        }
    } 
    // 3. 📖 世界书 App (新增)
    else if (appName === 'worldbook') {
        const win = document.getElementById('app-worldbook-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof initWorldBook === 'function') initWorldBook();
        }
    }
    // 4. 🛠️ 正则 App (新增)
    else if (appName === 'regex') {
        const win = document.getElementById('app-regex-window');
        if (win) {
            win.classList.remove('hidden');
            setTimeout(() => win.classList.add('active'), 10);
            if (typeof initRegexApp === 'function') initRegexApp();
        }
    }
    // 其他未开发
    else {
        alert("正在打开: " + appName + " (功能开发中...)");
    }
}

function closeApp(appName) {
    let winId = '';
    if (appName === 'theme') winId = 'app-theme-window';
    else if (appName === 'wechat') winId = 'app-wechat-window';
    else if (appName === 'worldbook') winId = 'app-worldbook-window';
    else if (appName === 'regex') winId = 'app-regex-window';
// 在 closeApp 函数的 if 判断中添加：
    else if (appName === 'sillytavern') winId = 'app-sillytavern-window';
    const win = document.getElementById(winId);
    if (win) { 
        win.classList.remove('active'); 
        setTimeout(() => win.classList.add('hidden'), 300); 
        
        // 如果是微信，还要顺便关掉聊天房
        if (appName === 'wechat' && typeof closeChat === 'function') {
            setTimeout(closeChat, 300);
        }
    }
}