-- D'Guard KMS 3주차 SQLTools 시연 1: app_user 한 테이블의 3가지 보호 방식
-- 안전성: 모든 문장은 읽기 전용이며 개인정보 원문을 출력하지 않습니다.
-- SQLTools에서 `--1.` 다음 문장부터 하나씩 선택해 Run Selected Querys로 실행하세요.

--1. 현재 접속 DB·계정·PostgreSQL 버전 확인
SELECT
    current_database() AS database_name,
    current_user AS database_user,
    current_setting('server_version') AS postgres_version,
    current_setting('TimeZone') AS timezone;

--2. app_user에 암호문·마스킹·검색 HMAC·Salt·행 HMAC 컬럼이 함께 있는지 확인
SELECT
    ordinal_position,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_user'
ORDER BY ordinal_position;

--3. 최근 사용자 5건의 3가지 보호 상태 확인
--    1) 비밀번호: PBKDF2 해시+Salt  2) 개인정보: AES-GCM 암호문+IV
--    3) 검색/행 무결성: HMAC-SHA256
SELECT
    user_uid,
    name_masked,
    phone_masked,
    email_masked,
    status,
    octet_length(name_ciphertext) AS name_cipher_bytes,
    octet_length(name_iv) AS name_iv_bytes,
    octet_length(phone_ciphertext) AS phone_cipher_bytes,
    octet_length(phone_iv) AS phone_iv_bytes,
    octet_length(email_ciphertext) AS email_cipher_bytes,
    octet_length(email_iv) AS email_iv_bytes,
    password_algo,
    password_iter,
    length(password_hash) AS password_hash_chars,
    length(password_salt) AS password_salt_chars,
    length(name_search_hash) AS name_search_hmac_chars,
    length(phone_search_hash) AS phone_search_hmac_chars,
    length(integrity_hash) AS row_hmac_chars,
    enc_ver
FROM app_user
ORDER BY created_at DESC
LIMIT 5;

--4. 평문 개인정보·비밀번호 컬럼이 없는지 검증
--    결과가 0행이면 password, phone, email, name 평문 컬럼이 없습니다.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_user'
  AND column_name IN (
      'password', 'password_plain',
      'name', 'name_plain',
      'phone', 'phone_plain',
      'email', 'email_plain'
  );

--5. 비밀번호 Salt와 검색 HMAC의 사용자별 유일성 점검
--    duplicate_password_salts=0, duplicate_phone_search_hashes=0이 정상입니다.
SELECT
    (SELECT count(*) FROM (
        SELECT password_salt FROM app_user GROUP BY password_salt HAVING count(*) > 1
    ) duplicated_salts) AS duplicate_password_salts,
    (SELECT count(*) FROM (
        SELECT phone_search_hash FROM app_user GROUP BY phone_search_hash HAVING count(*) > 1
    ) duplicated_phone_hashes) AS duplicate_phone_search_hashes,
    (SELECT count(*) FROM app_user) AS total_users;

--6. 최근 서비스 사용자의 등록·수정·상태·비밀번호·원문조회 감사 이력 확인
WITH latest_user AS (
    SELECT user_uid::text AS target_id
    FROM app_user
    ORDER BY created_at DESC
    LIMIT 1
)
SELECT
    a.created_at,
    a.actor,
    a.action,
    a.target_id,
    a.detail,
    length(a.prev_hash) AS prev_hash_chars,
    length(a.row_hash) AS row_hash_chars
FROM audit_log a
JOIN latest_user u ON u.target_id = a.target_id
WHERE a.action IN (
    'USER_CREATE', 'USER_UPDATE', 'USER_STATUS_CHANGE',
    'USER_PASSWORD_RESET', 'USER_VIEW_PLAIN'
)
ORDER BY a.id DESC
LIMIT 20;
