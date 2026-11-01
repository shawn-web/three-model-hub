# 测试指南

## 概述

three-model-hub 采用前后端分离的测试策略：

- **前端**：Vitest + jsdom + React Testing Library，覆盖 store、工具函数、通信协议
- **后端**：Jest + supertest + 真实数据库，覆盖 API 端到端测试

## 前端测试

### 运行测试

```bash
cd frontend

# watch 模式（开发时推荐）
pnpm test

# 单次运行（CI 推荐）
pnpm test:run
```

### 测试文件位置

所有测试文件放在 `frontend/tests/` 目录下：

```
tests/
├── message-bus.test.ts          # iframe 消息总线与 origin 校验
├── parent-origin.test.ts        # referrer 解析与降级策略
├── protocol.test.ts             # 通信协议类型
├── url-params.test.ts           # URL 参数解析（含 visibleModelIds 三态）
├── plugin-manager.test.ts       # 插件管理器
├── loader-registry.test.ts      # 模型加载器注册表
├── viewer-store.test.ts         # 查看器状态
├── scene-store.test.ts          # 场景状态
├── edit-store.test.ts           # 编辑器状态（含 undo/redo）
├── geo-store.test.ts            # Geo 状态（模型定位/锁定/视点）
├── geo-coords.test.ts           # 地理坐标换算
├── imagery-providers.test.ts    # 底图 provider 构建
├── load-cesium.test.ts          # Cesium 动态加载
├── glb-normal-fix.test.ts       # GLB 法线修复
├── measurement-plugin.test.ts   # 测量插件
└── upload.test.ts               # 分片上传与断点续传
```

### 编写前端测试

使用 Vitest 的 API：

```ts
import { describe, it, expect, beforeEach } from 'vitest'

beforeEach(() => {
  // 重置 store 状态
})

it('should ...', () => {
  // 执行操作
  // 断言结果
})
```

Zustand store 测试注意事项：
- 在 `beforeEach` 中调用 `useStore.setState({ ... })` 重置为初始状态
- EditStore 含 zundo 时间旅行，测试后建议调用 `useTemporalStore.getState().clear()`

## 后端测试

后端有两套测试配置，用途不同：

| 命令 | 配置 | 内容 | 依赖 |
|------|------|------|------|
| `pnpm test:unit` | `jest.unit.config.js` | `src/**/__tests__/*.spec.ts` 单元测试（24 个套件 / 328 个用例） | 无（Repository 全部 mock） |
| `pnpm test` | `jest.config.js` | `test/**/*.e2e-spec.ts` 端到端测试 | **需要 MySQL + MinIO** |

### 运行单元测试（推荐日常使用 / CI 使用）

```bash
cd backend
pnpm test:unit
```

单元测试不依赖任何外部服务，可在任意环境直接运行。

### 运行 e2e 测试

e2e 测试会真实连接 MySQL 与 MinIO，需要先准备基础设施：

```bash
# 1. 启动 MySQL + MinIO
docker-compose up -d mysql
pnpm minio:start

# 2. 准备测试环境变量（指向测试库，避免污染开发数据）
cp backend/.env.example backend/.env
# 编辑 backend/.env：DB_DATABASE=three_model_hub_test、MINIO_BUCKET=three-model-hub-test

# 3. 建表（e2e 默认 synchronize: true）并运行
cd backend && pnpm test
```

### 测试文件位置

```
backend/src/**/__tests__/*.spec.ts   # 单元测试（与被测代码同目录）
backend/test/api.e2e-spec.ts         # 端到端 API 测试
backend/test/geo-maps.e2e-spec.ts    # Geo 地图 e2e
backend/test/jest.setup.ts           # e2e 全局前置（环境变量/清理）
```

### 测试覆盖范围

当前 e2e 测试覆盖以下模块：

| 模块 | 测试内容 |
|------|---------|
| Models API | 列表、分页、搜索、获取详情（404） |
| Scenes API | 创建、列表、详情、更新、删除、模型关联 |
| Viewpoints API | 创建、列表、详情、更新、删除 |
| Annotations API | 创建、列表、详情、更新、删除 |
| Resources API | 资源列表、分组 CRUD |
| Share API | 创建分享、获取分享、撤销分享、查询分享列表 |

### 编写后端测试

使用 NestJS TestingModule + supertest：

```ts
import request from 'supertest'

it('POST /api/scenes 应创建场景', async () => {
  const res = await request(app.getHttpServer())
    .post('/api/scenes')
    .send({ name: '测试场景' })
    .expect(201)

  expect(res.body.id).toBeDefined()
})
```

**注意事项**：
- 新增实体时，必须在 `TypeOrmModule.forRoot` 的 `entities` 数组中注册
- 新增模块时，必须在测试模块的 `imports` 中导入
- 测试间共享数据时注意清理，或使用独立数据

## 测试最佳实践

1. **独立性**：每个测试应独立运行，不依赖其他测试的执行顺序
2. **重置状态**：store 测试在 `beforeEach` 中重置状态
3. **边界情况**：除正常流程外，测试 404、参数错误等异常情况
4. **命名清晰**：测试描述使用中文，说明期望的行为
5. **避免真实网络**：前端测试使用 mock，后端测试使用内存/测试数据库

## 持续集成

仓库内置 `.github/workflows/ci.yml`，在 push / PR 到 `master` 时运行四个作业：

| 作业 | 内容 |
|------|------|
| `encoding` | 运行 `python3 scripts/check-bom.py`，拦截 UTF-8 BOM 回归 |
| `docs` | 运行 `node scripts/sync-docs.js --check`，校验根文档与 `frontend/src/docs/` 一致 |
| `backend` | `lint` → `tsc -p tsconfig.build.json --noEmit` → `test:unit` |
| `frontend` | `lint` → `tsc -b --noEmit` → `test:run` → `build` |

> CI **不运行 e2e**：e2e 需要真实 MySQL + MinIO 实例，按上文在本地执行。
> 若需要在 CI 中补齐，可加一个启动 `docker-compose up -d` 的作业。

本地提交前建议执行等价校验：

```bash
pnpm check:docs                       # 文档副本是否同步
python3 scripts/check-bom.py          # 是否引入 BOM
pnpm --filter three-model-hub-backend lint
pnpm --filter three-model-hub-backend test:unit
pnpm --filter three-model-hub-frontend lint
pnpm --filter three-model-hub-frontend test:run
pnpm --filter three-model-hub-frontend build
```
