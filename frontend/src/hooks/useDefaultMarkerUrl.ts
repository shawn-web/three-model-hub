import { useState, useEffect, useCallback } from 'react'
import { getDefaultMarkerUrl, migrateLegacyMarkerUrl, setDefaultMarkerUrl, resetDefaultMarkerUrl } from '../utils/marker-defaults'

/** 跨组件实例同步默认图标变更的事件名 */
const DEFAULT_MARKER_URL_EVENT = 'three-model-hub:default-marker-url-change'

/** 广播本地 localStorage 变更，让其他组件实例的 hook 同步刷新 */
function emitDefaultMarkerUrlChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(DEFAULT_MARKER_URL_EVENT))
}

/**
 * 管理默认标点图标 URL 的共享 hook
 * - 组件挂载时自动迁移旧 key
 * - 监听 storage 事件 + 自定义事件，让多个组件实例保持同步
 * - 返回当前自定义默认图标 URL 及设置/还原方法
 */
export function useDefaultMarkerUrl() {
  const [customDefault, setCustomDefault] = useState<string | null>(getDefaultMarkerUrl)

  // 挂载时执行一次性迁移
  useEffect(() => {
    migrateLegacyMarkerUrl()
    // 一次性迁移旧存储键后必须回写最新值，迁移发生在挂载期
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomDefault(getDefaultMarkerUrl())
  }, [])

  // 监听跨 tab / 跨组件实例的 storage 变更
  useEffect(() => {
    const sync = () => setCustomDefault(getDefaultMarkerUrl())
    window.addEventListener('storage', sync)
    window.addEventListener(DEFAULT_MARKER_URL_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(DEFAULT_MARKER_URL_EVENT, sync)
    }
  }, [])

  const setDefault = useCallback((url: string) => {
    setDefaultMarkerUrl(url)
    setCustomDefault(url)
    emitDefaultMarkerUrlChange()
  }, [])

  const resetDefault = useCallback(() => {
    resetDefaultMarkerUrl()
    setCustomDefault(null)
    emitDefaultMarkerUrlChange()
  }, [])

  return {
    customDefault,
    setDefault,
    resetDefault,
  }
}
