/* Char phone: second-level pages and record details, generated when the user opens them.
   Nothing here runs in the background. Opening a page or a record that has no saved content
   sends one request; the result is saved on the character so reopening is free.
   Pages follow the phone sync: after a new sync they are regenerated on the next visit.
   Errors stay visible on the page with a retry button; they are never retried automatically. */

const CHAR_PHONE_DETAIL_STORE_LIMIT = 80;

// ---------- small helpers ----------
function cpdText(value, max = 200) {
    if (value == null) return '';
    if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, max);
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
function cpdLong(value, max = 1200) {
    return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim().slice(0, max) : '';
}
function cpdList(value, limit, map) {
    return (Array.isArray(value) ? value : []).slice(0, limit)
        .filter(item => item && typeof item === 'object' && !Array.isArray(item))
        .map(map).filter(Boolean);
}
function cpdNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const match = String(value ?? '').replace(/,/g, '').match(/[-+−]?\s*\d+(?:\.\d+)?/);
    if (!match) return null;
    const number = Number(match[0].replace(/\s+/g, '').replace('−', '-'));
    return Number.isFinite(number) ? number : null;
}
function cpdHash(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}
function cpdEsc(value) { return wcEscapeHtml(value == null ? '' : String(value)); }
function cpdAttr(value) { return wcEscapeAttr(value == null ? '' : String(value)); }
function cpdChar() {
    return (window.myCharacters || []).find(item => item.id === window._wechatAiPhoneOpenCharId) || null;
}
function cpdRerender() {
    const char = cpdChar();
    if (char) renderWechatAiPhone(char);
}

// ---------- storage ----------
function getCharPhoneDetailStore(char) {
    char.chatConfig = char.chatConfig || {};
    const store = char.chatConfig.aiPhoneDetails;
    if (store && typeof store === 'object' && store.pages && store.records) return store;
    char.chatConfig.aiPhoneDetails = { pages: {}, records: {} };
    return char.chatConfig.aiPhoneDetails;
}
function pruneCharPhoneDetailStore(store) {
    for (const bucket of ['pages', 'records']) {
        const entries = Object.entries(store[bucket]);
        if (entries.length <= CHAR_PHONE_DETAIL_STORE_LIMIT) continue;
        entries.sort((a, b) => (b[1]?.at || 0) - (a[1]?.at || 0));
        store[bucket] = Object.fromEntries(entries.slice(0, CHAR_PHONE_DETAIL_STORE_LIMIT));
    }
}
function charPhoneSnapshotVersion(snapshot) {
    return String(snapshot?.updatedAt || snapshot?.generatedAt || '');
}
function charPhoneRecordKey(app, row) {
    return `${app}:${cpdHash([row.title, row.detail, row.meta, row.time, row.amount].map(value => String(value || '')).join('|'))}`;
}

// ---------- what can be generated ----------
// Each entry: prompt (what to write), schema (JSON shape), normalize (coerce the reply).
const CHAR_PHONE_PAGE_SPECS = {
    'wallet:bills': {
        title: '账单',
        prompt: '生成本月账单流水 12-18 条，按时间倒序。要像真实账单：有日常小额消费，也有符合身份的大额支出、转账和收入（工资、报销、退款、红包等至少 2 条）。商户名要具体，金额要符合角色的经济状况和世界观货币。',
        schema: '{"month":"2026年10月","items":[{"date":"10月21日 19:42","merchant":"商户或对方","category":"餐饮|购物|交通|转账|收入|娱乐|生活缴费|医疗|其他","amount":-36.5,"method":"支付方式","note":"一句备注"}]}',
        normalize: data => ({
            month: cpdText(data.month, 20),
            items: cpdList(data.items, 24, item => {
                const amount = cpdNumber(item.amount);
                const merchant = cpdText(item.merchant || item.title, 40);
                if (!merchant || amount == null) return null;
                return { date: cpdText(item.date || item.time, 30), merchant, category: cpdText(item.category, 10) || '其他', amount, method: cpdText(item.method, 30), note: cpdText(item.note, 80) };
            })
        }),
        valid: data => data.items.length > 0
    },
    'shopping:discover': {
        title: '首页推荐',
        prompt: '生成购物 App 首页根据这个角色的浏览和购买习惯推荐的 6-8 件商品。要具体到品牌/型号/规格，价格真实，reason 写平台推荐理由（像“你常买的店上新”“浏览过相似”）。',
        schema: '{"items":[{"title":"商品标题","price":"¥129","shop":"店铺名","sales":"已售2万+","reason":"推荐理由"}]}',
        normalize: data => ({ items: cpdList(data.items, 10, item => cpdText(item.title, 60) ? { title: cpdText(item.title, 60), price: cpdText(item.price, 20), shop: cpdText(item.shop, 30), sales: cpdText(item.sales, 20), reason: cpdText(item.reason, 40) } : null) }),
        valid: data => data.items.length > 0
    },
    'shopping:video': {
        title: '逛逛',
        prompt: '生成购物 App「逛逛」里推给这个角色的 4-6 条种草内容，主题要贴合角色兴趣。',
        schema: '{"items":[{"title":"标题","author":"作者","likes":"1.2万","body":"两三句正文"}]}',
        normalize: data => ({ items: cpdList(data.items, 8, item => cpdText(item.title, 60) ? { title: cpdText(item.title, 60), author: cpdText(item.author, 24), likes: cpdText(item.likes, 12), body: cpdText(item.body, 160) } : null) }),
        valid: data => data.items.length > 0
    },
    'shopping:messages': {
        title: '消息',
        prompt: '生成购物 App 消息页 4-6 条：物流通知、店铺客服对话、降价提醒、售后进度。要和这个角色买过的东西对得上。',
        schema: '{"items":[{"from":"发送方","kind":"物流|客服|活动|售后","text":"最新一条内容","time":"10:24"}]}',
        normalize: data => ({ items: cpdList(data.items, 8, item => cpdText(item.text, 120) ? { from: cpdText(item.from, 24) || '消息', kind: cpdText(item.kind, 8), text: cpdText(item.text, 120), time: cpdText(item.time, 16) } : null) }),
        valid: data => data.items.length > 0
    },
    'shopping:orders': {
        title: '购物车',
        prompt: '生成这个角色购物车里还没结算的 3-6 件商品，体现他/她想买但还在犹豫的东西。',
        schema: '{"items":[{"shop":"店铺","title":"商品","spec":"规格颜色","price":"¥89","qty":1}]}',
        normalize: data => ({ items: cpdList(data.items, 8, item => cpdText(item.title, 60) ? { shop: cpdText(item.shop, 30), title: cpdText(item.title, 60), spec: cpdText(item.spec, 40), price: cpdText(item.price, 20), qty: Math.max(1, Math.min(99, Math.round(cpdNumber(item.qty) || 1))) } : null) }),
        valid: data => data.items.length > 0
    },
    'takeout:discover': {
        title: '附近商家',
        prompt: '生成外卖 App 首页给这个角色推荐的附近 5-7 家店，口味要符合角色喜好和所在城市/世界观。',
        schema: '{"items":[{"name":"店名","rating":"4.8","eta":"30分钟","distance":"1.2km","minOrder":"起送¥20","tags":["标签"],"pick":"他常点的菜"}]}',
        normalize: data => ({ items: cpdList(data.items, 8, item => cpdText(item.name, 30) ? { name: cpdText(item.name, 30), rating: cpdText(item.rating, 6), eta: cpdText(item.eta, 12), distance: cpdText(item.distance, 12), minOrder: cpdText(item.minOrder, 16), tags: (Array.isArray(item.tags) ? item.tags : []).slice(0, 3).map(tag => cpdText(tag, 8)).filter(Boolean), pick: cpdText(item.pick, 40) } : null) }),
        valid: data => data.items.length > 0
    },
    'takeout:saved': {
        title: '红包卡券',
        prompt: '生成这个角色外卖账户里的 3-6 张红包/优惠券，有的快过期，有的是店铺专属。',
        schema: '{"items":[{"title":"券名","amount":"¥8","condition":"满35可用","expires":"今天23:59到期","shop":"适用店铺或全平台"}]}',
        normalize: data => ({ items: cpdList(data.items, 8, item => cpdText(item.title, 30) ? { title: cpdText(item.title, 30), amount: cpdText(item.amount, 12), condition: cpdText(item.condition, 30), expires: cpdText(item.expires, 30), shop: cpdText(item.shop, 30) } : null) }),
        valid: data => data.items.length > 0
    },
    'takeout:profile': {
        title: '我的',
        prompt: '生成这个角色外卖账户「我的」页：收货地址 1-3 个（只写到楼栋/区域，不写门牌号等隐私细节）、收藏的店 2-4 家、本月统计。',
        schema: '{"addresses":[{"label":"家|公司|其他","text":"地址到楼栋","contact":"称呼"}],"favorites":[{"name":"店名","note":"为什么常点"}],"month":{"orders":12,"spent":"¥486","saved":"¥63"}}',
        normalize: data => ({
            addresses: cpdList(data.addresses, 3, item => cpdText(item.text, 60) ? { label: cpdText(item.label, 6), text: cpdText(item.text, 60), contact: cpdText(item.contact, 16) } : null),
            favorites: cpdList(data.favorites, 5, item => cpdText(item.name, 30) ? { name: cpdText(item.name, 30), note: cpdText(item.note, 50) } : null),
            month: { orders: cpdText(data.month?.orders, 8), spent: cpdText(data.month?.spent, 16), saved: cpdText(data.month?.saved, 16) }
        }),
        valid: data => data.addresses.length + data.favorites.length > 0
    },
    'games:library': {
        title: '资料库',
        prompt: '生成这个角色游戏资料库里拥有的 4-8 款游戏，只能是符合人设会玩的；没玩完的、吃灰的都可以有。',
        schema: '{"items":[{"title":"游戏名","platform":"平台","hours":"126小时","status":"在玩|已通关|吃灰|刚买","note":"一句评价"}]}',
        normalize: data => ({ items: cpdList(data.items, 10, item => cpdText(item.title, 40) ? { title: cpdText(item.title, 40), platform: cpdText(item.platform, 16), hours: cpdText(item.hours, 16), status: cpdText(item.status, 8), note: cpdText(item.note, 60) } : null) }),
        valid: data => data.items.length > 0
    },
    'games:profile': {
        title: '玩家',
        prompt: '生成这个角色的游戏玩家主页：昵称、等级、最近解锁的 3-5 个成就、2-4 个游戏好友及状态。',
        schema: '{"nickname":"游戏昵称","level":"Lv.42","bio":"签名","achievements":[{"title":"成就名","game":"游戏","time":"3天前"}],"friends":[{"name":"好友","status":"在线 · 正在玩xx"}]}',
        normalize: data => ({
            nickname: cpdText(data.nickname, 24), level: cpdText(data.level, 12), bio: cpdText(data.bio, 60),
            achievements: cpdList(data.achievements, 6, item => cpdText(item.title, 30) ? { title: cpdText(item.title, 30), game: cpdText(item.game, 30), time: cpdText(item.time, 16) } : null),
            friends: cpdList(data.friends, 5, item => cpdText(item.name, 20) ? { name: cpdText(item.name, 20), status: cpdText(item.status, 40) } : null)
        }),
        valid: data => !!data.nickname || data.achievements.length > 0
    },
    'footprints:saved': {
        title: '收藏地点',
        prompt: '生成这个角色地图里收藏的 4-7 个地点，要符合他/她的生活圈和世界观。',
        schema: '{"items":[{"name":"地点名","address":"区域/街道","tag":"常去|想去|工作|家人","note":"一句备注"}]}',
        normalize: data => ({ items: cpdList(data.items, 9, item => cpdText(item.name, 30) ? { name: cpdText(item.name, 30), address: cpdText(item.address, 50), tag: cpdText(item.tag, 6), note: cpdText(item.note, 60) } : null) }),
        valid: data => data.items.length > 0
    },
    'footprints:profile': {
        title: '我的足迹',
        prompt: '生成这个角色地图「我的」页的足迹统计：今年去过的城市/区域 3-6 个及次数，加一句年度总结。',
        schema: '{"summary":"一句总结","cities":[{"name":"城市或区域","visits":12,"note":"去做什么"}]}',
        normalize: data => ({ summary: cpdText(data.summary, 80), cities: cpdList(data.cities, 8, item => cpdText(item.name, 20) ? { name: cpdText(item.name, 20), visits: cpdText(item.visits, 6), note: cpdText(item.note, 40) } : null) }),
        valid: data => data.cities.length > 0
    }
};

const CHAR_PHONE_RECORD_SPECS = {
    wallet: {
        title: '账单详情',
        prompt: '把这条钱包记录展开成完整的支付凭证：交易单号、商户单号、支付方式、商品或服务明细。消费类交易如果商户会开票，给出电子发票（invoice），转账/红包/收入不需要发票时 invoice 为 null。金额要和记录一致。',
        schema: '{"merchant":"商户全称","amount":-36.5,"status":"支付成功|已退款|对方已收款|已入账","category":"分类","method":"支付方式","time":"2026-10-21 19:42:08","orderNo":"交易单号","merchantNo":"商户单号","items":[{"name":"明细","qty":1,"price":"¥18.00"}],"note":"备注","invoice":{"type":"电子发票（普通发票）","number":"20位发票号码","issuedAt":"2026-10-21","buyer":"购买方名称","buyerTaxNo":"个人可留空","seller":"销售方名称","sellerTaxNo":"18位统一社会信用代码","lines":[{"name":"*餐饮服务*餐费","amount":"34.43","rate":"6%","tax":"2.07"}],"total":"36.50","totalCn":"叁拾陆圆伍角"}}',
        normalize: (data, row) => {
            const invoice = data.invoice && typeof data.invoice === 'object' ? {
                type: cpdText(data.invoice.type, 20) || '电子发票（普通发票）', number: cpdText(data.invoice.number, 24), issuedAt: cpdText(data.invoice.issuedAt, 20),
                buyer: cpdText(data.invoice.buyer, 40), buyerTaxNo: cpdText(data.invoice.buyerTaxNo, 24), seller: cpdText(data.invoice.seller, 40), sellerTaxNo: cpdText(data.invoice.sellerTaxNo, 24),
                lines: cpdList(data.invoice.lines, 6, line => cpdText(line.name, 40) ? { name: cpdText(line.name, 40), amount: cpdText(line.amount, 14), rate: cpdText(line.rate, 6), tax: cpdText(line.tax, 12) } : null),
                total: cpdText(data.invoice.total, 16), totalCn: cpdText(data.invoice.totalCn, 30)
            } : null;
            return {
                merchant: cpdText(data.merchant, 40) || cpdText(row.title, 40), amount: cpdNumber(data.amount), amountText: cpdText(data.amount, 20),
                status: cpdText(data.status, 12) || '支付成功', category: cpdText(data.category, 10), method: cpdText(data.method, 30), time: cpdText(data.time, 30),
                orderNo: cpdText(data.orderNo, 40), merchantNo: cpdText(data.merchantNo, 40), note: cpdText(data.note, 80),
                items: cpdList(data.items, 10, item => cpdText(item.name, 40) ? { name: cpdText(item.name, 40), qty: cpdText(item.qty, 6), price: cpdText(item.price, 16) } : null),
                invoice: invoice && (invoice.number || invoice.lines.length) ? invoice : null
            };
        },
        valid: data => !!data.merchant
    },
    shopping: {
        title: '订单详情',
        prompt: '把这条购物记录展开成完整订单：店铺、商品明细与规格、价格构成、付款方式、下单/付款/发货时间、收货信息（地址只写到区域，收件人用称呼）、物流轨迹（按时间倒序 3-6 条，和订单状态一致）。',
        schema: '{"shop":"店铺","status":"待发货|运输中|已签收|已完成|退款中","items":[{"name":"商品","spec":"规格","qty":1,"price":"¥129.00"}],"goodsTotal":"¥129.00","freight":"¥0.00","discount":"-¥10.00","paid":"¥119.00","method":"支付方式","orderNo":"订单号","createdAt":"下单时间","paidAt":"付款时间","shippedAt":"发货时间或空","receiver":"称呼","address":"区域地址","carrier":"快递公司","trackingNo":"运单号","tracks":[{"time":"10-21 14:02","text":"物流节点"}]}',
        normalize: (data, row) => ({
            shop: cpdText(data.shop, 30) || cpdText(row.title, 30), status: cpdText(data.status, 10), method: cpdText(data.method, 20),
            items: cpdList(data.items, 8, item => cpdText(item.name, 60) ? { name: cpdText(item.name, 60), spec: cpdText(item.spec, 40), qty: cpdText(item.qty, 4) || '1', price: cpdText(item.price, 16) } : null),
            goodsTotal: cpdText(data.goodsTotal, 16), freight: cpdText(data.freight, 16), discount: cpdText(data.discount, 16), paid: cpdText(data.paid, 16),
            orderNo: cpdText(data.orderNo, 40), createdAt: cpdText(data.createdAt, 24), paidAt: cpdText(data.paidAt, 24), shippedAt: cpdText(data.shippedAt, 24),
            receiver: cpdText(data.receiver, 16), address: cpdText(data.address, 60), carrier: cpdText(data.carrier, 16), trackingNo: cpdText(data.trackingNo, 30),
            tracks: cpdList(data.tracks, 8, item => cpdText(item.text, 80) ? { time: cpdText(item.time, 20), text: cpdText(item.text, 80) } : null)
        }),
        valid: data => data.items.length > 0
    },
    takeout: {
        title: '订单详情',
        prompt: '把这条外卖记录展开成完整外卖订单：菜品明细（份数、单价）、打包费、配送费、优惠、实付、骑手、送达时间、备注、订单进度（3-5 个节点）。',
        schema: '{"shop":"店名","status":"已送达|配送中|商家已接单|已取消","items":[{"name":"菜品","qty":1,"price":"¥28"}],"packing":"¥2","delivery":"¥3","discount":"-¥6","paid":"¥27","method":"支付方式","rider":"骑手称呼","eta":"预计/实际送达时间","address":"区域地址","remark":"订单备注","orderNo":"订单号","createdAt":"下单时间","timeline":[{"time":"19:02","text":"节点"}]}',
        normalize: (data, row) => ({
            shop: cpdText(data.shop, 30) || cpdText(row.title, 30), status: cpdText(data.status, 10), method: cpdText(data.method, 20),
            items: cpdList(data.items, 10, item => cpdText(item.name, 40) ? { name: cpdText(item.name, 40), qty: cpdText(item.qty, 4) || '1', price: cpdText(item.price, 12) } : null),
            packing: cpdText(data.packing, 12), delivery: cpdText(data.delivery, 12), discount: cpdText(data.discount, 12), paid: cpdText(data.paid, 12),
            rider: cpdText(data.rider, 16), eta: cpdText(data.eta, 24), address: cpdText(data.address, 60), remark: cpdText(data.remark, 60),
            orderNo: cpdText(data.orderNo, 40), createdAt: cpdText(data.createdAt, 24),
            timeline: cpdList(data.timeline, 6, item => cpdText(item.text, 50) ? { time: cpdText(item.time, 12), text: cpdText(item.text, 50) } : null)
        }),
        valid: data => data.items.length > 0
    },
    schedule: {
        title: '日程详情',
        prompt: '把这条日程展开成日历事件详情：地点、时间段、参与人、提醒、角色自己写的备注和待准备事项。',
        schema: '{"title":"标题","start":"10月22日 14:00","end":"15:30","location":"地点","attendees":["参与人"],"alert":"提前15分钟","notes":"角色写的备注","todo":["要准备的事"]}',
        normalize: (data, row) => ({
            title: cpdText(data.title, 40) || cpdText(row.title, 40), start: cpdText(data.start, 30), end: cpdText(data.end, 30), location: cpdText(data.location, 50), alert: cpdText(data.alert, 20),
            attendees: (Array.isArray(data.attendees) ? data.attendees : []).slice(0, 6).map(item => cpdText(item, 16)).filter(Boolean),
            notes: cpdLong(data.notes, 400), todo: (Array.isArray(data.todo) ? data.todo : []).slice(0, 6).map(item => cpdText(item, 40)).filter(Boolean)
        }),
        valid: data => !!data.title
    },
    footprints: {
        title: '足迹详情',
        prompt: '把这条足迹展开：具体地址（到街道/楼栋，不写门牌）、到达和离开时间、停留时长、同行的人、在那里做了什么、角色的一句私人备注。',
        schema: '{"place":"地点","address":"地址","arrived":"14:10","left":"16:40","duration":"2小时30分","with":["同行人"],"did":"在那里做了什么","note":"私人备注"}',
        normalize: (data, row) => ({
            place: cpdText(data.place, 30) || cpdText(row.title, 30), address: cpdText(data.address, 60), arrived: cpdText(data.arrived, 20), left: cpdText(data.left, 20), duration: cpdText(data.duration, 16),
            with: (Array.isArray(data.with) ? data.with : []).slice(0, 5).map(item => cpdText(item, 16)).filter(Boolean), did: cpdLong(data.did, 300), note: cpdLong(data.note, 200)
        }),
        valid: data => !!data.place
    },
    games: {
        title: '游戏记录',
        prompt: '把这条游戏记录展开：平台、总时长、最近一次游玩、当前进度/段位、最近战绩或存档 2-4 条、角色对这款游戏的一句吐槽。',
        schema: '{"game":"游戏","platform":"平台","total":"总时长","last":"最近游玩","progress":"进度或段位","sessions":[{"time":"昨天 23:10","result":"战绩或进度"}],"comment":"一句吐槽"}',
        normalize: (data, row) => ({
            game: cpdText(data.game, 40) || cpdText(row.title, 40), platform: cpdText(data.platform, 16), total: cpdText(data.total, 16), last: cpdText(data.last, 20), progress: cpdText(data.progress, 40),
            sessions: cpdList(data.sessions, 5, item => cpdText(item.result, 60) ? { time: cpdText(item.time, 20), result: cpdText(item.result, 60) } : null), comment: cpdText(data.comment, 80)
        }),
        valid: data => !!data.game
    }
};

// ---------- generation ----------
function buildCharPhoneDetailContext(char) {
    const parts = [];
    try {
        if (typeof buildWechatIdentityContextPrompt === 'function') {
            parts.push(stripWechatPromptText(buildWechatIdentityContextPrompt(char, typeof getWechatChatUserProfile === 'function' ? getWechatChatUserProfile(char) : {}), 800));
        }
    } catch (error) { console.warn('[char-phone details] identity context unavailable', error); }
    parts.push(typeof getWechatCharacterPersonaText === 'function' ? getWechatCharacterPersonaText(char, 2600) : String(char.description || '').slice(0, 2600));
    if (typeof buildWechatWorldBookPrompt === 'function') parts.push(stripWechatPromptText(buildWechatWorldBookPrompt(char, 10), 1200));
    if (typeof buildWechatMemoryPrompt === 'function') parts.push(stripWechatPromptText(buildWechatMemoryPrompt(char), 600));
    const history = typeof buildWechatRecentHistoryForPrompt === 'function' ? buildWechatRecentHistoryForPrompt(char, 6) : '';
    return { profile: parts.filter(Boolean).join('\n\n'), history };
}

function charPhoneAppLabel(app) {
    return (typeof getWechatAiPhoneAllApps === 'function' ? getWechatAiPhoneAllApps() : []).find(item => item.key === app)?.label || app;
}

async function requestCharPhoneDetailJson(char, app, spec, extra) {
    const context = buildCharPhoneDetailContext(char);
    const today = new Date();
    const messages = [
        {
            role: 'system',
            content: `你在为「${char.name}」本人手机里的「${charPhoneAppLabel(app)}」生成一页真实数据。读角色资料后按这个角色的身份、经济状况、城市/世界观和最近生活来写，内容要具体、像真实 App 里的数据，不要模板化，不要写解释。古风/架空世界观就换成符合世界观的叫法和货币。只返回一个可 JSON.parse 的 JSON 对象，不要 Markdown 代码块。\n任务：${spec.prompt}\n格式：${spec.schema}`
        },
        {
            role: 'user',
            content: `【今天】${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日\n【角色资料】${context.profile}\n【最近聊天】${context.history || '（无）'}${extra ? `\n${extra}` : ''}`
        }
    ];
    const result = await callChatApi(messages, { max_tokens: 3000, temperature: 0.85, presetOverride: null, usageFeature: 'charPhone', usageChar: char, skipStatusValidationRetry: true });
    if (!result || !result.ok) throw new Error((result && result.error) || '请求失败');
    const parsed = parseWechatJsonObject(result.content);
    if (!parsed) throw new Error('AI 返回的内容不是有效的 JSON，可以点重试。');
    return parsed;
}

window._charPhoneDetailPending = window._charPhoneDetailPending || new Map();
window._charPhoneDetailErrors = window._charPhoneDetailErrors || new Map();

function startCharPhoneDetailJob(char, jobKey, run) {
    const pending = window._charPhoneDetailPending;
    if (pending.has(jobKey)) return pending.get(jobKey);
    window._charPhoneDetailErrors.delete(jobKey);
    const promise = Promise.resolve().then(run).then(async () => {
        if (await saveCharactersToStorage() === false) throw new Error('内容已生成，但没能保存到本机存储。');
    }).catch(error => {
        console.error('[char-phone details]', jobKey, error);
        window._charPhoneDetailErrors.set(jobKey, error?.message || String(error));
    }).finally(() => {
        pending.delete(jobKey);
        if (window._wechatAiPhoneOpenCharId === char.id) cpdRerender();
    });
    pending.set(jobKey, promise);
    return promise;
}

function generateCharPhonePage(char, app, view, snapshot) {
    const id = `${app}:${view}`;
    const spec = CHAR_PHONE_PAGE_SPECS[id];
    if (!spec) return null;
    return startCharPhoneDetailJob(char, `page:${char.id}:${id}`, async () => {
        const data = spec.normalize(await requestCharPhoneDetailJson(char, app, spec, charPhonePageExtraContext(app, snapshot, char)));
        if (!spec.valid(data)) throw new Error('AI 返回的内容是空的，可以点重试。');
        const store = getCharPhoneDetailStore(char);
        store.pages[id] = { version: charPhoneSnapshotVersion(snapshot), at: Date.now(), data };
        pruneCharPhoneDetailStore(store);
    });
}

function generateCharPhoneRecord(char, app, row) {
    const spec = CHAR_PHONE_RECORD_SPECS[app];
    if (!spec) return null;
    const key = charPhoneRecordKey(app, row);
    return startCharPhoneDetailJob(char, `record:${char.id}:${key}`, async () => {
        const fields = Object.fromEntries(Object.entries(row).filter(([name, value]) => !name.startsWith('_') && value !== '' && value != null));
        const record = `【要展开的这条记录】${JSON.stringify(fields).slice(0, 800)}`;
        const data = spec.normalize(await requestCharPhoneDetailJson(char, app, spec, record), row);
        if (!spec.valid(data)) throw new Error('AI 返回的内容是空的，可以点重试。');
        const store = getCharPhoneDetailStore(char);
        store.records[key] = { at: Date.now(), row: { title: row.title, detail: row.detail, meta: row.meta }, data };
        pruneCharPhoneDetailStore(store);
    });
}

// Pages see what the phone already shows, so they stay consistent with it.
function charPhonePageExtraContext(app, snapshot, char) {
    const pick = {
        wallet: () => ({ 余额: snapshot.wallet, 最近交易: getWechatAiPhoneWalletRows(snapshot, char) }),
        shopping: () => ({ 订单: getWechatAiPhoneShoppingRows(snapshot, char) }),
        takeout: () => ({ 订单: getWechatAiPhoneTakeoutRows(snapshot, char) }),
        games: () => ({ 最近游玩: getWechatAiPhoneGameRows(snapshot, char) }),
        footprints: () => ({ 最近足迹: getWechatAiPhoneFootprintRows(snapshot, char) })
    }[app];
    const persona = snapshot?.appData?.[app];
    if (!pick && !persona) return '';
    const value = pick ? pick() : { 余额: persona.balance, 记录: (persona.items || []).slice(0, 8) };
    try { return `【手机里已有的数据，要和它一致】${JSON.stringify(value).slice(0, 1400)}`; }
    catch (error) { console.warn('[char-phone details] context', error); return ''; }
}

// ---------- open / close ----------
function openCharPhoneRecord(app, index, source = 'list') {
    window._charPhoneRecord = { app, index: Number(index), source };
    cpdRerender();
}
function closeCharPhoneRecord() {
    window._charPhoneRecord = null;
    window._charPhoneDetail = null;
    window._charPhoneInvoiceOpen = false;
    cpdRerender();
}
function toggleCharPhoneInvoice(open) {
    window._charPhoneInvoiceOpen = !!open;
    cpdRerender();
}
function retryCharPhoneDetail(kind) {
    const char = cpdChar();
    if (!char) return;
    const snapshot = getWechatAiPhoneRenderSnapshot(char);
    if (kind === 'page') {
        const current = window._charPhoneLazyCurrent;
        if (current) generateCharPhonePage(char, current.app, current.view, snapshot);
    } else {
        const ref = charPhoneActiveRecordRef();
        const row = charPhoneRecordRow(char, snapshot, ref);
        if (row) generateCharPhoneRecord(char, ref.app, row);
    }
    cpdRerender();
}
function regenerateCharPhoneDetail(kind) {
    const char = cpdChar();
    if (!char) return;
    const store = getCharPhoneDetailStore(char);
    const snapshot = getWechatAiPhoneRenderSnapshot(char);
    if (kind === 'page') {
        const current = window._charPhoneLazyCurrent;
        if (current) delete store.pages[`${current.app}:${current.view}`];
    } else {
        const ref = charPhoneActiveRecordRef();
        const row = charPhoneRecordRow(char, snapshot, ref);
        if (row) delete store.records[charPhoneRecordKey(ref.app, row)];
    }
    retryCharPhoneDetail(kind);
}

// The row a record page expands: from the app's own list, or from a generated bill.
function charPhoneRecordRows(app, snapshot, char) {
    return ({
        wallet: () => getWechatAiPhoneWalletRows(snapshot, char),
        shopping: () => getWechatAiPhoneShoppingRows(snapshot, char),
        takeout: () => getWechatAiPhoneTakeoutRows(snapshot, char),
        schedule: () => getWechatAiPhoneScheduleRows(snapshot, char),
        footprints: () => getWechatAiPhoneFootprintRows(snapshot, char),
        games: () => getWechatAiPhoneGameRows(snapshot, char)
    }[app] || (() => charPhoneNativeRecordRows(app, snapshot)))();
}
// Persona apps keep their records in appData; give the generator every field the list shows.
function charPhoneNativeRecordRows(app, snapshot) {
    const items = snapshot?.appData?.[app]?.items;
    if (!Array.isArray(items)) return [];
    return items.map(item => ({
        title: item.title, detail: item.body, meta: item.time || item.meta, amount: item.amount, status: item.status,
        symbol: item.symbol, price: item.price, change: item.change, quantity: item.quantity, from: item.from, to: item.to,
        checkIn: item.checkIn, checkOut: item.checkOut, tier: item.tier, author: item.author
    }));
}
function charPhoneRecordRow(char, snapshot, ref) {
    if (!ref) return null;
    if (ref.source === 'bills') {
        const bill = getCharPhoneDetailStore(char).pages[`${ref.app}:bills`]?.data?.items?.[ref.index];
        return bill ? { title: bill.merchant, detail: [bill.category, bill.method, bill.note].filter(Boolean).join(' · '), meta: bill.date, amount: String(bill.amount) } : null;
    }
    return charPhoneRecordRows(ref.app, snapshot, char)[ref.index] || null;
}

// ---------- shared states ----------
function charPhoneDetailState(jobKey, label, kind) {
    const error = window._charPhoneDetailErrors.get(jobKey);
    if (error) {
        return `<div class="cpd-state is-error" role="alert"><i class="ri-error-warning-line"></i><b>${cpdEsc(label)}没能生成</b><p>${cpdEsc(error)}</p><button type="button" onclick="retryCharPhoneDetail('${kind}')">重试</button></div>`;
    }
    return `<div class="cpd-state" role="status" aria-live="polite"><span class="cpd-spinner" aria-hidden="true"></span><b>正在生成${cpdEsc(label)}…</b><p>按 TA 的人设和最近的生活写，只在第一次打开时生成。</p></div>`;
}
function charPhoneDetailFooter(kind, stale) {
    return `<div class="cpd-footer">${stale ? '<span>手机已重新同步，这页还是旧的</span>' : '<span>由 AI 按角色生成</span>'}<button type="button" onclick="regenerateCharPhoneDetail('${kind}')">重新生成</button></div>`;
}

// ---------- pages ----------
function charPhoneHasLazyPage(app, view) {
    return !!CHAR_PHONE_PAGE_SPECS[`${app}:${view}`];
}
function renderCharPhoneLazyPage(app, view, snapshot, char) {
    const id = `${app}:${view}`;
    const spec = CHAR_PHONE_PAGE_SPECS[id];
    window._charPhoneLazyCurrent = { app, view };
    const saved = getCharPhoneDetailStore(char).pages[id];
    const jobKey = `page:${char.id}:${id}`;
    const version = charPhoneSnapshotVersion(snapshot);
    const pending = window._charPhoneDetailPending.has(jobKey);
    const failed = window._charPhoneDetailErrors.has(jobKey);
    // Opening the page is the user's request; start once, never loop on errors.
    if (!saved && !pending && !failed) generateCharPhonePage(char, app, view, snapshot);
    if (!saved) return charPhoneDetailState(jobKey, spec.title, 'page');
    const stale = !!version && saved.version !== version;
    const body = CHAR_PHONE_PAGE_RENDERERS[id](saved.data, char, snapshot, app);
    const busy = window._charPhoneDetailPending.has(jobKey) ? `<div class="cpd-refreshing" role="status"><span class="cpd-spinner" aria-hidden="true"></span>正在更新…</div>` : '';
    const error = failed ? `<div class="cpd-inline-error" role="alert">${cpdEsc(window._charPhoneDetailErrors.get(jobKey))}<button type="button" onclick="retryCharPhoneDetail('page')">重试</button></div>` : '';
    return `${busy}${error}${body}${charPhoneDetailFooter('page', stale)}`;
}

function cpdBillsSummary(items) {
    let out = 0, income = 0;
    for (const item of items) {
        if (item.amount < 0) out += -item.amount; else income += item.amount;
    }
    return { out, income };
}
function cpdMoney(amount) {
    const sign = amount < 0 ? '-' : '+';
    return `${sign}${Math.abs(amount).toFixed(2)}`;
}

const CHAR_PHONE_PAGE_RENDERERS = {
    'wallet:bills': (data, char, snapshot, app = 'wallet') => {
        const filter = window._charPhoneSections?.walletBills || 0;
        const items = data.items.map((item, index) => ({ ...item, index }))
            .filter(item => filter === 0 || (filter === 1 ? item.amount < 0 : item.amount >= 0));
        const { out, income } = cpdBillsSummary(data.items);
        const categories = {};
        data.items.filter(item => item.amount < 0).forEach(item => { categories[item.category] = (categories[item.category] || 0) - item.amount; });
        const top = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const tabs = ['全部', '支出', '收入'].map((label, index) => `<button type="button" class="${filter === index ? 'active' : ''}" aria-pressed="${filter === index}" onclick="setCharPhoneBillFilter(${index})">${label}</button>`).join('');
        return `<section class="cpd-bills">
            <div class="cpd-bills-month"><b>${cpdEsc(data.month || '本月')}</b><span>支出 <strong>¥${out.toFixed(2)}</strong></span><span>收入 <strong>¥${income.toFixed(2)}</strong></span></div>
            ${top.length ? `<div class="cpd-bills-bars" aria-label="支出分类">${top.map(([name, value]) => `<div><span>${cpdEsc(name)}</span><i><b style="width:${Math.max(6, Math.round(value / (top[0][1] || 1) * 100))}%"></b></i><em>¥${value.toFixed(0)}</em></div>`).join('')}</div>` : ''}
            <div class="cpd-filter" role="group" aria-label="筛选">${tabs}</div>
            <div class="cpd-bill-list">${items.map(item => `<button type="button" class="cpd-bill" onclick="openCharPhoneRecord('${app}',${item.index},'bills')">
                <span class="cpd-bill-icon">${cpdEsc((item.category || '其').slice(0, 1))}</span>
                <span class="cpd-bill-main"><b>${cpdEsc(item.merchant)}</b><small>${cpdEsc([item.date, item.method].filter(Boolean).join(' · '))}</small></span>
                <strong class="${item.amount < 0 ? '' : 'is-income'}">${cpdMoney(item.amount)}</strong>
            </button>`).join('') || '<p class="cpd-empty">这个分类没有记录</p>'}</div>
        </section>`;
    },
    'shopping:discover': data => `<div class="cpd-goods-grid">${data.items.map(item => `<article class="cpd-goods"><div class="cpd-goods-art"><i class="ri-shopping-bag-3-line"></i></div><h3>${cpdEsc(item.title)}</h3>${item.reason ? `<em>${cpdEsc(item.reason)}</em>` : ''}<div><strong>${cpdEsc(item.price)}</strong><small>${cpdEsc(item.sales)}</small></div><small class="cpd-goods-shop">${cpdEsc(item.shop)}</small></article>`).join('')}</div>`,
    'shopping:video': data => `<div class="cpd-feed">${data.items.map(item => `<article class="cpd-feed-card"><h3>${cpdEsc(item.title)}</h3><p>${cpdEsc(item.body)}</p><small>${cpdEsc(item.author)} · ♡ ${cpdEsc(item.likes)}</small></article>`).join('')}</div>`,
    'shopping:messages': data => `<div class="cpd-messages">${data.items.map(item => `<div class="cpd-message"><span class="cpd-message-icon"><i class="${/物流/.test(item.kind) ? 'ri-truck-line' : /客服/.test(item.kind) ? 'ri-customer-service-2-line' : /售后/.test(item.kind) ? 'ri-refund-2-line' : 'ri-notification-3-line'}"></i></span><span><b>${cpdEsc(item.from)}</b><p>${cpdEsc(item.text)}</p></span><small>${cpdEsc(item.time)}</small></div>`).join('')}</div>`,
    'shopping:orders': data => {
        const total = data.items.reduce((sum, item) => sum + (cpdNumber(item.price) || 0) * item.qty, 0);
        return `<div class="cpd-cart">${data.items.map(item => `<div class="cpd-cart-item"><span class="cpd-cart-check" aria-hidden="true"></span><div class="cpd-goods-art small"><i class="ri-shopping-bag-3-line"></i></div><div><small>${cpdEsc(item.shop)}</small><b>${cpdEsc(item.title)}</b><em>${cpdEsc(item.spec)}</em><span><strong>${cpdEsc(item.price)}</strong><i>×${item.qty}</i></span></div></div>`).join('')}<div class="cpd-cart-total"><span>共 ${data.items.length} 件，合计 <strong>¥${total.toFixed(2)}</strong></span><b>还没结算</b></div></div>`;
    },
    'takeout:discover': data => `<div class="cpd-shops">${data.items.map(item => `<article class="cpd-shop"><div class="cpd-shop-art"><i class="ri-restaurant-2-line"></i></div><div><b>${cpdEsc(item.name)}</b><small>★ ${cpdEsc(item.rating)} · ${cpdEsc(item.eta)} · ${cpdEsc(item.distance)}</small><small>${cpdEsc(item.minOrder)}</small>${item.tags.length ? `<span>${item.tags.map(tag => `<em>${cpdEsc(tag)}</em>`).join('')}</span>` : ''}${item.pick ? `<p>常点：${cpdEsc(item.pick)}</p>` : ''}</div></article>`).join('')}</div>`,
    'takeout:saved': data => `<div class="cpd-coupons">${data.items.map(item => `<article class="cpd-coupon"><strong>${cpdEsc(item.amount)}</strong><div><b>${cpdEsc(item.title)}</b><small>${cpdEsc(item.condition)} · ${cpdEsc(item.shop)}</small><em>${cpdEsc(item.expires)}</em></div></article>`).join('')}</div>`,
    'takeout:profile': data => `<div class="cpd-card-list">
        ${data.month.orders || data.month.spent ? `<div class="cpd-stats"><div><strong>${cpdEsc(data.month.orders || '—')}</strong><small>本月订单</small></div><div><strong>${cpdEsc(data.month.spent || '—')}</strong><small>本月花费</small></div><div><strong>${cpdEsc(data.month.saved || '—')}</strong><small>已省</small></div></div>` : ''}
        ${data.addresses.length ? `<h3>收货地址</h3>${data.addresses.map(item => `<div class="cpd-row"><em>${cpdEsc(item.label)}</em><span><b>${cpdEsc(item.text)}</b><small>${cpdEsc(item.contact)}</small></span></div>`).join('')}` : ''}
        ${data.favorites.length ? `<h3>收藏的店</h3>${data.favorites.map(item => `<div class="cpd-row"><i class="ri-heart-3-fill"></i><span><b>${cpdEsc(item.name)}</b><small>${cpdEsc(item.note)}</small></span></div>`).join('')}` : ''}
    </div>`,
    'games:library': data => `<div class="cpd-card-list">${data.items.map(item => `<div class="cpd-row cpd-game-row"><span class="cpd-game-art"><i class="ri-gamepad-fill"></i></span><span><b>${cpdEsc(item.title)}</b><small>${cpdEsc([item.platform, item.hours].filter(Boolean).join(' · '))}</small>${item.note ? `<small>${cpdEsc(item.note)}</small>` : ''}</span><em>${cpdEsc(item.status)}</em></div>`).join('')}</div>`,
    'games:profile': (data, char) => `<div class="cpd-card-list">
        <div class="cpd-player"><img src="${cpdAttr(getWechatAiPhoneHomeAvatar(char))}" alt=""><div><b>${cpdEsc(data.nickname || getWechatCharDisplayName(char))}</b><small>${cpdEsc(data.level)}</small>${data.bio ? `<p>${cpdEsc(data.bio)}</p>` : ''}</div></div>
        ${data.achievements.length ? `<h3>最近成就</h3>${data.achievements.map(item => `<div class="cpd-row"><i class="ri-trophy-line"></i><span><b>${cpdEsc(item.title)}</b><small>${cpdEsc(item.game)}</small></span><em>${cpdEsc(item.time)}</em></div>`).join('')}` : ''}
        ${data.friends.length ? `<h3>好友</h3>${data.friends.map(item => `<div class="cpd-row"><span class="cpd-initial">${cpdEsc(item.name.slice(0, 1))}</span><span><b>${cpdEsc(item.name)}</b><small>${cpdEsc(item.status)}</small></span></div>`).join('')}` : ''}
    </div>`,
    'footprints:saved': data => `<div class="cpd-card-list">${data.items.map(item => `<div class="cpd-row"><i class="ri-star-fill"></i><span><b>${cpdEsc(item.name)}</b><small>${cpdEsc(item.address)}</small>${item.note ? `<small>${cpdEsc(item.note)}</small>` : ''}</span><em>${cpdEsc(item.tag)}</em></div>`).join('')}</div>`,
    'footprints:profile': data => `<div class="cpd-card-list">${data.summary ? `<p class="cpd-summary">${cpdEsc(data.summary)}</p>` : ''}<h3>去过的地方</h3>${data.cities.map(item => `<div class="cpd-row"><i class="ri-map-pin-2-line"></i><span><b>${cpdEsc(item.name)}</b><small>${cpdEsc(item.note)}</small></span><em>${cpdEsc(item.visits)} 次</em></div>`).join('')}</div>`
};

function setCharPhoneBillFilter(index) {
    window._charPhoneSections = { ...window._charPhoneSections, walletBills: Number(index) || 0 };
    cpdRerender();
}

// ---------- record detail ----------
// Record pages open from our own lists (_charPhoneRecord) or from a persona app's item (_charPhoneDetail).
function charPhoneActiveRecordRef() {
    if (window._charPhoneRecord) return window._charPhoneRecord;
    const detail = window._charPhoneDetail;
    if (detail && CHAR_PHONE_RECORD_SPECS[detail.key] && CHAR_PHONE_RECORD_RENDERERS[detail.key]) return { app: detail.key, index: Number(detail.index), source: 'native' };
    return null;
}
function charPhoneRecordOpenFor(app) {
    const ref = charPhoneActiveRecordRef();
    return ref && ref.app === app ? ref : null;
}
function renderCharPhoneRecordDetail(app, snapshot, char) {
    const ref = charPhoneRecordOpenFor(app);
    const spec = CHAR_PHONE_RECORD_SPECS[app];
    const row = charPhoneRecordRow(char, snapshot, ref);
    if (!ref || !spec || !row) return null;
    const key = charPhoneRecordKey(app, row);
    const jobKey = `record:${char.id}:${key}`;
    const saved = getCharPhoneDetailStore(char).records[key];
    if (!saved && !window._charPhoneDetailPending.has(jobKey) && !window._charPhoneDetailErrors.has(jobKey)) generateCharPhoneRecord(char, app, row);
    const back = ref.source === 'bills' ? '账单' : charPhoneAppLabel(app);
    if (saved?.data.invoice && window._charPhoneInvoiceOpen) {
        return `<section class="cp-native cpd-page cpd-app-${app}" data-app-layout="${app}-invoice"><div class="cpd-nav"><button type="button" onclick="toggleCharPhoneInvoice(false)"><i class="ri-arrow-left-s-line"></i>账单详情</button><b>电子发票</b><span></span></div><div class="cp-scroll">${renderCharPhoneInvoice(saved.data, char)}</div></section>`;
    }
    const body = saved ? CHAR_PHONE_RECORD_RENDERERS[app](saved.data, row, char) + charPhoneDetailFooter('record', false) : charPhoneDetailState(jobKey, spec.title, 'record');
    return `<section class="cp-native cpd-page cpd-app-${app}" data-app-layout="${app}-detail"><div class="cpd-nav"><button type="button" onclick="closeCharPhoneRecord()"><i class="ri-arrow-left-s-line"></i>${cpdEsc(back)}</button><b>${cpdEsc(spec.title)}</b><span></span></div><div class="cp-scroll">${body}</div></section>`;
}

function cpdFields(rows) {
    const list = rows.filter(([, value]) => value);
    return list.length ? `<dl class="cpd-fields">${list.map(([label, value]) => `<div><dt>${cpdEsc(label)}</dt><dd>${cpdEsc(value)}</dd></div>`).join('')}</dl>` : '';
}

const CHAR_PHONE_RECORD_RENDERERS = {
    wallet: (data, row) => {
        const amount = data.amount != null ? data.amount : cpdNumber(row.amount || row.title);
        const amountText = amount != null ? cpdMoney(amount) : data.amountText;
        return `<div class="cpd-receipt">
            <div class="cpd-receipt-head"><span class="cpd-receipt-logo">${cpdEsc(data.merchant.slice(0, 1))}</span><b>${cpdEsc(data.merchant)}</b><strong>${cpdEsc(amountText || '')}</strong><em>${cpdEsc(data.status)}</em></div>
            ${cpdFields([['支付时间', data.time], ['支付方式', data.method], ['交易分类', data.category], ['交易单号', data.orderNo], ['商户单号', data.merchantNo], ['备注', data.note]])}
            ${data.items.length ? `<div class="cpd-section"><h3>明细</h3>${data.items.map(item => `<div class="cpd-line"><span>${cpdEsc(item.name)}${item.qty && item.qty !== '1' ? ` ×${cpdEsc(item.qty)}` : ''}</span><b>${cpdEsc(item.price)}</b></div>`).join('')}</div>` : ''}
            <div class="cpd-actions">${data.invoice ? `<button type="button" onclick="toggleCharPhoneInvoice(true)"><i class="ri-file-text-line"></i>查看电子发票</button>` : `<span class="cpd-muted">这笔交易没有发票</span>`}</div>
        </div>`;
    },
    shopping: data => `<div class="cpd-order">
        <div class="cpd-order-status"><b>${cpdEsc(data.status || '订单')}</b>${data.tracks[0] ? `<p>${cpdEsc(data.tracks[0].text)}</p>` : ''}</div>
        ${data.address ? `<div class="cpd-card cpd-address"><i class="ri-map-pin-2-line"></i><span><b>${cpdEsc(data.receiver)}</b><small>${cpdEsc(data.address)}</small></span></div>` : ''}
        <div class="cpd-card"><h3><i class="ri-store-2-line"></i>${cpdEsc(data.shop)}</h3>${data.items.map(item => `<div class="cpd-product"><div class="cpd-goods-art small"><i class="ri-shopping-bag-3-line"></i></div><div><b>${cpdEsc(item.name)}</b><small>${cpdEsc(item.spec)}</small></div><span><strong>${cpdEsc(item.price)}</strong><small>×${cpdEsc(item.qty)}</small></span></div>`).join('')}
            ${cpdFields([['商品总价', data.goodsTotal], ['运费', data.freight], ['优惠', data.discount], ['实付款', data.paid]])}</div>
        ${data.tracks.length ? `<div class="cpd-card"><h3><i class="ri-truck-line"></i>${cpdEsc([data.carrier, data.trackingNo].filter(Boolean).join(' '))}</h3><ol class="cpd-timeline">${data.tracks.map(item => `<li><b>${cpdEsc(item.text)}</b><small>${cpdEsc(item.time)}</small></li>`).join('')}</ol></div>` : ''}
        <div class="cpd-card">${cpdFields([['订单编号', data.orderNo], ['支付方式', data.method], ['下单时间', data.createdAt], ['付款时间', data.paidAt], ['发货时间', data.shippedAt]])}</div>
    </div>`,
    takeout: data => `<div class="cpd-order">
        <div class="cpd-order-status"><b>${cpdEsc(data.status || '订单')}</b>${data.eta ? `<p>${cpdEsc(data.eta)}${data.rider ? ` · 骑手 ${cpdEsc(data.rider)}` : ''}</p>` : ''}</div>
        <div class="cpd-card"><h3><i class="ri-restaurant-2-line"></i>${cpdEsc(data.shop)}</h3>${data.items.map(item => `<div class="cpd-line"><span>${cpdEsc(item.name)} <small>×${cpdEsc(item.qty)}</small></span><b>${cpdEsc(item.price)}</b></div>`).join('')}
            ${cpdFields([['打包费', data.packing], ['配送费', data.delivery], ['优惠', data.discount], ['实付', data.paid]])}</div>
        ${data.timeline.length ? `<div class="cpd-card"><h3><i class="ri-time-line"></i>订单进度</h3><ol class="cpd-timeline">${data.timeline.map(item => `<li><b>${cpdEsc(item.text)}</b><small>${cpdEsc(item.time)}</small></li>`).join('')}</ol></div>` : ''}
        <div class="cpd-card">${cpdFields([['送达地址', data.address], ['备注', data.remark], ['订单号', data.orderNo], ['下单时间', data.createdAt], ['支付方式', data.method]])}</div>
    </div>`,
    schedule: data => `<div class="cpd-event">
        <h2>${cpdEsc(data.title)}</h2><p>${cpdEsc([data.start, data.end].filter(Boolean).join(' – '))}</p>
        ${cpdFields([['地点', data.location], ['参与人', data.attendees.join('、')], ['提醒', data.alert]])}
        ${data.notes ? `<div class="cpd-section"><h3>备注</h3><p class="cpd-note">${cpdEsc(data.notes)}</p></div>` : ''}
        ${data.todo.length ? `<div class="cpd-section"><h3>要准备</h3><ul class="cpd-checklist">${data.todo.map(item => `<li>${cpdEsc(item)}</li>`).join('')}</ul></div>` : ''}
    </div>`,
    footprints: data => `<div class="cpd-event">
        <h2>${cpdEsc(data.place)}</h2><p>${cpdEsc(data.address)}</p>
        ${cpdFields([['到达', data.arrived], ['离开', data.left], ['停留', data.duration], ['同行', data.with.join('、')]])}
        ${data.did ? `<div class="cpd-section"><h3>做了什么</h3><p class="cpd-note">${cpdEsc(data.did)}</p></div>` : ''}
        ${data.note ? `<div class="cpd-section"><h3>私人备注</h3><p class="cpd-note">${cpdEsc(data.note)}</p></div>` : ''}
    </div>`,
    games: data => `<div class="cpd-event">
        <h2>${cpdEsc(data.game)}</h2><p>${cpdEsc(data.platform)}</p>
        ${cpdFields([['总时长', data.total], ['最近游玩', data.last], ['进度', data.progress]])}
        ${data.sessions.length ? `<div class="cpd-section"><h3>最近记录</h3>${data.sessions.map(item => `<div class="cpd-line"><span>${cpdEsc(item.result)}</span><small>${cpdEsc(item.time)}</small></div>`).join('')}</div>` : ''}
        ${data.comment ? `<div class="cpd-section"><h3>TA 说</h3><p class="cpd-note">${cpdEsc(data.comment)}</p></div>` : ''}
    </div>`
};

function renderCharPhoneInvoice(data, char) {
    const invoice = data.invoice;
    return `<article class="cpd-invoice" aria-label="电子发票">
        <div class="cpd-invoice-head"><h2>${cpdEsc(invoice.type)}</h2><dl><div><dt>发票号码</dt><dd>${cpdEsc(invoice.number)}</dd></div><div><dt>开票日期</dt><dd>${cpdEsc(invoice.issuedAt)}</dd></div></dl></div>
        <section class="cpd-invoice-parties">
            <div><h3>购买方</h3><p>名称：${cpdEsc(invoice.buyer || getWechatCharDisplayName(char))}</p>${invoice.buyerTaxNo ? `<p>统一社会信用代码/纳税人识别号：${cpdEsc(invoice.buyerTaxNo)}</p>` : ''}</div>
            <div><h3>销售方</h3><p>名称：${cpdEsc(invoice.seller || data.merchant)}</p>${invoice.sellerTaxNo ? `<p>统一社会信用代码/纳税人识别号：${cpdEsc(invoice.sellerTaxNo)}</p>` : ''}</div>
        </section>
        <table><thead><tr><th>项目名称</th><th>金额</th><th>税率</th><th>税额</th></tr></thead><tbody>${invoice.lines.map(line => `<tr><td>${cpdEsc(line.name)}</td><td>${cpdEsc(line.amount)}</td><td>${cpdEsc(line.rate)}</td><td>${cpdEsc(line.tax)}</td></tr>`).join('')}</tbody></table>
        <div class="cpd-invoice-foot"><span>价税合计（大写）${cpdEsc(invoice.totalCn)}</span><b>（小写）¥${cpdEsc(String(invoice.total || '').replace(/^¥/, ''))}</b></div>
        <p class="cpd-invoice-note">小手机里的虚构票据，仅作角色扮演展示。</p>
    </article>`;
}
