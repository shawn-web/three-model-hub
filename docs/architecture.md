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
│  ┌──────┴───────────────────────┴──────────────┐ │
│  │  Cesium.js（Geo 页面按需加载，WebGL 地球）    │ │
│  └──────────────────────────────────────────────┘ │
└─────────┼───────────────────────┼─────────────────┘
          │                       │
          ▼                       ▼
┌─────────────────┐    ┌──────────────────────┐
│  NestJS 后端     │    │  MinIO（本地对象存储） │
│  (localhost:3000) │    │  (文件上传/下载)       │
│  ├─ Models API   │    │  bucket=three-mode    │
│  ├─ GeoMaps API  │    │  端口 9000（数据）     │
│  ├─ Scenes API   │    │  端口 9001（控制台）   │
│  ├─ Sharing API  │    └──────────────────────┘
│  ├─ Viewpoints   │
│  ├─ Annotations  │
│  ├─ Resources    │
│  ├─ Upload       │  (分片上传管理 6 端点)
│  ├─ Storage      │  (文件代理下载 + 列表，/api/storage/:bucket/*)
│  └─ Minio        │  (基础设施，全局)
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
| MinIO | 8.x SDK | 对象存储（S3 兼容） |
| @nestjs/schedule | 6.x | 定时任务（清理孤儿 session） |
| Jest | 29.x | 测试框架 |

## 模块划分

### 前端目录结构

```
src/
├── api/                    # API 请求层
│   ├── client.ts           # axios 实例配置（5 分钟 GET 缓存）
│   ├── models.ts           # 模型相关 API
│   ├── scenes.ts           # 场景相关 API
│   ├── geo-maps.ts         # 地理地图相关 API
│   ├── annotations.ts      # 批注相关 API
│   ├── viewpoints.ts       # 视点相关 API
│   ├── upload.ts           # 分片上传核心 API（MinIO 8MB 分片 + 3 路并发 + 重试 + 断点续传）
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
│   ├── ViewerTree.tsx      # 查看器构件树
│   └── geo/                # Geo 页面组件（Cesium 地球）
│       ├── CesiumViewer.tsx    # Cesium 3D 地球视图（智能自动交互：点选/拖拽/放置/自动聚焦）
│       ├── GeoToolbar.tsx      # 底部工具栏（地图切换/定位/保存）
│       ├── GeoLocationPanel.tsx # 右侧面板（模型列表 + 坐标编辑 + 标点管理 + 主题弹窗）
│       ├── GeoModelLayer.tsx   # 模型实体图层（GLB → Cesium Entity，遵循 visibleFilter）
│       ├── GeoMarkerLayer.tsx  # 标点实体图层（Billboard，遵循 showMarkers）
│       ├── GeoMarkerPopup.tsx  # 标点弹窗（HTML overlay，popup/iframe/link）
│       └── GeoMarkerConfig.tsx # 标点配置 Modal
├── pages/                  # 页面组件
│   ├── HomePage.tsx        # 首页
│   ├── ModelsPage.tsx      # 模型管理
│   ├── ScenesPage.tsx      # 场景管理
│   ├── SceneEditorPage.tsx # 场景编辑
│   ├── ViewerPage.tsx      # 全屏查看器（无导航栏）
│   ├── IframePage.tsx      # iframe 嵌入查看器（无导航栏）
│   ├── MapsPage.tsx        # 地图管理列表
│   ├── GeoScenePage.tsx    # Geo 地球页面（Cesium 3D 地球，无导航栏）
│   └── ResourcesPage.tsx   # 资源管理
├── store/                  # 状态管理
│   ├── scene-store.ts      # 3D 场景核心状态
│   ├── edit-store.ts       # 编辑器状态（含 undo/redo）
│   ├── viewer-store.ts     # 查看器状态
│   ├── geo-store.ts        # Geo 页面状态：底图配置、可见/隐藏工具、可见/锁定模型、标点、弹窗
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
│   ├── multi-model-loader.ts  # 多模型加载
│   ├── geo-coords.ts       # 地理坐标转换（WGS84 ↔ 本地偏移）
│   ├── geo-focus.ts        # Geo 模型相机聚焦工具（"回到模型" 飞行逻辑）
│   ├── imagery-providers.ts # 地图底图厂商注册表（天地图/谷歌）
│   ├── glb-normal-fix.ts   # GLB 法线贴图移除（绕过 Cesium shader bug）
│   └── load-cesium.ts      # Cesium 动态加载 + shader 运行时补丁
├── loaders/                # 模型加载器
│   ├── glb-loader.ts       # GLB/GLTF 加载器
│   ├── loader-registry.ts  # 加载器注册表
│   └── types.ts            # 加载器接口定义
├── types/                  # 类型定义
│   ├── edit-data.ts        # 编辑数据类型
│   ├── plugin-config.ts    # 插件配置类型
│   ├── geo-marker.ts       # Geo 标点 / 弹窗 / 链接类型
│   ├── cesium-global.d.ts  # Cesium 全局 window 类型
│   ├── resource.ts         # 资源类型
│   └── upload.ts           # 上传类型：UploadOptions / UploadResult / BizType / CHUNK_SIZE
├── communication/          # 通信协议
│   ├── message-bus.ts      # iframe 消息总线
│   ├── protocol.ts         # 消息协议定义（含 GeoConfigPayload）
│   ├── url-params.ts       # URL 参数解析（含 Geo 页面 hiddenTools/showMarkers/visibleModelIds/camera）
│   └── parent-origin.ts    # 父页面 origin 工具（postMessage targetOrigin）
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
│   ├── dto/                # scene.dto.ts + geo-position.dto.ts
│   ├── scenes.controller.ts
│   ├── scenes.service.ts
│   └── scenes.module.ts
├── geo-maps/               # 地理地图模块（独立：模型地理定位 + 底图配置 + 标点）
│   ├── entities/           # GeoMap + GeoMapModel 实体
│   ├── dto/                # geo-map.dto.ts
│   ├── geo-maps.controller.ts
│   ├── geo-maps.service.ts
│   └── geo-maps.module.ts
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
├── upload/                 # 分片上传模块（6 端点：simple + multipart init/part/complete/abort/status）
│   ├── entities/           # UploadSession 实体（status 状态机）
│   ├── dto/                # InitMultipart / UploadPart / CompleteMultipart / Abort
│   ├── upload.controller.ts
│   ├── upload.service.ts          # 编排 MinioService + UploadSession
│   ├── upload-cleanup.service.ts # @nestjs/schedule 每日清理 24h+ pending session
│   └── upload.module.ts
├── storage/                # 文件存储服务（基础设施，封装 MinIO）
│   ├── storage.controller.ts     # GET /api/storage/:bucket（列表）/ :bucket/*（代理下载）
│   ├── storage.service.ts        # generateObjectKey / verifyObject / getPublicUrl / uploadFile / deleteFile
│   └── storage.module.ts
├── minio/                  # MinIO 基础设施模块（@Global()）
│   ├── minio.service.ts          # onModuleInit 自动检测/创建 bucket + 设 download 策略
│   └── minio.module.ts
├── migrations/             # TypeORM 迁移脚本
│   ├── 1700000001000-ExpandFileUrlLength.ts
│   └── 1700000002000-CreateUploadSession.ts
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
2. 前端按文件大小自动选择上传路径：
   - **< 8MB**：`POST /api/upload/simple`（一次性 multipart 上传）
   - **≥ 8MB**：`POST /api/upload/multipart/init` → N 次 `POST /api/upload/multipart/part` → `POST /api/upload/multipart/complete`（分片上传，支持断点续传）
3. 后端通过 `MinioService` 将文件写入 MinIO
4. 返回 `{ url: "/api/storage/three-mode/labs/...glb", fileKey, fileSize }` 给前端
5. 前端调 `POST /api/models/create` 传入 `{ file_url, file_key, file_size }` 创建模型记录
6. 模型预览/加载时，前端通过 `/api/storage/:bucket/*` 代理下载

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

### Geo 页面流程
1. 用户访问 `/maps/:id`，页面动态加载 Cesium.js（按需加载，不影响其他页面）
2. 创建 Cesium Viewer，初始化天地图/谷歌底图（支持卫星影像/路网矢量/地形切换）
3. 获取地图数据（后端在 `getMapData` 中先取 GeoMap + relations，再 `In(modelIds)` 批量预取 file_url/thumbnail_url，避免前端 N+1；并非真 SQL JOIN）
4. 从 `config.geo` 恢复所有持久化配置：底图厂商、底图类型、工具栏/面板可见性、视角、标点、锁定模型、可见模型白名单、隐藏工具、显示标点、白名单来源
5. 将有 `geo_position` 的模型加载为 Cesium Entity（GLB 预处理：移除法线贴图绕过 shader bug）
6. 智能自动交互：
   - 左键单击模型 → 选中（自动聚焦，等同于点击"回到模型"）
   - 左键双击模型 → 选中/取消选中（toggle）
   - 左键拖拽已选中模型 → 自动锁定地球相机 → 实时移动模型 → 释放后恢复地球
   - 左键单击空白 → 取消选中模型
   - 左键拖拽空白 → Cesium 默认旋转地球
   - 放置模式（未定位模型）→ 单击地图放置（从面板点击未定位模型触发）
   - 添加标点模式 → 单击地图放置新标点
   - 单击标点 → 触发 `triggerMarkerAction`：popup 弹窗 / iframe 嵌入 / link 跳转 / none 不响应
7. 坐标编辑面板支持精确调整经度/纬度/海拔/航向角/俯仰角/翻滚角/缩放
8. 保存时按分支选择 API：
   - 有模型坐标变更 → `PUT /api/geo-maps/:id/geo`（原子保存坐标 + 底图配置）
   - 纯配置变更（标点/底图/锁定/可见性等）→ `PUT /api/geo-maps/:id`（只更新 config.geo）
9. 主题：所有确认弹窗（清除定位、从地图移除）通过 `App.useApp().modal` 渲染，绑定 `ConfigProvider` 暗色主题
10. iframe 嵌入：通过 URL 参数或 postMessage 配置全部参数
    - URL 参数：`imagery`、`type`、`toolbar`、`panel`、`visibleModelIds`、`hiddenTools`、`showMarkers`、`allowedOrigins`、`camera`（JSON 字符串）
    - postMessage `geo-config`：覆盖底图运行时值（不持久化）、工具栏/面板可见性、隐藏工具、显示标点、视角、可见模型白名单
    - postMessage origin 校验：URL `?allowedOrigins=` 优先，其次使用 DB 中恢复的白名单
    - 未保存修改时关闭页面会弹出确认提示
11. 父页面消息：GeoReady / ModelsLoaded / ModelClicked / PositionChanged / Saved / MarkerClicked
    （MarkerClicked 复用 `MarkerClickedPayload` 协议字段）
