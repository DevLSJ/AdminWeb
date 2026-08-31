# D'Guard KMS 3주차 구현 컨텍스트

기준일: 2026-08-31

주제: 사용자 관리 & 감사 로그

참고 문서: `DGuard_Web_v1.4.0_표현_정리본.docx`, `DGuard_Web_v1.2.0_week2_rewritten.docx`

## 1. 구현 목표와 완료 범위

3주차 구현은 기존 React 목업을 실제 Spring Boot API와 DB에 연결하고 다음 보안 동작을 검증 가능한 상태로 만드는 데 초점을 둔다.

- 사용자 이름·연락처·이메일을 마스터키 기반 AES-256-GCM 암호문으로 저장
- 일반 사용자 조회 응답에는 마스킹 값만 포함하고 원문 필드는 구조적으로 제외
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

일반 목록·상세 DTO인 `UserResponse`에는 `nameMasked`, `phoneMasked`, `emailMasked`만 존재한다. 따라서 서비스 구현 실수와 무관하게 평문 이름·연락처·이메일을 일반 JSON 응답에 직렬화할 수 없다.

이름과 연락처 검색은 복호화나 SQL `LIKE`를 사용하지 않는다. 입력을 정규화한 뒤 필드별 도메인 HMAC을 계산하여 정확히 일치하는 행을 찾는다. 전화번호와 이메일 검색 HMAC에는 UNIQUE 제약을 적용해 중복 등록 경쟁 조건을 DB에서도 차단한다.

### 2.3 원문 조회 정책

원문 조회는 조회 의미를 명확히 하고 캐시를 통제하기 위해 `POST /api/users/{userUid}/plain`으로 제공한다.

1. JWT와 `ADMIN` 또는 `S.ADMIN` 권한을 확인한다.
2. 2~200자의 조회 사유를 Bean Validation으로 강제한다.
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

감사 상세에는 개인정보 원문, 비밀번호, 키 원문, JWT를 넣지 않는다. `V9__week_three_users_and_audit.sql`은 PostgreSQL `BEFORE UPDATE OR DELETE` 트리거를 설치해 `audit_log`를 DB 수준에서도 append-only로 유지한다.

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
| POST | `/api/users/{userUid}/password` | 비밀번호 재설정 | 새 Salt·PBKDF2 해시, 행 HMAC 재계산 |
| POST | `/api/users/{userUid}/plain` | 개인정보 원문 조회 | 조회 사유 필수, 무결성 검증, no-store, 감사 기록 |
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

- DB: `backend/src/main/resources/db/migration/V9__week_three_users_and_audit.sql`
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

1. 사용자 생성 응답에 평문 필드가 없고 마스킹 값만 존재한다.
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

- 백엔드: `./gradlew test bootJar --no-daemon` 성공, 8개 테스트 클래스 21개 테스트, 실패/오류/skip 0건
- 3주차 전용: `WeekThreeUserAuditIntegrationTests` 2개 시나리오와 `SensitiveDtoRedactionTests` 통과
- 프론트: TypeScript `tsc -b`, Vite production build, oxlint 모두 성공
- 실제 로컬 서버: Spring Boot `:18080`, Vite `:15173` 동시 기동 및 CORS 허용 출처 확인
- 실제 연동 흐름: admin 로그인 → 사용자 등록 → 이름/연락처 HMAC 검색 → 마스킹 응답 → 사유 기반 원문 조회 → `USER_VIEW_PLAIN` 검색 → 전체 체인 검증 성공
- 연동 관측값: 일반 응답 평문 필드 없음, 행 무결성 `true`, 원문 값 일치, `Cache-Control: no-store`, 체인 `valid=true`, `headValid=true`

브라우저 제어 인스턴스가 이 세션에 연결되어 있지 않아 자동 클릭·스크린샷 검증은 실행할 수 없었다. 대신 같은 Vite 서버에서 `/`, 사용자 화면 모듈, 감사 화면 모듈이 모두 HTTP 200으로 제공되는지 확인하고, 해당 화면 함수가 호출하는 동일 API 계약을 실제 서버에서 끝까지 수행했다. 화면 번들 자체는 production build로 별도 검증했다.

## 8. 운영 및 후속 고려사항

- `app_user`는 서비스 사용자 개인정보 도메인이고 `admin_user`는 KMS 관리자 로그인 도메인이다. 이번 주차에서는 두 테이블을 자동 연결하거나 앱 사용자 로그인 API를 만들지 않는다.
- HMAC 검색은 개인정보를 복호화하지 않는 대신 부분 검색이 아니라 정확 일치 검색이다.
- 마스킹 값은 화면 조회 성능을 위해 저장되므로 일부 정보 노출 범위를 데이터 분류 정책과 정기적으로 검토해야 한다.
- 마스터 패스프레이즈 교체 시 기존 개인정보 재암호화/이중 읽기 절차는 별도 운영 마이그레이션이 필요하다.
- PostgreSQL 감사 append-only 트리거는 운영자 직접 UPDATE/DELETE를 막는다. 체인 검증 장애 조사나 복구는 승인된 유지보수 절차로 트리거와 HMAC 키를 함께 관리해야 한다.
