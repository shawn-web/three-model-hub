# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

three-model-hub 是一个全栈 3D 模型管理与场景平台，支持 GLB/GLTF 模型上传、场景组合、标注、测量、剖面、Geo 地理和分享。pnpm monorepo 结构，前后端分离。

## 常用命令

```bash
# 前端开发（Vite dev server，默认 localhost:5173）
pnpm dev

# 前端构建
pnpm build

# 前端测试（Vitest）
cd frontend && pnpm test          # watch 模式
cd frontend && pnpm test:run      # 单次运行

# 后端开发（NestJS，默认 localhost:3000）
pnpm backend:dev

# 后端测试（Jest）
pnpm backend:test

# 数据库（MySQL 8.0，docker-compose）
docker-compose up -d

# MinIO（根目录脚本，替代 docker-compose 中 minio 服务）
pnpm minio:start                  # 启动 MinIO，控制台 http://localhost:9001（minioadmin/minioadmin123）
pnpm minio:stop                   # 跨平台杀进程
pnpm minio:status                 # 检查健康状态
pnpm minio:reset                  # 清理 .minio-data/ 数据

# 一键全栈
pnpm dev:full                     # 并发启动 MinIO + MySQL + 前后端
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 19 + TypeScript 6 |
| 构建 | Vite 8 |
| 3D 渲染 | Three.js + React Three Fiber + Drei |
| UI | Ant Design 6 + Tailwind CSS |
| 状态管理 | Zustand（zundo 提供 undo/redo） |
| 后端框架 | NestJS 11 |
| 对象存储 | MinIO（S3 兼容，minio Node SDK 8.x） |
| 定时任务 | @nestjs/schedule 6.x |
| 数据库 | MySQL 8.0 + TypeORM |
| 包管理 | pnpm workspaces |

## 架构

### Monorepo 布局

```
frontend/        # React SPA（Vite）
backend/         # NestJS API（Express）
docker-compose.yml  # MySQL 开发环境
```

### 前端关键路径

- **路由**: `frontend/src/RouterApp.tsx` — `/`（首页）、`/models`、`/scenes`、`/scenes/:id/edit`（场景编辑器）、`/view/:sceneId`（全屏查看器）、`/maps`（地图管理列表）、`/maps/:id`（Geo 3D 地球页面，Cesium + 暗色主题，无导航栏，支持 iframe 嵌入）、`/resources`、`/docs`、`/docs/:name`（应用内文档）、`/iframe/:sceneId`（iframe 嵌入查看器，无导航栏）
  - `/maps/:id` iframe 嵌入 URL 参数：`imagery`（底图厂商，如 `tianditu`/`google`）、`type=satellite|vector|terrain`（图层类型）、`toolbar=false`（隐藏工具栏）、`panel=false`（隐藏右侧面板）、`hiddenTools=tool1,tool2`（隐藏指定工具按钮）、`visibleModelIds=id1,id2`（仅显示指定模型；不传=全显示，传空=全隐藏）、`showMarkers=false`（隐藏标点）、`allowedOrigins=https://a.com,https://b.com`（postMessage 白名单）、`camera={"longitude":...,"latitude":...,"altitude":...,"heading":...,"pitch":...}`（初始视角 JSON）
  - `/maps/:id` 运行时 postMessage：`geo-config`（覆盖底图/工具栏/面板/视角/可见性，不持久化）；iframe 向外发送：`geo-ready`、`geo-models-loaded`、`geo-position-changed`、`geo-saved`、`geo-model-clicked`、`marker-clicked`
- **状态**: `frontend/src/store/` — `scene-store.ts`（3D 场景核心状态）、`viewer-store.ts`（查看器）、`edit-store.ts`（编辑器+undo/redo）、`geo-store.ts`（Geo 页面：Cesium 地球 / 模型地理定位 / 拖拽交互 / 底图配置）、`theme-store.ts`
- **API 层**: `frontend/src/api/client.ts`（Axios 实例 + GET 请求 5 分钟缓存）
- **3D 插件**: `frontend/src/plugins/` — 12 个插件：measurement（测量）、navigation（导航）、picking（拾取）、section（剖面）、grid（网格）、auto-rotate（自动旋转）、camera-info（相机信息）、rotation-mode（旋转模式）、screenshot（截图）、view-cube（视图方块）、transform-controls（变换控制）、xray（透视）
- **核心模块**: `frontend/src/core/` — `plugin-manager.ts`（插件管理器）、`viewer.ts`（查看器上下文工厂）
- **模型加载**: `frontend/src/loaders/glb-loader.ts`、`loader-registry.ts`（加载器注册表）、`utils/multi-model-loader.ts`
- **通信**: `frontend/src/communication/` — iframe 嵌入时的消息总线（`message-bus.ts`、`protocol.ts`）+ URL 参数解析（`url-params.ts`）
- **主题**: `frontend/src/theme/` — Ant Design 主题配置（明暗主题）

### 后端模块结构

NestJS 模块化组织，每个业务模块包含 `entities/`、`dto/`、`*.service.ts`、`*.controller.ts`：

| 模块 | 路径前缀 | 功能 |
|---|---|---|
| Models | `/api/models` | 模型 CRUD + 版本管理 |
| Scenes | `/api/scenes` | 场景组合（模型/图片排列 + transform + material_overrides） |
| GeoMaps | `/api/geo-maps` | 地理地图管理（独立模块：模型地理定位 + 底图配置 + 标点） |
| Viewpoints | `/api/scenes/:sceneId/viewpoints` | 相机视点保存（嵌套在场景下） |
| Annotations | `/api/scenes/:sceneId/annotations` | 模型标注（嵌套在场景下） |
| Sharing | `/api/share` | 场景分享（token 机制） |
| Upload | `/api/upload/*` | 分片上传管理（simple/multipart init/part/complete/abort/status 6 端点，依赖 UploadSession 实体） |
| Resources | `/api/resources` | 通用文件资源（含分组管理 `/groups`、图片代理 `/proxy-image`、文件上传 `/upload`） |
| Storage | `/api/storage/:bucket/*` | 文件存储代理（列表 + 流式下载，封装 MinIO） |
| MinIO | （无独立路由） | MinIO 基础设施模块（`@Global()`，onModuleInit 自动创建 bucket + 设 download 策略） |

共享目录：`common/`（全局异常过滤器、共享类型）、`types/`（Express 类型增强）、`migrations/`（TypeORM migration 脚本）。

### 数据库

- TypeORM `synchronize: true`（开发环境自动同步，生产需 migration）
- `autoLoadEntities: true`
- 核心实体关系：Model → ModelVersion（一对多）、Scene → SceneModel（多对多，含 transform/material_overrides JSON 字段）、GeoMap → GeoMapModel（多对多，含 geo_position JSON 字段）、UploadSession（status 状态机 pending/completed/aborted）
- **新结构变更需同步 migration**（即使 synchronize:true 也要写 migration 脚本），详见 `backend/src/migrations/`

### 前端代理配置

`vite.config.ts` 中 `/api` 代理到 `localhost:3000`。文件上传走后端代理，浏览器不直连 MinIO。

### MinIO 启动方式

根目录 `package.json` 提供以下脚本（不依赖 docker-compose）：

```bash
pnpm minio:start   # 启动 MinIO（数据存 .minio-data/，控制台 http://localhost:9001）
pnpm minio:stop    # 跨平台杀 MinIO 进程
pnpm minio:status  # 检查 MinIO 状态
pnpm minio:reset   # 清理 .minio-data/ 数据
pnpm dev:infra     # 同时启动 MinIO + MySQL
pnpm dev:full      # 同时启动 MinIO + MySQL + 前后端
```

## 开发注意事项

### 文件读取
- 默认只读取用户指定文件，禁止递归扫描和全仓库搜索
- 单次最多读取 5 个文件，存在明确依赖链时可扩展至 8~10 个
- 允许读取直接依赖文件（最多一层 import 链）
- 禁止无目的批量扫描，不读取 node_modules、dist 目录，不分析无关依赖

### 作用域
- 仅修改用户要求内容，禁止主动重构、修复全局问题、修改无关代码
- 优先输出 diff，禁止生成 mock 实现
- 修改实体必须同步 migration

### 编码规范
- 所有注释和文档使用中文，注释只写功能相关的
- 后端 TypeScript 使用 `experimentalDecorators` + `emitDecoratorMetadata`（NestJS 装饰器模式）
- 前端 TypeScript 启用 `noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`（非 strict 模式），后端 `strictNullChecks` 和 `noImplicitAny` 均关闭

### 项目约定
- 后端 `.env` 文件配置数据库连接和文件上传服务
- 场景编辑器（`/scenes/:id/edit`）和全屏查看器（`/view/:sceneId`）是两个不同的页面，后者无导航栏
- 修改、新增、删除场景、模型、属性等配置时，需同步修改以下配置文件：

| 变更类型 | 需同步修改的配置文件 |
|---|---|
| 场景状态/属性 | `frontend/src/store/scene-store.ts`、`frontend/src/store/edit-store.ts`、`frontend/src/store/viewer-store.ts` |
| Geo 状态/标点/底图配置 | `frontend/src/store/geo-store.ts`、`frontend/src/types/geo-marker.ts`、`backend/src/geo-maps/entities/`、`backend/src/geo-maps/dto/geo-map.dto.ts`、`config.geo.*` 字段说明（`docs/api.md`） |
| 场景中模型的 geo_position 字段 | `backend/src/scenes/entities/scene-model.entity.ts`、`backend/src/scenes/dto/scene.dto.ts`、`backend/src/scenes/dto/geo-position.dto.ts` |
| iframe 通信协议 | `frontend/src/communication/protocol.ts`、`frontend/src/communication/message-bus.ts`、`frontend/src/communication/url-params.ts`、`frontend/tests/message-bus.test.ts`、`docs/api.md` 的 postMessage 段落（如有） |
| 前端路由/页面 | `frontend/src/RouterApp.tsx` |
| 后端实体字段 | `backend/src/<module>/entities/` 目录下对应实体文件 |
| 后端 DTO | `backend/src/<module>/dto/` 目录下对应 DTO 文件 |
| 后端模块注册 | `backend/src/app.module.ts` |
| 文档 | 详见下方「文档同步规则」表 |

### 文档同步规则

修改以下内容时，必须同步更新对应文档：

| 变更类型 | 需同步更新的文档 |
|---|---|
| 新增/修改/删除 API 端点 | `docs/api.md` |
| 新增/修改后端模块 | `docs/architecture.md` 后端目录结构 + AGENTS.md 模块表 |
| 新增/修改前端页面/路由 | `docs/architecture.md` 前端目录结构 + AGENTS.md 路由表 |
| 新增/修改前端 store | `docs/architecture.md` 前端目录结构 + AGENTS.md 状态说明 |
| 新增/修改前端插件 | `docs/architecture.md` 前端目录结构 + AGENTS.md 插件说明 |
| 新增/修改 Geo 标点/弹窗字段 | `frontend/src/types/geo-marker.ts` + `frontend/src/communication/protocol.ts` 的 `MarkerClickedPayload`/`GeoConfigPayload` + `docs/api.md` config.geo 字段表 |
| 修改 AGENTS.md 时 | 无需改 `CLAUDE.md`（它只是指向本文件的指针） |
| 技术栈版本变更 | AGENTS.md 技术栈表 + `docs/architecture.md` 技术栈表 |
| 环境变量变更 | `docs/deployment.md` + `backend/.env.example` |
| 部署方式变更 | `docs/deployment.md` |

### 设计 / 规划文档

- `docs/geo-improvement-plan.md` — Geo 模块迭代计划（标点、底图、iframe 嵌入相关需求与决策记录）

---

## 代码规范

前后端各有独立的代码规范文件，**所有新增/修改代码必须遵守**。规范文件中的规则优先级最高，与默认行为冲突时以规范为准。

- **后端规范**：`backend/BACKEND_CONVENTIONS.md` — 13 条强制规则（DTO 验证、异常处理、事务、路由顺序、安全约束等）+ 新增模块检查清单
- **前端规范**：`frontend/FRONTEND_CONVENTIONS.md` — 11 条强制规则（API 层、状态管理、组件、Three.js 集成、命名约定等）+ 新功能检查清单
