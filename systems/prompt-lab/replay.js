/* Loaded in a separate VM/iframe, never in the live BYND global environment. */
(function (root) {
    'use strict';
    const E = root.ByndPromptEval;
    let fixture = null;
    let active = E.BASELINE;
    let preset = null;
    root.ByndPromptLab = {
        prompt: () => E.policyText(active),
        worldBook: char => E.select(char.worldBook, char, active.worldBookMode)
    };
    root.getWechatChatUserProfile = () => ({ name: '小余' });
    root.getUserProfile = root.getWechatChatUserProfile;
    root.getActivePreset = () => preset;
    root.setByndPromptReplayPreset = value => { preset = value ? E.clone(value) : null; };
    root.getWechatCharDisplayName = char => char.name;
    root.getWechatCharacterPersonaText = char => char.description || '';
    root.buildWechatWorldBookPrompt = char => E.select(char.worldBook, char, active.worldBookMode).map(item => item.content).join('\n');
    root.buildWechatMemoryPrompt = char => E.select(fixture.memories, char, active.memoryMode).map(item => item.content).join('\n');
    root.getLivingWorldRelevantEventsForChar = char => fixture.events.filter(item => E.visible(item, char.id)).map(item => item.content).join('\n');
    root.prepareByndPromptReplay = function (testCase, policy) {
        fixture = E.clone(testCase); active = E.candidate(policy);
        const char = { ...fixture.character, worldBook: fixture.worldBook || [], history: [...(fixture.history || []), { isMe: true, type: 'text', content: fixture.input, timestamp: 1790764800000 }], chatConfig: { ...fixture.character.chatConfig, timeMode: 'custom', customTime: '2026-09-30T20:00:00+08:00' } };
        const selection = {
            worldbook: E.select(char.worldBook, char, active.worldBookMode).map(item => item.id),
            memory: E.select(fixture.memories, char, active.memoryMode).map(item => item.id),
            events: fixture.events.filter(item => E.visible(item, char.id)).map(item => item.id)
        };
        return { messages: root.buildMessages(char, char.history, 30), selection,
            state: { ...root.ByndDecider.turnState(char), ...(fixture.proposedAction ? { proposedAction: fixture.proposedAction } : {}), evaluationPolicy: E.policyText(active, 'jev') }, questions: fixture.questions || root.ByndDecider.turnQuestions(char).questions };
    };
    if (root.parent && root.parent !== root) {
        root.addEventListener('message', event => {
            if (event.source !== root.parent || event.data?.byndPromptReplay !== 'request') return;
            const { id, command, payload } = event.data;
            try {
                let result;
                if (command === 'preset') { root.setByndPromptReplayPreset(payload); result = E.fingerprint([root.buildMessages.toString(), root.buildSystemPrompt.toString(), root.buildChatApiCoreIdentityAnchor.toString(), root.prepareByndPromptReplay.toString(), ...Object.values(E).filter(v => typeof v === 'function').map(fn => fn.toString()), E.CATEGORIES, E.CRITICAL]); }
                else if (command === 'prepare') result = root.prepareByndPromptReplay(payload.testCase, payload.policy);
                else throw new Error('Unknown replay command');
                root.parent.postMessage({ byndPromptReplay: 'response', id, result: E.clone(result) }, '*');
            } catch (error) { root.parent.postMessage({ byndPromptReplay: 'response', id, error: error.message }, '*'); }
        });
        root.parent.postMessage({ byndPromptReplay: 'ready' }, '*');
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
