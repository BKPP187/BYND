'use strict';
// Original grid-drawn SVG artwork, inspired by the supplied monochrome references.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../assets/ui/pixel-chat');
fs.mkdirSync(path.join(root, 'stickers'), { recursive: true });
const ink = '#171719', paper = '#f5f5ef', grey = '#bbbcc2', purple = '#484066';
const rect = (x, y, w, h, fill = ink) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const shape = (d, fill = paper, stroke = ink) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="miter"/>`;
const line = d => shape(d, 'none');
const group = (content, x = 0, y = 0, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})">${content}</g>`;
const svg = (name, content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><title>${name}</title>${content}</svg>\n`;
const heart = (fill = ink) => shape('M2 5H4V3H8V5H10V3H14V5H16V10H14V12H12V14H10V16H8V14H6V12H4V10H2Z', fill);
const spark = group(shape('M5 0H6V4H10V5H6V9H5V5H1V4H5Z', paper), 0, 0);
const star = (fill = paper) => shape('M14 3H18V7H20V11H28V15H24V19H22V23H24V28H20V26H18V24H14V26H12V28H8V23H10V19H8V17H4V13H12V9H14Z', fill);
const bunnyBody = shape('M5 15V7H7V4H11V6H13V9H15V6H17V4H22V7H24V15H26V25H24V27H6V25H4V15Z');
const mouth = line('M13 23H14V24H16V23H17');
const eye = (x, y = 19) => rect(x, y, 3, 4) + rect(x + 1, y + 1, 1, 1, paper);
const blush = rect(6, 23, 4, 2, grey) + rect(21, 23, 4, 2, grey);
function bunny(mood) {
    const eyes = eye(8) + eye(20);
    const faces = {
        hello: eyes + mouth,
        round: group(shape('M0 1H4V5H0Z') + rect(1, 2, 2, 1, paper), 8, 19) + group(shape('M0 1H4V5H0Z') + rect(1, 2, 2, 1, paper), 19, 19) + mouth,
        wink: eye(8) + line('M23 19H21V21H23V23H21') + mouth + group(spark, 24, 10, .6),
        cry: line('M8 19H11V18H12M19 18H20V19H23') + rect(8, 20, 3, 5, grey) + rect(20, 20, 3, 5, grey) + line('M13 25V23H17V25') + group(spark, 1, 25, .5) + group(spark, 26, 25, .5),
        shining: eyes + mouth + group(spark, 23, 7, .7) + group(spark, 1, 25, .6),
        headphones: line('M3 18V9H5V5H9V3H21V5H25V9H27V18') + rect(3, 14, 3, 7, grey) + rect(24, 14, 3, 7, grey) + line('M8 20V22H12V20M19 20V22H23V20') + mouth,
        sleepy: rect(8, 20, 4, 1) + rect(19, 20, 4, 1) + blush + mouth,
        mask: eyes + shape('M12 19H18V25H12Z', grey) + line('M12 21H18M12 23H18'),
        confused: eyes + mouth + line('M23 1H26V3H24V5M24 7H25'),
        shy: eyes + blush + line('M9 24H11V26H13V28H16V26H18V24H20M12 21V23M14 21V23M16 21V23M18 21V23'),
        cool: shape('M6 18H14V22H12V24H8V22H6Z', ink) + shape('M17 18H25V22H23V24H19V22H17Z', ink) + line('M14 19H17') + rect(8, 19, 4, 1, paper) + rect(19, 19, 4, 1, paper) + mouth + group(spark, 0, 8, .6),
        tongue: rect(8, 20, 4, 1) + rect(19, 20, 4, 1) + line('M10 24H20') + shape('M13 24H17V28H15V29H13Z', grey) + blush,
        dizzy: group(line('M0 0H5V5H1V1H4V4H2V2'), 7, 18) + group(line('M0 0H5V5H1V1H4V4H2V2'), 19, 18) + mouth + group(spark, 1, 11, .6),
        scratched: shape('M5 15V7H7V4H11V6H13V9H15V6H17V4H22V7H24V15H26V25H24V27H6V25H4V15Z', grey) + line('M3 9H9M3 12H8M3 16H8M3 20H8M3 24H8') + rect(8, 21, 4, 3) + rect(20, 21, 4, 3) + mouth,
        embarrassed: rect(8, 20, 4, 1) + rect(19, 20, 4, 1) + blush + line('M10 25H20M12 21V23M14 21V23M16 21V23M18 21V23'),
        bow: line('M5 21H8V17H11V16H14V19H17V16H20V17H23V21H26M4 26H26') + rect(5, 18, 20, 8, paper) + line('M5 21H8V17H11V16H14V19H17V16H20V17H23V21H26M4 26H26')
    };
    return bunnyBody + (faces[mood] || faces.hello);
}
const headphones = shape('M4 23V11H6V7H10V4H22V7H26V11H28V23H24V14H26V11H24V8H21V6H11V8H8V11H6V14H8V23Z', grey, purple) + rect(6, 17, 4, 10, purple) + rect(22, 17, 4, 10, purple);
const camera = shape('M3 11H9V7H20V9H24V11H29V27H3Z', grey) + shape('M11 15H13V13H21V15H23V23H21V25H13V23H11Z', '#555') + rect(15, 16, 5, 3, '#8d8e92') + rect(11, 9, 7, 2, paper) + rect(4, 12, 4, 2, paper);
const clipboard = shape('M6 6H11V3H21V6H26V29H6Z', grey) + rect(8, 8, 16, 19, paper) + shape('M11 6V4H14V2H18V4H21V6Z', paper) + line('M10 14H12V16H14V12H16M10 22H12V24H14V20H16') + rect(18, 14, 4, 1, grey) + rect(18, 22, 4, 1, grey);
const hourglass = shape('M7 3H25V6H23V10H21V13H18V17H21V20H23V26H25V29H7V26H9V20H11V17H14V13H11V10H9V6H7Z') + shape('M11 7H21V10H19V12H17V14H15V12H13V10H11Z', grey, 'none') + shape('M11 25V22H13V20H15V18H17V20H19V22H21V25Z', grey, 'none');
const disc = shape('M12 3H20V5H24V8H27V12H29V20H27V24H24V27H20V29H12V27H8V24H5V20H3V12H5V8H8V5H12Z', grey) + shape('M14 12H18V14H20V18H18V20H14V18H12V14H14Z', paper) + line('M8 8H12M6 11H10M21 23H25');
const music = shape('M12 7V22H8V24H5V28H11V26H15V11H24V20H20V22H17V26H23V24H27V4H24V7Z', ink);
const bubble = shape('M3 5H28V7H30V21H28V23H16V25H14V27H11V23H3V21H1V7H3Z') + rect(6, 11, 3, 3) + rect(14, 11, 3, 3) + rect(22, 11, 3, 3);
const wing = shape('M5 15H8V11H13V8H18V4H21V3H23V7H21V10H24V12H22V15H24V18H20V21H15V24H11V26H7V24H4V21H3V17H5Z') + line('M6 20H10V23M12 15H18M16 11H21');
const wand = group(star(grey), 1, 1, .65) + shape('M17 18H20V20H22V22H24V24H26V26H28V29H25V27H23V25H21V23H19V21H17Z', ink) + group(spark, 23, 3, .7);
const dinosaur = shape('M16 3H28V5H30V11H22V13H27V15H21V18H23V21H21V24H19V29H16V26H12V29H9V24H6V22H4V19H2V13H4V16H6V18H10V16H12V13H14V5H16Z', ink) + rect(18, 5, 2, 2, paper) + rect(14, 8, 2, 2, paper) + rect(12, 13, 2, 2, paper) + rect(10, 16, 2, 2, paper) + rect(6, 19, 4, 1, paper);
const tools = {
    ai: star(), sticker: bunny('hello'), voice: headphones, transfer: shape('M6 4H23V27H6Z', grey) + shape('M10 10H20V13H18V20H12V23H10Z') + rect(24, 20, 4, 7, purple),
    redpacket: group(heart(), 5, 5, 1.2), video: camera + rect(22, 17, 6, 5, purple), call: headphones,
    camera, image: camera, poke: wing, shake: shape('M4 10H11V7H21V10H28V24H21V27H11V24H4Z', grey) + line('M3 6H7M25 6H29M2 28H6M26 28H30'),
    music, dinosaur, hourglass, player: shape('M7 2H25V30H7Z', grey, purple) + rect(9, 4, 14, 10, purple) + line('M10 12H12V10H14V8H16V6H18') + shape('M14 19H16V21H18V23H16V25H14Z', purple, purple),
    screen: shape('M3 5H29V23H3Z', grey) + rect(5, 7, 22, 14, paper) + rect(14, 24, 4, 3) + rect(9, 27, 14, 2),
    manager: clipboard, memory: disc, settings: clipboard + group(shape('M0 0H7V7H0Z', paper, purple), 20, 18),
    send: shape('M4 7H29V10H27V13H25V16H23V19H21V22H19V25H17V28H15V19H11V17H7V15H4Z', ink) + line('M14 18H16V16H18V14H20V12H22'),
    microphone: shape('M13 3H19V5H21V17H19V19H13V17H11V5H13Z', grey) + line('M7 14V20H9V22H13V24H19V22H23V20H25V14M16 24V29M11 29H21'),
    back: line('M23 8H20V11H17V14H14V17H17V20H20V23H23'), more: rect(5, 15, 4, 4) + rect(14, 15, 4, 4) + rect(23, 15, 4, 4)
};
for (const [name, art] of Object.entries(tools)) fs.writeFileSync(path.join(root, `${name}.svg`), svg(name, art));
const stickers = [
    ['magic-wand', '魔法棒', wand], ['bunny-hello', '你好', bunny('hello')],
    ['heart-cookie', '爱心饼干', shape('M11 4H21V6H25V10H28V21H25V25H21V28H11V25H7V21H4V11H7V7H11Z') + group(heart(paper), 8, 7, .8)],
    ['wing-right', '小翅膀', wing], ['bunny-playful', '调皮', bunny('tongue') + group(heart(paper), 17, 3, .55)],
    ['bunny-round', '乖巧', bunny('round')], ['angel-heart', '天使爱心', group(wing, -1, 7, .65) + group(wing, 20, 7, .5) + group(heart(), 7, 6, 1.1) + rect(14, 13, 4, 8, paper) + rect(12, 15, 8, 3, paper)],
    ['bunny-wink', '眨眼', bunny('wink')], ['sun-wand', '星光魔法', wand + group(spark, 1, 26, .65)],
    ['bunny-cry', '哭哭', bunny('cry')], ['broken-heart', '心碎', group(heart(paper), 3, 2, 1.5) + line('M16 8V12H14V15H17V18H15V23') + rect(3, 28, 2, 1) + rect(26, 27, 2, 1)],
    ['bunny-shining', '星星眼', bunny('shining')], ['heart-sparkles', '心动', group(heart(), 8, 1, .6) + group(spark, 21, 12, .7) + group(spark, 3, 22, .65)],
    ['bunny-headphones', '听歌', bunny('headphones')], ['bunny-sleepy', '困困', bunny('sleepy')], ['music-notes', '音乐', music + group(music, 3, 4, .35)],
    ['bunny-mask', '口罩', bunny('mask')], ['angry-marks', '生气', line('M5 5V9H9M15 5V9H11M5 15V11H9M15 15V11H11M19 19V23H23M29 19V23H25M19 29V25H23M29 29V25H25')],
    ['bunny-bow', '鞠躬', bunny('bow') + line('M24 1H27V3H25V5M26 7H27')], ['heart-arrow', '爱心箭', group(heart(paper), 1, 12, .8) + shape('M12 17H15V14H18V11H21V8H24V5H27V2H30V5H27V8H24V11H21V14H18V17H15V20H12Z', ink)],
    ['bunny-shy', '害羞', bunny('shy')], ['floating-hearts', '喜欢你', group(heart(), 0, 19, .45) + group(heart(), 9, 10, .65) + group(heart(), 18, 1, .8)],
    ['bunny-cool', '酷酷', bunny('cool')], ['lucky-cards', '好运', shape('M6 7H17V25H6Z') + shape('M15 12H26V28H15Z', grey) + rect(9, 13, 5, 5) + group(spark, 2, 1, .6) + line('M28 2V9M26 4H30M26 7H30')],
    ['bunny-tongue', '吐舌', bunny('tongue')], ['wing-left', '飞飞', group(wing, 30, 0, -1).replace('scale(-1)', 'scale(-1 1)')],
    ['beer', '干杯', shape('M6 12H22V28H6Z', grey) + shape('M22 15H27V24H22Z') + shape('M5 12V8H8V6H12V8H16V5H20V8H23V12H19V15H16V12H12V14H9V12Z') + line('M10 17V25M16 17V25') + rect(24, 3, 1, 1) + rect(27, 6, 1, 1)],
    ['bunny-dizzy', '晕晕', bunny('dizzy')], ['diamonds', '闪闪', group(shape('M6 1V4H9V7H11V9H9V12H6V15H3V12H1V9H3V7H6Z'), 0, 0) + group(shape('M6 1V4H9V7H11V9H9V12H6V15H3V12H1V9H3V7H6Z', grey), 16, 10, .9) + group(spark, 9, 24, .6)],
    ['bunny-scratched', '受伤', bunny('scratched')], ['three-dots', '省略号', group(heart(), 0, 9, .5) + group(heart(), 10, 9, .5) + group(heart(), 20, 9, .5)],
    ['hug-circle', '抱抱', shape('M12 3H20V5H24V8H27V12H29V20H27V24H24V27H20V29H12V27H8V24H5V20H3V12H5V8H8V5H12Z', 'none') + group(bunny('hello'), 9, 16, .45) + line('M10 6H7V10H6V23H9M22 6H25V10H26V23H23')],
    ['bunny-propeller', '起飞', group(bunny('hello'), 2, 9, .9) + shape('M5 1H9V3H13V5H20V3H24V1H28V4H24V6H20V8H13V6H9V4H5Z')],
    ['heart-hug', '爱心抱抱', group(heart(paper), 0, 0, 1.8) + group(bunny('hello'), 9, 17, .45)],
    ['little-cheer', '开心', group(bunny('hello'), 8, 12, .55) + line('M16 1V5M5 8H8M24 8H27M1 15H5M27 15H31M7 2V5H9M23 2V5H21')],
    ['bunny-alert', '注意', group(bunny('hello'), 1, 13, .55) + shape('M21 17H29V25H21Z') + rect(24, 19, 2, 3) + rect(24, 23, 2, 1) + group(spark, 13, 2, .8)],
    ['bunny-embarrassed', '脸红', bunny('embarrassed')], ['bunny-question', '怎么了', group(bunny('hello'), 1, 11, .6) + shape('M20 10H28V12H30V22H28V24H22V26H20V24H18V12H20Z') + line('M22 14H26V17H24V19') + rect(24, 21, 1, 1) + line('M8 2V7M12 0V8M16 2V7')],
    ['double-exclamation', '惊叹', shape('M6 4H10V6H12V18H10V22H7V18H5V6H6Z') + rect(7, 25, 4, 4) + shape('M20 4H24V6H26V18H24V22H21V18H19V6H20Z', grey) + rect(21, 25, 4, 4)],
    ['double-question', '疑惑', shape('M3 6H5V4H12V6H15V13H13V15H10V19H6V14H9V11H11V9H5V11H3Z', grey) + rect(6, 23, 4, 4) + group(shape('M3 6H5V4H12V6H15V13H13V15H10V19H6V14H9V11H11V9H5V11H3Z', grey) + rect(6, 23, 4, 4), 15, 3)]
];
for (const [id, name, art] of stickers) fs.writeFileSync(path.join(root, 'stickers', `${id}.svg`), svg(name, art));
fs.writeFileSync(path.join(root, 'stickers.json'), JSON.stringify(stickers.map(([id, name]) => ({ id, name })), null, 2) + '\n');
const snow = Array.from({ length: 70 }, (_, i) => `<rect x="${(i * 73) % 375}" y="${(i * 113) % 720}" width="${i % 3 + 1}" height="${i % 3 + 1}" fill="#fff" opacity=".7"/>`).join('');
const wallpaper = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 720"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#d8d9de"/><stop offset=".55" stop-color="#9499a7"/><stop offset="1" stop-color="#c6c8ce"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h375v720H0z"/><g opacity=".13" fill="#252640"><path d="M0 410h30v-42h24v-55h19v-18h47v21h30v94h70v-28h31v-70h60v-28h28v25h36v130H0z"/><path d="M45 480v-215h4v83l-25-35v-4l25 28v-50l-18-27v-5l18 22v-54h4v129l29-50v8l-29 56v40l-33-23v5l33 28v94zm221 0V170h5v60l24-39v8l-24 45v42l-34-50v-8l34 43v53l34-40v6l-34 46v64l-57-45v6l57 50v79z"/></g>${snow}<g fill="#fff" opacity=".5" shape-rendering="crispEdges"><path d="M46 62h8v8h8v8h-8v8h-8v-8h-8v-8h8zM306 566h8v8h8v8h-8v8h-8v-8h-8v-8h8z"/><path d="M41 620h7v-7h10v7h7v12h-7v7h-4v5h-5v-5h-4v-7h-4zm255-521h7v-7h10v7h7v12h-7v7h-4v5h-5v-5h-4v-7h-4z"/></g></svg>`;
fs.writeFileSync(path.join(root, 'wallpaper.svg'), wallpaper);
console.log(`Generated ${Object.keys(tools).length} tool icons and ${stickers.length} stickers.`);
