// ========== 数据管理（导出 / 导入 / 清理缓存） ==========

const APP_VERSION = 'v1.1.989';
const MONITOR_PET_BACKUP_DB_NAME = 'bynd_monitor_pet_assets_v1';
const MONITOR_PET_BACKUP_DB_STORE = 'assets';
const DREAM_IMAGE_BACKUP_DB_NAME = 'bynd_dream_images_v1';
const DREAM_IMAGE_BACKUP_DB_STORE = 'images';
const ALL_DATA_KEYS = [
    'bynd_prompt_lab_v1',
    'bynd_jev_config_v1',
    'bynd_character_events_v1',
    'my_characters_data',
    'my_characters_data_meta',
    'bynd_worldbooks_v1',
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
    'bynd_coread_reading_journal_v1',
    'bynd_coread_literature_v1',
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
    'bynd_home3d_v1',
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
    'bynd_wolfcha_audio_v1',
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
    // Jev configuration travels with the backup for cross-device testing.
    // Character tool keys (AMap / TMDB) remain device-local secrets.
    const toolSecretStorageKey = window.ByndCharacterTools?.secretStorageKey || 'bynd_tool_keys_v1';
    const tripoSecretStorageKey = window.ByndTripo?.storageKey || 'bynd_tripo_private_v1';
    const lifePrivateStorageKeys = new Set(['bynd_life_state_private_v1', 'bynd_moon_private_v1', 'bynd_health_connection_private_v1', 'bynd_vivix_private_v1', 'bynd_proactive_notify_client_secret_v1']);
    const keys = new Set(ALL_DATA_KEYS);
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (isByndStorageKey(key) && key !== toolSecretStorageKey && key !== tripoSecretStorageKey && !lifePrivateStorageKeys.has(key)) keys.add(key);
    }
    keys.delete(toolSecretStorageKey);
    keys.delete(tripoSecretStorageKey);
    lifePrivateStorageKeys.forEach(key => keys.delete(key));
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
        let timeout = null;
        // The picker wait and each write step get their own window. One fixed limit for
        // picking a location plus writing every chunk aborted large backups mid-write.
        const armTimeout = (ms, message) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fail(new Error(message)), ms);
        };
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
                const stalled = '备份写入长时间没有进展，已停止。请重新导出';
                armTimeout(60 * 1000, stalled);
                const chunkSize = 192 * 1024;
                for (let offset = 0; offset < blob.size; offset += chunkSize) {
                    const encoded = await readByndBlobChunkAsBase64(blob.slice(offset, offset + chunkSize));
                    if (settled) return;
                    const accepted = bridge.appendBackupExportChunk(id, encoded);
                    if (accepted !== true && accepted !== 'true') throw new Error('备份分段写入失败');
                    armTimeout(60 * 1000, stalled);
                    // Keep the WebView event queue responsive for large image/font backups.
                    await new Promise(resolveChunk => setTimeout(resolveChunk, 0));
                }
                if (!settled) {
                    armTimeout(2 * 60 * 1000, '系统没有确认备份已写完，请检查保存的文件或重新导出');
                    bridge.finishBackupExport(id);
                }
            } catch (error) {
                fail(error);
            }
        };
        armTimeout(5 * 60 * 1000, '没有选择保存位置，请重新导出并选择保存位置');
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
            // Revoking in the same task can cancel the download in Safari and Firefox.
            setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
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

function isByndBackupImportableKey(key) {
    return isByndStorageKey(key) && !['bynd_life_state_private_v1', 'bynd_moon_private_v1', 'bynd_health_connection_private_v1', 'bynd_proactive_notify_client_secret_v1'].includes(key) && key !== 'bynd_vivix_private_v1' && key !== (window.ByndCharacterTools?.secretStorageKey || 'bynd_tool_keys_v1') && key !== (window.ByndTripo?.storageKey || 'bynd_tripo_private_v1');
}

// 导入数据。先完整校验，再写入；任何一步失败都按快照回滚，不留下半新半旧的数据。
async function importAllData(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';

    const undo = [];
    let applying = false;
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
        const importsCharacters = Array.isArray(data.my_characters_data);
        // Check every module before the first write, so a missing module cannot leave a partial import.
        if (importsCharacters) {
            if (typeof saveWechatImportedCharactersData !== 'function') throw new Error('角色存储模块尚未准备好');
            if (localStorage.getItem('bynd_life_state_private_v1') && !window.ByndLifeState?.revokeAll) throw new Error('生活授权模块尚未准备好，无法安全导入角色');
            if (localStorage.getItem('bynd_moon_private_v1') && !window.ByndMoon?.revokeAll) throw new Error('月伴授权模块尚未准备好，无法安全导入角色');
        }
        if (data._fontBlobs && typeof data._fontBlobs === 'object' && Object.keys(data._fontBlobs).length && typeof saveFontBlob !== 'function') {
            throw new Error('字体模块尚未准备好');
        }
        const rawLocalStorageKeys = Array.isArray(data._rawLocalStorageKeys) ? data._rawLocalStorageKeys : [];
        const localEntries = Object.keys(data)
            .filter(key => !key.startsWith('_') && key !== 'my_characters_data' && key !== 'my_characters_data_meta' && isByndBackupImportableKey(key))
            .map(key => [key, stringifyBackupLocalStorageValue(data[key], rawLocalStorageKeys.includes(key))]);

        if (!confirm('导入将覆盖当前所有数据，确定继续吗？')) return;
        applying = true;

        // 1. localStorage：记录旧值后逐项写入。
        const previousLocal = new Map(localEntries.map(([key]) => [key, localStorage.getItem(key)]));
        undo.push(() => {
            previousLocal.forEach((value, key) => {
                if (value === null) localStorage.removeItem(key);
                else localStorage.setItem(key, value);
            });
        });
        localEntries.forEach(([key, value]) => localStorage.setItem(key, value));

        // 2. 角色数据：先保存当前快照，失败时写回。快照不可读时仍允许导入，用于修复损坏的安装。
        if (importsCharacters) {
            let previousCharacters = null;
            try {
                if (typeof getWechatCharacterSnapshotForBackup === 'function') previousCharacters = await getWechatCharacterSnapshotForBackup();
            } catch (error) {
                console.warn('导入前无法读取当前角色快照，失败时无法恢复角色数据', error);
            }
            // Imported characters can reuse an existing ID. Local health consent must be renewed.
            if (localStorage.getItem('bynd_life_state_private_v1')) window.ByndLifeState.revokeAll();
            if (localStorage.getItem('bynd_moon_private_v1')) window.ByndMoon.revokeAll();
            await saveWechatImportedCharactersData(data.my_characters_data);
            if (previousCharacters && Array.isArray(previousCharacters.characters)) {
                undo.push(() => saveWechatImportedCharactersData(previousCharacters.characters));
            } else {
                undo.push(() => { throw new Error('导入前的角色数据无法读取，未能恢复'); });
            }
        }

        // 3. IndexedDB 字体文件
        if (data._fontBlobs && typeof data._fontBlobs === 'object') {
            const fontIds = Object.keys(data._fontBlobs);
            const previousFonts = new Map();
            for (const fontId of fontIds) {
                previousFonts.set(fontId, typeof loadFontBlob === 'function' ? await loadFontBlob(fontId).catch(() => null) : null);
            }
            undo.push(async () => {
                for (const [fontId, value] of previousFonts) {
                    if (value) await saveFontBlob(fontId, value);
                    else if (typeof deleteFontBlob === 'function') await deleteFontBlob(fontId);
                }
            });
            for (const fontId of fontIds) {
                await saveFontBlob(fontId, data._fontBlobs[fontId]);
            }
        }

        // 4. IndexedDB 桌宠素材包、梦境图片：整库替换前先读出旧内容。
        if (data._monitorPetAssets) {
            const previousPetAssets = await exportMonitorPetAssetsForBackup();
            undo.push(() => importMonitorPetAssetsFromBackup(previousPetAssets || {}));
            await importMonitorPetAssetsFromBackup(data._monitorPetAssets);
        }
        if (data._dreamImages) {
            const previousDreamImages = await exportDreamImagesForBackup();
            undo.push(() => importDreamImagesFromBackup(previousDreamImages || {}));
            await importDreamImagesFromBackup(data._dreamImages);
        }

        // 5. API 账单（按 id 合并，不覆盖本机已有记录；只增不改，因此放在最后）
        if (Array.isArray(data._usageLedger) && window.ByndUsageLedger?.importFromBackup) {
            await window.ByndUsageLedger.importFromBackup(data._usageLedger);
        }

        alert('导入成功！页面即将刷新...');
        location.reload();
    } catch (e) {
        let rollbackNote = '';
        if (applying && undo.length) {
            const problems = [];
            for (const step of undo.reverse()) {
                try { await step(); } catch (error) { problems.push(error?.message || String(error)); }
            }
            rollbackNote = problems.length
                ? `\n部分数据未能恢复到导入前：${problems.join('；')}。请不要关闭应用，先导出一份当前备份。`
                : '\n已恢复到导入前的数据。';
        }
        alert('导入失败: ' + e.message + rollbackNote);
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

