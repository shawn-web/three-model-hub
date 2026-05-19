# 开发指南

## 开发环境搭建

### 1. 克隆项目

```bash
git clone <repo-url>
cd threeMode
```

### 2. 安装依赖

```bash
# 前端
npm install

# 后端
cd backend && npm install && cd ..
```

### 3. 配置数据库

确保 MySQL 运行，创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS three_mode
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

配置 `backend/.env`（参考 `docs/deployment.md`）。

### 4. 启动开发服务

```bash
# 终端 1：后端
cd backend && npm run start:dev

# 终端 2：前端
npm run dev
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000/api

## 代码规范

### TypeScript
- 严格模式开启
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
threeMode/
├── backend/                # NestJS 后端
│   ├── src/
│   │   ├── models/         # 模型 CRUD
│   │   ├── scenes/         # 场景 CRUD
│   │   ├── sharing/        # 分享功能
│   │   ├── viewpoints/     # 视点保存
│   │   ├── annotations/    # 批注系统
│   │   └── storage/        # 文件上传服务
│   ├── test/               # e2e 测试
│   └── .env                # 环境变量
├── src/                    # React 前端
│   ├── api/                # API 调用封装
│   ├── components/         # 可复用组件
│   ├── pages/              # 页面组件
│   ├── store/              # 状态管理
│   ├── utils/              # 工具函数
│   ├── hooks/              # 自定义 Hook
│   ├── core/               # 核心模块
│   ├── plugins/            # 查看器插件
│   ├── theme/              # 主题配置
│   └── types/              # 类型定义
├── public/                 # 静态资源
├── docs/                   # 项目文档
└── docker-compose.yml      # Docker 配置
```

## 测试

### 后端测试

```bash
cd backend
npm test
```

e2e 测试文件：`backend/test/api.e2e-spec.ts`，覆盖所有 API 端点。

测试需要 MySQL 运行，会自动创建测试数据库表。

### 前端构建验证

```bash
npm run build
```

确保 TypeScript 编译和 Vite 构建无错误。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动前端开发服务 |
| `npm run build` | 构建前端生产版本 |
| `npm run preview` | 预览构建结果 |
| `cd backend && npm run start:dev` | 启动后端开发服务 |
| `cd backend && npm run build` | 构建后端 |
| `cd backend && npm test` | 运行后端测试 |

## 添加新功能指南

### 新增后端模块

1. 在 `backend/src/` 下创建模块目录
2. 创建 Entity、DTO、Service、Controller、Module
3. 在 `app.module.ts` 中注册新模块
4. 编写 e2e 测试

### 新增前端页面

1. 在 `src/pages/` 下创建页面组件
2. 在 `src/RouterApp.tsx` 中添加路由
3. 在 `src/components/Layout.tsx` 中添加导航项（如需要）
4. 在 `src/api/` 下添加 API 调用函数

### 新增查看器插件

1. 在 `src/plugins/` 下创建插件目录
2. 实现插件初始化和生命周期方法
3. 在 `src/components/PluginScene.tsx` 中注册插件
4. 在 `src/components/Toolbar.tsx` 中添加工具栏按钮
