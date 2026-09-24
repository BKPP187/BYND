/* BYND decision layer: one set of per-turn decisions, answered by Jev when the user added a key, otherwise by the chat model itself. */
(function () {
    'use strict';

    const TURN_KEYS = ['status', 'memory', 'moment'];
    const TURN_LABELS = { status: '更新心声', memory: '写入记忆', moment: '发朋友圈', avatar: '心情头像' };
    const DECIDE_TAG = /<bynd_decide\b[^>]*>([\s\S]*?)<\/bynd_decide>/gi;
    const clip = (value, length) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, length);
    const displayName = char => (typeof getWechatCharDisplayName === 'function' ? getWechatCharDisplayName(char) : '') || char?.name || '角色';

    function usesJev(scope) {
        return !!window.ByndJev?.available(scope);
    }

    // The agent route costs no extra request: the chat reply carries its own hidden verdicts.
    function replyInstructions(char) {
        if (!char || char.isGroupChat || usesJev('turn')) return '';
        return '在全部正文之后另起一行，附上用户看不到的判断块：<bynd_decide>{"status":true或false,"memory":true或false,"moment":true或false}</bynd_decide>。'
            + 'status：这一轮之后你（角色）的心情、状态或没说出口的想法是否明显变化，值得更新心声；'
            + 'memory：这一轮是否出现值得长期记住的新事实（用户的经历、偏好、约定、关系变化）；'
            + 'moment：按你的人设和此刻情绪，是否有自然动机发一条自己的朋友圈。'
            + '按角色真实会怎么做来判断，不确定就填 false。判断块只能出现一次，不要解释。';
    }

    function extractReplyDecisions(raw) {
        let decisions = null;
        const content = String(raw || '').replace(DECIDE_TAG, (_, body) => {
            if (decisions) return '';
            try {
                const parsed = JSON.parse(String(body).trim().replace(/^```(?:json)?\s*|```$/g, ''));
                if (parsed && typeof parsed === 'object') {
                    decisions = {};
                    TURN_KEYS.forEach(key => { if (typeof parsed[key] === 'boolean') decisions[key] = parsed[key]; });
                }
            } catch (_) {}
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
            text: clip(msg.content || msg.description || `[${msg.type || 'message'}]`, 160)
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
            hoursSinceStatusUpdate: status?.updatedAt ? Math.round((Date.now() - status.updatedAt) / 360000) / 10 : null,
            hoursSinceLastMoment: lastMoment ? Math.round((Date.now() - lastMoment) / 360000) / 10 : null,
            localTime: new Date().toLocaleString('zh-CN', { hour12: false })
        };
    }

    function turnQuestions(char) {
        const questions = {
            status: { type: 'noul', instructions: "After this exchange, has the character's mood, inner state or unspoken thoughts changed noticeably enough to refresh their inner-voice status?" },
            memory: { type: 'noul', instructions: 'Did this exchange reveal a new fact worth remembering long term (the user\'s experiences, preferences, promises, or a change in the relationship)?' },
            moment: { type: 'noul', instructions: "Given the character's persona and current mood, would they naturally post an update to their own social feed right now?" }
        };
        const moods = moodOptions(char);
        if (moods.length) {
            questions.avatar = {
                type: 'choice',
                instructions: "Which avatar mood best matches how the character feels at the end of this exchange? Keep the current one unless the mood clearly shifted.",
                criteria: Object.fromEntries(moods.map(option => [option.label, option.current ? `Current avatar: ${option.label}` : `Avatar showing: ${option.label}`]))
            };
        }
        return { questions, moods };
    }

    // Returns { route, status, memory, moment, avatar } where each verdict is true/false or null (= keep BYND's default behaviour).
    async function afterReply(char, context = {}) {
        const empty = { route: 'none', status: null, memory: null, moment: null, avatar: null };
        if (!char || char.isGroupChat) return empty;
        if (usesJev('turn')) {
            const { questions, moods } = turnQuestions(char);
            const answers = await window.ByndJev.ask('turn', turnState(char), questions, { charName: displayName(char), labels: TURN_LABELS });
            if (answers) {
                const verdict = key => answers[key]?.confident ? answers[key].value : null;
                const avatarLabel = answers.avatar?.confident ? answers.avatar.value : null;
                const target = moods.find(option => option.label === avatarLabel && !option.current);
                return { route: 'jev', status: verdict('status'), memory: verdict('memory'), moment: verdict('moment'), avatar: target ? { index: target.index, label: target.label } : null };
            }
        }
        const decisions = context.replyDecisions;
        if (!decisions) return empty;
        TURN_KEYS.filter(key => typeof decisions[key] === 'boolean').forEach(key => {
            window.ByndJev?.logDecision?.({ scope: 'turn', route: 'agent', charName: displayName(char), key, label: TURN_LABELS[key], answer: decisions[key], probability: null, applied: true });
        });
        return { route: 'agent', status: decisions.status ?? null, memory: decisions.memory ?? null, moment: decisions.moment ?? null, avatar: null };
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
