# 测试指南

## 概述

ThreeModelHub 采用前后端分离的测试策略：

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
├── message-bus.test.ts      # iframe 消息总线
├── url-params.test.ts       # URL 参数解析
├── plugin-manager.test.ts   # 插件管理器
├── loader-registry.test.ts  # 模型加载器注册表
├── viewer-store.test.ts     # 查看器状态
├── scene-store.test.ts      # 场景状态
├── edit-store.test.ts       # 编辑器状态（含 undo/redo）
└── protocol.test.ts         # 通信协议类型
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

### 运行测试

```bash
cd backend

# 运行 e2e 测试
pnpm test
```

**注意**：后端测试需要 MySQL 运行，测试数据库会自动创建表（`synchronize: true`）。

### 测试文件位置

```
test/
└── api.e2e-spec.ts    # 端到端 API 测试
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

## 持续集成建议

在 CI 流水线中建议按顺序执行：

```bash
# 1. 代码检查
pnpm lint

# 2. 前端构建 + 测试
cd frontend && pnpm build && pnpm test:run

# 3. 后端测试（需先启动 MySQL）
cd backend && pnpm test
```
