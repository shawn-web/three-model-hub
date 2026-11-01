import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { PluginManager } from '../src/core/plugin-manager'
import { MeasurementPlugin } from '../src/plugins/measurement'
import type { ViewerContext, ViewerPlugin } from '../src/plugins/types'

function createOtherPlugin(): ViewerPlugin {
  let active = false
  return {
    id: 'other',
    name: 'Other',
    install() {},
    uninstall() {},
    activate() { active = true },
    deactivate() { active = false },
    isActive() { return active },
  }
}

describe('MeasurementPlugin', () => {
  it('clears existing measurements when switching to another tool', () => {
    const manager = new PluginManager()
    const measurement = new MeasurementPlugin()
    manager.register(measurement, {} as ViewerContext)
    manager.register(createOtherPlugin(), {} as ViewerContext)

    manager.activate('measurement')
    measurement.addPoint(new THREE.Vector3(0, 0, 0))
    measurement.addPoint(new THREE.Vector3(1, 0, 0))
    expect(measurement.getMeasurements()).toHaveLength(1)

    manager.activate('other')

    expect(measurement.getMeasurements()).toHaveLength(0)
    expect(measurement.getPendingStart()).toBeNull()
  })
})
