import { useCallback, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { Input, Slider, ColorPicker, Empty, theme } from 'antd'
import * as THREE from 'three'
import { useEditStore } from '../store/edit-store'

export interface ComponentPropertiesRef {
  save: () => void
}

/**
 * 构件属性面板（弹窗内使用）
 * 所有修改暂存在本地状态，调用 save() 时统一写入 store
 */
export const ComponentProperties = forwardRef<ComponentPropertiesRef>(function ComponentProperties(_props, ref) {
  const modelObject = useEditStore((s) => s.modelObject)
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const editData = useEditStore((s) => s.editData)
  const updateComponentMaterial = useEditStore((s) => s.updateComponentMaterial)
  const updateComponentDescription = useEditStore((s) => s.updateComponentDescription)
  const updateComponentName = useEditStore((s) => s.updateComponentName)
  const updateComponentTransform = useEditStore((s) => s.updateComponentTransform)
  const { token } = theme.useToken()

  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null)
  const [alias, setAlias] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>('#ffffff')
  const [opacity, setOpacity] = useState(100)
  const [posX, setPosX] = useState('0')
  const [posY, setPosY] = useState('0')
  const [posZ, setPosZ] = useState('0')
  const [rotX, setRotX] = useState('0')
  const [rotY, setRotY] = useState('0')
  const [rotZ, setRotZ] = useState('0')
  const [scaleX, setScaleX] = useState('1')
  const [scaleY, setScaleY] = useState('1')
  const [scaleZ, setScaleZ] = useState('1')
  const [hasMesh, setHasMesh] = useState(false)

  // 当选中构件变化时，从对象和 editData 恢复状态
  useEffect(() => {
    if (!modelObject || !selectedComponentId) {
      setSelectedObj(null)
      setAlias('')
      setDescription('')
      setColor('#ffffff')
      setOpacity(100)
      setPosX('0')
      setPosY('0')
      setPosZ('0')
      setRotX('0')
      setRotY('0')
      setRotZ('0')
      setScaleX('1')
      setScaleY('1')
      setScaleZ('1')
      setHasMesh(false)
      return
    }
    let found: THREE.Object3D | null = null
    modelObject.traverse((child) => {
      if (child.uuid === selectedComponentId) found = child
    })
    setSelectedObj(found)
    if (!found) return

    const data = editData[selectedComponentId]

    // 恢复别名
    if (data?.name) setAlias(data.name)
    else if (found.name) setAlias(found.name)
    else setAlias('')

    // 恢复描述
    if (data?.description !== undefined) setDescription(data.description)
    else if (found.userData?.description) setDescription(found.userData.description)
    else setDescription('')

    // 恢复位置
    const pos = data?.position || found.position.toArray()
    setPosX(pos[0].toFixed(3))
    setPosY(pos[1].toFixed(3))
    setPosZ(pos[2].toFixed(3))

    // 恢复旋转
    const rot = data?.rotation || [found.rotation.x, found.rotation.y, found.rotation.z]
    setRotX((rot[0] * 180 / Math.PI).toFixed(1))
    setRotY((rot[1] * 180 / Math.PI).toFixed(1))
    setRotZ((rot[2] * 180 / Math.PI).toFixed(1))

    // 恢复缩放
    const scl = data?.scale || found.scale.toArray()
    setScaleX(scl[0].toFixed(3))
    setScaleY(scl[1].toFixed(3))
    setScaleZ(scl[2].toFixed(3))

    // 恢复材质
    const mesh = found instanceof THREE.Mesh ? found as THREE.Mesh : null
    if (mesh) {
      const mat = Array.isArray(mesh.material) ? mesh.material[0] as THREE.MeshStandardMaterial : mesh.material as THREE.MeshStandardMaterial
      setColor(mat.color.getStyle())
      setOpacity(Math.round((mat.opacity ?? 1) * 100))
      setHasMesh(true)
    } else {
      setHasMesh(false)
    }
  }, [modelObject, selectedComponentId, editData])

  /** 统一保存所有编辑到 store */
  const save = useCallback(() => {
    if (!selectedComponentId || !selectedObj) return

    // 保存名称
    updateComponentName(selectedComponentId, alias || null)
    // 保存描述
    updateComponentDescription(selectedComponentId, description || null)
    // 保存位置
    const x = parseFloat(posX) || 0
    const y = parseFloat(posY) || 0
    const z = parseFloat(posZ) || 0
    selectedObj.position.set(x, y, z)
    // 保存旋转（度 → 弧度）
    const rx = (parseFloat(rotX) || 0) * Math.PI / 180
    const ry = (parseFloat(rotY) || 0) * Math.PI / 180
    const rz = (parseFloat(rotZ) || 0) * Math.PI / 180
    selectedObj.rotation.set(rx, ry, rz)
    // 保存缩放
    const sx = parseFloat(scaleX) || 1
    const sy = parseFloat(scaleY) || 1
    const sz = parseFloat(scaleZ) || 1
    selectedObj.scale.set(sx, sy, sz)
    updateComponentTransform(selectedComponentId, {
      position: [x, y, z],
      rotation: [rx, ry, rz],
      scale: [sx, sy, sz],
    })
    // 保存材质
    if (hasMesh && selectedObj instanceof THREE.Mesh) {
      const mat = Array.isArray(selectedObj.material) ? selectedObj.material[0] as THREE.MeshStandardMaterial : selectedObj.material as THREE.MeshStandardMaterial
      mat.color.set(color)
      mat.transparent = true
      mat.opacity = opacity / 100
      // 同步更新高亮前的原始材质，避免重新选中时颜色丢失
      const mgr = useEditStore.getState().highlightManager
      if (mgr) {
        mgr.syncToOriginalMaterial(selectedObj, { color, opacity: opacity / 100 })
      }
      updateComponentMaterial(selectedComponentId, { color, opacity: opacity / 100 })
    }
  }, [selectedComponentId, selectedObj, alias, description, posX, posY, posZ, rotX, rotY, rotZ, scaleX, scaleY, scaleZ, color, opacity, hasMesh, updateComponentName, updateComponentDescription, updateComponentTransform, updateComponentMaterial])

  useImperativeHandle(ref, () => ({ save }), [save])

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
        <Input
          size="small"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="输入别名..."
          maxLength={100}
        />
      </div>

      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 2 }}>类型</div>
        <div style={{ fontSize: 12, color: token.colorText }}>{selectedObj.type}</div>
      </div>

      <div style={{ marginTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 8 }}>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>位置</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: token.colorTextQuaternary, marginBottom: 2 }}>X</div>
            <Input size="small" value={posX} onChange={(e) => setPosX(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: token.colorTextQuaternary, marginBottom: 2 }}>Y</div>
            <Input size="small" value={posY} onChange={(e) => setPosY(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: token.colorTextQuaternary, marginBottom: 2 }}>Z</div>
            <Input size="small" value={posZ} onChange={(e) => setPosZ(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 8 }}>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>旋转 (度)</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: token.colorTextQuaternary, marginBottom: 2 }}>X</div>
            <Input size="small" value={rotX} onChange={(e) => setRotX(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: token.colorTextQuaternary, marginBottom: 2 }}>Y</div>
            <Input size="small" value={rotY} onChange={(e) => setRotY(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: token.colorTextQuaternary, marginBottom: 2 }}>Z</div>
            <Input size="small" value={rotZ} onChange={(e) => setRotZ(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 8 }}>
        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>缩放</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: token.colorTextQuaternary, marginBottom: 2 }}>X</div>
            <Input size="small" value={scaleX} onChange={(e) => setScaleX(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: token.colorTextQuaternary, marginBottom: 2 }}>Y</div>
            <Input size="small" value={scaleY} onChange={(e) => setScaleY(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: token.colorTextQuaternary, marginBottom: 2 }}>Z</div>
            <Input size="small" value={scaleZ} onChange={(e) => setScaleZ(e.target.value)} />
          </div>
        </div>
      </div>

      {hasMesh && (
        <>
          <div style={{ marginTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>颜色</div>
            <ColorPicker
              size="small"
              value={color}
              onChange={(c: string | { toHexString: () => string }) => {
                const hex = typeof c === 'string' ? c : c?.toHexString?.() ?? '#ffffff'
                setColor(hex)
              }}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>
              透明度: {opacity}%
            </div>
            <Slider
              min={0}
              max={100}
              value={opacity}
              onChange={setOpacity}
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
})
