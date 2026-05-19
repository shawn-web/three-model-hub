import { useState, useCallback, useEffect } from 'react'
import { Dropdown, Modal, Input, message, Popconfirm, ConfigProvider, theme as antdTheme } from 'antd'
import type { MenuProps } from 'antd'
import { Icon } from '@iconify/react'
import { ToolButton } from './ToolButton'
import { IconHome, IconPointer, IconCut, IconRuler, IconFitView, IconRotate } from './Icons'
import { useViewerStore } from '../store/viewer-store'
import type { ViewerPlugin } from '../plugins/types'
import type { PluginManager } from '../core/plugin-manager'
import { downloadScreenshot } from '../utils/screenshot'

/** 工具栏内的 Dropdown 统一使用暗色主题 */
const darkDropdownConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorBgElevated: 'rgba(30, 30, 45, 0.95)',
    colorText: '#ddd',
    borderRadius: 8,
  },
}

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
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [viewpointName, setViewpointName] = useState('')
  const [saving, setSaving] = useState(false)
  const [annotationModalOpen, setAnnotationModalOpen] = useState(false)
  const [annotationText, setAnnotationText] = useState('')
  const [annotationAuthor, setAnnotationAuthor] = useState('')
  const [annotationPosition, setAnnotationPosition] = useState<{ x: number; y: number; z: number } | null>(null)
  const [annotationSaving, setAnnotationSaving] = useState(false)
  const activePluginId = useViewerStore((s) => s.activePluginId)
  const hiddenTools = useViewerStore((s) => s.hiddenTools)
  const toolbarVisible = useViewerStore((s) => s.toolbarVisible)
  const rotationMode = useViewerStore((s) => s.rotationMode)
  const sceneId = useViewerStore((s) => s.sceneId)
  const viewpoints = useViewerStore((s) => s.viewpoints)
  // 视点加载状态（供后续加载指示器使用）
  const annotations = useViewerStore((s) => s.annotations)
  const addingAnnotation = useViewerStore((s) => s.addingAnnotation)
  const viewerType = useViewerStore((s) => s.viewerType)
  const cameraInfoVisible = useViewerStore((s) => s.cameraInfoVisible)

  /** 当场景 ID 变化时加载视点和批注（仅场景模式） */
  useEffect(() => {
    if (sceneId && viewerType === 'scene') {
      useViewerStore.getState().loadViewpoints(sceneId)
      useViewerStore.getState().loadAnnotations(sceneId)
    }
  }, [sceneId, viewerType])

  /** 注册批注点击回调，当用户在模型上点击时弹出输入框 */
  useEffect(() => {
    useViewerStore.getState().setOnAnnotationClick((position) => {
      setAnnotationPosition(position)
      setAnnotationText('')
      setAnnotationAuthor('')
      setAnnotationModalOpen(true)
      // 退出添加模式
      useViewerStore.getState().setAddingAnnotation(false)
    })
    return () => {
      useViewerStore.getState().setOnAnnotationClick(null)
    }
  }, [])

  /** 保存视点 */
  const handleSaveViewpoint = useCallback(async () => {
    if (!sceneId) {
      message.warning('请先加载场景')
      return
    }
    if (!viewpointName.trim()) {
      message.warning('请输入视点名称')
      return
    }
    setSaving(true)
    try {
      await useViewerStore.getState().saveViewpoint(sceneId, viewpointName.trim())
      message.success('视点已保存')
      setViewpointName('')
      setSaveModalOpen(false)
    } catch (err) {
      message.error('保存视点失败')
      console.error('[Toolbar] 保存视点失败:', err)
    } finally {
      setSaving(false)
    }
  }, [sceneId, viewpointName])

  /** 删除视点 */
  const handleDeleteViewpoint = useCallback(async (id: string) => {
    if (!sceneId) return
    try {
      await useViewerStore.getState().deleteViewpoint(sceneId, id)
      message.success('视点已删除')
    } catch (err) {
      message.error('删除视点失败')
      console.error('[Toolbar] 删除视点失败:', err)
    }
  }, [sceneId])

  /** 切换添加批注模式 */
  const handleToggleAnnotation = useCallback(() => {
    const newState = !addingAnnotation
    useViewerStore.getState().setAddingAnnotation(newState)
    if (newState && activePluginId) {
      pluginManager.deactivate(activePluginId)
      useViewerStore.getState().setActivePluginId(null)
    }
  }, [addingAnnotation, activePluginId, pluginManager])

  /** 保存批注 */
  const handleSaveAnnotation = useCallback(async () => {
    if (!sceneId || !annotationPosition) return
    if (!annotationText.trim()) {
      message.warning('请输入批注内容')
      return
    }
    setAnnotationSaving(true)
    try {
      await useViewerStore.getState().addAnnotation(sceneId, {
        position: annotationPosition,
        text: annotationText.trim(),
        author: annotationAuthor.trim() || undefined,
      })
      message.success('批注已添加')
      setAnnotationModalOpen(false)
      setAnnotationText('')
      setAnnotationAuthor('')
      setAnnotationPosition(null)
    } catch (err) {
      message.error('添加批注失败')
      console.error('[Toolbar] 添加批注失败:', err)
    } finally {
      setAnnotationSaving(false)
    }
  }, [sceneId, annotationPosition, annotationText, annotationAuthor])

  /** 删除批注 */
  const handleDeleteAnnotation = useCallback(async (id: string) => {
    if (!sceneId) return
    try {
      await useViewerStore.getState().removeAnnotation(sceneId, id)
      message.success('批注已删除')
    } catch (err) {
      message.error('删除批注失败')
      console.error('[Toolbar] 删除批注失败:', err)
    }
  }, [sceneId])

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

  /** 截图按钮点击处理 */
  const handleScreenshot = () => {
    downloadScreenshot()
  }

  /** 视点列表下拉菜单项 */
  const viewpointMenuItems: MenuProps['items'] = viewpoints.length > 0
    ? viewpoints.map((vp) => ({
      key: vp.id,
      icon: <Icon icon="lucide:crosshair" width={14} height={14} />,
      label: (
        <div className="flex items-center justify-between min-w-[160px]">
          <span>{vp.name}</span>
          <Popconfirm
            title="确定删除此视点?"
            onConfirm={(e) => {
              e?.stopPropagation()
              handleDeleteViewpoint(vp.id)
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <span className="ml-2"><Icon icon="lucide:trash-2" width={14} height={14} style={{ color: "#ff4d4f" }} /></span>
          </Popconfirm>
        </div>
      ),
    }))
    : [{ key: 'empty', label: '暂无保存的视点', disabled: true }]

  /** 视点菜单点击处理 */
  const handleViewpointMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'empty') return
    const vp = viewpoints.find((v) => v.id === key)
    if (vp) {
      useViewerStore.getState().applyViewpoint(vp)
    }
  }

  return (
    <ConfigProvider theme={darkDropdownConfig} getPopupContainer={() => document.body}>
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
          {/* Rotate model button */}
          <div className="w-px h-5 bg-white/[0.12] mx-0.5" />
          <ToolButton
            icon={<IconRotate size={16} />}
            label="旋转模型"
            active={rotationMode}
            onClick={handleRotateClick}
          />
          {/* 截图按钮 */}
          <div className="w-px h-5 bg-white/[0.12] mx-0.5" />
          <ToolButton
            icon={<Icon icon="lucide:camera" width={16} height={16} />}
            label="截图"
            onClick={handleScreenshot}
          />
          {/* 视角信息切换 */}
          <ToolButton
            icon={<Icon icon="lucide:crosshair" width={16} height={16} />}
            label="视角信息"
            active={cameraInfoVisible}
            onClick={() => useViewerStore.getState().setCameraInfoVisible(!cameraInfoVisible)}
          />
          {/* 视点功能按钮 */}
          {sceneId && viewerType === 'scene' && (
            <>
              <div className="w-px h-5 bg-white/[0.12] mx-0.5" />
              <ToolButton
                icon={<Icon icon="lucide:crosshair" width={16} height={16} />}
                label="保存视点"
                onClick={() => setSaveModalOpen(true)}
              />
              <Dropdown
                menu={{ items: viewpointMenuItems, onClick: handleViewpointMenuClick }}
                trigger={['click']}
                placement="top"
              >
                <ToolButton
                  icon={<Icon icon="lucide:list" width={16} height={16} />}
                  label="视点列表"
                  onClick={() => {}}
                />
              </Dropdown>
              <Modal
                title="保存视点"
                open={saveModalOpen}
                onOk={handleSaveViewpoint}
                onCancel={() => { setSaveModalOpen(false); setViewpointName('') }}
                okText="保存"
                cancelText="取消"
                confirmLoading={saving}
                styles={{ body: { paddingTop: 16 } }}
              >
                <Input
                  placeholder="请输入视点名称"
                  value={viewpointName}
                  onChange={(e) => setViewpointName(e.target.value)}
                  onPressEnter={handleSaveViewpoint}
                  maxLength={100}
                  autoFocus
                />
              </Modal>
            </>
          )}
          {/* 批注功能按钮 */}
          {sceneId && viewerType === 'scene' && (
            <>
              <div className="w-px h-5 bg-white/[0.12] mx-0.5" />
              <ToolButton
                icon={<Icon icon="lucide:message-square" width={16} height={16} />}
                label="添加批注"
                active={addingAnnotation}
                onClick={handleToggleAnnotation}
              />
              <Dropdown
                menu={{
                  items: annotations.length > 0
                    ? annotations.map((ann, idx) => ({
                        key: ann.id,
                        label: (
                          <div className="flex items-center justify-between min-w-[200px]">
                            <div className="flex-1 overflow-hidden">
                              <div className="text-xs text-[#999]">
                                #{idx + 1} ({ann.position.x.toFixed(1)}, {ann.position.y.toFixed(1)}, {ann.position.z.toFixed(1)})
                              </div>
                              <div className="whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px]">
                                {ann.text}
                              </div>
                            </div>
                            <Popconfirm
                              title="确定删除此批注?"
                              onConfirm={(e) => {
                                e?.stopPropagation()
                                handleDeleteAnnotation(ann.id)
                              }}
                              onCancel={(e) => e?.stopPropagation()}
                            >
                              <span className="ml-2"><Icon icon="lucide:trash-2" width={14} height={14} style={{ color: "#ff4d4f" }} /></span>
                            </Popconfirm>
                          </div>
                        ),
                      }))
                    : [{ key: 'empty', label: '暂无批注', disabled: true }],
                }}
                trigger={['click']}
                placement="top"
              >
                <ToolButton
                  icon={<Icon icon="lucide:list" width={16} height={16} />}
                  label="批注列表"
                  onClick={() => {}}
                />
              </Dropdown>
              <Modal
                title="添加批注"
                open={annotationModalOpen}
                onOk={handleSaveAnnotation}
                onCancel={() => {
                  setAnnotationModalOpen(false)
                  setAnnotationText('')
                  setAnnotationAuthor('')
                  setAnnotationPosition(null)
                }}
                okText="保存"
                cancelText="取消"
                confirmLoading={annotationSaving}
                styles={{ body: { paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 } }}
              >
                <Input
                  placeholder="作者（可选）"
                  value={annotationAuthor}
                  onChange={(e) => setAnnotationAuthor(e.target.value)}
                  maxLength={50}
                />
                <Input.TextArea
                  placeholder="请输入批注内容"
                  value={annotationText}
                  onChange={(e) => setAnnotationText(e.target.value)}
                  maxLength={500}
                  rows={4}
                  autoFocus
                />
              </Modal>
            </>
          )}
        </>
      )}
    </div>
    </div>
    </ConfigProvider>
  )
}
