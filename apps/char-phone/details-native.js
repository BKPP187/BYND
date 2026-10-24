/* Char phone: generated details and pages for the persona apps (bank, stocks, funds, luxury,
   hotels, flights, golf, board, Alipay). Same rules as details.js: generated only when opened,
   saved on the character, errors shown with a retry button. Loaded after details.js. */

function cpdStrings(value, limit, max) {
    return (Array.isArray(value) ? value : []).slice(0, limit).map(item => cpdText(item, max)).filter(Boolean);
}
function cpdPoints(value) {
    return (Array.isArray(value) ? value : []).slice(0, 40).map(cpdNumber).filter(number => number != null);
}
// Up is red, down is green: the convention of Chinese market apps.
function cpdTrendClass(change) {
    const text = String(change || '');
    if (/^\s*[-−]/.test(text)) return 'is-down';
    return /\d/.test(text) && !/^\s*0+(?:\.0+)?%?\s*$/.test(text) ? 'is-up' : '';
}
function cpdSparkline(points, label) {
    if (points.length < 2) return '';
    const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
    const coords = points.map((value, index) => `${(index / (points.length - 1) * 100).toFixed(2)},${(36 - (value - min) / span * 32 - 2).toFixed(2)}`).join(' ');
    const trend = points[points.length - 1] >= points[0] ? 'is-up' : 'is-down';
    return `<svg class="cpd-spark ${trend}" viewBox="0 0 100 36" preserveAspectRatio="none" role="img" aria-label="${cpdAttr(label)}"><polyline points="${coords}" fill="none" vector-effect="non-scaling-stroke"/></svg>`;
}
function cpdTracks(tracks) {
    return tracks.length ? `<ol class="cpd-timeline">${tracks.map(item => `<li><b>${cpdEsc(item.text)}</b><small>${cpdEsc(item.time)}</small></li>`).join('')}</ol>` : '';
}
function cpdChips(items) {
    return items.length ? `<div class="cpd-chips">${items.map(item => `<span>${cpdEsc(item)}</span>`).join('')}</div>` : '';
}
const cpdTrackList = value => cpdList(value, 8, item => cpdText(item.text, 80) ? { time: cpdText(item.time, 20), text: cpdText(item.text, 80) } : null);

Object.assign(CHAR_PHONE_RECORD_SPECS, {
    alipay: { ...CHAR_PHONE_RECORD_SPECS.wallet },
    bank: {
        title: '电子回单',
        prompt: '把这条私人银行记录展开成银行电子回单。账号只显示后四位（如 ****6218）。金额、方向要和记录一致。',
        schema: '{"type":"转入|转出|消费|理财申购|理财赎回|利息","amount":"-¥200,000.00","status":"交易成功","time":"2026-10-21 10:12:33","account":"本方账户 ****6218","counterparty":"对方户名","counterAccount":"对方账户 ****3301","counterBank":"对方开户行","channel":"手机银行|私行柜台|自动扣款","purpose":"用途","serialNo":"流水号","balanceAfter":"交易后余额","note":"客户经理备注或空"}',
        normalize: (data, row) => ({
            type: cpdText(data.type, 10), amount: cpdText(data.amount, 24) || cpdText(row.amount, 24), status: cpdText(data.status, 10) || '交易成功', time: cpdText(data.time, 24),
            account: cpdText(data.account, 30), counterparty: cpdText(data.counterparty, 40) || cpdText(row.title, 40), counterAccount: cpdText(data.counterAccount, 30), counterBank: cpdText(data.counterBank, 30),
            channel: cpdText(data.channel, 16), purpose: cpdText(data.purpose, 40), serialNo: cpdText(data.serialNo, 40), balanceAfter: cpdText(data.balanceAfter, 24), note: cpdText(data.note, 80)
        }),
        valid: data => !!(data.amount || data.counterparty)
    },
    stocks: {
        title: '个股详情',
        prompt: '把这只自选/持仓股票展开成行情详情：今日走势 20 个价格点（和涨跌方向一致）、开高低、成交量、市值、市盈率、角色的持仓（没持仓就 position 为 null）、相关新闻 2-3 条、角色自己的交易笔记一句。数值要互相自洽。',
        schema: '{"name":"名称","symbol":"代码","price":"36.82","change":"+1.24","changePct":"+3.48%","open":"35.70","high":"37.10","low":"35.52","volume":"12.3万手","marketCap":"812亿","pe":"23.4","points":[35.7,35.9],"position":{"qty":"2000股","cost":"31.20","value":"73,640","pnl":"+11,240","pnlPct":"+18.0%"},"news":[{"title":"新闻标题","time":"10:21"}],"note":"交易笔记"}',
        normalize: (data, row) => ({
            name: cpdText(data.name, 20) || cpdText(row.title, 20), symbol: cpdText(data.symbol, 16) || cpdText(row.symbol, 16), price: cpdText(data.price, 14) || cpdText(row.price, 14),
            change: cpdText(data.change, 12), changePct: cpdText(data.changePct, 12) || cpdText(row.change, 12), open: cpdText(data.open, 12), high: cpdText(data.high, 12), low: cpdText(data.low, 12),
            volume: cpdText(data.volume, 16), marketCap: cpdText(data.marketCap, 16), pe: cpdText(data.pe, 10), points: cpdPoints(data.points),
            position: data.position && typeof data.position === 'object' ? { qty: cpdText(data.position.qty, 16), cost: cpdText(data.position.cost, 14), value: cpdText(data.position.value, 16), pnl: cpdText(data.position.pnl, 16), pnlPct: cpdText(data.position.pnlPct, 12) } : null,
            news: cpdList(data.news, 4, item => cpdText(item.title, 60) ? { title: cpdText(item.title, 60), time: cpdText(item.time, 16) } : null), note: cpdText(data.note, 100)
        }),
        valid: data => !!data.name
    },
    funds: {
        title: '基金详情',
        prompt: '把这只基金展开成持仓详情：近 20 个交易日净值点、最新净值和日期、日涨跌、今年以来收益、基金经理、规模、角色的持有金额/份额/成本/收益、最近 2-4 条交易记录（定投、申购、赎回）。',
        schema: '{"name":"基金名称","code":"6位代码","type":"股票型|混合型|债券型|指数型","nav":"1.8231","navDate":"10-21","day":"+0.82%","ytd":"+12.4%","points":[1.71,1.72],"manager":"基金经理","size":"规模","position":{"amount":"128,400.00","shares":"70,432.11份","cost":"1.6520","pnl":"+11,980.30"},"records":[{"time":"10-15","action":"定投","amount":"¥5,000"}]}',
        normalize: (data, row) => ({
            name: cpdText(data.name, 30) || cpdText(row.title, 30), code: cpdText(data.code, 10) || cpdText(row.symbol, 10), type: cpdText(data.type, 8), nav: cpdText(data.nav, 10), navDate: cpdText(data.navDate, 10),
            day: cpdText(data.day, 10), ytd: cpdText(data.ytd, 10), points: cpdPoints(data.points), manager: cpdText(data.manager, 16), size: cpdText(data.size, 16),
            position: data.position && typeof data.position === 'object' ? { amount: cpdText(data.position.amount, 18), shares: cpdText(data.position.shares, 20), cost: cpdText(data.position.cost, 10), pnl: cpdText(data.position.pnl, 18) } : null,
            records: cpdList(data.records, 5, item => cpdText(item.action, 10) ? { time: cpdText(item.time, 12), action: cpdText(item.action, 10), amount: cpdText(item.amount, 16) } : null)
        }),
        valid: data => !!data.name
    },
    luxury: {
        title: '订单详情',
        prompt: '把这条奢侈品订单展开：品牌与商品明细（尺码、颜色、单价）、小计、关税、运费、合计、支付方式、收货地址（只到区域）、包装方式、礼品卡留言（没有就空）、物流轨迹 2-5 条。',
        schema: '{"orderNo":"订单号","status":"已签收|运输中|备货中","items":[{"brand":"品牌","name":"商品","size":"尺码","color":"颜色","price":"¥18,900"}],"subtotal":"¥18,900","duties":"¥0","shipping":"免运费","total":"¥18,900","method":"支付方式","address":"区域地址","packaging":"品牌礼盒","giftNote":"留言或空","tracks":[{"time":"10-21 09:12","text":"节点"}]}',
        normalize: (data, row) => ({
            orderNo: cpdText(data.orderNo, 30), status: cpdText(data.status, 10) || cpdText(row.status, 10),
            items: cpdList(data.items, 6, item => cpdText(item.name, 50) ? { brand: cpdText(item.brand, 20), name: cpdText(item.name, 50), size: cpdText(item.size, 12), color: cpdText(item.color, 12), price: cpdText(item.price, 16) } : null),
            subtotal: cpdText(data.subtotal, 16), duties: cpdText(data.duties, 16), shipping: cpdText(data.shipping, 16), total: cpdText(data.total, 16), method: cpdText(data.method, 20),
            address: cpdText(data.address, 60), packaging: cpdText(data.packaging, 20), giftNote: cpdText(data.giftNote, 120), tracks: cpdTrackList(data.tracks)
        }),
        valid: data => data.items.length > 0
    },
    hotels: {
        title: '预订确认',
        prompt: '把这条酒店预订展开成预订确认单：确认号、房型、入住人、晚数、入住离店时间、每晚房价与税费明细、合计、会员权益、特殊要求、取消政策、状态。',
        schema: '{"hotel":"酒店","confirmation":"确认号","status":"已确认|已入住|已离店|已取消","room":"房型","guests":["入住人"],"nights":"2晚","checkIn":"10月24日 15:00后","checkOut":"10月26日 12:00前","rates":[{"label":"10月24日 房费","amount":"¥3,280"}],"total":"¥7,213","benefits":["会员权益"],"requests":"特殊要求","cancellation":"取消政策"}',
        normalize: (data, row) => ({
            hotel: cpdText(data.hotel, 40) || cpdText(row.title, 40), confirmation: cpdText(data.confirmation, 24), status: cpdText(data.status, 8) || cpdText(row.status, 8), room: cpdText(data.room, 40),
            guests: cpdStrings(data.guests, 4, 16), nights: cpdText(data.nights, 10), checkIn: cpdText(data.checkIn, 24) || cpdText(row.checkIn, 24), checkOut: cpdText(data.checkOut, 24) || cpdText(row.checkOut, 24),
            rates: cpdList(data.rates, 8, item => cpdText(item.label, 30) ? { label: cpdText(item.label, 30), amount: cpdText(item.amount, 16) } : null),
            total: cpdText(data.total, 16), benefits: cpdStrings(data.benefits, 5, 24), requests: cpdText(data.requests, 100), cancellation: cpdText(data.cancellation, 120)
        }),
        valid: data => !!data.hotel
    },
    flights: {
        title: '行程单',
        prompt: '把这条私人飞机行程展开成行程单：机型、注册号、起降机场与 FBO、起降时间（当地时间）、飞行时长、乘客、机组、餐食、费用、状态与备注。',
        schema: '{"aircraft":"机型","tail":"注册号","from":"出发机场","to":"到达机场","fboFrom":"出发 FBO","fboTo":"到达 FBO","depart":"10-25 08:30","arrive":"10-25 11:05","duration":"2小时35分","passengers":["乘客"],"crew":["机长 xx"],"catering":"餐食安排","cost":"费用","status":"已确认|已完成|待确认","note":"备注"}',
        normalize: (data, row) => ({
            aircraft: cpdText(data.aircraft, 30), tail: cpdText(data.tail, 12), from: cpdText(data.from, 30) || cpdText(row.from, 30), to: cpdText(data.to, 30) || cpdText(row.to, 30),
            fboFrom: cpdText(data.fboFrom, 30), fboTo: cpdText(data.fboTo, 30), depart: cpdText(data.depart, 20), arrive: cpdText(data.arrive, 20), duration: cpdText(data.duration, 16),
            passengers: cpdStrings(data.passengers, 8, 16), crew: cpdStrings(data.crew, 5, 20), catering: cpdText(data.catering, 80), cost: cpdText(data.cost, 20), status: cpdText(data.status, 8) || cpdText(row.status, 8), note: cpdText(data.note, 100)
        }),
        valid: data => !!(data.from || data.to)
    },
    golf: {
        title: '预约详情',
        prompt: '把这条高尔夫记录展开：球场、开球时间、同组球友、洞数、球童、球车、费用、天气，如果已经打完给出总杆数和 18 洞简要记分（只写每洞杆数数组），加一句角色的感想。',
        schema: '{"course":"球场","teeTime":"10-26 07:40","players":["球友"],"holes":"18洞","caddie":"球童","cart":"双人球车","fee":"¥2,680","weather":"晴 18°C","total":"86","scores":[4,5,3],"comment":"感想"}',
        normalize: (data, row) => ({
            course: cpdText(data.course, 40) || cpdText(row.title, 40), teeTime: cpdText(data.teeTime, 20), players: cpdStrings(data.players, 4, 16), holes: cpdText(data.holes, 8), caddie: cpdText(data.caddie, 16),
            cart: cpdText(data.cart, 16), fee: cpdText(data.fee, 16), weather: cpdText(data.weather, 20), total: cpdText(data.total, 6), scores: cpdPoints(data.scores).slice(0, 18).map(Math.round), comment: cpdText(data.comment, 100)
        }),
        valid: data => !!data.course
    },
    board: {
        title: '会议详情',
        prompt: '把这条董事会/会议日程展开：时间地点、主持人、与会人、议程 3-5 项、已形成的决议（会还没开就为空）、需要角色准备的材料、角色自己的私人备注。',
        schema: '{"title":"会议","time":"10-23 09:30-11:30","location":"地点","chair":"主持人","attendees":["与会人"],"agenda":["议程"],"decisions":["决议"],"materials":["材料"],"note":"私人备注"}',
        normalize: (data, row) => ({
            title: cpdText(data.title, 40) || cpdText(row.title, 40), time: cpdText(data.time, 30), location: cpdText(data.location, 40), chair: cpdText(data.chair, 16),
            attendees: cpdStrings(data.attendees, 10, 16), agenda: cpdStrings(data.agenda, 6, 60), decisions: cpdStrings(data.decisions, 6, 80), materials: cpdStrings(data.materials, 6, 40), note: cpdLong(data.note, 300)
        }),
        valid: data => !!data.title
    }
});

Object.assign(CHAR_PHONE_RECORD_RENDERERS, {
    alipay: CHAR_PHONE_RECORD_RENDERERS.wallet,
    bank: data => `<div class="cpd-receipt cpd-bank-receipt">
        <div class="cpd-receipt-head"><span class="cpd-receipt-logo"><i class="ri-bank-line"></i></span><b>${cpdEsc(data.type || '交易')}</b><strong>${cpdEsc(data.amount)}</strong><em>${cpdEsc(data.status)}</em></div>
        ${cpdFields([['交易时间', data.time], ['本方账户', data.account], ['对方户名', data.counterparty], ['对方账户', data.counterAccount], ['对方开户行', data.counterBank], ['交易渠道', data.channel], ['用途', data.purpose], ['交易后余额', data.balanceAfter], ['流水号', data.serialNo], ['备注', data.note]])}
        <div class="cpd-stamp" aria-hidden="true">电子回单<br>专用章</div>
    </div>`,
    stocks: data => `<div class="cpd-quote">
        <div class="cpd-quote-head"><div><b>${cpdEsc(data.name)}</b><small>${cpdEsc(data.symbol)}</small></div><div class="${cpdTrendClass(data.changePct || data.change)}"><strong>${cpdEsc(data.price)}</strong><span>${cpdEsc([data.change, data.changePct].filter(Boolean).join('  '))}</span></div></div>
        ${cpdSparkline(data.points, `${data.name} 今日走势`)}
        <div class="cpd-quote-grid">${[['今开', data.open], ['最高', data.high], ['最低', data.low], ['成交量', data.volume], ['市值', data.marketCap], ['市盈率', data.pe]].filter(([, value]) => value).map(([label, value]) => `<div><small>${label}</small><b>${cpdEsc(value)}</b></div>`).join('')}</div>
        ${data.position ? `<div class="cpd-card"><h3>我的持仓</h3>${cpdFields([['持仓', data.position.qty], ['成本价', data.position.cost], ['市值', data.position.value]])}<div class="cpd-pnl ${cpdTrendClass(data.position.pnl)}"><span>浮动盈亏</span><b>${cpdEsc(data.position.pnl)}</b><em>${cpdEsc(data.position.pnlPct)}</em></div></div>` : ''}
        ${data.news.length ? `<div class="cpd-card"><h3>资讯</h3>${data.news.map(item => `<div class="cpd-line"><span>${cpdEsc(item.title)}</span><small>${cpdEsc(item.time)}</small></div>`).join('')}</div>` : ''}
        ${data.note ? `<div class="cpd-card"><h3>交易笔记</h3><p class="cpd-note">${cpdEsc(data.note)}</p></div>` : ''}
    </div>`,
    funds: data => `<div class="cpd-quote">
        <div class="cpd-quote-head"><div><b>${cpdEsc(data.name)}</b><small>${cpdEsc([data.code, data.type].filter(Boolean).join(' · '))}</small></div><div class="${cpdTrendClass(data.day)}"><strong>${cpdEsc(data.nav)}</strong><span>${cpdEsc(data.day)} ${data.navDate ? `· ${cpdEsc(data.navDate)}` : ''}</span></div></div>
        ${cpdSparkline(data.points, `${data.name} 近期净值`)}
        <div class="cpd-quote-grid">${[['今年以来', data.ytd], ['基金经理', data.manager], ['规模', data.size]].filter(([, value]) => value).map(([label, value]) => `<div><small>${label}</small><b>${cpdEsc(value)}</b></div>`).join('')}</div>
        ${data.position ? `<div class="cpd-card"><h3>我的持有</h3>${cpdFields([['持有金额', data.position.amount], ['持有份额', data.position.shares], ['持仓成本', data.position.cost]])}<div class="cpd-pnl ${cpdTrendClass(data.position.pnl)}"><span>持有收益</span><b>${cpdEsc(data.position.pnl)}</b></div></div>` : ''}
        ${data.records.length ? `<div class="cpd-card"><h3>交易记录</h3>${data.records.map(item => `<div class="cpd-line"><span>${cpdEsc(item.action)} <small>${cpdEsc(item.time)}</small></span><b>${cpdEsc(item.amount)}</b></div>`).join('')}</div>` : ''}
    </div>`,
    luxury: data => `<div class="cpd-order cpd-luxury-order">
        <div class="cpd-order-status"><b>${cpdEsc(data.status || 'ORDER')}</b><p>${cpdEsc(data.orderNo)}</p></div>
        <div class="cpd-card">${data.items.map(item => `<div class="cpd-product"><div class="cpd-goods-art small"><i class="ri-vip-diamond-line"></i></div><div><small>${cpdEsc(item.brand)}</small><b>${cpdEsc(item.name)}</b><small>${cpdEsc([item.color, item.size].filter(Boolean).join(' / '))}</small></div><span><strong>${cpdEsc(item.price)}</strong></span></div>`).join('')}
            ${cpdFields([['小计', data.subtotal], ['关税', data.duties], ['运费', data.shipping], ['合计', data.total], ['支付方式', data.method]])}</div>
        <div class="cpd-card">${cpdFields([['收货地址', data.address], ['包装', data.packaging]])}${data.giftNote ? `<div class="cpd-gift-note"><small>礼品卡留言</small><p>${cpdEsc(data.giftNote)}</p></div>` : ''}</div>
        ${data.tracks.length ? `<div class="cpd-card"><h3>配送</h3>${cpdTracks(data.tracks)}</div>` : ''}
    </div>`,
    hotels: data => `<div class="cpd-event cpd-hotel-confirm">
        <small class="cpd-kicker">${cpdEsc(data.status || 'CONFIRMED')}</small><h2>${cpdEsc(data.hotel)}</h2><p>${cpdEsc(data.room)}</p>
        <div class="cpd-stay"><div><small>入住</small><b>${cpdEsc(data.checkIn)}</b></div><i class="ri-arrow-right-line" aria-hidden="true"></i><div><small>离店</small><b>${cpdEsc(data.checkOut)}</b></div></div>
        ${cpdFields([['确认号', data.confirmation], ['入住人', data.guests.join('、')], ['晚数', data.nights]])}
        ${data.rates.length ? `<div class="cpd-section"><h3>费用明细</h3>${data.rates.map(item => `<div class="cpd-line"><span>${cpdEsc(item.label)}</span><b>${cpdEsc(item.amount)}</b></div>`).join('')}${data.total ? `<div class="cpd-line cpd-total"><span>合计</span><b>${cpdEsc(data.total)}</b></div>` : ''}</div>` : ''}
        ${data.benefits.length ? `<div class="cpd-section"><h3>会员权益</h3>${cpdChips(data.benefits)}</div>` : ''}
        ${data.requests ? `<div class="cpd-section"><h3>特殊要求</h3><p class="cpd-note">${cpdEsc(data.requests)}</p></div>` : ''}
        ${data.cancellation ? `<div class="cpd-section"><h3>取消政策</h3><p class="cpd-note cpd-small">${cpdEsc(data.cancellation)}</p></div>` : ''}
    </div>`,
    flights: data => `<div class="cpd-event cpd-itinerary">
        <small class="cpd-kicker">${cpdEsc(data.status || 'ITINERARY')}</small>
        <div class="cpd-route"><div><b>${cpdEsc(data.from)}</b><small>${cpdEsc(data.depart)}</small></div><i class="ri-plane-line" aria-hidden="true"></i><div><b>${cpdEsc(data.to)}</b><small>${cpdEsc(data.arrive)}</small></div></div>
        ${cpdFields([['机型', data.aircraft], ['注册号', data.tail], ['飞行时长', data.duration], ['出发 FBO', data.fboFrom], ['到达 FBO', data.fboTo], ['费用', data.cost]])}
        ${data.passengers.length ? `<div class="cpd-section"><h3>乘客</h3>${cpdChips(data.passengers)}</div>` : ''}
        ${data.crew.length ? `<div class="cpd-section"><h3>机组</h3>${cpdChips(data.crew)}</div>` : ''}
        ${data.catering ? `<div class="cpd-section"><h3>餐食</h3><p class="cpd-note">${cpdEsc(data.catering)}</p></div>` : ''}
        ${data.note ? `<div class="cpd-section"><h3>备注</h3><p class="cpd-note">${cpdEsc(data.note)}</p></div>` : ''}
    </div>`,
    golf: data => `<div class="cpd-event">
        <h2>${cpdEsc(data.course)}</h2><p>${cpdEsc([data.teeTime, data.weather].filter(Boolean).join(' · '))}</p>
        ${cpdFields([['同组', data.players.join('、')], ['洞数', data.holes], ['球童', data.caddie], ['球车', data.cart], ['费用', data.fee], ['总杆数', data.total]])}
        ${data.scores.length ? `<div class="cpd-section"><h3>记分卡</h3><div class="cpd-scorecard">${data.scores.map((score, index) => `<span><small>${index + 1}</small><b>${score}</b></span>`).join('')}</div></div>` : ''}
        ${data.comment ? `<div class="cpd-section"><h3>TA 说</h3><p class="cpd-note">${cpdEsc(data.comment)}</p></div>` : ''}
    </div>`,
    board: data => `<div class="cpd-event">
        <h2>${cpdEsc(data.title)}</h2><p>${cpdEsc([data.time, data.location].filter(Boolean).join(' · '))}</p>
        ${cpdFields([['主持', data.chair], ['与会', data.attendees.join('、')]])}
        ${data.agenda.length ? `<div class="cpd-section"><h3>议程</h3><ol class="cpd-ordered">${data.agenda.map(item => `<li>${cpdEsc(item)}</li>`).join('')}</ol></div>` : ''}
        ${data.decisions.length ? `<div class="cpd-section"><h3>决议</h3><ul class="cpd-checklist">${data.decisions.map(item => `<li>${cpdEsc(item)}</li>`).join('')}</ul></div>` : ''}
        ${data.materials.length ? `<div class="cpd-section"><h3>要准备的材料</h3>${cpdChips(data.materials)}</div>` : ''}
        ${data.note ? `<div class="cpd-section"><h3>私人备注</h3><p class="cpd-note">${cpdEsc(data.note)}</p></div>` : ''}
    </div>`
});

const cpdNamedList = (fields, limit = 10) => data => ({
    items: cpdList(data.items, limit, item => {
        const out = {};
        for (const [name, max] of fields) out[name] = cpdText(item[name], max);
        return out[fields[0][0]] ? out : null;
    })
});
const cpdHasItems = data => data.items.length > 0;

Object.assign(CHAR_PHONE_PAGE_SPECS, {
    'alipay:bills': { ...CHAR_PHONE_PAGE_SPECS['wallet:bills'], title: '支付宝账单' },
    'alipay:wealth': {
        title: '总资产',
        prompt: '生成这个角色支付宝「财富」页：总资产、昨日收益、余额宝和持有的 3-6 个理财/基金产品。规模要符合角色经济状况。',
        schema: '{"total":"¥86,420.18","yesterday":"+¥12.36","items":[{"name":"余额宝","type":"货币基金","amount":"¥32,010.55","yield":"七日年化 1.42%","pnl":"+¥4.21"}]}',
        normalize: data => ({ total: cpdText(data.total, 20), yesterday: cpdText(data.yesterday, 16), ...cpdNamedList([['name', 30], ['type', 10], ['amount', 20], ['yield', 20], ['pnl', 16]], 8)(data) }),
        valid: cpdHasItems
    },
    'alipay:messages': {
        title: '消息',
        prompt: '生成这个角色支付宝消息页 4-6 条：服务提醒、账单通知、转账留言、小程序通知。要和角色生活对得上。',
        schema: '{"items":[{"from":"发送方","text":"内容","time":"10:24","kind":"服务提醒|账单|转账|小程序"}]}',
        normalize: cpdNamedList([['from', 24], ['text', 120], ['time', 16], ['kind', 8]], 8),
        valid: cpdHasItems
    },
    'alipay:life': {
        title: '生活',
        prompt: '生成这个角色支付宝「生活」页最近使用的 4-6 项生活服务记录：缴费、出行、医疗挂号、快递、租房、政务等，要符合人设。',
        schema: '{"items":[{"service":"服务名","detail":"做了什么","time":"10-20","amount":"¥0或金额"}]}',
        normalize: cpdNamedList([['service', 20], ['detail', 60], ['time', 16], ['amount', 16]], 8),
        valid: cpdHasItems
    },
    'alipay:cards': {
        title: '卡包',
        prompt: '生成这个角色支付宝卡包：绑定的银行卡 2-4 张（只显示后四位）、会员卡/证件卡 2-3 张。',
        schema: '{"items":[{"name":"招商银行 储蓄卡","last4":"6218","kind":"储蓄卡|信用卡|会员卡|交通卡|证件","note":"额度/等级/余额等"}]}',
        normalize: data => ({ items: cpdList(data.items, 8, item => cpdText(item.name, 30) ? { name: cpdText(item.name, 30), last4: cpdText(item.last4, 4).replace(/\D/g, '').slice(-4), kind: cpdText(item.kind, 8), note: cpdText(item.note, 40) } : null) }),
        valid: cpdHasItems
    },
    'alipay:forest': {
        title: '蚂蚁森林',
        prompt: '生成这个角色的蚂蚁森林：当前能量、已种的树、最近 4-6 条能量动态（收能量、被偷、浇水等，好友名要符合角色社交圈）。如果角色人设明显不会玩，就写得很冷清。',
        schema: '{"energy":"12,840g","trees":["梭梭树 ×3"],"items":[{"text":"动态","time":"07:21"}]}',
        normalize: data => ({ energy: cpdText(data.energy, 16), trees: cpdStrings(data.trees, 5, 20), items: cpdList(data.items, 8, item => cpdText(item.text, 60) ? { text: cpdText(item.text, 60), time: cpdText(item.time, 12) } : null) }),
        valid: data => !!data.energy || data.items.length > 0
    },
    'bank:wealth': {
        title: '财富',
        prompt: '生成这个角色私人银行「财富」页：资产配置（3-5 类及占比）和持有的 3-6 个理财/信托/保险产品，规模符合角色身份。',
        schema: '{"allocation":[{"name":"固收","percent":42}],"items":[{"name":"产品名","type":"类型","amount":"¥3,000,000","yield":"业绩比较基准 3.6%","term":"到期日","risk":"R2"}]}',
        normalize: data => ({
            allocation: cpdList(data.allocation, 6, item => cpdText(item.name, 10) ? { name: cpdText(item.name, 10), percent: Math.max(0, Math.min(100, Math.round(cpdNumber(item.percent) || 0))) } : null),
            ...cpdNamedList([['name', 30], ['type', 10], ['amount', 20], ['yield', 24], ['term', 16], ['risk', 4]], 8)(data)
        }),
        valid: cpdHasItems
    },
    'bank:service': {
        title: '服务',
        prompt: '生成这个角色私人银行「服务」页：专属客户经理（称呼、头衔、最近一条留言）、可用权益 3-5 项、近期预约 1-3 项。',
        schema: '{"manager":{"name":"称呼","title":"头衔","message":"最近留言"},"benefits":["权益"],"appointments":[{"title":"预约","time":"时间"}]}',
        normalize: data => ({
            manager: { name: cpdText(data.manager?.name, 16), title: cpdText(data.manager?.title, 20), message: cpdText(data.manager?.message, 140) },
            benefits: cpdStrings(data.benefits, 6, 24),
            appointments: cpdList(data.appointments, 4, item => cpdText(item.title, 30) ? { title: cpdText(item.title, 30), time: cpdText(item.time, 20) } : null)
        }),
        valid: data => !!data.manager.name || data.benefits.length > 0
    },
    'stocks:markets': {
        title: '行情',
        prompt: '生成股票 App 行情页：3-4 个主要指数、5-6 个板块涨跌，数值合理。',
        schema: '{"indices":[{"name":"上证指数","value":"3,287.41","change":"+0.62%"}],"sectors":[{"name":"板块","change":"+2.1%","lead":"领涨股"}]}',
        normalize: data => ({
            indices: cpdList(data.indices, 4, item => cpdText(item.name, 12) ? { name: cpdText(item.name, 12), value: cpdText(item.value, 14), change: cpdText(item.change, 10) } : null),
            sectors: cpdList(data.sectors, 8, item => cpdText(item.name, 12) ? { name: cpdText(item.name, 12), change: cpdText(item.change, 10), lead: cpdText(item.lead, 12) } : null)
        }),
        valid: data => data.indices.length + data.sectors.length > 0
    },
    'stocks:trade': {
        title: '交易',
        prompt: '生成这个角色股票账户的今日/近期委托与成交 4-8 条，和自选/持仓里的股票对得上。',
        schema: '{"items":[{"time":"10-21 10:02","side":"买入|卖出","name":"股票","price":"36.10","qty":"500股","status":"已成交|部分成交|已撤单"}]}',
        normalize: cpdNamedList([['name', 16], ['time', 16], ['side', 4], ['price', 12], ['qty', 12], ['status', 8]], 10),
        valid: cpdHasItems
    },
    'stocks:community': {
        title: '社区',
        prompt: '生成雪球社区里这个角色关注的人/自己发的 4-6 条帖子，讨论他/她关心的股票和行业。',
        schema: '{"items":[{"author":"作者","title":"标题","body":"两三句正文","likes":"126"}]}',
        normalize: cpdNamedList([['title', 50], ['author', 20], ['body', 180], ['likes', 10]], 8),
        valid: cpdHasItems
    },
    'funds:discover': {
        title: '发现',
        prompt: '生成基金 App 发现页推给这个角色的 4-6 只基金，贴合他/她的风险偏好。',
        schema: '{"items":[{"name":"基金名","code":"代码","type":"类型","yield":"近一年 +12.3%","risk":"中风险","reason":"推荐理由"}]}',
        normalize: cpdNamedList([['name', 30], ['code', 10], ['type', 8], ['yield', 20], ['risk', 8], ['reason', 40]], 8),
        valid: cpdHasItems
    },
    'luxury:discover': {
        title: '新品',
        prompt: '生成奢侈品 App 新品页推给这个角色的 4-6 件单品，品牌和品味符合人设。',
        schema: '{"items":[{"brand":"品牌","name":"单品","price":"¥12,800","note":"一句介绍"}]}',
        normalize: cpdNamedList([['name', 40], ['brand', 20], ['price', 16], ['note', 50]], 8),
        valid: cpdHasItems
    },
    'luxury:saved': {
        title: '心愿单',
        prompt: '生成这个角色心愿单里的 3-6 件单品，有的在等补货、有的在犹豫，可以有想送给 user 的。',
        schema: '{"items":[{"brand":"品牌","name":"单品","price":"¥8,600","size":"尺码","note":"为什么想要"}]}',
        normalize: cpdNamedList([['name', 40], ['brand', 20], ['price', 16], ['size', 10], ['note', 60]], 8),
        valid: cpdHasItems
    },
    'flights:fleet': {
        title: '机队',
        prompt: '生成这个角色可用/常用的 2-4 架公务机：机型、注册号、座位数、航程、常驻基地、一句备注。',
        schema: '{"items":[{"model":"机型","tail":"注册号","seats":"13座","range":"7,700km","base":"常驻基地","note":"备注"}]}',
        normalize: cpdNamedList([['model', 30], ['tail', 12], ['seats', 8], ['range', 12], ['base', 20], ['note', 50]], 6),
        valid: cpdHasItems
    },
    'golf:courses': {
        title: '球场',
        prompt: '生成这个角色常去或会员所在的 3-5 个高尔夫球场：位置、标准杆、难度、果岭费、一句评价。',
        schema: '{"items":[{"name":"球场","location":"位置","par":"72","rating":"难度","fee":"¥1,880","note":"评价"}]}',
        normalize: cpdNamedList([['name', 30], ['location', 30], ['par', 4], ['rating', 10], ['fee', 14], ['note', 50]], 6),
        valid: cpdHasItems
    },
    'board:notes': {
        title: '纪要',
        prompt: '生成这个角色最近 3-5 份会议纪要：标题、日期、两三句摘要、关键决议。',
        schema: '{"items":[{"title":"会议","time":"10-18","summary":"摘要","decision":"关键决议"}]}',
        normalize: cpdNamedList([['title', 40], ['time', 12], ['summary', 160], ['decision', 80]], 6),
        valid: cpdHasItems
    }
});

const cpdSimpleRows = (render) => data => `<div class="cpd-card-list">${data.items.map(render).join('')}</div>`;
Object.assign(CHAR_PHONE_PAGE_RENDERERS, {
    'alipay:bills': CHAR_PHONE_PAGE_RENDERERS['wallet:bills'],
    'alipay:wealth': data => `<div class="cpd-card-list"><div class="cpd-asset-hero"><small>总资产（元）</small><strong>${cpdEsc(data.total || '—')}</strong>${data.yesterday ? `<span>昨日收益 ${cpdEsc(data.yesterday)}</span>` : ''}</div>${data.items.map(item => `<div class="cpd-row"><span><b>${cpdEsc(item.name)}</b><small>${cpdEsc([item.type, item.yield].filter(Boolean).join(' · '))}</small></span><span class="cpd-row-end"><b>${cpdEsc(item.amount)}</b><small class="${cpdTrendClass(item.pnl)}">${cpdEsc(item.pnl)}</small></span></div>`).join('')}</div>`,
    'alipay:messages': data => `<div class="cpd-messages">${data.items.map(item => `<div class="cpd-message"><span class="cpd-message-icon is-blue"><i class="${/账单/.test(item.kind) ? 'ri-bill-line' : /转账/.test(item.kind) ? 'ri-exchange-cny-line' : /小程序/.test(item.kind) ? 'ri-apps-2-line' : 'ri-notification-3-line'}"></i></span><span><b>${cpdEsc(item.from)}</b><p>${cpdEsc(item.text)}</p></span><small>${cpdEsc(item.time)}</small></div>`).join('')}</div>`,
    'alipay:life': cpdSimpleRows(item => `<div class="cpd-row"><i class="ri-service-line"></i><span><b>${cpdEsc(item.service)}</b><small>${cpdEsc(item.detail)}</small></span><span class="cpd-row-end"><b>${cpdEsc(item.amount)}</b><small>${cpdEsc(item.time)}</small></span></div>`),
    'alipay:cards': data => `<div class="cpd-cards">${data.items.map((item, index) => `<div class="cpd-bankcard tone-${index % 4}"><small>${cpdEsc(item.kind)}</small><b>${cpdEsc(item.name)}</b>${item.last4 ? `<span>**** **** **** ${cpdEsc(item.last4)}</span>` : ''}${item.note ? `<em>${cpdEsc(item.note)}</em>` : ''}</div>`).join('')}</div>`,
    'alipay:forest': data => `<div class="cpd-card-list"><div class="cpd-forest"><i class="ri-plant-line"></i><strong>${cpdEsc(data.energy || '0g')}</strong><small>可用能量</small>${cpdChips(data.trees)}</div>${data.items.map(item => `<div class="cpd-row"><i class="ri-leaf-line"></i><span><b>${cpdEsc(item.text)}</b></span><em>${cpdEsc(item.time)}</em></div>`).join('')}</div>`,
    'bank:wealth': data => `<div class="cpd-card-list">${data.allocation.length ? `<div class="cpd-allocation" aria-label="资产配置"><div class="cpd-allocation-bar">${data.allocation.map((item, index) => `<i class="tone-${index % 5}" style="flex:${Math.max(1, item.percent)}"></i>`).join('')}</div>${data.allocation.map((item, index) => `<span><i class="tone-${index % 5}"></i>${cpdEsc(item.name)} ${item.percent}%</span>`).join('')}</div>` : ''}<h3>持有产品</h3>${data.items.map(item => `<div class="cpd-row"><span><b>${cpdEsc(item.name)}</b><small>${cpdEsc([item.type, item.yield, item.term].filter(Boolean).join(' · '))}</small></span><span class="cpd-row-end"><b>${cpdEsc(item.amount)}</b><small>${cpdEsc(item.risk)}</small></span></div>`).join('')}</div>`,
    'bank:service': data => `<div class="cpd-card-list">${data.manager.name ? `<div class="cpd-manager"><span class="cpd-initial">${cpdEsc(data.manager.name.slice(0, 1))}</span><div><b>${cpdEsc(data.manager.name)}</b><small>${cpdEsc(data.manager.title)}</small>${data.manager.message ? `<p>${cpdEsc(data.manager.message)}</p>` : ''}</div></div>` : ''}${data.benefits.length ? `<h3>专属权益</h3>${cpdChips(data.benefits)}` : ''}${data.appointments.length ? `<h3>近期预约</h3>${data.appointments.map(item => `<div class="cpd-row"><i class="ri-calendar-event-line"></i><span><b>${cpdEsc(item.title)}</b></span><em>${cpdEsc(item.time)}</em></div>`).join('')}` : ''}</div>`,
    'stocks:markets': data => `<div class="cpd-card-list"><div class="cpd-indices">${data.indices.map(item => `<div class="${cpdTrendClass(item.change)}"><small>${cpdEsc(item.name)}</small><b>${cpdEsc(item.value)}</b><span>${cpdEsc(item.change)}</span></div>`).join('')}</div>${data.sectors.length ? `<h3>板块</h3>${data.sectors.map(item => `<div class="cpd-row"><span><b>${cpdEsc(item.name)}</b><small>${cpdEsc(item.lead)}</small></span><em class="cpd-trend ${cpdTrendClass(item.change)}">${cpdEsc(item.change)}</em></div>`).join('')}` : ''}</div>`,
    'stocks:trade': cpdSimpleRows(item => `<div class="cpd-row"><em class="cpd-side ${/卖/.test(item.side) ? 'is-down' : 'is-up'}">${cpdEsc(item.side)}</em><span><b>${cpdEsc(item.name)}</b><small>${cpdEsc([item.time, item.status].filter(Boolean).join(' · '))}</small></span><span class="cpd-row-end"><b>${cpdEsc(item.price)}</b><small>${cpdEsc(item.qty)}</small></span></div>`),
    'stocks:community': data => `<div class="cpd-feed">${data.items.map(item => `<article class="cpd-feed-card"><small>${cpdEsc(item.author)}</small><h3>${cpdEsc(item.title)}</h3><p>${cpdEsc(item.body)}</p><small>♡ ${cpdEsc(item.likes)}</small></article>`).join('')}</div>`,
    'funds:discover': cpdSimpleRows(item => `<div class="cpd-row"><span><b>${cpdEsc(item.name)}</b><small>${cpdEsc([item.code, item.type, item.risk].filter(Boolean).join(' · '))}</small>${item.reason ? `<small>${cpdEsc(item.reason)}</small>` : ''}</span><em class="cpd-trend ${cpdTrendClass(item.yield.replace(/^[^+\-−\d]*/, ''))}">${cpdEsc(item.yield)}</em></div>`),
    'luxury:discover': data => `<div class="cpd-goods-grid cpd-lux-grid">${data.items.map(item => `<article class="cpd-goods"><div class="cpd-goods-art"><i class="ri-vip-diamond-line"></i></div><small class="cpd-goods-shop">${cpdEsc(item.brand)}</small><h3>${cpdEsc(item.name)}</h3><div><strong>${cpdEsc(item.price)}</strong></div>${item.note ? `<small class="cpd-goods-shop">${cpdEsc(item.note)}</small>` : ''}</article>`).join('')}</div>`,
    'luxury:saved': cpdSimpleRows(item => `<div class="cpd-row"><i class="ri-heart-3-line"></i><span><small>${cpdEsc(item.brand)}</small><b>${cpdEsc(item.name)}</b><small>${cpdEsc([item.size, item.note].filter(Boolean).join(' · '))}</small></span><em>${cpdEsc(item.price)}</em></div>`),
    'flights:fleet': cpdSimpleRows(item => `<div class="cpd-row"><i class="ri-flight-takeoff-line"></i><span><b>${cpdEsc(item.model)}</b><small>${cpdEsc([item.tail, item.seats, item.range].filter(Boolean).join(' · '))}</small><small>${cpdEsc([item.base, item.note].filter(Boolean).join(' · '))}</small></span></div>`),
    'golf:courses': cpdSimpleRows(item => `<div class="cpd-row"><i class="ri-flag-2-line"></i><span><b>${cpdEsc(item.name)}</b><small>${cpdEsc([item.location, item.par ? `标准杆 ${item.par}` : '', item.rating].filter(Boolean).join(' · '))}</small>${item.note ? `<small>${cpdEsc(item.note)}</small>` : ''}</span><em>${cpdEsc(item.fee)}</em></div>`),
    'board:notes': cpdSimpleRows(item => `<div class="cpd-row cpd-minutes"><span><b>${cpdEsc(item.title)}</b><small>${cpdEsc(item.time)}</small><p>${cpdEsc(item.summary)}</p>${item.decision ? `<small>决议：${cpdEsc(item.decision)}</small>` : ''}</span></div>`)
});
