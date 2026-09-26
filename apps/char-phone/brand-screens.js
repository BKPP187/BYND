/* Independent app chrome based on the mobile app screenshots, with persona data. */
function setCharPhoneBrandView(key, view) {
    window._charPhoneBrandViews = {...window._charPhoneBrandViews, [key]:view};
    closeCharPhoneItem();
}
function charPhoneBrandEmpty(snapshot, label) {
    return `<div class="cp-brand-empty"><strong>${wcEscapeHtml(label)}</strong><p>${snapshot.syncError ? '同步未完成，请返回桌面重试。' : '角色同步后，这里会显示对应内容。'}</p></div>`;
}
function charPhoneBrandNav(key, current, entries) {
    return `<nav class="cp-brand-nav" aria-label="${key==='x'?'X':'支付宝'}导航">${entries.map(([view,label,icon])=>`<button type="button" aria-label="${label}" aria-pressed="${view===current}" class="${view===current?'active':''}" onclick="setCharPhoneBrandView('${key}','${view}')"><i class="${icon}" aria-hidden="true"></i>${key==='alipay'?`<span>${label}</span>`:''}</button>`).join('')}</nav>`;
}
function renderCharPhoneX(snapshot, char) {
    const e=wcEscapeHtml, data=snapshot.appData?.x||{}, items=data.items||[];
    const view=window._charPhoneBrandViews?.x||'home';
    const following=window._charPhoneSections?.x===1;
    const name=getWechatCharDisplayName(char);
    const avatar=`<img class="cp-x-avatar" src="${wcEscapeAttr(getWechatCharAvatarSource(char,DEFAULT_AVATAR))}" alt="${wcEscapeAttr(getWechatCharDisplayName(char))}">`;
    const rows=view==='messages'?items.filter(i=>i.section===2):view==='profile'?items.filter(i=>i.author===getWechatCharDisplayName(char)||i.author===data.name):view==='home'&&following?items.filter(i=>i.section===1):items.filter(i=>i.section!==2);
    const posts=rows.map(i=>`<button class="cp-x-post" type="button" data-search="${wcEscapeAttr([i.author,i.title,i.body].join(' ').toLowerCase())}" onclick="openCharPhoneItem('x',${items.indexOf(i)})">
        <span class="cp-x-post-avatar">${e((i.author||name).slice(0,1))}</span><div class="cp-x-post-content">
        <div class="cp-x-byline"><b>${e(i.author||name)}</b>${i.verified==='true'?'<i class="ri-verified-badge-fill"></i>':''}<span>${e(i.handle||'')}</span><span>· ${e(i.time||'')}</span><i class="ri-more-line"></i></div>
        <p>${e(i.title)}${i.body?'\n'+e(i.body):''}</p>${i.image?`<img class="cp-x-media" src="${wcEscapeAttr(i.image)}" alt="${wcEscapeAttr(i.title)}" loading="lazy" referrerpolicy="no-referrer">`:''}
        <div class="cp-x-actions"><span><i class="ri-chat-1-line"></i>${e(i.replies||'')}</span><span><i class="ri-repeat-line"></i>${e(i.reposts||'')}</span><span><i class="ri-heart-line"></i>${e(i.likes||'')}</span><span><i class="ri-bar-chart-line"></i>${e(i.views||'')}</span><span><i class="ri-bookmark-line"></i></span><span><i class="ri-upload-2-line"></i></span></div>
        ${i.meta||i.status?`<small class="cp-x-post-meta">${e(i.meta||i.status)}</small>`:''}</div></button>`).join('');
    let content=posts||charPhoneBrandEmpty(snapshot,view==='messages'?'暂无私信':view==='profile'?'暂无个人帖子':'你的时间线');
    if(view==='notifications') content=items.filter(i=>i.meta||i.status).map(i=>`<button type="button" class="cp-x-notification" onclick="openCharPhoneItem('x',${items.indexOf(i)})"><i class="ri-heart-fill"></i><div><b>${e(i.author||name)}</b><p>${e(i.meta||i.status)}</p><small>${e(i.title)}</small></div></button>`).join('')||charPhoneBrandEmpty(snapshot,'暂无通知');
    if(view==='grok') content=`<div class="cp-x-grok"><i class="ri-sparkling-line"></i><h2>Grok</h2><p>${e(data.summary||'暂无角色的内容摘要')}</p></div>`;
    if(view==='draft') content=`<div class="cp-x-draft">${avatar}<textarea aria-label="X 草稿" placeholder="有什么新鲜事？" oninput="window._charPhoneXDrafts={...window._charPhoneXDrafts,[window._wechatAiPhoneOpenCharId]:this.value}">${e(window._charPhoneXDrafts?.[char.id]||'')}</textarea><small>草稿</small></div>`;
    const titles={search:'搜索',notifications:'通知',messages:'私信',profile:name,draft:'草稿'};
    return `<section class="cp-native cp-x cp-brand-screen">
        <div class="cp-x-top"><button type="button" class="cp-x-profile" aria-label="个人资料" onclick="setCharPhoneBrandView('x','profile')">${avatar}</button><i class="ri-twitter-x-line cp-x-logo" aria-label="X"></i><button type="button" aria-label="内容摘要" onclick="setCharPhoneBrandView('x','grok')"><i class="ri-sparkling-line"></i></button></div>
        ${view==='home'?`<div class="cp-x-timeline-tabs" role="group" aria-label="时间线"><button class="${following?'':'active'}" aria-pressed="${!following}" onclick="setCharPhoneSection('x',0)">为你推荐</button><button class="${following?'active':''}" aria-pressed="${following}" onclick="setCharPhoneSection('x',1)">正在关注</button></div>`:view==='search'?'<div class="cp-x-search"><i class="ri-search-line"></i><input aria-label="搜索帖子" placeholder="搜索 X" oninput="filterCharPhoneXPosts(this.value)"></div>':titles[view]?`<h2 class="cp-x-view-title">${e(titles[view])}</h2>`:''}
        <div class="cp-scroll">${view==='profile'?`<div class="cp-x-cover"></div><div class="cp-x-bio">${avatar}<h2>${e(name)}</h2><p>${e(data.summary||'')}</p></div>`:''}${content}<div class="cp-x-search-empty" hidden>没有找到相关帖子</div></div>
        ${view==='home'?'<button class="cp-x-compose" aria-label="写草稿" onclick="setCharPhoneBrandView(\'x\',\'draft\')"><i class="ri-quill-pen-line"></i><b>+</b></button>':''}
        ${charPhoneBrandNav('x',view,[['home','首页','ri-home-5-line'],['search','搜索','ri-search-line'],['grok','Grok','ri-sparkling-line'],['notifications','通知','ri-notification-3-line'],['messages','私信','ri-mail-line']])}
    </section>`;
}
function filterCharPhoneXPosts(value) {
    const query=String(value||'').trim().toLowerCase();
    const posts=document.querySelectorAll('#wc-ai-phone-overlay .cp-x-post');
    let visible=0;
    posts.forEach(post=>{post.hidden=!post.dataset.search.includes(query);if(!post.hidden)visible++;});
    const empty=document.querySelector('#wc-ai-phone-overlay .cp-x-search-empty');
    if(empty)empty.hidden=!posts.length||visible>0;
}
function renderCharPhoneAlipay(snapshot, char) {
    const e=wcEscapeHtml, data=snapshot.appData?.alipay||{}, items=data.items||[];
    const view=window._charPhoneBrandViews?.alipay||'home';
    const action=(label,icon,target,tone='blue')=>`<button type="button" class="cp-pay-service ${tone}" onclick="setCharPhoneBrandView('alipay','${target}')"><i class="${icon}"></i><span>${label}</span></button>`;
    const records=(rows,label)=>rows.map(i=>`<button type="button" class="cp-pay-record" onclick="openCharPhoneItem('alipay',${items.indexOf(i)})"><span class="cp-pay-record-icon"><i class="ri-bill-line"></i></span><div><b>${e(i.title)}</b><small>${e(i.time||i.meta||i.body)}</small></div><aside><strong>${e(i.amount)}</strong><small>${e(i.status)}</small></aside></button>`).join('')||charPhoneBrandEmpty(snapshot,label);
    const billCard=`<section class="cp-pay-card"><div class="cp-pay-card-heading"><b>最近账单</b><button type="button" onclick="setCharPhoneBrandView('alipay','bills')">全部 <i class="ri-arrow-right-s-line"></i></button></div>${records(items.slice(0,3),'暂无收支记录')}</section>`;
    let content='';
    if(view==='home') content=`<div class="cp-pay-services">${[['转账','ri-exchange-dollar-line','transfer'],['余额宝','ri-funds-box-line','wealth'],['生活缴费','ri-lightbulb-line','utilities','orange'],['信用卡还款','ri-bank-card-line','repay'],['蚂蚁森林','ri-tree-line','forest','green'],['出行','ri-bus-line','travel'],['市民中心','ri-government-line','citizen'],['更多','ri-apps-2-line','more']].map(a=>action(...a)).join('')}</div><section class="cp-pay-card cp-pay-shortcuts"><button onclick="setCharPhoneBrandView('alipay','bills')"><i class="ri-bill-line"></i><span>账单</span><i class="ri-arrow-right-s-line"></i></button><button onclick="setCharPhoneBrandView('alipay','my')"><i class="ri-bank-card-line"></i><span>银行卡</span><i class="ri-arrow-right-s-line"></i></button></section>${data.summary?`<section class="cp-pay-card cp-pay-summary"><b>生活动态</b><p>${e(data.summary)}</p></section>`:''}${billCard}`;
    else if(view==='wealth') content=`<section class="cp-pay-card cp-pay-assets"><small>总资产（元）</small><strong>${e(data.balance||'—')}</strong><div><span>余额宝</span><span>银行卡</span><span>资金记录</span></div></section>${records(items.filter(i=>i.section!==2),'暂无资产明细')}`;
    else if(view==='my') content=`<div class="cp-pay-profile"><img src="${wcEscapeAttr(getWechatCharAvatarSource(char,DEFAULT_AVATAR))}" alt=""><div><h2>${e(getWechatCharDisplayName(char))}</h2><span>${e(data.name||'支付宝账户')}</span></div><i class="ri-arrow-right-s-line"></i></div><section class="cp-pay-card cp-pay-assets"><small>账户余额（元）</small><strong>${e(data.balance||'—')}</strong></section><section class="cp-pay-card">${[['账单','ri-bill-line','bills'],['总资产','ri-wallet-3-line','wealth'],['银行卡','ri-bank-card-line','cards']].map(a=>`<button class="cp-pay-menu" onclick="setCharPhoneBrandView('alipay','${a[2]}')"><i class="${a[1]}"></i><span>${a[0]}</span><i class="ri-arrow-right-s-line"></i></button>`).join('')}</section>`;
    else if(view==='messages') content=records(items.filter(i=>i.section===1),'暂无消息');
    else if(view==='life') content=records(items.filter(i=>i.section===2),'暂无生活服务记录');
    else if(view==='bills') content=`<div class="cp-pay-bill-filter"><span>全部账单</span><i class="ri-arrow-down-s-line"></i></div><section class="cp-pay-card">${records(items,'暂无账单')}</section>`;
    else {
        const terms={scan:'扫码',pay:'收款|付款|支付',travel:'出行|机票|车|交通',cards:'银行卡|卡包',transfer:'转账',utilities:'缴费|电费|水费',repay:'还款|信用卡',forest:'森林|能量',citizen:'市民|政务',more:'.'};
        const matches=items.filter(i=>new RegExp(terms[view]||'$^').test([i.title,i.body,i.meta].join(' ')));
        content=`<section class="cp-pay-card">${records(matches,'暂无对应记录')}</section>`;
    }
    const titles={wealth:'财富',life:'生活',messages:'消息',my:'我的',bills:'账单',scan:'扫一扫',pay:'收付款',travel:'出行',cards:'卡包',transfer:'转账',utilities:'生活缴费',repay:'信用卡还款',forest:'蚂蚁森林',citizen:'市民中心',more:'全部服务'};
    return `<section class="cp-native cp-alipay cp-brand-screen">
        ${view==='home'?`<div class="cp-pay-blue"><div class="cp-pay-search"><span>支付宝</span><button type="button" onclick="setCharPhoneBrandView('alipay','more')"><i class="ri-search-line"></i> 搜索服务</button><button aria-label="全部服务" onclick="setCharPhoneBrandView('alipay','more')"><i class="ri-add-line"></i></button></div><div class="cp-pay-primary">${[['扫一扫','ri-scan-line','scan'],['收付款','ri-qr-code-line','pay'],['出行','ri-bus-line','travel'],['卡包','ri-bank-card-line','cards']].map(a=>action(...a)).join('')}</div></div>`:`<div class="cp-pay-page-title"><button aria-label="返回支付宝首页" onclick="setCharPhoneBrandView('alipay','home')"><i class="ri-arrow-left-s-line"></i></button><strong>${titles[view]||'支付宝'}</strong><i class="ri-more-line"></i></div>`}
        <div class="cp-scroll">${content}</div>${charPhoneBrandNav('alipay',view,[['home','首页','ri-alipay-fill'],['wealth','财富','ri-bar-chart-box-line'],['life','生活','ri-compass-3-line'],['messages','消息','ri-chat-3-line'],['my','我的','ri-user-3-line']])}
    </section>`;
}
