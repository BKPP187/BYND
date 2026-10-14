CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_revision INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    verified_at INTEGER NOT NULL
);
CREATE TABLE account_tokens (
    token_hash TEXT PRIMARY KEY,
    purpose TEXT NOT NULL CHECK(purpose IN ('register','reset')),
    email TEXT NOT NULL,
    display_name TEXT,
    password_hash TEXT,
    user_id TEXT REFERENCES accounts(id),
    password_revision INTEGER,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
);
CREATE INDEX account_tokens_expiry ON account_tokens(expires_at);
CREATE TABLE account_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES accounts(id),
    password_revision INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE INDEX account_sessions_user ON account_sessions(user_id);
CREATE TABLE account_throttle (
    key_hash TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    attempts INTEGER NOT NULL
);
-- Ownership is independent of device activation and mutable fulfillment emails.
CREATE TABLE account_licenses (
    license_id TEXT PRIMARY KEY REFERENCES licenses(id),
    user_id TEXT NOT NULL REFERENCES accounts(id),
    claimed_at INTEGER NOT NULL
);
CREATE INDEX account_licenses_user ON account_licenses(user_id);
