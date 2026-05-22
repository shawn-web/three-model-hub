import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'

export class PickingPlugin implements ViewerPlugin {
  id = 'picking'
  name = '构件拾取'
  icon = 'pointer'
  group = 'picking' as const

  private context: ViewerContext | null = null
  private active = false
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()

  install(context: ViewerContext): void {
    this.context = context
  }

  uninstall(): void {
    this.clearSelection()
    this.context = null
  }

  activate(): void {
    this.active = true
    if (this.context) {
      this.context.renderer.domElement.addEventListener('click', this.handleClick)
      this.context.renderer.domElement.style.cursor = 'crosshair'
    }
  }

  deactivate(): void {
    this.active = false
    this.clearSelection()
    if (this.context) {
      this.context.renderer.domElement.removeEventListener('click', this.handleClick)
      this.context.renderer.domElement.style.cursor = 'default'
    }
  }

  isActive(): boolean {
    return this.active
  }

  private handleClick = (event: MouseEvent): void => {
    if (!this.context) return
    const rect = this.context.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.context.camera)

    const model = this.context.store.getState().modelObject
    if (!model) return

    const intersects = this.raycaster.intersectObjects(model.children, true)
    if (intersects.length > 0) {
      const hit = intersects[0].object
      this.context.store.getState().setSelectedComponentId(hit.uuid)
      this.context.messageBus.send('pick-result', {
        objectId: hit.uuid,
        info: { name: hit.name, type: hit.type, position: hit.position.toArray() },
      })
    } else {
      this.clearSelection()
      this.context.messageBus.send('pick-result', { objectId: null, info: {} })
    }
  }

  private clearSelection(): void {
    if (this.context) {
      this.context.store.getState().setSelectedComponentId(null)
    }
  }
}

export function createPickingPlugin(): ViewerPlugin {
  return new PickingPlugin()
}
