# Changelog

## 2026-11-01

开源前工程化整改：

- **编码**：移除 47 个文件中的 UTF-8 BOM（此前导致 Vite 无法解析 `package.json`，前端测试虽全绿却退出码 1），新增 `.editorconfig` 与 `scripts/check-bom.py` 防回归
- **测试**：修复后端 7 处测试漂移（scenes/geo-maps 的 `modelRepo` mock、`models.controller.download`、`upload` 的 `bizType`、annotations/viewpoints 新增 `sceneId` 参数），后端单测 328 项全绿
- **类型与 Lint**：修复前端 5 处 TypeScript 编译错误（`pnpm build` 此前会失败）；前端 ESLint 从 63 error 降至 0，后端 12 error 清零
- **契约**：`getIframeConfig` 的 `frameAncestors` 统一返回不带引号的 origin（与 `docs/api.md` 一致）
- **仓库卫生**：移除被跟踪的 `*.tsbuildinfo`、两份 npm 锁文件、AI 工具配置；`docs/superpowers/` 更名为 `docs/design/`；重写 `.gitignore`
- **CI**：修复 `setup-node` 的 pnpm 缓存早于 pnpm 安装的顺序缺陷；新增编码检查、lint、typecheck、文档同步校验作业
- **安全**：从 Git 全历史中移除曾提交的 `backend/.env`
- **文档**：新增 `docs/iframe-integration.md`（路由/参数/消息协议/安全模型）

## 2026-06-02

- 新增 `pnpm dev:all` 命令，支持一键并行启动前后端开发服务

## 2026-05-22

- 优化场景编辑器类型安全与调试配置
- iframe 嵌入支持动态传入 `sceneId` 加载对应场景

## 2026-05-20

- 资源管理添加点击预览功能
- 引入 `yet-another-react-lightbox` 支持图片和视频预览

## 2026-05-19

- 场景编辑器增强：材质修改、纹理替换、场景重置
- 查看器树交互优化

## 2026-05-15

- 3D 模型查看器基础功能上线
- 支持 GLB/GLTF 模型加载、场景组合、标注、测量、剖面
- 12 个查看器插件：测量、导航、拾取、剖面、网格、自动旋转、相机信息、旋转模式、截图、视图方块、变换控制、透视
