# ─────────────────────────────────────────────
# Stage 1: Build (Node + Vite)
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# 의존성 캐시 레이어 (package.json 변경 시만 재설치)
COPY package.json package-lock.json ./
RUN npm ci

# 소스 복사 및 빌드
COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Runtime (Nginx)
# ─────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# 기본 Nginx 설정 제거 후 커스텀 설정 적용
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Vite 빌드 결과물 복사
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
