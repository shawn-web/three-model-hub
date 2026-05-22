/**
 * 标点完整配置面板
 *
 * Modal 形式提供标点的全部配置：
 * - 名称、图标尺寸
 * - 点击行为（无操作 / 弹窗 / 跳转链接），弹窗和链接互斥
 * - 弹窗配置：标题、内容、图片、自定义样式
 * - 链接配置：URL、打开方式
 * - 多图片管理
 */
import { useState, useCallback } from 'react'
import {
  Input,
  Button,
  Modal,
  Form,
  message,
  Radio,
  InputNumber,
  Select,
  Collapse,
  ColorPicker,
} from 'antd'
import { Icon } from '@iconify/react'
import { crosshairIcon, plusIcon, trash2Icon } from './Icons'
import { useEditStore } from '../store/edit-store'
import { ResourcePicker } from './ResourcePicker'
import type { MarkerData, MarkerPopupStyle, MarkerImage } from '../types/edit-data'
import type { ResourceItem } from '../types/resource'

/** 默认弹窗样式 */
const DEFAULT_POPUP_STYLE: MarkerPopupStyle = {
  width: 260,
  background: '#1a1a2ecc',
  textColor: '#eeeeee',
  borderRadius: 8,
  fontSize: 13,
}

interface MarkerConfigPanelProps {
  marker: MarkerData | null
  visible: boolean
  onClose: () => void
}

export function MarkerConfigPanel({ marker, visible, onClose }: MarkerConfigPanelProps) {
  const updateMarker = useEditStore((s) => s.updateMarker)
  const [form] = Form.useForm()

  const [action, setAction] = useState<'popup' | 'link' | 'none'>('none')
  const [images, setImages] = useState<MarkerImage[]>([])
  const [activeImageId, setActiveImageId] = useState<string>('')
  const [currentState, setCurrentState] = useState<string>('')
  const [popupStyle, setPopupStyle] = useState<MarkerPopupStyle>({ ...DEFAULT_POPUP_STYLE })
  const [markerPickerOpen, setMarkerPickerOpen] = useState(false)

  /** 保存配置 */
  const handleSave = useCallback(() => {
    if (!marker) return
    const values = form.getFieldsValue()

    const updates: Partial<MarkerData> = {
      name: values.name || marker.name,
      width: values.width ?? marker.width,
      height: values.height ?? marker.height,
      action,
      state: currentState || undefined,
      images: images.length > 0 ? images : undefined,
    }

    // 当前激活图片作为标点图标
    const activeImage = images.find((img) => img.id === activeImageId)
    if (activeImage) {
      updates.imageUrl = activeImage.url
    }

    if (action === 'popup') {
      updates.popup = {
        title: values.popupTitle || '',
        content: values.popupContent || '',
        contentUrl: values.popupContentUrl || undefined,
        style: { ...popupStyle },
      }
      updates.linkUrl = undefined
      updates.linkTarget = undefined
    } else if (action === 'link') {
      updates.linkUrl = values.linkUrl || undefined
      updates.linkTarget = values.linkTarget || '_blank'
      updates.popup = undefined
    } else {
      updates.popup = undefined
      updates.linkUrl = undefined
      updates.linkTarget = undefined
    }

    updateMarker(marker.id, updates)
    message.success('标点配置已保存')
    onClose()
  }, [marker, form, action, images, activeImageId, popupStyle, updateMarker, onClose])

  /** 从资源库选择标点图片 */
  const handleMarkerResourceSelect = useCallback((resources: ResourceItem[]) => {
    for (const res of resources) {
      const newImg: MarkerImage = {
        id: `mi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        url: res.url,
        name: res.name,
      }
      setImages((prev) => [...prev, newImg])
      if (!activeImageId) setActiveImageId(newImg.id)
    }
  }, [activeImageId])

  if (!marker) return null

  return (
    <Modal
      title="标点配置"
      open={visible}
      onOk={handleSave}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      width={480}
      destroyOnHidden
      styles={{ body: { maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 } }}
      afterOpenChange={(open) => {
        if (open && marker) {
          form.setFieldsValue({
            name: marker.name,
            width: marker.width,
            height: marker.height,
            popupTitle: marker.popup?.title || '',
            popupContent: marker.popup?.content || '',
            popupContentUrl: marker.popup?.contentUrl || '',
            linkUrl: marker.linkUrl || '',
            linkTarget: marker.linkTarget || '_blank',
          })
          setAction(marker.action || 'none')
          setCurrentState(marker.state || '')
          setImages(marker.images || [])
          const matchImg = (marker.images || []).find((img) => img.url === marker.imageUrl)
          setActiveImageId(matchImg?.id || (marker.images?.[0]?.id || ''))
          setPopupStyle(marker.popup?.style || { ...DEFAULT_POPUP_STYLE })
        }
      }}
    >
      <Form form={form} layout="vertical" size="small">
        {/* 基础设置 */}
        <Form.Item label="标点名称" name="name">
          <Input placeholder="请输入标点名称" maxLength={50} />
        </Form.Item>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Form.Item label="图标宽度" name="width" style={{ flex: 1, marginBottom: 0 }}>
            <InputNumber min={0.01} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="图标高度" name="height" style={{ flex: 1, marginBottom: 0 }}>
            <InputNumber min={0.01} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        {/* 位置坐标 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>位置坐标</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>X</label>
              <InputNumber
                size="small"
                style={{ width: '100%' }}
                value={Number(marker.position?.[0]?.toFixed(2) ?? 0)}
                step={0.1}
                onChange={(v) => {
                  if (v != null) {
                    updateMarker(marker.id, { position: [v, marker.position[1], marker.position[2]] })
                  }
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Y</label>
              <InputNumber
                size="small"
                style={{ width: '100%' }}
                value={Number(marker.position?.[1]?.toFixed(2) ?? 0)}
                step={0.1}
                onChange={(v) => {
                  if (v != null) {
                    updateMarker(marker.id, { position: [marker.position[0], v, marker.position[2]] })
                  }
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 2 }}>Z</label>
              <InputNumber
                size="small"
                style={{ width: '100%' }}
                value={Number(marker.position?.[2]?.toFixed(2) ?? 0)}
                step={0.1}
                onChange={(v) => {
                  if (v != null) {
                    updateMarker(marker.id, { position: [marker.position[0], marker.position[1], v] })
                  }
                }}
              />
            </div>
          </div>
          <Button
            size="small"
            type="dashed"
            icon={<Icon icon={crosshairIcon} width={12} />}
            style={{ marginTop: 8, width: '100%' }}
            onClick={() => {
              useEditStore.getState().setEditingMarkerId(marker.id)
              onClose()
            }}
          >
            点击模型重定位
          </Button>
        </div>

        {/* 点击行为 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>点击行为</label>
          <Radio.Group value={action} onChange={(e) => setAction(e.target.value)}>
            <Radio value="none">无操作</Radio>
            <Radio value="popup">弹出浮窗</Radio>
            <Radio value="link">跳转链接</Radio>
          </Radio.Group>
        </div>

        {/* 弹窗配置 */}
        {action === 'popup' && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
            <Form.Item label="弹窗标题" name="popupTitle">
              <Input placeholder="请输入弹窗标题" maxLength={100} />
            </Form.Item>
            <Form.Item label="弹窗内容" name="popupContent">
              <Input.TextArea placeholder="请输入弹窗内容" rows={3} maxLength={1000} />
            </Form.Item>
            <Form.Item label="内容链接" name="popupContentUrl">
              <Input placeholder="可选：弹窗中嵌入的链接（iframe）" />
            </Form.Item>

            <Collapse size="small" items={[{
              key: 'style',
              label: '自定义样式',
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: '#888' }}>宽度 (px)</label>
                      <InputNumber
                        size="small"
                        value={popupStyle.width}
                        min={100}
                        max={600}
                        style={{ width: '100%' }}
                        onChange={(v) => v != null && setPopupStyle((s) => ({ ...s, width: v }))}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: '#888' }}>圆角</label>
                      <InputNumber
                        size="small"
                        value={popupStyle.borderRadius}
                        min={0}
                        max={30}
                        style={{ width: '100%' }}
                        onChange={(v) => v != null && setPopupStyle((s) => ({ ...s, borderRadius: v }))}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: '#888' }}>背景色</label>
                      <ColorPicker
                        size="small"
                        value={popupStyle.background}
                        onChangeComplete={(c) => setPopupStyle((s) => ({ ...s, background: c.toHexString() }))}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: '#888' }}>文字颜色</label>
                      <ColorPicker
                        size="small"
                        value={popupStyle.textColor}
                        onChangeComplete={(c) => setPopupStyle((s) => ({ ...s, textColor: c.toHexString() }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#888' }}>字号</label>
                    <InputNumber
                      size="small"
                      value={popupStyle.fontSize}
                      min={10}
                      max={24}
                      style={{ width: '100%' }}
                      onChange={(v) => v != null && setPopupStyle((s) => ({ ...s, fontSize: v }))}
                    />
                  </div>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => setPopupStyle({ ...DEFAULT_POPUP_STYLE })}
                  >
                    恢复默认样式
                  </Button>
                </div>
              ),
            }]} />
          </div>
        )}

        {/* 链接配置 */}
        {action === 'link' && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
            <Form.Item label="链接地址" name="linkUrl">
              <Input placeholder="请输入跳转链接 URL" />
            </Form.Item>
            <Form.Item label="打开方式" name="linkTarget">
              <Select size="small" options={[
                { label: '新窗口', value: '_blank' },
                { label: '当前窗口', value: '_self' },
              ]} />
            </Form.Item>
          </div>
        )}

        {/* 多图片管理 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>标点图片</label>

            {/* 状态选择 */}
            {images.some((img) => img.state) && (
              <Select
                size="small"
                value={currentState || undefined}
                placeholder="选择状态"
                style={{ width: 120 }}
                allowClear
                onChange={(v) => setCurrentState(v || '')}
                options={images
                  .filter((img) => img.state)
                  .map((img) => ({ label: img.state, value: img.state! }))}
              />
            )}
          </div>
            <Button
              type="link"
              size="small"
              icon={<Icon icon={plusIcon} width={12} />}
              onClick={() => setMarkerPickerOpen(true)}
            >
              添加图片
            </Button>
            <ResourcePicker
              open={markerPickerOpen}
              onClose={() => setMarkerPickerOpen(false)}
              onSelect={handleMarkerResourceSelect}
              multiple
              typeFilter="image"
              allowUpload
            />
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
