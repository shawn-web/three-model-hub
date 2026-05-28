# 后端生产运行容器
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# 配置 npm 镜像源
RUN pnpm config set registry https://registry.npmmirror.com

# 复制 workspace 配置
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/

# 只安装生产依赖
RUN pnpm install --prod --ignore-scripts

# 复制编译产物（本地预构建）
COPY backend/dist ./backend/dist

# 非 root 用户运行
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
USER appuser

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main.js"]
