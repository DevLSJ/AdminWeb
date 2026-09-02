-- D'Guard KMS 3주차 SQLTools 시연 2: 감사로그 해시 체인·append-only 검증
-- 안전성: 운영 감사행을 수정/삭제하지 않습니다.
-- SQLTools에서 `--1.` 다음 문장부터 하나씩 선택해 Run Selected Querys로 실행하세요.

--1. prev_hash가 바로 이전 행 row_hash와 연결되는지 전체 검증
--    broken_links=0이 정상입니다.
WITH chain AS (
    SELECT
        id,
        log_uid,
        prev_hash,
        row_hash,
        lag(row_hash) OVER (ORDER BY id) AS expected_prev_hash
    FROM audit_log
)
SELECT
    count(*) AS checked_rows,
    count(*) FILTER (
        WHERE prev_hash IS DISTINCT FROM expected_prev_hash
    ) AS broken_links
FROM chain;

--2. 저장된 체인 헤드가 마지막 감사 행 row_hash와 일치하는지 검증
--    head_matches=true가 정상입니다.
SELECT
    h.id AS chain_id,
    h.current_hash AS stored_head,
    last_log.row_hash AS last_row_hash,
    h.current_hash IS NOT DISTINCT FROM last_log.row_hash AS head_matches
FROM audit_chain_head h
LEFT JOIN LATERAL (
    SELECT row_hash
    FROM audit_log
    ORDER BY id DESC
    LIMIT 1
) last_log ON true
WHERE h.id = 1;

--3. audit_log UPDATE/DELETE 차단 트리거 설치 상태 확인
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_orientation,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'audit_log'
ORDER BY trigger_name, event_manipulation;

--4. append-only UPDATE 차단 동작 시연
--    트리거 예외를 이 블록 안에서 받으므로 실제 데이터는 변경되지 않습니다.
--    SQLTools Messages에 `PASS: audit_log UPDATE blocked` NOTICE가 표시되어야 합니다.
DO $$
DECLARE
    target_log_id BIGINT;
BEGIN
    SELECT id INTO target_log_id FROM audit_log ORDER BY id LIMIT 1;
    IF target_log_id IS NULL THEN
        RAISE NOTICE 'SKIP: audit_log is empty';
        RETURN;
    END IF;

    BEGIN
        UPDATE audit_log
        SET detail = detail
        WHERE id = target_log_id;
        RAISE EXCEPTION 'FAIL: audit_log UPDATE unexpectedly succeeded';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'audit_log is append-only' THEN
                RAISE NOTICE 'PASS: audit_log UPDATE blocked (%)', SQLERRM;
            ELSE
                RAISE;
            END IF;
    END;
END;
$$;

--5. 감사 체인 행별 연결 샘플 10건 확인
SELECT
    id,
    log_uid,
    actor,
    action,
    target_type,
    target_id,
    left(coalesce(prev_hash, 'GENESIS'), 16) AS prev_hash_prefix,
    left(row_hash, 16) AS row_hash_prefix,
    created_at
FROM audit_log
ORDER BY id DESC
LIMIT 10;

--6. 원문 조회와 CSV 내려받기가 감사 체인에 기록되었는지 확인
SELECT
    created_at,
    actor,
    action,
    target_type,
    target_id,
    detail,
    length(row_hash) AS row_hash_chars
FROM audit_log
WHERE action IN ('USER_VIEW_PLAIN', 'AUDIT_EXPORT')
ORDER BY id DESC
LIMIT 20;
