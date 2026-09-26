// 8. 测试 API（从列表）
async function testApiById(apiId) {
    const data = getApiData();
    const api = data.apis.find(a => a.id === apiId);
    if (!api) return;

    // 更新状态灯为 testing
    const card = document.querySelector(`.api-card[data-id="${apiId}"] .api-status-dot`);
    if (card) { card.className = 'api-status-dot testing'; }

    let result = await doTestApi(api.baseUrl, api.apiKey);
    if (!result.ok && isApiVoiceEnabled(api)) {
        result = await testMiniMaxVoiceApi(api);
    }

    // 更新状态
    const apiIdx = data.apis.findIndex(a => a.id === apiId);
    if (apiIdx >= 0) {
        data.apis[apiIdx]._status = result.ok ? 'online' : 'offline';
        saveApiData(data);
    }
    renderApiList();
}

