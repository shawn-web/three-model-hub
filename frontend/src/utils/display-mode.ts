/**
 * 显示模式工具函数
 * - 遍历 Object3D 下所有 Mesh，修改材质以实现不同显示效果
 * - 支持：正常着色 / 线框 / 半透明
 * - 修改前将原始材质属性保存到 userData 中，以便恢复
 */

import * as THREE from 'three'

/** 显示模式类型 */
export type DisplayMode = 'shaded' | 'wireframe' | 'transparent'

/** 用于存储原始材质属性的 userData 键名 */
const ORIGINAL_PROPS_KEY = '__originalDisplayProps'

/**
 * 对指定 Object3D 应用显示模式
 * 遍历所有 Mesh 子对象，根据模式修改材质属性
 * @param object - 目标 3D 对象（通常是模型根 Group）
 * @param mode - 显示模式
 */
export function applyDisplayMode(object: THREE.Object3D, mode: DisplayMode): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const mesh = child as THREE.Mesh
    const material = mesh.material
    if (!material) return

    // 处理材质数组的情况
    const materials = Array.isArray(material) ? material : [material]
    for (const mat of materials) {
      if (!(mat instanceof THREE.Material)) continue
      applyModeToMaterial(mat, mode)
    }
  })
}

/**
 * 对单个材质应用显示模式
 * 首先保存原始属性（仅保存一次），然后根据模式设置对应属性
 */
function applyModeToMaterial(material: THREE.Material, mode: DisplayMode): void {
  const mat = material as THREE.MeshStandardMaterial

  // 首次修改时保存原始属性
  if (!(material as any)[ORIGINAL_PROPS_KEY]) {
    ;(material as any)[ORIGINAL_PROPS_KEY] = {
      wireframe: mat.wireframe ?? false,
      transparent: material.transparent,
      opacity: material.opacity,
      depthWrite: material.depthWrite,
    }
  }

  // 先恢复原始状态，再应用新模式（避免属性叠加）
  restoreMaterial(material)

  switch (mode) {
    case 'shaded':
      // restoreMaterial 已恢复
      break
    case 'wireframe':
      mat.wireframe = true
      break
    case 'transparent':
      material.transparent = true
      material.opacity = 0.5
      material.depthWrite = false
      break
  }

  material.needsUpdate = true
}

/**
 * 恢复材质到原始状态
 */
function restoreMaterial(material: THREE.Material): void {
  const original = (material as any)[ORIGINAL_PROPS_KEY]
  if (!original) return

  const mat = material as THREE.MeshStandardMaterial
  mat.wireframe = original.wireframe
  material.transparent = original.transparent
  material.opacity = original.opacity
  material.depthWrite = original.depthWrite
}

/**
 * 清除指定对象上所有材质的原始属性缓存
 * 通常在模型卸载时调用
 */
export function clearDisplayModeCache(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const mesh = child as THREE.Mesh
    const material = mesh.material
    if (!material) return

    const materials = Array.isArray(material) ? material : [material]
    for (const mat of materials) {
      if (!(mat instanceof THREE.Material)) continue
      delete (mat as any)[ORIGINAL_PROPS_KEY]
    }
  })
}
