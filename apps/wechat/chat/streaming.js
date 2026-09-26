// --- 流式回复：边生成边显示 ---
// The preview only ever shows text that the final pipeline would also show:
// summaries, tool calls, pet reactions, hidden thinking and unfinished
// directives are cut out. Once the reply is saved, refreshChatView() replaces
// the preview with the real bubbles, so nothing here touches char.history.
function getWechatStreamPreviewSegments(rawContent) {
    let text = String(rawContent || '')
        .replace(/<bynd_(?:summary|tool|pet|decide)\b[^>]*>[\s\S]*?<\/bynd_(?:summary|tool|pet|decide)>/gi, '')
        .replace(/<bynd_(?:summary|tool|pet|decide)\b[^>]*>[\s\S]*$/gi, '')
        .replace(/<\/?bynd_(?:summary|tool|pet|decide)\b[^>]*>/gi, '')
        // A hidden reasoning block that is still open hides everything after it.
        .replace(/<(thinking|think|thought|execute_think|cot|analysis|reasoning|chain_of_thought)\b[^>]*>(?![\s\S]*?<\/\1\s*>)[\s\S]*$/i, '');
    text = cleanWechatVisibleContent(text);
    if (!text) return [];
    // A directive that has not closed yet (e.g. "[微信图片:窗边…") stays hidden until complete.
    for (let i = 0; i < text.length; i += 1) {
        const opener = text[i];
        if (opener !== '[' && opener !== '【') continue;
        if (!getWechatAiDirectiveStartAt(text, i)) continue;
        const directive = readWechatAiDirectiveAt(text, i);
        if (!directive) {
            text = text.slice(0, i);
            break;
        }
        text = text.slice(0, i) + text.slice(directive.end);
        i -= 1;
    }
    text = text.replace(/\[\[(?:WECHAT_EMOJI|QQ_EMOJI):[^\]]*$/, '');
    return text.split(/\|{2,}/)
        .map(part => part.trim())
        .filter(part => part && !isWechatAiMetaLeakContent(part));
}

function createWechatStreamPreview(char, contentEl) {
    const state = { row: null, shell: null, bubbles: [], pending: null, frame: 0, removed: false };
    const fontSize = (char?.chatConfig && char.chatConfig.fontSize) || 15;
    const attach = () => {
        if (state.removed || window.currentChatCharId !== char?.id) return null;
        const container = document.getElementById('chat-room-content') || contentEl;
        if (!container) return null;
        if (!state.row) {
            state.row = document.createElement('div');
            state.row.className = 'msg-row left msg-stream-preview';
            state.row.setAttribute('aria-live', 'polite');
            const avatar = getWechatFirstRealAvatarSource(getWechatCharAvatarSource(char, '')) || DEFAULT_AVATAR;
            state.row.innerHTML = renderWechatMessageAvatarHtml({ isMe: false, timestamp: createMessageTimestamp() }, avatar, 'msg-avatar msg-avatar-ai', { showCoupleHeader: true });
            state.shell = document.createElement('div');
            state.shell.className = 'msg-bubble-shell';
            state.row.appendChild(state.shell);
        }
        if (!state.row.isConnected) container.appendChild(state.row);
        return container;
    };
    const paint = () => {
        state.frame = 0;
        if (state.removed) return;
        const segments = getWechatStreamPreviewSegments(state.pending);
        if (!segments.length) {
            if (state.row?.isConnected) state.row.remove();
            return;
        }
        const container = attach();
        if (!container) return;
        const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 140;
        while (state.bubbles.length > segments.length) state.bubbles.pop().bubble.remove();
        segments.forEach((segment, index) => {
            let entry = state.bubbles[index];
            if (!entry) {
                const bubble = document.createElement('div');
                bubble.className = 'msg-bubble';
                bubble.style.fontSize = `${fontSize}px`;
                const text = document.createElement('div');
                text.className = 'msg-text';
                bubble.appendChild(text);
                state.shell.appendChild(bubble);
                entry = { bubble, text };
                state.bubbles.push(entry);
            }
            const isLast = index === segments.length - 1;
            const html = renderWechatBuiltinEmojiMarkersHtml(wcEscapeHtml(segment)) + (isLast ? '<span class="msg-stream-cursor" aria-hidden="true"></span>' : '');
            if (entry.text.innerHTML !== html) entry.text.innerHTML = html;
            entry.bubble.classList.toggle('wechat-emoji-text', hasWechatBuiltinEmojiMarker(segment));
        });
        const typing = document.getElementById('wc-typing-indicator');
        if (typing) typing.style.display = 'none';
        if (nearBottom) container.scrollTop = container.scrollHeight;
    };
    return {
        update(fullContent) {
            if (state.removed) return;
            state.pending = fullContent;
            if (state.frame) return;
            const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn => setTimeout(fn, 16));
            state.frame = schedule(paint) || 1;
        },
        clear() {
            state.pending = null;
            if (state.row?.isConnected) state.row.remove();
            state.row = null;
            state.shell = null;
            state.bubbles = [];
        },
        remove() {
            this.clear();
            state.removed = true;
        }
    };
}

// Point the global usage ledger entries of one reply at the chat message they produced.
function linkWechatUsageLedgerSource(char, pendingIds, msgIndex) {
    const ledger = window.ByndUsageLedger;
    if (!ledger || !char?.id || !Array.isArray(pendingIds) || !pendingIds.length || !(msgIndex >= 0)) return;
    Promise.all(pendingIds).then(ids => ids.forEach(id => {
        if (id) ledger.update(id, { source: { charId: char.id, msgIndex } });
    })).catch(error => console.warn('账单来源关联失败', error));
}

async function triggerAiAfterMessage(char, contentEl, options = {}) {
    if (!char || !Array.isArray(char.history)) return;
    if (window._wechatAiBusy) return;
    if (options.background && isWechatAiRateLimitPaused() && !options.force) return;
    window._wechatAiBusy = true;
    window.ByndCharacterPet?.beginReply(char);
    const shouldTouchChatUi = !options.background && window.currentChatCharId === char?.id;
    if (shouldTouchChatUi) setWechatBusyState(true);
    const replyStartIndex = Array.isArray(char.history) ? char.history.length : 0;
    const replyHistory = char.history;

    if (shouldTouchChatUi) syncWechatCurrentChatTitleState('正在回复中...');
    let streamPreview = null;
    const usageCollector = typeof getWechatAgentPreferences === 'function' && getWechatAgentPreferences(char).showTokenUsage ? [] : null;
    const usageLedgerIds = [];
    let replyDecisions = null;
    let webSearchContext = null;

    try {
        const appendAiResultToChat = async (rawContent, appendOptions = {}) => {
            if (!(window.myCharacters || []).includes(char)) return 0;
            streamPreview?.clear();
            const consumed = typeof consumeWechatAgentResponse === 'function'
                ? await consumeWechatAgentResponse(char, rawContent)
                : { content: rawContent, summary: '', toolCount: 0 };
            if (consumed.decisions) replyDecisions = consumed.decisions;
            const petResponse = window.ByndCharacterPet?.extract(consumed.content);
            if (petResponse) consumed.content = petResponse.content;
            const avatarAction = consumeWechatAvatarDirective(char, consumed.content);
            consumed.content = avatarAction.content;
            const start = char.history.length;
            const parts = splitWechatAiResponseSegments(consumed.content, char)
                .filter(part => !isWechatAiMetaLeakContent(part));
            let count = 0;
            for (let i = 0; i < parts.length; i++) {
                if (i > 0 && !appendOptions.instant) await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
                let text = parts[i];
                if (!text || isWechatAiMetaLeakContent(text)) continue;
                count += appendWechatAiMessageParts(char, contentEl, text, {
                    groupFallbackStartIndex: count,
                    groupReplyStartIndex: replyStartIndex,
                    background: options.background,
                    textOnly: options.textOnly
                }) || 0;
            }
            if (typeof consumed.afterAppend === 'function') count += await consumed.afterAppend({ background: !!options.background }) || 0;
            const first = char.history.slice(start).find(msg => msg && !msg.isMe && msg.type !== 'system_notice');
            if (first && consumed.summary) first.thinkingSummary = consumed.summary;
            if (webSearchContext?.sources?.length) {
                const answer = char.history.slice(start).reverse().find(msg => msg && !msg.isMe && msg.type === 'text' && !msg.apiError);
                if (answer) answer.webSources = webSearchContext.sources;
            }
            if (count > 0 && petResponse) window.ByndCharacterPet.applyChatReaction(char, petResponse.reaction, char.history.slice(start).filter(msg => !msg.isMe).map(msg => msg.content || msg.description || '').join('\n')).catch(() => {});
            if (avatarAction.backgroundChanged && shouldTouchChatUi && typeof applyChatConfig === 'function') applyChatConfig(char);
            if ((consumed.summary || consumed.toolCount || avatarAction.changed || webSearchContext?.sources?.length) && shouldTouchChatUi) refreshChatView(char);
            // A tool-only response was handled; retrying it could repeat an action.
            return count + consumed.toolCount + (avatarAction.changed ? 1 : 0);
        };

        // 构建消息并调用API
        if (!options.background && !options.textOnly && !char.isGroupChat) {
            try { webSearchContext = await window.ByndWebSearch?.prepare(char, char.history || []); }
            catch (error) { console.warn('主动搜索决策失败，继续普通回复', error); }
        }
        const messages = buildMessages(char, char.history || []);
        if (typeof buildWechatAgentInstructions === 'function') messages.push({ role: 'system', content: buildWechatAgentInstructions(char) });
        if (webSearchContext?.prompt) messages.push({ role: 'system', content: webSearchContext.prompt });
        if (options.textOnly) {
            messages.push({
                role: 'system',
                content: '【本轮仅允许文字气泡】只输出角色要发给用户看的普通文字消息。禁止输出微信语音、图片、表情、音乐、链接、红包、转账、通话、旁白或任何方括号指令。'
            });
        }
        // 流式回复：仅前台、非群聊，并且当前聊天在设置里打开了开关。
        const streamPreference = shouldTouchChatUi
            && !char.isGroupChat
            && typeof getWechatAgentPreferences === 'function'
            && (getWechatAgentPreferences(char).streamReplies === true || !!webSearchContext);
        streamPreview = streamPreference ? createWechatStreamPreview(char, contentEl) : null;
        const chatApiOptions = {
            background: !!options.background,
            force: !!options.force,
            stream: streamPreference,
            usageCollector,
            usageFeature: 'chat',
            usageLedgerIds,
            usageChar: char,
            onStreamDelta: streamPreview ? (_, fullContent) => streamPreview.update(fullContent) : undefined
        };
        let result = await callChatApi(messages, chatApiOptions);
        if (!result.ok && (isWechatApiRateLimitError(result) || result.deferred)) {
            if (typeof showWechatToast === 'function' && shouldTouchChatUi) showWechatToast(result.error, 6000);
            return;
        }
        if (!result.ok && !result.httpStatus && /空内容/.test(String(result.error || ''))) {
            messages.push({
                role: 'system',
                content: '【重新生成】上一轮响应没有可见微信正文。请只输出本轮要发给用户看的微信消息；不要只输出 thinking/COT/状态栏/正则块。若需要状态栏或正则块，必须放在至少一条可见消息之后，且保持独立。'
            });
            result = await callChatApi(messages, chatApiOptions);
            if (!result.ok && (isWechatApiRateLimitError(result) || result.deferred)) {
                if (typeof showWechatToast === 'function' && shouldTouchChatUi) showWechatToast(result.error, 6000);
                return;
            }
        }

        // 恢复标题，备注可能会在 AI 指令里被角色主动修改。
        if (shouldTouchChatUi) syncWechatCurrentChatTitleState('');
        if (!(window.myCharacters || []).includes(char) || char.history !== replyHistory) return;

        if (result.ok) {
            if (markPendingUserPaymentsCollected(char) && shouldTouchChatUi) {
                refreshChatView(char);
            }
            if (!options.textOnly && (typeof getWechatAgentPreferences !== 'function' || getWechatAgentPreferences(char).allowImages) && shouldRetryWechatImageDirectiveResponse(result.content || '', char)) {
                const imageRetry = await callChatApi(messages.concat({
                    role: 'system',
                    content: '【必须重写为生图指令】你刚才用普通文字说了“看图/照片来了/给你看”等内容，这是错误的。现在如果要发图，必须输出一段 [微信图片:画面提示词|说明]，不要只写普通文字。画面提示词要具体描述角色本人、外观、服饰、表情、姿势、光线、环境，并保持角色参考图的同一张脸和画风。'
                }), chatApiOptions);
                if (imageRetry && imageRetry.ok) result = imageRetry;
            }
            let newAiMessageCount = await appendAiResultToChat(result.content || '', { instant: !!result.previewed });
            if (newAiMessageCount === 0) {
                const retryMessages = messages.concat({
                    role: 'system',
                    content: options.textOnly
                        ? '【强制重写】你刚才输出了特殊消息/指令或不可见内容，前端已过滤。现在只能输出 1-3 条普通文字气泡，禁止任何方括号指令、语音、图片、表情、音乐、链接、旁白、代码块。'
                        : '【强制重写】你刚才只输出了 thinking/COT/状态栏/自检/元分析，前端已全部过滤。现在必须只输出 1-3 条可以直接显示在微信气泡里的角色正文。禁止输出 <thinking>、<content>、[消息]、[状态栏]、自检、解释、检查清单、代码块。'
                });
                const retry = await callChatApi(retryMessages, chatApiOptions);
                if (retry && !retry.ok) {
                    if (typeof showWechatToast === 'function' && shouldTouchChatUi) showWechatToast(retry.error, 6000);
                    return;
                }
                if (retry && retry.ok) {
                    newAiMessageCount = await appendAiResultToChat(retry.content || '', { instant: !!retry.previewed });
                }
            }
            if (char?.isGroupChat) {
                const completed = await completeWechatGroupMissingReplies(char, contentEl, replyStartIndex, newAiMessageCount);
                newAiMessageCount += completed;
            }
            if (newAiMessageCount > 0) {
                if (usageCollector?.length) {
                    const latestReplyIndex = char.history.findLastIndex((item, index) => index >= replyStartIndex && item && !item.isMe && item.type !== 'system_notice' && !isWechatHiddenChatSurfaceMessage(item));
                    if (latestReplyIndex >= 0) {
                        char.history[latestReplyIndex].apiUsageRecords = usageCollector;
                        if (shouldTouchChatUi) refreshChatView(char);
                    }
                }
                linkWechatUsageLedgerSource(char, usageLedgerIds, char.history.findLastIndex((item, index) => index >= replyStartIndex && item && !item.isMe && item.type !== 'system_notice' && !isWechatHiddenChatSurfaceMessage(item)));
                if (await saveCharactersToStorage() === false) throw new Error('回复已显示，但未能保存。请检查存储后重试保存，再关闭页面。');
                if (!char.isGroupChat && window.LivingWorld?.recordPrivateChatMessage) {
                    const latestReply = [...char.history].reverse().find(item => item && !item.isMe && !item.apiError && item.type === 'text');
                    if (latestReply) {
                        try { window.LivingWorld.recordPrivateChatMessage(char, latestReply); }
                        catch (error) { console.warn('论坛角色事件未保存', error); }
                    }
                }
                renderChatList();
                showWechatDesktopMessageIsland(char);
                void runWechatTurnFollowUps(char, { replyDecisions, textOnly: !!options.textOnly, webSearched: !!webSearchContext?.sources?.length });
            } else if (typeof showWechatToast === 'function') {
                showWechatToast('AI 这次只返回了思维链，已拦截，没有发送空气泡');
            }
        } else {
            const errMsg = { type: 'text', isMe: false, apiError: true, content: `⚠️ ${result.error}`, timestamp: createMessageTimestamp() };
            if (usageCollector?.length) errMsg.apiUsageRecords = usageCollector;
            char.history.push(errMsg);
            linkWechatUsageLedgerSource(char, usageLedgerIds, char.history.length - 1);
            if (shouldTouchChatUi) refreshChatView(char);
        }

        if (shouldTouchChatUi && contentEl) contentEl.scrollTop = contentEl.scrollHeight;
        if (await saveCharactersToStorage() === false) throw new Error('聊天未能保存，请检查存储后重试。');
        renderChatList();
    } catch (error) {
        if (typeof showWechatToast === 'function') showWechatToast(error.message || '本次回复未完成，请重试。', 6000);
        console.warn('wechat reply failed:', error);
    } finally {
        streamPreview?.remove();
        window.ByndCharacterPet?.endReply(char);
        if (shouldTouchChatUi) {
            syncWechatCurrentChatTitleState('');
            setWechatBusyState(false);
        }
        window._wechatAiBusy = false;
    }
}

function resizeWechatMessageInput() {
    const inputEl = document.getElementById('wc-msg-input');
    if (inputEl && inputEl.tagName === 'TEXTAREA' && !isWechatRichInputEnabled()) {
        inputEl.style.setProperty('height', '36px', 'important');
        const maxHeight = 96;
        const nextHeight = Math.min(maxHeight, Math.max(36, inputEl.scrollHeight || 36));
        inputEl.style.setProperty('height', `${nextHeight}px`, 'important');
        inputEl.style.setProperty('overflow-y', inputEl.scrollHeight > maxHeight ? 'auto' : 'hidden', 'important');
    }
    const richEl = getWechatRichInputElement?.();
    if (richEl && isWechatRichInputEnabled()) {
        richEl.scrollTop = richEl.scrollHeight;
    }
}

function syncWechatDraftState() {
    const room = document.getElementById('wechat-chat-room');
    const inputEl = document.getElementById('wc-msg-input');
    resizeWechatMessageInput();
    if (!room || !inputEl) return;
    room.classList.toggle('has-draft', !!getWechatMessageInputValue({ markers: false }).trim());
}

function isWechatVoiceInputMode() {
    return !!document.getElementById('wechat-chat-room')?.classList.contains('is-voice-input');
}

function isWechatNativeVoiceTheme() {
    return typeof getWechatUiThemeId === 'function' && getWechatUiThemeId() === 'wechat';
}

function getWechatVoiceHoldSurface() {
    const room = document.getElementById('wechat-chat-room');
    if (room?.classList.contains('uses-rich-voice-input')) return getWechatRichInputElement();
    if (isWechatNativeVoiceTheme()) return getWechatRichInputElement() || document.getElementById('wc-msg-input');
    return document.getElementById('wc-msg-input') || document.getElementById('wc-voice-press-btn');
}

function isWechatVoiceHoldGesture(event) {
    const target = event?.currentTarget;
    if (!target) return false;
    if (isWechatVoiceInputMode()) return target === getWechatVoiceHoldSurface();
    return isWechatNativeVoiceTheme() && target === getWechatRichInputElement();
}

function setWechatHoldVoiceOverlay(active, options = {}) {
    const room = document.getElementById('wechat-chat-room');
    const overlay = document.getElementById('wc-hold-voice-overlay');
    if (!room || !overlay || !isWechatNativeVoiceTheme()) return;
    room.classList.toggle('wc-hold-voice-active', !!active);
    overlay.classList.toggle('hidden', !active);
    if (!active) return;
    const transcript = document.getElementById('wc-hold-voice-transcript');
    const prompt = document.getElementById('wc-hold-voice-prompt');
    if (transcript && options.text != null) transcript.textContent = options.text || '正在聆听...';
    if (prompt && options.prompt != null) prompt.textContent = options.prompt;
}

function updateWechatHoldVoiceTranscript(text) {
    const overlay = document.getElementById('wc-hold-voice-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    const transcript = document.getElementById('wc-hold-voice-transcript');
    if (transcript) transcript.textContent = String(text || '').trim() || '正在聆听...';
}

function setWechatVoiceHoldSurfaceLabel(surface, label) {
    if (!surface) return;
    surface.setAttribute('aria-label', label);
    if (surface.matches('textarea, input')) {
        surface.placeholder = label;
        return;
    }
    if (surface.classList.contains('wc-rich-input')) {
        surface.dataset.placeholder = label;
        return;
    }
    surface.textContent = label;
}

function setWechatVoiceInputSurfaceActive(active) {
    const input = document.getElementById('wc-msg-input');
    const rich = getWechatRichInputElement();
    const surfaces = [input, rich].filter(Boolean);
    surfaces.forEach(surface => {
        if (active) {
            if (!surface.dataset.voiceHoldDraft) {
                surface.dataset.voiceHoldDraft = surface.matches('textarea, input') ? surface.value : surface.innerHTML;
            }
            if (surface.matches('textarea, input')) {
                surface.value = '';
                surface.readOnly = true;
            } else {
                surface.innerHTML = '';
                surface.setAttribute('contenteditable', 'false');
            }
            surface.classList.add('wc-voice-hold-surface');
            setWechatVoiceHoldSurfaceLabel(surface, '长按说话');
            return;
        }
        if (surface.dataset.voiceHoldDraft != null) {
            if (surface.matches('textarea, input')) surface.value = surface.dataset.voiceHoldDraft;
            else surface.innerHTML = surface.dataset.voiceHoldDraft;
            delete surface.dataset.voiceHoldDraft;
        }
        if (surface.matches('textarea, input')) {
            surface.readOnly = false;
            surface.placeholder = getWechatChatInputPlaceholder();
        } else {
            surface.setAttribute('contenteditable', window._wechatAiBusy ? 'false' : 'true');
            surface.dataset.placeholder = getWechatChatInputPlaceholder();
        }
        surface.removeAttribute('aria-label');
        surface.classList.remove('wc-voice-hold-surface', 'is-pressing', 'is-recording');
    });
}

function clearWechatVoiceInputHoldPending(event) {
    const pending = window._wechatVoiceHoldPending;
    if (!pending || (event?.pointerId != null && pending.pointerId !== event.pointerId)) return false;
    clearTimeout(pending.timer);
    pending.target?.classList.remove('is-pressing');
    if (event && pending.target?.releasePointerCapture && event.pointerId != null) {
        try { pending.target.releasePointerCapture(event.pointerId); } catch (e) {}
    }
    window._wechatVoiceHoldPending = null;
    return true;
}

function handleWechatVoiceInputPointerDown(event) {
    if (!isWechatVoiceHoldGesture(event) || window._wechatAiBusy) return;
    const voiceMode = isWechatVoiceInputMode();
    if (voiceMode) event.preventDefault();
    const target = event.currentTarget;
    clearWechatVoiceInputHoldPending();
    if (voiceMode && target.setPointerCapture && event.pointerId != null) {
        try { target.setPointerCapture(event.pointerId); } catch (e) {}
    }
    if (voiceMode) target.classList.add('is-pressing');
    const pending = { target, pointerId: event.pointerId ?? null, timer: null, voiceMode };
    pending.timer = setTimeout(() => {
        if (window._wechatVoiceHoldPending !== pending) return;
        window._wechatVoiceHoldPending = null;
        target.classList.remove('is-pressing');
        if (!pending.voiceMode) target.blur();
        startWechatHoldVoice({ currentTarget: target, pointerId: pending.pointerId, clientX: pending.startX, clientY: pending.startY });
    }, 320);
    pending.startX = event.clientX ?? null;
    pending.startY = event.clientY ?? null;
    window._wechatVoiceHoldPending = pending;
}

function handleWechatVoiceInputPointerUp(event) {
    if (!isWechatVoiceHoldGesture(event)) return;
    const hadPendingHold = !!window._wechatVoiceHoldPending;
    if (isWechatVoiceInputMode() || !hadPendingHold) event.preventDefault();
    if (clearWechatVoiceInputHoldPending(event)) return;
    const hold = window._wechatVoiceHold;
    finishWechatHoldVoice(event, hold?.editRequested ? { edit: true } : undefined);
}

function handleWechatVoiceInputPointerMove(event) {
    if (!isWechatVoiceHoldGesture(event)) return;
    const hold = window._wechatVoiceHold;
    if (!hold || (event.pointerId != null && hold.pointerId != null && event.pointerId !== hold.pointerId)) return;
    const startX = Number(hold.startX);
    const startY = Number(hold.startY);
    const currentX = Number(event.clientX);
    const currentY = Number(event.clientY);
    if (![startX, startY, currentX, currentY].every(Number.isFinite)) return;
    const deltaX = currentX - startX;
    const deltaY = Math.abs(currentY - startY);
    const editRequested = deltaX >= 72 && deltaX >= deltaY * 1.25;
    if (editRequested === !!hold.editRequested) return;
    hold.editRequested = editRequested;
    setWechatHoldVoiceOverlay(true, { prompt: editRequested ? '松开 编辑' : '松手 发送' });
    if (editRequested) event.preventDefault();
}

function handleWechatVoiceInputPointerCancel(event) {
    if (!isWechatVoiceHoldGesture(event)) return;
    event.preventDefault();
    clearWechatVoiceInputHoldPending(event);
    cancelWechatHoldVoice(event);
}

function handleWechatVoiceInputPointerLeave(event) {
    if (!isWechatVoiceHoldGesture(event) || event?.buttons) return;
    handleWechatVoiceInputPointerCancel(event);
}

function handleWechatVoiceInputContextMenu(event) {
    if (isWechatVoiceInputMode() || window._wechatVoiceHoldPending || window._wechatVoiceHold) event.preventDefault();
}

function setWechatVoiceToolMode(mode) {
    const nextMode = mode === 'tts' ? 'tts' : 'speech';
    document.querySelectorAll('.wc-voice-mode-tabs button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === nextMode);
    });
    document.getElementById('wc-voice-speech-panel')?.classList.toggle('hidden', nextMode !== 'speech');
    document.getElementById('wc-voice-tts-panel')?.classList.toggle('hidden', nextMode !== 'tts');
    const status = document.getElementById('wc-voice-status');
    if (status) status.textContent = nextMode === 'tts' ? '输入文字，发送后显示为语音气泡' : '长按输入框说话，松开发送';
}

function setWechatVoiceInputMode(active, options = {}) {
    const room = document.getElementById('wechat-chat-room');
    const panel = document.getElementById('wc-voice-mode-panel');
    const inputEl = document.getElementById('wc-msg-input');
    const richEl = getWechatRichInputElement();
    const icon = document.getElementById('wc-voice-toggle-icon');
    if (!room) return;
    // 微信主题的输入框始终保持可编辑：长按本身就是录音手势，不再先切换录音模式。
    const useDirectHold = isWechatNativeVoiceTheme();
    const nextActive = useDirectHold ? false : !!active;
    room.classList.toggle('is-voice-input', nextActive);
    room.classList.toggle('uses-rich-voice-input', nextActive && isWechatRichInputEnabled());
    if (panel) panel.classList.add('hidden');
    if (icon) icon.className = nextActive ? 'ri-keyboard-line' : 'ri-mic-line';
    setWechatVoiceInputSurfaceActive(nextActive);
    if (useDirectHold) {
        document.querySelector('.wc-voice-btn')?.setAttribute('aria-label', '长按输入框说话');
    } else if (nextActive) {
        closeChatToolbar();
        closeStickerPicker();
        inputEl?.blur();
        richEl?.blur();
        setWechatVoiceToolMode('speech');
    } else if (!options.keepDraft) {
        cancelWechatHoldVoice();
    }
    syncWechatDraftState();
}

function toggleWechatVoiceInputMode(force) {
    if (isWechatNativeVoiceTheme()) {
        setWechatVoiceInputMode(false, { keepDraft: true });
        return;
    }
    const active = typeof force === 'boolean' ? force : !isWechatVoiceInputMode();
    setWechatVoiceInputMode(active);
}

function clearWechatVoiceDraft() {
    const speech = document.getElementById('wc-voice-recognized-text');
    const tts = document.getElementById('wc-voice-tts-input');
    if (speech) speech.value = '';
    if (tts) tts.value = '';
    const status = document.getElementById('wc-voice-status');
    if (status) status.textContent = '长按输入框说话，松开发送';
}

function getWechatRecordMimeType() {
    if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    return [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus'
    ].find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function readWechatBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('读取录音失败'));
        reader.readAsDataURL(blob);
    });
}

async function analyzeWechatVoiceMeta(blob, options = {}) {
    const fallback = buildWechatVoiceMetaFromTranscript(options);
    if (!blob || typeof blob.arrayBuffer !== 'function') return fallback;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return fallback;
    let audioContext = null;
    try {
        const arrayBuffer = await blob.arrayBuffer();
        audioContext = new AudioContextCtor();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const features = extractWechatVoiceAudioFeatures(audioBuffer, options);
        return buildWechatVoiceMetaFromFeatures(features, options);
    } catch (e) {
        console.warn('voice meta analysis failed:', e);
        return fallback;
    } finally {
        try {
            if (audioContext && audioContext.state !== 'closed') await audioContext.close();
        } catch (e) {}
    }
}

function buildWechatVoiceMetaFromTranscript(options = {}) {
    const transcript = String(options.transcript || '').trim();
    const duration = Math.max(1, Number(options.duration) || 0);
    if (!transcript) {
        return {
            source: 'local-fallback',
            emotion: '不确定',
            energy: '未知',
            pace: '未知',
            pitch: '未知',
            voiceQuality: [],
            confidence: 0.18,
            summary: '没有可用的声音特征，只知道用户发来一段真实语音。'
        };
    }
    const charsPerSecond = Array.from(transcript).length / duration;
    const pace = charsPerSecond > 4.2 ? '偏快' : (charsPerSecond < 1.6 ? '偏慢' : '适中');
    const sadHint = /难受|累|烦|崩溃|算了|没事|不想|哭|委屈|失望|心累|撑不住/.test(transcript);
    const happyHint = /开心|高兴|好耶|哈哈|喜欢|太好了|爱你|期待|舒服/.test(transcript);
    return {
        source: 'local-transcript',
        emotion: sadHint ? '低落' : (happyHint ? '开心' : '不确定'),
        energy: '未知',
        pace,
        pitch: '未知',
        voiceQuality: [],
        confidence: sadHint || happyHint ? 0.34 : 0.22,
        summary: `只有语音转写可用，语速看起来${pace}${sadHint ? '，文字内容带低落倾向' : (happyHint ? '，文字内容偏开心' : '')}。`
    };
}

function extractWechatVoiceAudioFeatures(audioBuffer, options = {}) {
    const sampleRate = audioBuffer.sampleRate || 44100;
    const channelCount = Math.max(1, audioBuffer.numberOfChannels || 1);
    const length = audioBuffer.length || 0;
    const stride = Math.max(1, Math.floor(length / Math.min(length || 1, 180000)));
    let sumSquares = 0;
    let peak = 0;
    let zeroCrossings = 0;
    let previous = 0;
    let sampledCount = 0;

    for (let i = 0; i < length; i += stride) {
        let sample = 0;
        for (let ch = 0; ch < channelCount; ch++) {
            sample += audioBuffer.getChannelData(ch)[i] || 0;
        }
        sample /= channelCount;
        const abs = Math.abs(sample);
        sumSquares += sample * sample;
        if (abs > peak) peak = abs;
        if (sampledCount > 0 && ((sample >= 0 && previous < 0) || (sample < 0 && previous >= 0))) zeroCrossings += 1;
        previous = sample;
        sampledCount += 1;
    }

    const rms = sampledCount ? Math.sqrt(sumSquares / sampledCount) : 0;
    const zcr = sampledCount > 1 ? zeroCrossings / (sampledCount - 1) : 0;
    const frameMs = 50;
    const frameSize = Math.max(1, Math.floor(sampleRate * frameMs / 1000));
    const frameRms = [];
    for (let start = 0; start < length; start += frameSize) {
        let frameSum = 0;
        let count = 0;
        const end = Math.min(length, start + frameSize);
        const data = audioBuffer.getChannelData(0);
        for (let i = start; i < end; i++) {
            const sample = data[i] || 0;
            frameSum += sample * sample;
            count += 1;
        }
        frameRms.push(count ? Math.sqrt(frameSum / count) : 0);
    }
    const activeThreshold = Math.max(0.008, rms * 0.55);
    const activeFrames = frameRms.filter(value => value >= activeThreshold);
    const silentFrames = Math.max(0, frameRms.length - activeFrames.length);
    const silenceRatio = frameRms.length ? silentFrames / frameRms.length : 0;
    const pauseCount = countWechatVoiceLongPauses(frameRms, activeThreshold, frameMs);
    const pitchValues = estimateWechatVoicePitchValues(audioBuffer, activeThreshold);
    const pitchMean = averageWechatNumberList(pitchValues);
    const pitchStd = stdWechatNumberList(pitchValues, pitchMean);
    const transcript = String(options.transcript || '').trim();
    const duration = Math.max(1, Number(options.duration) || audioBuffer.duration || 1);
    const charsPerSecond = transcript ? Array.from(transcript).length / duration : 0;

    return {
        duration,
        rms,
        peak,
        zcr,
        silenceRatio,
        pauseCount,
        pitchMean,
        pitchStd,
        pitchSamples: pitchValues.length,
        charsPerSecond
    };
}

function countWechatVoiceLongPauses(frameRms, threshold, frameMs) {
    let pauseCount = 0;
    let silentRun = 0;
    const minFrames = Math.max(3, Math.round(260 / frameMs));
    frameRms.forEach(value => {
        if (value < threshold) {
            silentRun += 1;
            return;
        }
        if (silentRun >= minFrames) pauseCount += 1;
        silentRun = 0;
    });
    if (silentRun >= minFrames) pauseCount += 1;
    return pauseCount;
}

function estimateWechatVoicePitchValues(audioBuffer, activeThreshold) {
    const sampleRate = audioBuffer.sampleRate || 44100;
    const data = audioBuffer.getChannelData(0);
    const frameSize = Math.min(4096, Math.max(2048, Math.floor(sampleRate * 0.08)));
    const step = Math.max(frameSize, Math.floor(sampleRate * 0.22));
    const values = [];
    for (let start = 0; start + frameSize < data.length && values.length < 10; start += step) {
        const frame = data.subarray(start, start + frameSize);
        const rms = calculateWechatFrameRms(frame);
        if (rms < activeThreshold) continue;
        const pitch = estimateWechatFramePitch(frame, sampleRate);
        if (pitch >= 70 && pitch <= 450) values.push(pitch);
    }
    return values;
}

function calculateWechatFrameRms(frame) {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    return frame.length ? Math.sqrt(sum / frame.length) : 0;
}

function estimateWechatFramePitch(frame, sampleRate) {
    const minLag = Math.floor(sampleRate / 450);
    const maxLag = Math.floor(sampleRate / 70);
    let bestLag = 0;
    let bestScore = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
        let corr = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < frame.length - lag; i += 2) {
            const a = frame[i];
            const b = frame[i + lag];
            corr += a * b;
            normA += a * a;
            normB += b * b;
        }
        const score = normA && normB ? corr / Math.sqrt(normA * normB) : 0;
        if (score > bestScore) {
            bestScore = score;
            bestLag = lag;
        }
    }
    return bestScore > 0.42 && bestLag ? sampleRate / bestLag : 0;
}

function averageWechatNumberList(list) {
    return list && list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 0;
}

function stdWechatNumberList(list, mean = averageWechatNumberList(list)) {
    if (!list || list.length < 2) return 0;
    return Math.sqrt(list.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / list.length);
}

function buildWechatVoiceMetaFromFeatures(features, options = {}) {
    const transcriptMeta = buildWechatVoiceMetaFromTranscript(options);
    if (!features) return transcriptMeta;
    const energy = features.rms < 0.028 ? '低' : (features.rms > 0.095 || features.peak > 0.58 ? '高' : '中');
    const pace = features.charsPerSecond
        ? (features.charsPerSecond > 4.2 ? '偏快' : (features.charsPerSecond < 1.6 ? '偏慢' : '适中'))
        : (features.pauseCount >= 3 || features.silenceRatio > 0.48 ? '偏慢' : '未知');
    const pitch = features.pitchMean
        ? (features.pitchMean > 235 ? '偏高' : (features.pitchMean < 145 ? '偏低' : '适中'))
        : '未知';
    const pitchUnstable = features.pitchMean && features.pitchStd / Math.max(1, features.pitchMean) > 0.18;
    const voiceQuality = [];
    if (features.zcr > 0.24 && features.rms < 0.075) voiceQuality.push('可能沙哑');
    else if (features.zcr > 0.18 && features.rms < 0.065) voiceQuality.push('气声偏重');
    if (features.silenceRatio > 0.45 || features.pauseCount >= 3) voiceQuality.push('停顿多');
    if (pitchUnstable) voiceQuality.push('音高起伏明显');

    let emotion = '平静';
    if (energy === '低' && (pace === '偏慢' || features.silenceRatio > 0.42)) emotion = '低落/疲惫';
    if (energy === '高' && (pace === '偏快' || pitch === '偏高' || pitchUnstable)) emotion = '开心/兴奋';
    if (pitchUnstable && features.pauseCount >= 2) emotion = '紧张/不安';
    if (transcriptMeta.emotion === '低落' && emotion === '平静') emotion = '低落';
    if (transcriptMeta.emotion === '开心' && emotion === '平静') emotion = '开心';

    const cues = [
        `音量${energy}`,
        pace !== '未知' ? `语速${pace}` : '',
        pitch !== '未知' ? `音高${pitch}` : '',
        features.silenceRatio > 0.38 ? '停顿偏多' : '',
        ...voiceQuality
    ].filter(Boolean);
    const confidence = Math.min(0.76, Math.max(0.38, 0.42 + (features.pitchSamples ? 0.08 : 0) + (options.transcript ? 0.08 : 0) + (cues.length >= 3 ? 0.08 : 0)));
    const summary = `本地声音分析：${cues.join('、') || '声音特征不明显'}；整体听起来偏${emotion}。`;

    return {
        source: 'local-audio',
        emotion,
        energy,
        pace,
        pitch,
        voiceQuality,
        confidence: Number(confidence.toFixed(2)),
        summary,
        features: {
            rms: Number(features.rms.toFixed(4)),
            peak: Number(features.peak.toFixed(4)),
            silenceRatio: Number(features.silenceRatio.toFixed(2)),
            pauseCount: features.pauseCount,
            zcr: Number(features.zcr.toFixed(3)),
            pitchMean: features.pitchMean ? Math.round(features.pitchMean) : 0,
            pitchStd: features.pitchStd ? Math.round(features.pitchStd) : 0
        }
    };
}

function formatWechatVoiceMetaForPrompt(meta) {
    if (!meta || typeof meta !== 'object') return '';
    const parts = [];
    if (meta.emotion) parts.push(`情绪:${stripWechatPromptText(meta.emotion, 24)}`);
    if (meta.energy && meta.energy !== '未知') parts.push(`音量:${stripWechatPromptText(meta.energy, 16)}`);
    if (meta.pace && meta.pace !== '未知') parts.push(`语速:${stripWechatPromptText(meta.pace, 16)}`);
    if (meta.pitch && meta.pitch !== '未知') parts.push(`音高:${stripWechatPromptText(meta.pitch, 16)}`);
    if (Array.isArray(meta.voiceQuality) && meta.voiceQuality.length) {
        parts.push(`嗓音:${meta.voiceQuality.map(item => stripWechatPromptText(item, 14)).filter(Boolean).slice(0, 3).join('、')}`);
    }
    const summary = stripWechatPromptText(meta.summary, 90);
    if (summary) parts.push(summary);
    return parts.filter(Boolean).join('；');
}

function resetWechatHoldVoiceUi(message) {
    const surface = getWechatVoiceHoldSurface();
    surface?.classList.remove('is-pressing', 'is-recording');
    if (isWechatVoiceInputMode()) {
        setWechatVoiceHoldSurfaceLabel(surface, '长按说话');
    } else if (isWechatNativeVoiceTheme() && surface) {
        surface.removeAttribute('aria-label');
        if (surface.matches('textarea, input')) surface.placeholder = getWechatChatInputPlaceholder();
        else if (surface.classList.contains('wc-rich-input')) surface.dataset.placeholder = getWechatChatInputPlaceholder();
    }
    setWechatHoldVoiceOverlay(false);
    const status = document.getElementById('wc-voice-status');
    if (status && message) status.textContent = message;
}

function stopWechatHoldSpeechRecognition() {
    const recognition = window._wechatHoldSpeechRecognition;
    if (!recognition) return;
    window._wechatHoldSpeechRecognition = null;
    try { recognition.onend = null; recognition.onerror = null; recognition.stop(); } catch (e) {}
}

function stopWechatHoldMediaTracks(hold) {
    const stream = hold?.stream;
    if (!stream || typeof stream.getTracks !== 'function') return;
    stream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
    });
}

function startWechatHoldSpeechRecognition(hold) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const target = document.getElementById('wc-voice-recognized-text');
    if (!Recognition || !hold) return;
    try {
        stopWechatHoldSpeechRecognition();
        const recognition = new Recognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.onresult = event => {
            let finalText = hold.finalTranscript || '';
            let interimText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const part = event.results[i][0]?.transcript || '';
                if (event.results[i].isFinal) finalText += part;
                else interimText += part;
            }
            hold.finalTranscript = finalText;
            // The old expanded voice panel is no longer part of the interaction.
            // Keep this hidden field in sync only for legacy in-flight recordings.
            const displayText = `${finalText}${interimText ? `…${interimText}` : ''}`.trim();
            if (target) target.value = displayText;
            updateWechatHoldVoiceTranscript(displayText);
        };
        recognition.onerror = () => {};
        window._wechatHoldSpeechRecognition = recognition;
        recognition.start();
    } catch (e) {}
}

async function startWechatHoldVoice(event) {
    if (window._wechatAiBusy) return;
    const surface = event?.currentTarget || getWechatVoiceHoldSurface();
    if (!surface) return;
    if (window._wechatVoiceHold) cancelWechatHoldVoice(event);
    if (event && surface.setPointerCapture && event.pointerId != null) {
        try { surface.setPointerCapture(event.pointerId); } catch (e) {}
    }
    const hold = {
        startedAt: Date.now(),
        pointerId: event?.pointerId ?? null,
        startX: event?.clientX ?? null,
        startY: event?.clientY ?? null,
        cancelled: false,
        chunks: [],
        recorder: null,
        stream: null,
        finalTranscript: ''
    };
    window._wechatVoiceHold = hold;
    surface.classList.add('is-recording');
    setWechatVoiceHoldSurfaceLabel(surface, '准备录音...');
    setWechatHoldVoiceOverlay(true, { text: '正在聆听...', prompt: '松手 发送' });
    const status = document.getElementById('wc-voice-status');
    if (status) status.textContent = '正在请求麦克风权限';

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        window._wechatVoiceHold = null;
        resetWechatHoldVoiceUi('当前浏览器不支持录音，不能发送真实语音');
        if (typeof showWechatToast === 'function') showWechatToast('当前浏览器不支持录音');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (window._wechatVoiceHold !== hold || hold.cancelled) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }
        hold.stream = stream;
        const mimeType = getWechatRecordMimeType();
        const recorderOptions = { audioBitsPerSecond: 32000 };
        if (mimeType) recorderOptions.mimeType = mimeType;
        const recorder = new MediaRecorder(stream, recorderOptions);
        hold.recorder = recorder;
        hold.mimeType = recorder.mimeType || mimeType || 'audio/webm';
        recorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) hold.chunks.push(e.data);
        };
        recorder.start(250);
        hold.maxTimer = setTimeout(() => finishWechatHoldVoice(event, { autoStop: true }), 60000);
        setWechatVoiceHoldSurfaceLabel(surface, '松开发送');
        setWechatHoldVoiceOverlay(true, { prompt: '松手 发送' });
        if (status) status.textContent = '正在录音，松开发送';
        startWechatHoldSpeechRecognition(hold);
    } catch (e) {
        window._wechatVoiceHold = null;
        resetWechatHoldVoiceUi(e && e.name === 'NotAllowedError' ? '麦克风权限被拒绝' : '麦克风启动失败');
        if (typeof showWechatToast === 'function') showWechatToast(e && e.name === 'NotAllowedError' ? '请允许麦克风权限' : '麦克风启动失败');
    }
}

function requestWechatHoldVoiceEdit() {
    if (!window._wechatVoiceHold) return;
    finishWechatHoldVoice(null, { edit: true });
}

function maybeCancelWechatHoldVoice(event) {
    const hold = window._wechatVoiceHold;
    if (!hold || hold.pointerId == null || event?.buttons) return;
    cancelWechatHoldVoice(event);
}

function cancelWechatHoldVoice(event) {
    clearWechatVoiceInputHoldPending(event);
    const surface = event?.currentTarget || getWechatVoiceHoldSurface();
    if (event && surface?.releasePointerCapture && event.pointerId != null) {
        try { surface.releasePointerCapture(event.pointerId); } catch (e) {}
    }
    const hold = window._wechatVoiceHold;
    if (hold) {
        hold.cancelled = true;
        clearTimeout(hold.maxTimer);
        stopWechatHoldSpeechRecognition();
        try {
            if (hold.recorder && hold.recorder.state !== 'inactive') hold.recorder.stop();
        } catch (e) {}
        stopWechatHoldMediaTracks(hold);
    }
    window._wechatVoiceHold = null;
    resetWechatHoldVoiceUi('已取消，长按输入框重新说话');
}

async function finishWechatHoldVoice(event, options = {}) {
    const hold = window._wechatVoiceHold;
    if (!hold) return;
    const surface = event?.currentTarget || getWechatVoiceHoldSurface();
    if (event && surface?.releasePointerCapture && event.pointerId != null) {
        try { surface.releasePointerCapture(event.pointerId); } catch (e) {}
    }
    const elapsed = Math.max(1, Math.min(90, Math.round((Date.now() - hold.startedAt) / 1000) || 1));
    window._wechatVoiceHold = null;
    clearTimeout(hold.maxTimer);
    stopWechatHoldSpeechRecognition();
    resetWechatHoldVoiceUi(options.autoStop ? '录音已到 60 秒，正在发送' : '正在发送录音');

    const recorder = hold.recorder;
    let stopped = Promise.resolve();
    if (recorder && recorder.state !== 'inactive') {
        stopped = new Promise(resolve => {
            recorder.onstop = resolve;
            try { recorder.stop(); } catch (e) { resolve(); }
        });
    }
    await stopped;
    stopWechatHoldMediaTracks(hold);

    const transcriptEl = document.getElementById('wc-voice-recognized-text');
    const transcript = (hold.finalTranscript || transcriptEl?.value || '').replace(/….*$/g, '').trim();
    if (!hold.chunks.length) {
        resetWechatHoldVoiceUi('没有录到声音，请重新长按输入框');
        return;
    }
    if (options.edit) {
        resetWechatHoldVoiceUi('已转为可编辑文字');
        if (isWechatVoiceInputMode()) setWechatVoiceInputMode(false, { keepDraft: true });
        if (transcript) {
            insertWechatRichInputText(transcript);
            getWechatRichInputElement()?.focus();
        } else if (typeof showWechatToast === 'function') {
            showWechatToast('没有识别到可编辑的文字');
        }
        return;
    }
    let audioUrl = '';
    let voiceMeta = null;
    try {
        const blob = new Blob(hold.chunks, { type: hold.mimeType || 'audio/webm' });
        const status = document.getElementById('wc-voice-status');
        if (status) status.textContent = '正在分析声音情绪...';
        const [nextAudioUrl, nextVoiceMeta] = await Promise.all([
            readWechatBlobAsDataUrl(blob),
            analyzeWechatVoiceMeta(blob, {
                transcript,
                duration: elapsed,
                mimeType: hold.mimeType || 'audio/webm'
            }).catch(() => null)
        ]);
        audioUrl = nextAudioUrl;
        voiceMeta = nextVoiceMeta;
    } catch (e) {
        resetWechatHoldVoiceUi('录音保存失败，请重试');
        if (typeof showWechatToast === 'function') showWechatToast('录音保存失败');
        return;
    }
    const voiceMessage = {
        type: 'voice',
        isMe: true,
        duration: elapsed,
        transcript,
        content: transcript || `[语音 ${formatWechatDuration(elapsed)}]`,
        audioUrl,
        audioMime: hold.mimeType || 'audio/webm',
        timestamp: createMessageTimestamp()
    };
    if (voiceMeta) voiceMessage.voiceMeta = voiceMeta;
    appendWechatMessage(voiceMessage);
    if (transcriptEl) transcriptEl.value = '';
    const status = document.getElementById('wc-voice-status');
    if (status) status.textContent = '已发送语音';
}

async function sendWechatTypedVoice() {
    const input = document.getElementById('wc-voice-tts-input');
    const text = (input?.value || '').trim();
    if (!text) {
        if (typeof showWechatToast === 'function') showWechatToast('先输入要转成语音的文字');
        return;
    }
    const status = document.getElementById('wc-voice-status');
    const msg = {
        type: 'voice',
        isMe: true,
        duration: estimateWechatVoiceDuration(text),
        transcript: text,
        content: text,
        timestamp: createMessageTimestamp()
    };
    const voiceApi = typeof getDefaultVoiceApi === 'function' ? getDefaultVoiceApi() : null;
    if (voiceApi && typeof requestDefaultVoiceAudio === 'function') {
        try {
            if (status) status.textContent = '正在生成语音气泡...';
            const result = await requestDefaultVoiceAudio(text);
            msg.audioUrl = result.audioUrl;
            msg.audioMime = result.mimeType || 'audio/mpeg';
            msg.duration = result.duration || msg.duration;
        } catch (e) {
            console.warn('TTS failed:', e);
            if (typeof showWechatToast === 'function') showWechatToast('已发送语音气泡');
        }
    }
    appendWechatMessage({
        ...msg
    });
    if (input) input.value = '';
    if (status) status.textContent = '已发送语音气泡';
}

function startWechatSpeechRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const target = document.getElementById('wc-voice-recognized-text');
    const status = document.getElementById('wc-voice-status');
    if (!Recognition || !target) {
        if (status) status.textContent = '当前浏览器不支持实时语音转文字，可直接按住说话发送语音';
        if (typeof showWechatToast === 'function') showWechatToast('当前浏览器不支持实时语音转文字');
        return;
    }
    try {
        if (window._wechatSpeechRecognition) {
            window._wechatSpeechRecognition.stop();
            window._wechatSpeechRecognition = null;
        }
        const recognition = new Recognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.onresult = event => {
            let finalText = '';
            let interimText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const part = event.results[i][0]?.transcript || '';
                if (event.results[i].isFinal) finalText += part;
                else interimText += part;
            }
            target.value = (target.value.replace(/\s*…[^\n]*$/g, '') + finalText + (interimText ? `…${interimText}` : '')).trim();
        };
        recognition.onstart = () => { if (status) status.textContent = '正在转文字...'; };
        recognition.onend = () => { if (status) status.textContent = '转文字结束，可按住发送语音'; window._wechatSpeechRecognition = null; };
        recognition.onerror = () => { if (status) status.textContent = '转文字失败，可直接按住发送语音'; };
        window._wechatSpeechRecognition = recognition;
        recognition.start();
    } catch (e) {
        if (status) status.textContent = '转文字启动失败，可直接按住发送语音';
    }
}

function setWechatTypingIndicator(show) {
    document.getElementById('wc-typing-indicator')?.remove();
    const root = document.getElementById('app-wechat-window');
    const isClaude = root?.classList.contains('wc-ui-theme-claude');
    const content = document.getElementById('chat-room-content');
    if (!isClaude || !content) {
        root?.classList.remove('wc-claude-generating');
        return;
    }
    root.classList.toggle('wc-claude-generating', !!show);
    if (!show) {
        content.querySelector('.wc-claude-typing')?.remove();
        return;
    }
    if (!content.querySelector('.wc-claude-typing')) {
        content.insertAdjacentHTML('beforeend', `<div class="wc-claude-typing" id="wc-typing-indicator">${renderWechatClaudeMarkSvg('wc-claude-typing-mark')}<span class="wc-claude-sr-only">Claude is responding</span></div>`);
        requestAnimationFrame(() => content.querySelector('.wc-claude-typing')?.classList.add('is-active'));
    }
}

function setWechatBusyState(isBusy) {
    if (isBusy) window._wechatBusyStartedAt = Date.now();
    else window._wechatBusyStartedAt = 0;
    setWechatTypingIndicator(!!isBusy);
    const inputEl = document.getElementById('wc-msg-input');
    const richEl = getWechatRichInputElement?.();
    const voiceInputMode = isWechatVoiceInputMode();
    const placeholder = isBusy ? '正在回复中...' : (voiceInputMode ? '长按说话' : getWechatChatInputPlaceholder());
    const sendBtn = document.querySelector('.wc-send-btn');
    const aiBtn = document.querySelector('.wc-ai-btn');
    const voiceBtn = document.querySelector('.wc-voice-btn');
    const stickerBtn = document.querySelector('.wc-sticker-btn');
    const addBtn = document.querySelector('.wc-add-btn');
    if (inputEl) {
        inputEl.disabled = isBusy;
        inputEl.readOnly = voiceInputMode;
        inputEl.placeholder = placeholder;
    }
    if (richEl) {
        richEl.dataset.placeholder = placeholder;
        richEl.setAttribute('contenteditable', isBusy || voiceInputMode ? 'false' : 'true');
        richEl.classList.toggle('is-busy', !!isBusy);
    }
    const pressBtn = document.getElementById('wc-voice-press-btn');
    [sendBtn, aiBtn, voiceBtn, stickerBtn, addBtn, pressBtn].forEach(btn => {
        if (!btn) return;
        btn.classList.toggle('is-disabled', isBusy);
        btn.style.pointerEvents = isBusy ? 'none' : '';
    });
    if (aiBtn && (document.getElementById('app-wechat-window')?.classList.contains('wc-ui-theme-claude') || aiBtn.dataset.claudeIdleMarkup)) {
        if (!aiBtn.dataset.claudeIdleMarkup) aiBtn.dataset.claudeIdleMarkup = aiBtn.innerHTML;
        aiBtn.innerHTML = isBusy
            ? '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"></rect>'
            : aiBtn.dataset.claudeIdleMarkup;
        aiBtn.classList.toggle('wc-claude-stop', !!isBusy);
        aiBtn.setAttribute('aria-label', isBusy ? '正在生成' : 'AI 回复');
    }
    syncWechatDraftState();
}

function recoverWechatInputLockIfStale() {
    const inputEl = document.getElementById('wc-msg-input');
    const richEl = getWechatRichInputElement?.();
    if (!inputEl && !richEl) return;
    const busyStartedAt = Number(window._wechatBusyStartedAt || 0);
    const isStaleBusy = !!window._wechatAiBusy && busyStartedAt > 0 && Date.now() - busyStartedAt > 120000;
    if (!window._wechatAiBusy || isStaleBusy) {
        if (isStaleBusy) window._wechatAiBusy = false;
        setWechatBusyState(false);
    }
}

