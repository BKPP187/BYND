const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../apps/study/study-ocr.js'),'utf8');
function harness({rejectAction='',holdAction=''}={}) {
    const workers=[],revoked=[],packets=[];
    const assets={worker:'//worker','core-basic':'//core',tha:'AA==',chi_sim:'AA==',eng:'AA==',jpn:'AA=='};
    const context=vm.createContext({
        window:{ByndStudyOcrAssets:assets},Blob,atob,setTimeout,clearTimeout,Uint8Array,
        URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:url=>revoked.push(url)},
        WebAssembly:{validate:()=>false},
        document:{createElement:()=>({remove(){}}),head:{appendChild:script=>queueMicrotask(()=>script.onload())}},
        Worker:class {
            constructor(){this.terminated=false;workers.push(this);}
            terminate(){this.terminated=true;}
            postMessage(packet){
                packets.push(packet);
                if(packet.action===holdAction)return;
                queueMicrotask(()=>this.onmessage({data:{jobId:packet.jobId,status:packet.action===rejectAction?'reject':'resolve',data:packet.action===rejectAction?'invalid model':{text:'สวัสดี',blocks:[]}}}));
            }
        }
    });
    vm.runInContext(source,context);
    return {S:context.window.ByndStudyOcr,workers,revoked,packets};
}
test('OCR initializes a self-contained local worker with supplied models and releases it on close',async()=>{
    const h=harness();
    const session=await h.S.create({targetId:'th',nativeId:'cn'});
    const load=h.packets.find(packet=>packet.action==='loadLanguage');
    assert.deepEqual(Array.from(load.payload.langs,lang=>lang.code),['tha','chi_sim']);
    assert.equal(load.payload.options.cacheMethod,'none');
    assert.equal(load.payload.langs[0].data.length,1);
    session.close();session.close();
    assert.equal(h.workers[0].terminated,true);
    assert.equal(h.revoked.length,1);
});
test('cancellation interrupts the worker while model initialization is still pending',async()=>{
    const h=harness({holdAction:'loadLanguage'}),controller=new AbortController();
    const pending=h.S.create({targetId:'th',nativeId:'cn',signal:controller.signal});
    while(!h.packets.some(packet=>packet.action==='loadLanguage'))await new Promise(resolve=>setImmediate(resolve));
    controller.abort();
    await assert.rejects(pending,/取消/);
    assert.equal(h.workers[0].terminated,true);
});
test('model initialization failures propagate and terminate the worker',async()=>{
    const h=harness({rejectAction:'initialize'});
    await assert.rejects(h.S.create({targetId:'th',nativeId:'cn'}),/invalid model/);
    assert.equal(h.workers[0].terminated,true);
});
test('unsupported languages fail before starting an OCR worker',async()=>{
    const h=harness();
    await assert.rejects(h.S.create({targetId:'ko',nativeId:'cn'}),/支持中文、英文、日语和泰语/);
    assert.equal(h.workers.length,0);
});
test('Thai lines preserve combining marks instead of reordering individual glyph boxes',()=>{
    const h=harness();
    const items=h.S.itemsFromBlocks([{paragraphs:[{lines:[{text:'ไข้หวัดใหญ่',bbox:{x0:40,y0:20,x1:140,y1:45},confidence:90,words:[{text:'ไข้'},{text:'หวัดใหญ่'}]}]}]}],200);
    assert.equal(items.length,1);
    assert.equal(items[0].str,'ไข้หวัดใหญ่');
    assert.equal(items[0].transform[5],155);
});
test('offline OCR resources match their manifest and do not duplicate raw WASM or traineddata files',()=>{
    const {createHash}=require('node:crypto');
    const dir=path.resolve(__dirname,'../assets/vendor/study-ocr');
    const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
    for(const [name,hash] of Object.entries(manifest.hashes))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex'),hash,name);
    assert.equal(fs.readdirSync(dir).some(name=>/\.(?:wasm|traineddata)(?:\.gz)?$/.test(name)),false);
});
