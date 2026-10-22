/* BYND decision layer: one set of per-turn decisions, answered by Jev when the user added a key, otherwise by the chat model itself. */
(function () {
    'use strict';

    const TURN_KEYS = ['status', 'memory', 'moment', 'npcFriend', 'channel', 'live'];
    const TURN_LABELS = { status: '更新心声', memory: '写入记忆', moment: '发朋友圈', avatar: '心情头像', npcFriend: '剧情好友申请', channel: '发布视频号作品', live: '角色开播' };
    const DECIDE_TAG = /<bynd_decide\b[^>]*>([\s\S]*?)<\/bynd_decide>/gi;
    const clip = (value, length) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, length);
    const displayName = char => (typeof getWechatCharDisplayName === 'function' ? getWechatCharDisplayName(char) : '') || char?.name || '角色';

    function usesJev(scope) {
        return !!window.ByndJev?.available(scope);
    }

    // When the reply was asked for a verdict block; lets afterReply tell "the model ignored it" from "never asked".
    const INSTRUCTED_WINDOW_MS = 10 * 60 * 1000;
    const instructedAt = new Map();
    const log = entry => window.ByndJev?.logDecision?.(entry);

    // The agent route costs no extra request: the chat reply carries its own hidden verdicts.
    // With Jev on, the block is still requested so any question Jev is unsure about has an answer.
    function replyInstructions(char) {
        if (!char || char.isGroupChat) return '';
        if (char.id != null) instructedAt.set(char.id, Date.now());
        const npc = window.ByndNpcFriends?.canConsider(char) === true;
        const discover = window.ByndDiscoverStory?.canPublish(char) === true;
        const moods = moodOptions(char);
        const currentMood = moods.find(option => option.current)?.label;
        return '在全部正文之后另起一行，附上用户看不到的判断块：<bynd_decide>{"status":true或false,"memory":true或false,"moment":true或false' + (npc ? ',"npcFriend":true或false' : '') + (discover ? ',"channel":true或false,"live":true或false' : '') + (moods.length ? ',"avatar":"心情标签"或null' : '') + '}</bynd_decide>。'
            + 'status：这一轮之后你（角色）的心情、状态或没说出口的想法是否明显变化，值得更新心声；'
            + 'memory：这一轮是否出现值得长期记住的新事实或共同经历（用户的经历、偏好、约定、关系变化，或主动查资料带来的重要事件）；普通一次性搜索结果不用记；'
            + 'moment：按你的人设和此刻情绪，是否有自然动机发一条自己的朋友圈。'
            + (npc ? 'npcFriend：当前聊天剧情中是否已经出现具体的第三方联系需求，合理需要你世界里的某位配角现在主动加用户微信（例如已约定由同事联系用户处理某件事）？仅提到一个人、普通闲聊、世界书里有人物都不足以触发；不能为了加人编造转交联系方式或新的剧情。没有明确上下文依据填 false，符合剧情才填 true；申请尚未真正生成前不要声称已加好友。' : '')
            + (discover ? 'channel：你或世界中的配角是否自然有动机发布与当前剧情有关、可公开的作品？live：你此刻是否真的适合开启一场用户可以参与的做饭、游戏、排练、访谈等直播？私密约定、敏感私聊和普通问候不要发布；不得为了功能编造公开动机。没有明确动机填 false，作品或直播真正创建前不要声称已发布或开播。' : '')
            + (moods.length ? `avatar：这一轮结束时你的心情最贴近哪个头像，只能从${moods.map(option => `「${option.label}」`).join('、')}中原样选一个；心情没有明显变化就填 null${currentMood ? `（当前是「${currentMood}」）` : ''}。` : '')
            + '按角色真实会怎么做来判断，不确定就填 false。判断块只能出现一次，不要解释。';
    }

    // A block that is present but unreadable comes back as an empty object flagged `invalid`
    // (not enumerable, so callers that spread or compare decisions are unaffected).
    function invalidDecisions() {
        return Object.defineProperty({}, 'invalid', { value: true, enumerable: false });
    }

    function extractReplyDecisions(raw) {
        let decisions = null;
        const content = String(raw || '').replace(DECIDE_TAG, (_, body) => {
            if (decisions) return '';
            try {
                const parsed = JSON.parse(String(body).trim().replace(/^```(?:json)?\s*|```$/g, ''));
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    decisions = {};
                    TURN_KEYS.forEach(key => { if (typeof parsed[key] === 'boolean') decisions[key] = parsed[key]; });
                    if (typeof parsed.avatar === 'string' && parsed.avatar.trim()) decisions.avatar = clip(parsed.avatar, 12);
                } else decisions = invalidDecisions();
            } catch (_) { decisions = invalidDecisions(); }
            return '';
        }).replace(/<bynd_decide\b[^>]*>[\s\S]*$/gi, '').replace(/<\/?bynd_decide\b[^>]*>/gi, '');
        return { content, decisions };
    }

    function moodOptions(char) {
        const gallery = Array.isArray(char?.avatarGallery) ? char.avatarGallery.filter(Boolean) : [];
        const moods = char?.avatarMoods && typeof char.avatarMoods === 'object' ? char.avatarMoods : {};
        const options = [];
        const seen = new Set();
        gallery.forEach((src, index) => {
            const label = clip(moods[src], 12);
            if (!label || seen.has(label)) return;
            seen.add(label);
            options.push({ label, index, current: src === char.avatar });
        });
        return options.length >= 2 ? options : [];
    }

    function turnState(char) {
        const history = Array.isArray(char.history) ? char.history : [];
        const recent = history.filter(msg => msg && msg.type !== 'system_notice').slice(-8).map(msg => ({
            from: msg.isMe ? 'user' : 'character',
            text: clip(msg.content || msg.description || `[${msg.type || 'message'}]`, 160),
            searchedSources: Array.isArray(msg.webSources) ? msg.webSources.length : 0
        }));
        const persona = typeof getWechatCharacterPersonaText === 'function' ? getWechatCharacterPersonaText(char, 700) : (char.description || char.personality || '');
        const world = typeof buildWechatWorldBookPrompt === 'function' ? buildWechatWorldBookPrompt(char) : '';
        const status = char.chatConfig?.aiStatusSnapshot;
        const lastMoment = typeof getWechatMomentStore === 'function'
            ? Math.max(0, ...getWechatMomentStore().posts.filter(post => post.charId === char.id).map(post => Number(post.createdAt || 0)))
            : 0;
        return {
            character: { name: displayName(char), persona: clip(persona, 700), world: clip(world, 500) },
            currentAvatarMood: clip(char.avatarMoods?.[char.avatar], 12) || null,
            recent,
            ...(window.ByndNpcFriends ? { npcFriend: window.ByndNpcFriends.decisionContext(char) } : {}),
            ...(window.ByndDiscoverStory ? { discovery: window.ByndDiscoverStory.decisionContext(char) } : {}),
            hoursSinceStatusUpdate: status?.updatedAt ? Math.round((Date.now() - status.updatedAt) / 360000) / 10 : null,
            hoursSinceLastMoment: lastMoment ? Math.round((Date.now() - lastMoment) / 360000) / 10 : null,
            localTime: new Date().toLocaleString('zh-CN', { hour12: false })
        };
    }

    function turnQuestions(char) {
        const questions = {
            status: { type: 'noul', instructions: "After this exchange, has the character's mood, inner state or unspoken thoughts changed noticeably enough to refresh their inner-voice status?" },
            memory: { type: 'noul', instructions: 'Did this exchange reveal a new fact or shared event worth remembering long term, including a meaningful search the character performed for the user? Do not store one-off search results.' },
            moment: { type: 'noul', instructions: "Given the character's persona and current mood, would they naturally post an update to their own social feed right now?" }
        };
        const moods = moodOptions(char);
        if (window.ByndDiscoverStory?.canPublish(char) === true) {
            questions.channel = { type: 'noul', instructions: 'Does the current storyline naturally motivate this character or a supporting NPC to publish a public work now? Require an in-character activity or event. Do not expose private user information or invent a public motive. Default to no.' };
            questions.live = { type: 'noul', instructions: 'Would this character naturally start an interactive cooking, gaming, rehearsal, interview or other in-character live stream now? Require a concrete current motive and no already active room. Never broadcast private conversations. Default to no.' };
        }
        if (window.ByndNpcFriends?.canConsider(char) === true) {
            questions.npcFriend = { type: 'noul', instructions: 'Does this specific chat storyline already give a concrete, in-character reason for a supporting NPC from the character world to send the user a WeChat friend request now? Require an established need for third-party contact and a plausible way to obtain the user contact. Mere mentions, casual conversation or world-book existence are insufficient. Do not invent contact sharing or plot to justify a request. Default to no.' };
        }
        if (moods.length) {
            questions.avatar = {
                type: 'choice',
                instructions: "Which avatar mood best matches how the character feels at the end of this exchange? Keep the current one unless the mood clearly shifted.",
                criteria: Object.fromEntries(moods.map(option => [option.label, option.current ? `Current avatar: ${option.label}` : `Avatar showing: ${option.label}`]))
            };
        }
        return { questions, moods };
    }

    // Returns { route, status, memory, moment, avatar, ... } where each verdict is true/false or null (= keep BYND's default behaviour).
    async function afterReply(char, context = {}) {
        const empty = { route: 'none', status: null, memory: null, moment: null, avatar: null, npcFriend: null, channel: null, live: null };
        if (!char || char.isGroupChat) return empty;
        const name = displayName(char);
        const askedAt = char.id != null ? instructedAt.get(char.id) : undefined;
        if (char.id != null) instructedAt.delete(char.id);
        const instructed = askedAt !== undefined && Date.now() - askedAt < INSTRUCTED_WINDOW_MS;
        const received = context.replyDecisions || null;
        const reply = received && !received.invalid ? received : null;
        const npcAllowed = window.ByndNpcFriends?.canConsider(char) === true;
        const discoverAllowed = window.ByndDiscoverStory?.canPublish(char) === true;
        const moods = moodOptions(char);
        const replyAvatar = () => {
            const target = typeof reply?.avatar === 'string' ? moods.find(option => option.label === reply.avatar && !option.current) : null;
            return target ? { index: target.index, label: target.label } : null;
        };

        if (usesJev('turn')) {
            const { questions, moods: jevMoods } = turnQuestions(char);
            const answers = await window.ByndJev.ask('turn', turnState(char), questions, { charName: name, labels: TURN_LABELS, timeoutMs: 5000 });
            if (answers) {
                // Jev decides first; where it is unsure, the reply's own verdict (if any) fills in.
                const verdict = key => {
                    if (!questions[key]) return null;
                    if (answers[key]?.confident) return answers[key].value;
                    if (typeof reply?.[key] !== 'boolean') return null;
                    log({ scope: 'turn', route: 'agent', charName: name, key, label: `${TURN_LABELS[key]}（Jev 不确定，用回复判断）`, answer: reply[key], probability: null, applied: true });
                    return reply[key];
                };
                const avatarLabel = answers.avatar?.confident ? answers.avatar.value : null;
                const jevTarget = jevMoods.find(option => option.label === avatarLabel && !option.current);
                let avatar = jevTarget ? { index: jevTarget.index, label: jevTarget.label } : null;
                if (!avatar && !answers.avatar?.confident && (avatar = replyAvatar())) {
                    log({ scope: 'turn', route: 'agent', charName: name, key: 'avatar', label: `${TURN_LABELS.avatar}（Jev 不确定，用回复判断）`, answer: avatar.label, probability: null, applied: true });
                }
                return { route: 'jev', status: verdict('status'), memory: verdict('memory'), moment: verdict('moment'), avatar, npcFriend: verdict('npcFriend'), channel: verdict('channel'), live: verdict('live') };
            }
        }

        if (!reply) {
            // Make a silent fallback visible in the decision log instead of looking like "nothing happened".
            if (received?.invalid) log({ scope: 'turn', route: 'agent-missing', charName: name, key: 'invalid', label: '判断块格式有误，本轮按默认处理', answer: null, probability: null, applied: false });
            else if (instructed) log({ scope: 'turn', route: 'agent-missing', charName: name, key: 'missing', label: '模型没有附上判断，本轮按默认处理', answer: null, probability: null, applied: false });
            return empty;
        }
        TURN_KEYS.filter(key => typeof reply[key] === 'boolean').forEach(key => {
            log({ scope: 'turn', route: 'agent', charName: name, key, label: TURN_LABELS[key], answer: reply[key], probability: null, applied: true });
        });
        const avatar = replyAvatar();
        if (avatar) log({ scope: 'turn', route: 'agent', charName: name, key: 'avatar', label: TURN_LABELS.avatar, answer: avatar.label, probability: null, applied: true });
        return { route: 'agent', status: reply.status ?? null, memory: reply.memory ?? null, moment: reply.moment ?? null, avatar, npcFriend: npcAllowed ? reply.npcFriend ?? null : null, channel: discoverAllowed ? reply.channel ?? null : null, live: discoverAllowed ? reply.live ?? null : null };
    }

    // Out-of-character guard for character tools. Jev judges it when available; otherwise the chat model already chose the action in character.
    async function gate(char, action, context = {}) {
        if (!char || !usesJev('toolGate')) return { allow: true, route: 'agent', probability: null };
        const state = { ...turnState(char), proposedAction: clip(action, 300), details: context.details ? clip(JSON.stringify(context.details), 800) : undefined };
        const answers = await window.ByndJev.ask('toolGate', state, {
            inCharacter: { type: 'noul', instructions: "Would this character, given their persona, world and current situation, naturally take the proposed action right now without breaking character?" }
        }, { charName: displayName(char), labels: { inCharacter: clip(action, 40) } });
        const verdict = answers?.inCharacter;
        if (!verdict?.confident) return { allow: true, route: answers ? 'jev' : 'agent', probability: verdict?.probability ?? null };
        return { allow: verdict.value === true, route: 'jev', probability: verdict.probability };
    }

    window.ByndDecider = { replyInstructions, extractReplyDecisions, afterReply, gate, moodOptions, turnState, turnQuestions };
})();
