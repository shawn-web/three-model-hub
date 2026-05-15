import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'

export interface FloorInfo {
  name: string
  elevation: number
  height: number
}

export class FloorPlugin implements ViewerPlugin {
  id = 'floor'
  name = '楼层'
  icon = '🏢'
  group = 'floor' as const

  private context: ViewerContext | null = null
  private active = false
  private floors: FloorInfo[] = []
  private activeFloor: number | null = null

  install(context: ViewerContext): void {
    this.context = context
  }

  uninstall(): void {
    this.showAllFloors()
    this.context = null
  }

  activate(): void {
    this.active = true
  }

  deactivate(): void {
    this.active = false
    this.showAllFloors()
  }

  isActive(): boolean {
    return this.active
  }

  setFloors(floors: FloorInfo[]): void {
    this.floors = floors
  }

  showFloor(index: number): void {
    if (!this.context || index < 0 || index >= this.floors.length) return
    this.activeFloor = index
    const floor = this.floors[index]
    const model = this.context.store.getState().modelObject
    if (!model) return

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const worldY = new THREE.Vector3()
        child.getWorldPosition(worldY)
        child.visible = worldY.y >= floor.elevation && worldY.y < floor.elevation + floor.height
      }
    })
  }

  showAllFloors(): void {
    if (!this.context) return
    const model = this.context.store.getState().modelObject
    if (!model) return
    model.traverse((child) => { child.visible = true })
    this.activeFloor = null
  }

  getActiveFloor(): number | null {
    return this.activeFloor
  }

  getFloors(): FloorInfo[] {
    return this.floors
  }
}

export function createFloorPlugin(): ViewerPlugin {
  return new FloorPlugin()
}
