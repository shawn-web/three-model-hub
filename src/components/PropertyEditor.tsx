import { useEditStore } from '../store/edit-store'
import * as THREE from 'three'

export function PropertyEditor() {
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const modelObject = useEditStore((s) => s.modelObject)
  const editData = useEditStore((s) => s.editData)
  const updateComponentTransform = useEditStore((s) => s.updateComponentTransform)
  const updateComponentMaterial = useEditStore((s) => s.updateComponentMaterial)
  const updateComponentVisibility = useEditStore((s) => s.updateComponentVisibility)

  if (!selectedComponentId || !modelObject) return null

  const obj = modelObject.getObjectByProperty('uuid', selectedComponentId) as THREE.Object3D | undefined
  if (!obj) return null

  const data = editData[selectedComponentId]
  const position = data?.position ?? obj.position.toArray() as [number, number, number]
  const rotation = data?.rotation ?? [obj.rotation.x, obj.rotation.y, obj.rotation.z] as [number, number, number]
  const scale = data?.scale ?? obj.scale.toArray() as [number, number, number]
  const color = data?.color
  const opacity = data?.opacity ?? 1
  const visible = data?.visible ?? obj.visible

  const handlePositionChange = (axis: number, value: string) => {
    const v = parseFloat(value) || 0
    const newPos = [...position] as [number, number, number]
    newPos[axis] = v
    obj.position.set(...newPos)
    updateComponentTransform(selectedComponentId, { position: newPos })
  }

  const handleRotationChange = (axis: number, value: string) => {
    const v = parseFloat(value) || 0
    const newRot = [...rotation] as [number, number, number]
    newRot[axis] = v
    obj.rotation.set(...newRot)
    updateComponentTransform(selectedComponentId, { rotation: newRot })
  }

  const handleScaleChange = (axis: number, value: string) => {
    const v = parseFloat(value) || 1
    const newScale = [...scale] as [number, number, number]
    newScale[axis] = v
    obj.scale.set(...newScale)
    updateComponentTransform(selectedComponentId, { scale: newScale })
  }

  const handleColorChange = (value: string) => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((m) => {
          const mat = m as THREE.MeshStandardMaterial
          if (!mat.userData._originalColor) {
            mat.userData._originalColor = '#' + mat.color.getHexString()
          }
          mat.color.set(value)
        })
      }
    })
    updateComponentMaterial(selectedComponentId, { color: value })
  }

  const handleOpacityChange = (value: number) => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((m) => {
          m.transparent = value < 1
          m.opacity = value
          m.needsUpdate = true
        })
      }
    })
    updateComponentMaterial(selectedComponentId, { opacity: value })
  }

  const handleVisibilityChange = (v: boolean) => {
    obj.visible = v
    updateComponentVisibility(selectedComponentId, v)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4, padding: '4px 8px', color: '#ddd', fontSize: 12, outline: 'none',
  }

  const labelStyle: React.CSSProperties = { color: '#888', fontSize: 11, marginBottom: 4 }

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: '#4a9eff' }}>
        {obj.name || obj.type}
      </div>

      {/* Transform */}
      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>位置</div>
        {(['X', 'Y', 'Z'] as const).map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ color: '#666', fontSize: 11, width: 12 }}>{label}</span>
            <input type="number" step="0.1" value={position[i].toFixed(2)}
              onChange={(e) => handlePositionChange(i, e.target.value)} style={inputStyle} />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>旋转 (度)</div>
        {(['X', 'Y', 'Z'] as const).map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ color: '#666', fontSize: 11, width: 12 }}>{label}</span>
            <input type="number" step="1" value={(rotation[i] * 180 / Math.PI).toFixed(1)}
              onChange={(e) => handleRotationChange(i, (parseFloat(e.target.value) * Math.PI / 180).toString())} style={inputStyle} />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>缩放</div>
        {(['X', 'Y', 'Z'] as const).map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ color: '#666', fontSize: 11, width: 12 }}>{label}</span>
            <input type="number" step="0.1" value={scale[i].toFixed(2)}
              onChange={(e) => handleScaleChange(i, e.target.value)} style={inputStyle} />
          </div>
        ))}
      </div>

      {/* Material */}
      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>颜色</div>
        <input type="color" value={color || '#ffffff'}
          onChange={(e) => handleColorChange(e.target.value)}
          style={{ width: '100%', height: 32, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>透明度: {(opacity * 100).toFixed(0)}%</div>
        <input type="range" min="0" max="1" step="0.01" value={opacity}
          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
          style={{ width: '100%' }} />
      </div>

      {/* Visibility */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={labelStyle}>可见</span>
        <button onClick={() => handleVisibilityChange(!visible)} style={{
          background: visible ? 'rgba(74, 158, 255, 0.8)' : 'rgba(255,255,255,0.1)',
          border: 'none', borderRadius: 4, padding: '4px 12px', color: '#fff', fontSize: 12, cursor: 'pointer',
        }}>
          {visible ? '显示' : '隐藏'}
        </button>
      </div>
    </div>
  )
}
