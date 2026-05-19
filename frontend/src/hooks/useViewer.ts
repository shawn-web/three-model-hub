import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PluginManager } from '../core/plugin-manager'
import { createViewerContext } from '../core/viewer'
import { LoaderRegistryImpl } from '../loaders/loader-registry'
import { GlbLoader } from '../loaders/glb-loader'
import { getMessageBus } from './useMessageBus'
import { useViewerStore } from '../store/viewer-store'
import { MESSAGE_TYPES } from '../communication/protocol'
import { parseUrlParams } from '../communication/url-params'
import { applyEditData } from '../utils/edit-apply'

export function useViewer() {
  const pluginManagerRef = useRef(new PluginManager())
  const loaderRegistryRef = useRef(new LoaderRegistryImpl())
  const { scene, camera, gl } = useThree()

  useEffect(() => {
    const loaderRegistry = loaderRegistryRef.current
    loaderRegistry.register(new GlbLoader())

    const messageBus = getMessageBus()
    const pluginManager = pluginManagerRef.current
    const context = createViewerContext(
      scene, camera, gl,
      useViewerStore, messageBus, pluginManager
    )
    pluginManager.setContext(context)

    const store = useViewerStore.getState()

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

      store.setModelLoading(true)
      store.setModelError(null)

      try {
        const model = await loader.load(p.url, (percent) => {
          messageBus.send(MESSAGE_TYPES.PROGRESS, { loaded: percent, total: 100, percent })
        })
        console.log('[Viewer] Model loaded:', model.name, 'children:', model.children.length)
        store.setModelObject(model)
        store.setModelUrl(p.url)
        store.setModelLoading(false)

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
      } catch (err: any) {
        console.error('[Viewer] Model load error:', err)
        store.setModelError(err.message)
        store.setModelLoading(false)
        messageBus.send(MESSAGE_TYPES.MODEL_ERROR, { url: p.url, error: err.message })
      }
    })

    messageBus.on(MESSAGE_TYPES.UNLOAD_MODEL, () => {
      const currentModel = store.modelObject
      if (currentModel) {
        const loader = loaderRegistry.get('glb')
        loader?.dispose(currentModel)
      }
      store.setModelObject(null)
      store.setModelUrl(null)
    })

    messageBus.on(MESSAGE_TYPES.SET_ENVIRONMENT, (payload: unknown) => {
      const p = payload as { preset?: string }
      if (p.preset) store.setEnvironmentPreset(p.preset)
    })

    messageBus.on(MESSAGE_TYPES.TOOL_CONFIG, (payload: unknown) => {
      const p = payload as { visible?: string[]; hidden?: string[] }
      if (p.visible) store.setVisibleTools(p.visible)
      if (p.hidden) store.setHiddenTools(p.hidden)
    })

    messageBus.on(MESSAGE_TYPES.TOOL_ACTIVATE, (payload: unknown) => {
      const p = payload as { toolId: string }
      pluginManager.activate(p.toolId)
      store.setActivePluginId(p.toolId)
      messageBus.send(MESSAGE_TYPES.TOOL_ACTIVATED, { toolId: p.toolId })
    })

    return () => {
      pluginManager.getAllPlugins().forEach((p) => pluginManager.unregister(p.id))
    }
  }, [scene, camera, gl])

  return {
    pluginManager: pluginManagerRef.current,
    loaderRegistry: loaderRegistryRef.current,
  }
}
