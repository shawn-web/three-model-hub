import { useCallback, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { Input, Slider, ColorPicker, Empty, theme, Button, Image } from 'antd'
import { ResourcePicker } from './ResourcePicker'
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
  const [mapUrl, setMapUrl] = useState<string | null>(null)
  const [normalMapUrl, setNormalMapUrl] = useState<string | null>(null)
  const [roughnessMapUrl, setRoughnessMapUrl] = useState<string | null>(null)
  const [metalnessMapUrl, setMetalnessMapUrl] = useState<string | null>(null)
  const [emissiveMapUrl, setEmissiveMapUrl] = useState<string | null>(null)
  const [texturePickerTarget, setTexturePickerTarget] = useState<string | null>(null)
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
      setMapUrl(null)
      setNormalMapUrl(null)
      setRoughnessMapUrl(null)
      setMetalnessMapUrl(null)
      setEmissiveMapUrl(null)
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
      if (data?.mapUrl !== undefined) setMapUrl(data.mapUrl)
      else setMapUrl(null)
      if (data?.normalMapUrl !== undefined) setNormalMapUrl(data.normalMapUrl)
      else setNormalMapUrl(null)
      if (data?.roughnessMapUrl !== undefined) setRoughnessMapUrl(data.roughnessMapUrl)
      else setRoughnessMapUrl(null)
      if (data?.metalnessMapUrl !== undefined) setMetalnessMapUrl(data.metalnessMapUrl)
      else setMetalnessMapUrl(null)
      if (data?.emissiveMapUrl !== undefined) setEmissiveMapUrl(data.emissiveMapUrl)
      else setEmissiveMapUrl(null)
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
    if (hasMesh) {
      const meshes: THREE.Mesh[] = []
      selectedObj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh)
      })
      const loader = new THREE.TextureLoader()
      loader.setCrossOrigin('anonymous')

      for (const mesh of meshes) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const m of materials) {
          const mat = m as THREE.MeshStandardMaterial
          mat.color.set(color)
          mat.transparent = true
          mat.opacity = opacity / 100

          const texChannels: Array<{
            url: string | null
            mapKey: keyof Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'emissiveMap'>
            origKey: string
          }> = [
            { url: mapUrl, mapKey: 'map', origKey: '_originalMap' },
            { url: normalMapUrl, mapKey: 'normalMap', origKey: '_originalNormalMap' },
            { url: roughnessMapUrl, mapKey: 'roughnessMap', origKey: '_originalRoughnessMap' },
            { url: metalnessMapUrl, mapKey: 'metalnessMap', origKey: '_originalMetalnessMap' },
            { url: emissiveMapUrl, mapKey: 'emissiveMap', origKey: '_originalEmissiveMap' },
          ]

          for (const { url, mapKey, origKey } of texChannels) {
            if (url) {
              if (!mat.userData[origKey]) mat.userData[origKey] = mat[mapKey]
              const tex = loader.load(
                url,
                () => { mat.needsUpdate = true },
                undefined,
                (err) => { console.error(`[Texture] 加载 ${mapKey} 失败:`, url, err) },
              )
              if (mapKey === 'map') tex.colorSpace = THREE.SRGBColorSpace
              mat[mapKey] = tex
              mat.needsUpdate = true
            } else if (url === '') {
              mat[mapKey] = mat.userData[origKey] ?? null
              delete mat.userData[origKey]
              mat.needsUpdate = true
            }
          }
        }

        const mgr = useEditStore.getState().highlightManager
        if (mgr) {
          mgr.syncToOriginalMaterial(mesh, {
            color, opacity: opacity / 100,
            mapUrl, normalMapUrl, roughnessMapUrl, metalnessMapUrl, emissiveMapUrl,
          })
        }
      }
      updateComponentMaterial(selectedComponentId, {
        color, opacity: opacity / 100,
        ...(mapUrl !== null ? { mapUrl } : {}),
        ...(normalMapUrl !== null ? { normalMapUrl } : {}),
        ...(roughnessMapUrl !== null ? { roughnessMapUrl } : {}),
        ...(metalnessMapUrl !== null ? { metalnessMapUrl } : {}),
        ...(emissiveMapUrl !== null ? { emissiveMapUrl } : {}),
      })
    }
  }, [selectedComponentId, selectedObj, alias, description, posX, posY, posZ, rotX, rotY, rotZ, scaleX, scaleY, scaleZ, color, opacity, mapUrl, normalMapUrl, roughnessMapUrl, metalnessMapUrl, emissiveMapUrl, hasMesh, updateComponentName, updateComponentDescription, updateComponentTransform, updateComponentMaterial])

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
    <>
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

        <div style={{ marginTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 8 }}>
          <div style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 4 }}>贴图设置</div>
          {([
            { label: '漫反射贴图', value: mapUrl, onChange: setMapUrl, key: 'map' },
            { label: '法线贴图', value: normalMapUrl, onChange: setNormalMapUrl, key: 'normalMap' },
            { label: '粗糙度贴图', value: roughnessMapUrl, onChange: setRoughnessMapUrl, key: 'roughnessMap' },
            { label: '金属度贴图', value: metalnessMapUrl, onChange: setMetalnessMapUrl, key: 'metalnessMap' },
            { label: '自发光贴图', value: emissiveMapUrl, onChange: setEmissiveMapUrl, key: 'emissiveMap' },
          ] as const).map(({ label, value, onChange, key }) => (
            <div key={key} style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 70, fontSize: 11, color: token.colorTextSecondary, flexShrink: 0 }}>{label}</div>
              {value ? (
                <Image
                  src={value}
                  width={32}
                  height={32}
                  style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                  preview={{ mask: null as unknown as React.ReactNode }}
                />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                  background: token.colorFillQuaternary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={token.colorTextQuaternary} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                </div>
              )}
              <Button size="small" onClick={() => setTexturePickerTarget(key)}>选择</Button>
              {value && (
                <Button size="small" danger onClick={() => onChange('')}>×</Button>
              )}
            </div>
          ))}
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
      {texturePickerTarget && (
        <ResourcePicker
          open={texturePickerTarget !== null}
          onClose={() => setTexturePickerTarget(null)}
          typeFilter="image"
          multiple={false}
          allowUpload={true}
          onSelect={(items) => {
            if (items.length > 0) {
              const url = items[0].url
              switch (texturePickerTarget) {
                case 'map': setMapUrl(url); break
                case 'normalMap': setNormalMapUrl(url); break
                case 'roughnessMap': setRoughnessMapUrl(url); break
                case 'metalnessMap': setMetalnessMapUrl(url); break
                case 'emissiveMap': setEmissiveMapUrl(url); break
              }
            }
            setTexturePickerTarget(null)
          }}
        />
      )}
  </>
  )
})
