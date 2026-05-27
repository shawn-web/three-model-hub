import { create } from 'zustand'
import { temporal } from 'zundo'
import type * as THREE from 'three'
import type { MarkerData, SceneMedia } from '../types/edit-data'
import type { SelectionHighlightManager } from '../utils/selection-highlight'
import { useSceneStore } from './scene-store'

/** 场景背景配置 */
export type BackgroundConfig =
  | { type: 'color'; color: string }
  | { type: 'image'; url: string }
  | { type: 'skybox' }

/** 变换操作模式（null 表示未激活） */
export type TransformMode = 'translate' | 'rotate' | 'scale' | null

/** 构件编辑数据 */
export interface EditComponentData {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string | null
  opacity: number | null
  visible: boolean
  name: string | null
  description: string | null
  mapUrl: string | null
  normalMapUrl: string | null
  roughnessMapUrl: string | null
  metalnessMapUrl: string | null
  emissiveMapUrl: string | null
  _deleted?: boolean
}

/** 编辑器状态 */
export interface EditState {
  /** 模型文件 URL */
  modelUrl: string | null
  /** 模型 Three.js 对象 */
  modelObject: THREE.Group | null
  /** 模型加载中 */
  modelLoading: boolean
  /** 模型加载进度 */
  modelLoadingProgress: number
  /** 是否有未保存的编辑 */
  isDirty: boolean
  /** 当前选中的构件 UUID */
  selectedComponentId: string | null
  /** 变换操作模式 */
  transformMode: TransformMode
  /** 构件编辑数据映射 (uuid → EditComponentData) */
  editData: Record<string, EditComponentData>
  /** 自动旋转开关 */
  autoRotate: boolean
  /** 自动旋转轴（默认 Y 轴） */
  autoRotateAxis: 'x' | 'y' | 'z'
  /** 自动旋转速度（默认 2.0） */
  autoRotateSpeed: number
  /** 背景颜色 */
  backgroundColor: string
  /** 场景背景配置 */
  backgroundConfig: BackgroundConfig | null
  /** 环境光强度（默认 0.8） */
  ambientIntensity: number
  /** 整体光照强度（倍率，默认 1.0） */
  lightIntensity: number
  /** 整体光照颜色（默认白色） */
  lightColor: string
  /** 标点数据列表 */
  markers: MarkerData[]
  /** 是否正在添加标点 */
  addingMarker: boolean
  /** 正在重定位的标点 ID */
  editingMarkerId: string | null
  /** 当前选中的标点 ID */
  selectedMarkerId: string | null
  /** 场景媒体列表 */
  sceneImages: SceneMedia[]
  /** 当前选中的媒体 ID */
  selectedImageId: string | null
  /** 正在点击定位的媒体 ID */
  placingImageId: string | null
  /** 网格是否可见 */
  gridVisible: boolean
  /** 当前活动标签页 key ('scene' | 'model' | 'properties') */
  activeTab: string
  /** 相机信息面板是否可见 */
  cameraInfoVisible: boolean
  /** 适配视图函数 */
  fitToViewFn: (() => void) | null
  /** 用于获取相机状态的外部回调 */
  getCameraState: (() => {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    up: { x: number; y: number; z: number }
    fov: number
  }) | null
  /** 用于设置相机状态的外部回调 */
  setCameraState: ((state: {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    up?: { x: number; y: number; z: number }
    fov?: number
  }) => void) | null
  /** 从 scene_config 恢复的相机配置，EditSceneSetup 加载后应用并清除 */
  savedCameraConfig: {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    fov?: number
  } | null
  /** 场景图变更版本号，外部添加/删除模型时递增以触发 SceneTree 等组件重渲染 */
  sceneVersion: number
  /** 透视模式开关 */
  xrayMode: boolean
  /** 高亮管理器引用（由 EditSceneSetup 设置） */
  highlightManager: SelectionHighlightManager | null
  /** RRF invalidate 函数（由 Canvas 内部组件设置，外部修改材质后调用强制刷新） */
  invalidateFn: (() => void) | null
}

/** 编辑器操作方法 */
export interface EditActions {
  /** 设置模型 URL */
  setModelUrl: (url: string | null) => void
  /** 设置模型 Three.js 对象 */
  setModelObject: (obj: THREE.Group | null) => void
  /** 设置模型加载状态 */
  setModelLoading: (loading: boolean) => void
  /** 设置模型加载进度 */
  setModelLoadingProgress: (percent: number) => void
  /** 设置是否有未保存的编辑 */
  setIsDirty: (dirty: boolean) => void
  /** 选中构件（同时设置 selectedComponentId） */
  selectComponent: (id: string | null) => void
  /** 设置选中的构件 ID */
  setSelectedComponentId: (id: string | null) => void
  /** 设置变换操作模式 */
  setTransformMode: (mode: TransformMode | null) => void
  /** 更新构件变换数据 */
  updateComponentTransform: (uuid: string, transform: Partial<{ position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }>) => void
  /** 更新构件材质数据 */
  updateComponentMaterial: (uuid: string, material: {
    color?: string | null
    opacity?: number | null
    mapUrl?: string | null
    normalMapUrl?: string | null
    roughnessMapUrl?: string | null
    metalnessMapUrl?: string | null
    emissiveMapUrl?: string | null
  }) => void
  /** 更新构件可见性 */
  updateComponentVisibility: (uuid: string, visible: boolean) => void
  /** 更新构件名称 */
  updateComponentName: (uuid: string, name: string | null) => void
  /** 更新构件描述 */
  updateComponentDescription: (uuid: string, description: string | null) => void
  /** 标记构件为已删除 */
  deleteComponent: (uuid: string, name: string | null) => void
  /** 批量加载编辑数据 */
  loadEditData: (data: Record<string, EditComponentData>) => void
  /** 设置自动旋转 */
  setAutoRotate: (value: boolean) => void
  /** 设置自动旋转轴 */
  setAutoRotateAxis: (axis: 'x' | 'y' | 'z') => void
  /** 设置自动旋转速度 */
  setAutoRotateSpeed: (speed: number) => void
  /** 设置背景颜色 */
  setBackgroundColor: (color: string) => void
  /** 设置场景背景配置 */
  setBackgroundConfig: (config: BackgroundConfig | null) => void
  /** 设置整体光照强度 */
  setLightIntensity: (intensity: number) => void
  /** 设置环境光强度 */
  setAmbientIntensity: (intensity: number) => void
  /** 设置整体光照颜色 */
  setLightColor: (color: string) => void
  /** 添加标点 */
  addMarker: (marker: MarkerData) => void
  /** 移除标点 */
  removeMarker: (id: string) => void
  /** 更新标点数据 */
  updateMarker: (id: string, updates: Partial<MarkerData>) => void
  /** 批量设置标点列表（替换整个数组） */
  setMarkers: (markers: MarkerData[]) => void
  /** 设置是否正在添加标点 */
  setAddingMarker: (value: boolean) => void
  /** 设置正在重定位的标点 ID */
  setEditingMarkerId: (id: string | null) => void
  /** 设置选中的标点 ID */
  setSelectedMarkerId: (id: string | null) => void
  /** 添加场景媒体 */
  addSceneImage: (image: SceneMedia) => void
  /** 移除场景媒体 */
  removeSceneImage: (id: string) => void
  /** 更新场景媒体数据 */
  updateSceneImage: (id: string, updates: Partial<SceneMedia>) => void
  /** 批量设置场景媒体列表 */
  setSceneImages: (images: SceneMedia[]) => void
  /** 设置选中的媒体 ID */
  setSelectedImageId: (id: string | null) => void
  /** 设置正在点击定位的媒体 ID */
  setPlacingImageId: (id: string | null) => void
  setGridVisible: (visible: boolean) => void
  /** 设置活动标签页 */
  setActiveTab: (tab: string) => void
  setCameraInfoVisible: (visible: boolean) => void
  /** 设置适配视图函数 */
  setFitToViewFn: (fn: (() => void) | null) => void
  /** 注册获取相机状态的回调 */
  setGetCameraState: (fn: EditState['getCameraState']) => void
  /** 注册设置相机状态的回调 */
  setSetCameraState: (fn: EditState['setCameraState']) => void
  /** 设置从 scene_config 恢复的相机配置 */
  setSavedCameraConfig: (config: EditState['savedCameraConfig']) => void
  /** 递增场景图版本号 */
  bumpSceneVersion: () => void
  /** 设置透视模式 */
  setXrayMode: (enabled: boolean) => void
  /** 设置高亮管理器引用 */
  setHighlightManager: (mgr: SelectionHighlightManager | null) => void
  /** 设置 RRF invalidate 函数 */
  setInvalidateFn: (fn: (() => void) | null) => void
  /** 重置编辑器状态 */
  resetEdit: () => void
}

/** 默认构件数据 */
const defaultComponent = (): EditComponentData => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: null,
  opacity: null,
  visible: true,
  name: null,
  description: null,
  mapUrl: null,
  normalMapUrl: null,
  roughnessMapUrl: null,
  metalnessMapUrl: null,
  emissiveMapUrl: null,
})

/** 初始状态 */
const initialState: EditState = {
  modelUrl: null,
  modelObject: null,
  modelLoading: false,
  modelLoadingProgress: 0,
  isDirty: false,
  selectedComponentId: null,
  transformMode: null,
  editData: {},
  autoRotate: false,
  autoRotateAxis: 'y',
  autoRotateSpeed: 2,
  backgroundColor: '#1a1a2e',
  backgroundConfig: null,
  ambientIntensity: 0.8,
  lightIntensity: 1.0,
  lightColor: '#ffffff',
  markers: [],
  addingMarker: false,
  editingMarkerId: null,
  selectedMarkerId: null,
  sceneImages: [],
  selectedImageId: null,
  placingImageId: null,
  gridVisible: false,
  activeTab: 'scene',
  cameraInfoVisible: false,
  fitToViewFn: null,
  getCameraState: null,
  setCameraState: null,
  savedCameraConfig: null,
  sceneVersion: 0,
  xrayMode: false,
  highlightManager: null,
  invalidateFn: null,
}

/** 编辑器状态管理 Store（支持时间旅行撤销/重做） */
export const useEditStore = create<EditState & EditActions>()(
  temporal(
    (set) => ({
      ...initialState,

      setModelUrl: (url) => set({ modelUrl: url }),
      setModelObject: (obj) => set({ modelObject: obj }),
      setModelLoading: (loading) => set({ modelLoading: loading, modelLoadingProgress: loading ? 0 : 0 }),
      setModelLoadingProgress: (percent) => set({ modelLoadingProgress: percent }),
      setIsDirty: (dirty) => set({ isDirty: dirty }),
      selectComponent: (id) => { set({ selectedComponentId: id }); useSceneStore.getState().selectComponent(id) },
      setSelectedComponentId: (id) => { set({ selectedComponentId: id }); useSceneStore.getState().selectComponent(id) },
      setTransformMode: (mode) => set({ transformMode: mode }),

      updateComponentTransform: (uuid, transform) => set((state) => {
        const existing = state.editData[uuid] || defaultComponent()
        return {
          editData: {
            ...state.editData,
            [uuid]: {
              ...existing,
              ...transform,
              position: transform.position ?? existing.position,
              rotation: transform.rotation ?? existing.rotation,
              scale: transform.scale ?? existing.scale,
            },
          },
          isDirty: true,
        }
      }),

      updateComponentMaterial: (uuid, material) => set((state) => {
        const existing = state.editData[uuid] || defaultComponent()
        return {
          editData: {
            ...state.editData,
            [uuid]: {
              ...existing,
              color: material.color !== undefined ? material.color : existing.color,
              opacity: material.opacity !== undefined ? material.opacity : existing.opacity,
              mapUrl: material.mapUrl !== undefined ? material.mapUrl : existing.mapUrl,
              normalMapUrl: material.normalMapUrl !== undefined ? material.normalMapUrl : existing.normalMapUrl,
              roughnessMapUrl: material.roughnessMapUrl !== undefined ? material.roughnessMapUrl : existing.roughnessMapUrl,
              metalnessMapUrl: material.metalnessMapUrl !== undefined ? material.metalnessMapUrl : existing.metalnessMapUrl,
              emissiveMapUrl: material.emissiveMapUrl !== undefined ? material.emissiveMapUrl : existing.emissiveMapUrl,
            },
          },
          isDirty: true,
        }
      }),

      updateComponentVisibility: (uuid, visible) => set((state) => {
        const existing = state.editData[uuid] || defaultComponent()
        return {
          editData: {
            ...state.editData,
            [uuid]: { ...existing, visible },
          },
          isDirty: true,
        }
      }),

      updateComponentName: (uuid, name) => set((state) => {
        const existing = state.editData[uuid] || defaultComponent()
        return {
          editData: {
            ...state.editData,
            [uuid]: { ...existing, name },
          },
        }
      }),

      updateComponentDescription: (uuid, description) => set((state) => {
        const existing = state.editData[uuid] || defaultComponent()
        return {
          editData: {
            ...state.editData,
            [uuid]: { ...existing, description },
          },
          isDirty: true,
        }
      }),

      deleteComponent: (uuid, name) => set((state) => {
        const existing = state.editData[uuid] || defaultComponent()
        return {
          editData: {
            ...state.editData,
            [uuid]: { ...existing, name: name || existing.name, _deleted: true },
          },
          isDirty: true,
        }
      }),

      loadEditData: (data) => set({ editData: data }),
      setAutoRotate: (value) => set({ autoRotate: value }),
      setAutoRotateAxis: (axis) => set({ autoRotateAxis: axis, isDirty: true }),
      setAutoRotateSpeed: (speed) => {
        const v = Number(speed)
        set({ autoRotateSpeed: isNaN(v) ? 2 : v, isDirty: true })
      },
      setBackgroundColor: (color) => set({ backgroundColor: color }),
      setBackgroundConfig: (config) => {
        set({ backgroundConfig: config, isDirty: true })
      },
      setLightIntensity: (intensity) => {
        const v = Number(intensity)
        set({ lightIntensity: isNaN(v) ? 1.0 : v })
      },
      setAmbientIntensity: (intensity) => {
        const v = Number(intensity)
        set({ ambientIntensity: isNaN(v) ? 0.8 : v, isDirty: true })
      },
      setLightColor: (color) => set({ lightColor: color }),

      addMarker: (marker) => set((state) => ({ markers: [...state.markers, marker], isDirty: true })),
      removeMarker: (id) => set((state) => ({ markers: state.markers.filter((m) => m.id !== id), isDirty: true })),
      updateMarker: (id, updates) => set((state) => ({
        markers: state.markers.map((m) => m.id === id ? { ...m, ...updates } : m),
        isDirty: true,
      })),
      setMarkers: (markers) => set({ markers, isDirty: true }),
      setAddingMarker: (value) => set({ addingMarker: value }),
      setEditingMarkerId: (id) => set({ editingMarkerId: id }),
      setSelectedMarkerId: (id) => set({ selectedMarkerId: id }),
      addSceneImage: (image) => set((state) => ({ sceneImages: [...state.sceneImages, image], isDirty: true })),
      removeSceneImage: (id) => set((state) => ({ sceneImages: state.sceneImages.filter((i) => i.id !== id), isDirty: true })),
      updateSceneImage: (id, updates) => set((state) => ({
        sceneImages: state.sceneImages.map((i) => i.id === id ? { ...i, ...updates } : i),
        isDirty: true,
      })),
      setSceneImages: (images) => set({ sceneImages: images }),
      setSelectedImageId: (id) => set({ selectedImageId: id }),
      setPlacingImageId: (id) => set({ placingImageId: id }),
      setGridVisible: (visible) => set({ gridVisible: visible }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setCameraInfoVisible: (visible) => set({ cameraInfoVisible: visible }),
      setFitToViewFn: (fn) => set({ fitToViewFn: fn }),
      setGetCameraState: (fn) => set({ getCameraState: fn }),
      setSetCameraState: (fn) => set({ setCameraState: fn }),
      setSavedCameraConfig: (config) => set({ savedCameraConfig: config }),
      bumpSceneVersion: () => set((s) => ({ sceneVersion: s.sceneVersion + 1 })),
      setXrayMode: (enabled) => set({ xrayMode: enabled }),
      setHighlightManager: (mgr) => set({ highlightManager: mgr }),
      setInvalidateFn: (fn) => set({ invalidateFn: fn }),
      resetEdit: () => set(initialState),
    }),
    {
      /** 时间旅行历史记录上限 */
      limit: 50,
      /** 自定义相等判断：仅当编辑数据、自动旋转、背景颜色、标点数据、光照、背景配置变化时记录历史 */
      equality: (pastState, currentState) =>
        JSON.stringify(pastState.editData) === JSON.stringify(currentState.editData)
        && pastState.autoRotate === currentState.autoRotate
        && pastState.autoRotateAxis === currentState.autoRotateAxis
        && pastState.autoRotateSpeed === currentState.autoRotateSpeed
        && pastState.backgroundColor === currentState.backgroundColor
        && JSON.stringify(pastState.markers) === JSON.stringify(currentState.markers)
        && JSON.stringify(pastState.sceneImages) === JSON.stringify(currentState.sceneImages)
        && pastState.ambientIntensity === currentState.ambientIntensity
        && pastState.lightIntensity === currentState.lightIntensity
        && pastState.lightColor === currentState.lightColor
        && JSON.stringify(pastState.backgroundConfig) === JSON.stringify(currentState.backgroundConfig),
    }
  )
)

/** 时间旅行 Store（用于撤销/重做） */
export const useTemporalStore = useEditStore.temporal

export type EditStoreApi = typeof useEditStore
