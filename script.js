// script.js

// 1. 初始化
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initBattery();
    initDate();     // 刚才 HTML 里加了日期，这里 JS 也要加上
    initLockScreen(); // 锁屏逻辑
});

// --- 时钟逻辑 ---
function initClock() {
    const timeEl = document.getElementById('clock-time-small');
    if (!timeEl) return;
    
    setInterval(() => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeEl.textContent = `${hours}:${minutes}`;
    }, 1000);
}

// --- 电池逻辑 ---
function initBattery() {
    const levelEl = document.getElementById('battery-level');
    const iconEl = document.getElementById('battery-icon');

    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            const updateBatteryUI = () => {
                const level = Math.round(battery.level * 100);
                levelEl.textContent = `${level}%`;
                if (battery.charging) {
                    iconEl.className = "ri-battery-2-charge-fill"; 
                } else {
                    if (level > 80) iconEl.className = "ri-battery-fill";
                    else iconEl.className = "ri-battery-line";
                }
            }
            updateBatteryUI();
            battery.addEventListener('levelchange', updateBatteryUI);
            battery.addEventListener('chargingchange', updateBatteryUI);
        });
    } else {
        levelEl.textContent = "100%";
    }
}

// --- 🔒 锁屏独有逻辑 ---

// 1. 锁屏大时钟 & 日期
function initLockScreen() {
    const bigClock = document.getElementById('ls-big-clock');
    
    function updateBigTime() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        if (bigClock) bigClock.textContent = `${h}:${m}`;
    }
    setInterval(updateBigTime, 1000);
    updateBigTime();
}

// 2. 锁屏日期
function initDate() {
    const dateEl = document.getElementById('ls-date');
    if (!dateEl) return;
    const now = new Date();
    // 简单格式：Mon, 13 Apr
    const dateStr = now.toDateString().slice(0, 10); 
    dateEl.textContent = dateStr + " ☁️ 24°";
}

// 3. 解锁功能
function unlockPhone() {
    const lockScreen = document.getElementById('lock-screen');
    const homeScreen = document.getElementById('home-screen');
    
    if (lockScreen && homeScreen) {
        lockScreen.classList.add('unlocked'); // 上滑
        homeScreen.classList.remove('hidden'); // 显示桌面
        console.log("解锁成功！");
    }
}
// --- 📅 桌面日历组件逻辑 ---
function initCalendar() {
    const dayNameEl = document.getElementById('cal-day-name');
    const dateNumEl = document.getElementById('cal-date-num');
    const monthNameEl = document.getElementById('cal-month-name');
    const gridEl = document.getElementById('cal-grid');

    if (!dateNumEl) return;

    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // 1. 设置文字
    dayNameEl.textContent = days[now.getDay()];
    dateNumEl.textContent = now.getDate();
    monthNameEl.textContent = months[now.getMonth()];

// 2. 生成小格子 (带数字)
    gridEl.innerHTML = ''; 
    const today = now.getDate();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); 

    for (let i = 1; i <= totalDays; i++) {
        const dot = document.createElement('div');
        dot.className = 'cal-dot';
        dot.textContent = i; // <--- 关键修改：把数字 i 填进去
        
        // 如果是今天
        if (i === today) {
            dot.classList.add('active');
        }
        gridEl.appendChild(dot);
    }
}

// 别忘了在 initApp 或者 DOMContentLoaded 里调用它
document.addEventListener('DOMContentLoaded', () => {
    // ...之前的代码...
    initCalendar(); // <--- 加上这一句！
});