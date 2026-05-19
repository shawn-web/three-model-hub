/**
 * 编辑器左侧面板
 *
 * 使用 Tabs 切换三个功能区域：
 * - 场景：场景设置、场景模型管理、图片配置
 * - 模型：模型的树形结构，支持选中/勾选/展开
 * - 属性：选中构件的属性编辑 + 标点管理
 */
import { useState, useCallback } from 'react'
import { Tabs, theme as antdTheme, Button } from 'antd'
import type { TabsProps } from 'antd'
import { Icon } from '@iconify/react'
import { SceneTree } from './SceneTree'
import { SceneSettings } from './SceneSettings'
import { ComponentProperties } from './ComponentProperties'
import { SceneImagePanel } from './SceneImagePanel'
import { MarkerList } from '../pages/SceneEditorPage'

interface EditPanelProps {
  sceneModels: any[]
  onRemoveModel: (id: string) => void
  onOpenAddModal: () => void
  onAddModel: (modelId: string) => void
  onEditMarker?: (marker: any) => void
}

/** 编辑器左侧面板组件 */
export function EditPanel({ sceneModels, onRemoveModel, onOpenAddModal, onEditMarker }: EditPanelProps) {
  const [activeTab, setActiveTab] = useState('scene')
  const { token } = antdTheme.useToken()

  const items: TabsProps['items'] = [
    {
      key: 'scene',
      label: (
        <span className="flex items-center gap-1">
          <Icon icon="lucide:layers" width={14} />
          场景
        </span>
      ),
      children: <SceneTab sceneModels={sceneModels} onRemoveModel={onRemoveModel} onOpenAddModal={onOpenAddModal} />,
    },
    {
      key: 'model',
      label: (
        <span className="flex items-center gap-1">
          <Icon icon="lucide:git-branch" width={14} />
          模型
        </span>
      ),
      children: <SceneTree />,
    },
    {
      key: 'properties',
      label: (
        <span className="flex items-center gap-1">
          <Icon icon="lucide:sliders" width={14} />
          属性
        </span>
      ),
      children: (
        <div style={{ overflow: 'auto', padding: '4px 0', maxHeight: 'calc(100vh - 200px)' }}>
          <ComponentProperties />
          <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, marginTop: 8, paddingTop: 8 }}>
            <SectionTitle title="标点管理" />
            <MarkerList onEditMarker={onEditMarker || (() => {})} />
          </div>
        </div>
      ),
    },
  ]

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key)
  }, [])

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={items}
        size="small"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
        tabBarStyle={{
          marginBottom: 0,
          padding: '0 8px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
        tabPaneStyle={{
          overflow: 'auto',
          padding: '4px 0',
          maxHeight: 'calc(100% - 40px)',
        }}
      />
    </div>
  )
}

/** 场景 Tab 内容：场景设置 + 场景模型 + 图片管理 */
function SceneTab({ sceneModels, onRemoveModel, onOpenAddModal }: {
  sceneModels: any[]
  onRemoveModel: (id: string) => void
  onOpenAddModal: () => void
}) {
  const { token } = antdTheme.useToken()

  return (
    <div style={{ overflow: 'auto', padding: '4px 8px', maxHeight: 'calc(100vh - 200px)' }}>
      {/* 场景设置 */}
      <div style={{ marginBottom: 12 }}>
        <SceneSettings />
      </div>

      {/* 场景模型 */}
      <SectionTitle title={`场景模型 (${sceneModels.length})`} />
      <div style={{ marginBottom: 12 }}>
        {sceneModels.map((sm, i) => (
          <div key={sm.id} className="flex items-center justify-between py-1 px-2 group cursor-pointer hover:bg-[var(--ant-color-bg-text-hover)] rounded">
            <span
              className="text-xs flex-1 truncate"
              title={sm.resolvedName || sm.display_name || `模型 ${i + 1}`}
            >
              {sm.resolvedName || sm.display_name || `模型 ${i + 1}`}
            </span>
            <Button type="text" size="small" danger onClick={() => onRemoveModel(sm.id)} className="opacity-0 group-hover:opacity-100">
              <Icon icon="lucide:trash-2" width={14} />
            </Button>
          </div>
        ))}
        <Button type="dashed" icon={<Icon icon="lucide:plus" width={14} />} block size="small" className="mt-2" onClick={onOpenAddModal}>
          添加模型
        </Button>
      </div>

      {/* 图片管理 */}
      <SectionTitle title="图片管理" />
      <SceneImagePanel />
    </div>
  )
}

/** 分区标题 */
function SectionTitle({ title }: { title: string }) {
  const { token } = antdTheme.useToken()
  return (
    <div style={{
      fontSize: 12,
      fontWeight: 600,
      color: token.colorTextSecondary,
      padding: '6px 4px 4px',
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
      marginBottom: 6,
    }}>
      {title}
    </div>
  )
}
