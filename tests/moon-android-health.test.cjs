const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {memoryStorage} = require('./helpers/harness.cjs');
function setup({native=true, available=true}={}) {
    const posts=[], storage=memoryStorage();
    const window={ location:{protocol:native?'file:':'https:', pathname:native?'/android_asset/www/index.html':'/index.html'}, ByndAndroid:{healthAvailable:()=>available, requestHealth:payload=>posts.push(JSON.parse(payload))}, crypto:require('node:crypto').webcrypto };
    const context={window, localStorage:storage, document:{addEventListener(){}}, Date, Math, setTimeout:(...args)=>{const timer=setTimeout(...args);timer.unref();return timer;}, clearTimeout};
    for(const file of ['systems/life-state/life-state.js','systems/life-state/native-health.js','apps/moon/moon.js']) vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
    const bridge=window.ByndNativeHealth;
    const reply=(data,ok=true,index=posts.length-1)=>bridge.onReply({id:posts[index].id,ok,data,error:'权限拒绝'});
    return {window,bridge,posts,storage,reply};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('Android bridge is confined to the packaged page and supports cycle permission only',async()=>{
    const {bridge,posts}=setup();
    assert.equal(bridge.available(),true); assert.equal(bridge.provider(),'Health Connect');
    assert.deepEqual(Array.from(bridge.supportedTypes()),['cycle']);
    await assert.rejects(bridge.connect(['steps']),/不支持/); assert.equal(posts.length,0);
    await assert.rejects(setup({native:false}).bridge.connect(['cycle']),/原生/);
    await assert.rejects(setup({available:false}).bridge.connect(['cycle']),/Android 14/);
});
test('Android authorization then a cycle read imports samples without granting characters or creating actual period records',async()=>{
    const {window,bridge,posts,reply}=setup();
    const operation=bridge.connect(['cycle']);
    assert.deepEqual(posts[0].types,['cycle']); assert.equal(posts[0].action,'authorize');
    reply({}); await flush(); assert.equal(posts[1].action,'read');
    reply({version:1,records:[],flowDays:['2026-09-28','2026-09-29']});
    assert.equal((await operation).flowDays,2);
    assert.deepEqual(Array.from(window.ByndMoon.read().nativeDays),['2026-09-28','2026-09-29']);
    assert.equal(window.ByndMoon.read().records.length,0);
    assert.equal(Object.keys(window.ByndMoon.read().grants).length,0);
});
test('Android denied, malformed, failed and disconnected reads cannot claim success or restore old samples',async()=>{
    const {window,bridge,reply}=setup();
    const denied=bridge.connect(['cycle']); reply(null,false); await assert.rejects(denied,/权限拒绝/);
    assert.equal(bridge.read().connected,false);
    const connected=bridge.connect(['cycle']); reply({}); await flush(); reply({version:1,records:[],flowDays:['2026-09-28']}); await connected;
    const malformed=bridge.sync(); reply({version:1,records:[{values:{steps:1}}],flowDays:[]}); await assert.rejects(malformed,/未选择/);
    assert.equal(window.ByndMoon.read().nativeDays.length,0);
    const failed=bridge.sync(); reply(null,false); await assert.rejects(failed,/权限拒绝/);
    const pending=bridge.sync(); bridge.disconnect(); reply({version:1,records:[],flowDays:['2026-09-28']}); await assert.rejects(pending,/取消/);
    assert.equal(window.ByndMoon.read().nativeDays.length,0); assert.equal(bridge.read().connected,false);
});
test('reauthorization denial clears previous native samples and concurrent authorizations are refused',async()=>{
    const {window,bridge,posts,reply}=setup();
    const first=bridge.connect(['cycle']);
    await assert.rejects(bridge.connect(['cycle']),/正在读取/);
    assert.equal(posts.length,1);
    reply({}); await flush(); reply({version:1,records:[],flowDays:['2026-09-28']}); await first;
    assert.equal(window.ByndMoon.read().nativeDays.length,1);
    const denied=bridge.connect(['cycle']);
    assert.equal(window.ByndMoon.read().nativeDays.length,0);
    reply(null,false); await assert.rejects(denied,/权限拒绝/);
    assert.equal(bridge.read().connected,false);
});
