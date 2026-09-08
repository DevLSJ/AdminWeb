# D'Guard KMS 실행·운영 안내

[프로젝트 소개로 돌아가기](../README.md)

## 시작하기 (Getting Started)

### 사전 요구사항

- JDK 21
- Node.js 22 및 npm
- Docker 29+ (PostgreSQL을 컨테이너로 실행할 경우)

저장소를 받은 뒤 프론트엔드 의존성을 설치합니다. 백엔드는 Gradle Wrapper가 필요한 의존성을 자동으로 내려받습니다.

```bash
git clone https://github.com/devlsj/AdminWeb.git my-project
cd my-project

cd frontend
npm ci
cd ..
```

### 1. PostgreSQL 실행

로컬 개발용 PostgreSQL 17 컨테이너를 실행합니다. `dguard-postgres-data` 볼륨에 데이터가 유지됩니다.

```bash
docker run --name dguard-postgres \
  -e POSTGRES_DB=dguard_kms \
  -e POSTGRES_USER=dguard \
  -e POSTGRES_PASSWORD=dguard-local-password \
  -p 127.0.0.1:5432:5432 \
  -v dguard-postgres-data:/var/lib/postgresql/data \
  -d postgres:17-alpine
```

이미 생성한 컨테이너는 다음 명령으로 다시 실행할 수 있습니다.

```bash
docker start dguard-postgres
```

### 2. 환경 설정

필수 비밀값은 저장소에 커밋하지 말고 로컬 개발에서는 셸 환경변수로 관리합니다. 저장소 루트 `.env` 파일은 Docker Compose 배포에서만 사용합니다.

| 환경변수 | 설명 | 예시/기본값 |
|---|---|---|
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL | `jdbc:postgresql://localhost:5432/dguard_kms` |
| `SPRING_DATASOURCE_USERNAME` | DB 사용자 | `dguard` |
| `SPRING_DATASOURCE_PASSWORD` | DB 비밀번호 | 필수 |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | DDL 정책 | 기본·운영 `validate`, local 프로필 `update` |
| `KMS_MASTER_PASSPHRASE` | 마스터키 유도 패스프레이즈 | 필수, UTF-8 32바이트 이상 |
| `INTEGRITY_HMAC_KEY` | 무결성 HMAC 키 | 필수 |
| `JWT_SECRET` | JWT 서명 키 | 필수 |
| `KMS_PBKDF2_ITERATIONS` | 마스터키 PBKDF2 반복 횟수 | `10000` |
| `PASSWORD_PBKDF2_ITERATIONS` | 비밀번호 PBKDF2 반복 횟수 | `10000` |
| `USER_PROVISIONING_ENABLED` | 일회성 계정 생성 활성화 | 기본 `false` |
| `PROVISION_USER_LOGIN_ID` | 생성할 로그인 ID | 프로비저닝 시 필수 |
| `PROVISION_USER_PASSWORD` | 생성할 계정 비밀번호 | 프로비저닝 시 필수 |
| `PROVISION_USER_NAME` | 표시 이름 | 프로비저닝 시 필수 |
| `PROVISION_USER_ROLE` | 계정 역할 | `ADMIN` 또는 `CLIENT` |

```bash
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/dguard_kms
export SPRING_DATASOURCE_USERNAME=dguard
export SPRING_DATASOURCE_PASSWORD=dguard-local-password
export SPRING_JPA_HIBERNATE_DDL_AUTO=update
export KMS_MASTER_PASSPHRASE=local-master-passphrase-at-least-32-bytes
export INTEGRITY_HMAC_KEY=local-integrity-hmac-key-at-least-32-chars
export JWT_SECRET=local-jwt-secret-at-least-32-characters
```

최초 기동 시 `crypto_config`에 마스터키 유도 Salt와 KCV가 기록됩니다. **같은 DB를 사용할 때는 이후에도 동일한 `KMS_MASTER_PASSPHRASE`를 사용해야 합니다.**

운영 코드에는 기본 계정이나 비밀번호가 없습니다. 최초 계정은 아래처럼 프로비저닝
모드로 한 번 생성합니다. 비밀번호는 셸 기록에 남지 않도록 대화식으로 입력하고,
완료 후 관련 환경변수를 제거합니다.

```bash
cd backend
read -s PROVISION_USER_PASSWORD
export PROVISION_USER_PASSWORD
export USER_PROVISIONING_ENABLED=true
export PROVISION_USER_LOGIN_ID=admin
export PROVISION_USER_NAME=관리자
export PROVISION_USER_ROLE=ADMIN
./gradlew bootRun --args='--spring.main.web-application-type=none'
unset PROVISION_USER_PASSWORD USER_PROVISIONING_ENABLED \
  PROVISION_USER_LOGIN_ID PROVISION_USER_NAME PROVISION_USER_ROLE
```

프로비저닝은 기존 `login_id`가 있으면 건너뛰므로 기존 계정을 덮어쓰지 않습니다.

### 3. Backend 실행

```bash
cd backend
./gradlew bootRun
```

### 4. Frontend 실행

새 터미널에서 API 주소를 지정해 Vite 개발 서버를 실행합니다.

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

터미널에 출력된 Vite 주소(기본값 <http://localhost:5173>)로 접속한 뒤 앞에서
프로비저닝한 계정으로 로그인합니다.

### Docker Compose 배포

루트 `docker-compose.yml`은 Docker Hub에 빌드된 이미지와 서버의 `/home/dguard/app/` 마운트 경로를 사용하는 **배포 환경용 구성**입니다.

```bash
cp .env.example .env
# .env의 이미지 계정과 모든 비밀값을 실제 값으로 변경
docker compose pull
docker compose up -d
docker compose ps
```

배포 환경에서는 프론트엔드 Nginx가 `/api/*` 요청을 백엔드로 프록시하며, 외부 서비스 포트는 `80`입니다.

배포 DB에 최초 계정을 생성할 때는 서버에서 비밀번호를 대화식으로 받은 뒤,
동일한 백엔드 이미지를 일회성 non-web 컨테이너로 실행합니다.

```bash
read -s PROVISION_USER_PASSWORD
export PROVISION_USER_PASSWORD
docker compose run --rm \
  -e USER_PROVISIONING_ENABLED=true \
  -e PROVISION_USER_LOGIN_ID=admin \
  -e PROVISION_USER_PASSWORD \
  -e PROVISION_USER_NAME=관리자 \
  -e PROVISION_USER_ROLE=ADMIN \
  backend --spring.main.web-application-type=none
unset PROVISION_USER_PASSWORD
```


### 명령어

#### 1) 로그인 API 확인

```bash
curl -i -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"loginId":"admin","password":"<provisioned-password>"}'
```

정상 응답의 `data.token`에 JWT가 포함됩니다.

#### 감사 로그 기간 체인 검증

Apidog에서 `GET /api/audit-logs/verify?from=2026-09-06&to=2026-09-07`을 호출하고,
로그인 응답의 JWT를 Bearer Token으로 지정합니다. `from`, `to`는 `YYYY-MM-DD` 형식입니다.
한국 시간 기준 시작일 0시 이상, 종료일 다음 날 0시 미만을 검증하며 같은 날짜도 허용합니다.
두 날짜를 모두 생략하면 전체 체인을 검증합니다. 날짜를 지정할 때는 두 값이 모두 필요하며
종료일을 포함해 최대 366일까지 선택할 수 있습니다. 응답의 `rangeTo`는 미포함 종료 경계입니다.
기존 날짜·시간 형식의 요청은 날짜 형식으로 변경해야 합니다.

#### 2) 비밀번호 저장 형태 확인

```bash
docker exec -it dguard-db psql -U dguard -d dguard_kms -c \
  'SELECT login_id, role, status, password_algo, password_iter, length(password_hash) AS hash_len, length(password_salt) AS salt_len FROM admin_user;'
```

`password` 원문 컬럼은 존재하지 않으며 `password_hash`, `password_salt`, 알고리즘과 반복 횟수만 저장됩니다.

#### 3) KCV 실패 확인

정상 패스프레이즈로 한 번 기동해 KCV를 생성한 뒤 서버를 종료하고, 같은 DB에서 다른 패스프레이즈로 다시 실행합니다.

```bash
cd backend
KMS_MASTER_PASSPHRASE=wrong-master-passphrase-at-least-32-bytes ./gradlew bootRun
```

로그에 아래 `ERROR` 메시지와 `Master key KCV verification failed` 예외가 출력되고 Spring Boot 기동이 중단되어야 합니다. 실제 패스프레이즈나 KCV 값은 로그에 출력되지 않습니다.

```text
KCV verification failed: the configured KMS master passphrase does not match the persisted master key configuration. Application startup is aborted.
```

시연 후에는 원래 패스프레이즈로 복구합니다.

## 테스트 및 품질 검사

```bash
# Backend 테스트
cd backend
./gradlew test

# Frontend 정적 검사 및 프로덕션 빌드
cd ../frontend
npm run lint
npm run build
```

주요 테스트는 초기 계정의 Salt 적용 여부, 로그인/JWT 인증, 잘못된 로그인 거절, KCV 불일치 기동 실패, AES-GCM 임의 IV 및 변조 거절을 검증합니다.

## 보안 주의사항

- `.env`, DB 비밀번호, JWT 키, 마스터 패스프레이즈를 Git에 커밋하지 않습니다.
- 운영 환경에서 `USER_PROVISIONING_ENABLED`를 상시 활성화하지 않습니다.
- 프로비저닝 비밀번호는 Git, `.env`, 셸 명령 인자에 기록하지 않습니다.
- 운영 환경에서는 `SPRING_JPA_HIBERNATE_DDL_AUTO=validate`를 사용합니다.
- 암호화된 데이터와 `crypto_config`가 있는 DB를 백업할 때 마스터 패스프레이즈도 별도의 안전한 경로로 관리합니다.
- 마스터 패스프레이즈 변경은 단순 환경변수 교체가 아니라 키 재래핑 절차가 필요합니다.

### 감사 로그 CSV 안내 표

감사 로그 CSV는 UTF-8 BOM으로 시작하며 최상단에 열별 한글 의미·설명·예시를 포함합니다.
첫 셀이 `#`으로 시작하는 행은 안내 표입니다. CSV를 자동 처리할 때는 이 안내 행을 건너뛰고
`logUid,actor,...,rowValid` 행을 데이터 헤더로 사용하세요. 조회 결과가 없어도 안내 표와 헤더는 포함됩니다.
`createdAt`은 기존 UTC 원문을 유지하며, `rowValid`는 내보내기 시점의 개별 행 HMAC 검사 결과입니다.
