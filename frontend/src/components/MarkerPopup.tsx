/**
 * 标点弹窗组件
 *
 * 提供两个组件：
 * - MarkerPopupEditor：弹窗配置编辑器（Modal），用于配置标点的弹窗内容和多图片管理
 * - MarkerPopupView：弹窗展示组件，在 3D 场景中展示标点的弹窗信息
 *
 * 弹窗支持配置：标题、内容、图片链接、跳转链接、多图片管理
 */
import { useState, useCallback } from 'react'
import { Input, Button, Modal, Form, message, Upload } from 'antd'
import { Icon } from '@iconify/react'
import { plusIcon, trash2Icon, xIcon } from './Icons'
import { useEditStore } from '../store/edit-store'
import { uploadFile } from '../api/upload'
import type { MarkerData, MarkerPopup, MarkerImage } from '../types/edit-data'

/**
 * 标点弹窗配置编辑器
 * 以 Modal 形式展示，支持编辑弹窗标题、内容、图片链接和跳转链接
 */
export function MarkerPopupEditor({
  marker,
  visible,
  onClose,
}: {
  marker: MarkerData | null
  visible: boolean
  onClose: () => void
}) {
  const updateMarker = useEditStore((s) => s.updateMarker)
  const [form] = Form.useForm()
  const [images, setImages] = useState<MarkerImage[]>([])
  const [activeImageId, setActiveImageId] = useState<string>('')

  /** 保存弹窗配置和图片到 store */
  const handleSave = useCallback(() => {
    if (!marker) return
    const values = form.getFieldsValue()
    const popup: MarkerPopup = {
      title: values.title || '',
      content: values.content || '',
      imageUrl: values.imageUrl || undefined,
      linkUrl: values.linkUrl || undefined,
    }
    // 找到当前激活的图片 URL 作为显示图片
    const activeImage = images.find((img) => img.id === activeImageId)
    updateMarker(marker.id, {
      popup,
      images: images.length > 0 ? images : undefined,
      imageUrl: activeImage?.url || values.imageUrl || marker.imageUrl,
    })
    message.success('弹窗配置已保存')
    onClose()
  }, [marker, form, updateMarker, onClose, images, activeImageId])

  /** 上传标点图片 */
  const handleUploadImage = useCallback(async (file: File) => {
    try {
      const result = await uploadFile(file)
      const newImg: MarkerImage = {
        id: `mi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        url: result.url,
        name: file.name,
      }
      setImages((prev) => [...prev, newImg])
      if (!activeImageId) setActiveImageId(newImg.id)
    } catch {
      message.error('上传图片失败')
    }
    return false
  }, [activeImageId])

  if (!marker) return null

  return (
    <Modal
      title="配置点位弹窗"
      open={visible}
      onOk={handleSave}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      width={420}
      afterOpenChange={(open) => {
        if (open && marker) {
          form.setFieldsValue(marker.popup || {})
          setImages(marker.images || [])
          // 找到当前 imageUrl 对应的图片
          const matchImg = (marker.images || []).find((img) => img.url === marker.imageUrl)
          setActiveImageId(matchImg?.id || (marker.images?.[0]?.id || ''))
        } else if (open) {
          form.resetFields()
          setImages([])
          setActiveImageId('')
        }
      }}
    >
      <Form form={form} layout="vertical" size="small">
        <Form.Item label="弹窗标题" name="title">
          <Input placeholder="请输入弹窗标题" maxLength={100} />
        </Form.Item>
        <Form.Item label="弹窗内容" name="content">
          <Input.TextArea placeholder="请输入弹窗内容" rows={4} maxLength={1000} />
        </Form.Item>
        <Form.Item label="图片链接" name="imageUrl">
          <Input placeholder="可选：弹窗中显示的图片URL" />
        </Form.Item>
        <Form.Item label="跳转链接" name="linkUrl">
          <Input placeholder="可选：点击弹窗后跳转的URL" />
        </Form.Item>

        {/* 多图片管理 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>标点图片</label>
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => { handleUploadImage(file); return false }}
            >
              <Button type="link" size="small" icon={<Icon icon={plusIcon} width={12} />}>
                添加图片
              </Button>
            </Upload>
          </div>
          {images.length === 0 && (
            <div style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
              暂无图片，点击添加
            </div>
          )}
          {images.map((img) => (
            <div
              key={img.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 6px',
                marginBottom: 4,
                borderRadius: 4,
                background: activeImageId === img.id ? 'rgba(74,158,255,0.1)' : 'transparent',
                border: activeImageId === img.id ? '1px solid rgba(74,158,255,0.3)' : '1px solid transparent',
              }}
            >
              <img src={img.url} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 3 }} />
              <Input
                size="small"
                value={img.state || img.name || ''}
                placeholder="状态标签"
                style={{ flex: 1, fontSize: 12 }}
                onChange={(e) => {
                  setImages((prev) => prev.map((i) => i.id === img.id ? { ...i, state: e.target.value } : i))
                }}
              />
              <Button
                type={activeImageId === img.id ? 'primary' : 'text'}
                size="small"
                onClick={() => setActiveImageId(img.id)}
              >
                {activeImageId === img.id ? '当前' : '选用'}
              </Button>
              <Button
                type="text"
                size="small"
                danger
                onClick={() => {
                  setImages((prev) => prev.filter((i) => i.id !== img.id))
                  if (activeImageId === img.id) {
                    setActiveImageId(images.find((i) => i.id !== img.id)?.id || '')
                  }
                }}
              >
                <Icon icon={trash2Icon} width={12} />
              </Button>
            </div>
          ))}
        </div>
      </Form>
    </Modal>
  )
}

/**
 * 标点弹窗展示组件
 * 在 3D 场景中以浮动卡片形式展示标点的弹窗信息
 * 支持标题、内容、图片和跳转链接的展示
 */
export function MarkerPopupView({
  popup,
  position,
  onClose,
}: {
  popup: MarkerPopup
  position: { x: number; y: number }
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 100,
        minWidth: 200,
        maxWidth: 320,
        background: 'rgba(20, 20, 30, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        animation: 'popupFadeIn 0.2s ease-out',
      }}
    >
      <div style={{
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{ color: '#eee', fontWeight: 600, fontSize: 13 }}>{popup.title}</span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#999',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
          }}
        >
          <Icon icon={xIcon} width={14} />
        </button>
      </div>
      {popup.imageUrl && (
        <div style={{ padding: '8px 14px 0' }}>
          <img
            src={popup.imageUrl}
            alt={popup.title}
            style={{ width: '100%', borderRadius: 6, maxHeight: 160, objectFit: 'cover' }}
          />
        </div>
      )}
      <div style={{ padding: '8px 14px 12px', color: '#bbb', fontSize: 12, lineHeight: 1.6 }}>
        {popup.content}
      </div>
      {popup.linkUrl && (
        <div style={{ padding: '0 14px 10px' }}>
          <a
            href={popup.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#4a9eff', fontSize: 12 }}
          >
            查看详情 →
          </a>
        </div>
      )}
      <style>{`
        @keyframes popupFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
