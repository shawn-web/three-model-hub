/**
 * 标点完整配置面板
 *
 * Modal 形式提供标点的全部配置，使用 Tabs 分组：
 * - 基础：名称、图标尺寸、不透明度、形状、偏移、固定大小、图标图片
 * - 位置：X/Y/Z + 点击重定位
 * - 行为：无操作 / 弹窗 / 跳转链接
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
  ColorPicker,
  Switch,
  Tabs,
  theme as antdTheme,
} from 'antd'
import type { TabsProps } from 'antd'
import { Icon } from '@iconify/react'
import { crosshairIcon, plusIcon, trash2Icon } from './Icons'
import { useEditStore } from '../store/edit-store'
import { ResourcePicker } from './ResourcePicker'
import type { MarkerData, MarkerPopupStyle, MarkerImage, MarkerIframe } from '../types/edit-data'
import { getDefaultMarkerUrl } from '../utils/marker-defaults'
import { createDefaultMarkerImage } from './MarkerSpriteShared'

const DEFAULT_POPUP_STYLE: MarkerPopupStyle = {
  width: 260,
  background: '#1a1a2ecc',
  textColor: '#eeeeee',
  borderRadius: 8,
  fontSize: 13,
  padding: 12,
  shadow: true,
  titleAlign: 'left',
  contentAlign: 'left',
}

const SHAPE_OPTIONS = [
  { value: 'original', label: '原比例' },
  { value: 'circle', label: '圆形' },
  { value: 'rounded', label: '圆角方形' },
]

const ALIGN_OPTIONS = [
  { value: 'left', label: '左对齐' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右对齐' },
]

const CLOSE_BUTTON_POSITION_OPTIONS = [
  { value: 'top-left', label: '左上' },
  { value: 'top-right', label: '右上' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-right', label: '右下' },
]

interface MarkerConfigPanelProps {
  marker: MarkerData | null
  visible: boolean
  onClose: () => void
}

export function MarkerConfigPanel({ marker, visible, onClose }: MarkerConfigPanelProps) {
  const updateMarker = useEditStore((s) => s.updateMarker)
  const [form] = Form.useForm()
  const { token } = antdTheme.useToken()

  const [activeTab, setActiveTab] = useState('basic')
  const [action, setAction] = useState<'popup' | 'link' | 'iframe' | 'none'>('none')
  const [images, setImages] = useState<MarkerImage[]>([])
  const [activeImageId, setActiveImageId] = useState<string>('')
  const [currentState, setCurrentState] = useState<string>('')
  const [popupStyle, setPopupStyle] = useState<MarkerPopupStyle>({ ...DEFAULT_POPUP_STYLE })
  const [markerPickerOpen, setMarkerPickerOpen] = useState(false)
  const [shape, setShape] = useState<string>('original')
  const [markerOpacity, setMarkerOpacity] = useState<number>(1)
  const [markerOffset, setMarkerOffset] = useState<number>(0)
  const [fixedSize, setFixedSize] = useState<boolean>(false)
  const [iframeConfig, setIframeConfig] = useState<MarkerIframe>({ url: '', width: 400, height: 300, showCloseButton: true, closeButtonPosition: 'top-right' })
  const [closeButtonPickerOpen, setCloseButtonPickerOpen] = useState(false)

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
      opacity: markerOpacity,
      shape: (shape || 'original') as MarkerData['shape'],
      offset: markerOffset,
      fixedSize,
    }

    // 图片管理：有图片用激活图片的 url，无图片时回退到默认图标
    if (images.length > 0) {
      const activeImage = images.find((img) => img.id === activeImageId)
      if (activeImage) {
        updates.imageUrl = activeImage.url
      } else if (images[0]) {
        updates.imageUrl = images[0].url
        setActiveImageId(images[0].id)
      }
    } else {
      updates.imageUrl = getDefaultMarkerUrl() || createDefaultMarkerImage()
      updates.images = undefined
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
      updates.iframe = undefined
    } else if (action === 'link') {
      updates.linkUrl = values.linkUrl || undefined
      updates.linkTarget = values.linkTarget || '_blank'
      updates.popup = undefined
      updates.iframe = undefined
    } else if (action === 'iframe') {
      updates.iframe = { ...iframeConfig, url: values.iframeUrl || '' }
      updates.popup = undefined
      updates.linkUrl = undefined
      updates.linkTarget = undefined
    } else {
      updates.popup = undefined
      updates.linkUrl = undefined
      updates.linkTarget = undefined
      updates.iframe = undefined
    }

    updateMarker(marker.id, updates)
    message.success('标点配置已保存')
    onClose()
  }, [marker, form, action, images, activeImageId, popupStyle, updateMarker, onClose, markerOpacity, shape, markerOffset, fixedSize, iframeConfig, currentState])

  const handleMarkerResourceSelect = useCallback((resources: { url: string; name: string }[]) => {
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

  const handleCloseButtonImageSelect = useCallback((resources: { url: string; name: string }[]) => {
    if (resources[0]) {
      setIframeConfig((prev) => ({ ...prev, closeButtonImage: resources[0].url }))
    }
    setCloseButtonPickerOpen(false)
  }, [])

  if (!marker) return null

  const tabItems: TabsProps['items'] = [
    {
      key: 'basic',
      label: '基础',
      children: (
        <>
          <Form.Item label="标点名称" name="name" style={{ marginBottom: 12 }}>
            <Input placeholder="请输入标点名称" maxLength={50} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Form.Item label="图标宽度" name="width" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber min={0.01} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="图标高度" name="height" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber min={0.01} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>
              不透明度 <span style={{ float: 'right' }}>{markerOpacity.toFixed(2)}</span>
            </div>
            <InputNumber min={0.05} max={1} step={0.05} value={markerOpacity} style={{ width: '100%' }} onChange={(v) => v != null && setMarkerOpacity(v)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>形状裁切</div>
            <Radio.Group optionType="button" buttonStyle="solid" size="small" value={shape} onChange={(e) => setShape(e.target.value)} options={SHAPE_OPTIONS} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>偏移高度（沿 Y 轴上移）</div>
            <InputNumber min={0} max={20} step={0.1} value={markerOffset} style={{ width: '100%' }} onChange={(v) => v != null && setMarkerOffset(v)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: token.colorTextTertiary }}>固定大小（不随距离缩放）</span>
            <Switch size="small" checked={fixedSize} onChange={setFixedSize} />
          </div>

          {/* 图标图片管理 */}
          <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 10, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: token.colorTextTertiary }}>标点图标</span>
              {images.some((img) => img.state) && (
                <Select
                  size="small"
                  value={currentState || undefined}
                  placeholder="选择状态"
                  style={{ width: 100 }}
                  allowClear
                  onChange={(v) => setCurrentState(v || '')}
                  options={images
                    .filter((img) => img.state)
                    .map((img) => ({ label: img.state, value: img.state! }))}
                />
              )}
              <Button
                type="link"
                size="small"
                icon={<Icon icon={plusIcon} width={12} />}
                onClick={() => setMarkerPickerOpen(true)}
              >
                添加
              </Button>
            </div>
            <ResourcePicker
              open={markerPickerOpen}
              onClose={() => setMarkerPickerOpen(false)}
              onSelect={handleMarkerResourceSelect}
              multiple
              typeFilter="image"
              allowUpload
            />
            {images.length === 0 && (
              <div className="text-center text-xs py-2" style={{ color: token.colorTextQuaternary }}>
                使用默认图标
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
                  background: activeImageId === img.id ? token.colorPrimaryBg : 'transparent',
                  border: activeImageId === img.id ? `1px solid ${token.colorPrimaryBorder}` : '1px solid transparent',
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
        </>
      ),
    },
    {
      key: 'position',
      label: '位置',
      children: (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {(['X', 'Y', 'Z'] as const).map((axis, idx) => (
              <div key={axis} style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 2 }}>{axis}</div>
                <InputNumber
                  size="small"
                  style={{ width: '100%' }}
                  value={Number(marker.position?.[idx]?.toFixed(2) ?? 0)}
                  step={0.1}
                  onChange={(v) => {
                    if (v != null) {
                      const pos: [number, number, number] = [...marker.position]
                      pos[idx] = v
                      updateMarker(marker.id, { position: pos })
                    }
                  }}
                />
              </div>
            ))}
          </div>
          <Button
            size="small"
            type="dashed"
            icon={<Icon icon={crosshairIcon} width={12} />}
            block
            onClick={() => {
              useEditStore.getState().setEditingMarkerId(marker.id)
              onClose()
            }}
          >
            点击模型重定位
          </Button>
        </>
      ),
    },
    {
      key: 'action',
      label: '行为',
      children: (
        <>
          <Radio.Group value={action} onChange={(e) => setAction(e.target.value)} style={{ marginBottom: 12 }}>
            <Radio value="none">无操作</Radio>
            <Radio value="popup">自定义弹窗</Radio>
            <Radio value="iframe">iframe 弹窗</Radio>
            <Radio value="link">跳转链接</Radio>
          </Radio.Group>

          {action === 'popup' && (
            <div style={{ padding: '8px 12px', background: token.colorFillQuaternary, borderRadius: 6 }}>
              <Form.Item label="弹窗标题" name="popupTitle">
                <Input placeholder="请输入弹窗标题" maxLength={100} />
              </Form.Item>
              <Form.Item label="弹窗内容" name="popupContent">
                <Input.TextArea placeholder="请输入弹窗内容" rows={3} maxLength={1000} />
              </Form.Item>
              <Form.Item label="内容链接" name="popupContentUrl">
                <Input placeholder="可选：弹窗中嵌入的链接（iframe）" />
              </Form.Item>

              {/* 弹窗样式 */}
              <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 12, marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>弹窗样式</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>宽度 (px)</div>
                      <InputNumber size="small" value={popupStyle.width} min={100} max={600} style={{ width: '100%' }} onChange={(v) => v != null && setPopupStyle((s) => ({ ...s, width: v }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>高度 (px)</div>
                      <InputNumber size="small" value={popupStyle.height} min={60} max={800} style={{ width: '100%' }} placeholder="自适应" onChange={(v) => setPopupStyle((s) => ({ ...s, height: v ?? undefined }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>内边距</div>
                      <InputNumber size="small" value={popupStyle.padding} min={0} max={40} style={{ width: '100%' }} onChange={(v) => v != null && setPopupStyle((s) => ({ ...s, padding: v }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>圆角</div>
                      <InputNumber size="small" value={popupStyle.borderRadius} min={0} max={30} style={{ width: '100%' }} onChange={(v) => v != null && setPopupStyle((s) => ({ ...s, borderRadius: v }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>背景色</div>
                      <ColorPicker size="small" value={popupStyle.background} onChangeComplete={(c) => setPopupStyle((s) => ({ ...s, background: c.toHexString() }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>边框色</div>
                      <ColorPicker size="small" value={popupStyle.borderColor || '#ffffff'} onChangeComplete={(c) => setPopupStyle((s) => ({ ...s, borderColor: c.toHexString() }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>文字颜色</div>
                      <ColorPicker size="small" value={popupStyle.textColor} onChangeComplete={(c) => setPopupStyle((s) => ({ ...s, textColor: c.toHexString() }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>字号</div>
                      <InputNumber size="small" value={popupStyle.fontSize} min={10} max={24} style={{ width: '100%' }} onChange={(v) => v != null && setPopupStyle((s) => ({ ...s, fontSize: v }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>标题对齐</div>
                      <Select size="small" value={popupStyle.titleAlign} style={{ width: '100%' }} onChange={(v) => setPopupStyle((s) => ({ ...s, titleAlign: v }))} options={ALIGN_OPTIONS} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>内容对齐</div>
                      <Select size="small" value={popupStyle.contentAlign} style={{ width: '100%' }} onChange={(v) => setPopupStyle((s) => ({ ...s, contentAlign: v }))} options={ALIGN_OPTIONS} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: token.colorTextTertiary }}>显示阴影</span>
                    <Switch size="small" checked={popupStyle.shadow !== false} onChange={(v) => setPopupStyle((s) => ({ ...s, shadow: v }))} />
                  </div>
                  <Button size="small" type="link" onClick={() => setPopupStyle({ ...DEFAULT_POPUP_STYLE })}>
                    恢复默认样式
                  </Button>
                </div>
              </div>
            </div>
          )}

          {action === 'iframe' && (
            <div style={{ padding: '8px 12px', background: token.colorFillQuaternary, borderRadius: 6 }}>
              <Form.Item label="iframe 地址" name="iframeUrl" rules={[{ required: true, message: '请输入 iframe 地址' }]}>
                <Input placeholder="请输入 iframe URL" />
              </Form.Item>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>宽度 (px)</div>
                  <InputNumber size="small" value={iframeConfig.width} min={100} max={1200} style={{ width: '100%' }} onChange={(v) => v != null && setIframeConfig((s) => ({ ...s, width: v }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>高度 (px)</div>
                  <InputNumber size="small" value={iframeConfig.height} min={60} max={1000} style={{ width: '100%' }} onChange={(v) => v != null && setIframeConfig((s) => ({ ...s, height: v }))} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: token.colorTextTertiary }}>显示关闭按钮</span>
                <Switch size="small" checked={iframeConfig.showCloseButton !== false} onChange={(v) => setIframeConfig((s) => ({ ...s, showCloseButton: v }))} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>关闭按钮位置</div>
                <Select size="small" value={iframeConfig.closeButtonPosition} style={{ width: '100%' }} onChange={(v) => setIframeConfig((s) => ({ ...s, closeButtonPosition: v }))} options={CLOSE_BUTTON_POSITION_OPTIONS} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 4 }}>关闭按钮图片</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {iframeConfig.closeButtonImage && (
                    <img src={iframeConfig.closeButtonImage} alt="关闭按钮" style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 3, border: `1px solid ${token.colorBorderSecondary}` }} />
                  )}
                  <Button size="small" onClick={() => setCloseButtonPickerOpen(true)}>
                    {iframeConfig.closeButtonImage ? '更换图片' : '选择图片'}
                  </Button>
                  {iframeConfig.closeButtonImage && (
                    <Button size="small" type="link" danger onClick={() => setIframeConfig((s) => ({ ...s, closeButtonImage: undefined }))}>
                      清除
                    </Button>
                  )}
                </div>
              </div>
              <ResourcePicker
                open={closeButtonPickerOpen}
                onClose={() => setCloseButtonPickerOpen(false)}
                onSelect={handleCloseButtonImageSelect}
                typeFilter="image"
                allowUpload
              />
            </div>
          )}

          {action === 'link' && (
            <div style={{ padding: '8px 12px', background: token.colorFillQuaternary, borderRadius: 6 }}>
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
        </>
      ),
    },
  ]

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
            iframeUrl: marker.iframe?.url || '',
          })
          setAction(marker.action || 'none')
          setCurrentState(marker.state || '')
          setImages(marker.images || [])
          const matchImg = (marker.images || []).find((img) => img.url === marker.imageUrl)
          setActiveImageId(matchImg?.id || (marker.images?.[0]?.id || ''))
          setPopupStyle(marker.popup?.style || { ...DEFAULT_POPUP_STYLE })
          setIframeConfig(marker.iframe || { url: '', width: 400, height: 300, showCloseButton: true, closeButtonPosition: 'top-right' })
          setShape(marker.shape || 'original')
          setMarkerOpacity(marker.opacity ?? 1)
          setMarkerOffset(marker.offset ?? 0)
          setFixedSize(marker.fixedSize ?? false)
        }
      }}
    >
      <Form form={form} layout="vertical" size="small">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          items={tabItems}
          tabBarStyle={{ marginBottom: 12 }}
        />
      </Form>
    </Modal>
  )
}
