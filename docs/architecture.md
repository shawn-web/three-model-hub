# 架构文档

## 整体架构

```
┌──────────────────────────────────────────────────┐
│                   浏览器                          │
│  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  React SPA   │  │  Three.js / R3F 渲染器    │  │
│  │  (antd UI)   │  │  (WebGL Canvas)           │  │
│  └──────┬───────┘  └────────────┬──────────────┘  │
│         │                       │                 │
│         │  API 请求 (axios)     │  模型文件加载    │
└─────────┼───────────────────────┼─────────────────┘
          │                       │
          ▼                       ▼
┌─────────────────┐    ┌──────────────────────┐
│  NestJS 后端     │    │  外部文件服务          │
│  (localhost:3000) │    │  (文件上传/下载)       │
│  ├─ Models API   │    └──────────────────────┘
│  ├─ Scenes API   │
│  ├─ Sharing API  │
│  ├─ Viewpoints   │
│  └─ Annotations  │
└────────┬────────┘
         │ TypeORM
         ▼
┌─────────────────┐
│   MySQL 8.0     │
│  (three_mode)   │
└─────────────────┘
```

## 技术栈

### 前端
| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 构建工具 |
| Three.js | 0.170+ | 3D 渲染 |
| React Three Fiber | 8.x | React 的 Three.js 封装 |
| antd | 5.x | UI 组件库 |
| @ant-design/icons | 5.x | SVG 图标 |
| Zustand | 4.x | 状态管理 |
| zundo | 2.x | 撤销/重做中间件 |
| React Router | 6.x | 路由 |
| axios | 1.x | HTTP 客户端 |

### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| NestJS | 10.x | 服务端框架 |
| TypeORM | 0.3.x | ORM |
| MySQL2 | 3.x | MySQL 驱动 |
| Jest | 29.x | 测试框架 |

## 模块划分

### 前端目录结构

```
src/
├── api/                    # API 请求层
│   ├── client.ts           # axios 实例配置
│   ├── models.ts           # 模型相关 API
│   ├── scenes.ts           # 场景相关 API
│   ├── viewpoints.ts       # 视点相关 API
│   └── annotations.ts      # 批注相关 API
├── components/             # 通用组件
│   ├── Layout.tsx          # 页面布局（导航栏 + 主题切换）
│   ├── Toolbar.tsx         # 查看器工具栏
│   ├── ViewerCanvas.tsx    # 查看器 Canvas
│   ├── EditCanvas.tsx      # 编辑器 Canvas
│   ├── EditPanel.tsx       # 编辑面板
│   ├── EditToolbar.tsx     # 编辑器工具栏
│   ├── EditSceneSetup.tsx  # 编辑场景配置
│   ├── ComponentTree.tsx   # 构件树
│   ├── PropertyEditor.tsx  # 属性编辑器
│   └── PluginScene.tsx     # 插件场景
├── pages/                  # 页面组件
│   ├── HomePage.tsx        # 首页
│   ├── ModelsPage.tsx      # 模型管理
│   ├── ScenesPage.tsx      # 场景管理
│   ├── SceneEditorPage.tsx # 场景编辑
│   └── ViewerPage.tsx      # 模型查看器
├── store/                  # 状态管理
│   ├── edit-store.ts       # 编辑器状态
│   ├── viewer-store.ts     # 查看器状态
│   └── theme-store.ts      # 主题状态
├── core/                   # 核心模块
│   ├── scene-setup.tsx     # 场景初始化
│   └── plugin-manager.ts   # 插件管理器
├── plugins/                # 插件
│   ├── section/            # 剖面工具
│   ├── measurement/        # 测量工具
│   └── picking/            # 拾取工具
├── hooks/                  # 自定义 Hook
├── utils/                  # 工具函数
│   ├── edit-apply.ts       # 编辑数据应用
│   ├── edit-save.ts        # 编辑数据保存
│   ├── screenshot.ts       # 截图工具
│   └── display-mode.ts     # 显示模式切换
├── theme/                  # 主题配置
│   └── index.ts            # antd 主题配置
├── loaders/                # 模型加载器
├── types/                  # 类型定义
├── communication/          # 通信协议
├── RouterApp.tsx           # 路由配置
└── main.tsx                # 入口文件
```

### 后端目录结构

```
backend/src/
├── models/                 # 模型管理模块
│   ├── entities/           # Model + ModelVersion 实体
│   ├── dto/                # 数据传输对象
│   ├── models.controller.ts
│   ├── models.service.ts
│   └── models.module.ts
├── scenes/                 # 场景管理模块
│   ├── entities/           # Scene + SceneModel 实体
│   ├── dto/
│   ├── scenes.controller.ts
│   ├── scenes.service.ts
│   └── scenes.module.ts
├── sharing/                # 分享模块
│   ├── entities/           # ShareLink 实体
│   ├── dto/
│   ├── sharing.controller.ts
│   ├── sharing.service.ts
│   └── sharing.module.ts
├── viewpoints/             # 视点模块
│   ├── entities/           # Viewpoint 实体
│   ├── dto/
│   ├── viewpoints.controller.ts
│   ├── viewpoints.service.ts
│   └── viewpoints.module.ts
├── annotations/            # 批注模块
│   ├── entities/           # Annotation 实体
│   ├── dto/
│   ├── annotations.controller.ts
│   ├── annotations.service.ts
│   └── annotations.module.ts
├── storage/                # 文件存储服务
│   └── storage.service.ts
├── app.module.ts           # 根模块
└── main.ts                 # 入口文件
```

## 核心流程

### 模型上传流程
1. 用户在前端选择 GLB/GLTF 文件
2. 前端将文件上传到后端 `POST /api/models/upload`
3. 后端将文件转发到外部文件服务
4. 外部服务返回文件 URL
5. 后端保存模型记录到数据库（含 file_url）
6. 返回模型信息给前端

### 场景查看流程
1. 用户访问 `/view/:sceneId`
2. 前端调用 `GET /api/scenes/:id/data` 获取场景数据
3. 获取场景关联的所有模型信息
4. 为每个模型加载 GLB 文件
5. 应用各自的 transform（位置/旋转/缩放）
6. 初始化 Three.js 场景和插件

### 编辑流程
1. 用户在场景编辑页选择构件
2. 编辑面板显示属性（位置/旋转/缩放/材质/可见性）
3. 修改属性 → 直接更新 Three.js 对象 → 保存到 Zustand store
4. 支持撤销/重做（Ctrl+Z / Ctrl+Y）
5. 保存时导出编辑数据为 JSON
