# 前端代码规范（强制）

以下规范基于代码审查整理，所有新增/修改的前端代码必须遵守。本文件中的规则优先级最高，与默认行为冲突时以此为准。

---

## 1. API 层 (`src/api/`)

### 1.1 每个 API 函数必须声明显式返回类型

```typescript
// 正确 ✓
export async function getAnnotations(sceneId: string): Promise<AnnotationData[]> {
  const { data } = await apiClient.get(`/scenes/${sceneId}/annotations`)
  return data
}

// 禁止 ✗ — 返回类型为 any，无编译器保护
export async function getModels(params?: { ... }) {
  const { data } = await apiClient.get('/models', { params })
  return data
}
```

### 1.2 API 响应类型必须定义在 `src/types/` 中

禁止在 API 文件中内联定义接口。类型集中管理，API 文件从 `../types/` 导入。

```
src/types/
├── resource.ts      # ResourceItem, ResourceGroup（已存在）
├── edit-data.ts     # ComponentEdit, MarkerData, SceneMedia（已存在）
└── plugin-config.ts # PluginConfig（已存在）
```

> **技术债务**：`annotation.ts`、`viewpoint.ts`、`model.ts`、`scene.ts` 尚未创建，相关类型目前仍内联在 `src/api/annotations.ts`、`src/api/viewpoints.ts` 等文件中。新增类型时应按规范提取到 `src/types/`。

### 1.3 禁止使用 `as` 类型断言处理 API 返回值

```typescript
// 正确 ✓ — 函数签名声明返回类型
export async function uploadResource(...): Promise<ResourceItem> {
  const { data } = await apiClient.post(...)
  return data
}

// 禁止 ✗ — 不安全的 as 断言
export async function uploadResource(...) {
  const { data } = await apiClient.post(...)
  return data as ResourceItem
}
```

### 1.4 禁止使用 `Record<string, unknown>` 替代实际类型

`scene_config`、`transform`、`material_overrides` 等字段已有明确的类型定义（在 `types/` 中），不得用 `Record<string, unknown>` 或 `JsonConfig` 等别名逃避类型检查。

### 1.5 写操作后必须清除相关 GET 缓存

```typescript
import apiClient, { invalidateHttpCache } from './client'

export async function createScene(dto: CreateSceneParams) {
  const { data } = await apiClient.post('/scenes', dto)
  invalidateHttpCache('/scenes')   // 必须清除
  return data
}
```

任何执行 POST/PUT/PATCH/DELETE 的 API 函数，都必须对相关的 GET 路径调用 `invalidateHttpCache`。

### 1.6 前端发送的请求体必须与后端 DTO 格式一致

后端 annotation DTO 已改为扁平字段（`x/y/z`），前端 API 必须同步：

```typescript
// 正确 ✓ — 与后端 CreateAnnotationDto 一致
await apiClient.post(`/scenes/${sceneId}/annotations`, {
  x: position.x,
  y: position.y,
  z: position.z,
  text,
  author,
})

// 禁止 ✗ — 后端已不接受嵌套对象
await apiClient.post(`/scenes/${sceneId}/annotations`, {
  position: { x, y, z },
  text,
})
```

---

## 2. 状态管理 (`src/store/`)

### 2.1 禁止跨 store 重复状态字段

四个 store 之间存在大量重复字段。单一数据源原则：

| 状态 | 归属 store | 说明 |
|---|---|---|
| `modelUrl`, `modelObject`, `modelLoading` | `scene-store` | 3D 场景核心状态 |
| `selectedComponentId`, `xrayMode` | `scene-store` | 场景交互状态 |
| `markers`, `sceneImages` | `scene-store` | 场景内容 |
| `getCameraState`, `setCameraState`, `fitToViewFn` | `scene-store` | 相机回调 |
| `isDirty`, `editData`, `transformMode` | `edit-store` | 编辑器专属 |
| `backgroundConfig`, `ambientIntensity`, `lightIntensity` | `edit-store` | 编辑器配置 |
| `activePluginId`, `installedPlugins`, `toolbarVisible` | `viewer-store` | 查看器 UI |
| `viewerType`, `sceneId` | `viewer-store` | 查看器元数据 |

> **技术债务**：当前 `modelUrl`、`modelObject`、`selectedComponentId`、`xrayMode`、`markers`、`sceneImages`、相机回调方法在 `scene-store`、`viewer-store`、`edit-store` 三个 store 中均有副本。新代码应遵循上表的归属规则，从 `scene-store` 读取共享状态。

`edit-store` 和 `viewer-store` 需要的共享状态从 `scene-store` 读取，不再各自重复一份。

### 2.2 禁止在 store 操作中直接修改其他 store

```typescript
// 禁止 ✗ — 跨 store 副作用
selectComponent: (id) => {
  set({ selectedComponentId: id })
  useSceneStore.getState().selectComponent(id)  // 隐式耦合
}

// 正确 ✓ — 页面/组件层面协调
function handleSelect(id: string) {
  useEditStore.getState().selectComponent(id)
  useSceneStore.getState().selectComponent(id)
}
```

### 2.3 Store 文件不超过 300 行

超过时按领域边界拆分。例如 `edit-store.ts` 可拆分为核心编辑状态和场景设置状态。

### 2.4 Store 操作命名规范

| 操作类型 | 命名模式 | 示例 |
|---|---|---|
| 设置单字段 | `set{Field}` | `setModelUrl`、`setXrayMode` |
| 数组操作 | `add{Item}` / `remove{Item}` / `update{Item}` | `addMarker`、`removeSceneImage` |
| 重置状态 | `reset{Name}` | `resetEdit`、`resetScene` |
| 语义选择 | `select{Thing}` | `selectComponent` |

---

## 3. 组件 (`src/components/`)

### 3.1 Props 必须定义为命名接口

```typescript
// 正确 ✓
interface ToolbarProps {
  pluginManager: PluginManager
  onFitView?: () => void
}
export function Toolbar({ pluginManager, onFitView }: ToolbarProps) { ... }

// 禁止 ✗ — 内联对象类型
export function Toolbar({ pluginManager }: { pluginManager: PluginManager }) { ... }
```

### 3.2 页面组件不超过 500 行

超出时提取自定义 hooks 和子组件：

```typescript
// 从 SceneEditorPage 提取
function useSceneEditor(sceneId: string) { ... }   // 加载/保存逻辑
function AddModelModal(props: AddModelModalProps) { ... }  // 添加模型弹窗
```

### 3.3 使用命名导出，禁止默认导出

```typescript
// 正确 ✓
export function HomePage() { ... }
export function ToolButton(props: ToolButtonProps) { ... }

// 禁止 ✗
export default function HomePage() { ... }
```

---

## 4. 类型安全 (`src/types/`)

### 4.1 禁止 `as any` 和 `any`

不允许出现 `any` 类型。需要灵活类型时用 `unknown` 并配合类型守卫。

### 4.2 禁止本地类型遮蔽导入类型

```typescript
// 禁止 ✗ — 本地 MarkerData 遮蔽 types/edit-data.ts 中的完整定义
interface MarkerData {
  id: string
  [key: string]: unknown   // 完全丧失类型安全
}

// 正确 ✓ — 导入已有的完整类型
import type { MarkerData } from '../types/edit-data'
```

### 4.3 页面级的 API 响应类型移到 `src/types/`

`SceneDataResp`、`SceneModelEntry` 等在页面中定义的类型，如果被多处使用，应提取到 `src/types/` 中。

---

## 5. Three.js / R3F 集成

### 5.1 材质克隆必须配对 dispose

```typescript
// 克隆时保存引用
const clonedMaterial = originalMaterial.clone()
clonedMaterial.emissive.set(0x00ffff)

// 清理时必须 dispose
useEffect(() => {
  return () => {
    clonedMaterial.dispose()    // 防止 GPU 内存泄漏
  }
}, [])
```

参考实现：`src/utils/selection-highlight.ts` 的 `SelectionHighlightManager`。

### 5.2 Three.js 对象引用用 useRef，不放渲染依赖

```typescript
// 正确 ✓ — useRef 存储后再在 effect 中使用
const cameraRef = useRef<THREE.Camera>()
const { camera } = useThree()
cameraRef.current = camera

useEffect(() => {
  if (!cameraRef.current) return
  // 使用 cameraRef.current
}, [依赖状态])

// 禁止 ✗ — 直接把 useThree() 返回值放入依赖数组
useEffect(() => {
  // camera 每帧都变，导致 effect 无限触发
}, [camera])
```

### 5.3 缓存模型必须用 SkeletonUtils.clone

从缓存加载的模型不得直接使用引用，必须深拷贝以确保材质和变换独立：

```typescript
// 正确 ✓ — multi-model-loader.ts 的模式
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
const clonedScene = SkeletonUtils.clone(cachedScene)
```

### 5.4 事件处理函数必须保持 this 绑定

插件类中作为事件监听器的方法必须用箭头函数：

```typescript
// 正确 ✓
class PickingPlugin {
  handleClick = (event: MouseEvent) => { /* this 正确 */ }
}

// 禁止 ✗ — this 丢失
class PickingPlugin {
  handleClick(event: MouseEvent) { /* this 可能是 undefined */ }
}
```

---

## 6. 插件系统 (`src/plugins/`)

### 插件列表（12 个）

| 插件 | 目录 | group | 功能 |
|---|---|---|---|
| NavigationPlugin | `navigation/` | navigation | 导航控制 |
| PickingPlugin | `picking/` | picking | 构件拾取 |
| MeasurementPlugin | `measurement/` | measurement | 测量工具 |
| SectionPlugin | `section/` | section | 剖面工具 |
| GridPlugin | `grid/` | display | 网格辅助 |
| AutoRotatePlugin | `auto-rotate/` | display | 自动旋转 |
| CameraInfoPlugin | `camera-info/` | display | 相机信息 |
| RotationModePlugin | `rotation-mode/` | interaction | 旋转模式 |
| ScreenshotPlugin | `screenshot/` | tool | 截图工具 |
| ViewCubePlugin | `view-cube/` | display | 视图方块 |
| TransformControlsPlugin | `transform-controls/` | interaction | 变换控制器 |
| XRayPlugin | `xray/` | display | 透视模式 |

### 6.1 插件必须实现完整 ViewerPlugin 接口

`install`、`uninstall`、`activate`、`deactivate`、`isActive` 都必须有实际实现。`uninstall` 必须清理事件监听器、恢复 DOM 更改、dispose Three.js 资源。

### 6.2 使用工厂函数导出

```typescript
// 正确 ✓ — 每次注册获取新实例
export function createPickingPlugin(): ViewerPlugin { ... }
```

### 6.3 插件 UI 组件通过 store hooks 获取状态

`sceneComponent` 和 `toolbarComponent` 中的 React 组件必须通过 `useSceneStore` / `useViewerStore` 获取状态，不通过 props 传递。插件类字段仅用于非 React 的外部引用（Three.js 对象、DOM 引用等）。

---

## 7. 命名约定

### 7.1 文件命名

| 类别 | 模式 | 示例 |
|---|---|---|
| 组件 | `PascalCase.tsx` | `ToolButton.tsx`、`SceneSetup.tsx` |
| 页面 | `PascalCasePage.tsx` | `ModelsPage.tsx`、`ViewerPage.tsx` |
| Store | `camelCase-store.ts` | `edit-store.ts`、`viewer-store.ts` |
| Hooks | `useName.ts` | `useMessageBus.ts`、`useViewer.ts` |
| 工具函数 | `camelCase.ts` | `fit-to-view.ts`、`selection-highlight.ts` |
| 类型 | `camelCase.ts` | `edit-data.ts`、`plugin-config.ts` |
| API | `camelCase.ts` | `models.ts`、`scenes.ts` |
| 插件 | `kebab-case/index.tsx` | `picking/index.tsx`、`auto-rotate/index.tsx` |

### 7.2 变量和函数命名

| 类别 | 模式 | 示例 |
|---|---|---|
| Store hooks | `use{Name}Store` | `useEditStore`、`useSceneStore` |
| 自定义 hooks | `use{Name}` | `useMessageBus`、`useViewer` |
| API 函数 | `动词 + 名词` | `getModels`、`createScene`、`updateSceneModel` |
| 组件 | PascalCase 命名函数 | `export function Toolbar()` |
| 事件处理 | `handle{Action}` | `handleClick`、`handleSaveAll` |
| 回调 props | `on{Action}` | `onFitView`、`onPluginManagerReady` |
| 布尔状态 | `is{X}` / `has{X}` | `isDirty`、`hasUnsavedChanges` |
| Ref | `{name}Ref` | `loadingRef`、`orbitRef` |

---

## 8. 样式

### 8.1 优先级：Tailwind > Ant Design 组件 > 内联样式

- 布局、间距、定位用 Tailwind CSS
- 标准交互用 Ant Design 组件（Button、Modal、Form 等）
- 仅动态计算值用 `style={{}}`（如 `width: ${progress}%`）

### 8.2 深色主题颜色用调色板

```typescript
// 正确 ✓ — 使用 CSS 变量或 Tailwind 扩展
className="bg-surface text-muted border-subtle"

// 禁止 ✗ — 硬编码 hex
className="bg-[#141414] text-[#aaa] border-[rgba(255,255,255,0.1)]"
```

在 `tailwind.config.js` 中定义项目调色板，通过名称引用。

---

## 9. 错误处理

### 9.1 页面必须有 error 状态和用户可见的错误 UI

每个加载远程数据的页面都必须处理加载失败的情况，提供重试和导航选项：

```typescript
const [error, setError] = useState<string | null>(null)

if (error) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <p>{error}</p>
      <Button onClick={fetchData}>重试</Button>
    </div>
  )
}
```

### 9.2 API 函数不吞错误

API 层不使用 try/catch 包装，错误交由调用方（页面/组件）处理。

---

## 10. React 模式

### 10.1 用 selector hook 读 store，不在渲染中用 getState

```typescript
// 正确 ✓ — 响应式更新
const sceneConfig = useViewerStore((s) => s.sceneConfig)

// 禁止 ✗ — 不触发重渲染
const sceneConfig = useViewerStore.getState().sceneConfig
```

`getState()` 仅限在 `useEffect`、`useCallback` 或事件处理函数内部使用。

### 10.2 Zustand store 不放入 useEffect/useCallback 依赖数组

Store 是稳定引用，不需要放入依赖数组。使用 `getState()` 读取最新值。

### 10.3 Three.js 相关组件用 React.memo

R3F 内部渲染组件用 `React.memo` 包装，避免不必要的重渲染：

```typescript
export const ViewerSceneContent = React.memo(function ViewerSceneContent() { ... })
```

### 10.4 useEffect 中的订阅必须配对取消

```typescript
useEffect(() => {
  messageBus.on('load-model', handler)
  return () => messageBus.off('load-model', handler)   // 必须配对
}, [])
```

---

## 11. 新功能检查清单

创建新的前端功能时，逐项确认：

**类型**
- [ ] `src/types/{domain}.ts` — 定义所有接口（API 响应、UI 状态、数据模型）
- [ ] 类型从 API 文件和组件中导入，未重复定义
- [ ] 无 `Record<string, unknown>` 或 `any` 逃逸

**API**
- [ ] `src/api/{domain}.ts` — 每个函数有显式 `Promise<T>` 返回类型
- [ ] 响应类型定义在 `src/types/`，不在 API 文件内
- [ ] 写操作后调用 `invalidateHttpCache` 清除相关 GET 缓存
- [ ] 请求体格式与后端 DTO 一致（注意扁平字段 vs 嵌套对象）
- [ ] 无 `as` 类型断言

**Store**
- [ ] `src/store/{name}-store.ts` — 命名导出 `use{Name}Store`
- [ ] 状态不与现有 store（特别是 `scene-store`）重复
- [ ] 操作无跨 store 调用
- [ ] 需要撤销/重做时用 `temporal` 包装器 + 自定义 equality
- [ ] 文件不超过 300 行

**组件**
- [ ] `src/components/PascalCase.tsx` — 命名导出，无默认导出
- [ ] Props 定义为命名接口（`ComponentNameProps`）
- [ ] 样式用 Tailwind，无静态内联样式
- [ ] error 状态有用户可见的错误 UI

**页面**（新页面时）
- [ ] `src/pages/PascalCasePage.tsx`
- [ ] 路由已在 `RouterApp.tsx` 中注册
- [ ] 数据加载有错误边界或 error 状态
- [ ] 不超过 500 行（提取 hooks 和子组件）

**Three.js / R3F**（涉及 3D 时）
- [ ] 材质克隆配对 dispose
- [ ] Three.js 对象引用用 useRef
- [ ] 事件处理函数用箭头函数保持 this
- [ ] 缓存模型用 `SkeletonUtils.clone` 深拷贝

**插件**（新插件时）
- [ ] `src/plugins/{kebab-case}/index.tsx`
- [ ] 实现完整 `ViewerPlugin` 接口（install/uninstall/activate/deactivate）
- [ ] 导出工厂函数 `create{Name}Plugin()`
- [ ] `uninstall` 清理所有资源
- [ ] `sceneComponent` 用 store hooks 获取状态
- [ ] 在 `EditCanvas.tsx` 或 `ViewerCanvas.tsx` 中注册

**通信**（涉及 iframe 时）
- [ ] 消息类型在 `src/communication/protocol.ts` 中定义
- [ ] payload 类型已定义并导出
- [ ] `messageBus.on` 在 useEffect cleanup 中配对 `off`
