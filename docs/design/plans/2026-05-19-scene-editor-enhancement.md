# 场景编辑器增强 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面增强场景编辑器——保存机制、组件树、背景设置、缩略图、测量改进、材质编辑

**Architecture:** 后端增加批量更新 API；前端重构编辑器为左侧面板（组件树+场景设置）+ 中央 3D 视图 + 底部工具栏的布局；共用背景渲染组件；脏检查+保存提示贯穿编辑流程

**Tech Stack:** NestJS + TypeORM + MySQL（后端）；React + R3F + Zustand + antd + @iconify/react（前端）

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `frontend/src/components/EditToolbar.tsx` | 编辑器底部工具栏（移动/旋转/缩放/截图/封面/适配） |
| `frontend/src/components/SceneTree.tsx` | 编辑器组件树面板（可见性/选中/高亮） |
| `frontend/src/components/SceneSettings.tsx` | 场景设置面板（背景色/图片/天空盒/HDR） |
| `frontend/src/components/ComponentProperties.tsx` | 构件属性面板（材质/属性/描述） |
| `frontend/src/components/SceneBackground.tsx` | R3F 背景渲染组件（共用） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `backend/src/scenes/scenes.controller.ts` | 添加 batch update 端点 |
| `backend/src/scenes/scenes.service.ts` | 添加 batchUpdateModels 方法 |
| `backend/src/scenes/dto/scene.dto.ts` | 添加 BatchUpdateSceneModelDto |
| `frontend/src/api/scenes.ts` | 添加 batchUpdateModels API |
| `frontend/src/store/edit-store.ts` | 添加 isDirty、selectedComponentId、backgroundConfig |
| `frontend/src/components/EditSceneSetup.tsx` | 集成背景组件、快捷键、组件选中高亮 |
| `frontend/src/pages/SceneEditorPage.tsx` | 重构布局：左侧面板+工具栏+保存提示 |
| `frontend/src/utils/multi-model-loader.ts` | 加载时应用 transform + material_overrides |
| `frontend/src/core/scene-setup.tsx` | 集成背景组件到预览页 |
| `frontend/src/utils/screenshot.ts` | 添加 captureAndUploadThumbnail 函数 |
| `frontend/src/plugins/measurement/index.tsx` | 测量点加大、连线 |

---

## Task 1: 后端批量更新 API

**Files:**
- Modify: `backend/src/scenes/dto/scene.dto.ts`
- Modify: `backend/src/scenes/scenes.service.ts`
- Modify: `backend/src/scenes/scenes.controller.ts`

- [ ] **Step 1: 添加 BatchUpdateSceneModelDto**

在 `backend/src/scenes/dto/scene.dto.ts` 末尾追加：

```typescript
/** 批量更新场景模型 DTO 中的单项 */
export class BatchSceneModelItemDto {
  id: string
  transform?: Record<string, any>
  material_overrides?: Record<string, any>
  visible?: boolean
  display_name?: string
}

/** 批量更新场景模型 DTO */
export class BatchUpdateSceneModelsDto {
  models: BatchSceneModelItemDto[]
}
```

- [ ] **Step 2: 添加 Service 方法**

在 `backend/src/scenes/scenes.service.ts` 的 `ScenesService` 类中添加：

```typescript
/**
 * 批量更新场景中的模型配置
 */
async batchUpdateModels(sceneId: string, items: BatchSceneModelItemDto[]): Promise<void> {
  await this.findOne(sceneId)

  for (const item of items) {
    const sceneModel = await this.sceneModelRepo.findOne({
      where: { id: item.id, scene_id: sceneId },
    })
    if (!sceneModel) continue

    if (item.transform !== undefined) sceneModel.transform = item.transform
    if (item.material_overrides !== undefined) sceneModel.material_overrides = item.material_overrides
    if (item.visible !== undefined) sceneModel.visible = item.visible
    if (item.display_name !== undefined) sceneModel.display_name = item.display_name

    await this.sceneModelRepo.save(sceneModel)
  }
}
```

同时在 import 中追加 `BatchSceneModelItemDto`。

- [ ] **Step 3: 添加 Controller 端点**

在 `backend/src/scenes/scenes.controller.ts` 的 `ScenesController` 类中添加：

```typescript
/** 批量更新场景中的模型配置 */
@Put(':id/models/batch')
async batchUpdateModels(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: BatchUpdateSceneModelsDto,
) {
  await this.scenesService.batchUpdateModels(id, dto.models)
  return { success: true }
}
```

同时在 import 中追加 `BatchUpdateSceneModelsDto`。

- [ ] **Step 4: 验证编译**

Run: `cd D:/other/three-model-hub/backend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add backend/src/scenes/dto/scene.dto.ts backend/src/scenes/scenes.service.ts backend/src/scenes/scenes.controller.ts
git commit -m "feat: 添加场景模型批量更新 API 端点"
```

---

## Task 2: 前端 API + Store 扩展

**Files:**
- Modify: `frontend/src/api/scenes.ts`
- Modify: `frontend/src/store/edit-store.ts`

- [ ] **Step 1: 添加前端 API 函数**

在 `frontend/src/api/scenes.ts` 末尾追加：

```typescript
/** 批量更新场景模型 */
export async function batchUpdateSceneModels(
  sceneId: string,
  models: Array<{
    id: string
    transform?: Record<string, any>
    material_overrides?: Record<string, any>
    visible?: boolean
    display_name?: string
  }>,
) {
  const { data } = await apiClient.put(`/scenes/${sceneId}/models/batch`, { models })
  return data
}
```

- [ ] **Step 2: 扩展 edit-store**

在 `frontend/src/store/edit-store.ts` 的 `EditState` 接口中添加：

```typescript
/** 是否有未保存的编辑 */
isDirty: boolean
/** 当前选中的构件 UUID */
selectedComponentId: string | null
/** 场景背景配置 */
backgroundConfig: BackgroundConfig | null
```

在 `EditActions` 接口中添加：

```typescript
setIsDirty: (dirty: boolean) => void
setSelectedComponentId: (id: string | null) => void
setBackgroundConfig: (config: BackgroundConfig | null) => void
```

在文件顶部添加背景配置类型：

```typescript
/** 场景背景配置 */
export type BackgroundConfig =
  | { type: 'color'; color: string }
  | { type: 'image'; url: string }
  | { type: 'skybox'; urls: [string, string, string, string, string, string] }
  | { type: 'hdr'; url: string }
```

在 `initialState` 中添加：

```typescript
isDirty: false,
selectedComponentId: null,
backgroundConfig: null,
```

在 store 实现中添加：

```typescript
setIsDirty: (dirty) => set({ isDirty: dirty }),
setSelectedComponentId: (id) => set({ selectedComponentId: id }),
setBackgroundConfig: (config) => {
  set({ backgroundConfig: config, isDirty: true })
},
```

同时在 `updateComponentTransform` 和 `updateComponentMaterial` 和 `updateComponentVisibility` 的实现中，在 `set()` 调用里追加 `isDirty: true`。

- [ ] **Step 3: 验证编译**

Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add frontend/src/api/scenes.ts frontend/src/store/edit-store.ts
git commit -m "feat: 添加批量更新 API 和编辑器 store 扩展（脏检查/选中/背景）"
```

---

## Task 3: 编辑器工具栏组件

**Files:**
- Create: `frontend/src/components/EditToolbar.tsx`

- [ ] **Step 1: 创建 EditToolbar 组件**

创建 `frontend/src/components/EditToolbar.tsx`：

```tsx
import { useCallback } from 'react'
import { Icon } from '@iconify/react'
import { ToolButton } from './ToolButton'
import { useEditStore } from '../store/edit-store'
import type { TransformMode } from '../store/edit-store'
import { captureAsThumbnail } from '../utils/screenshot'
import { downloadScreenshot } from '../utils/screenshot'

interface EditToolbarProps {
  onFitView: () => void
  onSave: () => void
  onSetThumbnail: (dataUrl: string) => void
  saving: boolean
}

/** 变换模式配置 */
const TRANSFORM_MODES: { mode: TransformMode; icon: string; label: string; shortcut: string }[] = [
  { mode: 'translate', icon: 'lucide:move', label: '移动', shortcut: 'W' },
  { mode: 'rotate', icon: 'lucide:rotate-cw', label: '旋转', shortcut: 'E' },
  { mode: 'scale', icon: 'lucide:scaling', label: '缩放', shortcut: 'R' },
]

export function EditToolbar({ onFitView, onSave, onSetThumbnail, saving }: EditToolbarProps) {
  const transformMode = useEditStore((s) => s.transformMode)
  const setTransformMode = useEditStore((s) => s.setTransformMode)
  const isDirty = useEditStore((s) => s.isDirty)

  const handleModeChange = useCallback((mode: TransformMode) => {
    setTransformMode(mode)
  }, [setTransformMode])

  const handleScreenshot = useCallback(() => {
    downloadScreenshot()
  }, [])

  const handleThumbnail = useCallback(() => {
    const dataUrl = captureAsThumbnail()
    if (dataUrl) onSetThumbnail(dataUrl)
  }, [onSetThumbnail])

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-[rgba(20,20,30,0.9)] rounded-[10px] backdrop-blur-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.4)] py-1 px-2">
      {/* 变换模式按钮组 */}
      {TRANSFORM_MODES.map(({ mode, icon, label, shortcut }) => (
        <ToolButton
          key={mode}
          icon={<Icon icon={icon} width={16} height={16} />}
          label={`${label} (${shortcut})`}
          active={transformMode === mode}
          onClick={() => handleModeChange(mode)}
        />
      ))}

      <div className="w-px h-5 bg-white/[0.12] mx-0.5" />

      {/* 适配视图 */}
      <ToolButton
        icon={<Icon icon="lucide:maximize" width={16} height={16} />}
        label="适配视图"
        onClick={onFitView}
      />

      <div className="w-px h-5 bg-white/[0.12] mx-0.5" />

      {/* 截图 */}
      <ToolButton
        icon={<Icon icon="lucide:camera" width={16} height={16} />}
        label="截图下载"
        onClick={handleScreenshot}
      />

      {/* 设为封面 */}
      <ToolButton
        icon={<Icon icon="lucide:image" width={16} height={16} />}
        label="设为封面"
        onClick={handleThumbnail}
      />

      <div className="w-px h-5 bg-white/[0.12] mx-0.5" />

      {/* 保存 */}
      <ToolButton
        icon={<Icon icon="lucide:save" width={16} height={16} />}
        label={`保存${isDirty ? ' *' : ''}`}
        onClick={onSave}
        active={isDirty}
      />
      {saving && (
        <span className="text-white/50 text-[10px] ml-1">保存中...</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误（可能因 edit-store 中 setTransformMode 不存在而报错，下一步处理）

- [ ] **Step 3: 确认 edit-store 已有 setTransformMode**

检查 `frontend/src/store/edit-store.ts` 是否已有 `setTransformMode` action。如果没有，在 `EditActions` 中添加 `setTransformMode: (mode: TransformMode) => void`，在实现中添加 `setTransformMode: (mode) => set({ transformMode: mode })`。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/EditToolbar.tsx
git commit -m "feat: 添加编辑器工具栏组件（移动/旋转/缩放/截图/封面/保存）"
```

---

## Task 4: 组件树面板

**Files:**
- Create: `frontend/src/components/SceneTree.tsx`

- [ ] **Step 1: 创建 SceneTree 组件**

创建 `frontend/src/components/SceneTree.tsx`：

```tsx
import { useMemo, useCallback, useState } from 'react'
import { Tree } from 'antd'
import type { TreeProps, TreeDataNode } from 'antd'
import { Icon } from '@iconify/react'
import * as THREE from 'three'
import { useEditStore } from '../store/edit-store'

/** 将 THREE.Object3D 层级结构转换为 antd Tree 数据 */
function buildTreeData(object: THREE.Object3D, isRoot: boolean = false): TreeDataNode[] {
  const displayName = isRoot ? '模型根节点' : (object.name || object.type)

  const node: TreeDataNode = {
    key: object.uuid,
    title: displayName,
  }

  if (object.children.length > 0) {
    node.children = object.children
      .filter((child) => !(child as any).isMarker)
      .map((child) => buildTreeData(child, false)[0])
      .filter(Boolean)
  }

  return [node]
}

/** 收集所有节点的 key */
function collectAllKeys(object: THREE.Object3D): string[] {
  const keys: string[] = [object.uuid]
  object.children
    .filter((child) => !(child as any).isMarker)
    .forEach((child) => keys.push(...collectAllKeys(child)))
  return keys
}

/**
 * 编辑器组件树面板
 * 支持可见性控制、点选高亮、展开折叠
 */
export function SceneTree() {
  const modelObject = useEditStore((s) => s.modelObject)
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const setSelectedComponentId = useEditStore((s) => s.setSelectedComponentId)
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([])

  const treeData = useMemo<TreeDataNode[]>(() => {
    if (!modelObject) return []
    return buildTreeData(modelObject, true)
  }, [modelObject])

  /** 默认全选 */
  const allKeys = useMemo(() => {
    if (!modelObject) return []
    return collectAllKeys(modelObject)
  }, [modelObject])

  // 首次加载时全选
  useMemo(() => {
    if (allKeys.length > 0 && checkedKeys.length === 0) {
      setCheckedKeys(allKeys)
    }
  }, [allKeys])

  const handleSelect: TreeProps['onSelect'] = useCallback((keys) => {
    const key = keys[0] as string | undefined
    setSelectedComponentId(key ?? null)
  }, [setSelectedComponentId])

  const handleCheck: TreeProps['onCheck'] = useCallback((checked) => {
    const keys = checked as React.Key[]
    setCheckedKeys(keys)

    // 根据勾选状态控制模型对象可见性
    if (modelObject) {
      modelObject.traverse((child) => {
        child.visible = keys.includes(child.uuid)
      })
    }
  }, [modelObject])

  if (!modelObject) return null

  return (
    <div style={{ padding: '4px 8px' }}>
      <div style={{
        padding: '8px 4px 6px',
        fontSize: 12,
        fontWeight: 600,
        color: '#666',
        borderBottom: '1px solid #f0f0f0',
      }}>
        模型结构
      </div>
      <Tree
        treeData={treeData}
        defaultExpandAll
        selectedKeys={selectedComponentId ? [selectedComponentId] : []}
        checkedKeys={checkedKeys}
        onSelect={handleSelect}
        onCheck={handleCheck}
        checkable
        showIcon={false}
        blockNode
        style={{ background: 'transparent', fontSize: 12, marginTop: 4 }}
      />
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/SceneTree.tsx
git commit -m "feat: 添加编辑器组件树面板（可见性控制/选中高亮）"
```

---

## Task 5: 场景背景渲染组件

**Files:**
- Create: `frontend/src/components/SceneBackground.tsx`

- [ ] **Step 1: 创建 SceneBackground 组件**

创建 `frontend/src/components/SceneBackground.tsx`：

```tsx
import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import type { BackgroundConfig } from '../store/edit-store'

interface SceneBackgroundProps {
  config: BackgroundConfig | null
}

/** 共用的场景背景渲染组件，供编辑器和预览页使用 */
export function SceneBackground({ config }: SceneBackgroundProps) {
  const { scene } = useThree()

  // 默认背景色
  const defaultColor = '#1a1a2e'
  const resolvedConfig = config ?? { type: 'color' as const, color: defaultColor }

  // 纯色背景
  useEffect(() => {
    if (resolvedConfig.type !== 'color') return
    scene.background = new THREE.Color(resolvedConfig.color)
    scene.environment = null
    return () => {
      scene.background = null
    }
  }, [scene, resolvedConfig])

  // 图片背景
  const imageUrl = resolvedConfig.type === 'image' ? resolvedConfig.url : null
  useEffect(() => {
    if (!imageUrl) return
    const loader = new THREE.TextureLoader()
    loader.load(imageUrl, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      scene.background = texture
    })
    return () => {
      scene.background = null
    }
  }, [scene, imageUrl])

  // 天空盒背景
  const skyboxUrls = resolvedConfig.type === 'skybox' ? resolvedConfig.urls : null
  useEffect(() => {
    if (!skyboxUrls) return
    const loader = new THREE.CubeTextureLoader()
    loader.load(skyboxUrls as string[], (cubeTexture) => {
      scene.background = cubeTexture
    })
    return () => {
      scene.background = null
    }
  }, [scene, skyboxUrls])

  // HDR 背景
  const hdrUrl = resolvedConfig.type === 'hdr' ? resolvedConfig.url : null
  useEffect(() => {
    if (!hdrUrl) return
    const loader = new RGBELoader()
    loader.load(hdrUrl, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      scene.background = texture
      scene.environment = texture
    })
    return () => {
      scene.background = null
      scene.environment = null
    }
  }, [scene, hdrUrl])

  return null
}
```

- [ ] **Step 2: 集成到编辑器 EditSceneSetup**

在 `frontend/src/components/EditSceneSetup.tsx` 中：

1. 添加 import：
```tsx
import { SceneBackground } from './SceneBackground'
import { useEditStore } from '../store/edit-store'
```

2. 在组件内部获取背景配置：
```tsx
const backgroundConfig = useEditStore((s) => s.backgroundConfig)
```

3. 在 return JSX 中，替换 `scene.background = new THREE.Color(0x1a1a2e)` 的 useEffect（即删除设置硬编码背景色的 useEffect），改为添加 SceneBackground 组件：
```tsx
<SceneBackground config={backgroundConfig} />
```

- [ ] **Step 3: 集成到预览页 SceneSetup**

在 `frontend/src/core/scene-setup.tsx` 中：

1. 添加 import：
```tsx
import { SceneBackground } from '../components/SceneBackground'
```

2. 删除设置硬编码背景色的 useEffect：
```tsx
// 删除这个 useEffect：
// useEffect(() => {
//   scene.background = new THREE.Color(0x1a1a2e)
//   ...
// }, [scene, gl])
```

改为保留 gl 的 shadowMap 和 toneMapping 设置，同时使用 `useViewerStore` 读取场景配置中的背景：

```tsx
const sceneConfig = useViewerStore((s) => s.sceneConfig)

useEffect(() => {
  gl.shadowMap.enabled = true
  gl.shadowMap.type = THREE.PCFSoftShadowMap
  gl.toneMapping = THREE.ACESFilmicToneMapping
  gl.toneMappingExposure = 1.0
}, [gl])
```

在 return JSX 中添加：
```tsx
<SceneBackground config={sceneConfig?.background ?? null} />
```

注意：`sceneConfig` 需要从 viewer-store 中获取。如果 viewer-store 中没有 `sceneConfig`，需要添加：

在 `frontend/src/store/viewer-store.ts` 的 `ViewerState` 中添加 `sceneConfig: Record<string, any> | null` 和 `setSceneConfig` action，初始值为 null。

在 `frontend/src/pages/ViewerPage.tsx` 的 `loadAsScene` 方法中，加载场景数据后调用 `useViewerStore.getState().setSceneConfig(sceneData.config)`。

- [ ] **Step 4: 验证编译**

Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/SceneBackground.tsx frontend/src/components/EditSceneSetup.tsx frontend/src/core/scene-setup.tsx frontend/src/store/viewer-store.ts frontend/src/pages/ViewerPage.tsx
git commit -m "feat: 添加场景背景渲染组件，集成到编辑器和预览页"
```

---

## Task 6: 场景设置面板（背景配置）

**Files:**
- Create: `frontend/src/components/SceneSettings.tsx`

- [ ] **Step 1: 创建 SceneSettings 组件**

创建 `frontend/src/components/SceneSettings.tsx`：

```tsx
import { useState, useCallback } from 'react'
import { Select, ColorPicker, Input, Upload, message, Button } from 'antd'
import { Icon } from '@iconify/react'
import type { BackgroundConfig } from '../store/edit-store'
import { useEditStore } from '../store/edit-store'
import { uploadFile } from '../api/upload'

type BackgroundType = 'color' | 'image' | 'skybox' | 'hdr'

/** 背景类型选项 */
const BG_TYPE_OPTIONS = [
  { value: 'color', label: '纯色' },
  { value: 'image', label: '图片' },
  { value: 'skybox', label: '天空盒' },
  { value: 'hdr', label: 'HDR 环境贴图' },
]

/**
 * 场景设置面板
 * 支持背景类型切换和对应配置
 */
export function SceneSettings() {
  const backgroundConfig = useEditStore((s) => s.backgroundConfig)
  const setBackgroundConfig = useEditStore((s) => s.setBackgroundConfig)
  const [uploading, setUploading] = useState(false)

  const currentType: BackgroundType = backgroundConfig?.type ?? 'color'

  /** 切换背景类型 */
  const handleTypeChange = useCallback((type: BackgroundType) => {
    switch (type) {
      case 'color':
        setBackgroundConfig({ type: 'color', color: '#1a1a2e' })
        break
      case 'image':
        setBackgroundConfig({ type: 'image', url: '' })
        break
      case 'skybox':
        setBackgroundConfig({ type: 'skybox', urls: ['', '', '', '', '', ''] })
        break
      case 'hdr':
        setBackgroundConfig({ type: 'hdr', url: '' })
        break
    }
  }, [setBackgroundConfig])

  /** 更新纯色背景 */
  const handleColorChange = useCallback((_: any, color: any) => {
    // antd ColorPicker 返回的颜色对象
    const hex = typeof color === 'string' ? color : color?.toHexString?.() ?? '#1a1a2e'
    setBackgroundConfig({ type: 'color', color: hex })
  }, [setBackgroundConfig])

  /** 更新图片 URL */
  const handleImageUrlChange = useCallback((url: string) => {
    setBackgroundConfig({ type: 'image', url })
  }, [setBackgroundConfig])

  /** 更新 HDR URL */
  const handleHdrUrlChange = useCallback((url: string) => {
    setBackgroundConfig({ type: 'hdr', url })
  }, [setBackgroundConfig])

  /** 上传文件辅助 */
  const handleUpload = useCallback(async (file: File, onComplete: (url: string) => void) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await uploadFile(formData)
      onComplete(result.url)
      message.success('上传成功')
    } catch {
      message.error('上传失败')
    }
    setUploading(false)
  }, [])

  return (
    <div style={{ padding: '4px 8px' }}>
      <div style={{
        padding: '8px 4px 6px',
        fontSize: 12,
        fontWeight: 600,
        color: '#666',
        borderBottom: '1px solid #f0f0f0',
      }}>
        场景设置
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>背景类型</div>
        <Select
          size="small"
          value={currentType}
          onChange={handleTypeChange}
          options={BG_TYPE_OPTIONS}
          style={{ width: '100%' }}
        />
      </div>

      {/* 纯色设置 */}
      {currentType === 'color' && backgroundConfig?.type === 'color' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>背景颜色</div>
          <ColorPicker
            size="small"
            value={backgroundConfig.color}
            onChangeComplete={handleColorChange}
          />
        </div>
      )}

      {/* 图片设置 */}
      {currentType === 'image' && backgroundConfig?.type === 'image' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>图片 URL</div>
          <Input
            size="small"
            value={backgroundConfig.url}
            onChange={(e) => handleImageUrlChange(e.target.value)}
            placeholder="输入图片 URL"
          />
          <Upload
            showUploadList={false}
            accept="image/*"
            beforeUpload={(file) => {
              handleUpload(file, (url) => handleImageUrlChange(url))
              return false
            }}
          >
            <Button size="small" loading={uploading} style={{ marginTop: 4 }} block>
              <Icon icon="lucide:upload" width={12} /> 上传图片
            </Button>
          </Upload>
        </div>
      )}

      {/* HDR 设置 */}
      {currentType === 'hdr' && backgroundConfig?.type === 'hdr' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>HDR 文件 URL</div>
          <Input
            size="small"
            value={backgroundConfig.url}
            onChange={(e) => handleHdrUrlChange(e.target.value)}
            placeholder="输入 HDR 文件 URL"
          />
          <Upload
            showUploadList={false}
            accept=".hdr,.exr"
            beforeUpload={(file) => {
              handleUpload(file, (url) => handleHdrUrlChange(url))
              return false
            }}
          >
            <Button size="small" loading={uploading} style={{ marginTop: 4 }} block>
              <Icon icon="lucide:upload" width={12} /> 上传 HDR
            </Button>
          </Upload>
        </div>
      )}

      {/* 天空盒设置 */}
      {currentType === 'skybox' && backgroundConfig?.type === 'skybox' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
            天空盒图片（6 张，顺序：+X -X +Y -Y +Z -Z）
          </div>
          {['+X', '-X', '+Y', '-Y', '+Z', '-Z'].map((label, i) => (
            <div key={label} style={{ marginBottom: 4 }}>
              <Input
                size="small"
                value={backgroundConfig.urls[i]}
                onChange={(e) => {
                  const newUrls = [...backgroundConfig.urls] as [string, string, string, string, string, string]
                  newUrls[i] = e.target.value
                  setBackgroundConfig({ type: 'skybox', urls: newUrls })
                }}
                placeholder={`${label} 图片 URL`}
                addonBefore={<span style={{ fontSize: 10 }}>{label}</span>}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

注意：`uploadFile` API 需要确认是否存在。如果不存在，在 `frontend/src/api/upload.ts` 中创建：

```typescript
import apiClient from './client'

/** 上传文件（通用） */
export async function uploadFile(formData: FormData) {
  const { data } = await apiClient.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  })
  return data
}
```

如果后端没有通用上传端点，也可以直接调用文件服务。检查后端是否有 `/upload` 路由。如果没有，使用场景缩略图的保存方式：先截图转 Blob，然后通过后端中转上传。

- [ ] **Step 2: 验证编译**

Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/SceneSettings.tsx frontend/src/api/upload.ts
git commit -m "feat: 添加场景设置面板（背景色/图片/天空盒/HDR）"
```

---

## Task 7: 构件属性面板

**Files:**
- Create: `frontend/src/components/ComponentProperties.tsx`

- [ ] **Step 1: 创建 ComponentProperties 组件**

创建 `frontend/src/components/ComponentProperties.tsx`：

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Input, InputNumber, ColorPicker, Slider, Button, Empty } from 'antd'
import { Icon } from '@iconify/react'
import * as THREE from 'three'
import { useEditStore } from '../store/edit-store'

/**
 * 构件属性面板
 * 选中构件后显示属性信息，支持材质编辑和描述
 */
export function ComponentProperties() {
  const modelObject = useEditStore((s) => s.modelObject)
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const updateComponentMaterial = useEditStore((s) => s.updateComponentMaterial)

  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null)
  const [description, setDescription] = useState('')

  // 查找选中的对象
  useEffect(() => {
    if (!modelObject || !selectedComponentId) {
      setSelectedObj(null)
      return
    }
    let found: THREE.Object3D | null = null
    modelObject.traverse((child) => {
      if (child.uuid === selectedComponentId) found = child
    })
    setSelectedObj(found)
  }, [modelObject, selectedComponentId])

  // 获取当前颜色和透明度
  const meshMaterial = (() => {
    if (!selectedObj || !(selectedObj instanceof THREE.Mesh)) return null
    const mat = selectedObj.material
    if (Array.isArray(mat)) return mat[0] as THREE.MeshStandardMaterial
    return mat as THREE.MeshStandardMaterial
  })()

  const handleColorChange = useCallback((_: any, color: any) => {
    if (!selectedComponentId || !meshMaterial) return
    const hex = typeof color === 'string' ? color : color?.toHexString?.() ?? '#ffffff'
    updateComponentMaterial(selectedComponentId, { color: hex, opacity: null })
    // 直接应用
    meshMaterial.color.set(hex)
  }, [selectedComponentId, meshMaterial, updateComponentMaterial])

  const handleOpacityChange = useCallback((value: number) => {
    if (!selectedComponentId || !meshMaterial) return
    updateComponentMaterial(selectedComponentId, { color: null, opacity: value / 100 })
    meshMaterial.transparent = true
    meshMaterial.opacity = value / 100
  }, [selectedComponentId, meshMaterial, updateComponentMaterial])

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value)
  }, [])

  const handleDescriptionSave = useCallback(() => {
    if (!selectedComponentId) return
    // 存储到 editData 中
    const store = useEditStore.getState()
    const existing = store.editData[selectedComponentId]
    store.updateComponentMaterial(selectedComponentId, {
      color: null,
      opacity: null,
    })
  }, [selectedComponentId])

  if (!selectedComponentId) {
    return (
      <div style={{ padding: '12px 8px', textAlign: 'center' }}>
        <Empty
          description="请选择一个构件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ fontSize: 11 }}
        />
      </div>
    )
  }

  if (!selectedObj) {
    return null
  }

  return (
    <div style={{ padding: '4px 8px' }}>
      <div style={{
        padding: '8px 4px 6px',
        fontSize: 12,
        fontWeight: 600,
        color: '#666',
        borderBottom: '1px solid #f0f0f0',
      }}>
        构件属性
      </div>

      {/* 基本信息 */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>名称</div>
        <div style={{ fontSize: 12, color: '#333' }}>{selectedObj.name || '(未命名)'}</div>
      </div>

      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>类型</div>
        <div style={{ fontSize: 12, color: '#333' }}>{selectedObj.type}</div>
      </div>

      {/* 位置信息 */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>位置</div>
        <div style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>
          X: {selectedObj.position.x.toFixed(3)} Y: {selectedObj.position.y.toFixed(3)} Z: {selectedObj.position.z.toFixed(3)}
        </div>
      </div>

      {/* 材质编辑（仅 Mesh 类型） */}
      {meshMaterial && (
        <>
          <div style={{ marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>颜色</div>
            <ColorPicker
              size="small"
              value={meshMaterial.color.getStyle()}
              onChangeComplete={handleColorChange}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
              透明度: {Math.round((meshMaterial.opacity ?? 1) * 100)}%
            </div>
            <Slider
              min={0}
              max={100}
              value={Math.round((meshMaterial.opacity ?? 1) * 100)}
              onChange={handleOpacityChange}
              size="small"
            />
          </div>
        </>
      )}

      {/* 描述 */}
      <div style={{ marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>描述</div>
        <Input.TextArea
          size="small"
          value={description}
          onChange={handleDescriptionChange}
          placeholder="添加构件描述..."
          rows={2}
          maxLength={200}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/ComponentProperties.tsx
git commit -m "feat: 添加构件属性面板（材质编辑/属性查看/描述）"
```

---

## Task 8: EditSceneSetup 增强

**Files:**
- Modify: `frontend/src/components/EditSceneSetup.tsx`

- [ ] **Step 1: 添加快捷键支持**

在 `EditSceneSetup.tsx` 组件内部添加快捷键 useEffect：

```tsx
/** 快捷键处理 */
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // 忽略输入框中的按键
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    const store = useEditStore.getState()
    switch (e.key.toLowerCase()) {
      case 'w':
        store.setTransformMode('translate')
        break
      case 'e':
        store.setTransformMode('rotate')
        break
      case 'r':
        store.setTransformMode('scale')
        break
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

- [ ] **Step 2: 添加选中构件高亮**

在 EditSceneSetup 中添加选中构件的高亮渲染。在 return JSX 中添加：

```tsx
{selectedComponentId && (() => {
  let found: THREE.Object3D | null = null
  modelObject?.traverse((child) => {
    if (child.uuid === selectedComponentId) found = child
  })
  if (!found) return null
  return (
    <SelectionHighlight object={found} />
  )
})()}
```

确保 `SelectionHighlight` 组件已存在（当前文件中已有此组件）。如果有，确认它能正确对选中构件画框。如果没有，实现为使用 `BoxHelper`：

```tsx
function SelectionHighlight({ object }: { object: THREE.Object3D }) {
  const ref = useRef<THREE.BoxHelper>(null)
  useFrame(() => {
    if (ref.current) {
      ref.current.update()
    }
  })
  return <boxHelper ref={ref} object={object} color={0x4a9eff} />
}
```

- [ ] **Step 3: TransformControls 绑定到选中构件**

修改 TransformControls 部分，使其绑定到选中的构件而不是模型根对象：

当前代码中 TransformControls 可能绑定到 modelObject。需要修改为：
- 如果有 `selectedComponentId`，找到对应对象并绑定 TransformControls
- 如果没有选中构件，TransformControls 不显示

```tsx
const selectedObject = useMemo(() => {
  if (!modelObject || !selectedComponentId) return null
  let found: THREE.Object3D | null = null
  modelObject.traverse((child) => {
    if (child.uuid === selectedComponentId) found = child
  })
  return found
}, [modelObject, selectedComponentId])
```

在 JSX 中：
```tsx
{selectedObject && (
  <TransformControls
    ref={transformRef}
    object={selectedObject}
    mode={transformMode}
    onObjectChange={onObjectChange}
  />
)}
```

- [ ] **Step 4: 验证编译**

Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/EditSceneSetup.tsx
git commit -m "feat: 编辑器场景增强（快捷键/选中高亮/构件变换）"
```

---

## Task 9: 场景编辑器页面重构

**Files:**
- Modify: `frontend/src/pages/SceneEditorPage.tsx`

- [ ] **Step 1: 重构布局**

将 SceneEditorPage 重构为：左侧面板（组件树 + 场景设置 + 构件属性）+ 中央 3D 编辑器 + 底部工具栏。

核心布局结构：

```tsx
<Layout className="h-full overflow-hidden">
  {/* 左侧面板 */}
  <Sider width={280} theme="light" className="border-r flex flex-col">
    {/* 返回 + 标题 */}
    <div className="py-3 px-4 border-b flex items-center gap-2">
      <Button type="text" size="small" icon={<ArrowLeft20 />} onClick={handleGoBack} />
      <Text strong className="text-sm">场景编辑</Text>
    </div>

    {/* 场景名称 */}
    <div className="py-3 px-4">
      <Input value={sceneName} onChange={(e) => setSceneName(e.target.value)} size="small" />
    </div>

    {/* 可滚动区域：组件树 + 场景设置 + 构件属性 */}
    <div className="flex-1 overflow-auto">
      <SceneTree />
      <SceneSettings />
      <ComponentProperties />
    </div>

    {/* 底部操作 */}
    <div className="py-3 px-4 border-t">
      <Button type="primary" icon={<Save20 />} block onClick={handleSaveScene} loading={saving}>
        保存场景
      </Button>
      <Button icon={<Eye20 />} block className="mt-2" onClick={handlePreview}>
        预览场景
      </Button>
    </div>
  </Sider>

  {/* 中央 3D 编辑器 */}
  <Content className="relative bg-[#f5f5f5]">
    <EditCanvas />
    <EditToolbar
      onFitView={handleFitView}
      onSave={handleSaveAll}
      onSetThumbnail={handleSetThumbnail}
      saving={saving}
    />
    {modelLoading && <Spin ... />}
  </Content>
</Layout>
```

- [ ] **Step 2: 添加脏检查 + 保存提示逻辑**

在 SceneEditorPage 中添加：

```tsx
const isDirty = useEditStore((s) => s.isDirty)

/** 保存所有编辑数据 */
const handleSaveAll = useCallback(async () => {
  if (!id) return
  setSaving(true)
  try {
    // 1. 保存场景基础信息（名称、背景配置）
    const store = useEditStore.getState()
    await updateScene(id, {
      name: sceneName,
      scene_config: {
        ...sceneConfig,
        background: store.backgroundConfig,
      },
    })

    // 2. 批量保存模型变换和材质
    const editData = store.editData
    const updates = sceneModels.map((sm) => {
      const modelEdits: Record<string, any> = {}
      // 收集该 scene_model 下所有组件的编辑数据
      Object.entries(editData).forEach(([uuid, data]) => {
        if (data.color || data.opacity || data.description) {
          modelEdits[uuid] = {
            color: data.color,
            opacity: data.opacity,
            description: data.description,
          }
        }
      })

      return {
        id: sm.id,
        transform: sm.transform,
        material_overrides: Object.keys(modelEdits).length > 0 ? { components: modelEdits } : undefined,
        visible: sm.visible,
      }
    })

    await batchUpdateSceneModels(id, updates)
    useEditStore.getState().setIsDirty(false)
    message.success('保存成功')
  } catch (err) {
    message.error('保存失败')
    console.error('[SceneEditor] 保存失败:', err)
  }
  setSaving(false)
}, [id, sceneName, sceneConfig, sceneModels])

/** 带保存确认的导航 */
const confirmAndNavigate = useCallback((target: string) => {
  if (!useEditStore.getState().isDirty) {
    navigate(target)
    return
  }
  Modal.confirm({
    title: '未保存的更改',
    content: '你有未保存的更改，是否保存后再继续？',
    okText: '保存并继续',
    cancelText: '不保存',
    onOk: async () => {
      await handleSaveAll()
      navigate(target)
    },
    onCancel: () => {
      navigate(target)
    },
  })
}, [navigate, handleSaveAll])

const handlePreview = useCallback(() => {
  confirmAndNavigate(`/view/${id}?type=scene`)
}, [confirmAndNavigate, id])

const handleGoBack = useCallback(() => {
  confirmAndNavigate('/scenes')
}, [confirmAndNavigate])
```

- [ ] **Step 3: 添加 beforeunload 拦截**

```tsx
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (useEditStore.getState().isDirty) {
      e.preventDefault()
    }
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [])
```

- [ ] **Step 4: 缩略图保存**

需要上传截图到文件服务并更新 scene.thumbnail_url。因为前端不能直接调用外部文件服务（需要 token），通过后端中转：

```tsx
const handleSetThumbnail = useCallback(async (dataUrl: string) => {
  if (!id) return
  try {
    // 将 base64 dataUrl 转为 Blob
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const formData = new FormData()
    formData.append('file', blob, `scene-${id}-thumbnail.png`)

    // 通过后端上传
    const result = await uploadFile(formData)
    if (result.url) {
      await updateScene(id, { thumbnail_url: result.url } as any)
      message.success('封面已设置')
    }
  } catch (err) {
    message.error('设置封面失败')
    console.error('[SceneEditor] 设置封面失败:', err)
  }
}, [id])
```

注意：`updateScene` 的 DTO 需要支持 `thumbnail_url` 字段。检查 `UpdateSceneDto`，已有该字段，但前端 `updateScene` 函数的类型定义可能不包含。需要扩展前端 API 函数的参数类型。

- [ ] **Step 5: 添加缺失的 import**

确保所有新组件和函数都已 import：
```tsx
import { SceneTree } from '../components/SceneTree'
import { SceneSettings } from '../components/SceneSettings'
import { ComponentProperties } from '../components/ComponentProperties'
import { EditToolbar } from '../components/EditToolbar'
import { batchUpdateSceneModels } from '../api/scenes'
```

- [ ] **Step 6: 验证编译**

Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 7: 提交**

```bash
git add frontend/src/pages/SceneEditorPage.tsx
git commit -m "feat: 重构场景编辑器页面（左侧面板+工具栏+保存提示+缩略图）"
```

---

## Task 10: multi-model-loader 应用 transform + material

**Files:**
- Modify: `frontend/src/utils/multi-model-loader.ts`

- [ ] **Step 1: 加载时应用 transform**

在 `loadSceneModels` 函数中，每个模型加载完成后，如果有 `transform` 数据则应用。确认当前代码是否已有 `applyTransform` 调用。如果已有，确认其正确性。

如果缺失，在每个模型加载后添加：

```typescript
// 应用变换
if (sceneModel.transform) {
  applyTransform(group, sceneModel.transform)
}
```

- [ ] **Step 2: 加载时应用 material_overrides**

在模型加载完成后，如果有 `material_overrides` 数据则应用：

```typescript
// 应用材质覆盖
if (sceneModel.material_overrides?.components) {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const override = sceneModel.material_overrides.components[child.uuid]
    if (!override) return
    const mat = child.material as THREE.MeshStandardMaterial
    if (override.color) mat.color.set(override.color)
    if (override.opacity != null) {
      mat.transparent = true
      mat.opacity = override.opacity
    }
  })
}
```

- [ ] **Step 3: 加载时应用 visible**

```typescript
// 应用可见性
if (sceneModel.visible === false) {
  group.visible = false
}
```

- [ ] **Step 4: 验证编译**

Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add frontend/src/utils/multi-model-loader.ts
git commit -m "feat: 多模型加载时应用 transform/material_overrides/visible"
```

---

## Task 11: 测量工具改进

**Files:**
- Modify: `frontend/src/components/PluginScene.tsx`（MeasurementScene 和 MeasurementPoint 部分）

- [ ] **Step 1: 加大测量点球体**

在 `MeasurementPoint` 组件中，将 `baseRadius` 的计算从 `scale * 0.002` 改为 `scale * 0.005`：

```typescript
const baseRadius = Math.max(scale * 0.005, 0.008)
```

- [ ] **Step 2: 确认点击点在模型表面**

在 `MeasurementScene` 的 `onClick` 处理中，确认 `intersects[0].point` 直接使用。当前代码已经是正确的：
```typescript
const point = intersects[0].point
plugin.addPoint(point.clone())
```
这已经是模型表面的点，无需修改。

- [ ] **Step 3: 确认两点之间有连线**

在 `MeasurementVisualization` 组件中确认已有 `Line` 组件。当前代码：
```tsx
<Line points={[start.toArray(), end.toArray()]} color="#4a9eff" lineWidth={2} />
```
连线已存在。增加线宽从 2 到 3 使其更明显：

```tsx
<Line points={[start.toArray(), end.toArray()]} color="#4a9eff" lineWidth={3} />
```

- [ ] **Step 4: 添加距离标签位置优化**

确认 `MeasurementVisualization` 中的 `Html` 标签在连线中点。当前已在中点。无需修改。

- [ ] **Step 5: 验证编译**

Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/PluginScene.tsx
git commit -m "fix: 加大测量点球体、加粗测量连线"
```

---

## Task 12: 预览页应用保存的编辑数据

**Files:**
- Modify: `frontend/src/pages/ViewerPage.tsx`
- Modify: `frontend/src/store/viewer-store.ts`

- [ ] **Step 1: viewer-store 添加 sceneConfig**

在 `frontend/src/store/viewer-store.ts` 中：
- `ViewerState` 添加 `sceneConfig: Record<string, any> | null`
- `ViewerActions` 添加 `setSceneConfig: (config: Record<string, any> | null) => void`
- `initialState` 添加 `sceneConfig: null`
- 实现中添加 `setSceneConfig: (config) => set({ sceneConfig: config })`

- [ ] **Step 2: ViewerPage 加载时保存 sceneConfig**

在 `ViewerPage.tsx` 的 `loadAsScene` 中，获取场景数据后保存配置：

```typescript
const sceneData = await getSceneData(sceneId)
// 保存场景配置（包含背景设置）
useViewerStore.getState().setSceneConfig(sceneData.config)
```

- [ ] **Step 3: 验证编译**

Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add frontend/src/store/viewer-store.ts frontend/src/pages/ViewerPage.tsx
git commit -m "feat: 预览页加载场景配置（背景等）"
```

---

## Task 13: 后端通用文件上传接口（供缩略图和背景图片使用）

**Files:**
- Create: `backend/src/upload/upload.module.ts`
- Create: `backend/src/upload/upload.controller.ts`
- Create: `backend/src/upload/upload.service.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: 创建 UploadModule**

创建 `backend/src/upload/upload.service.ts`：

```typescript
import { Injectable } from '@nestjs/common'
import { StorageService } from '../storage/storage.service'

@Injectable()
export class UploadService {
  constructor(private storageService: StorageService) {}

  async uploadFile(file: Express.Multer.File): Promise<{ url: string }> {
    const bucket = `upload-${Date.now()}`
    const result = await this.storageService.uploadFile(
      file.buffer,
      file.originalname,
      bucket,
      'assets',
    )
    return { url: result.url }
  }
}
```

创建 `backend/src/upload/upload.controller.ts`：

```typescript
import { Controller, Post, UseInterceptors, UploadedFile } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { UploadService } from './upload.service'

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadFile(file)
  }
}
```

创建 `backend/src/upload/upload.module.ts`：

```typescript
import { Module } from '@nestjs/common'
import { UploadController } from './upload.controller'
import { UploadService } from './upload.service'
import { StorageModule } from '../storage/storage.module'

@Module({
  imports: [StorageModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
```

- [ ] **Step 2: 注册 UploadModule**

在 `backend/src/app.module.ts` 的 `imports` 中添加 `UploadModule`：

```typescript
import { UploadModule } from './upload/upload.module'

@Module({
  imports: [
    // ... 已有的模块
    UploadModule,
  ],
})
```

- [ ] **Step 3: 前端 API**

在 `frontend/src/api/upload.ts` 中（如 Task 6 中创建）：

```typescript
import apiClient from './client'

/** 通用文件上传 */
export async function uploadFile(formData: FormData) {
  const { data } = await apiClient.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  })
  return data
}
```

- [ ] **Step 4: 验证编译**

Run: `cd D:/other/three-model-hub/backend && npx tsc --noEmit`
Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add backend/src/upload/ backend/src/app.module.ts frontend/src/api/upload.ts
git commit -m "feat: 添加通用文件上传 API 端点"
```

---

## Task 14: 集成测试 + 最终验证

**Files:**
- All modified files

- [ ] **Step 1: 全量 TypeScript 编译检查**

Run: `cd D:/other/three-model-hub/backend && npx tsc --noEmit`
Run: `cd D:/other/three-model-hub/frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 2: 检查所有新文件的 import 路径**

确认所有新建文件的 import 路径正确，无遗漏的依赖。

- [ ] **Step 3: 检查类型一致性**

确认 BackgroundConfig 类型在 store 和组件间一致使用。

确认 `uploadFile` API 返回 `{ url: string }` 格式与前端使用一致。

确认 `batchUpdateSceneModels` 的请求格式与后端 DTO 一致。

- [ ] **Step 4: 最终提交**

如果有修复：
```bash
git add -A
git commit -m "fix: 集成测试修复"
```
