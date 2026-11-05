# Changelog

## 2026-11-05

镜像构建实测与端到端部署验证：

- **修复 CSP 白名单静默失效**：CSP 要求 `self`/`none` 必须带引号，但 Docker Compose 解析 `.env` 会剥掉外层引号，`FRAME_ANCESTORS='self'` 到容器里变成 `self`，渲染出 `frame-ancestors self` 属非法语法，浏览器忽略该关键字——白名单看起来配了实际没生效。新增 `frontend/docker-entrypoint.d/10-csp-normalize.envsh`（`.envsh` 会被官方入口脚本 source，编号 10 保证先于 20-envsubst 执行）自动补引号
- **修复 nginx 启动即退出 / 后端换 IP 后永久 502**：nginx 默认启动时解析上游主机名，解析不到直接 `[emerg] host not found in upstream` 退出。改用 Docker 内置 DNS 做运行时解析（`resolver 127.0.0.11 valid=10s` + 变量形式 `proxy_pass`）。现在后端不可用时前端照常启动、`/api` 返回 502；后端恢复或换 IP 后 10 秒内自动接上，无需重启前端
- **修复 BuildKit 并行调度导致构建中断**：`builder` 与 `proddeps` 两个阶段无依赖关系会被并行执行，两个 `pnpm install` 同时下载会耗尽内存并报 `rpc error: ... EOF`。改为从 builder 复用 pnpm store，既建立阶段依赖又省掉重复下载
- **修复 runtime 阶段 apk 与 install 争抢网络**：`apk add tini` 与 `pnpm install` 并行时偶发失败，移到所有 COPY 之后
- **实测结论**：两镜像本机构建通过（后端 437MB / 前端 129MB），四容器全部 healthy；空库自举建表、文件上传→MinIO→代理回读字节一致、模型增删查、`/api` 反代、iframe 路由、Cesium 静态资源、数据卷持久化与增量 migration 分支全部验证通过

## 2026-11-02

Docker 镜像化与拉取式部署：

- **镜像自包含**：重写 `backend/Dockerfile` 与 `frontend/Dockerfile` 为多阶段构建。旧版本依赖本地预构建的 `dist`（`COPY backend/dist`），既无法从干净源码构建，也无法由 CI 产出可分发的镜像
- **新增 `docker-compose.prod.yml`**：纯 `image:` 编排，用户只需下载编排文件 + `.env` 即可 `docker compose up -d`，不需源码、不需构建
- **新增 `.github/workflows/docker-publish.yml`**：打 `v*.*.*` 标签时构建 `linux/amd64` + `linux/arm64` 双架构镜像并推送 ghcr.io；PR 仅做 amd64 编译验证不推送
- **修复空库无法首次部署**：仓库内 migration 全是增量 ALTER，没有基础建表那一版，而生产 `synchronize=false`，旧流程在全新数据库上必然失败并进入重启循环。`migrate-prod.js` 现在会在检测到空库时按实体定义自举建表，并把历史 migration 登记为已应用（`DB_AUTO_BOOTSTRAP` 可关闭）
- **修复 nginx 模板化与安全头失效**：`/api` 反代地址与 iframe 白名单改为运行时 envsubst 注入，同一份镜像可用于任意环境；原配置在 `location` 内写 `add_header` 导致 server 级 CSP 不再继承，改用 `expires` 控制缓存以保持安全头始终生效；同时去掉 `X-Frame-Options`，避免与 CSP 多域名白名单冲突
- **修复幽灵依赖**：`frontend/src` 直接 `import type` 了 `three-stdlib` 与 `@iconify/types` 但未声明，本地靠 pnpm 提升侥幸可用，任何过滤安装（含镜像构建）都会失败。已补进 `devDependencies`
- **修复 `.dockerignore` 误伤**：原规则 `*.md` 会把 `frontend/src/docs/*.md` 一并排除，导致镜像内文档页空白；改为按目录精确排除，并补上 `**/node_modules`（原写法只排除根目录那一份）
- **清理死配置** `MINIO_PUBLIC_URL`：`getPublicUrl` 早已改为返回相对地址 `/api/storage/{bucket}/{key}`，该变量不再被任何代码读取，仅在示例与编排里误导使用者
- **固定 pnpm 行为**：容器内无 TTY，Dockerfile 增加 `ENV CI=true`，否则 pnpm 遇到需重建 `node_modules` 时会直接报错退出
- **文档**：新增 `docs/docker-deploy.md`（拉取部署、环境变量、HTTPS、备份升级、常见问题），README 与 `docs/deployment.md` 增加入口

镜像仓库可切换：

- **新增 `scripts/publish-image.sh`**：在任意装了 Docker 的机器上一条命令完成构建 + 推送，完全不依赖 CI；内置仓库名小写化、多架构与 `--no-push` 冲突检测、关闭 buildx 的 provenance/SBOM 附加 manifest（部分国内仓库不兼容会导致 `no matching manifest`）
- **发布流水线仓库参数化**：`docker-publish.yml` 的 `REGISTRY` / `IMAGE_NAMESPACE` / `IMAGE_PREFIX` / `NPM_REGISTRY` 改为读取仓库变量，`REGISTRY_USERNAME` / `REGISTRY_PASSWORD` 走密钥，不配置时行为与原来一致（ghcr.io + 内置 token）
- **文档补充镜像仓库选型**：阿里云 ACR、腾讯云 TCR、华为云 SWR 个人版均免费可用；说明 Gitee 无法作为镜像仓库（制品库属企业版付费功能，社区版无 Registry 端点），并给出 `.env` 一行切换的方法

## 2026-11-01

开源前工程化整改：

- **编码**：移除 47 个文件中的 UTF-8 BOM（此前导致 Vite 无法解析 `package.json`，前端测试虽全绿却退出码 1），新增 `.editorconfig` 与 `scripts/check-bom.py` 防回归
- **测试**：修复后端 7 处测试漂移（scenes/geo-maps 的 `modelRepo` mock、`models.controller.download`、`upload` 的 `bizType`、annotations/viewpoints 新增 `sceneId` 参数），后端单测 328 项全绿
- **类型与 Lint**：修复前端 5 处 TypeScript 编译错误（`pnpm build` 此前会失败）；前端 ESLint 从 63 error 降至 0，后端 12 error 清零
- **契约**：`getIframeConfig` 的 `frameAncestors` 统一返回不带引号的 origin（与 `docs/api.md` 一致）
- **仓库卫生**：移除被跟踪的 `*.tsbuildinfo`、两份 npm 锁文件、AI 工具配置；`docs/superpowers/` 更名为 `docs/design/`；重写 `.gitignore`
- **CI**：修复 `setup-node` 的 pnpm 缓存早于 pnpm 安装的顺序缺陷；新增编码检查、lint、typecheck、文档同步校验作业
- **安全**：重写 Git 历史，从全部 74 个提交中移除曾提交的 `backend/.env`（含 `FILE_SERVICE_TOKEN`、`DB_PASSWORD`），并清除 238MB 的 `外立面.glb` 二进制文件；仓库 `.git` 从 46MB 降至 2.4MB
- **元信息**：统一全部历史提交的作者身份为 `shawn-web <lishuaistart@163.com>`
- **文档**：新增 `docs/iframe-integration.md`（路由/参数/消息协议/安全模型）
- **发布**：主仓库迁至 Gitee（`lishuaistart/three-model`），GitHub 镜像为 `shawn-web/three-model-hub`，README 增加 CI 状态徽章
- **配置**：`pnpm.onlyBuiltDependencies` 从 `backend/package.json` 上移到工作区根，消除 pnpm 告警

## 2026-06-02

- 新增 `pnpm dev:all` 命令，支持一键并行启动前后端开发服务

## 2026-05-22

- 优化场景编辑器类型安全与调试配置
- iframe 嵌入支持动态传入 `sceneId` 加载对应场景

## 2026-05-20

- 资源管理添加点击预览功能
- 引入 `yet-another-react-lightbox` 支持图片和视频预览

## 2026-05-19

- 场景编辑器增强：材质修改、纹理替换、场景重置
- 查看器树交互优化

## 2026-05-15

- 3D 模型查看器基础功能上线
- 支持 GLB/GLTF 模型加载、场景组合、标注、测量、剖面
- 12 个查看器插件：测量、导航、拾取、剖面、网格、自动旋转、相机信息、旋转模式、截图、视图方块、变换控制、透视
