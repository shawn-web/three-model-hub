import { useRef, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { useThree } from '@react-three/fiber'
import { SceneSetup } from './SceneSetup'
import { useEditStore } from '../store/edit-store'
import { useSceneStore } from '../store/scene-store'
import { PluginManager } from '../core/plugin-manager'
import { createViewerContext } from '../core/viewer'
import { createNavigationPlugin } from '../plugins/navigation'
import { createPickingPlugin } from '../plugins/picking'
import { createSectionPlugin } from '../plugins/section'
import { createMeasurementPlugin } from '../plugins/measurement'
import { createGridPlugin } from '../plugins/grid'
import { createAutoRotatePlugin } from '../plugins/auto-rotate'
import { createXRayPlugin } from '../plugins/xray'
import { createTransformControlsPlugin } from '../plugins/transform-controls'
import { createCameraInfoPlugin } from '../plugins/camera-info'
import { getMessageBus } from '../hooks/useMessageBus'
import type { SceneSetupConfig } from '../types/plugin-config'

function useEditPluginInit() {
  const pluginManagerRef = useRef(new PluginManager())
  const [pluginManager, setPluginManager] = useState<PluginManager | null>(null)
  const { scene, camera, gl, invalidate } = useThree()

  useEffect(() => {
    useEditStore.getState().setInvalidateFn(invalidate)
    const pm = pluginManagerRef.current
    const context = createViewerContext(
      scene, camera, gl,
      useSceneStore, getMessageBus(), pm
    )
    pm.setContext(context)

    const plugins = [
      createNavigationPlugin(),
      createPickingPlugin(),
      createSectionPlugin(),
      createMeasurementPlugin(),
      createGridPlugin(),
      createAutoRotatePlugin(),
      createXRayPlugin(),
      createTransformControlsPlugin(),
      createCameraInfoPlugin(),
    ]

    plugins.forEach((p) => pm.register(p))
    pm.activate('navigation')

    // 使用 state 暴露 pluginManager，避免在渲染中访问 ref.current
    setPluginManager(pm)

    return () => {
      plugins.forEach((p) => pm.unregister(p.id))
    }
  }, [scene, camera, gl])

  return pluginManager
}

function EditSceneContent() {
  const pluginManager = useEditPluginInit()

  const ambientIntensity = useEditStore((s) => s.ambientIntensity)
  const lightIntensity = useEditStore((s) => s.lightIntensity)
  const lightColor = useEditStore((s) => s.lightColor)
  const backgroundConfig = useEditStore((s) => s.backgroundConfig)
  const autoRotate = useEditStore((s) => s.autoRotate)
  const autoRotateAxis = useEditStore((s) => s.autoRotateAxis)
  const autoRotateSpeed = useEditStore((s) => s.autoRotateSpeed)
  const activeTab = useEditStore((s) => s.activeTab)
  const savedCamera = useEditStore((s) => s.savedCameraConfig)

  const config: SceneSetupConfig = {
    mode: 'edit',
    lighting: { ambientIntensity, lightIntensity, lightColor },
    background: backgroundConfig,
    camera: {
      position: savedCamera
        ? [savedCamera.position.x, savedCamera.position.y, savedCamera.position.z]
        : [10, 10, 10],
      fov: savedCamera?.fov ?? 50,
      near: 0.001,
      far: 100000,
      savedConfig: savedCamera,
    },
    plugins: {
      viewCube: true,
      autoRotate: { enabled: autoRotate, axis: autoRotateAxis, speed: autoRotateSpeed },
      grid: true,
      xray: true,
      transformControls: true,
      cameraInfo: true,
      rotationMode: false,
      screenshot: false,
      picking: true,
      section: true,
      measurement: true,
      navigation: true,
      markerPlacement: true,
      imagePlacement: true,
    },
    editTab: activeTab,
  }

  // pluginManager 在首次 effect 执行后可用，此前不渲染
  if (!pluginManager) return null

  return (
    <Suspense fallback={null}>
      <SceneSetup config={config} pluginManager={pluginManager} />
    </Suspense>
  )
}

export function EditCanvas() {
  const saved = useEditStore.getState().savedCameraConfig
  const cameraProps = saved
    ? {
        position: [saved.position.x, saved.position.y, saved.position.z] as [number, number, number],
        fov: saved.fov || 50,
        near: 0.001,
        far: 100000,
      }
    : { position: [10, 10, 10] as [number, number, number], fov: 50, near: 0.001, far: 100000 }

  return (
    <Canvas
      camera={cameraProps}
      shadows
      dpr={window.devicePixelRatio}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      className="w-full h-full"
    >
      <EditSceneContent />
    </Canvas>
  )
}
