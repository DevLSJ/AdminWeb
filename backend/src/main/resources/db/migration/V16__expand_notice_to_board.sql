ALTER TABLE notice
    ADD COLUMN category VARCHAR(16) NOT NULL DEFAULT 'NOTICE';

ALTER TABLE notice
    ADD CONSTRAINT ck_notice_category CHECK (category IN ('NOTICE', 'GENERAL'));

CREATE INDEX idx_notice_category_created_at ON notice(category DESC, created_at DESC);

COMMENT ON TABLE notice IS '게시판 게시글 — 공지와 일반 게시물을 함께 저장한다';
COMMENT ON COLUMN notice.category IS '게시글 구분 (NOTICE: 관리자 공지, GENERAL: 일반 게시물)';
