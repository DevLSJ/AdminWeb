-- Change the minimum/default policy without invalidating existing hashes or master keys.
-- Existing passwords require rehashing with their plaintext and a refreshed row HMAC.
-- Existing master-key parameters must remain paired with their encrypted data and KCV.
ALTER TABLE app_user
    DROP CONSTRAINT ck_app_user_password_iter,
    ADD CONSTRAINT ck_app_user_password_iter CHECK (password_iter >= 10000);

ALTER TABLE crypto_config ALTER COLUMN iterations SET DEFAULT 10000;

COMMENT ON COLUMN app_user.password_hash IS 'PBKDF2-HMAC-SHA256 256비트 해시(Base64), 반복 10000회 이상';
COMMENT ON COLUMN app_user.password_iter IS 'PBKDF2 반복 횟수 — 기본 및 최소 10000';
COMMENT ON COLUMN admin_user.password_iter IS 'PBKDF2 반복 횟수 — 기본 및 최소 10000';
COMMENT ON COLUMN crypto_config.iterations IS '마스터키 PBKDF2 반복 횟수 — 기본 및 최소 10000, 기존 키는 저장된 값 유지';
