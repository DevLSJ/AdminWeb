-- 암호화 서비스 사용자도 관리 계정과 동일한 ADMIN/CLIENT 권한 체계를 사용한다.
-- 기존 3주차 사용자에게는 최소 권한인 CLIENT를 부여한다.
ALTER TABLE app_user
    ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'CLIENT',
    ADD COLUMN integrity_ver INTEGER NOT NULL DEFAULT 1,
    ADD CONSTRAINT ck_app_user_role CHECK (role IN ('ADMIN', 'CLIENT')),
    ADD CONSTRAINT ck_app_user_integrity_ver CHECK (integrity_ver IN (1, 2));

COMMENT ON COLUMN app_user.role IS '관리 권한: ADMIN 또는 CLIENT (S.ADMIN은 시스템 관리 계정에만 허용)';
COMMENT ON COLUMN app_user.integrity_ver IS '행 무결성 서명 형식 버전: 1=레거시, 2=role 포함';

-- S.ADMIN은 설치 시 생성되는 admin/admin 계정 하나에만 고정한다.
-- admin_user 무결성 해시는 애플리케이션이 다음 조회 시 현재 값으로 재서명한다.
UPDATE admin_user
SET role = 'ADMIN', integrity_hash = NULL
WHERE role = 'S.ADMIN' AND login_id <> 'admin';

UPDATE admin_user
SET role = 'S.ADMIN', integrity_hash = NULL
WHERE login_id = 'admin' AND role <> 'S.ADMIN';

ALTER TABLE admin_user
    ADD CONSTRAINT ck_admin_user_super_admin_identity
    CHECK (role <> 'S.ADMIN' OR login_id = 'admin');
