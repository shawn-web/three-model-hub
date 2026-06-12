<!-- pending-issues-path: pending-issues.md -->

# 待处理问题清单

> 本文件由 Claude Code 自动维护。每次代码修改后，AI 会检查对话中是否有"本次不处理"的遗留问题并追加记录；问题解决后会验证并核销。

## 格式说明

每条记录包含：问题描述、来源（对话上下文）、关联文件、优先级。

---

## 待处理

<!-- AI 会自动在此处追加新遗留问题 -->

### [2026-06-09] `Object.values(Map)` 导致 geo_position 未持久化（生产 bug）
- **id**: pi-001
- **priority**: high
- **status**: pending
- **description**: `ScenesService.batchUpdateModels` 与 `GeoMapsService.batchUpdateModels` 调用 `Object.values(modelMap)`，但 `modelMap` 是 `Map` 实例，`Object.values(Map)` 始终返回 `[]`，导致 `manager.save(SceneModel, [])` 实际无任何写入，调用方在 `PUT /api/scenes/:id/geo` 与 `PUT /api/geo-maps/:id/geo` 传入的 `models[].geo_position` 不会落库。
- **source**: 编写 `backend/test/geo-maps.e2e-spec.ts` 时端到端触发并通过断言验证发现
- **修复方案**: 将两处 `Object.values(modelMap)` 改为 `Array.from(modelMap.values())`
- **files**: `backend/src/scenes/scenes.service.ts:batchUpdateModels`, `backend/src/geo-maps/geo-maps.service.ts:batchUpdateModels`
- **impact**: Geo 3D 地球场景下用户拖拽/调整后的 `geo_position` 不保存，刷新后回退到上次成功保存的位置
- **added_by**: claude-session-2026-06-09

### [2026-06-04] Geo 页面前端类型错误（9 个）
- **id**: pi-002
- **priority**: medium
- **status**: pending
- **description**: tsc --noEmit 发现 9 个类型错误，分布在 CesiumViewer.tsx（3 个：subscribe 回调参数签名）、GeoScenePage.tsx（4 个：未使用的解构变量）、geo-store.ts（2 个：隐式 any 和 GeoPosition 类型不兼容）
- **source**: 多次 Stop hook 类型检查中持续存在，非本次修改引入
- **files**: `frontend/src/components/geo/CesiumViewer.tsx:457,467`, `frontend/src/pages/GeoScenePage.tsx:47-50`, `frontend/src/store/geo-store.ts:139,224`
- **added_by**: claude-session-2026-06-04

## 已解决

### [2026-06-05] Geo 页面前端类型错误（9 个）
- **描述**: tsc --noEmit 发现 9 个类型错误，分布在 CesiumViewer.tsx（subscribe 回调参数签名）、GeoScenePage.tsx（未使用的解构变量）、geo-store.ts（隐式 any 和 GeoPosition 类型不兼容）
- **解决日期**: 2026-06-05
- **验证说明**:
  - `npx tsc --noEmit` 前端全量检查通过，无类型错误
  - GeoScenePage.tsx 已移除未使用的解构变量（setImageryType、setImageryProvider、setShowToolbar、setShowPanel）
  - ESLint 检查通过（0 errors, 0 warnings）

<!-- 已验证完整实现的问题会移至此列表，标注解决日期和验证说明 -->
