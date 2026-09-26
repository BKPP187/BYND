// --- 📄 页面滑动系统 ---
function initPageSwipe(options = {}) {
    const container = document.getElementById('pages-container');
    const homeScreen = document.getElementById('home-screen');
    if (!container) return;
    const force = !!(options && options.force);
    if (container.dataset.pageSwipeInit === '1') {
        if (!force) return;
        if (typeof container._pageSwipeCleanup === 'function') {
            container._pageSwipeCleanup();
        }
    }
    container.dataset.pageSwipeInit = '1';

    let currentPage = Number.isInteger(window._desktopCurrentPage) ? window._desktopCurrentPage : 0;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let isDragging = false;
    let swipeIntent = '';
    let activeMousePointerId = null;
    let activeLegacyMouseSwipe = false;
    let suppressNextSwipeClick = false;
    let suppressNextSwipeClickTimer = null;
    let wheelSwipeAccum = 0;
    let wheelSwipeResetTimer = null;
    let wheelSwipeLockedUntil = 0;
    const getPages = () => Array.from(container.querySelectorAll('.desktop-page'));
    const cleanupSwipeListeners = [];
    const bindSwipe = (target, type, handler, eventOptions) => {
        if (!target) return;
        target.addEventListener(type, handler, eventOptions);
        cleanupSwipeListeners.push(() => target.removeEventListener(type, handler, eventOptions));
    };
    const markSwipeClickSuppressed = () => {
        suppressNextSwipeClick = true;
        clearTimeout(suppressNextSwipeClickTimer);
        suppressNextSwipeClickTimer = setTimeout(() => {
            suppressNextSwipeClick = false;
        }, 360);
    };

    function goToPage(idx) {
        const pages = getPages();
        const totalPages = Math.max(1, pages.length);
        idx = Math.max(0, Math.min(idx, totalPages - 1));
        currentPage = idx;
        window._desktopCurrentPage = currentPage;
        pages.forEach(p => {
            p.style.transition = '';
            p.style.transform = `translateX(-${currentPage * 100}%)`;
        });
        updateDots();
        if (typeof scheduleDesktopVisibleLayoutRepair === 'function') scheduleDesktopVisibleLayoutRepair();
    }
    window.goToDesktopPage = goToPage;
    window._desktopPageSwipeState = {
        begin(e, point) { beginSwipe(e, point || e); },
        move(e, point) { moveSwipe(e, point || e); },
        end() { endSwipe(); }
    };

    function updateDots() {
        const dots = document.querySelectorAll('#page-dots .page-dot');
        dots.forEach((d, i) => d.classList.toggle('active', i === currentPage));
    }

    function isDesktopSwipeInteractiveTarget(target) {
        return !!(target && target.closest && target.closest(
            'button, a, input, textarea, select, [contenteditable="true"], .folder-overlay, .desktop-edit-toolbar, .desktop-save-modal, .desktop-widget-library, .desktop-resize-handle, .desktop-item-center, .desktop-item-move-page, .desktop-item-delete, .lcw-control, .lcw-input, .pw-note'
        ));
    }

    function canSwipeDesktopPage(e) {
        const target = e.target;
        if (!window._editMode) {
            if (target && target.closest && !target.closest('#pages-container, .page-dots, .dock-bar, #home-screen')) return false;
            return !isDesktopSwipeInteractiveTarget(target);
        }
        if (target && target.closest && target.closest('.dock-item, .desktop-edit-toolbar, .desktop-save-modal, .folder-overlay, .desktop-resize-handle, .desktop-item-center, .desktop-item-move-page, .desktop-item-delete')) return false;
        const layoutItem = target && target.closest ? target.closest('.desktop-layout-item') : null;
        if (layoutItem) {
            const point = getDesktopPointerPoint(e);
            const rect = layoutItem.getBoundingClientRect();
            const innerX = point.x - rect.left;
            const innerY = point.y - rect.top;
            const isAppIcon = layoutItem.classList.contains('layout-app');
            const activeCoreWidth = isAppIcon ? Math.min(rect.width, 86) : rect.width;
            const activeCoreHeight = isAppIcon ? Math.min(rect.height, 96) : rect.height;
            const coreLeft = (rect.width - activeCoreWidth) / 2;
            const coreTop = (rect.height - activeCoreHeight) / 2;
            const insideCore = innerX >= coreLeft && innerX <= coreLeft + activeCoreWidth && innerY >= coreTop && innerY <= coreTop + activeCoreHeight;
            if (insideCore) return false;
        }
        return true;
    }

    const beginSwipe = (e, point) => {
        if (!canSwipeDesktopPage(e)) return;
        startX = point.clientX;
        startY = point.clientY;
        currentX = startX;
        currentY = startY;
        swipeIntent = '';
        isDragging = true;
    };

    const moveSwipe = (e, point) => {
        if (!canSwipeDesktopPage(e)) return;
        if (!isDragging) return;
        const pages = getPages();
        currentX = point.clientX;
        currentY = point.clientY;
        const diff = currentX - startX;
        const diffY = currentY - startY;
        if (!swipeIntent && (Math.abs(diff) > 8 || Math.abs(diffY) > 8)) {
            swipeIntent = Math.abs(diff) > Math.abs(diffY) * 1.12 ? 'horizontal' : 'vertical';
        }
        if (swipeIntent !== 'horizontal') return;
        if (e.cancelable) e.preventDefault();
        if (Math.abs(diff) > 14) markSwipeClickSuppressed();
        const offset = -currentPage * 100 + (diff / container.offsetWidth) * 100;
        pages.forEach(p => {
            p.style.transition = 'none';
            p.style.transform = `translateX(${offset}%)`;
        });
    };

    const endSwipe = () => {
        if (!isDragging) return;
        isDragging = false;
        const diff = currentX - startX;
        const diffY = currentY - startY;
        const pages = getPages();
        const totalPages = Math.max(1, pages.length);
        pages.forEach(p => p.style.transition = '');

        const threshold = Math.max(24, Math.min(42, container.offsetWidth * 0.1));
        const horizontal = swipeIntent === 'horizontal' || Math.abs(diff) > Math.abs(diffY) * 1.12;
        if (horizontal && Math.abs(diff) > threshold) {
            if (diff < 0 && currentPage < totalPages - 1) goToPage(currentPage + 1);
            else if (diff > 0 && currentPage > 0) goToPage(currentPage - 1);
            else goToPage(currentPage);
        } else {
            goToPage(currentPage);
        }
        startX = 0;
        startY = 0;
        currentX = 0;
        currentY = 0;
        swipeIntent = '';
    };

    const handleWheelSwipe = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (!canSwipeDesktopPage(e)) return;
        const pages = getPages();
        if (pages.length < 2) return;
        const rawDeltaX = Number(e.deltaX) || 0;
        const rawDeltaY = Number(e.deltaY) || 0;
        const horizontalDelta = e.shiftKey ? (rawDeltaX || rawDeltaY) : rawDeltaX;
        const verticalDelta = e.shiftKey ? 0 : rawDeltaY;
        if (!horizontalDelta) return;
        if (!e.shiftKey && Math.abs(horizontalDelta) < Math.max(8, Math.abs(verticalDelta) * 1.08)) return;
        if (e.cancelable) e.preventDefault();

        const now = Date.now();
        if (now < wheelSwipeLockedUntil) return;
        wheelSwipeAccum += horizontalDelta;
        clearTimeout(wheelSwipeResetTimer);
        wheelSwipeResetTimer = setTimeout(() => {
            wheelSwipeAccum = 0;
        }, 180);

        const threshold = Math.max(36, Math.min(80, container.offsetWidth * 0.16));
        if (Math.abs(wheelSwipeAccum) < threshold) return;
        if (wheelSwipeAccum > 0 && currentPage < pages.length - 1) goToPage(currentPage + 1);
        else if (wheelSwipeAccum < 0 && currentPage > 0) goToPage(currentPage - 1);
        else goToPage(currentPage);
        wheelSwipeAccum = 0;
        wheelSwipeLockedUntil = now + 360;
    };

    const shouldSkipOuterSwipeEvent = (e) => (
        homeScreen
        && e.currentTarget === homeScreen
        && e.target
        && e.target.closest
        && e.target.closest('#pages-container')
    );

    const onTouchStart = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (e.touches && e.touches[0]) beginSwipe(e, e.touches[0]);
    };

    const onTouchMove = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (e.touches && e.touches[0]) moveSwipe(e, e.touches[0]);
    };

    const onPointerDown = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.pointerType === 'mouse') activeMousePointerId = e.pointerId;
        beginSwipe(e, e);
    };

    const onPointerMove = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (e.pointerType === 'mouse' && activeMousePointerId !== e.pointerId) return;
        moveSwipe(e, e);
    };

    const onPointerUp = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (e.pointerType === 'mouse' && activeMousePointerId !== e.pointerId) return;
        activeMousePointerId = null;
        endSwipe();
    };

    const onPointerCancel = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (e.pointerType === 'mouse' && activeMousePointerId !== e.pointerId) return;
        activeMousePointerId = null;
        endSwipe();
    };

    const onMouseDown = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (activeMousePointerId !== null || e.button !== 0) return;
        activeLegacyMouseSwipe = true;
        beginSwipe(e, e);
    };

    const onMouseMove = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (!activeLegacyMouseSwipe) return;
        moveSwipe(e, e);
    };

    const onMouseUp = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (!activeLegacyMouseSwipe) return;
        activeLegacyMouseSwipe = false;
        endSwipe();
    };

    const onMouseLeave = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (!activeLegacyMouseSwipe) return;
        activeLegacyMouseSwipe = false;
        endSwipe();
    };

    const onClick = (e) => {
        if (shouldSkipOuterSwipeEvent(e)) return;
        if (!suppressNextSwipeClick) return;
        suppressNextSwipeClick = false;
        clearTimeout(suppressNextSwipeClickTimer);
        e.preventDefault();
        e.stopPropagation();
    };

    const swipeTargets = [container];
    if (homeScreen && homeScreen !== container) swipeTargets.push(homeScreen);
    swipeTargets.forEach(target => {
        bindSwipe(target, 'touchstart', onTouchStart, { passive: true });
        bindSwipe(target, 'touchmove', onTouchMove, { passive: false });
        bindSwipe(target, 'touchend', endSwipe);
        bindSwipe(target, 'touchcancel', endSwipe);
        bindSwipe(target, 'pointerdown', onPointerDown);
        bindSwipe(target, 'pointermove', onPointerMove);
        bindSwipe(target, 'pointerup', onPointerUp);
        bindSwipe(target, 'pointercancel', onPointerCancel);
        bindSwipe(target, 'mousedown', onMouseDown);
        bindSwipe(target, 'mousemove', onMouseMove);
        bindSwipe(target, 'mouseup', onMouseUp);
        bindSwipe(target, 'mouseleave', onMouseLeave);
        bindSwipe(target, 'click', onClick, true);
        bindSwipe(target, 'wheel', handleWheelSwipe, { passive: false });
    });
    container._pageSwipeCleanup = () => {
        clearTimeout(suppressNextSwipeClickTimer);
        clearTimeout(wheelSwipeResetTimer);
        cleanupSwipeListeners.splice(0).forEach(remove => remove());
        delete container._pageSwipeCleanup;
        delete container.dataset.pageSwipeInit;
    };

    goToPage(currentPage);
}

