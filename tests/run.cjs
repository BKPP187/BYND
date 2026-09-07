const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
function javascriptFiles(directory, recurse = false) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() && recurse ? javascriptFiles(file, true)
            : entry.isFile() && entry.name.endsWith('.js') ? [file] : [];
    });
}

const scripts = [...javascriptFiles(root), ...javascriptFiles(path.join(root, 'modules'), true)];
for (const file of scripts) {
    const check = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
    if (check.status !== 0) {
        process.stderr.write(check.stderr || String(check.error || 'JavaScript syntax check failed'));
        process.exit(check.status || 1);
    }
}
console.log(`JavaScript syntax checks passed (${scripts.length} files).`);

const tests = fs.readdirSync(__dirname).filter(file => file.endsWith('.test.cjs')).sort()
    .map(file => path.join(__dirname, file));
const result = spawnSync(process.execPath, ['--test', ...tests], { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
