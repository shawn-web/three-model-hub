# 贡献指南

感谢你对 three-model-hub 项目的关注！本文档将帮助你快速了解如何参与项目开发。

## 开发环境

请参考 [开发指南](docs/development.md) 完成环境搭建。

快速启动：

```bash
pnpm install
pnpm dev:all    # 同时启动前后端
```

## 分支策略

- `master` —— 主分支，始终保持可部署状态
- `feature/xxx` —— 新功能分支
- `fix/xxx` —— 缺陷修复分支

## 提交规范

提交信息使用中文，格式如下：

```
类型(模块): 简要描述

详细说明（可选）
```

常用类型：

| 类型 | 说明 |
|------|------|
| feat | 新功能 |
| fix | 缺陷修复 |
| docs | 文档更新 |
| style | 代码格式（不影响功能） |
| refactor | 重构 |
| test | 测试相关 |
| chore | 构建/工具相关 |

示例：

```bash
git commit -m "feat(scenes): 添加场景图片批量上传功能"
git commit -m "fix(viewer): 修复剖面工具在暗色主题下的显示问题"
```

## 代码规范

- 所有注释使用中文
- 文件名使用 kebab-case
- 组件名使用 PascalCase
- 函数/变量使用 camelCase
- 类型/接口使用 PascalCase

前后端分别有独立的规范文件，请务必遵守：

- [前端规范](frontend/FRONTEND_CONVENTIONS.md)
- [后端规范](backend/BACKEND_CONVENTIONS.md)

## 添加新功能

### 新增后端模块

1. 在 `backend/src/` 下创建模块目录（entities、dto、service、controller、module）
2. 在 `app.module.ts` 中注册新模块
3. 编写 e2e 测试
4. 同步更新 `docs/api.md` + `docs/architecture.md`

### 新增前端页面

1. 在 `frontend/src/pages/` 下创建页面组件
2. 在 `frontend/src/RouterApp.tsx` 中添加路由
3. 在导航栏中添加导航项（如需要）
4. 同步更新 `docs/architecture.md`

### 新增查看器插件

1. 在 `frontend/src/plugins/` 下创建插件目录
2. 实现 `ViewerPlugin` 接口
3. 在插件管理器中注册
4. 同步更新 `docs/architecture.md`

## 测试

提交前确保所有测试通过：

```bash
# 前端测试
cd frontend && pnpm test:run

# 后端测试
cd backend && pnpm test
```

## PR 流程

1. 从 `master` 切出功能分支
2. 开发完成后，在本地运行测试确保通过
3. 提交 PR，描述变更内容和测试情况
4. 等待代码审查，根据反馈修改
5. 审查通过后合并到 `master`

## 文档同步

修改以下内容时，必须同步更新对应文档：

| 变更类型 | 需同步更新的文档 |
|---|---|
| 新增/修改/删除 API 端点 | `docs/api.md` |
| 新增/修改后端模块 | `docs/architecture.md` + AGENTS.md |
| 新增/修改前端页面/路由 | `docs/architecture.md` + AGENTS.md |
| 新增/修改前端 store | `docs/architecture.md` + AGENTS.md |
| 新增/修改前端插件 | `docs/architecture.md` + AGENTS.md |
| 技术栈版本变更 | AGENTS.md + `docs/architecture.md` |
| 环境变量变更 | `docs/deployment.md` + `backend/.env.example` |
| 部署方式变更 | `docs/deployment.md` |

## 联系方式

如有问题，欢迎通过 Issue 或 PR 讨论。
