// In-memory IndexedDB stand-in for tests: enough of the event-based API for
// key/value object stores (put/get/delete/clear/getAll/getAllKeys) and
// transaction completion, with optional injected failures.
function fakeIndexedDb() {
    const databases = new Map();
    const failures = { open: null, write: null, read: null };
    const later = fn => setImmediate(fn);
    const request = (run, tx) => {
        const req = { result: undefined, error: null, onsuccess: null, onerror: null };
        tx.pending += 1;
        later(() => {
            try {
                req.result = run();
                req.onsuccess?.({ target: req });
            } catch (error) {
                req.error = error; tx.error = error; tx.failed = true;
                req.onerror?.({ target: req });
            } finally {
                tx.pending -= 1;
                later(() => tx.settle());
            }
        });
        return req;
    };
    function makeTransaction(db, storeName, mode) {
        const stores = databases.get(db.name).stores;
        const data = stores.get(storeName);
        if (!data) throw new Error(`NotFoundError: ${storeName}`);
        const tx = { pending: 0, error: null, failed: false, done: false, oncomplete: null, onerror: null, onabort: null, mode };
        tx.settle = () => {
            if (tx.done || tx.pending > 0) return;
            tx.done = true;
            if (tx.failed) { tx.onerror?.({ target: tx }); tx.onabort?.({ target: tx }); }
            else tx.oncomplete?.({ target: tx });
        };
        const write = fn => request(() => { if (failures.write) throw failures.write; if (mode !== 'readwrite') throw new Error('ReadOnlyError'); return fn(); }, tx);
        const read = fn => request(() => { if (failures.read) throw failures.read; return fn(); }, tx);
        const store = {
            put: (value, key) => write(() => { data.set(String(key), value); return key; }),
            get: key => read(() => data.get(String(key))),
            delete: key => write(() => { data.delete(String(key)); }),
            clear: () => write(() => { data.clear(); }),
            getAll: () => read(() => [...data.values()]),
            getAllKeys: () => read(() => [...data.keys()])
        };
        tx.objectStore = name => { if (name !== storeName) throw new Error(`NotFoundError: ${name}`); return store; };
        tx.abort = () => { tx.failed = true; tx.settle(); };
        later(() => tx.settle());
        return tx;
    }
    const indexedDB = {
        open(name, version = 1) {
            const req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
            later(() => {
                if (failures.open) { req.error = failures.open; req.onerror?.({ target: req }); return; }
                const fresh = !databases.has(name);
                if (fresh) databases.set(name, { version, stores: new Map() });
                const entry = databases.get(name);
                const db = {
                    name, version, closed: false,
                    objectStoreNames: { contains: storeName => entry.stores.has(storeName) },
                    createObjectStore(storeName) { entry.stores.set(storeName, new Map()); return {}; },
                    transaction(storeName, mode = 'readonly') { return makeTransaction(db, storeName, mode); },
                    close() { db.closed = true; }
                };
                req.result = db;
                if (fresh) req.onupgradeneeded?.({ target: req });
                req.onsuccess?.({ target: req });
            });
            return req;
        }
    };
    const read = (name, storeName) => databases.get(name)?.stores.get(storeName) || new Map();
    return { indexedDB, databases, failures, read };
}

module.exports = { fakeIndexedDb };
