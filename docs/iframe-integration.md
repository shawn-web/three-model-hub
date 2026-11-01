# iframe 嵌入集成指南

ThreeModelHub 支持把 3D 查看器 / Geo 地球页嵌入到任意第三方系统，并通过 `postMessage` 双向通信。

> 本文档以当前代码实现为准。协议中已定义但尚未接入的消息会明确标注「预留」，避免接入方按文档实现后发现无效。

---

## 1. 两种嵌入形态

| 形态 | 路由 | 说明 | 适用场景 |
|------|------|------|----------|
| **直接嵌入查看器** | `/view/:sceneId` | 全屏查看器，无导航栏，支持 URL 参数与 postMessage | 大多数场景，推荐 |
| **嵌入包装页** | `/iframe/:sceneId` | 内部再用 `<iframe>` 加载查看器，并在转发 `media-clicked` 等事件 | 需要在包装层统一改写事件时 |

`:sceneId` 既可以是**场景 ID**，也可以是**模型 ID**：前端会先尝试按场景加载，失败后回退为单模型加载。

Geo 地球页独立路由：`/maps/:mapId`。

---

## 2. 最小示例

```html
<!-- 父页面 -->
<iframe
  id="viewer"
  src="https://your-host/view/SCENE_ID?toolbar=false&tree=false"
  width="100%"
  height="720"
  style="border:0"
  allow="fullscreen"
></iframe>

<script>
  const viewer = document.getElementById('viewer')

  window.addEventListener('message', (event) => {
    // 必须校验来源，否则任何页面都能向你投递伪造消息
    if (event.origin !== 'https://your-host') return

    const { type, payload } = event.data || {}
    if (type === 'viewer-ready') {
      console.log('查看器已就绪')
    }
    if (type === 'model-loaded') {
      console.log('模型加载完成', payload.metadata)
    }
  })
</script>
```

---

## 3. URL 参数

参数由 `frontend/src/communication/url-params.ts` 统一解析，查看器与 Geo 页共用同一套语义。

### 3.1 查看器（`/view/:sceneId`）

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `toolbar` | `true` \| `false` | `true` | 是否显示左侧工具栏 |
| `tree` | `true` \| `false` | `true` | 是否显示模型树面板 |
| `tools` | 逗号分隔 | 空 | 仅启用指定工具，如 `measurement,section` |
| `environment` | 字符串 | 空 | 环境预设名 |
| `editData` | URL | 空 | 外部编辑数据地址 |
| `allowedOrigins` | 逗号分隔 | 空 | postMessage 白名单（见 §5） |

### 3.2 Geo 页（`/maps/:mapId`）

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `imagery` | `tianditu` \| `google` 等 | 服务端配置 | 底图厂商 |
| `type` | `satellite` \| `vector` \| `terrain` | 服务端配置 | 图层类型 |
| `toolbar` | `true` \| `false` | `true` | 是否显示工具栏 |
| `panel` | `true` \| `false` | `true` | 是否显示侧边面板 |
| `visibleModelIds` | 逗号分隔 | 不过滤 | **三态语义**：未传 = 全部显示；传空串 = 全部隐藏；传值 = 白名单 |
| `hiddenTools` | 逗号分隔 | 空 | 隐藏的工具栏按钮 ID |
| `showMarkers` | `true` \| `false` | `true` | 是否显示标点 |
| `camera` | JSON | 空 | 初始视角，见下 |
| `allowedOrigins` | 逗号分隔 | 空 | postMessage 白名单 |

`camera` 示例（需 URL 编码）：

```text
?camera={"longitude":116.39,"latitude":39.9,"altitude":2000,"heading":0,"pitch":-45,"range":5000}
```

> `viewpoint` 是 `camera` 的兼容别名，新代码请使用 `camera`。

---

## 4. postMessage 协议

### 4.1 消息信封

```ts
{
  type: string,      // 消息类型
  payload: unknown,  // 负载
  requestId?: string // 预留：请求-响应关联
}
```

### 4.2 父页面 → 查看器（当前已实现）

| 消息类型 | payload | 说明 |
|----------|---------|------|
| `scene-config` | 场景配置对象 | 下发场景级配置；`ViewerPage` 监听 |
| `geo-config` | `GeoConfigPayload` | 下发 Geo 配置；`GeoScenePage` 监听 |
| `tool-activate` | `{ toolId: string }` | 激活指定工具；`ViewerCanvas` 监听 |

`GeoConfigPayload` 主要字段：

```ts
{
  imagery?: string
  imageryType?: 'satellite' | 'vector' | 'terrain'
  toolbar?: boolean
  panel?: boolean
  camera?: { longitude: number; latitude: number; altitude: number; heading?: number; pitch?: number; range?: number }
  visibleModelIds?: string[] | null  // 三态：null=全部，[]=全隐藏，非空=白名单
  hiddenTools?: string[]
  showMarkers?: boolean
}
```

### 4.3 查看器 → 父页面（当前已实现）

| 消息类型 | payload | 触发时机 |
|----------|---------|----------|
| `viewer-ready` | `{ status: 'ok' }` | 查看器初始化完成 |
| `model-loaded` | `{ metadata: { name, size, vertices, boundingBox } }` | 模型加载完成 |
| `tool-activated` | `{ toolId: string }` | 工具被激活 |
| `media-clicked` | `{ id, type, name, url?, text? }` | 点击图片 / 视频标注 |
| `marker-clicked` | `{ id, name, position, action, popup?, linkUrl? }` | 点击 3D 标点 |
| `pick-result` | `{ objectId: string \| null, info }` | 拾取插件选中对象 |

### 4.4 Geo 页 → 父页面（当前已实现）

| 消息类型 | payload | 触发时机 |
|----------|---------|----------|
| `geo-ready` | `{ mapId }` | 地图初始化完成 |
| `geo-models-loaded` | `{ mapId, modelCount }` | 模型批量加载完成 |
| `geo-model-clicked` | `{ modelId, type: 'selected' \| 'deselected' }` | 点击 / 取消选中模型 |
| `geo-position-changed` | `{ savedModels }` | 模型地理位置保存后 |
| `geo-saved` | `{ mapId, savedModelCount }` | Go 配置整体保存完成 |

### 4.5 协议预留（已定义、尚未接入）

`protocol.ts` 中另定义了下列消息，但**当前没有任何代码订阅**，接入后不会生效，请勿依赖：

`load-model`、`unload-model`、`set-environment`、`tool-config`、`set-camera`、`set-section`、`model-error`

如需使用，请先在本仓库实现订阅逻辑（欢迎提交 PR）。

---

## 5. 安全模型

本项目采用**默认拒绝**策略，这是与许多「直接 `postMessage('*')`」实现的本质差异。

### 5.1 可信来源如何确定

`MessageBus` 解析来源的顺序：

1. URL 参数 `allowedOrigins`（逗号分隔白名单）
2. `document.referrer` 的 origin
3. 两者都没有 → **allowlist 为空 → 既不发送也不接收**（仅打印 warn）

> 不存在「回退到 `*`」的逻辑。`getParentOrigin()` 中的 `*` 回退仅为兼容旧代码而保留，已标注 `@deprecated`。

### 5.2 接收侧校验

`MessageBus.handleMessage` 会丢弃 `event.origin` 不在 allowlist 内的消息；发送侧同样要求 `targetOrigin` 必须在 allowlist 内。

### 5.3 CSP `frame-ancestors`

服务端通过环境变量控制允许嵌入的父页面域名：

```env
# backend/.env
IFRAME_FRAME_ANCESTORS=self
```

Geo 地图还支持按地图配置 `allowedOrigins`，二者会在 `getIframeConfig` 中合并，返回不带引号的 origin 列表（如 `["self","https://a.com"]`），由组装 CSP 响应头的一侧负责加引号。

### 5.4 常见陷阱

| 现象 | 原因 | 处理 |
|------|------|------|
| 父页面收不到任何消息 | `document.referrer` 为空（隐私模式、`Referrer-Policy: no-referrer`、地址栏直开） | 显式传 `?allowedOrigins=https://your-host` |
| 消息被丢弃 | 白名单里写的是页面 URL 而非 origin | 只写 `scheme://host[:port]`，不带路径 |
| HTTPS 父页嵌 HTTP 子页 | 混合内容被浏览器拦截 | 子页必须同为 HTTPS |
| 嵌入后白屏 | 被 `frame-ancestors` 拒绝 | 在 `IFRAME_FRAME_ANCESTORS` 中加入父页 origin |

---

## 6. 完整示例

### 6.1 原生 JS

```html
<iframe
  id="geo"
  src="https://your-host/maps/MAP_ID?allowedOrigins=https://portal.example.com&toolbar=false"
  width="100%" height="800" style="border:0"
></iframe>

<script>
  const geo = document.getElementById('geo')
  const TARGET = 'https://your-host'

  window.addEventListener('message', (e) => {
    if (e.origin !== TARGET) return
    switch (e.data?.type) {
      case 'geo-ready':
        // 就绪后下发配置
        geo.contentWindow.postMessage(
          { type: 'geo-config', payload: { visibleModelIds: ['m1', 'm2'], showMarkers: false } },
          TARGET,
        )
        break
      case 'geo-model-clicked':
        console.log('选中模型', e.data.payload.modelId)
        break
    }
  })
</script>
```

### 6.2 React

```tsx
import { useEffect, useRef } from 'react'

const VIEWER_ORIGIN = 'https://your-host'

export function EmbeddedViewer({ sceneId }: { sceneId: string }) {
  const ref = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== VIEWER_ORIGIN) return
      if (e.data?.type === 'model-loaded') {
        console.log('loaded', e.data.payload.metadata)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <iframe
      ref={ref}
      title="3D 查看器"
      src={`${VIEWER_ORIGIN}/view/${sceneId}?toolbar=false&allowedOrigins=${encodeURIComponent(location.origin)}`}
      style={{ width: '100%', height: 720, border: 0 }}
      allow="fullscreen"
    />
  )
}
```

---

## 7. 常见问题

**Q：能否不传 `allowedOrigins`，靠 referrer 自动识别？**
可以，但仅当父页面正常发送 referrer（同源或跨域默认策略允许）时有效。生产环境建议显式配置，避免隐私模式下静默失效。

**Q：`visibleModelIds` 传空字符串是什么意思？**
表示「全部隐藏」。这与不传该参数（全部显示）语义不同，是刻意设计的三态。

**Q：能否通过 postMessage 切换模型？**
当前不行。`load-model` 属于协议预留，尚未接入。请通过路由或 `sceneId` 控制。

**Q：iframe 里能拿到父页面的登录态吗？**
不能。跨域隔离下无法读取父页 Cookie，如需鉴权请在 URL 中携带一次性 token 或改用同源部署。

---

## 8. 版本与兼容

| 版本 | 变更 |
|------|------|
| v0.1.0 | 初版：`viewer-ready` / `model-loaded` / `media-clicked` / `marker-clicked` / `pick-result`，Geo 全套事件，默认拒绝的 origin 白名单 |

协议新增会保持向后兼容；移除或改变语义将在大版本号中说明。
