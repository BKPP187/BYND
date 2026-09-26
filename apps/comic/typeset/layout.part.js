    // Typesetting: the same bubble geometry drives the HTML reader and the canvas export.
    // Sizes are fractions of the panel width (CSS uses cqw on the panel container).
    const BUBBLE = { font: 0.0385, lineHeight: 1.42, padX: 0.034, padY: 0.022, maxWidth: 0.46, narrationWidth: 0.62, sfxFont: 0.085 };
    const panelRatio = panel => {
        const [w, h] = shotOf(panel.shot).nai;
        return `${w} / ${h}`;
    };
    function bubbleHtml(bubble) {
        const x = clamp(Number(bubble.x ?? 0.05), 0, 0.95) * 100;
        const y = clamp(Number(bubble.y ?? 0.05), 0, 0.97) * 100;
        const side = Number(bubble.x ?? 0) >= 0.45 ? 'tail-right' : 'tail-left';
        return `<div class="ct-bubble kind-${esc(bubble.kind)} who-${esc(bubble.who)} ${side}" data-bubble="${esc(bubble.id)}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%"><span>${esc(bubble.text)}</span></div>`;
    }
    function panelHtml(panel, options = {}) {
        const art = `<div class="ct-panel-art${panel.imageKey ? '' : ' empty'}" data-image="${esc(panel.imageKey || '')}" data-alt="${esc(panel.beat)}" style="aspect-ratio:${panelRatio(panel)}">${panel.imageKey ? '' : `<div class="ct-panel-missing"><i class="${panel.error ? 'ri-error-warning-line' : 'ri-image-line'}"></i><span>${esc(panel.error || '图片尚未生成')}</span></div>`}${(panel.bubbles || []).map(bubbleHtml).join('')}</div>`;
        return `<figure class="ct-panel shot-${esc(panel.shot)}${options.bordered ? ' bordered' : ''}" data-panel="${esc(panel.id)}">${art}</figure>`;
    }
    // Bubbles store their top-left corner; like the canvas export, keep them inside the panel.
    function fitBubbles(scope = root()) {
        scope?.querySelectorAll('.ct-panel-art').forEach(art => {
            const box = art.getBoundingClientRect();
            if (!box.width || !box.height) return;
            art.querySelectorAll('.ct-bubble').forEach(node => {
                const rect = node.getBoundingClientRect();
                if (rect.right > box.right - 2) node.style.left = `${Math.max(0, (box.width - rect.width - 4) / box.width * 100).toFixed(2)}%`;
                if (rect.bottom > box.bottom - 2) node.style.top = `${Math.max(0, (box.height - rect.height - 4) / box.height * 100).toFixed(2)}%`;
            });
        });
    }
    function gutterHtml(panel, last) {
        const height = last ? 0 : gutterOf(panel.gutter).view;
        return height ? `<div class="ct-gutter tone-${panel.tone === 'dark' ? 'dark' : 'light'}" style="height:${height}px"></div>` : '';
    }
    const stamp = time => { const d = new Date(time || Date.now()); return `'${String(d.getFullYear()).slice(2)} ${d.getMonth() + 1} ${d.getDate()}`; };
    function pieceHtml(book, part) {
        const type = typeOf(book.type);
        const panels = part.panels || [];
        if (type.layout === 'strip') {
            return `<div class="ct-strip">${panels.map((panel, index) => panelHtml(panel) + gutterHtml(panel, index === panels.length - 1)).join('')}</div>`;
        }
        if (type.layout === 'yonkoma') {
            return `<div class="ct-yonkoma"><header><strong>${esc(book.title)}</strong><span>${esc(book.charName)} × ${esc(book.userName)}</span></header>${panels.map(panel => panelHtml(panel, { bordered: true })).join('')}<footer>BYND COMICS · ${esc(date(part.updatedAt))}</footer></div>`;
        }
        if (type.layout === 'polaroid') {
            const panel = panels[0] || {};
            return `<div class="ct-polaroid"><div class="ct-polaroid-photo">${panels[0] ? panelHtml(panel) : ''}<time>${esc(stamp(part.createdAt))}</time></div><p>${esc(part.caption || `${book.charName} & ${book.userName}`)}</p></div>`;
        }
        if (type.layout === 'poster') {
            const poster = part.poster || {};
            return `<div class="ct-poster">${panels[0] ? panelHtml(panels[0]) : ''}<div class="ct-poster-type"><small>${esc(poster.subtitle || 'A BYND ORIGINAL')}</small><strong>${esc(poster.title || book.title)}</strong><em>${esc(poster.tagline || book.logline || '')}</em><span>${esc(poster.credits || `主演 ${book.charName} · ${book.userName}`)}</span><b>${esc(poster.date || date(part.createdAt))}</b></div></div>`;
        }
        if (type.layout === 'wallpaper') {
            const now = new Date();
            return `<div class="ct-wallpaper"><div class="ct-wallpaper-phone">${panels[0] ? panelHtml(panels[0]) : ''}<div class="ct-wallpaper-clock"><small>${esc(now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }))}</small><strong>${esc(now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }))}</strong></div></div></div>`;
        }
        return `<article class="ct-illust">${panels.map(panel => panelHtml(panel)).join('<div class="ct-gutter tone-light" style="height:14px"></div>')}<h2>${esc(book.title)}</h2>${part.story ? `<p>${esc(part.story).replace(/\n/g, '<br>')}</p>` : ''}<small>${esc(book.charName)} × ${esc(book.userName)} · ${esc(date(part.createdAt))}</small></article>`;
    }
    // ---- canvas export ----
    const FONT_SANS = '"PingFang SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif';
    const FONT_SERIF = '"Noto Serif SC","Songti SC","STSong",serif';
    function loadPicture(source) {
        return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('图片无法读取')); img.src = source; });
    }
    function wrapLines(ctx, text, maxWidth) {
        const lines = [];
        for (const paragraph of String(text || '').split('\n')) {
            let line = '';
            for (const char of paragraph) {
                if (line && ctx.measureText(line + char).width > maxWidth) { lines.push(line); line = char; }
                else line += char;
            }
            lines.push(line);
        }
        return lines.filter((line, index, list) => line || index < list.length - 1);
    }
    function roundRect(ctx, x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
    }
    function drawBubble(ctx, bubble, box) {
        const unit = box.w;
        const kind = bubble.kind || 'speech';
        if (kind === 'sfx') {
            const size = Math.round(unit * BUBBLE.sfxFont);
            ctx.save();
            ctx.font = `900 ${size}px ${FONT_SANS}`;
            const x = box.x + clamp(Number(bubble.x ?? 0.5), 0, 0.9) * box.w;
            const y = box.y + clamp(Number(bubble.y ?? 0.45), 0, 0.95) * box.h + size;
            ctx.translate(x, y);
            ctx.rotate(-0.12);
            ctx.lineJoin = 'round';
            ctx.lineWidth = size * 0.16;
            ctx.strokeStyle = '#111';
            ctx.strokeText(bubble.text, 0, 0);
            ctx.fillStyle = '#fff';
            ctx.fillText(bubble.text, 0, 0);
            ctx.restore();
            return;
        }
        const narration = kind === 'narration' || kind === 'caption';
        const size = unit * BUBBLE.font * (kind === 'shout' ? 1.14 : 1);
        ctx.save();
        ctx.font = `${kind === 'shout' ? 800 : narration ? 500 : 600} ${size}px ${FONT_SANS}`;
        const padX = unit * BUBBLE.padX, padY = unit * BUBBLE.padY;
        const lines = wrapLines(ctx, bubble.text, unit * (narration ? BUBBLE.narrationWidth : BUBBLE.maxWidth) - padX * 2);
        const lineHeight = size * BUBBLE.lineHeight;
        const w = Math.max(...lines.map(line => ctx.measureText(line).width)) + padX * 2;
        const h = lines.length * lineHeight + padY * 2;
        const x = clamp(box.x + Number(bubble.x ?? 0.05) * box.w, box.x + 4, box.x + box.w - w - 4);
        const y = clamp(box.y + Number(bubble.y ?? 0.05) * box.h, box.y + 4, box.y + box.h - h - 4);
        const right = Number(bubble.x ?? 0) >= 0.45;
        if (narration) {
            ctx.fillStyle = kind === 'caption' ? 'rgba(255,255,255,0.94)' : '#15151a';
            ctx.fillRect(x, y, w, h);
            if (kind === 'caption') { ctx.strokeStyle = '#15151a'; ctx.lineWidth = unit * 0.004; ctx.strokeRect(x, y, w, h); }
            ctx.fillStyle = kind === 'caption' ? '#15151a' : '#fff';
        } else {
            const stroke = unit * (kind === 'shout' ? 0.007 : 0.0045);
            ctx.lineWidth = stroke;
            ctx.strokeStyle = '#15151a';
            ctx.fillStyle = '#fff';
            if (kind === 'thought' || kind === 'whisper') ctx.setLineDash([unit * 0.012, unit * 0.008]);
            roundRect(ctx, x, y, w, h, kind === 'shout' ? h * 0.18 : h / 2);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);
            if (kind === 'thought') {
                for (const [dx, dy, r] of [[0.16, 0.2, 0.012], [0.08, 0.42, 0.008]]) {
                    ctx.beginPath();
                    ctx.arc(right ? x + w - unit * dx : x + unit * dx, y + h + unit * dy * 0.3, unit * r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            } else {
                const tailX = right ? x + w * 0.72 : x + w * 0.28;
                const tip = right ? tailX + unit * 0.03 : tailX - unit * 0.03;
                ctx.beginPath();
                ctx.moveTo(tailX - unit * 0.018, y + h - stroke);
                ctx.lineTo(tip, y + h + unit * 0.035);
                ctx.lineTo(tailX + unit * 0.018, y + h - stroke);
                ctx.fill();
                ctx.stroke();
                ctx.fillRect(tailX - unit * 0.016, y + h - stroke * 2.2, unit * 0.032, stroke * 2);
            }
            ctx.fillStyle = kind === 'whisper' ? '#5b5b66' : '#15151a';
        }
        ctx.textBaseline = 'middle';
        ctx.textAlign = narration ? 'left' : 'center';
        lines.forEach((line, index) => ctx.fillText(line, narration ? x + padX : x + w / 2, y + padY + lineHeight * (index + 0.5)));
        ctx.restore();
    }
    async function panelPicture(panel, index) {
        const source = await image(panel.imageKey);
        if (!source) throw new Error(`第 ${index + 1} 格还没有图片`);
        return loadPicture(source);
    }
    function drawPanel(ctx, picture, panel, box) {
        ctx.drawImage(picture, box.x, box.y, box.w, box.h);
        for (const bubble of panel.bubbles || []) drawBubble(ctx, bubble, box);
    }
    function textBlock(ctx, text, width, font, lineHeight) {
        ctx.font = font;
        return { lines: wrapLines(ctx, text, width), lineHeight };
    }
    async function composePiece(book, part) {
        const type = typeOf(book.type);
        const panels = part.panels || [];
        if (!panels.length) throw new Error('这一话还没有分镜');
        const pictures = [];
        for (let index = 0; index < panels.length; index++) pictures.push(await panelPicture(panels[index], index));
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const W = 1080;
        if (type.layout === 'wallpaper') {
            canvas.width = pictures[0].naturalWidth;
            canvas.height = pictures[0].naturalHeight;
            ctx.drawImage(pictures[0], 0, 0);
            return canvas;
        }
        if (type.layout === 'strip') {
            const heights = pictures.map(picture => Math.round(picture.naturalHeight * W / picture.naturalWidth));
            const gaps = panels.map((panel, index) => index === panels.length - 1 ? 0 : Math.round(gutterOf(panel.gutter).px * W / 800));
            const total = heights.reduce((sum, h) => sum + h, 0) + gaps.reduce((sum, g) => sum + g, 0);
            if (total > 30000) throw new Error('这一话太长，无法拼成一张长图；请改用“逐格 ZIP”导出');
            canvas.width = W; canvas.height = total;
            let y = 0;
            panels.forEach((panel, index) => {
                drawPanel(ctx, pictures[index], panel, { x: 0, y, w: W, h: heights[index] });
                y += heights[index];
                if (gaps[index]) { ctx.fillStyle = panel.tone === 'dark' ? '#0c0c0f' : '#ffffff'; ctx.fillRect(0, y, W, gaps[index]); y += gaps[index]; }
            });
            return canvas;
        }
        if (type.layout === 'yonkoma') {
            const margin = 64, gap = 30, head = 150, foot = 90, inner = W - margin * 2;
            const heights = pictures.map(picture => Math.round(picture.naturalHeight * inner / picture.naturalWidth));
            canvas.width = W; canvas.height = head + heights.reduce((sum, h) => sum + h, 0) + gap * (panels.length - 1) + foot;
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, canvas.height);
            ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.font = `800 46px ${FONT_SANS}`; ctx.fillText(book.title, W / 2, 84);
            ctx.font = `500 24px ${FONT_SANS}`; ctx.fillStyle = '#777'; ctx.fillText(`${book.charName} × ${book.userName}`, W / 2, 122);
            let y = head;
            panels.forEach((panel, index) => {
                const box = { x: margin, y, w: inner, h: heights[index] };
                drawPanel(ctx, pictures[index], panel, box);
                ctx.lineWidth = 5; ctx.strokeStyle = '#111'; ctx.strokeRect(box.x, box.y, box.w, box.h);
                y += heights[index] + gap;
            });
            ctx.font = `600 20px ${FONT_SANS}`; ctx.fillStyle = '#aaa'; ctx.textAlign = 'center';
            ctx.fillText(`BYND COMICS · ${date(part.updatedAt)}`, W / 2, canvas.height - 36);
            return canvas;
        }
        if (type.layout === 'polaroid') {
            const side = 70, photo = W - side * 2, bottom = 260;
            canvas.width = W; canvas.height = side + photo + bottom;
            ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, W, canvas.height);
            const box = { x: side, y: side, w: photo, h: photo };
            const picture = pictures[0];
            const crop = Math.min(picture.naturalWidth, picture.naturalHeight);
            ctx.drawImage(picture, (picture.naturalWidth - crop) / 2, (picture.naturalHeight - crop) / 2, crop, crop, box.x, box.y, box.w, box.h);
            for (const bubble of panels[0].bubbles || []) drawBubble(ctx, bubble, box);
            ctx.font = `700 34px "Courier New",monospace`; ctx.fillStyle = '#ff8a1f'; ctx.textAlign = 'right';
            ctx.shadowColor = 'rgba(255,120,0,0.6)'; ctx.shadowBlur = 8;
            ctx.fillText(stamp(part.createdAt), box.x + box.w - 30, box.y + box.h - 30);
            ctx.shadowBlur = 0;
            ctx.font = `500 46px "Kaiti SC","STKaiti","KaiTi",${FONT_SERIF}`; ctx.fillStyle = '#34302b'; ctx.textAlign = 'center';
            ctx.fillText(part.caption || `${book.charName} & ${book.userName}`, W / 2, side + photo + 140, W - side * 2);
            return canvas;
        }
        if (type.layout === 'poster') {
            const picture = pictures[0];
            const H = Math.round(picture.naturalHeight * W / picture.naturalWidth);
            canvas.width = W; canvas.height = H;
            drawPanel(ctx, picture, panels[0], { x: 0, y: 0, w: W, h: H });
            const shade = ctx.createLinearGradient(0, H * 0.52, 0, H);
            shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.82)');
            ctx.fillStyle = shade; ctx.fillRect(0, H * 0.52, W, H * 0.48);
            const poster = part.poster || {};
            ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
            ctx.font = `600 26px ${FONT_SANS}`; ctx.globalAlpha = 0.86;
            ctx.fillText((poster.subtitle || 'A BYND ORIGINAL').toUpperCase(), W / 2, H - 330, W - 120);
            ctx.globalAlpha = 1;
            ctx.font = `900 118px ${FONT_SERIF}`; ctx.fillText(poster.title || book.title, W / 2, H - 200, W - 100);
            ctx.font = `500 34px ${FONT_SANS}`; ctx.fillText(poster.tagline || book.logline || '', W / 2, H - 138, W - 140);
            ctx.font = `400 22px ${FONT_SANS}`; ctx.globalAlpha = 0.78;
            ctx.fillText(poster.credits || `主演 ${book.charName} · ${book.userName}`, W / 2, H - 84, W - 120);
            ctx.font = `800 26px ${FONT_SANS}`; ctx.globalAlpha = 1;
            ctx.fillText(poster.date || date(part.createdAt), W / 2, H - 42, W - 120);
            return canvas;
        }
        // illustration / couple: pictures stacked with a story block underneath.
        const pad = 70;
        const heights = pictures.map(picture => Math.round(picture.naturalHeight * W / picture.naturalWidth));
        const measure = document.createElement('canvas').getContext('2d');
        const title = textBlock(measure, book.title, W - pad * 2, `800 52px ${FONT_SERIF}`, 70);
        const story = textBlock(measure, part.story || '', W - pad * 2, `400 34px ${FONT_SERIF}`, 64);
        const textHeight = 90 + title.lines.length * title.lineHeight + (part.story ? 30 + story.lines.length * story.lineHeight : 0) + 110;
        canvas.width = W; canvas.height = heights.reduce((sum, h) => sum + h, 0) + 24 * (pictures.length - 1) + textHeight;
        ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, W, canvas.height);
        let y = 0;
        panels.forEach((panel, index) => { drawPanel(ctx, pictures[index], panel, { x: 0, y, w: W, h: heights[index] }); y += heights[index] + 24; });
        y += 66;
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#1c1916';
        ctx.font = `800 52px ${FONT_SERIF}`;
        title.lines.forEach(line => { ctx.fillText(line, pad, y + 52); y += title.lineHeight; });
        if (part.story) {
            y += 30; ctx.font = `400 34px ${FONT_SERIF}`; ctx.fillStyle = '#3d3831';
            story.lines.forEach(line => { ctx.fillText(line, pad, y + 34); y += story.lineHeight; });
        }
        ctx.font = `500 24px ${FONT_SANS}`; ctx.fillStyle = '#a39b90';
        ctx.fillText(`${book.charName} × ${book.userName} · ${date(part.createdAt)}`, pad, canvas.height - 56);
        return canvas;
    }
    async function pieceBlob(book, part, format = 'image/png') {
        const canvas = await composePiece(book, part);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, format, 0.92));
        if (!blob) throw new Error('成品图导出失败，图片可能太大');
        return blob;
    }
