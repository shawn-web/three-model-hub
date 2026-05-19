import type { ViewerPlugin, ViewerContext } from '../plugins/types'

export class PluginManager {
  private plugins = new Map<string, ViewerPlugin>()
  private activePluginId: string | null = null
  private context: ViewerContext | null = null

  setContext(context: ViewerContext): void {
    this.context = context
  }

  register(plugin: ViewerPlugin, context?: ViewerContext): void {
    const ctx = context ?? this.context
    if (!ctx) throw new Error('ViewerContext not set')

    this.plugins.set(plugin.id, plugin)
    plugin.install(ctx)
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    if (this.activePluginId === pluginId) {
      plugin.deactivate()
      this.activePluginId = null
    }
    plugin.uninstall()
    this.plugins.delete(pluginId)
  }

  activate(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    if (this.activePluginId && this.activePluginId !== pluginId) {
      this.plugins.get(this.activePluginId)?.deactivate()
    }

    this.activePluginId = pluginId
    plugin.activate()
  }

  deactivate(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    if (this.activePluginId === pluginId) {
      this.activePluginId = null
    }
    plugin.deactivate()
  }

  getPlugin(pluginId: string): ViewerPlugin | undefined {
    return this.plugins.get(pluginId)
  }

  getPluginIds(): string[] {
    return Array.from(this.plugins.keys())
  }

  getActivePluginId(): string | null {
    return this.activePluginId
  }

  getAllPlugins(): ViewerPlugin[] {
    return Array.from(this.plugins.values())
  }
}
