# 标点重定位 + 媒体管理扩展 + 属性修正 + 按钮固定

## 概述

4 个相关需求的设计方案，涉及标点/媒体的点击重定位、图片管理扩展为媒体管理、属性输入框修正、保存按钮位置固定。

## 需求 1：标点/媒体点击重定位

### 问题

- 标点创建后标记错误位置，只能通过 MarkerConfigPanel 的"点击模型重定位"按钮才能重新定位，操作路径太深
- 媒体（图片）放置后无法在列表中直接触发重定位

### 方案

**标点重定位**：

1. 在 MarkerList 的每个列表项上增加一个"重定位"图标按钮（十字准星图标）
2. 点击后设置 `editingMarkerId = marker.id`，进入重定位模式
3. 在模型上点击即更新标点位置，退出重定位模式
4. 复用现有的 `editingMarkerId` 机制（与 MarkerConfigPanel 中的"点击模型重定位"逻辑一致）

**媒体重定位**：

1. 在媒体卡片上增加"重定位"按钮
2. 点击后设置 `placingImageId = media.id`，进入放置模式
3. 在模型上点击即更新媒体位置，退出放置模式
4. 复用现有的 `placingImageId` 机制

### 涉及文件

- `frontend/src/pages/SceneEditorPage.tsx` — MarkerList 组件，加"重定位"按钮
- `frontend/src/components/SceneImagePanel.tsx` — 媒体卡片，加"重定位"按钮

## 需求 2：图片管理 → 媒体管理

### 问题

- 当前面板只支持图片，需要扩展为支持图片、视频、文字标注、网页 iframe 四种类型

### 方案

#### 数据类型

将 `SceneImage` 扩展为 `SceneMedia`：

```typescript
export interface SceneMedia {
  id: string
  type: 'image' | 'video' | 'text' | 'iframe'
  url?: string
  name: string
  width: number
  height: number
  position?: [number, number, number]
  scale?: [number, number, number]  // 仅 X/Y 有意义（平面无厚度）
  rotation?: [number, number, number]
  visible: boolean
  billboard?: boolean
  // 视频专用
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  // 文字标注专用
  text?: string
  fontSize?: number
  fontColor?: string
  // iframe 专用
  iframeUrl?: string
}
```

#### 面板改造

- 面板名称从"图片管理"改为"媒体管理"
- 添加按钮改为下拉选择：图片 / 视频 / 文字标注 / 网页嵌入
- 图片：复用现有 ResourcePicker
- 视频：ResourcePicker 允许视频文件
- 文字标注：直接输入文本内容，无需上传
- 网页嵌入：输入 URL

#### 各类型属性编辑

| 属性 | 图片 | 视频 | 文字标注 | iframe |
|------|------|------|----------|--------|
| 名称 | ✓ | ✓ | ✓ | ✓ |
| 可见性 | ✓ | ✓ | ✓ | ✓ |
| 宽/高 | ✓ | ✓ | ✓ | ✓ |
| 位置 X/Y/Z | ✓ | ✓ | ✓ | ✓ |
| 缩放 X/Y | ✓ | ✓ | ✓ | ✓ |
| 旋转 Z | ✓ | ✓ | ✓ | ✓ |
| 始终面向相机 | ✓ | ✓ | ✓ | ✓ |
| 自动播放 | - | ✓ | - | - |
| 静音 | - | ✓ | - | - |
| 循环 | - | ✓ | - | - |
| 文字内容 | - | - | ✓ | - |
| 字号 | - | - | ✓ | - |
| 字色 | - | - | ✓ | - |
| 网页 URL | - | - | - | ✓ |

#### 3D 渲染

- **图片**：保持 Sprite 现有实现
- **视频**：`<video>` 元素 + `VideoTexture` 贴到 `PlaneGeometry`
- **文字标注**：Canvas 绘制文字，贴到 Sprite
- **iframe**：`CSS2DRenderer` 嵌入 HTML `<iframe>` 元素

### 涉及文件

- `frontend/src/types/edit-data.ts` — SceneImage → SceneMedia
- `frontend/src/store/edit-store.ts` — 所有 sceneImage 相关改为 sceneMedia
- `frontend/src/components/SceneImagePanel.tsx` → 重命名为 `SceneMediaPanel.tsx`
- `frontend/src/components/EditSceneSetup.tsx` — 渲染不同类型的媒体
- `frontend/src/components/EditPanel.tsx` — 引用改名
- `frontend/src/pages/SceneEditorPage.tsx` — 保存逻辑、引用改名
- `frontend/src/api/scenes.ts` — API 类型适配

## 需求 3：属性输入框修正

### 问题

- `SceneImagePanel` 中位置输入框使用了 `['position', 0, 1, 2]` 数组（4 个元素），导致渲染了 4 个输入框而非 3 个
- 图片是平面，没有厚度，缩放不需要 Z 轴，旋转只需 Z 轴

### 方案

- **位置**：3 个输入框 (X, Y, Z) — 平面在 3D 空间中的位置需要三个坐标
- **缩放**：2 个输入框 (X, Y) — 平面只有宽和高方向
- **旋转**：1 个输入框 (Z) — 平面只需要绕法线方向旋转
- 修复 `['position', 0, 1, 2]` → `[0, 1, 2]`

### 涉及文件

- `frontend/src/components/SceneImagePanel.tsx`（已合并到媒体面板改造中）

## 需求 4：保存/预览按钮固定在 Sider 底部

### 问题

- 当前按钮在画布左下角（`absolute bottom-3 left-3`），用户期望固定在左侧面板底部

### 方案

将按钮从 `Content` 区域移到 `Sider` 内部底部：

```
Sider
├── 顶栏（场景名称、返回按钮等）
├── EditPanel（flex: 1, overflow: auto）
└── 底栏（保存/预览按钮，flex-shrink: 0）
```

### 涉及文件

- `frontend/src/pages/SceneEditorPage.tsx` — 按钮位置移动
