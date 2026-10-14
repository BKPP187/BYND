ALTER TABLE licenses ADD COLUMN customer_email TEXT;
ALTER TABLE licenses ADD COLUMN issuance_email TEXT;
ALTER TABLE licenses ADD COLUMN last_version_code INTEGER;
ALTER TABLE audit_logs ADD COLUMN expected_revision INTEGER;
CREATE TABLE deliveries (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL REFERENCES licenses(id),
  token_hash TEXT NOT NULL UNIQUE,
  customer_email TEXT,
  receipt_origin TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  email_state TEXT NOT NULL DEFAULT 'ready',
  email_started_at INTEGER,
  email_first_attempt_at INTEGER,
  email_from TEXT,
  email_provider_id TEXT
);
CREATE INDEX delivery_license ON deliveries(license_id, created_at);
CREATE TABLE apk_artifacts (
  sha256 TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL UNIQUE,
  version_code INTEGER NOT NULL UNIQUE,
  version_name TEXT NOT NULL,
  size INTEGER NOT NULL,
  signer_sha256 TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'uploading' CHECK (state IN ('uploading','ready')),
  created_at INTEGER NOT NULL
);
CREATE TABLE storefront (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  price_label TEXT NOT NULL DEFAULT '待公布',
  purchase_url TEXT NOT NULL DEFAULT ''
);
INSERT INTO storefront (id) VALUES (1);
