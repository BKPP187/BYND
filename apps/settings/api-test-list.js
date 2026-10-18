// 8. 测试 API（从列表）
async function testApiById(apiId) {
    let data = getApiData();
    const api = data.apis.find(a => a.id === apiId);
    if (!api) return;

    // 更新状态灯为 testing
    const card = [...document.querySelectorAll('.api-card')].find(node => node.dataset.id === String(apiId))?.querySelector('.api-status-dot');
    if (card) { card.className = 'api-status-dot testing'; }

    let result = await doTestApi(api.baseUrl, api.apiKey);
    if (!result.ok && isApiVoiceEnabled(api)) {
        result = await testMiniMaxVoiceApi(api);
    }

    // Re-read after the request so testing cannot overwrite edits or deletions.
    data = getApiData();
    const apiIdx = data.apis.findIndex(a => a.id === apiId);
    if (apiIdx >= 0 && data.apis[apiIdx].baseUrl === api.baseUrl && data.apis[apiIdx].apiKey === api.apiKey) {
        if (result.baseUrl && (result.ok || result.detected)) data.apis[apiIdx].baseUrl = result.baseUrl;
        data.apis[apiIdx]._status = result.ok ? 'online' : (result.detected ? 'unverified' : 'offline');
        saveApiData(data);
    }
    renderApiList();
}

