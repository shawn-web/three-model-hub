# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

ThreeMode 是一个全栈 3D 模型管理与查看平台，支持 GLB/GLTF 模型上传、场景组合、标注、测量、剖面和分享。pnpm monorepo 结构，前后端分离。

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

- **路由**: `frontend/src/RouterApp.tsx` — `/`（首页）、`/models`、`/scenes`、`/scenes/:id/edit`（场景编辑器）、`/view/:sceneId`（全屏查看器）、`/resources`、`/iframe`（iframe 嵌入查看器，无导航栏）
- **状态**: `frontend/src/store/` — `scene-store.ts`（3D 场景核心状态）、`viewer-store.ts`（查看器）、`edit-store.ts`（编辑器+undo/redo）、`theme-store.ts`
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
| Scenes | `/api/scenes` | 场景组合（模型/图片排列 + transform） |
| Viewpoints | `/api/scenes/:sceneId/viewpoints` | 相机视点保存（嵌套在场景下） |
| Annotations | `/api/scenes/:sceneId/annotations` | 模型标注（嵌套在场景下） |
| Sharing | `/api/share` | 场景分享（token 机制） |
| Upload | `/api/upload` | 文件上传（代理到外部文件服务，地址由 `FILE_SERVICE_URL` 环境变量配置） |
| Resources | `/api/resources` | 通用文件资源（含分组管理 `/groups`、图片代理 `/proxy-image`、文件上传 `/upload`） |
| Storage | （无独立路由） | 文件存储基础设施服务（被 Upload/Resources/Models 调用） |

共享目录：`common/`（全局异常过滤器、共享类型）、`types/`（Express 类型增强）

### 数据库

- TypeORM `synchronize: true`（开发环境自动同步，生产需 migration）
- `autoLoadEntities: true`
- 核心实体关系：Model → ModelVersion（一对多）、Scene → SceneModel（多对多，含 transform/material_overrides JSON 字段）

### 前端代理配置

`vite.config.ts` 中 `/api` 代理到 `localhost:3000`，`/hz-file-upload` 代理到外部文件服务，确保上传进度可追踪。

## 开发注意事项

- 所有注释和文档使用中文，注释只写功能相关的
- 后端 TypeScript 使用 `experimentalDecorators` + `emitDecoratorMetadata`（NestJS 装饰器模式）
- 前端 TypeScript 启用 `noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`（非 strict 模式），后端 `strictNullChecks` 和 `noImplicitAny` 均关闭
- 后端 `.env` 文件配置数据库连接和文件上传服务
- 场景编辑器（`/scenes/:id/edit`）和全屏查看器（`/view/:sceneId`）是两个不同的页面，后者无导航栏
- 修改、新增、删除场景、模型、属性等的配置的时候需要同步修改配置文件

### 文档同步规则

修改以下内容时，必须同步更新对应文档：

| 变更类型 | 需同步更新的文档 |
|---|---|
| 新增/修改/删除 API 端点 | `docs/api.md` |
| 新增/修改后端模块 | `docs/architecture.md` 后端目录结构 + CLAUDE.md 模块表 |
| 新增/修改前端页面/路由 | `docs/architecture.md` 前端目录结构 + CLAUDE.md 路由表 |
| 新增/修改前端 store | `docs/architecture.md` 前端目录结构 + CLAUDE.md 状态说明 |
| 新增/修改前端插件 | `docs/architecture.md` 前端目录结构 + CLAUDE.md 插件说明 |
| 技术栈版本变更 | CLAUDE.md 技术栈表 + `docs/architecture.md` 技术栈表 |
| 环境变量变更 | `docs/deployment.md` + `backend/.env.example` |
| 部署方式变更 | `docs/deployment.md` |

---

## 代码规范

前后端各有独立的代码规范文件，**所有新增/修改代码必须遵守**。规范文件中的规则优先级最高，与默认行为冲突时以规范为准。

- **后端规范**：`backend/BACKEND_CONVENTIONS.md` — 13 条强制规则（DTO 验证、异常处理、事务、路由顺序、安全约束等）+ 新增模块检查清单
- **前端规范**：`frontend/FRONTEND_CONVENTIONS.md` — 11 条强制规则（API 层、状态管理、组件、Three.js 集成、命名约定等）+ 新功能检查清单
