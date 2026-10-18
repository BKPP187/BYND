// Local OCR for image-only PDFs. Assets use classic scripts and Blob workers so
// Android's file:// origin never needs CDN access or a binary mirror resource.
(() => {
    const ROOT = 'assets/vendor/study-ocr/';
    const LANGS = {cn:'chi_sim',en:'eng',ja:'jpn',th:'tha'};
    const scripts = new Map();
    function load(name) {
        if(!scripts.has(name)) scripts.set(name,new Promise((resolve,reject)=>{
            const script=document.createElement('script');
            script.src=ROOT+name+'.js';
            script.onload=resolve;
            script.onerror=()=>{script.remove();scripts.delete(name);reject(new Error('本地文字识别资源加载失败，请刷新后重试。'));};
            document.head.appendChild(script);
        }));
        return scripts.get(name);
    }
    function cancelled(signal) {if(signal?.aborted)throw new Error('已取消识别。');}
    function decode(text) {const raw=atob(text);return Uint8Array.from(raw,ch=>ch.charCodeAt(0));}
    function itemsFromBlocks(blocks,height) {
        // Keep a recognized Thai line intact: vowel/tone marks have different
        // bounding boxes and must not be reordered as independent PDF glyphs.
        return (blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>(paragraph.lines||[]).filter(line=>line.text?.trim()).map(line=>({
            str:line.text.trim(), width:line.bbox.x1-line.bbox.x0,
            transform:[1,0,0,line.bbox.y1-line.bbox.y0,line.bbox.x0,height-line.bbox.y1], bbox:line.bbox, confidence:line.confidence
        }))));
    }
    function tableGeometry(canvas) {
        const {width,height}=canvas;
        const pixels=canvas.getContext('2d').getImageData(0,0,width,height).data;
        const boundaries=[];
        let start=-1;
        for(let y=0;y<height;y++) {
            let ink=0;
            for(let x=0;x<width;x+=3) {
                const i=(y*width+x)*4;
                if(pixels[i]<235&&pixels[i+1]<235&&pixels[i+2]<235)ink++;
            }
            const line=ink>width/3*.55;
            if(line&&start<0)start=y;
            if(!line&&start>=0){boundaries.push((start+y-1)/2);start=-1;}
        }
        if(start>=0)boundaries.push((start+height-1)/2);
        if(boundaries.length<4)return {rows:[],columns:[]};
        const rows=boundaries.slice(1).map((bottom,index)=>({top:boundaries[index],bottom})).filter(row=>row.bottom-row.top>12);
        const columns=[];start=-1;
        const top=Math.ceil(boundaries[0]),bottom=Math.floor(boundaries[boundaries.length-1]);
        for(let x=0;x<width;x++) {
            let ink=0;
            for(let y=top;y<=bottom;y+=3){const i=(y*width+x)*4;if(pixels[i]<235&&pixels[i+1]<235&&pixels[i+2]<235)ink++;}
            const line=ink>(bottom-top)/3*.6;
            if(line&&start<0)start=x;
            if(!line&&start>=0){columns.push((start+x-1)/2);start=-1;}
        }
        return {rows,columns};
    }
    async function create(options={}) {
        const languages=[...new Set([options.targetId,options.nativeId].filter(Boolean).map(id=>LANGS[id]))];
        if(languages.includes(undefined))throw new Error('本地扫描识别支持中文、英文、日语和泰语；这门语言请开启 AI 识别。');
        if(!languages.length)languages.push('eng');
        // The same SIMD detector used by wasm-feature-detect 1.8.0.
        const simd=typeof WebAssembly==='object'&&WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));
        const core=simd?'core-simd':'core-basic';
        cancelled(options.signal);
        options.onProgress?.('正在准备本地文字识别…');
        await Promise.all(['worker-source',core,...languages].map(load));
        cancelled(options.signal);
        const assets=window.ByndStudyOcrAssets;
        // A file:// page has an opaque origin: importing a second Blob from the
        // worker can fail. Start core and worker in one self-contained script.
        const workerUrl=URL.createObjectURL(new Blob([assets[core],'\n;\n',assets.worker],{type:'application/javascript'}));
        let worker, closed=false, next=0, lastPercent=-1;
        const pending=new Map();
        const close=(error=new Error('已取消识别。'))=>{
            if(closed)return;
            closed=true;worker?.terminate();
            options.signal?.removeEventListener('abort',abort);
            for(const job of pending.values()){clearTimeout(job.timer);job.reject(error);}
            pending.clear();URL.revokeObjectURL(workerUrl);
        };
        const abort=()=>close();
        const send=(action,payload)=>new Promise((resolve,reject)=>{
            if(closed){reject(new Error('已取消识别。'));return;}
            const jobId='study_ocr_'+(++next);
            const timer=setTimeout(()=>close(new Error('本地识别耗时过长，请减少页数后重试。')),120000);
            pending.set(jobId,{resolve,reject,timer});
            try{worker.postMessage({workerId:'study',jobId,action,payload});}
            catch(error){close(error);}
        });
        try {
            worker=new Worker(workerUrl);
            worker.onmessage=({data})=>{
                if(data.status==='progress') {
                    if(data.data?.status==='recognizing text') {
                        const percent=Math.floor(data.data.progress*20)*5;
                        if(percent!==lastPercent){lastPercent=percent;options.onProgress?.(`本地文字识别 ${percent}%…`);}
                    }
                    return;
                }
                const job=pending.get(data.jobId);if(!job)return;
                clearTimeout(job.timer);pending.delete(data.jobId);
                if(data.status==='resolve')job.resolve(data.data);
                else job.reject(new Error('本地文字识别失败：'+String(data.data||'未知错误').slice(0,200)));
            };
            worker.onerror=()=>close(new Error('本地文字识别组件运行失败，请刷新或开启 AI 识别重试。'));
            options.signal?.addEventListener('abort',abort,{once:true});
            cancelled(options.signal);
            // Pinned Tesseract.js 6.0.1 worker protocol. Own the Worker from its
            // creation so cancellation also interrupts engine/model initialization.
            await send('load',{options:{lstmOnly:true,corePath:'bynd-offline-core.js',logging:false}});
            options.onProgress?.('正在载入本地语言模型…');
            await send('loadLanguage',{langs:languages.map(code=>({code,data:decode(assets[code])})),options:{lstmOnly:true,cacheMethod:'none'}});
            options.onProgress?.('正在初始化本地识别…');
            await send('initialize',{langs:languages.join('+'),oem:1,config:{}});
            let activeLanguage=languages.join('+');
            const recognizeImage=async(canvas,language,psm)=>{
                if(activeLanguage!==language){await send('initialize',{langs:language,oem:1,config:{}});activeLanguage=language;}
                await send('setParameters',{params:{tessedit_pageseg_mode:psm,preserve_interword_spaces:'1'}});
                const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
                if(!blob)throw new Error('无法读取扫描页面图片。');
                return send('recognize',{image:new Uint8Array(await blob.arrayBuffer()),options:{},output:{text:true,blocks:true}});
            };
            return {
                async recognize(canvas) {
                    cancelled(options.signal);
                    lastPercent=-1;
                    const geometry=tableGeometry(canvas);
                    const columns=geometry.columns;
                    if(options.targetId==='th'&&options.nativeId==='cn'&&columns.length===4&&(columns[1]-columns[0])<(columns[3]-columns[0])*.2) {
                        const results=[];
                        // Recognize each language column with its own model. A
                        // mixed Thai/Chinese decoder can mistake Thai tone marks
                        // for separate Chinese lines and lose Chinese characters.
                        for(const [left,right,language] of [[columns[1],columns[2],'chi_sim'],[columns[2],columns[3],'tha']]) {
                            cancelled(options.signal);
                            const crop=document.createElement('canvas');
                            crop.width=Math.floor(right-left-4);crop.height=canvas.height;
                            try {
                                const ctx=crop.getContext('2d');
                                ctx.drawImage(canvas,Math.ceil(left)+2,0,crop.width,crop.height,0,0,crop.width,crop.height);
                                const image=ctx.getImageData(0,0,crop.width,crop.height);
                                for(let i=0;i<image.data.length;i+=4) {
                                    const value=(image.data[i]+image.data[i+1]+image.data[i+2])/3>180?255:0;
                                    image.data[i]=image.data[i+1]=image.data[i+2]=value;
                                }
                                ctx.putImageData(image,0,0);
                                const data=await recognizeImage(crop,language,'6');
                                const items=itemsFromBlocks(data.blocks,canvas.height);
                                items.forEach(item=>{item.bbox.x0+=left+2;item.bbox.x1+=left+2;item.transform[4]+=left+2;});
                                results.push({text:data.text||'',items});
                            } finally {crop.width=crop.height=0;}
                        }
                        return {text:results.map(result=>result.text).join('\n'),items:results.flatMap(result=>result.items),rows:geometry.rows};
                    }
                    const data=await recognizeImage(canvas,languages.join('+'),'3');
                    cancelled(options.signal);
                    return {text:data.text||'',items:itemsFromBlocks(data.blocks,canvas.height),rows:geometry.rows};
                }, close
            };
        } catch(error){close(error);throw error;}
    }
    window.ByndStudyOcr={create,itemsFromBlocks,tableGeometry};
})();
