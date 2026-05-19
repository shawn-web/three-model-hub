/**
 * 多模型场景加载工具
 *
 * 接收场景模型列表，为每个模型获取文件 URL 并加载 GLB，
 * 返回一个 THREE.Group，每个子 Group 携带各自的变换（位置、旋转、缩放）。
 *
 * 内置模型缓存：相同 URL 的 GLB 文件只加载一次，后续请求从缓存中克隆，
 * 减少网络请求和加载时间。缓存默认 30 分钟过期。
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

/* ──────────────── 模型缓存 ──────────────── */

/** 缓存条目 */
interface CacheEntry {
  /** 原始 GLTF 结果（scene 不会被加入任何场景，仅作为克隆源） */
  gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>
  /** 缓存写入时间戳 */
  timestamp: number
}

/** 正在加载中的条目（用于请求去重） */
interface LoadingEntry {
  promise: Promise<Awaited<ReturnType<GLTFLoader['loadAsync']>>>
}

/** 缓存过期时间（毫秒），默认 30 分钟 */
const CACHE_TTL = 30 * 60 * 1000

/** 内部默认 GLTFLoader 实例，供 loadGLBWithCache(url) 简化调用使用 */
const defaultGLTFLoader = new GLTFLoader()

/** 已完成的模型缓存：URL → CacheEntry */
const modelCache = new Map<string, CacheEntry>()

/** 正在加载的模型缓存：URL → LoadingEntry（防止同一 URL 并发重复请求） */
const loadingCache = new Map<string, LoadingEntry>()

/**
 * 从缓存中获取已加载的模型（克隆副本）。
 * 如果缓存不存在或已过期，返回 null。
 */
function getCachedModel(url: string): THREE.Group | null {
  const entry = modelCache.get(url)
  if (!entry) return null

  const now = Date.now()
  if (now - entry.timestamp > CACHE_TTL) {
    modelCache.delete(url)
    return null
  }

  // 使用 SkeletonUtils.clone 进行深拷贝（几何体共享，材质独立）
  const cloned = SkeletonUtils.clone(entry.gltf.scene) as THREE.Group
  return cloned
}

/**
 * 将加载完成的 GLTF 结果写入缓存。
 */
function setCachedModel(
  url: string,
  gltf: Awaited<ReturnType<GLTFLoader['loadAsync']>>,
): void {
  modelCache.set(url, { gltf, timestamp: Date.now() })
}

/**
 * 加载 GLB 文件（带缓存 + 请求去重）。
 * - 如果缓存命中且未过期，直接返回克隆的场景
 * - 如果同一 URL 正在加载中，复用同一个 Promise（去重）
 * - 否则发起新的网络请求，加载完成后写入缓存
 *
 * 此函数同时被 GlbLoader 使用，确保所有 GLB 加载共享同一缓存。
 *
 * @param gltfLoader 可选的 GLTFLoader 实例，不传则使用内部默认实例
 * @param url        GLB 文件的 URL
 */
export async function loadGLBWithCache(
  gltfLoaderOrUrl: GLTFLoader | string,
  url?: string,
): Promise<{ scene: THREE.Group; fromCache: boolean }> {
  // 支持两种调用方式：loadGLBWithCache(url) 或 loadGLBWithCache(loader, url)
  let loader: GLTFLoader
  let fileUrl: string
  if (typeof gltfLoaderOrUrl === 'string') {
    loader = defaultGLTFLoader
    fileUrl = gltfLoaderOrUrl
  } else {
    loader = gltfLoaderOrUrl
    fileUrl = url!
  }
  // 1. 检查已完成缓存
  const cached = getCachedModel(fileUrl)
  if (cached) {
    return { scene: cached, fromCache: true }
  }

  // 2. 检查是否有正在进行的加载（请求去重）
  const loading = loadingCache.get(fileUrl)
  if (loading) {
    const gltf = await loading.promise
    const cloned = SkeletonUtils.clone(gltf.scene) as THREE.Group
    return { scene: cloned, fromCache: true }
  }

  // 3. 发起新的加载请求
  const loadPromise = loader.loadAsync(fileUrl)
  loadingCache.set(fileUrl, { promise: loadPromise })

  try {
    const gltf = await loadPromise
    setCachedModel(fileUrl, gltf)
    return { scene: gltf.scene as THREE.Group, fromCache: false }
  } finally {
    loadingCache.delete(fileUrl)
  }
}

/**
 * 清除所有模型缓存。
 * 可在需要强制刷新模型时调用。
 */
export function clearModelCache(): void {
  modelCache.clear()
  loadingCache.clear()
}

/**
 * 清除指定 URL 的模型缓存。
 */
export function invalidateModelCache(url: string): void {
  modelCache.delete(url)
  loadingCache.delete(url)
}

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

      /* 使用带缓存的加载（命中缓存时跳过网络请求） */
      const { scene: model, fromCache } = await loadGLBWithCache(gltfLoader, fileUrl)
      model.name = displayName

      if (fromCache) {
        console.debug(`[MultiModelLoader] 模型 "${displayName}" 从缓存加载`)
      }

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
