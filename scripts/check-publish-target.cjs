'use strict';
// Shared pre-push gate. Override only when the user explicitly requests another branch.
function checkUpdates(input, allowNonMain = false) {
    if (allowNonMain) return;
    for (const line of input.trim().split(/\r?\n/).filter(Boolean)) {
        const fields = line.trim().split(/\s+/);
        if (fields.length !== 4) throw new Error('Cannot verify Git push destination.');
        if (fields[2] !== 'refs/heads/main') throw new Error('BYND defaults to publishing main. This push targets ' + fields[2] + '. Use BYND_ALLOW_NON_MAIN_PUSH=1 only when the user explicitly requests that destination.');
    }
}
if (require.main === module) {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { input += chunk; });
    process.stdin.on('end', () => {
        try { checkUpdates(input, process.env.BYND_ALLOW_NON_MAIN_PUSH === '1'); }
        catch (error) { console.error(error.message); process.exitCode = 1; }
    });
}
module.exports = { checkUpdates };
