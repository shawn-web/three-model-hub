import * as THREE from 'three'
import type { ViewerPlugin, ViewerContext } from '../types'

export interface MeasurementData {
  id: string
  start: THREE.Vector3
  end: THREE.Vector3
  distance: number
}

export class MeasurementPlugin implements ViewerPlugin {
  id = 'measurement'
  name = '测量'
  icon = 'ruler'
  group = 'measurement' as const

  private active = false
  private measurements: MeasurementData[] = []
  private pendingStart: THREE.Vector3 | null = null
  private nextId = 0

  // Listener for state changes from scene components
  private stateListener: ((measurements: MeasurementData[], pendingStart: THREE.Vector3 | null) => void) | null = null

   
  install(_context: ViewerContext): void {
    // 场景交互由 PluginScene 组件处理，无需 context
  }

  uninstall(): void {
    this.clearAll()
    this.stateListener = null
  }

  activate(): void {
    this.active = true
  }

  deactivate(): void {
    this.active = false
    this.clearAll()
  }

  isActive(): boolean {
    return this.active
  }

  /** Set a listener that will be called whenever measurements change */
  onStateChange(listener: (measurements: MeasurementData[], pendingStart: THREE.Vector3 | null) => void): void {
    this.stateListener = listener
  }

  getMeasurements(): MeasurementData[] {
    return this.measurements
  }

  getPendingStart(): THREE.Vector3 | null {
    return this.pendingStart
  }

  /**
   * Add a measurement point. If no pending start, stores it.
   * If there is a pending start, creates a complete measurement.
   * Returns true if a measurement was completed.
   */
  addPoint(point: THREE.Vector3): boolean {
    if (!this.pendingStart) {
      this.pendingStart = point.clone()
      this.notifyListener()
      return false
    } else {
      const distance = this.pendingStart.distanceTo(point)
      const measurement: MeasurementData = {
        id: `measurement-${this.nextId++}`,
        start: this.pendingStart.clone(),
        end: point.clone(),
        distance,
      }
      this.measurements.push(measurement)
      this.pendingStart = null
      this.notifyListener()
      return true
    }
  }

  /** Cancel pending measurement (e.g. right-click) */
  cancelPending(): void {
    this.pendingStart = null
    this.notifyListener()
  }

  /** Clear all measurements */
  clearAll(): void {
    this.measurements = []
    this.pendingStart = null
    this.notifyListener()
  }

  /** Format distance with proper units */
  formatDistance(distance: number): string {
    if (distance < 0.01) {
      return `${(distance * 1000).toFixed(1)}mm`
    }
    return `${distance.toFixed(3)}m`
  }

  private notifyListener(): void {
    if (this.stateListener) {
      this.stateListener(this.measurements, this.pendingStart)
    }
  }
}

export function createMeasurementPlugin(): ViewerPlugin {
  return new MeasurementPlugin()
}
