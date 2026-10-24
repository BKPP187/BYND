'use strict';
// Money cards in every WeChat theme: each state (pending / received / returned / 亲密付 / gift) on both sides.
// Fails when a card's main text, note or footer has too little contrast with its own background.
// Usage: node scripts/check-pay-cards-themes-browser.cjs [themeId]   (screenshots: artifacts/pay-cards-themes)
const path=require('path');const fs=require('fs');const {pathToFileURL}=require('url');
const {chromium}=require(process.env.BYND_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..');const out=path.join(root,'artifacts/pay-cards-themes');fs.mkdirSync(out,{recursive:true});
const only=process.argv[2];
(async()=>{const b=await chromium.launch(process.env.BYND_BROWSER_CHANNEL?{channel:process.env.BYND_BROWSER_CHANNEL}:{});const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/*',r=>{const u=r.request().url();if(/^(file|data|blob):/.test(u))return r.continue();return r.abort();});
await p.addInitScript(()=>localStorage.setItem('bynd_builtin_library_seen_v1','1'));
await p.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__byndCoreReady&&typeof openApp==='function');
await p.evaluate(async()=>{await window.__byndCoreReady;await window.byndStylesReady;await window._wechatCharactersLoadPromise;unlockPhone();window.ByndBuiltinLibrary?.close();document.documentElement.classList.add('mobile-runtime');
 const now=Date.now();const mk=(list)=>list.map((m,i)=>({...m,timestamp:now-60000*(list.length-i)}));
 const variants=s=>[{type:'transfer',amount:'52.00',isMe:s},{type:'transfer',amount:'52.00',status:'已被领取',isMe:s},{type:'transfer',amount:'52.00',receipt:true,isMe:s},{type:'transfer',amount:'52.00',returned:true,isMe:s},{type:'redpacket',amount:'8.88',isMe:s},{type:'redpacket',amount:'8.88',receipt:true,isMe:s},{type:'redpacket',amount:'8.88',returned:true,isMe:s},{type:'gift',item:{name:'香薰蜡烛',price:'128'},isMe:s},{type:'gift',item:{name:'香薰蜡烛',price:'128'},receipt:true,isMe:s},{type:'intimatePay',amount:'2000',isMe:s},{type:'intimatePay',amount:'2000',receipt:true,isMe:s}];
 const all=[...variants(false),...variants(true)];
 window.myCharacters=[];for(let i=0;i<all.length;i+=3)window.myCharacters.push({id:'p'+i,name:'林间'+i,avatar:'',chatConfig:{},history:mk(all.slice(i,i+3))});
 openApp('wechat');
});
const themes=await p.evaluate(()=>WECHAT_UI_THEMES.map(t=>t.id));
const report=[];
for(const theme of themes){ if(only&&theme!==only)continue;
 const ids=await p.evaluate(()=>myCharacters.map(c=>c.id));
 for(const id of ids){
  await p.evaluate(([theme,id])=>{selectWechatUiTheme(theme);document.getElementById('wc-toast')?.classList.remove('show');openChat(id);},[theme,id]);await p.waitForTimeout(220);
  const r=await p.evaluate(()=>{
   const rgb=s=>{const cm=String(s).match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/);if(cm)return {r:cm[1]*255,g:cm[2]*255,b:cm[3]*255,a:cm[4]?+cm[4]:1};const m=String(s).match(/rgba?\(([^)]+)\)/);if(!m)return null;const v=m[1].split(',').map(x=>parseFloat(x));return {r:v[0],g:v[1],b:v[2],a:v.length>3?v[3]:1};};
   const L=c=>{const f=x=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b);};
   const ratio=(a,b)=>{const x=L(a),y=L(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
   const bgOf=el=>{for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e);const bi=cs.backgroundImage;if(bi&&bi!=='none'&&/gradient/.test(bi)){const m=bi.match(/rgba?\([^)]+\)|color\(srgb[^)]+\)/);if(m)return rgb(m[0]);}const c=rgb(cs.backgroundColor);if(c&&c.a>0.5)return c;}return {r:255,g:255,b:255,a:1};};
   return [...document.querySelectorAll('#wechat-chat-room .msg-row')].map(row=>{const card=row.querySelector('.msg-pay-bubble,.msg-gift-bubble,.msg-intimate-pay-bubble');if(!card)return null;
    const t=card.querySelector('.msg-pay-amount,.msg-rp-amount,.msg-gift-info strong,.msg-pay-title');const n=card.querySelector('.msg-pay-note,.msg-gift-info p');const f=card.querySelector('.msg-card-footer span');
    const c=x=>x?ratio(rgb(getComputedStyle(x).color),bgOf(x)).toFixed(1):'-';
    const rect=card.getBoundingClientRect();
    return {side:row.classList.contains('right')?'me':'char',cls:card.className.replace(/msg-bubble |msg-pay-bubble /g,'').trim(),main:c(t),note:c(n),foot:c(f),w:Math.round(rect.width)};}).filter(Boolean);});
  for(const x of r)report.push({theme,...x});
  await p.screenshot({path:`${out}/${theme}-${id}.png`});
 }
}
const bad=report.filter(x=>parseFloat(x.main)<2.4||parseFloat(x.note)<2.4||parseFloat(x.foot)<2.6||x.w<150);
console.log('cards',report.length,'flagged',bad.length);
for(const x of bad)console.log(JSON.stringify(x));
console.log(JSON.stringify({errors:errors.slice(0,5)}));await b.close();if(bad.length||errors.length)process.exitCode=1;})().catch(e=>{console.error(e);process.exit(1);});
