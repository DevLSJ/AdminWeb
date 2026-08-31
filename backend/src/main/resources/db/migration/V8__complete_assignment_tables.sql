-- 과제안내서의 10개 권장 테이블 중 누락된 3개 테이블을 추가하고,
-- 기존 테이블에서 빠진 마스터키 유도 알고리즘과 감사 로그 불변성을 보완한다.

-- crypto_config: 현재 단일 행 구조를 유지하면서 원문 핵심 항목인 algo를 추가한다.
ALTER TABLE crypto_config
    ADD COLUMN IF NOT EXISTS algo VARCHAR(64) NOT NULL DEFAULT 'PBKDF2WithHmacSHA256';

COMMENT ON COLUMN crypto_config.algo IS '마스터키 유도 알고리즘';

-- app_user: 서비스 사용자 인증정보와 암호화된 개인정보를 저장한다.
-- AES-GCM nonce 재사용을 피하기 위해 안내서의 단일 iv 예시를 개인정보별 IV로 분리한다.
CREATE TABLE app_user (
    id BIGSERIAL PRIMARY KEY,
    user_uid UUID NOT NULL UNIQUE,
    name VARCHAR(64) NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    password_salt VARCHAR(256) NOT NULL,
    password_algo VARCHAR(32) NOT NULL,
    password_iter INTEGER NOT NULL,
    phone_enc BYTEA NOT NULL,
    phone_iv BYTEA NOT NULL,
    phone_hash VARCHAR(512) NOT NULL,
    email_enc BYTEA NOT NULL,
    email_iv BYTEA NOT NULL,
    email_hash VARCHAR(512) NOT NULL,
    enc_ver INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    integrity_hash VARCHAR(512) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_app_user_password_iter_positive CHECK (password_iter > 0),
    CONSTRAINT ck_app_user_enc_ver_positive CHECK (enc_ver > 0),
    CONSTRAINT ck_app_user_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX idx_app_user_phone_hash ON app_user(phone_hash);
CREATE INDEX idx_app_user_email_hash ON app_user(email_hash);
CREATE INDEX idx_app_user_status ON app_user(status);

COMMENT ON TABLE app_user IS '서비스 사용자 — 비밀번호 평문 및 개인정보 평문 저장 금지';
COMMENT ON COLUMN app_user.user_uid IS '외부 노출용 사용자 UUID';
COMMENT ON COLUMN app_user.password_hash IS 'PBKDF2 비밀번호 해시 — Base64 인코딩';
COMMENT ON COLUMN app_user.password_salt IS '비밀번호 해시용 개별 솔트 — Base64 인코딩';
COMMENT ON COLUMN app_user.phone_enc IS '마스터키로 AES-256-GCM 암호화한 연락처';
COMMENT ON COLUMN app_user.phone_iv IS '연락처 암호화에 사용한 고유 GCM IV';
COMMENT ON COLUMN app_user.phone_hash IS '연락처 정확검색용 HMAC-SHA256';
COMMENT ON COLUMN app_user.email_enc IS '마스터키로 AES-256-GCM 암호화한 이메일';
COMMENT ON COLUMN app_user.email_iv IS '이메일 암호화에 사용한 고유 GCM IV';
COMMENT ON COLUMN app_user.email_hash IS '이메일 정확검색용 HMAC-SHA256';
COMMENT ON COLUMN app_user.enc_ver IS '개인정보 암호화에 사용한 마스터키 세대';
COMMENT ON COLUMN app_user.integrity_hash IS '행 변조 탐지용 HMAC-SHA256';

-- notice: 공지 본문과 노출 상태, 조회 수를 저장한다.
CREATE TABLE notice (
    id BIGSERIAL PRIMARY KEY,
    notice_uid UUID NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    expose_yn CHAR(1) NOT NULL DEFAULT 'Y',
    view_count BIGINT NOT NULL DEFAULT 0,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_notice_expose_yn CHECK (expose_yn IN ('Y', 'N')),
    CONSTRAINT ck_notice_view_count_nonnegative CHECK (view_count >= 0)
);

CREATE INDEX idx_notice_expose_created_at ON notice(expose_yn, created_at DESC);
CREATE INDEX idx_notice_created_by ON notice(created_by);

COMMENT ON TABLE notice IS '관리자 공지사항';
COMMENT ON COLUMN notice.notice_uid IS '외부 노출용 공지 UUID';
COMMENT ON COLUMN notice.expose_yn IS '공지 노출 여부 (Y/N)';
COMMENT ON COLUMN notice.view_count IS '공지 상세 조회 횟수';
COMMENT ON COLUMN notice.created_by IS '공지 작성 관리자 login_id';

-- notice_file: 파일 본문은 암호화된 상태로 파일 저장소에 두고 메타정보만 DB에 저장한다.
CREATE TABLE notice_file (
    id BIGSERIAL PRIMARY KEY,
    file_uid UUID NOT NULL UNIQUE,
    notice_id BIGINT NOT NULL,
    orig_name VARCHAR(255) NOT NULL,
    saved_name VARCHAR(255) NOT NULL UNIQUE,
    content_type VARCHAR(255),
    size BIGINT NOT NULL,
    iv BYTEA NOT NULL,
    enc_ver INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_notice_file_notice
        FOREIGN KEY (notice_id) REFERENCES notice(id) ON DELETE CASCADE,
    CONSTRAINT ck_notice_file_size_nonnegative CHECK (size >= 0),
    CONSTRAINT ck_notice_file_enc_ver_positive CHECK (enc_ver > 0)
);

CREATE INDEX idx_notice_file_notice_id ON notice_file(notice_id);

COMMENT ON TABLE notice_file IS '마스터키로 암호화한 공지 첨부파일 메타정보';
COMMENT ON COLUMN notice_file.file_uid IS '외부 노출용 첨부파일 UUID';
COMMENT ON COLUMN notice_file.orig_name IS '사용자가 업로드한 원본 파일명';
COMMENT ON COLUMN notice_file.saved_name IS '파일 저장소의 암호문 파일 식별자';
COMMENT ON COLUMN notice_file.size IS '원본 파일 크기(byte)';
COMMENT ON COLUMN notice_file.iv IS '파일 암호화에 사용한 고유 GCM IV';
COMMENT ON COLUMN notice_file.enc_ver IS '파일 암호화에 사용한 마스터키 세대';

-- audit_log는 V2에서 이미 생성되었다. UPDATE/DELETE를 DB 레벨에서 차단해
-- 과제안내서의 append-only 요구사항을 보장한다.
CREATE OR REPLACE FUNCTION reject_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only; % is not allowed', TG_OP;
END;
$$;

CREATE TRIGGER trg_audit_log_append_only
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION reject_audit_log_mutation();

COMMENT ON TABLE audit_log IS '관리자 행위 감사 로그 — append-only 해시 체인';
COMMENT ON COLUMN audit_log.prev_hash IS '직전 감사 로그의 row_hash';
COMMENT ON COLUMN audit_log.row_hash IS '현재 행과 prev_hash로 생성한 HMAC-SHA256';
