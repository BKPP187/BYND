const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { root } = require('./helpers/harness.cjs');
const { scriptParts, wechatParts, styleParts, forumParts, comicParts, settingsParts } = require('../scripts/source-layout.cjs');

const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('runtime scripts follow the feature order and every local entry exists', () => {
    const html = read('index.html');
    const scripts = [...html.matchAll(/<script\s+src="([^"?]+)(?:\?[^\"]*)?"/g)].map(match => match[1]);
    const styles = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"?]+)(?:\?[^\"]*)?"/g)].map(match => match[1]);
    for (const file of [...scripts, ...styles].filter(file => !/^(?:https?:)?\/\//.test(file))) {
        assert.ok(fs.existsSync(path.join(root, file)), `Missing page asset: ${file}`);
    }
    const ordered = parts => parts.map(file => scripts.indexOf(file));
    for (const parts of [wechatParts, settingsParts, scriptParts]) {
        const positions = ordered(parts);
        assert.ok(positions.every(position => position >= 0), `Missing feature script in index.html`);
        assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'feature script order changed');
    }
    assert.ok(scripts.indexOf('main.js') > scripts.indexOf(scriptParts.at(-1)));
    assert.ok(scripts.indexOf('systems/living-world/living-world.js') > scripts.indexOf(wechatParts.at(-1)));
    assert.ok(scripts.indexOf('apps/comic/comic.js') > scripts.indexOf('main.js'));
    assert.ok(!scripts.includes('script.js') && !scripts.includes('wechat.js') && !scripts.includes('apps/settings/settings.js'));
});

test('ordered CSS imports resolve to the declared feature sheets', () => {
    const imports = [...read('ui/theme/style.css').matchAll(/^@import url\("([^"?]+)(?:\?[^\"]*)?"\);/gm)]
        .map(match => path.relative(root, path.resolve(root, 'ui/theme', match[1])).replaceAll('\\', '/'));
    assert.deepEqual(imports, styleParts);
    for (const file of imports) assert.ok(fs.existsSync(path.join(root, file)), `Missing CSS sheet: ${file}`);
    for (const href of [...read('ui/theme/foundation.css').matchAll(/^@import url\("([^"?]+)(?:\?[^\"]*)?"\);/gm)]) {
        assert.ok(fs.existsSync(path.resolve(root, 'ui/theme', href[1])));
    }
});

test('private closure bundles equal their maintained feature fragments', () => {
    for (const [bundle, parts] of [
        ['systems/living-world/living-world.js', forumParts],
        ['apps/comic/comic.js', comicParts],
        ['apps/settings/settings.js', settingsParts]
    ]) {
        assert.equal(read(bundle), parts.map(read).join(''), `${bundle} is out of date`);
    }
});
