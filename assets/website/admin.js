(function () {
    'use strict';
    const $ = id => document.getElementById(id), state = { token: '', epoch: 0, current: null, delivery: null, cursor: null, idle: null };
    const pending = new Map();
    const serviceLabel = document.createElement('p'); serviceLabel.className = 'muted';
    serviceLabel.textContent = (location.protocol === 'http:' ? '本机测试后台 · ' : '线上授权后台 · ') + location.origin;
    $('admin-login').insertBefore(serviceLabel, $('login-form'));
    function node(tag, value, className) { const element = document.createElement(tag); if (value !== undefined) element.textContent = value; if (className) element.className = className; return element; }
    function message(value) { $('admin-status').textContent = value; }
    async function api(route, body) {
        const epoch = state.epoch;
        try {
            const result = await ByndSiteApi.request(route, { token: state.token, body });
            if (epoch !== state.epoch) throw new Error('管理会话已退出，请重新登录。');
            return result;
        } catch (error) { if (error.status === 401) logout(); throw error; }
    }
    function armIdle() { if (!state.token) return; clearTimeout(state.idle); state.idle = setTimeout(() => { logout(); message('一段时间没有操作，管理会话已退出。'); }, 15 * 60 * 1000); }
    function logout() {
        state.token = ''; state.epoch++; state.current = null; state.delivery = null; clearTimeout(state.idle);
        $('admin-workspace').hidden = true; $('admin-login').hidden = false; $('admin-logout').hidden = true;
        for (const id of ['admin-token', 'admin-code', 'delivery-link', 'customer-email', 'delivery-email', 'order-ref']) $(id).value = '';
        $('license-list').replaceChildren(); $('license-facts').replaceChildren(); $('delivery-history').replaceChildren(); $('artifact-list').replaceChildren(); $('account-mail-list').replaceChildren();
        $('license-detail').hidden = true; $('delivery-result').hidden = true; pending.clear(); message('已退出管理。');
    }
    async function requestId(kind, payload) {
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
        const fingerprint = Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
        const key = 'bynd_admin_request_' + kind;
        let prior = pending.get(kind);
        try { if (!prior) prior = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { }
        const saved = prior?.fingerprint === fingerprint ? prior : { id: crypto.randomUUID(), fingerprint };
        pending.set(kind, saved);
        try { sessionStorage.setItem(key, JSON.stringify(saved)); } catch { }
        return saved.id;
    }
    function complete(kind) { pending.delete(kind); try { sessionStorage.removeItem('bynd_admin_request_' + kind); } catch { } }
    async function busy(button, work, channel = message) {
        button.disabled = true;
        try { await work(); } catch (error) { channel(error.message || '操作失败，请重试。'); }
        finally { button.disabled = false; }
    }
    function date(seconds) { return seconds ? new Date(seconds * 1000).toLocaleString('zh-CN') : '—'; }
    async function list(reset = true) {
        const query = new URLSearchParams({ q: $('license-search').value.trim() });
        if (!reset && state.cursor) query.set('cursor', state.cursor);
        const data = await api('/admin/v1/licenses?' + query);
        if (reset) $('license-list').replaceChildren();
        for (const license of data.licenses) {
            const row = node('button', license.key_hint + ' · ' + (license.status === 'active' ? '有效' : '已停用'), 'license-row'); row.type = 'button';
            row.appendChild(node('small', license.order_ref || license.customer_email || license.id));
            row.onclick = () => { void busy(row, () => select(license.id)); }; $('license-list').appendChild(row);
        }
        if (reset && data.licenses.length === 0) $('license-list').appendChild(node('p', '没有找到对应授权。', 'muted'));
        state.cursor = data.nextCursor; $('license-more').hidden = !state.cursor;
    }
    async function select(id) {
        const data = await api('/admin/v1/licenses/' + id), license = data.license;
        state.current = license; state.delivery = null;
        $('admin-code').value = ''; $('admin-code').hidden = true; $('admin-code-copy').hidden = true; $('delivery-link').value = ''; $('delivery-result').hidden = true;
        const facts = $('license-facts'); facts.replaceChildren();
        for (const [label, value] of [['License ID', license.id], ['状态', license.status === 'active' ? '有效' : '已停用'], ['购买记录', license.order_ref || '测试授权／未填写'], ['邮箱', license.customer_email || '未填写'], ['设备绑定', license.bound_device ? '已绑定一台设备' : '未绑定'], ['最近激活版本码', license.last_version_code || '尚无记录'], ['首次激活', date(license.activated_at)]]) { facts.append(node('dt', label), node('dd', String(value))); }
        $('license-toggle').textContent = license.status === 'active' ? '禁用授权' : '恢复授权';
        $('license-recover').disabled = license.status !== 'active'; $('delivery-email').value = license.customer_email || '';
        $('license-detail').hidden = false;
        await history(id); message('已读取授权。');
    }
    async function history(id) {
        const data = await api('/admin/v1/licenses/' + id + '/deliveries'); $('delivery-history').replaceChildren();
        const labels = { ready: '未发送邮件', sending: '发送中／结果待核对', accepted: '邮件服务已接受（不代表已送达）', unknown: '发送结果待核对', failed: '发送失败，可重试' };
        for (const delivery of data.deliveries) {
            const line = node('p', (delivery.customer_email || '没有填写邮箱') + ' · ' + (labels[delivery.email_state] || delivery.email_state) + ' · ' + date(delivery.created_at));
            const retry = node('button', '重新打开这份交付', 'plain-button'); retry.type = 'button';
            retry.onclick = () => { void busy(retry, () => createDelivery(delivery.customer_email, delivery.id)); };
            line.appendChild(retry); $('delivery-history').appendChild(line);
        }
        if (!data.deliveries.length) $('delivery-history').appendChild(node('p', '还没有领取记录。'));
    }
    async function createDelivery(email, existingId) {
        const id = state.current.id, payload = { email: email || null };
        const request = existingId || await requestId('delivery', { licenseId: id, ...payload });
        const data = await api('/admin/v1/licenses/' + id + '/delivery', { ...payload, requestId: request });
        complete('delivery'); state.delivery = data; $('delivery-link').value = data.receiptUrl; $('delivery-result').hidden = false;
        $('delivery-send').hidden = !email; $('delivery-send').disabled = false;
        $('delivery-status').textContent = data.emailState === 'accepted' ? '邮件服务已接受这份交付；用户是否收到仍需确认。' : '领取链接已生成，有效期至 ' + date(data.expiresAt) + '。';
        message('领取链接已生成，可以私下交付给用户。'); await history(id);
    }
    async function mutate(action) {
        const selected = state.current;
        const hints = { disable: '禁用后将禁止后续激活，已签发的离线凭证不会立即失效。确定禁用？', enable: '确定恢复这份授权的后续激活？', unbind: '确定为用户换机解绑？旧设备的离线凭证不会立即失效。' };
        if (!confirm(hints[action])) return;
        const payload = { expectedRevision: selected.revision };
        const id = await requestId(action, { licenseId: selected.id, ...payload });
        await api('/admin/v1/licenses/' + selected.id + '/' + action, { ...payload, requestId: id });
        complete(action); await select(selected.id); await list(); message('操作已完成。已签发的离线凭证不会立即撤销。');
    }
    async function artifacts() {
        const result = await api('/admin/v1/artifacts'); $('artifact-list').replaceChildren();
        for (const item of result.artifacts) $('artifact-list').appendChild(node('p', 'v' + item.version_name + ' · versionCode ' + item.version_code + ' · ' + (item.size / 1024 / 1024).toFixed(1) + ' MB · 已上传校验'));
        if (!result.artifacts.length) $('artifact-list').appendChild(node('p', '还没有上传并校验的 APK。', 'muted'));
    }
    $('login-form').onsubmit = event => {
        event.preventDefault(); const button = event.submitter;
        void busy(button, async () => {
            state.token = $('admin-token').value.trim();
            const config = await api('/admin/v1/config'); $('admin-token').value = '';
            $('admin-login').hidden = true; $('admin-workspace').hidden = false; $('admin-logout').hidden = false;
            const summary = $('admin-summary'); summary.replaceChildren();
            for (const text of [config.saleOpen ? '已开售' : '尚未开售', config.activationEnabled ? '激活已开启' : '公众激活关闭', config.emailEnabled ? '邮件已配置' : '邮件尚未配置']) summary.appendChild(node('span', text));
            $('price-label').value = config.priceLabel; $('purchase-url').value = config.configuredPurchaseUrl || '';
            armIdle(); await Promise.all([list(), artifacts()]); message('已进入管理。');
        });
    };
    $('admin-logout').onclick = logout;
    $('account-mail-panel').hidden = !(location.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname));
    $('account-mail-refresh').onclick = () => { void busy($('account-mail-refresh'), async () => {
        const result = await api('/admin/v1/account-mail'); $('account-mail-list').replaceChildren();
        for (const mail of result.messages) {
            const row = node('p', mail.to + ' · ' + mail.subject + ' · ' + mail.createdAt);
            const link = new URL(mail.link);
            if (link.origin !== location.origin || link.pathname !== '/account.html' || !/^#(register|reset)=[A-Za-z0-9_-]{43}$/.test(link.hash)) continue;
            const anchor = node('a', '打开验证链接 ↗'); anchor.href = link.href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
            row.append(node('br'), anchor); $('account-mail-list').appendChild(row);
        }
        if (!result.messages.length) $('account-mail-list').appendChild(node('p', '还没有测试邮件。'));
        message('已读取本机测试邮件，真实邮箱没有收到邮件。');
    }); };
    document.addEventListener('pointerdown', armIdle); document.addEventListener('keydown', armIdle);
    $('create-form').onsubmit = event => {
        event.preventDefault(); void busy(event.submitter, async () => {
            const payload = { orderRef: $('order-ref').value.trim() || null, email: $('customer-email').value.trim() || null };
            const request = await requestId('create', payload);
            const data = await api('/admin/v1/licenses', { ...payload, requestId: request });
            await select(data.id);
            $('admin-code').value = data.licenseKey; $('admin-code').hidden = false; $('admin-code-copy').hidden = false;
            complete('create');
            message('激活码已创建。可以直接复制，或生成领取链接。');
            try { await list(); } catch (error) { message('激活码已创建，但列表未刷新：' + error.message); }
        });
    };
    $('search-form').onsubmit = event => { event.preventDefault(); void busy(event.submitter, () => list()); };
    $('license-more').onclick = () => { void busy($('license-more'), () => list(false)); };
    $('license-recover').onclick = () => { void busy($('license-recover'), async () => { const result = await api('/admin/v1/licenses/' + state.current.id + '/recover', {}); $('admin-code').value = result.licenseKey; $('admin-code').hidden = false; $('admin-code-copy').hidden = false; message('已读取激活码，请妥善交付。'); }); };
    $('admin-code-copy').onclick = () => { void ByndSiteApi.copy($('admin-code').value, $('admin-code'), $('admin-status')); };
    $('license-unbind').onclick = () => { void busy($('license-unbind'), () => mutate('unbind')); };
    $('license-toggle').onclick = () => { void busy($('license-toggle'), () => mutate(state.current.status === 'active' ? 'disable' : 'enable')); };
    $('delivery-form').onsubmit = event => { event.preventDefault(); void busy(event.submitter, () => createDelivery($('delivery-email').value.trim() || null)); };
    $('delivery-copy').onclick = () => { void ByndSiteApi.copy($('delivery-link').value, $('delivery-link'), $('delivery-status')); };
    $('delivery-send').onclick = () => { void busy($('delivery-send'), async () => {
        if (!confirm('发送给这份领取记录中的邮箱？邮件服务接受发送不代表用户已收到。')) return;
        await api('/admin/v1/deliveries/' + state.delivery.id + '/email', {});
        $('delivery-status').textContent = '邮件服务已接受发送；是否送达请以用户邮箱或邮件服务后台为准。'; await history(state.current.id);
    }, value => { $('delivery-status').textContent = value; }); };
    $('release-form').onsubmit = event => { event.preventDefault(); void busy(event.submitter, async () => {
        const file = $('release-manifest').files[0]; if (!file || file.size > 32768) throw new Error('请选择不超过32 KB的更新清单。');
        let manifest; try { manifest = JSON.parse(await file.text()); } catch { throw new Error('清单 JSON 格式无效。'); }
        if (!confirm('确定发布 v' + String(manifest.versionName || '') + '？已开启更新检查的客户端会看到此版本。')) return;
        await api('/admin/v1/releases/android/stable', manifest); message('更新清单已发布。');
        try { await artifacts(); } catch (error) { message('更新清单已发布，但安装包列表未刷新：' + error.message); }
    }); };
    $('store-form').onsubmit = event => { event.preventDefault(); void busy(event.submitter, async () => {
        const result = await api('/admin/v1/store', { priceLabel: $('price-label').value.trim(), purchaseUrl: $('purchase-url').value.trim() });
        message(result.saleOpen ? '购买页配置已保存，售卖开关已开启。' : '购买页配置已保存，仍未开售。');
    }); };
})();
