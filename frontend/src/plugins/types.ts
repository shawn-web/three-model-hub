import type { FC } from 'react'
import type * as THREE from 'three'
import type { MessageBus } from '../communication/message-bus'
import type { PluginManager } from '../core/plugin-manager'
import type { SceneStoreApi } from '../store/scene-store'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export interface ViewerContext {
  scene: THREE.Scene
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
  gl: THREE.WebGLRenderer
  store: SceneStoreApi
  messageBus: MessageBus
  pluginManager: PluginManager
  /** OrbitControls 引用（插件可注册回调获取） */
  controlsRef?: { current: OrbitControlsImpl | null }
}

export interface ViewerPlugin {
  id: string
  name: string
  icon?: string
  group?: 'navigation' | 'interaction' | 'display' | 'tool'
  install(context: ViewerContext): void
  uninstall(): void
  activate(): void
  deactivate(): void
  isActive(): boolean
  /** 3D 场景中渲染的组件 */
  sceneComponent?: FC
  /** 工具栏按钮组件 */
  toolbarComponent?: FC<{ plugin: ViewerPlugin }>
}
