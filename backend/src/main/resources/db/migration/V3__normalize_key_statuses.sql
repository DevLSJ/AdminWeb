-- 키 상태를 준비/활성/만료/비활성/배포됨/배포 실패/폐기로 통일한다.
UPDATE crypto_key
SET status = 'INACTIVE'
WHERE status IN ('COMPROMISED', 'DEACTIVATED');

UPDATE key_status_history
SET from_status = 'INACTIVE'
WHERE from_status IN ('COMPROMISED', 'DEACTIVATED');

UPDATE key_status_history
SET to_status = 'INACTIVE'
WHERE to_status IN ('COMPROMISED', 'DEACTIVATED');
