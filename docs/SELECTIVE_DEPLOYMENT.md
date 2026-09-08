# 서비스별 자동 배포 버전

자동 배포는 마지막 성공 릴리스와 현재 커밋을 비교해 변경된 frontend/backend만 빌드·pull·재시작합니다. 취소·실패한 릴리스의 변경도 다음 비교에 포함합니다. 수동 workflow_dispatch는 두 서비스를 모두 빌드합니다. 독립 Buildx 캐시와 production concurrency를 유지하며 DB pull·prune은 하지 않습니다.

서비스별 실제 이미지 버전은 서버의 `/home/dguard/app/deployed-images.yml`에 보관합니다. 기존 `.env`의 IMAGE_TAG는 최초 기본값이며, 이후 운영 명령은 이 파일을 함께 적용해야 현재 배포 버전이 유지됩니다. 별도 `docker-compose.override.yml`을 사용하는 서버는 그것도 함께 지정하세요.

```bash
cd /home/dguard/app
docker compose -f docker-compose.yml -f deployed-images.yml ps
# 예: 프론트만 재시작
docker compose -f docker-compose.yml -f deployed-images.yml up -d --no-deps frontend
```

롤백은 `deployed-images.yml`에서 해당 서비스의 태그를 이전 성공 이미지로 바꾼 뒤 같은 파일 조합으로 해당 서비스만 pull/up합니다. 배포 러너에는 Docker Compose와 Python 3이 필요합니다. 선택된 서비스는 기존 방식처럼 교체되므로 짧은 중단 가능성이 있으며, 성공한 up 이후 이미지 버전 파일을 원자적으로 교체합니다.
