/**
 * 场景配置文件生成 & 解析
 *
 * 负责：
 * 1. 从编辑器 store 收集所有配置数据
 * 2. 生成带完整注释的 .js 配置文件文本
 * 3. 解析 postMessage 传入的配置并应用到 viewer store
 */

import type { MarkerData, SceneMedia } from '../types/edit-data'
import type { EditState } from '../store/edit-store'

/** 场景模型原始数据（后端返回） */
interface SceneModelRaw {
  id: string
  model_id: string
  display_name?: string
  transform?: Record<string, unknown>
  visible?: boolean
}

/** 组件编辑数据原始结构 */
interface ComponentEditRaw {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  color?: string | null
  opacity?: number | null
  mapUrl?: string | null
  normalMapUrl?: string | null
  roughnessMapUrl?: string | null
  metalnessMapUrl?: string | null
  emissiveMapUrl?: string | null
  visible?: boolean
  name?: string | null
  description?: string | null
}

/** 外部配置数据结构 */
interface ExternalConfigData {
  background?: unknown
  ambientIntensity?: number
  lightIntensity?: number
  lightColor?: string
  autoRotate?: boolean
  autoRotateAxis?: string
  autoRotateSpeed?: number
  toolbarVisible?: boolean
  treeVisible?: boolean
  hiddenTools?: string[]
  rotationMode?: boolean
  camera?: { position: unknown; target: unknown }
  markers?: Array<MarkerData & Record<string, unknown>>
  sceneImages?: SceneMedia[]
  models?: Array<{ modelId?: string; visible?: boolean; transform?: unknown }>
  components?: Record<string, unknown>
}

/** Viewer store 接口（applyExternalConfig 使用） */
interface ViewerStoreApi {
  sceneConfig?: Record<string, unknown>
  markers: MarkerData[]
  modelObject?: THREE.Group | null
  setSceneConfig: (config: Record<string, unknown>) => void
  setToolbarVisible: (visible: boolean) => void
  setTreeVisible: (visible: boolean) => void
  setHiddenTools: (tools: string[]) => void
  setRotationMode: (mode: boolean) => void
  setCameraState: ((state: unknown) => void) | null
  setMarkers: (markers: MarkerData[]) => void
  setSceneImages?: (images: SceneMedia[]) => void
}

import type * as THREE from 'three'

/** 从编辑器收集完整配置数据 */
export function collectSceneConfig(store: EditState & {
  getCameraState?: () => {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    up?: { x: number; y: number; z: number }
    fov?: number
  }
}, sceneModels: SceneModelRaw[]) {
  const cameraState = store.getCameraState?.()

  return {
    // 场景背景
    background: store.backgroundConfig,
    ambientIntensity: store.ambientIntensity ?? 0.8,
    lightIntensity: store.lightIntensity ?? 1.0,
    lightColor: store.lightColor ?? '#ffffff',
    autoRotate: store.autoRotate,
    autoRotateAxis: store.autoRotateAxis,
    autoRotateSpeed: store.autoRotateSpeed,
    gridVisible: store.gridVisible,

    // 标点（包含完整字段）
    markers: store.markers.map(fullMarker),

    // 场景图片
    sceneImages: store.sceneImages.map(fullSceneImage),

    // 模型组件变换（从 editData 提取）
    components: serializeComponents(store.editData),

    // 模型列表（transform + visible + display_name）
    models: sceneModels.map((sm) => ({
      id: sm.id,
      modelId: sm.model_id,
      displayName: sm.display_name || null,
      transform: sm.transform,
      visible: sm.visible,
    })),

    // UI 可见性
    toolbarVisible: true,
    treeVisible: true,

    // 相机
    camera: cameraState ? {
      position: cameraState.position,
      target: cameraState.target,
    } : undefined,
  }
}

/** 标点完整字段序列化 */
function fullMarker(m: MarkerData) {
  return {
    id: m.id,
    name: m.name,
    position: m.position,
    imageUrl: m.imageUrl,
    width: m.width,
    height: m.height,
    action: m.action,
    state: m.state,
    popup: m.popup,
    linkUrl: m.linkUrl,
    linkTarget: m.linkTarget,
    images: m.images,
  }
}

/** 场景媒体完整字段序列化 */
function fullSceneImage(img: SceneMedia) {
  return {
    id: img.id,
    type: img.type,
    url: img.url,
    name: img.name,
    width: img.width,
    height: img.height,
    position: img.position,
    scale: img.scale,
    rotation: img.rotation,
    visible: img.visible,
    billboard: img.billboard,
    autoplay: img.autoplay,
    muted: img.muted,
    loop: img.loop,
    text: img.text,
    fontSize: img.fontSize,
    fontColor: img.fontColor,
  }
}

/** 组件变换数据序列化 */
function serializeComponents(editData: Record<string, ComponentEditRaw | null>) {
  const result: Record<string, ComponentEditRaw> = {}
  for (const [uuid, data] of Object.entries(editData)) {
    if (!data) continue
    result[uuid] = {
      position: data.position,
      rotation: data.rotation,
      scale: data.scale,
      color: data.color,
      opacity: data.opacity,
      mapUrl: data.mapUrl,
      normalMapUrl: data.normalMapUrl,
      roughnessMapUrl: data.roughnessMapUrl,
      metalnessMapUrl: data.metalnessMapUrl,
      emissiveMapUrl: data.emissiveMapUrl,
      visible: data.visible,
      name: data.name,
      description: data.description,
    }
  }
  return result
}

/** 生成带注释的 .js 配置文件文本 */
export function generateConfigFile(config: ReturnType<typeof collectSceneConfig>, sceneName: string): string {
  const markersJson = JSON.stringify(config.markers, null, 4)
  const sceneImagesJson = JSON.stringify(config.sceneImages, null, 4)
  const componentsJson = JSON.stringify(config.components, null, 4)
  const modelsJson = JSON.stringify(config.models, null, 4)
  const cameraJson = config.camera ? JSON.stringify(config.camera, null, 4) : 'undefined'

  return `/**
 * 场景配置文件
 * 场景：${sceneName || '未命名'}
 * 生成时间：${new Date().toLocaleString('zh-CN')}
 *
 * 使用方式：
 *   const config = (await import('./scene-config.js')).default
 *   iframe.contentWindow.postMessage({ type: 'scene-config', ...config }, '*')
 *
 * 所有字段均为可选，未传入的字段保持场景原有配置不变
 */

const sceneConfig = {

  // ========== 场景背景 ==========
  // type: 'color' | 'image' | 'skybox'
  // color 类型：{ type: 'color', color: '#1a1a2e' }
  // image 类型：{ type: 'image', url: 'https://...' }
  // skybox 类型：{ type: 'skybox' }
  background: ${JSON.stringify(config.background, null, 2)},

  // ========== 灯光 ==========
  ambientIntensity: ${config.ambientIntensity},  // 环境光强度 0~3
  lightIntensity: ${config.lightIntensity},    // 方向光强度 0~3
  lightColor: '${config.lightColor}',           // 颜色

  // ========== 自动旋转 ==========
  autoRotate: ${config.autoRotate},
  autoRotateAxis: '${config.autoRotateAxis}',  // 旋转轴 'x' | 'y' | 'z'，默认 'y'
  autoRotateSpeed: ${config.autoRotateSpeed},  // 旋转速度，默认 2
  gridVisible: ${config.gridVisible},          // 显示网格，默认 true

  // ========== 标点配置 ==========
  // 每个标点字段说明：
  //   id         - 唯一标识（新增标点时自定义，更新已有标点时使用原 id）
  //   name       - 标点名称
  //   position   - 3D 坐标 [x, y, z]
  //   imageUrl   - 标点图标 URL
  //   width      - 图标宽度
  //   height     - 图标高度
  //   action     - 点击行为 'none' | 'popup' | 'link'
  //   state      - 当前状态（匹配 images 中的 state 切换图标）
  //   popup      - 弹窗配置（action='popup' 时生效）
  //     title      弹窗标题
  //     content    弹窗文本内容
  //     contentUrl 嵌入链接（可选，会替代文本内容）
  //     style      自定义样式 { width, background, textColor, borderRadius, fontSize }
  //   linkUrl    - 跳转链接（action='link' 时生效）
  //   linkTarget - '_blank' | '_self'
  //   images     - 多图片数组，每项可带 state 标签用于状态切换
  markers: ${markersJson},

  // ========== 场景媒体 ==========
  // 支持三种类型：image(图片)/video(视频)/text(文字标注)
  // type       - 媒体类型 'image' | 'video' | 'text'
  // url        - 资源 URL（图片/视频）
  // position   - 3D 坐标 [x, y, z]
  // scale      - 缩放 [x, y]，平面无厚度
  // rotation   - 旋转 [x, y, z] 欧拉角
  // billboard  - true = 始终面向相机，false = 嵌入场景
  // 视频专用：autoplay/muted/loop
  // 文字专用：text/fontSize/fontColor
  sceneImages: ${sceneImagesJson},

  // ========== 模型组件编辑 ==========
  // key 为模型内部构件的 UUID，value 为该构件的变换和材质覆盖
  // position/rotation/scale 格式: [x, y, z]
  components: ${componentsJson},

  // ========== 场景模型列表 ==========
  // 每个模型的 transform 和可见性配置
  models: ${modelsJson},

  // ========== UI 可见性 ==========
  toolbarVisible: true,     // 是否显示工具栏
  treeVisible: true,        // 是否显示模型树
  hiddenTools: [],           // 隐藏的工具列表，如 ['section', 'measurement']

  // ========== 相机位置 ==========
  // 可选，设置后预览页会跳转到指定视角
  camera: ${cameraJson},

}

export default sceneConfig
`
}

/** 触发浏览器下载文件 */
export function downloadConfigFile(content: string, sceneName: string) {
  const blob = new Blob([content], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `scene-config-${sceneName || 'untitled'}.js`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 解析 postMessage 传入的配置，返回需要在 viewer store 上执行的更新操作
 */
export function applyExternalConfig(data: ExternalConfigData, store: ViewerStoreApi) {
  // 场景背景和灯光
  if (data.background || data.ambientIntensity != null || data.lightIntensity != null || data.lightColor) {
    const prev = store.sceneConfig || {}
    store.setSceneConfig({
      ...prev,
      ...(data.background != null ? { background: data.background } : {}),
      ...(data.ambientIntensity != null ? { ambientIntensity: data.ambientIntensity } : {}),
      ...(data.lightIntensity != null ? { lightIntensity: data.lightIntensity } : {}),
      ...(data.lightColor != null ? { lightColor: data.lightColor } : {}),
    })
  }

  // 自动旋转
  if (data.autoRotate != null || data.autoRotateAxis || data.autoRotateSpeed != null) {
    const prev = store.sceneConfig || {}
    store.setSceneConfig({
      ...prev,
      ...(data.autoRotate != null ? { autoRotate: data.autoRotate } : {}),
      ...(data.autoRotateAxis ? { autoRotateAxis: data.autoRotateAxis } : {}),
      ...(data.autoRotateSpeed != null ? { autoRotateSpeed: data.autoRotateSpeed } : {}),
    })
  }

  // UI 可见性
  if (data.toolbarVisible != null) store.setToolbarVisible(data.toolbarVisible)
  if (data.treeVisible != null) store.setTreeVisible(data.treeVisible)
  if (data.hiddenTools) store.setHiddenTools(data.hiddenTools)
  if (data.rotationMode != null) store.setRotationMode(data.rotationMode)

  // 相机位置
  if (data.camera && store.setCameraState) {
    store.setCameraState(data.camera)
  }

  // 标点配置：按 id 合并，外部字段覆盖本地
  if (data.markers && Array.isArray(data.markers)) {
    const currentMarkers = store.markers
    const merged = currentMarkers.map((m: MarkerData) => {
      const external = data.markers.find((em) => em.id === m.id)
      if (!external) return m
      return { ...m, ...external }
    })
    for (const em of data.markers) {
      if (!merged.find((m: MarkerData) => m.id === em.id)) {
        merged.push(em)
      }
    }
    store.setMarkers(merged)
  }

  // 场景图片
  if (data.sceneImages && Array.isArray(data.sceneImages)) {
    store.setMarkers(store.markers) // 保留 markers 不变
    // 如果 viewer store 有 sceneImages 支持
    if (store.setSceneImages) {
      store.setSceneImages(data.sceneImages)
    }
  }

  // 模型可见性
  if (data.models && Array.isArray(data.models)) {
    const modelObject = store.modelObject
    if (modelObject) {
      for (const modelConfig of data.models) {
        if (modelConfig.visible != null && modelConfig.transform) {
          // 查找并更新模型可见性
          modelObject.traverse((child: THREE.Object3D) => {
            if (child.userData?.modelId === modelConfig.modelId) {
              child.visible = modelConfig.visible
            }
          })
        }
      }
    }
  }

  // 组件变换和材质
  if (data.components && modelComponentUpdater) {
    modelComponentUpdater(data.components, store)
  }
}

/** 组件变换更新（延迟绑定） */
let modelComponentUpdater: ((components: Record<string, unknown>, store: ViewerStoreApi) => void) | null = null

export function setModelComponentUpdater(fn: (components: Record<string, unknown>, store: ViewerStoreApi) => void) {
  modelComponentUpdater = fn
}
