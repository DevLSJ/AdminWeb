-- .codex-db.txt의 1·2주차 물리 스키마에 기존 데이터를 보존하며 정렬한다.

-- crypto_config: key/value 여러 행을 단일 설정 행으로 변환한다.
CREATE TABLE crypto_config_v4 (
    id BIGSERIAL PRIMARY KEY,
    salt VARCHAR(512) NOT NULL,
    kcv VARCHAR(512) NOT NULL,
    iterations INTEGER NOT NULL DEFAULT 210000,
    enc_ver VARCHAR(16) NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO crypto_config_v4 (salt, kcv, iterations, enc_ver)
SELECT
    MAX(config_value) FILTER (WHERE config_key = 'master.salt'),
    MAX(config_value) FILTER (WHERE config_key = 'master.kcv'),
    COALESCE(MAX(config_value) FILTER (WHERE config_key = 'master.iterations'), '210000')::INTEGER,
    'v1'
FROM crypto_config
HAVING MAX(config_value) FILTER (WHERE config_key = 'master.salt') IS NOT NULL
   AND MAX(config_value) FILTER (WHERE config_key = 'master.kcv') IS NOT NULL;

DROP TABLE crypto_config;
ALTER TABLE crypto_config_v4 RENAME TO crypto_config;

COMMENT ON TABLE crypto_config IS '마스터키 유도 설정 — 단일 행 유지 필수';
COMMENT ON COLUMN crypto_config.salt IS 'PBKDF2 솔트 — 16바이트 SecureRandom, Base64 인코딩';
COMMENT ON COLUMN crypto_config.kcv IS 'Key Check Value — KMS-KCV-V1 검증값, Base64 인코딩';
COMMENT ON COLUMN crypto_config.iterations IS 'PBKDF2 반복 횟수 — 최소 210000';
COMMENT ON COLUMN crypto_config.enc_ver IS '암호화 알고리즘 버전';

-- admin_user: 내부 순번 PK와 마지막 로그인 시각을 추가한다.
ALTER TABLE admin_user DROP CONSTRAINT admin_user_pkey;
ALTER TABLE admin_user ADD COLUMN id BIGSERIAL;
ALTER TABLE admin_user ADD COLUMN last_login_at TIMESTAMPTZ;
ALTER TABLE admin_user ADD CONSTRAINT admin_user_pkey PRIMARY KEY (id);
ALTER TABLE admin_user ALTER COLUMN login_id TYPE VARCHAR(64);
ALTER TABLE admin_user ALTER COLUMN name TYPE VARCHAR(64);
ALTER TABLE admin_user ALTER COLUMN password_salt TYPE VARCHAR(256);
ALTER TABLE admin_user ALTER COLUMN password_algo TYPE VARCHAR(32);
ALTER TABLE admin_user ALTER COLUMN role TYPE VARCHAR(32);
ALTER TABLE admin_user ALTER COLUMN status TYPE VARCHAR(16);
CREATE INDEX idx_admin_user_login_id ON admin_user(login_id);

COMMENT ON TABLE admin_user IS '관리자 계정 — 비밀번호 평문 저장 금지';
COMMENT ON COLUMN admin_user.login_id IS '로그인 ID (중복 불가)';
COMMENT ON COLUMN admin_user.password_hash IS 'PBKDF2-HMAC-SHA256 해시 — Base64 인코딩';
COMMENT ON COLUMN admin_user.password_salt IS '비밀번호 해시용 개별 솔트 — Base64 인코딩';
COMMENT ON COLUMN admin_user.last_login_at IS '마지막 로그인 시각 (UTC 저장)';

-- crypto_key: 명세 컬럼명·자료형과 등록자 정보를 반영한다.
ALTER TABLE crypto_key RENAME COLUMN current_version TO version;
ALTER TABLE crypto_key ALTER COLUMN key_name TYPE VARCHAR(128);
ALTER TABLE crypto_key ALTER COLUMN algorithm TYPE VARCHAR(32);
ALTER TABLE crypto_key ALTER COLUMN purpose TYPE VARCHAR(32);
ALTER TABLE crypto_key ALTER COLUMN status TYPE VARCHAR(16);
ALTER TABLE crypto_key ALTER COLUMN integrity_hash TYPE VARCHAR(512);
ALTER TABLE crypto_key
    ALTER COLUMN expire_at TYPE TIMESTAMPTZ
    USING CASE WHEN expire_at IS NULL THEN NULL ELSE expire_at::timestamp AT TIME ZONE 'UTC' END;
ALTER TABLE crypto_key ADD COLUMN created_by VARCHAR(64) NOT NULL DEFAULT 'system';
ALTER TABLE crypto_key ALTER COLUMN created_by DROP DEFAULT;
CREATE INDEX idx_crypto_key_key_uid ON crypto_key(key_uid);
CREATE INDEX idx_crypto_key_status ON crypto_key(status);
CREATE INDEX idx_crypto_key_algorithm ON crypto_key(algorithm);
CREATE INDEX idx_crypto_key_purpose ON crypto_key(purpose);
CREATE INDEX idx_crypto_key_expire_at ON crypto_key(expire_at) WHERE expire_at IS NOT NULL;

COMMENT ON TABLE crypto_key IS 'KMS 관리 키 메타정보 — 키 원문 저장 금지';
COMMENT ON COLUMN crypto_key.key_uid IS '외부 노출 식별자 UUID';
COMMENT ON COLUMN crypto_key.integrity_hash IS 'HMAC-SHA256 무결성 해시 — Base64 인코딩';

-- key_material: 래핑 값과 IV를 Base64 문자열이 아닌 bytea로 저장한다.
ALTER TABLE key_material DROP CONSTRAINT uk_key_material_version;
ALTER TABLE key_material RENAME COLUMN crypto_key_id TO key_id;
ALTER TABLE key_material RENAME COLUMN wrapping_iv TO iv;
ALTER TABLE key_material RENAME COLUMN wrapping_algorithm TO wrap_algo;
ALTER TABLE key_material
    ALTER COLUMN wrapped_key TYPE BYTEA USING decode(wrapped_key, 'base64');
ALTER TABLE key_material
    ALTER COLUMN iv TYPE BYTEA USING decode(iv, 'base64');
ALTER TABLE key_material ALTER COLUMN wrap_algo TYPE VARCHAR(32);

-- 초기 스키마는 키 버전마다 재료 행을 보존했지만 2주차 명세는 key_id당
-- 현재 재료 한 행만 허용한다. 현재 crypto_key.version과 일치하는 행을 먼저
-- 보존하고, 없으면 가장 높은 버전의 행을 보존한 뒤 UNIQUE 제약을 추가한다.
DELETE FROM key_material material
USING (
    SELECT
        candidate.id,
        ROW_NUMBER() OVER (
            PARTITION BY candidate.key_id
            ORDER BY
                CASE WHEN candidate.key_version = crypto.version THEN 0 ELSE 1 END,
                candidate.key_version DESC,
                candidate.id DESC
        ) AS row_number
    FROM key_material candidate
    JOIN crypto_key crypto ON crypto.id = candidate.key_id
) ranked
WHERE material.id = ranked.id
  AND ranked.row_number > 1;

ALTER TABLE key_material ADD CONSTRAINT uk_key_material_key UNIQUE (key_id);

COMMENT ON TABLE key_material IS '마스터키로 AES-256-GCM 래핑된 키 원문';
COMMENT ON COLUMN key_material.wrapped_key IS '래핑된 키 바이트 (bytea)';
COMMENT ON COLUMN key_material.iv IS '래핑 IV 바이트 (bytea)';

-- 상태 이력: 명세의 key_id, 필수 from_status, TEXT 사유를 적용한다.
ALTER TABLE key_status_history RENAME COLUMN crypto_key_id TO key_id;
UPDATE key_status_history SET from_status = 'CREATED' WHERE from_status IS NULL;
ALTER TABLE key_status_history ALTER COLUMN from_status SET NOT NULL;
ALTER TABLE key_status_history ALTER COLUMN from_status TYPE VARCHAR(16);
ALTER TABLE key_status_history ALTER COLUMN to_status TYPE VARCHAR(16);
ALTER TABLE key_status_history ALTER COLUMN reason TYPE TEXT;
ALTER TABLE key_status_history ALTER COLUMN changed_by TYPE VARCHAR(64);
CREATE INDEX idx_key_status_history_key_id ON key_status_history(key_id);
CREATE INDEX idx_key_status_history_changed_at ON key_status_history(changed_at);

COMMENT ON TABLE key_status_history IS '키 상태 전이 이력 — append-only';

-- 사용 로그: boolean success를 SUCCESS/FAILURE 결과 코드로 변환한다.
ALTER TABLE key_usage_log RENAME COLUMN crypto_key_id TO key_id;
ALTER TABLE key_usage_log ADD COLUMN result VARCHAR(8);
UPDATE key_usage_log SET result = CASE WHEN success THEN 'SUCCESS' ELSE 'FAILURE' END;
ALTER TABLE key_usage_log ALTER COLUMN result SET NOT NULL;
ALTER TABLE key_usage_log DROP COLUMN success;
ALTER TABLE key_usage_log RENAME COLUMN failure_reason TO fail_reason;
ALTER TABLE key_usage_log ALTER COLUMN operation TYPE VARCHAR(16);
ALTER TABLE key_usage_log ALTER COLUMN fail_reason TYPE TEXT;
ALTER TABLE key_usage_log ALTER COLUMN used_by TYPE VARCHAR(64);
CREATE INDEX idx_key_usage_log_key_id ON key_usage_log(key_id);
CREATE INDEX idx_key_usage_log_used_at ON key_usage_log(used_at);

COMMENT ON TABLE key_usage_log IS '암복호화 테스트 호출 기록';
