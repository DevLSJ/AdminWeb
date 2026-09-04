ALTER TABLE admin_user
    ADD COLUMN phone_ciphertext BYTEA,
    ADD COLUMN phone_iv BYTEA,
    ADD COLUMN phone_masked VARCHAR(32),
    ADD COLUMN email_ciphertext BYTEA,
    ADD COLUMN email_iv BYTEA,
    ADD COLUMN email_masked VARCHAR(256),
    ADD COLUMN contact_enc_ver INTEGER;

ALTER TABLE admin_user
    ADD CONSTRAINT ck_admin_user_phone_protection
        CHECK (
            (phone_ciphertext IS NULL AND phone_iv IS NULL AND phone_masked IS NULL)
            OR
            (phone_ciphertext IS NOT NULL AND phone_iv IS NOT NULL AND phone_masked IS NOT NULL
                AND octet_length(phone_iv) = 12 AND octet_length(phone_ciphertext) >= 16)
        ),
    ADD CONSTRAINT ck_admin_user_email_protection
        CHECK (
            (email_ciphertext IS NULL AND email_iv IS NULL AND email_masked IS NULL)
            OR
            (email_ciphertext IS NOT NULL AND email_iv IS NOT NULL AND email_masked IS NOT NULL
                AND octet_length(email_iv) = 12 AND octet_length(email_ciphertext) >= 16)
        ),
    ADD CONSTRAINT ck_admin_user_contact_encryption_version
        CHECK (
            (phone_ciphertext IS NULL AND email_ciphertext IS NULL AND contact_enc_ver IS NULL)
            OR
            ((phone_ciphertext IS NOT NULL OR email_ciphertext IS NOT NULL) AND contact_enc_ver = 1)
        );

COMMENT ON COLUMN admin_user.phone_ciphertext IS '마스터키 AES-256-GCM으로 암호화한 관리 계정 연락처';
COMMENT ON COLUMN admin_user.phone_iv IS '연락처 암호화에 사용한 12바이트 난수 GCM IV';
COMMENT ON COLUMN admin_user.phone_masked IS '목록·상세 응답용 마스킹 연락처';
COMMENT ON COLUMN admin_user.email_ciphertext IS '마스터키 AES-256-GCM으로 암호화한 관리 계정 이메일';
COMMENT ON COLUMN admin_user.email_iv IS '이메일 암호화에 사용한 12바이트 난수 GCM IV';
COMMENT ON COLUMN admin_user.email_masked IS '목록·상세 응답용 마스킹 이메일';
COMMENT ON COLUMN admin_user.contact_enc_ver IS '관리 계정 연락처·이메일 암호화 형식 버전';

-- 기존 행의 V1 무결성 해시는 애플리케이션이 조회 시 검증한 뒤 V2로 재서명한다.
