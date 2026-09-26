    async function exportProject(book) {
        const keys = new Set([book.coverKey, ...book.chapters.flatMap(part => part.panels.map(panel => panel.imageKey))].filter(Boolean));
        const images = {};
        for (const key of keys) images[key] = await image(key);
        return download(JSON.stringify({ format: 'bynd-comic', version: 2, series: book, images }, null, 2), `${book.title}.bynd-comic.json`, 'application/json');
    }
    async function importProject(file) {
        let payload;
        try { payload = JSON.parse(await file.text()); } catch (_) { throw new Error('文件不是有效的漫画项目 JSON'); }
        if (payload?.format !== 'bynd-comic' || !payload.series || !Array.isArray(payload.series.chapters)) throw new Error('这不是有效的 BYND 漫画项目');
        const book = upgradeBook(structuredClone(payload.series));
        book.id = id('series'); book.createdAt = Date.now(); book.updatedAt = Date.now();
        const keys = [...new Set([book.coverKey, ...book.chapters.flatMap(part => part.panels.map(panel => panel.imageKey))].filter(Boolean))];
        for (const key of keys) if (!/^data:image\/(png|jpeg|webp);base64,/i.test(payload.images?.[key] || '')) throw new Error(`项目缺少有效图片 ${key}`);
        const remap = new Map();
        for (const key of keys) { const next = id('img'); await put('images', { id: next, data: payload.images[key] }); remap.set(key, next); }
        book.coverKey = remap.get(book.coverKey) || '';
        for (const part of book.chapters) for (const panel of part.panels) panel.imageKey = remap.get(panel.imageKey) || '';
        await save(book);
        return book;
    }
    function toBytes(dataUrl) { const [head, body] = dataUrl.split(','); const raw = atob(body); const bytes = Uint8Array.from(raw, char => char.charCodeAt(0)); return { bytes, mime: head.match(/data:([^;]+)/)?.[1] || 'image/png' }; }
    const safeName = text => String(text || 'BYND').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'BYND';
    async function savePiece(book, part) {
        const blob = await pieceBlob(book, part);
        const title = typeOf(book.type).series ? `${book.title} ${part.title}` : book.title;
        return download(blob, `${safeName(title)}.png`, 'image/png');
    }
    async function exportZip(book, part) {
        const files = [];
        for (let index = 0; index < part.panels.length; index++) {
            const source = await image(part.panels[index].imageKey);
            if (!source) throw new Error(`第 ${index + 1} 格还没有图片`);
            const decoded = toBytes(source);
            files.push({ name: `${String(index + 1).padStart(3, '0')}.${decoded.mime === 'image/jpeg' ? 'jpg' : decoded.mime === 'image/webp' ? 'webp' : 'png'}`, bytes: decoded.bytes });
        }
        if (!files.length) throw new Error('这一话还没有图片');
        return download(makeZip(files), `${safeName(`${book.title} ${part.title}`)}.zip`, 'application/zip');
    }
    async function exportPdf(book, part) {
        const pages = [];
        for (let index = 0; index < part.panels.length; index++) {
            const panel = part.panels[index];
            const picture = await panelPicture(panel, index);
            const canvas = document.createElement('canvas');
            canvas.width = picture.naturalWidth; canvas.height = picture.naturalHeight;
            drawPanel(canvas.getContext('2d'), picture, panel, { x: 0, y: 0, w: canvas.width, h: canvas.height });
            pages.push({ width: canvas.width, height: canvas.height, bytes: toBytes(canvas.toDataURL('image/jpeg', 0.9)).bytes });
        }
        if (!pages.length) throw new Error('这一话还没有图片');
        return download(makePdf(pages), `${safeName(`${book.title} ${part.title}`)}.pdf`, 'application/pdf');
    }
    // Wallpapers live in the theme data (localStorage), so they are re-encoded small enough to fit.
    async function setWallpaper(book, part, target) {
        const source = await image(part.panels[0]?.imageKey);
        if (!source) throw new Error('壁纸还没有生成图片');
        const picture = await loadPicture(source);
        const scale = Math.min(1, 1080 / picture.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(picture.naturalWidth * scale); canvas.height = Math.round(picture.naturalHeight * scale);
        canvas.getContext('2d').drawImage(picture, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        let theme = {};
        try { theme = JSON.parse(localStorage.getItem('my_theme_data') || '{}') || {}; } catch (_) {}
        const field = target === 'lock' ? 'wpLock' : 'wpHome';
        theme[field] = dataUrl;
        try { localStorage.setItem('my_theme_data', JSON.stringify(theme)); } catch (error) {
            throw new Error(error?.name === 'QuotaExceededError' ? '存储空间不足，壁纸没有保存；请先在“数据管理”里清理缓存' : `壁纸保存失败：${error.message}`);
        }
        const input = document.getElementById(target === 'lock' ? 'input-wp-lock' : 'input-wp-home');
        if (input) input.value = dataUrl;
        const screen = document.getElementById(target === 'lock' ? 'lock-screen' : 'home-screen');
        if (screen) { screen.style.backgroundImage = `url('${dataUrl}')`; screen.style.backgroundSize = 'cover'; }
        if (typeof checkImageBrightness === 'function') checkImageBrightness(dataUrl, target === 'lock' ? 'lock' : 'home');
        if (target === 'lock' && typeof applyLockscreenAdaptiveTheme === 'function') applyLockscreenAdaptiveTheme(dataUrl);
        if (target !== 'lock' && typeof applyByndAdaptiveTheme === 'function') applyByndAdaptiveTheme(dataUrl);
    }
    const crcTable = Array.from({ length: 256 }, (_, i) => { let c = i; for (let n = 0; n < 8; n++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    function makeZip(files) {
        const encoder = new TextEncoder(), chunks = [], directory = [];
        let offset = 0;
        const set16 = (view, at, value) => view.setUint16(at, value, true);
        const set32 = (view, at, value) => view.setUint32(at, value >>> 0, true);
        for (const file of files) {
            const name = encoder.encode(file.name), data = file.bytes;
            let crc = 0xffffffff;
            for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
            crc = (crc ^ 0xffffffff) >>> 0;
            const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
            set32(lv, 0, 0x04034b50); set16(lv, 4, 20);
            set32(lv, 14, crc); set32(lv, 18, data.length); set32(lv, 22, data.length);
            set16(lv, 26, name.length); local.set(name, 30);
            chunks.push(local, data);
            const entry = new Uint8Array(46 + name.length), ev = new DataView(entry.buffer);
            set32(ev, 0, 0x02014b50); set16(ev, 4, 20); set16(ev, 6, 20);
            set32(ev, 16, crc); set32(ev, 20, data.length); set32(ev, 24, data.length);
            set16(ev, 28, name.length); set32(ev, 42, offset); entry.set(name, 46);
            directory.push(entry); offset += local.length + data.length;
        }
        const size = directory.reduce((total, entry) => total + entry.length, 0);
        const footer = new Uint8Array(22), view = new DataView(footer.buffer);
        set32(view, 0, 0x06054b50); set16(view, 8, files.length); set16(view, 10, files.length);
        set32(view, 12, size); set32(view, 16, offset);
        return new Blob([...chunks, ...directory, footer], { type: 'application/zip' });
    }
    function makePdf(pages) { const enc=new TextEncoder(), parts=[], offsets=[0]; let length=0; const add=value=>{const bytes=typeof value==='string'?enc.encode(value):value; parts.push(bytes); length+=bytes.length;}; add('%PDF-1.4\n'); const objects=[]; const count=2+pages.length*3; objects[1]='<< /Type /Catalog /Pages 2 0 R >>'; objects[2]=`<< /Type /Pages /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] /Count ${pages.length} >>`; pages.forEach((page,i)=>{const base=3+i*3; objects[base]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /Im${i} ${base+1} 0 R >> >> /Contents ${base+2} 0 R >>`; objects[base+1]=[`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,page.bytes,'\nendstream'];const stream=`q ${page.width} 0 0 ${page.height} 0 0 cm /Im${i} Do Q`;objects[base+2]=`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}\nendstream`;}); for(let i=1;i<=count;i++){offsets[i]=length;add(`${i} 0 obj\n`);const obj=objects[i]; if(Array.isArray(obj)) obj.forEach(add); else add(obj); add('\nendobj\n');} const xref=length;add(`xref\n0 ${count+1}\n0000000000 65535 f \n`);for(let i=1;i<=count;i++) add(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);add(`trailer\n<< /Size ${count+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);return new Blob(parts,{type:'application/pdf'}); }
