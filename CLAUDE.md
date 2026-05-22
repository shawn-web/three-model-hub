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

- **路由**: `frontend/src/RouterApp.tsx` — `/`（首页）、`/models`、`/scenes`、`/scenes/:id/edit`（场景编辑器）、`/view/:sceneId`（全屏查看器）、`/resources`
- **状态**: `frontend/src/store/` — `viewer-store.ts`（查看器）、`edit-store.ts`（编辑器+undo/redo）、`theme-store.ts`
- **API 层**: `frontend/src/api/client.ts`（Axios 实例 + GET 请求 5 分钟缓存）
- **3D 插件**: `frontend/src/plugins/` — measurement（测量）、navigation（导航）、picking（拾取）、section（剖面）
- **模型加载**: `frontend/src/loaders/glb-loader.ts`、`frontend/src/utils/multi-model-loader.ts`
- **通信**: `frontend/src/communication/` — iframe 嵌入时的消息总线

### 后端模块结构

NestJS 模块化组织，每个业务模块包含 `entities/`、`dto/`、`*.service.ts`、`*.controller.ts`：

| 模块 | 路径前缀 | 功能 |
|---|---|---|
| Models | `/api/models` | 模型 CRUD + 版本管理 |
| Scenes | `/api/scenes` | 场景组合（模型排列 + transform） |
| Viewpoints | `/api/viewpoints` | 相机视点保存 |
| Annotations | `/api/annotations` | 模型标注 |
| Sharing | `/api/share` | 场景分享（token 机制） |
| Upload | `/api/upload` | 文件上传（代理到外部文件服务 api.1357.cn） |
| Resources | `/api/resources` | 通用文件资源 |

### 数据库

- TypeORM `synchronize: true`（开发环境自动同步，生产需 migration）
- `autoLoadEntities: true`
- 核心实体关系：Model → ModelVersion（一对多）、Scene → SceneModel（多对多，含 transform/material_overrides JSON 字段）

### 前端代理配置

`vite.config.ts` 中 `/api` 代理到 `localhost:3000`，`/hz-file-upload` 代理到外部文件服务，确保上传进度可追踪。

## 开发注意事项

- 所有注释和文档使用中文，注释只写功能相关的
- 后端 TypeScript 使用 `experimentalDecorators` + `emitDecoratorMetadata`（NestJS 装饰器模式）
- 前端 TypeScript 严格模式，后端 `strictNullChecks` 和 `noImplicitAny` 均关闭
- 后端 `.env` 文件配置数据库连接和文件上传服务
- 场景编辑器（`/scenes/:id/edit`）和全屏查看器（`/view/:sceneId`）是两个不同的页面，后者无导航栏
- 修改、新增、删除场景、模型、属性等的配置的时候需要同步修改配置文件
