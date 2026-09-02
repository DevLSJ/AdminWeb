# D'Guard KMS 3주차 구현 컨텍스트

기준일: 2026-08-31

주제: 사용자 관리 & 감사 로그

참고 문서: `DGuard_Web_v1.4.0_표현_정리본.docx`, `DGuard_Web_v1.2.0_week2_rewritten.docx`

## 1. 구현 목표와 완료 범위

3주차 구현은 실제 Spring Boot API와 DB에 연결하고 다음 보안 동작을 검증 가능한 상태로 만드는 데 초점을 둔다.

- 사용자 이름·연락처·이메일을 마스터키 기반 AES-256-GCM 암호문으로 저장
- 일반 사용자 조회 응답은 이름·연락처·이메일을 모두 마스킹
- 개인정보 원문 조회 전에 행 무결성을 검증하고 조회 사유를 필수로 기록
- 원문 조회 시 `USER_VIEW_PLAIN` 감사 이벤트를 append-only 해시 체인에 추가
- 감사 로그의 행 HMAC, `prev_hash` 연결, 최종 체인 헤드를 일괄 검증
- 변조된 사용자 행을 경고 표시하고 원문 조회·수정·상태 변경을 차단
- 감사 로그 검색·서버 페이징·서명 포함 CSV 내보내기를 실제 API로 제공

안내서에서 사용자 백엔드는 빈 파일, 사용자 화면은 `mockUsers`, 감사 화면은 일부 선행 API와 브라우저 CSV에 의존하는 상태였다. 이번 구현에서 해당 목업 경로를 실제 영속화·암호화·감사 API로 교체했다.

## 2. 보안 설계

### 2.1 키 계층과 암호 파라미터

| 대상 | 방식 | 파라미터 | 저장 원칙 |
|---|---|---|---|
| KMS 마스터키 | PBKDF2-HMAC-SHA256 | 기본/최소 10,000회, 256비트 | 패스프레이즈 원문 미저장, DB Salt와 KCV만 저장 |
| 사용자 개인정보 | AES-256-GCM | 매 필드 12바이트 난수 IV, 128비트 인증 태그 | 이름·연락처·이메일별 암호문과 IV만 저장 |
| 사용자 비밀번호 | PBKDF2-HMAC-SHA256 | 사용자별 16바이트 Salt, 기본 210,000회, 256비트 | 해시·Salt·알고리즘·반복 횟수만 저장 |
| 검색 값 | HMAC-SHA256 | 필드별 도메인 구분자 사용 | 정규화된 값의 HMAC으로 정확 일치 검색 |
| 사용자 행 무결성 | HMAC-SHA256 | `APP_USER_ROW_V1` 도메인 | 암호문·IV·마스크·검색 HMAC·상태·비밀번호 해시를 서명 |
| 감사 로그 체인 | HMAC-SHA256 | 이전 행 해시를 다음 행 입력에 포함 | `prev_hash`, `row_hash`, 별도 체인 헤드 저장 |

마스터키 작업은 `MasterKeyService.withMasterKey`가 작업별 키 복사본을 전달한 후 메모리를 덮어쓰는 방식으로 제한한다. 개인정보 암복호화는 기존 `CryptoUtil`의 AES-GCM 구현을 재사용한다. 암호화 입력과 복호화 결과의 바이트 배열은 사용 직후 `Arrays.fill`로 지운다.

로그인 비밀번호, JWT, 사용자 개인정보 요청·원문 응답, 키 암복호화 입력·출력 DTO는 `toString()`을 재정의해 DEBUG 로그에서도 민감값 대신 `REDACTED`만 남긴다. 이 동작은 `SensitiveDtoRedactionTests`로 회귀 검증한다.

### 2.2 개인정보 저장과 조회 경계

`app_user`에는 다음 범주의 데이터가 저장된다.

- 암호화 필드: `name_ciphertext/name_iv`, `phone_ciphertext/phone_iv`, `email_ciphertext/email_iv`
- 마스킹 필드: `name_masked`, `phone_masked`, `email_masked`
- 검색 필드: `name_search_hash`, `phone_search_hash`, `email_search_hash`
- 인증 준비 필드: `password_hash`, `password_salt`, `password_algo`, `password_iter`
- 통제 필드: `status`, `integrity_hash`, `enc_ver`, 등록·수정 시각, 낙관적 잠금 버전

일반 목록·상세 DTO인 `UserResponse`는 `nameMasked`, `phoneMasked`, `emailMasked`만 제공하며 암호문을 복호화하지 않는다. 이름·연락처·이메일 원문은 사유 기반 원문 조회 API에서만 반환한다.

이름과 연락처 검색은 복호화나 SQL `LIKE`를 사용하지 않는다. 입력을 정규화한 뒤 필드별 도메인 HMAC을 계산하여 정확히 일치하는 행을 찾는다. 전화번호와 이메일 검색 HMAC에는 UNIQUE 제약을 적용해 중복 등록 경쟁 조건을 DB에서도 차단한다.

### 2.3 원문 조회 정책

원문 조회는 과제 API 계약에 맞춰 `GET /api/users/{userUid}/plain?reason=...`으로 제공한다. 조회 사유는 URL에 남을 수 있으므로 고객 식별정보나 원문 개인정보를 입력하지 않는다.

1. JWT와 `ADMIN` 또는 `S.ADMIN` 권한을 확인한다.
2. 2~200자의 조회 사유를 서비스 경계에서 강제한다.
3. 저장된 사용자 행 HMAC을 상수 시간 비교로 검증한다.
4. 무결성 실패 시 `409 USER_INTEGRITY_VIOLATION`으로 복호화를 차단한다.
5. 이름·연락처·이메일을 마스터키로 복호화한다.
6. 원문 값은 포함하지 않고 행위자·사용자 UID·조회 사유만 `USER_VIEW_PLAIN` 감사 이벤트로 기록한다.
7. 응답에 `Cache-Control: no-store`와 `Pragma: no-cache`를 설정한다.

수정 화면이 기존 값을 채우기 위해 원문을 읽는 경우도 `사용자 개인정보 수정` 사유로 동일한 감사 이벤트를 남긴다.

## 3. 감사 로그 해시 체인

### 3.1 추가 동작

감사 이벤트 추가 시 `audit_chain_head`의 단일 행을 비관적 쓰기 잠금으로 조회한다. 이후 다음 순서로 동일 트랜잭션 안에서 처리한다.

1. 현재 체인 헤드를 `previousHash`로 읽는다.
2. 로그 UUID와 PostgreSQL 저장 정밀도에 맞춘 생성 시각을 만든다.
3. UUID, 행위자, 행위, 대상, 상세, 이전 해시, 시각을 길이 구분 HMAC 입력으로 정규화한다.
4. 계산한 `rowHash`로 `audit_log`를 INSERT한다.
5. `audit_chain_head.current_hash`를 새 `rowHash`로 전진시킨다.

감사 상세에는 개인정보 원문, 비밀번호, 키 원문, JWT를 넣지 않는다. `V10__week_three_users_and_audit.sql`은 PostgreSQL `BEFORE UPDATE OR DELETE` 트리거를 설치해 `audit_log`를 DB 수준에서도 append-only로 유지한다.

### 3.2 검증 동작

`GET /api/audit-logs/verify`는 ID 오름차순으로 전체 로그를 읽고 다음 세 항목을 확인한다.

- 각 행의 `row_hash`가 현재 필드 값으로 다시 계산한 HMAC과 일치하는가
- 각 행의 `prev_hash`가 바로 이전 행의 저장 `row_hash`와 일치하는가
- 마지막 행의 `row_hash`가 `audit_chain_head.current_hash`와 일치하는가

응답은 전체 유효 여부, 검사 건수, 실패 로그 UUID, 체인 헤드 일치 여부, 검증 시각을 제공한다. 마지막 로그 삭제처럼 개별 행이 남지 않는 변조도 체인 헤드 불일치로 검출한다.

CSV 내보내기는 서버 검색 조건을 그대로 사용하며 최대 10,000건으로 제한한다. CSV 수식 주입 문자를 중화하고 `previousHash`, `rowHash`, 행 검증 결과를 포함한다. 내보내기 자체도 `AUDIT_EXPORT` 이벤트로 기록한다.

## 4. API 명세

모든 경로는 JWT가 필요하며 사용자·감사 API는 `ADMIN` 또는 `S.ADMIN`만 접근할 수 있다.

| Method | Path | 기능 | 주요 보안 동작 |
|---|---|---|---|
| GET | `/api/users` | 마스킹 목록·페이징·정확 검색 | 원문 미반환, 행별 무결성 결과 포함 |
| GET | `/api/users/{userUid}` | 마스킹 상세 | 원문 미반환 |
| POST | `/api/users` | 사용자 등록 | 개인정보 암호화, 검색/행 HMAC, 비밀번호 PBKDF2 |
| PUT | `/api/users/{userUid}` | 개인정보 수정 | 기존 무결성 검증 후 새 IV로 전체 재암호화 |
| PATCH | `/api/users/{userUid}/status` | ACTIVE/INACTIVE 전환 | 무결성 검증, 행 HMAC 재계산, 감사 기록 |
| PATCH | `/api/users/{userUid}/password` | 비밀번호 재설정 | 새 Salt·PBKDF2 해시, 행 HMAC 재계산 |
| GET | `/api/users/{userUid}/plain?reason=...` | 개인정보 원문 조회 | 조회 사유 필수, 무결성 검증, no-store, 감사 기록 |
| GET | `/api/audit-logs` | 기간·행위자·행위 검색 | 서버 페이징, 행 HMAC 결과 포함 |
| GET | `/api/audit-logs/verify` | 전체 체인 검증 | 행·연결·헤드 검증 |
| GET | `/api/audit-logs/export` | 감사 CSV | 최대 10,000건, CSV 주입 방지, 내보내기 감사 기록 |

주요 오류 코드는 `USER_NOT_FOUND`(404), `USER_DUPLICATE`(409), `USER_INTEGRITY_VIOLATION`(409), `VALIDATION_FAILED`(400), `FORBIDDEN`(403)이다.

## 5. 웹 연동

### 사용자 관리 `/users`

- 서버 페이징과 이름·연락처 HMAC 정확 검색
- 사용자 등록 직후 실제 DB 결과로 목록 재조회
- 마스킹 상세와 사유 입력 원문 조회를 별도 모달로 분리
- 원문 조회 응답을 별도 민감정보 경고 모달에만 표시
- 수정 진입 시 감사 원문 조회 후 기존 값을 채우고 저장 시 재암호화
- ACTIVE/INACTIVE 상태 변경과 비밀번호 재설정 API 연결
- 무결성 실패 행을 붉은 배경·경고 아이콘·INVALID 배지로 강조
- 무결성 실패 시 수정·원문·상태·비밀번호 버튼을 모두 비활성화
- 고밀도 sticky header 테이블과 내부 세로 스크롤 유지

### 감사 로그 `/audit-logs`

- 기간·행위자·행위 조건을 서버 검색 API에 전달
- 서버 페이지 결과와 전체 건수로 페이지네이션
- `USER_VIEW_PLAIN` 행위를 경고 색상으로 강조
- 체인 검증 결과에서 실패 UUID가 포함된 행을 즉시 강조
- 검증 성공 시 검사 건수·검증 시각 표시
- 브라우저 메모리 조립이 아닌 서버 생성 서명 CSV 다운로드

## 6. 주요 구현 파일

- DB: `backend/src/main/resources/db/migration/V10__week_three_users_and_audit.sql`
- 사용자 엔티티: `backend/src/main/java/com/ineb/dguard_kms/domain/user/entity/AppUser.java`
- 사용자 서비스: `backend/src/main/java/com/ineb/dguard_kms/domain/user/service/AppUserService.java`
- 사용자 API: `backend/src/main/java/com/ineb/dguard_kms/domain/user/controller/AppUserController.java`
- 감사 서비스: `backend/src/main/java/com/ineb/dguard_kms/domain/audit/service/AuditLogService.java`
- 감사 API: `backend/src/main/java/com/ineb/dguard_kms/domain/audit/controller/AuditLogController.java`
- 통합 테스트: `backend/src/test/java/com/ineb/dguard_kms/WeekThreeUserAuditIntegrationTests.java`
- 프론트 API: `frontend/src/api/kms.ts`
- 사용자 화면: `frontend/src/pages/users/UserList.tsx`
- 감사 화면: `frontend/src/pages/audit/AuditLog.tsx`

## 7. 검증 시나리오

자동 통합 테스트는 다음을 실제 HTTP 요청과 DB 조회로 확인한다.

1. 사용자 생성·목록·상세 응답은 이름·연락처·이메일 원문을 제외하고 마스킹 값만 제공한다.
2. DB의 이름·연락처·이메일 값이 평문이 아닌 AES-GCM 암호문이고 IV가 12바이트다.
3. 비밀번호가 평문이 아니며 개별 Salt와 PBKDF2 반복 횟수가 저장된다.
4. CLIENT의 원문 조회는 403이고 빈 조회 사유는 400이다.
5. ADMIN 원문 조회 응답은 `no-store`이며 조회 원문이 정확하다.
6. `USER_VIEW_PLAIN` 로그에는 행위자·대상·사유만 있고 개인정보 원문은 없다.
7. 개인정보 수정, 상태 변경, 비밀번호 재설정 후 행 무결성이 유지된다.
8. 사용자 마스킹 값을 DB에서 임의 변조하면 원문 조회가 409로 차단되고 목록에 INVALID가 표시된다.
9. 감사 로그 상세를 임의 변조하면 체인 검증이 실패 UUID를 반환한다.
10. 변조를 복구하면 체인 검증이 다시 정상으로 돌아온다.
11. CSV에 원문이 아닌 감사 필드·체인 해시가 포함되고 내보내기 후 체인이 계속 유효하다.

최종 검증 결과는 다음과 같다.

- 백엔드: `./gradlew clean test bootJar --no-daemon` 성공, 9개 테스트 클래스 23개 테스트, 실패/오류/skip 0건
- 3주차 전용: `WeekThreeUserAuditIntegrationTests` 2개 시나리오와 `SensitiveDtoRedactionTests` 통과
- 프론트: TypeScript `tsc -b`, Vite production build, oxlint 모두 성공
- 실제 로컬 서버: Spring Boot `:18080`, Vite `:15173` 동시 기동 및 CORS 허용 출처 확인
- 실제 연동 흐름: admin 로그인 → 사용자 등록 → 이름/연락처 HMAC 검색 → 마스킹 응답 → 사유 기반 원문 조회 → `USER_VIEW_PLAIN` 검색 → 전체 체인 검증 성공
- 연동 관측값: 일반 응답의 이름·연락처·이메일 원문 없음, 행 무결성 `true`, 사유 기반 원문 값 일치, `Cache-Control: no-store`, 체인 `valid=true`, `headValid=true`

브라우저 제어 인스턴스가 이 세션에 연결되어 있지 않아 자동 클릭·스크린샷 검증은 실행할 수 없었다. 대신 같은 Vite 서버에서 `/`, 사용자 화면 모듈, 감사 화면 모듈이 모두 HTTP 200으로 제공되는지 확인하고, 해당 화면 함수가 호출하는 동일 API 계약을 실제 서버에서 끝까지 수행했다. 화면 번들 자체는 production build로 별도 검증했다.

## 8. 운영 및 후속 고려사항

- `app_user`는 서비스 사용자 개인정보 도메인이고 `admin_user`는 KMS 관리자 로그인 도메인이다. 이번 주차에서는 두 테이블을 자동 연결하거나 앱 사용자 로그인 API를 만들지 않는다.
- HMAC 검색은 개인정보를 복호화하지 않는 대신 부분 검색이 아니라 정확 일치 검색이다.
- 마스킹 값은 화면 조회 성능을 위해 저장되므로 일부 정보 노출 범위를 데이터 분류 정책과 정기적으로 검토해야 한다.
- 마스터 패스프레이즈 교체 시 기존 개인정보 재암호화/이중 읽기 절차는 별도 운영 마이그레이션이 필요하다.
- PostgreSQL 감사 append-only 트리거는 운영자 직접 UPDATE/DELETE를 막는다. 체인 검증 장애 조사나 복구는 승인된 유지보수 절차로 트리거와 HMAC 키를 함께 관리해야 한다.

## 9. 3주차 연동 보강 (2026-09-01)

- 사용자 관리 화면에 `GET /api/admin-accounts`를 추가해 `admin_user`의 기존 로그인 계정(`admin`, `client`, `dguard` 등)을 비밀번호·Salt·해시 필드 없이 그대로 표시한다. 개인정보 서비스 사용자는 기존 `app_user` 마스킹 목록으로 분리한다.
- `GET /api/audit-logs/{logUid}/verify`를 추가했다. 선택한 감사 행의 HMAC, 이전 행 연결, 다음 행 연결, 마지막 행의 체인 헤드를 독립적으로 검증하며 감사로그 표의 각 행에서 실행할 수 있다.
- 대시보드의 정적 키 상태·사용 추이·만료 예정 키·최근 활동을 제거했다. 현재는 `crypto_key`, `key_usage_log`, `audit_log` API 응답만 사용하고, 전체 키 페이지를 순회하여 100건 초과 데이터도 누락하지 않는다.
- 최근 활동 전용 화면의 목업 데이터 소스를 제거하고 로그인 행위자 기준 감사로그 API로 교체했다.
- 키 카테고리는 대칭 암호화(AES), 비대칭 암호화(RSA-OAEP), 메시지 인증(HMAC-SHA256)으로 구분한다. 상태는 KMIP 2.1의 Pre-Active, Active, Deactivated, Compromised, Destroyed를 표준 축으로 표시하고 재활성·만료·운영 중지·배포 상태는 D’Guard 정책 확장으로 명시한다.
- 대시보드의 이번 달 암호화·복호화 정적 카드를 삭제하고, 만료 임박 키에는 위험 배지·경고 이모지·7일 이내 붉은 강조를 적용했다.
- 상단 앱바 중복 페이지명, 페이지 제목 하단 설명, 사용자·감사·암복호화 화면의 고정 안내 배너를 제거했다.
- 암호문 입력은 외부 고정 라벨 방식으로 변경해 포커스 시 축소 라벨이 아웃라인과 겹치지 않는다.

보강 검증 결과: 백엔드 전체 Gradle 테스트, 프론트 TypeScript/Vite 프로덕션 빌드, oxlint가 통과했다. 로컬 인증 HTTP 연동에서 관리 계정 목록, 대시보드 요약·추이, 감사로그 목록, 전체 체인 검증, 개별 행 체인 검증이 모두 성공했으며 개별 검증 결과는 `rowHashValid`, `previousLinkValid`, `nextLinkValid`, `chainHeadValid`가 모두 `true`였다.

## 10. 키 생명주기·알고리즘 정책 정리 (2026-09-01)

- 웹 목록과 상세 화면의 상태를 `생성됨(CREATED)`, `활성화(ACTIVE)`, `비활성(DEACTIVATED)`, `침해(COMPROMISED)`, `폐기(DESTROYED)` 5개로 정규화했다. 기존 `REACTIVATED`·`DISTRIBUTED`는 활성화, `EXPIRED`·`INACTIVE`는 비활성으로 표시해 기존 DB도 누락 없이 조회한다.
- 키 상세의 생명주기 작업 영역은 현재 상태만 표시한다. 생명주기 타임라인은 내부 스크롤을 유지하면서 작업 코드(`STATUS_CHANGE` 등)를 숨기고 버전 `v1`, `v2`만 표시한다.
- 활성 키만 암호화·복호화할 수 있다. 비활성 키는 두 작업을 모두 차단하되 자동·수동 회전은 계속 허용하고 새 버전 이력을 누적한다. 침해 키는 폐기만 가능하다.
- 배포는 키 생명주기 상태를 변경하지 않는다. 현재 키 상태를 유지하면서 키 재료의 배포 시각, 상태 이력 `DISTRIBUTE`, 감사로그 `KEY_DEPLOY`를 별도로 기록한다.
- 즉시 폐기는 모든 버전의 래핑 키와 IV를 제로화한 뒤 DB 값을 `NULL`로 만들고 공개키도 제거한다. 키 메타데이터, 상태 이력, 사용 로그, 감사로그는 무결성 검증을 위해 보존한다.
- 신규 웹 등록 정책은 `대칭키 · AES-256-GCM`과 `공개키 · RSA-2048-SHA256`만 제공한다. RSA 구현 내부 패딩 식별자는 API 호환을 위해 유지하지만 웹 문구에서는 노출하지 않는다. 생성 완료 후 자동으로 활성화한다.
- 키 카테고리 필터는 대칭키와 공개키로 단순화하고, 대시보드 상태 분포도 동일한 5개 상태로 합산한다. 기존 레거시 키와 HMAC 데이터는 전체 조회에서 보존한다.

## 11. 관리자 웹 UI 통합 개선 (2026-09-01)

- 전체 내비게이션을 청색 계열로 통일하고 선택 메뉴가 흰색으로 본문 방향에 파고드는 형태, 카드 상승 효과와 테이블 행 호버 애니메이션을 적용했다.
- 대시보드 키 상태 차트를 5개 상태별 상호작용 SVG 도넛으로 변경했다. 조각이나 범례에 마우스를 올리면 상태명, 키 수, 비율이 중앙에 표시된다.
- `admin_user` 로그인 계정과 `app_user` 서비스 사용자를 사용자 관리의 단일 표에서 함께 표시한다. 별도 로그인 관리 계정 영역과 개인정보 암호화 사용자 제목은 제거했다.
- 암복호화 테스트의 `IV Base64`를 `IV`, `키 버전`을 `Key Version`으로 변경하고 우측 선택 키 정보 카드를 제거했다.
- 최근 활동 표에서 IP 주소 열을 제거하고, 키 목록의 외부 UUID 안내 배지와 상세 버튼을 제거했다. 키 목록 행은 한 번 클릭하거나 Enter 키를 누르면 상세 화면으로 이동한다.
- 감사로그의 개별 검증·보기 버튼을 제거했다. 감사 행을 클릭하면 배경 블러 모달에서 이벤트 상세와 행 HMAC, 이전·다음 연결, 체인 헤드 검증 결과를 함께 조회한다. 감사로그는 append-only이므로 수정 기능은 제공하지 않는다.
- 키 상세는 네이버 KMS형 각진 정보 패널로 재구성했다. 상태 변경은 우측 상단 단일 주요 액션으로 두고, 기본정보·회전 설정·버전 이력을 왼쪽에, 내부 스크롤과 호버 애니메이션을 적용한 생명주기 타임라인을 오른쪽에 배치했다.

## 12. 관리자 웹 UI 밀도·상세 이동 보강 (2026-09-01)

- 최근 활동 화면의 필터 간격, 테이블 셀 높이, 글자 크기와 스크롤 높이를 키 목록과 동일한 고밀도 규격으로 통일했다.
- 좌측 메뉴는 상위 그룹과 하위 메뉴가 동시에 명확히 강조되며, 선택 시 투명해지지 않도록 단색 선택 배경과 부드러운 이동 애니메이션을 적용했다.
- 생명주기 타임라인을 공통 컴포넌트로 분리해 키 상세와 암복호화 테스트 우측에서 동일한 실제 이력을 표시한다. 연결선은 각 이력 박스 안에서 잘려 외부로 돌출되지 않는다.
- 키 상세의 기본정보·회전 설정·버전 이력은 동일한 헤더 높이와 좌우 여백을 사용한다. 기본정보 헤더의 중복 상태 배지를 제거하고 상태 행의 배지를 짧은 크기로 조정했다.
- 공지 목록의 상세·수정 버튼과 모달을 제거했다. 공지 행을 클릭하면 `/notices/{noticeUid}` 상세 페이지로 이동하고, 해당 페이지에서 조회·수정·첨부파일 관리를 수행한다.
- 공지 목록 열은 제목, 첨부, 노출, 작성자, 등록일, 조회수 순으로 배치하고 등록일은 보조 크기, 조회수는 최우측 정렬로 표시한다.

## 13. 공지·관리 계정·실시간 체인 검증 보강 (2026-09-01)

- 0바이트로 남아 있던 공지 백엔드 계층을 실제 Spring Data JPA CRUD로 구현했다. 공지 등록·수정은 `multipart/form-data`의 JSON `metadata`와 최대 10개 첨부파일을 함께 받고, 목록·상세·삭제·파일 다운로드까지 PostgreSQL 데이터를 사용한다.
- 첨부파일 본문은 파일당 최대 10MB로 제한하고 마스터키 AES-256-GCM으로 암호화하여 `notice_file.content_enc`에 저장한다. DB에는 암호문과 12바이트 IV만 남고, 다운로드 시에만 복호화하며 응답은 `Cache-Control: no-store`로 제공한다.
- 공지 상세 `GET /api/notices/{noticeUid}`는 행 잠금 트랜잭션에서 `view_count`를 원자적으로 1 증가시키고 `NOTICE_VIEW` 감사 이벤트를 남긴다. 따라서 목록 버튼이나 프론트 상태가 아닌 실제 상세 API 접속 횟수가 DB 조회수 기준이다.
- 사용자 관리 단일 목록은 기존 `admin_user`의 `admin`, `client`, `dguard` 계정과 `app_user`를 함께 표시한다. 관리 계정은 무결성 HMAC을 검증하여 정상/비정상으로 표시하고, 서비스 사용자는 이름·연락처·이메일을 모두 마스킹한다.
- 사용자 행 클릭 시 `/users/admin/{uid}` 또는 `/users/app/{uid}` 상세 페이지로 이동한다. ADMIN은 CLIENT 계정만, S.ADMIN은 모든 하위 계정을 수정·정지·활성화·PBKDF2 비밀번호 재설정할 수 있으며 동일 정책을 프론트 버튼과 백엔드 권한 검사 양쪽에서 강제한다.
- 감사 이벤트 상세 모달이 열려 있는 동안 3초마다 선택 행의 HMAC, 이전 행 연결, 다음 행 연결, 마지막 행의 체인 헤드를 서버에서 다시 검증한다. 결과는 `rowHashValid`, `previousLinkValid`, `nextLinkValid`, `chainHeadValid`로 각각 표시한다.
- 키 상세에서 상태 보조 설명, 회전 보조 설명, 버전 이력 패널을 제거하고 실제 사용 집계 카드를 위로 올렸다. 생명주기 타임라인은 하나의 연속 세로선과 호버 애니메이션을 사용하며 키 상세와 암복호화 화면에서 동일 컴포넌트를 공유한다.
- 신규 키 등록 모달은 정책 입력과 대형 만료일 달력을 같은 높이의 2열로 맞추고, 입력 컨트롤 높이와 좌측 영역 폭을 확장했다.

자동 검증은 `NoticeDatabaseIntegrationTests`에서 multipart 공지 등록, 암호문·IV DB 저장, 상세 조회수 0→1→2 증가, 첨부파일 복호화 일치, 감사 체인 정상, ADMIN/CLIENT 및 S.ADMIN/ADMIN 권한 분기와 관리 계정 재서명을 실제 HTTP·JPA 흐름으로 확인한다. 프론트는 oxlint, TypeScript 프로젝트 검사, Vite production build를 통과했다.

운영 PostgreSQL의 기존 `notice.expose_yn CHAR(1)`과 Hibernate 7의 String `VARCHAR(1)` 검증 차이는 `V12__normalize_notice_exposure_type.sql`에서 데이터 의미와 Y/N 체크 제약을 유지한 채 `VARCHAR(1)`로 정규화했다. 이 마이그레이션은 기존 V11 체크섬을 변경하지 않으며 운영 `ddl-auto=validate` 기동을 보장한다.

## 14. 인증·공지 등록 및 슬라이드 상세 UI 보강 (2026-09-01)

- 로그인 화면을 좌측 내비게이션과 같은 청색 그라데이션, 청색 포커스 조명과 그림자 체계로 통일했다.
- Axios의 전역 JSON `Content-Type`이 공지 `FormData`까지 덮어써 multipart boundary가 누락되던 문제를 수정했다. FormData 요청은 브라우저가 boundary를 생성하며 JWT만 그대로 전달한다.
- 프론트 Nginx의 요청 본문 제한을 100MB로 맞췄다. 화면과 백엔드는 파일당 10MB, 최대 10개를 함께 검증해 초과 요청을 명확한 오류로 차단한다.
- 저장 세션을 프론트 임시 계정 목록으로 재해석하던 로직을 제거했다. 기존 DB 계정의 UID·이름·역할을 보존하고 `/api/auth/me`에서 최신 상태를 다시 검증한다.
- 키 상태, 키·사용자 무결성은 배지 대신 색상 점과 짧은 상태 텍스트로 표시한다. 사용자 목록의 현재 로그인 표시는 제거하고 최근 접속일만 유지한다.
- 키·공지·암복호화 화면의 상단 경로는 `목록 | 대상` 형태의 2px 구분선을 공유한다.
- 사용자 목록 행은 식별이 쉬운 아바타형 아이콘을 사용하고, 행을 클릭하면 목록 위로 우측 슬라이드 상세 패널이 열린다. 배경은 블러 처리되며 관리 권한에 따른 수정·정지·활성화·비밀번호 재설정은 기존 서버 API를 그대로 사용한다.
- 감사 이벤트도 동일한 우측 슬라이드 패널로 전환했다. 패널이 열린 동안 3초마다 행 HMAC, 이전 연결, 다음 연결과 체인 헤드를 서버에서 실시간 재검증한다.
- 좌측 메뉴는 선택 상태가 투명해지지 않는 청색/흰색 강조, 하위 메뉴 세로 가이드, 짧은 이동 애니메이션을 사용한다.

검증: 프론트 oxlint, TypeScript 프로젝트 검사, Vite production build가 성공했다. 백엔드 `NoticeDatabaseIntegrationTests`에서 multipart 등록, AES-256-GCM 첨부 암호화 DB 저장, 복호화 다운로드, 상세 접속별 조회수 증가와 감사 체인 검증이 통과했다.

운영 검증: GitHub Actions `Build & Deploy` 실행 33473801243에서 백엔드·프론트 이미지 빌드와 `Deploy to Server`가 모두 성공했다. 배포 후 운영 도메인에서 `admin` DB 계정으로 로그인하고 개인정보가 없는 임시 텍스트 첨부 공지를 multipart로 등록했다. 생성 UUID를 사용한 상세 조회에서 조회수 1, 첨부파일 1개를 확인했으며 검증 공지는 HTTP 200으로 즉시 삭제했다. 로그인 화면으로 이탈하지 않은 채 동일 JWT로 생성·조회·삭제가 완료되어 인증 유지와 운영 DB 왕복을 확인했다.

## 15. 활동 의미·상세 패널 정렬 보강 (2026-09-01)

- 대시보드 최근 활동은 `NOTICE_VIEW` 같은 감사 코드 대신 `공지 조회`, `키 상태 변경`, `암복호화 테스트` 등 한글 행위명을 표시한다. 상세 내용은 한 줄 요약과 말줄임표로 정리하고 원문은 툴팁으로 확인한다.
- 최근 활동 목록의 `대상 키`를 `대상`으로 변경했다. 키 감사 이벤트는 실제 `crypto_key.key_name`으로 해석하고, 그 외 이벤트는 공지사항·관리 계정·서비스 사용자·인증 세션 등의 의미 있는 대상 유형과 대상 식별자를 함께 표시한다. 키 이름 캐시는 60초 동안 재사용해 10초 폴링이 전체 키 API를 반복 호출하지 않도록 했다.
- 공지 목록의 첨부는 아이콘과 파일 수, 노출은 상태 점과 `노출/숨김`, 작성자는 청색 아바타와 계정명으로 단순화했다. `내 글` 배지는 삭제했다.
- 감사 상세의 EVENT와 CHAIN VERIFICATION을 동일한 2열 폭·패딩·헤더 높이·테두리 규격으로 맞췄다.
- 키 상태 변경 모달의 현재 상태를 공통 색상 점 UI로 변경했다. 개인 프로필의 역할별 강조색과 배경·아바타·권한 배지를 청색 계열로 통일했다.
- 사용자 상세는 계정 정보·상태 제어·비밀번호 재설정을 하나의 정렬된 카드로 합쳤다. 우측 패널은 콘텐츠 높이에 맞춰 표시되어 하단의 불필요한 빈 영역을 줄이고, 서비스 사용자 작업은 2열 버튼 그리드로 정렬했다.
- 카드·행·라우트·드로어 애니메이션을 점검하고 섹션 카드에 청색 테두리·그림자 전환을 추가했으며 `prefers-reduced-motion` 정책은 유지했다.
- 서로 다른 Spring 통합 테스트가 동일한 H2 메모리 DB 이름을 공유해 컨텍스트 종료 시 다음 테스트 테이블을 삭제하던 격리 문제를 발견했다. 키 관리, 3주차 사용자·감사, 공지 통합 테스트에 독립 DB 이름을 지정하여 한 Gradle 실행에서도 함께 통과하도록 수정했다.

검증: 프론트 oxlint, TypeScript, Vite production build가 성공했다. `KeyManagementIntegrationTests`, `WeekThreeUserAuditIntegrationTests`, `NoticeDatabaseIntegrationTests`를 하나의 Gradle 실행에서 수행해 AES/RSA 암복호화, 키 버전·상태·무결성, 개인정보 암호화·마스킹, 감사 해시 체인, 공지·첨부 DB 저장을 모두 확인했다.

## 16. KMS 상세 통계·공지 레이아웃 보강 (2026-09-01)

- 전체 UI에 `border-box`를 적용하고 카드의 최대 폭을 부모 영역으로 제한했다. 공지 목록·검색·등록·상세·첨부 카드에는 각진 2px 모서리와 동일한 좌우 기준선을 적용하고, 목록 테이블은 고정 열 폭과 내부 가로 스크롤을 사용해 카드가 본문 우측으로 돌출되지 않는다.
- 대시보드의 `키 상태` 제목을 `전체 키 상태`로 변경했다. 상태 도넛은 SVG 내부에서만 선 두께가 14px에서 18px로 변하고 다른 조각의 불투명도만 조절되므로, 호버 애니메이션이 카드나 인접 그래프 영역을 침범하지 않는다.
- 키 생성·사용 추이 그래프를 암호화(파랑), 복호화(초록), 키 생성(주황)의 명확히 구분되는 색상으로 재구성했다. 실데이터 지점, 축, 범례, 세로 인디케이터와 일자별 툴팁을 제공하고 키보드 포커스·클릭·마우스 호버를 모두 지원한다.
- 대시보드의 `상세 통계` 버튼과 좌측 `키 통계` 메뉴가 `/analytics`로 이동한다. 상세 화면은 대시보드 요약, 전체 키 목록, 일/월 사용 추이 API를 직접 호출해 전체 키, 기간 내 사용량, 작업 성공률, 만료 임박, 무결성 위반, 5단계 키 상태와 AES/RSA/HMAC 분포를 서버 DB 기준으로 표시한다.
- 상세 통계의 선 그리기, 지점 선택, 지표 카드 상승, 분포 막대 진입 모션은 `prefers-reduced-motion` 환경에서 비활성화된다.

검증: 프론트 oxlint, TypeScript 프로젝트 검사, Vite production build와 `git diff --check`가 성공했다. 프론트 변경만 포함하므로 백엔드 이미지·DB 스키마는 변경하지 않으며 기존 대시보드 API 계약을 그대로 재사용한다.

## 17. 3주차 요구사항·시연 기준 재점검 (2026-09-02)

제공된 이미지 4건을 API 계약, 데이터 보호 방식, 패스프레이즈 제약으로 나누어 반영했다.

- API 표: 사용자 목록·상세·원문 조회, 등록·수정, 비밀번호·상태 변경, 감사 검색·체인 검증·CSV 내려받기의 HTTP method와 URI를 그대로 맞춰 검증한다.
- 데이터 보호 표: `app_user` 한 테이블에 비밀번호 PBKDF2+Salt, 이름·연락처·이메일 AES-256-GCM, 정규화 검색 HMAC, 행 무결성 HMAC을 적용한다. `audit_log`는 별도 행 HMAC과 `prev_hash` 해시 체인을 사용한다.
- 패스프레이즈 제약: 랜덤 32바이트 이상을 사용하고 데이터베이스에 저장하지 않는다. Salt는 비밀이 아니므로 DB에 두어도 되지만, 패스프레이즈는 DB 백업에 포함하지 않는다. 패스프레이즈 변경은 전체 개인정보 재암호화가 필요하며 이번 과제 범위에서는 자동 교체를 구현하지 않는다.

시연 합격 기준은 다음과 같다.

1. 목록·상세 응답에는 이름·연락처·이메일 원문이 없고 마스킹 필드와 `integrityValid`만 있어야 한다.
2. 이름·연락처는 정규화 후 HMAC 정확 일치로 검색하고 상태·페이징을 함께 적용한다.
3. ADMIN/S.ADMIN만 2~200자 사유로 원문을 조회하며, 복호화 전 행 무결성을 검증하고 응답은 `no-store`로 보호한다.
4. 원문 조회 직후 `USER_VIEW_PLAIN`에 행위자·대상 UID·사유만 남고 개인정보 원문은 남지 않아야 한다.
5. 비밀번호 재설정 전후 Salt와 해시가 달라지고, 상태·개인정보 수정 후에도 행 무결성은 정상이어야 한다.
6. 감사 목록은 기간·행위자·행위 유형·페이징으로 검색하고, CSV 내려받기와 전체/개별 해시 체인 검증 결과를 표시한다.

원격 PostgreSQL 읽기 전용 점검 결과, `dguard_kms` DB의 `app_user`, `audit_log`, `audit_chain_head`, Flyway 히스토리가 존재하고 `audit_log_append_only` 트리거가 활성화되어 있었다. 시연 쿼리는 운영 행을 수정·삭제하지 않고 스키마, 보호 필드 길이, 체인 연결, 체인 헤드, append-only 차단을 검증하도록 구성한다.
