import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'

export interface SectionState {
  axis: 'x' | 'y' | 'z'
  position: number
  enabled: boolean
  bounds: { min: number; max: number }
}

export class SectionPlugin implements ViewerPlugin {
  id = 'section'
  name = '剖面'
  icon = 'cut'
  group = 'section' as const

  private context: ViewerContext | null = null
  private active = false
  private sectionAxis: 'x' | 'y' | 'z' = 'y'
  private sectionPosition = 0
  private sectionEnabled = false
  private modelMin = 0
  private modelMax = 0

  // Listener for state changes from scene components
  private stateListener: ((state: SectionState) => void) | null = null

  install(context: ViewerContext): void {
    this.context = context
  }

  uninstall(): void {
    this.removeClipping()
    this.context = null
    this.stateListener = null
  }

  activate(): void {
    this.active = true
    this.updateModelBounds()
    // 初始位置设在模型边缘，不裁切任何内容
    this.sectionPosition = this.modelMax
    this.notifyListener()
  }

  deactivate(): void {
    this.active = false
    this.sectionEnabled = false
    this.removeClipping()
    this.notifyListener()
  }

  isActive(): boolean {
    return this.active
  }

  /** Set a listener that will be called whenever section state changes */
  onStateChange(listener: (state: SectionState) => void): void {
    this.stateListener = listener
  }

  getAxis(): 'x' | 'y' | 'z' {
    return this.sectionAxis
  }

  setAxis(axis: 'x' | 'y' | 'z'): void {
    this.sectionAxis = axis
    this.updateModelBounds()
    // 切换轴时重置到边缘，不裁切任何内容
    this.sectionPosition = this.modelMax
    if (this.sectionEnabled) {
      this.applyClipping()
    }
    this.notifyListener()
  }

  getPosition(): number {
    return this.sectionPosition
  }

  setPosition(pos: number): void {
    this.sectionPosition = pos
    if (this.sectionEnabled) {
      this.applyClipping()
    }
    this.notifyListener()
  }

  isEnabled(): boolean {
    return this.sectionEnabled
  }

  /** Enable/disable section clipping. Called by the in-scene component. */
  toggle(enabled?: boolean): void {
    this.sectionEnabled = enabled ?? !this.sectionEnabled
    if (this.sectionEnabled) {
      this.applyClipping()
    } else {
      this.removeClipping()
    }
    this.notifyListener()
  }

  getBounds(): { min: number; max: number } {
    return { min: this.modelMin, max: this.modelMax }
  }

  getState(): SectionState {
    return {
      axis: this.sectionAxis,
      position: this.sectionPosition,
      enabled: this.sectionEnabled,
      bounds: { min: this.modelMin, max: this.modelMax },
    }
  }

  getModelCenter(): THREE.Vector3 {
    if (!this.context) return new THREE.Vector3()
    const model = this.context.store.getState().modelObject
    if (!model) return new THREE.Vector3()
    const box = new THREE.Box3().setFromObject(model)
    return box.getCenter(new THREE.Vector3())
  }

  private notifyListener(): void {
    if (this.stateListener) {
      this.stateListener(this.getState())
    }
  }

  private updateModelBounds(): void {
    if (!this.context) return
    const model = this.context.store.getState().modelObject
    if (!model) {
      this.modelMin = -5
      this.modelMax = 5
      return
    }
    const box = new THREE.Box3().setFromObject(model)
    switch (this.sectionAxis) {
      case 'x': this.modelMin = box.min.x; this.modelMax = box.max.x; break
      case 'y': this.modelMin = box.min.y; this.modelMax = box.max.y; break
      case 'z': this.modelMin = box.min.z; this.modelMax = box.max.z; break
    }
    if (this.sectionPosition < this.modelMin || this.sectionPosition > this.modelMax) {
      this.sectionPosition = this.modelMax
    }
  }

  applyClipping(): void {
    if (!this.context) return
    this.removeClipping()
    this.updateModelBounds()

    // 法线为负方向：箭头指向 +X 表示从 +X 方向剖切（移除正侧）
    // THREE.Plane 裁剪 n·p + d < 0 的部分
    // normal = (-1,0,0), d = position → 裁剪 -x + position < 0 → x > position（正侧被裁剪）
    const normal = new THREE.Vector3()
    switch (this.sectionAxis) {
      case 'x': normal.set(-1, 0, 0); break
      case 'y': normal.set(0, -1, 0); break
      case 'z': normal.set(0, 0, -1); break
    }

    const plane = new THREE.Plane(normal, this.sectionPosition)

    const model = this.context.store.getState().modelObject
    if (model) {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((m) => {
            m.clippingPlanes = [plane]
            m.clipShadows = true
            m.side = THREE.DoubleSide
            m.needsUpdate = true
          })
        }
      })
    }
    this.context.renderer.localClippingEnabled = true
  }

  private removeClipping(): void {
    if (this.context) {
      const model = this.context.store.getState().modelObject
      if (model) {
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach((m) => {
              m.clippingPlanes = []
              m.needsUpdate = true
            })
          }
        })
      }
    }
  }
}

export function createSectionPlugin(): ViewerPlugin {
  return new SectionPlugin()
}
