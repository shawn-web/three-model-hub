import * as THREE from 'three'

/** 组件编辑数据结构 */
interface ComponentEditRaw {
  version?: number
  backgroundColor?: string
  autoRotate?: boolean
  markers?: unknown[]
  components?: Record<string, {
    name?: string | null
    description?: string | null
    transform?: {
      position: [number, number, number]
      rotation: [number, number, number]
      scale: [number, number, number]
    }
    material?: {
      color?: string
      opacity?: number | null
      mapUrl?: string | null
      normalMapUrl?: string | null
      roughnessMapUrl?: string | null
      metalnessMapUrl?: string | null
      emissiveMapUrl?: string | null
    }
    visible?: boolean
  }>
}

export function applyEditData(model: THREE.Group, editData: ComponentEditRaw): void {
  // 兼容 version 1 格式：补充缺失的新字段
  if (!editData.version || editData.version === 1) {
    editData.backgroundColor = editData.backgroundColor || '#1a1a2e'
    editData.autoRotate = editData.autoRotate || false
    editData.markers = editData.markers || []
    const comps = editData.components || {}
    Object.keys(comps).forEach((key) => {
      const edit = comps[key]
      if (!edit.name) edit.name = null
      if (!edit.description) edit.description = null
    })
  }

  // 应用背景颜色
  if (editData.backgroundColor && model.parent) {
    const scene = model.parent
    if (scene instanceof THREE.Scene) {
      scene.background = new THREE.Color(editData.backgroundColor)
    }
  }

  // 应用组件编辑
  for (const [key, editRaw] of Object.entries(editData.components!)) {
    const edit = editRaw
    let target: THREE.Object3D | null = model.getObjectByProperty('uuid', key) ?? null
    if (!target) {
      target = model.getObjectByName(key) ?? null
    }
    if (!target) {
      console.warn(`[EditApply] Component not found: ${key}`)
      continue
    }

    if (edit.name) {
      target.name = edit.name
    }

    if (edit.transform) {
      const [px, py, pz] = edit.transform.position
      const [rx, ry, rz] = edit.transform.rotation
      const [sx, sy, sz] = edit.transform.scale
      target.position.set(px, py, pz)
      target.rotation.set(rx, ry, rz)
      target.scale.set(sx, sy, sz)
    }

    if (edit.material) {
      target.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((m) => {
            const mat = m as THREE.MeshStandardMaterial
            if (edit.material!.color) {
              if (!mat.userData._originalColor) {
                mat.userData._originalColor = mat.color.getHexString()
              }
              mat.color.set(edit.material!.color)
            }
            if (edit.material!.opacity !== null && edit.material!.opacity !== undefined) {
              if (mat.userData._originalOpacity === undefined) {
                mat.userData._originalOpacity = mat.opacity
              }
              mat.transparent = edit.material!.opacity < 1
              mat.opacity = edit.material!.opacity
              mat.needsUpdate = true
            }
            // 贴图恢复
            const loader = new THREE.TextureLoader()
            loader.setCrossOrigin('anonymous')
            const texChannels: Array<{
              url: string | null | undefined
              mapKey: keyof Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'emissiveMap'>
              origKey: string
            }> = [
              { url: edit.material!.mapUrl, mapKey: 'map', origKey: '_originalMap' },
              { url: edit.material!.normalMapUrl, mapKey: 'normalMap', origKey: '_originalNormalMap' },
              { url: edit.material!.roughnessMapUrl, mapKey: 'roughnessMap', origKey: '_originalRoughnessMap' },
              { url: edit.material!.metalnessMapUrl, mapKey: 'metalnessMap', origKey: '_originalMetalnessMap' },
              { url: edit.material!.emissiveMapUrl, mapKey: 'emissiveMap', origKey: '_originalEmissiveMap' },
            ]
            for (const { url, mapKey, origKey } of texChannels) {
              if (url) {
                if (!mat.userData[origKey]) mat.userData[origKey] = mat[mapKey]
                const tex = loader.load(url)
                if (mapKey === 'map') tex.colorSpace = THREE.SRGBColorSpace
                mat[mapKey] = tex
                mat.needsUpdate = true
              } else if (url === '') {
                mat[mapKey] = null
                mat.needsUpdate = true
              }
            }
          })
        }
      })
    }

    if (edit.visible !== undefined) {
      target.visible = edit.visible
    }
  }
}
