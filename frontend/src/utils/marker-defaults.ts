/**
 * 默认标点图标管理
 * 使用 localStorage 持久化自定义默认标点图标 URL
 *
 * 旧 key（项目重命名前）→ 新 key 的迁移：见 migrateLegacyMarkerUrl()。
 * 迁移必须放在 useEffect 等副作用钩子里调用，
 * 禁止在 render / useState initializer 路径中执行 localStorage 写入。
 */

const STORAGE_KEY = 'threeModelHub_defaultMarkerUrl'
// 旧 key（项目重命名前），用于一次性迁移用户自定义的标点图标
const LEGACY_STORAGE_KEY = 'threeMode_defaultMarkerUrl'

/**
 * 读取自定义默认标点图标 URL，纯读，不写 localStorage。
 * 未设置时返回 null。旧 key 数据需要通过 migrateLegacyMarkerUrl() 迁移。
 */
export function getDefaultMarkerUrl(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

/**
 * 一次性把旧 key 的值迁移到新 key，并删除旧 key。
 * 应在组件挂载副作用（useEffect）里调用，禁止在 render 路径调用。
 * 重复调用幂等：旧 key 不存在时直接返回，不会反复写。
 */
export function migrateLegacyMarkerUrl(): void {
  if (localStorage.getItem(STORAGE_KEY) !== null) return
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (legacy === null) return
  localStorage.setItem(STORAGE_KEY, legacy)
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

/** 设置自定义默认标点图标 URL */
export function setDefaultMarkerUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url)
}

/** 还原为内置默认标点图标（删除自定义配置） */
export function resetDefaultMarkerUrl(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}
