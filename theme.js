// --- 🎨 theme.js: 终极整合版 (含自动压缩 + 亮度检测 + 防爆保险) ---

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

// 2. 🔧 智能压缩上传函数 (核心修改：防止 localStorage 爆满)
function convertFile(input, targetInputId) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;

            img.onload = function() {
                // --- 定义压缩规则 ---
                let maxWidth = 1080; // 壁纸限制宽度
                let quality = 0.7;   // 壁纸压缩质量 (0-1)
                let isIcon = targetInputId.includes('icon');

                // 如果是图标，压得更小
                if (isIcon) {
                    maxWidth = 150; // 图标只要这么大就够了
                }

                // --- 计算新尺寸 ---
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                // --- Canvas 绘图压缩 ---
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                // 如果不是图标（是壁纸），铺个白底，转成 JPG 节省空间
                // 如果是图标，保持透明背景，转成 PNG
                let outputType = 'image/jpeg';
                
                if (!isIcon) {
                    ctx.fillStyle = "#ffffff"; 
                    ctx.fillRect(0, 0, width, height);
                } else {
                    outputType = 'image/png'; // 图标保持透明
                }
                
                ctx.drawImage(img, 0, 0, width, height);

                // 导出压缩后的 Base64
                const compressedData = canvas.toDataURL(outputType, quality);

                // --- 赋值 ---
                const inputEl = document.getElementById(targetInputId);
                inputEl.value = compressedData;

                const previewId = targetInputId.replace('input-', 'preview-');
                const previewEl = document.getElementById(previewId);
                if(previewEl) previewEl.innerHTML = `<img src="${compressedData}">`;
                
                // 成功提示色
                if(inputEl.parentElement) {
                    inputEl.parentElement.style.background = "#e6fffa"; 
                    inputEl.parentElement.style.borderColor = "#38b2ac";
                }
                
                // 调试信息
                console.log(`压缩前: ${(e.target.result.length/1024).toFixed(2)}KB, 压缩后: ${(compressedData.length/1024).toFixed(2)}KB`);
            }
        };
        reader.readAsDataURL(file);
    }
}

// 3. 读取设置
function loadSavedSettings() {
    // 加个容错，万一数据坏了不报错
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
    } catch (e) {
        console.error("读取存档失败，可能数据已损坏", e);
    }
}

// 4. 💾 安全保存设置 (含防爆保险)
function saveTheme() {
    const wpLock = document.getElementById('input-wp-lock').value;
    const wpHome = document.getElementById('input-wp-home').value;
    const musicText = document.getElementById('input-music-text').value;
    const vibeText = document.getElementById('input-vibe-text').value; 
    
    const lockImg1 = document.getElementById('input-lock-img-1').value;
    const lockImg2 = document.getElementById('input-lock-img-2').value;
    const deskImg1 = document.getElementById('input-desk-img-1').value;
    const deskImg2 = document.getElementById('input-desk-img-2').value;

    // 立即应用壁纸
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

    // 触发亮度检测 (自动黑白字)
    if (wpLock) checkImageBrightness(wpLock, 'lock');
    else checkImageBrightness("", 'lock');

    if (wpHome) checkImageBrightness(wpHome, 'home');
    else checkImageBrightness("", 'home');

    // 应用其他元素
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
                const iconBox = dockIcons[dockIndex].querySelector('.dock-icon-box');
                if (iconBox) {
                    iconBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:10px; object-fit:cover;">`;
                }
            }
        }
    });

    const themeData = {
        wpLock: wpLock,
        wpHome: wpHome,
        music: musicText,
        vibe: vibeText, 
        l1: lockImg1, l2: lockImg2,
        d1: deskImg1, d2: deskImg2,
        icons: iconInputs
    };
    
    // --- 🚨 核心防爆逻辑 ---
    try {
        localStorage.setItem('my_theme_data', JSON.stringify(themeData));
        alert("✅ 设置已保存！");
        if (typeof closeApp === 'function') {
            closeApp('theme');
        }
    } catch (e) {
        // 如果存储满了，弹出提示而不是报错死机
        if (e.name === 'QuotaExceededError') {
             alert("❌ 保存失败：图片总大小超过浏览器限制！\n\n请【重新上传】一次壁纸或大图标，新代码会自动压缩它们。");
             console.error("Storage full:", e);
        } else {
             alert("❌ 未知错误: " + e.message);
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
                        const iconBox = dockIcons[dockIndex].querySelector('.dock-icon-box');
                        if (iconBox) {
                            iconBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:10px; object-fit:cover;">`;
                        }
                    }
                }
            });
        }
    } catch(e) {
        console.error("初始化加载失败", e);
    }
}

// 6. 🧠 自动变色大脑 (亮度计算)
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
        canvas.width = img.width;
        canvas.height = 50; 
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let r, g, b, avg;
        let colorSum = 0;

        for (let i = 0, len = data.length; i < len; i += 4) {
            r = data[i];
            g = data[i + 1];
            b = data[i + 2];
            avg = Math.floor((r + g + b) / 3);
            colorSum += avg;
        }

        const brightness = Math.floor(colorSum / (canvas.width * canvas.height));
        const isDark = brightness < 150; 
        applyBrightnessResult(isDark, type);
    }
}

function applyBrightnessResult(isDark, type) {
    const statusBar = document.querySelector('.status-bar');
    
    if (type === 'lock') {
        window.lockIsDark = isDark;
        const lockScreen = document.getElementById('lock-screen');
        if (!lockScreen.classList.contains('unlocked')) {
            if (isDark) statusBar.classList.add('white-text');
            else statusBar.classList.remove('white-text');
        }
    } else if (type === 'home') {
        window.homeIsDark = isDark;
        const lockScreen = document.getElementById('lock-screen');
        if (lockScreen.classList.contains('unlocked')) {
            if (isDark) statusBar.classList.add('white-text');
            else statusBar.classList.remove('white-text');
        }
    }
}