# 部署文档

## 环境要求

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 18.x | 推荐 LTS 版本 |
| npm | 9.x | 包管理器 |
| MySQL | 8.0 | 数据库 |

## 配置说明

### 后端环境变量

创建 `backend/.env` 文件：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=three_mode

# 文件服务配置
FILE_SERVICE_URL=http://spm3.1357.cn/hz-file-upload/file/upload
FILE_SERVICE_CLIENT_ID=1001
FILE_SERVICE_TOKEN=your_token
FILE_SERVICE_PASSPORT_ID=your_passport_id

# 服务端口
PORT=3000
```

### 前端环境变量

创建 `.env` 文件（项目根目录）：

```env
# API 地址（开发环境通过 Vite 代理，生产环境填实际地址）
VITE_API_URL=/api
```

## 启动步骤

### 1. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd backend
npm install
```

### 2. 初始化数据库

MySQL 会由 TypeORM 自动创建表（synchronize: true），只需先创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS three_mode
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 3. 启动后端

```bash
cd backend
npm run start:dev
```

后端运行在 `http://localhost:3000`，API 前缀 `/api`。

### 4. 启动前端

```bash
npm run dev
```

前端运行在 `http://localhost:5173`，API 请求通过 Vite 代理到后端。

## 生产构建

### 前端构建

```bash
npm run build
```

输出到 `dist/` 目录，使用 Nginx 托管静态文件。

**Nginx 配置参考：**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/threeMode/dist;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 后端构建

```bash
cd backend
npm run build
npm run start:prod
```

建议使用 PM2 管理进程：

```bash
pm2 start dist/main.js --name three-mode-api
```

## Docker 部署（可选）

项目包含 `docker-compose.yml` 用于 MySQL 服务：

```bash
docker-compose up -d
```

仅启动 MySQL，后端和前端需单独运行。

## 常见问题

### 数据库连接失败
- 检查 MySQL 是否运行：`mysql -u root -p`
- 检查 `.env` 中的数据库配置
- 确认数据库 `three_mode` 已创建

### 文件上传失败
- 检查外部文件服务是否可访问
- 检查 `.env` 中的 token 配置
- 确认网络连通性

### 前端无法连接后端
- 确认后端运行在 3000 端口
- 检查 `vite.config.ts` 中的代理配置
- 生产环境检查 Nginx 代理配置
