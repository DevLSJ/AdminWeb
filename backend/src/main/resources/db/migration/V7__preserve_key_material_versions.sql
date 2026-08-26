-- 키 회전 시 과거 버전을 보존하도록 key_id 단일 행 제약을 버전별 제약으로 전환한다.
ALTER TABLE key_material DROP CONSTRAINT IF EXISTS uk_key_material_key;

ALTER TABLE key_material
    ADD CONSTRAINT uk_key_material_version UNIQUE (key_id, key_version);

CREATE INDEX IF NOT EXISTS idx_key_material_key_version
    ON key_material (key_id, key_version DESC);
