# API 文档

基础路径：`/api`，服务端口：`3000`

---

## 模型管理 `/api/models`

### 获取模型列表
`GET /api/models`

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20 |
| search | string | 否 | 搜索关键词 |

**响应示例：**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "建筑模型",
      "description": "示例描述",
      "file_url": "/api/storage/three-model-hub/labs/models/2026/06/xxx.glb",
      "file_name": "building.glb",
      "file_size": 1048576,
      "file_format": "glb",
      "thumbnail_url": null,
      "version_count": 1,
      "is_public": true,
      "download_count": 0,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 100
}
```

### 获取单个模型
`GET /api/models/:id`

### 创建模型记录
`POST /api/models/create`

先调 `/api/upload/simple` 或 `/api/upload/multipart/*` 上传文件，拿到 `{ url, fileKey, fileSize }`。

**请求体：**
```json
{
  "name": "建筑模型",
  "description": "可选",
  "file_url": "/api/storage/three-model-hub/labs/models/2026/06/xxx.glb",
  "file_name": "building.glb",
  "file_size": 1048576,
  "file_key": "labs/models/2026/06/xxx.glb",
  "tags": ["建筑"],
  "commit_message": "初始版本"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 模型名称 |
| file_url | string | 是 | 文件访问 URL（`/api/storage/...` 相对路径） |
| file_name | string | 是 | 原始文件名 |
| file_size | number | 是 | 文件大小（≤ 1GB） |
| file_key | string | 是 | MinIO objectKey |
| description | string | 否 | 描述 |
| tags | string[] | 否 | 标签 |
| commit_message | string | 否 | 初始版本说明 |

### 上传模型文件（整文件，< 8MB）
`POST /api/models/upload`

**请求：** `multipart/form-data` 字段 `file` + DTO

### 更新模型
`PUT /api/models/:id`

**请求体：** `{ name?, description?, tags?, is_public? }`

### 删除模型
`DELETE /api/models/:id`

### 复制模型
`POST /api/models/:id/copy`

### 下载模型
`GET /api/models/:id/download`

### 代理获取模型文件
`GET /api/models/:id/file`

Geo 页面预处理 GLB（移除法线贴图）。响应 `application/octet-stream` 二进制流。

### 版本管理
- `POST /api/models/:id/versions` — 上传新版本（multipart 整文件）
- `GET /api/models/:id/versions` — 获取版本列表
- `GET /api/models/:id/compare?v1=1&v2=2` — 版本对比

---

## 上传管理 `/api/upload`

### 简单上传（< 8MB）
- `POST /api/upload/simple`
  - **请求**：`multipart/form-data` 字段 `file` + body 字段 `bizType`
  - **响应**：`{ url, fileKey, fileSize }`

### 分片上传（≥ 8MB）
- `POST /api/upload/multipart/init`
  - 请求：`{ fileName, fileSize, mimeType, bizType }`
  - 响应：`{ uploadId, objectKey, partSize, totalParts }`
- `POST /api/upload/multipart/part?uploadId=xxx&partNumber=N`
  - 请求：`multipart/form-data` 字段 `file`（分片 Buffer）
  - 响应：`{ etag, partNumber }`
- `POST /api/upload/multipart/complete`
  - 请求：`{ uploadId, parts: [{ partNumber, etag }] }`
  - 响应：`{ url, fileKey, fileSize }`
- `POST /api/upload/multipart/abort`
  - 请求：`{ uploadId }`
  - 响应：`{ success: true }`
- `GET /api/upload/multipart/status?uploadId=xxx`
  - 响应：`{ objectKey, fileSize, uploadedParts, etags }`

### 错误码
| 状态码 | 说明 |
|--------|------|
| 400 | DTO 验证失败（文件超过 1GB、bizType 非法、uploadId 不存在） |
| 413 | 分片超过 9MB（8MB chunk + 1MB 余量） |
| 500 | MinIO 调用失败 |

单文件上限默认 1GB（可通过 `MAX_UPLOAD_SIZE_MB` 环境变量调整）。

---

## 文件存储代理 `/api/storage`

前端通过此代理读取 MinIO 中的文件。上传返回的 `url` 字段（如 `/api/storage/three-model-hub/labs/models/...glb`）可直接用于 `<img src>`、`fetch`、three.js `GLTFLoader`。

### 列出文件
`GET /api/storage/:bucket`

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prefix | string | 否 | 按前缀过滤（如 `labs/models`） |

**响应示例：**
```json
{
  "bucket": "three-model-hub",
  "total": 3,
  "objects": [
    {
      "key": "labs/models/2026/06/xxx.glb",
      "size": 1048576,
      "lastModified": "2026-06-09T10:00:00Z",
      "url": "/api/storage/three-model-hub/labs/models/2026/06/xxx.glb"
    }
  ]
}
```

### 下载文件
`GET /api/storage/:bucket/*`

流式代理 MinIO 对象到浏览器，支持 `Content-Length`、`ETag`、`Last-Modified`、`Accept-Ranges` 头。

**错误码：**
| 状态码 | 说明 |
|--------|------|
| 404 | bucket 不存在 / 文件不存在 |
| 400 | URL 格式错误 / objectKey 为空 |

---

## 地理地图管理 `/api/geo-maps`

### 获取地图列表
`GET /api/geo-maps`

**查询参数：** `page`, `limit`, `search`

### 获取单个地图
`GET /api/geo-maps/:id`

### 获取地图完整数据（含模型列表）
`GET /api/geo-maps/:id/data`

**响应示例：**
```json
{
  "id": "uuid",
  "name": "北京地图",
  "description": "示例地图",
  "config": {
    "geo": {
      "imageryProvider": "tianditu",
      "imageryType": "satellite",
      "toolbar": true,
      "panel": true,
      "viewpoint": { ... },
      "markers": [ ... ],
      "lockedModelIds": ["uuid-1"],
      "visibleModelIds": null,
      "hiddenTools": [],
      "showMarkers": true,
      "allowedOrigins": ["https://example.com"]
    }
  },
  "models": [
    {
      "id": "uuid",
      "model_id": "model-uuid",
      "display_name": "主建筑",
      "geo_position": {
        "longitude": 116.397,
        "latitude": 39.916,
        "altitude": 50,
        "heading": 0,
        "pitch": 0,
        "roll": 0,
        "scale": 1
      },
      "visible": true,
      "sort_order": 0,
      "file_url": "/api/storage/three-model-hub/labs/models/.../xxx.glb",
      "thumbnail_url": "/api/storage/three-model-hub/labs/images/.../thumb.png",
      "model_name": "building"
    }
  ]
}
```

**config.geo 字段说明：**

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| imageryProvider | string | tianditu | 底图厂商 ID（tianditu、google 等） |
| imageryType | 'satellite' \| 'vector' \| 'terrain' | satellite | 底图类型：卫星影像 / 路网矢量 / 地形 |
| toolbar | boolean | true | 是否显示底部工具栏 |
| panel | boolean | true | 是否显示右侧模型面板 |
| viewpoint | object \| null | null | 保存的相机视角（lon/lat/alt/heading/pitch/roll） |
| origin | object \| null | null | 自定义地图原点（用于"重置视角"） |
| markers | array | [] | 地图标点列表（GeoMarkerData） |
| lockedModelIds | string[] | [] | 锁定后禁止拖动/编辑的模型 ID 列表 |
| visibleModelIds | string[] \| null | null | 可见模型白名单；null 表示不过滤 |
| hiddenTools | string[] | [] | 隐藏的工具按钮 ID（focusModel、flyToModel 等） |
| showMarkers | boolean | true | 是否在地球上显示标点 |
| allowedOrigins | string[] | [] | 允许的 postMessage 来源域名 |

### 创建地图
`POST /api/geo-maps`

**请求体：** `{ name, description?, config? }`

### 更新地图
`PUT /api/geo-maps/:id`

**请求体：** `{ name?, description?, thumbnail_url?, config? }`

### 删除地图
`DELETE /api/geo-maps/:id`

### 添加模型到地图
`POST /api/geo-maps/:id/models`

**请求体：** `{ model_id, model_version_id?, display_name?, geo_position?, visible?, sort_order? }`

### 批量更新地图中的模型
`PUT /api/geo-maps/:id/models/batch`

**请求体：** `{ models: [{ id, display_name?, geo_position?, visible? }] }`

`models` 可传空数组 `[]`（用于纯配置保存）。

### 统一保存 Geo 配置
`PUT /api/geo-maps/:id/geo`

**请求体：**
```json
{
  "models": [
    { "id": "uuid", "geo_position": { "longitude": 116.4, "latitude": 39.9, "altitude": 50 } }
  ],
  "geoConfig": {
    "imageryProvider": "tianditu",
    "imageryType": "satellite",
    "markers": [],
    "lockedModelIds": [],
    "visibleModelIds": null,
    "hiddenTools": [],
    "showMarkers": true,
    "allowedOrigins": [],
    "toolbar": true,
    "panel": true
  }
}
```

原子保存，同时更新模型坐标和 `geo_maps.config.geo`。`models` 为空数组时只更新配置。

### 更新地图中的单个模型
`PUT /api/geo-maps/:id/models/:mid`

**请求体：** `{ display_name?, geo_position?, visible?, sort_order? }`

### 从地图中移除模型
`DELETE /api/geo-maps/:id/models/:mid`

---

## 场景管理 `/api/scenes`

### 获取场景列表
`GET /api/scenes`

**查询参数：** `page`, `limit`, `search`

### 获取单个场景
`GET /api/scenes/:id`

### 获取场景数据（含模型列表）
`GET /api/scenes/:id/data`

**响应示例：**
```json
{
  "id": "uuid",
  "name": "我的场景",
  "scene_config": {},
  "models": [
    {
      "id": "uuid",
      "model_id": "model-uuid",
      "display_name": "主建筑",
      "transform": {
        "position": { "x": 0, "y": 0, "z": 0 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 1, "y": 1, "z": 1 }
      },
      "material_overrides": {},
      "visible": true,
      "sort_order": 0,
      "file_url": "/api/storage/three-model-hub/labs/models/.../xxx.glb",
      "thumbnail_url": "/api/storage/three-model-hub/labs/images/.../thumb.png"
    }
  ]
}
```

**models 中 file_url / thumbnail_url 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| file_url | string \| null | 模型文件 URL（从 models 表 JOIN 获取） |
| thumbnail_url | string \| null | 模型缩略图 URL |

### 创建场景
`POST /api/scenes`

**请求体：** `{ name, description?, scene_config? }`

### 更新场景
`PUT /api/scenes/:id`

**请求体：** `{ name?, description?, scene_config?, markers? }`

### 删除场景
`DELETE /api/scenes/:id`

### 场景模型管理
- `POST /api/scenes/:id/models` — 添加模型到场景
- `PUT /api/scenes/:id/models/:mid` — 更新场景中的模型
- `PUT /api/scenes/:id/models/batch` — 批量更新场景模型
- `DELETE /api/scenes/:id/models/:mid` — 从场景移除模型

### 场景图片管理
- `POST /api/scenes/:id/images` — 添加场景图片
- `PUT /api/scenes/:id/images/batch` — 批量保存场景图片
- `PUT /api/scenes/:id/images/:iid` — 更新单个场景图片
- `DELETE /api/scenes/:id/images/:iid` — 删除场景图片

---

## 分享 `/api/share`

### 创建分享链接
`POST /api/share`

**请求体：** `{ scene_id?, model_id?, permission?, expires_at? }`

### 获取分享内容
`GET /api/share/:token`

（公开接口，无需认证）

### 撤销分享
`DELETE /api/share/:id`

### 查询分享链接
- `GET /api/share/scene/:sceneId` — 获取场景的分享链接
- `GET /api/share/model/:modelId` — 获取模型的分享链接

---

## 视点 `/api/scenes/:sceneId/viewpoints`

### 获取视点列表
`GET /api/scenes/:sceneId/viewpoints`

### 获取单个视点
`GET /api/scenes/:sceneId/viewpoints/:id`

### 创建视点
`POST /api/scenes/:sceneId/viewpoints`

**请求体：**
```json
{
  "name": "正面视角",
  "camera_position": { "x": 10, "y": 5, "z": 10 },
  "camera_target": { "x": 0, "y": 0, "z": 0 },
  "camera_up": { "x": 0, "y": 1, "z": 0 },
  "fov": 60
}
```

### 更新视点
`PATCH /api/scenes/:sceneId/viewpoints/:id`

### 删除视点
`DELETE /api/scenes/:sceneId/viewpoints/:id`

---

## 批注 `/api/scenes/:sceneId/annotations`

### 获取批注列表
`GET /api/scenes/:sceneId/annotations`

### 获取单个批注
`GET /api/scenes/:sceneId/annotations/:id`

### 创建批注
`POST /api/scenes/:sceneId/annotations`

**请求体：**
```json
{
  "position": { "x": 1.5, "y": 2.0, "z": 3.0 },
  "text": "此处需要修改",
  "author": "张三"
}
```

### 更新批注
`PATCH /api/scenes/:sceneId/annotations/:id`

### 删除批注
`DELETE /api/scenes/:sceneId/annotations/:id`

---

## 资源管理 `/api/resources`

### 获取资源列表
`GET /api/resources`

**查询参数：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20 |
| type | string | 否 | 资源类型过滤 |
| group_id | string | 否 | 分组 ID 过滤 |

### 图片代理
`GET /api/resources/proxy-image`

**查询参数：** `url`（代理访问外部图片资源）

### 上传资源
`POST /api/resources/upload`

**请求：** `multipart/form-data`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 资源文件 |
| name | string | 是 | 资源名称 |
| type | string | 是 | 资源类型 |
| group_id | string | 否 | 所属分组 |

### 更新资源
`PATCH /api/resources/:id`

### 删除资源
`DELETE /api/resources/:id`

### 分组管理
- `GET /api/resources/groups` — 获取分组列表
- `POST /api/resources/groups` — 创建分组
- `PATCH /api/resources/groups/:id` — 更新分组
- `DELETE /api/resources/groups/:id` — 删除分组

---

## 错误响应格式

所有 API 出错时返回统一格式：

```json
{
  "statusCode": 404,
  "message": "模型不存在",
  "error": "Not Found"
}
```

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 500 | 服务器内部错误 |
