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
│  ├─ Annotations  │
│  ├─ Resources    │
│  ├─ Upload       │
│  └─ Storage      │
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
| React | 19.x | UI 框架 |
| TypeScript | 6.x | 类型安全 |
| Vite | 8.x | 构建工具 |
| Three.js | 0.184+ | 3D 渲染 |
| React Three Fiber | 9.x | React 的 Three.js 封装 |
| @react-three/drei | 10.x | R3F 辅助工具集 |
| antd | 6.x | UI 组件库 |
| @ant-design/icons | 6.x | SVG 图标 |
| Zustand | 5.x | 状态管理 |
| zundo | 2.x | 撤销/重做中间件 |
| React Router | 7.x | 路由 |
| axios | 1.x | HTTP 客户端 |
| Tailwind CSS | 3.x | 原子化 CSS |

### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| NestJS | 11.x | 服务端框架 |
| TypeORM | 0.3.x | ORM |
| MySQL2 | 3.x | MySQL 驱动 |
| Jest | 29.x | 测试框架 |

## 模块划分

### 前端目录结构

```
src/
├── api/                    # API 请求层
│   ├── client.ts           # axios 实例配置（5 分钟 GET 缓存）
│   ├── models.ts           # 模型相关 API
│   ├── scenes.ts           # 场景相关 API
│   ├── annotations.ts      # 批注相关 API
│   ├── viewpoints.ts       # 视点相关 API
│   ├── upload.ts           # 通用文件上传 API
│   └── resources.ts        # 资源管理 API
├── components/             # 通用组件
│   ├── Layout.tsx          # 页面布局（导航栏 + 主题切换）
│   ├── CameraInfo.tsx      # 相机信息面板
│   ├── ComponentProperties.tsx # 构件属性面板
│   ├── EditCanvas.tsx      # 编辑器 Canvas
│   ├── EditPanel.tsx       # 编辑面板
│   ├── Icons.tsx           # SVG 图标组件
│   ├── MarkerConfigPanel.tsx # 标注配置面板
│   ├── MarkerSpriteShared.tsx # 标注精灵共享逻辑
│   ├── ResourcePicker.tsx  # 资源选择器
│   ├── SceneImagePanel.tsx # 场景图片面板
│   ├── SceneImageSprite.tsx # 场景图片精灵
│   ├── SceneSettings.tsx   # 场景设置
│   ├── SceneSetup.tsx      # 场景初始化配置
│   ├── SceneTree.tsx       # 场景树
│   ├── ViewerCanvas.tsx    # 查看器 Canvas
│   └── ViewerTree.tsx      # 查看器构件树
├── pages/                  # 页面组件
│   ├── HomePage.tsx        # 首页
│   ├── ModelsPage.tsx      # 模型管理
│   ├── ScenesPage.tsx      # 场景管理
│   ├── SceneEditorPage.tsx # 场景编辑
│   ├── ViewerPage.tsx      # 全屏查看器（无导航栏）
│   ├── IframePage.tsx      # iframe 嵌入查看器（无导航栏）
│   └── ResourcesPage.tsx   # 资源管理
├── store/                  # 状态管理
│   ├── scene-store.ts      # 3D 场景核心状态
│   ├── edit-store.ts       # 编辑器状态（含 undo/redo）
│   ├── viewer-store.ts     # 查看器状态
│   └── theme-store.ts      # 主题状态
├── core/                   # 核心模块
│   ├── plugin-manager.ts   # 插件管理器
│   └── viewer.ts           # 查看器上下文工厂
├── plugins/                # 查看器插件（12 个）
│   ├── measurement/        # 测量工具
│   ├── navigation/         # 导航控制
│   ├── picking/            # 构件拾取
│   ├── section/            # 剖面工具
│   ├── grid/               # 网格辅助
│   ├── auto-rotate/        # 自动旋转
│   ├── camera-info/        # 相机信息
│   ├── rotation-mode/      # 旋转模式
│   ├── screenshot/         # 截图工具
│   ├── view-cube/          # 视图方块
│   ├── transform-controls/ # 变换控制器
│   ├── xray/               # 透视模式
│   └── types.ts            # 插件接口定义
├── hooks/                  # 自定义 Hook
│   ├── useMessageBus.ts    # 消息总线 Hook
│   ├── usePlugin.ts        # 插件 Hook
│   └── useViewer.ts        # 查看器 Hook
├── utils/                  # 工具函数
│   ├── edit-apply.ts       # 编辑数据应用到 Three.js
│   ├── edit-save.ts        # 编辑数据保存
│   ├── screenshot.ts       # 截图工具
│   ├── marker-defaults.ts  # 标注默认值
│   ├── lighting.ts         # 光照配置
│   ├── fit-to-view.ts      # 自适应视角
│   ├── scene-config.ts     # 场景配置
│   ├── selection-highlight.ts # 选中高亮
│   └── multi-model-loader.ts  # 多模型加载
├── loaders/                # 模型加载器
│   ├── glb-loader.ts       # GLB/GLTF 加载器
│   ├── loader-registry.ts  # 加载器注册表
│   └── types.ts            # 加载器接口定义
├── types/                  # 类型定义
│   ├── edit-data.ts        # 编辑数据类型
│   ├── plugin-config.ts    # 插件配置类型
│   └── resource.ts         # 资源类型
├── communication/          # 通信协议
│   ├── message-bus.ts      # iframe 消息总线
│   ├── protocol.ts         # 消息协议定义
│   └── url-params.ts       # URL 参数解析
├── theme/                  # 主题配置
│   └── index.ts            # antd 明暗主题配置
├── assets/                 # 静态资源
│   └── scene-config.js     # 运行时场景配置
├── RouterApp.tsx           # 路由配置
└── main.tsx                # 入口文件
```

### 后端目录结构

```
backend/src/
├── models/                 # 模型管理模块
│   ├── entities/           # Model + ModelVersion 实体
│   ├── dto/
│   ├── models.controller.ts
│   ├── models.service.ts
│   └── models.module.ts
├── scenes/                 # 场景管理模块
│   ├── entities/           # Scene + SceneModel + SceneImage 实体
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
├── viewpoints/             # 视点模块（嵌套在场景路由下）
│   ├── entities/           # Viewpoint 实体
│   ├── dto/
│   ├── viewpoints.controller.ts
│   ├── viewpoints.service.ts
│   └── viewpoints.module.ts
├── annotations/            # 批注模块（嵌套在场景路由下）
│   ├── entities/           # Annotation 实体
│   ├── dto/
│   ├── annotations.controller.ts
│   ├── annotations.service.ts
│   └── annotations.module.ts
├── resources/              # 资源管理模块
│   ├── entities/           # Resource + ResourceGroup 实体
│   ├── dto/
│   ├── resources.controller.ts
│   ├── resources.service.ts
│   └── resources.module.ts
├── upload/                 # 文件上传模块（轻量，无 entities/dto）
│   ├── upload.controller.ts
│   ├── upload.service.ts
│   └── upload.module.ts
├── storage/                # 文件存储服务（基础设施，无 controller/dto/entities）
│   ├── storage.service.ts
│   └── storage.module.ts
├── common/                 # 共享工具
│   ├── exception-filter.ts # 全局异常过滤器
│   └── types.ts            # 共享类型（MulterFile）
├── types/                  # Express 类型增强
│   └── express.d.ts
├── app.module.ts           # 根模块
└── main.ts                 # 入口文件
```

## 核心流程

### 模型上传流程
1. 用户在前端选择 GLB/GLTF 文件
2. 前端将文件上传到后端 `POST /api/models/upload`
3. 后端通过 `StorageService` 将文件转发到外部文件服务
4. 外部服务返回文件 URL
5. 后端保存模型记录到数据库（含 file_url）
6. 返回模型信息给前端

### 场景查看流程
1. 用户访问 `/view/:sceneId` 或 `/iframe`
2. 前端调用 `GET /api/scenes/:id/data` 获取场景数据
3. 获取场景关联的所有模型和图片信息
4. 为每个模型加载 GLB 文件
5. 应用各自的 transform（位置/旋转/缩放）
6. 初始化 Three.js 场景和插件

### 编辑流程
1. 用户在场景编辑页选择构件
2. 编辑面板显示属性（位置/旋转/缩放/材质/可见性）
3. 修改属性 → 直接更新 Three.js 对象 → 保存到 Zustand store
4. 支持撤销/重做（Ctrl+Z / Ctrl+Y）
5. 保存时导出编辑数据为 JSON
