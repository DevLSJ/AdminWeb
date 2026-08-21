CREATE TABLE IF NOT EXISTS admin_user (
    login_id VARCHAR(100) PRIMARY KEY,
    user_uid UUID NOT NULL UNIQUE,
    password_hash VARCHAR(512) NOT NULL,
    password_salt VARCHAR(128) NOT NULL,
    password_algo VARCHAR(50) NOT NULL,
    password_iter INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- 초기 개발 스키마의 숫자 PK를 1주차 명세인 login_id PK로 안전하게 전환한다.
ALTER TABLE admin_user DROP CONSTRAINT IF EXISTS admin_user_pkey;
ALTER TABLE admin_user DROP COLUMN IF EXISTS id;
ALTER TABLE admin_user ADD CONSTRAINT admin_user_pkey PRIMARY KEY (login_id);

CREATE TABLE IF NOT EXISTS crypto_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value VARCHAR(2048) NOT NULL
);

CREATE TABLE IF NOT EXISTS crypto_key (
    id BIGSERIAL PRIMARY KEY,
    key_uid UUID NOT NULL UNIQUE,
    key_name VARCHAR(120) NOT NULL UNIQUE,
    algorithm VARCHAR(30) NOT NULL,
    key_size INTEGER NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL,
    current_version INTEGER NOT NULL,
    expire_at DATE,
    integrity_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    lock_version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS key_material (
    id BIGSERIAL PRIMARY KEY,
    crypto_key_id BIGINT NOT NULL REFERENCES crypto_key(id),
    key_version INTEGER NOT NULL,
    wrapped_key VARCHAR(4096) NOT NULL,
    wrapping_iv VARCHAR(128) NOT NULL,
    wrapping_algorithm VARCHAR(50) NOT NULL,
    material_status VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    retired_at TIMESTAMPTZ,
    distributed_at TIMESTAMPTZ,
    CONSTRAINT uk_key_material_version UNIQUE (crypto_key_id, key_version)
);

CREATE TABLE IF NOT EXISTS key_status_history (
    id BIGSERIAL PRIMARY KEY,
    crypto_key_id BIGINT NOT NULL REFERENCES crypto_key(id),
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    changed_by VARCHAR(100) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_key_status_history_key_time
    ON key_status_history (crypto_key_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS key_usage_log (
    id BIGSERIAL PRIMARY KEY,
    crypto_key_id BIGINT NOT NULL REFERENCES crypto_key(id),
    operation VARCHAR(30) NOT NULL,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(500),
    used_by VARCHAR(100) NOT NULL,
    used_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_key_usage_log_key_time
    ON key_usage_log (crypto_key_id, used_at DESC);
