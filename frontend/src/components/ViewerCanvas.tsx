import React, { useRef, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { useThree } from '@react-three/fiber'
import { SceneSetup } from './SceneSetup'
import { useSceneStore } from '../store/scene-store'
import { useViewerStore } from '../store/viewer-store'
import { PluginManager } from '../core/plugin-manager'
import { createViewerContext } from '../core/viewer'
import { createNavigationPlugin } from '../plugins/navigation'
import { createPickingPlugin } from '../plugins/picking'
import { createSectionPlugin } from '../plugins/section'
import { createMeasurementPlugin } from '../plugins/measurement'
import { createGridPlugin } from '../plugins/grid'
import { createAutoRotatePlugin } from '../plugins/auto-rotate'
import { createXRayPlugin } from '../plugins/xray'
import { createCameraInfoPlugin } from '../plugins/camera-info'

import { createScreenshotPlugin } from '../plugins/screenshot'
import { getMessageBus } from '../hooks/useMessageBus'
import { MESSAGE_TYPES } from '../communication/protocol'
import { LIGHT_DEFAULTS } from '../utils/lighting'
import type { SceneSetupConfig } from '../types/plugin-config'
import type { PluginManager as PM } from '../core/plugin-manager'

interface ViewerCanvasProps {
  onPluginManagerReady: (pm: PM) => void
}

function useViewerPluginInit(onReady: (pm: PM) => void) {
  const pluginManagerRef = useRef(new PluginManager())
  const { scene, camera, gl } = useThree()

  useEffect(() => {
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
      createCameraInfoPlugin(),
      createScreenshotPlugin(),
    ]

    plugins.forEach((p) => pm.register(p))
    pm.activate('navigation')

    // messageBus 监听（预览模式特有）
    const messageBus = getMessageBus()
    const viewerState = useViewerStore.getState()

    const toolActivateHandler = (payload: unknown) => {
      const p = payload as { toolId: string }
      pm.activate(p.toolId)
      viewerState.setActivePluginId(p.toolId)
      messageBus.send(MESSAGE_TYPES.TOOL_ACTIVATED, { toolId: p.toolId })
    }
    messageBus.on(MESSAGE_TYPES.TOOL_ACTIVATE, toolActivateHandler)

    // 通过回调通知外部 pluginManager 实例（避免在渲染期间读取 ref）
    onReady(pm)

    return () => {
      messageBus.off(MESSAGE_TYPES.TOOL_ACTIVATE, toolActivateHandler)
      plugins.forEach((p) => pm.unregister(p.id))
    }
  }, [scene, camera, gl, onReady])
}

const ViewerSceneContent = React.memo(function ViewerSceneContent({ onPluginManagerReady }: { onPluginManagerReady: (pm: PM) => void }) {
  const [pluginManager, setPluginManager] = React.useState<PM | null>(null)
  const stableCallback = useCallback((pm: PM) => {
    setPluginManager(pm)
    onPluginManagerReady(pm)
  }, [onPluginManagerReady])

  useViewerPluginInit(stableCallback)

  const sceneConfig = useViewerStore((s) => s.sceneConfig)
  const isModelPreview = useViewerStore((s) => s.viewerType === 'model')
  const sceneAmbientIntensity = useViewerStore((s) => s.sceneConfig?.ambientIntensity as number | undefined)
  const sceneLightIntensity = useViewerStore((s) => s.sceneConfig?.lightIntensity as number | undefined)
  const sceneLightColor = useViewerStore((s) => s.sceneConfig?.lightColor as string | undefined)
  const ambientIntensity = isModelPreview ? LIGHT_DEFAULTS.ambientIntensity : (sceneAmbientIntensity ?? LIGHT_DEFAULTS.ambientIntensity)
  const lightIntensity = isModelPreview ? 1.0 : (sceneLightIntensity ?? 1.0)
  const lightColor = isModelPreview ? LIGHT_DEFAULTS.lightColor : (sceneLightColor ?? LIGHT_DEFAULTS.lightColor)
  const autoRotate = useSceneStore((s) => s.autoRotate)
  const autoRotateAxis = useSceneStore((s) => s.autoRotateAxis)
  const autoRotateSpeed = useSceneStore((s) => s.autoRotateSpeed)

  const config: SceneSetupConfig = {
    mode: 'view',
    lighting: { ambientIntensity, lightIntensity, lightColor },
    background: (sceneConfig?.background as import('../store/edit-store').BackgroundConfig) ?? null,
    camera: {
      position: [10, 10, 10],
      fov: 50,
      near: 0.001,
      far: 100000,
      savedConfig: (sceneConfig?.camera as { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; fov?: number }) ?? null,
    },
    plugins: {
      viewCube: true,
      autoRotate: { enabled: autoRotate, axis: autoRotateAxis, speed: autoRotateSpeed },
      grid: true,
      xray: true,
      transformControls: false,
      cameraInfo: true,
      rotationMode: false,
      screenshot: true,
      picking: true,
      section: true,
      measurement: true,
      navigation: true,
      markerPlacement: false,
      imagePlacement: false,
    },
  }

  if (!pluginManager) return null

  return (
    <Suspense fallback={null}>
      <SceneSetup config={config} pluginManager={pluginManager} />
    </Suspense>
  )
})

export function ViewerCanvas({ onPluginManagerReady }: ViewerCanvasProps) {
  const sceneConfig = useViewerStore.getState().sceneConfig
  const cameraConfig = sceneConfig?.camera as { position: { x: number; y: number; z: number }; fov?: number } | undefined
  const cameraProps = cameraConfig
    ? {
        position: [cameraConfig.position.x, cameraConfig.position.y, cameraConfig.position.z] as [number, number, number],
        fov: cameraConfig.fov || 50,
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
      <ViewerSceneContent onPluginManagerReady={onPluginManagerReady} />
    </Canvas>
  )
}
