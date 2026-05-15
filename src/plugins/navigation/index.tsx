import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'
import { fitToView } from '../../utils/fit-to-view'

export class NavigationPlugin implements ViewerPlugin {
  id = 'navigation'
  name = '导航'
  icon = '🏠'
  group = 'navigation' as const

  private context: ViewerContext | null = null
  private active = true

  install(context: ViewerContext): void {
    this.context = context
    this.active = true
  }

  uninstall(): void {
    this.context = null
  }

  activate(): void {
    this.active = true
  }

  deactivate(): void {
    this.active = false
  }

  isActive(): boolean {
    return this.active
  }

  fitToView(): void {
    if (!this.context) return
    const camera = this.context.camera as THREE.PerspectiveCamera
    const modelObject = this.context.store.getState().modelObject
    if (!modelObject) return
    const controls = (this.context.renderer as any).__r3f_orbitControls
    if (controls) {
      fitToView(camera, controls, modelObject)
    }
  }

  setCamera(position: THREE.Vector3, target: THREE.Vector3): void {
    if (!this.context) return
    const camera = this.context.camera as THREE.PerspectiveCamera
    camera.position.copy(position)
    camera.lookAt(target)
  }
}

export function createNavigationPlugin(): ViewerPlugin {
  return new NavigationPlugin()
}
