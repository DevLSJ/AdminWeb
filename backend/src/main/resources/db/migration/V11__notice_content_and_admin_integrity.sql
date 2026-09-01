ALTER TABLE notice_file
    ADD COLUMN IF NOT EXISTS content_enc BYTEA;

COMMENT ON COLUMN notice_file.content_enc IS '마스터키 AES-256-GCM으로 암호화한 첨부파일 본문';

ALTER TABLE admin_user
    ADD COLUMN IF NOT EXISTS integrity_hash VARCHAR(128);

COMMENT ON COLUMN admin_user.integrity_hash IS '관리 계정 핵심 필드 변조 탐지용 HMAC-SHA256';
