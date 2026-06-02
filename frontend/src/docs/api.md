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

### 获取上传配置
`GET /api/models/upload/config`

返回模型上传所需的配置信息（文件大小限制、支持格式等）。

### 创建模型记录
`POST /api/models/create`

**请求体：** `{ name, description?, file_url, file_name, file_size, file_format }`

### 上传模型文件
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

## 文件上传 `/api/upload`

### 通用文件上传
`POST /api/upload`

**请求：** `multipart/form-data`
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 上传的文件 |

文件通过 `StorageService` 转发到外部文件服务，返回文件 URL。

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
