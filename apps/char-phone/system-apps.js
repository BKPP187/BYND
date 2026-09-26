function charPhoneSystemRecords(key, rows, icon) {
    return rows.map((row,index)=>`<details class="cp-system-record"><summary><i class="${icon}"></i><div><b>${wcEscapeHtml(row.title)}</b><small>${wcEscapeHtml(row.meta||row.time||'')}</small></div><i class="ri-arrow-right-s-line"></i></summary><p>${wcEscapeHtml(row.detail||row.content||'')}</p></details>`).join('');
}
function renderCharPhoneSystemApp(key,snapshot,char,isLoading) {
    const e=wcEscapeHtml, view=window._charPhoneNativeViews?.[key]||'home';
    const empty=label=>charPhoneBrandEmpty(snapshot,label);
    const avatar=`<img src="${wcEscapeAttr(getWechatAiPhoneHomeAvatar(char))}" alt="">`;
    let header='',body='',bottom='';
    if(key==='chat') {
        header=`<div class="cp-wc-header"><b>${view==='contacts'?'通讯录':view==='discover'?'发现':view==='profile'?'我':'微信'}</b><i class="ri-add-circle-line"></i></div><div class="cp-wc-search"><i class="ri-search-line"></i><input aria-label="搜索聊天" placeholder="搜索" oninput="filterCharPhoneSystemRows(this.value,'.wc-ai-phone-chat-row')"></div>`;
        body=view==='profile'?`<div class="cp-wc-profile">${avatar}<div><h2>${e(getWechatCharDisplayName(char))}</h2><p>${e(snapshot.userRemark||'')}</p></div><i class="ri-qr-code-line"></i></div><button class="cp-wc-feature" onclick="switchWechatAiPhoneTab('wallet')"><i class="ri-wallet-line"></i> 服务 <i class="ri-arrow-right-s-line"></i></button>`:view==='discover'?`<button class="cp-wc-feature" onclick="switchWechatAiPhoneTab('weibo')"><i class="ri-camera-line"></i> 朋友圈 <i class="ri-arrow-right-s-line"></i></button><button class="cp-wc-feature" onclick="switchWechatAiPhoneTab('douyin')"><i class="ri-video-line"></i> 视频号 <i class="ri-arrow-right-s-line"></i></button>`:renderWechatAiPhoneChatRows(snapshot,char);
        bottom=charPhoneNativeNav(key,[['home','微信','ri-wechat-line'],['contacts','通讯录','ri-contacts-line'],['discover','发现','ri-compass-3-line'],['profile','我','ri-user-line']],view);
    } else if(key==='memo') {
        const rows=getWechatAiPhoneMemoItems(snapshot);
        const index=Number(window._wechatAiPhoneMemoIndex);
        if(index>=0&&rows[index])return `<section class="cp-native cp-system-designed cp-system-memo"><div class="cp-scroll">${renderWechatAiPhoneMemoDetail(rows[index])}</div></section>`;
        header=`<div class="cp-notes-toolbar"><span>‹ 文件夹</span><i class="ri-more-line"></i></div><h2 class="cp-system-large-title">备忘录</h2><div class="cp-system-search"><i class="ri-search-line"></i><input aria-label="搜索备忘录" placeholder="搜索" oninput="filterCharPhoneSystemRows(this.value,'.cp-notes-entry')"></div>`;
        body=`<h3 class="cp-notes-date-heading">全部 iCloud</h3><div class="cp-notes-list">${rows.map((i,n)=>`<button class="cp-notes-entry" onclick="openWechatAiPhoneMemoItem(${n})"><b>${e(i.title)}</b><div><time>${e(i.meta)}</time><span>${e(i.detail)}</span></div></button>`).join('')||empty('暂无备忘录')}</div>`;
        bottom=`<div class="cp-notes-bottom"><i class="ri-folder-line"></i><small>${rows.length} 个备忘录</small><i class="ri-edit-box-line"></i></div>`;
    } else if(key==='schedule') {
        const now=new Date();const month=now.getMonth();const start=new Date(now.getFullYear(),month,1).getDay();const days=new Date(now.getFullYear(),month+1,0).getDate();
        const rows=getWechatAiPhoneScheduleRows(snapshot,char);
        header=`<div class="cp-calendar-toolbar"><span>‹ ${now.getFullYear()}</span><i class="ri-list-check"></i><i class="ri-search-line"></i><i class="ri-add-line"></i></div><h2 class="cp-system-large-title">${month+1}月</h2>`;
        body=`<div class="cp-calendar-weekdays">${Array.from('日一二三四五六').map(x=>`<span>${x}</span>`).join('')}</div><div class="cp-calendar-month">${Array.from({length:start},()=>'<span></span>').join('')}${Array.from({length:days},(_,n)=>`<span class="${n+1===now.getDate()?'today':''}">${n+1}</span>`).join('')}</div><div class="cp-calendar-agenda-heading">${e(now.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'}))}</div>${rows.map(i=>`<details class="cp-calendar-event"><summary><time>${e(i.time||i.meta)}</time><div><b>${e(i.title)}</b><small>${e(i.detail||i.meta)}</small></div></summary><p>${e(i.detail)}</p></details>`).join('')||empty('今天暂无日程')}`;
        bottom='<div class="cp-calendar-bottom"><span>今天</span><span>日历</span><span>收件箱</span></div>';
    } else if(key==='shopping'||key==='takeout') {
        const shopping=key==='shopping';const all=shopping?getWechatAiPhoneShoppingRows(snapshot,char):getWechatAiPhoneTakeoutRows(snapshot,char);
        const labels=shopping?['全部','待付款','待发货','待收货','待评价']:['全部','进行中','已完成'];
        const active=window._charPhoneSections?.[key]||0;
        const rows=active===0?all:all.filter(i=>[i.meta,i.detail,i.title].join(' ').includes(labels[active]));
        header=`<div class="cp-commerce-header"><strong>${shopping?'我的淘宝':'美团外卖'}</strong><i class="ri-customer-service-line"></i><i class="ri-settings-line"></i></div><div class="cp-commerce-profile">${avatar}<b>${e(getWechatCharDisplayName(char))}</b><i class="ri-arrow-right-s-line"></i></div><div class="cp-commerce-title">我的订单</div>${charPhoneNativeTabs(key,labels,active)}`;
        body=rows.map(i=>`<details class="cp-commerce-order"><summary><div class="cp-commerce-order-head"><span><i class="ri-store-2-line"></i> ${e(i.title)}</span><em>${e(i.meta)}</em></div><div class="cp-commerce-product"><div class="cp-commerce-placeholder"><i class="${shopping?'ri-shopping-bag-line':'ri-restaurant-line'}"></i></div><div><h3>${e(i.title)}</h3><p>${e(i.detail)}</p></div></div><div class="cp-commerce-order-foot"><span>订单详情</span><i class="ri-arrow-right-s-line"></i></div></summary><p>${e(i.detail)}</p><small>${e(i.meta)}</small></details>`).join('')||empty('暂无订单');
        bottom=shopping?charPhoneNativeNav(key,[['discover','首页','ri-home-5-line'],['video','逛逛','ri-video-line'],['messages','消息','ri-chat-3-line'],['orders','购物车','ri-shopping-cart-line'],['home','我的淘宝','ri-user-3-line']],view):charPhoneNativeNav(key,[['discover','首页','ri-home-5-line'],['saved','神券','ri-coupon-line'],['home','订单','ri-file-list-line'],['profile','我的','ri-user-line']],view);
    } else if(key==='games') {
        const rows=getWechatAiPhoneGameRows(snapshot,char);
        header=`<div class="cp-games-header"><h2>Games</h2>${avatar}</div>`;
        body=`<div class="cp-games-banner"><i class="ri-gamepad-line"></i><div><small>GAME CENTER</small><h2>${e(getWechatCharDisplayName(char))}</h2></div></div><h3 class="cp-games-heading">最近游玩</h3>${rows.map(i=>`<details class="cp-games-item"><summary><div><i class="ri-gamepad-fill"></i></div><span><b>${e(i.title)}</b><small>${e(i.meta)}</small></span><i class="ri-arrow-right-s-line"></i></summary><p>${e(i.detail)}</p></details>`).join('')||empty('暂无游戏记录')}`;
        bottom=charPhoneNativeNav(key,[['home','首页','ri-gamepad-line'],['library','资料库','ri-apps-line'],['profile','玩家','ri-user-line']],view);
    } else if(key==='browser') {
        const rows=getWechatAiPhoneBrowserRows(snapshot,char);const index=Number(window._wechatAiPhoneBrowserIndex);
        if(index>=0&&rows[index])return `<section class="cp-native cp-system-designed cp-system-browser"><div class="cp-scroll">${renderWechatAiPhoneBrowserDetail(rows[index])}</div></section>`;
        header='';
        body=`<h2 class="cp-safari-heading">Safari</h2><h3 class="cp-safari-section-heading">个人收藏</h3><div class="cp-safari-favorites">${rows.slice(0,4).map((i,n)=>`<button onclick="openWechatAiPhoneBrowserItem(${n})"><span>${e((i.title||'').slice(0,1))}</span><small>${e(i.title)}</small></button>`).join('')}</div><h3 class="cp-safari-section-heading">最近浏览</h3>${renderWechatAiPhoneBrowserListRows(rows)}`;
        bottom=`<div class="cp-safari-bottom"><div><i class="ri-font-size"></i><span><i class="ri-lock-line"></i> 搜索或输入网站名称</span><i class="ri-mic-line"></i></div><div><i class="ri-arrow-left-s-line"></i><i class="ri-arrow-right-s-line"></i><i class="ri-share-line"></i><i class="ri-book-open-line"></i><i class="ri-checkbox-multiple-blank-line"></i></div></div>`;
    } else if(key==='wallet') {
        const info=getWechatAiPhoneWalletPassInfo(snapshot,char),rows=getWechatAiPhoneWalletRows(snapshot,char);
        header=`<div class="cp-wallet-title"><h2>钱包</h2><i class="ri-add-circle-fill"></i></div>`;
        body=`<div class="cp-wallet-stack"><div></div><section><b>Card</b><small>${e(info.owner)}</small><strong>${e(info.amount)}</strong><span>${e(info.detail)}</span><i class="ri-bank-card-fill"></i></section></div><h3 class="cp-wallet-history-title">最新交易</h3>${charPhoneSystemRecords(key,rows,'ri-bank-card-line')||empty('暂无交易记录')}`;
    } else if(key==='diary') {
        header=`<div class="cp-journal-header"><h2>手记</h2><i class="ri-more-line"></i></div>`;
        body=renderWechatAiPhoneDiaryMailbox(snapshot,char,!!window._wechatAiPhoneDiaryGenerating?.has(char.id),isLoading);
    } else if(key==='footprints') {
        const rows=getWechatAiPhoneFootprintRows(snapshot,char);
        header=`<div class="cp-map-search"><i class="ri-map-pin-fill"></i><span>搜索地点、公交、地铁</span><i class="ri-mic-line"></i></div>`;
        body=`<div class="cp-map-canvas"><div class="cp-map-river"></div><div class="cp-map-road road-a"></div><div class="cp-map-road road-b"></div><div class="cp-map-road road-c"></div>${rows.slice(0,4).map((i,n)=>`<span class="cp-map-marker marker-${n}"><i class="ri-map-pin-fill"></i><b>${e(i.title)}</b></span>`).join('')}<small>足迹示意</small></div><div class="cp-map-sheet"><div class="cp-map-sheet-handle"></div><h3>我的足迹</h3>${charPhoneSystemRecords(key,rows,'ri-map-pin-line')||empty('暂无地点记录')}</div>`;
        bottom=charPhoneNativeNav(key,[['home','足迹','ri-map-pin-line'],['saved','收藏','ri-star-line'],['profile','我的','ri-user-line']],view);
    } else if(key==='usage') {
        const rows=getWechatAiPhoneUsageRows(snapshot,char);const minutes=rows.map(i=>Number(String(i.meta||'').match(/\d+/)?.[0]||0));const total=minutes.reduce((a,b)=>a+b,0),max=Math.max(...minutes,1);
        header='<h2 class="cp-system-large-title">屏幕使用时间</h2>';
        body=`<div class="cp-screen-time-summary"><div><b>App 与网站活动</b><i class="ri-bar-chart-box-fill"></i></div><small>已同步的使用时长</small><strong>${total?`${total} 分钟`:'—'}</strong><div class="cp-screen-time-chart">${minutes.map((n,index)=>`<span><i style="height:${Math.round(n/max*100)}%"></i><small>${e(rows[index].title.slice(0,4))}</small></span>`).join('')}</div></div><h3 class="cp-screen-time-heading">使用最多</h3><div class="cp-screen-time-list">${rows.map((i,n)=>`<div><b>${e(i.title)}</b><small>${e(i.meta)}</small><span><i style="width:${Math.round(minutes[n]/max*100)}%"></i></span></div>`).join('')||empty('暂无使用记录')}</div>`;
    } else if(key==='clock') {
        const titles={home:'闹钟',world:'世界时钟',stopwatch:'秒表',timer:'计时器'};
        header=`<div class="cp-clock-edit"><span>编辑</span><i class="ri-add-line"></i></div><h2 class="cp-system-large-title">${titles[view]||'闹钟'}</h2>`;
        if(view==='world')body=`<div class="cp-clock-world"><span>本地时间</span><strong>${e(getWechatAiPhoneClockParts().time)}</strong><small>${e(getWechatAiPhoneClockParts().date)}</small></div>`;
        else if(view==='stopwatch'||view==='timer')body=`<div class="cp-clock-instrument"><div id="cp-clock-readout">${view==='stopwatch'?'00:00.00':'00:05:00'}</div>${view==='timer'?'<label>时长（分钟）<input id="cp-clock-minutes" type="number" min="1" max="1440" value="5"></label>':''}<div><button onclick="resetCharPhoneClock()">重设</button><button class="start" onclick="toggleCharPhoneClock('${view}',this)">开始</button></div></div>`;
        else {const rows=getWechatAiPhoneAlarmRows(snapshot,char);body=`<div class="cp-clock-sleep"><i class="ri-hotel-bed-line"></i><strong>睡眠 | 起床</strong><span>日程提醒</span></div>${rows.map(i=>`<div class="cp-clock-alarm"><div><strong>${e(i.title)}</strong><small>${e(i.detail)}</small></div><span class="cp-clock-switch" aria-label="已开启"></span></div>`).join('')||empty('暂无闹钟')}`;}
        bottom=charPhoneNativeNav(key,[['world','世界时钟','ri-global-line'],['home','闹钟','ri-alarm-line'],['stopwatch','秒表','ri-timer-line'],['timer','计时器','ri-hourglass-line']],view);
    } else return null;
    return `<section class="cp-native cp-system-designed cp-system-${key}" data-app-layout="${key}">${header}<div class="cp-scroll">${body}</div>${bottom}</section>`;
}
function filterCharPhoneSystemRows(value,selector) {
    const query=String(value||'').trim().toLowerCase();
    document.querySelectorAll('#wc-ai-phone-overlay '+selector).forEach(row=>{row.hidden=!row.textContent.toLowerCase().includes(query);});
}
function resetCharPhoneClock() {
    if(window._charPhoneClockTick)clearTimeout(window._charPhoneClockTick);
    window._charPhoneClockState=null;
    const node=document.getElementById('cp-clock-readout');if(node)node.textContent=window._charPhoneNativeViews?.clock==='timer'?'00:05:00':'00:00.00';
    const start=document.querySelector('.cp-clock-instrument .start');if(start)start.textContent='开始';
}
function toggleCharPhoneClock(mode,button) {
    const old=window._charPhoneClockState;
    if(old?.running){old.elapsed+=Date.now()-old.started;old.running=false;button.textContent='继续';clearTimeout(window._charPhoneClockTick);return;}
    const duration=Math.min(1440,Math.max(1,Number(document.getElementById('cp-clock-minutes')?.value)||5))*60000;
    const state=old||{mode,elapsed:0,duration};state.running=true;state.started=Date.now();window._charPhoneClockState=state;button.textContent='暂停';
    const tick=()=>{const node=document.getElementById('cp-clock-readout');if(!node||!state.running){state.running=false;return;}const elapsed=state.elapsed+Date.now()-state.started;const ms=mode==='timer'?Math.max(0,state.duration-elapsed):elapsed;const sec=Math.floor(ms/1000);node.textContent=mode==='timer'?`${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor(sec/60)%60).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`:`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}.${String(Math.floor(ms%1000/10)).padStart(2,'0')}`;if(mode==='timer'&&ms===0){state.running=false;button.textContent='已结束';return;}window._charPhoneClockTick=setTimeout(tick,100);};tick();
}
