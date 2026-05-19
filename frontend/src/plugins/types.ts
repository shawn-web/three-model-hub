import type { FC } from 'react'
import type * as THREE from 'three'
import type { MessageBus } from '../communication/message-bus'
import type { PluginManager } from '../core/plugin-manager'
import type { ViewerStoreApi } from '../store/viewer-store'

export interface ViewerContext {
  scene: THREE.Scene
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
  gl: THREE.WebGLRenderer
  store: ViewerStoreApi
  messageBus: MessageBus
  pluginManager: PluginManager
}

export interface ViewerPlugin {
  id: string
  name: string
  icon?: string
  group?: 'navigation' | 'picking' | 'section' | 'measurement' | 'floor'
  install(context: ViewerContext): void
  uninstall(): void
  activate(): void
  deactivate(): void
  isActive(): boolean
  toolbarComponent?: FC<{ plugin: ViewerPlugin }>
}
