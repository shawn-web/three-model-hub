# 场景编辑器增强设计

## 概述

对场景编辑器进行全面增强，包括：缩略图设置、保存机制、背景设置、编辑工具、组件级编辑，以及测量工具改进。预览页仅保留展示功能。

---

## 一、缩略图设置

### 模型缩略图
- 模型编辑页工具栏增加"设为封面"按钮
- 点击后对 Canvas 截图（`canvas.toDataURL()`），上传到文件服务，更新 `models.thumbnail_url`
- 后端已有 `PATCH /models/:id`，无需新接口

### 场景缩略图
- 场景编辑器工具栏增加"设为封面"按钮
- 同样的截图→上传→更新 `scenes.thumbnail_url` 流程
- 后端已有 `PATCH /scenes/:id`

### 截图流程
1. 获取 R3F Canvas DOM 元素
2. `canvas.toDataURL('image/png')` 生成 base64
3. 转为 Blob，通过现有文件上传服务上传
4. 获取返回的 URL，调用 `PATCH /scenes/:id { thumbnail_url: url }`

---

## 二、保存机制 + 脏检查

### Transform 持久化
- 编辑器中拖拽/旋转/缩放组件后，变更写入 `editStore.editData`
- 点击"保存"时：
  1. 遍历场景中所有 scene_model
  2. 将 editData 中每个构件的 transform/visible/material 映射到 scene_model 的 `transform`、`material_overrides`、`visible` 字段
  3. 调用批量更新接口

### 批量更新接口
- `PATCH /scenes/:id/models/batch`
- 请求体：
```json
{
  "models": [
    {
      "id": "scene_model_uuid",
      "transform": { "position": [0,0,0], "rotation": [0,0,0], "scale": [1,1,1] },
      "material_overrides": { "components": { ... } },
      "visible": true
    }
  ]
}
```
- 后端循环调用 `sceneModelRepo.update()`

### 脏检查（Dirty Tracking）
- `editStore` 增加 `isDirty: boolean`
- 任何编辑操作（transform、材质、可见性）后置为 `true`
- 保存成功后置为 `false`
- 初始加载完成后也置为 `false`

### 保存提示
- 点击"预览"按钮 → 检查 isDirty → 弹窗确认（保存/不保存/取消）
- 点击"返回"按钮 → 同上
- 浏览器 `beforeunload` 事件拦截（isDirty 时弹出浏览器原生提示）

### 预览页加载
- `loadSceneModels` 读取每个 scene_model 的 `transform`，在加载完成后应用到对应模型对象
- 读取 `material_overrides`，应用材质和可见性

---

## 三、场景背景设置

### 数据结构
`scene_config.background` 存储背景配置：
```typescript
type BackgroundConfig =
  | { type: 'color'; color: string }
  | { type: 'image'; url: string }
  | { type: 'skybox'; urls: [string, string, string, string, string, string] }
  | { type: 'hdr'; url: string }
```

### 编辑器 UI
- 左侧面板"场景设置"区域
- 背景类型下拉选择（纯色/图片/天空盒/HDR）
- 纯色 → 颜色选择器（antd ColorPicker）
- 图片/天空盒/HDR → 文件上传按钮 + URL 输入框
- 上传走现有文件服务，URL 写入 scene_config

### R3F 渲染
共用背景渲染组件（SceneBackground），场景编辑器和预览页都使用：
- 纯色 → `scene.background = new THREE.Color(color)`
- 图片 → `TextureLoader` 加载 → `scene.background = texture`
- 天空盒 → `CubeTextureLoader` 加载 6 张图 → `scene.background = cubeTexture`
- HDR → `RGBELoader` 加载 → `scene.background + scene.environment = hdrTexture`
- 无配置时默认 `#1a1a2e`

### 依赖
- `three/examples/jsm/loaders/RGBELoader`（HDR 支持）

---

## 四、编辑器增强工具栏

### 布局
- 左侧面板：上方"组件树"，下方"场景设置"（背景/灯光配置）
- 底部工具栏：移动/旋转/缩放 + 截图 + 设为封面 + 适配视图

### 工具栏按钮

| 按钮 | 功能 | 快捷键 |
|------|------|--------|
| 移动 | TransformControls translate | W |
| 旋转 | TransformControls rotate | E |
| 缩放 | TransformControls scale | R |
| 截图 | Canvas 截图下载 | - |
| 设为封面 | 截图上传为缩略图 | - |
| 适配视图 | 相机聚焦模型 | - |

### 快捷键
- `W` 移动、`E` 旋转、`R` 缩放
- `Ctrl+S` 保存
- `Ctrl+Z` 撤销、`Ctrl+Shift+Z` 重做（已有）

### 添加图片
- 场景设置面板中，背景类型选择图片/天空盒/HDR 时显示上传按钮
- 上传走现有文件服务（StorageService），返回 URL 写入 scene_config
- 支持直接粘贴 URL

---

## 五、组件树 + 构件级编辑

### 组件树面板（左侧上方）
- 复用 ViewerTree 的 `buildTreeData` 逻辑，遍历 modelObject 的 Object3D 层级
- 每个节点支持：
  - **勾选框** → 控制该构件 `visible`，联动 3D 视图
  - **点击选中** → 高亮该构件，TransformControls 绑定到该构件
  - **展开折叠** → 显示子级结构

### 选中构件操作
- **变换**：底部工具栏切换模式，TransformControls 操作选中构件
- **材质编辑**：选中后右侧弹出属性面板 → 颜色选择器、透明度滑块
- **属性查看**：显示构件名称、类型（Mesh/Group）、位置(x,y,z)、缩放
- **自定义描述**：可编辑文本字段，保存到 material_overrides

### 数据持久化
`material_overrides` 结构：
```json
{
  "components": {
    "uuid-xxx": {
      "color": "#ff0000",
      "opacity": 0.8,
      "description": "承重墙",
      "name": "Wall-001"
    }
  }
}
```

### 预览页
- 仅保留展示功能：组件树可见性控制 + 视点 + 批注
- 不带编辑能力
- 读取编辑器保存的 material_overrides 应用材质和可见性

---

## 六、测量工具改进

### 问题
- 点击标记球体太小
- 点击点未严格贴合模型表面
- 两个测量点之间无连线

### 改进
- 标记球体半径从 0.05 增大到 0.15（或根据模型包围盒自适应）
- 使用 `Raycaster.intersectObject()` 的 hit point 确保点在模型表面
- 两个测量点之间画 `THREE.Line` 连线
- 连线中点显示距离文字标签（CSS2DRenderer 或 Sprite）

---

## 涉及文件

| 文件 | 改动内容 |
|------|---------|
| `frontend/src/pages/SceneEditorPage.tsx` | 重构左侧面板，增加组件树和场景设置 |
| `frontend/src/pages/ViewerPage.tsx` | 背景渲染、material_overrides 应用 |
| `frontend/src/components/EditCanvas.tsx` | 背景渲染组件集成 |
| `frontend/src/components/EditSceneSetup.tsx` | 组件选中高亮、快捷键、背景 |
| `frontend/src/components/EditToolbar.tsx`（新建）| 编辑器工具栏 |
| `frontend/src/components/SceneTree.tsx`（新建）| 编辑器组件树 |
| `frontend/src/components/SceneSettings.tsx`（新建）| 场景设置面板（背景/灯光）|
| `frontend/src/components/ComponentProperties.tsx`（新建）| 构件属性面板 |
| `frontend/src/components/SceneBackground.tsx`（新建）| 背景渲染组件 |
| `frontend/src/store/edit-store.ts` | 增加 isDirty、背景配置、选中构件 |
| `frontend/src/api/scenes.ts` | 增加 batchUpdateModels 接口 |
| `frontend/src/utils/multi-model-loader.ts` | 加载时应用 transform 和 material |
| `frontend/src/plugins/measurement/index.tsx` | 测量工具改进 |
| `backend/src/scenes/scenes.controller.ts` | 增加 batch update 端点 |
| `backend/src/scenes/scenes.service.ts` | 批量更新逻辑 |
| `backend/src/scenes/dto/` | batch update DTO |

---

## 实现优先级

1. **P0（核心）**：保存机制 + 脏检查 + 保存提示 + transform 持久化
2. **P0（核心）**：组件树 + 选中高亮 + 变换操作
3. **P1（重要）**：缩略图设置
4. **P1（重要）**：背景设置（纯色 → 图片 → 天空盒 → HDR）
5. **P1（重要）**：测量工具改进
6. **P2（增强）**：材质编辑 + 属性查看 + 自定义描述
7. **P2（增强）**：快捷键
