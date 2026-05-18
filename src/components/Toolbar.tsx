import { useState } from 'react'
import { ToolButton } from './ToolButton'
import { IconHome, IconPointer, IconCut, IconRuler, IconFitView, IconRotate } from './Icons'
import { useViewerStore } from '../store/viewer-store'
import type { ViewerPlugin } from '../plugins/types'
import type { PluginManager } from '../core/plugin-manager'

const ICON_MAP: Record<string, React.ReactNode> = {
  home: <IconHome size={16} />,
  pointer: <IconPointer size={16} />,
  cut: <IconCut size={16} />,
  ruler: <IconRuler size={16} />,
  fitview: <IconFitView size={16} />,
}

interface ToolbarProps {
  pluginManager: PluginManager
  onFitView?: () => void
}

export function Toolbar({ pluginManager, onFitView }: ToolbarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const activePluginId = useViewerStore((s) => s.activePluginId)
  const hiddenTools = useViewerStore((s) => s.hiddenTools)
  const toolbarVisible = useViewerStore((s) => s.toolbarVisible)
  const rotationMode = useViewerStore((s) => s.rotationMode)

  if (!toolbarVisible) return null

  const allPlugins = pluginManager.getAllPlugins()
  const filteredPlugins = allPlugins.filter((p) => {
    if (hiddenTools.length > 0 && hiddenTools.includes(p.id)) return false
    return true
  })

  const groups = ['navigation', 'picking', 'section', 'measurement'] as const
  const groupedPlugins = groups.map((group) => ({
    group,
    plugins: filteredPlugins.filter((p) => p.group === group),
  })).filter((g) => g.plugins.length > 0)

  const handleToolClick = (plugin: ViewerPlugin) => {
    if (activePluginId === plugin.id) {
      pluginManager.deactivate(plugin.id)
      useViewerStore.getState().setActivePluginId(null)
    } else {
      // Deactivate rotation mode when switching plugins
      if (rotationMode) {
        useViewerStore.getState().setRotationMode(false)
      }
      pluginManager.activate(plugin.id)
      useViewerStore.getState().setActivePluginId(plugin.id)
    }
  }

  const handleRotateClick = () => {
    const newMode = !rotationMode
    useViewerStore.getState().setRotationMode(newMode)
    // If activating rotation, deactivate any active plugin
    if (newMode && activePluginId) {
      pluginManager.deactivate(activePluginId)
      useViewerStore.getState().setActivePluginId(null)
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
      background: 'rgba(20, 20, 30, 0.9)',
      borderRadius: 10,
      padding: collapsed ? 4 : '4px 8px',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
    }}>
      <ToolButton
        icon={collapsed ? <span style={{ fontSize: 14 }}>☰</span> : <span style={{ fontSize: 10 }}>▽</span>}
        label={collapsed ? '展开工具栏' : '收起工具栏'}
        onClick={() => setCollapsed(!collapsed)}
      />
      {!collapsed && (
        <>
          {onFitView && (
            <>
              <ToolButton
                icon={ICON_MAP.fitview}
                label="适配视图"
                onClick={onFitView}
              />
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} />
            </>
          )}
          {groupedPlugins.map(({ group, plugins }, gi) => (
            <div key={group} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {gi > 0 && <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} />}
              {plugins.map((plugin) => (
                <ToolButton
                  key={plugin.id}
                  icon={ICON_MAP[plugin.icon || ''] || <span>?</span>}
                  label={plugin.name}
                  active={activePluginId === plugin.id}
                  onClick={() => handleToolClick(plugin)}
                />
              ))}
            </div>
          ))}
          {/* Rotate model button */}
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} />
          <ToolButton
            icon={<IconRotate size={16} />}
            label="旋转模型"
            active={rotationMode}
            onClick={handleRotateClick}
          />
        </>
      )}
    </div>
  )
}
