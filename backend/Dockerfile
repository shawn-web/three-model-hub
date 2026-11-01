# syntax=docker/dockerfile:1
#
# three-model-hub 后端镜像（多阶段构建，自包含：只依赖源码 + lockfile，不依赖本地预构建产物）
#
# 本地构建：
#   docker build -f backend/Dockerfile -t three-model-hub-backend:local .
# 拉取运行：见 docker-compose.prod.yml
#
# 架构：amd64 / arm64（sharp 的 musl 预编译产物按目标平台自动选择）

# ─────────────────────────── 阶段 1：构建 ───────────────────────────
FROM node:22-alpine AS builder

# 国内网络可传 --build-arg NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm config set registry "$NPM_REGISTRY" \
 && npm install -g pnpm@9.15.2

# 容器内没有 TTY；pnpm 需要 CI 模式才会自动处理 node_modules，否则直接报错退出
ENV CI=true

WORKDIR /app

# 依赖清单单独入层：源码改动不会击穿依赖缓存
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile --filter three-model-hub-backend...

COPY backend ./backend

RUN pnpm --filter three-model-hub-backend build

# ─────────────────────────── 阶段 2：生产依赖 ───────────────────────────
# 单独一层重装 --prod：pnpm 的 symlink 结构跨阶段复制需保持目录布局一致，
# 因此两个阶段都固定在 /app 下。
FROM node:22-alpine AS proddeps

ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm config set registry "$NPM_REGISTRY" \
 && npm install -g pnpm@9.15.2

# 容器内没有 TTY；pnpm 需要 CI 模式才会自动处理 node_modules，否则直接报错退出
ENV CI=true

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile --prod --filter three-model-hub-backend...

# ─────────────────────────── 阶段 3：运行时 ───────────────────────────
FROM node:22-alpine AS runtime

# tini 负责 PID 1 信号转发，保证 docker stop 能优雅退出
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY --from=proddeps --chown=node:node /app/node_modules ./node_modules
COPY --from=proddeps --chown=node:node /app/backend/node_modules ./backend/node_modules
COPY --from=proddeps --chown=node:node /app/backend/package.json ./backend/package.json

COPY --from=builder --chown=node:node /app/backend/dist ./backend/dist

COPY --chown=node:node backend/scripts/migrate-prod.js ./backend/scripts/migrate-prod.js
COPY --chown=node:node backend/entrypoint.sh ./backend/entrypoint.sh
RUN chmod +x ./backend/entrypoint.sh

# node:22-alpine 内置 uid/gid 1000 的 node 用户，无需额外建号
USER node

WORKDIR /app/backend
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD wget -q -T 3 -O /dev/null http://127.0.0.1:3000/api/models || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
# 入口脚本：先跑 migration，成功后再启动应用
CMD ["./entrypoint.sh"]
