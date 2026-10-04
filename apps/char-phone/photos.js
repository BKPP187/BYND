function getCharPhoneAlbumItems(char, snapshot = char?.chatConfig?.aiPhoneSnapshot) {
    const saved = Array.isArray(char?.chatConfig?.outingPhotos) ? char.chatConfig.outingPhotos : [];
    const generated = snapshot?.appData?.album?.items || [];
    return [...saved, ...generated.filter(item => !saved.some(photo => photo.outingEntryId && photo.outingEntryId === item.outingEntryId))];
}
function charPhonePhotoKey(item) { return JSON.stringify([item.title||'',item.body||'',item.meta||'']); }
function charPhonePhotoState(char,item) {
    const key=charPhonePhotoKey(item);
    return {key,url:char?.chatConfig?.aiPhonePhotos?.[key]?.url||item.image||'',pending:window._charPhonePhotoJobs?.has(char.id+'|'+key),error:window._charPhonePhotoErrors?.get(char.id+'|'+key)||''};
}
function renderCharPhonePhotoDetail(item,index,char) {
    const state=charPhonePhotoState(char,item),e=wcEscapeHtml;
    return `<section class="cp-native cp-album cp-item-detail"><button class="cp-back" onclick="closeCharPhoneItem()">‹ 照片</button><div class="cp-scroll"><h2>${e(item.title)}</h2>${state.url?`<img src="${wcEscapeAttr(state.url)}" alt="${wcEscapeAttr(item.title)}">`:'<div class="cp-photo-preview"><i class="ri-image-line"></i></div>'}<p class="cp-letter">${e(item.body||item.title)}</p>${item.outingEntryId ? '<p class="cp-photo-route">一起出门时珍藏的真实照片</p>' : `<button class="cp-photo-generate" onclick="generateCharPhonePhoto(${index})" ${state.pending?'disabled aria-busy="true"':''}><i class="ri-image-add-line"></i> ${state.pending?'正在生成…':state.url?'重新生成照片':'生成这张照片'}</button><p class="cp-photo-route">使用设置中的聊天图片生图服务</p>`}${state.error?`<p class="cp-photo-error" role="alert">${e(state.error)}</p>`:''}</div></section>`;
}
async function generateCharPhonePhoto(index) {
    const char=(window.myCharacters||[]).find(c=>c.id===window._wechatAiPhoneOpenCharId);
    const item=getCharPhoneAlbumItems(char)[index];
    if(!char || !item || item.outingEntryId)return false;
    const key=charPhonePhotoKey(item),jobKey=char.id+'|'+key;
    const jobs=window._charPhonePhotoJobs ||= new Map(),errors=window._charPhonePhotoErrors ||= new Map();
    if(jobs.has(jobKey))return jobs.get(jobKey);
    const render=()=>{if(window._wechatAiPhoneOpenCharId===char.id)renderWechatAiPhone(char);};
    errors.delete(jobKey);
    const work=Promise.resolve().then(async()=>{
        if(typeof callWechatImageGenerationApi!=='function')throw new Error('生图服务尚未加载，请刷新后重试。');
        const persona=typeof getWechatCharacterPersonaText==='function'?getWechatCharacterPersonaText(char,3600):String(char.description||'');
        const world=typeof buildWechatWorldBookPrompt==='function'?buildWechatWorldBookPrompt(char,12):'';
        const result=await callWechatImageGenerationApi(`生成角色自己手机相册中的一张图片。按画面描述选择照片、插画或截图形式，不要擅自改成自拍。\n角色资料：${persona}\n世界书：${world}\n标题：${item.title}\n画面描述：${item.body||item.title}`,{feature:'chat',usageChar:char,size:'1024x1024'});
        if(!result?.ok || !/^(?:https?:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(String(result.url||'')))throw new Error(result?.error||'生图服务没有返回有效图片。');
        char.chatConfig=char.chatConfig||{};
        const photos=char.chatConfig.aiPhonePhotos ||= {};
        const previous=photos[key],row={url:result.url,title:item.title,createdAt:Date.now()};
        photos[key]=row;
        try { if(await saveCharactersToStorage()===false)throw new Error('照片未能保存，请检查存储后重试。'); }
        catch(error){if(photos[key]===row){if(previous)photos[key]=previous;else delete photos[key];}throw error;}
        return true;
    }).catch(error=>{errors.set(jobKey,error.message||'照片生成失败，请重试。');return false;}).finally(()=>{jobs.delete(jobKey);render();});
    jobs.set(jobKey,work);render();return work;
}
