import { useState } from 'react'
import { Icon } from '@iconify/react'
import { cameraIcon, crosshairIcon, eyeIcon } from './Icons'
import { ToolButton } from './ToolButton'
import { IconHome, IconPointer, IconCut, IconRuler, IconFitView } from './Icons'
import { useViewerStore } from '../store/viewer-store'
import { useSceneStore } from '../store/scene-store'
import type { ViewerPlugin } from '../plugins/types'
import type { PluginManager } from '../core/plugin-manager'
import { downloadScreenshot } from '../utils/screenshot'

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
  const cameraInfoVisible = useSceneStore((s) => s.cameraInfoVisible)
  const xrayMode = useSceneStore((s) => s.xrayMode)

  if (!toolbarVisible) return null

  const allPlugins = pluginManager.getAllPlugins()
  const filteredPlugins = allPlugins.filter((p) => {
    if (hiddenTools.length > 0 && hiddenTools.includes(p.id)) return false
    return true
  })

  const groups = ['picking', 'section', 'measurement'] as const
  const groupedPlugins = groups.map((group) => ({
    group,
    plugins: filteredPlugins.filter((p) => p.group === group),
  })).filter((g) => g.plugins.length > 0)

  const handleToolClick = (plugin: ViewerPlugin) => {
    if (activePluginId === plugin.id) {
      pluginManager.deactivate(plugin.id)
      useViewerStore.getState().setActivePluginId(null)
    } else {
      pluginManager.activate(plugin.id)
      useViewerStore.getState().setActivePluginId(plugin.id)
    }
  }

  /** 截图按钮点击处理 */
  const handleScreenshot = () => {
    downloadScreenshot()
  }

  return (
    <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
    <div className={`flex items-center gap-0.5 bg-[rgba(20,20,30,0.9)] rounded-[10px] backdrop-blur-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.4)] pointer-events-auto ${collapsed ? 'p-1' : 'py-1 px-2'}`}>
      <ToolButton
        icon={collapsed ? <span className="text-sm">☰</span> : <span className="text-[10px]">▽</span>}
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
              <div className="w-px h-5 bg-white/[0.12] mx-0.5" />
            </>
          )}
          {groupedPlugins.map(({ group, plugins }, gi) => (
            <div key={group} className="flex gap-0.5 items-center">
              {gi > 0 && <div className="w-px h-5 bg-white/[0.12] mx-0.5" />}
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
          {/* X-Ray mode button */}
          <div className="w-px h-5 bg-white/[0.12] mx-0.5" />
          <ToolButton
            icon={<Icon icon={eyeIcon} width={16} height={16} />}
            label={xrayMode ? '关闭透视' : '开启透视'}
            active={xrayMode}
            onClick={() => useSceneStore.getState().setXrayMode(!xrayMode)}
          />
          {/* 截图按钮 */}
          <div className="w-px h-5 bg-white/[0.12] mx-0.5" />
          <ToolButton
            icon={<Icon icon={cameraIcon} width={16} height={16} />}
            label="截图"
            onClick={handleScreenshot}
          />
          {/* 视角信息切换 */}
          <ToolButton
            icon={<Icon icon={crosshairIcon} width={16} height={16} />}
            label="视角信息"
            active={cameraInfoVisible}
            onClick={() => useSceneStore.getState().setCameraInfoVisible(!cameraInfoVisible)}
          />
        </>
      )}
    </div>
    </div>
  )
}
