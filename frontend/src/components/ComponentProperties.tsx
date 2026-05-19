import { useCallback, useEffect, useState } from 'react'
import { Input, Slider, ColorPicker, Empty, theme } from 'antd'
import * as THREE from 'three'
import { useEditStore } from '../store/edit-store'

/**
 * 构件属性面板
 * 选中构件后显示属性信息，支持材质编辑和描述
 */
export function ComponentProperties() {
  const modelObject = useEditStore((s) => s.modelObject)
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const updateComponentMaterial = useEditStore((s) => s.updateComponentMaterial)
  const { token } = theme.useToken()

  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null)
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!modelObject || !selectedComponentId) {
      setSelectedObj(null)
      return
    }
    let found: THREE.Object3D | null = null
    modelObject.traverse((child) => {
      if (child.uuid === selectedComponentId) found = child
    })
    setSelectedObj(found)
  }, [modelObject, selectedComponentId])

  const meshMaterial = (() => {
    if (!selectedObj || !(selectedObj instanceof THREE.Mesh)) return null
    const mat = selectedObj.material
    if (Array.isArray(mat)) return mat[0] as THREE.MeshStandardMaterial
    return mat as THREE.MeshStandardMaterial
  })()

  const handleColorChange = useCallback((_: any, color: any) => {
    if (!selectedComponentId || !meshMaterial) return
    const hex = typeof color === 'string' ? color : color?.toHexString?.() ?? '#ffffff'
    updateComponentMaterial(selectedComponentId, { color: hex, opacity: undefined })
    meshMaterial.color.set(hex)
  }, [selectedComponentId, meshMaterial, updateComponentMaterial])

  const handleOpacityChange = useCallback((value: number) => {
    if (!selectedComponentId || !meshMaterial) return
    updateComponentMaterial(selectedComponentId, { color: undefined, opacity: value / 100 })
    meshMaterial.transparent = true
    meshMaterial.opacity = value / 100
  }, [selectedComponentId, meshMaterial, updateComponentMaterial])

  if (!selectedComponentId) {
    return (
      <div style={{ padding: '12px 8px', textAlign: 'center' }}>
        <Empty
          description="请选择一个构件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ fontSize: 11 }}
        />
      </div>
    )
  }

  if (!selectedObj) return null

  return (
    <div style={{ padding: '4px 8px' }}>
      <div style={{
        padding: '8px 4px 6px',
        fontSize: 12,
        fontWeight: 600,
        color: token.colorTextSecondary,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}>
        构件属性
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 2 }}>名称</div>
        <div style={{ fontSize: 12, color: token.colorText }}>{selectedObj.name || '(未命名)'}</div>
      </div>

      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 2 }}>类型</div>
        <div style={{ fontSize: 12, color: token.colorText }}>{selectedObj.type}</div>
      </div>

      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 2 }}>位置</div>
        <div style={{ fontSize: 11, color: token.colorTextSecondary, fontFamily: 'monospace' }}>
          X: {selectedObj.position.x.toFixed(3)} Y: {selectedObj.position.y.toFixed(3)} Z: {selectedObj.position.z.toFixed(3)}
        </div>
      </div>

      {meshMaterial && (
        <>
          <div style={{ marginTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>颜色</div>
            <ColorPicker
              size="small"
              value={meshMaterial.color.getStyle()}
              onChangeComplete={handleColorChange}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>
              透明度: {Math.round((meshMaterial.opacity ?? 1) * 100)}%
            </div>
            <Slider
              min={0}
              max={100}
              value={Math.round((meshMaterial.opacity ?? 1) * 100)}
              onChange={handleOpacityChange}
              size="small"
            />
          </div>
        </>
      )}

      <div style={{ marginTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 8 }}>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>描述</div>
        <Input.TextArea
          size="small"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="添加构件描述..."
          rows={2}
          maxLength={200}
        />
      </div>
    </div>
  )
}
