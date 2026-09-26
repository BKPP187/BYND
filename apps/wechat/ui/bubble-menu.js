// ========== 气泡操作菜单（长按触发） ==========

window._msgMultiSelectMode = false;
window._msgSelectedIndexes = new Set();

function showMsgActionMenu(msgIdx, isMe, rowEl) {
    // 如果在多选模式，点击是切换选中
    if (window._msgMultiSelectMode) {
        toggleMsgSelect(msgIdx, rowEl);
        return;
    }
    // 关闭已有菜单
    closeMsgActionMenu();
    const menu = document.createElement('div');
    menu.className = 'msg-action-menu';
    menu.id = 'msg-action-menu';

    const char = getCurrentChatChar();
    const msg = char && Array.isArray(char.history) ? char.history[msgIdx] : null;
    const isNarration = msg && msg.type === 'offline_narration';
    let html = `<div class="msg-action-item" onclick="editSingleMsg(${msgIdx})"><i class="ri-edit-line"></i> 编辑</div>`;
    if (!isNarration) html += `<div class="msg-action-item" onclick="quoteWechatMessage(${msgIdx})"><i class="ri-reply-line"></i> 引用</div>`;
    if (isNarration) html += `<div class="msg-action-item" onclick="convertWechatNarrationToText(${msgIdx})"><i class="ri-chat-1-line"></i> 转为普通消息</div>`;
    html += `<div class="msg-action-item" onclick="deleteSingleMsg(${msgIdx})"><i class="ri-delete-bin-line"></i> 删除</div>`;
    if (!isMe && !isNarration) {
        html += `<div class="msg-action-item" onclick="collectWechatMessage(${msgIdx})"><i class="ri-star-line"></i> 收藏</div>`;
        html += `<div class="msg-action-item" onclick="rerollMsg(${msgIdx})"><i class="ri-refresh-line"></i> 重新roll</div>`;
    }
    html += `<div class="msg-action-item" onclick="enterMsgMultiSelect(${msgIdx})"><i class="ri-checkbox-multiple-line"></i> 多选删除</div>`;
    menu.innerHTML = html;

    rowEl.style.position = 'relative';
    rowEl.appendChild(menu);

    // 点击其他地方关闭
    setTimeout(() => {
        document.addEventListener('click', _closeMsgMenuHandler, { once: true });
    }, 50);
}

function _closeMsgMenuHandler(e) {
    const menu = document.getElementById('msg-action-menu');
    if (menu && !menu.contains(e.target)) closeMsgActionMenu();
}

function closeMsgActionMenu() {
    const menu = document.getElementById('msg-action-menu');
    if (menu) menu.remove();
}

function convertWechatNarrationToText(msgIdx) {
    closeMsgActionMenu();
    const char = getCurrentChatChar();
    const msg = char && Array.isArray(char.history) ? char.history[msgIdx] : null;
    if (!msg || msg.type !== 'offline_narration') return;
    const content = cleanWechatVisibleContent(msg.content || msg.description || '');
    if (!content) return;
    char.history[msgIdx] = { ...msg, type: 'text', isMe: false, content, description: '' };
    saveCharactersToStorage();
    refreshChatView(char);
}

function deleteSingleMsg(msgIdx) {
    closeMsgActionMenu();
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.history) return;
    if (msgIdx < 0 || msgIdx >= char.history.length) return;
    char.history.splice(msgIdx, 1);
    saveCharactersToStorage();
    refreshChatView(char);
}

function editSingleMsg(msgIdx) {
    closeMsgActionMenu();
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.history || msgIdx < 0 || msgIdx >= char.history.length) return;
    const msg = char.history[msgIdx];
    if (msg.type === 'tool_result') return;
    if (isWechatSpecialMessage(msg.type)) {
        openWechatComposer(msg.type, msgIdx);
        return;
    }
    openWechatMessageEditor(msgIdx);
}

function rerollMsg(msgIdx) {
    closeMsgActionMenu();
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.history) return;
    if (msgIdx < 0 || msgIdx >= char.history.length) return;
    const startIdx = getWechatLastAiBatchStartIndex(char.history, msgIdx);
    char.history.splice(startIdx);
    saveCharactersToStorage();
    refreshChatView(char);
    const contentEl = document.getElementById('chat-room-content');
    triggerAiAfterMessage(char, contentEl);
}

function enterMsgMultiSelect(initialMsgIdx) {
    closeMsgActionMenu();
    window._msgMultiSelectMode = true;
    window._msgSelectedIndexes = new Set();
    // 显示底部多选操作栏
    const footer = document.querySelector('.wc-room-footer');
    if (footer) footer.classList.add('hidden');
    let bar = document.getElementById('msg-multiselect-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'msg-multiselect-bar';
        bar.className = 'msg-multiselect-bar';
        bar.innerHTML = `
            <span id="msg-select-count">已选 0 条</span>
            <div style="display:flex;gap:10px;">
                <span class="msg-ms-btn delete" onclick="deleteSelectedMsgs()">删除</span>
                <span class="msg-ms-btn cancel" onclick="exitMsgMultiSelect()">取消</span>
            </div>
        `;
        const room = document.getElementById('wechat-chat-room');
        room.appendChild(bar);
    }
    bar.classList.remove('hidden');
    if (Number.isInteger(initialMsgIdx) && isWechatMsgSelectable(initialMsgIdx)) {
        const initialRow = document.querySelector(`.msg-row[data-msg-idx="${initialMsgIdx}"]`);
        if (initialRow) toggleMsgSelect(initialMsgIdx, initialRow);
    }
}

function exitMsgMultiSelect() {
    window._msgMultiSelectMode = false;
    window._msgSelectedIndexes = new Set();
    const bar = document.getElementById('msg-multiselect-bar');
    if (bar) bar.classList.add('hidden');
    const footer = document.querySelector('.wc-room-footer');
    if (footer) footer.classList.remove('hidden');
    // 去掉所有选中样式
    document.querySelectorAll('.msg-row.selected').forEach(r => r.classList.remove('selected'));
}

function toggleMsgSelect(msgIdx, rowEl) {
    if (!isWechatMsgSelectable(msgIdx)) {
        if (typeof showWechatToast === 'function') showWechatToast('这条消息不能多选删除');
        return;
    }
    if (window._msgSelectedIndexes.has(msgIdx)) {
        window._msgSelectedIndexes.delete(msgIdx);
        rowEl.classList.remove('selected');
    } else {
        window._msgSelectedIndexes.add(msgIdx);
        rowEl.classList.add('selected');
    }
    const countEl = document.getElementById('msg-select-count');
    if (countEl) countEl.textContent = `已选 ${window._msgSelectedIndexes.size} 条`;
}

function deleteSelectedMsgs() {
    const charId = window.currentChatCharId;
    if (!charId) return;
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char || !char.history) return;
    if (window._msgSelectedIndexes.size === 0) return;
    if (!confirm(`确定删除 ${window._msgSelectedIndexes.size} 条消息吗？`)) return;
    // 从大到小删，避免索引错位
    const sorted = [...window._msgSelectedIndexes].sort((a, b) => b - a);
    sorted.forEach(idx => {
        if (idx >= 0 && idx < char.history.length) char.history.splice(idx, 1);
    });
    saveCharactersToStorage();
    exitMsgMultiSelect();
    refreshChatView(char);
}

function isWechatHistoryExpanded(char) {
    if (!char) return false;
    window._wechatExpandedHistoryIds = window._wechatExpandedHistoryIds || new Set();
    return window._wechatExpandedHistoryIds.has(char.id);
}

function appendWechatHistoryDivider(container, char, count, expanded) {
    const divider = document.createElement('div');
    divider.className = 'msg-collapse-divider';
    divider.innerHTML = expanded
        ? `<i class="ri-arrow-up-s-line"></i><span>收起早期消息</span>`
        : `<i class="ri-history-line"></i><span>已折叠 ${count} 条早期消息</span><b>展开</b>`;
    divider.onclick = () => toggleWechatCollapsedHistory(char.id);
    container.appendChild(divider);
}

function toggleWechatCollapsedHistory(charId) {
    const char = window.myCharacters.find(c => c.id === charId);
    if (!char) return;
    window._wechatExpandedHistoryIds = window._wechatExpandedHistoryIds || new Set();
    if (window._wechatExpandedHistoryIds.has(charId)) {
        window._wechatExpandedHistoryIds.delete(charId);
    } else {
        window._wechatExpandedHistoryIds.add(charId);
    }
    refreshChatView(char);
}

function shouldRunWechatHistoryRepairPass(char) {
    if (!char || !char.id) return true;
    window._wechatHistoryRepairKeys = window._wechatHistoryRepairKeys || new Map();
    return window._wechatHistoryRepairKeys.get(char.id) !== getWechatHistoryVersionKey(char);
}

function markWechatHistoryRepairPassDone(char) {
    if (!char || !char.id) return;
    window._wechatHistoryRepairKeys = window._wechatHistoryRepairKeys || new Map();
    window._wechatHistoryRepairKeys.set(char.id, getWechatHistoryVersionKey(char));
}

function refreshChatView(char) {
    const contentEl = document.getElementById('chat-room-content');
    if (!contentEl) return;
    syncWechatCoupleThemeHeader(char);
    const shouldRepairHistory = shouldRunWechatHistoryRepairPass(char);
    const migratedMixedAi = shouldRepairHistory && migrateWechatMixedAiHistory(char);
    const migratedNarration = shouldRepairHistory && migrateWechatNarrationHistory(char);
    const migratedStickerDirectives = shouldRepairHistory && migrateWechatStickerDirectiveHistory(char);
    const prunedLeakedCallSummary = shouldRepairHistory && pruneWechatLeakedCallSummaryMessages(char);
    const repairedSplitPipeStatus = shouldRepairHistory && repairWechatSplitPipeStatusHistory(char);
    const repairedQuoteDirectives = shouldRepairHistory && repairWechatQuoteDirectiveReplyHistory(char);
    const prunedEmptyAiText = shouldRepairHistory && pruneWechatEmptyAiTextMessages(char);
    if (shouldRepairHistory) markWechatHistoryRepairPassDone(char);
    const history = char.history || [];
    contentEl.innerHTML = '';
    const hasRealChatMessage = history.some(msg => msg && msg.type !== 'system_notice');
    if (getWechatUiThemeId() === 'claude' && !hasRealChatMessage) {
        contentEl.insertAdjacentHTML('beforeend', renderWechatClaudeChatWelcome());
    }
    if (isWechatXTheme() && !hasRealChatMessage) {
        contentEl.insertAdjacentHTML('beforeend', renderWechatXChatProfileIntro(char));
    }
    const expanded = isWechatHistoryExpanded(char);
    let startIndex = 0;
    if (history.length > WECHAT_AUTO_COLLAPSE_AFTER) {
        const collapsedCount = Math.max(0, history.length - WECHAT_COLLAPSE_KEEP_RECENT);
        if (expanded) {
            appendWechatHistoryDivider(contentEl, char, collapsedCount, true);
        } else {
            startIndex = collapsedCount;
            appendWechatHistoryDivider(contentEl, char, collapsedCount, false);
        }
    }
    let prevVisibleMsg = null;
    for (let offset = 0; offset < history.length - startIndex; offset += 1) {
        let msg = history[startIndex + offset];
        const index = startIndex + offset;
        if (isWechatHiddenChatSurfaceMessage(msg)) continue;
        if (msg && msg.type !== 'system_notice' && shouldShowWechatTimeDivider(prevVisibleMsg, msg)) {
            appendWechatTimeDivider(contentEl, getWechatMessageDate(msg));
        }
        let renderMsg = msg;
        let renderIndex = index;
        if (isWechatStackableImageMessage(msg)) {
            const rows = [{ msg, index }];
            let cursor = offset + 1;
            while (cursor < history.length - startIndex) {
                const next = history[startIndex + cursor];
                if (isWechatHiddenChatSurfaceMessage(next)) {
                    cursor += 1;
                    continue;
                }
                if (!canStackWechatAdjacentImages(msg, next) || shouldShowWechatTimeDivider(rows[rows.length - 1].msg, next)) break;
                rows.push({ msg: next, index: startIndex + cursor });
                cursor += 1;
            }
            if (rows.length > 1) {
                renderMsg = buildWechatImageStackDisplayMessage(rows);
                renderIndex = rows[0].index;
                offset = rows[rows.length - 1].index - startIndex;
            }
        }
        renderMessageBubble(contentEl, renderMsg, getWechatCharAvatarSource(char, ''), char, renderIndex, {
            showCoupleHeader: shouldShowWechatCoupleMessageHeader(prevVisibleMsg, msg, char)
        });
        if (renderMsg && renderMsg.type === 'image_stack' && Array.isArray(renderMsg.imageStackItems)) {
            renderMsg.imageStackItems.forEach(item => {
                const original = Number.isInteger(item.index) ? history[item.index] : null;
                if (original && typeof renderWechatAgentExtras === 'function') renderWechatAgentExtras(contentEl, char, original);
                if (original) queueWechatPendingImageGeneration(char, original);
            });
        } else {
            if (typeof renderWechatAgentExtras === 'function') renderWechatAgentExtras(contentEl, char, msg);
            queueWechatPendingImageGeneration(char, msg);
        }
        if (renderMsg && renderMsg.type !== 'system_notice' && renderMsg.type !== 'offline_narration') prevVisibleMsg = renderMsg;
    }
    contentEl.scrollTop = contentEl.scrollHeight;
    requestAnimationFrame(() => { contentEl.scrollTop = contentEl.scrollHeight; });
    setTimeout(() => { contentEl.scrollTop = contentEl.scrollHeight; }, 180);
    if (migratedMixedAi || migratedNarration || migratedStickerDirectives || prunedLeakedCallSummary || repairedSplitPipeStatus || repairedQuoteDirectives || prunedEmptyAiText) saveCharactersToStorage();
}

function getWechatPaymentReceiptId(msg, index) {
    return msg.receiptFor || msg.paymentId || msg.timestamp || `${msg.type}_${index}`;
}

function buildWechatPaymentReturnedAtText(msg) {
    const time = msg?.returnedAt || msg?.timestamp || '';
    if (!time) return '已退回';
    return `已退回 · ${formatMessageTime({ timestamp: time })}`;
}

function buildWechatPaymentReceiptMessage(msg, receiptFor, isMe = false) {
    const collectedAt = msg.collectedAt || createMessageTimestamp();
    const receipt = {
        type: msg.type,
        isMe,
        receipt: true,
        receiptFor,
        amount: msg.amount,
        title: msg.title,
        note: msg.note,
        status: '已收取',
        timestamp: collectedAt,
        collectedAt
    };
    if (msg.type === 'transfer' && !receipt.note) receipt.note = '已存入零钱';
    if (msg.type === 'redpacket' && !receipt.title) receipt.title = '恭喜发财，大吉大利';
    if (msg.type === 'gift') {
        receipt.item = msg.item;
        receipt.note = msg.note || '已放入礼物盒';
    }
    if (msg.type === 'intimatePay') {
        receipt.note = msg.note || '亲密付已开通';
        receipt.status = '已开通';
    }
    return syncWechatMessageDescription(receipt);
}

function buildWechatPaymentReturnMessage(msg, receiptFor, isMe = true) {
    const returnedAt = msg.returnedAt || createMessageTimestamp();
    const receipt = {
        type: msg.type,
        isMe,
        receipt: true,
        returned: true,
        receiptFor,
        amount: msg.amount,
        title: msg.title,
        originalNote: msg.note,
        note: buildWechatPaymentReturnedAtText({ ...msg, returnedAt }),
        status: '已退回',
        timestamp: returnedAt,
        returnedAt
    };
    if (msg.type === 'redpacket' && !receipt.title) receipt.title = '恭喜发财，大吉大利';
    return syncWechatMessageDescription(receipt);
}

function getWechatPaymentActionLabel(msg) {
    if (!msg) return '付款';
    if (msg.type === 'redpacket') return '红包';
    if (msg.type === 'transfer') return '转账';
    if (msg.type === 'gift') return '礼物';
    if (msg.type === 'intimatePay') return '亲密付';
    return '付款';
}

function buildWechatPaymentEventText(msg, action) {
    const label = getWechatPaymentActionLabel(msg);
    const amount = msg?.amount ? `（¥${normalizeWechatAmount(msg.amount)}）` : '';
    const titleOrNote = stripWechatPromptText(msg?.note || msg?.title || msg?.description || '', 80);
    const extra = titleOrNote ? `，原备注/标题：「${titleOrNote}」` : '';
    const actionText = action === 'return' ? '退回了你发来的' : '收取了你发来的';
    const moodHint = action === 'return'
        ? '可以失落、尴尬、嘴硬、追问原因、理解用户，或按你们的关系自然反应。'
        : '可以开心、放心、调侃、撒娇、嘴硬，或按你们的关系自然反应。';
    return `用户刚刚${actionText}${label}${amount}${extra}。请按你的人设、当前关系和最近聊天自然回应，${moodHint}不要解释系统。`;
}

function ensureWechatPaymentActionModal() {
    let modal = document.getElementById('wc-payment-action-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'wc-payment-action-modal';
    modal.className = 'wc-modal-overlay hidden wc-compose-overlay wc-payment-action-overlay';
    modal.addEventListener('click', event => {
        if (event.target === modal) closeWechatPaymentActionModal();
    });
    getWechatModalRoot().appendChild(modal);
    return modal;
}

function closeWechatPaymentActionModal() {
    const modal = document.getElementById('wc-payment-action-modal');
    if (modal) modal.classList.add('hidden');
}

function openWechatPaymentActionModal(msgIdx) {
    const char = getCurrentChatChar();
    if (!char || !Array.isArray(char.history)) return;
    const msg = char.history[msgIdx];
    if (!msg || msg.isMe || msg.receipt || !['transfer', 'redpacket'].includes(msg.type)) return;
    if (msg.status === '已被领取' || msg.status === '已收取' || msg.status === '已退回' || msg.returned) return;

    const modal = ensureWechatPaymentActionModal();
    const label = getWechatPaymentActionLabel(msg);
    const amount = msg.amount ? normalizeWechatAmount(msg.amount) : '';
    const isRedpacket = msg.type === 'redpacket';
    const title = isRedpacket ? (msg.title || msg.note || '恭喜发财，大吉大利') : (msg.note || '转账给你');
    const icon = isRedpacket ? 'ri-red-packet-fill' : 'ri-money-cny-circle-fill';
    const acceptText = isRedpacket ? '打开红包' : '收取转账';
    modal.dataset.msgIdx = String(msgIdx);
    modal.innerHTML = `
        <div class="wc-payment-action-card" role="dialog" aria-modal="true" aria-label="${wcEscapeAttr(acceptText)}">
            <button type="button" class="wc-payment-action-close" onclick="closeWechatPaymentActionModal()" aria-label="关闭"><i class="ri-close-line"></i></button>
            <div class="wc-payment-action-hero ${isRedpacket ? 'redpacket' : 'transfer'}">
                <div class="wc-payment-action-icon"><i class="${icon}"></i></div>
                <span>${wcEscapeHtml(label)}</span>
                ${amount ? `<strong>¥${wcEscapeHtml(amount)}</strong>` : ''}
                <p>${wcEscapeHtml(title)}</p>
            </div>
            <div class="wc-payment-action-footer">
                <button type="button" class="wc-payment-return" onclick="returnWechatIncomingPayment(${msgIdx})"><i class="ri-refund-2-line"></i><span>退回</span></button>
                <button type="button" class="wc-payment-accept" onclick="collectWechatIncomingPayment(${msgIdx}, { notifyChar: true })"><i class="ri-checkbox-circle-fill"></i><span>${acceptText}</span></button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function isWechatMsgSelectable(msgIdx) {
    const char = getCurrentChatChar();
    const msg = char && Array.isArray(char.history) ? char.history[msgIdx] : null;
    if (!msg) return false;
    return msg.type !== 'system_notice';
}

function markPendingUserPaymentsCollected(char) {
    if (!char || !Array.isArray(char.history)) return false;
    let changed = false;
    const existingReceipts = new Set(
        char.history
            .filter(msg => msg && msg.receipt && msg.receiptFor)
            .map(msg => msg.receiptFor)
    );
    const receipts = [];

    char.history.forEach((msg, index) => {
        if (!msg || msg.receipt || !msg.isMe || !['transfer', 'redpacket', 'gift', 'intimatePay'].includes(msg.type)) return;
        const receiptFor = getWechatPaymentReceiptId(msg, index);
        if (!msg.receiptCreated) {
            ensureMessageTimestamp(msg);
            msg.status = msg.type === 'intimatePay' ? '已开通' : '已被领取';
            msg.receiptCreated = true;
            msg.collectedAt = createMessageTimestamp();
            syncWechatMessageDescription(msg);
            changed = true;
        }
        if (!existingReceipts.has(receiptFor)) {
            receipts.push(buildWechatPaymentReceiptMessage(msg, receiptFor));
            existingReceipts.add(receiptFor);
            changed = true;
        } else if (['redpacket', 'gift', 'intimatePay'].includes(msg.type) && (!msg.status || msg.status === '待收取' || msg.status === '待开通')) {
            msg.status = '已被领取';
            if (msg.type === 'intimatePay') msg.status = '已开通';
            syncWechatMessageDescription(msg);
            changed = true;
        }
    });
    if (receipts.length) char.history.push(...receipts);
    return changed;
}

async function collectWechatIncomingPayment(msgIdx, options = {}) {
    const char = getCurrentChatChar();
    if (!char || !Array.isArray(char.history)) return;
    const msg = char.history[msgIdx];
    if (!msg || msg.isMe || msg.receipt || !['transfer', 'redpacket', 'gift', 'intimatePay'].includes(msg.type)) return;
    if (msg.status === '已被领取' || msg.status === '已收取' || msg.status === '已开通' || msg.status === '已退回' || msg.returned) return;
    const receiptFor = getWechatPaymentReceiptId(msg, msgIdx);
    const hasReceipt = char.history.some(item => item && item.receipt && item.receiptFor === receiptFor);
    ensureMessageTimestamp(msg);
    msg.status = msg.type === 'intimatePay' ? '已开通' : '已被领取';
    msg.receiptCreated = true;
    msg.collectedAt = createMessageTimestamp();
    syncWechatMessageDescription(msg);
    if (msg.type === 'intimatePay') {
        const store = getWechatShopStore();
        store.intimatePay[char.id] = {
            limit: parseWechatAmountNumber(msg.amount) || 0,
            status: '已开通',
            note: msg.note || '亲密付已开通',
            updatedAt: Date.now()
        };
        saveWechatShopStore(store);
    }
    if (!hasReceipt) {
        char.history.push(buildWechatPaymentReceiptMessage(msg, receiptFor, true));
    }
    saveCharactersToStorage();
    closeWechatPaymentActionModal();
    refreshChatView(char);
    renderChatList();
    if ((msg.type === 'transfer' || msg.type === 'redpacket') && options.notifyChar !== false) {
        await appendWechatRelationshipEventReply(char, buildWechatPaymentEventText(msg, 'collect'));
        saveCharactersToStorage();
        if (window.currentChatCharId === char.id) refreshChatView(char);
        renderChatList();
    }
}

async function returnWechatIncomingPayment(msgIdx) {
    const char = getCurrentChatChar();
    if (!char || !Array.isArray(char.history)) return;
    const msg = char.history[msgIdx];
    if (!msg || msg.isMe || msg.receipt || !['transfer', 'redpacket'].includes(msg.type)) return;
    if (msg.status === '已被领取' || msg.status === '已收取' || msg.status === '已退回' || msg.returned) return;

    const receiptFor = getWechatPaymentReceiptId(msg, msgIdx);
    const hasReturnReceipt = char.history.some(item => item && item.receipt && item.returned && item.receiptFor === receiptFor);
    ensureMessageTimestamp(msg);
    msg.status = '已退回';
    msg.returned = true;
    msg.returnedAt = createMessageTimestamp();
    msg.receiptCreated = true;
    syncWechatMessageDescription(msg);
    if (!hasReturnReceipt) {
        char.history.push(buildWechatPaymentReturnMessage(msg, receiptFor, true));
    }
    saveCharactersToStorage();
    closeWechatPaymentActionModal();
    refreshChatView(char);
    renderChatList();
    if (typeof showWechatToast === 'function') showWechatToast(`已退回${getWechatPaymentActionLabel(msg)}`);
    await appendWechatRelationshipEventReply(char, buildWechatPaymentEventText(msg, 'return'));
    saveCharactersToStorage();
    if (window.currentChatCharId === char.id) refreshChatView(char);
    renderChatList();
}

function normalizeWechatCharacterVoiceBinding(binding) {
    const source = binding && typeof binding === 'object' ? binding : {};
    const provider = ['minimax', 'openai', 'fish-audio', 'elevenlabs', 'local'].includes(source.provider)
        ? source.provider
        : '';
    if (!provider) return null;
    return {
        provider,
        voiceModel: String(source.voiceModel || source.model || '').trim().slice(0, 160),
        voiceId: String(source.voiceId || source.voice || source.referenceId || '').trim().slice(0, 240)
    };
}

function queueWechatCharacterVoiceAudio(char, msg) {
    if (!char || !msg || msg.isMe || msg.type !== 'voice' || msg.audioUrl) return;
    const binding = normalizeWechatCharacterVoiceBinding(char.chatConfig?.voiceBinding);
    if (!binding || typeof requestCharacterVoiceAudio !== 'function') return;
    const speechText = String(msg.transcript || msg.content || '').trim();
    if (!speechText) return;
    window._wechatCharacterVoicePending = window._wechatCharacterVoicePending || new WeakSet();
    if (window._wechatCharacterVoicePending.has(msg)) return;
    window._wechatCharacterVoicePending.add(msg);

    // Chat character audio may only use the character's paid/custom binding. Never fall back to system TTS here.
    let synthesizedState = null;
    Promise.resolve(requestCharacterVoiceAudio(speechText, char)).then(result => {
        if (!result?.audioUrl || !Array.isArray(char.history) || !char.history.includes(msg)) return;
        const previousDuration = msg.duration;
        synthesizedState = { previousDuration };
        msg.audioUrl = result.audioUrl;
        msg.audioMimeType = result.mimeType || '';
        msg.duration = Math.max(1, Math.min(5999, Number(result.duration) || Number(msg.duration) || 1));
        return Promise.resolve(saveCharactersToStorage()).then(saved => {
            if (saved === false) {
                delete msg.audioUrl;
                delete msg.audioMimeType;
                msg.duration = previousDuration;
                throw new Error('角色语音未能保存');
            }
            if (window.currentChatCharId === char.id) refreshChatView(char);
            renderChatList();
        });
    }).catch(error => {
        if (synthesizedState) {
            delete msg.audioUrl;
            delete msg.audioMimeType;
            msg.duration = synthesizedState.previousDuration;
        }
        console.warn('角色付费音色生成失败，保留文字语音气泡：', error);
    }).finally(() => {
        window._wechatCharacterVoicePending?.delete(msg);
    });
}

function appendWechatAiMessageParts(char, contentEl, text, options = {}) {
    const shouldRefreshActiveChat = !options.background && window.currentChatCharId === char?.id;
    const cleanedText = cleanWechatVisibleContent(text);
    if (isWechatAiMetaLeakContent(cleanedText)) return 0;
    const parsedParts = parseWechatAiMessageParts(cleanedText, char)
        .filter(part => part && (part.kind !== 'text' || (
            !isWechatAiMetaLeakContent(part.content)
            && (
                looksLikeWechatRichOrRegexSource(part.content, char)
                || !!getWechatTextMessageVisibleText({ type: 'text', content: part.content }, char)
            )
        )));
    let appendedCount = 0;
    let speakerFallbackOffset = 0;
    parsedParts.forEach(part => {
        if (options.textOnly && (part.kind === 'special' || part.kind === 'narration')) return;
        const implicitCallMsg = part.kind === 'text'
            ? buildWechatImplicitCallFromAiText(part.content, char)
            : null;
        const stickerDirectiveMsg = (!implicitCallMsg && part.kind === 'text')
            ? buildWechatStickerMessageFromAiText(part.content, char)
            : null;
        const autoImageMsg = (!implicitCallMsg && !stickerDirectiveMsg && part.kind === 'text')
            ? buildWechatAutoImageMessageFromText(part.content, char)
            : null;
        if (options.textOnly && (implicitCallMsg || stickerDirectiveMsg || autoImageMsg)) return;
        let aiMsg = part.kind === 'special'
            ? part.msg
            : (part.kind === 'narration'
                ? { type: 'offline_narration', isMe: false, content: normalizeWechatOfflineNarrationText(part.content), description: '', timestamp: createMessageTimestamp() }
                : (implicitCallMsg || stickerDirectiveMsg || autoImageMsg || { type: 'text', isMe: false, content: cleanWechatVisibleContent(part.content), timestamp: createMessageTimestamp() }));
        if (aiMsg && !aiMsg.isMe && !isWechatRenderableMessage(aiMsg, char)) return;
        if (aiMsg && char?.isGroupChat && !aiMsg.isMe) {
            const fallbackStart = Number(options.groupFallbackStartIndex) || 0;
            const fallbackMembers = getWechatGroupNextFallbackMembers(
                char,
                options.groupReplyStartIndex ?? options.replyStartIndex ?? 0,
                options.groupFallbackMembers
            );
            aiMsg = attachWechatGroupSpeaker(aiMsg, char, fallbackStart + speakerFallbackOffset, fallbackMembers);
        }
        if (aiMsg && !aiMsg.isMe && !isWechatRenderableMessage(aiMsg, char)) return;
        if (!aiMsg || (!aiMsg.content && !isWechatSpecialMessage(aiMsg.type) && !(aiMsg.type === 'image' && aiMsg.imagePending) && !isWechatImageStackMessage(aiMsg))) return;
        if (isWechatIncomingCallMessage(aiMsg)) {
            handleWechatIncomingCall(char, aiMsg);
            return;
        }
        if (aiMsg.type === 'music_card' && !aiMsg.isMe && isWechatMusicListenActive()) {
            const info = getWechatMusicMessageInfo(aiMsg);
            char.history.push({
                type: 'user_event',
                isMe: false,
                hiddenFromChat: true,
                internalEvent: true,
                eventKind: 'music_switch_requested',
                content: `角色把一起听歌切到《${info.title || '新歌'}》${info.artist ? ` - ${info.artist}` : ''}。这是当前一起听歌列表内的切歌动作，不是新的音乐邀请卡片。`,
                timestamp: createMessageTimestamp()
            });
            appendedCount += 1;
            switchWechatMusicListenTrackFromAi(char, aiMsg).catch(e => console.warn('ai music switch failed:', e));
            if (shouldRefreshActiveChat) refreshChatView(char);
            return;
        }
        char.history.push(aiMsg);
        appendedCount += 1;
        if (aiMsg.type !== 'system_notice') speakerFallbackOffset += 1;
        if (aiMsg.type === 'music_card') {
            enrichWechatMusicCardMessage(char, aiMsg, { reason: 'ai_music' }).catch(e => console.warn('ai music enrich failed:', e));
        }
        if (aiMsg.type === 'image' && aiMsg.imagePending) {
            queueWechatPendingImageGeneration(char, aiMsg);
        }
        if (aiMsg.type === 'voice' && !aiMsg.isMe) {
            queueWechatCharacterVoiceAudio(char, aiMsg);
        }
        if (aiMsg.type === 'poke') {
            triggerWechatScreenFeedback('poke');
        } else if (aiMsg.type === 'screen_shake') {
            triggerWechatScreenFeedback('shake');
        }
        if (shouldRefreshActiveChat) refreshChatView(char);
    });
    return appendedCount;
}

function findWechatRichFunction(element, functionName) {
    if (!element || !functionName) return null;
    let scope = element;
    while (scope) {
        if (typeof scope[functionName] === 'function') return scope[functionName].bind(scope);
        scope = scope.parentElement || (scope.getRootNode && scope.getRootNode().host) || null;
    }
    return typeof window[functionName] === 'function' ? window[functionName].bind(window) : null;
}

function closeWechatRichModal(modal) {
    if (!modal) return;
    modal.classList.remove('visible', 'active', 'show', 'open');
    modal.style.display = 'none';
}

function openWechatRichModal(trigger, rootElement) {
    const richRoot = (trigger && trigger.closest && trigger.closest('.msg-rich-card')) || rootElement;
    if (!richRoot || !richRoot.querySelector) return false;

    const modal = richRoot.querySelector('.modal-overlay, .secret-modal, [id*="secretModal"], [class*="modal"]');
    if (!modal) return false;

    const host = (typeof getWechatModalRoot === 'function' ? getWechatModalRoot() : document.body) || document.body;
    if (modal.parentElement !== host) host.appendChild(modal);

    modal.classList.add('visible', 'active', 'show', 'open');
    Object.assign(modal.style, {
        display: 'flex',
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        zIndex: '3800',
        maxWidth: 'none',
        maxHeight: 'none',
        pointerEvents: 'auto'
    });

    if (modal.dataset.wcRichModalBound !== '1') {
        modal.dataset.wcRichModalBound = '1';
        modal.addEventListener('click', event => {
            const target = event.target;
            if (target === modal || (target && target.closest && target.closest('.close-modal, .wc-rich-modal-close'))) {
                event.preventDefault();
                event.stopPropagation();
                closeWechatRichModal(modal);
            }
        });
    }
    return true;
}

function decryptWechatRichSection(trigger) {
    if (!trigger || typeof trigger.closest !== 'function') return false;
    const section = trigger.closest('.encrypted-section');
    const overlay = section
        ? (section.querySelector('.encrypted-overlay') || trigger.closest('.encrypted-overlay'))
        : trigger.closest('.encrypted-overlay');
    if (!overlay) return false;

    overlay.classList.add('decrypted');
    overlay.style.pointerEvents = 'none';
    const progressBar = section && section.querySelector('.progress-bar-value');
    if (progressBar) progressBar.style.width = progressBar.style.width;
    return true;
}

function findWechatRichDecryptTrigger(target) {
    if (!target || typeof target.closest !== 'function') return null;
    const direct = target.closest('.decrypt-button, [data-wc-rich-original-onclick*="decryptContent"], [onclick*="decryptContent"]');
    if (direct) return direct;

    const overlay = target.closest('.encrypted-overlay');
    if (overlay) {
        const overlayText = (overlay.textContent || '').replace(/\s+/g, '');
        if (/点击解密内心深处|解密.*内心/.test(overlayText)) return overlay;
    }
    return null;
}

function ensureWechatRichDecryptDelegation() {
    if (window.__wechatRichDecryptDelegationBound === '1') return;
    window.__wechatRichDecryptDelegationBound = '1';
    document.addEventListener('click', event => {
        const trigger = findWechatRichDecryptTrigger(event.target);
        if (!trigger) return;
        if (decryptWechatRichSection(trigger)) {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }
    }, true);
}

function bindWechatRichRevealFallbacks(element) {
    if (!element || !element.querySelectorAll) return;
    ensureWechatRichDecryptDelegation();
    const selectorCandidates = Array.from(element.querySelectorAll('.secret-note, .secret-note-container, .encrypted-overlay, .decrypt-button, [data-secret], [data-decrypt], [data-reveal], [onclick*="decryptContent"], [onclick*="showModal"], [onclick*="hideModal"], [onclick*="secretModal"]'));
    const candidates = Array.from(new Set(selectorCandidates));
    candidates.forEach(el => {
        if (el.dataset.wcRichRevealBound === '1') return;
        const text = (el.textContent || '').replace(/\s+/g, '');
        const originalClick = el.getAttribute('onclick') || el.dataset.wcRichOriginalOnclick || '';
        const looksReveal = /点击|查看|解密|展开|内心|深处|■■|涂黑|机密|秘密|隐藏/.test(text)
            || /secret|decrypt|decode|unlock|reveal/i.test(el.className || '')
            || /decryptContent|showModal|secretModal|hideModal|closeModal/i.test(originalClick);
        if (!looksReveal) return;
        el.classList.add('wc-rich-clickable');
        el.dataset.wcRichRevealBound = '1';
        el.dataset.wcRichClick = '1';
        el.setAttribute('role', el.getAttribute('role') || 'button');
        el.setAttribute('tabindex', el.getAttribute('tabindex') || '0');
        el.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (decryptWechatRichSection(el)) return;
            const openedByFallback = openWechatRichModal(el, element);
            const runner = openedByFallback ? null : (
                findWechatRichFunction(el, 'decryptContent')
                || findWechatRichFunction(el, 'decodeContent')
                || findWechatRichFunction(el, 'unlockContent')
                || findWechatRichFunction(el, 'showModal')
                || findWechatRichFunction(el, 'showSecret')
                || findWechatRichFunction(el, 'revealSecret')
                || findWechatRichFunction(el, 'openSecret')
            );
            if (runner) {
                try {
                    runner(event);
                } catch (err) {
                    console.warn('rich reveal runner failed:', err);
                    openWechatRichModal(el, element);
                }
            }
        });
    });
}

function bindWechatRichDetailsFallbacks(element) {
    if (!element || !element.querySelectorAll) return;
    element.querySelectorAll('.msg-rich-card details > summary').forEach(summary => {
        if (summary.dataset.wcRichDetailsBound === '1') return;
        summary.dataset.wcRichDetailsBound = '1';
        summary.dataset.wcRichClick = '1';
        summary.addEventListener('click', event => {
            const details = summary.parentElement;
            if (!details || details.tagName !== 'DETAILS') return;
            event.preventDefault();
            event.stopPropagation();
            details.open = !details.open;
        });
    });
}

