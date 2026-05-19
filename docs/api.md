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
      "file_url": "https://...",
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

### 上传模型
`POST /api/models/upload`

**请求：** `multipart/form-data`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | GLB/GLTF 文件 |
| name | string | 是 | 模型名称 |
| description | string | 否 | 描述 |

### 更新模型
`PUT /api/models/:id`

**请求体：** `{ name?, description?, tags?, is_public? }`

### 删除模型
`DELETE /api/models/:id`

### 复制模型
`POST /api/models/:id/copy`

### 下载模型
`GET /api/models/:id/download`

### 版本管理
- `POST /api/models/:id/versions` — 上传新版本
- `GET /api/models/:id/versions` — 获取版本列表
- `GET /api/models/:id/compare?v1=1&v2=2` — 版本对比

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
      "visible": true,
      "sort_order": 0
    }
  ]
}
```

### 创建场景
`POST /api/scenes`

**请求体：** `{ name, description?, scene_config? }`

### 更新场景
`PUT /api/scenes/:id`

**请求体：** `{ name?, description?, scene_config? }`

### 删除场景
`DELETE /api/scenes/:id`

### 场景模型管理
- `POST /api/scenes/:id/models` — 添加模型到场景
- `PUT /api/scenes/:id/models/:mid` — 更新场景中的模型
- `DELETE /api/scenes/:id/models/:mid` — 从场景移除模型

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

## 错误响应格式

所有 API 在出错时返回统一格式：

```json
{
  "statusCode": 404,
  "message": "模型不存在",
  "error": "Not Found"
}
```

**常见状态码：**
| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 409 | 资源冲突 |
| 500 | 服务器内部错误 |
