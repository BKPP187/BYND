const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),vendor=path.join(root,'assets/vendor/study-thai');
function harness(){const context=vm.createContext({window:{}});for(const file of ['assets/vendor/study-thai/readings.js','apps/study/study-reading.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);return context.window;}

test('expanded offline dictionary adds source-backed technical vocabulary and preserves existing reference readings',()=>{
 const w=harness(),manifest=JSON.parse(fs.readFileSync(path.join(vendor,'manifest.json'),'utf8'));
 assert.ok(manifest.entries>140000,'the shipped dictionary must actually grow, not just add a manual-edit button');
 for(const term of ['เซลล์เชื้อเพลิง','ปรากฏการณ์โฟโตอิเล็กทริก','ยาต้านเชื้อมาเลเรีย'])assert.ok(w.ByndStudyReading.describeThai(term),term);
 assert.equal(w.ByndStudyReading.thai('โรคติดต่ออันตราย'),'rôok dtìt dtɔ̀ɔ ʔan dtà raay');
 assert.equal(manifest.additional.revision,'0b0cbe7c8aee9cdfef93371104478e412da668f6');
 assert.ok(manifest.additional.added>80000);assert.ok(manifest.additional.rejected>0);assert.ok(manifest.additional.conflicts>20000);
 assert.equal(w.ByndStudyReading.thai('เซลล์'),'seel','a source-backed loanword /l/ final must not be changed to /n/');
 assert.match(w.ByndStudyReading.thai('เซลล์เชื้อเพลิง'),/^seel /,'incompatible whole-word additions never override known component sounds');
 assert.match(fs.readFileSync(path.join(vendor,'thai-g2p-v4-LICENSE.txt'),'utf8'),/Apache License/);
});

test('Thai OCR proofreading offers dictionary candidates without changing the original pronunciation',()=>{
 const r=harness().ByndStudyReading;
 assert.equal(r.thai('โรคระบาค'),'');
 assert.ok(r.suggestThai('โรคระบาค').some(x=>x.term==='โรคระบาด'&&x.reading.text==='rôok rá bàat'));
 assert.ok(r.suggestThai('โรคติตต่ออันตราย').some(x=>x.term==='โรคติดต่ออันตราย'));
 assert.equal(r.thai('โรคติตต่ออันตราย'),'','a suggestion never becomes a reading of an uncorrected term');
 assert.equal(r.suggestThai('โรคติดต่อ').length,0);
 assert.equal(r.suggestThai('hello').length,0);
 const ambiguous=r.suggestThai('เชือ').map(x=>x.term);
 assert.ok(ambiguous.includes('เชื้อ'));assert.ok(ambiguous.includes('เชื่อ'));
 assert.equal(r.suggestThai('สวัสดี฿฿').length,0);
});

test('an unusable compound entry falls back to complete valid component readings',()=>{
 const context=vm.createContext({window:{ByndThaiLexicon:{'ขอบคุณ':'/missing-tone/','ขอบ':'/kʰɔːp̚˨˩/','คุณ':'/kʰun˧/'}}});
 vm.runInContext(fs.readFileSync(path.join(root,'apps/study/study-reading.js'),'utf8'),context);
 assert.equal(context.window.ByndStudyReading.thai('ขอบคุณ'),'khɔ̀ɔp khun');
});
test('offline Thai references cover compounds and whole sentences without guessing unknown text',()=>{
 const w=harness(),read=w.ByndStudyReading.thai;
 assert.equal(read('สวัสดีค่ะ'),'sà wàt dii khâʔ');
 assert.equal(read('โรคติดต่อ'),'rôok dtìt dtɔ̀ɔ');
 assert.equal(read('โรคติดต่ออันตราย'),'rôok dtìt dtɔ̀ɔ ʔan dtà raay');
 assert.equal(read('วันนี้เรียนแค่สิบนาทีก็พอ'),'wan níi rian khɛ̂ɛ sìp naa thii kɔ̂ʔ phɔɔ');
 assert.equal(read('ขอบคุณ'),'khɔ̀ɔp khun');
 assert.equal(read('ลําบาก'),read('ลำบาก'),'OCR decomposed sara am is normalized');
 assert.equal(read('hello'),'');assert.equal(read('สวัสดี฿฿'),'','unknown runs never emit a partial pronunciation');
 const text='โรคติดต่อ';const before=read(text);delete w.ByndThaiLexicon;assert.equal(read(text),'','missing library never supplies stale cached output');assert.ok(before);
});
test('Thai reading analysis retains actual tones, vowel length and aspiration contrasts',()=>{
 const reading=harness().ByndStudyReading;
 const result=reading.describeThai('โรคติดต่อ');
 assert.equal(result.text,'rôok dtìt dtɔ̀ɔ');
 assert.equal(result.ipa,'/roːk̚˥˩.tit̚˨˩.tɔː˨˩/');
 assert.deepEqual(Array.from(result.syllables,s=>s.tone),[3,2,2]);
 assert.equal(reading.thai('ต่อ'),'dtɔ̀ɔ');
 assert.equal(reading.thai('แม่'),'mɛ̂ɛ');
 assert.equal(reading.thai('ม้า'),'máa');
 assert.equal(reading.fromIpa('/taː˧/').text,'dtaa');
 assert.equal(reading.fromIpa('/tʰaː˧/').text,'thaa');
 assert.equal(reading.fromIpa('/paː˧/').text,'bpaa');
 assert.equal(reading.fromIpa('/pʰaː˧/').text,'phaa');
 assert.equal(reading.fromIpa('/daː˧/').text,'daa');
 assert.equal(reading.fromIpa('/tɔː˨˩/').text,'dtɔ̀ɔ');
 assert.equal(reading.fromIpa('/toː˨˩/').text,'dtòo');
 assert.equal(reading.fromIpa('/kaː˩˩˦/').syllables[0].tone,5);
 assert.equal(reading.fromIpa('/kaː/'),null,'unmarked source data must not fabricate an actual tone');
 assert.equal(reading.fromIpa('/banana˧/'),null,'tone symbols do not make a malformed syllable valid Thai IPA');
});
test('offline Thai dictionary provenance, digest and runtime script order remain verifiable',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(vendor,'manifest.json'),'utf8'));
 assert.ok(manifest.entries>60000);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(vendor,'readings.js'))).digest('hex'),manifest.sha256);
 assert.match(fs.readFileSync(path.join(vendor,'README.md'),'utf8'),/CC BY-SA 4.0/);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.ok(html.indexOf('study-thai/readings.js')<html.indexOf('study-reading.js'));assert.ok(html.indexOf('study-reading.js')<html.indexOf('study-app.js'));
});
test('Thai word explanations split only its own sounds and give supported spelling-specific tone reasons',()=>{
 const reading=harness().ByndStudyReading;
 const word=reading.describeThai('โรคติดต่อ');
 assert.deepEqual(Array.from(word.syllables,item=>item.written),['โรค','ติด','ต่อ']);
 assert.equal(word.syllables[0].parts.vowel,'oː');assert.equal(word.syllables[0].parts.coda,'k');
 assert.match(word.syllables[0].explanation,/长元音/);assert.match(word.syllables[0].toneReason,/ร.*低辅音.*无调号.*3.*降/);
 assert.match(word.syllables[1].explanation,/不送气.*短元音.*尾音/);
 assert.match(word.syllables[2].explanation,/不送气.*长元音/);assert.match(word.syllables[2].toneReason,/ต.*中辅音.*่.*2.*低/);
 assert.doesNotMatch(word.syllables.map(item=>item.explanation).join(''),/แม่|ม้า|标二读三/);
 assert.match(reading.describeThai('ม้า').syllables[0].toneReason,/ม.*低辅音.*้.*4.*高/);
 assert.match(reading.describeThai('ขอบคุณ').syllables[0].explanation,/送气.*双唇闭住/);
 assert.equal(reading.describeThai('โรคติตต่ออันตราย'),null,'OCR misspellings cannot borrow the explanation of another word');
});
test('Thai spelling explanations abstain when the spelling rule disagrees with the supplied IPA',()=>{
 const w=harness();w.ByndThaiLexicon={'ก่า':'/kaː˦˥/'};
 const word=w.ByndStudyReading.describeThai('ก่า');assert.equal(word.syllables[0].tone,4);
 assert.equal(word.syllables[0].toneReason,'','never invent a spelling rationale to fit unverified dictionary data');
});
