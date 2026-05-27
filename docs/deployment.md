# 部署文档

## 环境要求

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 20.x LTS | 推荐 LTS 版本 |
| pnpm | 9.x | 包管理器（必须使用 pnpm） |
| MySQL | 8.0 | 数据库 |
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

### 3. 初始化数据库

MySQL 由 TypeORM 自动创建表（开发环境 synchronize: true），只需先创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS three_mode
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

开发环境可直接用 Docker 启动 MySQL：

```bash
docker-compose up -d
```

### 4. 启动后端

```bash
pnpm backend:dev
```

后端运行在 `http://localhost:3000`，API 前缀 `/api`。

### 5. 启动前端

```bash
pnpm dev
```

前端运行在 `http://localhost:5173`，API 请求通过 Vite 代理到后端。

---

## 生产环境部署

### 一、服务器环境安装

```bash
# 系统更新
sudo apt update && sudo apt upgrade -y

# Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
npm install -g pnpm

# MySQL 8.0
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Nginx
sudo apt install -y nginx

# PM2
npm install -g pm2

# 构建工具
sudo apt install -y build-essential git

# 防火墙
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 二、MySQL 配置

```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE IF NOT EXISTS three_mode CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'threemode'@'localhost' IDENTIFIED BY '你的强密码';
GRANT ALL PRIVILEGES ON three_mode.* TO 'threemode'@'localhost';
FLUSH PRIVILEGES;
```

确认 MySQL 只监听本地连接（`/etc/mysql/mysql.conf.d/mysqld.cnf`）：

```
bind-address = 127.0.0.1
```

### 三、部署应用代码

```bash
# 创建部署目录
sudo mkdir -p /opt/threemode
sudo chown $USER:$USER /opt/threemode
cd /opt/threemode

# 克隆代码
git clone YOUR_REPO_URL .

# 安装依赖
pnpm install --frozen-lockfile

# 构建前端
cd frontend && pnpm build    # 输出到 frontend/dist/

# 构建后端
cd ../backend && pnpm build  # 输出到 backend/dist/main.js
```

### 四、后端环境变量

创建 `backend/.env`：

```env
NODE_ENV=production

# 数据库
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=threemode
DB_PASSWORD=你的数据库密码
DB_DATABASE=three_mode
DB_LOGGING=false

# 文件服务
FILE_SERVICE_URL=https://your-file-service.com/upload
FILE_SERVICE_TOKEN=your_token
FILE_SERVICE_PATH=your_path
FILE_SERVICE_CLIENT_ID=1001
FILE_SERVICE_PASSPORT_ID=

# CORS（多个域名用逗号分隔）
CORS_ORIGINS=https://your-domain.com

# 服务端口
PORT=3000
```

设置文件权限：

```bash
chmod 600 backend/.env
```

### 五、数据库首次同步

首次部署时运行一次性同步脚本创建所有表：

```bash
cd /opt/threemode/backend
npx ts-node -r tsconfig-paths/register scripts/sync-once.ts
```

成功后会打印所有 10 张表的状态。**此脚本只需运行一次，不要重复执行。**

### 六、PM2 启动

```bash
cd /opt/threemode

# 创建日志目录
sudo mkdir -p /var/log/threemode
sudo chown $USER:$USER /var/log/threemode

# 启动应用（使用项目根目录的 ecosystem.config.js）
pm2 start ecosystem.config.js

# 设置开机自启
pm2 save
pm2 startup  # 按提示执行输出的命令
```

常用 PM2 命令：

```bash
pm2 status              # 查看进程状态
pm2 logs threemode-api  # 查看日志
pm2 monit               # 监控面板
pm2 restart threemode-api  # 重启
```

### 七、Nginx 配置

```bash
# 复制项目中的 Nginx 配置
sudo cp /opt/threemode/nginx/threemode.conf /etc/nginx/sites-available/threemode
sudo ln -s /etc/nginx/sites-available/threemode /etc/nginx/sites-enabled/

# 删除默认站点
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 八、SSL 证书（有域名后配置）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书（自动修改 Nginx 配置）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 验证自动续期
sudo certbot renew --dry-run
```

获取证书后，编辑 `nginx/threemode.conf`，取消 HTTPS server 块的注释，注释掉纯 HTTP server 块，然后重新复制到 Nginx 配置目录。

---

## 更新部署

```bash
cd /opt/threemode
git pull origin main
pnpm install --frozen-lockfile

# 重新构建
cd frontend && pnpm build
cd ../backend && pnpm build

# 重启后端
cd /opt/threemode
pm2 restart threemode-api
```

如果数据库 schema 有变更，先生成并运行 migration：

```bash
cd backend
pnpm migration:generate src/migrations/描述名称
pnpm migration:run
```

---

## 数据库备份

手动备份：

```bash
mysqldump -u threemode -p three_mode | gzip > backup_$(date +%Y%m%d).sql.gz
```

定时备份（添加到 crontab）：

```bash
# 每天凌晨 3 点备份，保留 30 天
0 3 * * * mysqldump -u threemode -p'密码' three_mode | gzip > /opt/backups/threemode_$(date +\%Y\%m\%d).sql.gz && find /opt/backups -name "threemode_*.sql.gz" -mtime +30 -delete
```

---

## 常见问题

### 数据库连接失败
- 检查 MySQL 是否运行：`sudo systemctl status mysql`
- 检查 `backend/.env` 中的数据库配置
- 确认数据库 `three_mode` 已创建：`mysql -u threemode -p -e "SHOW DATABASES;"`

### 文件上传失败
- 检查外部文件服务 `tapi.huazhukeji.cn:82` 是否可访问
- 检查 `backend/.env` 中的 `FILE_SERVICE_URL` 和 `FILE_SERVICE_TOKEN`
- 检查 Nginx 的 `client_max_body_size` 配置

### 前端无法连接后端
- 确认 PM2 进程在运行：`pm2 status`
- 确认后端监听 3000 端口：`curl http://localhost:3000/api/models`
- 检查 Nginx 反向代理配置：`sudo nginx -t`

### 环境变量缺失导致启动失败
- 后端启动时会校验必要环境变量，缺少会打印错误并退出
- 必要变量：`DB_HOST`、`DB_USERNAME`、`DB_PASSWORD`、`DB_DATABASE`、`FILE_SERVICE_URL`、`FILE_SERVICE_TOKEN`
