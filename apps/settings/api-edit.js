// 4. 打开编辑弹窗
function openApiModal(editId) {
    const modal = document.getElementById('api-edit-modal');
    const titleEl = document.getElementById('api-modal-title');
    const resultEl = document.getElementById('api-test-result');
    resultEl.innerHTML = '';

    if (editId) {
        // 编辑模式
        const data = getApiData();
        const api = data.apis.find(a => a.id === editId);
        if (!api) return;
        titleEl.textContent = '编辑 API';
        document.getElementById('api-edit-id').value = api.id;
        document.getElementById('api-edit-name').value = api.name || '';
        document.getElementById('api-edit-url').value = api.baseUrl || '';
        document.getElementById('api-edit-key').value = api.apiKey || '';
        // 模型：先恢复为 select，显示已保存的值
        restoreModelSelect();
        restoreImageModelSelect();
        const modelEl = document.getElementById('api-edit-model');
        modelEl.dataset.savedModel = api.model || '';
        if (api.model) {
            modelEl.innerHTML = `<option value="">不在这个 API 使用聊天</option><option value="${escapeHtml(api.model)}" selected>${escapeHtml(api.model)}</option><option value="__refresh_hint" disabled>重新测试可刷新列表</option>`;
            modelEl.disabled = false;
            modelEl.style.color = '#5a4a52';
            modelEl.style.background = '#faf5f0';
            modelEl.style.cursor = 'pointer';
            const hintEl = document.getElementById('api-model-hint');
            if (hintEl) hintEl.textContent = '重新测试可刷新列表';
        } else {
            modelEl.innerHTML = '<option value="" selected>不在这个 API 使用聊天</option><option value="__refresh_hint" disabled>重新测试可刷新列表</option>';
            modelEl.disabled = false;
            modelEl.style.color = '#5a4a52';
            modelEl.style.background = '#faf5f0';
            modelEl.style.cursor = 'pointer';
            const hintEl = document.getElementById('api-model-hint');
            if (hintEl) hintEl.textContent = '当前不用于聊天，重新测试可刷新列表';
        }
        const imageModelEl = document.getElementById('api-edit-image-model');
        imageModelEl.dataset.savedModel = api.imageModel || '';
        if (api.imageModel) {
            imageModelEl.innerHTML = `<option value="${escapeHtml(api.imageModel)}" selected>${escapeHtml(api.imageModel)}</option><option value="" disabled>重新测试可刷新列表</option>`;
            imageModelEl.disabled = false;
            imageModelEl.style.color = '#5a4a52';
            imageModelEl.style.background = '#faf5f0';
            imageModelEl.style.cursor = 'pointer';
            const hintEl = document.getElementById('api-image-model-hint');
            if (hintEl) hintEl.textContent = '重新测试可刷新列表';
        }
    } else {
        // 新增模式
        titleEl.textContent = '添加 API';
        document.getElementById('api-edit-id').value = '';
        document.getElementById('api-edit-name').value = '';
        document.getElementById('api-edit-url').value = '';
        document.getElementById('api-edit-key').value = '';
        restoreModelSelect();
        restoreImageModelSelect();
        const modelEl2 = document.getElementById('api-edit-model');
        modelEl2.dataset.savedModel = '';
        modelEl2.innerHTML = '<option value="">请先点测试按钮</option>';
        modelEl2.disabled = true;
        modelEl2.style.color = '#999';
        modelEl2.style.background = '#f0ebe6';
        modelEl2.style.cursor = 'not-allowed';
        const hintEl2 = document.getElementById('api-model-hint');
        if (hintEl2) hintEl2.textContent = '先测试连接再选~';
        const imageModelEl2 = document.getElementById('api-edit-image-model');
        imageModelEl2.dataset.savedModel = '';
        imageModelEl2.innerHTML = '<option value="">请先点测试按钮</option>';
        imageModelEl2.disabled = true;
        imageModelEl2.style.color = '#999';
        imageModelEl2.style.background = '#f0ebe6';
        imageModelEl2.style.cursor = 'not-allowed';
        const imageHintEl2 = document.getElementById('api-image-model-hint');
        if (imageHintEl2) imageHintEl2.textContent = '测试后从下拉列表选择';
    }

    modal.classList.remove('hidden');
    refreshApiModelPickers();
}

function closeApiModal() {
    closeApiFloatingPickers();
    document.getElementById('api-edit-modal').classList.add('hidden');
}

// 5. 保存 API
function saveApi() {
    const id = document.getElementById('api-edit-id').value;
    const name = document.getElementById('api-edit-name').value.trim();
    const baseUrl = document.getElementById('api-edit-url').value.trim();
    const apiKey = document.getElementById('api-edit-key').value.trim();
    const modelEl = document.getElementById('api-edit-model');
    const model = (modelEl.value || '').trim();
    const imageModelEl = document.getElementById('api-edit-image-model');
    const imageModel = (imageModelEl?.value || '').trim();

    if (!name) { alert('请填写名称'); return; }
    if (!baseUrl) { alert('请填写 Base URL'); return; }

    const data = getApiData();

    if (id) {
        // 更新
        const idx = data.apis.findIndex(a => a.id === id);
        if (idx >= 0) {
            data.apis[idx] = { ...data.apis[idx], name, baseUrl, apiKey, model, imageModel };
        }
    } else {
        // 新增
        const newApi = {
            id: 'api_' + Date.now(),
            name, baseUrl, apiKey, model, imageModel
        };
        data.apis.push(newApi);
        // 第一个可聊天 API 自动设为默认
        if (newApi.model && !data.defaultId) {
            data.defaultId = newApi.id;
        }
        if (newApi.imageModel && !data.imageDefaultId) data.imageDefaultId = newApi.id;
    }

    saveApiData(data);
    closeApiModal();
    renderApiList();
}

// 6. 删除 API
function deleteApi(apiId) {
    if (!confirm('确定删除这个 API 吗？')) return;

    const data = getApiData();
    data.apis = data.apis.filter(a => a.id !== apiId);
    if (data.defaultId === apiId) {
        const nextChatApi = data.apis.find(api => api.model);
        data.defaultId = nextChatApi ? nextChatApi.id : null;
    }
    if (data.imageDefaultId === apiId) {
        const nextImageApi = data.apis.find(api => api.imageModel);
        data.imageDefaultId = nextImageApi ? nextImageApi.id : null;
    }
    saveApiData(data);
    renderApiList();
}

// 7. 设为默认
function setDefaultApi(apiId) {
    const data = getApiData();
    const api = data.apis.find(a => a.id === apiId);
    if (!api || !api.model) {
        alert('这个 API 当前没有聊天模型。请先编辑它选择聊天模型，或者取消“不在这个 API 使用聊天”。');
        renderApiList();
        return;
    }
    data.defaultId = apiId;
    saveApiData(data);
    renderApiList();
}

function setDefaultImageApi(apiId) {
    const data = getApiData();
    const api = data.apis.find(a => a.id === apiId);
    if (!api || !api.imageModel) {
        alert('这个 API 还没有选择生图模型。请先编辑它，测试后从“生图模型”下拉里选一个，或者单独添加生图 API。');
        renderApiList();
        return;
    }
    data.imageDefaultId = apiId;
    saveApiData(data);
    renderApiList();
}

