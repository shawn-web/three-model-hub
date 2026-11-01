# 后端生产运行容器
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# 配置 npm 镜像源
RUN pnpm config set registry https://registry.npmmirror.com

# 复制 workspace 配置
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/

# 安装生产依赖（不禁用构建脚本，sharp/meshoptimizer 需要构建）
RUN pnpm install --prod

# 复制编译产物（本地预构建）
COPY backend/dist ./backend/dist

# 复制迁移脚本
COPY backend/scripts/migrate-prod.js ./backend/scripts/migrate-prod.js

# 复制入口脚本
COPY backend/entrypoint.sh ./backend/entrypoint.sh
RUN chmod +x ./backend/entrypoint.sh

# 非 root 用户运行
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
USER appuser

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 3000

# 入口：先跑迁移再启动应用
CMD ["./entrypoint.sh"]
