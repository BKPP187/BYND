function buildWechatGeneratedImageMessage(prompt, caption, char) {
    const cleanPrompt = cleanWechatVisibleContent(prompt || caption || '');
    if (!cleanPrompt) return null;
    const cleanCaption = cleanWechatVisibleContent(caption || '照片');
    return {
        type: 'image',
        isMe: false,
        content: '',
        imageUrl: '',
        imagePending: true,
        imagePrompt: cleanPrompt,
        description: cleanCaption,
        timestamp: createMessageTimestamp()
    };
}

function buildWechatImageMessageFromAiText(text, char) {
    const source = cleanWechatVisibleContent(text);
    const match = source.match(/^\s*[\[【](?:微信图片|微信照片)\s*[：:]\s*([\s\S]+?)[\]】]\s*$/);
    return match ? buildWechatMessageFromAiDirective('微信图片', match[1], char) : null;
}

function buildWechatAutoImageMessageFromText(text, char) {
    const source = cleanWechatVisibleContent(text);
    if (!source || source.length > 620) return null;
    if (hasWechatAiDirectiveSource(source) || looksLikeWechatRichOrRegexSource(source, char)) return null;
    const shortPhotoIntent = /^(?:你)?(?:看图|看照片|看图片|看这个|给你看(?:一下|一眼|看)?|给你看看|发你看|发张图|发个图|发照片|发自拍|照片来了|图来了|自拍来了|拍给你看)(?:吧|啦|了|一下|一眼)?[。.!！…\s]*$/i.test(source);
    const photoIntent = /(照片|自拍|图片|相片|镜头)/.test(source)
        && /(加载|传了过来|发了过来|发给你|给你看|重新拍|拍给你|拍了一张|发来|传来)/.test(source);
    if (!shortPhotoIntent && (!photoIntent || source.length < 18)) return null;
    const recent = Array.isArray(char && char.history)
        ? char.history.slice().reverse().find(msg => msg && msg.type !== 'system_notice' && !msg.isMe)
        : null;
    const recentText = recent ? cleanWechatVisibleContent(recent.content || recent.description || '').slice(0, 160) : '';
    const sceneHint = shortPhotoIntent
        ? '角色主动发来一张此刻照片/自拍，回应当前聊天里的“在干嘛/给我看看/看图”等语境。'
        : `画面描述：${source}`;
    const prompt = [
        `微信聊天中角色刚发来的真实照片。`,
        sceneHint,
        recentText ? `最近角色上一句：${recentText}` : '',
        char && char.description ? `角色设定：${String(char.description).slice(0, 900)}` : '',
        '手机照片质感，自然光线，真实自拍或随手拍构图，不要文字水印，不要聊天气泡。'
    ].filter(Boolean).join('\n');
    return buildWechatGeneratedImageMessage(prompt, shortPhotoIntent ? '看图' : '照片', char);
}

function buildWechatMessageFromAiDirective(command, rawArgs, char) {
    const args = splitWechatDirectiveArgs(rawArgs);
    const base = { isMe: false, timestamp: createMessageTimestamp() };

    if (command === '群聊发言' || command === '微信群聊') {
        return buildWechatGroupSpeechDirective(rawArgs, char);
    }

    if (isWechatQQGroupTitleDirectiveCommand(command)) {
        return applyWechatQQGroupTitleDirective(rawArgs, char);
    }

    if (isWechatGroupNicknameDirectiveCommand(command)) {
        return applyWechatGroupNicknameDirective(rawArgs, char);
    }

    if (isWechatGroupNameDirectiveCommand(command)) {
        return applyWechatGroupNameDirective(rawArgs, char);
    }

    if (isWechatGroupInviteDirectiveCommand(command)) {
        return applyWechatGroupInviteDirective(rawArgs, char);
    }

    if (command === '旁白' || command === '微信旁白') {
        const content = args.join('|').trim();
        if (!content) return null;
        if (looksLikeWechatRichOrRegexSource(content, char)) {
            return {
                ...base,
                type: 'text',
                content
            };
        }
        const narration = normalizeWechatOfflineNarrationText(content);
        if (!narration) return null;
        return {
            ...base,
            type: 'offline_narration',
            content: narration,
            description: ''
        };
    }

    if (command === '微信引用') {
        const target = findWechatMessageForAiQuote(char, args[0] || '');
        const content = args.slice(1).join('|').trim();
        if (!content) return null;
        const replyTo = target
            ? buildWechatReplySnapshot(target.msg, char, target.index)
            : buildWechatFallbackReplySnapshotFromAiQuote(args[0] || '');
        return {
            ...base,
            type: 'text',
            content,
            ...(replyTo ? { replyTo } : {})
        };
    }

    if (command === '微信记忆') {
        const content = args.join('|').trim();
        if (content) addWechatAutoMemory(char, content, '角色主动记忆');
        return null;
    }

    if (command === '微信改用户备注') {
        return applyWechatUserTitleDirective(rawArgs, char);
    }

    if (command === '微信拉黑') {
        return applyWechatCharBlacklistDirective(rawArgs, char);
    }

    if (command === '微信转账') {
        if (parseWechatAmountNumber(args[0]) == null) return null;
        return syncWechatMessageDescription({
            ...base,
            type: 'transfer',
            amount: normalizeWechatAmount(args[0]),
            note: args.slice(1).join('|').trim()
        });
    }

    if (command === '微信红包') {
        const msg = {
            ...base,
            type: 'redpacket',
            title: args[0] || '恭喜发财，大吉大利',
            status: args[2] || '待领取'
        };
        if (parseWechatAmountNumber(args[1]) != null) msg.amount = normalizeWechatAmount(args[1]);
        return syncWechatMessageDescription(msg);
    }

    if (command === '微信礼物' || command === '微信送礼物') {
        const title = args[0] || '一份礼物';
        const price = parseWechatAmountNumber(args[1]);
        const image = args[2] || '';
        const note = args.slice(3).join('|').trim();
        return syncWechatMessageDescription({
            ...base,
            type: 'gift',
            status: '待收取',
            item: {
                name: title,
                price: price == null ? '' : price.toFixed(2),
                image,
                description: note
            },
            note
        });
    }

    if (command === '微信亲密付') {
        const limit = parseWechatAmountNumber(args[0]);
        const note = args.slice(1).join('|').trim();
        return syncWechatMessageDescription({
            ...base,
            type: 'intimatePay',
            status: '待开通',
            amount: limit == null ? '' : limit.toFixed(2),
            note: note || '邀请你开通亲密付'
        });
    }

    if (command === '微信拍一拍' || command === '拍一拍') {
        const content = args.join('|').trim() || '拍了拍你';
        return syncWechatMessageDescription({
            ...base,
            type: 'poke',
            content,
            note: content
        });
    }

    if (command === '微信震动' || command === '震动屏幕') {
        const content = args.join('|').trim() || '发来一次屏幕震动';
        return syncWechatMessageDescription({
            ...base,
            type: 'screen_shake',
            content,
            note: content
        });
    }

    if (command === '\u5fae\u4fe1\u97f3\u4e50' || command === '\u97f3\u4e50\u5361\u7247') {
        const title = args[0] || '\u4e00\u8d77\u542c\u6b4c';
        const artist = args[1] || '';
        const url = normalizeWechatUrl(args[2] || '');
        return syncWechatMessageDescription({
            ...base,
            type: 'music_card',
            music: {
                title,
                artist,
                url,
                audioUrl: url,
                playableUrl: url,
                sourceAudioUrl: url,
                pendingSearch: !url,
                invite: !base.isMe,
                inviteAccepted: !!base.isMe,
                coListening: false
            },
            musicInvite: !base.isMe,
            musicInviteAccepted: !!base.isMe,
            title,
            artist,
            url,
            audioUrl: url,
            playableUrl: url,
            sourceAudioUrl: url
        });
    }

    if (command === '微信链接' || command === '链接卡片') {
        const url = normalizeWechatUrl(args[0] || '');
        if (!url) return null;
        const title = args[1] || url.replace(/^https?:\/\//i, '').slice(0, 42);
        const note = args.slice(2).join('|').trim();
        return syncWechatMessageDescription({
            ...base,
            type: 'link_card',
            url,
            title,
            note
        });
    }

    if (command === '微信图片' || command === '微信照片') {
        const prompt = args[0] || '';
        const caption = args.slice(1).join('|').trim() || '照片';
        return buildWechatGeneratedImageMessage(prompt, caption, char);
    }

    if (command === '微信语音') {
        const firstArgIsDuration = args.length > 1 && isWechatDurationArg(args[0]);
        const transcript = firstArgIsDuration ? args.slice(1).join('|').trim() : args.join('|').trim();
        const explicitDuration = firstArgIsDuration ? normalizeWechatDuration(args[0], 0) : 0;
        const duration = explicitDuration > 0 ? explicitDuration : estimateWechatVoiceDuration(transcript);
        return syncWechatMessageDescription({
            ...base,
            type: 'voice',
            duration,
            transcript,
            content: transcript || `[语音 ${formatWechatDuration(duration)}]`
        });
    }

    if (command === '微信表情') {
        const query = args[0] || '';
        const sticker = findWechatStickerForAi(char, query, args.slice(1).join('|').trim());
        if (!sticker || !sticker.url) return null;
        const isEmoji = sticker.emoji || sticker.source === 'wechatEmoji' || sticker.source === 'qqEmoji' || isWechatBuiltinEmojiUrl(sticker.url);
        return {
            ...base,
            type: 'sticker',
            content: sticker.url,
            stickerName: sticker.name || query || '贴纸',
            stickerKind: isEmoji ? 'wechatEmoji' : 'sticker',
            emoji: !!isEmoji
        };
    }

    if (command === '微信语音电话' || command === '微信视频电话') {
        return syncWechatMessageDescription({
            ...base,
            type: command === '微信视频电话' ? 'videoCall' : 'voiceCall',
            status: '来电',
            reason: args.join('|').trim(),
            duration: 0
        });
    }

    return null;
}

