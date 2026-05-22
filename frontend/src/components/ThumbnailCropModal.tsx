/**
 * 缩略图裁剪编辑弹窗
 *
 * 使用 react-easy-crop 插件，支持：
 * - 拖拽裁剪区域
 * - 缩放（鼠标滚轮）
 * - 旋转（滑块控制）
 * - 确认后生成裁剪后的图片并上传
 */
import { useState, useCallback } from 'react'
import { Modal, Button, Slider } from 'antd'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'

interface ThumbnailCropModalProps {
  open: boolean
  imageDataUrl: string | null
  onClose: () => void
  onConfirm: (processedDataUrl: string) => void
}

export function ThumbnailCropModal({ open, imageDataUrl, onClose, onConfirm }: ThumbnailCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  /** 将裁剪区域的内容绘制到 canvas 并导出 */
  const handleConfirm = useCallback(async () => {
    if (!imageDataUrl || !croppedAreaPixels) return
    setSaving(true)

    try {
      const img = new Image()
      img.src = imageDataUrl
      await new Promise((resolve) => { img.onload = resolve })

      const canvas = document.createElement('canvas')
      canvas.width = croppedAreaPixels.width
      canvas.height = croppedAreaPixels.height
      const ctx = canvas.getContext('2d')!

      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.translate(-img.width / 2, -img.height / 2)
      // 裁剪区域映射回原图坐标
      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
      )
      ctx.restore()

      const dataUrl = canvas.toDataURL('image/png')
      onConfirm(dataUrl)
    } catch {
      // 忽略裁剪失败
    }
    setSaving(false)
  }, [imageDataUrl, croppedAreaPixels, rotation, onConfirm])

  return (
    <Modal
      title="编辑封面图"
      open={open}
      onCancel={onClose}
      width={640}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={handleConfirm}>确认上传</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 裁剪区域 */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: 350,
          background: '#1a1a2e',
          borderRadius: 6,
          overflow: 'hidden',
        }}>
          <Cropper
            image={imageDataUrl || undefined}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* 缩放控制 */}
        <div>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 2 }}>
            缩放: {zoom.toFixed(1)}x
          </label>
          <Slider
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={setZoom}
          />
        </div>

        {/* 旋转控制 */}
        <div>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 2 }}>
            旋转: {rotation}°
          </label>
          <Slider
            min={0}
            max={360}
            value={rotation}
            onChange={setRotation}
            step={1}
            marks={{ 0: '0°', 90: '90°', 180: '180°', 270: '270°', 360: '360°' }}
          />
        </div>
      </div>
    </Modal>
  )
}
