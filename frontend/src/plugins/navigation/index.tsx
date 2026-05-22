import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { ViewerPlugin, ViewerContext } from '../types'
import { fitToView } from '../../utils/fit-to-view'

export class NavigationPlugin implements ViewerPlugin {
  id = 'navigation'
  name = '导航'
  icon = 'home'
  group = 'navigation' as const

  private context: ViewerContext | null = null
  private active = true
  private controlsRef: OrbitControlsImpl | null = null

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

  setControlsRef(ref: OrbitControlsImpl | null): void {
    this.controlsRef = ref
  }

  fitToView(): void {
    if (!this.context) return
    const camera = this.context.camera as THREE.PerspectiveCamera
    const modelObject = this.context.store.getState().modelObject
    if (!modelObject) return

    const controls = this.controlsRef
    if (controls) {
      fitToView(camera, controls, modelObject)
      // 触发渲染，确保相机变化立即反映
      this.context.renderer.render(this.context.scene, camera)
    }
  }
}

export function createNavigationPlugin(): ViewerPlugin {
  return new NavigationPlugin()
}
