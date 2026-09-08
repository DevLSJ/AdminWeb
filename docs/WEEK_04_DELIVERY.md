# 구현 4주차 완료 및 검증 기록

2026-09-08 로컬 검증. 과제안내서는 요구사항의 근거로 사용했으며, 문서 속 운영 서버 접속·계정 변경 지시를 실행하지 않았다.
안내서에는 22개 통합 테스트의 개별 항목이 없다. 아래 W4-01~22는 이번 작업에서 요구사항을 기준으로 정의한 수용 테스트이며 공식 채점표가 아니다.

## 구현 범위

기존 게시판 CRUD, `notice`·`notice_file` 테이블과 마스터키 첨부 암호화를 유지하고 누락 및 오류를 보완했다.

- 게시글당 **기존 첨부 포함 최대 10개**, 개별 **10MiB**. 수정 중 제한 위반 시 메타데이터와 첨부 저장 전체 롤백.
- PostgreSQL `notice_file.content_enc BYTEA`를 JPA에도 명시하여 H2 개발·테스트 환경의 255바이트 기본 제한 해소.
- 첨부 경로 제거, 파일명 길이 검증. 암호문 변조·지원하지 않는 `enc_ver`는 409.
- 다운로드는 GCM 인증 완료 후 `application/octet-stream`, `attachment`, `no-store`, `nosniff`로 64KiB씩 전송하고 평문 버퍼를 finally에서 제거.
- 개별 파일 GCM 인증에는 전체 파일 메모리가 필요하다. 완전한 상수 메모리 복호화는 아니며 현재 10MiB 제한을 전제로 한다. HTTP 전송 전에 FILE_DOWNLOAD 감사행을 기록하므로 클라이언트 수신 완료를 증명하는 로그는 아니다.
- 10개 × 10MiB와 multipart 메타데이터·경계 오버헤드를 허용하도록 Spring/Nginx 전체 요청 제한을 101MiB로 정렬.
- 대시보드의 **4개 카드: 전체 관리 키 / 서비스 사용자 / 전체 게시글 / 무결성 위반**. 별도 만료 임박 목록과 최근 사용 추이·게시글·관리자 최근 활동 표시.
- 사용자 수는 `app_user`, 게시글 수는 숨김·일반 글 포함 `notice` 전체. 관리 로그인 계정 `admin_user`는 사용자 수와 사용자 무결성 집계에서 제외한다.
- 무결성 수는 키(모든 버전 포함), 서비스 사용자 HMAC, 감사 체인 위반의 합. 삭제·헤드 이상으로 UUID를 특정할 수 없으면 감사 위반 1건으로 센다. 이는 현재 검증 결과이며 누적 사고 수가 아니다.

## 4주차 API

응답은 `{success,data,message,errorCode}`. 다운로드는 바이너리. UUID 외부 식별자를 사용한다.

| 메서드·경로 | 동작 |
|---|---|
| GET `/api/notices` | title/category/exposeYn/page/size 검색, 공지 우선 정렬 |
| GET `/api/notices/{noticeUid}` | 본문·첨부 메타 조회, 조회수 +1 |
| POST `/api/notices` | multipart metadata JSON + files 다중 등록 |
| PUT `/api/notices/{noticeUid}` | multipart 수정, 기존 첨부 유지 + 새 첨부 추가 |
| DELETE `/api/notices/{noticeUid}` | 공지와 첨부 함께 삭제 |
| GET `/api/files/{fileUid}/download` | 인가·GCM 검증 후 복호화 다운로드 |
| DELETE `/api/files/{fileUid}` | 첨부 개별 삭제 |
| GET `/api/dashboard/summary` | 기존 키·작업 집계 + 사용자·공지·만료·대상별 무결성 수 |
| GET `/api/dashboard/expiring?days=30` | **신규**. 1~365일, KST 오늘~days일 후 포함, ACTIVE만, 만료일·UUID 오름차순 |
| GET `/api/dashboard/usage-trend` | KST 기준 기본 최근 30일, 빈 날짜 0 포함. from/to/interval=DAY 또는 MONTH |

사용 추이는 성공·실패를 모두 포함하는 호출 수다. 기간 쿼리로 대상 행만 읽는다.
기존 `/api/dashboard/trends` 별칭도 유지했다. API 명세는 `apidog/dguard-kms-openapi.json`에 반영했다.
날짜만 있는 만료일은 기존 DB의 UTC 자정 인코딩을 유지하고, 조회 시작 날짜를 KST에서 결정한다.
기존 응답의 ISO UTC 시각 계약은 유지하며 화면에서 KST로 표시한다.

## 테이블 및 배포

필수 10개 테이블이 실제 PostgreSQL에 존재함을 확인했다. 신규 테이블을 중복 생성하지 않고 다음 **추가 마이그레이션 V18**을 적용한다.

- `crypto_key(status, expire_at, key_uid)` 인덱스 추가. 추이·공지 목록 인덱스는 선행 마이그레이션의 것을 재사용.
- `notice_file`에 GCM payload 제약 추가: content_enc 존재, IV 12바이트, 암호문 길이 = 원문 크기 + 태그 16바이트, 최대 10MiB.
- `NOT VALID`로 기존 메타데이터 전용 첨부 행을 보존하면서 이후 INSERT/UPDATE에 제약 적용. 과거 행 전체가 유효하다고 보증하지 않는다.
- 기존 암호문·IV·enc_ver·KCV·유도 반복값은 갱신하지 않는다. 첨부는 외부 파일이 아닌 BYTEA에 보관되므로 공지 삭제·첨부 정리가 같은 DB 트랜잭션이다.

프론트와 백엔드 모두 변경되어 두 서비스 이미지가 필요하다. Dockerfile의 의존성 캐시 순서, Buildx backend/frontend 독립 캐시, 배포 concurrency와 `pull backend frontend`, `up --no-deps`를 유지한다. DB 이미지 pull 및 image prune을 추가하지 않았다. e2e·테스트 출력은 프론트 Docker 컨텍스트에서 제외했다.
V18 인덱스 생성에는 DB 쓰기 잠금이 발생할 수 있다. 데이터가 큰 환경은 배포 창을 잡아야 한다. 기존 배포는 두 서비스 재시작 방식이므로 짧은 중단 가능성이 있다. 이전 앱 이미지로 롤백해도 V18 인덱스·제약은 남으며, 기존 데이터를 삭제하는 down migration은 제공하지 않는다.

## 실행 결과

| 검증 | 결과 |
|---|---|
| H2 수용 테스트 | **22/22 통과**, 실패·스킵 0 |
| PostgreSQL 17 수용 테스트 + Flyway V1~V18 | **22/22 통과**, 실패·스킵 0 |
| 기존 회귀 포함 전체 Gradle 테스트 | **54/54 통과**, 실패·스킵 0 |
| 배포용 bootJar | 성공 |
| 프론트 TypeScript/Vite 빌드·oxlint | 성공 |
| 실제 Chrome + React + Spring + PostgreSQL 기능 테스트 | **8/8 시나리오 통과**, 페이지 예외·API 오류 0 |

PostgreSQL은 임시 전용 DB, 브라우저도 별도 임시 DB·샘플 계정으로 실행했다. 운영 데이터는 테스트하지 않았다.
브라우저 기능 검증 기준 해상도는 1440×1000이다. Nginx를 경유하는 운영 배포 검증은 별도이며 위 결과에 포함하지 않는다.

| ID | 검증 항목 |
|---|---|
| W4-01 | 미인증 게시판·파일·대시보드 차단, 잘못된 로그인 거절 |
| W4-02 | 필수 10개 테이블·게시판 첨부 컬럼 |
| W4-03 | 공지 등록·상세·UUID |
| W4-04 | 제목·노출 검색·페이징 |
| W4-05 | 상세 조회수 증가 |
| W4-06 | 다중 첨부 마스터키 암호화·독립 IV·enc_ver |
| W4-07 | 다운로드 원본 일치·캐시 차단·파일명 |
| W4-08 | 수정 시 기존 첨부 보존·새 첨부 추가 |
| W4-09 | 누적 10개 제한·초과 수정 롤백 |
| W4-10 | 10MiB 허용·초과 업로드 전체 롤백 |
| W4-11 | 제목·노출·구분 입력 검증 |
| W4-12 | CLIENT 공지 작성 거절 |
| W4-13 | 숨김 글 목록·상세·파일 권한 |
| W4-14 | 타인 글·파일 변경 거절, 본인 수정 허용 |
| W4-15 | 첨부 개별 삭제·404 |
| W4-16 | 공지와 첨부 함께 삭제 |
| W4-17 | 첨부 암호문 변조 거절·평문 미전송 |
| W4-18 | 게시판 행위 감사기록·체인·CSV |
| W4-19 | 요약 원천 DB·키 사용 수 일치 |
| W4-20 | 만료 30일 경계·상태·정렬·일수 검증 |
| W4-21 | 30일 0 포함 추이·KST 자정·기간 검증 |
| W4-22 | 키·사용자·감사 헤드 변조 집계 |

브라우저 8개 시나리오: 실제 로그인, 공지+다중 첨부 등록, 조회수+다운로드 바이트 검증, 글 수정+첨부 삭제, 제목 검색, 4개 카드+만료 목록+추이+최근 글, 대시보드 상세 이동+글 삭제, 감사 체인+오류 없음.

재실행:

```bash
cd backend
./gradlew test bootJar
./gradlew test --tests '*WeekFourAcceptanceIntegrationTests' --rerun-tasks

# 전용 빈 PostgreSQL DB를 생성한 뒤 실행. profile 사용자명은 week4.
WEEK4_TEST_DATABASE_URL=jdbc:postgresql://127.0.0.1:55434/week4_test \
SPRING_PROFILES_ACTIVE=week4-postgres \
./gradlew test --tests '*WeekFourAcceptanceIntegrationTests' --rerun-tasks

cd ../frontend
npm run build
npm run lint

# Playwright 설치 환경에서 실행. 반드시 샘플 전용 서버/계정을 사용한다.
# 필요 시 PLAYWRIGHT_MODULE=<playwright 모듈 경로>, CHROME_EXECUTABLE=<Chrome 경로> 지정.
WEEK4_E2E_URL=http://127.0.0.1:5184 \
WEEK4_E2E_API=http://127.0.0.1:18084 \
WEEK4_E2E_LOGIN_ID='<test-account>' WEEK4_E2E_PASSWORD='<test-password>' \
node e2e/week4.cjs
```

브라우저 시나리오는 임시 키를 생성하므로 재실행 후 테스트 DB를 폐기한다. 실제 서비스에 실행하지 않는다.

## 두 가지 키의 역할과 HSM 대비 한계

| 구분 | 마스터키 | KMS 관리 키 |
|---|---|---|
| 생성 | 패스프레이즈 + 서버별 Salt로 PBKDF2-HMAC-SHA256 유도 | AES는 SecureRandom, RSA는 키쌍 생성 |
| 보호 대상 | 어드민 개인정보·첨부파일·관리 키의 저장 값 | 외부 시스템의 업무 데이터; 과제에서는 암복호화 테스트 데이터 |
| 저장 | 기동 중 JVM 메모리, DB에는 Salt·KCV·유도 설정 | 마스터키로 래핑한 암호문·IV를 key_material에 저장 |
| 관리 책임 | 기동 시 KCV 검증, 세대 구분·백업 복구의 기반 | 등록·조회·상태 전이·버전·사용 이력 |

**발표 설명:** “마스터키는 우리 어드민이 보관하는 데이터를 보호합니다. 개인정보와 첨부파일을 직접 암호화하고 KMS 관리 키는 래핑합니다. KMS 관리 키는 외부 업무 데이터를 암호화하기 위한 자산이며 어드민에서는 생명주기와 동작을 검증합니다. 관리 키를 폐기해도 첨부파일은 그 키로 암호화하지 않았으므로 직접 영향을 받지 않습니다. 반대로 마스터키를 잃으면 개인정보·첨부·래핑된 관리 키를 모두 복구할 수 없습니다.”

`INTEGRITY_HMAC_KEY`는 위 두 키와 별도의 비밀이다. 행·감사 체인의 변조 탐지 및 검색 HMAC에 사용하며 암복호화 키가 아니다. 비밀번호 해시는 단방향 PBKDF2+개별 Salt이고 원문 조회 대상이 아니다.

이 구현은 키와 복호화 연산이 JVM 프로세스에 존재한다. 서버 권한 탈취·메모리 덤프·환경변수 유출 시 키 노출을 하드웨어 경계로 막지 못한다. 배열 덮어쓰기는 일부 복사본의 수명을 줄일 뿐 JVM·JCE 내부 복사와 환경변수에서 생성된 String까지 완전히 지운다는 보장은 없다.

HSM을 키 비반출 정책으로 구성하면 장치 내부에서 키를 사용하고 물리적 보호·인증 정책을 적용할 수 있다. 이 과제에는 그러한 하드웨어 분리, 물리적 변조 대응, 스마트카드 기반 접근 통제가 없다. AES-256 사용만으로 FIPS 인증 모듈과 동등해지지 않는다. NIST의 [FIPS 140-3 설명](https://csrc.nist.gov/pubs/fips/140-3/final)은 암호 알고리즘 외에 물리 보안·인증·민감 파라미터 관리·자체 테스트 등 모듈 전체 요구를 다룬다. HSM 사용도 애플리케이션 인가 오류나 탈취된 세션의 암호 연산 악용까지 자동으로 막아 주지는 않는다.

패스프레이즈의 실제 엔트로피가 마스터키 강도를 제한한다. Salt·KCV를 가진 공격자는 오프라인 추측을 시도할 수 있으며 PBKDF2는 시도 비용을 높인다. 패스프레이즈·Salt·반복값 변경은 서로 다른 키를 만들므로 기존 암호문을 그대로 두고 설정값만 바꾸면 안 된다. 마스터키 교체에는 개인정보·첨부 재암호화 및 관리 키 재래핑이 필요하며 `enc_ver` 컬럼만으로 자동 교체가 구현되는 것은 아니다. 백업에는 DB와 별도 보관한 패스프레이즈가 모두 필요하다.

아이넵의 [공식 제품 소개](https://www.inebsoft.com/products)는 통합 키 관리 제품의 물리 HSM 지원을 설명한다. 과제안내서에 있는 FIPS 140-2 Level 3 및 스마트카드+Passphrase 설명은 과제의 비교 기준으로 인용하며, 특정 현재 장비의 인증 유효성을 이 작업에서 별도로 검증한 것은 아니다.

## 선행 구현과 안내서 사이에 남아 있는 차이

이번 작업은 구현 4주차 API·테이블·화면과 수용 검증이다. 전체 과제의 모든 보안 정책까지 일치한다는 의미는 아니다.

- 현재 `MasterKeyService.REQUIRED_ITERATIONS` 및 기본 정책은 **10,000회**, 안내서 마스터키 유도 기준은 **210,000회**다. 기존 DB의 반복값은 유지했다. 기존 설정을 덮어쓰면 KCV 불일치와 데이터 복호화 불가가 발생할 수 있으므로, 반복값을 바꾸는 작업은 데이터 이관을 포함해 별도로 수행해야 한다.
- 기존 키 상태 전이는 `CREATED→DESTROYED` 직행 및 DEACTIVATED·COMPROMISED 등 확장 규칙을 포함한다. 안내서의 엄격한 상태도와 다르며 이번 4주차에서 변경하지 않았다.
- 안내서의 날짜 응답 예시와 달리 기존 API는 ISO UTC 시각을 유지한다. 화면 KST 표시와 대시보드 KST 일자 집계는 검증했다.
- 대시보드 무결성 검증은 대상 전체를 순회하므로 대규모 운영에서는 별도 검증 스케줄·캐시 설계가 필요하다. 파일 목록 응답은 메타데이터만 반환하지만 현재 엔티티 조회는 BYTEA를 함께 읽는다.
