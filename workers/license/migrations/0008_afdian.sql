-- Afdian records are separate from sandbox payments and existing licenses.
CREATE TABLE afdian_accounts (
  user_id TEXT PRIMARY KEY REFERENCES accounts(id),
  provider_user_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE afdian_oauth_states (
  state_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(id),
  session_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE TABLE afdian_orders (
  id TEXT PRIMARY KEY,
  out_trade_no TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES accounts(id),
  provider_user_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  amount_fen INTEGER NOT NULL CHECK(amount_fen=1388),
  state TEXT NOT NULL DEFAULT 'verified' CHECK(state IN ('verified','issued')),
  created_at INTEGER NOT NULL,
  license_id TEXT UNIQUE REFERENCES licenses(id)
);
CREATE INDEX afdian_orders_user ON afdian_orders(user_id,created_at);
-- Acknowledge notifications only after durable insertion. Retry via cron/admin.
CREATE TABLE afdian_jobs (
  out_trade_no TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','done','rejected')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_at INTEGER NOT NULL,
  lease TEXT,
  last_result TEXT
);
CREATE INDEX afdian_jobs_due ON afdian_jobs(state,next_at);
