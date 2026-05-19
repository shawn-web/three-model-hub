import { useState, useCallback } from 'react'
import { Select, ColorPicker, Input, Upload, message, Button, theme } from 'antd'
import { Icon } from '@iconify/react'
import type { BackgroundConfig } from '../store/edit-store'
import { useEditStore } from '../store/edit-store'
import { uploadFile } from '../api/upload'

type BackgroundType = 'color' | 'image' | 'skybox' | 'hdr'

const BG_TYPE_OPTIONS = [
  { value: 'color', label: '纯色' },
  { value: 'image', label: '图片' },
  { value: 'skybox', label: '天空盒' },
  { value: 'hdr', label: 'HDR 环境贴图' },
]

export function SceneSettings() {
  const backgroundConfig = useEditStore((s) => s.backgroundConfig)
  const setBackgroundConfig = useEditStore((s) => s.setBackgroundConfig)
  const [uploading, setUploading] = useState(false)
  const { token } = theme.useToken()

  const currentType: BackgroundType = backgroundConfig?.type ?? 'color'

  const handleTypeChange = useCallback((type: BackgroundType) => {
    switch (type) {
      case 'color':
        setBackgroundConfig({ type: 'color', color: '#1a1a2e' })
        break
      case 'image':
        setBackgroundConfig({ type: 'image', url: '' })
        break
      case 'skybox':
        setBackgroundConfig({ type: 'skybox', urls: ['', '', '', '', '', ''] })
        break
      case 'hdr':
        setBackgroundConfig({ type: 'hdr', url: '' })
        break
    }
  }, [setBackgroundConfig])

  const handleColorChange = useCallback((_: any, color: any) => {
    const hex = typeof color === 'string' ? color : color?.toHexString?.() ?? '#1a1a2e'
    setBackgroundConfig({ type: 'color', color: hex })
  }, [setBackgroundConfig])

  const handleImageUrlChange = useCallback((url: string) => {
    setBackgroundConfig({ type: 'image', url })
  }, [setBackgroundConfig])

  const handleHdrUrlChange = useCallback((url: string) => {
    setBackgroundConfig({ type: 'hdr', url })
  }, [setBackgroundConfig])

  const handleUpload = useCallback(async (file: File, onComplete: (url: string) => void) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await uploadFile(formData)
      onComplete(result.url)
      message.success('上传成功')
    } catch {
      message.error('上传失败')
    }
    setUploading(false)
  }, [])

  return (
    <div style={{ padding: '4px 8px' }}>
      <div style={{
        padding: '8px 4px 6px',
        fontSize: 12,
        fontWeight: 600,
        color: token.colorTextSecondary,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}>
        场景设置
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>背景类型</div>
        <Select
          size="small"
          value={currentType}
          onChange={handleTypeChange}
          options={BG_TYPE_OPTIONS}
          style={{ width: '100%' }}
        />
      </div>

      {currentType === 'color' && backgroundConfig?.type === 'color' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>背景颜色</div>
          <ColorPicker
            size="small"
            value={backgroundConfig.color}
            onChangeComplete={handleColorChange}
          />
        </div>
      )}

      {currentType === 'image' && backgroundConfig?.type === 'image' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>图片 URL</div>
          <Input
            size="small"
            value={backgroundConfig.url}
            onChange={(e) => handleImageUrlChange(e.target.value)}
            placeholder="输入图片 URL"
          />
          <Upload
            showUploadList={false}
            accept="image/*"
            beforeUpload={(file) => {
              handleUpload(file, (url) => handleImageUrlChange(url))
              return false
            }}
          >
            <Button size="small" loading={uploading} style={{ marginTop: 4 }} block>
              <Icon icon="lucide:upload" width={12} /> 上传图片
            </Button>
          </Upload>
        </div>
      )}

      {currentType === 'hdr' && backgroundConfig?.type === 'hdr' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>HDR 文件 URL</div>
          <Input
            size="small"
            value={backgroundConfig.url}
            onChange={(e) => handleHdrUrlChange(e.target.value)}
            placeholder="输入 HDR 文件 URL"
          />
          <Upload
            showUploadList={false}
            accept=".hdr,.exr"
            beforeUpload={(file) => {
              handleUpload(file, (url) => handleHdrUrlChange(url))
              return false
            }}
          >
            <Button size="small" loading={uploading} style={{ marginTop: 4 }} block>
              <Icon icon="lucide:upload" width={12} /> 上传 HDR
            </Button>
          </Upload>
        </div>
      )}

      {currentType === 'skybox' && backgroundConfig?.type === 'skybox' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>
            天空盒图片（顺序：+X -X +Y -Y +Z -Z）
          </div>
          {['+X', '-X', '+Y', '-Y', '+Z', '-Z'].map((label, i) => (
            <div key={label} style={{ marginBottom: 4 }}>
              <Input
                size="small"
                value={backgroundConfig.urls[i]}
                onChange={(e) => {
                  const newUrls = [...backgroundConfig.urls] as [string, string, string, string, string, string]
                  newUrls[i] = e.target.value
                  setBackgroundConfig({ type: 'skybox', urls: newUrls })
                }}
                placeholder={`${label} 图片 URL`}
                addonBefore={<span style={{ fontSize: 10 }}>{label}</span>}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
