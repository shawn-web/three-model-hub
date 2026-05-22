import type * as THREE from 'three'
import type { ViewerContext } from '../plugins/types'
import type { MessageBus } from '../communication/message-bus'
import type { PluginManager } from './plugin-manager'
import type { SceneStoreApi } from '../store/scene-store'

export function createViewerContext(
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  store: SceneStoreApi,
  messageBus: MessageBus,
  pluginManager: PluginManager,
): ViewerContext {
  return {
    scene,
    camera,
    renderer,
    gl: renderer,
    store,
    messageBus,
    pluginManager,
  }
}
