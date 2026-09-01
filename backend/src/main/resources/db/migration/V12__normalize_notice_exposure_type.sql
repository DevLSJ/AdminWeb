ALTER TABLE notice
    ALTER COLUMN expose_yn TYPE VARCHAR(1)
    USING TRIM(expose_yn);

COMMENT ON COLUMN notice.expose_yn IS '공지 노출 여부 (Y/N)';
