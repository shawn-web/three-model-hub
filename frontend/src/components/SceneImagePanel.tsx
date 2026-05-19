/**
 * 场景图片配置面板
 *
 * 提供场景中图片的管理功能：
 * - 批量上传图片到场景
 * - 编辑图片属性（名称、尺寸、位置、缩放）
 * - 控制图片可见性
 * - 删除图片
 *
 * 通过事件回调将图片的增删改操作暴露给父组件，
 * 以便在 3D 场景中同步更新图片显示。
 */
import { useState, useCallback, useRef } from 'react'
import { Button, Upload, message, Input, InputNumber, Switch, Space, Card, Popconfirm } from 'antd'
import { Icon } from '@iconify/react'
import { useEditStore } from '../store/edit-store'
import { uploadFile } from '../api/upload'
import type { SceneImage } from '../types/edit-data'

/** 场景图片面板事件回调接口 */
export interface SceneImagePanelEvents {
  /** 图片添加到场景后的回调 */
  onImageAdded?: (image: SceneImage) => void
  /** 图片从场景中移除后的回调 */
  onImageRemoved?: (id: string) => void
  /** 图片属性更新后的回调 */
  onImageUpdated?: (id: string, updates: Partial<SceneImage>) => void
}

interface SceneImagePanelProps extends SceneImagePanelEvents {}

/** 场景图片配置面板组件 */
export function SceneImagePanel({ onImageAdded, onImageRemoved, onImageUpdated }: SceneImagePanelProps) {
  const sceneImages = useEditStore((s) => s.sceneImages)
  const addSceneImage = useEditStore((s) => s.addSceneImage)
  const removeSceneImage = useEditStore((s) => s.removeSceneImage)
  const updateSceneImage = useEditStore((s) => s.updateSceneImage)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const batchRef = useRef(false)

  /** 批量上传图片处理：逐个上传文件并添加到场景 */
  const handleBatchUpload = useCallback(async (files: File[]) => {
    setUploading(true)
    let successCount = 0
    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const result = await uploadFile(formData)
        if (result.url) {
          const img = new Image()
          img.src = result.url
          await new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
          })
          const sceneImage: SceneImage = {
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            url: result.url,
            name: file.name,
            width: img.naturalWidth || 512,
            height: img.naturalHeight || 512,
            position: [0, 0, 0],
            scale: [1, 1, 1],
            rotation: [0, 0, 0],
            visible: true,
          }
          addSceneImage(sceneImage)
          onImageAdded?.(sceneImage)
          successCount++
        }
      } catch (err) {
        console.error('[SceneImagePanel] 上传图片失败:', err)
        message.error(`上传 ${file.name} 失败`)
      }
    }
    if (successCount > 0) {
      message.success(`成功上传 ${successCount} 张图片`)
    }
    setUploading(false)
  }, [addSceneImage, onImageAdded])

  /** 移除图片处理 */
  const handleRemove = useCallback((id: string) => {
    removeSceneImage(id)
    onImageRemoved?.(id)
  }, [removeSceneImage, onImageRemoved])

  /** 更新图片属性处理 */
  const handleUpdate = useCallback((id: string, updates: Partial<SceneImage>) => {
    updateSceneImage(id, updates)
    onImageUpdated?.(id, updates)
  }, [updateSceneImage, onImageUpdated])

  return (
    <div style={{ padding: '4px 8px' }}>
      <Upload
        multiple
        accept="image/*"
        showUploadList={false}
        beforeUpload={(_file, fileList) => {
          if (batchRef.current) return false
          batchRef.current = true
          handleBatchUpload(fileList as unknown as File[]).finally(() => {
            setTimeout(() => { batchRef.current = false }, 100)
          })
          return false
        }}
      >
        <Button
          type="dashed"
          icon={<Icon icon="lucide:upload" width={14} />}
          loading={uploading}
          block
          size="small"
          style={{ marginBottom: 8 }}
        >
          批量上传图片
        </Button>
      </Upload>

      {sceneImages.length === 0 && (
        <div style={{ textAlign: 'center', color: '#999', fontSize: 12, padding: '12px 0' }}>
          暂无图片，点击上方按钮上传
        </div>
      )}

      {sceneImages.map((img) => (
        <ImageCard
          key={img.id}
          image={img}
          editing={editingId === img.id}
          onEdit={() => setEditingId(editingId === img.id ? null : img.id)}
          onRemove={() => handleRemove(img.id)}
          onUpdate={(updates) => handleUpdate(img.id, updates)}
        />
      ))}
    </div>
  )
}

/** 图片卡片组件：显示单张图片的缩略图、属性编辑和操作按钮 */
function ImageCard({
  image,
  editing,
  onEdit,
  onRemove,
  onUpdate,
}: {
  image: SceneImage
  editing: boolean
  onEdit: () => void
  onRemove: () => void
  onUpdate: (updates: Partial<SceneImage>) => void
}) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 6, borderRadius: 6 }}
      bodyStyle={{ padding: 8 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <img
            src={image.url}
            alt={image.name}
            style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 3 }}
          />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {image.name}
          </span>
          <Switch
            size="small"
            checked={image.visible}
            onChange={(v) => onUpdate({ visible: v })}
          />
        </div>
      }
      extra={
        <Space size={4}>
          <Button type="text" size="small" onClick={onEdit}>
            <Icon icon={editing ? 'lucide:chevron-up' : 'lucide:chevron-down'} width={14} />
          </Button>
          <Popconfirm title="确定删除此图片?" onConfirm={onRemove} okText="删除" cancelText="取消">
            <Button type="text" size="small" danger>
              <Icon icon="lucide:trash-2" width={14} />
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
              value={image.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>宽度</label>
              <InputNumber
                size="small"
                value={image.width}
                min={1}
                style={{ width: '100%' }}
                onChange={(v) => v != null && onUpdate({ width: v })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>高度</label>
              <InputNumber
                size="small"
                value={image.height}
                min={1}
                style={{ width: '100%' }}
                onChange={(v) => v != null && onUpdate({ height: v })}
              />
            </div>
          </div>
          <div>
            <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>位置 (X, Y, Z)</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['position', 0, 1, 2] as const).map((_, idx) => (
                <InputNumber
                  key={idx}
                  size="small"
                  value={image.position?.[idx as 0 | 1 | 2] ?? 0}
                  step={0.1}
                  style={{ flex: 1 }}
                  onChange={(v) => {
                    const pos: [number, number, number] = [...(image.position || [0, 0, 0])]
                    pos[idx as 0 | 1 | 2] = v ?? 0
                    onUpdate({ position: pos })
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <label style={{ color: '#888', marginBottom: 2, display: 'block' }}>缩放 (X, Y, Z)</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {([0, 1, 2] as const).map((idx) => (
                <InputNumber
                  key={idx}
                  size="small"
                  value={image.scale?.[idx] ?? 1}
                  step={0.1}
                  min={0.01}
                  style={{ flex: 1 }}
                  onChange={(v) => {
                    const sc: [number, number, number] = [...(image.scale || [1, 1, 1])]
                    sc[idx] = v ?? 1
                    onUpdate({ scale: sc })
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
