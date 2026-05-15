import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { SceneSetup } from '../core/scene-setup'
import { useViewer } from '../hooks/useViewer'
import { createNavigationPlugin } from '../plugins/navigation'
import { createPickingPlugin } from '../plugins/picking'
import { createSectionPlugin } from '../plugins/section'
import { createMeasurementPlugin } from '../plugins/measurement'
import { createFloorPlugin } from '../plugins/floor'
import type { PluginManager } from '../core/plugin-manager'

interface ViewerCanvasProps {
  onPluginManagerReady: (pm: PluginManager) => void
}

function SceneContent({ onPluginManagerReady }: { onPluginManagerReady: (pm: PluginManager) => void }) {
  const { pluginManager } = useViewer()

  useEffect(() => {
    const plugins = [
      createNavigationPlugin(),
      createPickingPlugin(),
      createSectionPlugin(),
      createMeasurementPlugin(),
      createFloorPlugin(),
    ]

    plugins.forEach((p) => pluginManager.register(p))
    pluginManager.activate('navigation')

    onPluginManagerReady(pluginManager)

    return () => {
      plugins.forEach((p) => pluginManager.unregister(p.id))
    }
  }, [pluginManager, onPluginManagerReady])

  return (
    <Suspense fallback={null}>
      <SceneSetup />
    </Suspense>
  )
}

export function ViewerCanvas({ onPluginManagerReady }: ViewerCanvasProps) {
  return (
    <Canvas
      camera={{ position: [10, 10, 10], fov: 50, near: 0.01, far: 10000 }}
      shadows
      dpr={window.devicePixelRatio}
      gl={{ antialias: true, alpha: false }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContent onPluginManagerReady={onPluginManagerReady} />
    </Canvas>
  )
}
