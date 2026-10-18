-- Sandbox orders cannot be enabled against the production origin. See payments.mjs.
CREATE TABLE sandbox_payment_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES accounts(id),
    request_id TEXT NOT NULL,
    order_no TEXT NOT NULL UNIQUE,
    app_id TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    amount_fen INTEGER NOT NULL CHECK (amount_fen = 1280),
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','issued','closed','refunded')),
    trade_no TEXT UNIQUE,
    license_id TEXT UNIQUE REFERENCES licenses(id),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    paid_at INTEGER,
    checked_at INTEGER,
    UNIQUE(user_id,request_id),
    CHECK ((state IN ('issued','refunded') AND license_id IS NOT NULL AND trade_no IS NOT NULL AND paid_at IS NOT NULL)
        OR (state IN ('pending','closed') AND license_id IS NULL AND paid_at IS NULL))
);
CREATE INDEX sandbox_payment_user ON sandbox_payment_orders(user_id,created_at);
