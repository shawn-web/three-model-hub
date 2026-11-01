# 3D Model Viewer - Design Spec

## Context

需要一个独立的 3D 模型预览项目，通过 iframe 嵌入到其他页面中使用。主要场景是建筑模型预览，需要对标 BIMFace 等专业 BIM 查看器的核心功能。使用 Three.js + React Three Fiber + TypeScript 技术栈。

## Architecture: R3F + Plugin Module

采用插件模块架构，核心 Viewer 管理场景和渲染，每个功能工具作为独立插件注册。插件可被启用/禁用，工具栏根据已注册插件动态渲染。

## Project Structure

```
three-model-hub/
├── src/
│   ├── main.tsx                    # 入口
│   ├── App.tsx                     # 根组件
│   ├── core/                       # 核心层
│   │   ├── viewer.ts               # Viewer 核心类
│   │   ├── plugin-manager.ts       # 插件管理
│   │   └── scene-setup.ts          # 场景初始化
│   ├── communication/              # 通信层
│   │   ├── message-bus.ts          # postMessage 收发
│   │   ├── protocol.ts             # 消息类型定义
│   │   └── url-params.ts           # URL 参数解析
│   ├── plugins/                    # 插件目录
│   │   ├── types.ts                # 插件接口
│   │   ├── navigation/             # 导航插件
│   │   ├── picking/                # 拾取插件
│   │   ├── section/                # 剖切插件
│   │   ├── measurement/            # 测量插件
│   │   └── floor/                  # 楼层控制插件
│   ├── components/                 # UI 组件
│   │   ├── ViewerCanvas.tsx        # R3F Canvas
│   │   ├── Toolbar.tsx             # 工具栏
│   │   ├── ToolButton.tsx          # 工具按钮
│   │   └── EnvironmentSelector.tsx # 环境切换
│   ├── hooks/                      # React hooks
│   │   ├── useViewer.ts
│   │   ├── usePlugin.ts
│   │   └── useMessageBus.ts
│   ├── loaders/                    # 模型加载器
│   │   ├── loader-registry.ts      # 加载器注册表
│   │   ├── glb-loader.ts           # GLB 加载
│   │   └── types.ts                # 加载器接口
│   ├── store/
│   │   └── viewer-store.ts         # Zustand store
│   └── utils/
├── public/
│   ├── environments/               # 环境资源
│   └── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Communication Layer

### Message Format

```typescript
interface ViewerMessage {
  type: string;        // 消息类型
  payload: any;        // 数据
  requestId?: string;  // 请求-响应关联
}
```

### Initialization Flow

1. 父页面设置 iframe src，可带 query: `?modelUrl=xxx&tools=navigation,picking`
2. iframe 加载 → 解析 URL 参数 → 初始化核心 → 发送 `viewer-ready`
3. 父页面收到 ready 后通过 postMessage 调整配置

### Message Types

| Direction | Type | Description |
|-----------|------|-------------|
| Parent→iframe | `load-model` | `{ url, format? }` |
| Parent→iframe | `unload-model` | 卸载模型 |
| Parent→iframe | `set-environment` | `{ preset }` or `{ skybox, lighting }` |
| Parent→iframe | `tool-config` | `{ visible: [...], hidden: [...] }` |
| Parent→iframe | `tool-activate` | `{ toolId }` |
| Parent→iframe | `set-camera` | 设置相机 |
| Parent→iframe | `set-section` | 剖切参数 |
| iframe→Parent | `viewer-ready` | 初始化完成 |
| iframe→Parent | `model-loaded` | `{ metadata }` |
| iframe→Parent | `model-error` | 加载失败 |
| iframe→Parent | `pick-result` | `{ objectId, info }` |
| iframe→Parent | `tool-activated` | 工具已激活 |
| iframe→Parent | `progress` | 加载进度 |

MessageBus 内部使用发布/订阅模式分发消息，自带 origin 校验。

## Plugin System

### Plugin Interface

```typescript
interface ViewerPlugin {
  id: string;
  name: string;
  icon?: string;
  install(viewer: ViewerContext): void;
  uninstall(): void;
  activate(): void;
  deactivate(): void;
  toolbarComponent?: React.FC;
}
```

### Plugin Lifecycle

- `install`: 注册时调用，绑定事件、添加 Three.js 对象
- `activate`: 工具激活（如进入测量模式）
- `deactivate`: 工具停用
- `uninstall`: 卸载时清理所有资源

### Tool Plugins

**Navigation** (默认激活)
- OrbitControls 旋转/缩放/平移
- BoxZoom 框选放大
- fitToView 重置主视角

**Picking**
- Raycaster 点击检测
- 高亮选中构件（outline/变色）
- 输出构件信息
- 支持多选

**Section**
- 盒剖切 (ClipPlane 六面体)
- 轴向剖切 (X/Y/Z 轴拖拽)
- 拾取面剖切 (点击面对齐)
- Three.js ClippingPlanes 实现

**Measurement**
- 点到点距离
- 面积测量
- 标注线/标注文字

**Floor**
- 楼层列表 (从 metadata 或 postMessage 获取)
- 楼层隔离显示
- 剖面视图

## Toolbar

- 固定底部，水平排列 icon 按钮
- 分组：导航 | 拾取/测量 | 剖切 | 楼层
- 通过 `tool-config` 消息动态控制显示/隐藏
- 可折叠/隐藏
- 激活工具高亮状态

## Environment System

- 内置预设：晴天、阴天、黄昏、纯白背景
- 每个预设：天空盒/背景色 + 环境光 + 方向光 + 地面
- postMessage 可切换预设或自定义参数
- 使用 drei `Environment` + `EnvironmentMap`
- 地面：阴影接收面 / 网格辅助线 / 无

## Model Loading

- 通过 URL 加载，避免 postMessage 传输大文件
- LoaderRegistry 注册表模式，支持扩展
- 当前实现 GLB 加载器
- 加载进度通过 postMessage 回传

## Tech Stack

- React + TypeScript
- React Three Fiber (R3F)
- @react-three/drei
- Zustand (状态管理)
- Vite (构建)
- Three.js
