import * as THREE from 'three'

/** 可设置 emissive 的材质类型 */
type EmissiveMaterial = THREE.Material & { emissive?: THREE.Color; emissiveIntensity?: number }
/** 可设置 opacity 的材质类型 */
type OpacityMaterial = THREE.Material & { opacity?: number; transparent?: boolean }

/** 高亮颜色（青色） */
const HIGHLIGHT_COLOR = new THREE.Color(0x00e5ff)
const HIGHLIGHT_EMISSIVE_INTENSITY = 0.5

/** 透视模式下的半透明不透明度 */
const XRAY_OPACITY = 0.15

/** 保存所有被修改过的材质，用于恢复 */
export class SelectionHighlightManager {
  /** 被 emissive 高亮的 mesh → 原始材质 */
  private highlightedMeshes = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
  /** 被设为半透明的 mesh → 原始材质 */
  private xrayMeshes = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()

  /** 应用选中高亮（emissive 青色） */
  applyHighlight(modelRoot: THREE.Object3D, selectedId: string | null): void {
    this.clearHighlight()

    if (!selectedId || !modelRoot) return

    const selectedObj = modelRoot.getObjectByProperty('uuid', selectedId)
    if (!selectedObj) return

    // 遍历选中对象及其所有子级中的 Mesh
    const meshes: THREE.Mesh[] = []
    selectedObj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh)
    })

    for (const mesh of meshes) {
      this.highlightedMeshes.set(mesh, mesh.material)
      mesh.material = this.cloneWithEmissive(mesh.material)
      mesh.renderOrder = 1
    }
  }

  /** 应用透视模式（非选中构件变半透明） */
  applyXRay(modelRoot: THREE.Object3D, selectedId: string | null, enabled: boolean): void {
    this.clearXRay()

    if (!enabled || !modelRoot) return

    const selectedObj = selectedId
      ? modelRoot.getObjectByProperty('uuid', selectedId)
      : null

    // 收集选中对象及其所有子级的 uuid
    const selectedUuids = new Set<string>()
    if (selectedObj) {
      selectedUuids.add(selectedObj.uuid)
      selectedObj.traverse((child) => selectedUuids.add(child.uuid))
    }

    // 遍历模型，将非选中的 Mesh 设为半透明
    modelRoot.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      if (selectedUuids.has(child.uuid)) return

      const mesh = child as THREE.Mesh
      // 不修改已经被高亮的 mesh（避免双重克隆）
      if (this.highlightedMeshes.has(mesh)) return

      this.xrayMeshes.set(mesh, mesh.material)
      mesh.material = this.cloneWithTransparency(mesh.material)
      mesh.renderOrder = 0
    })
  }

  /** 获取 mesh 的原始材质（高亮前的材质），如果没有高亮则返回当前材质 */
  getOriginalMaterial(mesh: THREE.Mesh): THREE.Material | THREE.Material[] {
    return this.highlightedMeshes.get(mesh) ?? mesh.material
  }

  /** 同步更新原始材质的颜色/透明度/PBR贴图（在属性面板保存时调用） */
  syncToOriginalMaterial(mesh: THREE.Mesh, updates: {
    color?: string
    opacity?: number
    mapUrl?: string | null
    normalMapUrl?: string | null
    roughnessMapUrl?: string | null
    metalnessMapUrl?: string | null
    emissiveMapUrl?: string | null
  }): void {
    const original = this.highlightedMeshes.get(mesh)
    if (!original) return
    const mats = Array.isArray(original) ? original : [original]
    for (const mat of mats) {
      const m = mat as THREE.MeshStandardMaterial
      if (updates.color && 'color' in m) {
        m.color.set(updates.color)
      }
      if (updates.opacity !== undefined && 'opacity' in m) {
        m.transparent = true
        m.opacity = updates.opacity
      }
      const texChannels: Array<{
        url: string | null | undefined
        mapKey: keyof Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'emissiveMap'>
        origKey: string
      }> = [
        { url: updates.mapUrl, mapKey: 'map', origKey: '_originalMap' },
        { url: updates.normalMapUrl, mapKey: 'normalMap', origKey: '_originalNormalMap' },
        { url: updates.roughnessMapUrl, mapKey: 'roughnessMap', origKey: '_originalRoughnessMap' },
        { url: updates.metalnessMapUrl, mapKey: 'metalnessMap', origKey: '_originalMetalnessMap' },
        { url: updates.emissiveMapUrl, mapKey: 'emissiveMap', origKey: '_originalEmissiveMap' },
      ]
      for (const { url, mapKey, origKey } of texChannels) {
        if (url === undefined || url === null) continue
        if (url) {
          if (!m.userData[origKey]) m.userData[origKey] = m[mapKey]
          const tex = new THREE.TextureLoader().load(url)
          if (mapKey === 'map') tex.colorSpace = THREE.SRGBColorSpace
          m[mapKey] = tex
        } else {
          // url === ''：用户主动清除了贴图
          m[mapKey] = m.userData[origKey] ?? null
        }
        m.needsUpdate = true
      }
    }
  }

  /** 清除所有高亮和透视效果 */
  clearAll(): void {
    this.clearHighlight()
    this.clearXRay()
  }

  /** 清除选中高亮，恢复原始材质 */
  private clearHighlight(): void {
    for (const [mesh, original] of this.highlightedMeshes) {
      this.disposeMaterial(mesh.material)
      mesh.material = original
      mesh.renderOrder = 0
    }
    this.highlightedMeshes.clear()
  }

  /** 清除透视效果，恢复原始材质 */
  private clearXRay(): void {
    for (const [mesh, original] of this.xrayMeshes) {
      this.disposeMaterial(mesh.material)
      mesh.material = original
      mesh.renderOrder = 0
    }
    this.xrayMeshes.clear()
  }

  /** 克隆材质并添加 emissive 高亮 */
  private cloneWithEmissive(material: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
    if (Array.isArray(material)) {
      return material.map((m) => this.applyEmissiveToMaterial(m))
    }
    return this.applyEmissiveToMaterial(material)
  }

  private applyEmissiveToMaterial(mat: THREE.Material): THREE.Material {
    const clone = mat.clone()
    if ('emissive' in clone) {
      (clone as EmissiveMaterial).emissive = HIGHLIGHT_COLOR.clone()
      ;(clone as EmissiveMaterial).emissiveIntensity = HIGHLIGHT_EMISSIVE_INTENSITY
    }
    return clone
  }

  /** 克隆材质并设置为半透明 */
  private cloneWithTransparency(material: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
    if (Array.isArray(material)) {
      return material.map((m) => this.applyTransparencyToMaterial(m))
    }
    return this.applyTransparencyToMaterial(material)
  }

  private applyTransparencyToMaterial(mat: THREE.Material): THREE.Material {
    const clone = mat.clone()
    clone.transparent = true
    clone.depthWrite = true
    clone.side = THREE.DoubleSide
    if ('opacity' in clone) {
      ;(clone as OpacityMaterial).opacity = XRAY_OPACITY
    }
    return clone
  }

  /** 释放克隆的材质 */
  private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose())
    } else {
      material.dispose()
    }
  }
}
