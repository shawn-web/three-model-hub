/**
 * Geo 标点配置 Modal
 * 三 Tab 设计：基础（图标选择+默认图标管理） / 位置 / 行为
 * 参考 MarkerConfigPanel 的 UI 模式
 */
import { useState, useCallback } from 'react'
import { Modal, Tabs, Input, InputNumber, Select, Button, Space, ColorPicker, Switch, Upload, message, Popconfirm } from 'antd'
import { PushpinOutlined, EnvironmentOutlined, ThunderboltOutlined, UploadOutlined, UndoOutlined, PictureOutlined } from '@ant-design/icons'
import { useGeoStore } from '../../store/geo-store'
import type { GeoMarkerData, GeoMarkerPopup, GeoMarkerPopupStyle, GeoMarkerIframe } from '../../types/geo-marker'
import { ResourcePicker } from '../ResourcePicker'
import { uploadFile } from '../../api/upload'
import { getDefaultMarkerUrl, setDefaultMarkerUrl, resetDefaultMarkerUrl } from '../../utils/marker-defaults'

/** 生成默认 Canvas pin 图标的 data URL */
let _defaultPinDataUrl: string | null = null
function createDefaultPinDataUrl(): string {
  if (_defaultPinDataUrl) return _defaultPinDataUrl
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  ctx.arc(32, 22, 16, Math.PI, 0, false)
  ctx.quadraticCurveTo(48, 38, 32, 56)
  ctx.quadraticCurveTo(16, 38, 16, 22)
  ctx.closePath()
  ctx.fillStyle = '#ff4444'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(32, 22, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  _defaultPinDataUrl = canvas.toDataURL('image/png')
  return _defaultPinDataUrl
}

interface GeoMarkerConfigProps {
  open: boolean
  markerId: string | null
  onClose: () => void
}

export function GeoMarkerConfig({ open, markerId, onClose }: GeoMarkerConfigProps) {
  const markers = useGeoStore((s) => s.markers)
  const updateMarker = useGeoStore((s) => s.updateMarker)
  const removeMarker = useGeoStore((s) => s.removeMarker)

  const marker = markers.find((m) => m.id === markerId) ?? null

  // 本地编辑状态
  const [form, setForm] = useState<GeoMarkerData | null>(null)
  const [lastMarkerId, setLastMarkerId] = useState<string | null>(null)

  // 图标选择器
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  // 默认图标管理
  const [customDefault, setCustomDefault] = useState<string | null>(getDefaultMarkerUrl())

  // markerId 变化时重置表单
  if (markerId !== lastMarkerId) {
    setLastMarkerId(markerId)
    setForm(marker ? { ...marker } : null)
  }

  // 从资源管理器选择图标
  const handleIconSelect = useCallback((resources: { url: string; name: string }[]) => {
    if (resources[0]) {
      setForm((prev) => prev ? { ...prev, iconUrl: resources[0].url } : prev)
    }
    setIconPickerOpen(false)
  }, [])

  // 上传自定义默认图标
  const handleUploadDefault = useCallback(async (file: File) => {
    try {
      const result = await uploadFile(file, { bizType: 'marker-icon' })
      setDefaultMarkerUrl(result.url)
      setCustomDefault(result.url)
      message.success('默认标点图标已更新')
    } catch {
      message.error('上传失败')
    }
    return false
  }, [])

  // 还原默认图标
  const handleResetDefault = useCallback(() => {
    resetDefaultMarkerUrl()
    setCustomDefault(null)
    message.success('已还原为默认图标')
  }, [])

  if (!form) return null

  const updateForm = (updates: Partial<GeoMarkerData>) => {
    setForm((prev) => prev ? { ...prev, ...updates } : prev)
  }

  const updatePopup = (updates: Partial<GeoMarkerPopup>) => {
    setForm((prev) => prev ? {
      ...prev,
      popup: { ...prev.popup!, ...updates },
    } : prev)
  }

  const updatePopupStyle = (updates: Partial<GeoMarkerPopupStyle>) => {
    setForm((prev) => prev ? {
      ...prev,
      popup: {
        ...prev.popup!,
        style: { ...prev.popup?.style, ...updates },
      },
    } : prev)
  }

  const updateIframe = (updates: Partial<GeoMarkerIframe>) => {
    setForm((prev) => prev ? {
      ...prev,
      iframe: { ...prev.iframe!, ...updates },
    } : prev)
  }

  const handleSave = () => {
    if (!form || !markerId) return
    updateMarker(markerId, form)
    onClose()
  }

  const handleDelete = () => {
    if (!markerId) return
    removeMarker(markerId)
    onClose()
  }

  // 使用默认图标
  const handleUseDefault = () => {
    const url = customDefault || undefined
    updateForm({ iconUrl: url })
  }

  // 确保 action 切换时初始化对应数据
  const handleActionChange = (action: GeoMarkerData['action']) => {
    const updates: Partial<GeoMarkerData> = { action }
    if (action === 'popup' && !form.popup) {
      updates.popup = { title: form.name, content: '' }
    }
    if (action === 'iframe' && !form.iframe) {
      updates.iframe = { url: '', width: 400, height: 300 }
    }
    updateForm(updates)
  }

  const actionLabel: Record<string, string> = {
    none: '无操作',
    popup: '弹窗',
    iframe: '嵌入页面',
    link: '跳转链接',
  }

  // 当前使用的图标预览
  const currentIconUrl = form.iconUrl || customDefault || createDefaultPinDataUrl()

  return (
    <Modal
      title={<span><PushpinOutlined /> 标点配置</span>}
      open={open}
      onOk={handleSave}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      width={460}
      destroyOnHidden
      styles={{ body: { maxHeight: '60vh', overflow: 'auto' } }}
      footer={
        <Space style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Popconfirm title="确定删除此标点？" description="删除后不可恢复" onConfirm={handleDelete} okText="删除" cancelText="取消">
            <Button danger>删除标点</Button>
          </Popconfirm>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={handleSave}>保存</Button>
          </Space>
        </Space>
      }
    >
      <Tabs
        defaultActiveKey="basic"
        items={[
          {
            key: 'basic',
            label: <span><PushpinOutlined /> 基础</span>,
            children: (
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>名称</label>
                  <Input
                    value={form.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                    placeholder="标点名称"
                  />
                </div>

                {/* 图标选择区域 */}
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>标点图标</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <img
                      src={currentIconUrl}
                      alt="图标预览"
                      style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}
                    />
                    <Button size="small" icon={<PictureOutlined />} onClick={() => setIconPickerOpen(true)}>
                      从资源选择
                    </Button>
                    <Button size="small" onClick={handleUseDefault}>
                      默认图标
                    </Button>
                  </div>
                  <Input
                    value={form.iconUrl || ''}
                    onChange={(e) => updateForm({ iconUrl: e.target.value || undefined })}
                    placeholder="留空使用默认图标，或输入图标 URL"
                    size="small"
                  />
                </div>

                {/* 默认图标管理 */}
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>默认图标管理</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img
                      src={customDefault || createDefaultPinDataUrl()}
                      alt="默认图标"
                      style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}
                    />
                    <span style={{ fontSize: 12, color: '#999' }}>
                      {customDefault ? '自定义' : '内置'}
                    </span>
                    <Upload
                      accept="image/*"
                      showUploadList={false}
                      beforeUpload={(file) => { handleUploadDefault(file); return false }}
                    >
                      <Button size="small" icon={<UploadOutlined />}>上传</Button>
                    </Upload>
                    {customDefault && (
                      <Button size="small" icon={<UndoOutlined />} onClick={handleResetDefault}>还原</Button>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>图标缩放</label>
                  <InputNumber
                    value={form.iconScale || 1}
                    onChange={(v) => v !== null && updateForm({ iconScale: v })}
                    min={0.1}
                    max={5}
                    step={0.1}
                    style={{ width: '100%' }}
                  />
                </div>
              </Space>
            ),
          },
          {
            key: 'position',
            label: <span><EnvironmentOutlined /> 位置</span>,
            children: (
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>经度</label>
                  <InputNumber
                    value={form.longitude}
                    onChange={(v) => v !== null && updateForm({ longitude: v })}
                    step={0.000001}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>纬度</label>
                  <InputNumber
                    value={form.latitude}
                    onChange={(v) => v !== null && updateForm({ latitude: v })}
                    step={0.000001}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>海拔 (米)</label>
                  <InputNumber
                    value={form.altitude}
                    onChange={(v) => v !== null && updateForm({ altitude: v })}
                    step={0.1}
                    style={{ width: '100%' }}
                  />
                </div>
              </Space>
            ),
          },
          {
            key: 'action',
            label: <span><ThunderboltOutlined /> 行为</span>,
            children: (
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>点击行为</label>
                  <Select
                    value={form.action}
                    onChange={handleActionChange}
                    style={{ width: '100%' }}
                    options={Object.entries(actionLabel).map(([value, label]) => ({ value, label }))}
                  />
                </div>

                {/* 跳转链接 */}
                {form.action === 'link' && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>链接 URL</label>
                      <Input
                        value={form.linkUrl || ''}
                        onChange={(e) => updateForm({ linkUrl: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>打开方式</label>
                      <Select
                        value={form.linkTarget || '_blank'}
                        onChange={(v) => updateForm({ linkTarget: v })}
                        style={{ width: '100%' }}
                        options={[
                          { value: '_blank', label: '新窗口' },
                          { value: '_self', label: '当前窗口' },
                        ]}
                      />
                    </div>
                  </>
                )}

                {/* iframe 嵌入 */}
                {form.action === 'iframe' && form.iframe && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>页面 URL</label>
                      <Input
                        value={form.iframe.url}
                        onChange={(e) => updateIframe({ url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>宽度 (px)</label>
                        <InputNumber
                          value={form.iframe.width || 400}
                          onChange={(v) => v !== null && updateIframe({ width: v })}
                          min={200}
                          max={800}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>高度 (px)</label>
                        <InputNumber
                          value={form.iframe.height || 300}
                          onChange={(v) => v !== null && updateIframe({ height: v })}
                          min={150}
                          max={600}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>关闭按钮</label>
                      <Switch
                        checked={form.iframe.showCloseButton !== false}
                        onChange={(v) => updateIframe({ showCloseButton: v })}
                      />
                    </div>
                  </>
                )}

                {/* 自定义弹窗 */}
                {form.action === 'popup' && form.popup && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>标题</label>
                      <Input
                        value={form.popup.title}
                        onChange={(e) => updatePopup({ title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>内容</label>
                      <Input.TextArea
                        value={form.popup.content}
                        onChange={(e) => updatePopup({ content: e.target.value })}
                        rows={3}
                        placeholder="弹窗正文内容"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>图片 URL</label>
                      <Input
                        value={form.popup.imageUrl || ''}
                        onChange={(e) => updatePopup({ imageUrl: e.target.value || undefined })}
                        placeholder="弹窗内显示的图片"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>跳转链接</label>
                      <Input
                        value={form.popup.linkUrl || ''}
                        onChange={(e) => updatePopup({ linkUrl: e.target.value || undefined })}
                        placeholder="弹窗底部链接"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>嵌入 iframe</label>
                      <Input
                        value={form.popup.contentUrl || ''}
                        onChange={(e) => updatePopup({ contentUrl: e.target.value || undefined })}
                        placeholder="弹窗内嵌入的页面 URL"
                      />
                    </div>

                    {/* 弹窗样式 */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 4 }}>
                      <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>弹窗样式</label>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#999' }}>宽度</label>
                          <InputNumber
                            value={form.popup.style?.width || 280}
                            onChange={(v) => v !== null && updatePopupStyle({ width: v })}
                            min={150}
                            max={500}
                            style={{ width: '100%' }}
                            size="small"
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#999' }}>字号</label>
                          <InputNumber
                            value={form.popup.style?.fontSize || 13}
                            onChange={(v) => v !== null && updatePopupStyle({ fontSize: v })}
                            min={10}
                            max={20}
                            style={{ width: '100%' }}
                            size="small"
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#999' }}>背景色</label>
                          <ColorPicker
                            value={form.popup.style?.background || 'rgba(20,20,30,0.92)'}
                            onChange={(_, hex) => updatePopupStyle({ background: hex })}
                            size="small"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#999' }}>文字色</label>
                          <ColorPicker
                            value={form.popup.style?.textColor || '#eee'}
                            onChange={(_, hex) => updatePopupStyle({ textColor: hex })}
                            size="small"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </Space>
            ),
          },
        ]}
      />

      {/* 资源选择器：选择标点图标 */}
      <ResourcePicker
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        onSelect={handleIconSelect}
        typeFilter="image"
        allowUpload
      />
    </Modal>
  )
}
