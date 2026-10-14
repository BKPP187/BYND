const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const {test} = require('node:test');
const source = fs.readFileSync('apps/music/waveform.js','utf8');
function setup(fetcher = async () => {throw new Error('CORS');}) {
    const nodes=[{},{}].map(() => ({innerHTML:'',dataset:{},title:'',style:{setProperty(){}},classList:{toggle(){}},setAttribute(){},querySelectorAll:()=>[]}));
    const context=vm.createContext({window:{},document:{querySelectorAll:()=>nodes},AbortController,setTimeout,clearTimeout,fetch:fetcher,
        requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
    vm.runInContext(source,context); return {api:context.window.ByndMusicWaveform,nodes,context};
}
test('waveform bins follow actual decoded amplitude, including silence',()=>{
    const {api}=setup(), samples=Float32Array.from([0,0,.1,-.1,.4,-.4,1,-1]);
    const peaks=Array.from(api.peaksFromBuffer({numberOfChannels:1,getChannelData:()=>samples},4));
    assert.equal(peaks[0],0); assert.ok(peaks[1]<peaks[2]&&peaks[2]<peaks[3]); assert.equal(peaks[3],1);
    assert.ok(Array.from(api.peaksFromBuffer({numberOfChannels:1,getChannelData:()=>new Float32Array(8)},4)).every(p=>p===0));
});
test('failed waveform fetch shows an unavailable state and does not produce fake random peaks',async()=>{
    const {api,nodes}=setup(); await api.setTrack({audioUrl:'https://example.test/audio.mp3'});
    for(const node of nodes) {assert.equal(node.dataset.waveformState,'unavailable'); assert.equal((node.innerHTML.match(/--bar-h:2px/g)||[]).length,112);}
});
test('a switched-away decode failure cannot overwrite the current track waveform',async()=>{
    let rejectOld;
    const {api,nodes}=setup(url=>url.endsWith('old')?new Promise((_,reject)=>{rejectOld=reject;}):Promise.reject(new Error('unavailable')));
    const old=api.setTrack({audioUrl:'https://example.test/old'}); await api.setTrack({audioUrl:'https://example.test/new'});
    rejectOld(new Error('aborted')); await old;
    assert.ok(nodes.every(node=>node.dataset.waveformState==='unavailable'));
});
test('different songs at the same stream endpoint decode their own audio and reuse only their own cached peaks',async()=>{
    let calls=0;
    const {api,nodes,context}=setup(async()=>({ok:true,headers:{get:()=>null},arrayBuffer:async()=>new Uint8Array([++calls]).buffer}));
    context.window.OfflineAudioContext=class {
        async decodeAudioData(bytes) {
            const first=new Uint8Array(bytes)[0]===1;
            const samples=Float32Array.from({length:112*8},(_,i)=>(first?(i<448?.8:.1):(i<448?.1:.8))*(i%2?1:-1));
            return {numberOfChannels:1,getChannelData:()=>samples};
        }
    };
    const a={id:'song-a',audioUrl:'https://example.test/stream'},b={id:'song-b',audioUrl:'https://example.test/stream'};
    await api.setTrack(a);const waveA=nodes[0].innerHTML;
    await api.setTrack(b);const waveB=nodes[0].innerHTML;
    assert.notEqual(waveA,waveB);assert.equal(calls,2);
    await api.setTrack(a);assert.equal(nodes[0].innerHTML,waveA);assert.equal(calls,2);
    assert.equal(api.markup(b),waveB.replaceAll('music-wave-bar','mn-wave-bar'));
});
