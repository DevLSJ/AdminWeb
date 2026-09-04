# Apidog 가져오기 안내

`dguard-kms-openapi.json`에는 D'Guard KMS의 API 경로, 요청 Body,
Path/Query 파라미터, 응답 모델과 Bearer 인증 방식이 들어 있습니다.

## 1. API 명세 가져오기

Apidog 프로젝트에서 `Project Settings` → `Import Data` →
`OpenAPI/Swagger`를 선택하고 `dguard-kms-openapi.json`을 업로드합니다.

기존에 임시로 만든 API와 Method/Path가 같으면 가져오기 미리보기에서
기존 API를 업데이트하는 방식을 선택합니다.

## 2. 서버 주소 설정

Apidog 환경의 Base URL에는 `/api`를 붙이지 않습니다.

- 로컬: `http://localhost:8080`
- 운영: 실제 서비스 주소(예: `https://kms.example.com`)

## 3. 로그인 토큰 자동 저장

환경 변수 `access_token`을 하나 만든 뒤 로그인 API의
`Post Processors` → `Extract Variable`에 다음 값을 입력합니다.

- Variable name: `access_token`
- Scope: `Environment`
- Source: `Response JSON`
- JSONPath: `$.data.token`

공통 Authorization은 `Bearer Token`으로 선택하고 Token 값에
`{{access_token}}`을 입력합니다. `Bearer` 문자열은 직접 붙이지 않습니다.
로그인 API는 가져온 명세대로 `No Auth`를 유지합니다.

## 4. 실행 순서

1. 로그인 API를 실행해 토큰을 저장합니다.
2. 키 생성 API를 실행합니다.
3. 생성 응답의 `data.keyUid`를 복사해 `{keyUid}` Path Parameter에 넣습니다.
4. `GET /api/users/managed`에서 `admin_user` 관리 계정과 `app_user` 암호화 사용자가 모두 조회되는지 확인합니다.
5. 사용자 등록·마스킹 조회·사유 기반 원문 조회를 실행합니다.
6. 감사 로그 검색·기간/개별 체인 검증·CSV 내보내기를 실행합니다.
7. 나머지 키 조회·수정·테스트 API를 실행합니다.

요청 Body와 Query/Path 파라미터 구조는 OpenAPI 파일에서 자동으로
가져오므로 Apidog에서 다시 수동 작성할 필요가 없습니다.
