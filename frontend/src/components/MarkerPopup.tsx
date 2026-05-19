/**
 * 标点弹窗组件
 *
 * 提供两个组件：
 * - MarkerPopupEditor：弹窗配置编辑器（Modal），用于配置标点的弹窗内容
 * - MarkerPopupView：弹窗展示组件，在 3D 场景中展示标点的弹窗信息
 *
 * 弹窗支持配置：标题、内容、图片链接、跳转链接
 */
import { useState, useCallback } from 'react'
import { Input, Button, Modal, Form, message } from 'antd'
import { Icon } from '@iconify/react'
import { useEditStore } from '../store/edit-store'
import type { MarkerData, MarkerPopup } from '../types/edit-data'

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

  /** 保存弹窗配置到 store */
  const handleSave = useCallback(() => {
    if (!marker) return
    const values = form.getFieldsValue()
    const popup: MarkerPopup = {
      title: values.title || '',
      content: values.content || '',
      imageUrl: values.imageUrl || undefined,
      linkUrl: values.linkUrl || undefined,
    }
    updateMarker(marker.id, { popup })
    message.success('弹窗配置已保存')
    onClose()
  }, [marker, form, updateMarker, onClose])

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
        if (open && marker?.popup) {
          form.setFieldsValue(marker.popup)
        } else if (open) {
          form.resetFields()
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
          <Icon icon="lucide:x" width={14} />
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
