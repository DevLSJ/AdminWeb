-- Additive settings only: preserve existing keys, expiry dates and crypto_config.
CREATE TABLE common_code (
    id VARCHAR(80) PRIMARY KEY,
    code_group VARCHAR(20) NOT NULL,
    code VARCHAR(32) NOT NULL,
    label VARCHAR(80) NOT NULL,
    description VARCHAR(200) NOT NULL,
    sort_order INTEGER NOT NULL CHECK (sort_order BETWEEN 0 AND 999),
    enabled BOOLEAN NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (code_group, code)
);
CREATE TABLE key_policy (
    id BIGINT PRIMARY KEY CHECK (id = 1),
    default_validity_days INTEGER NOT NULL CHECK (default_validity_days BETWEEN 1 AND 3650),
    expiry_warning_days INTEGER NOT NULL CHECK (expiry_warning_days BETWEEN 1 AND 365),
    updated_by VARCHAR(100) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);
INSERT INTO key_policy VALUES (1, 365, 30, 'SYSTEM', CURRENT_TIMESTAMP, 0);
INSERT INTO common_code (id, code_group, code, label, description, sort_order, enabled) VALUES
('ALGORITHM:AES', 'ALGORITHM', 'AES', '대칭키 · AES-256-GCM', 'AES-256-GCM', 10, true),
('ALGORITHM:RSA', 'ALGORITHM', 'RSA', '공개키 · RSA-2048-SHA256', 'RSA-2048-SHA256', 20, true),
('ALGORITHM:HMAC', 'ALGORITHM', 'HMAC', '메시지 인증 · HMAC', '기존 키 조회 전용', 30, false),
('PURPOSE:ENCRYPT', 'PURPOSE', 'ENCRYPT', '암복호화', '데이터 암복호화', 10, true),
('PURPOSE:SIGN', 'PURPOSE', 'SIGN', '서명', '기존 키 조회 전용', 20, false),
('PURPOSE:AUTH', 'PURPOSE', 'AUTH', '인증', '기존 키 조회 전용', 30, false),
('PURPOSE:WRAP', 'PURPOSE', 'WRAP', '키 래핑', '키 래핑', 40, true),
('STATUS:CREATED', 'STATUS', 'CREATED', '생성됨', '활성화 전 키', 10, true),
('STATUS:ACTIVE', 'STATUS', 'ACTIVE', '활성화', '암복호화 가능', 20, true),
('STATUS:DEACTIVATED', 'STATUS', 'DEACTIVATED', '비활성', '암복호화 중지', 30, true),
('STATUS:COMPROMISED', 'STATUS', 'COMPROMISED', '침해', '폐기만 가능', 40, true),
('STATUS:DESTROYED', 'STATUS', 'DESTROYED', '폐기', '키 재료 제거 완료', 50, true);
