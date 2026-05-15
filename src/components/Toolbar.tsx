import { useState } from 'react'
import { ToolButton } from './ToolButton'
import { useViewerStore } from '../store/viewer-store'
import type { ViewerPlugin } from '../plugins/types'
import type { PluginManager } from '../core/plugin-manager'

interface ToolbarProps {
  pluginManager: PluginManager
}

export function Toolbar({ pluginManager }: ToolbarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const activePluginId = useViewerStore((s) => s.activePluginId)
  const visibleTools = useViewerStore((s) => s.visibleTools)
  const hiddenTools = useViewerStore((s) => s.hiddenTools)
  const toolbarVisible = useViewerStore((s) => s.toolbarVisible)

  if (!toolbarVisible) return null

  const allPlugins = pluginManager.getAllPlugins()
  const filteredPlugins = allPlugins.filter((p) => {
    if (hiddenTools.length > 0 && hiddenTools.includes(p.id)) return false
    if (visibleTools.length > 0 && !visibleTools.includes(p.id)) return false
    return true
  })

  const groups = ['navigation', 'picking', 'section', 'measurement', 'floor'] as const
  const groupedPlugins = groups.map((group) => ({
    group,
    plugins: filteredPlugins.filter((p) => p.group === group),
  })).filter((g) => g.plugins.length > 0)
  const ungrouped = filteredPlugins.filter((p) => !p.group)

  const handleToolClick = (plugin: ViewerPlugin) => {
    if (activePluginId === plugin.id) {
      pluginManager.deactivate(plugin.id)
      useViewerStore.getState().setActivePluginId(null)
    } else {
      pluginManager.activate(plugin.id)
      useViewerStore.getState().setActivePluginId(plugin.id)
    }
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: 'rgba(30, 30, 40, 0.85)',
      borderRadius: 8,
      padding: collapsed ? 4 : '4px 8px',
      backdropFilter: 'blur(8px)',
    }}>
      <ToolButton
        icon={collapsed ? '☰' : '▽'}
        label={collapsed ? '展开工具栏' : '收起工具栏'}
        onClick={() => setCollapsed(!collapsed)}
      />
      {!collapsed && (
        <>
          {groupedPlugins.map(({ group, plugins }, gi) => (
            <div key={group} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {gi > 0 && <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />}
              {plugins.map((plugin) => (
                <ToolButton
                  key={plugin.id}
                  icon={plugin.icon || '?'}
                  label={plugin.name}
                  active={activePluginId === plugin.id}
                  onClick={() => handleToolClick(plugin)}
                />
              ))}
            </div>
          ))}
          {ungrouped.length > 0 && groupedPlugins.length > 0 && (
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
          )}
          {ungrouped.map((plugin) => (
            <ToolButton
              key={plugin.id}
              icon={plugin.icon || '?'}
              label={plugin.name}
              active={activePluginId === plugin.id}
              onClick={() => handleToolClick(plugin)}
            />
          ))}
        </>
      )}
    </div>
  )
}
