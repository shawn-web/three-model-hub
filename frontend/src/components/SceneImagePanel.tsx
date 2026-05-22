/**
 * 场景媒体配置面板
 *
 * 支持四种媒体类型：图片、视频、文字标注、网页嵌入
 * - 批量添加媒体到场景
 * - 编辑媒体属性（名称、尺寸、位置、缩放等）
 * - 控制媒体可见性
 * - 重定位媒体位置
 */
import { useState, useCallback } from 'react'
import { Button, message, Input, InputNumber, Switch, Space, Card, Popconfirm, Dropdown, ColorPicker, theme as antdTheme } from 'antd'
import type { Color } from 'antd/es/color-picker'
import { Icon } from '@iconify/react'
import { imagePlusIcon, videoIcon, typeIcon, globeIcon, plusIcon, crosshairIcon, moveIcon, trash2Icon } from './Icons'
import * as THREE from 'three'
import { useEditStore } from '../store/edit-store'
import { ResourcePicker } from './ResourcePicker'
import type { SceneMedia, SceneMediaType } from '../types/edit-data'
import type { ResourceItem } from '../types/resource'

const MEDIA_TYPE_CONFIG: Record<SceneMediaType, { label: string; icon: typeof imagePlusIcon }> = {
  image: { label: '图片', icon: imagePlusIcon },
  video: { label: '视频', icon: videoIcon },
  text: { label: '文字标注', icon: typeIcon },
  iframe: { label: '网页嵌入', icon: globeIcon },
}

/** 场景媒体面板 */
export function SceneImagePanel() {
  const sceneImages = useEditStore((s) => s.sceneImages)
  const addSceneImage = useEditStore((s) => s.addSceneImage)
  const removeSceneImage = useEditStore((s) => s.removeSceneImage)
  const updateSceneImage = useEditStore((s) => s.updateSceneImage)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { token } = antdTheme.useToken()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerType, setPickerType] = useState<'image' | 'video'>('image')
  const [iframeInput, setIframeInput] = useState('')
  const [iframeModalOpen, setIframeModalOpen] = useState(false)

  /** 从资源选择器添加图片/视频 */
  const handleResourceSelect = useCallback((resources: ResourceItem[]) => {
    for (const res of resources) {
      const sceneMedia: SceneMedia = {
        id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: pickerType,
        url: res.url,
        name: res.name,
        width: res.width || 512,
        height: res.height || 512,
        position: [0, 0, 0],
        scale: [1, 1],
        rotation: 0,
        visible: true,
        ...(pickerType === 'video' ? { autoplay: true, muted: true, loop: true } : {}),
      }
      addSceneImage(sceneMedia)
      useEditStore.getState().setPlacingImageId(sceneMedia.id)
    }
    if (resources.length > 0) {
      message.success(`已添加 ${resources.length} 个${pickerType === 'image' ? '图片' : '视频'}，请在模型上点击放置`)
    }
  }, [addSceneImage, pickerType])

  /** 添加文字标注 */
  const handleAddText = useCallback(() => {
    const media: SceneMedia = {
      id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'text',
      name: '文字标注',
      text: '文字内容',
      fontSize: 24,
      fontColor: '#ffffff',
      width: 256,
      height: 64,
      position: [0, 0, 0],
      scale: [1, 1],
      rotation: 0,
      visible: true,
    }
    addSceneImage(media)
    useEditStore.getState().setPlacingImageId(media.id)
    message.success('已添加文字标注，请在模型上点击放置')
  }, [addSceneImage])

  /** 添加网页嵌入 */
  const handleAddIframe = useCallback(() => {
    if (!iframeInput.trim()) {
      message.warning('请输入网页地址')
      return
    }
    const media: SceneMedia = {
      id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'iframe',
      name: '网页嵌入',
      iframeUrl: iframeInput.trim(),
      width: 512,
      height: 384,
      position: [0, 0, 0],
      scale: [1, 1],
      rotation: 0,
      visible: true,
    }
    addSceneImage(media)
    useEditStore.getState().setPlacingImageId(media.id)
    setIframeModalOpen(false)
    setIframeInput('')
    message.success('已添加网页嵌入，请在模型上点击放置')
  }, [addSceneImage, iframeInput])

  /** 移除媒体 */
  const handleRemove = useCallback((id: string) => {
    removeSceneImage(id)
  }, [removeSceneImage])

  /** 更新媒体属性 */
  const handleUpdate = useCallback((id: string, updates: Partial<SceneMedia>) => {
    updateSceneImage(id, updates)
  }, [updateSceneImage])

  const addMenuItems = [
    { key: 'image', label: '图片', icon: <Icon icon={imagePlusIcon} width={14} /> },
    { key: 'video', label: '视频', icon: <Icon icon={videoIcon} width={14} /> },
    { key: 'text', label: '文字标注', icon: <Icon icon={typeIcon} width={14} /> },
    { key: 'iframe', label: '网页嵌入', icon: <Icon icon={globeIcon} width={14} /> },
  ]

  const handleAddMenu = useCallback(({ key }: { key: string }) => {
    if (key === 'image') {
      setPickerType('image')
      setPickerOpen(true)
    } else if (key === 'video') {
      setPickerType('video')
      setPickerOpen(true)
    } else if (key === 'text') {
      handleAddText()
    } else if (key === 'iframe') {
      setIframeModalOpen(true)
    }
  }, [handleAddText])

  return (
    <div style={{ padding: '4px 8px' }}>
      <Dropdown menu={{ items: addMenuItems, onClick: handleAddMenu }} trigger={['click']}>
        <Button
          type="dashed"
          icon={<Icon icon={plusIcon} width={14} />}
          block
          size="small"
          style={{ marginBottom: 8 }}
        >
          添加媒体
        </Button>
      </Dropdown>

      <ResourcePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleResourceSelect}
        multiple
        typeFilter={pickerType}
        allowUpload
      />

      {/* iframe 输入弹窗 */}
      {iframeModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.45)',
        }} onClick={() => setIframeModalOpen(false)}>
          <div style={{
            background: token.colorBgElevated, borderRadius: 8, padding: 20, width: 400,
            boxShadow: `0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)`,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 600, marginBottom: 12, color: token.colorText }}>添加网页嵌入</div>
            <Input
              placeholder="请输入网页地址 (URL)"
              value={iframeInput}
              onChange={(e) => setIframeInput(e.target.value)}
              style={{ marginBottom: 12 }}
              onPressEnter={handleAddIframe}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button size="small" onClick={() => setIframeModalOpen(false)}>取消</Button>
              <Button size="small" type="primary" onClick={handleAddIframe}>添加</Button>
            </div>
          </div>
        </div>
      )}

      {sceneImages.length === 0 && (
        <div style={{ textAlign: 'center', color: '#999', fontSize: 12, padding: '12px 0' }}>
          暂无媒体，点击上方按钮添加
        </div>
      )}

      {sceneImages.map((img) => (
        <MediaCard
          key={img.id}
          media={img}
          editing={editingId === img.id}
          onEdit={() => setEditingId(editingId === img.id ? null : img.id)}
          onRemove={() => handleRemove(img.id)}
          onUpdate={(updates) => handleUpdate(img.id, updates)}
        />
      ))}
    </div>
  )
}

/** 媒体类型图标 */
function MediaTypeIcon({ type }: { type: SceneMediaType }) {
  const config = MEDIA_TYPE_CONFIG[type]
  return <Icon icon={config.icon} width={14} style={{ opacity: 0.6 }} />
}

/** 媒体卡片 */
function MediaCard({
  media,
  editing,
  onEdit,
  onRemove,
  onUpdate,
}: {
  media: SceneMedia
  editing: boolean
  onEdit: () => void
  onRemove: () => void
  onUpdate: (updates: Partial<SceneMedia>) => void
}) {
  const typeLabel = MEDIA_TYPE_CONFIG[media.type]?.label || media.type

  return (
    <Card
      size="small"
      style={{ marginBottom: 6, borderRadius: 6 }}
      styles={{ body: { padding: 8 } }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <MediaTypeIcon type={media.type} />
          {media.type === 'image' && media.url && (
            <img
              src={media.url}
              alt={media.name}
              style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 3 }}
            />
          )}
          {media.type === 'text' && (
            <span style={{ maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#888', fontSize: 11 }}>
              {media.text}
            </span>
          )}
          {media.type === 'iframe' && (
            <Icon icon={globeIcon} width={14} style={{ opacity: 0.5 }} />
          )}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {media.name}
          </span>
          <span style={{ fontSize: 10, color: '#aaa', border: '1px solid #ddd', borderRadius: 3, padding: '0 4px' }}>
            {typeLabel}
          </span>
          <Switch
            size="small"
            checked={media.visible}
            onChange={(v) => onUpdate({ visible: v })}
          />
        </div>
      }
      extra={
        <Space size={4}>
          {/* 定位到媒体 */}
          <Button type="text" size="small" onClick={() => {
            const store = useEditStore.getState()
            const pos = media.position
            if (!pos) return
            const setCameraState = store.setCameraState
            const getCameraState = store.getCameraState
            if (!setCameraState || !getCameraState) return
            const cam = getCameraState()
            const dir = new THREE.Vector3(
              cam.position.x - cam.target.x,
              cam.position.y - cam.target.y,
              cam.position.z - cam.target.z,
            ).normalize()
            // 根据模型包围盒计算合理观察距离
            const model = store.modelObject
            let distance = 5
            if (model) {
              const box = new THREE.Box3().setFromObject(model)
              const size = new THREE.Vector3()
              box.getSize(size)
              const modelDiag = size.length()
              distance = Math.max(modelDiag * 0.6, 3)
            }
            setCameraState({
              position: {
                x: pos[0] + dir.x * distance,
                y: pos[1] + dir.y * distance,
                z: pos[2] + dir.z * distance,
              },
              target: { x: pos[0], y: pos[1], z: pos[2] },
            })
          }} title="定位到媒体">
            <Icon icon={crosshairIcon} width={14} />
          </Button>
          {/* 重定位 */}
          <Button type="text" size="small" onClick={() => {
            useEditStore.getState().setPlacingImageId(media.id)
            message.info('请在模型上点击放置')
          }} title="重定位">
            <Icon icon={moveIcon} width={14} />
          </Button>
          <Button type="text" size="small" onClick={onEdit}>
            <Icon icon={editing ? 'lucide:chevron-up' : 'lucide:chevron-down'} width={14} />
          </Button>
          <Popconfirm title="确定删除此媒体?" onConfirm={onRemove} okText="删除" cancelText="取消">
            <Button type="text" size="small" danger>
              <Icon icon={trash2Icon} width={14} />
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <div>
            <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>名称</label>
            <Input
              size="small"
              value={media.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>宽度</label>
              <InputNumber
                size="small"
                value={media.width}
                min={1}
                style={{ width: '100%' }}
                onChange={(v) => v != null && onUpdate({ width: v })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>高度</label>
              <InputNumber
                size="small"
                value={media.height}
                min={1}
                style={{ width: '100%' }}
                onChange={(v) => v != null && onUpdate({ height: v })}
              />
            </div>
          </div>
          <div>
            <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>位置 (X, Y, Z)</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {([0, 1, 2] as const).map((idx) => (
                <InputNumber
                  key={idx}
                  size="small"
                  value={media.position?.[idx] ?? 0}
                  step={0.1}
                  style={{ flex: 1 }}
                  onChange={(v) => {
                    const pos: [number, number, number] = [...(media.position || [0, 0, 0])]
                    pos[idx] = v ?? 0
                    onUpdate({ position: pos })
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>缩放 (X, Y)</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {([0, 1] as const).map((idx) => (
                <InputNumber
                  key={idx}
                  size="small"
                  value={media.scale?.[idx] ?? 1}
                  step={0.1}
                  min={0.01}
                  style={{ flex: 1 }}
                  onChange={(v) => {
                    const sc: [number, number] = [...(media.scale || [1, 1])]
                    sc[idx] = v ?? 1
                    onUpdate({ scale: sc })
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>旋转 (Z)</label>
            <InputNumber
              size="small"
              value={media.rotation ?? 0}
              step={0.1}
              style={{ width: '100%' }}
              onChange={(v) => onUpdate({ rotation: v ?? 0 })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ color: '#888' }}>始终面向相机</label>
            <Switch
              size="small"
              checked={media.billboard !== false}
              onChange={(v) => onUpdate({ billboard: v })}
            />
          </div>

          {/* 视频专用属性 */}
          {media.type === 'video' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: '#888' }}>自动播放</label>
                <Switch size="small" checked={media.autoplay !== false} onChange={(v) => onUpdate({ autoplay: v })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: '#888' }}>静音</label>
                <Switch size="small" checked={media.muted !== false} onChange={(v) => onUpdate({ muted: v })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: '#888' }}>循环</label>
                <Switch size="small" checked={media.loop !== false} onChange={(v) => onUpdate({ loop: v })} />
              </div>
            </>
          )}

          {/* 文字标注专用属性 */}
          {media.type === 'text' && (
            <>
              <div>
                <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>文字内容</label>
                <Input
                  size="small"
                  value={media.text || ''}
                  onChange={(e) => onUpdate({ text: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>字号</label>
                  <InputNumber
                    size="small"
                    value={media.fontSize ?? 24}
                    min={8}
                    max={200}
                    style={{ width: '100%' }}
                    onChange={(v) => v != null && onUpdate({ fontSize: v })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>文字颜色</label>
                  <ColorPicker
                    size="small"
                    value={media.fontColor ?? '#ffffff'}
                    onChangeComplete={(color: Color | string) => {
                      const hex = typeof color === 'string' ? color : color?.toHexString?.() ?? '#ffffff'
                      onUpdate({ fontColor: hex })
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* iframe 专用属性 */}
          {media.type === 'iframe' && (
            <div>
              <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>网页地址</label>
              <Input
                size="small"
                value={media.iframeUrl || ''}
                onChange={(e) => onUpdate({ iframeUrl: e.target.value })}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
