// --- 左滑删除 ---

function deleteCharacter(charId) {
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    if (!confirm(`确定删除「${char.name}」吗？\n聊天记录将不可恢复`)) return;

    window.myCharacters = window.myCharacters.filter(c => c.id !== charId);
    if (window.currentChatCharId === charId) window.currentChatCharId = null;

    // Only purge side data once the removal itself was saved.
    const saved = Promise.resolve(saveCharactersToStorage()).then(result => {
        if (result !== false) return purgeWechatDeletedCharacterData(charId);
    }).catch(error => console.warn('删除角色保存失败', error));
    renderChatList();
    return saved;
}

// Data kept outside the character record: pet images (IndexedDB) and 学习 chats.
function purgeWechatDeletedCharacterData(charId) {
    try {
        const key = 'bynd_study_chats_v1';
        const chats = JSON.parse(localStorage.getItem(key) || 'null');
        if (chats && typeof chats === 'object' && Object.prototype.hasOwnProperty.call(chats, charId)) {
            delete chats[charId];
            localStorage.setItem(key, JSON.stringify(chats));
        }
    } catch (error) { console.warn('学习对话清理失败', error); }
    const pet = window.ByndCharacterPet;
    if (pet && typeof pet.purgeCharacter === 'function') {
        return Promise.resolve().then(() => pet.purgeCharacter(charId)).catch(error => console.warn('桌宠图片清理失败', error));
    }
    return Promise.resolve();
}

// 滑动手势处理
function initSwipeHandlers() {
    const containers = document.querySelectorAll('.wc-swipe-container');
    let openItem = null; // 当前打开的滑动项

    function closeOpenItem(animate) {
        if (!openItem) return;
        const chatItem = openItem.querySelector('.wc-chat-item');
        if (chatItem) {
            if (animate) chatItem.style.transition = 'transform 0.3s ease';
            chatItem.style.transform = 'translateX(0)';
            if (animate) setTimeout(() => { chatItem.style.transition = ''; }, 300);
        }
        openItem.classList.remove('swiping');
        openItem.classList.remove('swipe-open');
        openItem = null;
    }

    containers.forEach(container => {
        const chatItem = container.querySelector('.wc-chat-item');
        const charId = container.dataset.charId;
        let startX = 0, startY = 0, currentX = 0, moveX = 0, moveY = 0;
        let isSwiping = false, directionDecided = false, didSwipe = false, didOpenChatOnEnd = false, startedOnDelete = false;

        function onStart(x, y, target) {
            startedOnDelete = !!target?.closest?.('.wc-delete-btn');
            if (startedOnDelete) return;
            // 如果点到了其他地方且有打开项，先关闭
            if (openItem && openItem !== container) {
                closeOpenItem(true);
            }
            startX = x;
            startY = y;
            currentX = 0;
            moveX = 0;
            moveY = 0;
            isSwiping = false;
            directionDecided = false;
            didSwipe = false;
            chatItem.style.transition = '';
        }

        function onMove(x, y, e) {
            if (startedOnDelete) return;
            const dx = x - startX;
            const dy = y - startY;
            moveX = dx;
            moveY = dy;

            if (!directionDecided) {
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; // 死区
                directionDecided = true;
                if (Math.abs(dy) > Math.abs(dx)) {
                    // 垂直滚动，放行
                    isSwiping = false;
                    return;
                }
                isSwiping = true;
                container.classList.add('swiping');
            }

            if (!isSwiping) return;
            if (e.cancelable) e.preventDefault();

            // 计算偏移（考虑已打开状态）
            const base = (openItem === container) ? -75 : 0;
            let tx = base + dx;
            tx = Math.max(-75, Math.min(0, tx));
            currentX = tx;
            chatItem.style.transform = `translateX(${tx}px)`;
        }

        function onEnd(target) {
            if (startedOnDelete || target?.closest?.('.wc-delete-btn')) {
                startedOnDelete = false;
                return;
            }
            if (!isSwiping) {
                const tapLike = !didSwipe && Math.abs(moveX) < 18 && Math.abs(moveY) < 18;
                if (tapLike) {
                    // 纯点击
                    if (openItem === container) {
                        closeOpenItem(true);
                    } else {
                        if (Date.now() - Number(container.dataset.openingAt || 0) < 360) return;
                        container.dataset.openingAt = String(Date.now());
                        didOpenChatOnEnd = true;
                        openChat(charId);
                        setTimeout(() => { didOpenChatOnEnd = false; }, 0);
                    }
                }
                return;
            }
            didSwipe = true;
            chatItem.style.transition = 'transform 0.3s ease';

            if (currentX < -35) {
                // 吸附打开
                chatItem.style.transform = 'translateX(-75px)';
                container.classList.add('swipe-open');
                openItem = container;
            } else {
                // 收回
                chatItem.style.transform = 'translateX(0)';
                container.classList.remove('swipe-open');
                if (openItem === container) openItem = null;
            }
            container.classList.remove('swiping');
            setTimeout(() => { chatItem.style.transition = ''; }, 300);
        }

        // 触摸事件
        container.addEventListener('touchstart', e => {
            const t = e.touches[0];
            onStart(t.clientX, t.clientY, e.target);
        }, { passive: true });

        container.addEventListener('touchmove', e => {
            const t = e.touches[0];
            onMove(t.clientX, t.clientY, e);
        }, { passive: false });

        container.addEventListener('touchend', e => onEnd(e.target));

        // 鼠标事件（桌面端）
        let mouseDown = false;
        container.addEventListener('mousedown', e => {
            if (e.target.closest('.wc-delete-btn')) return;
            mouseDown = true;
            onStart(e.clientX, e.clientY, e.target);
        });
        container.addEventListener('mousemove', e => {
            if (!mouseDown) return;
            onMove(e.clientX, e.clientY, e);
        });
        container.addEventListener('mouseup', () => {
            if (!mouseDown) return;
            mouseDown = false;
            onEnd(e.target);
        });
        container.addEventListener('mouseleave', () => {
            if (!mouseDown) return;
            mouseDown = false;
            onEnd();
        });
        container.addEventListener('click', e => {
            if (didOpenChatOnEnd) return;
            if (e.defaultPrevented || e.target.closest('.wc-delete-btn')) return;
            if (container.classList.contains('swiping') || container.classList.contains('swipe-open')) return;
            if (isSwiping || didSwipe || Math.abs(moveX) >= 18 || Math.abs(moveY) >= 18 || Math.abs(currentX) > 4) return;
            if (Date.now() - Number(container.dataset.openingAt || 0) < 360) return;
            container.dataset.openingAt = String(Date.now());
            openChat(charId);
        });
    });

    // 点击列表空白区域关闭已打开的滑动
    const chatList = document.getElementById('wc-chat-list');
    if (chatList) {
        chatList.addEventListener('click', (e) => {
            if (!e.target.closest('.wc-swipe-container') && openItem) {
                closeOpenItem(true);
            }
        });
    }
}

