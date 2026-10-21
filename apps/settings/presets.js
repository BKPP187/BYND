// ========== 预设管理 ==========

const PRESET_STORAGE_KEY = 'my_presets_data';

function getPresetData() {
    try {
        const raw = localStorage.getItem(PRESET_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { presets: [], activeId: null };
}

function savePresetData(data) {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(data));
}

function presetHasPromptContent(preset) {
    return !!preset && Array.isArray(preset.prompts) && preset.prompts.some(p =>
        p && typeof p.content === 'string' && p.content.trim());
}

function presetHasExtensionContent(preset) {
    const extensions = preset && preset.extensions;
    return !!extensions && typeof extensions === 'object' && !Array.isArray(extensions)
        && Object.keys(extensions).length > 0;
}

function renderPresetExtensions(preset) {
    if (!presetHasExtensionContent(preset)) return '';
    const renderValue = (label, value) => `<details class="preset-extension-item">
        <summary>${escapeHtml(label)}</summary>
        <div class="preset-prompt-content"><textarea readonly aria-label="${escapeHtml(label)} 原始内容">${escapeHtml(JSON.stringify(value, null, 2))}</textarea></div>
    </details>`;
    const sections = Object.entries(preset.extensions).map(([key, value]) => {
        const count = Array.isArray(value) ? ` · ${value.length} 条` : '';
        const body = key === 'regex_scripts' && Array.isArray(value)
            ? value.map((rule, index) => renderValue(rule && rule.scriptName || `规则 ${index + 1}`, rule)).join('')
            : renderValue('查看原始配置', value);
        return `<details class="preset-extension-section"><summary>${escapeHtml(key)}${count}</summary>${body}</details>`;
    }).join('');
    return `<div class="preset-prompts-list preset-extensions"><p class="preset-extension-note">扩展已保存，可展开查看。当前仅供测试查看，尚未接入聊天运行。</p>${sections}</div>`;
}

function getActivePreset() {
    const data = getPresetData();
    if (!data.activeId) return null;
    const preset = data.presets.find(p => p.id === data.activeId);
    return presetHasPromptContent(preset) ? preset : null;
}

function importPresetFile(input) {
    const file = input.files[0];
    if (!file) return;
    input.value = '';

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result.replace(/^\uFEFF/, ''));
            const preset = parsePromptPreset(json, file.name);
            if (!preset) {
                alert('没有识别到可读取的预设或扩展配置。请确认文件格式后重新导入。');
                return;
            }

            const data = getPresetData();
            const existing = data.presets.findIndex(p => p.name === preset.name);
            const replacesActive = existing >= 0 && data.presets[existing].id === data.activeId;
            if (existing >= 0) {
                if (!confirm(`已存在同名预设「${preset.name}」，覆盖吗？`)) return;
                data.presets[existing] = preset;
            } else {
                data.presets.push(preset);
            }
            if (presetHasPromptContent(preset)) data.activeId = preset.id;
            else if (replacesActive) data.activeId = null;
            savePresetData(data);
            window._expandedPresetId = preset.id;
            window._expandedPromptKey = null;
            renderPresetList();
            alert(presetHasPromptContent(preset)
                ? `预设「${preset.name}」导入成功！`
                : `「${preset.name}」已导入，可展开查看扩展内容；扩展尚未接入聊天运行。`);
        } catch (err) {
            alert('预设解析失败: ' + err.message);
        }
    };
    reader.onerror = function() {
        alert('预设文件读取失败，请确认文件可访问后重新导入。');
    };
    reader.readAsText(file);
}

function openManualPresetCreator() {
    let editor = document.getElementById('manual-preset-editor');
    if (!editor) {
        editor = document.createElement('div');
        editor.id = 'manual-preset-editor';
        editor.className = 'manual-preset-editor';
        const container = document.getElementById('preset-list-container');
        if (container && container.parentElement) container.parentElement.insertBefore(editor, container);
    }
    editor.innerHTML = `
        <div class="manual-preset-head">
            <div>
                <strong>手动新建预设</strong>
                <span>会保存为一个启用的 system prompt，可继续展开编辑。</span>
            </div>
            <button type="button" onclick="closeManualPresetCreator()"><i class="ri-close-line"></i></button>
        </div>
        <input id="manual-preset-name" class="manual-preset-input" placeholder="预设名称">
        <textarea id="manual-preset-content" class="manual-preset-textarea" placeholder="把你的预设内容写在这里。支持 {{char}}、{{user}}、{{datetime}}、{{description}} 等变量。" rows="9"></textarea>
        <div class="manual-preset-actions">
            <button type="button" class="subtle" onclick="closeManualPresetCreator()">取消</button>
            <button type="button" onclick="saveManualPreset()">保存预设</button>
        </div>
    `;
    editor.classList.remove('hidden');
    setTimeout(() => document.getElementById('manual-preset-name')?.focus(), 0);
}

function closeManualPresetCreator() {
    const editor = document.getElementById('manual-preset-editor');
    if (editor) editor.classList.add('hidden');
}

function saveManualPreset() {
    const name = (document.getElementById('manual-preset-name')?.value || '').trim();
    const content = (document.getElementById('manual-preset-content')?.value || '').trim();
    if (!content) {
        alert('先写预设内容');
        return;
    }
    const data = getPresetData();
    const preset = {
        id: 'preset_manual_' + Date.now(),
        name: name || `手动预设 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
        prompts: [{
            name: 'Main',
            role: 'system',
            content,
            identifier: 'manual_main',
            enabled: true
        }],
        temperature: 0.8,
        max_tokens: 1800,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
    };
    data.presets = Array.isArray(data.presets) ? data.presets : [];
    data.presets.unshift(preset);
    data.activeId = preset.id;
    savePresetData(data);
    window._expandedPresetId = preset.id;
    window._expandedPromptKey = preset.id + '_0';
    closeManualPresetCreator();
    renderPresetList();
}

function parsePromptPreset(json, filename) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
    const name = json.name || filename.replace(/\.json$/i, '') || '未命名预设';

    // prompt_order 存放真实启用状态（兼容多种旧格式）
    let orderMap = {};
    if (Array.isArray(json.prompt_order)) {
        const first = json.prompt_order[0];
        if (first && Array.isArray(first.order)) {
            first.order.forEach(o => { if (o.identifier) orderMap[o.identifier] = o.enabled !== false; });
        } else if (first && first.identifier) {
            json.prompt_order.forEach(o => { if (o.identifier) orderMap[o.identifier] = o.enabled !== false; });
        }
    }
    const hasOrder = Object.keys(orderMap).length > 0;

    let prompts = [];
    if (Array.isArray(json.prompts)) {
        prompts = json.prompts
            .filter(p => p && typeof p.content === 'string' && p.content.trim())
            .map(p => {
                const id = p.identifier || '';
                const enabled = (hasOrder && id in orderMap) ? orderMap[id] : (p.enabled !== false);
                return {
                    name: p.name || p.identifier || 'prompt',
                    role: p.role || 'system',
                    content: p.content,
                    identifier: id,
                    enabled: enabled
                };
            });
    }

    if (prompts.length === 0 && typeof json.main_prompt === 'string' && json.main_prompt.trim()) {
        prompts.push({ name: 'Main', role: 'system', content: json.main_prompt, identifier: 'main', enabled: true });
        if (typeof json.jailbreak_prompt === 'string' && json.jailbreak_prompt.trim()) {
            prompts.push({ name: 'Jailbreak', role: 'system', content: json.jailbreak_prompt, identifier: 'jailbreak', enabled: true });
        }
        if (typeof json.nsfw_prompt === 'string' && json.nsfw_prompt.trim()) {
            prompts.push({ name: 'NSFW', role: 'system', content: json.nsfw_prompt, identifier: 'nsfw', enabled: true });
        }
    }

    // Preserve extension payloads for test inspection; never promote them to chat instructions.
    const hasExtensions = presetHasExtensionContent(json);
    if (!prompts.length && !hasExtensions) return null;

    return {
        id: 'preset_' + Date.now(),
        name: name,
        prompts: prompts,
        ...(hasExtensions ? { extensions: json.extensions } : {}),
        importSource: { purpose: 'testing', fileName: filename },
        temperature: json.temperature ?? 0.8,
        max_tokens: json.max_tokens || json.openai_max_tokens || 1000,
        top_p: json.top_p ?? 1,
        frequency_penalty: json.frequency_penalty ?? 0,
        presence_penalty: json.presence_penalty ?? 0
    };
}

function renderPresetList() {
    const container = document.getElementById('preset-list-container');
    if (!container) return;

    const data = getPresetData();

    if (!data.presets || data.presets.length === 0) {
        container.innerHTML = `
            <div class="set-empty">
                <i class="ri-file-list-3-line"></i>
                还没有预设哦～<br>导入一个预设试试
            </div>
        `;
        return;
    }

    container.innerHTML = data.presets.map(p => {
        const hasContent = presetHasPromptContent(p);
        const hasExtensions = presetHasExtensionContent(p);
        const isActive = hasContent && p.id === data.activeId;
        const prompts = Array.isArray(p.prompts) ? p.prompts : [];
        const enabledCount = prompts.filter(pr => pr.enabled).length;
        const totalCount = prompts.length;
        const isExpanded = window._expandedPresetId === p.id;

        let promptsHtml = '';
        if (isExpanded) {
            promptsHtml = !hasContent && !hasExtensions ? `<div class="preset-prompts-list preset-missing-content">
                <p>这条记录没有可查看的内容。旧版导入时可能未保留扩展，请重新导入原文件查看。</p>
                <button type="button" class="set-add-btn" onclick="document.getElementById('import-preset-file').click()">重新导入原文件</button>
            </div>` : hasContent ? `<div class="preset-prompts-list">
                <div class="preset-params">
                    <span>temp: ${escapeHtml(p.temperature)}</span>
                    <span>max_tokens: ${escapeHtml(p.max_tokens)}</span>
                    <span>top_p: ${escapeHtml(p.top_p)}</span>
                    ${p.frequency_penalty ? `<span>freq: ${escapeHtml(p.frequency_penalty)}</span>` : ''}
                    ${p.presence_penalty ? `<span>pres: ${escapeHtml(p.presence_penalty)}</span>` : ''}
                </div>
                ${prompts.map((pr, i) => `
                    <div class="preset-prompt-item ${pr.enabled ? '' : 'disabled'}">
                        <div class="preset-prompt-header" onclick="togglePromptExpand('${escapeJsString(p.id)}', ${i})">
                            <label class="preset-toggle" onclick="event.stopPropagation()">
                                <input type="checkbox" ${pr.enabled ? 'checked' : ''} onchange="togglePromptEnabled('${escapeJsString(p.id)}', ${i}, this.checked)">
                                <span class="preset-toggle-slider"></span>
                            </label>
                            <span class="preset-prompt-name">${escapeHtml(pr.name)}</span>
                            <span class="preset-prompt-role">${escapeHtml(pr.role)}</span>
                            <i class="ri-delete-bin-6-line preset-prompt-del" onclick="event.stopPropagation(); deletePromptItem('${escapeJsString(p.id)}', ${i})" title="删除"></i>
                            <i class="ri-arrow-${window._expandedPromptKey === p.id+'_'+i ? 'up' : 'down'}-s-line"></i>
                        </div>
                        ${window._expandedPromptKey === p.id+'_'+i ? `
                            <div class="preset-prompt-content">
                                <textarea onchange="editPromptContent('${escapeJsString(p.id)}', ${i}, this.value)">${escapeHtml(pr.content)}</textarea>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>` : '';
            promptsHtml += renderPresetExtensions(p);
        }

        return `
            <div class="preset-card ${isActive ? 'active' : ''}" data-id="${escapeHtml(p.id)}">
                <div class="preset-card-header" onclick="togglePresetExpand('${escapeJsString(p.id)}')">
                    <div class="preset-card-left">
                        <i class="ri-arrow-${isExpanded ? 'up' : 'down'}-s-line preset-chevron"></i>
                        <div class="preset-card-info">
                            <div class="preset-card-name">
                                ${isActive ? '<span style="color:#f8a4b8;margin-right:4px;">♛</span>' : ''}
                                ${escapeHtml(p.name)}
                            </div>
                            <div class="preset-card-meta">${hasContent ? `${enabledCount}/${totalCount} prompts · temp ${escapeHtml(p.temperature)}` : hasExtensions ? '扩展配置 · 测试查看' : '记录为空 · 请重新导入'}</div>
                        </div>
                    </div>
                    <div class="preset-card-actions" onclick="event.stopPropagation()">
                        ${hasContent ? `<i class="ri-star-${isActive ? 'fill' : 'line'}" title="${isActive ? '取消启用' : '启用'}" onclick="setActivePreset('${escapeJsString(p.id)}')" style="${isActive ? 'color:#f8a4b8;' : 'color:#999;'}"></i>` : ''}
                        <i class="ri-delete-bin-6-line" title="删除" onclick="deletePreset('${escapeJsString(p.id)}')" style="color:#999;"></i>
                    </div>
                </div>
                ${promptsHtml}
            </div>
        `;
    }).join('');
}

window._expandedPresetId = null;
window._expandedPromptKey = null;

function togglePresetExpand(presetId) {
    window._expandedPresetId = (window._expandedPresetId === presetId) ? null : presetId;
    window._expandedPromptKey = null;
    renderPresetList();
}

function togglePromptExpand(presetId, promptIdx) {
    const key = presetId + '_' + promptIdx;
    window._expandedPromptKey = (window._expandedPromptKey === key) ? null : key;
    renderPresetList();
}

function togglePromptEnabled(presetId, promptIdx, enabled) {
    const data = getPresetData();
    const preset = data.presets.find(p => p.id === presetId);
    if (!preset) return;
    preset.prompts[promptIdx].enabled = enabled;
    savePresetData(data);
    renderPresetList();
}

function editPromptContent(presetId, promptIdx, newContent) {
    const data = getPresetData();
    const preset = data.presets.find(p => p.id === presetId);
    if (!preset) return;
    preset.prompts[promptIdx].content = newContent;
    savePresetData(data);
}

function deletePromptItem(presetId, promptIdx) {
    if (!confirm('删除这条 prompt 吗？')) return;
    const data = getPresetData();
    const preset = data.presets.find(p => p.id === presetId);
    if (!preset) return;
    preset.prompts.splice(promptIdx, 1);
    savePresetData(data);
    window._expandedPromptKey = null;
    renderPresetList();
}

function setActivePreset(presetId) {
    const data = getPresetData();
    if (!presetHasPromptContent(data.presets.find(p => p.id === presetId))) {
        alert('这条记录没有可启用的聊天提示词；扩展配置请展开查看。');
        return;
    }
    data.activeId = (data.activeId === presetId) ? null : presetId;
    savePresetData(data);
    renderPresetList();
}

function deletePreset(presetId) {
    if (!confirm('确定删除这个预设吗？')) return;
    const data = getPresetData();
    data.presets = data.presets.filter(p => p.id !== presetId);
    if (data.activeId === presetId) data.activeId = null;
    savePresetData(data);
    renderPresetList();
}

