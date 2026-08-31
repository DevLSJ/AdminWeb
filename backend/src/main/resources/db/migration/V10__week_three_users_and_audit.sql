-- 3주차 사용자 개인정보 암호화 저장과 감사 로그 append-only 보호.
-- V8의 과제 기본 app_user가 비어 있을 때만 신규 암호화 모델로 교체한다.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM app_user LIMIT 1) THEN
        RAISE EXCEPTION 'V10 requires an explicit app_user data migration; existing rows found';
    END IF;
END;
$$;

DROP TABLE app_user;
CREATE TABLE app_user (
    id BIGSERIAL PRIMARY KEY,
    user_uid UUID NOT NULL UNIQUE,
    name_ciphertext BYTEA NOT NULL,
    name_iv BYTEA NOT NULL,
    name_masked VARCHAR(64) NOT NULL,
    name_search_hash VARCHAR(128) NOT NULL,
    phone_ciphertext BYTEA NOT NULL,
    phone_iv BYTEA NOT NULL,
    phone_masked VARCHAR(32) NOT NULL,
    phone_search_hash VARCHAR(128) NOT NULL UNIQUE,
    email_ciphertext BYTEA NOT NULL,
    email_iv BYTEA NOT NULL,
    email_masked VARCHAR(256) NOT NULL,
    email_search_hash VARCHAR(128) NOT NULL UNIQUE,
    password_hash VARCHAR(512) NOT NULL,
    password_salt VARCHAR(256) NOT NULL,
    password_algo VARCHAR(32) NOT NULL,
    password_iter INTEGER NOT NULL,
    status VARCHAR(16) NOT NULL,
    integrity_hash VARCHAR(512) NOT NULL,
    enc_ver INTEGER NOT NULL,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    lock_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_app_user_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT ck_app_user_enc_ver CHECK (enc_ver >= 1),
    CONSTRAINT ck_app_user_password_iter CHECK (password_iter >= 10000)
);

CREATE INDEX idx_app_user_name_search_hash ON app_user(name_search_hash);
CREATE INDEX idx_app_user_status_created_at ON app_user(status, created_at DESC);

COMMENT ON TABLE app_user IS '3주차 서비스 사용자 — 개인정보 원문 저장 금지';
COMMENT ON COLUMN app_user.name_ciphertext IS '마스터키 AES-256-GCM 이름 암호문';
COMMENT ON COLUMN app_user.phone_ciphertext IS '마스터키 AES-256-GCM 연락처 암호문';
COMMENT ON COLUMN app_user.email_ciphertext IS '마스터키 AES-256-GCM 이메일 암호문';
COMMENT ON COLUMN app_user.integrity_hash IS '개인정보 암호문·검색값·상태를 포함한 HMAC-SHA256';

DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log;
DROP FUNCTION IF EXISTS reject_audit_log_mutation();

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
CREATE TRIGGER audit_log_append_only
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
