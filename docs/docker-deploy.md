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

两个代码仓库内容一致，任选其一。

只下载这两个文件，不用 clone 整个仓库（推荐）：

```bash
curl -O https://raw.githubusercontent.com/shawn-web/three-model-hub/master/docker-compose.prod.yml
curl -o .env https://raw.githubusercontent.com/shawn-web/three-model-hub/master/.env.docker.example
```

已经 clone 了仓库的话，直接复制：

```bash
cp .env.docker.example .env
```

国内访问 GitHub 不畅时，可从 Gitee 仓库取同一份文件：

```bash
git clone --depth 1 https://gitee.com/lishuaistart/three-model.git tmh-deploy
cp tmh-deploy/docker-compose.prod.yml . && cp tmh-deploy/.env.docker.example .env
```

> Gitee 的 `raw` 域名对部分服务器 IP 会返回 403（WAF 拦截），用 `git clone` 更稳。
> 以上只是获取编排文件；**容器镜像本身从 `ghcr.io`（或 `.env` 里 `IMAGE_NAMESPACE` 指定的仓库）拉取，与代码托管平台无关**。

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
| `FRAME_ANCESTORS` | `self` | 嵌入白名单，空格分隔，给 nginx 用；裸关键字会自动补引号 |
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
# 前端：真正写进 CSP 响应头，语法不同（空格分隔）
FRAME_ANCESTORS=self https://partner.example.com
```

两处表达的是同一组域名，改的时候要一起改。nginx 刻意没有下发 `X-Frame-Options`——它无法表达多域名白名单，与 CSP 同时存在时旧浏览器会按更严格的 XFO 拦截，反而会让白名单配置失效。

**关于引号**：CSP 规范要求 `self`、`none` 这类关键字必须带引号（`'self'`）。但 Docker Compose 解析 `.env` 时会剥掉外层引号，用户写 `FRAME_ANCESTORS='self'`，容器里拿到的其实是 `self`，直接拼进响应头就变成非法语法——浏览器会忽略这个关键字，白名单**静默失效**（看起来配了，实际没生效）。

镜像里的 `10-csp-normalize.envsh` 会在 nginx 渲染配置前自动给裸关键字补上引号，因此上面两种写法都等价、都安全。有多个域名时建议整体加双引号，内层单引号才会被保留：

```env
FRAME_ANCESTORS="'self' https://partner.example.com"
```

排查时可看前端容器启动日志，会打印实际生效的值：

```bash
docker logs tmh-frontend 2>&1 | grep csp-normalize
# csp-normalize: frame-ancestors -> 'self' https://partner.example.com
```

### 关于后端地址与容器重启

nginx 默认在**启动时**解析上游主机名，解析失败会直接 `[emerg] host not found in upstream` 退出。这在容器编排里会带来两个连锁问题：后端还没起来时前端跟着起不来；后端重建换 IP 后前端一直 502 直到手动重启。

前端镜像改用 Docker 内置 DNS 做运行时解析（`resolver 127.0.0.11 valid=10s`，`proxy_pass` 使用变量），因此：

- 后端不可用时前端照常启动，静态页面可正常访问，`/api` 返回 502；
- 后端恢复或换 IP 后，最多 10 秒内自动接上，**不需要重启前端容器**。

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

### 一键发布（不依赖任何 CI）

`scripts/publish-image.sh` 在任意一台装了 Docker 的机器上完成构建 + 推送：

```bash
REGISTRY=registry.cn-hangzhou.aliyuncs.com
docker login $REGISTRY
bash scripts/publish-image.sh -r $REGISTRY -n lishuaistart -t 0.1.0
```

脚本结束后会直接打印可贴进 `.env` 的两行。它顺手处理了几个容易踩的坑：关掉 buildx 的 provenance/SBOM 附加 manifest（部分国内仓库不兼容，会导致 `no matching manifest for linux/amd64`）、仓库名自动转小写、多架构与 `--no-push` 冲突时提前报错。

只构建不推送（本地验证 Dockerfile 能否编译）：

```bash
bash scripts/publish-image.sh -r docker.io -n yourname --no-push --platform linux/amd64
```

服务器是 ARM 时用 `-p linux/arm64`，要同时出双架构用 `-p linux/amd64,linux/arm64`。

### 镜像仓库怎么选

| 仓库 | 免费额度 | 国内拉取 | 备注 |
|---|---|---|---|
| 阿里云 ACR 个人版 | 免费，容量不限，3 命名空间 / 300 仓库 | 快 | 需实名认证，无 SLA |
| 腾讯云 TCR 个人版 | 免费 | 快 | |
| 华为云 SWR 个人版 | 免费 | 快 | |
| ghcr.io | 公开镜像不限量 | 一般 | 本仓库默认 |
| Docker Hub | 公开仓库免费 | 慢 | |

**Gitee 做不了镜像仓库。** 它的制品库（Gitee Repo）是企业级付费产品，社区版没有对外开放的 Registry 端点；网上「在 Gitee 上搭 Docker 仓库」的文章，实际都是让你在自己服务器上跑 `registry:2`，Gitee 只承担代码托管，跟镜像托管无关。此外 Gitee 单文件 50MB、单仓库 5GB 的限制也不适合放镜像 tar。

> 阿里云 ACR 个人版不提供多架构构建服务，但作为标准 OCI Registry 可以存放 buildx 推上去的 manifest list。若个别地域双架构拉取异常，改成用单架构分别发布即可。

### CI 自动发布

推送到 `v*.*.*` 标签时，GitHub Actions 构建 `linux/amd64` + `linux/arm64` 双架构镜像。默认推 ghcr.io，可通过仓库变量整体切换（Settings → Secrets and variables → Actions）：

| 类型 | 名称 | 示例 |
|---|---|---|
| 变量 | `REGISTRY` | `registry.cn-hangzhou.aliyuncs.com` |
| 变量 | `REGISTRY_NAMESPACE` | `lishuaistart` |
| 变量 | `IMAGE_PREFIX` | 默认 `three-model-hub` |
| 变量 | `NPM_REGISTRY` | 默认官方源，国内可设 `https://registry.npmmirror.com` |
| 密钥 | `REGISTRY_USERNAME`、`REGISTRY_PASSWORD` | 不填则回退 ghcr 账号 + 内置 token |

> GitHub Actions 本身可能被账号账单锁住，报 `The job was not started because your account is locked due to a billing issue.`，这与配置无关。这种情况下用上面的 `publish-image.sh` 手动发布即可。

ghcr.io 首次发布后**必须手动把两个 package 的可见性改为 Public**（GitHub → 个人主页 → Packages → 对应包 → Package settings → Change visibility），否则别人 `docker pull` 会 401。私有仓库则需先 `docker login`。

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

检查 `.env` 的 `FRAME_ANCESTORS` 是否包含父页面域名（空格分隔，裸关键字会自动补引号），改完要重启 frontend 容器才生效。用 `docker logs tmh-frontend | grep csp-normalize` 可确认实际生效的值。

**arm64 服务器（如树莓派、华为鲲鹏）**

官方镜像在打 tag 时同时构建了 `linux/arm64`，直接 pull 即可。自己用 `docker build` 构建的话只会得到本机架构的镜像。
