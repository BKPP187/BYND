document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initBattery();
    initDate();
    initLockScreen();
    initCalendar();
    initTheme(); // 初始化加载主题
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

// --- ⭐ 修复重点：美化 App 逻辑 ---

function openApp(appName) {
    if (appName === 'theme') {
        const win = document.getElementById('app-theme-window');
        if (win) {
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10);
            
            // 👇 关键：每次打开时，把保存的数据填回输入框
            loadSavedSettings();
        }
    } else {
        alert("正在打开: " + appName);
    }
}

function closeApp(appName) {
    if (appName === 'theme') {
        const win = document.getElementById('app-theme-window');
        if (win) {
            win.classList.remove('active'); 
            setTimeout(() => win.classList.add('hidden'), 300);
        }
    }
}

function convertFile(input, targetInputId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const inputEl = document.getElementById(targetInputId);
            inputEl.value = e.target.result;
            
            // 👇 让输入框变色反馈一下
            inputEl.parentElement.style.background = "#fff0f3"; // 变粉
            inputEl.parentElement.style.borderColor = "#ffc2d1";
            
            // 💡 这里虽然值是 Base64，但我们可以利用 placeholder 机制让它看起来干净点
            // (稍微复杂点，暂时保持这样，UI 上已经用了 overflow hidden 截断文字)
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// ⭐ 新增函数：把 localStorage 的数据读取到输入框里
function loadSavedSettings() {
    const data = JSON.parse(localStorage.getItem('my_theme_data'));
    if (!data) return; // 如果没有保存过，就什么都不做

    // 1. 回填文字
    if (data.music) document.getElementById('input-music-text').value = data.music;
    if (data.vibe) document.getElementById('input-vibe-text').value = data.vibe;

    // 2. 回填图片 URL
    if (data.l1) document.getElementById('input-lock-img-1').value = data.l1;
    if (data.l2) document.getElementById('input-lock-img-2').value = data.l2;
    if (data.d1) document.getElementById('input-desk-img-1').value = data.d1;
    if (data.d2) document.getElementById('input-desk-img-2').value = data.d2;

    // 3. 回填图标 URL
    if (data.icons) {
        data.icons.forEach((url, index) => {
            const inputEl = document.getElementById('input-icon-' + index);
            if (inputEl) {
                inputEl.value = url;
            }
        });
    }
}

function saveTheme() {
    const musicText = document.getElementById('input-music-text').value;
    const vibeText = document.getElementById('input-vibe-text').value; 
    
    const lockImg1 = document.getElementById('input-lock-img-1').value;
    const lockImg2 = document.getElementById('input-lock-img-2').value;
    const deskImg1 = document.getElementById('input-desk-img-1').value;
    const deskImg2 = document.getElementById('input-desk-img-2').value;

    // 应用修改
    if(musicText) {
        const marquee = document.querySelector('.music-pill marquee');
        if(marquee) marquee.textContent = musicText;
    }
    
    if(vibeText) {
        const vibeEl = document.getElementById('ls-vibe-text');
        if(vibeEl) vibeEl.textContent = vibeText;
    }

    if(lockImg1) document.querySelector('.user-img-1').src = lockImg1;
    if(lockImg2) document.querySelector('.user-img-2').src = lockImg2;
    if(deskImg1) document.querySelector('.desktop-img-1').src = deskImg1;
    
    const allDeskImgs = document.querySelectorAll('.photo-large img');
    if(allDeskImgs.length > 1 && deskImg2) {
        allDeskImgs[1].src = deskImg2;
    }

    const iconInputs = [];
    for(let i=0; i<12; i++) {
        const el = document.getElementById('input-icon-' + i);
        iconInputs.push(el ? el.value : "");
    }

    const desktopIcons = document.querySelectorAll('.apps-quad .app-icon');
    const dockIcons = document.querySelectorAll('.dock-item');

    iconInputs.forEach((url, index) => {
        if (!url) return; 

        if (index < 8) { 
            if (desktopIcons[index]) {
                desktopIcons[index].innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:12px; object-fit:cover;">`;
                desktopIcons[index].style.padding = "0";
                desktopIcons[index].style.background = "transparent";
            }
        } else { 
            const dockIndex = index - 8;
            if (dockIcons[dockIndex]) {
                dockIcons[dockIndex].innerHTML = `<img src="${url}" style="width:45px; height:45px; border-radius:10px; object-fit:cover;">`;
                dockIcons[dockIndex].style.display = "flex";
                dockIcons[dockIndex].style.alignItems = "center";
                dockIcons[dockIndex].style.justifyContent = "center";
            }
        }
    });

    // 保存到本地
    const themeData = {
        music: musicText,
        vibe: vibeText, 
        l1: lockImg1, l2: lockImg2,
        d1: deskImg1, d2: deskImg2,
        icons: iconInputs
    };
    localStorage.setItem('my_theme_data', JSON.stringify(themeData));
    
    alert("设置已保存！");
    closeApp('theme');
}

function initTheme() {
    const data = JSON.parse(localStorage.getItem('my_theme_data'));
    if (!data) return;

    if(data.music) {
        const marquee = document.querySelector('.music-pill marquee');
        if(marquee) marquee.textContent = data.music;
    }
    
    if(data.vibe) {
        const vibeEl = document.getElementById('ls-vibe-text');
        if(vibeEl) vibeEl.textContent = data.vibe;
    }

    if(data.l1) document.querySelector('.user-img-1').src = data.l1;
    if(data.l2) document.querySelector('.user-img-2').src = data.l2;
    if(data.d1) document.querySelector('.desktop-img-1').src = data.d1;
    
    const allDeskImgs = document.querySelectorAll('.photo-large img');
    if(allDeskImgs.length > 1 && data.d2) {
        allDeskImgs[1].src = data.d2;
    }

    const desktopIcons = document.querySelectorAll('.apps-quad .app-icon');
    const dockIcons = document.querySelectorAll('.dock-item');
    
    if (data.icons) {
        data.icons.forEach((url, index) => {
            if (!url) return;
            if (index < 8 && desktopIcons[index]) {
                desktopIcons[index].innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:12px; object-fit:cover;">`;
                desktopIcons[index].style.padding = "0"; 
                desktopIcons[index].style.background = "transparent";
            } else if (index >= 8) {
                const dockIndex = index - 8;
                if(dockIcons[dockIndex]) {
                    dockIcons[dockIndex].innerHTML = `<img src="${url}" style="width:45px; height:45px; border-radius:10px; object-fit:cover;">`;
                    dockIcons[dockIndex].style.display = "flex";
                    dockIcons[dockIndex].style.alignItems = "center";
                    dockIcons[dockIndex].style.justifyContent = "center";
                }
            }
        });
    }
}