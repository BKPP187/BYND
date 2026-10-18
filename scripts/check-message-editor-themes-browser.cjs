'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.BYND_PLAYWRIGHT || 'C:/Users/l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname,'..');
const output = path.join(root,'.qa-screenshots/message-editor-themes');
fs.mkdirSync(output,{recursive:true});
const metrics = el => { const s=getComputedStyle(el),r=el.getBoundingClientRect();return {background:s.backgroundColor,image:s.backgroundImage,color:s.color,radius:s.borderRadius,font:s.fontFamily,border:s.borderColor,shadow:s.boxShadow,top:r.top,bottom:r.bottom,left:r.left,right:r.right}; };
(async()=>{
    const browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:375,height:844}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**/*',route=>route.abort());
    try {
        await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>typeof openWechatMessageEditor==='function' && typeof selectWechatUiTheme==='function');
        await page.evaluate(async()=>{
            await window.__byndCoreReady;await byndStylesReady;unlockPhone();document.documentElement.classList.add('mobile-runtime');
            window.myCharacters=[{id:'editor-proof',name:'上官落',avatar:DEFAULT_AVATAR,chatConfig:{},history:[
                {type:'text',content:'角色原消息',isMe:false,timestamp:Date.now()-1000},
                {type:'text',content:'用户原消息',isMe:true,timestamp:Date.now()}
            ]}];
            openApp('wechat');openChat('editor-proof');ByndBuiltinLibrary?.close();
        });
        const themes=await page.evaluate(()=>WECHAT_UI_THEMES.map(t=>t.id));
        const results=[];
        for(const theme of themes) {
            await page.evaluate(theme=>{selectWechatUiTheme(theme);openWechatMessageEditor(0);document.getElementById('wc-toast')?.classList.remove('show');},theme);
            await page.waitForTimeout(300);
            const card=await page.locator('#wc-text-edit-modal .wc-compose-card').evaluate(metrics);
            const expected=await page.evaluate(()=>{
                const host=document.querySelector('.phone-container'),s=getComputedStyle(host),root=getComputedStyle(document.getElementById('app-wechat-window'));
                const color=token=>{const p=document.createElement('span');p.style.color=s.getPropertyValue(token);host.append(p);const value=getComputedStyle(p).color;p.remove();return value;};
                return {radius:s.getPropertyValue('--wci-radius').trim(),controlRadius:s.getPropertyValue('--wci-control-radius').trim(),surface:color('--wci-surface'),accent:color('--wci-accent'),text:color('--wci-text'),font:root.fontFamily};
            });
            assert.equal(card.radius,expected.radius,`${theme}: editor frame must follow current theme`);
            assert.equal(card.background,expected.surface,`${theme}: editor surface must follow current theme`);
            const primary=await page.locator('#wc-text-edit-modal .wc-compose-primary').evaluate(metrics);
            const field=await page.locator('#wc-edit-content').evaluate(metrics);
            const pill=await page.locator('#wc-edit-target-pill').evaluate(metrics);
            assert.equal(primary.background,expected.accent,`${theme}: primary action follows accent`);
            assert.equal(primary.image,'none',`${theme}: no fixed blue gradient`);
            assert.equal(field.radius,expected.controlRadius);
            assert.equal(field.font,expected.font);
            assert.equal(field.border,expected.accent,`${theme}: focus ring follows accent`);
            assert.equal(pill.color,expected.accent,`${theme}: sender notice follows accent`);
            assert.ok(card.left>=0 && card.right<=375 && card.top>=0 && card.bottom<=844);
            await page.locator('#wc-edit-content').fill(`${theme} 的编辑草稿`);
            await page.screenshot({path:path.join(output,`${theme}-375.png`),animations:'disabled'});
            await page.evaluate(()=>{
                window._editorProofSave=saveCharactersToStorage;
                saveCharactersToStorage=async()=>false;
            });
            await page.locator('#wc-text-edit-modal .wc-compose-primary').click();
            await page.waitForFunction(()=>document.querySelector('#wc-text-edit-modal [role="alert"]')?.textContent.includes('保存失败'));
            assert.equal(await page.locator('#wc-text-edit-modal').isVisible(),true);
            assert.equal(await page.locator('#wc-edit-content').inputValue(),`${theme} 的编辑草稿`);
            assert.equal(await page.evaluate(()=>myCharacters[0].history[0].content),'角色原消息');
            await page.screenshot({path:path.join(output,`${theme}-failure-375.png`),animations:'disabled'});
            await page.evaluate(()=>{saveCharactersToStorage=async()=>true;});
            await page.locator('#wc-text-edit-modal .wc-compose-primary').click();
            await page.waitForFunction(()=>document.getElementById('wc-text-edit-modal').classList.contains('hidden'));
            assert.equal(await page.evaluate(()=>myCharacters[0].history[0].content),`${theme} 的编辑草稿`);
            assert.equal(await page.evaluate(()=>myCharacters[0].history[0].isMe),false);
            await page.evaluate(()=>{saveCharactersToStorage=window._editorProofSave;delete window._editorProofSave;myCharacters[0].history[0].content='角色原消息';});
            results.push({theme,card,primary,field});
        }
        // Wait for persistence before closing; duplicate saves cannot queue another write.
        await page.evaluate(()=>{
            openWechatMessageEditor(1);window._editorProofSave=saveCharactersToStorage;window._editorProofCalls=0;
            saveCharactersToStorage=()=>{window._editorProofCalls++;return new Promise(resolve=>{window._editorProofResolve=resolve;});};
        });
        await page.locator('#wc-edit-content').fill('待保存的草稿');
        await page.locator('#wc-text-edit-modal .wc-compose-primary').click();
        assert.equal(await page.locator('#wc-edit-content').evaluate(el=>el.readOnly),true);
        assert.equal(await page.locator('#wc-text-edit-modal .wc-compose-primary').isDisabled(),true);
        await page.evaluate(()=>{void submitWechatMessageEditor();closeWechatMessageEditor();});
        assert.equal(await page.evaluate(()=>window._editorProofCalls),1);
        assert.equal(await page.locator('#wc-text-edit-modal').isVisible(),true);
        await page.evaluate(()=>window._editorProofResolve(false));
        await page.waitForFunction(()=>document.querySelector('#wc-text-edit-modal [role="alert"]')?.textContent.includes('保存失败'));
        assert.equal(await page.locator('#wc-edit-content').inputValue(),'待保存的草稿');
        assert.equal(await page.evaluate(()=>myCharacters[0].history[1].content),'用户原消息');
        await page.evaluate(()=>{saveCharactersToStorage=window._editorProofSave;delete window._editorProofSave;delete window._editorProofResolve;delete window._editorProofCalls;});
        await page.locator('.wc-text-edit-close').click();
        // Existing overlays change theme without replacing the editor or its draft.
        await page.evaluate(()=>{selectWechatUiTheme('pixel');openWechatMessageEditor(1);});
        await page.locator('#wc-edit-content').fill('主题切换保留这份草稿');
        const handle=await page.locator('#wc-text-edit-modal').elementHandle();
        for(const theme of themes) {
            await page.evaluate(theme=>selectWechatUiTheme(theme),theme);
            assert.equal(await handle.evaluate(el=>el===document.getElementById('wc-text-edit-modal')),true);
            assert.equal(await page.locator('#wc-edit-content').inputValue(),'主题切换保留这份草稿');
        }
        await page.locator('#wc-text-edit-modal .wc-compose-secondary').click();
        assert.equal(await page.evaluate(()=>myCharacters[0].history[1].content),'用户原消息');
        await page.addStyleTag({content:fs.readFileSync(path.join(root,'ui/theme/foundation-layout.css'),'utf8').replaceAll('env(safe-area-inset-top','var(--proof-safe-top')});
        for(const mode of ['parent','header']) for(const safe of [47,59]) for(const width of [320,375]) {
            await page.setViewportSize({width,height:640});
            for(const theme of themes) {
                await page.evaluate(({mode,safe,theme})=>{
                    document.documentElement.classList.toggle('bynd-display-fullscreen',mode==='header');
                    document.documentElement.style.setProperty('--proof-safe-top',`${safe}px`);
                    selectWechatUiTheme(theme);openWechatMessageEditor(1);
                    document.getElementById('wc-toast')?.classList.remove('show');
                },{mode,safe,theme});
                await page.waitForTimeout(40);
                const card=await page.locator('#wc-text-edit-modal .wc-compose-card').evaluate(metrics);
                const save=await page.locator('#wc-text-edit-modal .wc-compose-primary').evaluate(metrics);
                assert.ok(card.top>=safe && card.bottom<=640 && card.left>=0 && card.right<=width,JSON.stringify({mode,safe,width,theme,card}));
                assert.ok(save.bottom<=card.bottom && save.top>=card.top,'footer remains inside the editor');
                if(width===320 && safe===59) await page.screenshot({path:path.join(output,`${theme}-${mode}-safe59-320.png`),animations:'disabled'});
                await page.evaluate(()=>closeWechatMessageEditor());
            }
        }
        assert.deepEqual(errors,[]);
        fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
        console.log(`Message editor: ${themes.length} themes, success/failure, live draft switching, 320/375px and 47/59px safe areas passed.`);
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
