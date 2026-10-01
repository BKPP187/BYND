CREATE TABLE licenses (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  key_hint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at INTEGER NOT NULL,
  activated_at INTEGER,
  bound_device TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  order_ref TEXT UNIQUE
);
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL,
  device TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_by TEXT
);
CREATE INDEX challenge_expiry ON challenges(expires_at);
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL REFERENCES licenses(id),
  action TEXT NOT NULL,
  device TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE releases (
  channel TEXT PRIMARY KEY CHECK (channel = 'android-stable'),
  version_code INTEGER NOT NULL,
  token TEXT NOT NULL,
  published_at INTEGER NOT NULL
);
