/**
 * 编辑器左侧面板
 *
 * 使用 Tabs 切换两个功能区域：
 * - 场景：场景设置、场景模型管理、媒体管理、标点管理
 * - 模型：模型的树形结构，支持选中/勾选/展开
 */
import { useCallback } from 'react'
import { Tabs, theme as antdTheme, Button, Popconfirm } from 'antd'
import type { TabsProps } from 'antd'
import { Icon } from '@iconify/react'
import { layersIcon, gitBranchIcon, trash2Icon, plusIcon } from './Icons'
import { SceneTree } from './SceneTree'
import { SceneSettings } from './SceneSettings'
import { SceneImagePanel } from './SceneImagePanel'
import { MarkerList } from './MarkerList'
import { useEditStore } from '../store/edit-store'
import type { MarkerData } from '../types/edit-data'

/** 分区标题 */
export function SectionTitle({ title }: { title: string }) {
  const { token } = antdTheme.useToken()
  return (
    <div style={{
      fontSize: 12,
      fontWeight: 600,
      color: token.colorTextSecondary,
      padding: '8px 4px 4px',
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
      marginBottom: 8,
    }}>
      {title}
    </div>
  )
}

/** 场景模型条目（从 API 返回并附加 resolvedName） */
interface SceneModelItem {
  id: string
  model_id?: string
  display_name?: string
  resolvedName?: string
  [key: string]: unknown
}

interface EditPanelProps {
  sceneModels: SceneModelItem[]
  onRemoveModel: (id: string) => void
  onOpenAddModal: () => void
  onAddModel: (modelId: string) => void
  onSelectModel?: (sceneModelId: string) => void
  onEditMarker?: (marker: MarkerData) => void
}

/** 编辑器左侧面板组件 */
export function EditPanel({ sceneModels, onRemoveModel, onOpenAddModal, onSelectModel, onEditMarker }: EditPanelProps) {
  const activeTab = useEditStore((s) => s.activeTab)
  const setActiveTab = useEditStore((s) => s.setActiveTab)
  const { token } = antdTheme.useToken()

  const items: TabsProps['items'] = [
    {
      key: 'scene',
      label: (
        <span className="flex items-center gap-1">
          <Icon icon={layersIcon} width={14} />
          场景
        </span>
      ),
      children: (
        <div style={{ overflowY: 'auto', overflowX: 'hidden', padding: '4px 0' }}>
          <SceneTab sceneModels={sceneModels} onRemoveModel={onRemoveModel} onOpenAddModal={onOpenAddModal} onSelectModel={onSelectModel} onEditMarker={onEditMarker || (() => {})} />
        </div>
      ),
    },
    {
      key: 'model',
      label: (
        <span className="flex items-center gap-1">
          <Icon icon={gitBranchIcon} width={14} />
          模型
        </span>
      ),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <SceneTree />
        </div>
      ),
    },
  ]

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key)
  }, [setActiveTab])

  return (
    <div
      style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={items}
        size="small"
        className="edit-panel-tabs"
        tabBarStyle={{
          marginBottom: 0,
          padding: '0 8px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      />
    </div>
  )
}

/** 场景 Tab 内容：场景设置 + 场景模型 + 图片管理 + 标点管理 */
function SceneTab({ sceneModels, onRemoveModel, onOpenAddModal, onSelectModel, onEditMarker }: {
  sceneModels: SceneModelItem[]
  onRemoveModel: (id: string) => void
  onOpenAddModal: () => void
  onSelectModel?: (sceneModelId: string) => void
  onEditMarker?: (marker: MarkerData) => void
}) {
  const modelObject = useEditStore((s) => s.modelObject)
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const { token } = antdTheme.useToken()

  /** 判断场景模型是否被选中 */
  const isModelSelected = useCallback((sceneModelId: string) => {
    if (!modelObject || !selectedComponentId) return false
    const wrapper = modelObject.children.find(
      (child) => child.userData?.sceneModelId === sceneModelId,
    )
    return wrapper?.uuid === selectedComponentId
  }, [modelObject, selectedComponentId])

  return (
    <div style={{ overflow: 'auto', padding: 8 }}>
      {/* 场景设置 */}
      <SceneSettings />

      {/* 场景模型 */}
      <SectionTitle title={`场景模型 (${sceneModels.length})`} />
      <div style={{ marginBottom: 8 }}>
        {sceneModels.map((sm, i) => {
          const selected = isModelSelected(sm.id)
          return (
            <div
              key={sm.id}
              className="flex items-center justify-between py-1 px-2 group cursor-pointer rounded"
              style={selected ? { background: 'token.colorPrimaryBg' } : undefined}
              onClick={() => onSelectModel?.(sm.id)}
            >
              <span
                className={`text-xs flex-1 truncate ${selected ? 'font-semibold' : ''}`}
                style={selected ? { color: token.colorPrimary } : undefined}
                title={sm.resolvedName || sm.display_name || `模型 ${i + 1}`}
              >
                {sm.resolvedName || sm.display_name || `模型 ${i + 1}`}
              </span>
              <Popconfirm
                title="确认删除"
                description={`确定删除模型 "${sm.resolvedName || sm.display_name || `模型 ${i + 1}`}" 吗？`}
                onConfirm={(e) => { e?.stopPropagation(); onRemoveModel(sm.id) }}
                onCancel={(e) => e?.stopPropagation()}
                okText="确定"
                cancelText="取消"
              >
                <Button type="text" size="small" danger onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100">
                  <Icon icon={trash2Icon} width={14} />
                </Button>
              </Popconfirm>
            </div>
          )
        })}
        <Button type="dashed" icon={<Icon icon={plusIcon} width={14} />} block size="small" className="mt-2" onClick={onOpenAddModal}>
          添加模型
        </Button>
      </div>

      {/* 媒体管理 */}
      <SectionTitle title="媒体管理" />
      <SceneImagePanel />

      {/* 标点管理 */}
      <SectionTitle title="标点管理" />
      <MarkerList onEditMarker={onEditMarker || (() => {})} />
    </div>
  )
}
