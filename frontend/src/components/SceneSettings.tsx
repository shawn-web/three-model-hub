import { useState, useCallback } from 'react'
import { Select, ColorPicker, Input, Button, Slider, Switch, theme } from 'antd'
import type { Color } from 'antd/es/color-picker'
import { useEditStore } from '../store/edit-store'
import { ResourcePicker } from './ResourcePicker'
import { SectionTitle } from './EditPanel'
import type { ResourceItem } from '../types/resource'

type BackgroundType = 'color' | 'image' | 'skybox'

const BG_TYPE_OPTIONS = [
  { value: 'color', label: '纯色' },
  { value: 'image', label: '图片' },
  { value: 'skybox', label: '天空盒' },
]

export function SceneSettings() {
  const backgroundConfig = useEditStore((s) => s.backgroundConfig)
  const setBackgroundConfig = useEditStore((s) => s.setBackgroundConfig)
  const lightIntensity = useEditStore((s) => s.lightIntensity)
  const setLightIntensity = useEditStore((s) => s.setLightIntensity)
  const lightColor = useEditStore((s) => s.lightColor)
  const setLightColor = useEditStore((s) => s.setLightColor)
  const gridVisible = useEditStore((s) => s.gridVisible)
  const setGridVisible = useEditStore((s) => s.setGridVisible)
  const autoRotate = useEditStore((s) => s.autoRotate)
  const setAutoRotate = useEditStore((s) => s.setAutoRotate)
  const autoRotateAxis = useEditStore((s) => s.autoRotateAxis)
  const setAutoRotateAxis = useEditStore((s) => s.setAutoRotateAxis)
  const autoRotateSpeed = useEditStore((s) => s.autoRotateSpeed)
  const setAutoRotateSpeed = useEditStore((s) => s.setAutoRotateSpeed)
  const [bgPickerOpen, setBgPickerOpen] = useState(false)
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
        setBackgroundConfig({ type: 'skybox' })
        break
    }
  }, [setBackgroundConfig])

  const handleColorChange = useCallback((color: Color | string) => {
    const hex = typeof color === 'string' ? color : color?.toHexString?.() ?? '#1a1a2e'
    setBackgroundConfig({ type: 'color', color: hex })
  }, [setBackgroundConfig])

  const handleImageUrlChange = useCallback((url: string) => {
    setBackgroundConfig({ type: 'image', url })
  }, [setBackgroundConfig])

  const handleBgResourceSelect = useCallback((resources: ResourceItem[]) => {
    if (resources.length > 0) {
      setBackgroundConfig({ type: 'image', url: resources[0].url })
    }
  }, [setBackgroundConfig])

  return (
    <>
      <SectionTitle title="场景设置" />

      {/* 背景设置 */}
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
          <Button
            size="small"
            style={{ marginTop: 4 }}
            block
            onClick={() => setBgPickerOpen(true)}
          >
            从资源库选择
          </Button>
          <ResourcePicker
            open={bgPickerOpen}
            onClose={() => setBgPickerOpen(false)}
            onSelect={handleBgResourceSelect}
            typeFilter="image"
            allowUpload
          />
        </div>
      )}

      {currentType === 'skybox' && backgroundConfig?.type === 'skybox' && (
        <div style={{ marginTop: 8 }}>
          <div style={{
            fontSize: 11,
            color: token.colorTextSecondary,
            padding: '6px 8px',
            background: token.colorFillQuaternary,
            borderRadius: 4,
          }}>
            已启用程序化天空盒背景
          </div>
        </div>
      )}

      {/* 其他场景设置 */}
      <div style={{
        marginTop: 12,
        paddingTop: 8,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: token.colorTextTertiary }}>显示网格</span>
          <Switch
            size="small"
            checked={gridVisible}
            onChange={setGridVisible}
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>
            方向光强度 <span style={{ float: 'right' }}>{lightIntensity.toFixed(1)}</span>
          </div>
          <Slider
            min={0}
            max={10}
            step={0.1}
            value={lightIntensity}
            onChange={(v) => {
              setLightIntensity(v as number)
              useEditStore.getState().setIsDirty(true)
            }}
            styles={{ track: { background: token.colorPrimary } }}
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>光照颜色</div>
          <ColorPicker
            size="small"
            value={lightColor}
            onChangeComplete={(color: Color | string) => {
              const hex = typeof color === 'string' ? color : color?.toHexString?.() ?? '#ffffff'
              setLightColor(hex)
              useEditStore.getState().setIsDirty(true)
            }}
          />
        </div>

        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: token.colorTextTertiary }}>自动旋转</span>
          <Switch
            size="small"
            checked={autoRotate}
            onChange={(checked) => {
              setAutoRotate(checked)
              useEditStore.getState().setIsDirty(true)
            }}
          />
        </div>

        {autoRotate && (
          <>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>旋转轴</div>
              <Select
                size="small"
                value={autoRotateAxis}
                onChange={(v) => setAutoRotateAxis(v)}
                options={[
                  { value: 'x', label: 'X 轴' },
                  { value: 'y', label: 'Y 轴（默认）' },
                  { value: 'z', label: 'Z 轴' },
                ]}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>
                旋转速度 <span style={{ float: 'right' }}>{autoRotateSpeed.toFixed(1)}</span>
              </div>
              <Slider
                min={0.5}
                max={10}
                step={0.5}
                value={autoRotateSpeed}
                onChange={(v) => {
                  setAutoRotateSpeed(v as number)
                }}
                styles={{ track: { background: token.colorPrimary } }}
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}
