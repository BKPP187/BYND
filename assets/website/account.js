(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const state = { mode: 'register', token: '', user: null, epoch: 0, busy: false };
    const titles = { register: '给喜欢，留个家。', login: '欢迎回到小世界。', forgot: '把账号，找回来。', verify: '确认你的邮箱。', reset: '换个新的密码。' };
    function message(value) { $('account-status').textContent = value; }
    function node(tag, value, className) { const element = document.createElement(tag); if (value !== undefined) element.textContent = value; if (className) element.className = className; return element; }
    async function api(route, body) {
        const epoch = state.epoch;
        const data = await ByndSiteApi.request('/account/v1/' + route, { body, headers: { 'X-BYND-Account': '1' } });
        if (epoch !== state.epoch) throw new Error('页面状态已变化，请重新操作。');
        return data;
    }
    function clearPasswords() { $('account-password').value = ''; $('account-confirm').value = ''; $('account-password').type = 'password'; $('account-confirm').type = 'password'; $('password-visibility').textContent = '显示'; $('password-visibility').setAttribute('aria-label', '显示密码'); $('password-visibility').setAttribute('aria-pressed', 'false'); }
    function mode(value, keepMessage = false) {
        state.mode = value; clearPasswords(); $('account-home').hidden = true; $('account-entry').hidden = false;
        $('account-title').textContent = titles[value];
        $('account-tabs').hidden = !['register', 'login'].includes(value);
        for (const kind of ['register', 'login']) $('tab-' + kind).setAttribute('aria-pressed', String(value === kind));
        const fields = { name: value === 'register', email: ['register', 'login', 'forgot'].includes(value), password: ['register', 'login', 'reset'].includes(value), confirm: ['register', 'reset'].includes(value) };
        for (const [id, visible] of Object.entries(fields)) { $(id + '-field').hidden = !visible; $('account-' + id).required = visible; $('account-' + id).disabled = !visible; }
        $('activation-field').hidden = value !== 'register'; $('account-activation').disabled = value !== 'register';
        if (value !== 'register') $('account-activation').value = '';
        $('account-password').autocomplete = value === 'login' ? 'current-password' : 'new-password';
        $('account-password').minLength = value === 'login' ? 1 : 15;
        $('password-help').hidden = value === 'login';
        $('account-forgot').hidden = value !== 'login'; $('account-back').hidden = !['forgot', 'verify', 'reset'].includes(value);
        $('account-submit').textContent = { register: '注册，给喜欢留个位置 ♡', login: '登录 BYND', forgot: '发送重设密码链接', verify: '验证邮箱，完成注册', reset: '保存新密码' }[value];
        $('account-hint').textContent = { register: '验证邮箱后，就能把自己的激活码保存在这里。', login: '登录后，找回激活码和下载入口。', forgot: '我们会把重设密码的链接发到你的注册邮箱。', verify: '只有你本人提交了注册，才请确认。验证成功后，用注册时的密码登录。', reset: '新密码保存成功后，需要重新登录。' }[value];
        if (!keepMessage) message('');
    }
    async function busy(work) {
        if (state.busy) return; state.busy = true;
        const buttons = [...document.querySelectorAll('button')]; buttons.forEach(button => { button.disabled = true; });
        try { await work(); }
        catch (error) {
            if (error.code === 'login_required') { privateClear(); mode('login'); }
            message(error.message || '操作失败，请重试。');
        } finally { state.busy = false; buttons.forEach(button => { button.disabled = false; }); }
    }
    function privateClear() {
        state.user = null; state.epoch++; $('account-home').hidden = true;
        $('account-identity').textContent = ''; $('my-license-list').replaceChildren(); $('claim-code').value = ''; $('account-download').hidden = true; $('account-download').removeAttribute('href'); clearPasswords();
    }
    async function loadLicenses() {
        const data = await api('licenses'); $('my-license-list').replaceChildren();
        if (!data.licenses.length) $('my-license-list').appendChild(node('p', '还没有保存授权。拿到激活码后，点下面的“保存已有激活码”就好。', 'account-empty'));
        for (const license of data.licenses) {
            const item = node('article', undefined, 'account-license');
            item.appendChild(node('p', license.key_hint + ' · ' + (license.status === 'active' ? '永久授权' : '已停用')));
            item.appendChild(node('p', license.activated_at ? '已在设备上激活；换机请联系支持。' : '尚未在设备上激活。', 'muted'));
            if (license.status === 'active') {
                const reveal = node('button', '查看激活码', 'plain-button'); reveal.type = 'button'; item.appendChild(reveal);
                reveal.onclick = () => { void busy(async () => {
                    const data = await api('licenses/' + license.id + '/code', {});
                    if (!/^BYND(?:-[0-9A-F]{4}){8}$/.test(data.licenseKey || '')) throw new Error('激活码无效，请联系支持。');
                    const input = document.createElement('textarea'); input.readOnly = true; input.rows = 2; input.value = data.licenseKey; input.setAttribute('aria-label', '永久激活码');
                    const row = node('div', undefined, 'button-row'), copy = node('button', '复制激活码', 'plain-button'), save = node('button', '保存文本 ↓', 'plain-button'); copy.type = save.type = 'button';
                    copy.onclick = () => { void ByndSiteApi.copy(data.licenseKey, input, $('account-status')); };
                    save.onclick = () => { try { ByndSiteApi.saveText('BYND-永久激活码.txt', 'BYND 永久激活码\n\n' + data.licenseKey + '\n\n请妥善保存，不要分享给他人。'); } catch { message('保存失败，请复制激活码后手动保存。'); } };
                    row.append(copy, save); reveal.remove(); item.append(input, row); message('请妥善保存你的激活码。');
                }); };
            }
            $('my-license-list').appendChild(item);
        }
    }
    async function home(user) {
        state.user = user; clearPasswords(); $('account-entry').hidden = true; $('account-home').hidden = false;
        $('home-title').textContent = user.displayName + '的 BYND。'; $('account-identity').textContent = user.email;
        await loadLicenses();
        try {
            const data = await ByndSiteApi.request('/distribution/v1/store');
            if (!state.user) return;
            $('account-download').hidden = !data.download;
            $('account-download-info').textContent = data.download ? 'Android · v' + data.download.versionName : '安装包尚未开放下载。';
            if (data.download) { const link = $('account-download'); link.href = ByndSiteApi.downloadUrl(data.download.url); link.onclick = event => { event.preventDefault(); void ByndSiteApi.beginDownload(link.href, data.download, $('account-status')); }; }
        } catch (error) { $('account-download-info').textContent = error.message; }
    }
    function forgetLink() { state.token = ''; try { sessionStorage.removeItem('bynd_account_link_v1'); history.replaceState(null, '', location.pathname); } catch { } }
    $('account-form').onsubmit = event => { event.preventDefault(); void busy(async () => {
        const email = $('account-email').value.trim(), pass = $('account-password').value;
        if (['register', 'reset'].includes(state.mode) && pass !== $('account-confirm').value) throw new Error('两次密码不一样，再检查一下。');
        if (state.mode === 'login') {
            const result = await api('login', { email, password: pass }); forgetLink(); await home(result.user); message('欢迎回来，你的授权在这里。'); return;
        }
        const route = { register: 'register', forgot: 'forgot', verify: 'verify', reset: 'reset' }[state.mode];
        const body = state.mode === 'register' ? { email, password: pass, displayName: $('account-name').value.trim(), licenseKey: $('account-activation').value.trim() } : state.mode === 'forgot' ? { email } : state.mode === 'verify' ? { token: state.token } : { token: state.token, password: pass };
        const result = await api(route, body);
        if (['verify', 'reset'].includes(state.mode)) { forgetLink(); mode('login'); message(result.message); }
        else { clearPasswords(); $('account-activation').value = ''; $('account-local-note').hidden = result.mailMode !== 'local'; message(result.mailMode === 'local' ? '本机测试模式：若邮箱符合条件，链接会保存在管理页的“本机测试信箱”。已有账号请登录或找回密码。' : result.message); }
    }); };
    $('claim-form').onsubmit = event => { event.preventDefault(); void busy(async () => { const result = await api('claim', { licenseKey: $('claim-code').value.trim() }); $('claim-code').value = ''; $('claim-section').open = false; await loadLicenses(); message(result.message); }); };
    $('account-logout').onclick = () => { void busy(async () => { await api('logout', {}); privateClear(); mode('login'); message('已经退出登录。'); }); };
    $('license-refresh').onclick = () => { void busy(async () => { await loadLicenses(); message('授权已刷新。'); }); };
    $('tab-login').onclick = () => mode('login'); $('tab-register').onclick = () => mode('register'); $('account-forgot').onclick = () => mode('forgot'); $('account-back').onclick = () => { forgetLink(); mode('login'); };
    $('password-visibility').onclick = () => { const visible = $('account-password').type === 'password'; $('account-password').type = $('account-confirm').type = visible ? 'text' : 'password'; $('password-visibility').textContent = visible ? '隐藏' : '显示'; $('password-visibility').setAttribute('aria-label', visible ? '隐藏密码' : '显示密码'); $('password-visibility').setAttribute('aria-pressed', String(visible)); };
    function readLink(restore = false) {
        let link = location.hash.slice(1);
        try { if (/^(register|reset)=[A-Za-z0-9_-]{43}$/.test(link)) sessionStorage.setItem('bynd_account_link_v1', link); else if (restore && !link) link = sessionStorage.getItem('bynd_account_link_v1') || ''; } catch { }
        const match = /^(register|reset)=([A-Za-z0-9_-]{43})$/.exec(link);
        if (match) { state.token = match[2]; mode(match[1] === 'register' ? 'verify' : 'reset'); try { if (sessionStorage.getItem('bynd_account_link_v1') === link) history.replaceState(null, '', location.pathname); } catch { } }
        else { forgetLink(); mode(link === 'login' ? 'login' : 'register'); }
    }
    readLink(true);
    async function connect() {
        $('account-retry').hidden = true;
        try { const data = await api('me'); $('account-local-note').hidden = data.mailMode !== 'local'; if (data.user && !state.token) await home(data.user); }
        catch (error) { if (error.code === 'login_required') { privateClear(); mode('login'); } message(error.message); $('account-retry').hidden = false; }
    }
    $('account-retry').onclick = () => { void busy(connect); };
    window.addEventListener('hashchange', () => { privateClear(); readLink(); void connect(); });
    // Recheck server sessions after back/forward-cache restoration, clearing private DOM first.
    window.addEventListener('pageshow', event => { if (event.persisted) { privateClear(); mode('login'); void connect(); } });
    void connect();
})();
