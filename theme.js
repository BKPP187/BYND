// --- 🎨 theme.js: 最终增强版 (全屏亮度检测 + 自动白字) ---

// 1. 初始化图标网格
function initIconGrid() {
    const container = document.getElementById('icon-grid-container');
    if (!container) return;

    const icons = [
        {i:'ri-wechat-line', n:'微信'}, {i:'ri-code-s-slash-line', n:'正则'}, 
        {i:'ri-book-read-line', n:'世界书'}, {i:'ri-settings-4-line', n:'设置'},
        {i:'ri-palette-line', n:'美化'}, {i:'ri-graduation-cap-line', n:'学习'},
        {i:'ri-money-cny-box-line', n:'记账'}, {i:'ri-gamepad-line', n:'Game'},
        {i:'ri-music-2-fill', n:'音乐'}, {i:'ri-safari-line', n:'浏览器'},
        {i:'ri-camera-lens-line', n:'相机'}, {i:'ri-question-mark', n:'说明'}
    ];

    let htmlContent = '';
    icons.forEach((item, index) => {
        htmlContent += `
            <div class="pretty-icon-item" onclick="document.getElementById('file-icon-${index}').click()">
                <div class="icon-preview" id="preview-icon-${index}">
                    <i class="${item.i}"></i>
                </div>
                <span class="icon-name">${item.n}</span>
                <input type="text" id="input-icon-${index}" style="display:none">
                <input type="file" id="file-icon-${index}" accept="image/*" style="display:none" onchange="convertFile(this, 'input-icon-${index}')">
            </div>
        `;
    });
    container.innerHTML = htmlContent;
}

// 2. 🔧 强力压缩函数
function convertFile(input, targetInputId) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;

            img.onload = function() {
                let maxWidth = 720;  
                let quality = 0.5;   
                let isIcon = targetInputId.includes('icon');

                if (isIcon) {
                    maxWidth = 150;  
                    quality = 0.8;   
                }

                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                let outputType = 'image/jpeg';
                if (isIcon) {
                    outputType = 'image/png'; 
                    ctx.clearRect(0, 0, width, height); 
                } else {
                    ctx.fillStyle = "#ffffff"; 
                    ctx.fillRect(0, 0, width, height);
                }
                
                ctx.drawImage(img, 0, 0, width, height);
                const compressedData = canvas.toDataURL(outputType, quality);

                const inputEl = document.getElementById(targetInputId);
                inputEl.value = compressedData;

                const previewId = targetInputId.replace('input-', 'preview-');
                const previewEl = document.getElementById(previewId);
                if(previewEl) previewEl.innerHTML = `<img src="${compressedData}">`;
                
                if(inputEl.parentElement) {
                    inputEl.parentElement.style.background = "#e6fffa"; 
                }
            }
        };
        reader.readAsDataURL(file);
    }
}

// 3. 读取设置
function loadSavedSettings() {
    try {
        const data = JSON.parse(localStorage.getItem('my_theme_data'));
        if (!data) return;

        if (data.wpLock) document.getElementById('input-wp-lock').value = data.wpLock;
        if (data.wpHome) document.getElementById('input-wp-home').value = data.wpHome;
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
                    if(url && url.length > 0) {
                        const previewEl = document.getElementById('preview-icon-' + index);
                        if(previewEl) previewEl.innerHTML = `<img src="${url}">`;
                    }
                }
            });
        }
    } catch (e) { console.error(e); }
}

// 4. 💾 保存设置
function saveTheme() {
    const wpLock = document.getElementById('input-wp-lock').value;
    const wpHome = document.getElementById('input-wp-home').value;
    const musicText = document.getElementById('input-music-text').value;
    const vibeText = document.getElementById('input-vibe-text').value; 
    
    const lockImg1 = document.getElementById('input-lock-img-1').value;
    const lockImg2 = document.getElementById('input-lock-img-2').value;
    const deskImg1 = document.getElementById('input-desk-img-1').value;
    const deskImg2 = document.getElementById('input-desk-img-2').value;

    if (wpLock) {
        const lockScreen = document.getElementById('lock-screen');
        lockScreen.style.backgroundImage = `url('${wpLock}')`;
        lockScreen.style.backgroundSize = "cover"; 
    }
    if (wpHome) {
        const homeScreen = document.getElementById('home-screen');
        homeScreen.style.backgroundImage = `url('${wpHome}')`;
        homeScreen.style.backgroundSize = "cover";
    }

    // 检测亮度
    if (wpLock) checkImageBrightness(wpLock, 'lock');
    else checkImageBrightness("", 'lock');
    if (wpHome) checkImageBrightness(wpHome, 'home');
    else checkImageBrightness("", 'home');

    if(musicText) document.querySelector('.music-pill marquee').textContent = musicText;
    if(vibeText) document.getElementById('ls-vibe-text').textContent = vibeText;
    if(lockImg1) document.querySelector('.user-img-1').src = lockImg1;
    if(lockImg2) document.querySelector('.user-img-2').src = lockImg2;
    if(deskImg1) document.querySelector('.desktop-img-1').src = deskImg1;
    
    const allDeskImgs = document.querySelectorAll('.photo-large img');
    if(allDeskImgs.length > 1 && deskImg2) allDeskImgs[1].src = deskImg2;

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
                desktopIcons[index].innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:12px; object-fit:contain;">`;
                desktopIcons[index].style.padding = "0"; 
                desktopIcons[index].style.background = "transparent";
            }
        } else { 
            const dockIndex = index - 8;
            if (dockIcons[dockIndex]) {
                const iconBox = dockIcons[dockIndex].querySelector('.dock-icon-box');
                if (iconBox) {
                    iconBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:12px; object-fit:contain;">`;
                }
            }
        }
    });

    const themeData = {
        wpLock: wpLock, wpHome: wpHome, music: musicText, vibe: vibeText, 
        l1: lockImg1, l2: lockImg2, d1: deskImg1, d2: deskImg2, icons: iconInputs
    };
    
    try {
        localStorage.removeItem('my_theme_data'); 
        localStorage.setItem('my_theme_data', JSON.stringify(themeData));
        
        alert("✅ 保存成功！文字颜色已自动适配");
        if (typeof closeApp === 'function') closeApp('theme');
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
             alert("❌ 空间不足！请重新点击上传按钮，触发压缩逻辑！");
        } else {
             alert("❌ 错误: " + e.message);
        }
    }
}

// 5. 初始化
function initTheme() {
    try {
        const data = JSON.parse(localStorage.getItem('my_theme_data'));
        if (!data) return;

        if (data.wpLock) {
            const lockScreen = document.getElementById('lock-screen');
            lockScreen.style.backgroundImage = `url('${data.wpLock}')`;
            lockScreen.style.backgroundSize = "cover";
            checkImageBrightness(data.wpLock, 'lock');
        }
        if (data.wpHome) {
            const homeScreen = document.getElementById('home-screen');
            homeScreen.style.backgroundImage = `url('${data.wpHome}')`;
            homeScreen.style.backgroundSize = "cover";
            checkImageBrightness(data.wpHome, 'home');
        }

        if(data.music) document.querySelector('.music-pill marquee').textContent = data.music;
        if(data.vibe) document.getElementById('ls-vibe-text').textContent = data.vibe;
        if(data.l1) document.querySelector('.user-img-1').src = data.l1;
        if(data.l2) document.querySelector('.user-img-2').src = data.l2;
        if(data.d1) document.querySelector('.desktop-img-1').src = data.d1;
        const allDeskImgs = document.querySelectorAll('.photo-large img');
        if(allDeskImgs.length > 1 && data.d2) allDeskImgs[1].src = data.d2;

        const desktopIcons = document.querySelectorAll('.apps-quad .app-icon');
        const dockIcons = document.querySelectorAll('.dock-item');
        
        if (data.icons) {
            data.icons.forEach((url, index) => {
                if (!url) return;
                if (index < 8 && desktopIcons[index]) {
                    desktopIcons[index].innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:12px; object-fit:contain;">`;
                    desktopIcons[index].style.padding = "0"; 
                    desktopIcons[index].style.background = "transparent";
                } else if (index >= 8) {
                    const dockIndex = index - 8;
                    if(dockIcons[dockIndex]) {
                        const iconBox = dockIcons[dockIndex].querySelector('.dock-icon-box');
                        if (iconBox) {
                            iconBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:12px; object-fit:contain;">`;
                        }
                    }
                }
            });
        }
    } catch(e) { console.error(e); }
}

// 6. 🧠 自动变色大脑 (升级版：检测全图)
window.lockIsDark = false; 
window.homeIsDark = false;

function checkImageBrightness(src, type) {
    if (!src) return;
    if (src.includes('radial-gradient') || src === '') {
        applyBrightnessResult(false, type);
        return;
    }
    const img = new Image();
    img.crossOrigin = "Anonymous"; 
    img.src = src;
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        // 👇 关键修改：采样整张图片 (缩略为 50x50 以提高性能)
        canvas.width = 50;
        canvas.height = 50; 
        ctx.drawImage(img, 0, 0, 50, 50);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let r, g, b, avg;
        let colorSum = 0;
        
        for (let i = 0, len = data.length; i < len; i += 4) {
            r = data[i]; g = data[i + 1]; b = data[i + 2];
            avg = Math.floor((r + g + b) / 3);
            colorSum += avg;
        }
        
        const brightness = Math.floor(colorSum / (canvas.width * canvas.height));
        // 阈值：亮度 < 140 算深色 (可以根据需要调整)
        applyBrightnessResult(brightness < 140, type);
    }
}

function applyBrightnessResult(isDark, type) {
    const statusBar = document.querySelector('.status-bar');
    
    if (type === 'lock') {
        window.lockIsDark = isDark;
        const lockScreen = document.getElementById('lock-screen');
        if (isDark) {
            lockScreen.classList.add('dark-mode'); // 给锁屏加深色标记
        } else {
            lockScreen.classList.remove('dark-mode');
        }
        
        if (!lockScreen.classList.contains('unlocked')) {
            isDark ? statusBar.classList.add('white-text') : statusBar.classList.remove('white-text');
        }
    } 
    else if (type === 'home') {
        window.homeIsDark = isDark;
        const homeScreen = document.getElementById('home-screen');
        if (isDark) {
            homeScreen.classList.add('dark-mode'); // ✨ 给桌面加深色标记
        } else {
            homeScreen.classList.remove('dark-mode');
        }

        const lockScreen = document.getElementById('lock-screen');
        if (lockScreen.classList.contains('unlocked')) {
            isDark ? statusBar.classList.add('white-text') : statusBar.classList.remove('white-text');
        }
    }
}