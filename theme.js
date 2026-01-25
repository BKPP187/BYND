// --- 🎨 theme.js: 美化与设置模块 ---

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

function convertFile(input, targetInputId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const inputEl = document.getElementById(targetInputId);
            inputEl.value = e.target.result;
            const previewId = targetInputId.replace('input-', 'preview-');
            const previewEl = document.getElementById(previewId);
            if(previewEl) previewEl.innerHTML = `<img src="${e.target.result}">`;
            inputEl.parentElement.style.background = "#fff0f3"; 
            inputEl.parentElement.style.borderColor = "#ffc2d1";
        };
        reader.readAsDataURL(input.files[0]);
    }
}

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
                if(url && url.length > 0) {
                    const previewEl = document.getElementById('preview-icon-' + index);
                    if(previewEl) previewEl.innerHTML = `<img src="${url}">`;
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
                const iconBox = dockIcons[dockIndex].querySelector('.dock-icon-box');
                if (iconBox) {
                    iconBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:10px; object-fit:cover;">`;
                }
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
    // closeApp 在 script.js 里定义，这里可能调用不到，不过没关系，saveTheme 通常会刷新页面或直接改DOM
    // 为了保险，我们可以尝试调用 window.closeApp
    if (typeof closeApp === 'function') {
        closeApp('theme');
    }
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
                    const iconBox = dockIcons[dockIndex].querySelector('.dock-icon-box');
                    if (iconBox) {
                        iconBox.innerHTML = `<img src="${url}" style="width:100%; height:100%; border-radius:10px; object-fit:cover;">`;
                    }
                }
            }
        });
    }
}