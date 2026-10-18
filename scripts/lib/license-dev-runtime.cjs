'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { Readable } = require('node:stream');
const root = path.resolve(__dirname, '../..');
class LocalD1 {
    constructor(file = ':memory:') {
        this.database = new DatabaseSync(file); this.database.exec('PRAGMA foreign_keys = ON');
        this.database.exec('CREATE TABLE IF NOT EXISTS _bynd_migrations (name TEXT PRIMARY KEY)');
        for (const name of fs.readdirSync(path.join(root, 'workers/license/migrations')).filter(x => x.endsWith('.sql')).sort()) {
            if (this.database.prepare('SELECT name FROM _bynd_migrations WHERE name = ?').get(name)) continue;
            this.database.exec('BEGIN');
            try { this.database.exec(fs.readFileSync(path.join(root, 'workers/license/migrations', name), 'utf8')); this.database.prepare('INSERT INTO _bynd_migrations VALUES (?)').run(name); this.database.exec('COMMIT'); }
            catch (error) { this.database.exec('ROLLBACK'); throw error; }
        }
        this.failWrites = false;
    }
    prepare(sql) {
        const db = this;
        return { args: [], bind(...args) { this.args = args; return this; },
            async first() { return db.database.prepare(sql).get(...this.args) || null; },
            async all() { return { results: db.database.prepare(sql).all(...this.args) }; },
            async run() { return this.execute(); },
            execute() { if (db.failWrites) throw Error('Simulated database failure'); const result = db.database.prepare(sql).run(...this.args); return { success: true, meta: { changes: Number(result.changes) } }; }
        };
    }
    async batch(statements) { this.database.exec('BEGIN'); try { const results = statements.map(x => x.execute()); this.database.exec('COMMIT'); return results; } catch (error) { this.database.exec('ROLLBACK'); throw error; } }
}
class LocalBucket {
    constructor(directory) { this.directory = path.resolve(directory); fs.mkdirSync(this.directory, { recursive: true }); }
    file(key) {
        if (!/^android\/[a-f0-9]{64}\.apk$/.test(key)) throw Error('Invalid object key');
        return path.join(this.directory, key.slice('android/'.length));
    }
    async put(key, stream, options) {
        const file = this.file(key), partial = file + '.' + crypto.randomUUID() + '.part';
        const output = fs.createWriteStream(partial, { flags: 'wx', mode: 0o600 }), hash = crypto.createHash('sha256');
        let size = 0;
        try {
            const { pipeline } = require('node:stream/promises');
            const { Transform } = require('node:stream');
            await pipeline(Readable.fromWeb(stream), new Transform({ transform(chunk, encoding, callback) { size += chunk.length; hash.update(chunk); callback(null, chunk); } }), output);
            if (hash.digest('hex') !== options.sha256) throw Error('Checksum mismatch');
            fs.renameSync(partial, file);
            fs.writeFileSync(file + '.json', JSON.stringify({ size, customMetadata: options.customMetadata }), { mode: 0o600 });
            return { size, customMetadata: options.customMetadata };
        } finally { if (fs.existsSync(partial)) fs.unlinkSync(partial); }
    }
    async head(key) {
        const file = this.file(key);
        if (!fs.existsSync(file) || !fs.existsSync(file + '.json')) return null;
        const saved = JSON.parse(fs.readFileSync(file + '.json', 'utf8'));
        return { size: fs.statSync(file).size, customMetadata: saved.customMetadata };
    }
    async get(key, options) {
        const head = await this.head(key); if (!head) return null;
        const range = options?.range;
        return { ...head, range, body: Readable.toWeb(fs.createReadStream(this.file(key), range ? { start: range.offset, end: range.offset + range.length - 1 } : undefined)) };
    }
}
function secrets(directory) {
    fs.mkdirSync(directory, { recursive: true }); const file = path.join(directory, 'local-config.json');
    if (fs.existsSync(file)) {
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!saved.ACCOUNT_SECRET) { saved.ACCOUNT_SECRET = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(file, JSON.stringify(saved), { mode: 0o600 }); }
        return saved;
    }
    const signer = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 }), kid = 'local-' + crypto.randomUUID();
    const config = { ADMIN_TOKEN: crypto.randomBytes(32).toString('hex'), ACCOUNT_SECRET: crypto.randomBytes(32).toString('hex'), LICENSE_KEY_SECRET: crypto.randomBytes(32).toString('hex'),
        SIGNING_KEY_ID: kid, SIGNING_PRIVATE_JWK: JSON.stringify(signer.privateKey.export({ format: 'jwk' })) };
    fs.writeFileSync(file, JSON.stringify(config), { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(path.join(directory, 'admin-token.txt'), config.ADMIN_TOKEN, { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(path.join(directory, 'public-keys.json'), JSON.stringify({ [kid]: signer.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url') }), { flag: 'wx', mode: 0o600 });
    return config;
}
function limiter() {
    const buckets = new Map();
    return { async limit({ key }) { const now = Math.floor(Date.now() / 60000); if (buckets.size > 1000) buckets.clear(); const current = buckets.get(key); const count = current?.minute === now ? current.count + 1 : 1; buckets.set(key, { minute: now, count }); return { success: count <= 30 }; } };
}
async function createLocalEnvironment(directory, origin) {
    const mailbox = path.join(directory, 'account-emails.json');
    let mailWrites = Promise.resolve();
    return { ...secrets(directory), DB: new LocalD1(path.join(directory, 'licenses.sqlite')), APK_BUCKET: new LocalBucket(path.join(directory, 'apks')),
        ACCOUNTS_ENABLED: 'true', ACCOUNT_RATE_LIMITER: limiter(), ACCOUNT_DEV_MAIL: {
            async read() { return fs.existsSync(mailbox) ? JSON.parse(fs.readFileSync(mailbox, 'utf8')) : []; },
            send(mail) {
                mailWrites = mailWrites.catch(() => {}).then(async () => {
                    const messages = await this.read(); messages.unshift({ ...mail, createdAt: new Date().toISOString() });
                    fs.writeFileSync(mailbox, JSON.stringify(messages.slice(0, 30), null, 2), { mode: 0o600 });
                });
                return mailWrites;
            }
        },
        PUBLIC_ORIGIN: origin, LICENSE_ACTIVATION_ENABLED: 'true', SALES_ENABLED: 'false', EMAIL_ENABLED: 'false',
        APK_ALLOWED_HOSTS: 'bynd.ccwu.cc', APK_SIGNER_SHA256: process.env.BYND_APK_SIGNER_SHA256 || '', ACTIVATION_RATE_LIMITER: limiter(), RECEIPT_RATE_LIMITER: limiter() };
}
module.exports = { LocalD1, LocalBucket, createLocalEnvironment, createLocalRateLimiter: limiter };
