import { create } from 'zustand'
import type * as THREE from 'three'
import type { MarkerData, SceneMedia } from '../types/edit-data'

export interface ViewerState {
  modelUrl: string | null
  modelObject: THREE.Group | null
  modelLoading: boolean
  modelLoadingProgress: number
  modelError: string | null
  activePluginId: string | null
  installedPlugins: string[]
  visibleTools: string[]
  hiddenTools: string[]
  environmentPreset: string
  toolbarVisible: boolean
  treeVisible: boolean
  cameraInfoVisible: boolean
  rotationMode: boolean
  /** 当前选中的构件 UUID */
  selectedComponentId: string | null
  /** 透视模式开关 */
  xrayMode: boolean
  /** 当前场景 ID（用于视点保存等） */
  sceneId: string | null
  /** 当前查看模式：scene（场景）或 model（单个模型） */
  viewerType: 'scene' | 'model' | null
  /** 场景配置（包含背景设置等） */
  sceneConfig: Record<string, unknown> | null
  /** 场景标点数据 */
  markers: MarkerData[]
  /** 场景媒体数据 */
  sceneImages: SceneMedia[]
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

export interface ViewerActions {
  setModelUrl: (url: string | null) => void
  setModelObject: (obj: THREE.Group | null) => void
  setModelLoading: (loading: boolean) => void
  setModelLoadingProgress: (percent: number) => void
  setModelError: (error: string | null) => void
  setActivePluginId: (id: string | null) => void
  setInstalledPlugins: (ids: string[]) => void
  setVisibleTools: (tools: string[]) => void
  setHiddenTools: (tools: string[]) => void
  setEnvironmentPreset: (preset: string) => void
  setToolbarVisible: (visible: boolean) => void
  setTreeVisible: (visible: boolean) => void
  setCameraInfoVisible: (visible: boolean) => void
  setRotationMode: (enabled: boolean) => void
  /** 设置选中的构件 ID */
  setSelectedComponentId: (id: string | null) => void
  /** 设置透视模式 */
  setXrayMode: (enabled: boolean) => void
  resetViewer: () => void
  /** 设置当前场景 ID */
  setSceneId: (sceneId: string | null) => void
  setViewerType: (type: 'scene' | 'model' | null) => void
  /** 设置场景配置 */
  setSceneConfig: (config: Record<string, unknown> | null) => void
  /** 设置场景标点数据 */
  setMarkers: (markers: MarkerData[]) => void
  /** 设置场景媒体数据 */
  setSceneImages: (images: SceneMedia[]) => void
  /** 注册获取相机状态的回调 */
  setGetCameraState: (fn: ViewerState['getCameraState']) => void
  /** 注册设置相机状态的回调 */
  setSetCameraState: (fn: ViewerState['setCameraState']) => void
}

const initialState: ViewerState = {
  modelUrl: null,
  modelObject: null,
  modelLoading: false,
  modelLoadingProgress: 0,
  modelError: null,
  activePluginId: null,
  installedPlugins: [],
  visibleTools: [],
  hiddenTools: [],
  environmentPreset: 'none',
  toolbarVisible: true,
  treeVisible: true,
  cameraInfoVisible: false,
  rotationMode: false,
  selectedComponentId: null,
  xrayMode: false,
  sceneId: null,
  viewerType: null,
  sceneConfig: null,
  markers: [],
  sceneImages: [],
  getCameraState: null,
  setCameraState: null,
}

export const useViewerStore = create<ViewerState & ViewerActions>()((set) => ({
  ...initialState,

  setModelUrl: (url) => set({ modelUrl: url }),
  setModelObject: (obj) => set({ modelObject: obj }),
  setModelLoading: (loading) => set({ modelLoading: loading, modelLoadingProgress: loading ? 0 : 0 }),
  setModelLoadingProgress: (percent) => set({ modelLoadingProgress: percent }),
  setModelError: (error) => set({ modelError: error }),
  setActivePluginId: (id) => set({ activePluginId: id }),
  setInstalledPlugins: (ids) => set({ installedPlugins: ids }),
  setVisibleTools: (tools) => set({ visibleTools: tools }),
  setHiddenTools: (tools) => set({ hiddenTools: tools }),
  setEnvironmentPreset: (preset) => set({ environmentPreset: preset }),
  setToolbarVisible: (visible) => set({ toolbarVisible: visible }),
  setTreeVisible: (visible) => set({ treeVisible: visible }),
  setCameraInfoVisible: (visible) => set({ cameraInfoVisible: visible }),
  setRotationMode: (enabled) => set({ rotationMode: enabled }),
  setSelectedComponentId: (id) => set({ selectedComponentId: id }),
  setXrayMode: (enabled) => set({ xrayMode: enabled }),
  resetViewer: () => set(initialState),

  setSceneId: (sceneId) => set({ sceneId }),
  setViewerType: (type) => set({ viewerType: type }),
  setSceneConfig: (config) => set({ sceneConfig: config }),
  setMarkers: (markers) => set({ markers }),
  setSceneImages: (sceneImages) => set({ sceneImages }),

  setGetCameraState: (fn) => set({ getCameraState: fn }),
  setSetCameraState: (fn) => set({ setCameraState: fn }),
}))

export type ViewerStoreApi = typeof useViewerStore
