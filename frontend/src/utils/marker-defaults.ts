/**
 * 默认标点图标管理
 * 使用 localStorage 持久化自定义默认标点图标 URL
 */

const STORAGE_KEY = 'threeMode_defaultMarkerUrl'

/** 获取自定义默认标点图标 URL，未设置时返回 null */
export function getDefaultMarkerUrl(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

/** 设置自定义默认标点图标 URL */
export function setDefaultMarkerUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url)
}

/** 还原为内置默认标点图标（删除自定义配置） */
export function resetDefaultMarkerUrl(): void {
  localStorage.removeItem(STORAGE_KEY)
}
