# 阶段1：构建前端
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 复制 workspace 配置
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json ./frontend/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制前端源码并构建
COPY frontend/ ./frontend/
RUN cd frontend && node node_modules/vite/bin/vite.js build

# 阶段2：Nginx 服务
FROM nginx:1.27-alpine

# 复制构建产物
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
