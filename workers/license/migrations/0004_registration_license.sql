-- Keep only the validated license reference, never the plaintext code.
ALTER TABLE account_tokens ADD COLUMN register_license_id TEXT REFERENCES licenses(id);
