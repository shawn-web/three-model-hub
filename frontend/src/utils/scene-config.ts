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
  gridVisible?: boolean
  viewCubeVisible?: boolean
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

/** Viewer store 接口（UI 专用字段） */
interface ViewerStoreApi {
  sceneConfig?: Record<string, unknown> | null
  setSceneConfig: (config: Record<string, unknown>) => void
  setToolbarVisible: (visible: boolean) => void
  setTreeVisible: (visible: boolean) => void
  setHiddenTools: (tools: string[]) => void
  setRotationMode: (mode: boolean) => void
}

/** Scene store 接口（渲染专用字段） */
interface SceneStoreApi {
  modelObject: THREE.Group | null
  markers: MarkerData[]
  setMarkers: (markers: MarkerData[]) => void
  setSceneImages: (images: SceneMedia[]) => void
  setAutoRotate: (value: boolean) => void
  setAutoRotateAxis: (axis: 'x' | 'y' | 'z') => void
  setAutoRotateSpeed: (speed: number) => void
  setGridVisible: (visible: boolean) => void
  setViewCubeVisible: (visible: boolean) => void
  setCameraState: ((state: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; up?: { x: number; y: number; z: number }; fov?: number }) => void) | null
}

import * as THREE from 'three'

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
    viewCubeVisible: true,

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
    iframe: m.iframe,
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
  // skybox 预设类型：{ type: 'skybox', preset: 'day-1' }
  //   可选 preset: day-1, day-2, dusk-1, dusk-2, night-1, night-2
  // skybox 自定义类型：{ type: 'skybox', preset: 'day-1', customUrl: 'https://...' }
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
  //   action     - 点击行为 'none' | 'popup' | 'iframe' | 'link'
  //   state      - 当前状态（匹配 images 中的 state 切换图标）
  //   popup      - 弹窗配置（action='popup' 时生效）
  //     title      弹窗标题
  //     content    弹窗文本内容
  //     contentUrl 嵌入链接（可选，会替代文本内容）
  //     style      自定义样式 { width, background, textColor, borderRadius, fontSize }
  //   iframe     - iframe 弹窗配置（action='iframe' 时生效）
  //     url        iframe 地址
  //     width      弹窗宽度（px）
  //     height     弹窗高度（px）
  //     showCloseButton    是否显示关闭按钮
  //     closeButtonImage   关闭按钮图片 URL
  //     closeButtonPosition 关闭按钮位置
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
  toolbarVisible: ${config.toolbarVisible},     // 是否显示工具栏
  treeVisible: ${config.treeVisible},           // 是否显示模型树
  viewCubeVisible: ${config.viewCubeVisible},   // 是否显示右上角导航立方体
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
 * 解析 postMessage 传入的配置，分别写入 viewer-store（UI 数据）和 scene-store（渲染数据）
 */
export function applyExternalConfig(data: ExternalConfigData, viewerStore: ViewerStoreApi, sceneStore: SceneStoreApi) {
  // ── sceneConfig（背景/灯光）→ viewer-store ──
  const prev = viewerStore.sceneConfig || {}
  const merged: Record<string, unknown> = { ...prev }
  if (data.background != null) merged.background = data.background
  if (data.ambientIntensity != null) merged.ambientIntensity = data.ambientIntensity
  if (data.lightIntensity != null) merged.lightIntensity = data.lightIntensity
  if (data.lightColor != null) merged.lightColor = data.lightColor
  if (data.autoRotate != null) merged.autoRotate = data.autoRotate
  if (data.autoRotateAxis) merged.autoRotateAxis = data.autoRotateAxis
  if (data.autoRotateSpeed != null) merged.autoRotateSpeed = data.autoRotateSpeed
  if (data.gridVisible != null) merged.gridVisible = data.gridVisible
  if (data.viewCubeVisible != null) merged.viewCubeVisible = data.viewCubeVisible
  viewerStore.setSceneConfig(merged)

  // ── 渲染字段 → scene-store ──
  if (data.autoRotate != null) sceneStore.setAutoRotate(data.autoRotate)
  if (data.autoRotateAxis) sceneStore.setAutoRotateAxis(data.autoRotateAxis as 'x' | 'y' | 'z')
  if (data.autoRotateSpeed != null) sceneStore.setAutoRotateSpeed(data.autoRotateSpeed)
  if (data.gridVisible != null) sceneStore.setGridVisible(data.gridVisible)
  if (data.viewCubeVisible != null) sceneStore.setViewCubeVisible(data.viewCubeVisible)
  if (data.camera && sceneStore.setCameraState) sceneStore.setCameraState(data.camera as Parameters<NonNullable<typeof sceneStore.setCameraState>>[0])

  // ── 标点：按 id 合并 → scene-store ──
  if (data.markers && Array.isArray(data.markers)) {
    const currentMarkers = sceneStore.markers
    const mergedMarkers = currentMarkers.map((m: MarkerData) => {
      const external = data.markers!.find((em) => em.id === m.id)
      return external ? { ...m, ...external } : m
    })
    for (const em of data.markers) {
      if (!mergedMarkers.find((m: MarkerData) => m.id === em.id)) mergedMarkers.push(em)
    }
    sceneStore.setMarkers(mergedMarkers)
  }

  // ── 场景图片 → scene-store ──
  if (data.sceneImages && Array.isArray(data.sceneImages)) {
    sceneStore.setSceneImages(data.sceneImages)
  }

  // ── UI 可见性 → viewer-store ──
  if (data.toolbarVisible != null) viewerStore.setToolbarVisible(data.toolbarVisible)
  if (data.treeVisible != null) viewerStore.setTreeVisible(data.treeVisible)
  if (data.hiddenTools) viewerStore.setHiddenTools(data.hiddenTools)
  if (data.rotationMode != null) viewerStore.setRotationMode(data.rotationMode)

  // ── 模型可见性 → Three.js 直接操作 ──
  if (data.models && Array.isArray(data.models)) {
    const modelObject = sceneStore.modelObject
    if (modelObject) {
      for (const modelConfig of data.models) {
        if (modelConfig.visible != null && modelConfig.transform) {
          const visible = modelConfig.visible
          modelObject.traverse((child: THREE.Object3D) => {
            if (child.userData?.modelId === modelConfig.modelId) {
              child.visible = visible
            }
          })
        }
      }
    }
  }

  // ── 组件变换和材质 → Three.js 直接操作 ──
  if (data.components) {
    applyComponentTransforms(sceneStore.modelObject, data.components)
  }
}

/** 将组件配置（position/rotation/scale/color/opacity/贴图）应用到 Three.js 模型对象 */
function applyComponentTransforms(modelObject: THREE.Group | null, components: Record<string, unknown>) {
  if (!modelObject) return
  for (const [uuid, dataRaw] of Object.entries(components)) {
    const data = dataRaw as Record<string, unknown>
    const target = modelObject.getObjectByProperty('uuid', uuid) ?? modelObject.getObjectByName(uuid)
    if (!target) continue

    if (data.position) target.position.set(...(data.position as [number, number, number]))
    if (data.rotation) target.rotation.set(...(data.rotation as [number, number, number]))
    if (data.scale) target.scale.set(...(data.scale as [number, number, number]))
    if (data.visible !== undefined) target.visible = data.visible as boolean

    if (data.color || data.opacity != null || data.mapUrl !== undefined || data.normalMapUrl !== undefined) {
      target.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        for (const m of mats) {
          if (!(m instanceof THREE.MeshStandardMaterial)) continue
          if (data.color) m.color.set(data.color as string)
          if (data.opacity != null) { m.transparent = true; m.opacity = data.opacity as number; m.needsUpdate = true }
          const texLoader = new THREE.TextureLoader()
          texLoader.setCrossOrigin('anonymous')
          const channels: Array<{ url: unknown; key: keyof Pick<THREE.MeshStandardMaterial, 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'emissiveMap'> }> = [
            { url: data.mapUrl, key: 'map' },
            { url: data.normalMapUrl, key: 'normalMap' },
            { url: data.roughnessMapUrl, key: 'roughnessMap' },
            { url: data.metalnessMapUrl, key: 'metalnessMap' },
            { url: data.emissiveMapUrl, key: 'emissiveMap' },
          ]
          for (const { url, key } of channels) {
            if (url) {
              const tex = texLoader.load(url as string)
              if (key === 'map') tex.colorSpace = THREE.SRGBColorSpace
              m[key] = tex; m.needsUpdate = true
            } else if (url === '') {
              m[key] = null; m.needsUpdate = true
            }
          }
        }
      })
    }
  }
}
