# 部署文档

## 环境要求

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 20.x LTS | 推荐 LTS 版本 |
| pnpm | 9.x | 包管理器 |
| MySQL | 8.0 | 数据库 |
| MinIO | latest | 对象存储 |
| Nginx | 1.24+ | 反向代理 + 静态文件服务 |
| PM2 | 5.x | Node.js 进程管理 |

## 开发环境启动

### 1. 安装依赖

```bash
npm install -g pnpm
pnpm install
```

### 2. 配置环境变量

复制 `backend/.env.example` 为 `backend/.env` 并填写配置。

### 3. 启动基础设施

```bash
# 启动 MinIO（数据存 .minio-data/，控制台 http://localhost:9001）
pnpm minio:start

# 启动 MySQL
docker-compose up -d mysql

# 或一键启动
pnpm dev:infra
```

MinIO 控制台：`http://localhost:9001`，账号 `minioadmin / minioadmin123`。

### 4. 运行 migration

```bash
cd backend && pnpm migration:run
```

### 5. 启动后端

```bash
pnpm backend:dev
```

后端运行在 `http://localhost:3000`，API 前缀 `/api`。

### 6. 启动前端

```bash
pnpm dev
```

前端运行在 `http://localhost:5173`，API 请求通过 Vite 代理到后端。

### 一键全栈

```bash
pnpm dev:full
```

---

## 生产环境部署

> **推荐先看 [`docker-deploy.md`](docker-deploy.md)**：拉取已发布镜像一条命令起全栈，无需在服务器上装 Node、MySQL、Nginx。
> 本章节保留给需要在裸机上以 PM2 + 系统 Nginx 方式部署、或需要深度定制运行环境的场景。

### 一、服务器环境安装

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm / PM2
npm install -g pnpm pm2

# MySQL 8.0
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Nginx
sudo apt install -y nginx

# 构建工具
sudo apt install -y build-essential git

# 防火墙
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 二、MySQL 配置

```sql
CREATE DATABASE IF NOT EXISTS three_model_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'three-model-hub'@'localhost' IDENTIFIED BY '你的强密码';
GRANT ALL PRIVILEGES ON three_model_hub.* TO 'three-model-hub'@'localhost';
FLUSH PRIVILEGES;
```

确认 MySQL 只监听本地连接（`/etc/mysql/mysql.conf.d/mysqld.cnf`）：

```
bind-address = 127.0.0.1
```

### 三、部署应用代码

```bash
sudo mkdir -p /opt/three-model-hub
sudo chown $USER:$USER /opt/three-model-hub
cd /opt/three-model-hub

git clone YOUR_REPO_URL .
pnpm install --frozen-lockfile

cd frontend && pnpm build
cd ../backend && pnpm build
```

### 四、MinIO 部署

**方式一：直接二进制**

```bash
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=你的密码 \
  ./minio server /var/lib/minio --console-address ":9001"
```

**方式二：Docker**

```bash
docker run -d \
  --name minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=你的密码 \
  -v /data/minio:/data \
  minio/minio server /data --console-address ":9001"
```

首次启动 NestJS 时 `MinioService.onModuleInit` 会自动创建 `three-model-hub` bucket 并设置 download 策略。

### 五、后端环境变量

创建 `backend/.env`：

```env
NODE_ENV=production

# 数据库
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=three-model-hub
DB_PASSWORD=你的数据库密码
DB_DATABASE=three_model_hub
DB_LOGGING=false

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=你的MinIO密码
MINIO_BUCKET=three-model-hub
MINIO_DATA_DIR=./.minio-data            # 仅本地 minio:start 脚本使用

# 上传限制
MAX_UPLOAD_SIZE_MB=1024
UPLOAD_CLEANUP_THRESHOLD_HOURS=24       # 孤儿 pending session 清理阈值（小时）

# iframe 嵌入安全（frame-ancestors 白名单，多个用逗号分隔；默认 self 只允许同源嵌入）
IFRAME_FRAME_ANCESTORS=self

# CORS（多个域名用逗号分隔）
CORS_ORIGINS=https://your-domain.com

# 服务端口
PORT=3000
```

| 环境变量 | 说明 |
|------|------|
| IFRAME_FRAME_ANCESTORS | frame-ancestors 白名单，多个用逗号分隔，默认 self（只允许同源嵌入）|

设置文件权限：

```bash
chmod 600 backend/.env
```

### 六、数据库同步

首次部署或新增 migration 后运行：

```bash
cd /opt/three-model-hub/backend
pnpm migration:run
```

> 历史脚本 `scripts/sync-once.ts` 已废弃（依赖 `synchronize: true` 一次性建表），
> 新部署统一使用 TypeORM migration（`backend/src/migrations/`）。

### 七、PM2 启动

```bash
cd /opt/three-model-hub

sudo mkdir -p /var/log/three-model-hub
sudo chown $USER:$USER /var/log/three-model-hub

pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

常用命令：

```bash
pm2 status
pm2 logs three-model-hub-api
pm2 monit
pm2 restart three-model-hub-api
```

### 八、Nginx 配置

```bash
sudo cp /opt/three-model-hub/nginx/three-model-hub.conf /etc/nginx/sites-available/three-model-hub
sudo ln -s /etc/nginx/sites-available/three-model-hub /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

nginx 配置已包含 iframe 嵌入安全头（`X-Frame-Options: SAMEORIGIN` + `Content-Security-Policy: frame-ancestors 'self'`），默认只允许同源嵌入。
如需允许外部域名嵌入：在 nginx 配置中手动添加域名到 `frame-ancestors`，或通过部署脚本读取环境变量 `IFRAME_FRAME_ANCESTORS`（多个用逗号分隔）并替换 nginx 配置。`GET /api/geo-maps/:id/iframe-config` 端点提供后端白名单数据供运维脚本参考。

### 九、SSL 证书

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
sudo certbot renew --dry-run
```

---

## 更新部署

```bash
cd /opt/three-model-hub
git pull origin main
pnpm install --frozen-lockfile

cd frontend && pnpm build
cd ../backend && pnpm build
pm2 restart three-model-hub-api
```

数据库 schema 变更时：

```bash
cd backend
pnpm migration:generate src/migrations/描述名称
pnpm migration:run
```

---

## 数据库备份

手动备份：

```bash
mysqldump -u three-model-hub -p three_model_hub | gzip > backup_$(date +%Y%m%d).sql.gz
```

定时备份（crontab）：

```bash
0 3 * * * mysqldump -u three-model-hub -p'密码' three_model_hub | gzip > /opt/backups/three-model-hub_$(date +\%Y\%m\%d).sql.gz && find /opt/backups -name "three-model-hub_*.sql.gz" -mtime +30 -delete
```

---

## 常见问题

### 数据库连接失败
- 检查 MySQL 是否运行：`sudo systemctl status mysql`
- 检查 `backend/.env` 中的数据库配置
- 确认数据库已创建：`mysql -u three-model-hub -p -e "SHOW DATABASES;"`

### 文件上传失败
- 检查 MinIO 是否运行：`curl http://localhost:9000/minio/health/live`
- 检查 `backend/.env` 中的 `MINIO_*` 配置
- 检查 Nginx 的 `client_max_body_size` 配置

### 前端无法连接后端
- 确认 PM2 进程在运行：`pm2 status`
- 确认后端监听 3000 端口：`curl http://localhost:3000/api/models`
- 检查 Nginx 反向代理配置：`sudo nginx -t`

### 环境变量缺失
- 必要变量：`DB_HOST`、`DB_USERNAME`、`DB_PASSWORD`、`DB_DATABASE`、`MINIO_ENDPOINT`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`
