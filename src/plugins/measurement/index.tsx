import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'

interface Measurement {
  start: THREE.Vector3
  end: THREE.Vector3
  distance: number
  line: THREE.Line
  label: THREE.Sprite
}

export class MeasurementPlugin implements ViewerPlugin {
  id = 'measurement'
  name = '测量'
  icon = '📏'
  group = 'measurement' as const

  private context: ViewerContext | null = null
  private active = false
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private measurements: Measurement[] = []
  private pendingStart: THREE.Vector3 | null = null
  private measurementGroup = new THREE.Group()

  install(context: ViewerContext): void {
    this.context = context
    context.scene.add(this.measurementGroup)
  }

  uninstall(): void {
    this.clearAll()
    this.context?.scene.remove(this.measurementGroup)
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
    this.pendingStart = null
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
    if (intersects.length === 0) return

    const point = intersects[0].point

    if (!this.pendingStart) {
      this.pendingStart = point.clone()
      this.addMarker(point)
    } else {
      this.addMeasurement(this.pendingStart, point)
      this.pendingStart = null
    }
  }

  private addMarker(position: THREE.Vector3): void {
    const geometry = new THREE.SphereGeometry(0.1, 8, 8)
    const material = new THREE.MeshBasicMaterial({ color: 0x4a9eff })
    const sphere = new THREE.Mesh(geometry, material)
    sphere.position.copy(position)
    this.measurementGroup.add(sphere)
  }

  private addMeasurement(start: THREE.Vector3, end: THREE.Vector3): void {
    const distance = start.distanceTo(end)
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end])
    const material = new THREE.LineBasicMaterial({ color: 0x4a9eff, linewidth: 2 })
    const line = new THREE.Line(geometry, material)
    this.measurementGroup.add(line)

    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, 256, 64)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${distance.toFixed(2)}m`, 128, 42)

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.position.copy(midPoint)
    sprite.scale.set(2, 0.5, 1)
    this.measurementGroup.add(sprite)

    this.measurements.push({ start, end, distance, line, label: sprite })
  }

  clearAll(): void {
    while (this.measurementGroup.children.length > 0) {
      const child = this.measurementGroup.children[0]
      this.measurementGroup.remove(child)
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry?.dispose()
        ;(child as any).material?.dispose()
      }
    }
    this.measurements = []
    this.pendingStart = null
  }
}

export function createMeasurementPlugin(): ViewerPlugin {
  return new MeasurementPlugin()
}
