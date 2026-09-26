function setCharPhoneNativeView(key, view) {
    if(key==='clock')resetCharPhoneClock();
    window._charPhoneNativeViews={...window._charPhoneNativeViews,[key]:view};
    closeCharPhoneItem();
}
function charPhoneNativeTabs(key, entries, current=0) {
    return `<div class="cp-native-tabs" role="group" aria-label="分类">${entries.map((label,n)=>`<button type="button" class="${current===n?'active':''}" aria-pressed="${current===n}" onclick="setCharPhoneSection('${key}',${n})">${wcEscapeHtml(label)}</button>`).join('')}</div>`;
}
function charPhoneNativeNav(key, entries, current='home') {
    return `<nav class="cp-native-nav" aria-label="App 导航">${entries.map(([view,label,icon])=>`<button type="button" aria-label="${label}" aria-pressed="${current===view}" class="${current===view?'active':''}" onclick="setCharPhoneNativeView('${key}','${view}')"><i class="${icon}"></i><span>${label}</span></button>`).join('')}</nav>`;
}
function charPhoneNativeMedia(item, key, shape='') {
    return item.image?`<img class="cp-native-media ${shape}" src="${wcEscapeAttr(item.image)}" alt="${wcEscapeAttr(item.title)}" loading="lazy" referrerpolicy="no-referrer">`:`<div class="cp-native-media cp-media-description ${shape}"><i class="${key==='music'?'ri-disc-line':'ri-image-line'}"></i><span>${wcEscapeHtml(item.body||item.title)}</span></div>`;
}
function charPhoneNativeHeader(title, icon='', end='') {
    return `<div class="cp-native-header"><strong>${wcEscapeHtml(title)}</strong>${icon?`<i class="${icon}"></i>`:''}${end}</div>`;
}
function renderCharPhoneNativeApp(key,snapshot,char) {
    const app=CHAR_PHONE_EXTRA_APPS.find(a=>a.key===key);
    if(!app||['x','alipay'].includes(key))return null;
    const e=wcEscapeHtml, data=snapshot.appData?.[key]||{}, items=data.items||[];
    const view=window._charPhoneNativeViews?.[key]||'home';
    const active=window._charPhoneSections?.[key]||0;
    const rows=key==='mail'?items.filter(i=>(i.section||0)===active):active===0?items:items.filter(i=>i.section===active);
    const itemButton=(i,body,cls='')=>`<button type="button" aria-label="${wcEscapeAttr(i.title)}" class="${cls}" onclick="openCharPhoneItem('${key}',${items.indexOf(i)})">${body}</button>`;
    const empty=label=>charPhoneBrandEmpty(snapshot,label);
    const initials=i=>`<span class="cp-native-avatar">${e((i.author||getWechatCharDisplayName(char)).slice(0,1))}</span>`;
    const profile=`<div class="cp-native-profile"><img src="${wcEscapeAttr(getWechatCharAvatarSource(char,DEFAULT_AVATAR))}" alt=""><h2>${e(getWechatCharDisplayName(char))}</h2><p>${e(data.summary||'')}</p></div>`;
    const list=(entries,cls='')=>entries.map(i=>itemButton(i,`<b>${e(i.title)}</b><p>${e(i.body)}</p><small>${e(i.time||i.meta)}</small><strong>${e(i.amount||i.status)}</strong>`,cls||'cp-native-record')).join('')||empty('暂无记录');
    let header='',body='',bottom='',extras='';
    if(key==='instagram') {
        header=`<div class="cp-ig-header"><strong>Instagram</strong><button aria-label="收藏" onclick="setCharPhoneSection('instagram',2)"><i class="ri-heart-line"></i></button><button aria-label="角色资料" onclick="setCharPhoneNativeView('instagram','profile')"><i class="ri-messenger-line"></i></button></div>`;
        const grid=view==='search'||view==='profile';
        const stories=`<div class="cp-ig-stories">${items.slice(0,6).map(i=>itemButton(i,`${initials(i)}<small>${e(i.author||i.title)}</small>`)).join('')}</div>`;
        body=`${view==='profile'?profile:stories}<div class="${grid?'cp-ig-grid':'cp-ig-feed'}">${rows.map(i=>itemButton(i,`${grid?'':`<div class="cp-ig-author">${initials(i)}<b>${e(i.author||data.name||getWechatCharDisplayName(char))}</b><i class="ri-more-line"></i></div>`}${charPhoneNativeMedia(i,key)}${grid?'':`<div class="cp-ig-actions"><i class="ri-heart-line"></i><i class="ri-chat-1-line"></i><i class="ri-send-plane-line"></i><i class="ri-bookmark-line"></i></div><div class="cp-ig-caption"><b>${e(i.likes||'')}</b><p><strong>${e(i.author||'')}</strong> ${e(i.title)}</p><small>${e(i.time||i.meta)}</small></div>`}`,'cp-ig-post')).join('')||empty('你的动态')}</div>`;
        bottom=charPhoneNativeNav(key,[['home','首页','ri-home-5-line'],['search','探索','ri-search-line'],['reels','Reels','ri-video-line'],['saved','收藏','ri-bookmark-line'],['profile','我','ri-user-3-line']],view);
    } else if(key==='red') {
        header=`<div class="cp-red-header"><i class="ri-menu-line"></i>${charPhoneNativeTabs(key,['发现','关注','附近'],active)}<i class="ri-search-line"></i></div><div class="cp-red-categories"><b>推荐</b><span>视频</span><span>穿搭</span><span>美食</span><span>旅行</span></div>`;
        body=`${view==='profile'?profile:''}<div class="cp-red-waterfall">${rows.map(i=>itemButton(i,`${charPhoneNativeMedia(i,key)}<h3>${e(i.title)}</h3><div>${initials(i)}<span>${e(i.author||'')}</span><small>♡ ${e(i.likes||'')}</small></div>`,'cp-red-note')).join('')||empty('还没有笔记')}</div>`;
        bottom=charPhoneNativeNav(key,[['home','首页','ri-home-5-line'],['shop','购物','ri-shopping-bag-line'],['notes','笔记','ri-add-box-fill'],['messages','消息','ri-chat-3-line'],['profile','我','ri-user-line']],view);
    } else if(key==='weibo') {
        header=`<div class="cp-weibo-search"><i class="ri-weibo-fill"></i><span><i class="ri-search-line"></i> 搜索微博</span><i class="ri-add-circle-line"></i></div>${charPhoneNativeTabs(key,['关注','热门','我的微博'],active)}`;
        body=`${view==='profile'?profile:''}${rows.map(i=>itemButton(i,`<div class="cp-wb-author">${initials(i)}<div><b>${e(i.author||data.name||getWechatCharDisplayName(char))}</b><small>${e(i.time||i.meta)}</small></div><i class="ri-more-line"></i></div><p>${e(i.title)}${i.body?'\n'+e(i.body):''}</p>${i.image?charPhoneNativeMedia(i,key):''}<div class="cp-wb-actions"><span><i class="ri-share-forward-line"></i> ${e(i.reposts||'转发')}</span><span><i class="ri-chat-1-line"></i> ${e(i.replies||'评论')}</span><span><i class="ri-thumb-up-line"></i> ${e(i.likes||'赞')}</span></div>`,'cp-wb-post')).join('')||empty('暂无微博')}`;
        bottom=charPhoneNativeNav(key,[['home','首页','ri-home-5-line'],['video','视频','ri-video-line'],['discover','发现','ri-compass-3-line'],['messages','消息','ri-mail-line'],['profile','我','ri-user-line']],view);
    } else if(key==='douyin') {
        header=`<div class="cp-dy-header"><i class="ri-menu-line"></i>${charPhoneNativeTabs(key,['推荐','关注'],active)}<i class="ri-search-line"></i></div>`;
        body=`<div class="cp-video-feed">${rows.map(i=>itemButton(i,`${charPhoneNativeMedia(i,key)}<span class="cp-video-play"><i class="ri-play-fill"></i></span><div class="cp-video-rail">${initials(i)}<i class="ri-heart-fill"></i><small>${e(i.likes||'')}</small><i class="ri-chat-3-fill"></i><small>${e(i.replies||'')}</small><i class="ri-bookmark-fill"></i><i class="ri-share-forward-fill"></i><i class="ri-disc-fill"></i></div><div class="cp-video-caption"><b>@${e(i.author||getWechatCharDisplayName(char))}</b><p>${e(i.title)}</p><small>♫ ${e(i.artist||i.meta||'')}</small></div>`,'cp-video-post')).join('')||`<div class="cp-video-post is-empty">${empty('推荐视频')}<i class="ri-play-fill"></i></div>`}</div>`;
        bottom=charPhoneNativeNav(key,[['home','首页','ri-home-5-fill'],['friends','朋友','ri-group-line'],['posts','作品','ri-add-box-line'],['messages','消息','ri-chat-3-line'],['profile','我','ri-user-line']],view);
    } else if(key==='album') {
        header=`<div class="cp-photos-header"><h2>照片</h2><span>${items.length} 张照片</span><i class="ri-search-line"></i></div>`;
        body=`<div class="cp-photos-date">最近项目</div><div class="cp-photos-grid">${rows.map(i=>itemButton(i,charPhoneNativeMedia(i,key),'cp-photo-tile')).join('')||empty('暂无照片')}</div>`;
        bottom=charPhoneNativeNav(key,[['home','图库','ri-image-line'],['albums','相簿','ri-folders-line'],['saved','收藏','ri-heart-line']],view);
    } else if(key==='music') {
        header=`<div class="cp-music-header"><i class="ri-menu-line"></i><b>我的音乐</b><i class="ri-search-line"></i></div>`;
        body=`${profile}<div class="cp-music-tools"><span><i class="ri-play-circle-line"></i> 最近播放</span><span><i class="ri-download-line"></i> 本地下载</span><span><i class="ri-cloud-line"></i> 云盘</span></div><div class="cp-music-favorites"><i class="ri-heart-fill"></i><div><b>我喜欢的音乐</b><small>${items.length} 首</small></div></div><div class="cp-music-list-title"><b>我的歌单</b><span>${rows.length} 首</span></div>${rows.map((i,n)=>itemButton(i,`<span class="cp-music-number">${n+1}</span>${charPhoneNativeMedia(i,key)}<div><b>${e(i.title)}</b><small>${e(i.artist||i.author||i.body)}</small></div><i class="ri-more-2-line"></i>`,'cp-music-song')).join('')||empty('暂无音乐')}`;
        extras=items.length?itemButton(items[0],`<i class="ri-disc-fill"></i><span>${e(items[0].title)}</span><i class="ri-play-circle-line"></i><i class="ri-play-list-line"></i>`,'cp-music-player'):'';
        bottom=charPhoneNativeNav(key,[['discover','发现','ri-disc-line'],['home','我的','ri-music-2-line'],['podcast','播客','ri-mic-line'],['community','云村','ri-group-line']],view);
    } else if(key==='mail') {
        header=`<div class="cp-mail-toolbar"><button onclick="setCharPhoneSection('mail',${active===0?1:0})">‹ 邮箱</button><span>编辑</span></div><h2 class="cp-mail-title">${active===1?'已发送':'收件箱'}</h2><div class="cp-mail-search"><i class="ri-search-line"></i><input aria-label="搜索邮件" placeholder="搜索" oninput="filterCharPhoneSystemRows(this.value,'.cp-mail-message')"></div>`;
        body=rows.map(i=>itemButton(i,`<span class="cp-mail-dot"></span><div><div><b>${e(i.author||'发件人')}</b><small>${e(i.time)}</small></div><strong>${e(i.title)}</strong><p>${e(i.body)}</p></div><i class="ri-arrow-right-s-line"></i>`,'cp-mail-message')).join('')||empty('暂无邮件');
        bottom=`<nav class="cp-mail-bottom" aria-label="邮箱导航"><button aria-label="收件箱" onclick="setCharPhoneSection('mail',0)"><i class="ri-inbox-line"></i></button><small>${items.length} 封邮件</small><button aria-label="已发送" onclick="setCharPhoneSection('mail',1)"><i class="ri-send-plane-line"></i></button></nav>`;
    } else if(key==='bank') {
        header=charPhoneNativeHeader('私人银行','ri-customer-service-2-line');
        body=`<div class="cp-private-hero"><small>PRIVATE BANKING</small><h2>${e(getWechatCharDisplayName(char))}</h2><span>资产总览</span><strong>${e(data.balance||'—')}</strong></div><div class="cp-private-actions"><span><i class="ri-bank-card-line"></i> 账户</span><span><i class="ri-funds-line"></i> 财富</span><span><i class="ri-exchange-line"></i> 收支</span><span><i class="ri-vip-crown-line"></i> 权益</span></div>${charPhoneNativeTabs(key,['资产总览','交易明细'],active)}<div class="cp-private-list">${list(rows)}</div>`;
        bottom=charPhoneNativeNav(key,[['home','首页','ri-bank-line'],['wealth','财富','ri-funds-line'],['service','服务','ri-customer-service-line'],['profile','我的','ri-user-line']],view);
    } else if(key==='stocks') {
        header=`<div class="cp-stock-search"><b>雪球</b><span><i class="ri-search-line"></i> 股票 / 代码</span><i class="ri-add-line"></i></div>${charPhoneNativeTabs(key,['自选','持仓','市场'],active)}`;
        body=`<div class="cp-stock-table-head"><span>股票名称</span><span>最新价</span><span>涨跌幅</span></div>${rows.map(i=>itemButton(i,`<div><b>${e(i.title)}</b><small>${e(i.symbol)}</small></div><strong>${e(i.price||i.amount||'—')}</strong><em class="${String(i.change).startsWith('-')?'down':'up'}">${e(i.change||'—')}</em>`,'cp-stock-row')).join('')||empty('暂无自选股票')}<div class="cp-stock-summary">${e(data.summary||'')}</div>`;
        bottom=charPhoneNativeNav(key,[['community','雪球','ri-snowy-line'],['home','自选','ri-star-line'],['markets','行情','ri-stock-line'],['trade','交易','ri-exchange-line'],['profile','我的','ri-user-line']],view);
    } else if(key==='funds') {
        header=charPhoneNativeHeader('基金','ri-search-line');
        body=`<div class="cp-fund-assets"><span>基金总资产（元）</span><strong>${e(data.balance||'—')}</strong><div><span>收益记录</span><span>持有明细</span></div></div>${charPhoneNativeTabs(key,['持有','自选','交易记录'],active)}${rows.map(i=>itemButton(i,`<div><b>${e(i.title)}</b><small>${e(i.symbol||i.meta)}</small></div><div><strong>${e(i.price||i.amount||'—')}</strong><em class="${String(i.change).startsWith('-')?'down':'up'}">${e(i.change||'—')}</em></div><small>持有份额 ${e(i.quantity||'—')}</small>`,'cp-fund-card')).join('')||empty('暂无持有基金')}`;
        bottom=charPhoneNativeNav(key,[['discover','发现','ri-compass-line'],['home','基金','ri-funds-line'],['holding','持有','ri-wallet-line']],view);
    } else if(key==='board') {
        const today=new Date();
        header=`<div class="cp-board-header"><i class="ri-menu-line"></i><b>${today.getMonth()+1}月</b><i class="ri-calendar-line"></i></div><div class="cp-board-week">${Array.from({length:7},(_,n)=>{const d=new Date(today);d.setDate(d.getDate()-d.getDay()+n);return `<span class="${d.getDate()===today.getDate()?'active':''}"><small>${'日一二三四五六'[n]}</small><b>${d.getDate()}</b></span>`;}).join('')}</div>`;
        body=`<div class="cp-board-day">${e(today.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'}))}</div>${rows.map(i=>itemButton(i,`<time>${e(i.time||'待定')}</time><div><b>${e(i.title)}</b><p>${e(i.body)}</p><small><i class="ri-map-pin-line"></i> ${e(i.meta||i.status)}</small></div>`,'cp-board-event')).join('')||empty('暂无董事会日程')}`;
        bottom=charPhoneNativeNav(key,[['notes','纪要','ri-file-list-line'],['search','搜索','ri-search-line'],['home','日历','ri-calendar-line']],view);
    } else if(key==='flights') {
        header=charPhoneNativeHeader('VistaJet','ri-menu-line');
        body=`<div class="cp-flight-heading"><h2>My Itineraries</h2></div>${charPhoneNativeTabs(key,['Upcoming','Past'],active)}${rows.map(i=>itemButton(i,`<div class="cp-flight-date">${e(i.time||i.meta)}<span>${e(i.status)}</span></div><div class="cp-flight-route"><div><small>DEPARTURE</small><b>${e(i.from||'—')}</b></div><i class="ri-plane-line"></i><div><small>ARRIVAL</small><b>${e(i.to||'—')}</b></div></div><h3>${e(i.title)}</h3><p>${e(i.body)}</p><i class="cp-flight-more ri-arrow-right-s-line"></i>`,'cp-flight-ticket')).join('')||empty('暂无航程')}`;
        bottom=charPhoneNativeNav(key,[['home','航程','ri-plane-line'],['fleet','机队','ri-flight-takeoff-line'],['profile','账户','ri-user-line']],view);
    } else if(key==='hotels') {
        header=`<nav class="cp-hotel-toolbar" aria-label="App 导航"><button aria-label="入住记录" onclick="setCharPhoneSection('hotels',${active?0:1})"><i class="ri-menu-line"></i></button><span>Search for a destination</span><button aria-label="角色资料" onclick="setCharPhoneNativeView('hotels','${view==='profile'?'home':'profile'}')"><i class="ri-chat-3-line"></i></button></nav>`;
        const upcoming=items.filter(i=>(i.section||0)===active);
        body=`${view==='profile'?profile:''}<div class="cp-hotel-stay-strip">${upcoming.slice(0,2).map(i=>itemButton(i,`<small>${active?'PAST STAY':'UPCOMING STAY'}</small><strong>${e(i.title)}</strong><span>${e(i.checkIn||'—')} — ${e(i.checkOut||'—')}</span><i class="ri-arrow-right-s-line"></i>`,'cp-hotel-stay')).join('')||empty('暂无入住预订')}</div><div class="cp-hotel-destination">${items[0]?charPhoneNativeMedia(items[0],key):'<div class="cp-hotel-destination-empty"><i class="ri-hotel-line"></i></div>'}<div><small>EXPLORE</small><h2>HOTELS &amp; RESORTS</h2><p>${e(data.summary||'')}</p><button onclick="setCharPhoneSection('hotels',${active?0:1})">${active?'UPCOMING STAYS':'MY STAYS'}</button></div></div>${upcoming.slice(2).map(i=>itemButton(i,`<b>${e(i.title)}</b><p>${e(i.checkIn)} — ${e(i.checkOut)}</p>`,'cp-native-record')).join('')}`;
        bottom='';
    } else if(key==='luxury') {
        header=`<div class="cp-luxury-header"><strong>NET-A-PORTER</strong><i class="ri-shopping-bag-line"></i></div>`;
        body=`<h2 class="cp-luxury-title">MY ORDERS</h2>${charPhoneNativeTabs(key,['全部订单','配送中'],active)}${rows.map(i=>itemButton(i,`<div class="cp-luxury-order-head"><span>${e(i.time||i.meta)}</span><b>${e(i.status)}</b></div><div class="cp-luxury-product">${charPhoneNativeMedia(i,key)}<div><small>${e(i.author)}</small><h3>${e(i.title)}</h3><p>${e(i.body)}</p><strong>${e(i.amount)}</strong></div></div><span class="cp-luxury-detail">VIEW ORDER DETAILS →</span>`,'cp-luxury-order')).join('')||empty('暂无订单')}`;
        bottom=charPhoneNativeNav(key,[['discover','新品','ri-compass-line'],['saved','心愿单','ri-heart-line'],['home','订单','ri-shopping-bag-line'],['profile','我的','ri-user-line']],view);
    } else if(key==='golf') {
        header=charPhoneNativeHeader('GolfPass','ri-notification-line');
        body=`<div class="cp-golf-hero"><small>GOLFPASS</small><h2>Play more.<br>Pay better.</h2><span>${e(rows[0]?.tier||'会籍资料待同步')}</span><b>${e(getWechatCharDisplayName(char))}</b></div><div class="cp-golf-membership"><span><i class="ri-vip-crown-line"></i> ${e(items[0]?.tier||'我的会籍')}</span><strong>${e(data.balance||'—')}</strong></div>${charPhoneNativeTabs(key,['我的预约','会员资料'],active)}${rows.map(i=>itemButton(i,`<small>${e(i.time||i.meta)}</small><h3>${e(i.title)}</h3><p>${e(i.body)}</p><div><span><i class="ri-flag-line"></i> ${e(i.tier)}</span><b>${e(i.status||i.amount)}</b></div>`,'cp-golf-booking')).join('')||empty('暂无球场预约')}`;
        bottom=charPhoneNativeNav(key,[['courses','Home','ri-home-5-line'],['search','Search','ri-search-line'],['home','GolfPass','ri-flag-line'],['bookings','Deals','ri-price-tag-3-line'],['profile','More','ri-more-line']],view);
    }
    // Secondary destinations use the same saved records and an explicit section;
    // they never fabricate messages, bookings or payment confirmations.
    if(!['home','profile','search'].includes(view)) {
        const section=['saved','holding','bookings','notes','trade'].includes(view)?1:2;
        const subset=items.filter(i=>i.section===section);
        body=list(subset);
    }
    return `<section class="cp-native cp-${key} cp-native-designed" data-app-layout="${key}">${header}<div class="cp-scroll">${body}</div>${extras}${bottom}</section>`;
}
