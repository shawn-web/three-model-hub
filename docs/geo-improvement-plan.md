# Geo 页面全面改进计划

> 生成日期：2026-06-04
> 状态：待执行
> 范围：前端 `frontend/src/components/geo/`、`frontend/src/store/geo-store.ts`、`frontend/src/pages/GeoScenePage.tsx`、`frontend/src/communication/`、`backend/src/scenes/`

---

## 目录

- [一、问题总览](#一问题总览)
- [二、P0 — 必须修复（数据安全 + 核心体验）](#二p0--必须修复数据安全--核心体验)
- [三、P1 — 应该修复（架构健壮性 + iframe 完善）](#三p1--应该修复架构健壮性--iframe-完善)
- [四、P2 — 锦上添花（代码质量 + 配置管理 + 标注映射）](#四p2--锦上添花代码质量--配置管理--标注映射)
- [五、修改文件清单](#五修改文件清单)
- [六、验证方式](#六验证方式)

---

## 一、问题总览

共发现 **28 个问题**，按严重程度分三级：

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 P0 | 10 个 | 数据安全、核心功能缺失、用户可感知的 bug |
| 🟡 P1 | 10 个 | iframe 配置不完善、后端验证不足、架构风险 |
| 🟢 P2 | 8 个 | 代码质量、配置管理、长期功能规划 |

### P0 问题速览

| # | 问题 | 影响 |
|---|------|------|
| P0-1 | N+1 API 请求：loadScene 为每个模型发 `GET /models/:id` | 性能瓶颈，20 个模型 = 20 个请求 |
| P0-2 | 后端 geo_position 仅 `@IsObject()`，不验证字段类型/范围 | 可写入非法数据 |
| P0-3 | 单击空白处移动模型无确认无 undo | 误操作破坏性修改，无法恢复 |
| P0-4 | 无 unsaved changes 提示 | 关闭页面直接丢失修改 |
| P0-5 | 场景加载错误无 UI 展示 | 加载失败 = 空白地球，用户无感知 |
| P0-6 | 场景加载无进度指示器 | 模型后台加载中无任何提示 |
| P0-7 | loadScene 无防重入 | React StrictMode 双重挂载竞态 |
| P0-8 | iframe postMessage 临时配置被意外持久化到后端 | 父页面临时切底图 → 用户保存 → 永久覆盖 |
| P0-9 | iframe postMessage 无 origin 校验 | 任何页面都能修改 Geo 配置 |
| P0-10 | URL 参数与 postMessage 无优先级定义，互相覆盖 | 配置来源冲突，行为不可预测 |

### P1 问题速览

| # | 问题 |
|---|------|
| P1-1 | GeoConfigPayload 只有 4 个字段，缺少 camera / visibleModelIds / hiddenTools 等 |
| P1-2 | 事件通知只有 geo-ready，缺少 models-loaded / model-clicked / saved |
| P1-3 | geo-position-changed 消息定义了但从未发送 |
| P1-4 | 并行保存 batchUpdate + updateScene 无原子保证 |
| P1-5 | showToolbar/showPanel 未在后端持久化 |
| P1-6 | Geo 页面未使用 MessageBus，与 ViewerPage 模式不统一 |
| P1-7 | URL 参数未使用 url-params.ts 统一体系 |
| P1-8 | batchUpdate 后端逐条 save，大量模型时性能差 |
| P1-9 | batchUpdate 未限制 items 数组长度 |
| P1-10 | geo-ready 发送使用 `'*'` targetOrigin |

---

## 二、P0 — 必须修复（数据安全 + 核心体验）

### P0-1：N+1 API 请求

**现状**：`geo-store.ts:137-153`，`loadScene` 对每个模型调用 `fetchModelInfo(model_id)` → `GET /models/:id`，N 个模型 = N 次请求。

**修改方案**：

**后端**：修改 `scenes.service.ts` 的 `getSceneData` 方法，JOIN models 表返回 `file_url` 和 `thumbnail_url`。

```typescript
// backend/src/scenes/scenes.service.ts — getSceneData 方法中

// 当前：只查询 scene_models
// 修改为：JOIN models 表获取 file_url 和 thumbnail_url
const sceneData = await this.sceneRepo.findOne({
  where: { id },
  relations: ['models'], // scene_models
})

// 在返回结果中，为每个 scene_model 附加模型的 file_url 和 thumbnail_url
const modelIds = sceneData.models.map(m => m.model_id)
const modelEntities = await this.modelRepo.findByIds(modelIds)
const modelMap = new Map(modelEntities.map(m => [m.id, m]))

sceneData.models = sceneData.models.map(sm => ({
  ...sm,
  file_url: modelMap.get(sm.model_id)?.file_url || null,
  thumbnail_url: modelMap.get(sm.model_id)?.thumbnail_url || null,
}))
```

**前端**：`geo-store.ts` 的 `loadScene` 不再逐个调用 `fetchModelInfo`，直接使用后端返回的 `file_url` / `thumbnail_url`。

```typescript
// frontend/src/store/geo-store.ts — loadScene

const models = sceneData.models.map((m) => ({
  id: m.id,
  model_id: m.model_id,
  display_name: m.display_name,
  transform: m.transform,
  material_overrides: m.material_overrides,
  visible: m.visible,
  sort_order: m.sort_order,
  downloadUrl: m.file_url || '',           // 直接从场景数据取
  thumbnailUrl: m.thumbnail_url || '',      // 直接从场景数据取
  modelName: m.display_name || m.model_id,
  geo_position: m.geo_position || null,
}))
```

**影响文件**：
- `backend/src/scenes/scenes.service.ts`
- `frontend/src/store/geo-store.ts`

---

### P0-2：后端 geo_position 验证不足

**现状**：`scene.dto.ts:81-83`，仅 `@IsObject()`，不验证内部字段。`{foo:123}` 或 `{longitude:"abc"}` 都能通过。

**修改方案**：

新增 `GeoPositionDto` 类，替换三个 DTO 中的 `Record<string, any>`。

```typescript
// backend/src/scenes/dto/geo-position.dto.ts — 新文件

import { IsOptional, IsNumber, Min, Max } from 'class-validator'

/** 地理定位验证（WGS84） */
export class GeoPositionDto {
  @IsNumber() @Min(-180) @Max(180)
  longitude!: number

  @IsNumber() @Min(-90) @Max(90)
  latitude!: number

  @IsNumber()
  altitude!: number

  @IsOptional() @IsNumber() @Min(0) @Max(360)
  heading?: number

  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  pitch?: number

  @IsOptional() @IsNumber() @Min(-180) @Max(180)
  roll?: number

  @IsOptional() @IsNumber() @Min(0.001)
  scale?: number
}
```

在三个 DTO 中使用：

```typescript
// scene.dto.ts — AddSceneModelDto / UpdateSceneModelDto / BatchSceneModelItemDto

@IsOptional()
@ValidateIf((o) => o.geo_position !== null)
@ValidateNested()
@Type(() => GeoPositionDto)
geo_position?: GeoPositionDto | null
```

需要新增导入：`ValidateNested` 已有，新增 `Type` 装饰器导入，以及 `GeoPositionDto`。

**影响文件**：
- 新建 `backend/src/scenes/dto/geo-position.dto.ts`
- 修改 `backend/src/scenes/dto/scene.dto.ts`（3 个 DTO 类）

---

### P0-3：单击空白处移动模型无确认无 undo

**现状**：`CesiumViewer.tsx:430-466`，选中模型后单击空白直接移动模型到点击位置，破坏性操作无确认。

**修改方案**：改为"单击空白取消选中"，移动模型只能通过拖拽或面板输入坐标。移除定时器中"单击空白→移动模型"的逻辑。

```typescript
// CesiumViewer.tsx — LEFT_CLICK 双击等待定时器回调中

// 修改前：
// 单击空白区域 + 有选中模型 → 移动模型到点击位置

// 修改后：
// 单击空白区域 + 有选中模型 → 取消选中（仅此操作）
if (info.modelId) return // 单击模型：无操作

// 单击空白：取消选中
const currentState = useGeoStore.getState()
if (currentState.selectedModelId) {
  currentState.setSelectedModel(null)
}
```

保留拖拽移动模型的能力（LEFT_DOWN + MOUSE_MOVE + LEFT_UP）和面板坐标编辑。

**影响文件**：`frontend/src/components/geo/CesiumViewer.tsx`

---

### P0-4：无 unsaved changes 提示

**现状**：Geo 页面没有 `beforeunload` 监听。对比 `SceneEditorPage` 有完整实现。

**修改方案**：在 `GeoScenePage.tsx` 中添加：

```typescript
// GeoScenePage.tsx — 新增 useEffect

const models = useGeoStore((s) => s.models)

useEffect(() => {
  const hasPending = models.some((m) => m._pendingGeo !== undefined)
  if (!hasPending) return

  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault()
    // 现代浏览器不需要 returnValue 内容，但仍需赋值
    e.returnValue = ''
  }
  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}, [models])
```

**影响文件**：`frontend/src/pages/GeoScenePage.tsx`

---

### P0-5 & P0-6：错误/加载状态无 UI 展示

**现状**：store 有 `isLoading` 和 `error` 状态，但无组件展示。`geo-store.ts:168-173` 设置了 error 但 GeoScenePage 不读取。

**修改方案**：

```typescript
// GeoScenePage.tsx — 在主渲染区域添加

const { isLoading: sceneLoading, error: sceneError } = useGeoStore()

// 在 Cesium 容器上层叠加：
{sceneLoading && (
  <div style={{
    position: 'absolute', inset: 0, zIndex: 20,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
  }}>
    <Spin size="large">
      <div style={{ color: '#ccc' }}>加载场景数据...</div>
    </Spin>
  </div>
)}

{sceneError && (
  <div style={{
    position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
    zIndex: 20,
  }}>
    <Alert type="error" message={sceneError} closable showIcon />
  </div>
)}
```

**影响文件**：`frontend/src/pages/GeoScenePage.tsx`

---

### P0-7：loadScene 无防重入

**现状**：`geo-store.ts:131`，`loadScene` 无竞态保护。React StrictMode 双重挂载会调用两次。

**修改方案**：

```typescript
// geo-store.ts — loadScene 开头添加防重入

loadScene: async (sceneId: string) => {
  const current = get()
  // 防重入：相同 ID 且正在加载，跳过
  if (current.isLoading && current.sceneId === sceneId) return
  // 场景未变，数据已加载，跳过
  if (current.sceneId === sceneId && current.models.length > 0 && !current.error) return

  set({ isLoading: true, error: null, sceneId })
  // ...
}
```

**影响文件**：`frontend/src/store/geo-store.ts`

---

### P0-8：iframe 临时配置被意外持久化

**现状**：`geo-store.ts:230-242`，`saveGeoPositions` 保存时将 `imageryProvider` 和 `imageryType` 写回后端。如果 postMessage 临时切换了底图，保存会持久化临时值。

**修改方案**：在 store 中区分"持久化配置"和"运行时覆盖"。

```typescript
// geo-store.ts — GeoState 接口新增

/** 运行时覆盖（来自 postMessage），保存时忽略 */
runtimeOverrides: {
  imageryProvider?: string
  imageryType?: 'satellite' | 'vector'
} | null

// 新增 action
applyRuntimeConfig: (config: { imageryProvider?: string; imageryType?: 'satellite' | 'vector' }) => {
  set({ runtimeOverrides: config })
}
```

修改 `imageryProvider` / `imageryType` 的 getter 逻辑（通过 selector 或 computed value）：

```typescript
// Geo 组件中使用 effective 值：
const effectiveImageryProvider = useGeoStore(
  (s) => s.runtimeOverrides?.imageryProvider ?? s.imageryProvider
)
const effectiveImageryType = useGeoStore(
  (s) => s.runtimeOverrides?.imageryType ?? s.imageryType
)
```

`saveGeoPositions` 只保存 `imageryProvider` 和 `imageryType`（store 的持久值），不保存 `runtimeOverrides`。

**影响文件**：
- `frontend/src/store/geo-store.ts`
- `frontend/src/components/geo/CesiumViewer.tsx`（底图切换 effect 使用 effective 值）
- `frontend/src/pages/GeoScenePage.tsx`（postMessage 应用 runtimeOverrides）

---

### P0-9：postMessage 无 origin 校验

**现状**：`GeoScenePage.tsx:72-97`，`handleMessage` 不检查 `event.origin`。

**修改方案**：

```typescript
// GeoScenePage.tsx — handleMessage 中添加

// 从 URL 参数获取允许的 origin，默认不限制（向后兼容）
const allowedOrigins = useMemo(() => {
  const origins = searchParams.get('allowedOrigins')
  return origins ? origins.split(',') : null
}, [searchParams])

// 在 handleMessage 中：
const handleMessage = (event: MessageEvent) => {
  // origin 校验
  if (allowedOrigins && !allowedOrigins.includes(event.origin)) return
  // ...
}
```

同理修复 `geo-ready` 的 targetOrigin：

```typescript
// 优先使用 document.referrer（iframe 的父页面 origin），回退到 '*'
const parentOrigin = document.referrer ? new URL(document.referrer).origin : '*'
window.parent.postMessage({ type: 'geo-ready', payload: { sceneId } }, parentOrigin)
```

**影响文件**：`frontend/src/pages/GeoScenePage.tsx`

---

### P0-10：URL 参数与 postMessage 优先级冲突

**现状**：URL 参数（`GeoScenePage.tsx:51-68`）和 postMessage（`GeoScenePage.tsx:71-98`）直接调用同一个 store setter，互相覆盖，无优先级规则。

**修改方案**：定义统一优先级 + 合并函数。

```
优先级（从低到高）：
1. store 默认值
2. 后端 scene_config.geo（loadScene 恢复）
3. URL 参数（加载时一次性应用）
4. postMessage geo-config（运行时最高优先级，存入 runtimeOverrides）
```

```typescript
// GeoScenePage.tsx — URL 参数只设置持久化配置
useEffect(() => {
  const store = useGeoStore.getState()
  if (searchParams.has('imagery')) store.setImageryProvider(searchParams.get('imagery')!)
  if (searchParams.has('type')) {
    const t = searchParams.get('type')
    if (t === 'satellite' || t === 'vector') store.setImageryType(t)
  }
  if (searchParams.has('toolbar')) store.setShowToolbar(searchParams.get('toolbar') !== 'false')
  if (searchParams.has('panel')) store.setShowPanel(searchParams.get('panel') !== 'false')
}, [searchParams.toString()])

// postMessage 设置运行时覆盖（不参与持久化）
// handleMessage 中：
if (data.type === 'geo-config' && data.payload) {
  const config = data.payload as GeoConfigPayload
  const store = useGeoStore.getState()

  // 底图相关 → 运行时覆盖
  if (config.imagery || config.imageryType) {
    store.applyRuntimeConfig({
      imageryProvider: config.imagery,
      imageryType: config.imageryType as 'satellite' | 'vector',
    })
  }
  // UI 可见性 → 直接设置（不参与保存，无需区分）
  if (typeof config.toolbar === 'boolean') store.setShowToolbar(config.toolbar)
  if (typeof config.panel === 'boolean') store.setShowPanel(config.panel)
}
```

**影响文件**：`frontend/src/pages/GeoScenePage.tsx`、`frontend/src/store/geo-store.ts`

---

## 三、P1 — 应该修复（架构健壮性 + iframe 完善）

### P1-1：扩展 GeoConfigPayload

**现状**：`protocol.ts:95-100`，只有 4 个字段。对比 3D 查看器有 20+ 个字段。

**修改方案**：

```typescript
// protocol.ts — 扩展 GeoConfigPayload

export interface GeoConfigPayload {
  // ── 已有 ──
  imagery?: string
  imageryType?: 'satellite' | 'vector'
  toolbar?: boolean
  panel?: boolean

  // ── 新增：视角控制 ──
  camera?: {
    longitude: number
    latitude: number
    altitude: number
    heading?: number
    pitch?: number
    range?: number
  }

  // ── 新增：模型可见性控制 ──
  /** 指定可见的模型 ID 列表，null/undefined 表示全部 */
  visibleModelIds?: string[] | null

  // ── 新增：工具栏精细控制 ──
  hiddenTools?: string[]

  // ── 新增：标注显示 ──
  showMarkers?: boolean

  // ── 新增：安全 ──
  allowedOrigins?: string[]
}
```

**影响文件**：`frontend/src/communication/protocol.ts`、`frontend/src/pages/GeoScenePage.tsx`、`frontend/src/store/geo-store.ts`

---

### P1-2：新增事件通知

**现状**：只有 `geo-ready`，父页面不知道模型加载进度和用户交互。

**修改方案**：

```typescript
// protocol.ts — 新增 payload 接口

export interface GeoModelsLoadedPayload {
  sceneId: string
  modelCount: number
  failedModels: string[]
}

export interface GeoModelClickedPayload {
  modelId: string
  geoPosition: { longitude: number; latitude: number; altitude: number } | null
}

export interface GeoSavedPayload {
  sceneId: string
  savedModelIds: string[]
}

// MESSAGE_TYPES 新增
GEO_MODELS_LOADED: 'geo-models-loaded',
GEO_MODEL_CLICKED: 'geo-model-clicked',
GEO_SAVED: 'geo-saved',
```

发送时机：
- `geo-models-loaded`：`loadScene` 成功完成后发送
- `geo-model-clicked`：双击选中/取消选中模型时发送
- `geo-saved`：`saveGeoPositions` 成功后发送

**影响文件**：
- `frontend/src/communication/protocol.ts`
- `frontend/src/store/geo-store.ts`（loadScene / saveGeoPositions 中发送）
- `frontend/src/components/geo/CesiumViewer.tsx`（选中模型时发送）

---

### P1-3：实现 geo-position-changed 消息

**现状**：`protocol.ts:108-111` 定义了 `GeoPositionChangedPayload` 和 `GEO_POSITION_CHANGED` 常量，但从未发送。

**修改方案**：在 `saveGeoPositions` 成功后发送：

```typescript
// geo-store.ts — saveGeoPositions 成功后

// 通知父页面
window.parent.postMessage({
  type: 'geo-position-changed',
  payload: {
    savedModels: pendingModels.map(m => ({
      modelId: m.id,
      geo_position: m.geo_position,
    })),
  },
}, document.referrer ? new URL(document.referrer).origin : '*')
```

**影响文件**：`frontend/src/store/geo-store.ts`

---

### P1-4：并行保存无原子保证

**现状**：`geo-store.ts:224-244`，`batchUpdateSceneModels` 和 `updateScene` 并行执行，可能一个成功一个失败。

**修改方案**：后端新增统一的 Geo 保存接口。

```typescript
// backend: PUT /api/scenes/:id/geo — 同时保存模型坐标 + 底图配置

@Put(':id/geo')
async saveGeoConfig(
  @Param('id') id: string,
  @Body() dto: SaveGeoConfigDto,
) {
  return this.scenesService.saveGeoConfig(id, dto)
}

// SaveGeoConfigDto:
export class SaveGeoConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchSceneModelItemDto)
  models: BatchSceneModelItemDto[]

  @IsOptional()
  @IsObject()
  geoConfig?: Record<string, any>  // 底图厂商/类型等
}
```

前端从并行两个请求改为一个请求。

**影响文件**：
- 新建 `backend/src/scenes/dto/save-geo-config.dto.ts`
- 修改 `backend/src/scenes/scenes.controller.ts`、`backend/src/scenes/scenes.service.ts`
- 修改 `frontend/src/api/scenes.ts`（新增 `saveGeoConfig` API）
- 修改 `frontend/src/store/geo-store.ts`

---

### P1-5：showToolbar/showPanel 未持久化

**现状**：后端 `scene_config.geo` 中没有 `toolbar`/`panel` 字段，每次加载重置。

**修改方案**：在 `loadScene` 恢复时也恢复这两个值，保存时也写入。

```typescript
// geo-store.ts — loadScene 恢复时
const restoredToolbar = geoConfig?.toolbar ?? true
const restoredPanel = geoConfig?.panel ?? true

set({
  // ...
  showToolbar: restoredToolbar,
  showPanel: restoredPanel,
})

// saveGeoPositions 中保存时
const newGeoConfig = {
  ...currentGeoConfig,
  imageryProvider: currentProvider,
  imageryType: currentType,
  toolbar: get().showToolbar,
  panel: get().showPanel,
}
```

**影响文件**：`frontend/src/store/geo-store.ts`

---

### P1-6：Geo 页面未使用 MessageBus

**现状**：`GeoScenePage.tsx:71-97` 手动 `addEventListener`，而 ViewerPage 使用 `useMessageBus` hook。

**修改方案**：

```typescript
// GeoScenePage.tsx — 替换手动监听为 MessageBus

import { useMessageBus } from '../hooks/useMessageBus'

// 在组件中：
const messageBus = useMessageBus()

useEffect(() => {
  messageBus.on('geo-config', (payload: GeoConfigPayload) => {
    // ...处理配置
  })
  return () => messageBus.off('geo-config')
}, [messageBus])
```

**影响文件**：`frontend/src/pages/GeoScenePage.tsx`

---

### P1-7：URL 参数未使用统一体系

**现状**：Geo 页面自行解析 URL 参数，不在 `url-params.ts` 体系中。

**修改方案**：在 `url-params.ts` 中扩展 `UrlParams` 接口：

```typescript
// url-params.ts — UrlParams 新增
export interface UrlParams {
  // ...existing fields

  // Geo 页面专用
  imagery?: string
  geoType?: 'satellite' | 'vector'
  showToolbar?: boolean
  showPanel?: boolean
  allowedOrigins?: string[]
}

// parseUrlParams 中新增解析
imagery: searchParams.get('imagery') || undefined,
geoType: (searchParams.get('type') as 'satellite' | 'vector') || undefined,
showToolbar: searchParams.get('toolbar') !== 'false' ? undefined : false,
showPanel: searchParams.get('panel') !== 'false' ? undefined : false,
```

GeoScenePage 使用 `parseUrlParams()` 替代分散的 `searchParams.get()`。

**影响文件**：
- `frontend/src/communication/url-params.ts`
- `frontend/src/pages/GeoScenePage.tsx`

---

### P1-8：batchUpdate 后端逐条 save

**现状**：`scenes.service.ts:172-185`，事务内 for 循环逐条 `manager.save()`。

**修改方案**：改为批量操作：

```typescript
// scenes.service.ts — batchUpdateSceneModels

async batchUpdateSceneModels(sceneId: string, items: BatchSceneModelItemDto[]) {
  // ...验证所有 items 属于该场景

  await this.sceneModelRepo.manager.transaction(async (manager) => {
    // 批量查询
    const models = await manager.findByIds(SceneModel, itemIds)

    // 更新字段
    for (const model of models) {
      const item = itemsMap.get(model.id)
      if (item.transform !== undefined) model.transform = item.transform
      if (item.geo_position !== undefined) model.geo_position = item.geo_position
      // ...
    }

    // 批量保存
    await manager.save(SceneModel, models)
  })
}
```

**影响文件**：`backend/src/scenes/scenes.service.ts`

---

### P1-9：batchUpdate 未限制数组长度

**现状**：`scene.dto.ts:142-147`，`BatchUpdateSceneModelsDto.models` 无长度限制。

**修改方案**：

```typescript
// scene.dto.ts — BatchUpdateSceneModelsDto

export class BatchUpdateSceneModelsDto {
  @IsArray()
  @ArrayMaxSize(100)           // 新增：最多 100 条
  @ArrayMinSize(1)             // 新增：至少 1 条
  @ValidateNested({ each: true })
  @Type(() => BatchSceneModelItemDto)
  models: BatchSceneModelItemDto[]
}
```

需新增导入 `ArrayMaxSize` 和 `ArrayMinSize`。

**影响文件**：`backend/src/scenes/dto/scene.dto.ts`

---

### P1-10：geo-ready 发送使用 `'*'` targetOrigin

已在 P0-9 中一并修复（使用 `document.referrer` 推导父页面 origin）。

---

## 四、P2 — 锦上添花（代码质量 + 配置管理 + 标注映射）

### P2-1：提取 `effectiveGeo` 工具函数

**现状**：`model._pendingGeo !== undefined ? model._pendingGeo : model.geo_position` 在 5 个文件中出现 8 次。

**修改方案**：

```typescript
// frontend/src/store/geo-store.ts — GeoSceneModel 接口下方新增工具函数

/** 获取模型当前有效的地理坐标 */
export function getEffectiveGeo(model: GeoSceneModel): GeoPosition | null {
  return model._pendingGeo !== undefined ? model._pendingGeo : model.geo_position
}
```

替换所有 8 处用法。

**影响文件**：
- `frontend/src/store/geo-store.ts`
- `frontend/src/components/geo/CesiumViewer.tsx`
- `frontend/src/components/geo/GeoModelLayer.tsx`
- `frontend/src/components/geo/GeoLocationPanel.tsx`
- `frontend/src/components/geo/GeoToolbar.tsx`

---

### P2-2：提取 `getCs()` 到共享模块

**现状**：`getCs()` 在 4 个文件中各自定义。

**修改方案**：

```typescript
// 新建 frontend/src/utils/cesium-instance.ts

/** 获取全局 Cesium 实例（延迟求值，避免模块加载时未就绪） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCs(): any {
  return (window as any).Cesium
}
```

删除各文件中的重复定义，统一导入。

**影响文件**：
- 新建 `frontend/src/utils/cesium-instance.ts`
- 修改 `CesiumViewer.tsx`、`GeoModelLayer.tsx`、`GeoToolbar.tsx`、`imagery-providers.ts`

---

### P2-3：拆分 CesiumViewer 交互逻辑

**现状**：`CesiumViewer.tsx` 520 行，同时承担 Viewer 创建 + 底图管理 + 全部鼠标交互。

**修改方案**：

```
CesiumViewer.tsx (150 行) — Viewer 创建/销毁 + 底图管理 + 飞行到中心
useGeoInteraction.ts (300 行) — 鼠标交互 hook（拖拽/双击/放置/光标反馈）
```

```typescript
// 新建 frontend/src/hooks/useGeoInteraction.ts

export function useGeoInteraction(viewer: any): void {
  // 所有鼠标事件注册（LEFT_DOWN/MOUSE_MOVE/LEFT_UP/LEFT_CLICK）
  // 双击检测、拖拽状态机、放置模式、光标反馈
  // 全部从 CesiumViewer.tsx 提取
}

// CesiumViewer.tsx 中使用：
useGeoInteraction(viewer)
```

**影响文件**：
- 新建 `frontend/src/hooks/useGeoInteraction.ts`
- 修改 `frontend/src/components/geo/CesiumViewer.tsx`

---

### P2-4：为 viewer 定义最小类型接口

**现状**：所有组件中 viewer 为 `any`。

**修改方案**：

```typescript
// 新建 frontend/src/types/cesium.d.ts

/** Cesium Viewer 最小接口（仅暴露 Geo 页面实际使用的 API） */
export interface CesiumViewerFacade {
  entities: {
    values: CesiumEntity[]
    add(entity: unknown): CesiumEntity
    remove(entity: CesiumEntity): boolean
  }
  camera: {
    flyTo(options: unknown): void
    cancelFlight(): void
    getPickRay(position: { x: number; y: number }): unknown | undefined
  }
  imageryLayers: {
    addImageryProvider(provider: unknown): unknown
    remove(layer: unknown): boolean
    length: number
    get(index: number): unknown
  }
  scene: {
    pick(position: { x: number; y: number }): unknown
    globe: { pick(ray: unknown, scene: unknown): unknown }
    screenSpaceCameraController: { enableInputs: boolean }
  }
  canvas: HTMLCanvasElement
  isDestroyed(): boolean
  destroy(): void
  flyTo(entity: unknown, options?: unknown): void
  cesiumWidget: {
    screenSpaceEventHandler: { setInputAction(action: () => void, eventType: unknown): void }
    creditContainer: HTMLElement
  }
}
```

渐进式替换，先在组件 props 中使用 `CesiumViewerFacade` 替代 `any`。

**影响文件**：
- 新建 `frontend/src/types/cesium.d.ts`
- 渐进修改所有 Geo 组件

---

### P2-5：配置预览 + 导出功能

**现状**：3D 查看器有 `collectSceneConfig` / `generateConfigFile` / `downloadConfigFile`，Geo 页面完全没有。

**修改方案**：

```typescript
// 新建 frontend/src/utils/geo-config.ts

import type { GeoPosition } from './geo-coords'

/** Geo 场景完整配置 */
export interface GeoSceneConfig {
  sceneId: string
  sceneName: string
  // 底图
  imageryProvider: string
  imageryType: 'satellite' | 'vector'
  // 地理原点
  origin?: { longitude: number; latitude: number; altitude: number }
  // 模型列表
  models: Array<{
    id: string
    displayName: string
    visible: boolean
    geoPosition: GeoPosition | null
  }>
  // UI 配置
  toolbar: boolean
  panel: boolean
}

/** 从 geo-store 收集完整配置 */
export function collectGeoConfig(): GeoSceneConfig {
  const state = useGeoStore.getState()
  return {
    sceneId: state.sceneId || '',
    sceneName: state.sceneData?.name || '',
    imageryProvider: state.imageryProvider,
    imageryType: state.imageryType,
    origin: state.sceneData?.config?.geo?.origin,
    models: state.models.map(m => ({
      id: m.id,
      displayName: m.display_name || m.modelName,
      visible: m.visible,
      geoPosition: getEffectiveGeo(m),
    })),
    toolbar: state.showToolbar,
    panel: state.showPanel,
  }
}

/** 生成配置文件文本 */
export function generateGeoConfigFile(config: GeoSceneConfig): string {
  return `/**
 * Geo 场景配置 — ${config.sceneName}
 * 生成时间: ${new Date().toISOString()}
 */

// 底图配置
window.GeoSceneConfig = ${JSON.stringify(config, null, 2)}

// iframe 嵌入示例:
// <iframe src="/geo/${config.sceneId}?toolbar=true&panel=true&imagery=${config.imageryProvider}&type=${config.imageryType}"></iframe>
//
// postMessage 动态配置:
// iframe.contentWindow.postMessage({
//   type: 'geo-config',
//   payload: { imagery: 'tianditu', imageryType: 'satellite', toolbar: true }
// }, '*')
`
}

/** 下载配置文件 */
export function downloadGeoConfig(config: GeoSceneConfig): void {
  const text = generateGeoConfigFile(config)
  const blob = new Blob([text], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `geo-config-${config.sceneName || config.sceneId}.js`
  a.click()
  URL.revokeObjectURL(url)
}
```

在 GeoToolbar 中添加"导出配置"按钮。

**影响文件**：
- 新建 `frontend/src/utils/geo-config.ts`
- 修改 `frontend/src/components/geo/GeoToolbar.tsx`

---

### P2-6：标注/图片映射到 Geo 页面（场景原点方案）

**现状**：Geo 页面只有裸模型，没有标注和图片。两套坐标系完全独立。`geo-coords.ts` 中有 `localToGeo` / `geoToLocal` 转换函数但从未使用。

**修改方案（分阶段）**：

**阶段 1 — 场景编辑器增加地理原点配置**：

在 `SceneSettings.tsx` 中增加「地理原点」输入区域（经度/纬度/海拔），保存到 `scene_config.geo.origin`。

**阶段 2 — Geo 页面渲染标注**：

```typescript
// 新建 frontend/src/components/geo/GeoMarkerLayer.tsx

/** 将场景标注渲染为 Cesium Billboard */
export function GeoMarkerLayer({ viewer }: { viewer: any }) {
  const markers = useGeoStore((s) => s.markers)
  const origin = useGeoStore((s) => s.sceneData?.config?.geo?.origin)

  useEffect(() => {
    if (!viewer || !markers || !origin) return

    const C = getCs()

    markers.forEach((marker) => {
      // Three.js [x,y,z] → WGS84 [east,north,up]
      // 注意轴映射：X=east, Y=up, Z=-south（取决于模型朝向）
      const wgs84 = localToGeo(
        [marker.position[0], -marker.position[2], marker.position[1] + (marker.offset || 0)],
        origin,
      )

      viewer.entities.add({
        position: C.Cartesian3.fromDegrees(wgs84.longitude, wgs84.latitude, wgs84.altitude),
        billboard: {
          image: marker.imageUrl,
          width: marker.width,
          height: marker.height,
          verticalOrigin: C.VerticalOrigin.BOTTOM,
        },
        properties: { markerId: marker.id },
      })
    })
  }, [viewer, markers, origin])

  return null
}
```

**阶段 3 — Geo 页面渲染场景图片**：

类似方案，广告牌模式 → Cesium Billboard，嵌入模式 → Cesium Plane Primitive。

**阶段 4 — 双向同步**：

Geo 页面拖拽标注 → 保存时通过 `geoToLocal` 反算回 Three.js 坐标。

**影响文件**：
- 修改 `frontend/src/components/SceneSettings.tsx`（地理原点输入）
- 新建 `frontend/src/components/geo/GeoMarkerLayer.tsx`
- 修改 `frontend/src/pages/GeoScenePage.tsx`（加载标注数据）
- 修改 `frontend/src/store/geo-store.ts`（新增 markers 状态）

---

### P2-7：GeoLocationPanel 移除空 props

**现状**：`GeoLocationPanel.tsx:23`，`_props: GeoLocationPanelProps` 接口为空。

**修改方案**：移除 props 声明。

```typescript
// 修改前
export function GeoLocationPanel(_props: GeoLocationPanelProps) {

// 修改后
export function GeoLocationPanel() {
```

删除 `GeoLocationPanelProps` 接口。

**影响文件**：`frontend/src/components/geo/GeoLocationPanel.tsx`

---

### P2-8：GeoModelLayer 性能优化

**现状**：`GeoModelLayer.tsx:32-167`，`useEffect([viewer, models])` 每次 models 引用变化都全量 diff。

**修改方案**：分离"模型列表变化"和"坐标更新"两个 effect。

```typescript
// 模型列表变化 → 全量 diff（增删实体）
const modelIds = useMemo(() => models.map(m => m.id).join(','), [models])
useEffect(() => {
  // 增删实体逻辑
}, [viewer, modelIds])

// 坐标更新 → 只更新 position/orientation
useEffect(() => {
  // 遍历 models，只更新已有 Entity 的位置
}, [viewer, models])
```

**影响文件**：`frontend/src/components/geo/GeoModelLayer.tsx`

---

## 五、修改文件清单

### 按文件分组

| 文件 | P0 | P1 | P2 |
|------|-----|-----|-----|
| `frontend/src/store/geo-store.ts` | P0-1, P0-7, P0-8, P0-10 | P1-2, P1-3, P1-5 | P2-1 |
| `frontend/src/pages/GeoScenePage.tsx` | P0-4, P0-5/6, P0-9, P0-10 | P1-6, P1-7 | — |
| `frontend/src/components/geo/CesiumViewer.tsx` | P0-3 | P1-2 | P2-1, P2-2, P2-3 |
| `frontend/src/components/geo/GeoModelLayer.tsx` | — | — | P2-1, P2-2, P2-8 |
| `frontend/src/components/geo/GeoToolbar.tsx` | — | — | P2-1, P2-2, P2-5 |
| `frontend/src/components/geo/GeoLocationPanel.tsx` | — | — | P2-1, P2-7 |
| `frontend/src/communication/protocol.ts` | — | P1-1, P1-2 | — |
| `frontend/src/communication/url-params.ts` | — | P1-7 | — |
| `frontend/src/api/scenes.ts` | — | P1-4 | — |
| `backend/src/scenes/scenes.service.ts` | P0-1 | P1-4, P1-8 | — |
| `backend/src/scenes/scenes.controller.ts` | — | P1-4 | — |
| `backend/src/scenes/dto/scene.dto.ts` | P0-2 | P1-9 | — |

### 新建文件

| 文件 | 用途 | 级别 |
|------|------|------|
| `backend/src/scenes/dto/geo-position.dto.ts` | geo_position 字段级验证 | P0-2 |
| `backend/src/scenes/dto/save-geo-config.dto.ts` | 统一 Geo 保存 DTO | P1-4 |
| `frontend/src/utils/cesium-instance.ts` | 共享 getCs() | P2-2 |
| `frontend/src/hooks/useGeoInteraction.ts` | 鼠标交互 hook | P2-3 |
| `frontend/src/types/cesium.d.ts` | Cesium 最小类型接口 | P2-4 |
| `frontend/src/utils/geo-config.ts` | 配置收集/生成/导出 | P2-5 |
| `frontend/src/components/geo/GeoMarkerLayer.tsx` | 标注图层 | P2-6 |

---

## 六、验证方式

### 类型检查

```bash
cd frontend && pnpm exec tsc --noEmit
cd backend && pnpm exec tsc --noEmit
```

### 功能验证清单

**P0 验证**：

| 验证项 | 操作 | 预期结果 |
|--------|------|---------|
| N+1 修复 | 打开 DevTools Network，加载含 5+ 模型的 Geo 页面 | 不应有 `GET /models/:id` 批量请求 |
| geo_position 验证 | 用 Postman 发送 `{longitude: "abc"}` 到 batchUpdate | 返回 400 验证错误 |
| 单击空白行为 | 选中模型 → 单击空白区域 | 取消选中，模型位置不变 |
| unsaved changes | 修改坐标 → 关闭浏览器 Tab | 浏览器弹出确认对话框 |
| 错误展示 | 使用无效 sceneId 访问 Geo 页面 | 显示错误提示 |
| 加载指示器 | 加载含多个模型的场景 | 加载中显示 Loading overlay |
| 防重入 | React StrictMode 下加载场景 | 不重复请求 |
| 临时配置不持久化 | iframe 发送 geo-config 切底图 → 保存 → 刷新 | 底图恢复为后端保存的值 |
| origin 校验 | 从非允许域发送 postMessage | 配置不生效 |

**P1 验证**：

| 验证项 | 操作 | 预期结果 |
|--------|------|---------|
| camera 配置 | postMessage `{camera: {longitude:116, latitude:40, altitude:1000}}` | 相机飞到指定位置 |
| visibleModelIds | postMessage `{visibleModelIds: ['id1']}` | 只显示指定模型 |
| models-loaded 事件 | 监听 iframe message | 收到 geo-models-loaded 通知 |
| 原子保存 | 保存 Geo 配置 | 只发一个 API 请求 |
| toolbar/panel 持久化 | 隐藏工具栏 → 保存 → 刷新 | 工具栏保持隐藏 |

**P2 验证**：

| 验证项 | 操作 | 预期结果 |
|--------|------|---------|
| 配置导出 | 点击"导出配置"按钮 | 下载 .js 配置文件 |
| 标注映射 | 设置场景原点 → 打开 Geo 页面 | 标注显示在地图上对应位置 |
| CesiumViewer 代码量 | — | < 200 行（从 520 行拆分） |

### 文档同步

按 CLAUDE.md 要求，修改完成后同步更新：

| 变更类型 | 需同步更新的文件 |
|---------|----------------|
| 新增 API 端点 `PUT /scenes/:id/geo` | `docs/api.md` |
| 新增前端 hook / utils | `docs/architecture.md` 前端目录结构 |
| 新增后端 DTO | `docs/architecture.md` 后端目录结构 |
| GeoConfigPayload 扩展 | `docs/api.md`、`CLAUDE.md` |
| 新增组件 GeoMarkerLayer | `docs/architecture.md` 前端目录结构 |
