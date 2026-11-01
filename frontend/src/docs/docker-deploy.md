# Docker 镜像部署

本文档面向「只想把服务跑起来」的使用者：**不需要源码，不需要本地构建，拉取镜像即可部署**。

如果你要改代码或调试，请看 [`development.md`](development.md)；裸机 + PM2 的传统部署方式见 [`deployment.md`](deployment.md)。

---

## 一、三种部署方式怎么选

| 场景 | 编排文件 | 是否需要源码 |
|------|----------|--------------|
| 本地开发（只起 MySQL） | `docker-compose.yml` | 需要 |
| 服务器部署，自己构建镜像 | `docker-compose.deploy.yml` | 需要 |
| 服务器部署，直接拉取镜像 | `docker-compose.prod.yml` | **不需要** |

下文全部围绕第三种。

---

## 二、快速开始

### 1. 准备

服务器需安装 Docker 20.10+ 与 Docker Compose v2：

```bash
docker --version
docker compose version
```

### 2. 获取编排文件

```bash
# 方式一：只下载这两个文件，不用 clone 整个仓库
curl -O https://gitee.com/lishuaistart/three-model/raw/master/docker-compose.prod.yml
curl -o .env https://gitee.com/lishuaistart/three-model/raw/master/.env.docker.example

# 方式二：已经有仓库
cp .env.docker.example .env
```

### 3. 填写口令

编辑 `.env`，**这四个值必须改**，不要留空也不要沿用示例值：

```env
DB_PASSWORD=<应用账号口令>
MYSQL_ROOT_PASSWORD=<root 口令>
MINIO_ACCESS_KEY=<对象存储账号>
MINIO_SECRET_KEY=<对象存储口令>
```

生成随机口令：

```bash
openssl rand -base64 24
```

### 4. 拉取并启动

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

首次启动时后端会做两件事：等待 MySQL 健康 → 若检测到空库则按实体定义建表，然后执行 migration。

### 5. 访问

```bash
docker compose -f docker-compose.prod.yml ps
```

浏览器打开 `http://<服务器IP>:8080` 即可。

健康状态：

- 前端：`GET /healthz` → `ok`
- 后端：`GET /api/models` → JSON 列表

---

## 三、服务与端口

| 服务 | 容器名 | 端口 | 对外 |
|------|--------|------|------|
| frontend | `tmh-frontend` | 80 | `8080`（可改 `FRONTEND_PORT`） |
| backend | `tmh-backend` | 3000 | 否，仅容器网络内 |
| mysql | `tmh-mysql` | 3306 | 否，仅容器网络内 |
| minio | `tmh-minio` | 9000 / 9001 | 仅控制台绑定 `127.0.0.1:9001` |

**只暴露一个端口**是刻意的设计：

- 前端 nginx 把 `/api/` 反向代理到后端；
- 模型文件由后端 `/api/storage/:bucket/*` 代理读取，MinIO 不对公网暴露；
- 因此同一个域名下没有任何跨域和额外端口需要开放。

MinIO 控制台需通过 SSH 隧道访问：

```bash
ssh -L 9001:127.0.0.1:9001 user@your-server
# 然后浏览器打开 http://localhost:9001
```

---

## 四、环境变量

完整清单见 [`.env.docker.example`](../.env.docker.example)，这里只说容易踩坑的几项。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `IMAGE_NAMESPACE` | `ghcr.io/shawn-web` | 镜像仓库前缀，换私有仓库时改这个 |
| `IMAGE_TAG` | `latest` | 建议固定为具体版本号，便于回滚 |
| `FRONTEND_PORT` | `8080` | 对外端口 |
| `DB_USERNAME` | `tmh` | 应用数据库账号，**不要用 root** |
| `DB_AUTO_BOOTSTRAP` | `true` | 空库首次启动时自动建表，见下文 |
| `IFRAME_FRAME_ANCESTORS` | `self` | 嵌入白名单，逗号分隔，给后端用 |
| `FRAME_ANCESTORS` | `'self'` | 嵌入白名单，CSP 语法（空格分隔、带引号），给 nginx 用 |
| `CORS_ORIGINS` | 空 | 留空时后端会反射任意 Origin，公网部署建议显式填写 |

### 关于 `DB_AUTO_BOOTSTRAP`

仓库里的 migration 全部是增量变更，没有「基础建表」那一版。为了让全新服务器能一次跑通，后端启动脚本在**检测到库里一张表都没有**时会按实体定义建出完整表结构，并把这些历史 migration 登记为已应用。

- 已有数据的库不会触发该逻辑，仍按正常 migration 增量升级。
- 建表可能影响既有数据，所以检测到「库非空但缺核心表」时只告警、不自动修复。
- 确认不需要时可设 `DB_AUTO_BOOTSTRAP=false`，此时空库会直接报错退出。

### 关于 iframe 嵌入白名单

项目核心能力是把场景 iframe 嵌入到其他系统，所以有两处需要同时配置：

```env
# 后端：告诉集成方哪些域名可以嵌入（供 /api/geo-maps/:id/iframe-config）
IFRAME_FRAME_ANCESTORS=self,https://partner.example.com
# 前端：真正写进 CSP 响应头，语法不同
FRAME_ANCESTORS='self' https://partner.example.com
```

两处表达的是同一组域名，改的时候要一起改。nginx 刻意没有下发 `X-Frame-Options`——它无法表达多域名白名单，与 CSP 同时存在时旧浏览器会按更严格的 XFO 拦截，反而会让白名单配置失效。

---

## 五、反向代理与 HTTPS

容器本身只监听 HTTP。生产环境建议在前面加一层 nginx 或 Caddy 终止 TLS。

```nginx
server {
    listen 443 ssl http2;
    server_name three-model.example.com;

    ssl_certificate     /etc/letsencrypt/live/three-model.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/three-model.example.com/privkey.pem;

    client_max_body_size 1024m;   # 与 MAX_UPLOAD_SIZE_MB 对齐

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

注意：**不要在最外层再加 `X-Frame-Options`**，否则 iframe 嵌入会被挡掉。帧安全交给容器内的 CSP 处理。

配好域名后记得把 `.env` 里的 `CORS_ORIGINS` 改成实际域名。

---

## 六、数据卷与备份

| 卷名 | 挂载点 | 内容 |
|------|--------|------|
| `three-model-hub_mysql-data` | `/var/lib/mysql` | 数据库 |
| `three-model-hub_minio-data` | `/data` | 模型文件、缩略图、图片 |

备份数据库：

```bash
docker compose -f docker-compose.prod.yml exec -T mysql \
  sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction "$MYSQL_DATABASE"' \
  > backup-$(date +%F).sql
```

备份对象存储：

```bash
docker run --rm \
  -v three-model-hub_minio-data:/data:ro \
  -v "$PWD":/backup alpine \
  tar czf /backup/minio-$(date +%F).tar.gz -C /data .
```

---

## 七、升级与回滚

```bash
# 改 .env 里的 IMAGE_TAG 到目标版本
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

回滚就是把 `IMAGE_TAG` 改回旧版本再执行同样两步。数据库 migration 不会自动回退，跨大版本升级前请先备份。

> 建议把 `IMAGE_TAG` 固定为具体版本号而不是 `latest`，否则回滚时无从下手。

---

## 八、自己构建镜像

改过代码、或需要私有镜像时：

```bash
# 后端
docker build -f backend/Dockerfile -t three-model-hub-backend:dev .

# 前端
docker build -f frontend/Dockerfile -t three-model-hub-frontend:dev .
```

国内网络可加速：

```bash
docker build -f backend/Dockerfile \
  --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
  -t three-model-hub-backend:dev .
```

推送到私有仓库后在 `.env` 里改 `IMAGE_NAMESPACE` 指过去即可。

### 镜像发布

推送到 `v*.*.*` 标签时，GitHub Actions 会自动构建 `linux/amd64` + `linux/arm64` 双架构镜像并推送到：

```
ghcr.io/shawn-web/three-model-hub-backend
ghcr.io/shawn-web/three-model-hub-frontend
```

**首次发布后必须手动把这两个 package 的可见性改为 Public**（GitHub → 个人主页 → Packages → 对应包 → Package settings → Change visibility），否则别人 `docker pull` 会 401。私有仓库则需先 `docker login ghcr.io`。

---

## 九、常见问题

**`docker compose pull` 报 `not found` / `unauthorized`**

说明镜像还没发布，或发布后 package 仍是私有。两种处理：

```bash
# 方案一：改用源码构建路径（有源码时立刻可用）
docker compose -f docker-compose.deploy.yml up -d --build

# 方案二：登录后再拉（镜像已发布但为私有）
echo $CR_PAT | docker login ghcr.io -u <你的GitHub用户名> --password-stdin
```

**启动后 502 / 前端能开但接口报错**

后端还没就绪，或启动失败：

```bash
docker compose -f docker-compose.prod.yml logs backend | tail -50
```

最常见原因是数据库口令不一致——`.env` 里的 `DB_PASSWORD` 只在 MySQL 首次初始化时生效，之后改 `.env` 不会改掉库里已有的口令。

**日志里出现 `Access denied for user 'tmh'@'...'`**

同上；或在已有数据卷上换了 `DB_USERNAME`。要么把口令改回原值，要么清空数据卷重来（会丢数据）。

**改了 `.env` 不生效**

`DB_PASSWORD`、`MYSQL_ROOT_PASSWORD`、`MINIO_ACCESS_KEY/SECRET_KEY` 都只在**首次初始化数据卷时**写入数据库/对象存储。改完需要：

```bash
docker compose -f docker-compose.prod.yml down -v   # 删除数据卷，数据会丢
docker compose -f docker-compose.prod.yml up -d
```

**上传大文件失败**

确认 `MAX_UPLOAD_SIZE_MB` 与外层反向代理的 `client_max_body_size` 都不小于文件大小。

**iframe 嵌入报 X-Frame-Options / frame-ancestors 错误**

检查 `.env` 的 `FRAME_ANCESTORS` 是否包含父页面域名（注意是 CSP 语法，每项带单引号、空格分隔），改完要重启 frontend 容器才生效。

**arm64 服务器（如树莓派、华为鲲鹏）**

官方镜像在打 tag 时同时构建了 `linux/arm64`，直接 pull 即可。自己用 `docker build` 构建的话只会得到本机架构的镜像。
