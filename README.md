# ThreeMode

ThreeMode 是一个全栈 3D 模型管理与查看平台，支持 GLB/GLTF 模型上传、场景组合、标注、测量、剖面和分享。

## 核心功能

- **模型管理**：GLB/GLTF 模型上传、版本控制、缩略图预览
- **场景编辑器**：多模型组合、变换编辑（位置/旋转/缩放）、材质覆盖、图片标注
- **3D 查看器**：基于 Three.js + React Three Fiber 的交互式渲染，支持 12 种插件（测量、剖面、透视、自动旋转等）
- **视点保存**：保存和恢复相机视角
- **批注系统**：在 3D 场景中添加文本批注
- **场景分享**：通过 Token 机制分享场景链接
- **资源管理**：通用文件资源分组管理，支持图片/视频预览
- **iframe 嵌入**：支持将查看器嵌入第三方页面，通过消息总线通信

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript 6 |
| 构建工具 | Vite 8 |
| 3D 渲染 | Three.js + React Three Fiber + Drei |
| UI 组件 | Ant Design 6 + Tailwind CSS |
| 状态管理 | Zustand（zundo 提供撤销/重做） |
| 后端框架 | NestJS 11 |
| 数据库 | MySQL 8.0 + TypeORM |
| 包管理 | pnpm workspaces |

## 快速开始

### 环境要求

- Node.js 20.x LTS
- pnpm 9.x
- MySQL 8.0

### 安装

```bash
# 克隆项目
git clone <repo-url>
cd threeMode

# 安装依赖
pnpm install
```

### 配置数据库

```bash
# 启动 MySQL（Docker）
docker-compose up -d

# 创建数据库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS three_mode CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

复制 `backend/.env.example` 为 `backend/.env` 并填写配置。

### 启动开发服务

```bash
# 方式一：同时启动前后端
pnpm dev:all

# 方式二：分别启动
pnpm backend:dev   # 后端 http://localhost:3000
pnpm dev           # 前端 http://localhost:5173
```

## 项目结构

```
threeMode/
├── frontend/          # React SPA（Vite）
│   ├── src/
│   │   ├── api/       # API 请求层
│   │   ├── components/# 可复用组件
│   │   ├── pages/     # 页面组件
│   │   ├── store/     # 状态管理
│   │   ├── core/      # 核心模块（插件管理器、查看器）
│   │   ├── plugins/   # 12 个查看器插件
│   │   ├── loaders/   # 模型加载器
│   │   ├── communication/ # iframe 通信协议
│   │   └── theme/     # 主题配置
│   └── tests/         # 单元测试（Vitest）
├── backend/           # NestJS API
│   ├── src/
│   │   ├── models/    # 模型管理
│   │   ├── scenes/    # 场景管理
│   │   ├── sharing/   # 分享功能
│   │   ├── viewpoints/# 视点保存
│   │   ├── annotations/ # 批注系统
│   │   ├── resources/ # 资源管理
│   │   ├── upload/    # 文件上传
│   │   └── storage/   # 文件存储服务
│   └── test/          # e2e 测试（Jest）
├── docs/              # 项目文档
│   ├── api.md         # API 文档
│   ├── architecture.md# 架构文档
│   ├── development.md # 开发指南
│   └── deployment.md  # 部署文档
├── docker-compose.yml # MySQL 开发环境
└── package.json       # 根目录脚本
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev:all` | 同时启动前后端开发服务 |
| `pnpm dev` | 启动前端开发服务 |
| `pnpm build` | 构建前端生产版本 |
| `pnpm backend:dev` | 启动后端开发服务 |
| `pnpm backend:test` | 运行后端测试 |
| `cd frontend && pnpm test:run` | 运行前端测试 |
| `docker-compose up -d` | 启动 MySQL 容器 |

## 文档

- [API 文档](docs/api.md) — 后端 API 接口详情
- [架构文档](docs/architecture.md) — 系统架构、模块划分、核心流程
- [开发指南](docs/development.md) — 环境搭建、代码规范、添加新功能
- [部署文档](docs/deployment.md) — 生产环境部署步骤

## 许可证

MIT
