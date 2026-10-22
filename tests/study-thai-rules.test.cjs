const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function harness(){const values=new Map(),elements=new Map(),calls=[];let fail='';const context=vm.createContext({window:{},document:{getElementById:id=>elements.get(id)||null},localStorage:{getItem:k=>values.get(k)??null,setItem(k,v){if(k===fail)throw Error('QuotaExceededError');values.set(k,String(v));}}});
 for(const p of ['assets/vendor/study-thai/readings.js','apps/study/study-reading.js','apps/study/study-thai-rules.js','apps/study/study-thai-classroom.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),context);
 const w=context.window;w.ByndStudy={speakThaiLesson:async(text,slow)=>{calls.push({text,slow});return true;}};
 return {w,values,elements,calls,fail:key=>fail=key,panel(term='คิดถึง'){const html=w.ByndThaiClassroom.render(term),key=html.match(/data-thai-classroom="([^"]+)"/)[1],p={dataset:{thaiClassroom:key},innerHTML:html};p.closest=()=>p;return p;}};}
const h=harness(),r=h.w.ByndThaiRules;
test('standard tone matrix covers all classes, live/dead and short/long with every mark',()=>{
 const table={中:{活:{短:[1,2,3,4,5],长:[1,2,3,4,5]},死:{短:[2,2,3,4,5],长:[2,2,3,4,5]}},高:{活:{短:[5,2,3,null,null],长:[5,2,3,null,null]},死:{短:[2,2,3,null,null],长:[2,2,3,null,null]}},低:{活:{短:[1,3,4,null,null],长:[1,3,4,null,null]},死:{短:[4,3,4,null,null],长:[3,3,4,null,null]}}};
 for(const kind of ['高','中','低'])for(const life of ['活','死'])for(const length of ['长','短'])['','่','้','๊','๋'].forEach((mark,i)=>assert.equal(r.toneRule(kind,length,life,mark),table[kind][life][length][i],[kind,length,life,mark].join('/')));
 assert.equal(r.toneRule('unknown','短','活',''),null);assert.equal(r.toneRule('低','未知','死',''),null);assert.equal(r.toneRule('中','长','活','ึ'),null);
});
test('คิดถึง derives fourth and fifth tones from independent spelling facts, not from a mark',()=>{
 const a=r.analyze('คิดถึง');assert.equal(a.complete,true);assert.equal(a.syllables.map(s=>s.written).join('|'),'คิด|ถึง');
 const [k,t]=a.syllables;assert.equal(k.onset.controller,'ค');assert.equal(k.kind,'低');assert.equal(k.vowel.actual,'i');assert.equal(k.vowel.length,'短');assert.equal(k.coda,'t');assert.equal(k.finalSound,'t̚');assert.equal(k.life,'死');assert.equal(k.mark,'');assert.equal(k.tone,4);
 assert.equal(t.kind,'高');assert.equal(t.vowel.actual,'ɯ');assert.equal(t.vowel.length,'短');assert.equal(t.coda,'ŋ');assert.equal(t.life,'活');assert.equal(t.tone,5);assert.equal(t.mark,'');
 assert.match(k.steps[0],/ค ควาย/);assert.match(k.steps[2],/ด เด็ก.*t̚/);assert.match(t.vowel.note,/不是声调/);assert.match(a.lexical.grammar,/动词/);assert.match(a.lexical.usage,/主语.*谓语.*宾语/);
});
test('all 44 letters keep name, class, initial and final values distinct',()=>{
 assert.equal(Object.keys(r.consonants).length,44);for(const [kind,count]of [['高',11],['中',9],['低',24]])assert.equal(Object.values(r.consonants).filter(c=>c.kind===kind).length,count);
 assert.equal(r.consonants['ด'].name,'ด เด็ก');assert.equal(r.consonants['ด'].initial,'d');assert.equal(r.consonants['ด'].final,'t');assert.equal(r.consonants['ญ'].initial,'j');assert.equal(r.consonants['ญ'].final,'n');
 assert.equal(r.consonants['ห'].final,'');assert.match(r.consonants['ฑ'].note,/逐词|具体词/);
 const letters=r.analyze('กัก').syllables[0].characters.filter(c=>c.glyph==='ก');assert.equal(letters[0].role,'起始辅音');assert.equal(letters[1].role,'尾辅音');
});
test('short versus long low-class dead syllables produce different tones; final classes follow sound',()=>{
 for(const [word,length,tone]of [['มัก','短',4],['มาก','长',3]]){const s=r.analyze(word).syllables[0];assert.equal(s.verified,true);assert.equal(s.life,'死');assert.equal(s.vowel.length,length);assert.equal(s.tone,tone);assert.equal(s.finalClass,'แม่กก');}
 const p=r.analyze('ขอบคุณ').syllables;assert.equal(p[0].finalSound,'p̚');assert.equal(p[0].finalClass,'แม่กบ');assert.equal(p[1].coda,'n');assert.equal(p[1].finalClass,'แม่กน');assert.equal(p[1].life,'活');
});
test('marked mid, high and low examples obey class-specific rules including glottal codas',()=>{
 for(const [word,kind,tone]of [['ก่า','中',2],['ก้า','中',3],['ก๊า','中',4],['ก๋า','中',5],['ข่า','高',2],['ข้า','高',3],['ค่า','低',3],['ค้า','低',4],['คะ','低',4],['ค่ะ','低',3],['จ๊ะ','中',4],['โต๊ะ','中',4]]){const s=r.analyze(word).syllables[0];assert.ok(s?.verified,word);assert.equal(s.kind,kind,word);assert.equal(s.tone,tone,word);}
});
test('leading letters and true clusters use a controller without changing a letter class',()=>{
 const n=r.analyze('หนู').syllables[0];assert.equal(n.onset.type,'ห นำ');assert.equal(n.kind,'高');assert.equal(n.tone,5);assert.equal(n.characters.find(c=>c.glyph==='น').letter.kind,'低');assert.match(n.note,/不单独发/);
 for(const w of ['อย่า','อยู่','อย่าง','อยาก']){const s=r.analyze(w).syllables[0];assert.equal(s.onset.type,'อ นำ ย');assert.equal(s.kind,'中');assert.equal(s.tone,2);}
 for(const [w,onset,kind,tone]of [['กล้า','kl','中',3],['ครู','kʰr','低',1],['ผลัก','pʰl','高',2]]){const s=r.analyze(w).syllables[0];assert.equal(s.onset.type,'真复辅音');assert.equal(s.onset.sound,onset);assert.equal(s.kind,kind);assert.equal(s.tone,tone);}
});
test('implicit vowel, intrinsic coda, vowel component letters and bounded exceptions are explained',()=>{
 const nom=r.analyze('นม').syllables[0];assert.equal(nom.vowel.sound,'o');assert.match(nom.vowel.name,/隐含/);assert.equal(nom.coda,'m');assert.equal(h.w.ByndStudyReading.thai('นม'),'nom');
 const water=r.analyze('น้ำ').syllables[0];assert.equal(water.vowel.length,'长');assert.equal(water.coda,'m');assert.match(water.note,/不能.*所有/);
 const go=r.analyze('ไป').syllables[0];assert.equal(go.vowel.position,'辅音左侧');assert.equal(go.final,'');assert.equal(go.coda,'j');assert.equal(go.life,'活');
 const tua=r.analyze('ตัว').syllables[0];assert.equal(tua.characters.find(c=>c.glyph==='ว').role,'元音组合部分');
 assert.equal(r.analyze('จริง').syllables[0].onset.type,'假复辅音');assert.equal(r.analyze('ทราย').syllables[0].onset.sound,'s');
 assert.match(r.analyze('ทราย').syllables[0].characters.find(c=>c.glyph==='ร').actual,/合读.*不是每个字母/);
 assert.equal(r.analyze('ทราบ').syllables[0].verified,false,'do not expand a lexical false cluster exception to every ทร word');
});
test('unique whole-word spelling paths fill missing boundaries and preserve short open syllable status',()=>{
 for(const [word,split]of [['โรคระบาด','โรค|ระ|บาด'],['อันตราย','อัน|ต|ราย']]){const a=r.analyze(word);assert.equal(a.complete,true,word);assert.equal(a.syllables.map(s=>s.written).join('|'),split);assert.equal(a.syllables.map(s=>s.written).join(''),word);}
 const a=r.analyze('โรคระบาด').syllables[1];assert.equal(a.life,'死');assert.equal(a.vowel.length,'短');assert.match(a.lifeReason,/词库未显写/);
 assert.equal(r.analyze('สวัสดี').complete,false,'two-syllable leading-class transfer is not silently guessed from standalone letters');
});
test('conflicting dictionary tones, unsupported marks, silent spellings and unknown text do not yield fabricated rules',()=>{
 const base=r.analyze('คิด').syllables[0].reading, changed=JSON.parse(JSON.stringify(base));changed.tone=2;
 const wrong=r.analyzeSyllable('คิด',changed);assert.equal(wrong.verified,false);assert.match(wrong.reason,/不一致/);
 assert.equal(r.analyzeSyllable('ค๊า',r.analyze('ค้า').syllables[0].reading).verified,false);
 assert.equal(r.analyze('เซลล์').syllables[0].verified,false);
 assert.equal(r.analyze('฿฿').complete,false);assert.equal(r.analyze('โรคติตต่ออันตราย').reading,null);
 const q=r.questions(wrong);assert.equal(q.length,0,'unsupported syllables must not be used to grade learners');
});
test('every built-in lesson has complete rule support and quiz feedback points to the specific step',()=>{
 for(const word of r.examples)assert.equal(r.analyze(word).complete,true,word);
 const qs=r.questions(r.analyze('คิด').syllables[0]);assert.equal(qs.map(q=>q.answer).join('|'),'低|短|死|4');assert.match(qs[0].explanation,/ค ควาย/);assert.match(qs[1].explanation,/สระอิ/);assert.match(qs[2].explanation,/ด เด็ก.*死音节/);assert.match(qs[3].explanation,/低辅音.*短元音.*4/);
});
test('AI teaching receives computed facts and explicit unresolved status, never supplies grading data',()=>{
 const prompt=r.promptFor('解释 คิดถึง 和 เซลล์');assert.match(prompt,/本地泰语拼读核对数据/);const data=JSON.parse(prompt.slice(prompt.indexOf('\n')+1));assert.equal(data[0].complete,true);assert.equal(data[0].syllables[0].tone,4);assert.equal(data[0].syllables[1].tone,5);assert.equal(data[1].complete,false);assert.equal(data[1].syllables[0].verified,false);assert.equal(r.promptFor('hello'),'');
});
test('classroom mode, progressive steps and letter clicks render the current word only',()=>{
 const x=harness(),p=x.panel(),ui=x.w.ByndThaiClassroom;ui.setMode(p,'detail');assert.match(p.innerHTML,/ค ควาย/);assert.doesNotMatch(p.innerHTML,/第 2 步/);ui.step(p,0);assert.match(p.innerHTML,/第 2 步/);
 ui.letter(p,0,2);assert.match(p.innerHTML,/ด เด็ก/);assert.match(p.innerHTML,/常规起始音 \/d\/.*常规尾音 \/t̚\//);assert.match(p.innerHTML,/本词作用：尾辅音/);
 assert.equal(x.values.get('bynd_study_thai_mode_v1'),'detail');assert.match(ui.render('มาก'),/aria-pressed="true"/);
});
test('wrong answers persist the exact confusion, duplicate submission is ignored, and review reads it back',()=>{
 const x=harness(),p=x.panel(),ui=x.w.ByndThaiClassroom;ui.practice(p);ui.answer(p,0);assert.match(p.innerHTML,/这一步判断错误.*ค ควาย/);
 const key='bynd_study_thai_review_v1',before=x.values.get(key);assert.equal(JSON.parse(before)['辅音:ค'].wrong,1);ui.answer(p,0);assert.equal(x.values.get(key),before);
 assert.match(ui.renderHome(),/辅音:ค.*错 1/);ui.nextQuestion(p);assert.match(p.innerHTML,/长元音还是短元音/);ui.answer(p,0);assert.equal(JSON.parse(x.values.get(key))['元音:◌ิ'].wrong,1);
 const shared=x.values;const x2=harness();x2.values.set(key,shared.get(key));assert.equal(x2.w.ByndThaiClassroom.readReview()['辅音:ค'].term,'คิดถึง');
});
test('failed/corrupt persistence is visible and never overwritten or described as saved',()=>{
 const key='bynd_study_thai_review_v1';for(const scenario of ['quota','corrupt']){const x=harness(),p=x.panel(),ui=x.w.ByndThaiClassroom;if(scenario==='quota')x.fail(key);else x.values.set(key,'{broken');const before=x.values.get(key);ui.practice(p);ui.answer(p,0);assert.match(p.innerHTML,/记录没有保存/);assert.doesNotMatch(p.innerHTML,/已记入易混项/);assert.equal(x.values.get(key),before);if(scenario==='corrupt')assert.match(ui.renderHome(),/读取失败/);}
 const x=harness(),p=x.panel();x.fail('bynd_study_thai_mode_v1');x.w.ByndThaiClassroom.setMode(p,'detail');assert.match(p.innerHTML,/教学模式未保存/);
});
test('audio requests original Thai at normal/slow speeds and reports unavailable audio honestly',async()=>{
 const x=harness(),p=x.panel(),ui=x.w.ByndThaiClassroom;await ui.play(p,-1,false);await ui.play(p,0,true);assert.deepEqual(x.calls,[{text:'คิดถึง',slow:false},{text:'คิด',slow:true}]);
 x.w.ByndStudy.speakThaiLesson=async()=>false;assert.equal(await ui.play(p,-1,false),false);assert.match(p.innerHTML,/音频不可用/);
 x.w.ByndStudy.speakThaiLesson=async()=>{throw Error('offline');};assert.equal(await ui.play(p,-1,false),false);assert.match(p.innerHTML,/offline/);
});
