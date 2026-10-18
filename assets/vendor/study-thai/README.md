# Thai reading references

Source: https://github.com/awslabs/FastThaiG2P/tree/c4759eef7df03e11fcbb9aa83efe8cf21709fd2f

149140 merged entries (primary FastThaiG2P plus the additional source below). Source IPA is preserved verbatim, including actual tones, aspiration, vowel length and unreleased finals. Runtime learner transcription adds dt/bp for unaspirated onsets, doubles long vowels, preserves distinct vowels and adds actual-tone accents. IPA and actual tones remain inspectable. This is a BYND learner notation, not RTGS. The source combines manual, English Wiktionary and generated entries; references may need correction. These are reading aids, not authoritative phonetic transcriptions.

Transcription and tone guide references: https://learnthaistyle.com/wp-content/uploads/2020/05/3.-Pronunciation-Phonetic-Letters-Guide.pdf and https://learnthaiforfree.com/thai-alphabet/tone-marks .

FastThaiG2P: Apache-2.0 (LICENSE/NOTICE). Wiktionary-derived dictionary adaptations: CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/ ; attribution and history at https://en.wiktionary.org/wiki/Category:Thai_terms_with_IPA_pronunciation and source data/sources/wiktionary_ipa.json. The adapted readings.js dictionary is distributed under CC BY-SA 4.0.

## Additional reading data

PyThaiNLP Thai G2P v4 dataset by Wannaphong Phatthiyaphaibun: https://github.com/PyThaiNLP/thai-g2p-v4/tree/0b0cbe7c8aee9cdfef93371104478e412da668f6 ; published dataset card: https://huggingface.co/datasets/pythainlp/thai-g2p-v4-dataset (CC0-1.0), repository license: Apache-2.0 (thai-g2p-v4-LICENSE.txt). It derives IPA from Thai W2P written pronunciations using the Wiktionary th-pron transliterator. These references include proper names and technical vocabulary, not only common words.

88175 new entries; 10 previously unparseable entries replaced with a complete parseable source IPA; 881 rows rejected by the pure-Thai/complete-IPA schema; 22438 additions rejected because they conflict with complete primary component readings. Existing parseable primary readings take priority. Original tone, aspiration and vowel-length symbols are retained; format checks are not native-speaker verification. Only the merged runtime JS is shipped, not source CSV/JSON duplicates.

Rebuild: node scripts/prepare-study-readings.cjs <pinned ipa.json> <pinned thaig2p_v4.csv>. Both source checksums are enforced before writing.
