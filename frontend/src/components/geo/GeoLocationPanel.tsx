/**
 * Geo 页面右侧面板
 * 模型列表 + 坐标编辑 + 标点管理
 *
 * 交互流程：
 * - 点击未定位的模型 → 自动进入放置模式 → 点击地图放置
 * - 点击已定位的模型 → 选中并展示坐标编辑面板
 * - 标点管理：添加/编辑/删除地图标点
 */
import { useState, useEffect } from 'react'
import {
  EnvironmentOutlined,
  SaveOutlined,
  DeleteOutlined,
  PushpinOutlined,
  FileExclamationOutlined,
  LoadingOutlined,
  PlusOutlined,
  EditOutlined,
  MinusCircleOutlined,
  SearchOutlined,
  LockOutlined,
  LockFilled,
} from '@ant-design/icons'
import { Button, InputNumber, Input, Space, Tooltip, Badge, Popconfirm, Modal, List, Empty, Spin, message, App } from 'antd'
import { useGeoStore } from '../../store/geo-store'
import { getEffectiveGeo } from '../../store/geo-store'
import { GeoMarkerConfig } from './GeoMarkerConfig'
import { getModels } from '../../api/models'

/** 分区标题（参考场景编辑器 EditPanel 的 SectionTitle 模式） */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 12,
      fontWeight: 600,
      color: 'rgba(255,255,255,0.65)',
      marginTop: 16,
      marginBottom: 8,
      paddingBottom: 4,
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    }}>
      {children}
    </div>
  )
}

export function GeoLocationPanel() {
  const { modal } = App.useApp()
  // 按字段选择避免无关状态变化触发重渲染
  const models = useGeoStore((s) => s.models)
  const selectedModelId = useGeoStore((s) => s.selectedModelId)
  const isLoading = useGeoStore((s) => s.isLoading)
  const loadingModelIds = useGeoStore((s) => s.loadingModelIds)
  const placementMode = useGeoStore((s) => s.placementMode)
  const markers = useGeoStore((s) => s.markers)
  const editingMarkerId = useGeoStore((s) => s.editingMarkerId)
  const addingMarker = useGeoStore((s) => s.addingMarker)
  const focusedMarkerId = useGeoStore((s) => s.focusedMarkerId)
  const lockedModelIds = useGeoStore((s) => s.lockedModelIds)
  // actions 引用稳定，可以用全量取
  const {
    updateModelGeoPosition,
    saveAndNotify,
    setSelectedModel,
    setPlacementMode,
    clearModelGeoPosition,
    setAddingMarker,
    setEditingMarkerId,
    setFocusedMarkerId,
    removeMarker,
    toggleModelLock,
    triggerMarkerAction,
  } = useGeoStore()

  const selectedModel = models.find((m) => m.id === selectedModelId)

  // 当前编辑的 geo 值（复用 store 的 getEffectiveGeo，避免分散的三态判断逻辑）
  const currentGeo = selectedModel ? getEffectiveGeo(selectedModel) : null

  // 标点配置 Modal 状态
  const [markerConfigOpen, setMarkerConfigOpen] = useState(false)

  // 添加模型弹窗状态
  const [addModelModalOpen, setAddModelModalOpen] = useState(false)
  const [availableModels, setAvailableModels] = useState<Record<string, unknown>[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelSearchText, setModelSearchText] = useState('')
  const [addingModelId, setAddingModelId] = useState<string | null>(null)

  // 标点放置后自动打开配置弹窗（editingMarkerId 由 CesiumViewer 设置）
  useEffect(() => {
    if (editingMarkerId && !markerConfigOpen) {
      setMarkerConfigOpen(true)
    }
  }, [editingMarkerId])

  // 更新单个字段
  const handleUpdate = (field: string, value: number | null) => {
    if (!selectedModelId || value === null) return
    updateModelGeoPosition(selectedModelId, { [field]: value })
  }

  /**
   * 点击模型列表项
   */
  const handleModelClick = (modelId: string) => {
    if (selectedModelId === modelId) {
      setSelectedModel(null)
      return
    }

    const model = models.find((m) => m.id === modelId)
    if (!model) return

    const geo = getEffectiveGeo(model)
    const hasGeo = geo !== null
    const hasFile = !!model.downloadUrl

    setSelectedModel(modelId)

    if (!hasFile) {
      setPlacementMode(false)
      return
    }

    if (!hasGeo) {
      setPlacementMode(true)
    } else {
      setPlacementMode(false)
    }
  }

  // 清除模型的 geo_position（二次确认，防止误操作）
  const handleClearGeo = (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation()
    const model = models.find((m) => m.id === modelId)
    modal.confirm({
      title: '清除定位',
      content: `确定要清除「${model?.display_name || model?.modelName || '未命名模型'}」的地理定位吗？清除后模型将从地图上消失。`,
      okText: '确认清除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        clearModelGeoPosition(modelId)
      },
    })
  }

  // 点击标点行：聚焦到标点并触发已配置的弹窗/跳转行为
  const handleMarkerClick = (markerId: string) => {
    if (focusedMarkerId === markerId) {
      setFocusedMarkerId(null)
    } else {
      setFocusedMarkerId(markerId)
    }
    // triggerMarkerAction 内部已设置 focusedMarkerId 与弹窗/链接行为
    triggerMarkerAction(markerId)
  }

  // 打开标点配置弹窗
  const handleEditMarker = (e: React.MouseEvent, markerId: string) => {
    e.stopPropagation()
    setEditingMarkerId(markerId)
    setMarkerConfigOpen(true)
  }

  // 打开添加模型弹窗
  const handleOpenAddModelModal = async () => {
    setAddModelModalOpen(true)
    setModelSearchText('')
    setModelsLoading(true)
    try {
      const result = await getModels({ limit: 100 })
      setAvailableModels(result.items || result || [])
    } catch {
      message.error('获取模型列表失败')
    }
    setModelsLoading(false)
  }

  // 添加模型到地图
  const handleAddModel = async (modelId: string) => {
    setAddingModelId(modelId)
    try {
      await useGeoStore.getState().addModelToMap(modelId)
      message.success('模型已添加')
      setAddModelModalOpen(false)
    } catch {
      message.error('添加模型失败')
    }
    setAddingModelId(null)
  }

  // 移除模型（二次确认，防止误操作）
  const handleRemoveModel = (mapModelId: string) => {
    const model = models.find((m) => m.id === mapModelId)
    modal.confirm({
      title: '从地图移除',
      content: `确定要将「${model?.display_name || model?.modelName || '未命名模型'}」从地图中移除吗？`,
      okText: '确认移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await useGeoStore.getState().removeModelFromMap(mapModelId)
          message.success('模型已移除')
        } catch {
          message.error('移除模型失败')
        }
      },
    })
  }

  // 已在地图中的模型 ID 集合（用于弹窗去重）
  const existingModelIds = new Set(models.map((m) => m.model_id))

  // 过滤后的模型列表
  const filteredModels = modelSearchText
    ? availableModels.filter((m: Record<string, unknown>) =>
        String(m.name || '').toLowerCase().includes(modelSearchText.toLowerCase()),
      )
    : availableModels

  // 行为标签颜色
  const actionColor: Record<string, string> = {
    popup: '#1890ff',
    iframe: '#722ed1',
    link: '#52c41a',
    none: '#999',
  }
  const actionLabel: Record<string, string> = {
    popup: '弹窗',
    iframe: '嵌入',
    link: '链接',
    none: '无',
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 10,
        width: 280,
        maxHeight: 'calc(100vh - 100px)',
        overflow: 'auto',
        background: 'rgba(0, 0, 0, 0.75)',
        borderRadius: 8,
        padding: 12,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* ── 地图模型 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ color: '#fff', margin: 0, fontSize: 14 }}>地图模型</h4>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined style={{ color: '#52c41a' }} />}
          onClick={handleOpenAddModelModal}
          style={{ color: '#fff', fontSize: 12 }}
        >
          添加
        </Button>
      </div>
      <Space orientation="vertical" style={{ width: '100%' }} size={6}>
        {models.map((model) => {
          const geo = getEffectiveGeo(model)
          const hasGeo = geo !== null
          const hasFile = !!model.downloadUrl
          const isSelected = model.id === selectedModelId
          const isPlacing = isSelected && placementMode && !hasGeo && hasFile
          const isLoadingModel = loadingModelIds.has(model.id)
          const isLocked = lockedModelIds.has(model.id)

          return (
            <div
              key={model.id}
              onClick={() => !isLoadingModel && handleModelClick(model.id)}
              style={{
                padding: 8,
                borderRadius: 6,
                cursor: isLoadingModel ? 'wait' : 'pointer',
                background: isSelected
                  ? 'rgba(24, 144, 255, 0.25)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: isSelected ? '1px solid rgba(24, 144, 255, 0.6)' : '1px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all 0.2s',
                opacity: hasFile ? 1 : 0.6,
              }}
            >
              {/* 缩略图 */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {model.thumbnailUrl ? (
                  <img
                    src={model.thumbnailUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <EnvironmentOutlined style={{ color: '#666', fontSize: 18 }} />
                )}
              </div>

              {/* 名称 + 状态 */}
              <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                <div
                  style={{
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {model.display_name || model.modelName}
                </div>
                <div style={{ fontSize: 11, marginTop: 3 }}>
                  {isLoadingModel ? (
                    <span style={{ color: '#1890ff' }}>
                      <LoadingOutlined spin /> 模型加载中…
                    </span>
                  ) : !hasFile ? (
                    <span style={{ color: '#ff4d4f' }}>
                      <FileExclamationOutlined /> 模型文件缺失
                    </span>
                  ) : isPlacing ? (
                    <span style={{ color: '#faad14' }}>
                      <PushpinOutlined /> 点击地图放置
                    </span>
                  ) : hasGeo ? (
                    <Badge status="success" text={<span style={{ color: '#52c41a' }}>已定位</span>} />
                  ) : (
                    <span style={{ color: '#999' }}>点击定位</span>
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              {hasGeo && (
                <Tooltip title={isLocked ? '解锁后可拖动和编辑坐标' : '锁定后禁止拖动和编辑坐标'}>
                  <Button
                    type="text"
                    size="small"
                    icon={isLocked
                      ? <LockFilled style={{ color: '#ff4d4f' }} />
                      : <LockOutlined style={{ color: '#999' }} />}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleModelLock(model.id)
                    }}
                    style={{ flexShrink: 0 }}
                  />
                </Tooltip>
              )}
              {hasGeo && (
                <Tooltip title="清除定位">
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
                    onClick={(e) => handleClearGeo(e, model.id)}
                    style={{ flexShrink: 0 }}
                  />
                </Tooltip>
              )}
              <Tooltip title="从地图移除">
                <Button
                  type="text"
                  size="small"
                  icon={<MinusCircleOutlined style={{ color: '#999', fontSize: 12 }} />}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveModel(model.id)
                  }}
                  style={{ flexShrink: 0 }}
                />
              </Tooltip>
            </div>
          )
        })}
      </Space>

      {/* ── 坐标编辑 ── */}
      {selectedModel && currentGeo && !placementMode && (
        <>
          <SectionTitle>坐标编辑</SectionTitle>
          {lockedModelIds.has(selectedModel.id) ? (
            <div
              style={{
                color: '#999',
                fontSize: 12,
                padding: '8px 4px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <LockFilled style={{ color: '#ff4d4f' }} />
              模型已锁定，编辑功能已禁用
            </div>
          ) : (
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
              <CoordInput label="经度" value={currentGeo.longitude ?? 0} onChange={(v) => handleUpdate('longitude', v)} step={0.000001} />
              <CoordInput label="纬度" value={currentGeo.latitude ?? 0} onChange={(v) => handleUpdate('latitude', v)} step={0.000001} />
              <CoordInput label="海拔 (米)" value={currentGeo.altitude ?? 0} onChange={(v) => handleUpdate('altitude', v)} step={0.1} />
              <CoordInput label="航向角 (°)" value={currentGeo.heading ?? 0} onChange={(v) => handleUpdate('heading', v)} step={1} min={0} max={360} />
              <CoordInput label="俯仰角 (°)" value={currentGeo.pitch ?? 0} onChange={(v) => handleUpdate('pitch', v)} step={1} min={-90} max={90} />
              <CoordInput label="翻滚角 (°)" value={currentGeo.roll ?? 0} onChange={(v) => handleUpdate('roll', v)} step={1} min={-180} max={180} />
              <CoordInput label="缩放" value={currentGeo.scale ?? 1} onChange={(v) => handleUpdate('scale', v)} step={0.1} min={0.01} />
            </Space>
          )}
        </>
      )}

      {/* ── 标点管理 ── */}
      <SectionTitle>
        标点管理 {markers.length > 0 && `(${markers.length})`}
      </SectionTitle>

      <Space orientation="vertical" style={{ width: '100%' }} size={4}>
        {markers.map((marker) => {
          const isFocused = focusedMarkerId === marker.id
          return (
            <div
              key={marker.id}
              onClick={() => handleMarkerClick(marker.id)}
              style={{
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                background: isFocused
                  ? 'rgba(24, 144, 255, 0.25)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: isFocused ? '1px solid rgba(24, 144, 255, 0.6)' : '1px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
              }}
            >
              <PushpinOutlined style={{ color: actionColor[marker.action] || '#999', fontSize: 14 }} />
              <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                <span style={{ color: '#fff', fontSize: 13 }}>{marker.name}</span>
              </div>
              {/* 行为标签：小圆点 + 文字，轻量风格 */}
              <span
                style={{
                  fontSize: 10,
                  color: actionColor[marker.action] || '#999',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  flexShrink: 0,
                }}
              >
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: actionColor[marker.action] || '#999',
                  display: 'inline-block',
                }} />
                {actionLabel[marker.action]}
              </span>
              {/* 编辑按钮 */}
              <Tooltip title="编辑">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ fontSize: 12 }} />}
                  onClick={(e) => handleEditMarker(e, marker.id)}
                  style={{ flexShrink: 0 }}
                />
              </Tooltip>
              {/* 删除按钮 */}
              <Popconfirm
                title="确定删除此标点？"
                description="删除后不可恢复"
                onConfirm={(e) => { e?.stopPropagation(); removeMarker(marker.id) }}
                onCancel={(e) => e?.stopPropagation()}
                okText="删除"
                cancelText="取消"
              >
                <Tooltip title="删除">
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />}
                    onClick={(e) => e.stopPropagation()}
                    style={{ flexShrink: 0 }}
                  />
                </Tooltip>
              </Popconfirm>
            </div>
          )
        })}

        <Button
          type="dashed"
          block
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setAddingMarker(!addingMarker)}
          style={{
            borderColor: addingMarker ? '#ff4d4f' : undefined,
            color: addingMarker ? '#ff4d4f' : undefined,
          }}
        >
          {addingMarker ? '取消添加' : '添加标点'}
        </Button>
      </Space>

      {/* ── 保存按钮 ── */}
      <Button
        type="primary"
        block
        icon={<SaveOutlined />}
        onClick={saveAndNotify}
        loading={isLoading}
        style={{ marginTop: 16 }}
      >
        保存
      </Button>

      {/* 标点放置后自动打开配置弹窗 */}
      {/* 标点配置 Modal */}

      {/* ── 添加模型弹窗 ── */}
      <Modal
        title="添加模型到地图"
        open={addModelModalOpen}
        onCancel={() => setAddModelModalOpen(false)}
        footer={null}
        width={520}
        destroyOnHidden
      >
        <Input
          placeholder="搜索模型..."
          prefix={<SearchOutlined />}
          value={modelSearchText}
          onChange={(e) => setModelSearchText(e.target.value)}
          style={{ marginBottom: 12 }}
          allowClear
        />
        {modelsLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : filteredModels.length === 0 ? (
          <Empty description="没有可用的模型" />
        ) : (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <List
              size="small"
              dataSource={filteredModels}
              renderItem={(item: Record<string, unknown>) => {
                const modelId = item.id as string
                const modelName = (item.name as string) || '未命名模型'
                const alreadyAdded = existingModelIds.has(modelId)
                const isAdding = addingModelId === modelId
                return (
                  <List.Item
                    actions={[
                      alreadyAdded ? (
                        <span key="added" style={{ color: '#999', fontSize: 12 }}>已添加</span>
                      ) : (
                        <Button
                          key="add"
                          type="link"
                          size="small"
                          loading={isAdding}
                          onClick={() => handleAddModel(modelId)}
                        >
                          添加
                        </Button>
                      ),
                    ]}
                  >
                    <List.Item.Meta
                      title={modelName}
                      description={item.description ? String(item.description).slice(0, 60) : undefined}
                    />
                  </List.Item>
                )
              }}
            />
          </div>
        )}
      </Modal>
      <GeoMarkerConfig
        open={markerConfigOpen}
        markerId={editingMarkerId}
        onClose={() => {
          setMarkerConfigOpen(false)
          setEditingMarkerId(null)
        }}
      />
    </div>
  )
}

/** 单个坐标输入项 */
function CoordInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ color: '#ccc', fontSize: 12, width: 70, flexShrink: 0 }}>{label}</label>
      <InputNumber
        value={value}
        onChange={(v) => {
          if (v !== null && v !== undefined) onChange(v)
        }}
        step={step}
        min={min}
        max={max}
        style={{ flex: 1 }}
        size="small"
      />
    </div>
  )
}
