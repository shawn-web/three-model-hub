# 开发指南

## 开发环境搭建

### 1. 克隆项目

```bash
git clone <repo-url>
cd three-model-hub
```

### 2. 安装 pnpm（如未安装）

```bash
npm install -g pnpm
```

### 3. 安装依赖

```bash
# 根目录安装所有依赖（monorepo）
pnpm install
```

### 4. 配置数据库

确保 MySQL 运行，创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS three_model_hub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

配置 `backend/.env`（参考 `docs/deployment.md` 和 `backend/.env.example`）。

### 5. 启动开发服务

```bash
# 终端 1：后端
pnpm backend:dev

# 终端 2：前端
pnpm dev
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000/api

## 代码规范

### TypeScript
- 前端启用 `noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`
- 后端 `strictNullChecks` 和 `noImplicitAny` 关闭
- 所有新文件使用 TypeScript
- 避免使用 `any`，必要时添加注释说明

### 命名规范
- **文件名**：kebab-case（`edit-store.ts`）
- **组件名**：PascalCase（`SceneEditorPage`）
- **函数/变量**：camelCase
- **常量**：UPPER_SNAKE_CASE
- **类型/接口**：PascalCase

### 组件规范
- 使用函数组件 + Hook
- 状态管理使用 Zustand
- UI 使用 antd 组件库
- 图标使用 @ant-design/icons
- 不使用 emoji，统一使用 SVG 图标

### 注释规范
- 所有注释使用中文
- 函数注释说明用途，不需要说明实现细节
- 复杂逻辑添加行内注释

## 目录结构说明

```
three-model-hub/
├── backend/                # NestJS 后端
│   ├── src/
│   │   ├── models/         # 模型 CRUD
│   │   ├── scenes/         # 场景 CRUD
│   │   ├── sharing/        # 分享功能
│   │   ├── viewpoints/     # 视点保存
│   │   ├── annotations/    # 批注系统
│   │   ├── resources/      # 资源管理
│   │   ├── upload/         # 文件上传
│   │   ├── storage/        # 文件存储服务
│   │   ├── common/         # 共享工具
│   │   └── types/          # 类型增强
│   ├── test/               # e2e 测试
│   ├── .env                # 环境变量
│   └── .env.example        # 环境变量示例
├── frontend/               # React 前端
│   └── src/
│       ├── api/            # API 调用封装
│       ├── components/     # 可复用组件
│       ├── pages/          # 页面组件
│       ├── store/          # 状态管理
│       ├── core/           # 核心模块
│       ├── plugins/        # 查看器插件
│       ├── hooks/          # 自定义 Hook
│       ├── utils/          # 工具函数
│       ├── loaders/        # 模型加载器
│       ├── types/          # 类型定义
│       ├── communication/  # 通信协议
│       └── theme/          # 主题配置
├── docs/                   # 项目文档
└── docker-compose.yml      # Docker 配置
```

## 测试

### 后端测试

```bash
pnpm backend:test
```

e2e 测试文件：`backend/test/api.e2e-spec.ts`，覆盖所有 API 端点。

测试需要 MySQL 运行，会自动创建测试数据库表。

### 前端测试

```bash
cd frontend && pnpm test          # watch 模式
cd frontend && pnpm test:run      # 单次运行
```

### 前端构建验证

```bash
pnpm build
```

确保 TypeScript 编译和 Vite 构建无错误。

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动前端开发服务 |
| `pnpm build` | 构建前端生产版本 |
| `pnpm backend:dev` | 启动后端开发服务 |
| `pnpm dev:all` | 同时启动前后端开发服务 |
| `pnpm backend:test` | 运行后端测试 |
| `docker-compose up -d` | 启动 MySQL |

## 添加新功能指南

### 新增后端模块

1. 在 `backend/src/` 下创建模块目录
2. 创建 Entity、DTO、Service、Controller、Module
3. 在 `app.module.ts` 中注册新模块
4. 编写 e2e 测试
5. **同步更新文档**：`docs/api.md` + `docs/architecture.md` 后端目录结构 + CLAUDE.md 模块表

### 新增前端页面

1. 在 `frontend/src/pages/` 下创建页面组件
2. 在 `frontend/src/RouterApp.tsx` 中添加路由
3. 在导航栏中添加导航项（如需要）
4. 在 `frontend/src/api/` 下添加 API 调用函数
5. **同步更新文档**：`docs/architecture.md` 前端目录结构 + CLAUDE.md 路由表

### 新增查看器插件

1. 在 `frontend/src/plugins/` 下创建插件目录
2. 实现插件初始化和生命周期方法（参考 `plugins/types.ts` 中的 `ViewerPlugin` 接口）
3. 在插件管理器中注册插件
4. **同步更新文档**：`docs/architecture.md` 前端目录结构 + CLAUDE.md 插件说明

## 查看器插件列表

| 插件 | 目录 | 功能 |
|------|------|------|
| navigation | `plugins/navigation/` | 导航控制 |
| picking | `plugins/picking/` | 构件拾取 |
| measurement | `plugins/measurement/` | 测量工具 |
| section | `plugins/section/` | 剖面工具 |
| grid | `plugins/grid/` | 网格辅助 |
| auto-rotate | `plugins/auto-rotate/` | 自动旋转 |
| camera-info | `plugins/camera-info/` | 相机信息 |
| rotation-mode | `plugins/rotation-mode/` | 旋转模式 |
| screenshot | `plugins/screenshot/` | 截图工具 |
| view-cube | `plugins/view-cube/` | 视图方块 |
| transform-controls | `plugins/transform-controls/` | 变换控制器 |
| xray | `plugins/xray/` | 透视模式 |
