import { useEffect, useRef, useState, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PluginManager } from '../core/plugin-manager'
import { createViewerContext } from '../core/viewer'
import { LoaderRegistryImpl } from '../loaders/loader-registry'
import { GlbLoader } from '../loaders/glb-loader'
import { getMessageBus } from './useMessageBus'
import { useSceneStore } from '../store/scene-store'
import { useViewerStore } from '../store/viewer-store'
import { MESSAGE_TYPES } from '../communication/protocol'
import { parseUrlParams } from '../communication/url-params'
import { applyEditData } from '../utils/edit-apply'

export function useViewer(onReady?: (result: { pluginManager: PluginManager; loaderRegistry: LoaderRegistryImpl }) => void) {
  const pluginManagerRef = useRef(new PluginManager())
  const loaderRegistryRef = useRef(new LoaderRegistryImpl())
  const { scene, camera, gl } = useThree()
  const [ready, setReady] = useState(false)
  const stableOnReady = useCallback((pm: PluginManager, lr: LoaderRegistryImpl) => {
    onReady?.({ pluginManager: pm, loaderRegistry: lr })
    setReady(true)
  }, [onReady])

  useEffect(() => {
    const loaderRegistry = loaderRegistryRef.current
    loaderRegistry.register(new GlbLoader())

    const messageBus = getMessageBus()
    const pluginManager = pluginManagerRef.current
    const context = createViewerContext(
      scene, camera, gl,
      useSceneStore, messageBus, pluginManager
    )
    pluginManager.setContext(context)

    const sceneState = useSceneStore.getState()
    const viewerState = useViewerStore.getState()

    // Handler: load-model
    messageBus.on(MESSAGE_TYPES.LOAD_MODEL, async (payload: unknown) => {
      const p = payload as { url: string; format?: string }
      console.log('[Viewer] Loading model:', p.url)
      const format = p.format || loaderRegistry.detectFormat(p.url) || 'glb'
      const loader = loaderRegistry.get(format)

      if (!loader) {
        messageBus.send(MESSAGE_TYPES.MODEL_ERROR, { url: p.url, error: `Unsupported format: ${format}` })
        return
      }

      sceneState.setModelLoading(true)
      viewerState.setModelError(null)

      try {
        const model = await loader.load(p.url, (percent) => {
          messageBus.send(MESSAGE_TYPES.PROGRESS, { loaded: percent, total: 100, percent })
        })
        console.log('[Viewer] Model loaded:', model.name, 'children:', model.children.length)
        sceneState.setModelObject(model)
        sceneState.setModelUrl(p.url)
        sceneState.setModelLoading(false)

        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        messageBus.send(MESSAGE_TYPES.MODEL_LOADED, {
          metadata: {
            name: model.name,
            size: size.length(),
            vertices: 0,
            boundingBox: {
              min: box.min.toArray() as [number, number, number],
              max: box.max.toArray() as [number, number, number],
            },
          },
        })

        // After model loading success, check for editData
        const params = parseUrlParams(window.location.search)
        if (params.editDataUrl) {
          console.log('[Viewer] Found editData URL:', params.editDataUrl)
          try {
            const response = await fetch(params.editDataUrl)
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            const editData = await response.json()
            console.log('[Viewer] EditData loaded:', editData)
            applyEditData(model, editData)
            console.log('[Viewer] EditData applied successfully')
          } catch (err) {
            console.error('[Viewer] Failed to apply edit data:', err)
            messageBus.send(MESSAGE_TYPES.MODEL_ERROR, {
              url: p.url,
              error: `Failed to load edit data: ${err instanceof Error ? err.message : String(err)}`,
            })
          }
        }
      } catch (err: unknown) {
        console.error('[Viewer] Model load error:', err)
        const errMsg = err instanceof Error ? err.message : String(err)
        viewerState.setModelError(errMsg)
        sceneState.setModelLoading(false)
        messageBus.send(MESSAGE_TYPES.MODEL_ERROR, { url: p.url, error: errMsg })
      }
    })

    messageBus.on(MESSAGE_TYPES.UNLOAD_MODEL, () => {
      const currentModel = sceneState.modelObject
      if (currentModel) {
        const loader = loaderRegistry.get('glb')
        loader?.dispose(currentModel)
      }
      sceneState.setModelObject(null)
      sceneState.setModelUrl(null)
    })

    messageBus.on(MESSAGE_TYPES.SET_ENVIRONMENT, (payload: unknown) => {
      const p = payload as { preset?: string }
      if (p.preset) viewerState.setEnvironmentPreset(p.preset)
    })

    messageBus.on(MESSAGE_TYPES.TOOL_CONFIG, (payload: unknown) => {
      const p = payload as { visible?: string[]; hidden?: string[] }
      if (p.visible) viewerState.setVisibleTools(p.visible)
      if (p.hidden) viewerState.setHiddenTools(p.hidden)
    })

    messageBus.on(MESSAGE_TYPES.TOOL_ACTIVATE, (payload: unknown) => {
      const p = payload as { toolId: string }
      pluginManager.activate(p.toolId)
      viewerState.setActivePluginId(p.toolId)
      messageBus.send(MESSAGE_TYPES.TOOL_ACTIVATED, { toolId: p.toolId })
    })

    // 初始化完成后通知外部
    stableOnReady(pluginManager, loaderRegistry)

    return () => {
      pluginManager.getAllPlugins().forEach((p) => pluginManager.unregister(p.id))
    }
  }, [scene, camera, gl, stableOnReady])

  // 不直接返回 ref.current，避免渲染期读取 ref
  // 外部通过 onReady 回调获取 pluginManager 和 loaderRegistry
  return { ready }
}
