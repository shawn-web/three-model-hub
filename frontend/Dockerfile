# syntax=docker/dockerfile:1
#
# three-model-hub 前端镜像（多阶段构建，自包含）
#
# 构建产物是纯静态文件，由 nginx 托管；/api 由 nginx 反向代理到后端容器，
# 因此镜像本身不含任何环境相关的 API 地址——同一份镜像可用于任意环境。
#
# 本地构建：
#   docker build -f frontend/Dockerfile -t three-model-hub-frontend:local .

# ─────────────────────────── 阶段 1：构建 ───────────────────────────
FROM node:22-alpine AS builder

# 国内网络可传 --build-arg NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm config set registry "$NPM_REGISTRY" \
 && npm install -g pnpm@9.15.2

# 容器内没有 TTY；pnpm 需要 CI 模式才会自动处理 node_modules，否则直接报错退出
ENV CI=true

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile --filter three-model-hub-frontend...

# 源码含 frontend/src/docs/*.md（DocsPage 通过 import.meta.glob 内联），必须一起拷入
COPY frontend ./frontend

RUN pnpm --filter three-model-hub-frontend build

# ─────────────────────────── 阶段 2：运行时 ───────────────────────────
FROM nginx:stable-alpine AS runtime

# 运行时可通过 -e 覆盖，无需重新构建镜像
ENV BACKEND_UPSTREAM=backend:3000 \
    FRAME_ANCESTORS="'self'"

# nginx 官方镜像会自动扫描 /etc/nginx/templates/*.template 并用 envsubst 渲染
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template

COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -T 3 -O /dev/null http://127.0.0.1/healthz || exit 1
