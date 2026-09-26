// ========== 数据管理（导出 / 导入 / 清理缓存） ==========

const APP_VERSION = 'v1.1.698';
const MONITOR_PET_BACKUP_DB_NAME = 'bynd_monitor_pet_assets_v1';
const MONITOR_PET_BACKUP_DB_STORE = 'assets';
const DREAM_IMAGE_BACKUP_DB_NAME = 'bynd_dream_images_v1';
const DREAM_IMAGE_BACKUP_DB_STORE = 'images';
const ALL_DATA_KEYS = [
    'my_characters_data',
    'my_characters_data_meta',
    'my_api_data',
    'my_global_regex_scripts',
    'my_font_data',
    'my_user_profile',
    'my_theme_data',
    'my_sticker_packs',
    'my_bubble_presets',
    'my_presets_data',
    'wechat_user_persona_library_v1',
    'wechat_memory_store',
    'bynd_money_records_v1',
    'bynd_dream_records_v1',
    'bynd_dream_writing_v1',
    'desktop_layout_v2',
    'desktop_folders',
    'desktop_sticky_notes_v1',
    'desktop_status_widget_prefs_v1',
    'desktop_lovely_widget_prefs_v1',
    'desktop_status_weather_v1',
    'desktop_status_steps_v1',
    'bynd_coread_library_v1',
    'bynd_coread_reader_settings_v1',
    'bynd_coread_reader_wallpaper_v1',
    'bynd_coread_progress_v1',
    'bynd_coread_daily_v1',
    'bynd_coread_daily_participants_v1',
    'bynd_coread_sources_v1',
    'bynd_coread_sources_version_v1',
    'bynd_monitor_active_tool_v1',
    'bynd_monitor_pet_library_v1',
    'bynd_monitor_active_pet_v1',
    'bynd_monitor_pet_float_pos_v1',
    'bynd_monitor_pet_bound_char_v1',
    'desktop_default_princess_deleted_v1',
    'desktop_default_lovely_deleted_v1',
    // Module-owned localStorage used by music, MCP, games, camera/gallery,
    // notifications and the WeChat themed surfaces.
    'bynd_music_comments_v1',
    'bynd_music_favorites_v1',
    'bynd_music_co_listen_v1',
    'bynd_music_co_listen_char_v1',
    'bynd_music_source_mode_v1',
    'bynd_music_source_settings_v1',
    'bynd_music_playlists_v1',
    'bynd_music_library_state_v1',
    'bynd_github_mcp_config_v1',
    'bynd_outing_date_state_v1',
    'bynd_chat_album_v1',
    'bynd_character_generator_v1',
    'bynd_coread_shelf_settings_v1',
    'bynd_coread_shelf_meta_v1',
    'bynd_living_world_v1',
    'bynd_monitor_pet_enabled_v1',
    'bynd_monitor_pet_observe_interval_v1',
    'bynd_proactive_notify_settings_v1',
    'bynd_proactive_notify_state_v1',
    'bynd_proactive_notify_client_id_v1',
    'bynd_startup_seen_v1',
    'bynd_game_active_v1',
    'bynd_game_wolfcha_state_v1',
    'bynd_game_wolfcha_setup_v1',
    'bynd_game_wolfcha_entry_v1',
    'bynd_game_hub_filter_v1',
    'bynd_game_sync_char_v1',
    'bynd_game_sync_state_v2',
    'bynd_game_acting_state_v1',
    'bynd_game_2048_state_v1',
    'bynd_game_catpot_state_v5',
    'bynd_game_jump_state_v1',
    'bynd_game_jump_best_v1',
    'bynd_game_water_sort_state_v1',
    'bynd_game_water_sort_best_level_v1',
    'bynd_game_gomoku_state_v1',
    'bynd_game_chicken_best_v1',
    'bynd_game_chicken_avatar_v1',
    'bynd_game_cardmatch_rules_skip_date_v1',
    'wechat_ui_theme_v1',
    'wechat_favorites_store',
    'wechat_moments_store',
    'wechat_video_state',
    'wechat_live_state',
    'wechat_shop_store',
    'wechat_takeout_store',
    'wechat_music_play_mode',
    'wechat_music_queue_added_tracks_v1',
    'wechat_x_realtime_news_cache_v4'
];

// Keep backup/cleanup scoped to BYND-owned storage. Modules add keys over time,
// so relying on a hand-maintained allowlist alone can silently lose new data.
const APP_STORAGE_KEY_PREFIXES = ['my_', 'bynd_', 'wechat_', 'desktop_', 'XuexiFontDB'];
// Only keys whose contents can be fetched again belong here. Unknown keys are retained.
const REBUILDABLE_CACHE_KEYS = new Set(['wechat_x_realtime_news_cache_v4']);

function isByndStorageKey(key) {
    const value = String(key || '');
    return APP_STORAGE_KEY_PREFIXES.some(prefix => value.startsWith(prefix));
}

function getBackupLocalStorageKeys() {
    const jevStorageKey = window.ByndJev?.storageKey || 'bynd_jev_config_v1';
    // Character tool keys (AMap / TMDB) are device secrets like the Jev key.
    const toolSecretStorageKey = window.ByndCharacterTools?.secretStorageKey || 'bynd_tool_keys_v1';
    const keys = new Set(ALL_DATA_KEYS);
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (isByndStorageKey(key) && key !== jevStorageKey && key !== toolSecretStorageKey) keys.add(key);
    }
    keys.delete(jevStorageKey);
    keys.delete(toolSecretStorageKey);
    return Array.from(keys);
}

function parseBackupLocalStorageValue(raw) {
    try {
        return { value: JSON.parse(raw), raw: false };
    } catch (_) {
        return { value: raw, raw: true };
    }
}

function stringifyBackupLocalStorageValue(value, raw = false) {
    if (raw && typeof value === 'string') return value;
    return JSON.stringify(value);
}

function openBackupObjectStore(dbName, storeName, mode = 'readonly') {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(storeName)) {
                req.result.createObjectStore(storeName);
            }
        };
        req.onsuccess = () => {
            try {
                const db = req.result;
                const tx = db.transaction(storeName, mode);
                resolve({ db, tx, store: tx.objectStore(storeName) });
            } catch (e) {
                try { req.result.close(); } catch (_) {}
                reject(e);
            }
        };
        req.onerror = () => reject(req.error);
    });
}

async function exportBackupObjectStoreEntries(dbName, storeName) {
    if (typeof indexedDB === 'undefined') return {};
    const { db, tx, store } = await openBackupObjectStore(dbName, storeName, 'readonly');
    try {
        const keysReq = store.getAllKeys();
        const valuesReq = store.getAll();
        const keys = await new Promise((resolve, reject) => {
            keysReq.onsuccess = () => resolve(keysReq.result || []);
            keysReq.onerror = () => reject(keysReq.error);
        });
        const values = await new Promise((resolve, reject) => {
            valuesReq.onsuccess = () => resolve(valuesReq.result || []);
            valuesReq.onerror = () => reject(valuesReq.error);
        });
        const entries = {};
        keys.forEach((key, index) => {
            const value = values[index];
            if (value) entries[String(key)] = value;
        });
        await new Promise(resolve => {
            tx.oncomplete = resolve;
            tx.onerror = resolve;
            tx.onabort = resolve;
        });
        return entries;
    } finally {
        db.close();
    }
}

async function importBackupObjectStoreEntries(dbName, storeName, entries) {
    if (!entries || typeof entries !== 'object') return;
    const { db, tx, store } = await openBackupObjectStore(dbName, storeName, 'readwrite');
    try {
        store.clear();
        for (const [key, value] of Object.entries(entries)) {
            if (value) store.put(value, key);
        }
        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

function exportMonitorPetAssetsForBackup() {
    return exportBackupObjectStoreEntries(MONITOR_PET_BACKUP_DB_NAME, MONITOR_PET_BACKUP_DB_STORE);
}

async function importMonitorPetAssetsFromBackup(entries) {
    if (!entries || typeof entries !== 'object') return;
    await importBackupObjectStoreEntries(MONITOR_PET_BACKUP_DB_NAME, MONITOR_PET_BACKUP_DB_STORE, entries);
    window.ByndCharacterPet?.clearCache();
}

function exportDreamImagesForBackup() {
    return exportBackupObjectStoreEntries(DREAM_IMAGE_BACKUP_DB_NAME, DREAM_IMAGE_BACKUP_DB_STORE);
}

function importDreamImagesFromBackup(entries) {
    return importBackupObjectStoreEntries(DREAM_IMAGE_BACKUP_DB_NAME, DREAM_IMAGE_BACKUP_DB_STORE, entries);
}

async function buildByndBackupData() {
    if (typeof getWechatCharacterSnapshotForBackup !== 'function') {
        throw new Error('角色数据模块尚未准备好，请加载完成后重试');
    }
    const snapshot = await getWechatCharacterSnapshotForBackup();
    const exportData = { _version: APP_VERSION, _exportTime: new Date().toISOString() };
    const rawLocalStorageKeys = [];
    const warnings = [];

    // localStorage 数据
    getBackupLocalStorageKeys().forEach(key => {
        if (key === 'my_characters_data' || key === 'my_characters_data_meta') return;
        const raw = localStorage.getItem(key);
        if (raw !== null) {
            const parsed = parseBackupLocalStorageValue(raw);
            exportData[key] = parsed.value;
            if (parsed.raw) rawLocalStorageKeys.push(key);
        }
    });
    if (rawLocalStorageKeys.length) exportData._rawLocalStorageKeys = rawLocalStorageKeys;

    exportData.my_characters_data = snapshot.characters;
    exportData.my_characters_data_meta = { mode: 'full', updatedAt: snapshot.updatedAt, count: snapshot.characters.length };
    exportData._wechatCharactersIndexedDb = { updatedAt: snapshot.updatedAt };

    // IndexedDB 字体文件
    try {
        const fontStore = getFontStore();
        const fileFonts = fontStore.fonts.filter(f => f.type === 'file');
        if (fileFonts.length > 0) {
            exportData._fontBlobs = {};
            for (const f of fileFonts) {
                const blob = await loadFontBlob(f.id).catch(() => null);
                if (blob) exportData._fontBlobs[f.id] = blob;
                else warnings.push(`字体「${f.name || f.id}」未能读取`);
            }
        }
    } catch (e) { warnings.push('字体文件未能完整读取'); console.warn('导出字体文件失败', e); }

    // IndexedDB 桌宠素材包
    try {
        const monitorPetAssets = await exportMonitorPetAssetsForBackup();
        if (monitorPetAssets && Object.keys(monitorPetAssets).length) {
            exportData._monitorPetAssets = monitorPetAssets;
        }
    } catch (e) { warnings.push('桌宠素材未能读取'); console.warn('导出桌宠素材失败', e); }

    // IndexedDB 梦境图片
    try {
        const dreamImages = await exportDreamImagesForBackup();
        if (dreamImages && Object.keys(dreamImages).length) {
            exportData._dreamImages = dreamImages;
        }
    } catch (e) { warnings.push('梦境图片未能读取'); console.warn('导出梦境图片失败', e); }

    // IndexedDB API 账单（逐笔用量；不含小票明细，控制备份体积）
    try {
        const usageLedger = await window.ByndUsageLedger?.exportForBackup?.();
        if (Array.isArray(usageLedger) && usageLedger.length) exportData._usageLedger = usageLedger;
    } catch (e) { warnings.push('API 账单未能读取'); console.warn('导出 API 账单失败', e); }
    if (warnings.length) exportData._backupWarnings = warnings;
    return exportData;
}

function readByndBlobChunkAsBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const separator = result.indexOf(',');
            if (separator < 0) {
                reject(new Error('备份分段编码失败'));
                return;
            }
            resolve(result.slice(separator + 1));
        };
        reader.onerror = () => reject(reader.error || new Error('备份读取失败'));
        reader.readAsDataURL(blob);
    });
}

function exportByndBackupThroughAndroid(blob, filename) {
    const bridge = window.ByndAndroid;
    if (!bridge || typeof bridge.beginBackupExport !== 'function'
        || typeof bridge.appendBackupExportChunk !== 'function'
        || typeof bridge.finishBackupExport !== 'function'
        || typeof bridge.abortBackupExport !== 'function') return null;
    return new Promise((resolve, reject) => {
        const id = `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let settled = false;
        let writing = false;
        const cleanup = () => {
            window.removeEventListener('bynd:backup-export-ready', onReady);
            window.removeEventListener('bynd:backup-export', onResult);
            clearTimeout(timeout);
        };
        const fail = error => {
            if (settled) return;
            settled = true;
            if (writing) {
                try { bridge.abortBackupExport(id); } catch (e) {}
            }
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error || '备份导出失败')));
        };
        const onResult = event => {
            if (event?.detail?.id !== id) return;
            if (!event.detail.ok) {
                fail(new Error(event.detail.message || '备份导出失败'));
                return;
            }
            if (settled) return;
            settled = true;
            cleanup();
            resolve(event.detail.message || '备份已保存');
        };
        const onReady = async event => {
            if (event?.detail?.id !== id || settled) return;
            try {
                writing = true;
                const chunkSize = 192 * 1024;
                for (let offset = 0; offset < blob.size; offset += chunkSize) {
                    const encoded = await readByndBlobChunkAsBase64(blob.slice(offset, offset + chunkSize));
                    if (settled) return;
                    const accepted = bridge.appendBackupExportChunk(id, encoded);
                    if (accepted !== true && accepted !== 'true') throw new Error('备份分段写入失败');
                    // Keep the WebView event queue responsive for large image/font backups.
                    await new Promise(resolveChunk => setTimeout(resolveChunk, 0));
                }
                if (!settled) bridge.finishBackupExport(id);
            } catch (error) {
                fail(error);
            }
        };
        const timeout = setTimeout(() => {
            fail(new Error('系统文件选择或写入未完成，请重新导出并选择保存位置'));
        }, 2 * 60 * 1000);
        window.addEventListener('bynd:backup-export-ready', onReady);
        window.addEventListener('bynd:backup-export', onResult);
        try {
            bridge.beginBackupExport(id, filename);
        } catch (error) {
            fail(error);
        }
    });
}

// 导出所有数据。完整角色数据不可读时，不下载轻量索引冒充备份。
async function exportAllData() {
    try {
        const exportData = await buildByndBackupData();
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const filename = `AI_OS备份_${new Date().toISOString().slice(0,10)}.json`;
        const androidExport = exportByndBackupThroughAndroid(blob, filename);
        if (androidExport) {
            await androidExport;
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }
        alert(exportData._backupWarnings?.length
            ? `备份已下载，但以下内容未完整备份：\n${exportData._backupWarnings.join('\n')}\n请保留当前设备的数据。`
            : '导出成功！');
        return true;
    } catch (error) {
        console.error('导出失败', error);
        alert('导出失败：' + error.message);
        return false;
    }
}

// 导入数据
async function importAllData(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data._version && !data.my_characters_data && !data.my_api_data) {
            alert('这不是有效的备份文件');
            return;
        }
        if (Object.prototype.hasOwnProperty.call(data, 'my_characters_data')
            && (!Array.isArray(data.my_characters_data)
                || data.my_characters_data.some(char => !char || typeof char !== 'object' || Array.isArray(char) || char.__indexedDbBacked))) {
            throw new Error('备份中缺少完整角色数据，不能导入轻量索引');
        }

        if (!confirm('导入将覆盖当前所有数据，确定继续吗？')) return;

        // 先确认完整角色数据可保存，再恢复其他设置。
        if (Array.isArray(data.my_characters_data)) {
            if (typeof saveWechatImportedCharactersData !== 'function') throw new Error('角色存储模块尚未准备好');
            await saveWechatImportedCharactersData(data.my_characters_data);
        }

        // 恢复 localStorage。角色数据单独处理，避免大备份再次撑爆 localStorage。
        const rawLocalStorageKeys = Array.isArray(data._rawLocalStorageKeys) ? data._rawLocalStorageKeys : [];
        Object.keys(data).forEach(key => {
            if (key.startsWith('_') || key === 'my_characters_data' || key === 'my_characters_data_meta') return;
            if (isByndStorageKey(key) && key !== (window.ByndJev?.storageKey || 'bynd_jev_config_v1') && key !== (window.ByndCharacterTools?.secretStorageKey || 'bynd_tool_keys_v1')) {
                localStorage.setItem(key, stringifyBackupLocalStorageValue(data[key], rawLocalStorageKeys.includes(key)));
            }
        });

        // 恢复 IndexedDB 字体文件
        if (data._fontBlobs) {
            for (const [fontId, blob] of Object.entries(data._fontBlobs)) {
                await saveFontBlob(fontId, blob);
            }
        }

        // 恢复 IndexedDB 桌宠素材包
        if (data._monitorPetAssets) {
            await importMonitorPetAssetsFromBackup(data._monitorPetAssets);
        }

        // 恢复 IndexedDB 梦境图片
        if (data._dreamImages) {
            await importDreamImagesFromBackup(data._dreamImages);
        }

        // 恢复 API 账单（按 id 合并，不覆盖本机已有记录）
        if (Array.isArray(data._usageLedger) && window.ByndUsageLedger?.importFromBackup) {
            await window.ByndUsageLedger.importFromBackup(data._usageLedger);
        }

        alert('导入成功！页面即将刷新...');
        location.reload();
    } catch (e) {
        alert('导入失败: ' + e.message);
    }
}

// 清理无效缓存
async function clearInvalidCache() {
    let cleaned = 0;

    // 只清除已确认可重建的缓存；业务数据、未知键和用户导入的素材保持原样。
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (REBUILDABLE_CACHE_KEYS.has(key)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => { localStorage.removeItem(key); cleaned++; });

    // 计算存储用量。
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        totalSize += (localStorage.getItem(key) || '').length;
    }
    const sizeKB = (totalSize * 2 / 1024).toFixed(1); // UTF-16

    alert(`清理完成！\n清除了 ${cleaned} 项可重建缓存\n当前 localStorage 用量：${sizeKB} KB`);
}

