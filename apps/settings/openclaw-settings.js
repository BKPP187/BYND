// Local connection preparation. Remote WeChat login and routing remain on the gateway.
(() => {
    const sessionKey = 'bynd_openclaw_session_v1:';
    const secrets = new Map();
    const tests = new Map();
    const operations = new Set();
    const escape = value => wcEscapeHtml(String(value ?? ''));
    const currentRoot = () => document.getElementById('bynd-openclaw-settings');
    const findChar = id => (window.myCharacters || []).find(char => char.id === id);
    const fingerprint = binding => JSON.stringify([binding.endpoint, binding.agentId, binding.accountId]);
    const defaultAgent = char => ('bynd-' + String(char.id).toLowerCase().replace(/[^a-z0-9_-]/g, '-')).slice(0, 64);

    function normalize(raw = {}) {
        let endpoint = String(raw.endpoint || '').trim();
        if (endpoint) {
            let url;
            try { url = new URL(endpoint); } catch (_) { throw new Error('请填写完整的 OpenClaw 服务地址。'); }
            const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
            if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('服务地址需使用 HTTPS，本机地址可使用 HTTP。');
            if (url.username || url.password || url.search || url.hash) throw new Error('服务地址不能包含账号、密码、查询参数或锚点。');
            endpoint = url.href.replace(/\/+$/, '').replace(/\/v1(?:\/chat\/completions|\/models)?$/, '');
        }
        const agentId = String(raw.agentId || '').trim();
        if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(agentId)) throw new Error('Agent ID 需为 1–64 位小写字母、数字、短横线或下划线。');
        const accountId = String(raw.accountId || '').trim();
        if (accountId && !/^[a-zA-Z0-9_.:@-]{1,128}$/.test(accountId)) throw new Error('请填写微信插件显示的 account ID，不能包含空格。');
        return { endpoint, agentId, accountId, channel: 'openclaw-weixin' };
    }
    window.normalizeWechatOpenClawBinding = normalize;

    function readSecret(charId, endpoint) {
        let saved = secrets.get(charId);
        if (!saved) {
            try { saved = JSON.parse(sessionStorage.getItem(sessionKey + charId) || 'null'); } catch (_) {}
        }
        return saved?.endpoint === endpoint ? String(saved.token || '') : '';
    }
    function writeSecret(charId, endpoint, token) {
        const saved = { endpoint, token };
        if (token) secrets.set(charId, saved); else secrets.delete(charId);
        // If sessionStorage is unavailable, retain it only in this page's memory.
        try {
            if (token) sessionStorage.setItem(sessionKey + charId, JSON.stringify(saved));
            else sessionStorage.removeItem(sessionKey + charId);
        } catch (_) {}
    }
    function formValue(root) {
        const binding = normalize({ endpoint: root.querySelector('[name="endpoint"]').value, agentId: root.querySelector('[name="agentId"]').value, accountId: root.querySelector('[name="accountId"]').value });
        const token = root.querySelector('[name="token"]').value.trim();
        if (token.length > 4096 || /[\r\n\x00-\x1f]/.test(token)) throw new Error('令牌格式不正确，请重新填写。');
        return { binding, token };
    }
    function status(root, message, kind = '') {
        root = activeRoot(root);
        if (!root) return;
        const node = root.querySelector('.bynd-openclaw-status');
        node.textContent = message;
        node.dataset.state = kind;
    }
    function activeRoot(root) {
        if (root?.isConnected) return root;
        const active = currentRoot();
        return root && active?.dataset.charId === root.dataset.charId ? active : null;
    }
    function busy(root, value) {
        root = activeRoot(root);
        if (!root) return;
        root.querySelectorAll('input, button[data-operation]').forEach(input => { input.disabled = value; });
    }
    function updateSettings(char) {
        if (document.getElementById('wcs-agent-features')?.dataset.charId !== char.id) return;
        try { window.renderWechatAgentSettings?.(char); }
        catch (error) { console.warn('绑定操作已保存，设置界面刷新失败', error); }
    }

    window.openWechatOpenClawSettings = () => {
        const char = findChar(document.getElementById('wcs-agent-features')?.dataset.charId || window.currentChatCharId);
        if (!char) return;
        currentRoot()?.remove();
        const root = document.createElement('div');
        root.id = 'bynd-openclaw-settings';
        root.className = 'bynd-agent-overlay';
        root.dataset.charId = char.id;
        const binding = char.chatConfig?.openClawBinding || { endpoint: '', agentId: defaultAgent(char), accountId: '' };
        root.innerHTML = `<section class="bynd-agent-panel bynd-openclaw-panel">
            <header class="bynd-agent-header"><button type="button" onclick="closeWechatOpenClawSettings()" aria-label="返回聊天设置"><span aria-hidden="true">‹</span></button><span><strong>OpenClaw · 微信</strong><small>${escape(char.name)}的角色绑定</small></span><i class="ri-links-line" aria-hidden="true"></i></header>
            <main class="bynd-openclaw-body">
                <div class="bynd-openclaw-intro"><i class="ri-wechat-line"></i><h2>把角色带到微信</h2><p>先保存连接资料，部署好 OpenClaw 后再测试连接。</p></div>
                <div class="bynd-openclaw-status" role="status" aria-live="polite">${char.chatConfig?.openClawBinding ? '本地绑定已保存 · 尚未验证服务连接' : '待部署 · 尚未连接'}</div>
                <form id="bynd-openclaw-form" onsubmit="saveWechatOpenClawBinding(event)" autocomplete="off">
                    <label>OpenClaw 服务地址<input name="endpoint" type="url" placeholder="https://你的私有网关地址" value="${escape(binding.endpoint)}" maxlength="2048" autocapitalize="off" spellcheck="false"><small>尚未部署可以留空。建议通过私有网络或受保护的代理访问。</small></label>
                    <label>Agent ID<input name="agentId" value="${escape(binding.agentId)}" maxlength="64" autocapitalize="off" spellcheck="false" required><small>这个角色在 OpenClaw 中的独立 ID。</small></label>
                    <label>微信 account ID<input name="accountId" value="${escape(binding.accountId)}" maxlength="128" placeholder="扫码登录微信插件后填写" autocapitalize="off" spellcheck="false"><small>填写插件显示的 account ID，不是微信昵称。</small></label>
                    <label>网关令牌 / 密码<input name="token" type="password" placeholder="仅当前浏览器会话保存" maxlength="4096" autocomplete="new-password" autocapitalize="off" spellcheck="false"><small>这是网关操作凭据。不会写入角色卡、备份或导出资料。</small></label>
                    <div class="bynd-openclaw-actions"><button data-operation type="submit">绑定到当前角色</button><button data-operation type="button" class="subtle" onclick="testWechatOpenClawConnection()">测试连接</button></div>
                </form>
                <details class="bynd-openclaw-guide"><summary>还没有部署？查看接入步骤</summary><ol><li>在你自己的设备部署 OpenClaw，为当前角色创建独立 Agent。</li><li>安装微信插件 <code>@tencent-weixin/openclaw-weixin</code>，在网关设备扫码登录。</li><li>将微信账号路由绑定到这个 Agent，启用 Chat Completions 接口，并配置允许 BYND 访问的来源。</li><li>回到这里填入地址和账号 ID，再测试连接。</li></ol><p>测试通过仅代表网关及 Agent 可访问，微信登录和远端路由需在网关确认。当前入口不会自动发送微信消息。</p><p>BYND 的角色权限只控制本应用。请在 OpenClaw 为每个 Agent 设置工具白名单和消息来源权限。</p><a href="https://docs.openclaw.ai/channels/wechat" target="_blank" rel="noopener noreferrer">查看官方微信接入文档 <i class="ri-external-link-line"></i></a></details>
                <button type="button" data-operation class="bynd-openclaw-export subtle" onclick="exportWechatOpenClawSetup()"><i class="ri-download-2-line"></i>导出人设与部署资料</button>
                <button type="button" data-operation class="bynd-openclaw-unbind" onclick="removeWechatOpenClawBinding()">解除本地绑定</button>
            </main>
        </section>`;
        getWechatModalRoot().appendChild(root);
        root.querySelector('[name="token"]').value = readSecret(char.id, binding.endpoint);
        let priorEndpoint = binding.endpoint;
        root.querySelector('[name="endpoint"]').addEventListener('change', () => {
            const value = root.querySelector('[name="endpoint"]').value.trim().replace(/\/+$/, '');
            if (value !== priorEndpoint) root.querySelector('[name="token"]').value = '';
            priorEndpoint = value;
        });
        root.querySelector('form').addEventListener('input', () => status(root, '连接资料已修改 · 尚未保存或重新测试'));
        const tested = tests.get(char.id);
        if (tested?.fingerprint === fingerprint(binding)) status(root, tested.message, tested.ok ? 'success' : 'error');
        if (operations.has(char.id)) { busy(root, true); status(root, '上一项操作仍在进行，请稍后重新打开。'); }
    };
    window.closeWechatOpenClawSettings = () => currentRoot()?.remove();

    window.saveWechatOpenClawBinding = async event => {
        event?.preventDefault();
        const root = currentRoot();
        const char = findChar(root?.dataset.charId);
        if (!char || operations.has(char.id)) return false;
        let values;
        try { values = formValue(root); } catch (error) { status(root, error.message, 'error'); return false; }
        operations.add(char.id); busy(root, true);
        char.chatConfig = char.chatConfig || {};
        const before = char.chatConfig.openClawBinding;
        const binding = { ...values.binding, savedAt: Date.now() };
        char.chatConfig.openClawBinding = binding;
        try {
            if (await saveCharactersToStorage() === false) throw new Error('绑定未能保存，请重试。');
            writeSecret(char.id, binding.endpoint, values.token);
            tests.delete(char.id);
            status(root, binding.endpoint ? '本地绑定已保存 · 请测试连接，微信路由需在网关确认' : '本地绑定已保存 · 等待部署 OpenClaw', 'success');
            updateSettings(char);
            return true;
        } catch (error) {
            if (char.chatConfig.openClawBinding === binding) {
                if (before) char.chatConfig.openClawBinding = before; else delete char.chatConfig.openClawBinding;
            }
            status(root, '绑定未能保存，请检查存储后重试。', 'error');
            return false;
        } finally { operations.delete(char.id); busy(root, false); }
    };

    window.testWechatOpenClawConnection = async () => {
        const root = currentRoot();
        const char = findChar(root?.dataset.charId);
        if (!char || operations.has(char.id)) return false;
        let values;
        try {
            values = formValue(root);
            if (!values.binding.endpoint) throw new Error('请先部署 OpenClaw 并填写服务地址。');
        } catch (error) { status(root, error.message, 'error'); return false; }
        operations.add(char.id); busy(root, true);
        status(root, '正在读取网关角色列表…');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        let ok = false;
        let message;
        try {
            const response = await fetch(values.binding.endpoint + '/v1/models', {
                method: 'GET', headers: values.token ? { Authorization: 'Bearer ' + values.token, Accept: 'application/json' } : { Accept: 'application/json' },
                signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer'
            });
            if (!response.ok) {
                message = response.status === 401 || response.status === 403 ? '鉴权未通过，请检查网关令牌和访问权限。' : response.status === 404 ? '未找到角色列表接口，请在网关启用 Chat Completions。' : `网关返回 HTTP ${response.status}，连接未通过。`;
            } else {
                const data = await response.json();
                if (!Array.isArray(data?.data)) message = '服务未返回兼容的角色列表，请检查地址。';
                else if (!data.data.some(model => model?.id === 'openclaw/' + values.binding.agentId)) message = '网关可访问，但未找到这个 Agent ID。请先在网关创建角色。';
                else { ok = true; message = '网关及 Agent 可访问 · 微信扫码登录和路由绑定仍需在网关确认'; }
            }
        } catch (error) {
            // Never display server payloads or exception URLs that might echo credentials.
            message = controller.signal.aborted ? '连接超时，请检查网关是否启动。' : '无法连接，请检查私有网络、HTTPS 和跨域访问配置。';
        } finally { clearTimeout(timeout); operations.delete(char.id); busy(root, false); }
        tests.set(char.id, { fingerprint: fingerprint(values.binding), ok, message });
        status(root, message, ok ? 'success' : 'error');
        return ok;
    };

    window.removeWechatOpenClawBinding = async () => {
        const root = currentRoot();
        const char = findChar(root?.dataset.charId);
        if (!char || operations.has(char.id)) return false;
        operations.add(char.id); busy(root, true);
        const before = char.chatConfig?.openClawBinding;
        if (char.chatConfig) delete char.chatConfig.openClawBinding;
        try {
            if (await saveCharactersToStorage() === false) throw new Error('解绑保存失败');
            writeSecret(char.id, '', '');
            tests.delete(char.id);
            root.querySelector('[name="token"]').value = '';
            status(root, '本地绑定已解除 · 远端微信配置保持不变', 'success');
            updateSettings(char);
            return true;
        } catch (_) {
            if (before) { char.chatConfig = char.chatConfig || {}; char.chatConfig.openClawBinding = before; }
            status(root, '解绑未能保存，原绑定已保留。', 'error');
            return false;
        } finally { operations.delete(char.id); busy(root, false); }
    };

    window.buildWechatOpenClawSetup = (char, raw) => {
        const binding = normalize(raw);
        const worldBook = (Array.isArray(char.worldBook) ? char.worldBook : []).filter(entry => entry && entry.enabled !== false).map(entry => ({ keys: Array.isArray(entry.keys) ? entry.keys.map(String) : [], title: String(entry.comment || ''), content: String(entry.content || '') }));
        const workspace = '~/.openclaw/workspace-' + binding.agentId;
        return {
            format: 'bynd-openclaw-setup-v1', exportedAt: new Date().toISOString(), binding,
            status: 'Preparation only. Apply and verify on your own gateway; no remote binding has been performed.',
            character: { name: String(char.name || ''), description: String(char.description || ''), firstMessage: String(char.first_mes || ''), worldBook },
            workspace,
            files: {
                'IDENTITY.md': '# Identity\n\nName: ' + String(char.name || '') + '\n',
                'SOUL.md': '# Character\n\n' + String(char.description || '') + '\n\n# World book\n\n' + worldBook.map(entry => '## ' + (entry.title || entry.keys.join(', ')) + '\n' + entry.content).join('\n\n')
            },
            configPatch: {
                agents: { entries: { [binding.agentId]: { workspace } } },
                bindings: binding.accountId ? [{ agentId: binding.agentId, match: { channel: 'openclaw-weixin', accountId: binding.accountId } }] : [],
                gateway: { http: { endpoints: { chatCompletions: { enabled: true } } } }
            },
            instructions: ['把 files 中的文件写入当前角色的独立 workspace。', '将 configPatch 合并到网关配置，保留现有 agents 和 bindings；不要直接覆盖整份配置。', '安装 @tencent-weixin/openclaw-weixin 并在网关扫码登录；填写 account ID 后绑定到当前 Agent。', '为这个 Agent 设置工具白名单、发送者权限和私有网络访问。不要把网关操作接口直接暴露到公网。', '重启网关后回 BYND 测试连接；微信登录与消息路由请在网关确认。'],
            docs: ['https://docs.openclaw.ai/channels/wechat', 'https://docs.openclaw.ai/gateway/openai-http-api', 'https://docs.openclaw.ai/cli/agents']
        };
    };
    window.exportWechatOpenClawSetup = () => {
        const root = currentRoot();
        const char = findChar(root?.dataset.charId);
        if (!char) return false;
        try {
            const { binding } = formValue(root);
            const data = window.buildWechatOpenClawSetup(char, binding);
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url; link.download = 'BYND-OpenClaw-' + binding.agentId + '.json';
            document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            status(root, '部署资料已导出，不含网关令牌。');
            return true;
        } catch (error) { status(root, error.message || '导出失败，请重试。', 'error'); return false; }
    };
})();
