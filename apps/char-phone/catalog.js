/* Persona-selected phone apps. Templates own presentation; model owns content. */
const CHAR_PHONE_EXTRA_APPS = [
 ['instagram','Instagram','ri-instagram-line','pink','photo'],['x','X','ri-twitter-x-line','black','social'],
 ['red','小红书','ri-book-mark-fill','pink','discover'],['weibo','微博','ri-weibo-fill','orange','social'],
 ['douyin','抖音','ri-tiktok-fill','black','video'],['album','相册','ri-image-fill','blue','photo'],
 ['music','网易云音乐','ri-music-fill','pink','music'],['mail','邮箱','ri-mail-fill','blue','mail'],
 ['bank','私人银行','ri-bank-fill','black','finance'],['stocks','股票','ri-stock-fill','blue','market'],
 ['funds','基金','ri-funds-fill','orange','market'],['board','董事会','ri-briefcase-fill','black','calendar'],
 ['flights','私人飞机','ri-plane-fill','blue','booking'],['hotels','酒店预订','ri-hotel-fill','purple','booking'],
 ['luxury','奢侈品订单','ri-vip-diamond-fill','black','order'],['golf','高尔夫俱乐部','ri-flag-fill','green','membership'],
 ['alipay','支付宝','ri-alipay-fill','blue','finance']
].map(([key,label,icon,tone,template])=>({key,label,icon,tone,template}));
function normalizeCharPhoneApps(data, previous = {}) {
 const catalog=getWechatAiPhoneAllApps();
 const keys=new Set(catalog.map(a=>a.key));
 const keyOf=value=>{const text=String(value||'').trim();return keys.has(text)?text:catalog.find(a=>a.label.toLowerCase()===text.toLowerCase())?.key;};
 const raw=Array.isArray(data.installedApps)?data.installedApps:null;
 const installed=raw? [...new Set(raw.map(a=>keyOf(typeof a==='string'?a:a?.key||a?.name)).filter(Boolean))]:null;
 if(raw && !installed.length) throw new Error('模型没有返回有效的 App 列表，请重新同步');
 const appData={};
 for(const app of catalog){
  const provided=data.appData?.[app.key] || data.appData?.[app.label];
  const source=provided && (Array.isArray(provided.items) ? provided.items.some(i=>i && (i.title || i.body)) : false) ? provided : previous.appData?.[app.key] || provided;
  if(!source||typeof source!=='object'||Array.isArray(source))continue;
  const str=(v,n=500)=>typeof v==='string'?v.slice(0,n):typeof v==='number'?String(v):'';
  appData[app.key]={name:str(source.name,30),summary:str(source.summary,180),balance:str(source.balance,80),
   items:(Array.isArray(source.items)?source.items:[]).slice(0,12).filter(i=>i&&typeof i==='object').map(i=>({
    title:str(i.title,100),body:str(i.body),meta:str(i.meta,100),author:str(i.author,60),amount:str(i.amount,60),status:str(i.status,60),time:str(i.time,60),
    section:Number.isInteger(i.section)&&i.section>=0&&i.section<3?i.section:0,symbol:str(i.symbol,24),price:str(i.price,40),change:str(i.change,30),quantity:str(i.quantity,40),from:str(i.from,60),to:str(i.to,60),checkIn:str(i.checkIn,40),checkOut:str(i.checkOut,40),tier:str(i.tier,40),artist:str(i.artist,60),handle:str(i.handle,60),likes:str(i.likes,24),replies:str(i.replies,24),reposts:str(i.reposts,24),views:str(i.views,24),verified:String(i.verified)==='true'?'true':'',
    image:typeof i.image==='string'&&/^https?:\/\//.test(i.image)?i.image:''
   })).filter(i=>i.title||i.body)};
 }
 const appSyncMissing=(installed||[]).filter(key=>CHAR_PHONE_EXTRA_APPS.some(a=>a.key===key)&&!appData[key]?.items.length); 
 return {...(installed?{installedApps:installed}:{}),appData,appSyncMissing,deviceName:typeof data.deviceName==='string'?data.deviceName.slice(0,40):''};
}
function charPhoneCatalogPrompt(){
 return `\n新增字段 installedApps（App key 数组）、deviceName（手机或古风传音玉简名称）、appData（以 App key 为键的对象）。可选 App：${getWechatAiPhoneAllApps().map(a=>a.key+'='+a.label).join('，')}。先按角色人设/世界书自由决定装哪些 App，通常 6–12 个，不能所有角色都安装全部。chat 和 settings 保留。古风角色可将 App 的 name 改成符合世界观的名称。霸总或高净值角色可按实际设定选择私人银行、股票基金、董事会、私人飞机酒店、奢侈品、高尔夫；其他角色不要强加这些生活。每个选中的新增 App 都在 appData 填 {name,summary,balance,items:[{title,body,meta,author,amount,status,time}]}，每个 2–3 条。items 可带 section（0 默认，1 第二个分类，2 第三个分类），邮箱已发送 section=1，社交收藏或个人内容按实际分类标注。股票基金 items 额外填写 symbol,price,change,quantity；飞机填写 from,to,time；酒店填写 checkIn,checkOut；会籍填写 tier；音乐填写 artist。字段必须来自人设合理推演。社交写作者正文互动量，邮箱写发件人主题正文，金融写资产与交易金额，股票基金写持仓价格涨跌，预订写航线酒店日期确认状态，高尔夫写会籍预约，照片写画面描述，音乐写歌名歌手。image 仅在上下文提供真实图片 URL 时填写，不能捏造网址。内容自由创作但遵守人设时代财力，不是用户真实银行或订单。X 的 items 可额外填写 handle（账号）、likes、replies、reposts、views（互动数量），verified 布尔值，仅在设定支持时标认证；section=0 推荐帖子、1 关注帖子、2 私信。支付宝 section=0 收支账单、1 服务消息、2 生活服务。相册 section=1 相簿、2 收藏；音乐 section=1 歌单、2 播客；股票基金 section=1 持仓/交易；预订 section=1 历史记录。旧字段仍照原格式返回。`;
}
function openCharPhoneItem(key,index){window._charPhoneDetail={key,index}; const c=(window.myCharacters||[]).find(c=>c.id===window._wechatAiPhoneOpenCharId);if(c)renderWechatAiPhone(c);}
function closeCharPhoneItem(){window._charPhoneDetail=null;const c=(window.myCharacters||[]).find(c=>c.id===window._wechatAiPhoneOpenCharId);if(c)renderWechatAiPhone(c);}
function renderCharPhoneTemplate(key,snapshot,char){
 const app=CHAR_PHONE_EXTRA_APPS.find(a=>a.key===key);if(!app)return null;
 const data=snapshot.appData?.[key]||{};const items=data.items||[];const e=wcEscapeHtml;
 const detail=window._charPhoneDetail;
 const image=i=>i.image?`<img src="${wcEscapeAttr(i.image)}" alt="${wcEscapeAttr(i.title)}" loading="lazy" referrerpolicy="no-referrer">`:`<div class="cp-art"><i class="${app.icon}"></i><span>${e(i.body||i.title)}</span></div>`;
 if(detail?.key===key&&items[detail.index]){const i=items[detail.index];const fields=[['航线',i.from&&i.to?`${i.from} → ${i.to}`:''],['入住',i.checkIn],['离店',i.checkOut],['证券代码',i.symbol],['最新价',i.price],['涨跌',i.change],['份额',i.quantity],['会籍',i.tier],['歌手',i.artist]].filter(([label,value])=>value&&({flights:['航线'],hotels:['入住','离店'],stocks:['证券代码','最新价','涨跌','份额'],funds:['证券代码','最新价','涨跌','份额'],golf:['会籍'],music:['歌手']}[key]||[]).includes(label));return `<section class="cp-native cp-${key} cp-item-detail"><button class="cp-back" onclick="closeCharPhoneItem()">‹ 返回</button><div class="cp-scroll"><h2>${e(i.title)}</h2><p>${e(i.author||i.time||i.meta)}</p>${i.image?image(i):''}<div class="cp-letter">${e(i.body)}</div>${fields.length?`<dl>${fields.map(([label,value])=>`<div><dt>${label}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>`:''}<h3>${e(i.amount)}</h3><p>${e(i.status)}</p></div></section>`;}
 if(key==='x') return renderCharPhoneX(snapshot,char);
 if(key==='alipay') return renderCharPhoneAlipay(snapshot,char);
 return renderCharPhoneNativeApp(key,snapshot,char);
}

function setCharPhoneSection(key,n){window._charPhoneSections={...window._charPhoneSections,[key]:n};closeCharPhoneItem();}

function renderCharPhoneLibrary(snapshot,char){
 return `<section class="cp-native"><header><strong>App 资料库 · 30</strong></header><p class="cp-summary">桌面的 App 由角色按人设选择。这里可以浏览所有界面；点击桌面同步后生成角色的内容。</p><div class="cp-library">${getWechatAiPhoneAllApps().map(a=>`<button onclick="switchWechatAiPhoneTab('${a.key}')"><i class="${a.icon}"></i><b>${wcEscapeHtml(snapshot.appData?.[a.key]?.name||a.label)}</b><small>${snapshot.installedApps?.includes(a.key)?'已安装':snapshot.installedApps?'未选择':'待角色选择'}</small></button>`).join('')}</div></section>`;
}
