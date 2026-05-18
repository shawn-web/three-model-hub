import * as THREE from 'three'
import type { EditData } from '../types/edit-data'

export function applyEditData(model: THREE.Group, editData: EditData): void {
  for (const [key, edit] of Object.entries(editData.components)) {
    let target: THREE.Object3D | null = model.getObjectByProperty('uuid', key) ?? null
    if (!target) {
      target = model.getObjectByName(key) ?? null
    }
    if (!target) {
      console.warn(`[EditApply] Component not found: ${key}`)
      continue
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
          })
        }
      })
    }

    if (edit.visible !== undefined) {
      target.visible = edit.visible
    }
  }
}
