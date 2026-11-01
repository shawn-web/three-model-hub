# 预览页树交互 + 场景切换闪烁修复

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复预览页模型树与3D场景的双向交互（选中高亮），以及场景编辑器切换时旧场景闪烁的问题。

**Architecture:**
- 问题1：ViewerTree 读写 `useViewerStore.selectedComponentId`，但 SceneSetup/XRay 插件从 `useSceneStore.selectedComponentId` 读取。修复方式是让 ViewerTree 直接使用 sceneStore 的选中状态，并在 SceneSetup 的 view 模式下添加轻量点击处理。
- 问题2：SceneEditorPage 卸载时不清理全局 store。修复方式是添加 cleanup effect 调用 `resetScene()` 和 `resetEdit()`。

**Tech Stack:** React 19, Zustand, Three.js, Ant Design Tree

---

### Task 1: 修复 ViewerTree 使用 sceneStore 的选中状态

**Files:**
- Modify: `frontend/src/components/ViewerTree.tsx`

**背景：** ViewerTree 当前读写 `useViewerStore.selectedComponentId`，但 SceneSetup 和 XRay 插件从 `useSceneStore.selectedComponentId` 读取。需要统一到 sceneStore。

- [ ] **Step 1: 修改 ViewerTree 的 store 引用**

在 `ViewerTree.tsx` 中：

1. 将 `import { useViewerStore }` 改为同时引入 `useSceneStore`
2. 将 `selectedComponentId` 从 viewerStore 改为从 sceneStore 读取
3. 将 `handleSelect` 中的 setter 改为写入 sceneStore
4. 同时改进 `buildTreeData`，使用与 SceneTree 相同的 `shouldShowInTree` 过滤器

需要修改的具体位置：

```tsx
// 新增 import
import { useViewerStore } from '../store/viewer-store'
import { useSceneStore } from '../store/scene-store'

// 新增 shouldShowInTree（与 SceneTree 一致）
function shouldShowInTree(object: THREE.Object3D): boolean {
  if ((object as THREE.Object3D & { isMarker?: boolean }).isMarker) return false
  if (object.type === 'GridHelper' || object.type === 'BoxHelper') return false
  if (object.type.endsWith('Light')) return false
  if (object.type === 'ShadowMaterial') return false
  return true
}

// 修改 buildTreeData：使用 shouldShowInTree 过滤子节点
function buildTreeData(object: THREE.Object3D, isRoot: boolean = false): TreeDataNode[] {
  const displayName = isRoot ? '模型' : (object.name || object.type)
  const node: TreeDataNode = {
    key: object.uuid,
    title: displayName,
  }
  if (object.children.length > 0) {
    node.children = object.children
      .filter(shouldShowInTree)
      .map((child) => buildTreeData(child, false)[0])
      .filter(Boolean)
  }
  return [node]
}
```

在 `ViewerTree` 组件内：

```tsx
// 改为从 sceneStore 读取（因为 SceneSetup 和 XRay 插件都使用 sceneStore）
const selectedComponentId = useSceneStore((s) => s.selectedComponentId)

// handleSelect 改为写入 sceneStore
const handleSelect: TreeProps['onSelect'] = useCallback((keys) => {
  const key = keys[0] as string | undefined
  useSceneStore.getState().selectComponent(key ?? null)
}, [])
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```
feat: ViewerTree 使用 sceneStore 统一选中状态，添加节点过滤
```

---

### Task 2: SceneSetup 添加 view 模式点击选中

**Files:**
- Modify: `frontend/src/components/SceneSetup.tsx`

**背景：** 当前 SceneSetup 只在 edit 模式注册 `onClick` 处理。view 模式也需要：点击 3D 构件 → 设置 sceneStore.selectedComponentId，使 XRay 插件自动高亮。

- [ ] **Step 1: 添加 view 模式的点击处理**

在 `SceneSetup.tsx` 中，找到 `handleClick` 回调（约第296行），修改使其同时支持 edit 和 view 模式。

当前 `handleClick` 的逻辑：
- 标记放置模式（仅 edit）
- 图像放置模式（仅 edit）
- 变换模式选择（仅 edit）

需要做的修改：在现有 `handleClick` 的最前面（所有 edit-only 逻辑之前），添加 view 模式的选中逻辑。

```tsx
const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
  if (!modelObject) return
  event.stopPropagation()

  // view 模式：点击选中/取消选中构件
  if (config.mode === 'view') {
    const target = event.object
    if (target === modelObject) {
      useSceneStore.getState().selectComponent(null)
      return
    }
    // 向上查找到直接挂在 modelObject 下的 wrapper 级别
    let wrapper: THREE.Object3D | null = target
    while (wrapper && wrapper.parent !== modelObject) {
      wrapper = wrapper.parent
    }
    if (!wrapper || wrapper === modelObject) {
      useSceneStore.getState().selectComponent(null)
      return
    }
    const targetId = wrapper.uuid
    const currentId = useSceneStore.getState().selectedComponentId
    useSceneStore.getState().selectComponent(targetId === currentId ? null : targetId)
    return
  }

  // 以下为 edit 模式原有逻辑...
  const editState = useEditStore.getState()
  // ...（保持不变）
}, [config.mode, modelObject, selectedComponentId])
```

然后修改 primitive 的 onClick，改为在 view 模式也注册：

```tsx
<primitive
  object={modelObject}
  onClick={handleClick}
  onDoubleClick={config.mode === 'edit' ? handleDoubleClick : undefined}
/>
```

注意：`handleDoubleClick` 仍仅在 edit 模式注册。

- [ ] **Step 2: 验证 TypeScript 编译通过**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```
feat: 预览模式支持点击3D构件选中高亮
```

---

### Task 3: 场景编辑器卸载时清理 store

**Files:**
- Modify: `frontend/src/pages/SceneEditorPage.tsx`

**背景：** 从场景 A 的编辑页导航到场景 B 的编辑页时，场景 A 的 modelObject、editData 等仍保留在全局 store 中，导致新页面先渲染旧数据再切换到新数据。需要在组件卸载时调用 `resetScene()` 和 `resetEdit()`。

- [ ] **Step 1: 添加 cleanup effect**

在 `SceneEditorPage.tsx` 的 `SceneEditorPage` 函数组件内（约第92行之后），添加清理 effect：

```tsx
import { useSceneStore } from '../store/scene-store'
// useEditStore 已经 import 了

// 组件卸载时清理全局 store，防止切到其他场景时残留旧数据
useEffect(() => {
  return () => {
    useSceneStore.getState().resetScene()
    useEditStore.getState().resetEdit()
  }
}, [])
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```
fix: 场景编辑器卸载时清理 store，防止切换场景时旧场景闪烁
```

---

### Task 4: 端到端验证

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm dev` + `pnpm backend:dev`

- [ ] **Step 2: 验证预览页树交互**

1. 打开一个场景编辑页，保存后点击"预览"
2. 在预览页：点击树节点 → 3D 构件应高亮（青色 emissive）
3. 在预览页：点击 3D 构件 → 树节点应选中
4. 取消选中（点击空白处或再次点击）→ 高亮消失
5. 勾选框控制可见性正常工作

- [ ] **Step 3: 验证场景切换无闪烁**

1. 打开场景 A 的编辑页（场景 A 应有模型）
2. 点击返回按钮回到场景列表
3. 进入场景 B 的编辑页
4. 应该只看到 loading 状态，然后显示场景 B 的模型
5. 不应出现场景 A 的模型闪烁

- [ ] **Step 4: Final commit (if needed)**

如果验证中发现需要额外修复，提交修复。
