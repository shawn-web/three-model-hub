import { useCallback } from 'react'
import { useViewerStore } from '../store/viewer-store'
import type { ViewerPlugin } from '../plugins/types'
import type { PluginManager } from '../core/plugin-manager'

export function usePlugin(pluginManager: PluginManager) {
  const activePluginId = useViewerStore((s) => s.activePluginId)

  const togglePlugin = useCallback((plugin: ViewerPlugin) => {
    const store = useViewerStore.getState()
    if (activePluginId === plugin.id) {
      pluginManager.deactivate(plugin.id)
      store.setActivePluginId(null)
    } else {
      pluginManager.activate(plugin.id)
      store.setActivePluginId(plugin.id)
    }
  }, [pluginManager, activePluginId])

  return { activePluginId, togglePlugin }
}
