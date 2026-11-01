/**
 * 应用启动时的存储层迁移集中入口
 *
 * 项目重命名后，需要把 localStorage / IndexedDB 中残留的旧 key / 旧 DB 迁移或清理。
 * 之前这些迁移散落在各组件 useEffect 与工具函数内部，触发时机依赖用户是否访问特定页面；
 * 此处在应用启动时统一执行一次，确保迁移不依赖路由，且所有迁移逻辑有唯一入口。
 *
 * 各迁移函数本身幂等，重复调用安全。
 */
import { migrateLegacyMarkerUrl } from './marker-defaults'
import { cleanupLegacyCacheDB } from './glb-normal-fix'

let migrationsDone = false

/** 执行所有存储层迁移（应用启动时调用一次，幂等） */
export function runStorageMigrations(): void {
  if (migrationsDone) return
  migrationsDone = true
  try {
    // localStorage：把旧 key 的自定义标点图标迁移到新 key
    migrateLegacyMarkerUrl()
  } catch {
    // localStorage 不可用（隐私模式）时忽略
  }
  try {
    // IndexedDB：清理重命名前遗留的旧 GLB 缓存 DB
    cleanupLegacyCacheDB()
  } catch {
    // IndexedDB 不可用时忽略
  }
}
