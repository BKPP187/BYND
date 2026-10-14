'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.BYND_PLAYWRIGHT||'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=path.resolve(__dirname,'../.qa-screenshots/heartmail-waveform');fs.mkdirSync(output,{recursive:true});
function audioFixture(reverse=false) {
    const rate=8000,length=rate*8,bytes=Buffer.alloc(44+length*2);
    bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);
    bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(length*2,40);
    // An actual WAV with alternating quiet passages and short transients. A
    // steadily increasing sine amplitude is useful for math, but not visual QA.
    for(let i=0;i<length;i++) {
        const t=reverse?1-i/length:i/length;
        const burst=(center,width,strength)=>strength*Math.exp(-Math.pow((t-center)/width,2));
        const envelope=.045+burst(.12,.055,.55)+burst(.31,.035,.38)+burst(.51,.045,.28)+burst(.64,.015,.92)+burst(.78,.08,.3)+burst(.9,.025,.24);
        const accents=.25+.75*Math.pow(Math.abs(Math.sin(t*173)*Math.cos(t*83)),.7);
        bytes.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*240/rate)*Math.min(.98,envelope*accents)*30000),44+i*2);
    }
    return 'data:audio/wav;base64,'+bytes.toString('base64');
}
(async()=>{
    const browser=await chromium.launch({channel:'msedge',headless:true});
    try {
        const page=await browser.newPage({viewport:{width:375,height:844},isMobile:true,hasTouch:true});const errors=[];
        page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',route=>route.request().url().includes('cdn.jsdelivr.net/npm/remixicon')?route.continue():route.abort());
        await page.addInitScript(version=>{
            localStorage.setItem('bynd_lastSeenVersion',version);localStorage.setItem('bynd_builtin_library_seen_v1','1');
            localStorage.setItem('my_characters_data',JSON.stringify([{id:'quiet',name:'沉静的林',description:'克制的书店主人',worldBook:[{name:'地点',content:'月光书店',enabled:true}],history:[],chatConfig:{}},{id:'pilot',name:'星际旅人',description:'直爽的领航员',worldBook:[{name:'地点',content:'远航号飞船',enabled:true}],history:[],chatConfig:{}}]));
        },require('./bump-version.cjs').currentVersion());
        await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>window.__byndCoreReady&&window.ByndMusicWaveform);
        await page.evaluate(async()=>{await __byndCoreReady;unlockPhone();ByndBuiltinLibrary?.close();openApp('events');window.qaRequests=[];
            window.qaFailApi=false;callChatApi=async(messages,options)=>{const context=JSON.parse(messages[1].content);qaRequests.push({context,charId:options.usageChar.id});if(qaFailApi)return {ok:false,error:'测试网络失败'};
                const type=context.selectedCarrier;return {ok:true,content:JSON.stringify({version:1,action:'act',events:[{type,charId:options.usageChar.id,title:'远航号的'+type,body:'领航员写给你的原创内容。',...(type==='bottle'?{words:['星图上的归途','航船抵达时见你']}:type==='doodle'?{strokes:[{color:'#333333',points:[[20,20],[120,150],[200,50]]}]}:{})}]})};};
        });
        for(const type of ['letter','newspaper','bottle','doodle']) {
            await page.evaluate(type=>ByndEventInbox.request(type),type);
            await page.locator('#event-request-character').selectOption('pilot');
            await page.locator('.event-request-form button[type="submit"]').click();
            await page.waitForFunction(type=>document.getElementById('event-viewer').dataset.type===type,type);
            assert.equal(await page.evaluate(()=>qaRequests.at(-1).charId),'pilot');
            assert.match(await page.evaluate(()=>qaRequests.at(-1).context.world),/远航号/);
            assert.match(await page.evaluate(()=>qaRequests.at(-1).context.character.persona),/领航员/);
            assert.equal(await page.evaluate(()=>ByndCharacterEvents.read().events.at(-1).delivery),'delivered');
            await page.evaluate(()=>ByndEventInbox.closeViewer());
        }
        await page.evaluate(()=>{qaFailApi=true;ByndEventInbox.request('letter');});
        await page.locator('.event-request-form button[type="submit"]').click();
        await page.waitForFunction(()=>document.getElementById('event-viewer-error').textContent.includes('生成失败'));
        assert.equal(await page.evaluate(()=>ByndCharacterEvents.read().events.length),4);
        assert.equal(await page.locator('.event-request-form button[type="submit"]').isEnabled(),true);
        await page.evaluate(()=>{ByndEventInbox.closeViewer();document.getElementById('event-arrival').hidden=true;ByndEventInbox.request('bottle');});
        await page.screenshot({path:path.join(output,'role-picker.png')});
        await page.evaluate(()=>{ByndEventInbox.closeViewer();closeApp('events');const data={...getBuiltinThemeLibraryItem('builtin-cream-plush').themeData};localStorage.setItem('my_theme_data',JSON.stringify(data));localStorage.setItem('desktop_layout_v2',JSON.stringify(buildPlushDesktopLayout()));});
        await page.reload({waitUntil:'domcontentloaded'});await page.evaluate(async()=>{await __byndCoreReady;unlockPhone();});await page.waitForTimeout(400);
        page.once('dialog',d=>d.accept('等你回家 ♡'));await page.locator('[data-plush-bubble="left"]').click();
        page.once('dialog',d=>d.accept('今天也爱你'));await page.locator('[data-plush-bubble="right"]').click();
        assert.equal(await page.locator('[data-plush-bubble="left"]').textContent(),'等你回家 ♡');
        const before=await page.evaluate(()=>localStorage.getItem('my_theme_data'));
        await page.evaluate(()=>{window.qaStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='my_theme_data')throw new Error('测试存储已满');return qaStorageSet.call(this,k,v);};});
        const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.accept(d.type()==='prompt'?'不应保存':undefined);});
        await page.locator('[data-plush-bubble="left"]').click();
        assert.equal(await page.evaluate(()=>localStorage.getItem('my_theme_data')),before);assert.ok(dialogs.some(s=>s.includes('保存失败')));
        page.removeAllListeners('dialog');await page.evaluate(()=>{Storage.prototype.setItem=qaStorageSet;});
        await page.reload({waitUntil:'domcontentloaded'});await page.evaluate(async()=>{await __byndCoreReady;unlockPhone();});await page.waitForTimeout(350);
        assert.equal(await page.locator('[data-plush-bubble="right"]').textContent(),'今天也爱你');
        await page.screenshot({path:path.join(output,'editable-bubbles.png')});
        await page.evaluate(audio=>{openApp('music');musicTracks=[{id:'qa-wave',trackName:'播放波形',artistName:'本地测试音源',audioUrl:audio,duration:8,artworkUrl100:'assets/themes/cream-plush/toy-14.webp'}];musicCurrentIndex=0;setupMusicAudio();musicAudio.muted=true;musicAudio.src=audio;musicAudio.load();renderMusicNowPlaying();},audioFixture());
        await page.waitForFunction(()=>document.querySelector('.music-wave').dataset.waveformState==='ready'&&musicAudio.duration===8);
        await page.waitForTimeout(450);
        assert.equal(await page.locator('.music-wave span').count(),112);
        const heights=await page.locator('.music-wave span').evaluateAll(bars=>bars.map(b=>b.style.getPropertyValue('--bar-h')));assert.ok(new Set(heights).size>20);
        await page.evaluate(()=>{musicAudio.currentTime=2;updateMusicProgress();});
        assert.equal(await page.locator('.music-wave span.active').count(),28);
        const wave=page.locator('.music-wave'),box=await wave.boundingBox();
        await page.screenshot({path:path.join(output,'wave-before-seek.png')});
        await page.mouse.click(box.x+box.width*.75,box.y+box.height/2);
        const afterSeek=await page.evaluate(({x,y})=>({time:musicAudio.currentTime,hit:document.elementFromPoint(x,y)?.outerHTML?.slice(0,300)}),{x:box.x+box.width*.75,y:box.y+box.height/2});
        assert.ok(Math.abs(afterSeek.time-6)<.1,JSON.stringify({box,afterSeek}));
        await wave.focus();await page.keyboard.press('ArrowLeft');assert.ok(Math.abs(await page.evaluate(()=>musicAudio.currentTime)-1)<.1);
        await page.evaluate(async()=>{await musicAudio.play();});await page.waitForTimeout(450);await page.evaluate(()=>musicAudio.pause());
        assert.ok(await page.evaluate(()=>musicAudio.currentTime>1.2));assert.equal(await wave.evaluate(n=>n.classList.contains('is-playing')),false);
        await wave.evaluate(n=>n.blur());
        for(const width of [320,375])for(const safe of [47,59])for(const owner of ['parent','header']){
            await page.setViewportSize({width,height:844});await page.evaluate(({safe,owner})=>{document.body.style.paddingTop=owner==='parent'?safe+'px':'0';const p=document.querySelector('.phone-container');p.style.setProperty('--bynd-header-safe-top',owner==='header'?safe+'px':'0px');p.style.height=owner==='parent'?`calc(100dvh - ${safe}px)`:'100dvh';}, {safe,owner});
            const geometry=await wave.evaluate(n=>({wave:n.getBoundingClientRect().toJSON(),parent:n.parentElement.getBoundingClientRect().toJSON(),header:document.querySelector('.music-header button').getBoundingClientRect().toJSON()}));
            assert.ok(geometry.wave.width>=geometry.parent.width*.8);assert.ok(geometry.wave.right<=width);assert.ok(geometry.header.top>=safe);
            await page.screenshot({path:path.join(output,`wave-${width}-${safe}-${owner}.png`)});
            if(width===375&&safe===59&&owner==='header') await wave.screenshot({path:path.join(output,'wave-detail-375.png')});
        }
        await page.evaluate(()=>{musicAudio.currentTime=4;document.getElementById('music-netease-view').classList.remove('hidden');switchNeteaseSection('player');renderNeteasePlayerProgress();});
        assert.equal(await page.locator('#mn-player-progress .mn-wave-bar').count(),112);
        assert.equal(await page.locator('#mn-player-progress .active').count(),56);
        const fullWave=page.locator('#mn-player-progress');await fullWave.scrollIntoViewIfNeeded();
        const fullBox=await fullWave.boundingBox();await page.mouse.click(fullBox.x+fullBox.width*.25,fullBox.y+fullBox.height/2);
        assert.ok(Math.abs(await page.evaluate(()=>musicAudio.currentTime)-2)<.1);
        await fullWave.focus();await page.keyboard.press('End');assert.equal(await page.locator('#mn-player-progress .active').count(),112);
        await page.evaluate(()=>closeNeteaseView());
        await page.evaluate(audio=>{musicTracks.push({id:'qa-wave-second',trackName:'第二首音频',artistName:'本地测试音源',audioUrl:audio,duration:8,artworkUrl100:'assets/themes/cream-plush/toy-14.webp'});selectMusicTrack(1,false);},audioFixture(true));
        await page.waitForFunction(()=>document.querySelector('.music-wave').dataset.waveformState==='ready'&&musicCurrentIndex===1);
        const secondHeights=await page.locator('.music-wave span').evaluateAll(bars=>bars.map(b=>b.style.getPropertyValue('--bar-h')));
        assert.notDeepEqual(secondHeights,heights,'a different audio file must render its own waveform');
        await wave.screenshot({path:path.join(output,'wave-track-b.png')});
        await page.evaluate(()=>selectMusicTrack(0,false));
        assert.deepEqual(await page.locator('.music-wave span').evaluateAll(bars=>bars.map(b=>b.style.getPropertyValue('--bar-h'))),heights,'switching back restores only the matching song peaks');
        await wave.screenshot({path:path.join(output,'wave-track-a.png')});
        await page.evaluate(async()=>{musicTracks[0].audioUrl='https://example.test/no-cors.mp3';await ByndMusicWaveform.setTrack(musicTracks[0]);});
        assert.equal(await wave.getAttribute('data-waveform-state'),'unavailable');
        assert.deepEqual(errors,[]);console.log('Role-specific API generation, four carriers and failures, editable bubbles and failed persistence, decoded full-width waveform, playback/seek/pause and 47/59px safe areas passed.');
    }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
