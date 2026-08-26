-- V4에서 crypto_key 무결성 입력을 과제 명세의 정규화 필드로 변경했다.
-- 기존 방식의 해시는 새 규칙으로 검증할 수 없으므로, 이 마이그레이션 시점의
-- 행만 일회성 재서명 대상으로 표시한다. 애플리케이션 기동 후 즉시 HMAC으로
-- 교체되며 이후의 일반 무결성 위반 행은 자동 재서명하지 않는다.
UPDATE crypto_key
SET integrity_hash = 'PENDING_V6_SCHEMA_REALIGN';
