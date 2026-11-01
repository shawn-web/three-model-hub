# 贴图修改功能 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在场景编辑器的模型构件属性弹窗中增加全部 PBR 贴图通道的修改能力，数据存储在现有 material_overrides JSON 字段中。

**Architecture:** 扩展 EditComponentData 接口增加 5 个贴图 URL 字段，扩展现有 ComponentProperties 弹窗 UI 增加贴图选择区域，使用 Three.js TextureLoader 在保存时加载贴图并应用到材质，同步扩展开关数据流的保存/加载/配置导出逻辑。

**Tech Stack:** React 19 + TypeScript 6, Three.js, Ant Design 6, Zustand

---

### Task 1: 扩展数据模型（Store + Types）

**Files:**
- Modify: `frontend/src/store/edit-store.ts:18-28` (EditComponentData), `:206-216` (defaultComponent), `:133` (updateComponentMaterial 签名), `:286-299` (updateComponentMaterial 实现)
- Modify: `frontend/src/types/edit-data.ts:1-14` (ComponentEdit)

- [ ] **Step 1: 扩展 EditComponentData 接口，新增 5 个贴图字段**

在 `frontend/src/store/edit-store.ts` 第 17-28 行，在 `description` 字段后面新增贴图字段:

```typescript
export interface EditComponentData {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string | null
  opacity: number | null
  visible: boolean
  name: string | null
  description: string | null
  mapUrl: string | null
  normalMapUrl: string | null
  roughnessMapUrl: string | null
  metalnessMapUrl: string | null
  emissiveMapUrl: string | null
  _deleted?: boolean
}
```

- [ ] **Step 2: 更新 defaultComponent，新增贴图字段默认值**

修改 `defaultComponent()` 函数（第 206-216 行），在 `description: null` 后新增:

```typescript
const defaultComponent = (): EditComponentData => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: null,
  opacity: null,
  visible: true,
  name: null,
  description: null,
  mapUrl: null,
  normalMapUrl: null,
  roughnessMapUrl: null,
  metalnessMapUrl: null,
  emissiveMapUrl: null,
})
```

- [ ] **Step 3: 扩展 updateComponentMaterial 签名和实现**

修改接口 `EditActions` 中的 `updateComponentMaterial` 签名（第 133 行）：

```typescript
updateComponentMaterial: (uuid: string, material: {
  color?: string | null
  opacity?: number | null
  mapUrl?: string | null
  normalMapUrl?: string | null
  roughnessMapUrl?: string | null
  metalnessMapUrl?: string | null
  emissiveMapUrl?: string | null
}) => void
```

修改实现体（第 286-299 行）:

```typescript
updateComponentMaterial: (uuid, material) => set((state) => {
  const existing = state.editData[uuid] || defaultComponent()
  return {
    editData: {
      ...state.editData,
      [uuid]: {
        ...existing,
        color: material.color !== undefined ? material.color : existing.color,
        opacity: material.opacity !== undefined ? material.opacity : existing.opacity,
        mapUrl: material.mapUrl !== undefined ? material.mapUrl : existing.mapUrl,
        normalMapUrl: material.normalMapUrl !== undefined ? material.normalMapUrl : existing.normalMapUrl,
        roughnessMapUrl: material.roughnessMapUrl !== undefined ? material.roughnessMapUrl : existing.roughnessMapUrl,
        metalnessMapUrl: material.metalnessMapUrl !== undefined ? material.metalnessMapUrl : existing.metalnessMapUrl,
        emissiveMapUrl: material.emissiveMapUrl !== undefined ? material.emissiveMapUrl : existing.emissiveMapUrl,
      },
    },
    isDirty: true,
  }
}),
```

- [ ] **Step 4: 扩展 ComponentEdit 类型**

修改 `frontend/src/types/edit-data.ts` 第 7-10 行的 material 类型：

```typescript
material: {
  color: string | null
  opacity: number | null
  mapUrl: string | null
  normalMapUrl: string | null
  roughnessMapUrl: string | null
  metalnessMapUrl: string | null
  emissiveMapUrl: string | null
}
```

- [ ] **Step 5: Commit——数据模型扩展**

```bash
git add frontend/src/store/edit-store.ts frontend/src/types/edit-data.ts
git commit -m "feat: 扩展数据模型支持 PBR 贴图字段

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: 扩展 SelectionHighlightManager 贴图同步

**Files:**
- Modify: `frontend/src/utils/selection-highlight.ts:82-95`

- [ ] **Step 1: 扩展 syncToOriginalMaterial 的 updates 参数**

修改第 82-95 行 `syncToOriginalMaterial` 方法：

```typescript
syncToOriginalMaterial(mesh: THREE.Mesh, updates: {
  color?: string
  opacity?: number
  mapUrl?: string | null
  normalMapUrl?: string | null
  roughnessMapUrl?: string | null
  metalnessMapUrl?: string | null
  emissiveMapUrl?: string | null
}): void {
  const original = this.highlightedMeshes.get(mesh)
  if (!original) return
  const mats = Array.isArray(original) ? original : [original]
  for (const mat of mats) {
    const m = mat as THREE.MeshStandardMaterial
    if (updates.color && 'color' in m) {
      m.color.set(updates.color)
    }
    if (updates.opacity !== undefined && 'opacity' in m) {
      m.transparent = true
      m.opacity = updates.opacity
    }
    // 贴图同步
    const texChannels: Array<{
      url: string | null | undefined
      mapKey: keyof Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'emissiveMap'>
      origKey: string
    }> = [
      { url: updates.mapUrl, mapKey: 'map', origKey: '_originalMap' },
      { url: updates.normalMapUrl, mapKey: 'normalMap', origKey: '_originalNormalMap' },
      { url: updates.roughnessMapUrl, mapKey: 'roughnessMap', origKey: '_originalRoughnessMap' },
      { url: updates.metalnessMapUrl, mapKey: 'metalnessMap', origKey: '_originalMetalnessMap' },
      { url: updates.emissiveMapUrl, mapKey: 'emissiveMap', origKey: '_originalEmissiveMap' },
    ]
    for (const { url, mapKey, origKey } of texChannels) {
      if (url === undefined) continue
      if (url) {
        if (!m.userData[origKey]) m.userData[origKey] = m[mapKey]
        const tex = new THREE.TextureLoader().load(url)
        if (mapKey === 'map') tex.colorSpace = THREE.SRGBColorSpace
        m[mapKey] = tex
      } else {
        m[mapKey] = m.userData[origKey] ?? null
      }
      m.needsUpdate = true
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils/selection-highlight.ts
git commit -m "feat: SelectionHighlightManager 支持贴图同步

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: 扩展 ComponentProperties UI + 贴图加载逻辑

**Files:**
- Modify: `frontend/src/components/ComponentProperties.tsx`

- [ ] **Step 1: 新增 import**

在文件顶部扩充 import：

```typescript
import { Input, Slider, ColorPicker, Empty, theme, Button, Image } from 'antd'
import { ResourcePicker } from './ResourcePicker'
```

（原有的 `Input, Slider, ColorPicker, Empty, theme` 替换为以上版本）

- [ ] **Step 2: 新增贴图本地 state + 资源选择器激活状态**

在第 38 行 `const [hasMesh, setHasMesh] = useState(false)` 后新增：

```typescript
const [mapUrl, setMapUrl] = useState<string | null>(null)
const [normalMapUrl, setNormalMapUrl] = useState<string | null>(null)
const [roughnessMapUrl, setRoughnessMapUrl] = useState<string | null>(null)
const [metalnessMapUrl, setMetalnessMapUrl] = useState<string | null>(null)
const [emissiveMapUrl, setEmissiveMapUrl] = useState<string | null>(null)
const [texturePickerTarget, setTexturePickerTarget] = useState<string | null>(null)
```

- [ ] **Step 3: 在 useEffect 重置部分增加贴图 state 重置**

在第 56-57 行 `setScaleZ('1')` 和 `setHasMesh(false)` 之间，新增贴图重置：

```typescript
setMapUrl(null)
setNormalMapUrl(null)
setRoughnessMapUrl(null)
setMetalnessMapUrl(null)
setEmissiveMapUrl(null)
```

- [ ] **Step 4: 在 useEffect 恢复部分增加贴图恢复**

在第 102 行 `setOpacity(...)` 之后、`setHasMesh(true)` 之前，新增：

```typescript
if (data?.mapUrl !== undefined) setMapUrl(data.mapUrl)
else setMapUrl(null)
if (data?.normalMapUrl !== undefined) setNormalMapUrl(data.normalMapUrl)
else setNormalMapUrl(null)
if (data?.roughnessMapUrl !== undefined) setRoughnessMapUrl(data.roughnessMapUrl)
else setRoughnessMapUrl(null)
if (data?.metalnessMapUrl !== undefined) setMetalnessMapUrl(data.metalnessMapUrl)
else setMetalnessMapUrl(null)
if (data?.emissiveMapUrl !== undefined) setEmissiveMapUrl(data.emissiveMapUrl)
else setEmissiveMapUrl(null)
```

- [ ] **Step 5: 扩展 save 函数，新增贴图应用到 Three.js 材质**

替换 `save` 函数中的材质保存部分（第 138-149 行）：

```typescript
// 保存材质
if (hasMesh) {
  const meshes: THREE.Mesh[] = []
  selectedObj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh)
  })
  const loader = new THREE.TextureLoader()

  for (const mesh of meshes) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of materials) {
      const mat = m as THREE.MeshStandardMaterial
      mat.color.set(color)
      mat.transparent = true
      mat.opacity = opacity / 100

      // 贴图加载与应用
      const texChannels: Array<{
        url: string | null
        mapKey: keyof Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'emissiveMap'>
        origKey: string
      }> = [
        { url: mapUrl, mapKey: 'map', origKey: '_originalMap' },
        { url: normalMapUrl, mapKey: 'normalMap', origKey: '_originalNormalMap' },
        { url: roughnessMapUrl, mapKey: 'roughnessMap', origKey: '_originalRoughnessMap' },
        { url: metalnessMapUrl, mapKey: 'metalnessMap', origKey: '_originalMetalnessMap' },
        { url: emissiveMapUrl, mapKey: 'emissiveMap', origKey: '_originalEmissiveMap' },
      ]

      for (const { url, mapKey, origKey } of texChannels) {
        if (url) {
          if (!mat.userData[origKey]) mat.userData[origKey] = mat[mapKey]
          const tex = loader.load(url)
          if (mapKey === 'map') tex.colorSpace = THREE.SRGBColorSpace
          mat[mapKey] = tex
        } else {
          // 用户清除了贴图，恢复原始
          mat[mapKey] = mat.userData[origKey] ?? null
          delete mat.userData[origKey]
        }
        mat.needsUpdate = true
      }
    }

    // 同步更新高亮前的原始材质
    const mgr = useEditStore.getState().highlightManager
    if (mgr) {
      mgr.syncToOriginalMaterial(mesh, {
        color, opacity: opacity / 100,
        mapUrl, normalMapUrl, roughnessMapUrl, metalnessMapUrl, emissiveMapUrl,
      })
    }
  }
  updateComponentMaterial(selectedComponentId, {
    color, opacity: opacity / 100,
    mapUrl, normalMapUrl, roughnessMapUrl, metalnessMapUrl, emissiveMapUrl,
  })
}
```

同时扩展 `save` 函数的 deps 数组（第 150 行），追加 `mapUrl, normalMapUrl, roughnessMapUrl, metalnessMapUrl, emissiveMapUrl`。

- [ ] **Step 6: 在 UI 中新增贴图设置区域（颜色/透明度与描述之间）**

在透明度 Slider 区域之后（约第 277 行，`</>` 闭包之前），描述区域之前，新增：

```tsx
{hasMesh && (
  <div style={{ marginTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 8 }}>
    <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>贴图设置</div>
    {([
      { label: '漫反射贴图', value: mapUrl, onChange: setMapUrl, key: 'map' },
      { label: '法线贴图', value: normalMapUrl, onChange: setNormalMapUrl, key: 'normalMap' },
      { label: '粗糙度贴图', value: roughnessMapUrl, onChange: setRoughnessMapUrl, key: 'roughnessMap' },
      { label: '金属度贴图', value: metalnessMapUrl, onChange: setMetalnessMapUrl, key: 'metalnessMap' },
      { label: '自发光贴图', value: emissiveMapUrl, onChange: setEmissiveMapUrl, key: 'emissiveMap' },
    ] as const).map(({ label, value, onChange, key }) => (
      <div key={key} style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 70, fontSize: 11, color: token.colorTextSecondary, flexShrink: 0 }}>{label}</div>
        {value ? (
          <Image
            src={value}
            width={32}
            height={32}
            style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
            preview={{ mask: null as unknown as React.ReactNode }}
          />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: 4, flexShrink: 0,
            background: token.colorFillQuaternary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={token.colorTextQuaternary} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          </div>
        )}
        <Button size="small" onClick={() => setTexturePickerTarget(key)}>选择</Button>
        {value && (
          <Button size="small" danger onClick={() => onChange(null)}>×</Button>
        )}
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 7: 在组件底部新增 ResourcePicker Modal**

在 JSX 返回值的最后一个 div 之后、组件函数结束前，新增：

```tsx
{texturePickerTarget && (
  <ResourcePicker
    open={texturePickerTarget !== null}
    onClose={() => setTexturePickerTarget(null)}
    typeFilter="image"
    multiple={false}
    allowUpload={true}
    onSelect={(items) => {
      if (items.length > 0) {
        const url = items[0].url
        switch (texturePickerTarget) {
          case 'map': setMapUrl(url); break
          case 'normalMap': setNormalMapUrl(url); break
          case 'roughnessMap': setRoughnessMapUrl(url); break
          case 'metalnessMap': setMetalnessMapUrl(url); break
          case 'emissiveMap': setEmissiveMapUrl(url); break
        }
      }
      setTexturePickerTarget(null)
    }}
  />
)}
```

- [ ] **Step 8: 调整 SceneTree Modal 宽度**

修改 `frontend/src/components/SceneTree.tsx` 第 305 行，将 Modal 宽度从 `360` 改为 `420`：

```tsx
<Modal
  title="编辑构件属性"
  open={editingId !== null}
  onCancel={() => setEditingId(null)}
  width={420}
```

并给 Modal body 加 `styles` 属性：

```tsx
  styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/ComponentProperties.tsx frontend/src/components/SceneTree.tsx
git commit -m "feat: ComponentProperties 弹窗支持 PBR 贴图选择与加载

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: 扩展 edit-apply.ts 贴图恢复

**Files:**
- Modify: `frontend/src/utils/edit-apply.ts:17-20`, `:72-95`

- [ ] **Step 1: 扩展 material 接口，新增贴图字段**

修改第 17-20 行 material 类型注解：

```typescript
material?: {
  color?: string
  opacity?: number | null
  mapUrl?: string | null
  normalMapUrl?: string | null
  roughnessMapUrl?: string | null
  metalnessMapUrl?: string | null
  emissiveMapUrl?: string | null
}
```

- [ ] **Step 2: 扩展材质应用逻辑，新增贴图纹理加载**

替换第 72-95 行的 `if (edit.material)` 块：

```typescript
if (edit.material) {
  target.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial
        if (edit.material!.color) {
          if (!mat.userData._originalColor) {
            mat.userData._originalColor = mat.color.getHexString()
          }
          mat.color.set(edit.material!.color)
        }
        if (edit.material!.opacity !== null && edit.material!.opacity !== undefined) {
          if (mat.userData._originalOpacity === undefined) {
            mat.userData._originalOpacity = mat.opacity
          }
          mat.transparent = edit.material!.opacity < 1
          mat.opacity = edit.material!.opacity
          mat.needsUpdate = true
        }
        // 贴图恢复
        const loader = new THREE.TextureLoader()
        const texChannels: Array<{
          url: string | null | undefined
          mapKey: keyof Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'emissiveMap'>
          origKey: string
        }> = [
          { url: edit.material!.mapUrl, mapKey: 'map', origKey: '_originalMap' },
          { url: edit.material!.normalMapUrl, mapKey: 'normalMap', origKey: '_originalNormalMap' },
          { url: edit.material!.roughnessMapUrl, mapKey: 'roughnessMap', origKey: '_originalRoughnessMap' },
          { url: edit.material!.metalnessMapUrl, mapKey: 'metalnessMap', origKey: '_originalMetalnessMap' },
          { url: edit.material!.emissiveMapUrl, mapKey: 'emissiveMap', origKey: '_originalEmissiveMap' },
        ]
        for (const { url, mapKey, origKey } of texChannels) {
          if (url !== null && url !== undefined) {
            if (!mat.userData[origKey]) mat.userData[origKey] = mat[mapKey]
            const tex = loader.load(url)
            if (mapKey === 'map') tex.colorSpace = THREE.SRGBColorSpace
            mat[mapKey] = tex
            mat.needsUpdate = true
          }
        }
      })
    }
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/edit-apply.ts
git commit -m "feat: edit-apply 支持贴图恢复

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: 扩展 SceneEditorPage 保存/加载 + scene-config.ts

**Files:**
- Modify: `frontend/src/pages/SceneEditorPage.tsx:287-296`, `:413-422`
- Modify: `frontend/src/utils/scene-config.ts:23-32`, `:165-181`

- [ ] **Step 1: 扩展 restore 逻辑，读取贴图字段**

修改 `SceneEditorPage.tsx` 第 287-296 行：

```typescript
restoredEditData[child.uuid] = {
  position: child.position.toArray() as [number, number, number],
  rotation: [child.rotation.x, child.rotation.y, child.rotation.z] as [number, number, number],
  scale: child.scale.toArray() as [number, number, number],
  color: override?.color ?? null,
  opacity: override?.opacity ?? null,
  mapUrl: override?.mapUrl ?? null,
  normalMapUrl: override?.normalMapUrl ?? null,
  roughnessMapUrl: override?.roughnessMapUrl ?? null,
  metalnessMapUrl: override?.metalnessMapUrl ?? null,
  emissiveMapUrl: override?.emissiveMapUrl ?? null,
  visible: child.visible,
  name: child.name || null,
  description: desc || override?.description || null,
}
```

- [ ] **Step 2: 扩展 save 逻辑，写入贴图字段**

修改 `SceneEditorPage.tsx` 第 413-422 行：

```typescript
modelEdits[key] = {
  ...existing,
  ...(data.color != null && { color: data.color }),
  ...(data.opacity != null && { opacity: data.opacity }),
  ...(data.mapUrl != null && { mapUrl: data.mapUrl }),
  ...(data.normalMapUrl != null && { normalMapUrl: data.normalMapUrl }),
  ...(data.roughnessMapUrl != null && { roughnessMapUrl: data.roughnessMapUrl }),
  ...(data.metalnessMapUrl != null && { metalnessMapUrl: data.metalnessMapUrl }),
  ...(data.emissiveMapUrl != null && { emissiveMapUrl: data.emissiveMapUrl }),
  ...(data.description != null && { description: data.description }),
  position: data.position,
  rotation: data.rotation,
  scale: data.scale,
}
```

- [ ] **Step 3: 扩展 scene-config.ts 序列化**

修改 `ComponentEditRaw` 接口（第 23-32 行）：

```typescript
interface ComponentEditRaw {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  color?: string
  opacity?: number
  mapUrl?: string | null
  normalMapUrl?: string | null
  roughnessMapUrl?: string | null
  metalnessMapUrl?: string | null
  emissiveMapUrl?: string | null
  visible?: boolean
  name?: string | null
  description?: string | null
}
```

修改 `serializeComponents` 函数（第 165-181 行）：

```typescript
function serializeComponents(editData: Record<string, ComponentEditRaw | null>) {
  const result: Record<string, ComponentEditRaw> = {}
  for (const [uuid, data] of Object.entries(editData)) {
    if (!data) continue
    result[uuid] = {
      position: data.position,
      rotation: data.rotation,
      scale: data.scale,
      color: data.color,
      opacity: data.opacity,
      mapUrl: data.mapUrl,
      normalMapUrl: data.normalMapUrl,
      roughnessMapUrl: data.roughnessMapUrl,
      metalnessMapUrl: data.metalnessMapUrl,
      emissiveMapUrl: data.emissiveMapUrl,
      visible: data.visible,
      name: data.name,
      description: data.description,
    }
  }
  return result
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/SceneEditorPage.tsx frontend/src/utils/scene-config.ts
git commit -m "feat: SceneEditorPage 保存/加载 + scene-config 支持贴图字段

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: 验证

- [ ] **Step 1: 类型检查**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 2: 启动 dev server**

```bash
pnpm dev
```

- [ ] **Step 3: 功能验证清单**

1. 打开场景编辑器 → 模型 Tab → 展开树节点 → 点击齿轮图标
2. 确认弹窗内出现"贴图设置"区域，5 个贴图通道各含缩略图占位 + 选择按钮
3. 点击"选择" → 弹出资源库选择器 → 选一张图片 → 弹窗内显示缩略图
4. 点击弹窗"保存" → 模型在 3D 视图中显示贴图
5. 点击 × 清除贴图 → 模型恢复无贴图状态
6. 保存场景 → 刷新 → 贴图正确恢复
7. 导出场景配置 → .js 文件包含 `mapUrl` 等字段
