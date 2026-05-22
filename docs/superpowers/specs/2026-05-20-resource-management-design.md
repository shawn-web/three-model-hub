# 资源管理功能设计

## 背景

当前项目中图片管理存在以下问题：
1. 图片仅存在前端 store 中，无后端持久化，刷新即丢失
2. 场景编辑器中的图片上传是直接上传文件服务，没有统一的资源管理
3. 不支持视频资源
4. 无法复用已上传的资源（背景、标注、贴片各自上传）

本次新增资源管理模块，统一管理图片和视频资源，现有图片管理改为从资源库绑定。

## 数据模型

### Resource 实体

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT, PK, AUTO_INCREMENT | 主键 |
| name | VARCHAR(255) | 资源名称（默认文件名，可修改） |
| type | ENUM('image', 'video') | 资源类型 |
| url | VARCHAR(500) | 文件 URL |
| file_size | BIGINT | 文件大小（字节） |
| mime_type | VARCHAR(100) | MIME 类型 |
| width | INT, NULLABLE | 宽度 |
| height | INT, NULLABLE | 高度 |
| duration | FLOAT, NULLABLE | 视频时长（秒） |
| thumbnail_url | VARCHAR(500), NULLABLE | 缩略图/视频封面 |
| group_id | INT, NULLABLE, FK | 分组 ID |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### ResourceGroup 实体

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT, PK | 主键 |
| name | VARCHAR(100) | 分组名称 |
| sort_order | INT | 排序 |
| created_at | TIMESTAMP | 创建时间 |

### 关系

Resource 多对一 → ResourceGroup（group_id 可为 null，表示未分组）

## 后端 API

新建 `ResourcesModule`，路由前缀 `/resources`。

### 资源接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/resources` | 资源列表（支持 type、group_id 筛选，分页） |
| POST | `/resources/upload` | 上传并创建资源 |
| PATCH | `/resources/:id` | 更新资源（重命名、移动分组） |
| DELETE | `/resources/:id` | 删除资源 |

### 分组接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/resources/groups` | 分组列表 |
| POST | `/resources/groups` | 创建分组 |
| PATCH | `/resources/groups/:id` | 更新分组 |
| DELETE | `/resources/groups/:id` | 删除分组（资源移至未分组） |

### 上传流程

1. 前端 POST 文件到 `/resources/upload`，可选带 group_id
2. 后端通过 StorageService 上传到文件服务（路径 `resources/{type}/`）
3. 前端在上传前读取图片宽高或使用视频元素获取时长，随表单提交
4. 后端创建 Resource 记录并返回

## 前端设计

### 新增资源管理页面 `/resources`

- 顶部：搜索栏 + 类型筛选（全部/图片/视频）+ 上传按钮
- 左侧：分组列表（全部、未分组、各分组）
- 右侧：资源卡片网格（缩略图 + 名称 + 大小）
- 功能：拖拽上传、批量删除、右键菜单（重命名/移动分组/删除）

### 新增 ResourcePicker 组件

通用弹窗选择器，供其他组件调用：
- 弹窗形式，支持单选/多选
- 可限制类型（只选图片或只选视频）
- 支持弹窗内上传新资源
- 返回资源信息（url、name、width、height、type 等）

### 改造现有功能

**SceneImagePanel**：
- "添加图片"按钮 → 打开 ResourcePicker（type=image）→ 选择资源 → 创建 SceneImage
- 保留拖拽上传（自动先上传到资源管理，再绑定）

**SceneBackground**：
- 背景图/视频选择 → 使用 ResourcePicker

**MarkerPopup 标注图标**：
- 图标选择 → 使用 ResourcePicker（type=image）

### 新增前端文件

- `frontend/src/pages/ResourcesPage.tsx` — 资源管理页面
- `frontend/src/components/ResourcePicker.tsx` — 资源选择器弹窗
- `frontend/src/api/resources.ts` — 资源 API
- `frontend/src/types/resource.ts` — 资源类型定义

### 路由

在 `RouterApp.tsx` 中添加 `/resources` 路由，导航栏添加入口。

## 关键文件

### 后端（新建）
- `backend/src/resources/resources.module.ts`
- `backend/src/resources/resources.controller.ts`
- `backend/src/resources/resources.service.ts`
- `backend/src/resources/entities/resource.entity.ts`
- `backend/src/resources/entities/resource-group.entity.ts`
- `backend/src/resources/dto/resource.dto.ts`

### 后端（修改）
- `backend/src/app.module.ts` — 注册 ResourcesModule

### 前端（新建）
- `frontend/src/pages/ResourcesPage.tsx`
- `frontend/src/components/ResourcePicker.tsx`
- `frontend/src/api/resources.ts`
- `frontend/src/types/resource.ts`

### 前端（修改）
- `frontend/src/RouterApp.tsx` — 添加路由
- `frontend/src/components/SceneImagePanel.tsx` — 改用 ResourcePicker
- `frontend/src/components/SceneBackground.tsx` — 改用 ResourcePicker
- `frontend/src/components/MarkerPopup.tsx` — 标注图标改用 ResourcePicker
- 导航组件 — 添加资源管理入口

## 验证方式

1. 访问 `/resources` 页面，上传图片和视频资源
2. 创建分组，移动资源到分组
3. 在场景编辑器中通过 ResourcePicker 添加图片贴片
4. 在场景背景中选择图片/视频
5. 在标注中选择图标
6. 验证资源删除后引用处的表现
