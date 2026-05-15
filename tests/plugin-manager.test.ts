import { describe, it, expect, beforeEach } from 'vitest'
import { PluginManager } from '../src/core/plugin-manager'
import type { ViewerPlugin, ViewerContext } from '../src/plugins/types'

function createMockPlugin(id: string): ViewerPlugin & { activated: boolean; installed: boolean } {
  return {
    id,
    name: `Mock ${id}`,
    activated: false,
    installed: false,
    install() { this.installed = true },
    uninstall() { this.installed = false },
    activate() { this.activated = true },
    deactivate() { this.activated = false },
    isActive() { return this.activated },
  }
}

describe('PluginManager', () => {
  let manager: PluginManager
  const mockContext = {} as ViewerContext

  beforeEach(() => {
    manager = new PluginManager()
  })

  it('should register and install a plugin', () => {
    const plugin = createMockPlugin('test')
    manager.register(plugin, mockContext)
    expect(plugin.installed).toBe(true)
    expect(manager.getPluginIds()).toContain('test')
  })

  it('should activate a plugin', () => {
    const plugin = createMockPlugin('test')
    manager.register(plugin, mockContext)
    manager.activate('test')
    expect(plugin.activated).toBe(true)
  })

  it('should deactivate current plugin when activating another', () => {
    const pluginA = createMockPlugin('a')
    const pluginB = createMockPlugin('b')
    manager.register(pluginA, mockContext)
    manager.register(pluginB, mockContext)
    manager.activate('a')
    manager.activate('b')
    expect(pluginA.activated).toBe(false)
    expect(pluginB.activated).toBe(true)
  })

  it('should deactivate a plugin', () => {
    const plugin = createMockPlugin('test')
    manager.register(plugin, mockContext)
    manager.activate('test')
    manager.deactivate('test')
    expect(plugin.activated).toBe(false)
  })

  it('should unregister a plugin', () => {
    const plugin = createMockPlugin('test')
    manager.register(plugin, mockContext)
    manager.unregister('test')
    expect(manager.getPluginIds()).not.toContain('test')
    expect(plugin.installed).toBe(false)
  })

  it('should return plugin by id', () => {
    const plugin = createMockPlugin('test')
    manager.register(plugin, mockContext)
    expect(manager.getPlugin('test')).toBe(plugin)
  })

  it('should return undefined for unknown plugin', () => {
    expect(manager.getPlugin('unknown')).toBeUndefined()
  })

  it('should return all registered plugins', () => {
    manager.register(createMockPlugin('a'), mockContext)
    manager.register(createMockPlugin('b'), mockContext)
    expect(manager.getPluginIds()).toEqual(['a', 'b'])
  })
})
