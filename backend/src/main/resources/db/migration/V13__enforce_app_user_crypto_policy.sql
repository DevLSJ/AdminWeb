-- 사용자 등록 데이터가 애플리케이션의 암호 정책을 벗어난 형태로 저장되지 않도록 DB에서도 방어한다.
ALTER TABLE app_user
    DROP CONSTRAINT ck_app_user_password_iter,
    ADD CONSTRAINT ck_app_user_password_iter
        CHECK (password_iter >= 210000),
    ADD CONSTRAINT ck_app_user_password_algo
        CHECK (password_algo = 'PBKDF2WithHmacSHA256'),
    ADD CONSTRAINT ck_app_user_gcm_iv_length
        CHECK (
            octet_length(name_iv) = 12
            AND octet_length(phone_iv) = 12
            AND octet_length(email_iv) = 12
        ),
    ADD CONSTRAINT ck_app_user_gcm_ciphertext_length
        CHECK (
            octet_length(name_ciphertext) >= 16
            AND octet_length(phone_ciphertext) >= 16
            AND octet_length(email_ciphertext) >= 16
        );

COMMENT ON COLUMN app_user.password_salt IS '사용자별 16바이트 난수 Salt(Base64)';
COMMENT ON COLUMN app_user.password_hash IS 'PBKDF2-HMAC-SHA256 256비트 해시(Base64), 반복 210000회 이상';
COMMENT ON COLUMN app_user.phone_iv IS '연락처 AES-256-GCM 암호화용 사용자 저장 건별 12바이트 난수 IV';
