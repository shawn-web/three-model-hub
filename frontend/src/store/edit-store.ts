import { create } from 'zustand'
import { temporal } from 'zundo'
import type * as THREE from 'three'
import type { MarkerData, SceneImage } from '../types/edit-data'

/** 场景背景配置 */
export type BackgroundConfig =
  | { type: 'color'; color: string }
  | { type: 'image'; url: string }
  | { type: 'skybox'; urls: [string, string, string, string, string, string] }
  | { type: 'hdr'; url: string }

/** 变换操作模式 */
export type TransformMode = 'translate' | 'rotate' | 'scale'

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
  /** 背景颜色 */
  backgroundColor: string
  /** 场景背景配置 */
  backgroundConfig: BackgroundConfig | null
  /** 标点数据列表 */
  markers: MarkerData[]
  /** 是否正在添加标点 */
  addingMarker: boolean
  /** 场景图片列表 */
  sceneImages: SceneImage[]
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
  setTransformMode: (mode: TransformMode) => void
  /** 更新构件变换数据 */
  updateComponentTransform: (uuid: string, transform: Partial<{ position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }>) => void
  /** 更新构件材质数据 */
  updateComponentMaterial: (uuid: string, material: { color?: string | null; opacity?: number | null }) => void
  /** 更新构件可见性 */
  updateComponentVisibility: (uuid: string, visible: boolean) => void
  /** 更新构件名称 */
  updateComponentName: (uuid: string, name: string | null) => void
  /** 更新构件描述 */
  updateComponentDescription: (uuid: string, description: string | null) => void
  /** 批量加载编辑数据 */
  loadEditData: (data: Record<string, EditComponentData>) => void
  /** 设置自动旋转 */
  setAutoRotate: (value: boolean) => void
  /** 设置背景颜色 */
  setBackgroundColor: (color: string) => void
  /** 设置场景背景配置 */
  setBackgroundConfig: (config: BackgroundConfig | null) => void
  /** 添加标点 */
  addMarker: (marker: MarkerData) => void
  /** 移除标点 */
  removeMarker: (id: string) => void
  /** 更新标点数据 */
  updateMarker: (id: string, updates: Partial<MarkerData>) => void
  /** 设置是否正在添加标点 */
  setAddingMarker: (value: boolean) => void
  /** 添加场景图片 */
  addSceneImage: (image: SceneImage) => void
  /** 移除场景图片 */
  removeSceneImage: (id: string) => void
  /** 更新场景图片数据 */
  updateSceneImage: (id: string, updates: Partial<SceneImage>) => void
  /** 批量设置场景图片列表 */
  setSceneImages: (images: SceneImage[]) => void
  setCameraInfoVisible: (visible: boolean) => void
  /** 设置适配视图函数 */
  setFitToViewFn: (fn: (() => void) | null) => void
  /** 注册获取相机状态的回调 */
  setGetCameraState: (fn: EditState['getCameraState']) => void
  /** 注册设置相机状态的回调 */
  setSetCameraState: (fn: EditState['setCameraState']) => void
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
})

/** 初始状态 */
const initialState: EditState = {
  modelUrl: null,
  modelObject: null,
  modelLoading: false,
  modelLoadingProgress: 0,
  isDirty: false,
  selectedComponentId: null,
  transformMode: 'translate',
  editData: {},
  autoRotate: false,
  backgroundColor: '#1a1a2e',
  backgroundConfig: null,
  markers: [],
  addingMarker: false,
  sceneImages: [],
  cameraInfoVisible: false,
  fitToViewFn: null,
  getCameraState: null,
  setCameraState: null,
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
      selectComponent: (id) => set({ selectedComponentId: id }),
      setSelectedComponentId: (id) => set({ selectedComponentId: id }),
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
        }
      }),

      loadEditData: (data) => set({ editData: data }),
      setAutoRotate: (value) => set({ autoRotate: value }),
      setBackgroundColor: (color) => set({ backgroundColor: color }),
      setBackgroundConfig: (config) => {
        set({ backgroundConfig: config, isDirty: true })
      },

      addMarker: (marker) => set((state) => ({ markers: [...state.markers, marker] })),
      removeMarker: (id) => set((state) => ({ markers: state.markers.filter((m) => m.id !== id) })),
      updateMarker: (id, updates) => set((state) => ({
        markers: state.markers.map((m) => m.id === id ? { ...m, ...updates } : m),
      })),
      setAddingMarker: (value) => set({ addingMarker: value }),
      addSceneImage: (image) => set((state) => ({ sceneImages: [...state.sceneImages, image], isDirty: true })),
      removeSceneImage: (id) => set((state) => ({ sceneImages: state.sceneImages.filter((i) => i.id !== id), isDirty: true })),
      updateSceneImage: (id, updates) => set((state) => ({
        sceneImages: state.sceneImages.map((i) => i.id === id ? { ...i, ...updates } : i),
        isDirty: true,
      })),
      setSceneImages: (images) => set({ sceneImages: images }),
      setCameraInfoVisible: (visible) => set({ cameraInfoVisible: visible }),
      setFitToViewFn: (fn) => set({ fitToViewFn: fn }),
      setGetCameraState: (fn) => set({ getCameraState: fn }),
      setSetCameraState: (fn) => set({ setCameraState: fn }),
      resetEdit: () => set(initialState),
    }),
    {
      /** 时间旅行历史记录上限 */
      limit: 50,
      /** 自定义相等判断：仅当编辑数据、自动旋转、背景颜色、标点数据变化时记录历史 */
      equality: (pastState, currentState) =>
        JSON.stringify(pastState.editData) === JSON.stringify(currentState.editData)
        && pastState.autoRotate === currentState.autoRotate
        && pastState.backgroundColor === currentState.backgroundColor
        && JSON.stringify(pastState.markers) === JSON.stringify(currentState.markers),
    }
  )
)

/** 时间旅行 Store（用于撤销/重做） */
export const useTemporalStore = useEditStore.temporal

export type EditStoreApi = typeof useEditStore
