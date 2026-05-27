# 后端代码规范（强制）

以下规范基于代码审查整理，所有新增/修改的后端代码必须遵守。本文件中的规则优先级最高，与默认行为冲突时以此为准。

---

## 1. 模块结构

每个业务模块必须遵循以下目录结构：

```
backend/src/<module-name>/
├── entities/          # TypeORM 实体
│   └── *.entity.ts
├── dto/               # 请求验证 DTO
│   └── *.dto.ts
├── <module-name>.module.ts
├── <module-name>.controller.ts
└── <module-name>.service.ts
```

**例外**：
- **Storage 模块**（`storage/`）：基础设施服务，无 controller/dto/entities，仅提供 `StorageService` 供其他模块调用
- **Upload 模块**（`upload/`）：轻量模块，无 entities/dto，直接使用 `MulterFile` 处理文件上传

跨模块共享的类型放到 `backend/src/common/`（如 `common/types.ts`）。

环境变量配置参考 `docs/deployment.md` 和 `backend/.env.example`。

## 2. DTO 验证（强制）

**所有 DTO 必须使用 `class-validator` 装饰器**，不得只有 TypeScript 类型声明。全局 `ValidationPipe` 已启用 `whitelist: true` + `forbidNonWhitelisted: true`。

```typescript
// 正确 ✓
import { IsString, IsOptional, IsNumber } from 'class-validator'

export class CreateXxxDto {
  @IsString()
  name: string

  @IsOptional()
  @IsNumber()
  sort_order?: number
}

// 禁止 ✗ — 无装饰器的 DTO 不会被运行时验证
export class CreateXxxDto {
  name: string
  sort_order?: number
}
```

验证规则：
- 必填字段：`@IsString()` / `@IsNumber()` / `@IsBoolean()` 等，不加 `@IsOptional()`
- 可选字段：`@IsOptional()` + 类型装饰器
- 数组字段：`@IsArray()` + `@IsString({ each: true })`
- 嵌套对象数组：`@IsArray()` + `@ValidateNested({ each: true })` + `@Type(() => ItemDto)`
- 枚举字段：`@IsEnum(EnumType)`
- 数字范围：`@Min(0)`、`@Max(100)` 等

## 3. 嵌套对象字段处理

**DTO 中禁止使用不可验证的嵌套对象类型**（如 `position: { x: number; y: number; z: number }`）。改为扁平字段：

```typescript
// 正确 ✓ — 扁平字段，每个属性都能被独立验证
export class CreateAnnotationDto {
  @IsNumber() x: number
  @IsNumber() y: number
  @IsNumber() z: number
  @IsString() text: string
}

// 禁止 ✗ — 运行时无法验证嵌套对象内容
export class CreateAnnotationDto {
  position: { x: number; y: number; z: number }
  text: string
}
```

Service 层负责将扁平字段组装为实体需要的对象格式：

```typescript
async create(sceneId: string, dto: CreateAnnotationDto) {
  const entity = this.repo.create({
    scene_id: sceneId,
    position: { x: dto.x, y: dto.y, z: dto.z },
    text: dto.text,
  })
  return this.repo.save(entity)
}
```

## 4. 异常处理

**必须使用 NestJS 内置异常类**，禁止 `throw new Error()`：

```typescript
// 正确 ✓
import { NotFoundException, BadRequestException } from '@nestjs/common'
throw new NotFoundException('资源不存在')
throw new BadRequestException('参数错误')

// 禁止 ✗
throw new Error('xxx')
```

可用的异常类：
- `BadRequestException` (400) — 参数错误、业务校验失败
- `UnauthorizedException` (401) — 未认证
- `ForbiddenException` (403) — 无权限
- `NotFoundException` (404) — 资源不存在
- `ConflictException` (409) — 冲突（如重复创建）
- `InternalServerErrorException` (500) — 服务端异常

## 5. 类型安全

**禁止使用 `as any`**。遇到类型不匹配时优先：

1. 补全实体的类型声明
2. 用 `Partial<T>` 或 `Omit<T, K>` 表达可选/省略
3. 用 `@ts-expect-error` 并加注释说明原因（仅限 TypeORM 框架 bug）

## 6. 控制器路由顺序

**静态路径必须注册在动态参数路径之前**，否则会被参数通配符吞掉：

```typescript
// 正确 ✓ — 静态路径在前
@Get('scene/:sceneId')    // 先匹配
@Get('model/:modelId')    // 先匹配
@Get(':token')            // 最后匹配

// 禁止 ✗ — :token 会吞掉 scene 和 model
@Get(':token')
@Get('scene/:sceneId')    // 永远匹配不到
```

## 7. 数据库事务

涉及多表写操作的方法必须使用事务：

```typescript
import { DataSource } from 'typeorm'

constructor(private dataSource: DataSource) {}

async batchOperation() {
  await this.dataSource.transaction(async (manager) => {
    await manager.save(EntityA, dataA)
    await manager.delete(EntityB, { id: xxx })
  })
}
```

必须用事务的场景：
- 批量增删改（先删后建）
- 跨表写入（主表 + 关联表同时变更）
- 有序操作（先校验后写入，中间不允许被并发修改）

## 8. 批量操作优化

禁止在循环中逐条查询数据库（N+1 问题）。应先批量查询，再循环处理：

```typescript
// 正确 ✓ — 一次查询 + 事务批量保存
async batchUpdate(sceneId: string, items: ItemDto[]) {
  const ids = items.map(i => i.id)
  const entities = await this.repo.findBy({ id: In(ids) })
  const map = new Map(entities.map(e => [e.id, e]))

  await this.dataSource.transaction(async (manager) => {
    for (const item of items) {
      const entity = map.get(item.id)
      if (!entity) continue
      Object.assign(entity, item)
      await manager.save(Entity, entity)
    }
  })
}

// 禁止 ✗ — N+1 查询
for (const item of items) {
  const entity = await this.repo.findOne({ where: { id: item.id } })
  await this.repo.save(entity)
}
```

## 9. 分页参数安全

所有分页查询必须限制边界：

```typescript
const page = Math.max(query.page || 1, 1)                        // 最小为 1
const limit = Math.min(Math.max(query.limit || 20, 1), 100)      // 范围 [1, 100]
```

## 10. 公共类型

跨模块共享的类型只定义一次，放在 `backend/src/common/types.ts`：

```typescript
// common/types.ts
export interface MulterFile {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: number
  buffer: Buffer
}
```

禁止在多个 controller/service 中重复定义相同接口。

## 11. 安全约束

- **代理端点**：必须过滤内网 IP（10.x、172.16-31.x、192.168.x、127.x），防止 SSRF
- **文件上传**：必须设置 `fileSize` 上限（`FileInterceptor` 的 `limits.fileSize`）
- **外部 URL 输入**：必须校验协议（仅 `http`/`https`）
- **删除操作**：有外键引用时必须先检查依赖（如模型被场景引用时拒绝删除）

## 12. 实体定义规范

```typescript
@Entity('table_name')
export class MyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  // 外键字段：同时声明关系和原始列
  @ManyToOne(() => Parent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: Parent

  @Column()
  parent_id: string

  // JSON 字段标注用途
  /** 变换数据 { position: [x,y,z], rotation: [x,y,z], scale: [x,y,z] } */
  @Column({ type: 'json', nullable: true })
  transform: Record<string, any>

  @CreateDateColumn()
  created_at: Date

  @UpdateDateColumn()
  updated_at: Date
}
```

## 13. 新增模块检查清单

创建新的后端模块时，逐项确认：

- [ ] `entities/*.entity.ts` — 实体定义，含关系和 JoinColumn
- [ ] `dto/*.dto.ts` — 所有字段有 `class-validator` 装饰器
- [ ] `*.module.ts` — 注册 TypeOrmModule.forFeature + 导入依赖模块
- [ ] `*.controller.ts` — 静态路由在动态路由前；使用 ParseUUIDPipe；使用 NestJS 异常类
- [ ] `*.service.ts` — 分页参数边界保护；批量操作用事务；无 `as any`
- [ ] `app.module.ts` — 导入新模块
- [ ] 跨模块类型放 `common/types.ts`
- [ ] **同步更新文档**：`docs/api.md`（新增端点）+ `docs/architecture.md`（后端目录结构）+ CLAUDE.md（模块表）
