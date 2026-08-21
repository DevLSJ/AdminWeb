ALTER TABLE crypto_key
    ADD COLUMN IF NOT EXISTS auto_rotation_days INTEGER;

ALTER TABLE key_material
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) NOT NULL DEFAULT 'system';

ALTER TABLE key_material
    ALTER COLUMN created_by DROP DEFAULT;

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    log_uid UUID NOT NULL UNIQUE,
    actor VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(150) NOT NULL,
    detail VARCHAR(1000) NOT NULL,
    prev_hash VARCHAR(128),
    row_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
    ON audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_action
    ON audit_log (actor, action);

CREATE TABLE IF NOT EXISTS audit_chain_head (
    id SMALLINT PRIMARY KEY,
    current_hash VARCHAR(128)
);

INSERT INTO audit_chain_head (id, current_hash)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;
