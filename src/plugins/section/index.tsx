import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'

type SectionMode = 'box' | 'axis' | 'face'

export class SectionPlugin implements ViewerPlugin {
  id = 'section'
  name = '剖面'
  icon = '✂️'
  group = 'section' as const

  private context: ViewerContext | null = null
  private active = false
  private clippingPlanes: THREE.Plane[] = []
  private sectionAxis: 'x' | 'y' | 'z' = 'y'
  private sectionPosition = 0
  private enabled = false

  install(context: ViewerContext): void {
    this.context = context
    context.messageBus.on('set-section', (payload: unknown) => {
      const p = payload as {
        mode: SectionMode
        axis?: string
        position?: number
        enabled: boolean
        normal?: number[]
      }
      if (p.axis) this.sectionAxis = p.axis as 'x' | 'y' | 'z'
      if (p.position !== undefined) this.sectionPosition = p.position
      this.enabled = p.enabled
      if (this.enabled) {
        this.applyClipping()
      } else {
        this.removeClipping()
      }
    })
  }

  uninstall(): void {
    this.removeClipping()
    this.context = null
  }

  activate(): void {
    this.active = true
  }

  deactivate(): void {
    this.active = false
    this.removeClipping()
  }

  isActive(): boolean {
    return this.active
  }

  private applyClipping(): void {
    if (!this.context) return
    this.removeClipping()

    const normal = new THREE.Vector3()
    switch (this.sectionAxis) {
      case 'x': normal.set(-1, 0, 0); break
      case 'y': normal.set(0, -1, 0); break
      case 'z': normal.set(0, 0, -1); break
    }

    const plane = new THREE.Plane(normal, -this.sectionPosition)
    this.clippingPlanes = [plane]

    const model = this.context.store.getState().modelObject
    if (model) {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              m.clippingPlanes = this.clippingPlanes
              m.clipShadows = true
              m.needsUpdate = true
            })
          } else {
            child.material.clippingPlanes = this.clippingPlanes
            child.material.clipShadows = true
            child.material.needsUpdate = true
          }
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
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => { m.clippingPlanes = []; m.needsUpdate = true })
            } else {
              child.material.clippingPlanes = []
              child.material.needsUpdate = true
            }
          }
        })
      }
    }
    this.clippingPlanes = []
  }
}

export function createSectionPlugin(): ViewerPlugin {
  return new SectionPlugin()
}
