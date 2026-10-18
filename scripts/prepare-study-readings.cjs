// Build once from the pinned FastThaiG2P IPA dictionary. Runtime is entirely offline.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const revision='c4759eef7df03e11fcbb9aa83efe8cf21709fd2f';
const source=`https://raw.githubusercontent.com/awslabs/FastThaiG2P/${revision}/`;
const dest=path.resolve(__dirname,'../assets/vendor/study-thai');
const additionalRevision='0b0cbe7c8aee9cdfef93371104478e412da668f6';
const additionalSource=`https://raw.githubusercontent.com/PyThaiNLP/thai-g2p-v4/${additionalRevision}/`;
async function download(file){const response=await fetch(source+file);if(!response.ok)throw new Error(`${file}: HTTP ${response.status}`);return response.text();}
async function main(){
 const raw=process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):await download('data/ipa.json');
 const sourceSha256=crypto.createHash('sha256').update(raw).digest('hex');
 if(sourceSha256!=='f7a7bc1563c8eab5df5baf537a244c878922cd835dc5c6a7aa9c0bc24f31b991')throw new Error('Pinned Thai IPA source checksum mismatch');
 const dict=Object.fromEntries(Object.entries(JSON.parse(raw)).filter(([word,ipa])=>/^[ก-๛]+$/.test(word)&&word.length>1&&typeof ipa==='string'&&/^\/[^/]+\/$/.test(ipa)));
 const extra=process.argv[3]?fs.readFileSync(process.argv[3],'utf8'):await fetch(additionalSource+'thaig2p_v4.csv').then(r=>{if(!r.ok)throw new Error('Cannot download additional Thai data');return r.text();});
 const additionalSha256=crypto.createHash('sha256').update(extra).digest('hex');
 if(additionalSha256!=='1d11e83e765f01c0d7e0cc5d6c4cd90c89ac00583b74cf9fda42dc5ddde0b205')throw new Error('Pinned additional Thai IPA source checksum mismatch');
 const context=vm.createContext({window:{}});
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../apps/study/study-reading.js'),'utf8'),context);
 context.window.ByndThaiLexicon=Object.freeze({...dict});
 const parse=context.window.ByndStudyReading.fromIpa;
 const phonemes=ipa=>ipa.replace(/[.\sˈˌ\u0361\u032f\u031a]/g,'');
 let added=0,repaired=0,rejected=0,conflicts=0;
 for(const row of extra.trim().split(/\r?\n/).slice(1)) {
  // Only pure Thai words and IPA are retained. Comma-bearing/quoted rows do
  // not meet that schema; reject them rather than guessing a CSV field.
  const fields=row.split(','),[word,,ipa]=fields;
  if(fields.length!==3||!word||!/^[ก-๛]+$/.test(word)||word.length<2||!parse(ipa)){rejected++;continue;}
  if(!Object.hasOwn(dict,word)){
   const primary=context.window.ByndStudyReading.describeThai(word);
   if(primary&&phonemes(primary.ipa)!==phonemes(ipa)){conflicts++;continue;}
   dict[word]=ipa;added++;
  }
  else if(!parse(dict[word])){dict[word]=ipa;repaired++;}
 }
 fs.mkdirSync(dest,{recursive:true});
 const output='// FastThaiG2P '+revision+' + PyThaiNLP Thai G2P v4 '+additionalRevision+'; source IPA preserved. See README.md and licenses.\nwindow.ByndThaiLexicon=Object.freeze('+JSON.stringify(dict)+');\n';
 fs.writeFileSync(path.join(dest,'readings.js'),output);
 for(const file of ['LICENSE','NOTICE'])if(!fs.existsSync(path.join(dest,file)))fs.writeFileSync(path.join(dest,file),await download(file));
 if(!fs.existsSync(path.join(dest,'thai-g2p-v4-LICENSE.txt'))) {
  const response=await fetch(additionalSource+'LICENSE');if(!response.ok)throw new Error('Cannot download additional data license');
  fs.writeFileSync(path.join(dest,'thai-g2p-v4-LICENSE.txt'),await response.text());
 }
 fs.writeFileSync(path.join(dest,'README.md'),`# Thai reading references\n\nSource: https://github.com/awslabs/FastThaiG2P/tree/${revision}\n\n${Object.keys(dict).length} merged entries (primary FastThaiG2P plus the additional source below). Source IPA is preserved verbatim, including actual tones, aspiration, vowel length and unreleased finals. Runtime learner transcription adds dt/bp for unaspirated onsets, doubles long vowels, preserves distinct vowels and adds actual-tone accents. IPA and actual tones remain inspectable. This is a BYND learner notation, not RTGS. The source combines manual, English Wiktionary and generated entries; references may need correction. These are reading aids, not authoritative phonetic transcriptions.\n\nTranscription and tone guide references: https://learnthaistyle.com/wp-content/uploads/2020/05/3.-Pronunciation-Phonetic-Letters-Guide.pdf and https://learnthaiforfree.com/thai-alphabet/tone-marks .\n\nFastThaiG2P: Apache-2.0 (LICENSE/NOTICE). Wiktionary-derived dictionary adaptations: CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/ ; attribution and history at https://en.wiktionary.org/wiki/Category:Thai_terms_with_IPA_pronunciation and source data/sources/wiktionary_ipa.json. The adapted readings.js dictionary is distributed under CC BY-SA 4.0.\n`);
 fs.appendFileSync(path.join(dest,'README.md'),`\n## Additional reading data\n\nPyThaiNLP Thai G2P v4 dataset by Wannaphong Phatthiyaphaibun: https://github.com/PyThaiNLP/thai-g2p-v4/tree/${additionalRevision} ; published dataset card: https://huggingface.co/datasets/pythainlp/thai-g2p-v4-dataset (CC0-1.0), repository license: Apache-2.0 (thai-g2p-v4-LICENSE.txt). It derives IPA from Thai W2P written pronunciations using the Wiktionary th-pron transliterator. These references include proper names and technical vocabulary, not only common words.\n\n${added} new entries; ${repaired} previously unparseable entries replaced with a complete parseable source IPA; ${rejected} rows rejected by the pure-Thai/complete-IPA schema; ${conflicts} additions rejected because they conflict with complete primary component readings. Existing parseable primary readings take priority. Original tone, aspiration and vowel-length symbols are retained; format checks are not native-speaker verification. Only the merged runtime JS is shipped, not source CSV/JSON duplicates.\n\nRebuild: node scripts/prepare-study-readings.cjs <pinned ipa.json> <pinned thaig2p_v4.csv>. Both source checksums are enforced before writing.\n`);
 fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify({revision,format:'ipa-v2',entries:Object.keys(dict).length,sourceSha256,additional:{source:additionalSource+'thaig2p_v4.csv',revision:additionalRevision,sourceSha256:additionalSha256,added,repaired,rejected,conflicts},sha256:crypto.createHash('sha256').update(output).digest('hex')},null,2)+'\n');
 console.log(`Prepared ${Object.keys(dict).length} offline Thai reading references`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
