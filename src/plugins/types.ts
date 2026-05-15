import type * as THREE from 'three'
import type { FC } from 'react'

// Placeholder types for modules not yet created
// These will be replaced with actual imports once those modules exist
type ViewerStoreApi = unknown
type MessageBus = unknown
type PluginManager = unknown

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
