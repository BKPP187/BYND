// --- 📱 script.js: 核心系统与路由 (最终完整版) ---

removeLegacyByndStartup();
const byndStylesReady = waitForByndStyles();

function removeLegacyByndStartup() {
    // Cached HTML may still contain the retired splash and its controller.
    window.__byndStartup?.markReady?.();
    document.getElementById('bynd-startup')?.remove();
    document.documentElement.classList.remove('bynd-startup-loading', 'bynd-startup-disabled');
}

function initializeByndApp() {
    const run = (initializer, label) => {
        try {
            return initializer();
        } catch (error) {
            console.error(`BYND 初始化失败：${label}`, error);
            return undefined;
        }
    };

    run(initClock, '时钟');
    run(initBattery, '电池');
    run(initDate, '日期');
    run(initLockScreen, '锁屏');
    run(initCalendar, '日历');
    run(initByndFullscreenRuntime, '全屏模式');
    if (typeof initIconGrid === 'function') run(initIconGrid, '图标');
    if (typeof initTheme === 'function') run(initTheme, '主题');
    run(initLockscreenWeatherRuntime, '锁屏天气');

    const charactersReady = typeof loadCharactersFromStorage === 'function'
        ? Promise.resolve(run(loadCharactersFromStorage, '角色数据')).catch(error => {
            console.warn('角色数据读取未完成，继续启动', error);
        })
        : Promise.resolve();

    if (typeof initOutingAppRuntime === 'function') run(initOutingAppRuntime, '一起出门');
    if (typeof initDesktopStatusWidgetRuntime === 'function') run(initDesktopStatusWidgetRuntime, '桌面状态');
    run(initProactiveNotify, '主动提醒');
    if (typeof syncMonitorPetFloating === 'function') run(syncMonitorPetFloating, '桌宠');

    return charactersReady;
}

function waitForByndStyles() {
    const stylesheets = Array.from(document.querySelectorAll('link[data-bynd-core-style]'));
    return Promise.all(stylesheets.map(link => {
        if (link.media === 'all') return;
        return new Promise(resolve => {
            link.addEventListener('load', resolve, { once: true });
            link.addEventListener('error', resolve, { once: true });
        });
    })).then(() => document.documentElement.classList.remove('bynd-styles-pending'));
}

function startByndAppInitialization() {
    window.__byndCoreReady = byndStylesReady.then(initializeByndApp);
    window.__byndCoreReady.catch(error => {
        console.error('BYND 初始化失败', error);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startByndAppInitialization, { once: true });
} else {
    Promise.resolve().then(startByndAppInitialization);
}

