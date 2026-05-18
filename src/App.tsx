import { useEffect, useState, useCallback } from 'react'
import { ViewerCanvas } from './components/ViewerCanvas'
import { Toolbar } from './components/Toolbar'
import { useMessageBus } from './hooks/useMessageBus'
import { parseUrlParams } from './communication/url-params'
import { MESSAGE_TYPES } from './communication/protocol'
import { useViewerStore } from './store/viewer-store'
import type { PluginManager } from './core/plugin-manager'

export function App() {
  const messageBus = useMessageBus()
  const modelLoading = useViewerStore((s) => s.modelLoading)
  const [pluginManager, setPluginManager] = useState<PluginManager | null>(null)

  useEffect(() => {
    const params = parseUrlParams(window.location.search)
    const store = useViewerStore.getState()

    if (params.environment) {
      store.setEnvironmentPreset(params.environment)
    }
    if (params.tools.length > 0) {
      store.setVisibleTools(params.tools)
    }
    if (!params.toolbarVisible) {
      store.setToolbarVisible(false)
    }

    messageBus.send(MESSAGE_TYPES.VIEWER_READY, { status: 'ok' })

    if (params.modelUrl) {
      const checkAndLoad = () => {
        window.postMessage({
          type: MESSAGE_TYPES.LOAD_MODEL,
          payload: { url: params.modelUrl },
        }, '*')
      }
      setTimeout(checkAndLoad, 200)
    }
  }, [])

  const handleFitView = useCallback(() => {
    if (!pluginManager) return
    const navPlugin = pluginManager.getPlugin('navigation') as any
    if (navPlugin?.fitToView) {
      navPlugin.fitToView()
    }
  }, [pluginManager])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <ViewerCanvas onPluginManagerReady={setPluginManager} />
      {pluginManager && <Toolbar pluginManager={pluginManager} onFitView={handleFitView} />}
      {modelLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontSize: 16,
          background: 'rgba(0,0,0,0.6)',
          padding: '12px 24px',
          borderRadius: 8,
        }}>
          加载中...
        </div>
      )}
    </div>
  )
}
