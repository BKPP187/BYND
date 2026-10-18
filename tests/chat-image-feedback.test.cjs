const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { root } = require('./helpers/harness.cjs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const png = 'data:image/png;base64,aWRlbnRpdHk=';

function chatHarness() {
    const context = vm.createContext({window:{},console,Date,setTimeout,clearTimeout});
    vm.runInContext(read('core/api/chat-api.js'),context);
    for (const name of ['buildChatApiCoreIdentityAnchor','buildSystemPrompt','buildCurrentTimeAnchor','buildMemoryAnchor','buildRegexAnchor','buildChatApiStatusBlockAnchor','buildUserMomentsAnchor','buildWechatStickerAnchor','buildShoppingAnchor','buildChatApiHistoryTimeLabel']) context[name]=()=>'';
    context.getChatApiCurrentTimeContext=()=>({});
    return context;
}

test('the next real chat request carries the characters own generated pixels, not only the requested caption',()=>{
    const h=chatHarness();
    const photo={type:'image',isMe:false,content:png,imageUrl:png,imagePrompt:'黑发男子自拍',description:'自拍',imagePending:false};
    const history=[photo,{type:'text',isMe:true,content:'你看得见你自己生成的图吗？'}];
    const messages=h.buildMessages({name:'林间',chatConfig:{}},history);
    const visual=messages.find(msg=>Array.isArray(msg.content)&&msg.content.some(part=>part.type==='image_url'&&part.image_url.url===png));
    assert.ok(visual,'generated image pixels are missing from the follow-up request');
    assert.equal(visual.role,'user','vision evidence uses a supported input role');
    assert.match(visual.content.find(part=>part.type==='text').text,/你.*(?:生成|发送)|角色.*(?:生成|发送)/);
});

test('an unrecognized relay with a required identity reference must use an editing request',async()=>{
    const requests=[];
    const h=vm.createContext({window:{},Blob,FormData,Response,URL,AbortSignal,
        getDefaultImageApi:()=>({baseUrl:'https://new-relay.test/v1',imageModel:'new-channel-image',apiKey:''}),
        fetch:async(url,options)=>{
            if(url.startsWith('data:'))return new Response(new Blob(['reference'],{type:'image/png'}));
            requests.push({url,body:options.body});return new Response(JSON.stringify({data:[{b64_json:'bmV3LXBpY3R1cmU='}]}));
        }
    });
    vm.runInContext(read('core/api/image-generation.js'),h);
    const result=await h.callWechatImageGenerationApi('一个黑发男子，单人半身自拍',{referenceImage:png,requireReference:true,referenceStyle:'identity'});
    assert.equal(result.ok,true);
    assert.equal(requests[0].url,'https://new-relay.test/v1/images/edits','identity reference must not be sent to a text-only endpoint');
    assert.ok(requests[0].body instanceof FormData);
    assert.equal(requests[0].body.get('prompt').includes('一个黑发男子'),true);
});

test('NovelAI relays receive English subject and appearance tags instead of Chinese instructions or reference fields',async()=>{
    const bodies=[],converted=[];
    const h=vm.createContext({window:{},Response,URL,AbortSignal,
        getDefaultImageApi:()=>({baseUrl:'https://novel-relay.test/v1',imageModel:'nai-diffusion-5-full'}),
        convertTextToNovelAiPrompt:async(text,options)=>{converted.push({text,options});return {ok:true,prompt:'1boy, solo, selfie, indoors',characters:[{prompt:'male, black hair, brown eyes, gray shirt'}],negative:'collage, multiple views'};},
        fetch:async(_,options)=>{bodies.push(JSON.parse(options.body));return new Response(JSON.stringify({data:[{b64_json:'bmV3LXBpY3R1cmU='}]}));}
    });
    vm.runInContext(read('core/api/image-generation.js'),h);
    const result=await h.callWechatImageGenerationApi('年轻黑发男子穿灰色衬衫自拍，生成一张单人照片',{referenceImage:png,requireReference:true,referenceStyle:'identity'});
    assert.equal(result.ok,true);
    assert.equal(converted.length,1,'the NovelAI relay path must perform tag conversion too');
    assert.equal(converted[0].options.referenceImage,png);
    assert.match(bodies[0].prompt,/1boy.*solo/);
    assert.match(bodies[0].prompt,/black hair/);
    assert.doesNotMatch(bodies[0].prompt,/[\u3400-\u9fff]/);
    assert.match(bodies[0].negative_prompt,/collage/);
    assert.equal(bodies[0].image,undefined,'a text-only tag engine must not pretend to edit the reference');
    assert.equal(result.requestPrompt,bodies[0].prompt,'the activity can show the actual transmitted prompt');
});

test('failed or unfinished generated images are not sent as visual evidence; older self-images are bounded',()=>{
    const h=chatHarness();
    const make=(index,extra={})=>({type:'image',isMe:false,content:`https://images.test/${index}.png`,description:'照片',...extra});
    const history=[make(0),make(1),make(2),make(3,{imagePending:true}),make(4,{imageError:'生图失败'}),{type:'text',isMe:true,content:'看看刚刚的照片'}];
    const messages=h.buildMessages({name:'林间',chatConfig:{}},history);
    const sources=messages.flatMap(message=>Array.isArray(message.content)?message.content.filter(part=>part.type==='image_url').map(part=>part.image_url.url):[]);
    assert.deepEqual(Array.from(sources),['https://images.test/1.png','https://images.test/2.png']);
});

test('tag conversion failures never spend an image request or silently send Chinese unchanged',async()=>{
    let requests=0;
    const h=vm.createContext({window:{},URL,AbortSignal,
        getDefaultImageApi:()=>({baseUrl:'https://novel-relay.test/v1',imageModel:'nai-diffusion-5-full'}),
        convertTextToNovelAiPrompt:async()=>({ok:false,error:'聊天模型不支持视觉输入'}),fetch:async()=>{requests++;}
    });
    vm.runInContext(read('core/api/image-generation.js'),h);
    const result=await h.callWechatImageGenerationApi('角色自拍',{referenceImage:png,requireReference:true});
    assert.equal(result.ok,false);
    assert.match(result.error,/不支持视觉/);
    assert.equal(requests,0);
});

test('required remote identity images use JSON edits and never fall back to text-only generation on failure',async()=>{
    const calls=[];
    const h=vm.createContext({window:{},URL,AbortSignal,Response,
        getDefaultImageApi:()=>({baseUrl:'https://new-relay.test/v1',imageModel:'custom-image'}),
        fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return new Response(JSON.stringify({error:{message:'edits not supported'}}),{status:404});}
    });
    vm.runInContext(read('core/api/image-generation.js'),h);
    const result=await h.callWechatImageGenerationApi('一张单人照片',{referenceImage:'https://images.test/person.png',requireReference:true});
    assert.equal(result.ok,false);
    assert.equal(calls.length,1);
    assert.ok(calls.every(call=>call.url.endsWith('/images/edits')));
    assert.equal(calls[0].body.images[0].image_url,'https://images.test/person.png');
});

test('NovelAI tag conversion observes the actual identity reference before describing appearance',async()=>{
    const calls=[];
    const h=vm.createContext({window:{},URL,console,
        callChatApi:async(messages)=>{calls.push(messages);return {ok:true,content:JSON.stringify({prompt:'1boy, solo',characters:[{prompt:'silver hair, gray eyes'}],negative:'collage'})};}
    });
    vm.runInContext(read('core/api/novelai.js'),h);
    const result=await h.convertTextToNovelAiPrompt('场景中泛泛描述了黑发，但人物身份以参考图为准',{referenceImage:png});
    assert.equal(result.ok,true);
    assert.equal(calls[0][1].content[1].image_url.url,png);
    assert.match(calls[0][0].content,/inspect it for identity/);
    assert.match(calls[0][0].content,/never a contact sheet/);
    assert.match(result.characters[0].prompt,/silver hair/);
});
