const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../apps/wechat/chat/call-audio.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(blocked = false) {
    const state = { oscillators: [], timers: new Set(), listeners: {}, blocked };
    class AudioContext {
        constructor() { this.state = 'suspended'; this.currentTime = 0; state.context = this; }
        async resume() { if (state.blocked) throw new Error('gesture required'); this.state = 'running'; }
        createOscillator() { const osc = { frequency: {}, connect() {}, disconnect() {}, start() { osc.started = true; }, stop(time) { if (time === undefined) osc.stopped = true; } }; state.oscillators.push(osc); return osc; }
        createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {}, disconnect() {} }; }
    }
    const window = { AudioContext };
    const context = vm.createContext({ window, document: { addEventListener: (type, listener) => state.listeners[type] = listener },
        setInterval: callback => { state.timers.add(callback); return callback; }, clearInterval: id => state.timers.delete(id) });
    vm.runInContext(source, context);
    const call = { ended: false, acceptedAt: null }; window._wechatIncomingCall = call;
    return { state, window, call, ring: window.ByndWechatCallRingtone };
}
test('incoming ringtone is local, repeats and stops all scheduled tones immediately on answer/rejection', async () => {
    const h = harness(); h.state.listeners.pointerdown(); await tick(); h.ring.start(h.call); await tick();
    assert.equal(h.ring.isAudible(h.call), true); assert.equal(h.state.oscillators.length, 4);
    h.state.context.currentTime = 2.4; [...h.state.timers][0](); assert.equal(h.state.oscillators.length, 8);
    h.ring.stop(h.call); assert.equal(h.ring.isRinging(h.call), false); assert.equal(h.state.timers.size, 0);
    assert.ok(h.state.oscillators.every(osc => osc.stopped));
    h.ring.start(h.call); h.call.acceptedAt = 1; [...h.state.timers][0](); assert.equal(h.state.timers.size, 0);
});
test('blocked mobile autoplay retries on user gesture; late resume after stop never rings', async () => {
    const h = harness(true); h.ring.start(h.call); await tick();
    assert.equal(h.ring.isAudible(h.call), false); assert.equal(h.ring.isRinging(h.call), true);
    h.state.blocked = false; h.state.listeners.keydown(); await tick(); assert.equal(h.ring.isAudible(h.call), true);
    const next = { ended: false, acceptedAt: null }; h.window._wechatIncomingCall = next; h.ring.start(next);
    h.ring.stop(h.call); assert.equal(h.ring.isRinging(next), true, 'stale call cleanup must not stop a replacement call');
    h.ring.stop(next); h.state.context.state = 'suspended'; h.ring.start(next); h.ring.stop(next);
    const count = h.state.oscillators.length; await tick(); assert.equal(h.state.oscillators.length, count);
    assert.equal(h.state.timers.size, 0);
});
