-- crypto_config는 마스터키 설정 한 행만 허용한다.
CREATE UNIQUE INDEX uk_crypto_config_singleton ON crypto_config ((TRUE));

-- 2주차 키 종속 데이터는 키 삭제 시 함께 정리되도록 명세의 CASCADE를 적용한다.
ALTER TABLE key_material DROP CONSTRAINT key_material_crypto_key_id_fkey;
ALTER TABLE key_material
    ADD CONSTRAINT fk_key_material_key
    FOREIGN KEY (key_id) REFERENCES crypto_key(id) ON DELETE CASCADE;

ALTER TABLE key_status_history DROP CONSTRAINT key_status_history_crypto_key_id_fkey;
ALTER TABLE key_status_history
    ADD CONSTRAINT fk_key_status_history_key
    FOREIGN KEY (key_id) REFERENCES crypto_key(id) ON DELETE CASCADE;

ALTER TABLE key_usage_log DROP CONSTRAINT key_usage_log_crypto_key_id_fkey;
ALTER TABLE key_usage_log
    ADD CONSTRAINT fk_key_usage_log_key
    FOREIGN KEY (key_id) REFERENCES crypto_key(id) ON DELETE CASCADE;
