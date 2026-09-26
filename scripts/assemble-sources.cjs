#!/usr/bin/env node
'use strict';

// Classic-script snapshots support older source-inspection tests. The forum
// and comic bundles preserve their private closure; none of these generated
// files should be edited directly.
const fs = require('node:fs');
const path = require('node:path');
const { scriptParts, wechatParts, styleParts, forumParts, comicParts, settingsParts } = require('./source-layout.cjs');
const root = path.resolve(__dirname, '..');

function build(file, parts) {
    const contents = parts.map(part => fs.readFileSync(path.join(root, part), 'utf8')).join('');
    fs.writeFileSync(path.join(root, file), contents);
}

build('script.js', ['main.js', ...scriptParts]);
build('wechat.js', wechatParts);
build('style.css', styleParts);
build('systems/living-world/living-world.js', forumParts);
build('apps/comic/comic.js', comicParts);
build('apps/settings/settings.js', settingsParts);
