/**
 * 场景媒体配置面板
 *
 * 支持三种媒体类型：图片、视频、文字标注
 * - 批量添加媒体到场景
 * - 编辑媒体属性（名称、尺寸、位置、缩放等）
 * - 控制媒体可见性
 * - 重定位媒体位置
 */
import { useState, useCallback } from 'react'
import { Button, message, Input, InputNumber, Switch, Dropdown, ColorPicker, Popconfirm, Tooltip, theme as antdTheme } from 'antd'
import type { Color } from 'antd/es/color-picker'
import { Icon } from '@iconify/react'
import { imagePlusIcon, videoIcon, typeIcon, plusIcon, crosshairIcon, moveIcon, trash2Icon } from './Icons'
import * as THREE from 'three'
import { useEditStore } from '../store/edit-store'
import { useSceneStore } from '../store/scene-store'
import { ResourcePicker } from './ResourcePicker'
import { VideoThumbnail } from './VideoThumbnail'
import type { SceneMedia, SceneMediaType } from '../types/edit-data'
import type { ResourceItem } from '../types/resource'

const MEDIA_TYPE_CONFIG: Record<SceneMediaType, { label: string; icon: typeof imagePlusIcon; color: string }> = {
  image: { label: '图片', icon: imagePlusIcon, color: '#4a9eff' },
  video: { label: '视频', icon: videoIcon, color: '#f5a623' },
  text: { label: '文字', icon: typeIcon, color: '#7c5cfc' },
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
        rotation: [0, 0, 0],
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
      rotation: [0, 0, 0],
      visible: true,
    }
    addSceneImage(media)
    useEditStore.getState().setPlacingImageId(media.id)
    message.success('已添加文字标注，请在模型上点击放置')
  }, [addSceneImage])

  const handleRemove = useCallback((id: string) => {
    removeSceneImage(id)
  }, [removeSceneImage])

  const handleUpdate = useCallback((id: string, updates: Partial<SceneMedia>) => {
    updateSceneImage(id, updates)
  }, [updateSceneImage])

  const addMenuItems = [
    { key: 'image', label: '图片', icon: <Icon icon={imagePlusIcon} width={14} /> },
    { key: 'video', label: '视频', icon: <Icon icon={videoIcon} width={14} /> },
    { key: 'text', label: '文字标注', icon: <Icon icon={typeIcon} width={14} /> },
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
    }
  }, [handleAddText])

  return (
    <div className="space-y-1.5">
      <Dropdown menu={{ items: addMenuItems, onClick: handleAddMenu }} trigger={['click']}>
        <Button type="dashed" icon={<Icon icon={plusIcon} width={14} />} block size="small">
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

      {sceneImages.length === 0 && (
        <div className="text-center text-xs py-3" style={{ color: token.colorTextQuaternary }}>
          暂无媒体，点击上方按钮添加
        </div>
      )}

      {sceneImages.map((img) => (
        <MediaCard
          key={img.id}
          media={img}
          expanded={editingId === img.id}
          onToggle={() => setEditingId(editingId === img.id ? null : img.id)}
          onRemove={() => handleRemove(img.id)}
          onUpdate={(updates) => handleUpdate(img.id, updates)}
        />
      ))}
    </div>
  )
}

/** 媒体卡片 */
function MediaCard({
  media,
  expanded,
  onToggle,
  onRemove,
  onUpdate,
}: {
  media: SceneMedia
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
  onUpdate: (updates: Partial<SceneMedia>) => void
}) {
  const { token } = antdTheme.useToken()
  const cfg = MEDIA_TYPE_CONFIG[media.type]
  const isPlacing = useEditStore((s) => s.placingImageId) === media.id
  const isSelected = useEditStore((s) => s.selectedImageId) === media.id
  const setSelectedImageId = useEditStore((s) => s.setSelectedImageId)

  const handleSelect = useCallback(() => {
    setSelectedImageId(isSelected ? null : media.id)
  }, [isSelected, media.id, setSelectedImageId])

  /** 定位相机到媒体位置 */
  const handleLocate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const pos = media.position
    if (!pos) return
    const sceneStore = useSceneStore.getState()
    const setCameraState = sceneStore.setCameraState
    const getCameraState = sceneStore.getCameraState
    if (!setCameraState || !getCameraState) return
    const cam = getCameraState()
    const dir = new THREE.Vector3(
      cam.position.x - cam.target.x,
      cam.position.y - cam.target.y,
      cam.position.z - cam.target.z,
    ).normalize()
    const model = useEditStore.getState().modelObject
    let distance = 5
    if (model) {
      const box = new THREE.Box3().setFromObject(model)
      const size = new THREE.Vector3()
      box.getSize(size)
      distance = Math.max(size.length() * 0.6, 3)
    }
    setCameraState({
      position: { x: pos[0] + dir.x * distance, y: pos[1] + dir.y * distance, z: pos[2] + dir.z * distance },
      target: { x: pos[0], y: pos[1], z: pos[2] },
    })
  }, [media.position])

  const handleRelocate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    useEditStore.getState().setPlacingImageId(media.id)
    message.info('请在模型上点击放置')
  }, [media.id])

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggle()
  }, [onToggle])

  return (
    <div
      className="rounded-lg transition-all duration-150 border cursor-pointer"
      style={{
        background: isSelected
          ? token.colorPrimaryBg
          : expanded
            ? token.colorFillQuaternary
            : token.colorBgElevated,
        borderColor: isPlacing
          ? token.colorPrimary
          : isSelected
            ? token.colorPrimaryBorder
            : expanded
              ? token.colorBorderSecondary
              : token.colorBorderSecondary,
        opacity: media.visible ? 1 : 0.55,
      }}
      onClick={handleSelect}
    >
      {/* 卡片头部 */}
      <div className="flex items-center gap-2.5 p-2.5">
        {/* 缩略图区域 */}
        <div
          className="shrink-0 rounded-md overflow-hidden flex items-center justify-center"
          style={{ width: 40, height: 40, background: token.colorFillSecondary }}
        >
          {media.type === 'image' && media.url ? (
            <img src={media.url} alt={media.name} className="w-full h-full object-cover" />
          ) : media.type === 'video' && media.url ? (
            <VideoThumbnail url={media.url} className="w-full h-full object-cover" fallbackSize={20} />
          ) : media.type === 'text' ? (
            <div className="flex items-center justify-center w-full h-full" style={{ background: cfg.color + '22' }}>
              <Icon icon={typeIcon} width={18} style={{ color: cfg.color }} />
            </div>
          ) : (
            <Icon icon={cfg.icon} width={18} style={{ opacity: 0.35 }} />
          )}
        </div>

        {/* 名称与类型 */}
        <div className="flex-1 min-w-0">
          <div className="text-xs truncate font-medium" style={{ color: token.colorText }}>
            {media.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="text-[10px] px-1.5 py-px rounded-full leading-tight"
              style={{ background: cfg.color + '22', color: cfg.color, fontWeight: 500 }}
            >
              {cfg.label}
            </span>
            {media.width && media.height ? (
              <span className="text-[10px]" style={{ color: token.colorTextQuaternary }}>
                {media.width}×{media.height}
              </span>
            ) : null}
          </div>
        </div>

        {/* 可见性开关 */}
        <Switch
          size="small"
          checked={media.visible}
          onChange={(v) => onUpdate({ visible: v })}
          onClick={(_, e) => e.stopPropagation()}
        />
      </div>

      {/* 操作按钮栏 */}
      <div
        className="flex items-center gap-0.5 px-2 pb-2 border-t border-dashed"
        style={{ borderColor: token.colorBorderSecondary }}
      >
        <div className="flex-1" />
        <Tooltip title="定位到媒体">
          <Button type="text" size="small" className="!w-6 !h-6 !min-w-0 flex items-center justify-center" onClick={handleLocate}>
            <Icon icon={crosshairIcon} width={14} style={{ opacity: 0.55 }} />
          </Button>
        </Tooltip>
        <Tooltip title="重定位位置">
          <Button type="text" size="small" className="!w-6 !h-6 !min-w-0 flex items-center justify-center" onClick={handleRelocate}>
            <Icon icon={moveIcon} width={14} style={{ opacity: 0.55 }} />
          </Button>
        </Tooltip>
        <Tooltip title={expanded ? '收起属性' : '编辑属性'}>
          <Button type="text" size="small" className="!w-6 !h-6 !min-w-0 flex items-center justify-center" onClick={handleToggle}>
            <Icon icon={expanded ? 'lucide:chevron-up' : 'lucide:chevron-down'} width={14} style={{ opacity: 0.55 }} />
          </Button>
        </Tooltip>
        <Popconfirm title="确定删除此媒体?" onConfirm={onRemove} okText="删除" cancelText="取消" placement="bottomRight">
          <Button type="text" size="small" className="!w-6 !h-6 !min-w-0 flex items-center justify-center" danger onClick={(e) => e.stopPropagation()}>
            <Icon icon={trash2Icon} width={14} style={{ opacity: 0.55 }} />
          </Button>
        </Popconfirm>
      </div>

      {/* 展开的编辑区域 */}
      {expanded && (
        <div
          className="px-2.5 pb-2.5 space-y-2 text-xs border-t"
          style={{ borderColor: token.colorBorderSecondary }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pt-2.5">
            <label className="block mb-1" style={{ color: token.colorTextSecondary }}>名称</label>
            <Input size="small" value={media.name} onChange={(e) => onUpdate({ name: e.target.value })} />
          </div>

          <div className="flex gap-1.5">
            <div className="flex-1">
              <label className="block mb-1" style={{ color: token.colorTextSecondary }}>宽度</label>
              <InputNumber size="small" value={media.width} min={1} className="!w-full" onChange={(v) => v != null && onUpdate({ width: v })} />
            </div>
            <div className="flex-1">
              <label className="block mb-1" style={{ color: token.colorTextSecondary }}>高度</label>
              <InputNumber size="small" value={media.height} min={1} className="!w-full" onChange={(v) => v != null && onUpdate({ height: v })} />
            </div>
          </div>

          <div>
            <label className="block mb-1" style={{ color: token.colorTextSecondary }}>位置 (X, Y, Z)</label>
            <div className="flex gap-1">
              {(['X', 'Y', 'Z'] as const).map((axis, idx) => (
                <InputNumber
                  key={axis}
                  size="small"
                  value={media.position?.[idx] ?? 0}
                  step={0.1}
                  className="!flex-1"
                  prefix={<span className="text-[10px] opacity-40">{axis}</span>}
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
            <label className="block mb-1" style={{ color: token.colorTextSecondary }}>缩放 (X, Y)</label>
            <div className="flex gap-1">
              {(['X', 'Y'] as const).map((axis, idx) => (
                <InputNumber
                  key={axis}
                  size="small"
                  value={media.scale?.[idx] ?? 1}
                  step={0.1}
                  min={0.01}
                  className="!flex-1"
                  prefix={<span className="text-[10px] opacity-40">{axis}</span>}
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
            <label className="block mb-1" style={{ color: token.colorTextSecondary }}>旋转 (X, Y, Z)</label>
            <div className="flex gap-1">
              {(['X', 'Y', 'Z'] as const).map((axis, idx) => {
                const cur = Array.isArray(media.rotation)
                  ? (media.rotation[idx] ?? 0)
                  : (typeof media.rotation === 'number' ? (idx === 2 ? media.rotation : 0) : 0)
                return (
                  <InputNumber
                    key={axis}
                    size="small"
                    value={cur}
                    step={0.1}
                    className="!flex-1"
                    prefix={<span className="text-[10px] opacity-40">{axis}</span>}
                    onChange={(v) => {
                      const r = Array.isArray(media.rotation)
                        ? ([...media.rotation] as [number, number, number])
                        : (typeof media.rotation === 'number' ? [0, 0, media.rotation] as [number, number, number] : [0, 0, 0] as [number, number, number])
                      r[idx] = v ?? 0
                      onUpdate({ rotation: r })
                    }}
                  />
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span style={{ color: token.colorTextSecondary }}>始终面向相机</span>
            <Switch size="small" checked={media.billboard !== false} onChange={(v) => onUpdate({ billboard: v })} />
          </div>

          {/* 视频专用属性 */}
          {media.type === 'video' && (
            <div className="space-y-2 pt-1 border-t" style={{ borderColor: token.colorBorderSecondary }}>
              <div className="flex items-center justify-between">
                <span style={{ color: token.colorTextSecondary }}>自动播放</span>
                <Switch size="small" checked={media.autoplay !== false} onChange={(v) => onUpdate({ autoplay: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: token.colorTextSecondary }}>静音</span>
                <Switch size="small" checked={media.muted !== false} onChange={(v) => onUpdate({ muted: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: token.colorTextSecondary }}>循环</span>
                <Switch size="small" checked={media.loop !== false} onChange={(v) => onUpdate({ loop: v })} />
              </div>
            </div>
          )}

          {/* 文字标注专用属性 */}
          {media.type === 'text' && (
            <div className="space-y-2 pt-1 border-t" style={{ borderColor: token.colorBorderSecondary }}>
              <div>
                <label className="block mb-1" style={{ color: token.colorTextSecondary }}>文字内容</label>
                <Input size="small" value={media.text || ''} onChange={(e) => onUpdate({ text: e.target.value })} />
              </div>
              <div className="flex gap-1.5">
                <div className="flex-1">
                  <label className="block mb-1" style={{ color: token.colorTextSecondary }}>字号</label>
                  <InputNumber size="small" value={media.fontSize ?? 24} min={8} max={200} className="!w-full" onChange={(v) => v != null && onUpdate({ fontSize: v })} />
                </div>
                <div>
                  <label className="block mb-1" style={{ color: token.colorTextSecondary }}>文字颜色</label>
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
