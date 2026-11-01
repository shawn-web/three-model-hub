/**
 * 默认标点图标管理
 * 使用 localStorage 持久化自定义默认标点图标 URL
 *
 * 历史 key → 当前 key 的迁移逻辑见 migrateLegacyMarkerUrl()，
 * 需在 useEffect 副作用中调用，禁止在 render 路径执行 localStorage 写入。
 */

const STORAGE_KEY = 'three-model-hub_defaultMarkerUrl'
// 历史版本 localStorage key，用于迁移用户自定义默认图标
const LEGACY_STORAGE_KEY_V1 = 'threeMode_defaultMarkerUrl'

const LEGACY_STORAGE_KEY_V2 = 'threeModelHub_defaultMarkerUrl'

/**
 * 读取自定义默认标点图标 URL，纯读不写。
 * 优先读当前 key，无值时按版本顺序回退历史 key。
 */
export function getDefaultMarkerUrl(): string | null {
  return (
    localStorage.getItem(STORAGE_KEY) ??
    localStorage.getItem(LEGACY_STORAGE_KEY_V2) ??
    localStorage.getItem(LEGACY_STORAGE_KEY_V1)
  )
}

/**
 * 将历史 key 的值迁移到当前 key，并删除历史 key。
 * 需在 useEffect 副作用中调用，禁止在 render 路径调用。
 * 重复调用幂等：当前 key 有值（空字符串除外）时直接返回。
 * - 空字符串表示已清空，此时清理历史 key。
 * - 当前 key 无值时，优先迁移最近的历史 key。
 */
export function migrateLegacyMarkerUrl(): void {
  const current = localStorage.getItem(STORAGE_KEY)
  if (current !== null) {
    // 当前 key 存在：若为空字符串，主动清理旧 key；否则保持幂等
    if (current === '') {
      localStorage.removeItem(LEGACY_STORAGE_KEY_V2)
      localStorage.removeItem(LEGACY_STORAGE_KEY_V1)
    }
    return
  }

  // 优先从最近的旧 key 迁移
  const legacyV2 = localStorage.getItem(LEGACY_STORAGE_KEY_V2)
  if (legacyV2 !== null) {
    localStorage.setItem(STORAGE_KEY, legacyV2)
    localStorage.removeItem(LEGACY_STORAGE_KEY_V2)
    localStorage.removeItem(LEGACY_STORAGE_KEY_V1)
    return
  }

  const legacyV1 = localStorage.getItem(LEGACY_STORAGE_KEY_V1)
  if (legacyV1 !== null) {
    localStorage.setItem(STORAGE_KEY, legacyV1)
    localStorage.removeItem(LEGACY_STORAGE_KEY_V2)
    localStorage.removeItem(LEGACY_STORAGE_KEY_V1)
  }
}

/** 设置自定义默认标点图标 URL */
export function setDefaultMarkerUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url)
}

/** 删除自定义默认图标配置，回退到内置默认值 */
export function resetDefaultMarkerUrl(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(LEGACY_STORAGE_KEY_V2)
  localStorage.removeItem(LEGACY_STORAGE_KEY_V1)
}
