// DOM teaching layer. Thai spelling/tone logic lives in ByndThaiRules only.
(() => {
    'use strict';
    const REVIEW_KEY='bynd_study_thai_review_v1', MODE_KEY='bynd_study_thai_mode_v1';
    const sessions=new Map(); let serial=0;
    const rules=()=>window.ByndThaiRules;
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const roman=text=>text.replace(/ɯ/g,'ʉ').replace(/ /g,'-');
    function mode() { try { return localStorage.getItem(MODE_KEY)==='detail'?'detail':'basic'; } catch (_) { return 'basic'; } }
    function readReview() {
        const raw=localStorage.getItem(REVIEW_KEY), value=raw==null?{}:JSON.parse(raw);
        if (!value || typeof value!=='object' || Array.isArray(value) || Object.values(value).some(x=>!x||typeof x!=='object'||!Number.isSafeInteger(x.wrong)||x.wrong<0||!Number.isSafeInteger(x.right)||x.right<0||typeof x.term!=='string'||!Number.isInteger(x.syllable)||x.syllable<0||!['class','vowel','life','tone'].includes(x.id))) throw Error('原易混记录格式无效');
        return value;
    }
    function record(question,session,index,correct) {
        const data=readReview(), old=data[question.key];
        // Correct answers only update existing confusions. New mistakes are durable.
        if (correct&&!old) return;
        data[question.key]={wrong:(old?.wrong||0)+(correct?0:1),right:(old?.right||0)+(correct?1:0),term:session.analysis.term,syllable:index,id:question.id,lastAt:Date.now()};
        localStorage.setItem(REVIEW_KEY,JSON.stringify(data));
    }
    function newSession(term,meaning='') {
        const key='thai_lesson_'+(++serial), value={analysis:rules().analyze(term),meaning,mode:mode(),steps:{},practice:false,quizIndex:0,questionIndex:0,feedback:null,answered:false,notice:'',letter:null};
        sessions.set(key,value);
        if(sessions.size>400)sessions.delete(sessions.keys().next().value);
        return {key,value};
    }
    const button=(text,handler,cls='study-ghost',attrs='')=>`<button type="button" class="${cls}" onclick="ByndThaiClassroom.${handler}" ${attrs}>${text}</button>`;
    function voiceButtons(index) {
        return `<div class="study-thai-audio">${button('<i class="ri-volume-up-line" aria-hidden="true"></i> 示范',`play(this,${index},false)`, 'study-ghost', 'aria-label="泰语标准语音示范"')}${button('慢速',`play(this,${index},true)`, 'study-ghost', 'aria-label="泰语慢速播放"')}</div>`;
    }
    function letterInfo(char,syllable) {
        const item=char.letter;
        if(item)return `<strong lang="th">${esc(item.name)}</strong><p>字母类别：${esc(item.kind)}辅音。字母名称用于认字，不是把名称整段读进单词。</p><p>常规起始音 /${esc(item.initial)}/；常规尾音 ${item.final?'/'+esc(['k','t','p'].includes(item.final)?item.final+'̚':item.final)+'/':'不作普通尾辅音'}。</p><p>本词作用：${esc(char.role)}；${esc(char.actual||'实际读法待核对')}。</p><p>认字例词：<span lang="th">${esc(item.example)}</span>${item.note?'；'+esc(item.note):''}</p>`;
        const mark=rules().marks[char.glyph];
        return mark?`<strong lang="th">◌${esc(char.glyph)} · ${esc(mark)}</strong><p>这是声调符号；名称/次序不等于实际声调编号。</p>`:syllable.vowel?`<strong lang="th">◌${esc(char.glyph)} · ${esc(syllable.vowel.name)}</strong><p>本词组合 ${esc(syllable.vowel.shape)}，${syllable.vowel.length}元音 /${esc(syllable.vowel.actual)}/；${esc(syllable.vowel.position)}。这是元音/拼写部分，不是声调符号。</p>`:'<p>本词的具体符号作用尚待核对，不据此猜测读音。</p>';
    }
    function syllableBody(s,index,session) {
        const letters=s.characters.map((char,i)=>button(esc(/^[ัิีึืุู็่้๊๋์]$/.test(char.glyph)?'◌'+char.glyph:char.glyph),`letter(this,${index},${i})`,'study-thai-letter',`lang="th" aria-label="查看字母或符号 ${esc(char.glyph)}"`)).join('');
        const selected=session.letter?.[0]===index?s.characters[session.letter[1]]:null;
        const core=`<div class="study-thai-letters" aria-label="逐字查看">${letters}</div>${selected?`<div class="study-thai-letter-info" role="status">${letterInfo(selected,s)}</div>`:''}`;
        if(!s.verified)return `${core}<p class="study-thai-unverified">${esc(s.reason)}</p>${s.reading?`<p>词库参考：${esc(s.reading.explanation)}</p>`:''}`;
        if(session.mode==='basic')return `${core}<p class="study-thai-tone-reason">${esc(s.onset.controller)}（${s.kind}辅音）；${esc(s.ruleText)}。${esc(s.lifeReason)}。</p><p>${esc(s.vowel.name)} · ${s.vowel.length} /${esc(s.vowel.actual)}/；${s.final?esc(s.final)+' → /'+esc(s.finalSound)+'/':s.coda?'实际收尾 /'+esc(s.finalSound)+'/':'无尾辅音'}；${esc(s.markName)}。</p><details><summary>发音动作</summary><p>${esc(s.reading.explanation)}</p></details>${s.note?`<p>${esc(s.note)}</p>`:''}`;
        const shown=session.steps[index]||1;
        return `${core}<ol class="study-thai-steps">${s.steps.slice(0,shown).map((step,i)=>`<li><small>第 ${i+1} 步</small><p>${esc(step)}</p></li>`).join('')}</ol>${shown<s.steps.length?button('下一步：'+['','元音','尾音与活死','声调符号','声调规则','实际读音'][shown],`step(this,${index})`):'<small>已完成本音节的拼读推导。</small>'}${s.note?`<p class="study-thai-special">特殊拼写：${esc(s.note)}</p>`:''}`;
    }
    function renderQuiz(session) {
        const verified=session.analysis.syllables.map((s,i)=>({s,i})).filter(x=>x.s.verified);
        if(!verified.length)return '<p>本词尚无可核对的完整推导，暂不据此出题。</p>';
        const chosen=verified[session.quizIndex%verified.length], list=rules().questions(chosen.s), question=list[session.questionIndex];
        const labels={高:'高辅音',中:'中辅音',低:'低辅音',长:'长元音',短:'短元音',活:'活音节',死:'死音节'};
        return `<section class="study-thai-quiz" aria-label="泰语拼读练习"><small>音节 ${session.quizIndex%verified.length+1} / ${verified.length} · 判断 ${session.questionIndex+1} / ${list.length}</small><h3 lang="th">${esc(chosen.s.written)}</h3><p>${esc(question.prompt)}</p><div class="study-thai-answers">${question.options.map((option,i)=>button(esc(labels[option]||`第 ${option} 调`),`answer(this,${i})`,'study-ghost',session.answered?'disabled':'')).join('')}</div>${session.feedback?`<p class="study-thai-answer-feedback ${session.feedback.ok?'':'is-wrong'}" role="status">${esc(session.feedback.text)}</p>`:''}${session.answered?button('下一步练习',`nextQuestion(this)`):''}</section>`;
    }
    function renderReference() {
        const rows=[['无标记＋活音节','1','5','1'],['无标记＋死音节','2','2','短 4；长 3'],['่ · ไม้เอก','2','2','3'],['้ · ไม้โท','3','3','4'],['๊ · ไม้ตรี','4','需校验','需校验'],['๋ · ไม้จัตวา','5','需校验','需校验']];
        return `<details class="study-thai-rule-table"><summary>声调规则表与编号</summary><p>${rules().tones.slice(1).map(([label,value],i)=>`${i+1} ${label}≈${value}`).join('；')}。调值只是辅助近似，并非所有人的精确音高曲线。</p><div class="study-thai-table-scroll"><table><thead><tr><th>条件</th><th>中辅音</th><th>高辅音</th><th>低辅音</th></tr></thead><tbody>${rows.map(row=>`<tr>${row.map(col=>`<td>${col}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>表格适用于已正确确定声母组合、元音长短、活死音节的常规音节。๊、๋ 的常规用法在中辅音；其他类别需逐词核对。</p><p>本课采用 1 中平、2 低、3 降、4 高、5 升。低辅音的「标二读三／标三读四」课堂口诀，把无标记算在第一格，第二格 ่ → 实际第 3 调，第三格 ้ → 实际第 4 调；它不是调号泰语名称的编号，也不是高、中辅音的通用规则。</p><p>IPA 以斜线标示；教学罗马转写用重音符号表示实际声调，ɯ/ʉ 表示同一元音，长元音用重复字母。中文谐音不作标准发音。</p>${rules().sources.map(([name,url])=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${esc(name)}</a>`).join(' · ')}</details>`;
    }
    function body(session) {
        const a=session.analysis;
        const modes=`<div class="study-thai-controls"><div role="group" aria-label="泰语教学模式">${button('基础模式',`setMode(this,'basic')`,'study-ghost',`aria-pressed="${session.mode==='basic'}"`)}${button('详细课堂模式',`setMode(this,'detail')`,'study-ghost',`aria-pressed="${session.mode==='detail'}"`)}</div>${button(session.practice?'返回讲解':'自己判断拼读',`practice(this)`,'study-ghost')}</div>`;
        if(!a.reading)return `${modes}<p>${esc(a.reason)}</p><p>可回到词本校对原文，再展开课堂。</p>${session.notice?`<p role="status">${esc(session.notice)}</p>`:''}`;
        const teaching=`<p class="study-thai-ipa" lang="en">IPA ${esc(a.reading.ipa)}</p><p>音节划分：<span lang="th">${esc(a.syllables.map(s=>s.written||'〔边界待核对〕').join(' · '))}</span></p><p>带调教学转写：<span lang="en">${esc(roman(a.reading.text))}</span></p><ol class="study-thai-breakdown">${a.syllables.map((s,i)=>`<li><div><b lang="th">${esc(s.written||'第 '+(i+1)+' 音节')} · <span lang="en">${esc(roman(s.reading?.text||''))}</span></b><small>${s.reading?.tone||''} ${esc(s.reading?.label||'')}</small></div>${syllableBody(s,i,session)}${voiceButtons(i)}</li>`).join('')}</ol>`;
        const lexical=a.lexical;
        return `${modes}<p class="study-thai-notice" role="status">${esc(session.notice)}</p>${session.practice?renderQuiz(session):teaching}${voiceButtons(-1)}
            <details class="study-thai-meaning"><summary>词义及语法</summary><p>词汇含义：${esc(lexical?.meaning||session.meaning||'尚未补充释义')}。</p>${lexical?`<p>句法作用：${esc(lexical.grammar)}</p>${lexical.example?`<p lang="th">${esc(lexical.example)}</p><p>${esc(lexical.translation)} ${esc(lexical.usage)}</p>`:''}`:'<p>释义沿用当前词本；尚无经核对的本词语法数据，具体句法作用须结合上下文。</p>'}</details>${renderReference()}`;
    }
    function render(term,meaning='',open=false) {
        if(!rules())return '';
        const {key,value}=newSession(term,meaning), a=value.analysis;
        const summary=a.reading?`声调 · ${a.reading.syllables.map(s=>s.tone+s.label).join(' / ')} · 逐字课堂`:'泰语逐字课堂 · 待核对';
        return `<details class="study-thai-pronunciation" ${open?'open':''}><summary>${esc(summary)}</summary><div data-thai-classroom="${key}" class="study-thai-classroom">${body(value)}</div></details>`;
    }
    function locate(node) { const panel=node.closest('[data-thai-classroom]'); return {panel,session:panel&&sessions.get(panel.dataset.thaiClassroom)}; }
    function redraw(panel,session) { if(panel&&session)panel.innerHTML=body(session); }
    function setMode(node,value) {
        const {panel,session}=locate(node);if(!session||!['basic','detail'].includes(value))return;
        session.mode=value;session.notice='';try{localStorage.setItem(MODE_KEY,value);}catch(error){session.notice='教学模式未保存：'+error.message;}redraw(panel,session);
    }
    function step(node,index) {const {panel,session}=locate(node);if(session?.analysis.syllables[index]?.verified){session.steps[index]=Math.min(6,(session.steps[index]||1)+1);redraw(panel,session);}}
    function letter(node,index,charIndex) {const {panel,session}=locate(node);if(session?.analysis.syllables[index]?.characters[charIndex]){session.letter=[index,charIndex];redraw(panel,session);}}
    function practice(node) {const {panel,session}=locate(node);if(!session)return;session.practice=!session.practice;session.feedback=null;session.answered=false;session.questionIndex=0;redraw(panel,session);}
    function answer(node,optionIndex) {
        const {panel,session}=locate(node);if(!session||session.answered)return;
        const items=session.analysis.syllables.map((s,i)=>({s,i})).filter(x=>x.s.verified), chosen=items[session.quizIndex%items.length];if(!chosen)return;
        const question=rules().questions(chosen.s)[session.questionIndex];if(!Number.isInteger(optionIndex)||!question.options[optionIndex])return;
        const correct=question.options[optionIndex]===question.answer;
        session.feedback={ok:correct,text:(correct?'这一步判断正确。':'这一步判断错误：')+question.explanation};session.answered=true;
        try{record(question,session,chosen.i,correct);session.notice=correct?'':'已记入易混项，可在拼读课堂针对复习。';}catch(error){session.notice='本次判断已显示，但易混记录没有保存：'+error.message;}
        redraw(panel,session);
        const review=document.getElementById('study-thai-home-review');if(review)review.innerHTML=reviewHtml();
    }
    function nextQuestion(node) {const {panel,session}=locate(node);if(!session||!session.answered)return;session.questionIndex++;if(session.questionIndex>=4){session.questionIndex=0;session.quizIndex++;}session.feedback=null;session.answered=false;session.notice='';redraw(panel,session);}
    async function play(node,index,slow) {
        const {panel,session}=locate(node);if(!session)return false;
        const a=session.analysis, text=index<0?a.term:a.syllables[index]?.written;
        if(!text){session.notice='音节拼写尚未对齐，无法单独示范；可听整个词。';redraw(panel,session);return false;}
        const speak=window.ByndStudy?.speakThaiLesson;
        if(!speak){session.notice='泰语音频不可用：语音组件未加载。';redraw(panel,session);return false;}
        session.notice='';
        try{const ok=await speak(text,slow);session.notice=ok?'': '泰语音频不可用，请检查系统泰语语音包或语音设置。';redraw(panel,session);return !!ok;}
        catch(error){session.notice='泰语音频不可用：'+error.message;redraw(panel,session);return false;}
    }
    function reviewHtml() {
        try {const entries=Object.entries(readReview()).filter(([,r])=>r.wrong>0).sort((a,b)=>(b[1].wrong-b[1].right)-(a[1].wrong-a[1].right));
            return `<details class="study-thai-review"><summary>我的易混项 · ${entries.length}</summary>${entries.length?entries.slice(0,20).map(([key,item])=>`<div><span>${esc(key)} · 错 ${item.wrong} / 复习对 ${item.right}</span>${button('针对复习',`review(this)`,'study-ghost',`data-review-term="${esc(item.term)}" data-review-syllable="${item.syllable}" data-review-id="${item.id}"`)}</div>`).join(''):'<p>拼读练习答错后，会在这里记录具体辅音、元音或规则。</p>'}</details>`;
        }catch(error){return `<p role="status">易混记录读取失败：${esc(error.message)}；原记录未覆盖。</p>`;}
    }
    let homeTerm='คิดถึง';
    function renderHome() {
        return `<section id="study-thai-home" class="study-panel"><form class="study-thai-search" onsubmit="event.preventDefault();ByndThaiClassroom.search(this)"><label for="study-thai-word-input">泰语拼读课堂</label><div><input id="study-thai-word-input" name="term" lang="th" maxlength="300" value="${esc(homeTerm)}" placeholder="输入泰语词，如 คิดถึง" required><button type="submit" class="study-ghost">拆解</button></div></form><div class="study-thai-examples">${rules().examples.map(term=>button(esc(term),`example(this)`,'study-ghost',`data-term="${esc(term)}" lang="th"`)).join('')}</div><div id="study-thai-home-review">${reviewHtml()}</div><div id="study-thai-home-lesson">${render(homeTerm,'',true)}</div></section>`;
    }
    function setHome(term) {homeTerm=String(term||'').trim().slice(0,300);const host=document.getElementById('study-thai-home-lesson');if(host)host.innerHTML=render(homeTerm,'',true);const input=document.getElementById('study-thai-word-input');if(input)input.value=homeTerm;const review=document.getElementById('study-thai-home-review');if(review)review.innerHTML=reviewHtml();}
    function search(form) {setHome(form.elements.term.value);}
    function example(node) {setHome(node.dataset.term);}
    function review(node) {
        const term=node.dataset.reviewTerm, index=Number(node.dataset.reviewSyllable), id=node.dataset.reviewId;
        setHome(term);const panel=document.getElementById('study-thai-home-lesson')?.querySelector('[data-thai-classroom]'),session=panel&&sessions.get(panel.dataset.thaiClassroom);if(!session)return;
        const verified=session.analysis.syllables.map((s,i)=>({s,i})).filter(x=>x.s.verified),position=verified.findIndex(x=>x.i===index);if(position<0)return;
        session.practice=true;session.quizIndex=position;session.questionIndex=rules().questions(verified[position].s).findIndex(q=>q.id===id);if(session.questionIndex<0)session.questionIndex=0;redraw(panel,session);
    }
    window.ByndThaiClassroom={render,renderHome,setMode,step,letter,practice,answer,nextQuestion,play,search,example,review,readReview};
})();
