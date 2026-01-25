document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initBattery();
    initDate();
    initLockScreen();
    initCalendar();
    initTheme(); 
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

// --- 美化 App 逻辑 ---

function openApp(appName) {
    if (appName === 'theme') {
        const win = document.getElementById('app-theme-window');
        if (win) {
            win.classList.remove('hidden'); 
            setTimeout(() => win.classList.add('active'), 10);
            loadSavedSettings(); // 加载数据
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

// ⭐ 更新：选择文件后，直接在设置界面显示图片预览
function convertFile(input, targetInputId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // 1. 填入隐藏的 input (用于保存)
            const inputEl = document.getElementById(targetInputId);
            inputEl.value = e.target.result;
            
            // 2. 找到对应的预览图标区域
            // ID 规律：input-icon-0 -> preview-icon-0
            const previewId = targetInputId.replace('input-', 'preview-');
            const previewEl = document.getElementById(previewId);
            
            // 3. 直接把图片显示出来
            if(previewEl) {
                previewEl.innerHTML = `<img src="${e.target.result}">`;
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// ⭐ 更新：加载数据时，也要把图片显示在设置界面里
function loadSavedSettings() {
    const data = JSON.parse(localStorage.getItem('my_theme_data'));
    if (!data) return;

    if (data.music) document.getElementById('input-music-text').value = data.music;
    if (data.vibe) document.getElementById('input-vibe-text').value = data.vibe;

    if (data.l1) document.getElementById('input-lock-img-1').value = data.l1;
    if (data.l2) document.getElementById('input-lock-img-2').value = data.l2;
    if (data.d1) document.getElementById('input-desk-img-1').value = data.d1;
    if (data.d2) document.getElementById('input-desk-img-2').value = data.d2;

    if (data.icons) {
        data.icons.forEach((url, index) => {
            const inputEl = document.getElementById('input-icon-' + index);
            if (inputEl) {
                inputEl.value = url;
                // 如果有保存的图片 URL，直接显示在设置格子里
                if(url && url.length > 0) {
                    const previewEl = document.getElementById('preview-icon-' + index);
                    if(previewEl) {
                        previewEl.innerHTML = `<img src="${url}">`;
                    }
                }
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