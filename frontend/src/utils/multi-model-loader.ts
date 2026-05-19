/**
 * 多模型场景加载工具
 *
 * 接收场景模型列表，为每个模型获取文件 URL 并加载 GLB，
 * 返回一个 THREE.Group，每个子 Group 携带各自的变换（位置、旋转、缩放）。
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/** 场景模型数据（由后端 getSceneData 返回的 models 数组元素） */
export interface SceneModelData {
  /** 模型 ID */
  model_id: string
  /** 场景模型关联 ID */
  id?: string
  /** 显示名称 */
  display_name?: string
  /**
   * 变换数据
   * { position: [x,y,z], rotation: [x,y,z], scale: [x,y,z] }
   */
  transform?: {
    position?: [number, number, number]
    rotation?: [number, number, number]
    scale?: [number, number, number]
  } | null
  /**
   * 材质覆盖配置
   * { components: { [uuid]: { color?: string, opacity?: number } } }
   */
  material_overrides?: {
    components?: Record<string, {
      color?: string
      opacity?: number
    }>
  } | null
  /** 是否可见 */
  visible?: boolean
  /** 排序权重 */
  sort_order?: number
}

/** 加载进度回调 */
export type ProgressCallback = (
  loaded: number,
  total: number,
  currentName: string,
) => void

/**
 * 将 transform 数据应用到 Three.js 对象
 *
 * @param obj   目标 Object3D
 * @param transform  变换数据
 */
function applyTransform(
  obj: THREE.Object3D,
  transform: SceneModelData['transform'],
) {
  if (!transform) return

  if (transform.position) {
    obj.position.set(transform.position[0], transform.position[1], transform.position[2])
  }
  if (transform.rotation) {
    obj.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2])
  }
  if (transform.scale) {
    obj.scale.set(transform.scale[0], transform.scale[1], transform.scale[2])
  }
}

/**
 * 加载场景中的所有模型
 *
 * 逐个获取文件 URL 并加载 GLB，将每个模型放入带有 transform 的子 Group 中，
 * 最终返回一个包含所有模型的 THREE.Group。
 *
 * 加载失败的模型会被跳过，不会导致整体失败。
 *
 * @param sceneModels   场景模型列表
 * @param getModelUrl   通过模型 ID 获取可下载文件 URL 的回调
 * @param onProgress    可选的进度回调
 * @returns 包含所有已加载模型的 Group
 */
export async function loadSceneModels(
  sceneModels: SceneModelData[],
  getModelUrl: (id: string) => Promise<string>,
  onProgress?: ProgressCallback,
): Promise<THREE.Group> {
  const rootGroup = new THREE.Group()
  rootGroup.name = 'SceneModels'

  const gltfLoader = new GLTFLoader()
  const total = sceneModels.length
  let loaded = 0
  const errors: string[] = []

  for (const sm of sceneModels) {
    const displayName = sm.display_name || sm.model_id

    try {
      /* 获取模型文件下载地址 */
      const fileUrl = await getModelUrl(sm.model_id)

      /* 使用 GLTFLoader 加载 */
      const gltf = await gltfLoader.loadAsync(fileUrl)
      const model = gltf.scene
      model.name = displayName

      /* 为每个模型创建独立的包装 Group，用于应用场景级 transform */
      const wrapper = new THREE.Group()
      wrapper.name = `ModelWrapper_${displayName}`
      wrapper.userData = {
        sceneModelId: sm.id,
        modelId: sm.model_id,
        displayName,
      }

      /* 应用变换 */
      applyTransform(wrapper, sm.transform)

      /* 应用材质覆盖 */
      if (sm.material_overrides?.components) {
        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return
          const override = sm.material_overrides!.components![child.uuid]
          if (!override) return
          const mat = child.material
          const materials = Array.isArray(mat) ? mat : [mat]
          materials.forEach((m) => {
            if (!(m instanceof THREE.MeshStandardMaterial)) return
            if (override.color) m.color.set(override.color)
            if (override.opacity != null) {
              m.transparent = true
              m.opacity = override.opacity
            }
          })
        })
      }

      /* 应用可见性 */
      if (sm.visible === false) {
        wrapper.visible = false
      }

      wrapper.add(model)
      rootGroup.add(wrapper)

      loaded++
      if (onProgress) {
        onProgress(loaded, total, displayName)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[MultiModelLoader] 加载模型 "${displayName}" 失败:`, msg)
      errors.push(displayName)
      loaded++
      if (onProgress) {
        onProgress(loaded, total, displayName)
      }
    }
  }

  /* 如果有部分模型加载失败，记录警告 */
  if (errors.length > 0) {
    console.warn(
      `[MultiModelLoader] ${errors.length} 个模型加载失败: ${errors.join(', ')}`
    )
  }

  return rootGroup
}
