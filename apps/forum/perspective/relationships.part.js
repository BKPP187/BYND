    function visibleSocialLinks() {
        const world = loadState(); const who = world.viewerId;
        const known = new Set(safeList(world.knowledge[who]).map(row => row.eventId));
        const explicit = world.socialLinks.filter(link => link.fromId === who || known.has(link.sourceEventId));
        const observed = Object.entries(world.relationships).flatMap(([key,value]) => { const [fromId,toId] = key.split('>'); const evidence = safeList(value?.history).slice().reverse().find(row => known.has(row.eventId)); return evidence ? [{ fromId,toId,kind:'interacted',sourceEventId:evidence.eventId,sourceLabel:'已知论坛互动' }] : []; });
        return [...explicit,...observed].filter(link => world.accounts[link.fromId] || world.npcs.some(npc => npc.id === link.fromId)).filter(link => world.accounts[link.toId] || world.npcs.some(npc => npc.id === link.toId));
    }
    function relationshipGraphData() {
        const world = loadState(); const who = world.viewerId;
        const known = new Set(safeList(world.knowledge[who]).map(row => row.eventId));
        const people = new Set([...Object.keys(world.accounts), ...world.npcs.map(npc => npc.id)]);
        const links = visibleSocialLinks().map(link => ({ ...link, eventId:link.sourceEventId, at:Number(world.events.find(event => event.id === link.sourceEventId)?.createdAt || link.updatedAt || 0) }));
        world.events.forEach(event => {
            if (!known.has(event.id) && event.actorId !== who) return;
            if (event.type === 'private_chat') {
                if (event.visibility === 'private' && known.has(event.id) && [event.actorId,event.targetId].includes(who)) links.push({ fromId:event.actorId, toId:event.targetId, kind:'private_chat', eventId:event.id, at:event.createdAt });
                return;
            }
            if (event.visibility !== 'public') return;
            if (event.type === 'forum_follow' && safeList(world.follows[event.actorId]).includes(event.targetId)) links.push({ fromId:event.actorId, toId:event.targetId, kind:'follow', eventId:event.id, at:event.createdAt });
            if (event.type === 'forum_reply') {
                const post = world.posts.find(item => item.id === event.targetId);
                const comment = world.comments.find(item => item.id === event.metadata?.commentId);
                const parent = world.comments.find(item => item.id === comment?.parentCommentId);
                const toId = parent?.authorId || post?.authorId;
                if (toId) links.push({ fromId:event.actorId, toId, kind:'reply', eventId:event.id, at:event.createdAt });
            }
        });
        const pairs = new Map();
        links.forEach(link => {
            if (!people.has(link.fromId) || !people.has(link.toId) || link.fromId === link.toId) return;
            const [a,b] = [link.fromId,link.toId].sort(); const key = `${a}\u0000${b}`;
            if (!pairs.has(key)) pairs.set(key,{ a,b,records:[],forward:false,backward:false });
            const pair = pairs.get(key);
            if (pair.records.some(row => row.fromId === link.fromId && row.toId === link.toId && row.kind === link.kind && row.eventId === link.eventId)) return;
            pair.records.push(link);
            if (link.fromId === a) pair.forward = true; else pair.backward = true;
        });
        return [...pairs.values()].sort((left,right) => Number(right.records.some(row => row.fromId === who || row.toId === who)) - Number(left.records.some(row => row.fromId === who || row.toId === who)) || Math.max(...right.records.map(row => row.at || 0)) - Math.max(...left.records.map(row => row.at || 0)));
    }
    function relationKindLabel(kind) { return { follow:'关注', reply:'回复过', private_chat:'私聊过', met:'认识', heard:'听说过', interacted:'互动过' }[kind] || '有联系'; }
    function relationPairLabel(pair) {
        if (pair.forward && pair.backward) return pair.records.some(row => row.kind === 'met') ? '双向认识' : '双向互动';
        return relationKindLabel(pair.records.find(row => row.kind !== 'interacted')?.kind || pair.records[0]?.kind);
    }
    function relationPersona(world, id, otherId) {
        const person = world.accounts[id] || world.npcs.find(item => item.id === id) || {};
        const charId = person.charId || person.contactCharId || person.originCharId || (id.startsWith('char:') ? id.slice(5) : '');
        const chars = safeList(typeof window.getWechatGroupContacts === 'function' ? window.getWechatGroupContacts() : window.myCharacters);
        const char = chars.find(item => String(item?.id) === String(charId));
        const otherName = String((world.accounts[otherId] || world.npcs.find(item => item.id === otherId))?.name || '');
        const relatedLore = safeList(char?.worldBook).filter(entry => entry?.enabled !== false && otherName && String(entry?.content || entry?.text || '').includes(otherName)).slice(0,2).map(entry => String(entry.content || entry.text).slice(0,350));
        return { name:person.name || '未知人物', publicProfile:String(person.summary || '').slice(0,240), personality:[char?.personality,char?.description,person.personality,person.style].filter(Boolean).join('\n').slice(0,1000), relatedLore };
    }
    function relationEvidence(world, pair, fromId) {
        const known = new Set(safeList(world.knowledge[fromId]).map(row => row.eventId));
        return pair.records.filter(row => known.has(row.eventId) || row.fromId === fromId).slice(-12).map(row => {
            const event = world.events.find(item => item.id === row.eventId);
            const comment = event?.type === 'forum_reply' ? world.comments.find(item => item.id === event.metadata?.commentId) : null;
            const post = event?.type?.startsWith('forum_') ? world.posts.find(item => item.id === event.targetId || item.id === comment?.postId) : null;
            // Private-chat excerpts must not be sent to a relationship card visible from another account's perspective.
            const canShowPrivate = event?.type !== 'private_chat' || world.viewerId === fromId;
            return { direction:`${row.fromId} → ${row.toId}`, kind:relationKindLabel(row.kind), postTitle:String(post?.title || '').slice(0,80), excerpt:canShowPrivate ? String(comment?.body || event?.metadata?.excerpt || '').slice(0,180) : '', at:row.at || 0 };
        });
    }
    function relationImpressionInput(world, pair) {
        const make = (fromId,toId) => { const other = relationPersona(world,toId,fromId); return { fromId, toId, from:relationPersona(world,fromId,toId), to:{ name:other.name, publicProfile:other.publicProfile }, evidence:relationEvidence(world,pair,fromId) }; };
        return { viewerId:world.viewerId, aToB:make(pair.a,pair.b), bToA:make(pair.b,pair.a) };
    }
    function relationImpressionKey(input) { return `${input.viewerId}|${input.aToB.fromId}|${input.bToA.fromId}`; }
    function relationImpression(world, pair, fromId) {
        const input = relationImpressionInput(world,pair), key = relationImpressionKey(input);
        const direction = fromId === pair.a ? 'aToB' : 'bToA';
        if (!input[direction].evidence.length) return '尚无足够线索判断态度';
        const cached = relationImpressionCache.get(key);
        if (cached?.signature === JSON.stringify(input)) return cached[direction];
        if (relationImpressionPending.has(key)) return '正在结合人设与已知经历整理…';
        if (relationImpressionErrors.has(key)) return '暂时无法生成人设印象';
        return '等待结合人设与已知经历整理';
    }
    async function loadRelationImpression(pair, force = false) {
        const input = relationImpressionInput(loadState(),pair), key = relationImpressionKey(input), signature = JSON.stringify(input);
        if (relationImpressionPending.has(key) || (!force && relationImpressionCache.get(key)?.signature === signature)) return;
        relationImpressionErrors.delete(key);
        if (typeof window.callChatApi !== 'function') { relationImpressionErrors.set(key,'未配置文本模型'); render(); return; }
        relationImpressionPending.add(key); render();
        try {
            const prompt = `请根据人物各自的人设和实际可知的互动，分别写两个方向的印象。关系是有方向的：A 对 B 的态度不可从 B 对 A 的态度反推。互动次数只说明发生过接触，不能自动解释为熟悉、信任、喜欢或警惕。只依据每个方向自己的 evidence；若线索不够，就写“态度尚不明确”。不要编造共同经历、私聊内容或内心确定事实；用审慎的第三人称推测，体现人设但不要复述人设。每方向 8 至 60 个汉字。只输出严格 JSON：{"aToB":"...","bToA":"..."}。\n${signature}`;
            const result = await window.callChatApi([{ role:'system', content:'你只输出符合输入证据的双向人物关系印象 JSON。' },{ role:'user', content:prompt }], { background:true, backgroundPriority:-1, stream:false, temperature:.55, max_tokens:260, usageFeature:'relation' });
            if (!result?.ok) throw new Error(result?.error || '文本模型不可用');
            const parsed = parseJsonBatch(result.content);
            const clean = value => String(value || '').replace(/^印象[：:]\s*/, '').trim();
            const aToB = clean(parsed.aToB), bToA = clean(parsed.bToA);
            if (!aToB || !bToA || aToB.length > 90 || bToA.length > 90) throw new Error('关系印象格式无效');
            if (JSON.stringify(relationImpressionInput(loadState(),pair)) === signature) relationImpressionCache.set(key,{ signature, aToB, bToA });
        } catch (error) { relationImpressionErrors.set(key,error?.message || '生成失败'); }
        finally { relationImpressionPending.delete(key); if (selectedRelationPair?.a === pair.a && selectedRelationPair?.b === pair.b) render(); }
    }
    function renderRelationCard() {
        if (!selectedRelationPair) return '';
        const pair = relationshipGraphData().find(item => item.a === selectedRelationPair.a && item.b === selectedRelationPair.b);
        if (!pair) return '';
        const world = loadState(); const names = [account(pair.a).name,account(pair.b).name];
        const events = [...new Map(pair.records.map(row => [row.eventId,world.events.find(event => event.id === row.eventId)]).filter(([,event]) => event).map(([id,event]) => [id,event])).values()].sort((a,b) => a.createdAt - b.createdAt);
        const first = events[0]; const latest = events.at(-1);
        const firstPost = first && world.posts.find(post => post.id === first.targetId);
        const firstSource = !first ? '暂无可确认记录' : first.type === 'private_chat' ? '私聊' : firstPost ? `论坛 · 《${firstPost.title}》` : first.type.startsWith('forum_') ? '论坛 · 公开互动' : '世界轨迹';
        const shared = events.filter(event => safeList(world.knowledge[pair.a]).some(row => row.eventId === event.id) && safeList(world.knowledge[pair.b]).some(row => row.eventId === event.id)).length;
        const sources = [...new Set(events.map(event => event.type === 'private_chat' ? '私聊' : event.type.startsWith('forum_') ? '论坛' : '世界轨迹'))];
        const directions = [[pair.a,pair.b],[pair.b,pair.a]];
        const impressionKey = relationImpressionKey(relationImpressionInput(world,pair));
        return `<div class="lw-relation-shade" onclick="if(event.target===this)LivingWorld.closeRelation()"><section class="lw-relation-card" role="dialog" aria-modal="true" aria-label="${escapeAttr(names.join('与'))}的关系"><div class="lw-relation-card-head"><span>关系详情</span><button type="button" onclick="LivingWorld.closeRelation()" aria-label="关闭关系卡"><i class="ri-close-line"></i></button></div><h2>${escapeHtml(names[0])} <span>${pair.forward && pair.backward ? '↔' : pair.forward ? '→' : '←'}</span> ${escapeHtml(names[1])}</h2><div class="lw-relation-metrics"><div><small>认知状态</small><b>${pair.forward && pair.backward ? '双向已知' : '单向已知'}</b></div><div><small>首次接触</small><b>${escapeHtml(firstSource)}</b></div><div><small>最近接触</small><b>${latest ? timeAgo(latest.createdAt) : '未知'}</b></div><div><small>互动次数</small><b>${events.length}</b></div><div><small>共同事件</small><b>${shared}</b></div><div><small>关系来源</small><b>${escapeHtml(sources.join(' / ') || '已知线索')}</b></div></div><div class="lw-relation-directions">${directions.map(([fromId,toId]) => { const directionRows = pair.records.filter(row => row.fromId === fromId && row.toId === toId); return `<div><strong>${escapeHtml(account(fromId).name)} → ${escapeHtml(account(toId).name)}</strong><p>印象（推测）：${escapeHtml(relationImpression(world,pair,fromId))}</p><small>${directionRows.length ? [...new Set(directionRows.map(row => relationKindLabel(row.kind)))].join(' · ') : '尚无这方向的可见依据'}</small></div>`; }).join('')}</div>${relationImpressionErrors.has(impressionKey) ? `<button type="button" class="lw-relation-retry" onclick="LivingWorld.retryRelationImpression()">重新整理印象</button>` : ''}</section></div>`;
    }
    function openRelation(fromId,toId) { const pair = relationshipGraphData().find(item => [item.a,item.b].includes(fromId) && [item.a,item.b].includes(toId) && fromId !== toId); if (!pair) return; selectedRelationPair = { a:pair.a,b:pair.b }; render(); void loadRelationImpression(pair); }
    function retryRelationImpression() { if (!selectedRelationPair) return; const pair = relationshipGraphData().find(item => item.a === selectedRelationPair.a && item.b === selectedRelationPair.b); if (pair) void loadRelationImpression(pair,true); }
    function closeRelation() { selectedRelationPair = null; render(); }
    function renderRelationships() {
        const allPairs = relationshipGraphData(); const who = viewer().id;
        const ids = [...new Set([who,...allPairs.flatMap(pair => [pair.a,pair.b])])];
        const featured = ids.slice(0,17); const wide = featured.length > 6;
        const width = wide ? 640 : 420, height = wide ? 600 : 440, cx = width / 2, cy = height / 2 - 8;
        const nodes = featured.map((id,index) => { if (!index) return { id,x:cx,y:cy }; const ordinal = index - 1; const ring = ordinal < 8 ? 0 : 1; const count = ring ? Math.max(1,featured.length - 9) : Math.min(8,featured.length - 1); const position = ring ? ordinal - 8 : ordinal; const angle = -Math.PI / 2 + position * Math.PI * 2 / count; const radius = ring ? 255 : wide ? 166 : 160; return { id,x:Math.round(cx + radius * Math.cos(angle)),y:Math.round(cy + radius * Math.sin(angle)) }; });
        const byId = Object.fromEntries(nodes.map(node => [node.id,node])); const pairs = allPairs.filter(pair => byId[pair.a] && byId[pair.b]);
        const edgeSvg = pair => { const a = byId[pair.a], b = byId[pair.b]; const dx = b.x - a.x,dy = b.y - a.y,length = Math.hypot(dx,dy) || 1; const inset = 28; const x1 = Math.round(a.x + dx / length * inset),y1 = Math.round(a.y + dy / length * inset),x2 = Math.round(b.x - dx / length * inset),y2 = Math.round(b.y - dy / length * inset); const middleX = (x1+x2)/2,middleY = (y1+y2)/2; const label = relationPairLabel(pair); return `<g class="lw-relation-edge" role="button" tabindex="0" data-from="${escapeAttr(pair.a)}" data-to="${escapeAttr(pair.b)}" aria-label="查看 ${escapeAttr(account(pair.a).name)} 与 ${escapeAttr(account(pair.b).name)} 的关系" onclick="LivingWorld.openRelation(this.dataset.from,this.dataset.to)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();LivingWorld.openRelation(this.dataset.from,this.dataset.to)}"><line class="lw-relation-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${pair.backward ? 'marker-start="url(#lw-arrowhead)"' : ''} ${pair.forward ? 'marker-end="url(#lw-arrowhead)"' : ''}/><line class="lw-relation-hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><rect class="lw-relation-edge-label-bg" x="${Math.round(middleX-37)}" y="${Math.round(middleY-12)}" width="74" height="23" rx="11"/><text class="lw-relation-edge-label" x="${middleX}" y="${middleY+4}" text-anchor="middle">${escapeHtml(label)}</text></g>`; };
        return `<section class="lw-relations"><div class="lw-relation-intro"><span class="lw-relation-eyebrow">SOCIAL GRAPH</span><h1>已知关系网络</h1><p>只显示 ${escapeHtml(viewer().name)} 当前有依据知道的联系。箭头表示关系方向；两端都有依据时才显示双箭头。点边查看来往细节。</p></div>${pairs.length ? `<div class="lw-relation-viewport"><svg class="lw-relation-graph" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="group" aria-label="可点击边查看详情的已知人物关系图"><defs><marker id="lw-arrowhead" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto-start-reverse"><path d="M0 0 L9 4.5 L0 9" fill="#667888"/></marker></defs>${pairs.map(edgeSvg).join('')}${nodes.map(node => `<g class="lw-relation-node ${node.id === who ? 'is-current' : ''}" transform="translate(${node.x} ${node.y})"><circle r="24"/><text class="lw-relation-initial" text-anchor="middle" y="5">${escapeHtml(Array.from(account(node.id).name).slice(0,1).join(''))}</text><text class="lw-relation-name" text-anchor="middle" y="47">${escapeHtml(account(node.id).name)}</text>${node.id === who ? `<text class="lw-relation-current" text-anchor="middle" y="62">当前人物</text>` : ''}</g>`).join('')}</svg></div><div class="lw-relation-legend"><span><i>→</i> 单向</span><span><i>↔</i> 双向</span><span>${featured.length} 位人物 · ${pairs.length} 组关系</span></div>${ids.length > featured.length ? `<p class="lw-relation-overflow">人物较多，当前显示与视角最相关的 ${featured.length} 位。</p>` : ''}<div class="lw-relation-list">${pairs.map(pair => `<button type="button" data-from="${escapeAttr(pair.a)}" data-to="${escapeAttr(pair.b)}" onclick="LivingWorld.openRelation(this.dataset.from,this.dataset.to)"><span class="lw-relation-list-icon">${pair.forward && pair.backward ? '↔' : pair.forward ? '→' : '←'}</span><span><strong>${escapeHtml(account(pair.a).name)} ${pair.forward && pair.backward ? '↔' : pair.forward ? '→' : '←'} ${escapeHtml(account(pair.b).name)}</strong><small>${escapeHtml(relationPairLabel(pair))} · ${pair.records.length} 条可见线索</small></span><i class="ri-arrow-right-s-line"></i></button>`).join('')}</div>` : '<div class="lw-empty"><h2>关系网还在生长</h2><p>角色的关注、回复、私聊和有来源的世界事件，会逐渐把人物连在一起；未知关系不会凭空出现。</p></div>'}</section>`;
    }
