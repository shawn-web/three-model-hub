import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'
import { SceneSetup } from '../core/scene-setup'
import { useViewer } from '../hooks/useViewer'
import { createNavigationPlugin } from '../plugins/navigation'
import { createPickingPlugin } from '../plugins/picking'
import { createSectionPlugin } from '../plugins/section'
import { createMeasurementPlugin } from '../plugins/measurement'
import type { PluginManager } from '../core/plugin-manager'

interface ViewerCanvasProps {
  onPluginManagerReady: (pm: PluginManager) => void
}

function SceneContent({ onPluginManagerReady }: { onPluginManagerReady: (pm: PluginManager) => void }) {
  const { pluginManager } = useViewer()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (ready) return
    const plugins = [
      createNavigationPlugin(),
      createPickingPlugin(),
      createSectionPlugin(),
      createMeasurementPlugin(),
    ]

    plugins.forEach((p) => pluginManager.register(p))
    pluginManager.activate('navigation')
    onPluginManagerReady(pluginManager)
    setReady(true)

    return () => {
      plugins.forEach((p) => pluginManager.unregister(p.id))
    }
  }, [pluginManager, onPluginManagerReady])

  return (
    <Suspense fallback={null}>
      <SceneSetup pluginManager={pluginManager} />
    </Suspense>
  )
}

export function ViewerCanvas({ onPluginManagerReady }: ViewerCanvasProps) {
  return (
    <Canvas
      camera={{ position: [10, 10, 10], fov: 50, near: 0.001, far: 100000 }}
      shadows
      dpr={window.devicePixelRatio}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      className="w-full h-full"
    >
      <SceneContent onPluginManagerReady={onPluginManagerReady} />
    </Canvas>
  )
}
