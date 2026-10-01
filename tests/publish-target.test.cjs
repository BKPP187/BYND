'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkUpdates } = require('../scripts/check-publish-target.cjs');
const update = ref => `refs/heads/work aabb ${ref} ccdd\n`;
test('publishing main is allowed, including a worktree source branch', () => {
    assert.doesNotThrow(() => checkUpdates(update('refs/heads/main')));
});
test('non-main and mixed pushes are rejected by default', () => {
    assert.throws(() => checkUpdates(update('refs/heads/fix/bynd-icon')), /defaults to publishing main/);
    assert.throws(() => checkUpdates(update('refs/heads/main') + update('refs/tags/v1')), /defaults to publishing main/);
    assert.throws(() => checkUpdates('unrecognized input'), /Cannot verify/);
});
test('an explicit destination override is supported', () => {
    assert.doesNotThrow(() => checkUpdates(update('refs/heads/test'), true));
});
