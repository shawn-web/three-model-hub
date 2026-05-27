# 阶段1：构建后端
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 复制 workspace 配置
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/

# 安装全部依赖（包括 devDependencies 用于构建）
RUN pnpm install --frozen-lockfile

# 复制后端源码并构建
COPY backend/ ./backend/
RUN cd backend && pnpm build

# 阶段2：生产运行
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 复制 workspace 配置
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/

# 只安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 复制编译产物
COPY --from=builder /app/backend/dist ./backend/dist

# 非 root 用户运行
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
USER appuser

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main.js"]
