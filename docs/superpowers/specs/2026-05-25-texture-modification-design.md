# 贴图修改功能设计

## 概述

在场景编辑器的模型组件属性弹窗中，新增全部 PBR 贴图通道的修改能力。用户可以从资源库中选择图片，应用到组件的漫反射、法线、粗糙度、金属度、自发光贴图通道上。

## 需求

- 支持全部 PBR 贴图通道：map、normalMap、roughnessMap、metalnessMap、emissiveMap
- 贴图图片来源：从现有资源库（Resources）中选择
- 数据存储：扩展现有 `material_overrides` JSON 字段
- 配置文件同步：scene-config.ts 导入/导出需支持新字段

## 方案

**方案 A：扩展现有 ComponentProperties 弹窗**（已选定）

在现有颜色/透明度弹窗内，新增贴图通道区域。每个通道显示缩略图预览 + 选择按钮 + 清除按钮。

选择理由：
- 不改变现有交互模式，改动最小
- 复用现有保存/取消流程
- 与颜色/透明度编辑在同一弹窗中，逻辑连贯

## 数据结构

### 前端 EditComponentData 扩展

```typescript
interface EditComponentData {
  // 现有字段
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string | null
  opacity: number | null
  visible: boolean
  name: string | null
  description: string | null
  _deleted?: boolean
  // 新增贴图字段
  mapUrl: string | null
  normalMapUrl: string | null
  roughnessMapUrl: string | null
  metalnessMapUrl: string | null
  emissiveMapUrl: string | null
}
```

### 后端 material_overrides 格式

在现有 `material_overrides.components[key]` 中新增贴图 URL 字段：

```json
{
  "components": {
    "nodeName": {
      "color": "#ff0000",
      "opacity": 0.8,
      "mapUrl": "/uploads/xxx.png",
      "normalMapUrl": null,
      "roughnessMapUrl": null,
      "metalnessMapUrl": null,
      "emissiveMapUrl": null,
      "transform": { "position": [0,0,0], "rotation": [0,0,0], "scale": [1,1,1] },
      "visible": true,
      "name": null,
      "description": null
    }
  }
}
```

后端 DTO 无需修改（`material_overrides` 已是 `Record<string, any>`）。

## UI 交互

### ComponentProperties 弹窗布局

```
┌─────────────────────────────┐
│ 颜色：  [ColorPicker]        │
│ 透明度：[────●────] 80%      │
│ ─────────────────────────── │
│ 贴图设置                     │
│                             │
│ 漫反射贴图  [缩略图] [选择] [×] │
│ 法线贴图    [缩略图] [选择] [×] │
│ 粗糙度贴图  [缩略图] [选择] [×] │
│ 金属度贴图  [缩略图] [选择] [×] │
│ 自发光贴图  [缩略图] [选择] [×] │
│                             │
│           [取消]  [保存]      │
└─────────────────────────────┘
```

- 缩略图：64×64 px，无贴图时显示占位图标
- 选择按钮：弹出资源库选择器（Ant Design Modal）
- 清除按钮（×）：移除该通道贴图，恢复默认
- 弹窗 body 设置 `max-height` + `overflow-y: auto` 支持滚动

### 资源库选择器

复用 Resources API（`/api/resources`），弹窗展示资源列表，筛选图片类型，支持分页。选择后返回资源 URL。

## Three.js 贴图处理

### 贴图应用（编辑器侧 - ComponentProperties.save）

1. 遍历选中组件的所有子 Mesh
2. URL 非空时：`TextureLoader.load(url)` 加载贴图，赋值到材质对应属性
3. 保存原始贴图到 `userData._originalMap` / `_originalNormalMap` 等
4. 设置 `mat.needsUpdate = true`
5. URL 为空（清除）时：恢复原始贴图或设为 null

### 贴图恢复（加载保存数据）

`edit-apply.ts` 的 `applyEditData()` 需扩展，加载场景时重新加载保存的贴图 URL 到材质。

### SelectionHighlightManager 同步

`syncToOriginalMaterial()` 需支持贴图字段同步，防止高亮切换覆盖贴图修改。

### 配置文件

`scene-config.ts` 的 `serializeComponents()` 和 `deserializeComponents()` 同步支持 5 个贴图 URL 字段。

## 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/ComponentProperties.tsx` | 新增贴图通道 UI、TextureLoader 加载逻辑 |
| `frontend/src/components/SceneTree.tsx` | Modal 高度适配 |
| `frontend/src/store/edit-store.ts` | EditComponentData 新增 5 个贴图字段、updateComponentMaterial 扩展 |
| `frontend/src/types/edit-data.ts` | ComponentEdit 的 material 类型新增贴图字段 |
| `frontend/src/utils/edit-apply.ts` | applyEditData 扩展贴图恢复 |
| `frontend/src/utils/selection-highlight.ts` | syncToOriginalMaterial 扩展贴图同步 |
| `frontend/src/utils/scene-config.ts` | 序列化/反序列化支持贴图字段 |
| `frontend/src/pages/SceneEditorPage.tsx` | handleSaveAll 和加载逻辑扩展贴图字段 |
