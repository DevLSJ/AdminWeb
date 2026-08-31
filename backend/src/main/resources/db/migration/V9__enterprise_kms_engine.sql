-- 알고리즘/모드 세분화, 공개키 보관, 키 재료 HMAC 및 완전 폐기를 지원한다.
ALTER TABLE crypto_key
    ADD COLUMN IF NOT EXISTS crypto_mode VARCHAR(32);

UPDATE crypto_key SET crypto_mode = 'GCM' WHERE crypto_mode IS NULL;
ALTER TABLE crypto_key ALTER COLUMN crypto_mode SET NOT NULL;

ALTER TABLE crypto_key
    ADD COLUMN IF NOT EXISTS public_key TEXT;

ALTER TABLE key_material
    ADD COLUMN IF NOT EXISTS integrity_hash VARCHAR(512);

UPDATE key_material SET integrity_hash = 'PENDING_V8_MATERIAL_SIGN' WHERE integrity_hash IS NULL;
ALTER TABLE key_material ALTER COLUMN integrity_hash SET NOT NULL;

ALTER TABLE key_material ALTER COLUMN wrapped_key DROP NOT NULL;
ALTER TABLE key_material ALTER COLUMN iv DROP NOT NULL;

-- 메타데이터 서명 입력에 mode/public_key/rotation policy가 추가되었으므로 재서명 대상으로 표시한다.
UPDATE crypto_key SET integrity_hash = 'PENDING_V6_SCHEMA_REALIGN';

ALTER TABLE crypto_config ALTER COLUMN iterations SET DEFAULT 10000;
COMMENT ON COLUMN crypto_config.iterations IS 'PBKDF2 반복 횟수 — 최소 10000, 운영 환경에서 상향 가능';
COMMENT ON COLUMN crypto_key.crypto_mode IS 'AES: GCM/CBC, RSA: OAEP_SHA256';
COMMENT ON COLUMN crypto_key.public_key IS 'RSA 공개키 X.509 DER Base64; DESTROYED 상태에서는 NULL';
COMMENT ON COLUMN key_material.integrity_hash IS '키 버전별 HMAC-SHA256 무결성 서명';

ALTER TABLE key_status_history ADD COLUMN IF NOT EXISTS operation VARCHAR(32);
ALTER TABLE key_status_history ADD COLUMN IF NOT EXISTS key_version INTEGER;
UPDATE key_status_history SET operation = 'STATUS_CHANGE' WHERE operation IS NULL;
UPDATE key_status_history history
SET key_version = crypto.version
FROM crypto_key crypto
WHERE history.key_id = crypto.id AND history.key_version IS NULL;
ALTER TABLE key_status_history ALTER COLUMN operation SET NOT NULL;
ALTER TABLE key_status_history ALTER COLUMN key_version SET NOT NULL;
COMMENT ON COLUMN key_status_history.key_version IS '생명주기 작업 당시 암호 키 재료 버전';

CREATE INDEX IF NOT EXISTS idx_crypto_key_created_at ON crypto_key(created_at);
CREATE INDEX IF NOT EXISTS idx_key_usage_log_operation_used_at ON key_usage_log(operation, used_at);
