-- Additive migration: keep existing ciphertext, IV and enc_ver unchanged.
CREATE INDEX idx_crypto_key_status_expire_at ON crypto_key(status, expire_at, key_uid);

-- NOT VALID retains legacy metadata-only rows while enforcing new writes.
ALTER TABLE notice_file ADD CONSTRAINT ck_notice_file_gcm_payload
    CHECK (content_enc IS NOT NULL AND octet_length(iv) = 12
        AND octet_length(content_enc) = size + 16 AND size <= 10485760) NOT VALID;
COMMENT ON TABLE notice_file IS '마스터키 AES-256-GCM 첨부파일: 암호문 BYTEA, 개별 10MiB, 게시글당 10개';
